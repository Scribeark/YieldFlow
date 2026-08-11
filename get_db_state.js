const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: farms } = await supabase.from('farms').select('id, name, farm_status, created_at').order('created_at', { ascending: false }).limit(3);
  console.log("=== FARMS ===");
  console.log(JSON.stringify(farms, null, 2));

  for (const farm of (farms || [])) {
    const { data: allocs } = await supabase.from('farm_crop_allocations').select('id, crop_type, allocation_status, bidding_status').eq('farm_id', farm.id);
    console.log(`\n=== ALLOCATIONS FOR FARM ${farm.id} ===`);
    console.log(JSON.stringify(allocs, null, 2));

    const { data: preds } = await supabase.from('harvest_predictions').select('id, crop_allocation_id, prediction_cycle_status, readiness_status').eq('farm_id', farm.id);
    console.log(`\n=== PREDICTIONS FOR FARM ${farm.id} ===`);
    console.log(JSON.stringify(preds, null, 2));

    for (const pred of (preds || [])) {
      const { count: bids } = await supabase.from('harvest_bids').select('*', { count: 'exact', head: true }).eq('prediction_id', pred.id);
      const { count: trades } = await supabase.from('trade_requests').select('*', { count: 'exact', head: true }).eq('harvest_id', pred.id);
      console.log(`Bids for Prediction ${pred.id}: ${bids}, Trades: ${trades}`);
    }
  }
}
run().catch(console.error);
