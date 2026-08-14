-- ==============================================================================
-- YieldFlow Web (Agri-Data Hub v2) — Phase 2 Master Schema & RLS Migration
-- ==============================================================================
-- Run this script inside your Supabase SQL Editor (Project -> SQL Editor -> New Query)
-- to automatically align all columns, create new P2 tables, and open RLS / storage buckets.

-- 1. Ensure primary tables exist and have all required columns
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_uid UUID UNIQUE,
    full_name TEXT NOT NULL DEFAULT 'Agri User',
    phone_number TEXT,
    age INTEGER,
    gender TEXT,
    declared_profession TEXT NOT NULL DEFAULT 'farmer',
    macro_region TEXT,
    verification_status TEXT DEFAULT 'pending',
    business_latitude DOUBLE PRECISION,
    business_longitude DOUBLE PRECISION,
    has_registered_device BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'Agri User';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS declared_profession TEXT NOT NULL DEFAULT 'farmer';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS macro_region TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS business_latitude DOUBLE PRECISION;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS business_longitude DOUBLE PRECISION;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_registered_device BOOLEAN DEFAULT false;

-- 2. Trade Requests (`trade_requests`) alignment
CREATE TABLE IF NOT EXISTS public.trade_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    commodity_variety TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1000,
    address TEXT,
    harvest_photo_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.trade_requests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.trade_requests ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.trade_requests ADD COLUMN IF NOT EXISTS commodity_variety TEXT;
ALTER TABLE public.trade_requests ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1000;
ALTER TABLE public.trade_requests ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.trade_requests ADD COLUMN IF NOT EXISTS harvest_photo_url TEXT;
ALTER TABLE public.trade_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 3. Vehicle States (`vehicle_states`) alignment
CREATE TABLE IF NOT EXISTS public.vehicle_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    carrier_status TEXT DEFAULT 'available',
    vehicle_type TEXT,
    vehicle_photo_url TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vehicle_states ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.vehicle_states ADD COLUMN IF NOT EXISTS carrier_status TEXT DEFAULT 'available';
ALTER TABLE public.vehicle_states ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.vehicle_states ADD COLUMN IF NOT EXISTS vehicle_photo_url TEXT;
ALTER TABLE public.vehicle_states ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.vehicle_states ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.vehicle_states ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 4. IoT Telemetry Logs (`iot_telemetry_logs`) alignment
CREATE TABLE IF NOT EXISTS public.iot_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    associated_lga TEXT,
    soil_moisture_percentage NUMERIC NOT NULL,
    temperature NUMERIC,
    humidity NUMERIC,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.iot_telemetry_logs ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.iot_telemetry_logs ADD COLUMN IF NOT EXISTS associated_lga TEXT;
ALTER TABLE public.iot_telemetry_logs ADD COLUMN IF NOT EXISTS soil_moisture_percentage NUMERIC;
ALTER TABLE public.iot_telemetry_logs ADD COLUMN IF NOT EXISTS temperature NUMERIC;
ALTER TABLE public.iot_telemetry_logs ADD COLUMN IF NOT EXISTS humidity NUMERIC;
ALTER TABLE public.iot_telemetry_logs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.iot_telemetry_logs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 5. NEW P2 TABLE: Trade Inquiries (`trade_inquiries`)
CREATE TABLE IF NOT EXISTS public.trade_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    commodity TEXT NOT NULL,
    quantity_kg NUMERIC NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. NEW P2 TABLE: Farm Input Listings (`farm_input_listings`)
CREATE TABLE IF NOT EXISTS public.farm_input_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    input_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price_ngn NUMERIC NOT NULL,
    quantity_available NUMERIC NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'kg',
    photo_url TEXT,
    region TEXT DEFAULT 'Ibadan Central Hub',
    status TEXT DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. NEW P2 TABLE: Logistics Bookings (`logistics_bookings`)
CREATE TABLE IF NOT EXISTS public.logistics_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_request_id UUID REFERENCES public.trade_requests(id) ON DELETE CASCADE,
    harvest_id UUID REFERENCES public.trade_requests(id) ON DELETE CASCADE,
    carrier_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    payer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    pickup_time TIMESTAMP WITH TIME ZONE,
    delivery_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'matched',
    payment_status TEXT DEFAULT 'pending',
    estimated_cost_ngn NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.logistics_bookings ADD COLUMN IF NOT EXISTS payer_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.logistics_bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.logistics_bookings ADD COLUMN IF NOT EXISTS estimated_cost_ngn NUMERIC;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) OPEN PUBLIC/ANON POLICIES FOR TESTING
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_input_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_bookings ENABLE ROW LEVEL SECURITY;

-- Allow full SELECT / INSERT / UPDATE for authenticated and anon roles (client testing / seeder)
CREATE POLICY "Allow all select users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow all insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update users" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Allow all select trade_requests" ON public.trade_requests FOR SELECT USING (true);
CREATE POLICY "Allow all insert trade_requests" ON public.trade_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update trade_requests" ON public.trade_requests FOR UPDATE USING (true);

CREATE POLICY "Allow all select vehicle_states" ON public.vehicle_states FOR SELECT USING (true);
CREATE POLICY "Allow all insert vehicle_states" ON public.vehicle_states FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update vehicle_states" ON public.vehicle_states FOR UPDATE USING (true);

CREATE POLICY "Allow all select iot_telemetry_logs" ON public.iot_telemetry_logs FOR SELECT USING (true);
CREATE POLICY "Allow all insert iot_telemetry_logs" ON public.iot_telemetry_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update iot_telemetry_logs" ON public.iot_telemetry_logs FOR UPDATE USING (true);

CREATE POLICY "Allow all select trade_inquiries" ON public.trade_inquiries FOR SELECT USING (true);
CREATE POLICY "Allow all insert trade_inquiries" ON public.trade_inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update trade_inquiries" ON public.trade_inquiries FOR UPDATE USING (true);

CREATE POLICY "Allow all select farm_input_listings" ON public.farm_input_listings FOR SELECT USING (true);
CREATE POLICY "Allow all insert farm_input_listings" ON public.farm_input_listings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update farm_input_listings" ON public.farm_input_listings FOR UPDATE USING (true);

CREATE POLICY "Allow all select logistics_bookings" ON public.logistics_bookings FOR SELECT USING (true);
CREATE POLICY "Allow all insert logistics_bookings" ON public.logistics_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update logistics_bookings" ON public.logistics_bookings FOR UPDATE USING (true);

-- ==============================================================================
-- STORAGE BUCKETS SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('harvest-photos', 'harvest-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public read harvest photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'harvest-photos');
CREATE POLICY "Public upload harvest photos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'harvest-photos');

CREATE POLICY "Public read vehicle photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'vehicle-photos');
CREATE POLICY "Public upload vehicle photos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'vehicle-photos');

-- ==============================================================================
-- INITIAL SYNTHETIC TEST USERS
-- ==============================================================================
INSERT INTO public.users (id, full_name, declared_profession, phone_number, macro_region, verification_status, business_latitude, business_longitude)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Alhaji Musa (Simulated Farmer)', 'farmer', '08024757252', 'Ibadan Central Hub', 'verified', 7.3775, 3.9470),
    ('22222222-2222-2222-2222-222222222222', 'Chinedu Transport Fleet (Carrier)', 'carrier', '08036386934', 'Lagos Port Hub', 'verified', 6.5244, 3.3792),
    ('33333333-3333-3333-3333-333333333333', 'Dangote Agro-Processing (Buyer)', 'buyer', '08012345678', 'Kano Market Hub', 'verified', 12.0022, 8.5920)
ON CONFLICT (id) DO NOTHING;
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
-- ==============================================================================
-- YIELDFLOW: IoT Architecture & Native Farm-Monitoring Capability Patch
-- Version: 1.0 (Final)
-- Adjustments: Safe for empty legacy tables. Strictly Idempotent. Trigger Secured.
-- ==============================================================================
BEGIN;

-- ==========================================
-- 1. DEVICE PROVENANCE & CAPABILITIES
-- ==========================================
DO $$ BEGIN
  -- ingestion_mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'iot_devices' AND column_name = 'ingestion_mode') THEN
      ALTER TABLE public.iot_devices ADD COLUMN ingestion_mode TEXT NOT NULL DEFAULT 'direct_device';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_devices_ingestion_mode_check' AND conrelid = 'public.iot_devices'::regclass) THEN
      ALTER TABLE public.iot_devices ADD CONSTRAINT iot_devices_ingestion_mode_check CHECK (ingestion_mode IN ('direct_device', 'simulator'));
  END IF;
  
  -- expected_reporting_interval_minutes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'iot_devices' AND column_name = 'expected_reporting_interval_minutes') THEN
      ALTER TABLE public.iot_devices ADD COLUMN expected_reporting_interval_minutes INTEGER NOT NULL DEFAULT 60;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_devices_reporting_interval_check' AND conrelid = 'public.iot_devices'::regclass) THEN
      ALTER TABLE public.iot_devices ADD CONSTRAINT iot_devices_reporting_interval_check CHECK (expected_reporting_interval_minutes > 0);
  END IF;
  
  -- supported_measurements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'iot_devices' AND column_name = 'supported_measurements') THEN
      ALTER TABLE public.iot_devices ADD COLUMN supported_measurements TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_devices_supported_measurements_check' AND conrelid = 'public.iot_devices'::regclass) THEN
      ALTER TABLE public.iot_devices ADD CONSTRAINT iot_devices_supported_measurements_check CHECK (
          supported_measurements <@ ARRAY[
              'soil_moisture', 'soil_temperature', 'ambient_temperature', 
              'ambient_humidity', 'rainfall_mm', 'irrigation_mm', 
              'soil_ph', 'soil_nitrogen', 'soil_phosphorus', 
              'soil_potassium', 'soil_salinity'
          ]::TEXT[]
      );
  END IF;
END $$;

-- ==========================================
-- 2. BASE STREAMS & PROVENANCE CONFIG
-- ==========================================
DO $$ BEGIN
  -- Add column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'iot_sensor_streams' AND column_name = 'ingestion_source') THEN
      ALTER TABLE public.iot_sensor_streams ADD COLUMN ingestion_source TEXT;
  END IF;
END $$;

-- Enforce strict constraints (table confirmed empty of invalid legacy data)
ALTER TABLE public.iot_sensor_streams ALTER COLUMN ingestion_source SET DEFAULT 'direct_device';
ALTER TABLE public.iot_sensor_streams ALTER COLUMN ingestion_source SET NOT NULL;

DO $$ BEGIN
  -- Provenance Check
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_sensor_streams_ingestion_source_check' AND conrelid = 'public.iot_sensor_streams'::regclass) THEN
      ALTER TABLE public.iot_sensor_streams
      ADD CONSTRAINT iot_sensor_streams_ingestion_source_check 
      CHECK (ingestion_source IN ('direct_device', 'github_simulator', 'manual_test', 'external_provider'));
  END IF;

  -- Protect against duplicate packets
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_sensor_streams_unique_packet' AND conrelid = 'public.iot_sensor_streams'::regclass) THEN
      ALTER TABLE public.iot_sensor_streams ADD CONSTRAINT iot_sensor_streams_unique_packet UNIQUE (device_id, recorded_at);
  END IF;
END $$;

-- ==========================================
-- 3. CROP CONFIGURABLE THRESHOLDS
-- ==========================================
DO $$ BEGIN
  -- Add Columns Independently
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farm_crop_allocations' AND column_name = 'optimum_moisture_min') THEN
      ALTER TABLE public.farm_crop_allocations ADD COLUMN optimum_moisture_min DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farm_crop_allocations' AND column_name = 'optimum_moisture_max') THEN
      ALTER TABLE public.farm_crop_allocations ADD COLUMN optimum_moisture_max DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farm_crop_allocations' AND column_name = 'optimum_temp_min') THEN
      ALTER TABLE public.farm_crop_allocations ADD COLUMN optimum_temp_min DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farm_crop_allocations' AND column_name = 'optimum_temp_max') THEN
      ALTER TABLE public.farm_crop_allocations ADD COLUMN optimum_temp_max DOUBLE PRECISION;
  END IF;

  -- Bounded Constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_crop_allocations_moisture_threshold_check' AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
      ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT farm_crop_allocations_moisture_threshold_check CHECK (
          (optimum_moisture_min IS NULL OR (optimum_moisture_min >= 0 AND optimum_moisture_min <= 100)) AND
          (optimum_moisture_max IS NULL OR (optimum_moisture_max >= 0 AND optimum_moisture_max <= 100)) AND
          (optimum_moisture_min IS NULL OR optimum_moisture_max IS NULL OR optimum_moisture_max >= optimum_moisture_min)
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_crop_allocations_temperature_threshold_check' AND conrelid = 'public.farm_crop_allocations'::regclass) THEN
      ALTER TABLE public.farm_crop_allocations
      ADD CONSTRAINT farm_crop_allocations_temperature_threshold_check CHECK (
          (optimum_temp_min IS NULL OR (optimum_temp_min >= -50 AND optimum_temp_min <= 60)) AND
          (optimum_temp_max IS NULL OR (optimum_temp_max >= -50 AND optimum_temp_max <= 60)) AND
          (optimum_temp_min IS NULL OR optimum_temp_max IS NULL OR optimum_temp_max >= optimum_temp_min)
      );
  END IF;
END $$;

-- ==========================================
-- 4. SPECIALIZED ANALYTICS (OBSERVATIONS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.iot_sensor_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.iot_sensor_streams(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.iot_devices(id),
    farm_id UUID NOT NULL REFERENCES public.farms(id),
    crop_allocation_id UUID REFERENCES public.farm_crop_allocations(id),
    metric_code TEXT NOT NULL,
    numeric_value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL CHECK (trim(unit) <> ''),
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_sensor_observations_metric_code_check' AND conrelid = 'public.iot_sensor_observations'::regclass) THEN
      ALTER TABLE public.iot_sensor_observations ADD CONSTRAINT iot_sensor_observations_metric_code_check CHECK (
          metric_code IN (
              'soil_temperature', 'soil_ph', 'soil_nitrogen', 'soil_phosphorus', 
              'soil_potassium', 'soil_salinity', 'irrigation_mm'
          )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_sensor_observations_unit_check' AND conrelid = 'public.iot_sensor_observations'::regclass) THEN
      ALTER TABLE public.iot_sensor_observations ADD CONSTRAINT iot_sensor_observations_unit_check CHECK (
          (metric_code = 'soil_temperature' AND unit = 'celsius') OR
          (metric_code = 'soil_ph' AND unit = 'pH') OR
          (metric_code = 'soil_nitrogen' AND unit = 'mg/kg') OR
          (metric_code = 'soil_phosphorus' AND unit = 'mg/kg') OR
          (metric_code = 'soil_potassium' AND unit = 'mg/kg') OR
          (metric_code = 'soil_salinity' AND unit = 'dS/m') OR
          (metric_code = 'irrigation_mm' AND unit = 'mm')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_sensor_observations_numeric_range_check' AND conrelid = 'public.iot_sensor_observations'::regclass) THEN
      ALTER TABLE public.iot_sensor_observations ADD CONSTRAINT iot_sensor_observations_numeric_range_check CHECK (
          (metric_code = 'soil_temperature' AND numeric_value BETWEEN -50 AND 60) OR
          (metric_code = 'soil_ph' AND numeric_value BETWEEN 0 AND 14) OR
          (metric_code = 'soil_nitrogen' AND numeric_value >= 0) OR
          (metric_code = 'soil_phosphorus' AND numeric_value >= 0) OR
          (metric_code = 'soil_potassium' AND numeric_value >= 0) OR
          (metric_code = 'soil_salinity' AND numeric_value >= 0) OR
          (metric_code = 'irrigation_mm' AND numeric_value >= 0)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iot_sensor_observations_unique_reading' AND conrelid = 'public.iot_sensor_observations'::regclass) THEN
      ALTER TABLE public.iot_sensor_observations ADD CONSTRAINT iot_sensor_observations_unique_reading UNIQUE (device_id, metric_code, recorded_at);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_obs_stream ON public.iot_sensor_observations(stream_id);
CREATE INDEX IF NOT EXISTS idx_obs_device_metric ON public.iot_sensor_observations(device_id, metric_code, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_crop_time ON public.iot_sensor_observations(crop_allocation_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_farm_time ON public.iot_sensor_observations(farm_id, recorded_at DESC);

-- RLS Isolation
ALTER TABLE public.iot_sensor_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers can view own observations" ON public.iot_sensor_observations;
CREATE POLICY "Sellers can view own observations" ON public.iot_sensor_observations 
FOR SELECT USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())));

-- ==========================================
-- 5. DEVICE SECURITY TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION public.trg_protect_device_ingestion_mode()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.ingestion_mode != 'direct_device' THEN
      -- Restrict authenticated API users from setting simulator mode
      IF auth.role() IN ('authenticated', 'anon') THEN
          RAISE EXCEPTION 'Not authorized to set ingestion_mode on creation. Must be direct_device.';
      END IF;
  END IF;
  
  IF TG_OP = 'UPDATE' AND NEW.ingestion_mode IS DISTINCT FROM OLD.ingestion_mode THEN
      -- Restrict authenticated API users from changing mode
      IF auth.role() IN ('authenticated', 'anon') THEN
          RAISE EXCEPTION 'Not authorized to modify ingestion_mode.';
      END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_ingestion_mode_insert ON public.iot_devices;
CREATE TRIGGER enforce_ingestion_mode_insert
BEFORE INSERT ON public.iot_devices
FOR EACH ROW EXECUTE FUNCTION public.trg_protect_device_ingestion_mode();

DROP TRIGGER IF EXISTS enforce_ingestion_mode_update ON public.iot_devices;
CREATE TRIGGER enforce_ingestion_mode_update
BEFORE UPDATE ON public.iot_devices
FOR EACH ROW EXECUTE FUNCTION public.trg_protect_device_ingestion_mode();

COMMIT;

-- ==========================================
-- 6. VERIFICATION QUERIES
-- ==========================================
SELECT 'Table iot_sensor_observations exists' as check, COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'iot_sensor_observations';
SELECT 'Unique packet constraint exists' as check, COUNT(*) FROM pg_constraint WHERE conname = 'iot_sensor_streams_unique_packet';
SELECT 'Ingestion mode constraint exists' as check, COUNT(*) FROM pg_constraint WHERE conname = 'iot_devices_ingestion_mode_check';
SELECT 'Threshold constraints exist' as check, COUNT(*) FROM pg_constraint WHERE conname LIKE 'farm_crop_allocations_%_threshold_check';
SELECT 'Device triggers exist' as check, COUNT(*) FROM pg_trigger WHERE tgname IN ('enforce_ingestion_mode_insert', 'enforce_ingestion_mode_update');
ALTER TABLE farm_crop_allocations 
ADD COLUMN IF NOT EXISTS optimum_soil_moisture_min numeric,
ADD COLUMN IF NOT EXISTS optimum_soil_moisture_max numeric,
ADD COLUMN IF NOT EXISTS optimum_temperature_min numeric,
ADD COLUMN IF NOT EXISTS optimum_temperature_max numeric;

DROP FUNCTION IF EXISTS rpc_save_crop_allocation_draft;

CREATE OR REPLACE FUNCTION rpc_save_crop_allocation_draft(
    p_farm_id UUID,
    p_crop_type TEXT,
    p_land_size_value NUMERIC DEFAULT NULL,
    p_land_size_unit TEXT DEFAULT NULL,
    p_expected_harvest_min NUMERIC DEFAULT NULL,
    p_expected_harvest_max NUMERIC DEFAULT NULL,
    p_expected_harvest_unit TEXT DEFAULT 'kg',
    p_planting_date DATE DEFAULT NULL,
    p_expected_maturity_days INTEGER DEFAULT NULL,
    p_minimum_price_per_unit NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_optimum_soil_moisture_min NUMERIC DEFAULT NULL,
    p_optimum_soil_moisture_max NUMERIC DEFAULT NULL,
    p_optimum_temperature_min NUMERIC DEFAULT NULL,
    p_optimum_temperature_max NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_allocation_id UUID;
    v_seller_id UUID;
BEGIN
    SELECT user_id INTO v_seller_id FROM farms WHERE id = p_farm_id;
    IF v_seller_id IS NULL THEN
        RAISE EXCEPTION 'Farm not found';
    END IF;

    INSERT INTO farm_crop_allocations (
        farm_id,
        crop_type,
        land_size_value,
        land_size_unit,
        expected_harvest_min,
        expected_harvest_max,
        expected_harvest_unit,
        planting_date,
        expected_maturity_days,
        minimum_price_per_unit,
        notes,
        allocation_status,
        optimum_soil_moisture_min,
        optimum_soil_moisture_max,
        optimum_temperature_min,
        optimum_temperature_max
    ) VALUES (
        p_farm_id,
        p_crop_type,
        p_land_size_value,
        p_land_size_unit,
        p_expected_harvest_min,
        p_expected_harvest_max,
        p_expected_harvest_unit,
        p_planting_date,
        p_expected_maturity_days,
        p_minimum_price_per_unit,
        p_notes,
        'DRAFT',
        p_optimum_soil_moisture_min,
        p_optimum_soil_moisture_max,
        p_optimum_temperature_min,
        p_optimum_temperature_max
    ) RETURNING id INTO v_allocation_id;

    RETURN jsonb_build_object('id', v_allocation_id, 'status', 'DRAFT');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
BEGIN;

-- ============================================================================
-- 1. Close Crop Allocation Bidding RPC
-- ============================================================================
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


-- ============================================================================
-- 2. Archive Crop Allocation RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_archive_crop_allocation(
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
  v_blocking_predictions INT;
  v_blocking_bids INT;
  v_blocking_trades INT;
BEGIN
  -- Authenticate seller
  SELECT id INTO v_seller_profile_id
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated profile not found');
  END IF;

  -- Verify ownership and lock allocation
  SELECT user_id INTO v_allocation_owner_id
  FROM public.farm_crop_allocations
  WHERE id = p_crop_allocation_id FOR UPDATE;

  IF NOT FOUND OR v_allocation_owner_id != v_seller_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Allocation not found or unauthorized');
  END IF;

  -- Reject if OPEN prediction exists
  SELECT count(*) INTO v_blocking_predictions
  FROM public.harvest_predictions
  WHERE crop_allocation_id = p_crop_allocation_id
    AND bidding_status = 'OPEN';
    
  IF v_blocking_predictions > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot archive plot: Active marketplace listing exists. Close bidding first.');
  END IF;

  -- Reject if active bids exist on any prediction tied to this allocation
  SELECT count(*) INTO v_blocking_bids
  FROM public.harvest_bids hb
  JOIN public.harvest_predictions hp ON hp.id = hb.prediction_id
  WHERE hp.crop_allocation_id = p_crop_allocation_id
    AND hb.bid_status NOT IN ('REJECTED', 'CANCELLED');

  IF v_blocking_bids > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot archive plot: Active bids exist.');
  END IF;

  -- Reject if active trades exist on any prediction tied to this allocation
  SELECT count(*) INTO v_blocking_trades
  FROM public.trade_requests tr
  JOIN public.harvest_predictions hp ON hp.id = tr.harvest_prediction_id
  WHERE hp.crop_allocation_id = p_crop_allocation_id
    AND tr.request_status NOT IN ('CANCELLED', 'FULFILLED');

  IF v_blocking_trades > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot archive plot: Active trades exist.');
  END IF;

  -- Archive allocation (preserves predictions and historical readings)
  UPDATE public.farm_crop_allocations
  SET 
    allocation_status = 'ARCHIVED',
    updated_at = NOW()
  WHERE id = p_crop_allocation_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_archive_crop_allocation(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_archive_crop_allocation(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_archive_crop_allocation(UUID) TO authenticated;


-- ============================================================================
-- 3. Revised Archive Farm RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_archive_farm(
  p_farm_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_seller_profile_id UUID;
  v_farm_owner_id UUID;
  v_blocking_allocations INT;
  v_blocking_predictions INT;
  v_blocking_bids INT;
  v_blocking_trades INT;
BEGIN
  -- Authenticate seller
  SELECT id INTO v_seller_profile_id
  FROM public.users
  WHERE auth_uid = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated profile not found');
  END IF;

  -- Verify ownership and lock farm
  SELECT user_id INTO v_farm_owner_id
  FROM public.farms
  WHERE id = p_farm_id FOR UPDATE;

  IF NOT FOUND OR v_farm_owner_id != v_seller_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Farm not found or unauthorized');
  END IF;

  -- Reject if ACTIVE or BIDDING_OPEN allocations exist
  SELECT count(*) INTO v_blocking_allocations
  FROM public.farm_crop_allocations
  WHERE farm_id = p_farm_id
    AND allocation_status IN ('ACTIVE', 'BIDDING_OPEN');
    
  IF v_blocking_allocations > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot archive farm: Active crop plots exist. Archive them first.');
  END IF;

  -- Reject if OPEN prediction exists directly on farm
  SELECT count(*) INTO v_blocking_predictions
  FROM public.harvest_predictions
  WHERE farm_id = p_farm_id
    AND bidding_status = 'OPEN';
    
  IF v_blocking_predictions > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot archive farm: Active marketplace listing exists.');
  END IF;

  -- Reject if active bids exist directly on farm predictions
  SELECT count(*) INTO v_blocking_bids
  FROM public.harvest_bids hb
  JOIN public.harvest_predictions hp ON hp.id = hb.prediction_id
  WHERE hp.farm_id = p_farm_id
    AND hb.bid_status NOT IN ('REJECTED', 'CANCELLED');

  IF v_blocking_bids > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot archive farm: Active bids exist.');
  END IF;

  -- Reject if active trades exist directly on farm predictions
  SELECT count(*) INTO v_blocking_trades
  FROM public.trade_requests tr
  JOIN public.harvest_predictions hp ON hp.id = tr.harvest_prediction_id
  WHERE hp.farm_id = p_farm_id
    AND tr.request_status NOT IN ('CANCELLED', 'FULFILLED');

  IF v_blocking_trades > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot archive farm: Active trades exist.');
  END IF;

  -- Archive Farm
  UPDATE public.farms
  SET 
    farm_status = 'ARCHIVED',
    updated_at = NOW()
  WHERE id = p_farm_id;

  -- Retire active devices
  UPDATE public.iot_devices
  SET 
    device_status = 'RETIRED',
    updated_at = NOW()
  WHERE farm_id = p_farm_id
    AND device_status != 'RETIRED';

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_archive_farm(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_archive_farm(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_archive_farm(UUID) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Manual Execution Only)
-- ============================================================================
/*
-- 1. Verify that the RPCs were created successfully and have SECURITY DEFINER:
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN (
  'rpc_close_crop_allocation_bidding',
  'rpc_archive_crop_allocation',
  'rpc_archive_farm'
);

-- 2. Verify that PUBLIC and anon cannot execute these RPCs:
SELECT routine_name, grantee, privilege_type 
FROM information_schema.routine_privileges 
WHERE routine_name IN (
  'rpc_close_crop_allocation_bidding',
  'rpc_archive_crop_allocation',
  'rpc_archive_farm'
) AND grantee IN ('PUBLIC', 'anon');
-- (Should return 0 rows for these grantees)

-- 3. Verify that authenticated role CAN execute these RPCs:
SELECT routine_name, grantee, privilege_type 
FROM information_schema.routine_privileges 
WHERE routine_name IN (
  'rpc_close_crop_allocation_bidding',
  'rpc_archive_crop_allocation',
  'rpc_archive_farm'
) AND grantee = 'authenticated';
-- (Should return EXECUTE privilege for all three)
*/
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
BEGIN;

-- ============================================================================
-- 1. Harvest Prediction Evidence & Availability Tracking
-- ============================================================================
ALTER TABLE public.harvest_predictions 
  ADD COLUMN IF NOT EXISTS harvest_available_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS availability_source TEXT,
  ADD COLUMN IF NOT EXISTS availability_declared_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS evidence_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS harvest_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS evidence_verified_at TIMESTAMPTZ;

-- Dynamically discover and drop any existing check constraints on availability_source, then enforce strictly
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  FOR v_conname IN (
    SELECT conname 
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.harvest_predictions'::regclass
      AND a.attname = 'availability_source'
      AND c.contype = 'c'
  )
  LOOP
    EXECUTE 'ALTER TABLE public.harvest_predictions DROP CONSTRAINT ' || quote_ident(v_conname);
  END LOOP;
END $$;

ALTER TABLE public.harvest_predictions ADD CONSTRAINT harvest_predictions_avail_src_chk 
  CHECK (availability_source IN ('SELLER_DECLARATION', 'EXPECTED_DATE'));


-- ============================================================================
-- 2. Trade Requests Uniqueness
-- ============================================================================
ALTER TABLE public.trade_requests 
  ADD COLUMN IF NOT EXISTS harvest_bid_id UUID REFERENCES public.harvest_bids(id);

ALTER TABLE public.trade_requests DROP CONSTRAINT IF EXISTS unique_trade_per_bid;
ALTER TABLE public.trade_requests ADD CONSTRAINT unique_trade_per_bid UNIQUE (harvest_bid_id);


-- ============================================================================
-- 3. Negotiation Events CANCELLED Constraint 
-- ============================================================================
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  FOR v_conname IN (
    SELECT conname 
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.bid_negotiation_events'::regclass
      AND a.attname = 'event_type'
      AND c.contype = 'c'
  )
  LOOP
    EXECUTE 'ALTER TABLE public.bid_negotiation_events DROP CONSTRAINT ' || quote_ident(v_conname);
  END LOOP;
END $$;

-- Preserve every installed event type exactly and append CANCELLED natively
ALTER TABLE public.bid_negotiation_events ADD CONSTRAINT bid_negotiation_events_event_type_check 
  CHECK (event_type IN (
    'SUBMITTED', 'SELLER_COUNTERED', 'BUYER_COUNTERED', 
    'ACCEPTED', 'REJECTED', 'WITHDRAWN', 
    'READINESS_CONFIRMED', 'CONVERTED_TO_TRADE', 'EXPIRED', 
    'CANCELLED'
  ));

-- Do not drop unrelated check constraints. We preserve check_event_values exactly as it is.


-- ============================================================================
-- 4. Harvest Bids Cancellation Columns
-- ============================================================================
ALTER TABLE public.harvest_bids
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;


-- ============================================================================
-- 5. RPC: Authoritative Quantity Helper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_harvest_prediction_stats(p_prediction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected INTEGER;
  v_provisionally_allocated INTEGER;
  v_established INTEGER;
  v_pending INTEGER;
BEGIN
  SELECT expected_quantity_volume INTO v_expected
  FROM public.harvest_predictions WHERE id = p_prediction_id;

  SELECT COALESCE(SUM(COALESCE(final_accepted_quantity, accepted_quantity, desired_quantity)), 0)
  INTO v_provisionally_allocated
  FROM public.harvest_bids
  WHERE prediction_id = p_prediction_id AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED');

  SELECT COALESCE(SUM(COALESCE(final_accepted_quantity, accepted_quantity, desired_quantity)), 0)
  INTO v_established
  FROM public.harvest_bids
  WHERE prediction_id = p_prediction_id AND bid_status = 'CONVERTED_TO_TRADE';

  SELECT COALESCE(SUM(desired_quantity), 0)
  INTO v_pending
  FROM public.harvest_bids
  WHERE prediction_id = p_prediction_id AND bid_status IN ('PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED');

  RETURN jsonb_build_object(
    'listed_quantity', COALESCE(v_expected, 0),
    'provisionally_allocated', v_provisionally_allocated,
    'established_trade_quantity', v_established,
    'remaining_quantity', COALESCE(v_expected, 0) - v_provisionally_allocated - v_established,
    'pending_bid_quantity', v_pending
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_get_harvest_prediction_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_harvest_prediction_stats(UUID) TO authenticated;


-- ============================================================================
-- 6. RPC: Active Acceptance Replacement (rpc_accept_offer)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_accept_offer(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_prediction public.harvest_predictions%ROWTYPE;
  v_farm public.farms%ROWTYPE;
  v_latest_qty INTEGER;
  v_latest_price NUMERIC;
  v_accepted_total INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated'); END IF;

  SELECT hb.* INTO v_bid FROM public.harvest_bids hb WHERE hb.id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;

  SELECT hp.* INTO v_prediction FROM public.harvest_predictions hp WHERE hp.id = v_bid.prediction_id FOR UPDATE;
  
  SELECT f.* INTO v_farm FROM public.farms f WHERE f.id = v_prediction.farm_id;
  IF v_farm.user_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF v_bid.bid_status NOT IN ('PENDING', 'BUYER_COUNTERED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bid cannot be accepted in current state');
  END IF;

  -- 1. Use the latest valid negotiation-event price and quantity
  SELECT offered_quantity, offered_price_per_unit 
  INTO v_latest_qty, v_latest_price
  FROM public.bid_negotiation_events 
  WHERE bid_id = p_bid_id 
    AND event_type NOT IN ('REJECTED', 'WITHDRAWN', 'CANCELLED')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_latest_qty IS NULL OR v_latest_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid negotiation terms found');
  END IF;

  -- 2. Lock prediction and calculate remaining quantity to prevent overallocation
  SELECT COALESCE(SUM(COALESCE(final_accepted_quantity, accepted_quantity, desired_quantity)), 0)
  INTO v_accepted_total
  FROM public.harvest_bids
  WHERE prediction_id = v_prediction.id 
    AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE')
    AND id != p_bid_id;

  v_remaining := v_prediction.expected_quantity_volume - v_accepted_total;

  IF v_latest_qty > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acceptance exceeds remaining harvest quantity.');
  END IF;

  -- 3. Enforce all required writes exactly
  UPDATE public.harvest_bids
  SET bid_status = 'ACCEPTED',
      accepted_quantity = v_latest_qty, 
      final_accepted_quantity = v_latest_qty,
      final_accepted_price_per_unit = v_latest_price,
      final_total_value = v_latest_qty * v_latest_price,
      accepted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bid_id;

  INSERT INTO public.bid_negotiation_events (
      bid_id, actor_id, actor_role, event_type, 
      offered_price_per_unit, offered_quantity, message
  ) VALUES (
      p_bid_id, v_actor_id, 'SELLER', 'ACCEPTED', 
      v_latest_price, v_latest_qty, 'Offer accepted'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_accept_offer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_accept_offer(UUID) TO authenticated;


-- ============================================================================
-- 7. RPC: Declare Harvest Available
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_declare_harvest_available(p_prediction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction public.harvest_predictions%ROWTYPE;
  v_farm public.farms%ROWTYPE;
  v_actor_id UUID;
  v_has_bids BOOLEAN;
  v_buyer_rec RECORD;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated'); END IF;

  SELECT hp.* INTO v_prediction FROM public.harvest_predictions hp WHERE hp.id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Prediction not found'); END IF;

  SELECT f.* INTO v_farm FROM public.farms f WHERE f.id = v_prediction.farm_id;
  IF v_farm.user_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the farm owner can declare harvest available');
  END IF;

  IF v_prediction.harvest_available_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Harvest is already declared available.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.harvest_bids 
    WHERE prediction_id = p_prediction_id 
      AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
  ) INTO v_has_bids;

  IF NOT v_has_bids THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot declare harvest: no accepted provisional agreements exist.');
  END IF;

  -- Unlock the evidence stage
  UPDATE public.harvest_predictions
  SET harvest_available_at = NOW(),
      availability_source = 'SELLER_DECLARATION',
      availability_declared_by = v_actor_id,
      evidence_status = 'pending',
      updated_at = NOW()
  WHERE id = p_prediction_id;

  -- Explicit participant notifications using strict exact installed columns
  FOR v_buyer_rec IN (
    SELECT DISTINCT buyer_id FROM public.harvest_bids 
    WHERE prediction_id = p_prediction_id AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
  ) LOOP
    INSERT INTO public.notifications (recipient_id, actor_id, prediction_id, event_type, message)
    VALUES (
      v_buyer_rec.buyer_id, 
      v_actor_id, 
      p_prediction_id, 
      'HARVEST_AVAILABLE', 
      'The seller has declared harvest availability and is preparing evidence.'
    );
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_declare_harvest_available(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_declare_harvest_available(UUID) TO authenticated;


-- ============================================================================
-- 8. RPC: Progress Provisional Agreements (Establish Trades)
-- ============================================================================
-- Must be invoked by the evidence operation itself to create trades.
CREATE OR REPLACE FUNCTION public.rpc_progress_provisional_agreements(p_prediction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction public.harvest_predictions%ROWTYPE;
  v_farm public.farms%ROWTYPE;
  v_bid public.harvest_bids%ROWTYPE;
  v_crop_type TEXT;
  v_trade_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT hp.* INTO v_prediction FROM public.harvest_predictions hp WHERE hp.id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Prediction not found'); END IF;

  -- Ensure evidence has been provided and verified before creating ANY trade
  IF v_prediction.evidence_status != 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot progress trades: Harvest evidence has not been verified yet.');
  END IF;

  SELECT f.* INTO v_farm FROM public.farms f WHERE f.id = v_prediction.farm_id;
  
  -- Extract authoritative crop_type from the verified linked crop allocation
  SELECT crop_type INTO v_crop_type 
  FROM public.farm_crop_allocations 
  WHERE id = v_prediction.crop_allocation_id;

  FOR v_bid IN
    SELECT * FROM public.harvest_bids 
    WHERE prediction_id = p_prediction_id 
    AND bid_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED')
    FOR UPDATE
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.trade_requests WHERE harvest_bid_id = v_bid.id FOR SHARE) THEN
      
      -- We safely establish exactly one trade per bid, strictly matching the live trade_requests table.
      INSERT INTO public.trade_requests (
        harvest_prediction_id,
        user_id,
        buyer_id,
        commodity_variety,
        quantity,
        request_status,
        evidence_status,
        harvest_bid_id,
        harvest_photo_url
      ) VALUES (
        p_prediction_id,
        v_farm.user_id,
        v_bid.buyer_id,
        v_crop_type,
        COALESCE(v_bid.final_accepted_quantity, v_bid.accepted_quantity, v_bid.desired_quantity),
        'SEARCHING_LOGISTICS',
        'provided', 
        v_bid.id,
        v_prediction.harvest_photo_url
      ) RETURNING id INTO v_trade_id;

      UPDATE public.harvest_bids
      SET bid_status = 'CONVERTED_TO_TRADE',
          updated_at = NOW()
      WHERE id = v_bid.id;

      -- Explicit Notification
      INSERT INTO public.notifications (recipient_id, trade_id, event_type, message)
      VALUES (
        v_bid.buyer_id, 
        v_trade_id, 
        'TRADE_ESTABLISHED', 
        'Harvest evidence was verified and your trade is now active for logistics.'
      );
      
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'trades_created', v_count);
END;
$$;
-- This function is restricted. We grant to service_role, but it will be executed internally by rpc_upload_prediction_evidence which runs as SECURITY DEFINER.
REVOKE ALL ON FUNCTION public.rpc_progress_provisional_agreements(UUID) FROM PUBLIC;


-- ============================================================================
-- 9. RPC: Secure Camera Capture & Evidence Verification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_upload_prediction_evidence(p_prediction_id UUID, p_photo_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction public.harvest_predictions%ROWTYPE;
  v_farm public.farms%ROWTYPE;
  v_actor_id UUID;
  v_file_path TEXT;
  v_is_valid BOOLEAN;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated'); END IF;

  SELECT hp.* INTO v_prediction FROM public.harvest_predictions hp WHERE hp.id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Prediction not found'); END IF;

  SELECT f.* INTO v_farm FROM public.farms f WHERE f.id = v_prediction.farm_id;
  IF v_farm.user_id != v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the farm owner can upload evidence');
  END IF;

  IF v_prediction.harvest_available_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Harvest must be declared available before uploading evidence');
  END IF;

  IF v_prediction.evidence_status = 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evidence is already verified');
  END IF;

  -- Verify the file securely against the storage.objects table rather than blindly trusting the caller URL
  v_file_path := substring(p_photo_url from '/harvest-photos/(.*)$');
  IF v_file_path IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid photo URL format. Must be a secure harvest-photos storage URL.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'harvest-photos' 
      AND name = v_file_path
  ) INTO v_is_valid;

  IF NOT v_is_valid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evidence verification failed: Photo not found in secure storage bucket.');
  END IF;

  -- Evidence passes the established verification requirement
  UPDATE public.harvest_predictions
  SET harvest_photo_url = p_photo_url,
      evidence_status = 'verified',
      evidence_verified_at = NOW(),
      updated_at = NOW()
  WHERE id = p_prediction_id;

  -- The evidence operation immediately invokes progression (establishing exactly one trade per bid)
  PERFORM public.rpc_progress_provisional_agreements(p_prediction_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_upload_prediction_evidence(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_upload_prediction_evidence(UUID, TEXT) TO authenticated;


-- ============================================================================
-- 10. RPC: Cancel Provisional Agreement 
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_cancel_provisional_agreement(
    p_bid_id UUID,
    p_reason TEXT DEFAULT 'No reason provided'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_bid public.harvest_bids%ROWTYPE;
  v_farm_owner UUID;
  v_is_seller BOOLEAN;
  v_is_buyer BOOLEAN;
  v_actor_role TEXT;
  v_final_qty INTEGER;
  v_final_price NUMERIC;
  v_notify_id UUID;
BEGIN
  SELECT id INTO v_actor_id FROM public.users WHERE auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated'); END IF;

  SELECT hb.* INTO v_bid FROM public.harvest_bids hb WHERE hb.id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;

  IF v_bid.bid_status NOT IN ('ACCEPTED', 'PARTIALLY_ACCEPTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only accepted provisional agreements can be cancelled');
  END IF;

  SELECT f.user_id INTO v_farm_owner FROM public.harvest_predictions hp JOIN public.farms f ON f.id = hp.farm_id WHERE hp.id = v_bid.prediction_id;

  v_is_seller := (v_farm_owner = v_actor_id);
  v_is_buyer := (v_bid.buyer_id = v_actor_id);

  IF NOT (v_is_seller OR v_is_buyer) THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); END IF;
  IF v_is_seller THEN v_actor_role := 'SELLER'; v_notify_id := v_bid.buyer_id; ELSE v_actor_role := 'BUYER'; v_notify_id := v_farm_owner; END IF;

  v_final_qty := COALESCE(v_bid.final_accepted_quantity, v_bid.accepted_quantity, v_bid.desired_quantity);
  v_final_price := COALESCE(v_bid.final_accepted_price_per_unit, v_bid.offered_price_per_unit);

  INSERT INTO public.bid_negotiation_events (
      bid_id, actor_id, actor_role, event_type, 
      offered_price_per_unit, offered_quantity, message
  ) VALUES (
      p_bid_id, v_actor_id, v_actor_role, 'CANCELLED', 
      v_final_price, v_final_qty, p_reason
  );

  UPDATE public.harvest_bids 
  SET bid_status = 'CANCELLED',
      final_accepted_quantity = NULL,
      final_accepted_price_per_unit = NULL,
      final_total_value = NULL,
      accepted_quantity = NULL, 
      cancelled_by = v_actor_id,
      cancellation_reason = p_reason,
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bid_id;

  INSERT INTO public.notifications (recipient_id, actor_id, bid_id, event_type, message)
  VALUES (
    v_notify_id, 
    v_actor_id, 
    p_bid_id, 
    'AGREEMENT_CANCELLED', 
    'The other party cancelled a provisional agreement. Reason: ' || p_reason
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_cancel_provisional_agreement(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_provisional_agreement(UUID, TEXT) TO authenticated;


-- ============================================================================
-- 11. RPC: Automated Expected-Date Processor (Internal / Scheduler Safe)
-- ============================================================================
-- NOTE: Automation remains inactive until a service_role scheduler (e.g. pg_cron) is configured.
CREATE OR REPLACE FUNCTION public.rpc_auto_progress_harvests()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prediction public.harvest_predictions%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  FOR v_prediction IN
    SELECT * FROM public.harvest_predictions
    WHERE seller_maturity_at <= NOW()
      AND harvest_available_at IS NULL
      AND bidding_status != 'CLOSED'
  LOOP
    UPDATE public.harvest_predictions
    SET harvest_available_at = NOW(),
        availability_source = 'EXPECTED_DATE',
        evidence_status = 'pending',
        updated_at = NOW()
    WHERE id = v_prediction.id;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'predictions_processed', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_auto_progress_harvests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_auto_progress_harvests() TO service_role;

COMMIT;
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
