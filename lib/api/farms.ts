import { SupabaseClient } from '@supabase/supabase-js';

export async function getSellerFarms(supabase: SupabaseClient<any>, userId: string) {
  const { data, error } = await supabase
    .from('farms')
    .select('*, iot_devices(*), harvest_predictions(*)')
    .eq('user_id', userId)
    .or('farm_status.eq.ACTIVE,farm_status.is.null')
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function archiveFarm(supabase: SupabaseClient<any>, farmId: string) {
  const { data, error } = await (supabase as any).rpc('rpc_archive_farm', { p_farm_id: farmId });
  return { data, error };
}

export async function createSellerFarm(
  supabase: SupabaseClient<any>,
  userId: string,
  params: {
    name: string;
    cropType: string;
    plantingDate: string;
    maturityDays: number;
    latitude: number;
    longitude: number;
    address: string;
  }
) {
  const { data, error } = await supabase
    .from('farms')
    .insert({
      user_id: userId,
      name: params.name,
      crop_type: params.cropType,
      planting_date: params.plantingDate,
      expected_maturity_days: params.maturityDays,
      latitude: params.latitude,
      longitude: params.longitude,
      physical_address: params.address
    })
    .select()
    .single();

  return { data, error };
}

export async function registerSellerDevice(
  supabase: SupabaseClient<any>,
  userId: string,
  farmId: string,
  params: {
    name: string;
    serial: string;
    type: string;
    latitude: number;
    longitude: number;
    address: string;
  }
) {
  const { data, error } = await supabase
    .from('iot_devices')
    .insert({
      user_id: userId,
      farm_id: farmId,
      device_name: params.name,
      device_serial_number: params.serial,
      device_type: params.type,
      device_status: 'ACTIVE',
      installation_latitude: params.latitude,
      installation_longitude: params.longitude,
      installation_address: params.address
    })
    .select()
    .single();

  return { data, error };
}

export async function getDeviceReadings(
  supabase: SupabaseClient<any>,
  deviceId: string,
  limit: number = 24
) {
  const { data, error } = await supabase
    .from('iot_sensor_streams')
    .select('*')
    .eq('device_id', deviceId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

export async function createManualBiddingSale(
  supabase: SupabaseClient<any>,
  params: {
    farmId: string;
    cropType: string;
    totalQuantity: number;
    quantityUnit: string;
    minPricePerUnit: number;
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
  }
) {
  const { data, error } = await supabase.rpc('rpc_create_manual_bidding_sale', {
    p_farm_id: params.farmId,
    p_crop_type: params.cropType,
    p_total_quantity: params.totalQuantity,
    p_quantity_unit: params.quantityUnit,
    p_min_price_per_unit: params.minPricePerUnit,
    p_pickup_address: params.pickupAddress,
    p_pickup_latitude: params.pickupLatitude,
    p_pickup_longitude: params.pickupLongitude
  });
  return { data, error };
}

// ── Bid Management ────────────────────────────────────────────────────────────

/**
 * Loads all active harvest predictions for a seller's farms, with all bids.
 * Bids include nested buyer profile (full_name, phone_number).
 */
export async function getSellerBidListings(
  supabase: SupabaseClient<any>,
  userId: string
) {
  const { data: farms, error: farmError } = await supabase
    .from('farms')
    .select('id')
    .eq('user_id', userId);

  if (farmError || !farms) return { data: null, error: farmError };

  const farmIds = (farms as any[]).map((f) => f.id);
  if (farmIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('harvest_predictions')
    .select('*, farms(id, name, crop_type, physical_address, latitude, longitude, user_id), harvest_bids(*, buyer_profile:buyer_id(full_name, phone_number))')
    .in('farm_id', farmIds)
    .in('bidding_status', ['OPEN', 'SELLER_REVIEWING', 'ALLOCATED', 'HARVEST_CONFIRMED', 'CONVERTED_TO_TRADE'])
    .order('created_at', { ascending: false });

  return { data, error };
}

/** Seller rejects a PENDING bid. */
export async function rejectHarvestBid(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase.rpc('rpc_reject_harvest_bid', {
    p_bid_id: bidId
  });
  return { data, error };
}

/** Seller accepts a bid fully or partially. */
export async function allocateHarvestBid(
  supabase: SupabaseClient<any>,
  bidId: string,
  acceptedQuantity: number
) {
  const { data, error } = await supabase.rpc('rpc_allocate_harvest_bid', {
    p_bid_id: bidId,
    p_accepted_quantity: acceptedQuantity
  });
  return { data, error };
}

/** Seller confirms harvest is ready, sets final quantity + pickup coords. */
export async function confirmPredictedHarvest(
  supabase: SupabaseClient<any>,
  params: {
    predictionId: string;
    finalQuantity: number;
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
  }
) {
  const { data, error } = await supabase.rpc('rpc_confirm_predicted_harvest', {
    p_prediction_id: params.predictionId,
    p_final_quantity: params.finalQuantity,
    p_pickup_address: params.pickupAddress,
    p_pickup_latitude: params.pickupLatitude,
    p_pickup_longitude: params.pickupLongitude
  });
  return { data, error };
}

/** Converts all ACCEPTED/PARTIALLY_ACCEPTED bids into EVIDENCE_PENDING trade_requests. */
export async function convertBidsToTrades(
  supabase: SupabaseClient<any>,
  predictionId: string
) {
  const { data, error } = await supabase.rpc('rpc_convert_bids_to_trades', {
    p_prediction_id: predictionId
  });
  return { data, error };
}
