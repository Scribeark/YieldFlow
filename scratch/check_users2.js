const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authClient = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = `test_FARMER_${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  const { data, error } = await authClient.auth.signUp({ email, password });
  if (error) throw error;
  
  await new Promise(r => setTimeout(r, 2000));
  
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  const token = signInData.session.access_token;
  
  const userClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  await userClient.auth.setSession({
    access_token: token,
    refresh_token: signInData.session.refresh_token
  });
  
  // Try to query users
  const { data: users, error: usersErr } = await userClient.from('users').select('*');
  console.log("Users fetch:", usersErr || users);
  
  // Try to query user_profiles
  const { data: profiles, error: profErr } = await userClient.from('user_profiles').select('*');
  console.log("Profiles fetch:", profErr || profiles);
}
main().catch(console.error);
