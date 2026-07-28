'use server';

import { createClient } from '@supabase/supabase-js';
import { Database } from '../database.types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Helper to get service role client
const getAdminSupabase = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL or Service Role Key in env.");
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

// Helper to get authenticated server client to check who is requesting
const getAuthSupabase = async () => {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `set` method was called from a Server Component.
          }
        },
      },
    }
  );
};

export async function bootstrapFirstAdmin(data: any) {
  const { email, password, fullName, phoneNumber, setupCode } = data;

  if (!process.env.ADMIN_SETUP_CODE) {
    return { error: 'Server configuration error: ADMIN_SETUP_CODE not set.' };
  }
  if (setupCode !== process.env.ADMIN_SETUP_CODE) {
    return { error: 'Invalid setup code.' };
  }

  const supabaseAdmin = getAdminSupabase();

  // 1. Check if any admin already exists
  const { data: existingAdmins, error: adminCountError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('app_role', 'admin')
    .limit(1);

  if (adminCountError) {
    return { error: 'Database error checking admin existence.' };
  }

  if (existingAdmins && existingAdmins.length > 0) {
    return { error: 'An admin already exists. Public bootstrap is disabled.' };
  }

  // 2. Create the user in Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError || !authData.user) {
    return { error: authError?.message || 'Failed to create auth user.' };
  }

  // 3. Insert into public.users with app_role = 'admin'
  const { error: dbError } = await supabaseAdmin.from('users').insert({
    auth_uid: authData.user.id,
    full_name: fullName,
    phone_number: phoneNumber,
    declared_profession: 'Enterprise Buyer', // Default base role
    app_role: 'admin',
    verification_status: 'approved',
    age: 30,
    gender: 'Male',
    macro_region: 'North'
  });

  if (dbError) {
    // Attempt rollback of auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return { error: `Profile creation failed: ${dbError.message}` };
  }

  return { success: true };
}

export async function checkHasAdmin() {
  const supabaseAdmin = getAdminSupabase();
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('app_role', 'admin')
    .limit(1);
    
  if (error) return false;
  return data && data.length > 0;
}

export async function promoteUserToAdmin(userId: string) {
  const supabaseAuth = await getAuthSupabase();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  
  if (!user) return { error: 'Unauthorized' };

  const supabaseAdmin = getAdminSupabase();
  
  // Verify requester is admin
  const { data: requesterProfile } = await supabaseAdmin
    .from('users')
    .select('app_role')
    .eq('auth_uid', user.id)
    .single();

  if (!requesterProfile || requesterProfile.app_role !== 'admin') {
    return { error: 'Forbidden: You are not an admin.' };
  }

  // Promote
  const { error } = await supabaseAdmin
    .from('users')
    .update({ app_role: 'admin' })
    .eq('id', userId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function demoteUserFromAdmin(userId: string) {
  const supabaseAuth = await getAuthSupabase();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  
  if (!user) return { error: 'Unauthorized' };

  const supabaseAdmin = getAdminSupabase();
  
  // Verify requester is admin
  const { data: requesterProfile } = await supabaseAdmin
    .from('users')
    .select('app_role, id')
    .eq('auth_uid', user.id)
    .single();

  if (!requesterProfile || requesterProfile.app_role !== 'admin') {
    return { error: 'Forbidden: You are not an admin.' };
  }

  if (requesterProfile.id === userId) {
    return { error: 'You cannot demote yourself directly.' };
  }

  // Demote
  const { error } = await supabaseAdmin
    .from('users')
    .update({ app_role: 'user' })
    .eq('id', userId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function getAdminUsersList(searchQuery: string = '') {
  const supabaseAuth = await getAuthSupabase();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return { data: null, error: 'Unauthorized' };

  const supabaseAdmin = getAdminSupabase();
  
  const { data: requesterProfile } = await supabaseAdmin
    .from('users')
    .select('app_role')
    .eq('auth_uid', user.id)
    .single();

  if (!requesterProfile || requesterProfile.app_role !== 'admin') {
    return { data: null, error: 'Forbidden' };
  }

  let query = supabaseAdmin
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (searchQuery) {
    query = query.or(`full_name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`);
  }

  const { data, error } = await query;
  return { data, error: error?.message };
}
