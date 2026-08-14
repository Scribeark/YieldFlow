const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkApi() {
  try {
    // We don't necessarily need to auth to call get_marketplace_listings if it's public? 
    // Or we can auth using a known buyer. We don't have a known buyer password.
    // Let's try calling it anonymously first.
    const { data: hp } = await supabase.from('harvest_predictions').select('*').eq('id', '14e12dc2-0e07-4ec8-a2d5-1cbe17efec58');
    console.log('harvest_predictions:', hp);

    const { data: bol } = await supabase.from('bulk_offtake_listings').select('*').eq('id', '14e12dc2-0e07-4ec8-a2d5-1cbe17efec58');
    console.log('bulk_offtake_listings:', bol);
  } catch (err) {
    console.error(err);
  }
}

checkApi();
