BEGIN;

-- ===========================================================================
-- rpc_delete_user_account(UUID)
-- Server-side RPC for account deletion with retention safety
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
    v_calling_user_id UUID;
    v_has_protected   INT := 0;
    v_has_table       BOOLEAN := FALSE;
BEGIN
    -- 1. Authoritative resolution of caller
    SELECT id INTO v_calling_user_id FROM public.users WHERE auth_uid = auth.uid();
    IF v_calling_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- 2. Authorization check: caller must match target p_user_id
    IF v_calling_user_id != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only delete your own account';
    END IF;

    -- 3. Check for protected completed commercial history requiring statutory retention
    SELECT count(*) INTO v_has_protected
    FROM public.harvest_bids
    WHERE buyer_id = p_user_id AND bid_status IN ('CONVERTED_TO_TRADE');

    -- 4. Delete telemetry for user devices
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'iot_sensor_observations') INTO v_has_table;
    IF v_has_table THEN
        DELETE FROM public.iot_sensor_observations WHERE device_id IN (SELECT id FROM public.iot_devices WHERE user_id = p_user_id);
    END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'iot_sensor_streams') INTO v_has_table;
    IF v_has_table THEN
        DELETE FROM public.iot_sensor_streams WHERE device_id IN (SELECT id FROM public.iot_devices WHERE user_id = p_user_id);
    END IF;

    -- 5. Delete owned devices
    DELETE FROM public.iot_devices WHERE user_id = p_user_id;
    DELETE FROM public.iot_devices WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id);

    -- 6. Delete bid negotiation events
    DELETE FROM public.bid_negotiation_events WHERE actor_id = p_user_id;
    DELETE FROM public.bid_negotiation_events WHERE bid_id IN (
        SELECT id FROM public.harvest_bids WHERE buyer_id = p_user_id
        OR prediction_id IN (SELECT id FROM public.harvest_predictions WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id))
    );

    -- 7. Delete trade requests
    DELETE FROM public.trade_requests WHERE user_id = p_user_id;
    DELETE FROM public.trade_requests WHERE harvest_prediction_id IN (
        SELECT id FROM public.harvest_predictions WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id)
    );

    -- 8. Delete harvest bids
    DELETE FROM public.harvest_bids WHERE buyer_id = p_user_id;
    DELETE FROM public.harvest_bids WHERE prediction_id IN (
        SELECT id FROM public.harvest_predictions WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id)
    );

    -- 9. Delete harvest predictions
    DELETE FROM public.harvest_predictions WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id);

    -- 10. Delete farm activity logs
    DELETE FROM public.farm_activity_logs WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id);

    -- 11. Delete crop allocations
    DELETE FROM public.farm_crop_allocations WHERE farm_id IN (SELECT id FROM public.farms WHERE user_id = p_user_id);

    -- 12. Delete farms
    DELETE FROM public.farms WHERE user_id = p_user_id;

    -- 13. Public user profile handling (Anonymize if statutory retention applies, else delete)
    IF v_has_protected > 0 THEN
        UPDATE public.users SET
            full_name = 'Anonymized User',
            phone_number = '0000000000',
            verification_status = 'deleted',
            business_latitude = NULL,
            business_longitude = NULL,
            updated_at = NOW()
        WHERE id = p_user_id;
    ELSE
        DELETE FROM public.users WHERE id = p_user_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'anonymized', (v_has_protected > 0));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_delete_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_delete_user_account(UUID) TO authenticated;

COMMIT;
