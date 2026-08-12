'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '../database.types';

// Helper to get service role admin client
const getAdminSupabase = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server configuration error: Missing Supabase Service Role Key.');
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

// Helper to get authenticated server client from session cookies
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
            // Called from Server Component / Action
          }
        },
      },
    }
  );
};

/**
 * Updates permitted user profile fields.
 * Permanent role (declared_profession) cannot be changed.
 */
export async function updateProfile(data: {
  fullName: string;
  phoneNumber: string;
  age?: number;
  gender?: string;
  macroRegion?: string;
}) {
  const supabaseAuth = await getAuthSupabase();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const supabaseAdmin = getAdminSupabase();

  const updatePayload: any = {
    full_name: data.fullName,
    phone_number: data.phoneNumber,
  };
  if (data.age !== undefined) updatePayload.age = data.age;
  if (data.gender !== undefined) updatePayload.gender = data.gender;
  if (data.macroRegion !== undefined) updatePayload.macro_region = data.macroRegion;

  const { error } = await (supabaseAdmin as any)
    .from('users')
    .update(updatePayload)
    .eq('auth_uid', user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Securely deletes a user account server-side.
 * 
 * SERVER-ACTION EXECUTION ORDER:
 * 1. Reauthenticate current user with password (if provided).
 * 2. Delete owned Storage objects (harvest-photos, vehicle-photos, vehicle-documents) using admin client.
 * 3. Call rpc_delete_user_account() via AUTHENTICATED Supabase client (supabaseAuth) using user JWT context.
 * 4. If RPC succeeds, delete matching Supabase Auth user via server-only Admin API.
 * 5. Return structured result for client-side signout & redirect to landing page.
 */
export async function deleteUserAccount(data: {
  confirmationText: string;
  confirmedCheckbox: boolean;
  currentPassword?: string;
}) {
  const { confirmationText, confirmedCheckbox, currentPassword } = data;

  if (!confirmedCheckbox) {
    return { error: 'You must confirm account deletion by checking the confirmation box.' };
  }

  if (confirmationText.trim() !== 'DELETE MY ACCOUNT') {
    return { error: 'Please type DELETE MY ACCOUNT exactly as shown.' };
  }

  // Authoritative session verification
  const supabaseAuth = await getAuthSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) {
    return { error: 'Authentication required. Please log in and try again.' };
  }

  // STEP 1: Re-authenticate current user if password supplied
  if (currentPassword && user.email) {
    const { error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (authError) {
      return { error: 'Current password is incorrect. Account deletion aborted.' };
    }
  }

  const supabaseAdmin = getAdminSupabase();

  // Resolve application user profile ID for storage path resolution
  const { data: appUser } = await (supabaseAuth as any)
    .from('users')
    .select('id')
    .eq('auth_uid', user.id)
    .single();

  const userId = appUser?.id;

  // STEP 2: Delete owned Supabase Storage objects (requires admin client for storage bucket deletion)
  if (userId) {
    try {
      const buckets = ['harvest-photos', 'vehicle-photos', 'vehicle-documents'];
      for (const bucket of buckets) {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId);
        if (files && files.length > 0) {
          const filePaths = files.map((f) => `${userId}/${f.name}`);
          await supabaseAdmin.storage.from(bucket).remove(filePaths);
        }
      }
    } catch (err) {
      // Non-blocking storage removal
    }
  }

  // STEP 3: Execute RPC rpc_delete_user_account() through AUTHENTICATED client (passes user JWT context)
  const { data: rpcRes, error: rpcErr } = await (supabaseAuth as any).rpc('rpc_delete_user_account');

  if (rpcErr) {
    return { error: `Database account cleanup failed: ${rpcErr.message}` };
  }

  const profileStatus = rpcRes?.profile_status;
  const recordsDeleted = rpcRes?.records_deleted;
  const recordsRetained = rpcRes?.records_retained;
  const recordsAnonymized = rpcRes?.records_anonymized;

  let retainedReason: string | undefined;
  if (profileStatus === 'anonymized') {
    retainedReason =
      'Completed commercial trade records were retained for statutory financial compliance, but your personal identifiers have been anonymized and account access revoked.';
  }

  // STEP 4: Delete matching Supabase Auth user via server-only Admin API
  const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteAuthErr) {
    return { error: `Failed to remove authentication access: ${deleteAuthErr.message}` };
  }

  // STEP 5: Return structured result for client signout & redirect
  return {
    success: true,
    profileStatus,
    retainedReason,
    recordsDeleted,
    recordsRetained,
    recordsAnonymized,
  };
}
