import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ymihyyqdwwwdbsuhtjbv.supabase.co').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaWh5eXFkd3d3ZGJzdWh0amJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTU1NDMsImV4cCI6MjA5NzEzMTU0M30.xIKwl_tnab8bs5BUyk4PZEAIiEZAIypVq8q8J_H1Ql8').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
