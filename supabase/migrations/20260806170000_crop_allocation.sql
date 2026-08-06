-- SECTION 2: SCHEMA PATCHES (single transaction — run after Section 1 is done)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 1 — Add farm size columns to `farms` (named, idempotent constraints)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS farm_size_value NUMERIC,
  ADD COLUMN IF NOT EXISTS farm_size_unit  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'farms_farm_size_unit_check'
      AND conrelid = 'public.farms'::regclass
  ) THEN
    ALTER TABLE public.farms ADD CONSTRAINT farms_farm_size_unit_check
      CHECK (farm_size_unit IS NULL
             OR farm_size_unit IN ('hectares', 'acres', 'square_meters', 'plots'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'farms_farm_size_value_positive'
      AND conrelid = 'public.farms'::regclass
  ) THEN
    ALTER TABLE public.farms ADD CONSTRAINT farms_farm_size_value_positive
      CHECK (farm_size_value IS NULL OR farm_size_value > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.farms.farm_size_value IS 'Total area of the farm. Must be > 0 if provided.';
COMMENT ON COLUMN public.farms.farm_size_unit  IS 'Unit of farm_size_value: hectares, acres, square_meters, plots';


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 2 — Shared updated_at trigger function (idempotent CREATE OR REPLACE)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.fn_set_updated_at() IS 'Generic updated_at trigger. Attach to any table with an updated_at column.';


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 3 — Create `farm_crop_allocations` table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.farm_crop_allocations (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id                UUID        NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id                UUID        NOT NULL REFERENCES public.users(id),
  crop_type              TEXT        NOT NULL,
  land_size_value        NUMERIC,
  land_size_unit         TEXT,
  expected_harvest_min   INTEGER,        -- nullable: required only before opening bidding
  expected_harvest_max   INTEGER,        -- nullable: required only before opening bidding
  expected_harvest_unit  TEXT        NOT NULL DEFAULT 'kg',
  planting_date          DATE,
  expected_maturity_days INTEGER,
  expected_maturity_date DATE GENERATED ALWAYS AS (
    CASE
      WHEN planting_date IS NOT NULL AND expected_maturity_days IS NOT NULL
        THEN planting_date + expected_maturity_days
      ELSE NULL
    END
  ) STORED,
  minimum_price_per_unit NUMERIC,
  allocation_status      TEXT        NOT NULL DEFAULT 'DRAFT',
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Named constraints (all idempotent)
DO $$
BEGIN
  -- crop_type must not be blank
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fca_crop_type_not_empty'
      AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
    ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT fca_crop_type_not_empty CHECK (trim(crop_type) <> '');
  END IF;

  -- land_size_unit valid values
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fca_land_size_unit_check'
      AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
    ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT fca_land_size_unit_check
      CHECK (land_size_unit IS NULL
          OR land_size_unit IN ('hectares', 'acres', 'square_meters', 'plots'));
  END IF;

  -- land_size_value positive if provided
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fca_land_size_value_positive'
      AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
    ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT fca_land_size_value_positive
      CHECK (land_size_value IS NULL OR land_size_value > 0);
  END IF;

  -- expected_harvest_min positive if provided (nullable for DRAFT)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fca_harvest_min_positive'
      AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
    ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT fca_harvest_min_positive
      CHECK (expected_harvest_min IS NULL OR expected_harvest_min > 0);
  END IF;

  -- expected_harvest_max >= min if both provided (nullable for DRAFT)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fca_harvest_range_check'
      AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
    ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT fca_harvest_range_check
      CHECK (
        expected_harvest_max IS NULL
        OR expected_harvest_min IS NULL
        OR expected_harvest_max >= expected_harvest_min
      );
  END IF;

  -- expected_harvest_unit must not be empty
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fca_expected_harvest_unit_not_empty'
      AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
    ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT fca_expected_harvest_unit_not_empty
      CHECK (expected_harvest_unit IS NOT NULL AND trim(expected_harvest_unit) <> '');
  END IF;

  -- allocation_status allowed values
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fca_allocation_status_check'
      AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
    ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT fca_allocation_status_check
      CHECK (allocation_status IN ('DRAFT', 'ACTIVE', 'BIDDING_OPEN', 'HARVESTED', 'ARCHIVED'));
  END IF;

  -- minimum_price_per_unit non-negative if provided
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fca_min_price_non_negative'
      AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
    ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT fca_min_price_non_negative
      CHECK (minimum_price_per_unit IS NULL OR minimum_price_per_unit >= 0);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fca_farm_id ON public.farm_crop_allocations(farm_id);
CREATE INDEX IF NOT EXISTS idx_fca_user_id ON public.farm_crop_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_fca_status  ON public.farm_crop_allocations(allocation_status);
CREATE INDEX IF NOT EXISTS idx_fca_farm_status ON public.farm_crop_allocations(farm_id, allocation_status);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname   = 'trg_fca_updated_at'
      AND tgrelid  = 'public.farm_crop_allocations'::regclass
  ) THEN
    CREATE TRIGGER trg_fca_updated_at
      BEFORE UPDATE ON public.farm_crop_allocations
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
  END IF;
END $$;

-- Row Level Security
ALTER TABLE public.farm_crop_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fca_seller_owns" ON public.farm_crop_allocations;
CREATE POLICY "fca_seller_owns"
ON public.farm_crop_allocations
FOR ALL
TO authenticated
USING (
  user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
)
WITH CHECK (
  user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
);

DROP POLICY IF EXISTS "fca_service_role_full" ON public.farm_crop_allocations;
CREATE POLICY "fca_service_role_full"
ON public.farm_crop_allocations
FOR ALL
TO service_role
USING  (true)
WITH CHECK (true);

COMMENT ON TABLE  public.farm_crop_allocations IS 'One row per crop planting on a farm. Many crops per farm. Source of truth for pre-harvest bidding quantity and maturity timeline.';
COMMENT ON COLUMN public.farm_crop_allocations.expected_harvest_min   IS 'Nullable for DRAFT. Required (> 0) before opening pre-harvest bidding.';
COMMENT ON COLUMN public.farm_crop_allocations.expected_harvest_max   IS 'Nullable for DRAFT. Required (>= min) before opening pre-harvest bidding.';
COMMENT ON COLUMN public.farm_crop_allocations.expected_maturity_date IS 'Auto-computed generated column: planting_date + expected_maturity_days. Read-only.';
COMMENT ON COLUMN public.farm_crop_allocations.minimum_price_per_unit IS 'Optional price floor per unit. NULL = Negotiable shown in buyer UI.';
COMMENT ON COLUMN public.farm_crop_allocations.allocation_status      IS 'DRAFT: not yet visible to buyers. BIDDING_OPEN: marketplace visible. HARVESTED: actual harvest declared. ARCHIVED: closed.';


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 4 — Add columns to `harvest_predictions`
-- ────────────────────────────────────────────────────────────────────────────

-- FK to crop allocation
ALTER TABLE public.harvest_predictions
  ADD COLUMN IF NOT EXISTS crop_allocation_id UUID
    REFERENCES public.farm_crop_allocations(id) ON DELETE SET NULL;

-- Actual harvest quantity declared by seller before conversion
ALTER TABLE public.harvest_predictions
  ADD COLUMN IF NOT EXISTS confirmed_quantity INTEGER;

-- Expected quantity range (may already exist from earlier patch — safe with IF NOT EXISTS)
ALTER TABLE public.harvest_predictions
  ADD COLUMN IF NOT EXISTS expected_quantity_min INTEGER,
  ADD COLUMN IF NOT EXISTS expected_quantity_max INTEGER;

-- Named constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'harvest_predictions_expected_quantity_min_check'
      AND conrelid = 'public.harvest_predictions'::regclass
  ) THEN
    ALTER TABLE public.harvest_predictions
      ADD CONSTRAINT harvest_predictions_expected_quantity_min_check
      CHECK (expected_quantity_min IS NULL OR expected_quantity_min > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'harvest_predictions_expected_quantity_range_check'
      AND conrelid = 'public.harvest_predictions'::regclass
  ) THEN
    ALTER TABLE public.harvest_predictions
      ADD CONSTRAINT harvest_predictions_expected_quantity_range_check
      CHECK (
        expected_quantity_max IS NULL
        OR expected_quantity_min IS NULL
        OR expected_quantity_max >= expected_quantity_min
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hp_confirmed_quantity_positive'
      AND conrelid = 'public.harvest_predictions'::regclass
  ) THEN
    ALTER TABLE public.harvest_predictions
      ADD CONSTRAINT hp_confirmed_quantity_positive
      CHECK (confirmed_quantity IS NULL OR confirmed_quantity > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hp_crop_allocation_id
  ON public.harvest_predictions(crop_allocation_id);

COMMENT ON COLUMN public.harvest_predictions.crop_allocation_id IS 'FK to farm_crop_allocations. NULL for legacy/manual predictions.';
COMMENT ON COLUMN public.harvest_predictions.confirmed_quantity  IS 'Actual harvested quantity declared by seller. Must be set before conversion. Conversion is bounded by this value, not by the forecast max.';
COMMENT ON COLUMN public.harvest_predictions.expected_quantity_min IS 'Copied from crop_allocation.expected_harvest_min when bidding opens.';
COMMENT ON COLUMN public.harvest_predictions.expected_quantity_max IS 'Copied from crop_allocation.expected_harvest_max when bidding opens. Also sets expected_quantity_volume (provisional cap).';


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 5 — Add crop_allocation_id to `iot_devices`
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.iot_devices
  ADD COLUMN IF NOT EXISTS crop_allocation_id UUID
    REFERENCES public.farm_crop_allocations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.iot_devices.crop_allocation_id IS 'NULL = farm-wide. Non-null = readings monitor this specific crop allocation.';


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 6 — Add crop_allocation_id to `iot_sensor_streams`
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.iot_sensor_streams
  ADD COLUMN IF NOT EXISTS crop_allocation_id UUID
    REFERENCES public.farm_crop_allocations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_iss_crop_allocation_id
  ON public.iot_sensor_streams(crop_allocation_id);

COMMENT ON COLUMN public.iot_sensor_streams.crop_allocation_id IS 'Derived from iot_devices.crop_allocation_id at ingestion. NULL = farm-wide reading.';


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 7 — RPC: rpc_save_crop_allocation_draft
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_save_crop_allocation_draft(
  p_farm_id                UUID,
  p_crop_type              TEXT,
  p_land_size_value        NUMERIC   DEFAULT NULL,
  p_land_size_unit         TEXT      DEFAULT NULL,
  p_expected_harvest_min   INTEGER   DEFAULT NULL,
  p_expected_harvest_max   INTEGER   DEFAULT NULL,
  p_expected_harvest_unit  TEXT      DEFAULT 'kg',
  p_planting_date          DATE      DEFAULT NULL,
  p_expected_maturity_days INTEGER   DEFAULT NULL,
  p_minimum_price_per_unit NUMERIC   DEFAULT NULL,
  p_notes                  TEXT      DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_farm      public.farms%ROWTYPE;
  v_alloc_id  UUID;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users WHERE auth_uid = auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_farm FROM public.farms WHERE id = p_farm_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Farm not found';
  END IF;

  IF v_farm.user_id != v_caller_id THEN
    RAISE EXCEPTION 'Not authorized: farm belongs to another seller';
  END IF;

  IF v_farm.farm_status = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Cannot add crop allocation to an archived farm';
  END IF;

  IF p_crop_type IS NULL OR trim(p_crop_type) = '' THEN
    RAISE EXCEPTION 'Crop type is required';
  END IF;

  IF p_expected_harvest_unit IS NULL OR trim(p_expected_harvest_unit) = '' THEN
    RAISE EXCEPTION 'Expected harvest unit is required';
  END IF;

  IF p_expected_harvest_min IS NOT NULL AND p_expected_harvest_min <= 0 THEN
    RAISE EXCEPTION 'Expected harvest minimum must be greater than zero';
  END IF;

  IF p_expected_harvest_min IS NOT NULL
     AND p_expected_harvest_max IS NOT NULL
     AND p_expected_harvest_max < p_expected_harvest_min THEN
    RAISE EXCEPTION 'Expected harvest maximum must be >= minimum';
  END IF;

  IF p_land_size_value IS NOT NULL AND p_land_size_value <= 0 THEN
    RAISE EXCEPTION 'Land size value must be > 0';
  END IF;

  IF p_minimum_price_per_unit IS NOT NULL AND p_minimum_price_per_unit < 0 THEN
    RAISE EXCEPTION 'Minimum price per unit cannot be negative';
  END IF;

  INSERT INTO public.farm_crop_allocations (
    farm_id, user_id, crop_type,
    land_size_value, land_size_unit,
    expected_harvest_min, expected_harvest_max, expected_harvest_unit,
    planting_date, expected_maturity_days,
    minimum_price_per_unit, notes,
    allocation_status
  ) VALUES (
    p_farm_id, v_caller_id, p_crop_type,
    p_land_size_value, p_land_size_unit,
    p_expected_harvest_min, p_expected_harvest_max,
    p_expected_harvest_unit,
    p_planting_date, p_expected_maturity_days,
    p_minimum_price_per_unit, p_notes,
    'DRAFT'
  )
  RETURNING id INTO v_alloc_id;

  RETURN json_build_object(
    'success',       true,
    'allocation_id', v_alloc_id,
    'status',        'DRAFT'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_save_crop_allocation_draft(
  UUID, TEXT, NUMERIC, TEXT, INTEGER, INTEGER, TEXT, DATE, INTEGER, NUMERIC, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_save_crop_allocation_draft(
  UUID, TEXT, NUMERIC, TEXT, INTEGER, INTEGER, TEXT, DATE, INTEGER, NUMERIC, TEXT
) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 8 — RPC: rpc_open_crop_allocation_bidding
--
-- CORRECTIONS APPLIED:
--   ✅ Existing OPEN prediction is checked. If it has bids, aborts. If no bids, closes it.
--   ✅ Validates minimum price >= 0
--   ✅ COALESCE(p_minimum_price_per_unit, v_alloc.minimum_price_per_unit)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_open_crop_allocation_bidding(
  p_crop_allocation_id     UUID,
  p_minimum_price_per_unit NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id          UUID;
  v_alloc              public.farm_crop_allocations%ROWTYPE;
  v_farm               public.farms%ROWTYPE;
  v_existing_pred_id   UUID;
  v_bid_count          INTEGER;
  v_final_price        NUMERIC;
  v_pred_id            UUID;
BEGIN
  -- Resolve caller
  SELECT id INTO v_caller_id
  FROM public.users WHERE auth_uid = auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Load and lock allocation
  SELECT * INTO v_alloc
  FROM public.farm_crop_allocations
  WHERE id = p_crop_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crop allocation not found';
  END IF;

  -- Ownership check
  IF v_alloc.user_id != v_caller_id THEN
    RAISE EXCEPTION 'Not authorized: crop allocation belongs to another seller';
  END IF;

  IF v_alloc.allocation_status = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Cannot open bidding on an archived crop allocation';
  END IF;

  -- Load and check farm
  SELECT * INTO v_farm FROM public.farms WHERE id = v_alloc.farm_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Farm not found';
  END IF;

  IF v_farm.farm_status = 'ARCHIVED' THEN
    RAISE EXCEPTION 'Cannot open bidding for a crop allocation on an archived farm';
  END IF;

  -- Business completeness gates
  IF v_alloc.crop_type IS NULL OR trim(v_alloc.crop_type) = '' THEN
    RAISE EXCEPTION 'Crop type is required before opening pre-harvest bidding';
  END IF;

  IF v_alloc.expected_harvest_unit IS NULL OR trim(v_alloc.expected_harvest_unit) = '' THEN
    RAISE EXCEPTION 'Expected harvest unit is required before opening pre-harvest bidding';
  END IF;

  IF v_alloc.expected_harvest_min IS NULL OR v_alloc.expected_harvest_min <= 0 THEN
    RAISE EXCEPTION 'Expected harvest minimum must be greater than zero before opening bidding';
  END IF;

  IF v_alloc.expected_harvest_max IS NULL
     OR v_alloc.expected_harvest_max < v_alloc.expected_harvest_min THEN
    RAISE EXCEPTION 'Expected harvest maximum must be >= minimum before opening bidding';
  END IF;

  -- Resolve minimum price
  v_final_price := COALESCE(p_minimum_price_per_unit, v_alloc.minimum_price_per_unit);
  IF v_final_price IS NOT NULL AND v_final_price < 0 THEN
    RAISE EXCEPTION 'Minimum price cannot be negative';
  END IF;

  -- ── Handle existing OPEN prediction for this allocation ──────────────────
  SELECT id INTO v_existing_pred_id
  FROM public.harvest_predictions
  WHERE crop_allocation_id = p_crop_allocation_id
    AND bidding_status = 'OPEN';

  IF FOUND THEN
    -- Check if it has any bids
    SELECT COUNT(*) INTO v_bid_count
    FROM public.harvest_bids
    WHERE prediction_id = v_existing_pred_id;

    IF v_bid_count > 0 THEN
      RAISE EXCEPTION 'An OPEN prediction already exists for this allocation and it has existing bids. Cannot duplicate or close it.';
    END IF;

    -- Safe to close since no bids exist
    UPDATE public.harvest_predictions
    SET
      bidding_status          = 'CLOSED',
      prediction_cycle_status = 'COMPLETED',
      updated_at              = NOW()
    WHERE id = v_existing_pred_id;
  END IF;

  -- ── Create new OPEN harvest_prediction ──────────────────────────────────
  INSERT INTO public.harvest_predictions (
    farm_id,
    crop_allocation_id,
    prediction_cycle_status,
    readiness_status,
    readiness_score,
    bidding_status,
    bidding_origin,
    prediction_engine,
    expected_quantity_min,
    expected_quantity_max,
    expected_quantity_volume,   -- provisional cap = max
    expected_quantity_unit,
    minimum_price_per_unit
  ) VALUES (
    v_alloc.farm_id,
    p_crop_allocation_id,
    'ACTIVE',
    'NOT_READY',
    0.0,
    'OPEN',
    'IOT',
    'hybrid_score',
    v_alloc.expected_harvest_min,
    v_alloc.expected_harvest_max,
    v_alloc.expected_harvest_max,
    v_alloc.expected_harvest_unit,
    v_final_price
  )
  RETURNING id INTO v_pred_id;

  -- ── Update allocation status ─────────────────────────────────────────────
  UPDATE public.farm_crop_allocations
  SET
    allocation_status = 'BIDDING_OPEN',
    updated_at        = NOW()
  WHERE id = p_crop_allocation_id;

  RETURN json_build_object(
    'success',       true,
    'prediction_id', v_pred_id,
    'allocation_id', p_crop_allocation_id,
    'minimum_price', v_final_price
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_open_crop_allocation_bidding(UUID, NUMERIC)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_open_crop_allocation_bidding(UUID, NUMERIC)
  TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 9 — Strip rpc_hybrid_prediction_update of all bidding-opening logic
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_hybrid_prediction_update(
  p_prediction_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction     public.harvest_predictions%ROWTYPE;
  v_farm           public.farms%ROWTYPE;
  v_alloc          public.farm_crop_allocations%ROWTYPE;
  v_latest_reading public.iot_sensor_streams%ROWTYPE;

  v_planting_date        DATE;
  v_maturity_days        INTEGER;
  v_days_since_planting  INTEGER;
  v_base_score           DOUBLE PRECISION := 0;
  v_env_score            DOUBLE PRECISION := 100;
  v_final_score          DOUBLE PRECISION;
  v_new_status           TEXT;
  v_data_notes           TEXT := '';
  v_has_readings         BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_prediction
  FROM public.harvest_predictions
  WHERE id = p_prediction_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Prediction not found');
  END IF;

  IF v_prediction.prediction_cycle_status != 'ACTIVE' THEN
    RETURN json_build_object(
      'success', false,
      'error',   'Prediction is not ACTIVE — readiness update skipped'
    );
  END IF;

  SELECT * INTO v_farm FROM public.farms WHERE id = v_prediction.farm_id;

  IF v_prediction.crop_allocation_id IS NOT NULL THEN
    SELECT * INTO v_alloc
    FROM public.farm_crop_allocations
    WHERE id = v_prediction.crop_allocation_id;

    v_planting_date := v_alloc.planting_date;
    v_maturity_days := v_alloc.expected_maturity_days;
  END IF;

  IF v_planting_date IS NULL THEN
    v_planting_date := v_farm.planting_date;
  END IF;
  IF v_maturity_days IS NULL THEN
    v_maturity_days := v_farm.expected_maturity_days;
  END IF;

  IF v_planting_date IS NOT NULL AND v_maturity_days IS NOT NULL AND v_maturity_days > 0 THEN
    v_days_since_planting := GREATEST(0, CURRENT_DATE - v_planting_date);
    v_base_score := LEAST(100.0,
      (v_days_since_planting::DOUBLE PRECISION / v_maturity_days) * 100.0
    );
  ELSE
    v_base_score  := 0;
    v_data_notes  := v_data_notes || 'No maturity data available for base score. ';
  END IF;

  IF v_prediction.crop_allocation_id IS NOT NULL THEN
    SELECT iss.* INTO v_latest_reading
    FROM public.iot_sensor_streams iss
    JOIN public.iot_devices d ON d.id = iss.device_id
    WHERE d.crop_allocation_id = v_prediction.crop_allocation_id
    ORDER BY iss.recorded_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND OR v_latest_reading IS NULL THEN
    SELECT * INTO v_latest_reading
    FROM public.iot_sensor_streams
    WHERE farm_id = v_prediction.farm_id
    ORDER BY recorded_at DESC
    LIMIT 1;
  END IF;

  IF v_latest_reading.id IS NOT NULL THEN
    v_has_readings := TRUE;

    IF v_latest_reading.soil_moisture < 20.0 THEN
      v_env_score := v_env_score - 30;
    ELSIF v_latest_reading.soil_moisture < 35.0 THEN
      v_env_score := v_env_score - 15;
    END IF;

    IF v_latest_reading.ambient_temperature > 38.0 THEN
      v_env_score := v_env_score - 20;
    END IF;

    IF v_latest_reading.ambient_humidity < 30.0 THEN
      v_env_score := v_env_score - 10;
    END IF;

    v_env_score := GREATEST(0, v_env_score);

    IF v_latest_reading.recorded_at < NOW() - INTERVAL '12 hours' THEN
      v_env_score  := v_env_score * 0.8;
      v_data_notes := v_data_notes || 'Latest reading is >12 hours old (env score reduced). ';
    END IF;
  ELSE
    v_env_score  := 0;
    v_data_notes := v_data_notes || 'No sensor readings available (env score = 0). ';
  END IF;

  IF v_has_readings THEN
    v_final_score := (v_base_score * 0.6) + (v_env_score * 0.4);
  ELSE
    v_final_score := v_base_score * 0.5;
  END IF;

  IF v_env_score < 30 THEN
    v_new_status := 'RISK_ALERT';
  ELSIF v_final_score < 40 THEN
    v_new_status := 'NOT_READY';
  ELSIF v_final_score < 60 THEN
    v_new_status := 'WATCH';
  ELSIF v_final_score < 75 THEN
    v_new_status := 'READY_SOON';
  ELSE
    v_new_status := 'HARVEST_READY';
  END IF;

  -- ── CRITICAL: readiness_score and readiness_status ONLY — never bidding_status ──
  UPDATE public.harvest_predictions
  SET
    readiness_score  = v_final_score,
    readiness_status = v_new_status,
    updated_at       = NOW()
  WHERE id = p_prediction_id;

  RETURN json_build_object(
    'success',       true,
    'new_score',     round(v_final_score::numeric, 2),
    'new_status',    v_new_status,
    'has_readings',  v_has_readings,
    'base_score',    round(v_base_score::numeric, 2),
    'env_score',     round(v_env_score::numeric, 2),
    'data_notes',    NULLIF(trim(v_data_notes), '')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_hybrid_prediction_update(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_hybrid_prediction_update(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- PATCH 10 — Relax NOT NULL on farms legacy columns
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.farms 
  ALTER COLUMN crop_type DROP NOT NULL,
  ALTER COLUMN planting_date DROP NOT NULL,
  ALTER COLUMN expected_maturity_days DROP NOT NULL;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: VERIFICATION QUERIES (run after Section 2 commits successfully)
-- ═══════════════════════════════════════════════════════════════════════════════

-- V1: Confirm farm size columns + named constraints
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'farms'
  AND column_name IN ('farm_size_value', 'farm_size_unit')
ORDER BY column_name;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.farms'::regclass
  AND conname IN ('farms_farm_size_unit_check', 'farms_farm_size_value_positive');

-- V2: Confirm farm_crop_allocations table and its columns
SELECT column_name, data_type, is_nullable, is_generated, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'farm_crop_allocations'
ORDER BY ordinal_position;

-- V3: Confirm farm_crop_allocations named constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.farm_crop_allocations'::regclass
ORDER BY conname;

-- V4: Confirm RLS policies on farm_crop_allocations
SELECT policyname, cmd, roles, qual::text, with_check::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'farm_crop_allocations';

-- V5: Confirm updated_at trigger
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.farm_crop_allocations'::regclass;

-- V6: Confirm harvest_predictions new columns
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'harvest_predictions'
  AND column_name IN (
    'crop_allocation_id', 'confirmed_quantity',
    'expected_quantity_min', 'expected_quantity_max'
  )
ORDER BY column_name;

-- V7: Confirm harvest_predictions named constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.harvest_predictions'::regclass
  AND conname IN (
    'harvest_predictions_expected_quantity_min_check',
    'harvest_predictions_expected_quantity_range_check',
    'hp_confirmed_quantity_positive'
  );

-- V8: Confirm iot_devices has crop_allocation_id
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'iot_devices'
  AND column_name = 'crop_allocation_id';

-- V9: Confirm iot_sensor_streams has crop_allocation_id
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'iot_sensor_streams'
  AND column_name = 'crop_allocation_id';

-- V10: Confirm all 4 RPCs/functions exist
SELECT proname, prosecdef AS security_definer
FROM pg_proc
WHERE proname IN (
  'fn_set_updated_at',
  'rpc_save_crop_allocation_draft',
  'rpc_open_crop_allocation_bidding',
  'rpc_hybrid_prediction_update'
)
ORDER BY proname;

-- V11: Confirm rpc_hybrid_prediction_update no longer sets bidding_status = OPEN
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'rpc_hybrid_prediction_update'
  AND prosrc ILIKE '%bidding_status%=%OPEN%';
-- EXPECTED: 0 rows returned
