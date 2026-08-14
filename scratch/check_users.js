const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: users, error } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Recent users in public.users:", users);
  
  const { data: profiles } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Recent profiles in public.user_profiles:", profiles);
}
main();
