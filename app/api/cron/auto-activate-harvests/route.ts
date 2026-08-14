import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This function can only be executed by Vercel Cron or with the CRON_SECRET header
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Initialize Supabase with service role key to bypass RLS for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('rpc_auto_activate_expected_harvests');

    if (error) {
      console.error('Error executing rpc_auto_activate_expected_harvests:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Cron job executed successfully', data });
  } catch (err: any) {
    console.error('Unexpected error in cron job:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
