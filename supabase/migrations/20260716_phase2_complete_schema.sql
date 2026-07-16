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
