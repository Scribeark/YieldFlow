BEGIN;

-- ============================================================================
-- Phase 2: Database-Level Listing Cancellation, Hiding & Soft Delete
-- ============================================================================

-- 1. Ensure soft-delete and cancellation tracking columns exist
ALTER TABLE public.bulk_offtake_listings
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS seller_hidden BOOLEAN DEFAULT FALSE;

-- 2. Authoritative Atomic Cancellation RPC
CREATE OR REPLACE FUNCTION public.rpc_cancel_bulk_offtake_listing(
  p_listing_id UUID,
  p_reason TEXT DEFAULT 'Cancelled by seller'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_listing public.bulk_offtake_listings%ROWTYPE;
  v_has_active_trades BOOLEAN;
  v_buyer_rec RECORD;
BEGIN
  -- 1. Verify Authentication
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
  END IF;

  -- 2. Lock and verify listing ownership
  SELECT * INTO v_listing 
  FROM public.bulk_offtake_listings 
  WHERE id = p_listing_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  IF v_listing.seller_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only the seller can cancel this listing');
  END IF;

  IF v_listing.listing_status = 'CANCELLED' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Listing is already cancelled');
  END IF;

  -- 3. Refuse cancellation if an established trade or active logistics record exists
  SELECT EXISTS (
    SELECT 1 FROM public.trade_requests tr
    WHERE tr.bulk_offtake_listing_id = p_listing_id
      AND tr.request_status NOT IN ('CANCELLED', 'AWAITING_BUYER', 'EVIDENCE_PENDING')
  ) INTO v_has_active_trades;

  IF v_has_active_trades THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel listing: Active trade fulfilment or logistics dispatch is already underway.');
  END IF;

  -- 4. Update listing status to CANCELLED atomically
  UPDATE public.bulk_offtake_listings
  SET listing_status = 'CANCELLED',
      cancelled_at = NOW(),
      cancelled_by = v_actor_id,
      cancellation_reason = COALESCE(NULLIF(BTRIM(p_reason), ''), 'Cancelled by seller'),
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- 5 & 6. Cancel eligible pending purchase offers and provisional agreements, logging events atomically
  WITH cancelled_bids AS (
    UPDATE public.harvest_bids
    SET
      bid_status = 'CANCELLED',
      cancelled_at = NOW(),
      cancelled_by = v_actor_id,
      cancellation_reason =
        'Bulk listing cancelled by seller: ' ||
        COALESCE(NULLIF(BTRIM(p_reason), ''), 'No reason provided'),
      updated_at = NOW()
    WHERE bulk_offtake_listing_id = p_listing_id
      AND bid_status IN (
        'PENDING',
        'BUYER_COUNTERED',
        'SELLER_COUNTERED',
        'ACCEPTED',
        'PARTIALLY_ACCEPTED'
      )
    RETURNING
      id,
      COALESCE(
        final_accepted_quantity,
        accepted_quantity,
        desired_quantity
      ) AS event_quantity,
      COALESCE(
        final_accepted_price_per_unit,
        offered_price_per_unit
      ) AS event_price
  )
  INSERT INTO public.bid_negotiation_events (
    bid_id,
    actor_id,
    actor_role,
    event_type,
    offered_quantity,
    offered_price_per_unit,
    message,
    created_at
  )
  SELECT
    id,
    v_actor_id,
    'SELLER',
    'CANCELLED',
    event_quantity,
    event_price,
    'Listing cancelled by seller: ' ||
      COALESCE(NULLIF(BTRIM(p_reason), ''), 'No reason provided'),
    NOW()
  FROM cancelled_bids;

  -- 7. Notify affected buyers
  FOR v_buyer_rec IN (
    SELECT DISTINCT buyer_id 
    FROM public.harvest_bids 
    WHERE bulk_offtake_listing_id = p_listing_id 
      AND buyer_id IS NOT NULL 
      AND buyer_id != v_actor_id
  ) LOOP
    INSERT INTO public.notifications (
      recipient_id, actor_id, bulk_offtake_listing_id, event_type, message
    ) VALUES (
      v_buyer_rec.buyer_id,
      v_actor_id,
      p_listing_id,
      'LISTING_CANCELLED',
      'A listing with your active offer or provisional agreement has been cancelled by the seller.'
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'listing_id', p_listing_id, 'listing_status', 'CANCELLED');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cancel_bulk_offtake_listing(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_bulk_offtake_listing(UUID, TEXT) TO authenticated;


-- 3. Authoritative Seller-Only Visibility Hiding RPC
CREATE OR REPLACE FUNCTION public.rpc_hide_bulk_offtake_listing(
  p_listing_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
  END IF;

  UPDATE public.bulk_offtake_listings
  SET seller_hidden = TRUE,
      updated_at = NOW()
  WHERE id = p_listing_id
    AND seller_id = v_actor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found or unauthorized');
  END IF;

  RETURN jsonb_build_object('success', true, 'listing_id', p_listing_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_hide_bulk_offtake_listing(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_hide_bulk_offtake_listing(UUID) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
