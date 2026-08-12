BEGIN;

-- ===========================================================================
-- rpc_delete_user_account(UUID)
-- Server-side RPC for account deletion with complete retention safety,
-- statutory record anonymization, and disposable cascade cleanup.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.rpc_delete_user_account(
    p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id       UUID;
    v_protected_bids        INT := 0;
    v_protected_seller      INT := 0;
    v_protected_trades      INT := 0;
    v_total_protected       INT := 0;
    v_has_table             BOOLEAN := FALSE;
    v_has_col               BOOLEAN := FALSE;
    v_rows                  INT := 0;
    v_del_events            INT := 0;
    v_del_trades            INT := 0;
    v_del_bids              INT := 0;
    v_del_preds             INT := 0;
    v_del_logs              INT := 0;
    v_del_devices           INT := 0;
    v_del_crops             INT := 0;
    v_del_farms             INT := 0;
    v_anon_trades           INT := 0;
    v_anon_logistics        INT := 0;
BEGIN
    -- 1. Authoritative resolution of caller
    SELECT id INTO v_calling_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_calling_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- 2. Authorization check: caller must match target p_user_id
    IF v_calling_user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account';
    END IF;

    -- 3. Detect protected history for both sides (Buyer & Seller)
    -- Bids placed as buyer that were accepted or converted
    SELECT count(*) INTO v_protected_bids
    FROM public.harvest_bids
    WHERE buyer_id = p_user_id AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE');

    -- Harvests/predictions owned as seller with accepted or converted bids
    SELECT count(*) INTO v_protected_seller
    FROM public.harvest_bids hb
    JOIN public.harvest_predictions hp ON hp.id = hb.prediction_id
    WHERE hp.farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id)
      AND hb.bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE');

    -- Converted or active trade requests
    SELECT count(*) INTO v_protected_trades
    FROM public.trade_requests
    WHERE (user_id = p_user_id OR buyer_id = p_user_id OR interested_buyer_id = p_user_id)
      AND request_status IN ('CONVERTED_TO_TRADE', 'COMPLETED', 'EVIDENCE_PENDING', 'ACCEPTED');

    v_total_protected := v_protected_bids + v_protected_seller + v_protected_trades;

    -- 4. Delete telemetry using schema-safe dynamic SQL (checks table AND column existence)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'iot_sensor_observations' AND column_name = 'device_id'
    ) THEN
        EXECUTE 'DELETE FROM public.iot_sensor_observations WHERE device_id IN (SELECT id FROM public.iot_devices WHERE user_id = $1 OR farm_id IN (SELECT id FROM public.farms WHERE user_id = $1))' USING p_user_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'iot_sensor_streams' AND column_name = 'device_id'
    ) THEN
        EXECUTE 'DELETE FROM public.iot_sensor_streams WHERE device_id IN (SELECT id FROM public.iot_devices WHERE user_id = $1 OR farm_id IN (SELECT id FROM public.farms WHERE user_id = $1))' USING p_user_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'iot_telemetry_logs' AND column_name = 'owner_id'
    ) THEN
        EXECUTE 'DELETE FROM public.iot_telemetry_logs WHERE owner_id = $1' USING p_user_id;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'iot_telemetry_logs' AND column_name = 'device_id'
    ) THEN
        EXECUTE 'DELETE FROM public.iot_telemetry_logs WHERE device_id IN (SELECT id FROM public.iot_devices WHERE user_id = $1 OR farm_id IN (SELECT id FROM public.farms WHERE user_id = $1))' USING p_user_id;
    END IF;

    -- 5. Delete owned IoT devices
    DELETE FROM public.iot_devices WHERE user_id = p_user_id OR farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id);
    GET DIAGNOSTICS v_rows = ROW_COUNT; v_del_devices := v_rows;

    -- 6. Delete bid negotiation events (actor or related to user's bids/predictions)
    WITH d AS (
        DELETE FROM public.bid_negotiation_events
        WHERE actor_id = p_user_id
           OR bid_id IN (
               SELECT id FROM public.harvest_bids
               WHERE buyer_id = p_user_id
                  OR prediction_id IN (SELECT id FROM public.harvest_predictions WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id))
           )
        RETURNING id
    ) SELECT count(*) INTO v_del_events FROM d;

    -- 7. Delete disposable logistics bookings & payments before trade_requests
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logistics_bookings') INTO v_has_table;
    IF v_has_table THEN
        DELETE FROM public.logistics_bookings
        WHERE trade_request_id IN (
            SELECT id FROM public.trade_requests
            WHERE (user_id = p_user_id OR buyer_id = p_user_id)
              AND request_status NOT IN ('CONVERTED_TO_TRADE', 'COMPLETED')
        );
    END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') INTO v_has_table;
    IF v_has_table THEN
        DELETE FROM public.payments
        WHERE trade_request_id IN (
            SELECT id FROM public.trade_requests
            WHERE (user_id = p_user_id OR buyer_id = p_user_id)
              AND request_status NOT IN ('CONVERTED_TO_TRADE', 'COMPLETED')
        );
    END IF;

    -- 8. Delete disposable trade requests
    WITH d AS (
        DELETE FROM public.trade_requests
        WHERE (user_id = p_user_id OR buyer_id = p_user_id OR interested_buyer_id = p_user_id)
          AND request_status NOT IN ('CONVERTED_TO_TRADE', 'COMPLETED')
        RETURNING id
    ) SELECT count(*) INTO v_del_trades FROM d;

    -- 9. Delete disposable harvest bids
    WITH d AS (
        DELETE FROM public.harvest_bids
        WHERE (buyer_id = p_user_id OR prediction_id IN (SELECT id FROM public.harvest_predictions WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id)))
          AND bid_status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE')
        RETURNING id
    ) SELECT count(*) INTO v_del_bids FROM d;

    -- 10. Delete harvest predictions
    WITH d AS (
        DELETE FROM public.harvest_predictions
        WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id)
          AND id NOT IN (SELECT harvest_prediction_id FROM public.trade_requests WHERE harvest_prediction_id IS NOT NULL)
        RETURNING id
    ) SELECT count(*) INTO v_del_preds FROM d;

    -- 11. Delete farm activity logs
    WITH d AS (
        DELETE FROM public.farm_activity_logs
        WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id)
        RETURNING id
    ) SELECT count(*) INTO v_del_logs FROM d;

    -- 12. Delete crop allocations
    WITH d AS (
        DELETE FROM public.farm_crop_allocations
        WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id)
        RETURNING id
    ) SELECT count(*) INTO v_del_crops FROM d;

    -- 13. Delete farms
    WITH d AS (
        DELETE FROM public.farms
        WHERE user_id = p_user_id
        RETURNING id
    ) SELECT count(*) INTO v_del_farms FROM d;

    -- 14. ANONYMIZATION OF RETAINED RECORDS
    IF v_total_protected > 0 THEN
        -- Anonymize public user profile
        UPDATE public.users SET
            full_name = 'Anonymized User',
            phone_number = '0000000000',
            verification_status = 'deleted',
            business_latitude = NULL,
            business_longitude = NULL
        WHERE id = p_user_id;

        -- Anonymize retained trade requests
        UPDATE public.trade_requests SET
            physical_address = 'Anonymized Address',
            computed_latitude = 0,
            computed_longitude = 0,
            delivery_address = CASE WHEN delivery_address IS NOT NULL THEN 'Anonymized Address' ELSE NULL END,
            delivery_latitude = CASE WHEN delivery_latitude IS NOT NULL THEN 0 ELSE NULL END,
            delivery_longitude = CASE WHEN delivery_longitude IS NOT NULL THEN 0 ELSE NULL END,
            harvest_photo_url = NULL,
            cancellation_note = NULL
        WHERE user_id = p_user_id OR buyer_id = p_user_id OR interested_buyer_id = p_user_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT; v_anon_trades := v_rows;

        -- Anonymize retained logistics bookings
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logistics_bookings') INTO v_has_table;
        IF v_has_table THEN
            UPDATE public.logistics_bookings SET
                carrier_name = 'Anonymized Carrier',
                carrier_phone = '0000000000'
            WHERE carrier_id = p_user_id;
            GET DIAGNOSTICS v_rows = ROW_COUNT; v_anon_logistics := v_rows;
        END IF;
    ELSE
        -- No statutory retention required: delete public profile row completely
        DELETE FROM public.users WHERE id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'retained_and_anonymized', (v_total_protected > 0),
        'metrics', jsonb_build_object(
            'devices_deleted',       v_del_devices,
            'events_deleted',        v_del_events,
            'trades_deleted',        v_del_trades,
            'bids_deleted',          v_del_bids,
            'predictions_deleted',   v_del_preds,
            'logs_deleted',          v_del_logs,
            'crops_deleted',         v_del_crops,
            'farms_deleted',         v_del_farms,
            'retained_trades_anonymized', v_anon_trades,
            'retained_logistics_anonymized', v_anon_logistics
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_delete_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_delete_user_account(UUID) TO authenticated;

COMMIT;
