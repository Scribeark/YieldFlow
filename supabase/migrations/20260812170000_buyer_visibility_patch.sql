-- 20260812170000_buyer_visibility_patch.sql
-- 1. Create Buyer Marketplace RPC (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.rpc_get_buyer_harvest_opportunities()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_buyer_id uuid;
    v_profession text;
    v_result json;
BEGIN
    SELECT id, declared_profession INTO v_buyer_id, v_profession FROM public.users WHERE auth_uid = auth.uid();
    IF v_buyer_id IS NULL OR v_profession IS DISTINCT FROM 'Enterprise Buyer' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied: Must be an Enterprise Buyer';
    END IF;

    SELECT json_agg(
        json_build_object(
            'id', hp.id,
            'readiness_score', hp.readiness_score,
            'predicted_harvest_start', hp.predicted_harvest_start,
            'predicted_harvest_end', hp.predicted_harvest_end,
            'expected_quantity_volume', hp.expected_quantity_volume,
            'expected_quantity_unit', hp.expected_quantity_unit,
            'expected_quantity_min', hp.expected_quantity_min,
            'expected_quantity_max', hp.expected_quantity_max,
            'minimum_price_per_unit', hp.minimum_price_per_unit,
            'bidding_status', hp.bidding_status,
            'bidding_origin', hp.bidding_origin,
            'created_at', hp.created_at,
            'crop_type', CASE hp.bidding_origin 
                            WHEN 'IOT' THEN fca.crop_type 
                            WHEN 'MANUAL' THEN f.crop_type 
                            ELSE NULL 
                         END
            -- farm_id, farm_name, and physical_address are intentionally excluded for privacy
        ) ORDER BY hp.created_at DESC
    )
    INTO v_result
    FROM public.harvest_predictions hp
    JOIN public.farms f ON hp.farm_id = f.id
    LEFT JOIN public.farm_crop_allocations fca ON hp.crop_allocation_id = fca.id
    WHERE hp.bidding_status = 'OPEN';
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

-- 2. Create Buyer My Bids RPC (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.rpc_get_buyer_my_bids()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_buyer_id uuid;
    v_profession text;
    v_result json;
BEGIN
    SELECT id, declared_profession INTO v_buyer_id, v_profession FROM public.users WHERE auth_uid = auth.uid();
    IF v_buyer_id IS NULL OR v_profession IS DISTINCT FROM 'Enterprise Buyer' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied: Must be an Enterprise Buyer';
    END IF;

    -- Return only bids placed by the authenticated buyer
    SELECT json_agg(
        json_build_object(
            'id', hb.id,
            'prediction_id', hb.prediction_id,
            'desired_quantity', hb.desired_quantity,
            'accepted_quantity', hb.accepted_quantity,
            'offered_price_per_unit', hb.offered_price_per_unit,
            'total_offer_value', hb.total_offer_value,
            'bid_status', hb.bid_status,
            'created_at', hb.created_at,
            'harvest_predictions', json_build_object(
                'id', hp.id,
                'bidding_origin', hp.bidding_origin,
                'expected_quantity_unit', hp.expected_quantity_unit,
                'crop_type', CASE hp.bidding_origin 
                                WHEN 'IOT' THEN fca.crop_type 
                                WHEN 'MANUAL' THEN f.crop_type 
                                ELSE NULL 
                             END,
                'farm_name', CASE WHEN hb.bid_status = 'CONVERTED_TO_TRADE' THEN f.name ELSE NULL END,
                'farm_physical_address', CASE WHEN hb.bid_status = 'CONVERTED_TO_TRADE' THEN f.physical_address ELSE NULL END
            )
        ) ORDER BY hb.created_at DESC
    )
    INTO v_result
    FROM public.harvest_bids hb
    JOIN public.harvest_predictions hp ON hb.prediction_id = hp.id
    JOIN public.farms f ON hp.farm_id = f.id
    LEFT JOIN public.farm_crop_allocations fca ON hp.crop_allocation_id = fca.id
    WHERE hb.buyer_id = v_buyer_id;

    RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

-- 3. Security and Permission Rules
REVOKE ALL ON FUNCTION public.rpc_get_buyer_harvest_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_buyer_harvest_opportunities() TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_get_buyer_my_bids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_buyer_my_bids() TO authenticated;

-- 4. Verification Queries
SELECT 'BUYER_OPPORTUNITIES_RPC_EXISTS' AS check_name, EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rpc_get_buyer_harvest_opportunities');
SELECT 'BUYER_BIDS_RPC_EXISTS' AS check_name, EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rpc_get_buyer_my_bids');
