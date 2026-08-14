-- 20260814220000_v8_seller_bids_rls_and_buyer_hiding.sql

BEGIN;

-- ============================================================================
-- 1. Ensure Visibility Columns on harvest_bids
-- ============================================================================
ALTER TABLE public.harvest_bids
  ADD COLUMN IF NOT EXISTS visible_to_buyer BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_to_seller BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- 2. Unified Row Level Security (RLS) on harvest_bids & bid_negotiation_events
-- ============================================================================
ALTER TABLE public.harvest_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_negotiation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can view bids on own predictions" ON public.harvest_bids;
DROP POLICY IF EXISTS "Buyers can view own bids" ON public.harvest_bids;
DROP POLICY IF EXISTS "Sellers can view bids on own bulk offtake listings" ON public.harvest_bids;
DROP POLICY IF EXISTS "harvest_bids_select_policy" ON public.harvest_bids;

CREATE POLICY "harvest_bids_select_policy" ON public.harvest_bids
FOR SELECT TO authenticated
USING (
  -- A. Buyer who placed the bid
  buyer_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  OR
  -- B. Seller who owns the V8 bulk offtake listing
  bulk_offtake_listing_id IN (
    SELECT id FROM public.bulk_offtake_listings 
    WHERE seller_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  )
);

DROP POLICY IF EXISTS "Participants can view their negotiation events" ON public.bid_negotiation_events;
DROP POLICY IF EXISTS "bid_negotiation_events_select_policy" ON public.bid_negotiation_events;

CREATE POLICY "bid_negotiation_events_select_policy" ON public.bid_negotiation_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.harvest_bids hb
    LEFT JOIN public.bulk_offtake_listings bol ON bol.id = hb.bulk_offtake_listing_id
    WHERE hb.id = bid_negotiation_events.bid_id
      AND (
        hb.buyer_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
        OR bol.seller_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
      )
  )
);

-- ============================================================================
-- 3. Authoritative RPC to Hide Bids (For Buyer or Seller)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_hide_or_delete_bid_record(
  p_bid_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_listing public.bulk_offtake_listings%ROWTYPE;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
  END IF;

  SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bid record not found');
  END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = v_bid.bulk_offtake_listing_id;

  IF v_bid.buyer_id = v_user_id THEN
    UPDATE public.harvest_bids
    SET visible_to_buyer = FALSE, updated_at = NOW()
    WHERE id = p_bid_id;
    RETURN jsonb_build_object('success', true, 'hidden_for', 'BUYER');
  ELSIF v_listing.seller_id = v_user_id THEN
    UPDATE public.harvest_bids
    SET visible_to_seller = FALSE, updated_at = NOW()
    WHERE id = p_bid_id;
    RETURN jsonb_build_object('success', true, 'hidden_for', 'SELLER');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_hide_or_delete_bid_record(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_hide_or_delete_bid_record(UUID) TO authenticated;

-- ============================================================================
-- 4. Update rpc_get_buyer_my_bids to Respect visible_to_buyer = TRUE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_buyer_my_bids()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_buyer_id uuid;
    v_profession text;
    v_result json;
BEGIN
    SELECT id, declared_profession INTO v_buyer_id, v_profession FROM public.users WHERE auth_uid = auth.uid();
    
    IF v_buyer_id IS NULL
       OR v_profession IS NULL
       OR v_profession NOT IN ('Enterprise Buyer', 'Commercial Buyer')
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Access denied: Must be an Enterprise Buyer or Commercial Buyer';
    END IF;

    SELECT json_agg(
        json_build_object(
            'id', hb.id,
            'prediction_id', hb.bulk_offtake_listing_id,
            'desired_quantity', hb.desired_quantity,
            'accepted_quantity', hb.accepted_quantity,
            'offered_price_per_unit', hb.offered_price_per_unit,
            'total_offer_value', hb.total_offer_value,
            'bid_status', hb.bid_status,
            'created_at', hb.created_at,
            'harvest_photo_url', bol.harvest_photo_url,
            'harvest_predictions', json_build_object(
                'id', bol.id,
                'bidding_origin', 'MANUAL',
                'expected_quantity_unit', bol.quantity_unit,
                'crop_type', bol.crop_type,
                'pickup_address', bol.pickup_address,
                'harvest_photo_url', bol.harvest_photo_url
            ),
            'bulk_offtake_listings', json_build_object(
                'id', bol.id,
                'bidding_origin', 'MANUAL',
                'expected_quantity_unit', bol.quantity_unit,
                'crop_type', bol.crop_type,
                'pickup_address', bol.pickup_address,
                'harvest_photo_url', bol.harvest_photo_url
            )
        ) ORDER BY hb.created_at DESC
    )
    INTO v_result
    FROM public.harvest_bids hb
    JOIN public.bulk_offtake_listings bol ON hb.bulk_offtake_listing_id = bol.id
    WHERE hb.buyer_id = v_buyer_id
      AND COALESCE(hb.visible_to_buyer, TRUE) = TRUE;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_buyer_my_bids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_buyer_my_bids() TO authenticated;

-- ============================================================================
-- 5. Decouple Legacy Constraints (Drop foreign keys to harvest_predictions)
-- ============================================================================
ALTER TABLE public.harvest_bids DROP CONSTRAINT IF EXISTS harvest_bids_prediction_id_fkey;
ALTER TABLE public.bulk_offtake_listings DROP CONSTRAINT IF EXISTS bulk_offtake_listings_farm_id_fkey;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
