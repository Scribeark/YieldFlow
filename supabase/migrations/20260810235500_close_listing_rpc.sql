BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_close_crop_allocation_bidding(
  p_crop_allocation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_seller_profile_id UUID;
  v_allocation_owner_id UUID;
  v_prediction_id UUID;
  v_bid_counts JSONB;
  v_trade_counts JSONB;
  v_blocking_bids INT;
  v_blocking_trades INT;
BEGIN
  -- 1. Identify caller via public.users
  SELECT id INTO v_seller_profile_id
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated profile not found');
  END IF;

  -- 2. Verify ownership of the crop allocation
  SELECT user_id INTO v_allocation_owner_id
  FROM public.farm_crop_allocations
  WHERE id = p_crop_allocation_id FOR UPDATE;

  IF NOT FOUND OR v_allocation_owner_id != v_seller_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Allocation not found or unauthorized');
  END IF;

  -- 3. Find the open prediction (Strictly by bidding_status = 'OPEN', lock for update)
  -- Use strict exception handling in case of multiple OPEN predictions (database inconsistency)
  BEGIN
    SELECT id INTO STRICT v_prediction_id
    FROM public.harvest_predictions
    WHERE crop_allocation_id = p_crop_allocation_id
      AND bidding_status = 'OPEN'
    FOR UPDATE;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'No open bidding prediction found for this allocation');
    WHEN TOO_MANY_ROWS THEN
      RETURN jsonb_build_object('success', false, 'error', 'Database consistency error: multiple OPEN predictions found');
  END;

  -- 4. Audit bids (group by bid_status)
  SELECT COALESCE(jsonb_object_agg(COALESCE(bid_status, 'UNKNOWN'), count), '{}'::jsonb)
  INTO v_bid_counts
  FROM (
    SELECT bid_status, count(*) as count
    FROM public.harvest_bids
    WHERE prediction_id = v_prediction_id
    GROUP BY bid_status
  ) sub;

  SELECT COALESCE(SUM(count), 0) INTO v_blocking_bids
  FROM (
    SELECT count(*) as count
    FROM public.harvest_bids
    WHERE prediction_id = v_prediction_id
      AND bid_status NOT IN ('REJECTED', 'CANCELLED')
  ) sub2;

  -- 5. Audit trade requests (group by request_status)
  SELECT COALESCE(jsonb_object_agg(COALESCE(request_status, 'UNKNOWN'), count), '{}'::jsonb)
  INTO v_trade_counts
  FROM (
    SELECT request_status, count(*) as count
    FROM public.trade_requests
    WHERE harvest_prediction_id = v_prediction_id
    GROUP BY request_status
  ) sub3;

  SELECT COALESCE(SUM(count), 0) INTO v_blocking_trades
  FROM (
    SELECT count(*) as count
    FROM public.trade_requests
    WHERE harvest_prediction_id = v_prediction_id
      AND request_status NOT IN ('CANCELLED', 'FULFILLED')
  ) sub4;

  -- 6. Apply explicit lifecycle rules: block if ANY active/pending bids or trades exist
  IF v_blocking_bids > 0 OR v_blocking_trades > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cannot close listing: pending or active bids/trades exist.',
      'bids', COALESCE(v_bid_counts, '{}'::jsonb),
      'trades', COALESCE(v_trade_counts, '{}'::jsonb)
    );
  END IF;

  -- 7. Close the prediction (Leave readiness_status untouched!)
  UPDATE public.harvest_predictions 
  SET 
    prediction_cycle_status = 'CANCELLED', 
    bidding_status = 'CLOSED',
    updated_at = NOW()
  WHERE id = v_prediction_id;

  -- 8. Reset the crop allocation status back to ACTIVE (Not marketplace visible)
  UPDATE public.farm_crop_allocations
  SET 
    allocation_status = 'ACTIVE',
    updated_at = NOW()
  WHERE id = p_crop_allocation_id;

  RETURN jsonb_build_object(
    'success', true, 
    'bids', COALESCE(v_bid_counts, '{}'::jsonb),
    'trades', COALESCE(v_trade_counts, '{}'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_close_crop_allocation_bidding(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_close_crop_allocation_bidding(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_close_crop_allocation_bidding(UUID) TO authenticated;

COMMIT;
