import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('trade_requests').select('*').limit(1);
  if (error) console.error("Error:", error);
  else console.log("trade_requests row:", data[0]);

  // Also let's check bulk_offtake_listings evidence status
  const { data: bData } = await supabase.from('bulk_offtake_listings').select('evidence_status').limit(1);
  console.log("bulk_offtake_listings row:", bData && bData[0]);
}
run();
