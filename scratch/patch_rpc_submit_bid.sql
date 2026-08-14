CREATE OR REPLACE FUNCTION public.rpc_submit_harvest_bid(p_listing_id UUID, p_quantity NUMERIC, p_price NUMERIC, p_message TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID; v_listing public.bulk_offtake_listings%ROWTYPE; v_bid_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
    SELECT * INTO v_listing FROM public.bulk_offtake_listings WHERE id = p_listing_id;
    IF v_listing.seller_id = v_user_id THEN RAISE EXCEPTION 'Seller cannot bid on own listing'; END IF;
    IF v_listing.listing_status != 'OPEN' THEN RAISE EXCEPTION 'Listing is not open'; END IF;
    INSERT INTO public.harvest_bids (bulk_offtake_listing_id, buyer_id, desired_quantity, desired_quantity_unit, offered_price_per_unit, total_offer_value, bid_status, visible_to_buyer, visible_to_seller)
    VALUES (p_listing_id, v_user_id, p_quantity, v_listing.quantity_unit, p_price, (p_quantity * p_price), 'PENDING', true, true) RETURNING id INTO v_bid_id;
    INSERT INTO public.bid_negotiation_events (bid_id, actor_id, actor_role, event_type, offered_quantity, offered_price_per_unit, message, created_at)
    VALUES (v_bid_id, v_user_id, 'BUYER', 'SUBMITTED', p_quantity, p_price, p_message, NOW());
    INSERT INTO public.notifications (recipient_id, actor_id, bulk_offtake_listing_id, bid_id, event_type, message)
    VALUES (v_listing.seller_id, v_user_id, p_listing_id, v_bid_id, 'BID_SUBMITTED', 'A buyer has submitted a new offer.');
    RETURN json_build_object('success', true, 'bid_id', v_bid_id);
END; $$;

REVOKE ALL ON FUNCTION public.rpc_submit_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_submit_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;
