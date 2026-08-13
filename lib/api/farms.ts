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
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to delete crop allocation') };
  return { data, error: null };
}

export async function deleteFarm(
  supabase: SupabaseClient<any>,
  farmId: string
) {
  const { data, error } = await supabase.rpc('rpc_delete_farm', {
    p_farm_id: farmId,
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to delete farm') };
  return { data, error: null };
}

export async function deleteBid(
  supabase: SupabaseClient<any>,
  bidId: string
) {
  // Hides a bid record from the participant's active view using SECURITY DEFINER RPC
  const { data, error } = await supabase.rpc('rpc_hide_or_delete_bid_record', {
    p_bid_id: bidId
  });
  if (error) return { error };
  if (data?.success === false) return { error: new Error(data.error || 'Failed to hide bid record') };
  return { error: null };
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
    cropAllocationId?: string;
    cropType: string;
    totalQuantity: number;
    quantityUnit: string;
    minPricePerUnit: number;
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    sellerMaturityAt?: string;
  }
) {
  let allocId: string = params.cropAllocationId || '';
  if (!allocId) {
    const { data: existingAlloc } = await (supabase as any)
      .from('farm_crop_allocations')
      .select('id')
      .eq('farm_id', params.farmId)
      .eq('crop_type', params.cropType)
      .eq('allocation_status', 'ACTIVE')
      .maybeSingle();

    if (existingAlloc?.id) {
      allocId = existingAlloc.id;
    } else {
      const { data: newAlloc } = await (supabase as any)
        .from('farm_crop_allocations')
        .insert({
          farm_id: params.farmId,
          crop_type: params.cropType,
          expected_harvest_unit: params.quantityUnit,
          expected_harvest_max: params.totalQuantity,
          allocation_status: 'ACTIVE'
        })
        .select('id')
        .single();

      allocId = newAlloc?.id || '';
    }
  }

  return saveBulkSale(supabase, {
    farmId: params.farmId,
    cropAllocationId: allocId,
    cropType: params.cropType,
    expectedQuantityVolume: params.totalQuantity,
    expectedQuantityUnit: params.quantityUnit,
    askingPricePerUnit: params.minPricePerUnit,
    pickupAddress: params.pickupAddress,
    pickupLatitude: params.pickupLatitude,
    pickupLongitude: params.pickupLongitude,
    sellerMaturityAt: params.sellerMaturityAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

export async function saveBulkSale(
  supabase: SupabaseClient<any>,
  params: {
    farmId: string;
    cropAllocationId: string;
    cropType: string;
    expectedQuantityVolume: number;
    expectedQuantityUnit: string;
    askingPricePerUnit: number;
    pickupAddress?: string;
    pickupLatitude?: number;
    pickupLongitude?: number;
    saleOpenAt?: string | null;
    saleCloseAt?: string | null;
    sellerMaturityAt: string;
    sellerNote?: string | null;
  }
) {
  const { data, error } = await supabase.rpc('rpc_save_bulk_sale', {
    p_asking_price_per_unit: params.askingPricePerUnit,
    p_crop_allocation_id: params.cropAllocationId,
    p_crop_type: params.cropType,
    p_expected_quantity: params.expectedQuantityVolume,
    p_expected_quantity_unit: params.expectedQuantityUnit,
    p_farm_id: params.farmId,
    p_pickup_address: params.pickupAddress || null,
    p_pickup_latitude: params.pickupLatitude || null,
    p_pickup_longitude: params.pickupLongitude || null,
    p_sale_close_at: params.saleCloseAt || null,
    p_sale_open_at: params.saleOpenAt || null,
    p_seller_maturity_at: params.sellerMaturityAt,
    p_seller_note: params.sellerNote || null,
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to create bulk sale') };
  return { data, error: null };
}

/** Updates schedule fields on an existing Bulk Bidding Sale. */
export async function updateBulkSaleSchedule(
  supabase: SupabaseClient<any>,
  params: {
    predictionId: string;
    saleOpenAt?: string | null;
    saleCloseAt?: string | null;
    sellerMaturityAt?: string | null;
    sellerNote?: string | null;
  }
) {
  const { data, error } = await supabase.rpc('rpc_update_bulk_sale_schedule', {
    p_prediction_id: params.predictionId,
    p_sale_open_at: params.saleOpenAt || null,
    p_sale_close_at: params.saleCloseAt || null,
    p_seller_maturity_at: params.sellerMaturityAt || null,
    p_seller_note: params.sellerNote || null,
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to update schedule') };
  return { data, error: null };
}

/** Cancels a Bulk Bidding Sale listing. */
export async function cancelBulkSale(
  supabase: SupabaseClient<any>,
  predictionId: string
) {
  const { data, error } = await supabase.rpc('rpc_cancel_bulk_sale', {
    p_prediction_id: predictionId,
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to cancel bulk sale') };
  return { data, error: null };
}

/** Returns the effective sale status, resolving scheduled → open / open → closed transitions. */
export async function getEffectiveSaleStatus(
  supabase: SupabaseClient<any>,
  predictionId: string
) {
  const { data, error } = await supabase.rpc('rpc_get_effective_sale_status', {
    p_prediction_id: predictionId,
  });
  if (error) return { data: null, error };
  return { data, error: null };
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
    .in('bidding_status', ['SCHEDULED', 'OPEN', 'SELLER_REVIEWING', 'ALLOCATED', 'HARVEST_CONFIRMED', 'CONVERTED_TO_TRADE', 'CLOSED', 'CANCELLED'])
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

// ── Farm Activity Logging ───────────────────────────────────────────────────

export async function recordFarmActivity(
  supabase: SupabaseClient<any>,
  params: {
    farmId: string;
    cropAllocationId?: string;
    activityType: string;
    recordedAt: string;
    payload: any;
  }
) {
  const { data, error } = await supabase.rpc('rpc_record_farm_activity', {
    p_farm_id: params.farmId,
    p_crop_allocation_id: params.cropAllocationId || null,
    p_activity_type: params.activityType,
    p_recorded_at: params.recordedAt,
    p_payload: params.payload
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to record activity') };
  return { data, error: null };
}

export async function getBuyerFarmActivitySummary(
  supabase: SupabaseClient<any>,
  predictionId: string
) {
  const { data, error } = await supabase.rpc('rpc_get_buyer_farm_activity_summary', {
    p_prediction_id: predictionId
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to load activity summary') };
  const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return { data: arr, error: null };
}

// ── V6 Negotiation RPCs ─────────────────────────────────────────────────────

export async function placeHarvestBid(
  supabase: SupabaseClient<any>,
  params: {
    predictionId: string;
    desiredQuantity: number;
    offeredPricePerUnit: number;
    buyerMessage?: string;
  }
) {
  const { data, error } = await supabase.rpc('rpc_place_harvest_bid', {
    p_prediction_id: params.predictionId,
    p_desired_quantity: params.desiredQuantity,
    p_offered_price_per_unit: params.offeredPricePerUnit,
    p_buyer_message: params.buyerMessage || null
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to place bid') };
  return { data, error: null };
}

export async function counterHarvestBid(
  supabase: SupabaseClient<any>,
  params: {
    bidId: string;
    counterPrice: number;
    counterQuantity: number;
    message?: string;
  }
) {
  const { data, error } = await supabase.rpc('rpc_counter_harvest_bid', {
    p_bid_id: params.bidId,
    p_counter_price: params.counterPrice,
    p_counter_quantity: params.counterQuantity,
    p_message: params.message || null
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to counter bid') };
  return { data, error: null };
}

export async function acceptOffer(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase.rpc('rpc_accept_offer', {
    p_bid_id: bidId
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to accept offer') };
  return { data, error: null };
}

export async function rejectOffer(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase.rpc('rpc_reject_offer', {
    p_bid_id: bidId
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to reject offer') };
  return { data, error: null };
}

export async function withdrawOffer(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase.rpc('rpc_withdraw_offer', {
    p_bid_id: bidId
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to withdraw offer') };
  return { data, error: null };
}

export async function getBidNegotiationEvents(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase.rpc('rpc_get_bid_negotiation_events', {
    p_bid_id: bidId
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to load events') };
  const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return { data: arr, error: null };
}

export async function declareHarvestAvailable(supabase: SupabaseClient<any>, predictionId: string) {
  const { data, error } = await supabase.rpc('rpc_declare_harvest_available', {
    p_prediction_id: predictionId
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to declare harvest available') };
  return { data, error: null };
}

export async function confirmCropReadiness(supabase: SupabaseClient<any>, predictionId: string) {
  return declareHarvestAvailable(supabase, predictionId);
}

export async function cancelProvisionalAgreement(supabase: SupabaseClient<any>, bidId: string, reason?: string) {
  const { data, error } = await supabase.rpc('rpc_cancel_provisional_agreement', {
    p_bid_id: bidId,
    p_reason: reason || 'Cancelled by participant before trade establishment'
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to cancel provisional agreement') };
  return { data, error: null };
}

export async function closeCropAllocationBidding(supabase: SupabaseClient<any>, cropAllocationId: string) {
  const { data, error } = await supabase.rpc('rpc_close_crop_allocation_bidding', {
    p_crop_allocation_id: cropAllocationId
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to close crop listing') };
  return { data, error: null };
}
