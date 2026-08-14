import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../database.types';

export type TradeRequestRow = Database['public']['Tables']['trade_requests']['Row'] & {
  logistics_bookings?: (Database['public']['Tables']['logistics_bookings']['Row'] & {
    vehicle_states?: Database['public']['Tables']['vehicle_states']['Row'];
  })[];
};

export async function getAvailableTradeRequests(
  supabase: SupabaseClient<Database>,
  limit: number = 20
): Promise<{ data: TradeRequestRow[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('trade_requests')
      .select('*')
      .eq('request_status', 'AWAITING_BUYER')
      .is('buyer_id', null)
      .is('buyer_demand_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching available trade requests:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error fetching available trade requests:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export interface ConfirmOrderParams {
  requestId: string;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  confirmUssdExemption?: boolean;
}

export async function confirmOrder(
  supabase: SupabaseClient<Database>,
  params: ConfirmOrderParams
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('rpc_confirm_order', {
      req_id: params.requestId,
      p_delivery_address: params.deliveryAddress,
      p_delivery_latitude: params.deliveryLatitude,
      p_delivery_longitude: params.deliveryLongitude,
      p_confirm_ussd_exemption: params.confirmUssdExemption ?? false,
    });

    if (error) {
      console.error('Error confirming order:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('Unexpected error confirming order:', err);
    return { error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export async function getMyBids(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase.rpc('rpc_get_buyer_my_bids');
  return { data, error };
}

export async function placeHarvestBid(
  supabase: SupabaseClient<any>,
  params: {
    listingId: string;
    quantity: number;
    pricePerUnit: number;
    buyerMessage?: string;
  }
) {
  // Parameter names must match the RPC signature exactly:
  // rpc_place_harvest_bid(p_prediction_id, p_desired_quantity, p_offered_price_per_unit, p_buyer_message)
  const { data, error } = await supabase.rpc('rpc_place_harvest_bid', {
    p_listing_id: params.listingId,
    p_desired_quantity: params.quantity,
    p_offered_price_per_unit: params.pricePerUnit,
    p_buyer_message: params.buyerMessage ?? null
  });
  return { data, error };
}

export async function withdrawHarvestBid(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase.rpc('rpc_withdraw_harvest_bid', {
    p_bid_id: bidId
  });
  return { data, error };
}

export async function cancelAcceptedHarvestBid(supabase: SupabaseClient<any>, bidId: string, reason?: string) {
  const { data, error } = await supabase.rpc('rpc_cancel_provisional_agreement', {
    p_bid_id: bidId,
    p_reason: reason || 'Cancelled by buyer before trade establishment'
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to cancel provisional agreement') };
  return { data, error: null };
}

export async function getHarvestOpportunities(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase.rpc('rpc_get_buyer_harvest_opportunities');
  return { data, error };
}

export async function requestEvidence(
  supabase: SupabaseClient<Database>,
  requestId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('rpc_request_evidence', { req_id: requestId });

    if (error) {
      console.error('Error requesting evidence:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('Unexpected error requesting evidence:', err);
    return { error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export async function getBuyerOrders(
  supabase: SupabaseClient<Database>,
  buyerId: string,
  limit: number = 20
): Promise<{ data: TradeRequestRow[] | null; error: Error | null }> {
  try {
    // Fetch both confirmed orders and pending evidence requests
    const { data, error } = await supabase
      .from('trade_requests')
      .select('*, logistics_bookings(*, vehicle_states(*))')
      .or(`buyer_id.eq.${buyerId},interested_buyer_id.eq.${buyerId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching buyer orders:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as unknown as TradeRequestRow[], error: null };
  } catch (err) {
    console.error('Unexpected error fetching buyer orders:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export type BuyerDemandRow = Database['public']['Tables']['buyer_demands']['Row'];
export type BuyerDemandInsert = Database['public']['Tables']['buyer_demands']['Insert'];

export async function createBuyerDemand(
  supabase: SupabaseClient<Database>,
  payload: BuyerDemandInsert
): Promise<{ data: BuyerDemandRow | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('buyer_demands')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error inserting buyer demand:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error inserting buyer demand:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export async function getBuyerDemands(
  supabase: SupabaseClient<Database>,
  buyerId: string
): Promise<{ data: BuyerDemandRow[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('buyer_demands')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching buyer demands:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error fetching buyer demands:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

export async function getDemandResponses(
  supabase: SupabaseClient<Database>,
  buyerId: string
): Promise<{ data: (TradeRequestRow & { buyer_demands: BuyerDemandRow | null })[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('trade_requests')
      .select('*, buyer_demands!inner(*)')
      .eq('buyer_demands.buyer_id', buyerId)
      .is('buyer_id', null)
      .not('harvest_photo_url', 'is', null);

    if (error) {
      console.error('Error fetching demand responses:', error);
      return { data: null, error: new Error(error.message) };
    }

    // Supabase TS types can be tricky with joins, cast for simplicity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { data: data as any, error: null };
  } catch (err) {
    console.error('Unexpected error fetching demand responses:', err);
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

