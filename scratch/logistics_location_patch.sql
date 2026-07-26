-- ==========================================
-- LOGISTICS LOCATION AND RE-POOL PATCH
-- ==========================================

-- 1. Add current_address safely
ALTER TABLE public.vehicle_states ADD COLUMN IF NOT EXISTS current_address TEXT;

-- 2. Robust Release/Re-Pool RPC
CREATE OR REPLACE FUNCTION public.rpc_release_logistics_booking(
  p_trade_request_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid;
  v_booking record;
  v_trade record;
  v_result json;
BEGIN
  -- Resolve caller
  SELECT id INTO v_user_id FROM public.users 
  WHERE auth_uid = auth.uid() AND declared_profession = 'Logistics Carrier'
  FOR SHARE;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: Caller is not a registered Logistics Carrier.'; END IF;

  -- Lock booking
  SELECT * INTO v_booking FROM public.logistics_bookings
  WHERE trade_request_id = p_trade_request_id AND carrier_id = v_user_id AND status = 'active'
  FOR UPDATE;

  IF v_booking IS NULL THEN RAISE EXCEPTION 'No active booking found for this carrier.'; END IF;

  -- Block if pickup handover has started
  IF v_booking.seller_pickup_confirmed_at IS NOT NULL OR v_booking.carrier_pickup_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pickup handover is already in progress. Normal cancellation is no longer available.';
  END IF;

  -- Lock trade request
  SELECT * INTO v_trade FROM public.trade_requests WHERE id = p_trade_request_id FOR UPDATE;
  IF v_trade IS NULL THEN RAISE EXCEPTION 'Trade request not found.'; END IF;

  -- 1. Update Booking
  UPDATE public.logistics_bookings SET status = 'released' WHERE id = v_booking.id;
  
  -- 2. Update Trade Request (keeps buyer_id, delivery coords, and evidence_status intact)
  UPDATE public.trade_requests SET request_status = 'SEARCHING_LOGISTICS' WHERE id = p_trade_request_id;
  
  -- 3. Reset Vehicle State (ignore is_active=true requirement to ensure pool reset never fails silently)
  IF v_booking.vehicle_state_id IS NOT NULL THEN
    UPDATE public.vehicle_states SET carrier_status = 'available' WHERE id = v_booking.vehicle_state_id; 
  END IF;

  -- Return success data for frontend cache invalidation
  v_result := json_build_object(
    'success', true,
    'booking_id', v_booking.id,
    'trade_request_id', p_trade_request_id,
    'vehicle_state_id', v_booking.vehicle_state_id
  );
  
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_release_logistics_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_release_logistics_booking(uuid) TO authenticated;
