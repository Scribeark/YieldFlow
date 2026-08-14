BEGIN;

-- ============================================================================
-- V8 Buyer Evidence Review & Trade Establishment
-- ============================================================================

-- 1. Add bid-level evidence tracking to harvest_bids
ALTER TABLE public.harvest_bids ADD COLUMN IF NOT EXISTS buyer_evidence_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.harvest_bids ADD COLUMN IF NOT EXISTS buyer_evidence_reason TEXT;
ALTER TABLE public.harvest_bids ADD COLUMN IF NOT EXISTS buyer_evidence_reviewed_at TIMESTAMPTZ;
ALTER TABLE public.harvest_bids ADD COLUMN IF NOT EXISTS buyer_evidence_reviewed_by UUID REFERENCES public.users(id);

ALTER TABLE public.harvest_bids DROP CONSTRAINT IF EXISTS check_buyer_evidence_status;
ALTER TABLE public.harvest_bids ADD CONSTRAINT check_buyer_evidence_status CHECK (buyer_evidence_status IN ('PENDING', 'PROVIDED', 'APPROVED', 'REJECTED'));

-- 2. Modify seller evidence upload to validate storage ownership and cascade
DROP FUNCTION IF EXISTS public.rpc_upload_harvest_evidence(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.rpc_upload_harvest_evidence(p_listing_id UUID, p_photo_url TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE 
  v_user_id UUID; 
  v_auth_uid UUID;
  v_listing public.bulk_offtake_listings%ROWTYPE;
BEGIN
    v_auth_uid := auth.uid();
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = v_auth_uid;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = p_listing_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
    
    IF v_listing.seller_id != v_user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
    IF p_photo_url IS NULL OR BTRIM(p_photo_url) = '' THEN RAISE EXCEPTION 'Harvest Confirmation Photo is required'; END IF;

    -- Update listing overall status
    UPDATE public.bulk_offtake_listings 
    SET evidence_status = 'PROVIDED', harvest_photo_url = p_photo_url, updated_at = NOW() 
    WHERE id = p_listing_id;
    
    -- Cascade PROVIDED to bids that are pending or were rejected before
    UPDATE public.harvest_bids 
    SET buyer_evidence_status = 'PROVIDED', updated_at = NOW() 
    WHERE bulk_offtake_listing_id = p_listing_id 
      AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
      AND (buyer_evidence_status = 'PENDING' OR buyer_evidence_status = 'REJECTED');

    -- Update trade request photo if pre-logistics record already exists
    UPDATE public.trade_requests
    SET harvest_photo_url = p_photo_url, updated_at = NOW()
    WHERE bulk_offtake_listing_id = p_listing_id;

    INSERT INTO public.notifications (recipient_id, actor_id, bulk_offtake_listing_id, event_type, message)
    SELECT buyer_id, v_user_id, p_listing_id, 'EVIDENCE_PROVIDED', 'Seller has provided a Harvest Confirmation Photo. Please review it.' 
    FROM public.harvest_bids WHERE bulk_offtake_listing_id = p_listing_id AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED');
    
    RETURN jsonb_build_object('success', true);
END; $$;
REVOKE ALL ON FUNCTION public.rpc_upload_harvest_evidence(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_upload_harvest_evidence(UUID, TEXT) TO authenticated;

-- 3. Create Authoritative Buyer Evidence Review RPC (idempotent)
DROP FUNCTION IF EXISTS public.rpc_review_buyer_evidence(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_review_harvest_evidence(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_review_buyer_evidence(
  p_bid_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE 
  v_user_id UUID; 
  v_bid public.harvest_bids%ROWTYPE; 
  v_listing public.bulk_offtake_listings%ROWTYPE; 
  v_trade_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN 
      RAISE EXCEPTION 'Decision must be APPROVED or REJECTED'; 
    END IF;

    IF p_decision = 'REJECTED' AND (p_reason IS NULL OR BTRIM(p_reason) = '') THEN
      RAISE EXCEPTION 'A reason is required when rejecting a photo';
    END IF;

    SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;

    SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = v_bid.bulk_offtake_listing_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;

    IF v_bid.buyer_id != v_user_id THEN 
      RAISE EXCEPTION 'Not authorized to review this harvest photo'; 
    END IF;
    
    IF v_listing.seller_id = v_user_id THEN
      RAISE EXCEPTION 'Seller cannot review their own harvest photo';
    END IF;

    -- Idempotency check: if already APPROVED and trade is in SEARCHING_LOGISTICS
    IF p_decision = 'APPROVED' AND v_bid.buyer_evidence_status = 'APPROVED' AND v_bid.bid_status = 'CONVERTED_TO_TRADE' THEN
      SELECT id INTO v_trade_id FROM public.trade_requests WHERE harvest_bid_id = p_bid_id LIMIT 1;
      IF v_trade_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'decision', p_decision, 'trade_id', v_trade_id);
      END IF;
    END IF;

    IF v_bid.bid_status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE') THEN 
      RAISE EXCEPTION 'Provisional agreement is not in ACCEPTED state'; 
    END IF;

    IF p_decision = 'APPROVED' THEN
      -- Establish / Transition exactly one trade record to SEARCHING_LOGISTICS
      INSERT INTO public.trade_requests (
          bulk_offtake_listing_id, user_id, buyer_id, commodity_variety, quantity, 
          physical_address, computed_latitude, computed_longitude,
          request_status, evidence_status, harvest_bid_id, harvest_photo_url
      ) VALUES (
          v_listing.id, v_listing.seller_id, v_bid.buyer_id, v_listing.crop_type, 
          COALESCE(v_bid.final_accepted_quantity, v_bid.accepted_quantity, v_bid.desired_quantity),
          v_listing.pickup_address, v_listing.pickup_latitude, v_listing.pickup_longitude,
          'SEARCHING_LOGISTICS', 'VERIFIED', v_bid.id, v_listing.harvest_photo_url
      ) 
      ON CONFLICT (harvest_bid_id) DO UPDATE 
      SET request_status = 'SEARCHING_LOGISTICS',
          evidence_status = 'VERIFIED',
          harvest_photo_url = EXCLUDED.harvest_photo_url,
          updated_at = NOW()
      RETURNING id INTO v_trade_id;

      IF v_trade_id IS NULL THEN
        SELECT id INTO v_trade_id FROM public.trade_requests WHERE harvest_bid_id = p_bid_id LIMIT 1;
      END IF;

      -- Update bid status only after trade transition succeeds
      UPDATE public.harvest_bids 
      SET buyer_evidence_status = 'APPROVED', 
          buyer_evidence_reviewed_by = v_user_id, 
          buyer_evidence_reviewed_at = NOW(), 
          buyer_evidence_reason = NULL,
          bid_status = 'CONVERTED_TO_TRADE',
          updated_at = NOW()
      WHERE id = p_bid_id;

      -- Notify seller and buyer
      IF v_bid.buyer_evidence_status != 'APPROVED' THEN
        INSERT INTO public.notifications (recipient_id, actor_id, bulk_offtake_listing_id, trade_id, bid_id, event_type, message)
        VALUES 
          (v_listing.seller_id, v_user_id, v_listing.id, v_trade_id, p_bid_id, 'EVIDENCE_APPROVED', 'Buyer approved Harvest Confirmation Photo. Trade is now active for logistics.'),
          (v_bid.buyer_id, v_listing.seller_id, v_listing.id, v_trade_id, p_bid_id, 'TRADE_ESTABLISHED', 'Trade established successfully.');
      END IF;

      RETURN jsonb_build_object('success', true, 'decision', p_decision, 'trade_id', v_trade_id);

    ELSE
      -- REJECTED: preserves agreement, does not activate SEARCHING_LOGISTICS
      UPDATE public.harvest_bids 
      SET buyer_evidence_status = 'REJECTED', 
          buyer_evidence_reviewed_by = v_user_id, 
          buyer_evidence_reviewed_at = NOW(), 
          buyer_evidence_reason = p_reason,
          updated_at = NOW()
      WHERE id = p_bid_id;

      INSERT INTO public.notifications (recipient_id, actor_id, bulk_offtake_listing_id, bid_id, event_type, message)
      VALUES (v_listing.seller_id, v_user_id, v_listing.id, p_bid_id, 'EVIDENCE_REJECTED', 'Buyer rejected the Harvest Confirmation Photo: ' || p_reason);
      
      RETURN jsonb_build_object('success', true, 'decision', p_decision);
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_review_harvest_evidence(
  p_bid_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public.rpc_review_buyer_evidence(p_bid_id, p_decision, p_reason);
END; $$;

REVOKE ALL ON FUNCTION public.rpc_review_buyer_evidence(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_review_buyer_evidence(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_review_harvest_evidence(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_review_harvest_evidence(UUID, TEXT, TEXT) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
