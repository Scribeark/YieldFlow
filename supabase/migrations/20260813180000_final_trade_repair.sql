BEGIN;

-- ============================================================================
-- 1. Harvest Prediction Evidence & Availability Tracking
-- ============================================================================
ALTER TABLE public.harvest_predictions 
  ADD COLUMN IF NOT EXISTS harvest_available_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS availability_source TEXT,
  ADD COLUMN IF NOT EXISTS availability_declared_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS evidence_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS harvest_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS evidence_verified_at TIMESTAMPTZ;

-- Dynamically discover and drop any existing check constraints on availability_source, then enforce strictly
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  FOR v_conname IN (
    SELECT conname 
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.harvest_predictions'::regclass
      AND a.attname = 'availability_source'
      AND c.contype = 'c'
  )
  LOOP
    EXECUTE 'ALTER TABLE public.harvest_predictions DROP CONSTRAINT ' || quote_ident(v_conname);
  END LOOP;
END $$;

ALTER TABLE public.harvest_predictions ADD CONSTRAINT harvest_predictions_avail_src_chk 
  CHECK (availability_source IN ('SELLER_DECLARATION', 'EXPECTED_DATE'));


-- ============================================================================
-- 2. Trade Requests Uniqueness
-- ============================================================================
ALTER TABLE public.trade_requests 
  ADD COLUMN IF NOT EXISTS harvest_bid_id UUID REFERENCES public.harvest_bids(id);

ALTER TABLE public.trade_requests DROP CONSTRAINT IF EXISTS unique_trade_per_bid;
ALTER TABLE public.trade_requests ADD CONSTRAINT unique_trade_per_bid UNIQUE (harvest_bid_id);


-- ============================================================================
-- 3. Negotiation Events CANCELLED Constraint 
-- ============================================================================
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  FOR v_conname IN (
    SELECT conname 
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.bid_negotiation_events'::regclass
      AND a.attname = 'event_type'
      AND c.contype = 'c'
  )
  LOOP
    EXECUTE 'ALTER TABLE public.bid_negotiation_events DROP CONSTRAINT ' || quote_ident(v_conname);
  END LOOP;
END $$;

-- Preserve every installed event type exactly and append CANCELLED natively
ALTER TABLE public.bid_negotiation_events ADD CONSTRAINT bid_negotiation_events_event_type_check 
  CHECK (event_type IN (
    'SUBMITTED', 'SELLER_COUNTERED', 'BUYER_COUNTERED', 
    'ACCEPTED', 'REJECTED', 'WITHDRAWN', 
    'READINESS_CONFIRMED', 'CONVERTED_TO_TRADE', 'EXPIRED', 
    'CANCELLED'
  ));

-- Do not drop unrelated check constraints. We preserve check_event_values exactly as it is.


-- ============================================================================
-- 4. Harvest Bids Cancellation Columns
-- ============================================================================
ALTER TABLE public.harvest_bids
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;


-- ============================================================================
-- 5. RPC: Authoritative Quantity Helper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_harvest_prediction_stats(p_prediction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected INTEGER;
  v_provisionally_allocated INTEGER;
  v_established INTEGER;
  v_pending INTEGER;
BEGIN
  SELECT expected_quantity_volume INTO v_expected
  FROM public.harvest_predictions WHERE id = p_prediction_id;

  SELECT COALESCE(SUM(COALESCE(final_accepted_quantity, accepted_quantity, desired_quantity)), 0)
  INTO v_provisionally_allocated
  FROM public.harvest_bids
  WHERE prediction_id = p_prediction_id AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED');

  SELECT COALESCE(SUM(COALESCE(final_accepted_quantity, accepted_quantity, desired_quantity)), 0)
  INTO v_established
  FROM public.harvest_bids
  WHERE prediction_id = p_prediction_id AND bid_status = 'CONVERTED_TO_TRADE';

  SELECT COALESCE(SUM(desired_quantity), 0)
  INTO v_pending
  FROM public.harvest_bids
  WHERE prediction_id = p_prediction_id AND bid_status IN ('PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED');

  RETURN jsonb_build_object(
    'listed_quantity', COALESCE(v_expected, 0),
    'provisionally_allocated', v_provisionally_allocated,
    'established_trade_quantity', v_established,
    'remaining_quantity', COALESCE(v_expected, 0) - v_provisionally_allocated - v_established,
    'pending_bid_quantity', v_pending
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_get_harvest_prediction_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_harvest_prediction_stats(UUID) TO authenticated;


-- ============================================================================
-- 6. RPC: Active Acceptance Replacement (rpc_accept_offer)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_accept_offer(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_prediction public.harvest_predictions%ROWTYPE;
  v_farm public.farms%ROWTYPE;
  v_latest_qty INTEGER;
  v_latest_price NUMERIC;
  v_accepted_total INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated'); END IF;

  SELECT hb.* INTO v_bid FROM public.harvest_bids hb WHERE hb.id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;

  SELECT hp.* INTO v_prediction FROM public.harvest_predictions hp WHERE hp.id = v_bid.prediction_id FOR UPDATE;
  
  SELECT f.* INTO v_farm FROM public.farms f WHERE f.id = v_prediction.farm_id;
  IF v_farm.user_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bid cannot be accepted in current state');
  END IF;

  -- 1. Use the latest valid negotiation-event price and quantity
  SELECT offered_quantity, offered_price_per_unit 
  INTO v_latest_qty, v_latest_price
  FROM public.bid_negotiation_events 
  WHERE bid_id = p_bid_id 
    AND event_type NOT IN ('REJECTED', 'WITHDRAWN', 'CANCELLED')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_latest_qty IS NULL OR v_latest_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid negotiation terms found');
  END IF;

  -- 2. Lock prediction and calculate remaining quantity to prevent overallocation
  SELECT COALESCE(SUM(COALESCE(final_accepted_quantity, accepted_quantity, desired_quantity)), 0)
  INTO v_accepted_total
  FROM public.harvest_bids
  WHERE prediction_id = v_prediction.id 
    AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE')
    AND id != p_bid_id;

  v_remaining := v_prediction.expected_quantity_volume - v_accepted_total;

  IF v_latest_qty > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acceptance exceeds remaining harvest quantity.');
  END IF;

  -- 3. Enforce all required writes exactly
  UPDATE public.harvest_bids
  SET bid_status = 'ACCEPTED',
      accepted_quantity = v_latest_qty, 
      final_accepted_quantity = v_latest_qty,
      final_accepted_price_per_unit = v_latest_price,
      final_total_value = v_latest_qty * v_latest_price,
      accepted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bid_id;

  INSERT INTO public.bid_negotiation_events (
      bid_id, actor_id, actor_role, event_type, 
      offered_price_per_unit, offered_quantity, message
  ) VALUES (
      p_bid_id, v_actor_id, 'SELLER', 'ACCEPTED', 
      v_latest_price, v_latest_qty, 'Offer accepted'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_accept_offer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_accept_offer(UUID) TO authenticated;


-- ============================================================================
-- 7. RPC: Declare Harvest Available
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_declare_harvest_available(p_prediction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction public.harvest_predictions%ROWTYPE;
  v_farm public.farms%ROWTYPE;
  v_actor_id UUID;
  v_has_bids BOOLEAN;
  v_buyer_rec RECORD;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated'); END IF;

  SELECT hp.* INTO v_prediction FROM public.harvest_predictions hp WHERE hp.id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Prediction not found'); END IF;

  SELECT f.* INTO v_farm FROM public.farms f WHERE f.id = v_prediction.farm_id;
  IF v_farm.user_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the farm owner can declare harvest available');
  END IF;

  IF v_prediction.harvest_available_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Harvest is already declared available.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.harvest_bids 
    WHERE prediction_id = p_prediction_id 
      AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
  ) INTO v_has_bids;

  IF NOT v_has_bids THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot declare harvest: no accepted provisional agreements exist.');
  END IF;

  -- Unlock the evidence stage
  UPDATE public.harvest_predictions
  SET harvest_available_at = NOW(),
      availability_source = 'SELLER_DECLARATION',
      availability_declared_by = v_actor_id,
      evidence_status = 'pending',
      updated_at = NOW()
  WHERE id = p_prediction_id;

  -- Explicit participant notifications using strict exact installed columns
  FOR v_buyer_rec IN (
    SELECT DISTINCT buyer_id FROM public.harvest_bids 
    WHERE prediction_id = p_prediction_id AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
  ) LOOP
    INSERT INTO public.notifications (recipient_id, actor_id, prediction_id, event_type, message)
    VALUES (
      v_buyer_rec.buyer_id, 
      v_actor_id, 
      p_prediction_id, 
      'HARVEST_AVAILABLE', 
      'The seller has declared harvest availability and is preparing evidence.'
    );
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_declare_harvest_available(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_declare_harvest_available(UUID) TO authenticated;


-- ============================================================================
-- 8. RPC: Progress Provisional Agreements (Establish Trades)
-- ============================================================================
-- Must be invoked by the evidence operation itself to create trades.
CREATE OR REPLACE FUNCTION public.rpc_progress_provisional_agreements(p_prediction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction public.harvest_predictions%ROWTYPE;
  v_farm public.farms%ROWTYPE;
  v_bid public.harvest_bids%ROWTYPE;
  v_crop_type TEXT;
  v_trade_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT hp.* INTO v_prediction FROM public.harvest_predictions hp WHERE hp.id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Prediction not found'); END IF;

  -- Ensure evidence has been provided and verified before creating ANY trade
  IF v_prediction.evidence_status != 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot progress trades: Harvest evidence has not been verified yet.');
  END IF;

  SELECT f.* INTO v_farm FROM public.farms f WHERE f.id = v_prediction.farm_id;
  
  -- Extract authoritative crop_type from the verified linked crop allocation
  SELECT crop_type INTO v_crop_type 
  FROM public.farm_crop_allocations 
  WHERE id = v_prediction.crop_allocation_id;

  FOR v_bid IN
    SELECT * FROM public.harvest_bids 
    WHERE prediction_id = p_prediction_id 
    AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
    FOR UPDATE
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.trade_requests WHERE harvest_bid_id = v_bid.id FOR SHARE) THEN
      
      -- We safely establish exactly one trade per bid, strictly matching the live trade_requests table.
      INSERT INTO public.trade_requests (
        harvest_prediction_id,
        user_id,
        buyer_id,
        commodity_variety,
        quantity,
        request_status,
        evidence_status,
        harvest_bid_id,
        harvest_photo_url
      ) VALUES (
        p_prediction_id,
        v_farm.user_id,
        v_bid.buyer_id,
        v_crop_type,
        COALESCE(v_bid.final_accepted_quantity, v_bid.accepted_quantity, v_bid.desired_quantity),
        'SEARCHING_LOGISTICS',
        'provided', 
        v_bid.id,
        v_prediction.harvest_photo_url
      ) RETURNING id INTO v_trade_id;

      UPDATE public.harvest_bids
      SET bid_status = 'CONVERTED_TO_TRADE',
          updated_at = NOW()
      WHERE id = v_bid.id;

      -- Explicit Notification
      INSERT INTO public.notifications (recipient_id, trade_id, event_type, message)
      VALUES (
        v_bid.buyer_id, 
        v_trade_id, 
        'TRADE_ESTABLISHED', 
        'Harvest evidence was verified and your trade is now active for logistics.'
      );
      
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'trades_created', v_count);
END;
$$;
-- This function is restricted. We grant to service_role, but it will be executed internally by rpc_upload_prediction_evidence which runs as SECURITY DEFINER.
REVOKE ALL ON FUNCTION public.rpc_progress_provisional_agreements(UUID) FROM PUBLIC;


-- ============================================================================
-- 9. RPC: Secure Camera Capture & Evidence Verification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_upload_prediction_evidence(p_prediction_id UUID, p_photo_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction public.harvest_predictions%ROWTYPE;
  v_farm public.farms%ROWTYPE;
  v_actor_id UUID;
  v_file_path TEXT;
  v_is_valid BOOLEAN;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated'); END IF;

  SELECT hp.* INTO v_prediction FROM public.harvest_predictions hp WHERE hp.id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Prediction not found'); END IF;

  SELECT f.* INTO v_farm FROM public.farms f WHERE f.id = v_prediction.farm_id;
  IF v_farm.user_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the farm owner can upload evidence');
  END IF;

  IF v_prediction.harvest_available_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Harvest must be declared available before uploading evidence');
  END IF;

  IF v_prediction.evidence_status = 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evidence is already verified');
  END IF;

  -- Verify the file securely against the storage.objects table rather than blindly trusting the caller URL
  v_file_path := substring(p_photo_url from '/harvest-photos/(.*)$');
  IF v_file_path IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid photo URL format. Must be a secure harvest-photos storage URL.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'harvest-photos' 
      AND name = v_file_path
  ) INTO v_is_valid;

  IF NOT v_is_valid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evidence verification failed: Photo not found in secure storage bucket.');
  END IF;

  -- Evidence passes the established verification requirement
  UPDATE public.harvest_predictions
  SET harvest_photo_url = p_photo_url,
      evidence_status = 'verified',
      evidence_verified_at = NOW(),
      updated_at = NOW()
  WHERE id = p_prediction_id;

  -- The evidence operation immediately invokes progression (establishing exactly one trade per bid)
  PERFORM public.rpc_progress_provisional_agreements(p_prediction_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_upload_prediction_evidence(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_upload_prediction_evidence(UUID, TEXT) TO authenticated;


-- ============================================================================
-- 10. RPC: Cancel Provisional Agreement 
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_cancel_provisional_agreement(
    p_bid_id UUID,
    p_reason TEXT DEFAULT 'No reason provided'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_farm_owner UUID;
  v_is_seller BOOLEAN;
  v_is_buyer BOOLEAN;
  v_actor_role TEXT;
  v_final_qty INTEGER;
  v_final_price NUMERIC;
  v_notify_id UUID;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated'); END IF;

  SELECT hb.* INTO v_bid FROM public.harvest_bids hb WHERE hb.id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;

  IF v_bid.bid_status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only accepted provisional agreements can be cancelled');
  END IF;

  SELECT f.user_id INTO v_farm_owner FROM public.harvest_predictions hp JOIN public.farms f ON f.id = hp.farm_id WHERE hp.id = v_bid.prediction_id;

  v_is_seller := (v_farm_owner = v_actor_id);
  v_is_buyer := (v_bid.buyer_id = v_actor_id);

  IF NOT (v_is_seller OR v_is_buyer) THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); END IF;
  IF v_is_seller THEN v_actor_role := 'SELLER'; v_notify_id := v_bid.buyer_id; ELSE v_actor_role := 'BUYER'; v_notify_id := v_farm_owner; END IF;

  v_final_qty := COALESCE(v_bid.final_accepted_quantity, v_bid.accepted_quantity, v_bid.desired_quantity);
  v_final_price := COALESCE(v_bid.final_accepted_price_per_unit, v_bid.offered_price_per_unit);

  INSERT INTO public.bid_negotiation_events (
      bid_id, actor_id, actor_role, event_type, 
      offered_price_per_unit, offered_quantity, message
  ) VALUES (
      p_bid_id, v_actor_id, v_actor_role, 'CANCELLED', 
      v_final_price, v_final_qty, p_reason
  );

  UPDATE public.harvest_bids 
  SET bid_status = 'CANCELLED',
      final_accepted_quantity = NULL,
      final_accepted_price_per_unit = NULL,
      final_total_value = NULL,
      accepted_quantity = NULL, 
      cancelled_by = v_actor_id,
      cancellation_reason = p_reason,
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bid_id;

  INSERT INTO public.notifications (recipient_id, actor_id, bid_id, event_type, message)
  VALUES (
    v_notify_id, 
    v_actor_id, 
    p_bid_id, 
    'AGREEMENT_CANCELLED', 
    'The other party cancelled a provisional agreement. Reason: ' || p_reason
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_cancel_provisional_agreement(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_provisional_agreement(UUID, TEXT) TO authenticated;


-- ============================================================================
-- 11. RPC: Automated Expected-Date Processor (Internal / Scheduler Safe)
-- ============================================================================
-- NOTE: Automation remains inactive until a service_role scheduler (e.g. pg_cron) is configured.
CREATE OR REPLACE FUNCTION public.rpc_auto_progress_harvests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction public.harvest_predictions%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  FOR v_prediction IN
    SELECT * FROM public.harvest_predictions
    WHERE seller_maturity_at <= NOW()
      AND harvest_available_at IS NULL
      AND bidding_status != 'CLOSED'
  LOOP
    UPDATE public.harvest_predictions
    SET harvest_available_at = NOW(),
        availability_source = 'EXPECTED_DATE',
        evidence_status = 'pending',
        updated_at = NOW()
    WHERE id = v_prediction.id;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'predictions_processed', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_auto_progress_harvests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_auto_progress_harvests() TO service_role;

COMMIT;
