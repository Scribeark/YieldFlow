BEGIN;

-- ===========================================================================
-- 1. TRANSACTION STATE MODEL ENFORCEMENT (RPC UPDATES)
-- ===========================================================================

-- 1.a Accept Harvest Bid
CREATE OR REPLACE FUNCTION public.rpc_accept_harvest_bid(
    p_bid_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_bid public.harvest_bids%ROWTYPE;
    v_pred public.harvest_predictions%ROWTYPE;
    v_farm public.farms%ROWTYPE;
    v_is_seller BOOLEAN;
    v_is_buyer BOOLEAN;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;

    SELECT * INTO v_pred FROM public.harvest_predictions WHERE id = v_bid.prediction_id;
    SELECT * INTO v_farm FROM public.farms WHERE id = (SELECT farm_id FROM public.farm_crop_allocations WHERE id = v_pred.crop_allocation_id);

    v_is_seller := (v_farm.user_id = v_user_id);
    v_is_buyer := (v_bid.buyer_id = v_user_id);

    IF NOT v_is_seller AND NOT v_is_buyer THEN
        RAISE EXCEPTION 'Not authorized to accept this bid';
    END IF;

    -- Prevent repeated acceptance and reviving closed bids
    IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED') THEN
        RAISE EXCEPTION 'Bid cannot be accepted in its current state: %', v_bid.bid_status;
    END IF;

    -- Prevent participant from accepting their own offer
    IF v_is_buyer AND v_bid.bid_status IN ('PENDING', 'BUYER_COUNTERED') THEN
        RAISE EXCEPTION 'Buyer cannot accept their own offer/counteroffer.';
    END IF;

    IF v_is_seller AND v_bid.bid_status = 'SELLER_COUNTERED' THEN
        RAISE EXCEPTION 'Seller cannot accept their own counteroffer.';
    END IF;

    -- Check overselling (Overselling logic check)
    IF v_pred.accepted_quantity + v_bid.desired_quantity > v_pred.expected_quantity_volume THEN
        RAISE EXCEPTION 'Overselling prevented: Cannot accept more than expected quantity.';
    END IF;

    UPDATE public.harvest_bids
    SET bid_status = 'ACCEPTED', accepted_quantity = desired_quantity, updated_at = NOW()
    WHERE id = p_bid_id;

    UPDATE public.harvest_predictions
    SET accepted_quantity = accepted_quantity + v_bid.desired_quantity
    WHERE id = v_pred.id;

    RETURN json_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_accept_harvest_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_accept_harvest_bid(UUID) TO authenticated;

-- 1.b Counter Harvest Bid
CREATE OR REPLACE FUNCTION public.rpc_counter_harvest_bid(
    p_bid_id UUID,
    p_quantity NUMERIC,
    p_price NUMERIC,
    p_message TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_bid public.harvest_bids%ROWTYPE;
    v_farm public.farms%ROWTYPE;
    v_is_seller BOOLEAN;
    v_is_buyer BOOLEAN;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;

    SELECT * INTO v_farm FROM public.farms WHERE id = (SELECT farm_id FROM public.farm_crop_allocations WHERE id = (SELECT crop_allocation_id FROM public.harvest_predictions WHERE id = v_bid.prediction_id));

    v_is_seller := (v_farm.user_id = v_user_id);
    v_is_buyer := (v_bid.buyer_id = v_user_id);

    IF NOT v_is_seller AND NOT v_is_buyer THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Prevent reviving closed bids
    IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED') THEN
        RAISE EXCEPTION 'Cannot counter a closed bid';
    END IF;

    -- Prevent consecutive counters
    IF v_is_buyer AND v_bid.bid_status = 'BUYER_COUNTERED' THEN
        RAISE EXCEPTION 'Consecutive counters are not allowed (Buyer must wait for Seller).';
    END IF;

    IF v_is_seller AND v_bid.bid_status = 'SELLER_COUNTERED' THEN
        RAISE EXCEPTION 'Consecutive counters are not allowed (Seller must wait for Buyer).';
    END IF;

    -- Update state
    UPDATE public.harvest_bids
    SET bid_status = CASE WHEN v_is_seller THEN 'SELLER_COUNTERED' ELSE 'BUYER_COUNTERED' END,
        desired_quantity = p_quantity,
        offered_price_per_unit = p_price,
        total_offer_value = p_quantity * p_price,
        updated_at = NOW()
    WHERE id = p_bid_id;

    INSERT INTO public.bid_negotiation_events (bid_id, actor_id, event_type, details, created_at)
    VALUES (p_bid_id, v_user_id, CASE WHEN v_is_seller THEN 'SELLER_COUNTERED' ELSE 'BUYER_COUNTERED' END, jsonb_build_object('quantity', p_quantity, 'price', p_price, 'message', p_message), NOW());

    RETURN json_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_counter_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_counter_harvest_bid(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- 1.c Withdraw Harvest Bid
CREATE OR REPLACE FUNCTION public.rpc_withdraw_harvest_bid(
    p_bid_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_bid public.harvest_bids%ROWTYPE;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;

    IF v_bid.buyer_id != v_user_id THEN
        RAISE EXCEPTION 'Only the buyer can withdraw this bid.';
    END IF;

    IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED') THEN
        RAISE EXCEPTION 'Bid cannot be withdrawn in its current state.';
    END IF;

    UPDATE public.harvest_bids
    SET bid_status = 'WITHDRAWN', updated_at = NOW()
    WHERE id = p_bid_id;

    RETURN json_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_withdraw_harvest_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_withdraw_harvest_bid(UUID) TO authenticated;

-- 1.d Reject Harvest Bid
CREATE OR REPLACE FUNCTION public.rpc_reject_harvest_bid(
    p_bid_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_bid public.harvest_bids%ROWTYPE;
    v_farm public.farms%ROWTYPE;
    v_is_seller BOOLEAN;
    v_is_buyer BOOLEAN;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_bid FROM public.harvest_bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;

    SELECT * INTO v_farm FROM public.farms WHERE id = (SELECT farm_id FROM public.farm_crop_allocations WHERE id = (SELECT crop_allocation_id FROM public.harvest_predictions WHERE id = v_bid.prediction_id));

    v_is_seller := (v_farm.user_id = v_user_id);
    v_is_buyer := (v_bid.buyer_id = v_user_id);

    IF NOT v_is_seller AND NOT v_is_buyer THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED') THEN
        RAISE EXCEPTION 'Bid cannot be rejected in its current state.';
    END IF;
    
    -- Prevent participant from rejecting their own offer
    IF v_is_buyer AND v_bid.bid_status IN ('PENDING', 'BUYER_COUNTERED') THEN
        RAISE EXCEPTION 'Buyer cannot reject their own offer/counteroffer.';
    END IF;

    IF v_is_seller AND v_bid.bid_status = 'SELLER_COUNTERED' THEN
        RAISE EXCEPTION 'Seller cannot reject their own counteroffer.';
    END IF;

    UPDATE public.harvest_bids
    SET bid_status = 'REJECTED', updated_at = NOW()
    WHERE id = p_bid_id;

    RETURN json_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_reject_harvest_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reject_harvest_bid(UUID) TO authenticated;


-- ===========================================================================
-- 2. PERMANENT CROP DELETION (RPC MIGRATION)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_delete_crop_allocation(
    p_crop_allocation_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_farm_id UUID;
    v_commercial_bids INT;
    v_active_trade_count INT;
    v_prediction_count INT := 0;
    v_bid_count INT := 0;
    v_event_count INT := 0;
    v_log_count INT := 0;
    v_device_count INT := 0;
    v_rows INT;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not authenticated.'; END IF;

    SELECT f.id INTO v_farm_id
    FROM public.farm_crop_allocations fca
    JOIN public.farms f ON f.id = fca.farm_id
    WHERE fca.id = p_crop_allocation_id AND f.user_id = v_user_id;

    IF v_farm_id IS NULL THEN RAISE EXCEPTION 'Crop allocation not found or unauthorized.'; END IF;

    SELECT COUNT(*) INTO v_commercial_bids
    FROM public.harvest_bids hb
    JOIN public.harvest_predictions hp ON hp.id = hb.prediction_id
    WHERE hp.crop_allocation_id = p_crop_allocation_id
    AND hb.bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE');

    IF v_commercial_bids > 0 THEN RAISE EXCEPTION 'Cannot delete crop: Commercial bid history exists.'; END IF;

    SELECT COUNT(*) INTO v_active_trade_count
    FROM public.trade_requests tr
    JOIN public.harvest_predictions hp ON hp.id = tr.harvest_prediction_id
    WHERE hp.crop_allocation_id = p_crop_allocation_id;

    IF v_active_trade_count > 0 THEN RAISE EXCEPTION 'Cannot delete crop: Trade request dependencies exist.'; END IF;
    
    UPDATE public.iot_devices SET crop_allocation_id = NULL WHERE crop_allocation_id = p_crop_allocation_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_device_count := v_device_count + v_rows;

    WITH deleted_events AS (
        DELETE FROM public.bid_negotiation_events
        WHERE bid_id IN (SELECT hb.id FROM public.harvest_bids hb JOIN public.harvest_predictions hp ON hp.id = hb.prediction_id WHERE hp.crop_allocation_id = p_crop_allocation_id)
        RETURNING id
    ) SELECT count(*) INTO v_event_count FROM deleted_events;

    WITH deleted_bids AS (
        DELETE FROM public.harvest_bids WHERE prediction_id IN (SELECT id FROM public.harvest_predictions WHERE crop_allocation_id = p_crop_allocation_id)
        RETURNING id
    ) SELECT count(*) INTO v_bid_count FROM deleted_bids;

    WITH deleted_predictions AS (
        DELETE FROM public.harvest_predictions WHERE crop_allocation_id = p_crop_allocation_id
        RETURNING id
    ) SELECT count(*) INTO v_prediction_count FROM deleted_predictions;

    WITH deleted_logs AS (
        DELETE FROM public.farm_activity_logs WHERE crop_allocation_id = p_crop_allocation_id
        RETURNING id
    ) SELECT count(*) INTO v_log_count FROM deleted_logs;

    DELETE FROM public.farm_crop_allocations WHERE id = p_crop_allocation_id;

    RETURN json_build_object('success', true, 'metrics', json_build_object('devices_detached', v_device_count, 'events_deleted', v_event_count, 'bids_deleted', v_bid_count, 'predictions_deleted', v_prediction_count, 'logs_deleted', v_log_count));
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_delete_crop_allocation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_delete_crop_allocation(UUID) TO authenticated;


-- ===========================================================================
-- 3. TEST DATA RESET (AUTOMATIC DISPOSABLE CLEANUP)
-- ===========================================================================

DO $$
DECLARE
    v_has_payment_table BOOLEAN;
    v_has_logistics_table BOOLEAN;
    v_protected_trades INT;
    v_device_count INT := 0;
    v_event_count INT := 0;
    v_bid_count INT := 0;
    v_prediction_count INT := 0;
    v_log_count INT := 0;
    v_trade_count INT := 0;
    v_crop_count INT := 0;
    v_rows INT;
BEGIN
    -- Preflight: Check schema existence for protected relationships
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') INTO v_has_payment_table;
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logistics_bookings') INTO v_has_logistics_table;

    -- Preflight: Prevent reset if ANY trade request is linked to a payment or logistics booking
    IF v_has_payment_table THEN
        EXECUTE 'SELECT count(*) FROM public.payments WHERE trade_request_id IS NOT NULL' INTO v_protected_trades;
        IF v_protected_trades > 0 THEN RAISE EXCEPTION 'Reset Aborted: Protected payment dependencies found on trade requests.'; END IF;
    END IF;

    IF v_has_logistics_table THEN
        EXECUTE 'SELECT count(*) FROM public.logistics_bookings WHERE trade_request_id IS NOT NULL' INTO v_protected_trades;
        IF v_protected_trades > 0 THEN RAISE EXCEPTION 'Reset Aborted: Protected logistics dependencies found on trade requests.'; END IF;
    END IF;

    -- Detach devices safely
    UPDATE public.iot_devices SET crop_allocation_id = NULL WHERE crop_allocation_id IS NOT NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_device_count := v_device_count + v_rows;

    -- Clean disposable cascade
    DELETE FROM public.bid_negotiation_events;
    GET DIAGNOSTICS v_rows = ROW_COUNT; v_event_count := v_event_count + v_rows;

    DELETE FROM public.harvest_bids;
    GET DIAGNOSTICS v_rows = ROW_COUNT; v_bid_count := v_bid_count + v_rows;

    DELETE FROM public.trade_requests;
    GET DIAGNOSTICS v_rows = ROW_COUNT; v_trade_count := v_trade_count + v_rows;

    DELETE FROM public.harvest_predictions;
    GET DIAGNOSTICS v_rows = ROW_COUNT; v_prediction_count := v_prediction_count + v_rows;

    DELETE FROM public.farm_activity_logs;
    GET DIAGNOSTICS v_rows = ROW_COUNT; v_log_count := v_log_count + v_rows;

    DELETE FROM public.farm_crop_allocations;
    GET DIAGNOSTICS v_rows = ROW_COUNT; v_crop_count := v_crop_count + v_rows;

    RAISE NOTICE 'Test Data Reset Complete.';
    RAISE NOTICE '- Devices detached: %', v_device_count;
    RAISE NOTICE '- Events deleted: %', v_event_count;
    RAISE NOTICE '- Bids deleted: %', v_bid_count;
    RAISE NOTICE '- Trades deleted: %', v_trade_count;
    RAISE NOTICE '- Predictions deleted: %', v_prediction_count;
    RAISE NOTICE '- Logs deleted: %', v_log_count;
    RAISE NOTICE '- Crop allocations deleted: %', v_crop_count;
    RAISE NOTICE 'Preserved: Users, Farms, Devices, Policies, Configurations.';
END $$;

COMMIT;
