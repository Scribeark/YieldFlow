-- 20260814193000_v8_place_harvest_bid.sql

-- Drop previous overloads to eliminate schema cache ambiguities
DROP FUNCTION IF EXISTS public.rpc_place_harvest_bid(uuid, integer, numeric, text);
DROP FUNCTION IF EXISTS public.rpc_place_harvest_bid(uuid, numeric, numeric, text);

-- Unified V8 rpc_place_harvest_bid
CREATE OR REPLACE FUNCTION public.rpc_place_harvest_bid(
    p_listing_id UUID,
    p_desired_quantity NUMERIC,
    p_offered_price_per_unit NUMERIC,
    p_buyer_message TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_buyer_id UUID;
    v_profession TEXT;
    v_listing public.bulk_offtake_listings%ROWTYPE;
    v_total_value NUMERIC;
    v_bid_id UUID;
BEGIN
    -- 1. Input Validation
    IF p_desired_quantity IS NULL OR p_desired_quantity <= 0 THEN
        RAISE EXCEPTION 'Desired quantity must be > 0';
    END IF;
    IF p_offered_price_per_unit IS NULL OR p_offered_price_per_unit <= 0 THEN
        RAISE EXCEPTION 'Offered price must be > 0';
    END IF;

    -- 2. Authorization & Role Validation
    SELECT id, declared_profession INTO v_buyer_id, v_profession 
    FROM public.users 
    WHERE auth_uid = auth.uid();

    IF v_buyer_id IS NULL 
       OR v_profession IS NULL 
       OR v_profession NOT IN ('Enterprise Buyer', 'Commercial Buyer') 
    THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied: Must be an Enterprise Buyer or Commercial Buyer';
    END IF;

    -- 3. Target Listing Validation
    SELECT * INTO v_listing 
    FROM public.bulk_offtake_listings 
    WHERE id = p_listing_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing not found';
    END IF;

    IF v_listing.seller_id = v_buyer_id THEN
        RAISE EXCEPTION 'Seller cannot bid on own listing';
    END IF;

    IF v_listing.listing_status != 'OPEN' THEN
        RAISE EXCEPTION 'Listing is not open for bidding';
    END IF;

    IF p_desired_quantity > v_listing.listed_quantity THEN
        RAISE EXCEPTION 'Desired quantity cannot exceed total listed volume';
    END IF;

    -- 4. Calculate total offer value
    v_total_value := p_desired_quantity * p_offered_price_per_unit;

    -- 5. Insert Bid into harvest_bids (V8 schema)
    INSERT INTO public.harvest_bids (
        bulk_offtake_listing_id,
        buyer_id,
        desired_quantity,
        desired_quantity_unit,
        offered_price_per_unit,
        total_offer_value,
        bid_status,
        buyer_message,
        visible_to_buyer,
        visible_to_seller
    ) VALUES (
        p_listing_id,
        v_buyer_id,
        p_desired_quantity,
        v_listing.quantity_unit,
        p_offered_price_per_unit,
        v_total_value,
        'PENDING',
        p_buyer_message,
        true,
        true
    ) RETURNING id INTO v_bid_id;

    -- 6. Insert negotiation audit event
    INSERT INTO public.bid_negotiation_events (
        bid_id,
        actor_id,
        actor_role,
        event_type,
        offered_price_per_unit,
        offered_quantity,
        message,
        created_at
    ) VALUES (
        v_bid_id,
        v_buyer_id,
        'BUYER',
        'SUBMITTED',
        p_offered_price_per_unit,
        p_desired_quantity,
        p_buyer_message,
        NOW()
    );

    -- 7. Insert Notification for seller
    INSERT INTO public.notifications (
        recipient_id,
        actor_id,
        bulk_offtake_listing_id,
        bid_id,
        event_type,
        message
    ) VALUES (
        v_listing.seller_id,
        v_buyer_id,
        p_listing_id,
        v_bid_id,
        'BID_SUBMITTED',
        'A buyer has submitted a new offer on your ' || v_listing.crop_type || ' listing.'
    );

    RETURN json_build_object('success', true, 'bid_id', v_bid_id);
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.rpc_place_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_place_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
