import { SupabaseClient } from '@supabase/supabase-js';

export interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id?: string | null;
  bid_id?: string | null;
  prediction_id?: string | null;
  trade_id?: string | null;
  event_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(supabase: SupabaseClient<any>): Promise<{ data: NotificationItem[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return { data: null, error: new Error(error.message) };
    return { data: data as NotificationItem[], error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to load notifications') };
  }
}

export async function markNotificationRead(supabase: SupabaseClient<any>, notificationId: string) {
  const { data, error } = await supabase.rpc('rpc_mark_notification_read', {
    p_notification_id: notificationId
  });
  if (error) return { data: null, error };
  return { data, error: null };
}

export async function markAllNotificationsRead(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase.rpc('rpc_mark_all_notifications_read');
  if (error) return { data: null, error };
  return { data, error: null };
}
