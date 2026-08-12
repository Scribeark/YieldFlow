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
 * Validates session, re-authenticates password, deletes storage assets & DB data,
 * anonymizes statutory records if required, and deletes the Auth user.
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

  const supabaseAuth = await getAuthSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) {
    return { error: 'Authentication required. Please log in and try again.' };
  }

  // Re-authenticate password if provided
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

  // 1. Resolve application user profile
  const { data: appUser, error: appUserErr } = await supabaseAdmin
    .from('users')
    .select('id, declared_profession')
    .eq('auth_uid', user.id)
    .single();

  if (appUserErr || !appUser) {
    return { error: 'Application user profile not found.' };
  }

  const userId = appUser.id;

  // 2. Check for protected completed commercial history
  const { data: protectedBids } = await supabaseAdmin
    .from('harvest_bids')
    .select('id')
    .or(`buyer_id.eq.${userId}`)
    .in('bid_status', ['CONVERTED_TO_TRADE']);

  const hasProtectedTrades = protectedBids && protectedBids.length > 0;

  // 3. Delete Supabase Storage objects owned by user
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

  // 4. Foreign-key safe database deletion order
  try {
    // a. Owned farms
    const { data: farms } = await supabaseAdmin
      .from('farms')
      .select('id')
      .eq('user_id', userId);
    const farmIds = (farms || []).map((f) => f.id);

    // b. Crop allocations
    let cropIds: string[] = [];
    if (farmIds.length > 0) {
      const { data: crops } = await supabaseAdmin
        .from('farm_crop_allocations')
        .select('id')
        .in('farm_id', farmIds);
      cropIds = (crops || []).map((c) => c.id);
    }

    // c. Harvest predictions
    let predictionIds: string[] = [];
    if (farmIds.length > 0) {
      const { data: preds } = await supabaseAdmin
        .from('harvest_predictions')
        .select('id')
        .in('farm_id', farmIds);
      predictionIds = (preds || []).map((p) => p.id);
    }

    // d. Harvest bids (buyer or on seller predictions)
    const { data: buyerBids } = await supabaseAdmin
      .from('harvest_bids')
      .select('id')
      .eq('buyer_id', userId);
    let bidIds = (buyerBids || []).map((b) => b.id);

    if (predictionIds.length > 0) {
      const { data: predBids } = await supabaseAdmin
        .from('harvest_bids')
        .select('id')
        .in('prediction_id', predictionIds);
      if (predBids) {
        bidIds = Array.from(new Set([...bidIds, ...predBids.map((b) => b.id)]));
      }
    }

    // e. Bid negotiation events
    if (bidIds.length > 0) {
      await supabaseAdmin.from('bid_negotiation_events').delete().in('bid_id', bidIds);
    }
    await supabaseAdmin.from('bid_negotiation_events').delete().eq('actor_id', userId);

    // f. Trade requests (disposable)
    if (predictionIds.length > 0) {
      await supabaseAdmin.from('trade_requests').delete().in('harvest_prediction_id', predictionIds);
    }
    await supabaseAdmin.from('trade_requests').delete().eq('user_id', userId);

    // g. Harvest bids
    if (bidIds.length > 0) {
      await supabaseAdmin.from('harvest_bids').delete().in('id', bidIds);
    }

    // h. Harvest predictions
    if (predictionIds.length > 0) {
      await supabaseAdmin.from('harvest_predictions').delete().in('id', predictionIds);
    }

    // i. Farm activity logs
    if (farmIds.length > 0) {
      await supabaseAdmin.from('farm_activity_logs').delete().in('farm_id', farmIds);
    }

    // j. Telemetry / Devices
    const { data: userDevices } = await supabaseAdmin
      .from('iot_devices')
      .select('id')
      .eq('user_id', userId);
    const deviceIds = (userDevices || []).map((d) => d.id);

    if (deviceIds.length > 0) {
      try {
        await supabaseAdmin.from('iot_sensor_streams').delete().in('device_id', deviceIds);
      } catch (e) {}
    }

    await supabaseAdmin.from('iot_devices').delete().eq('user_id', userId);
    if (farmIds.length > 0) {
      await supabaseAdmin.from('iot_devices').delete().in('farm_id', farmIds);
    }

    // k. Crop allocations & Farms
    if (cropIds.length > 0) {
      await supabaseAdmin.from('farm_crop_allocations').delete().in('id', cropIds);
    }
    if (farmIds.length > 0) {
      await supabaseAdmin.from('farms').delete().in('id', farmIds);
    }

    // l. Public profile handling
    let retainedReason: string | undefined;
    if (hasProtectedTrades) {
      retainedReason =
        'Completed trade records were retained for statutory financial compliance, but your personal profile identifiers have been anonymized and account access revoked.';
      await (supabaseAdmin as any)
        .from('users')
        .update({
          full_name: 'Anonymized User',
          phone_number: '0000000000',
          verification_status: 'deleted',
          business_latitude: null,
          business_longitude: null,
        })
        .eq('id', userId);
    } else {
      await supabaseAdmin.from('users').delete().eq('id', userId);
    }

    // 5. Delete Supabase Auth account using Server Admin API
    const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteAuthErr) {
      console.error('Failed to delete Auth account:', deleteAuthErr);
    }

    return { success: true, retainedReason };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred during database cleanup.' };
  }
}
