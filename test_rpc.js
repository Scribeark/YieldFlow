const { createClient } = require('@supabase/supabase-js');


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = `test_seller_${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  
  console.log(`Signing up ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }
  
  // Create user profile
  console.log('Creating public.users profile...');
  const { error: profileError } = await supabase.from('users').insert({
    auth_uid: authData.user.id,
    full_name: 'Test Seller',
    phone_number: '080' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
    age: 30,
    gender: 'Male',
    declared_profession: 'Smallholder Farmer',
    macro_region: 'Ibadan Central Hub',
    verification_status: 'verified'
  });
  if (profileError) {
    console.error('Profile Error:', profileError.message);
    return;
  }
  
  console.log('Calling rpc_publish_bulk_bidding_sale...');
  const { data, error } = await supabase.rpc('rpc_publish_bulk_bidding_sale', {
    p_asking_price_per_unit: 100,
    p_crop_type: 'Maize',
    p_expected_harvest_date: new Date(Date.now() + 86400000 * 30).toISOString(),
    p_expected_quantity: 500,
    p_expected_quantity_unit: 'kg',
    p_pickup_address: '123 Test Farm',
    p_pickup_latitude: 9.0,
    p_pickup_longitude: 8.0,
    p_planting_date: new Date(Date.now() - 86400000 * 10).toISOString(),
    p_seller_note: 'Test note'
  });
  
  if (error) {
    console.error('RPC Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('RPC Success:', JSON.stringify(data, null, 2));
  }
}

main();
