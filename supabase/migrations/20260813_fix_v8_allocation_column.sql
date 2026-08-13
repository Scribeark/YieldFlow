BEGIN;

-- V9 correction: rpc_publish_bulk_bidding_sale
--
-- Root cause fixed: V8 inserted into farm_crop_allocations.expected_harvest_date
-- which does not exist. The correct column is expected_maturity_date.
--
-- This is CREATE OR REPLACE — no existing data altered.

CREATE OR REPLACE FUNCTION public.rpc_publish_bulk_bidding_sale(
  p_asking_price_per_unit  NUMERIC,
  p_crop_type              TEXT,
  p_expected_harvest_date  TIMESTAMPTZ,
  p_expected_quantity      INTEGER,
  p_expected_quantity_unit TEXT,
  p_pickup_address         TEXT        DEFAULT NULL,
  p_pickup_latitude        NUMERIC     DEFAULT NULL,
  p_pickup_longitude       NUMERIC     DEFAULT NULL,
  p_planting_date          TIMESTAMPTZ DEFAULT NULL,
  p_seller_note            TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id       UUID;
  v_farm_id       UUID;
  v_allocation_id UUID;
  v_prediction_id UUID;
BEGIN
  -- 1. Resolve internal user id via auth.uid()
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated or user profile not found');
  END IF;

  -- 2. Validate required inputs
  IF p_crop_type IS NULL OR BTRIM(p_crop_type) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Crop type is required');
  END IF;

  IF p_expected_quantity IS NULL OR p_expected_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expected quantity must be greater than zero');
  END IF;

  IF p_expected_quantity_unit IS NULL OR BTRIM(p_expected_quantity_unit) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity unit is required');
  END IF;

  IF p_asking_price_per_unit IS NULL OR p_asking_price_per_unit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asking price must be greater than zero');
  END IF;

  IF p_expected_harvest_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expected harvest date is required');
  END IF;

  IF p_planting_date IS NOT NULL AND p_expected_harvest_date <= p_planting_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expected harvest date must be after planting date');
  END IF;

  -- 3. Reuse most-recent seller-owned farm or create minimal backing record
  SELECT id INTO v_farm_id
  FROM public.farms
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_farm_id IS NULL THEN
    INSERT INTO public.farms (
      user_id,
      name,
      crop_type,
      physical_address,
      latitude,
      longitude,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      COALESCE(NULLIF(BTRIM(p_pickup_address), ''), 'My Farm'),
      BTRIM(p_crop_type),
      NULLIF(BTRIM(p_pickup_address), ''),
      p_pickup_latitude,
      p_pickup_longitude,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ) RETURNING id INTO v_farm_id;
  END IF;

  -- 4. Create internal crop allocation record
  --    FIXED: expected_maturity_date (not the non-existent expected_harvest_date)
  INSERT INTO public.farm_crop_allocations (
    farm_id,
    user_id,
    crop_type,
    expected_harvest_unit,
    expected_harvest_max,
    planting_date,
    expected_maturity_date,
    allocation_status,
    created_at,
    updated_at
  ) VALUES (
    v_farm_id,
    v_user_id,
    BTRIM(p_crop_type),
    BTRIM(p_expected_quantity_unit),
    p_expected_quantity,
    p_planting_date,
    p_expected_harvest_date,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_allocation_id;

  -- 5. Create harvest prediction with bidding OPEN immediately
  INSERT INTO public.harvest_predictions (
    farm_id,
    crop_allocation_id,
    prediction_cycle_status,
    readiness_status,
    readiness_score,
    bidding_status,
    bidding_origin,
    prediction_engine,
    expected_quantity_volume,
    expected_quantity_unit,
    minimum_price_per_unit,
    asking_price_per_unit,
    seller_maturity_at,
    seller_note,
    harvest_available_at,
    availability_source,
    created_at,
    updated_at
  ) VALUES (
    v_farm_id,
    v_allocation_id,
    'ACTIVE',
    'NOT_READY',
    0,
    'OPEN',
    'MANUAL',
    'MANUAL',
    p_expected_quantity,
    BTRIM(p_expected_quantity_unit),
    p_asking_price_per_unit,
    p_asking_price_per_unit,
    p_expected_harvest_date,
    p_seller_note,
    CASE WHEN CURRENT_TIMESTAMP >= p_expected_harvest_date THEN CURRENT_TIMESTAMP ELSE NULL END,
    CASE WHEN CURRENT_TIMESTAMP >= p_expected_harvest_date THEN 'EXPECTED_DATE'   ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_prediction_id;

  RETURN jsonb_build_object(
    'success',           true,
    'prediction_id',     v_prediction_id,
    'farm_id',           v_farm_id,
    'allocation_id',     v_allocation_id,
    'bidding_status',    'OPEN',
    'harvest_available', CURRENT_TIMESTAMP >= p_expected_harvest_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_publish_bulk_bidding_sale(
  NUMERIC, TEXT, TIMESTAMPTZ, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_publish_bulk_bidding_sale(
  NUMERIC, TEXT, TIMESTAMPTZ, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT
) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
