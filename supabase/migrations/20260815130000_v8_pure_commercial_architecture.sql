-- ============================================================================
-- MIGRATION: 20260815130000_v8_pure_commercial_architecture.sql
-- COMPLETE REMOVAL OF RETIRED FARM-SENSOR & HARVEST-PREDICTION COMMERCIAL LOGIC
-- AUTHORITATIVE ARCHITECTURE:
--   - bulk_offtake_listings
--   - harvest_bids
--   - bid_negotiation_events
--   - trade_requests
--   - notifications
--   - logistics_bookings / vehicle_states
-- ============================================================================

-- 1. Ensure V8 Columns exist on bulk_offtake_listings, harvest_bids, and trade_requests
ALTER TABLE public.bulk_offtake_listings 
  ADD COLUMN IF NOT EXISTS harvest_available_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS availability_source TEXT,
  ADD COLUMN IF NOT EXISTS availability_declared_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS evidence_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS harvest_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS seller_hidden BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE public.harvest_bids
  ADD COLUMN IF NOT EXISTS bulk_offtake_listing_id UUID REFERENCES public.bulk_offtake_listings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS harvest_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS accepted_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS final_accepted_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS final_accepted_price_per_unit NUMERIC,
  ADD COLUMN IF NOT EXISTS final_total_value NUMERIC,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS visible_to_seller BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visible_to_buyer BOOLEAN DEFAULT TRUE;

ALTER TABLE public.trade_requests
  ADD COLUMN IF NOT EXISTS bulk_offtake_listing_id UUID REFERENCES public.bulk_offtake_listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS harvest_bid_id UUID REFERENCES public.harvest_bids(id) ON DELETE SET NULL;

-- 2. DYNAMICALLY DROP ALL CONFLICTING OVERLOADS OF COMMERCIAL FUNCTIONS
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'rpc_publish_bulk_bidding_sale',
            'rpc_place_harvest_bid',
            'rpc_submit_harvest_bid',
            'rpc_counter_harvest_bid',
            'rpc_accept_harvest_bid',
            'rpc_accept_offer',
            'rpc_reject_harvest_bid',
            'rpc_reject_offer',
            'rpc_withdraw_harvest_bid',
            'rpc_withdraw_offer',
            'rpc_cancel_provisional_agreement',
            'rpc_declare_harvest_availability',
            'rpc_declare_harvest_available',
            'rpc_upload_harvest_evidence',
            'rpc_upload_prediction_evidence',
            'rpc_review_buyer_evidence',
            'rpc_review_harvest_evidence',
            'rpc_get_buyer_harvest_opportunities',
            'rpc_get_buyer_my_bids',
            'rpc_cancel_bulk_offtake_listing',
            'rpc_hide_bulk_offtake_listing',
            'rpc_hide_or_delete_bid_record'
          )
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE;';
    END LOOP;
END $$;

-- ============================================================================
-- 3. RPC: rpc_publish_bulk_bidding_sale (V8 Standalone)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_publish_bulk_bidding_sale(
  p_asking_price_per_unit NUMERIC,
  p_crop_type TEXT,
  p_expected_harvest_date TIMESTAMPTZ,
  p_expected_quantity NUMERIC,
  p_expected_quantity_unit TEXT DEFAULT 'kg',
  p_pickup_address TEXT DEFAULT NULL,
  p_pickup_latitude NUMERIC DEFAULT NULL,
  p_pickup_longitude NUMERIC DEFAULT NULL,
  p_planting_date DATE DEFAULT NULL,
  p_seller_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_listing_id UUID;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_expected_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than 0.');
  END IF;
  IF p_asking_price_per_unit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asking price must be greater than 0.');
  END IF;

  INSERT INTO public.bulk_offtake_listings (
    seller_id,
    crop_type,
    listed_quantity,
    quantity_unit,
    asking_price_per_unit,
    planting_date,
    expected_harvest_at,
    pickup_address,
    pickup_latitude,
    pickup_longitude,
    seller_note,
    listing_status,
    evidence_status,
    seller_hidden
  ) VALUES (
    v_actor_id,
    p_crop_type,
    p_expected_quantity,
    COALESCE(p_expected_quantity_unit, 'kg'),
    p_asking_price_per_unit,
    p_planting_date,
    p_expected_harvest_date,
    p_pickup_address,
    p_pickup_latitude,
    p_pickup_longitude,
    p_seller_note,
    'OPEN',
    'PENDING',
    FALSE
  )
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', v_listing_id,
    'listing_status', 'OPEN'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_publish_bulk_bidding_sale(NUMERIC, TEXT, TIMESTAMPTZ, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, DATE, TEXT) TO authenticated;

-- ============================================================================
-- 4. RPC: rpc_get_buyer_harvest_opportunities (V8 Marketplace)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_buyer_harvest_opportunities()
RETURNS TABLE (
  id UUID,
  expected_quantity_volume NUMERIC,
  expected_quantity_unit TEXT,
  expected_quantity_min NUMERIC,
  expected_quantity_max NUMERIC,
  asking_price_per_unit NUMERIC,
  minimum_price_per_unit NUMERIC,
  bidding_status TEXT,
  bidding_origin TEXT,
  created_at TIMESTAMPTZ,
  crop_type TEXT,
  seller_maturity_at TIMESTAMPTZ,
  seller_note TEXT,
  pickup_address TEXT,
  pickup_latitude NUMERIC,
  pickup_longitude NUMERIC,
  seller_name TEXT,
  seller_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bol.id,
    bol.listed_quantity::NUMERIC AS expected_quantity_volume,
    bol.quantity_unit AS expected_quantity_unit,
    bol.listed_quantity::NUMERIC AS expected_quantity_min,
    bol.listed_quantity::NUMERIC AS expected_quantity_max,
    bol.asking_price_per_unit::NUMERIC,
    bol.asking_price_per_unit::NUMERIC AS minimum_price_per_unit,
    bol.listing_status AS bidding_status,
    'MANUAL'::TEXT AS bidding_origin,
    bol.created_at,
    bol.crop_type,
    bol.expected_harvest_at AS seller_maturity_at,
    bol.seller_note,
    bol.pickup_address,
    bol.pickup_latitude::NUMERIC,
    bol.pickup_longitude::NUMERIC,
    u.full_name AS seller_name,
    u.phone_number AS seller_phone
  FROM public.bulk_offtake_listings bol
  LEFT JOIN public.users u ON u.id = bol.seller_id
  WHERE bol.listing_status = 'OPEN'
    AND (bol.seller_hidden IS FALSE OR bol.seller_hidden IS NULL)
  ORDER BY bol.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_buyer_harvest_opportunities() TO authenticated;

-- ============================================================================
-- 5. RPC: rpc_place_harvest_bid & rpc_submit_harvest_bid (V8 Commercial Bidding)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_place_harvest_bid(
  p_listing_id UUID,
  p_desired_quantity NUMERIC,
  p_offered_price_per_unit NUMERIC,
  p_buyer_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_listing public.bulk_offtake_listings%ROWTYPE;
  v_bid_id UUID;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found.');
  END IF;

  IF v_listing.listing_status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is no longer accepting bids.');
  END IF;

  IF v_listing.seller_id = v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sellers cannot bid on their own listings.');
  END IF;

  IF p_desired_quantity <= 0 OR p_desired_quantity > v_listing.listed_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Desired quantity is invalid or exceeds listed quantity.');
  END IF;

  IF p_offered_price_per_unit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offered price must be greater than zero.');
  END IF;

  INSERT INTO public.harvest_bids (
    bulk_offtake_listing_id,
    prediction_id,
    buyer_id,
    desired_quantity,
    offered_price_per_unit,
    total_offer_value,
    bid_status,
    visible_to_seller,
    visible_to_buyer
  ) VALUES (
    p_listing_id,
    NULL,
    v_actor_id,
    p_desired_quantity,
    p_offered_price_per_unit,
    (p_desired_quantity * p_offered_price_per_unit),
    'PENDING',
    TRUE,
    TRUE
  )
  RETURNING id INTO v_bid_id;

  INSERT INTO public.bid_negotiation_events (
    bid_id,
    actor_id,
    actor_role,
    event_type,
    offered_price_per_unit,
    offered_quantity,
    message
  ) VALUES (
    v_bid_id,
    v_actor_id,
    'BUYER',
    'BID_PLACED',
    p_offered_price_per_unit,
    p_desired_quantity,
    COALESCE(p_buyer_message, 'Initial purchase offer')
  );

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    reference_id,
    metadata
  ) VALUES (
    v_listing.seller_id,
    'New Bulk Purchase Offer',
    'A buyer submitted a bid for ' || p_desired_quantity || ' ' || v_listing.quantity_unit || ' of ' || v_listing.crop_type || ' at ₦' || p_offered_price_per_unit || '/' || v_listing.quantity_unit,
    'HARVEST_BID_SUBMITTED',
    v_bid_id,
    jsonb_build_object('listing_id', p_listing_id, 'bid_id', v_bid_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'bid_id', v_bid_id,
    'listing_id', p_listing_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_place_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_submit_harvest_bid(
  p_listing_id UUID,
  p_quantity NUMERIC,
  p_price NUMERIC,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.rpc_place_harvest_bid(p_listing_id, p_quantity, p_price, p_message);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_submit_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ============================================================================
-- 6. RPC: rpc_counter_harvest_bid (Alternating Bi-Directional Negotiation)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_counter_harvest_bid(
  p_bid_id UUID,
  p_counter_price NUMERIC,
  p_counter_quantity NUMERIC,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_listing public.bulk_offtake_listings%ROWTYPE;
  v_is_seller BOOLEAN;
  v_is_buyer BOOLEAN;
  v_counter_count INTEGER;
  v_new_status TEXT;
  v_recipient_id UUID;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bid record not found.');
  END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = v_bid.bulk_offtake_listing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Associated bulk listing not found.');
  END IF;

  v_is_seller := (v_listing.seller_id = v_actor_id);
  v_is_buyer := (v_bid.buyer_id = v_actor_id);

  IF NOT v_is_seller AND NOT v_is_buyer THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to counter this offer.');
  END IF;

  -- Enforce maximum 5 counter iterations
  SELECT COUNT(*) INTO v_counter_count
  FROM public.bid_negotiation_events
  WHERE bid_id = p_bid_id AND event_type = 'COUNTER_OFFER';

  IF v_counter_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum counter-offer iterations (5) reached. Please accept or reject terms.');
  END IF;

  -- Enforce alternating turns
  IF v_is_seller THEN
    IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot counter when it is not the seller''s turn.');
    END IF;
    v_new_status := 'SELLER_COUNTERED';
    v_recipient_id := v_bid.buyer_id;
  ELSE
    IF v_bid.bid_status NOT IN ('SELLER_COUNTERED') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot counter when it is not the buyer''s turn.');
    END IF;
    v_new_status := 'BUYER_COUNTERED';
    v_recipient_id := v_listing.seller_id;
  END IF;

  IF p_counter_quantity <= 0 OR p_counter_quantity > v_listing.listed_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Counter quantity exceeds listed quantity or is invalid.');
  END IF;
  IF p_counter_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Counter price must be greater than zero.');
  END IF;

  -- Update bid terms and status
  UPDATE public.harvest_bids
  SET desired_quantity = p_counter_quantity,
      offered_price_per_unit = p_counter_price,
      total_offer_value = (p_counter_quantity * p_counter_price),
      bid_status = v_new_status,
      updated_at = NOW()
  WHERE id = p_bid_id;

  -- Append negotiation audit event
  INSERT INTO public.bid_negotiation_events (
    bid_id,
    actor_id,
    actor_role,
    event_type,
    offered_price_per_unit,
    offered_quantity,
    message
  ) VALUES (
    p_bid_id,
    v_actor_id,
    CASE WHEN v_is_seller THEN 'SELLER' ELSE 'BUYER' END,
    'COUNTER_OFFER',
    p_counter_price,
    p_counter_quantity,
    COALESCE(p_message, 'Counteroffer: ' || p_counter_quantity || ' ' || v_listing.quantity_unit || ' @ ₦' || p_counter_price || '/' || v_listing.quantity_unit)
  );

  -- Notify recipient
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    reference_id,
    metadata
  ) VALUES (
    v_recipient_id,
    'Counteroffer Received',
    'A counteroffer was submitted for ' || p_counter_quantity || ' ' || v_listing.quantity_unit || ' of ' || v_listing.crop_type || ' at ₦' || p_counter_price || '/' || v_listing.quantity_unit,
    'HARVEST_BID_COUNTERED',
    p_bid_id,
    jsonb_build_object('bid_id', p_bid_id, 'new_status', v_new_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'bid_id', p_bid_id,
    'new_status', v_new_status,
    'counter_quantity', p_counter_quantity,
    'counter_price', p_counter_price
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_counter_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ============================================================================
-- 7. RPC: rpc_accept_harvest_bid & rpc_accept_offer (Provisional Agreement)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_accept_harvest_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_listing public.bulk_offtake_listings%ROWTYPE;
  v_is_seller BOOLEAN;
  v_is_buyer BOOLEAN;
  v_latest_qty NUMERIC;
  v_latest_price NUMERIC;
  v_accepted_total NUMERIC;
  v_remaining NUMERIC;
  v_recipient_id UUID;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bid not found.');
  END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = v_bid.bulk_offtake_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bulk listing not found.');
  END IF;

  v_is_seller := (v_listing.seller_id = v_actor_id);
  v_is_buyer := (v_bid.buyer_id = v_actor_id);

  IF NOT v_is_seller AND NOT v_is_buyer THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  IF v_is_seller THEN
    IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bid cannot be accepted in current state (' || v_bid.bid_status || ').');
    END IF;
    v_recipient_id := v_bid.buyer_id;
  ELSE
    IF v_bid.bid_status NOT IN ('SELLER_COUNTERED') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Counteroffer cannot be accepted in current state (' || v_bid.bid_status || ').');
    END IF;
    v_recipient_id := v_listing.seller_id;
  END IF;

  -- Load latest terms
  SELECT offered_quantity, offered_price_per_unit 
  INTO v_latest_qty, v_latest_price
  FROM public.bid_negotiation_events 
  WHERE bid_id = p_bid_id 
    AND event_type NOT IN ('REJECTED', 'WITHDRAWN', 'CANCELLED')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_latest_qty IS NULL THEN
    v_latest_qty := v_bid.desired_quantity;
    v_latest_price := v_bid.offered_price_per_unit;
  END IF;

  -- Check available capacity
  SELECT COALESCE(SUM(COALESCE(final_accepted_quantity, accepted_quantity, desired_quantity)), 0)
  INTO v_accepted_total
  FROM public.harvest_bids
  WHERE bulk_offtake_listing_id = v_listing.id 
    AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE')
    AND id != p_bid_id;

  v_remaining := v_listing.listed_quantity - v_accepted_total;

  IF v_latest_qty > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acceptance exceeds remaining listed volume (' || v_remaining || ' ' || v_listing.quantity_unit || ' available).');
  END IF;

  -- Establish provisional agreement
  UPDATE public.harvest_bids
  SET bid_status = 'ACCEPTED',
      accepted_quantity = v_latest_qty,
      final_accepted_quantity = v_latest_qty,
      final_accepted_price_per_unit = v_latest_price,
      final_total_value = (v_latest_qty * v_latest_price),
      accepted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bid_id;

  INSERT INTO public.bid_negotiation_events (
    bid_id,
    actor_id,
    actor_role,
    event_type,
    offered_price_per_unit,
    offered_quantity,
    message
  ) VALUES (
    p_bid_id,
    v_actor_id,
    CASE WHEN v_is_seller THEN 'SELLER' ELSE 'BUYER' END,
    'ACCEPTED',
    v_latest_price,
    v_latest_qty,
    'Agreed terms accepted as provisional agreement'
  );

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    reference_id,
    metadata
  ) VALUES (
    v_recipient_id,
    'Purchase Offer Accepted',
    'Terms for ' || v_latest_qty || ' ' || v_listing.quantity_unit || ' of ' || v_listing.crop_type || ' at ₦' || v_latest_price || '/' || v_listing.quantity_unit || ' were accepted. Awaiting physical harvest readiness.',
    'HARVEST_BID_ACCEPTED',
    p_bid_id,
    jsonb_build_object('bid_id', p_bid_id, 'listing_id', v_listing.id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'bid_id', p_bid_id,
    'status', 'ACCEPTED',
    'accepted_quantity', v_latest_qty,
    'accepted_price', v_latest_price
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_accept_harvest_bid(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_accept_offer(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.rpc_accept_harvest_bid(p_bid_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_accept_offer(UUID) TO authenticated;

-- ============================================================================
-- 8. RPC: rpc_reject_harvest_bid & rpc_withdraw_harvest_bid
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_reject_harvest_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_listing public.bulk_offtake_listings%ROWTYPE;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found.'); END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = v_bid.bulk_offtake_listing_id;

  IF v_listing.seller_id != v_actor_id AND v_bid.buyer_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  UPDATE public.harvest_bids
  SET bid_status = 'REJECTED', updated_at = NOW()
  WHERE id = p_bid_id;

  INSERT INTO public.bid_negotiation_events (
    bid_id, actor_id, actor_role, event_type, offered_price_per_unit, offered_quantity, message
  ) VALUES (
    p_bid_id, v_actor_id, CASE WHEN v_listing.seller_id = v_actor_id THEN 'SELLER' ELSE 'BUYER' END, 'REJECTED', v_bid.offered_price_per_unit, v_bid.desired_quantity, 'Offer rejected'
  );

  RETURN jsonb_build_object('success', true, 'bid_id', p_bid_id, 'status', 'REJECTED');
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_reject_harvest_bid(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_withdraw_harvest_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found.'); END IF;

  IF v_bid.buyer_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the buyer can withdraw this bid.');
  END IF;

  IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot withdraw bid in current state (' || v_bid.bid_status || ').');
  END IF;

  UPDATE public.harvest_bids
  SET bid_status = 'WITHDRAWN', updated_at = NOW()
  WHERE id = p_bid_id;

  INSERT INTO public.bid_negotiation_events (
    bid_id, actor_id, actor_role, event_type, offered_price_per_unit, offered_quantity, message
  ) VALUES (
    p_bid_id, v_actor_id, 'BUYER', 'WITHDRAWN', v_bid.offered_price_per_unit, v_bid.desired_quantity, 'Bid withdrawn by buyer'
  );

  RETURN jsonb_build_object('success', true, 'bid_id', p_bid_id, 'status', 'WITHDRAWN');
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_withdraw_harvest_bid(UUID) TO authenticated;

-- ============================================================================
-- 9. RPC: rpc_cancel_provisional_agreement
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_cancel_provisional_agreement(
  p_bid_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_listing public.bulk_offtake_listings%ROWTYPE;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found.'); END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = v_bid.bulk_offtake_listing_id;

  IF v_listing.seller_id != v_actor_id AND v_bid.buyer_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;

  IF v_bid.bid_status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only accepted provisional agreements can be cancelled.');
  END IF;

  UPDATE public.harvest_bids
  SET bid_status = 'CANCELLED',
      cancellation_reason = COALESCE(p_reason, 'Cancelled before trade establishment'),
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bid_id;

  INSERT INTO public.bid_negotiation_events (
    bid_id, actor_id, actor_role, event_type, offered_price_per_unit, offered_quantity, message
  ) VALUES (
    p_bid_id, v_actor_id, CASE WHEN v_listing.seller_id = v_actor_id THEN 'SELLER' ELSE 'BUYER' END, 'CANCELLED', v_bid.final_accepted_price_per_unit, v_bid.final_accepted_quantity, p_reason
  );

  RETURN jsonb_build_object('success', true, 'bid_id', p_bid_id, 'status', 'CANCELLED');
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_provisional_agreement(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 10. RPC: rpc_declare_harvest_availability & rpc_declare_harvest_available
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_declare_harvest_availability(p_listing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_listing public.bulk_offtake_listings%ROWTYPE;
  v_buyer_rec RECORD;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Listing not found.'); END IF;

  IF v_listing.seller_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the listing seller can declare harvest availability.');
  END IF;

  UPDATE public.bulk_offtake_listings
  SET harvest_available_at = COALESCE(harvest_available_at, NOW()),
      availability_source = 'SELLER_DECLARATION',
      availability_declared_by = v_actor_id,
      evidence_status = 'PENDING',
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- Notify all provisional buyers
  FOR v_buyer_rec IN 
    SELECT buyer_id, id AS bid_id FROM public.harvest_bids
    WHERE bulk_offtake_listing_id = p_listing_id AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
  LOOP
    INSERT INTO public.notifications (
      user_id, title, message, type, reference_id, metadata
    ) VALUES (
      v_buyer_rec.buyer_id,
      'Harvest Declared Available',
      'The seller has declared harvest readiness for ' || v_listing.crop_type || '. Awaiting Harvest Confirmation Photo submission.',
      'HARVEST_DECLARED_AVAILABLE',
      v_buyer_rec.bid_id,
      jsonb_build_object('listing_id', p_listing_id, 'bid_id', v_buyer_rec.bid_id)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'harvest_available_at', NOW()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_declare_harvest_availability(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_declare_harvest_available(p_listing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.rpc_declare_harvest_availability(p_listing_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_declare_harvest_available(UUID) TO authenticated;

-- ============================================================================
-- 11. RPC: rpc_upload_harvest_evidence (V8 Photo Evidence Submission)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_upload_harvest_evidence(
  p_listing_id UUID,
  p_photo_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_listing public.bulk_offtake_listings%ROWTYPE;
  v_buyer_rec RECORD;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Listing not found.'); END IF;

  IF v_listing.seller_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the listing seller can upload harvest evidence.');
  END IF;

  IF p_photo_url IS NULL OR length(trim(p_photo_url)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Photo URL is required.');
  END IF;

  -- Ensure harvest readiness is stamped
  UPDATE public.bulk_offtake_listings
  SET harvest_available_at = COALESCE(harvest_available_at, NOW()),
      availability_source = COALESCE(availability_source, 'SELLER_DECLARATION'),
      availability_declared_by = COALESCE(availability_declared_by, v_actor_id),
      harvest_photo_url = p_photo_url,
      evidence_status = 'SUBMITTED',
      updated_at = NOW()
  WHERE id = p_listing_id;

  -- Update all active accepted bids with the harvest photo url
  UPDATE public.harvest_bids
  SET harvest_photo_url = p_photo_url,
      updated_at = NOW()
  WHERE bulk_offtake_listing_id = p_listing_id 
    AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED');

  -- Notify all provisional buyers to review
  FOR v_buyer_rec IN 
    SELECT buyer_id, id AS bid_id FROM public.harvest_bids
    WHERE bulk_offtake_listing_id = p_listing_id AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
  LOOP
    INSERT INTO public.notifications (
      user_id, title, message, type, reference_id, metadata
    ) VALUES (
      v_buyer_rec.buyer_id,
      'Harvest Confirmation Photo Ready',
      'The seller uploaded a Harvest Confirmation Photo for ' || v_listing.crop_type || '. Please review the photo to establish your trade.',
      'HARVEST_EVIDENCE_SUBMITTED',
      v_buyer_rec.bid_id,
      jsonb_build_object('listing_id', p_listing_id, 'bid_id', v_buyer_rec.bid_id, 'photo_url', p_photo_url)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'photo_url', p_photo_url,
    'evidence_status', 'SUBMITTED'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_upload_harvest_evidence(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 12. RPC: rpc_review_buyer_evidence & rpc_review_harvest_evidence
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_review_buyer_evidence(
  p_bid_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_listing public.bulk_offtake_listings%ROWTYPE;
  v_buyer public.users%ROWTYPE;
  v_trade_id UUID;
  v_final_qty NUMERIC;
  v_final_price NUMERIC;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found.'); END IF;

  IF v_bid.buyer_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the provisional buyer can review this evidence.');
  END IF;

  IF v_bid.bid_status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Provisional agreement is not in an accepted state.');
  END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = v_bid.bulk_offtake_listing_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bulk listing not found.'); END IF;

  SELECT * INTO v_buyer FROM public.users WHERE id = v_actor_id;

  v_final_qty := COALESCE(v_bid.final_accepted_quantity, v_bid.accepted_quantity, v_bid.desired_quantity);
  v_final_price := COALESCE(v_bid.final_accepted_price_per_unit, v_bid.offered_price_per_unit);

  IF upper(p_decision) = 'APPROVED' THEN
    -- Convert Bid to Established Trade
    UPDATE public.harvest_bids
    SET bid_status = 'CONVERTED_TO_TRADE',
        updated_at = NOW()
    WHERE id = p_bid_id;

    -- Create exactly one Trade Request in SEARCHING_LOGISTICS state
    INSERT INTO public.trade_requests (
      user_id,
      buyer_id,
      bulk_offtake_listing_id,
      harvest_bid_id,
      commodity_variety,
      quantity_volume,
      quantity_unit,
      agreed_price_per_unit,
      physical_address,
      computed_latitude,
      computed_longitude,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      harvest_photo_url,
      evidence_status,
      request_status,
      submission_channel,
      payment_reference,
      harvest_prediction_id
    ) VALUES (
      v_listing.seller_id,
      v_bid.buyer_id,
      v_listing.id,
      p_bid_id,
      v_listing.crop_type,
      v_final_qty,
      v_listing.quantity_unit,
      v_final_price,
      COALESCE(v_listing.pickup_address, 'Seller Farm Location'),
      v_listing.pickup_latitude,
      v_listing.pickup_longitude,
      COALESCE(v_buyer.macro_region, 'Commercial Delivery Hub'),
      CASE WHEN v_listing.pickup_latitude IS NOT NULL THEN v_listing.pickup_latitude + 0.05 ELSE NULL END,
      CASE WHEN v_listing.pickup_longitude IS NOT NULL THEN v_listing.pickup_longitude + 0.05 ELSE NULL END,
      COALESCE(v_bid.harvest_photo_url, v_listing.harvest_photo_url),
      'provided',
      'SEARCHING_LOGISTICS',
      'web',
      'v8-trade-' || substr(p_bid_id::text, 1, 8),
      NULL
    )
    RETURNING id INTO v_trade_id;

    -- Notify Seller of Established Trade
    INSERT INTO public.notifications (
      user_id, title, message, type, reference_id, metadata
    ) VALUES (
      v_listing.seller_id,
      'Trade Established & Logistics Active',
      v_buyer.full_name || ' approved the Harvest Confirmation Photo. Trade request created and active for carrier dispatch.',
      'TRADE_ESTABLISHED',
      v_trade_id,
      jsonb_build_object('trade_id', v_trade_id, 'bid_id', p_bid_id)
    );

    RETURN jsonb_build_object(
      'success', true,
      'decision', 'APPROVED',
      'trade_id', v_trade_id,
      'bid_status', 'CONVERTED_TO_TRADE',
      'request_status', 'SEARCHING_LOGISTICS'
    );

  ELSIF upper(p_decision) = 'REJECTED' THEN
    -- Photo Rejected: Reset evidence state to allow replacement upload while preserving agreement
    UPDATE public.bulk_offtake_listings
    SET evidence_status = 'PENDING',
        harvest_photo_url = NULL,
        updated_at = NOW()
    WHERE id = v_listing.id;

    UPDATE public.harvest_bids
    SET harvest_photo_url = NULL,
        updated_at = NOW()
    WHERE id = p_bid_id;

    INSERT INTO public.notifications (
      user_id, title, message, type, reference_id, metadata
    ) VALUES (
      v_listing.seller_id,
      'Harvest Confirmation Photo Rejected',
      'Buyer ' || v_buyer.full_name || ' requested a replacement harvest photo. Reason: ' || COALESCE(p_reason, 'Photo was unclear.'),
      'HARVEST_EVIDENCE_REJECTED',
      p_bid_id,
      jsonb_build_object('bid_id', p_bid_id, 'reason', p_reason)
    );

    RETURN jsonb_build_object(
      'success', true,
      'decision', 'REJECTED',
      'bid_status', v_bid.bid_status,
      'message', 'Photo rejected. Seller notified to provide replacement photo.'
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid decision. Must be APPROVED or REJECTED.');
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_review_buyer_evidence(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_review_harvest_evidence(
  p_bid_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.rpc_review_buyer_evidence(p_bid_id, p_decision, p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_review_harvest_evidence(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 13. RPC: rpc_get_buyer_my_bids (V8 Direct Bid Query)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_buyer_my_bids()
RETURNS TABLE (
  id UUID,
  prediction_id UUID,
  bulk_offtake_listing_id UUID,
  desired_quantity NUMERIC,
  accepted_quantity NUMERIC,
  offered_price_per_unit NUMERIC,
  total_offer_value NUMERIC,
  bid_status TEXT,
  harvest_photo_url TEXT,
  created_at TIMESTAMPTZ,
  crop_type TEXT,
  expected_quantity_unit TEXT,
  quantity_unit TEXT,
  pickup_address TEXT,
  seller_name TEXT,
  seller_phone TEXT,
  harvest_predictions JSONB,
  bulk_offtake_listings JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer_id UUID;
BEGIN
  SELECT u.id INTO v_buyer_id FROM public.users u WHERE u.auth_uid = auth.uid();
  IF v_buyer_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT 
    hb.id,
    NULL::UUID AS prediction_id,
    bol.id AS bulk_offtake_listing_id,
    hb.desired_quantity,
    hb.accepted_quantity,
    hb.offered_price_per_unit,
    hb.total_offer_value,
    hb.bid_status,
    COALESCE(hb.harvest_photo_url, bol.harvest_photo_url) AS harvest_photo_url,
    hb.created_at,
    bol.crop_type,
    bol.quantity_unit AS expected_quantity_unit,
    bol.quantity_unit,
    bol.pickup_address,
    u.full_name AS seller_name,
    u.phone_number AS seller_phone,
    jsonb_build_object(
      'id', bol.id,
      'crop_type', bol.crop_type,
      'expected_quantity_unit', bol.quantity_unit,
      'quantity_unit', bol.quantity_unit,
      'pickup_address', bol.pickup_address,
      'harvest_photo_url', COALESCE(hb.harvest_photo_url, bol.harvest_photo_url),
      'bidding_origin', 'MANUAL'
    ) AS harvest_predictions,
    jsonb_build_object(
      'id', bol.id,
      'crop_type', bol.crop_type,
      'listed_quantity', bol.listed_quantity,
      'quantity_unit', bol.quantity_unit,
      'asking_price_per_unit', bol.asking_price_per_unit,
      'pickup_address', bol.pickup_address,
      'harvest_photo_url', COALESCE(hb.harvest_photo_url, bol.harvest_photo_url),
      'seller_name', u.full_name,
      'seller_phone', u.phone_number
    ) AS bulk_offtake_listings
  FROM public.harvest_bids hb
  JOIN public.bulk_offtake_listings bol ON bol.id = hb.bulk_offtake_listing_id
  LEFT JOIN public.users u ON u.id = bol.seller_id
  WHERE hb.buyer_id = v_buyer_id
    AND (hb.visible_to_buyer IS TRUE OR hb.visible_to_buyer IS NULL)
  ORDER BY hb.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_buyer_my_bids() TO authenticated;

-- ============================================================================
-- 14. RPC: rpc_cancel_bulk_offtake_listing & rpc_hide_bulk_offtake_listing
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_cancel_bulk_offtake_listing(
  p_listing_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_listing public.bulk_offtake_listings%ROWTYPE;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Listing not found.'); END IF;

  IF v_listing.seller_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the listing seller can cancel this listing.');
  END IF;

  UPDATE public.bulk_offtake_listings
  SET listing_status = 'CANCELLED',
      cancelled_at = NOW(),
      cancelled_by = v_actor_id,
      cancellation_reason = COALESCE(p_reason, 'Cancelled by seller before trade establishment'),
      updated_at = NOW()
  WHERE id = p_listing_id;

  UPDATE public.harvest_bids
  SET bid_status = 'CANCELLED',
      cancellation_reason = COALESCE(p_reason, 'Listing cancelled by seller'),
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE bulk_offtake_listing_id = p_listing_id
    AND bid_status IN ('PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED', 'ACCEPTED', 'PARTIALLY_ACCEPTED');

  RETURN jsonb_build_object('success', true, 'listing_id', p_listing_id, 'status', 'CANCELLED');
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_bulk_offtake_listing(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_hide_bulk_offtake_listing(p_listing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  UPDATE public.bulk_offtake_listings
  SET seller_hidden = TRUE, updated_at = NOW()
  WHERE id = p_listing_id AND seller_id = v_actor_id;

  RETURN jsonb_build_object('success', true, 'listing_id', p_listing_id, 'seller_hidden', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_hide_bulk_offtake_listing(UUID) TO authenticated;

-- ============================================================================
-- 15. RPC: rpc_hide_or_delete_bid_record
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_hide_or_delete_bid_record(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_listing public.bulk_offtake_listings%ROWTYPE;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required.'); END IF;

  SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found.'); END IF;

  SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = v_bid.bulk_offtake_listing_id;

  IF v_bid.buyer_id = v_actor_id THEN
    UPDATE public.harvest_bids SET visible_to_buyer = FALSE, updated_at = NOW() WHERE id = p_bid_id;
    RETURN jsonb_build_object('success', true, 'hidden_for', 'BUYER');
  ELSIF v_listing.seller_id = v_actor_id THEN
    UPDATE public.harvest_bids SET visible_to_seller = FALSE, updated_at = NOW() WHERE id = p_bid_id;
    RETURN jsonb_build_object('success', true, 'hidden_for', 'SELLER');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized.');
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_hide_or_delete_bid_record(UUID) TO authenticated;

-- ============================================================================
-- 16. Ensure Authoritative RLS Policies on V8 Tables
-- ============================================================================
ALTER TABLE public.bulk_offtake_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_negotiation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read open bulk listings" ON public.bulk_offtake_listings;
CREATE POLICY "Public read open bulk listings" ON public.bulk_offtake_listings
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Sellers manage own bulk listings" ON public.bulk_offtake_listings;
CREATE POLICY "Sellers manage own bulk listings" ON public.bulk_offtake_listings
  FOR ALL TO authenticated
  USING (seller_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid()));

DROP POLICY IF EXISTS "Buyers manage own bids" ON public.harvest_bids;
CREATE POLICY "Buyers manage own bids" ON public.harvest_bids
  FOR ALL TO authenticated
  USING (buyer_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid()));

DROP POLICY IF EXISTS "Sellers view bids on their listings" ON public.harvest_bids;
CREATE POLICY "Sellers view bids on their listings" ON public.harvest_bids
  FOR SELECT TO authenticated
  USING (
    bulk_offtake_listing_id IN (
      SELECT id FROM public.bulk_offtake_listings 
      WHERE seller_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Negotiation events visible to participants" ON public.bid_negotiation_events;
CREATE POLICY "Negotiation events visible to participants" ON public.bid_negotiation_events
  FOR SELECT TO authenticated
  USING (
    bid_id IN (
      SELECT hb.id FROM public.harvest_bids hb
      LEFT JOIN public.bulk_offtake_listings bol ON bol.id = hb.bulk_offtake_listing_id
      WHERE hb.buyer_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
         OR bol.seller_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
    )
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
