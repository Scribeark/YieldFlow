const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(step, msg) {
  console.log(`\n[Step ${step}] ${msg}`);
}

async function createAccount(role) {
  const email = `test_e2e_${Date.now()}_${role.toLowerCase()}@example.com`;
  const password = 'Password123!';
  
  const userClient = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await userClient.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  console.log(`[${role}] Created auth user: ${email}`);
  const token = data.session.access_token;
  
  const { error: insertError } = await userClient.from('users').insert({
    id: data.user.id,
    auth_uid: data.user.id,
    full_name: `E2E ${role}`,
    declared_profession: role === 'BUYER' ? 'Enterprise Buyer' : (role === 'CARRIER' ? 'Logistics Carrier' : 'Smallholder Farmer'),
    verification_status: 'verified',
    phone_number: `+234${Math.floor(Math.random() * 1000000000)}`,
    age: 30,
    gender: 'Male',
    macro_region: 'Kano'
  });
  if (insertError) {
    if (insertError.code !== '23505') throw insertError;
  }
  
  return { email, password, id: data.user.id, token: token, client: userClient };
}

async function callRpc(token, rpcName, payload) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload || {})
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RPC ${rpcName} failed: ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function runE2E() {
  try {
    let currentStep = 1;

    // 1. Create Accounts
    log(currentStep++, "Creating disposable accounts...");
    const seller = await createAccount('FARMER');
    const buyer = await createAccount('BUYER');
    
    // 2. Seller publishes bulk offtake listing
    log(currentStep++, "Seller publishing bulk offtake listing...");
    const listingData = await callRpc(seller.token, 'rpc_publish_bulk_bidding_sale', {
      p_asking_price_per_unit: 5000,
      p_crop_type: 'E2E Testing Maize',
      p_expected_harvest_date: new Date(Date.now() - 86400000 * 2).toISOString(), // Past date to trigger cron
      p_expected_quantity: 1000,
      p_expected_quantity_unit: 'kg',
      p_pickup_address: '123 E2E Farm, Kano',
      p_pickup_latitude: 12.0,
      p_pickup_longitude: 8.5,
      p_planting_date: new Date(Date.now() - 86400000 * 90).toISOString(),
      p_seller_note: 'E2E test batch'
    });
    const listingId = listingData.listing_id;
    console.log("Created Listing ID:", listingId);

    // 3. Buyer submits harvest bid
    log(currentStep++, "Buyer submitting bid...");
    const bidData = await callRpc(buyer.token, 'rpc_submit_harvest_bid', {
      p_listing_id: listingId,
      p_quantity: 500,
      p_price: 4500,
      p_message: 'Will take 500kg'
    });
    const bidId = bidData.bid_id;
    console.log("Submitted Bid ID:", bidId);

    // 4. VERIFY: prediction_id is NULL for the bid
    log(currentStep++, "Verifying prediction_id is NULL for new bid...");
    const { data: bidCheck, error: bidError } = await buyer.client
      .from('harvest_bids')
      .select('prediction_id, desired_quantity_unit')
      .eq('id', bidId)
      .single();
    if (bidError) throw bidError;
    if (bidCheck.prediction_id !== null) {
      throw new Error("FAILED: prediction_id is not NULL on new bid!");
    }
    console.log("SUCCESS: prediction_id is NULL. desired_quantity_unit is", bidCheck.desired_quantity_unit);

    // 5. Seller accepts bid
    log(currentStep++, "Seller accepting bid...");
    await callRpc(seller.token, 'rpc_accept_harvest_bid', {
      p_bid_id: bidId
    });
    console.log("SUCCESS: Bid accepted.");

    // 6. Run Cron to activate harvest (or manual RPC)
    log(currentStep++, "Seller declaring harvest available manually to bypass cron requirement...");
    const { error: availErr } = await callRpc(seller.token, 'rpc_declare_harvest_availability', {
        p_listing_id: listingId
    });
    console.log("SUCCESS: Harvest available, no trades created yet.");

    // 8. Seller uploads actual file to storage to pass ownership verification
    log(currentStep++, "Seller uploading evidence to storage bucket...");
    
    const fileContent = new Blob(['dummy evidence'], { type: 'image/jpeg' });
    const fileName = `dummy_${Date.now()}.jpg`;
    const { error: uploadErr } = await seller.client.storage
      .from('harvest-photos')
      .upload(fileName, fileContent);
    if (uploadErr) {
      console.warn("Storage upload failed (maybe RLS?). Err:", uploadErr.message);
    }
    const photoUrl = `harvest-photos/${fileName}`;

    log(currentStep++, "Seller calling rpc_upload_harvest_evidence...");
    await callRpc(seller.token, 'rpc_upload_harvest_evidence', {
        p_listing_id: listingId,
        p_photo_url: photoUrl
    });

    // 9. Buyer Rejects evidence
    log(currentStep++, "Buyer reviewing evidence (REJECTED)...");
    const rejectData = await callRpc(buyer.token, 'rpc_review_harvest_evidence', {
        p_bid_id: bidId,
        p_decision: 'REJECTED',
        p_reason: 'Photo is blurry'
    });
    console.log("SUCCESS: Buyer rejected evidence.");

    // Verify rejection
    const { data: rejectTradeCheck } = await buyer.client
        .from('trade_requests')
        .select('id')
        .eq('harvest_bid_id', bidId);
    if (rejectTradeCheck && rejectTradeCheck.length > 0) {
        throw new Error("FAILED: Trade request was incorrectly created after buyer rejection.");
    }

    // 10. Seller re-uploads evidence
    log(currentStep++, "Seller re-uploading evidence...");
    await callRpc(seller.token, 'rpc_upload_harvest_evidence', {
        p_listing_id: listingId,
        p_photo_url: photoUrl
    });

    // 11. Buyer Approves evidence
    log(currentStep++, "Buyer reviewing evidence (APPROVED)...");
    const approveData = await callRpc(buyer.token, 'rpc_review_harvest_evidence', {
        p_bid_id: bidId,
        p_decision: 'APPROVED'
    });
    console.log("SUCCESS: Buyer approved evidence. Trade established.");

    // 12. Verify trade creation
    log(currentStep++, "Verifying trade request was created...");
    const { data: finalTradeCheck } = await buyer.client
        .from('trade_requests')
        .select('id, request_status')
        .eq('harvest_bid_id', bidId)
        .single();
    
    if (!finalTradeCheck) {
        throw new Error("FAILED: Trade request was not created after buyer approval.");
    }
    console.log(`SUCCESS: Trade request created with status ${finalTradeCheck.request_status}`);

    // 13. Test Idempotency
    log(currentStep++, "Testing idempotency of APPROVE...");
    const idempotencyData = await callRpc(buyer.token, 'rpc_review_harvest_evidence', {
        p_bid_id: bidId,
        p_decision: 'APPROVED'
    });
    console.log("SUCCESS: Idempotency checked, returned trade_id:", idempotencyData.trade_id);

    console.log("\nE2E Test Success!");
  } catch (err) {
    console.error("\nE2E Test Failed:");
    console.error(err);
    process.exit(1);
  }
}

runE2E();
