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
