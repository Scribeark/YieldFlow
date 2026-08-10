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
