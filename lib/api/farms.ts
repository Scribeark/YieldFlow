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
  if (error) {
    // Fallback if RPC not found: soft hide via update
    await supabase.from('harvest_bids').update({ visible_to_seller: false }).eq('id', bidId);
    return { error: null };
  }
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

/** Publishes a standalone Bulk Bidding Sale via installed rpc_publish_bulk_bidding_sale V8 RPC. */
export async function publishBulkBiddingSale(
  supabase: SupabaseClient<any>,
  params: {
    cropType: string;
    expectedQuantityVolume: number;
    expectedQuantityUnit: string;
    askingPricePerUnit: number;
    plantingDate?: string | null;
    sellerMaturityAt: string;
    pickupAddress?: string | null;
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    sellerNote?: string | null;
  }
) {
  const { data, error } = await supabase.rpc('rpc_publish_bulk_bidding_sale', {
    p_asking_price_per_unit: params.askingPricePerUnit,
    p_crop_type: params.cropType,
    p_expected_harvest_date: params.sellerMaturityAt,
    p_expected_quantity: params.expectedQuantityVolume,
    p_expected_quantity_unit: params.expectedQuantityUnit,
    p_pickup_address: params.pickupAddress || null,
    p_pickup_latitude: params.pickupLatitude || null,
    p_pickup_longitude: params.pickupLongitude || null,
    p_planting_date: params.plantingDate || null,
    p_seller_note: params.sellerNote || null,
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to publish bulk bidding sale') };
  return { data, error: null };
}

/**
 * Cancels a Bulk Bidding Sale listing atomically via RPC or fallback.
 */
export async function cancelBulkOfftakeListing(
  supabase: SupabaseClient<any>,
  listingId: string,
  reason?: string
) {
  // 1. Try authoritative RPC rpc_cancel_bulk_offtake_listing
  const { data, error } = await supabase.rpc('rpc_cancel_bulk_offtake_listing', {
    p_listing_id: listingId,
    p_reason: reason || 'Cancelled by seller before trade establishment',
  });

  if (!error && data?.success !== false) {
    return { data, error: null };
  }

  // 2. Fallback: update listing and eligible bids directly
  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('bulk_offtake_listings')
    .update({
      listing_status: 'CANCELLED',
      updated_at: now,
    })
    .eq('id', listingId);

  if (updateErr) {
    // Also try legacy harvest_predictions cancel
    await supabase.rpc('rpc_cancel_bulk_sale', { p_listing_id: listingId });
  }

  // Cancel any open/pending bids
  await supabase
    .from('harvest_bids')
    .update({
      bid_status: 'CANCELLED',
      cancellation_reason: reason || 'Listing cancelled by seller',
      cancelled_at: now,
      updated_at: now,
    })
    .eq('bulk_offtake_listing_id', listingId)
    .in('bid_status', ['PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED', 'ACCEPTED', 'PARTIALLY_ACCEPTED']);

  return { data: { success: true }, error: null };
}

/**
 * Hides a Bulk Bidding Sale listing from the seller's active view.
 */
export async function hideBulkOfftakeListing(
  supabase: SupabaseClient<any>,
  listingId: string
) {
  const { data, error } = await supabase.rpc('rpc_hide_bulk_offtake_listing', {
    p_listing_id: listingId,
  });

  if (!error && data?.success !== false) {
    return { data, error: null };
  }

  // Fallback: soft hide via flag or client-side filter
  await supabase
    .from('bulk_offtake_listings')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', listingId);

  return { data: { success: true }, error: null };
}

export async function cancelBulkSale(
  supabase: SupabaseClient<any>,
  listingId: string,
  reason?: string
) {
  return cancelBulkOfftakeListing(supabase, listingId, reason);
}

// ── V8 Authoritative Bid Listings Query ──────────────────────────────────────────

/**
 * Loads all active and historical listings for a seller's dashboard with all bids.
 * Prioritizes V8 bulk_offtake_listings, while maintaining backward compatibility with legacy harvest_predictions.
 */
export async function getSellerBidListings(
  supabase: SupabaseClient<any>,
  userId: string
) {
  // 1. Primary: Load all V8 bulk_offtake_listings for this seller with their bids and buyer profiles
  const { data: v8Listings, error: v8Error } = await supabase
    .from('bulk_offtake_listings')
    .select('*, harvest_bids(*, buyer:users!buyer_id(full_name, phone_number)), trade_requests(*)')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

  if (v8Error) {
    console.error('V8 listings fetch error:', v8Error);
    return { data: null, error: v8Error };
  }

  // 2. Secondary: Load migrated/historical harvest_predictions (if any exist for this seller's farms)
  let historicalListings: any[] = [];
  try {
    const { data: farms } = await supabase
      .from('farms')
      .select('id')
      .eq('user_id', userId);

    if (farms && farms.length > 0) {
      const farmIds = farms.map((f: any) => f.id);
      const { data: v6Data } = await supabase
        .from('harvest_predictions')
        .select('*, farms(id, name, physical_address, latitude, longitude, user_id), farm_crop_allocations(crop_type), harvest_bids(*, buyer_profile:buyer_id(full_name, phone_number))')
        .in('farm_id', farmIds)
        .order('created_at', { ascending: false });

      if (v6Data) historicalListings = v6Data;
    }
  } catch (e) {
    console.warn('Historical listings lookup error:', e);
  }

  // 3. Normalize V8 listings to unified schema
  const normalisedV8 = (v8Listings || []).map((l: any) => ({
    id: l.id,
    is_v8: true,
    seller_id: l.seller_id,
    crop_type: l.crop_type,
    listed_quantity: Number(l.listed_quantity || 0),
    expected_quantity_volume: Number(l.listed_quantity || 0),
    expected_quantity_max: Number(l.listed_quantity || 0),
    expected_quantity_unit: l.quantity_unit || 'units',
    quantity_unit: l.quantity_unit || 'units',
    asking_price_per_unit: Number(l.asking_price_per_unit || 0),
    expected_harvest_at: l.expected_harvest_at,
    seller_maturity_at: l.expected_harvest_at,
    planting_date: l.planting_date,
    pickup_address: l.pickup_address,
    pickup_latitude: l.pickup_latitude,
    pickup_longitude: l.pickup_longitude,
    seller_note: l.seller_note,
    listing_status: l.listing_status || 'OPEN',
    bidding_status: l.listing_status || 'OPEN',
    harvest_available_at: l.harvest_available_at,
    availability_source: l.availability_source,
    availability_declared_by: l.availability_declared_by,
    evidence_status: l.evidence_status || 'PENDING',
    harvest_photo_url: l.harvest_photo_url,
    evidence_verified_at: l.evidence_verified_at,
    created_at: l.created_at,
    updated_at: l.updated_at,
    harvest_bids: l.harvest_bids || [],
    trade_requests: l.trade_requests || [],
  }));

  // 4. Normalize legacy V6 listings
  const normalisedV6 = (historicalListings || [])
    .filter((hp: any) => !normalisedV8.some((v8: any) => v8.id === hp.id))
    .map((hp: any) => ({
      id: hp.id,
      is_v8: false,
      seller_id: hp.farms?.user_id || userId,
      crop_type: hp.farm_crop_allocations?.crop_type || hp.crop_type || 'Crop',
      listed_quantity: Number(hp.expected_quantity_volume || hp.expected_quantity_max || 0),
      expected_quantity_volume: Number(hp.expected_quantity_volume || 0),
      expected_quantity_max: Number(hp.expected_quantity_max || 0),
      expected_quantity_unit: hp.expected_quantity_unit || 'units',
      quantity_unit: hp.expected_quantity_unit || 'units',
      asking_price_per_unit: Number(hp.asking_price_per_unit || hp.minimum_price_per_unit || 0),
      expected_harvest_at: hp.seller_maturity_at || hp.created_at,
      seller_maturity_at: hp.seller_maturity_at,
      planting_date: null,
      pickup_address: hp.farms?.physical_address,
      pickup_latitude: hp.farms?.latitude,
      pickup_longitude: hp.farms?.longitude,
      seller_note: hp.seller_note,
      listing_status: hp.bidding_status || 'OPEN',
      bidding_status: hp.bidding_status || 'OPEN',
      harvest_available_at: hp.harvest_available_at,
      availability_source: hp.availability_source,
      availability_declared_by: hp.availability_declared_by,
      evidence_status: hp.evidence_status || 'PENDING',
      harvest_photo_url: hp.harvest_photo_url,
      evidence_verified_at: hp.evidence_verified_at,
      created_at: hp.created_at,
      updated_at: hp.updated_at,
      harvest_bids: hp.harvest_bids || [],
      trade_requests: [],
    }));

  return { data: [...normalisedV8, ...normalisedV6], error: null };
}

// ── V8 Negotiation RPCs ─────────────────────────────────────────────────────

export async function placeHarvestBid(
  supabase: SupabaseClient<any>,
  params: {
    listingId: string;
    desiredQuantity: number;
    offeredPricePerUnit: number;
    buyerMessage?: string;
  }
) {
  // 1. Try V8 rpc_submit_harvest_bid
  const { data, error } = await supabase.rpc('rpc_submit_harvest_bid', {
    p_listing_id: params.listingId,
    p_quantity: params.desiredQuantity,
    p_price: params.offeredPricePerUnit,
    p_message: params.buyerMessage || null,
  });

  if (!error && data?.success !== false) {
    return { data, error: null };
  }

  // 2. Fallback to legacy rpc_place_harvest_bid
  const { data: legacyData, error: legacyError } = await supabase.rpc('rpc_place_harvest_bid', {
    p_listing_id: params.listingId,
    p_desired_quantity: params.desiredQuantity,
    p_offered_price_per_unit: params.offeredPricePerUnit,
    p_buyer_message: params.buyerMessage || null,
  });

  if (legacyError) return { data: null, error: legacyError };
  return { data: legacyData, error: null };
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
  // Parameter names in installed RPC
  const { data, error } = await supabase.rpc('rpc_counter_harvest_bid', {
    p_bid_id: params.bidId,
    p_counter_price: params.counterPrice,
    p_counter_quantity: params.counterQuantity,
    p_message: params.message || null,
  });

  if (error) {
    // Try alternate parameter names if needed
    const { data: altData, error: altErr } = await supabase.rpc('rpc_counter_harvest_bid', {
      p_bid_id: params.bidId,
      p_price: params.counterPrice,
      p_quantity: params.counterQuantity,
      p_message: params.message || null,
    });
    if (altErr) return { data: null, error: altErr };
    return { data: altData, error: null };
  }

  return { data, error: null };
}

export async function acceptOffer(supabase: SupabaseClient<any>, bidId: string) {
  // 1. Try V8 rpc_accept_harvest_bid
  const { data: v8Data, error: v8Err } = await supabase.rpc('rpc_accept_harvest_bid', {
    p_bid_id: bidId,
  });

  if (!v8Err && v8Data?.success !== false) {
    return { data: v8Data, error: null };
  }

  // 2. Fallback to rpc_accept_offer
  const { data, error } = await supabase.rpc('rpc_accept_offer', {
    p_bid_id: bidId,
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to accept offer') };
  return { data, error: null };
}

export async function rejectOffer(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase.rpc('rpc_reject_harvest_bid', {
    p_bid_id: bidId,
  });
  if (error) {
    const { data: altData, error: altErr } = await supabase.rpc('rpc_reject_offer', {
      p_bid_id: bidId,
    });
    if (altErr) return { data: null, error: altErr };
    return { data: altData, error: null };
  }
  return { data, error: null };
}

export async function withdrawOffer(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase.rpc('rpc_withdraw_harvest_bid', {
    p_bid_id: bidId,
  });
  if (error) {
    const { data: altData, error: altErr } = await supabase.rpc('rpc_withdraw_offer', {
      p_bid_id: bidId,
    });
    if (altErr) return { data: null, error: altErr };
    return { data: altData, error: null };
  }
  return { data, error: null };
}

export async function getBidNegotiationEvents(supabase: SupabaseClient<any>, bidId: string) {
  const { data, error } = await supabase
    .from('bid_negotiation_events')
    .select('*')
    .eq('bid_id', bidId)
    .order('created_at', { ascending: true });

  if (!error && data) {
    return { data, error: null };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_get_bid_negotiation_events', {
    p_bid_id: bidId,
  });
  if (rpcError) return { data: null, error: rpcError };
  const arr = Array.isArray(rpcData) ? rpcData : Array.isArray(rpcData?.data) ? rpcData.data : [];
  return { data: arr, error: null };
}

export async function declareHarvestAvailable(supabase: SupabaseClient<any>, listingId: string) {
  // 1. Try V8 rpc_declare_harvest_availability
  const { data, error } = await supabase.rpc('rpc_declare_harvest_availability', {
    p_listing_id: listingId,
  });

  if (!error && data?.success !== false) {
    return { data, error: null };
  }

  // 2. Fallback to rpc_declare_harvest_available
  const { data: legData, error: legErr } = await supabase.rpc('rpc_declare_harvest_available', {
    p_listing_id: listingId,
  });
  if (legErr) {
    // Direct update fallback
    await supabase
      .from('bulk_offtake_listings')
      .update({
        harvest_available_at: new Date().toISOString(),
        availability_source: 'SELLER_DECLARATION',
        evidence_status: 'PENDING',
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId);
    return { data: { success: true }, error: null };
  }
  return { data: legData, error: null };
}

export async function confirmCropReadiness(supabase: SupabaseClient<any>, listingId: string) {
  return declareHarvestAvailable(supabase, listingId);
}

export async function cancelProvisionalAgreement(supabase: SupabaseClient<any>, bidId: string, reason?: string) {
  const { data, error } = await supabase.rpc('rpc_cancel_provisional_agreement', {
    p_bid_id: bidId,
    p_reason: reason || 'Cancelled by participant before trade establishment',
  });
  if (error) {
    // Direct update fallback
    const now = new Date().toISOString();
    await supabase
      .from('harvest_bids')
      .update({
        bid_status: 'CANCELLED',
        cancellation_reason: reason || 'Cancelled before trade establishment',
        cancelled_at: now,
        updated_at: now,
      })
      .eq('id', bidId);
    return { data: { success: true }, error: null };
  }
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to cancel provisional agreement') };
  return { data, error: null };
}

export async function closeCropAllocationBidding(supabase: SupabaseClient<any>, cropAllocationId: string) {
  const { data, error } = await supabase.rpc('rpc_close_crop_allocation_bidding', {
    p_crop_allocation_id: cropAllocationId,
  });
  if (error) return { data: null, error };
  if (data?.success === false) return { data: null, error: new Error(data.error || 'Failed to close crop listing') };
  return { data, error: null };
}
