const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

function log(step, msg) {
  console.log(`\n[Step ${step}] ${msg}`);
}

async function createAccount(role) {
  const email = `test_e2e_${Date.now()}_${role.toLowerCase()}@example.com`;
  const password = 'Password123!';
  
  const userClient = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await userClient.auth.signUp({ email, password });
  
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
  
  return { email, password, id: data.user.id, token, client: userClient };
}

async function callRpc(client, rpcName, payload) {
  const { data, error } = await client.rpc(rpcName, payload);
  if (error) throw new Error(`RPC ${rpcName} failed: ${error.message} - ${error.details}`);
  return data;
}

async function runE2E() {
  try {
    let step = 1;

    // 1. Create Accounts
    log(step++, "Creating disposable accounts...");
    const seller = await createAccount('FARMER');
    const buyer = await createAccount('BUYER');

    // 2. Listing publication
    log(step++, "Seller publishes Bulk Bidding Sale...");
    const listingData = await callRpc(seller.client, 'rpc_publish_bulk_bidding_sale', {
      p_asking_price_per_unit: 5000,
      p_crop_type: 'E2E Complete Maize',
      p_expected_harvest_date: new Date(Date.now() + 86400000 * 2).toISOString(),
      p_expected_quantity: 1000,
      p_expected_quantity_unit: 'kg',
      p_pickup_address: '123 E2E Farm, Kano',
      p_pickup_latitude: 12.0,
      p_pickup_longitude: 8.5,
      p_planting_date: new Date(Date.now() - 86400000 * 90).toISOString(),
      p_seller_note: 'E2E Full Flow Test'
    });
    const listingId = listingData.listing_id;
    console.log("Created Listing ID:", listingId);

    // 3. Marketplace retrieval
    log(step++, "Buyer retrieves marketplace opportunities...");
    const marketplaceData = await callRpc(buyer.client, 'get_marketplace_listings');
    const foundListing = marketplaceData.find(m => m.id === listingId);
    if (!foundListing) throw new Error("Listing not found in marketplace retrieval!");
    console.log("SUCCESS: Found listing in marketplace.");

    // 4. Offer submission
    log(step++, "Buyer submits purchase offer...");
    const bidData = await callRpc(buyer.client, 'rpc_submit_harvest_bid', {
      p_listing_id: listingId,
      p_quantity: 500,
      p_price: 4500,
      p_message: 'Will take 500kg'
    });
    const bidId = bidData.bid_id;
    console.log("Submitted Bid ID:", bidId);

    // Verify Prediction ID is NULL
    const { data: bidCheck } = await buyer.client.from('harvest_bids').select('*').eq('id', bidId).single();
    if (bidCheck.prediction_id !== null) throw new Error("prediction_id is not null!");
    console.log("SUCCESS: prediction_id is NULL.");

    // 5. Seller counter
    log(step++, "Seller counteroffers...");
    await callRpc(seller.client, 'rpc_counter_harvest_bid', {
      p_bid_id: bidId,
      p_quantity: 500,
      p_price: 4800,
      p_message: 'How about 4800?'
    });
    console.log("SUCCESS: Seller countered.");

    // 6. Buyer counter
    log(step++, "Buyer counteroffers back...");
    await callRpc(buyer.client, 'rpc_counter_harvest_bid', {
      p_bid_id: bidId,
      p_quantity: 500,
      p_price: 4700,
      p_message: 'Deal at 4700.'
    });
    console.log("SUCCESS: Buyer countered.");

    // 7. Acceptance (Seller accepts Buyer's counter)
    log(step++, "Seller accepts the offer...");
    await callRpc(seller.client, 'rpc_accept_harvest_bid', {
      p_bid_id: bidId
    });
    console.log("SUCCESS: Seller accepted the bid.");

    // 8. Quantity allocation check
    log(step++, "Checking Quantity allocation...");
    const mp1 = await callRpc(buyer.client, 'get_marketplace_listings');
    const listingCheck = mp1.find(m => m.id === listingId);
    if (!listingCheck) throw new Error("Listing not found");
    if (listingCheck.provisionally_allocated !== 500 || listingCheck.remaining_quantity !== 500) {
      throw new Error(`Quantity mismatch: alloc=${listingCheck.provisionally_allocated}, rem=${listingCheck.remaining_quantity}`);
    }
    console.log("SUCCESS: Quantity correctly allocated (500 allocated, 500 remaining).");

    // 9. Cancellation and quantity restoration
    log(step++, "Buyer cancels the provisional agreement...");
    await callRpc(buyer.client, 'rpc_cancel_provisional_agreement', {
      p_bid_id: bidId,
      p_reason: 'Testing cancellation restoration'
    });
    console.log("SUCCESS: Cancelled agreement.");

    // Verify Restoration
    const mp2 = await callRpc(buyer.client, 'get_marketplace_listings');
    const listingCheckRestored = mp2.find(m => m.id === listingId);
    if (listingCheckRestored.provisionally_allocated !== 0 || listingCheckRestored.remaining_quantity !== 1000) {
      throw new Error(`Quantity restoration failed: alloc=${listingCheckRestored.provisionally_allocated}, rem=${listingCheckRestored.remaining_quantity}`);
    }
    console.log("SUCCESS: Quantity correctly restored (0 allocated, 1000 remaining).");

    // Re-create Offer and Accept for continuing flow
    log(step++, "Re-submitting and accepting bid for continuing test...");
    const bidData2 = await callRpc(buyer.client, 'rpc_submit_harvest_bid', {
      p_listing_id: listingId,
      p_quantity: 1000,
      p_price: 5000,
      p_message: 'Taking all 1000kg'
    });
    const bidId2 = bidData2.bid_id;
    await callRpc(seller.client, 'rpc_accept_harvest_bid', { p_bid_id: bidId2 });
    console.log("SUCCESS: Re-created accepted bid.");

    // 10. Harvest declaration
    log(step++, "Seller declares harvest available...");
    await callRpc(seller.client, 'rpc_declare_harvest_availability', {
      p_listing_id: listingId
    });
    console.log("SUCCESS: Harvest declared available.");

    // 11. Seller evidence upload
    log(step++, "Seller uploads evidence...");
    const fileContent = new Blob(['dummy evidence'], { type: 'image/jpeg' });
    const fileName = `dummy_${Date.now()}.jpg`;
    await seller.client.storage.from('harvest_evidence').upload(fileName, fileContent);
    const dummyUrl = fileName;
    
    await callRpc(seller.client, 'rpc_upload_harvest_evidence', {
      p_listing_id: listingId,
      p_photo_url: dummyUrl
    });
    console.log("SUCCESS: Evidence uploaded.");

    // 12. Buyer rejection
    log(step++, "Buyer rejects evidence...");
    await callRpc(buyer.client, 'rpc_review_buyer_evidence', {
      p_bid_id: bidId2,
      p_decision: 'REJECTED',
      p_reason: 'Blurry photo, please retake.'
    });
    console.log("SUCCESS: Evidence rejected.");

    // 13. Replacement evidence
    log(step++, "Seller uploads replacement evidence...");
    const replacementFileName = `dummy_v2_${Date.now()}.jpg`;
    await seller.client.storage.from('harvest_evidence').upload(replacementFileName, fileContent);
    const replacementUrl = replacementFileName;
    
    await callRpc(seller.client, 'rpc_upload_harvest_evidence', {
      p_listing_id: listingId,
      p_photo_url: replacementUrl
    });
    console.log("SUCCESS: Replacement evidence uploaded.");

    // 14. Buyer approval & Exactly one established trade
    log(step++, "Buyer approves evidence...");
    await callRpc(buyer.client, 'rpc_review_buyer_evidence', {
      p_bid_id: bidId2,
      p_decision: 'APPROVED'
    });
    console.log("SUCCESS: Evidence approved.");

    // Check trade
    const trades = await callRpc(buyer.client, 'rpc_get_buyer_orders');
    if (!trades || trades.length !== 1) {
      throw new Error(`Trade establishment failed. Expected 1 trade, found ${trades ? trades.length : 0}`);
    }
    if (trades[0].harvest_prediction_id !== null) {
        throw new Error("FAILED: harvest_prediction_id is not null on new trade!");
    }
    console.log("SUCCESS: Exactly one trade established. harvest_prediction_id is NULL.");

    // 15. Repeat approval idempotency
    log(step++, "Testing repeat approval idempotency...");
    try {
      await callRpc(buyer.client, 'rpc_review_buyer_evidence', {
        p_bid_id: bidId2,
        p_decision: 'APPROVED'
      });
      console.log("WARNING: Second approval succeeded without throwing. Checking if duplicate trades exist.");
    } catch (e) {
      console.log("SUCCESS: Second approval was properly rejected or handled idempotently. Error:", e.message);
    }
    const tradesCheck2 = await callRpc(buyer.client, 'rpc_get_buyer_orders');
    if (tradesCheck2.length !== 1) {
      throw new Error(`Idempotency failed. Expected 1 trade, found ${tradesCheck2.length}`);
    }
    console.log("SUCCESS: Idempotency confirmed. Still exactly 1 trade.");

    // 16. Logistics eligibility
    log(step++, "Checking Logistics eligibility...");
    // If trade_status is IN_PROGRESS, logistics can be requested or carrier assigned.
    console.log("Trade status is:", trades[0].trade_status);
    if (!['PENDING_LOGISTICS', 'IN_PROGRESS', 'ACCEPTED'].includes(trades[0].trade_status)) {
       throw new Error(`Trade status not valid for logistics: ${trades[0].trade_status}`);
    }
    console.log("SUCCESS: Logistics is eligible.");

    console.log("\n=================================");
    console.log("ALL E2E TESTS COMPLETED SUCCESSFULLY");
    console.log("=================================");

  } catch (err) {
    console.error("\nE2E Test Failed:");
    console.error(err);
    process.exit(1);
  }
}

runE2E();
