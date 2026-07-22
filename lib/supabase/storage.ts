import { SupabaseClient } from '@supabase/supabase-js';

export async function uploadHarvestPhoto(
  supabase: SupabaseClient,
  file: File,
  userId: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    // Generate a unique filename: userId/timestamp-originalName
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('harvest-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading photo:', uploadError);
      return { url: null, error: new Error(uploadError.message) };
    }

    // Get public URL
    const { data } = supabase.storage
      .from('harvest-photos')
      .getPublicUrl(filePath);

    return { url: data.publicUrl, error: null };
  } catch (err) {
    console.error('Unexpected error during photo upload:', err);
    return { url: null, error: err instanceof Error ? err : new Error('Unknown upload error') };
  }
}
