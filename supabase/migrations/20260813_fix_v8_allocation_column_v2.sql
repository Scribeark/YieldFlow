BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_publish_bulk_bidding_sale(
  p_asking_price_per_unit NUMERIC,
  p_crop_type TEXT,
  p_expected_harvest_date TIMESTAMPTZ,
  p_expected_quantity INTEGER,
  p_expected_quantity_unit TEXT,
  p_pickup_address TEXT DEFAULT NULL,
  p_pickup_latitude NUMERIC DEFAULT NULL,
  p_pickup_longitude NUMERIC DEFAULT NULL,
  p_planting_date TIMESTAMPTZ DEFAULT NULL,
  p_seller_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_farm_id UUID;
  v_allocation_id UUID;
  v_prediction_id UUID;
  v_effective_note TEXT;
  v_expected_maturity_days INTEGER;
BEGIN
  -- 1. Resolve internal user id from auth.uid()
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated or user profile not found');
  END IF;

  -- 2. Validate input parameters
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

  -- 3. Find existing seller-owned farm or create minimal backing farm record
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
      COALESCE(NULLIF(BTRIM(p_pickup_address), ''), 'Seller Farm'),
      BTRIM(p_crop_type),
      NULLIF(BTRIM(p_pickup_address), ''),
      p_pickup_latitude,
      p_pickup_longitude,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ) RETURNING id INTO v_farm_id;
  END IF;

  -- Calculate maturity days if planting date is provided
  IF p_planting_date IS NOT NULL THEN
    v_expected_maturity_days := GREATEST(1, EXTRACT(DAY FROM (p_expected_harvest_date - p_planting_date))::INTEGER);
  ELSE
    v_expected_maturity_days := NULL;
  END IF;

  -- 4. Create internal crop allocation record
  -- DO NOT insert into expected_maturity_date (it is GENERATED ALWAYS)
  INSERT INTO public.farm_crop_allocations (
    farm_id,
    user_id,
    crop_type,
    expected_harvest_unit,
    expected_harvest_max,
    planting_date,
    expected_maturity_days,
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
    v_expected_maturity_days,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_allocation_id;

  -- Combine planting date note if provided
  v_effective_note := ARRAY_TO_STRING(
    ARRAY_REMOVE(ARRAY[
      CASE WHEN p_planting_date IS NOT NULL THEN 'Planting Date: ' || to_char(p_planting_date, 'YYYY-MM-DD') ELSE NULL END,
      NULLIF(BTRIM(p_seller_note), '')
    ], NULL),
    ' | '
  );
  IF v_effective_note = '' THEN
    v_effective_note := NULL;
  END IF;

  -- 5. Create harvest prediction / listing with immediate OPEN bidding
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
    v_effective_note,
    CASE WHEN CURRENT_TIMESTAMP >= p_expected_harvest_date THEN CURRENT_TIMESTAMP ELSE NULL END,
    CASE WHEN CURRENT_TIMESTAMP >= p_expected_harvest_date THEN 'EXPECTED_DATE' ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_prediction_id;

  -- 6. Insert notification for seller
  INSERT INTO public.notifications (
    recipient_id,
    actor_id,
    prediction_id,
    event_type,
    message
  ) VALUES (
    v_user_id,
    v_user_id,
    v_prediction_id,
    'SALE_CREATED',
    'Your Bulk Bidding Sale is open for bids.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'prediction_id', v_prediction_id,
    'bidding_status', 'OPEN',
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
