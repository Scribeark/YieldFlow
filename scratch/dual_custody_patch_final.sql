-- =====================================================================
-- DUAL CUSTODY CONFIRMATION PATCH (FINAL)
-- 1. Adds 4 confirmation timestamp columns to logistics_bookings.
-- 2. Adds cancelled_by to trade_requests for accountability.
-- 3. Drops the old MVP single-sided RPCs and old signatures.
-- 4. Updates cancellation/release RPCs to block during handover.
-- 5. Creates 4 new dual-sided confirmation RPCs with idempotency.
-- Safe to run top-to-bottom in Supabase SQL Editor.
-- =====================================================================

-- ==========================================
-- 1. Schema Modifications
-- ==========================================
ALTER TABLE public.logistics_bookings
  ADD COLUMN IF NOT EXISTS seller_pickup_confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS carrier_pickup_confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS carrier_delivery_confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS buyer_delivery_confirmed_at timestamp with time zone;

ALTER TABLE public.trade_requests
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.users(id);

DROP FUNCTION IF EXISTS public.rpc_confirm_seller_pickup(uuid);
DROP FUNCTION IF EXISTS public.rpc_confirm_buyer_delivery(uuid);
DROP FUNCTION IF EXISTS public.rpc_cancel_seller_trade_request(uuid);
DROP FUNCTION IF EXISTS public.rpc_cancel_buyer_claim(uuid);
DROP FUNCTION IF EXISTS public.rpc_cancel_buyer_claim(uuid, text, text);

-- ==========================================
-- 2. Update Release/Cancellation RPCs
-- ==========================================

-- A. rpc_release_logistics_booking
CREATE OR REPLACE FUNCTION public.rpc_release_logistics_booking(
  p_trade_request_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid;
  v_booking record;
  v_trade record;
BEGIN
  SELECT id INTO v_user_id FROM public.users 
  WHERE auth_uid = auth.uid() AND declared_profession = 'Logistics Carrier'
  FOR SHARE;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: Caller is not a registered Logistics Carrier.'; END IF;

  SELECT * INTO v_booking FROM public.logistics_bookings
  WHERE trade_request_id = p_trade_request_id AND carrier_id = v_user_id AND status = 'active'
  FOR UPDATE;

  IF v_booking IS NULL THEN RAISE EXCEPTION 'No active booking found for this carrier.'; END IF;

  -- Block if pickup handover has started
  IF v_booking.seller_pickup_confirmed_at IS NOT NULL OR v_booking.carrier_pickup_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pickup handover is already in progress. Normal cancellation is no longer available.';
  END IF;

  SELECT * INTO v_trade FROM public.trade_requests WHERE id = p_trade_request_id FOR UPDATE;
  IF v_trade IS NULL THEN RAISE EXCEPTION 'Trade request not found.'; END IF;
  IF v_trade.request_status IS DISTINCT FROM 'ALLOCATED' THEN
    RAISE EXCEPTION 'Cannot release job. Job is currently in % status, not ALLOCATED.', v_trade.request_status;
  END IF;

  UPDATE public.logistics_bookings SET status = 'released' WHERE id = v_booking.id;
  UPDATE public.trade_requests SET request_status = 'SEARCHING_LOGISTICS' WHERE id = p_trade_request_id;
  
  IF v_booking.vehicle_state_id IS NOT NULL THEN
    UPDATE public.vehicle_states SET carrier_status = 'available' WHERE id = v_booking.vehicle_state_id AND is_active = true; 
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_release_logistics_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_release_logistics_booking(uuid) TO authenticated;


-- B. rpc_cancel_seller_trade_request
CREATE OR REPLACE FUNCTION public.rpc_cancel_seller_trade_request(
  p_trade_request_id uuid,
  p_cancellation_reason text,
  p_cancellation_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid;
  v_trade record;
  v_booking record;
BEGIN
  IF p_cancellation_reason IS NULL OR trim(p_cancellation_reason) = '' THEN
    RAISE EXCEPTION 'A cancellation reason is required.';
  END IF;

  SELECT id INTO v_user_id FROM public.users 
  WHERE auth_uid = auth.uid() AND declared_profession IN ('Smallholder Farmer', 'Commodity Trader')
  FOR SHARE;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: Caller is not a Farmer or Trader.'; END IF;

  SELECT * INTO v_trade FROM public.trade_requests WHERE id = p_trade_request_id FOR UPDATE;
  IF v_trade IS NULL THEN RAISE EXCEPTION 'Trade request not found.'; END IF;
  IF v_trade.user_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You do not own this trade request.'; END IF;

  IF v_trade.request_status IN ('DISPATCHED', 'FULFILLED', 'CANCELLED') THEN
    RAISE EXCEPTION 'This trade is already in logistics flow or cancelled, and cannot be cancelled normally.';
  END IF;

  -- Check for active logistics booking
  SELECT * INTO v_booking FROM public.logistics_bookings 
  WHERE trade_request_id = p_trade_request_id AND status = 'active' LIMIT 1 FOR UPDATE;

  IF v_booking IS NOT NULL THEN
    IF v_booking.seller_pickup_confirmed_at IS NOT NULL OR v_booking.carrier_pickup_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Pickup handover is already in progress. Normal cancellation is no longer available.';
    END IF;
    -- Cascade cancel the booking and free the vehicle
    UPDATE public.logistics_bookings SET status = 'cancelled' WHERE id = v_booking.id;
    IF v_booking.vehicle_state_id IS NOT NULL THEN
      UPDATE public.vehicle_states SET carrier_status = 'available' WHERE id = v_booking.vehicle_state_id AND is_active = true;
    END IF;
  END IF;

  UPDATE public.trade_requests
  SET request_status = 'CANCELLED',
      cancellation_reason = p_cancellation_reason,
      cancellation_note = p_cancellation_note,
      cancelled_by = v_user_id,
      cancelled_at = now()
  WHERE id = p_trade_request_id;

  -- Restore buyer demand if no other active/confirmed trades remain
  IF v_trade.buyer_demand_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_requests
      WHERE buyer_demand_id = v_trade.buyer_demand_id 
        AND id IS DISTINCT FROM p_trade_request_id 
        AND (buyer_id IS NOT NULL OR request_status IN ('SEARCHING_LOGISTICS', 'ALLOCATED', 'DISPATCHED', 'FULFILLED'))
    ) THEN
      UPDATE public.buyer_demands SET demand_status = 'AWAITING_SELLER' WHERE id = v_trade.buyer_demand_id;
    END IF;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_cancel_seller_trade_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_seller_trade_request(uuid, text, text) TO authenticated;


-- C. rpc_cancel_buyer_claim
CREATE OR REPLACE FUNCTION public.rpc_cancel_buyer_claim(
  p_trade_request_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid;
  v_trade record;
  v_booking record;
BEGIN
  -- NOTE ON CANCELLATION REASON: 
  -- We defer buyer cancellation reasons because storing them directly on the trade_request 
  -- while setting it back to 'AWAITING_BUYER' pollutes the listing metadata. 
  -- If a second buyer claims it and cancels, they would overwrite the first buyer's reason.
  -- Proper cancellation histories for multi-buyer claims require a separate audit table.

  SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid() AND declared_profession = 'Enterprise Buyer' FOR SHARE;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: Caller is not a registered Enterprise Buyer.'; END IF;

  SELECT * INTO v_trade FROM public.trade_requests WHERE id = p_trade_request_id FOR UPDATE;
  IF v_trade IS NULL THEN RAISE EXCEPTION 'Trade request not found.'; END IF;
  IF v_trade.buyer_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You do not own the buyer claim on this request.'; END IF;

  IF v_trade.request_status IN ('DISPATCHED', 'FULFILLED', 'CANCELLED') THEN
    RAISE EXCEPTION 'This order is already in logistics flow or cancelled, and cannot be cancelled here.';
  END IF;

  -- Check for active logistics booking
  SELECT * INTO v_booking FROM public.logistics_bookings 
  WHERE trade_request_id = p_trade_request_id AND status = 'active' LIMIT 1 FOR UPDATE;

  IF v_booking IS NOT NULL THEN
    IF v_booking.seller_pickup_confirmed_at IS NOT NULL OR v_booking.carrier_pickup_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Pickup handover is already in progress. Normal cancellation is no longer available.';
    END IF;
    -- Cascade cancel the booking and free the vehicle
    UPDATE public.logistics_bookings SET status = 'cancelled' WHERE id = v_booking.id;
    IF v_booking.vehicle_state_id IS NOT NULL THEN
      UPDATE public.vehicle_states SET carrier_status = 'available' WHERE id = v_booking.vehicle_state_id AND is_active = true;
    END IF;
  END IF;

  -- Return listing to pool instead of killing it
  UPDATE public.trade_requests
  SET buyer_id = NULL,
      interested_buyer_id = NULL,
      request_status = 'AWAITING_BUYER'
  WHERE id = p_trade_request_id;

  -- Restore buyer demand if no other active/confirmed trades remain
  IF v_trade.buyer_demand_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_requests
      WHERE buyer_demand_id = v_trade.buyer_demand_id 
        AND id IS DISTINCT FROM p_trade_request_id 
        AND (buyer_id IS NOT NULL OR request_status IN ('SEARCHING_LOGISTICS', 'ALLOCATED', 'DISPATCHED', 'FULFILLED'))
    ) THEN
      UPDATE public.buyer_demands SET demand_status = 'AWAITING_SELLER' WHERE id = v_trade.buyer_demand_id;
    END IF;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_cancel_buyer_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_buyer_claim(uuid) TO authenticated;


-- ==========================================
-- 3. Four New Dual-Confirmation RPCs
-- ==========================================

-- A. rpc_confirm_seller_pickup_handover
CREATE OR REPLACE FUNCTION public.rpc_confirm_seller_pickup_handover(
  p_trade_request_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller_id uuid;
  v_trade     public.trade_requests%ROWTYPE;
  v_booking   public.logistics_bookings%ROWTYPE;
BEGIN
  SELECT id INTO v_caller_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Caller not authenticated'; END IF;

  SELECT * INTO v_trade FROM public.trade_requests WHERE id = p_trade_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade request not found'; END IF;
  IF v_trade.user_id IS DISTINCT FROM v_caller_id THEN RAISE EXCEPTION 'Only the seller can confirm handover'; END IF;
  
  -- Delivery handover block
  IF v_trade.request_status = 'DISPATCHED' THEN
    RAISE EXCEPTION 'Delivery handover is already in progress. Pickup is already completed.';
  END IF;
  IF v_trade.request_status IS DISTINCT FROM 'ALLOCATED' THEN RAISE EXCEPTION 'Trade must be ALLOCATED to confirm pickup.'; END IF;

  SELECT * INTO v_booking FROM public.logistics_bookings WHERE trade_request_id = p_trade_request_id AND status = 'active' LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active logistics booking found'; END IF;

  -- Idempotency protection
  IF v_booking.seller_pickup_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pickup already confirmed by seller.';
  END IF;

  UPDATE public.logistics_bookings SET seller_pickup_confirmed_at = now() WHERE id = v_booking.id;

  IF v_booking.carrier_pickup_confirmed_at IS NOT NULL THEN
    UPDATE public.trade_requests SET request_status = 'DISPATCHED' WHERE id = p_trade_request_id;
    UPDATE public.logistics_bookings SET dispatched_at = now() WHERE id = v_booking.id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_confirm_seller_pickup_handover(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_seller_pickup_handover(uuid) TO authenticated;


-- B. rpc_confirm_carrier_pickup_handover
CREATE OR REPLACE FUNCTION public.rpc_confirm_carrier_pickup_handover(
  p_trade_request_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller_id uuid;
  v_trade     public.trade_requests%ROWTYPE;
  v_booking   public.logistics_bookings%ROWTYPE;
BEGIN
  SELECT id INTO v_caller_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Caller not authenticated'; END IF;

  SELECT * INTO v_trade FROM public.trade_requests WHERE id = p_trade_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade request not found'; END IF;
  
  IF v_trade.request_status = 'DISPATCHED' THEN
    RAISE EXCEPTION 'Delivery handover is already in progress. Pickup is already completed.';
  END IF;
  IF v_trade.request_status IS DISTINCT FROM 'ALLOCATED' THEN RAISE EXCEPTION 'Trade must be ALLOCATED to confirm pickup.'; END IF;

  SELECT * INTO v_booking FROM public.logistics_bookings WHERE trade_request_id = p_trade_request_id AND status = 'active' LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active logistics booking found'; END IF;
  IF v_booking.carrier_id IS DISTINCT FROM v_caller_id THEN RAISE EXCEPTION 'Only the assigned carrier can confirm pickup'; END IF;

  -- Idempotency protection
  IF v_booking.carrier_pickup_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pickup already confirmed by carrier.';
  END IF;

  UPDATE public.logistics_bookings SET carrier_pickup_confirmed_at = now() WHERE id = v_booking.id;

  IF v_booking.seller_pickup_confirmed_at IS NOT NULL THEN
    UPDATE public.trade_requests SET request_status = 'DISPATCHED' WHERE id = p_trade_request_id;
    UPDATE public.logistics_bookings SET dispatched_at = now() WHERE id = v_booking.id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_confirm_carrier_pickup_handover(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_carrier_pickup_handover(uuid) TO authenticated;


-- C. rpc_confirm_carrier_delivery
CREATE OR REPLACE FUNCTION public.rpc_confirm_carrier_delivery(
  p_trade_request_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller_id uuid;
  v_trade     public.trade_requests%ROWTYPE;
  v_booking   public.logistics_bookings%ROWTYPE;
BEGIN
  SELECT id INTO v_caller_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Caller not authenticated'; END IF;

  SELECT * INTO v_trade FROM public.trade_requests WHERE id = p_trade_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade request not found'; END IF;
  IF v_trade.request_status = 'FULFILLED' THEN RAISE EXCEPTION 'Trade is already fulfilled.'; END IF;
  IF v_trade.request_status IS DISTINCT FROM 'DISPATCHED' THEN RAISE EXCEPTION 'Trade must be DISPATCHED to confirm delivery.'; END IF;

  SELECT * INTO v_booking FROM public.logistics_bookings WHERE trade_request_id = p_trade_request_id AND status = 'active' LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active logistics booking found'; END IF;
  IF v_booking.carrier_id IS DISTINCT FROM v_caller_id THEN RAISE EXCEPTION 'Only the assigned carrier can confirm delivery'; END IF;

  -- Idempotency protection
  IF v_booking.carrier_delivery_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Delivery already confirmed by carrier.';
  END IF;

  UPDATE public.logistics_bookings SET carrier_delivery_confirmed_at = now() WHERE id = v_booking.id;

  IF v_booking.buyer_delivery_confirmed_at IS NOT NULL THEN
    UPDATE public.trade_requests SET request_status = 'FULFILLED' WHERE id = p_trade_request_id;
    UPDATE public.logistics_bookings SET status = 'completed' WHERE id = v_booking.id;
    IF v_booking.vehicle_state_id IS NOT NULL THEN
      UPDATE public.vehicle_states SET carrier_status = 'available' WHERE id = v_booking.vehicle_state_id AND is_active = true;
    END IF;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_confirm_carrier_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_carrier_delivery(uuid) TO authenticated;


-- D. rpc_confirm_buyer_delivery
CREATE OR REPLACE FUNCTION public.rpc_confirm_buyer_delivery(
  p_trade_request_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller_id uuid;
  v_trade     public.trade_requests%ROWTYPE;
  v_booking   public.logistics_bookings%ROWTYPE;
BEGIN
  SELECT id INTO v_caller_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Caller not authenticated'; END IF;

  SELECT * INTO v_trade FROM public.trade_requests WHERE id = p_trade_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade request not found'; END IF;
  IF v_trade.buyer_id IS DISTINCT FROM v_caller_id THEN RAISE EXCEPTION 'Only the confirmed buyer can confirm receipt'; END IF;
  
  IF v_trade.request_status = 'FULFILLED' THEN RAISE EXCEPTION 'Trade is already fulfilled.'; END IF;
  IF v_trade.request_status IS DISTINCT FROM 'DISPATCHED' THEN RAISE EXCEPTION 'Trade must be DISPATCHED to confirm delivery.'; END IF;

  SELECT * INTO v_booking FROM public.logistics_bookings WHERE trade_request_id = p_trade_request_id AND status = 'active' LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active logistics booking found'; END IF;

  -- Idempotency protection
  IF v_booking.buyer_delivery_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Delivery already confirmed by buyer.';
  END IF;

  UPDATE public.logistics_bookings SET buyer_delivery_confirmed_at = now() WHERE id = v_booking.id;

  IF v_booking.carrier_delivery_confirmed_at IS NOT NULL THEN
    UPDATE public.trade_requests SET request_status = 'FULFILLED' WHERE id = p_trade_request_id;
    UPDATE public.logistics_bookings SET status = 'completed' WHERE id = v_booking.id;
    IF v_booking.vehicle_state_id IS NOT NULL THEN
      UPDATE public.vehicle_states SET carrier_status = 'available' WHERE id = v_booking.vehicle_state_id AND is_active = true;
    END IF;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_confirm_buyer_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_buyer_delivery(uuid) TO authenticated;


-- ==========================================
-- 4. Verification SQL
-- ==========================================

-- Verify Columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('logistics_bookings', 'trade_requests') 
  AND column_name IN (
    'seller_pickup_confirmed_at', 
    'carrier_pickup_confirmed_at', 
    'carrier_delivery_confirmed_at', 
    'buyer_delivery_confirmed_at',
    'cancelled_by'
  );

-- Verify RPC Permissions & Config
SELECT 
    p.proname AS function_name,
    p.proconfig AS search_path_config,
    has_function_privilege('anon', p.oid, 'execute') AS anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'execute') AS auth_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'rpc_confirm_seller_pickup_handover',
    'rpc_confirm_carrier_pickup_handover',
    'rpc_confirm_carrier_delivery',
    'rpc_confirm_buyer_delivery',
    'rpc_release_logistics_booking',
    'rpc_cancel_seller_trade_request',
    'rpc_cancel_buyer_claim'
  );
