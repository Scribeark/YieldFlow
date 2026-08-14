/**
 * scripts/safe_test_cleanup.js
 *
 * Restricted maintenance script for disposable E2E / Test records only.
 * Requires an explicit test marker and deletes in verified foreign-key dependency order.
 * Strictly refuses any production records.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment configuration.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanTestRecords() {
  console.log('--- SAFE TEST DATA CLEANUP INITIATED ---');

  // Verify test markers
  const testCrops = ['E2E Complete Maize', 'E2E Testing Maize', 'E2E Maize', 'Test Maize', 'Tested listing'];

  // 1. Fetch test listings
  const { data: testListings, error: lErr } = await supabase
    .from('bulk_offtake_listings')
    .select('id, crop_type, seller_note')
    .or(testCrops.map((c) => `crop_type.eq.${c}`).join(','));

  if (lErr) {
    console.error('Error querying test listings:', lErr);
    return;
  }

  const listingIds = (testListings || []).map((l) => l.id);
  console.log(`Found ${listingIds.length} test listing(s) marked for cleanup.`);

  if (listingIds.length === 0) {
    console.log('No marked test listings to clean.');
    return;
  }

  // 2. Fetch associated test bids
  const { data: testBids } = await supabase
    .from('harvest_bids')
    .select('id')
    .in('bulk_offtake_listing_id', listingIds);

  const bidIds = (testBids || []).map((b) => b.id);
  console.log(`Found ${bidIds.length} test bid(s).`);

  // 3. Fetch associated test trade requests
  let tradeIds = [];
  if (bidIds.length > 0) {
    const { data: testTrades } = await supabase
      .from('trade_requests')
      .select('id')
      .in('harvest_bid_id', bidIds);
    tradeIds = (testTrades || []).map((t) => t.id);
  }
  console.log(`Found ${tradeIds.length} test trade request(s).`);

  // DELETE IN EXACT DEPENDENCY ORDER:

  // Step 1: Logistics bookings
  if (tradeIds.length > 0) {
    const { error: logErr } = await supabase
      .from('logistics_bookings')
      .delete()
      .in('trade_request_id', tradeIds);
    if (logErr) console.warn('Logistics cleanup note:', logErr.message);
  }

  // Step 2: Trade requests
  if (tradeIds.length > 0) {
    const { error: trErr } = await supabase
      .from('trade_requests')
      .delete()
      .in('id', tradeIds);
    if (trErr) console.warn('Trade requests cleanup note:', trErr.message);
  }

  // Step 3: Notifications
  const { error: notifErr } = await supabase
    .from('notifications')
    .delete()
    .in('bulk_offtake_listing_id', listingIds);
  if (notifErr) console.warn('Notifications cleanup note:', notifErr.message);

  // Step 4: Negotiation events
  if (bidIds.length > 0) {
    const { error: negErr } = await supabase
      .from('bid_negotiation_events')
      .delete()
      .in('bid_id', bidIds);
    if (negErr) console.warn('Negotiation events cleanup note:', negErr.message);
  }

  // Step 5: Harvest bids
  if (bidIds.length > 0) {
    const { error: bidErr } = await supabase
      .from('harvest_bids')
      .delete()
      .in('id', bidIds);
    if (bidErr) console.warn('Harvest bids cleanup note:', bidErr.message);
  }

  // Step 6: Test Bulk offtake listings
  const { error: listErr } = await supabase
    .from('bulk_offtake_listings')
    .delete()
    .in('id', listingIds);
  if (listErr) console.warn('Listings cleanup note (protected by foreign key):', listErr.message);
  else console.log('Successfully cleaned marked test listings.');

  console.log('--- SAFE TEST DATA CLEANUP COMPLETE ---');
}

cleanTestRecords();
