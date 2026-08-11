import { SupabaseClient } from '@supabase/supabase-js';

export async function getSellerFarms(supabase: SupabaseClient<any>, userId: string) {
  const { data, error } = await supabase
    .from('farms')
    .select('*, iot_devices(*), harvest_predictions(*), farm_crop_allocations(*)')
    .eq('user_id', userId)
    .or('farm_status.eq.ACTIVE,farm_status.is.null')
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function archiveFarm(supabase: SupabaseClient<any>, farmId: string) {
  const { data, error } = await (supabase as any).rpc('rpc_archive_farm', { p_farm_id: farmId });
  return { data, error };
}

// Removed deprecated startHarvestAnalysis flow that erroneously created predictions directly

export async function getCropAllocations(supabase: SupabaseClient<any>, farmId: string) {
  const { data, error } = await supabase
    .from('farm_crop_allocations')
    .select('*, harvest_predictions(*), iot_devices(*)')
    .eq('farm_id', farmId)
    .neq('allocation_status', 'ARCHIVED')
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function createCropAllocationDraft(
  supabase: SupabaseClient<any>,
  params: {
    farmId: string;
    cropType: string;
    landSizeValue?: number;
    landSizeUnit?: string;
    expectedHarvestMin?: number;
    expectedHarvestMax?: number;
    expectedHarvestUnit: string;
    plantingDate?: string;
    expectedMaturityDays?: number;
    minimumPricePerUnit?: number;
    notes?: string;
  }
) {
  const { data, error } = await supabase.rpc('rpc_save_crop_allocation_draft', {
    p_farm_id: params.farmId,
    p_crop_type: params.cropType,
    p_land_size_value: params.landSizeValue || null,
    p_land_size_unit: params.landSizeUnit || null,
    p_expected_harvest_min: params.expectedHarvestMin || null,
    p_expected_harvest_max: params.expectedHarvestMax || null,
    p_expected_harvest_unit: params.expectedHarvestUnit || 'kg',
    p_planting_date: params.plantingDate || null,
    p_expected_maturity_days: params.expectedMaturityDays || null,
    p_minimum_price_per_unit: params.minimumPricePerUnit || null,
    p_notes: params.notes || null
  });
  return { data, error };
}

export async function openCropAllocationBidding(
  supabase: SupabaseClient<any>,
  allocationId: string,
  minPrice?: number
) {
  const { data, error } = await supabase.rpc('rpc_open_crop_allocation_bidding', {
    p_crop_allocation_id: allocationId,
    p_minimum_price_per_unit: minPrice || null
  });
  return { data, error };
}

export async function closeCropAllocationBidding(
  supabase: SupabaseClient<any>,
  allocationId: string
) {
  const { data, error } = await supabase.rpc('rpc_close_crop_allocation_bidding', {
    p_crop_allocation_id: allocationId
  });
  return { data, error };
}

export async function archiveCropAllocation(
  supabase: SupabaseClient<any>,
  allocationId: string
) {
    const { data, error } = await supabase.rpc('rpc_archive_crop_allocation', {
      p_crop_allocation_id: allocationId
    });
    return { data, error };
}

export async function deleteCropAllocation(
  supabase: SupabaseClient<any>,
  allocationId: string
) {
  const { data, error } = await supabase.rpc('rpc_delete_crop_allocation', {
    p_crop_allocation_id: allocationId,
  });
  return { data, error };
}

export async function createSellerFarm(
  supabase: SupabaseClient<any>,
  userId: string,
  params: {
    name: string;
    latitude: number;
    longitude: number;
    address: string;
    farmSizeValue?: number;
    farmSizeUnit?: string;
  }
) {
  const { data, error } = await supabase
    .from('farms')
    .insert({
      user_id: userId,
      name: params.name,
      latitude: params.latitude,
      longitude: params.longitude,
      physical_address: params.address,
      farm_size_value: params.farmSizeValue || null,
      farm_size_unit: params.farmSizeUnit || null
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
    cropAllocationId?: string;
    supported_measurements?: string[];
  }
) {
  const { data, error } = await supabase
    .from('iot_devices')
    .insert({
      user_id: userId,
      farm_id: farmId,
      crop_allocation_id: params.cropAllocationId || null,
      device_name: params.name,
      device_serial_number: params.serial,
      device_type: params.type,
      device_status: 'ACTIVE',
      installation_latitude: params.latitude,
      installation_longitude: params.longitude,
      installation_address: params.address,
      supported_measurements: params.supported_measurements || []
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
    .select('*, farms(id, name, physical_address, latitude, longitude, user_id), farm_crop_allocations(crop_type), harvest_bids(*, buyer_profile:buyer_id(full_name, phone_number))')
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
