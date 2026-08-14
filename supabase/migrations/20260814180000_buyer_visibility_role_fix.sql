-- 20260814180000_buyer_visibility_role_fix.sql

-- 1. Fix role check in rpc_get_buyer_harvest_opportunities
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
            'id', bol.id,
            'expected_quantity_volume', bol.listed_quantity,
            'expected_quantity_unit', bol.quantity_unit,
            'expected_quantity_min', bol.listed_quantity,
            'expected_quantity_max', bol.listed_quantity,
            'asking_price_per_unit', bol.asking_price_per_unit,
            'minimum_price_per_unit', bol.asking_price_per_unit,
            'bidding_status', bol.listing_status,
            'bidding_origin', 'MANUAL',
            'created_at', bol.created_at,
            'crop_type', bol.crop_type,
            'seller_maturity_at', bol.expected_harvest_at,
            'seller_note', bol.seller_note
        ) ORDER BY bol.created_at DESC
    )
    INTO v_result
    FROM public.bulk_offtake_listings bol
    WHERE bol.listing_status = 'OPEN';
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

-- 2. Fix role check in rpc_get_buyer_my_bids
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
    
    IF v_buyer_id IS NULL
       OR v_profession IS NULL
       OR v_profession NOT IN ('Enterprise Buyer', 'Commercial Buyer')
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Access denied: Must be an Enterprise Buyer or Commercial Buyer';
    END IF;

    -- Return only bids placed by the authenticated buyer
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
            'harvest_predictions', json_build_object(
                'id', bol.id,
                'bidding_origin', 'MANUAL',
                'expected_quantity_unit', bol.quantity_unit,
                'crop_type', bol.crop_type,
                'farm_name', CASE WHEN hb.bid_status = 'CONVERTED_TO_TRADE' THEN f.name ELSE NULL END,
                'farm_physical_address', CASE WHEN hb.bid_status = 'CONVERTED_TO_TRADE' THEN f.physical_address ELSE NULL END
            )
        ) ORDER BY hb.created_at DESC
    )
    INTO v_result
    FROM public.harvest_bids hb
    JOIN public.bulk_offtake_listings bol ON hb.bulk_offtake_listing_id = bol.id
    LEFT JOIN public.farms f ON bol.farm_id = f.id
    WHERE hb.buyer_id = v_buyer_id;

    RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_get_buyer_harvest_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_buyer_harvest_opportunities() TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_get_buyer_my_bids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_buyer_my_bids() TO authenticated;

NOTIFY pgrst, 'reload schema';
