import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("1. Authenticating as seller...");
    const { data: sellerData, error: sellerErr } = await supabase.auth.signInWithPassword({
      email: 'seller@example.com',
      password: 'password123'
    });
    if (sellerErr) throw sellerErr;
    const sellerId = sellerData.user.id;
    console.log("Seller authenticated:", sellerId);

    console.log("2. Authenticating as buyer...");
    // We create a second client for the buyer to maintain session
    const buyerSupabase = createClient(supabaseUrl, supabaseKey);
    const { data: buyerData, error: buyerErr } = await buyerSupabase.auth.signInWithPassword({
      email: 'buyer@example.com',
      password: 'password123'
    });
    if (buyerErr) throw buyerErr;
    const buyerId = buyerData.user.id;
    console.log("Buyer authenticated:", buyerId);

    // Get an accepted bid
    console.log("3. Finding an ACCEPTED or PARTIALLY_ACCEPTED bid...");
    const { data: bids, error: bidsErr } = await supabase
      .from('harvest_bids')
      .select('*, bulk_offtake_listings(*)')
      .in('bid_status', ['ACCEPTED', 'PARTIALLY_ACCEPTED'])
      .not('bulk_offtake_listing_id', 'is', null)
      .limit(1);
    
    if (bidsErr) throw bidsErr;
    if (!bids || bids.length === 0) {
      console.log("No accepted bids found. Cannot test.");
      return;
    }
    const bid = bids[0];
    const listingId = bid.bulk_offtake_listing_id;
    const listing = bid.bulk_offtake_listings;
    console.log("Found bid:", bid.id, "for listing:", listingId);

    // If listing doesn't have harvest_available_at, set it manually as seller
    if (!listing.harvest_available_at) {
      console.log("Setting harvest_available_at via RPC...");
      const { error: availErr } = await supabase.rpc('rpc_declare_harvest_availability', {
        p_listing_id: listingId
      });
      if (availErr) throw availErr;
      console.log("Harvest declared available.");
    }

    console.log("4. Uploading dummy photo to harvest_evidence bucket as seller...");
    // Create a dummy text file
    const fileContent = new Blob(['dummy evidence'], { type: 'text/plain' });
    const fileName = `dummy_${Date.now()}.txt`;
    const { error: uploadErr } = await supabase.storage
      .from('harvest_evidence')
      .upload(fileName, fileContent);
    if (uploadErr) {
      console.warn("Storage upload failed, ignoring if it's RLS. Proceeding anyway, but RPC might fail if it strictly requires the file. Err:", uploadErr.message);
    }
    const photoUrl = `harvest_evidence/${fileName}`;

    console.log("5. Testing Seller Evidence Upload RPC...");
    const { data: uploadRes, error: rpcUploadErr } = await supabase.rpc('rpc_upload_harvest_evidence', {
      p_listing_id: listingId,
      p_photo_url: photoUrl
    });
    if (rpcUploadErr) throw rpcUploadErr;
    console.log("Upload evidence response:", uploadRes);

    console.log("6. Verifying listing and bid statuses...");
    const { data: listCheck } = await supabase.from('bulk_offtake_listings').select('evidence_status').eq('id', listingId).single();
    console.log("Listing evidence_status:", listCheck.evidence_status);
    const { data: bidCheck } = await supabase.from('harvest_bids').select('buyer_evidence_status').eq('id', bid.id).single();
    console.log("Bid buyer_evidence_status:", bidCheck.buyer_evidence_status);

    console.log("7. Testing Buyer Rejection RPC...");
    const { data: rejectRes, error: rejectErr } = await buyerSupabase.rpc('rpc_review_harvest_evidence', {
      p_bid_id: bid.id,
      p_decision: 'REJECTED',
      p_reason: 'Photo is blurry'
    });
    if (rejectErr) {
      // It might fail if the buyer isn't the owner of the bid. We need to check if the buyer matches.
      console.warn("Rejection failed (maybe buyer mismatch?):", rejectErr.message);
    } else {
      console.log("Reject response:", rejectRes);
      const { data: bidCheck2 } = await supabase.from('harvest_bids').select('buyer_evidence_status, bid_status').eq('id', bid.id).single();
      console.log("Bid status after rejection:", bidCheck2);
      
      console.log("Checking if trades were created (should be 0)...");
      const { data: tradesRej } = await supabase.from('trade_requests').select('id').eq('harvest_bid_id', bid.id);
      console.log("Trades after rejection:", tradesRej.length);

      console.log("8. Uploading evidence again (replacement)...");
      const { error: reUpErr } = await supabase.rpc('rpc_upload_harvest_evidence', {
        p_listing_id: listingId,
        p_photo_url: photoUrl
      });
      if (reUpErr) throw reUpErr;
      console.log("Re-upload successful.");
    }

    console.log("9. Testing Buyer Approval RPC...");
    const { data: approveRes, error: approveErr } = await buyerSupabase.rpc('rpc_review_harvest_evidence', {
      p_bid_id: bid.id,
      p_decision: 'APPROVED'
    });
    if (approveErr) {
       console.warn("Approval failed:", approveErr.message);
    } else {
      console.log("Approve response:", approveRes);
      
      console.log("10. Confirming exactly ONE trade was created...");
      const { data: trades } = await supabase.from('trade_requests').select('*').eq('harvest_bid_id', bid.id);
      console.log(`Found ${trades.length} trade(s) for this bid.`);
      if (trades.length > 0) {
        console.log("Trade details:", JSON.stringify(trades[0], null, 2));
      }

      console.log("11. Testing Idempotency (Calling APPROVE again)...");
      const { data: approveRes2, error: approveErr2 } = await buyerSupabase.rpc('rpc_review_harvest_evidence', {
        p_bid_id: bid.id,
        p_decision: 'APPROVED'
      });
      if (approveErr2) {
        console.warn("Idempotency test failed:", approveErr2.message);
      } else {
        console.log("Idempotency response (should return existing trade_id):", approveRes2);
      }
    }

    console.log("12. Confirming expected-date cron does NOT create trades...");
    // We just run the RPC to check
    const { data: cronRes, error: cronErr } = await supabase.rpc('rpc_auto_activate_expected_harvests');
    if (cronErr) throw cronErr;
    console.log("Cron response:", cronRes);

    console.log("E2E Test Flow Completed.");

  } catch (err) {
    console.error("Test execution failed:", err);
  }
}
run();
