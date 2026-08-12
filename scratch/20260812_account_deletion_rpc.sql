BEGIN;

-- ===========================================================================
-- rpc_delete_user_account()
-- No parameters. Target user resolved entirely from auth.uid() inside PostgreSQL.
-- Invoked under authenticated user JWT context (anon key client, not service role).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.rpc_delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id               UUID;
    v_protected_bids        INT := 0;
    v_protected_seller      INT := 0;
    v_protected_trades      INT := 0;
    v_total_protected       INT := 0;
    v_has_table             BOOLEAN := FALSE;
    v_rows                  INT := 0;

    -- Deletion Metrics
    v_del_events            INT := 0;
    v_del_logistics         INT := 0;
    v_del_payments          INT := 0;
    v_del_trades            INT := 0;
    v_del_bids              INT := 0;
    v_del_preds             INT := 0;
    v_del_logs              INT := 0;
    v_del_devices           INT := 0;
    v_del_crops             INT := 0;
    v_del_farms             INT := 0;

    -- Retention Metrics
    v_ret_farms             INT := 0;
    v_ret_crops             INT := 0;
    v_ret_preds             INT := 0;
    v_ret_bids              INT := 0;
    v_ret_trades            INT := 0;

    -- Anonymization Metrics
    v_anon_users            INT := 0;
    v_anon_farms            INT := 0;
    v_anon_crops            INT := 0;
    v_anon_trades           INT := 0;
    v_anon_logistics        INT := 0;
    v_profile_status        TEXT := 'deleted';

    -- Scoped trade ID sets
    v_disposable_trade_ids  UUID[];
    v_retained_trade_ids    UUID[];
BEGIN
    -- =========================================================================
    -- 1. Resolve user from auth.uid() — never from a client-supplied argument
    -- =========================================================================
    SELECT id INTO v_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- =========================================================================
    -- 2. Detect protected commercial history (Buyer AND Seller sides)
    -- =========================================================================
    SELECT count(*) INTO v_protected_bids
    FROM public.harvest_bids
    WHERE buyer_id = v_user_id
      AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE');

    SELECT count(*) INTO v_protected_seller
    FROM public.harvest_bids hb
    JOIN public.harvest_predictions hp ON hp.id = hb.prediction_id
    WHERE hp.farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
      AND hb.bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE');

    SELECT count(*) INTO v_protected_trades
    FROM public.trade_requests
    WHERE (user_id = v_user_id OR buyer_id = v_user_id OR interested_buyer_id = v_user_id)
      AND request_status IN ('CONVERTED_TO_TRADE', 'COMPLETED', 'EVIDENCE_PENDING', 'ACCEPTED');

    v_total_protected := v_protected_bids + v_protected_seller + v_protected_trades;

    -- =========================================================================
    -- 3. Delete telemetry (always disposable) — schema-safe dynamic SQL
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'iot_sensor_observations' AND column_name = 'device_id') THEN
        EXECUTE 'DELETE FROM public.iot_sensor_observations WHERE device_id IN (SELECT id FROM public.iot_devices WHERE user_id = $1 OR farm_id IN (SELECT id FROM public.farms WHERE user_id = $1))'
        USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'iot_sensor_streams' AND column_name = 'device_id') THEN
        EXECUTE 'DELETE FROM public.iot_sensor_streams WHERE device_id IN (SELECT id FROM public.iot_devices WHERE user_id = $1 OR farm_id IN (SELECT id FROM public.farms WHERE user_id = $1))'
        USING v_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'iot_telemetry_logs' AND column_name = 'owner_id') THEN
        EXECUTE 'DELETE FROM public.iot_telemetry_logs WHERE owner_id = $1' USING v_user_id;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'iot_telemetry_logs' AND column_name = 'device_id') THEN
        EXECUTE 'DELETE FROM public.iot_telemetry_logs WHERE device_id IN (SELECT id FROM public.iot_devices WHERE user_id = $1 OR farm_id IN (SELECT id FROM public.farms WHERE user_id = $1))'
        USING v_user_id;
    END IF;

    -- =========================================================================
    -- 4. Delete IoT devices (always disposable)
    -- =========================================================================
    DELETE FROM public.iot_devices
    WHERE user_id = v_user_id
       OR farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_del_devices := v_rows;

    -- =========================================================================
    -- 5. Delete farm activity logs (always disposable)
    -- =========================================================================
    WITH d AS (
        DELETE FROM public.farm_activity_logs
        WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
        RETURNING id
    ) SELECT count(*) INTO v_del_logs FROM d;

    -- =========================================================================
    -- 6. Classify owned trade_requests into disposable vs retained sets
    -- =========================================================================
    SELECT array_agg(id) INTO v_disposable_trade_ids
    FROM public.trade_requests
    WHERE (user_id = v_user_id OR buyer_id = v_user_id OR interested_buyer_id = v_user_id)
      AND request_status NOT IN ('CONVERTED_TO_TRADE', 'COMPLETED', 'EVIDENCE_PENDING', 'ACCEPTED');

    SELECT array_agg(id) INTO v_retained_trade_ids
    FROM public.trade_requests
    WHERE (user_id = v_user_id OR buyer_id = v_user_id OR interested_buyer_id = v_user_id)
      AND request_status IN ('CONVERTED_TO_TRADE', 'COMPLETED', 'EVIDENCE_PENDING', 'ACCEPTED');

    -- =========================================================================
    -- 7. Delete DISPOSABLE logistics rows before disposable trade_requests
    --    Schema-safe: verify table exists before referencing
    -- =========================================================================
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logistics_bookings')
    INTO v_has_table;

    IF v_has_table AND v_disposable_trade_ids IS NOT NULL THEN
        WITH d AS (
            DELETE FROM public.logistics_bookings
            WHERE trade_request_id = ANY(v_disposable_trade_ids)
            RETURNING id
        ) SELECT count(*) INTO v_del_logistics FROM d;
    END IF;

    -- =========================================================================
    -- 8. Delete DISPOSABLE payment rows before disposable trade_requests
    --    Schema-safe: verify table AND verified FK column before referencing
    -- =========================================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'trade_request_id') THEN
            IF v_disposable_trade_ids IS NOT NULL THEN
                EXECUTE 'DELETE FROM public.payments WHERE trade_request_id = ANY($1)'
                USING v_disposable_trade_ids;
                GET DIAGNOSTICS v_rows = ROW_COUNT;
                v_del_payments := v_rows;
            END IF;
        END IF;
    END IF;

    -- =========================================================================
    -- 9. Delete disposable trade_requests (all dependents cleared above)
    -- =========================================================================
    IF v_disposable_trade_ids IS NOT NULL THEN
        WITH d AS (
            DELETE FROM public.trade_requests
            WHERE id = ANY(v_disposable_trade_ids)
            RETURNING id
        ) SELECT count(*) INTO v_del_trades FROM d;
    END IF;

    -- =========================================================================
    -- 10. PROTECTED HISTORY BRANCH: anonymize, preserve retained parents
    -- =========================================================================
    IF v_total_protected > 0 THEN
        v_profile_status := 'anonymized';

        -- Negotiation events: delete only for disposable bids, keep for protected bids
        WITH d AS (
            DELETE FROM public.bid_negotiation_events
            WHERE bid_id IN (
                SELECT id FROM public.harvest_bids
                WHERE (
                    buyer_id = v_user_id
                    OR prediction_id IN (
                        SELECT id FROM public.harvest_predictions
                        WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
                    )
                )
                AND bid_status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE')
            )
            RETURNING id
        ) SELECT count(*) INTO v_del_events FROM d;

        -- Delete disposable bids only
        WITH d AS (
            DELETE FROM public.harvest_bids
            WHERE (
                buyer_id = v_user_id
                OR prediction_id IN (
                    SELECT id FROM public.harvest_predictions
                    WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
                )
            )
            AND bid_status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE')
            RETURNING id
        ) SELECT count(*) INTO v_del_bids FROM d;

        -- Count retained records kept as parents of protected history
        SELECT count(*) INTO v_ret_bids
        FROM public.harvest_bids
        WHERE (
            buyer_id = v_user_id
            OR prediction_id IN (
                SELECT id FROM public.harvest_predictions
                WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
            )
        )
        AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE');

        SELECT count(*) INTO v_ret_trades
        FROM public.trade_requests
        WHERE user_id = v_user_id OR buyer_id = v_user_id OR interested_buyer_id = v_user_id;

        SELECT count(*) INTO v_ret_preds
        FROM public.harvest_predictions
        WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id);

        SELECT count(*) INTO v_ret_crops
        FROM public.farm_crop_allocations
        WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id);

        SELECT count(*) INTO v_ret_farms FROM public.farms WHERE user_id = v_user_id;

        -- Anonymize user profile (verified columns: full_name, phone_number,
        -- verification_status, business_latitude, business_longitude)
        UPDATE public.users SET
            full_name           = 'Anonymized User',
            phone_number        = '0000000000',
            verification_status = 'deleted',
            business_latitude   = NULL,
            business_longitude  = NULL
        WHERE id = v_user_id;
        v_anon_users := 1;

        -- Anonymize retained farms (verified columns: name, physical_address, latitude, longitude)
        UPDATE public.farms SET
            name             = 'Anonymized Farm',
            physical_address = NULL,
            latitude         = NULL,
            longitude        = NULL
        WHERE user_id = v_user_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_anon_farms := v_rows;

        -- Anonymize retained crop allocations (verified column: notes)
        UPDATE public.farm_crop_allocations SET
            notes = NULL
        WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id);
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_anon_crops := v_rows;

        -- Anonymize retained trade_requests personal/location fields
        -- (verified columns: physical_address, computed_latitude, computed_longitude,
        --  delivery_address, delivery_latitude, delivery_longitude,
        --  harvest_photo_url, cancellation_note)
        IF v_retained_trade_ids IS NOT NULL THEN
            UPDATE public.trade_requests SET
                physical_address   = 'Anonymized Address',
                computed_latitude  = 0,
                computed_longitude = 0,
                delivery_address   = CASE WHEN delivery_address  IS NOT NULL THEN 'Anonymized Address' ELSE NULL END,
                delivery_latitude  = CASE WHEN delivery_latitude  IS NOT NULL THEN 0 ELSE NULL END,
                delivery_longitude = CASE WHEN delivery_longitude IS NOT NULL THEN 0 ELSE NULL END,
                harvest_photo_url  = NULL,
                cancellation_note  = NULL
            WHERE id = ANY(v_retained_trade_ids);
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_anon_trades := v_rows;
        END IF;

        -- Anonymize retained logistics personal fields (verified columns: carrier_name, carrier_phone)
        -- Schema-safe: table verified; carrier_id is a retained-side personal identifier
        SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logistics_bookings')
        INTO v_has_table;

        IF v_has_table THEN
            IF v_retained_trade_ids IS NOT NULL THEN
                UPDATE public.logistics_bookings SET
                    carrier_name  = 'Anonymized Carrier',
                    carrier_phone = '0000000000'
                WHERE trade_request_id = ANY(v_retained_trade_ids)
                   OR carrier_id = v_user_id;
            ELSE
                UPDATE public.logistics_bookings SET
                    carrier_name  = 'Anonymized Carrier',
                    carrier_phone = '0000000000'
                WHERE carrier_id = v_user_id;
            END IF;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_anon_logistics := v_rows;
        END IF;

        -- Anonymize retained payment personal fields (schema-safe: check table and each column)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payer_name')
               AND v_retained_trade_ids IS NOT NULL THEN
                EXECUTE 'UPDATE public.payments SET payer_name = ''Anonymized'' WHERE trade_request_id = ANY($1)'
                USING v_retained_trade_ids;
            END IF;
        END IF;

    ELSE
        -- =====================================================================
        -- 11. NO PROTECTED HISTORY: delete all remaining owned workflow data
        -- =====================================================================

        -- All negotiation events (including actor_id events)
        WITH d AS (
            DELETE FROM public.bid_negotiation_events
            WHERE actor_id = v_user_id
               OR bid_id IN (
                   SELECT id FROM public.harvest_bids
                   WHERE buyer_id = v_user_id
                      OR prediction_id IN (
                          SELECT id FROM public.harvest_predictions
                          WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
                      )
               )
            RETURNING id
        ) SELECT count(*) INTO v_del_events FROM d;

        -- All harvest bids
        WITH d AS (
            DELETE FROM public.harvest_bids
            WHERE buyer_id = v_user_id
               OR prediction_id IN (
                   SELECT id FROM public.harvest_predictions
                   WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
               )
            RETURNING id
        ) SELECT count(*) INTO v_del_bids FROM d;

        -- All harvest predictions
        WITH d AS (
            DELETE FROM public.harvest_predictions
            WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
            RETURNING id
        ) SELECT count(*) INTO v_del_preds FROM d;

        -- All crop allocations
        WITH d AS (
            DELETE FROM public.farm_crop_allocations
            WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = v_user_id)
            RETURNING id
        ) SELECT count(*) INTO v_del_crops FROM d;

        -- All farms
        WITH d AS (
            DELETE FROM public.farms
            WHERE user_id = v_user_id
            RETURNING id
        ) SELECT count(*) INTO v_del_farms FROM d;

        -- Delete public.users profile row entirely
        DELETE FROM public.users WHERE id = v_user_id;
    END IF;

    -- =========================================================================
    -- 12. Return structured result
    -- =========================================================================
    RETURN jsonb_build_object(
        'success',          true,
        'profile_status',   v_profile_status,
        'records_deleted', jsonb_build_object(
            'events',       v_del_events,
            'logistics',    v_del_logistics,
            'payments',     v_del_payments,
            'trades',       v_del_trades,
            'bids',         v_del_bids,
            'predictions',  v_del_preds,
            'logs',         v_del_logs,
            'devices',      v_del_devices,
            'crops',        v_del_crops,
            'farms',        v_del_farms
        ),
        'records_retained', jsonb_build_object(
            'farms',        v_ret_farms,
            'crops',        v_ret_crops,
            'predictions',  v_ret_preds,
            'bids',         v_ret_bids,
            'trades',       v_ret_trades
        ),
        'records_anonymized', jsonb_build_object(
            'users',        v_anon_users,
            'farms',        v_anon_farms,
            'crops',        v_anon_crops,
            'trades',       v_anon_trades,
            'logistics',    v_anon_logistics
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_delete_user_account() TO authenticated;

COMMIT;
