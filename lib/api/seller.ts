import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../database.types';

export type TradeRequestInsert = Database['public']['Tables']['trade_requests']['Insert'];
export type TradeRequestRow = Database['public']['Tables']['trade_requests']['Row'] & {
  logistics_bookings?: Database['public']['Tables']['logistics_bookings']['Row'][];
};

export async function createTradeRequest(
  supabase: SupabaseClient<Database>,
  payload: Omit<TradeRequestInsert, 'payment_reference' | 'user_id'> & { user_id: string }
): Promise<{ data: TradeRequestRow | null; error: Error | null }> {
  try {
    // Generate a unique offline payment reference since integration is not built yet
    // The DB schema requires this field.
    const paymentReference = `offline-${crypto.randomUUID()}`;

    const { data, error } = await supabase
      .from('trade_requests')
      .insert({
        ...payload,
        payment_reference: paymentReference,
        request_status: 'AWAITING_BUYER',
        submission_channel: 'web'
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting trade request:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error inserting trade request:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export async function getSellerTradeRequests(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = 20
): Promise<{ data: TradeRequestRow[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('trade_requests')
      .select('*, logistics_bookings(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching trade requests:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as unknown as TradeRequestRow[], error: null };
  } catch (err) {
    console.error('Unexpected error fetching trade requests:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export async function uploadEvidence(
  supabase: SupabaseClient<Database>,
  requestId: string,
  photoUrl: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('rpc_upload_evidence', { 
      req_id: requestId, 
      photo_url: photoUrl 
    });

    if (error) {
      console.error('Error uploading evidence:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('Unexpected error uploading evidence:', err);
    return { error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export type BuyerDemandRow = Database['public']['Tables']['buyer_demands']['Row'];

export async function getOpenBuyerDemands(
  supabase: SupabaseClient<Database>,
  limit: number = 20
): Promise<{ data: BuyerDemandRow[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('buyer_demands')
      .select('*')
      .eq('demand_status', 'AWAITING_SELLER')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching open buyer demands:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error fetching open buyer demands:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

