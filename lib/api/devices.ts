'use server';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * Generates a strong random key and updates the device record with its hash.
 * Only the device owner (authenticated seller) can perform this.
 * Returns the raw key ONLY ONCE. It is never stored.
 */
export async function generateDeviceIngestionKey(deviceId: string): Promise<{ rawKey: string } | { error: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'Unauthorized' };
    }

    // Verify ownership using the authenticated client
    // Since RLS uses profile.id not auth.uid(), we need the profile ID
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('id')
      .eq('auth_uid', user.id)
      .single();

    if (!profile) {
      return { error: 'User profile not found' };
    }

    const { data: device, error: checkError } = await (supabase as any)
      .from('iot_devices')
      .select('id, user_id')
      .eq('id', deviceId)
      .single();

    if (checkError || !device) {
      return { error: 'Device not found' };
    }

    if (device.user_id !== profile.id) {
      return { error: 'Unauthorized to manage this device' };
    }

    // Generate random key
    const rawKey = `ydf_${crypto.randomBytes(24).toString('hex')}`;
    
    // Hash key (SHA-256)
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Store hash and metadata in Supabase
    const { error: updateError } = await (supabase as any)
      .from('iot_devices')
      .update({
        ingest_key_hash: keyHash,
        ingest_key_created_at: new Date().toISOString(),
        ingest_key_last_used_at: null // Reset last used when rotated
      })
      .eq('id', deviceId);

    if (updateError) {
      console.error('[generateDeviceIngestionKey] DB Update Error:', updateError);
      return { error: 'Failed to save new key securely.' };
    }

    return { rawKey };
  } catch (err: any) {
    console.error('[generateDeviceIngestionKey] Error:', err);
    return { error: err.message || 'Internal Server Error' };
  }
}

export async function retireDevice(deviceId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data, error } = await (supabase as any).rpc('rpc_retire_iot_device', { p_device_id: deviceId });
    if (error) {
      return { success: false, error: error.message };
    }

    // Since RPC returns JSONB, handle the payload
    if (data && typeof data === 'object') {
      const response = data as any;
      if (!response.success) {
        return { success: false, error: response.error || 'Failed to retire device' };
      }
      return { success: true, message: response.message };
    }
    
    return { success: true };
  } catch (err: any) {
    console.error('[retireDevice] Error:', err);
    return { success: false, error: err.message || 'Internal Server Error' };
  }
}
