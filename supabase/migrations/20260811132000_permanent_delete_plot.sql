-- ==============================================================================
-- YIELDFLOW: Permanent Deletion of Crop Allocations
-- Version: 1.0 (Final)
-- Requires: farm_crop_allocations, harvest_predictions, harvest_bids, trade_requests, iot_sensor_streams, iot_devices
-- ==============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_delete_crop_allocation(
  p_crop_allocation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_farm_id UUID;
  v_bids_count INT := 0;
  v_trades_count INT := 0;
  v_readings_count INT := 0;
  v_devices_count INT := 0;
  v_open_predictions_count INT := 0;
BEGIN
  -- 1. Resolve calling user
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found or unauthorized.');
  END IF;

  -- 2. Verify ownership and lock allocation
  SELECT f.id INTO v_farm_id
  FROM public.farm_crop_allocations fca
  JOIN public.farms f ON f.id = fca.farm_id
  WHERE fca.id = p_crop_allocation_id
    AND f.user_id = v_user_id
  FOR UPDATE OF fca;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Crop plot not found or not owned by user.');
  END IF;

  -- 3. Lock related predictions to prevent concurrent state changes
  PERFORM 1
  FROM public.harvest_predictions
  WHERE crop_allocation_id = p_crop_allocation_id
  FOR UPDATE;

  -- 4. Count constraints
  
  -- Any OPEN predictions (blocked regardless of cycle status)
  SELECT COUNT(*) INTO v_open_predictions_count
  FROM public.harvest_predictions
  WHERE crop_allocation_id = p_crop_allocation_id
    AND bidding_status = 'OPEN';
    
  -- Bids across any prediction for this allocation
  SELECT COUNT(*) INTO v_bids_count
  FROM public.harvest_bids b
  JOIN public.harvest_predictions p ON p.id = b.prediction_id
  WHERE p.crop_allocation_id = p_crop_allocation_id;
  
  -- Trades across any prediction for this allocation
  SELECT COUNT(*) INTO v_trades_count
  FROM public.trade_requests tr
  JOIN public.harvest_predictions p ON p.id = tr.harvest_prediction_id
  WHERE p.crop_allocation_id = p_crop_allocation_id;
  
  -- Sensor readings
  SELECT COUNT(*) INTO v_readings_count
  FROM public.iot_sensor_streams
  WHERE crop_allocation_id = p_crop_allocation_id;
  
  -- Linked active devices (Only retired ones are permitted to remain linked prior to deletion)
  SELECT COUNT(*) INTO v_devices_count
  FROM public.iot_devices
  WHERE crop_allocation_id = p_crop_allocation_id
    AND device_status != 'RETIRED';

  -- 5. Evaluate safety constraints
  IF v_open_predictions_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete crop plot with an OPEN harvest prediction.');
  END IF;

  IF v_bids_count > 0 OR v_trades_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete crop plot because it has a marketplace or transaction history (bids/trades).');
  END IF;

  IF v_readings_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete crop plot because it has recorded sensor readings.');
  END IF;

  IF v_devices_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete crop plot because it has an active linked device. Retire or unlink the device first.');
  END IF;

  -- 6. Cascade safe deletions
  -- Safe to delete unused predictions
  DELETE FROM public.harvest_predictions
  WHERE crop_allocation_id = p_crop_allocation_id;
  
  -- Delete the allocation itself. 
  -- NOTE: Any linked RETIRED iot_devices will automatically have their crop_allocation_id set to NULL due to the existing ON DELETE SET NULL foreign key constraint.
  DELETE FROM public.farm_crop_allocations
  WHERE id = p_crop_allocation_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Explicit Grants
REVOKE ALL ON FUNCTION public.rpc_delete_crop_allocation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_delete_crop_allocation(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_delete_crop_allocation(UUID) TO authenticated;

COMMIT;
