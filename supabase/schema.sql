-- ============================================
-- Agri-Data Hub — Database Schema
-- Run this script in your Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Custom Enum Types
-- ============================================

CREATE TYPE user_role AS ENUM ('farmer', 'carrier', 'admin');
CREATE TYPE harvest_status AS ENUM ('pending', 'matched', 'in_transit', 'completed');

-- ============================================
-- 2. Users Table
-- ============================================

CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  role user_role NOT NULL DEFAULT 'farmer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for phone number lookups (used by USSD webhook)
CREATE INDEX idx_users_phone ON public.users(phone_number);
CREATE INDEX idx_users_role ON public.users(role);

-- ============================================
-- 3. Harvest Logs Table
-- ============================================

CREATE TABLE public.harvest_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  crop_type TEXT NOT NULL,
  quantity_kg NUMERIC(10, 2) NOT NULL CHECK (quantity_kg > 0),
  farm_location TEXT NOT NULL,
  status harvest_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_harvest_farmer ON public.harvest_logs(farmer_id);
CREATE INDEX idx_harvest_status ON public.harvest_logs(status);
CREATE INDEX idx_harvest_created ON public.harvest_logs(created_at DESC);

-- ============================================
-- 4. Logistics Bookings Table
-- ============================================

CREATE TABLE public.logistics_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  harvest_id UUID NOT NULL REFERENCES public.harvest_logs(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pickup_time TIMESTAMPTZ,
  delivery_time TIMESTAMPTZ,
  status harvest_status NOT NULL DEFAULT 'matched',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_carrier ON public.logistics_bookings(carrier_id);
CREATE INDEX idx_bookings_harvest ON public.logistics_bookings(harvest_id);
CREATE INDEX idx_bookings_status ON public.logistics_bookings(status);

-- ============================================
-- 5. IoT Telemetry Logs Table
-- ============================================

CREATE TABLE public.iot_telemetry_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  soil_moisture NUMERIC(5, 2) NOT NULL,
  temperature NUMERIC(5, 2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telemetry_farmer ON public.iot_telemetry_logs(farmer_id);
CREATE INDEX idx_telemetry_recorded ON public.iot_telemetry_logs(recorded_at DESC);

-- ============================================
-- 6. Enable Row Level Security on All Tables
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_telemetry_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. RLS Policies — Users Table
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Allow inserts during signup (service role or authenticated)
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 8. RLS Policies — Harvest Logs Table
-- ============================================

-- Farmers can read their own harvest logs
CREATE POLICY "Farmers can read own harvest logs"
  ON public.harvest_logs FOR SELECT
  USING (auth.uid() = farmer_id);

-- Farmers can insert their own harvest logs
CREATE POLICY "Farmers can insert own harvest logs"
  ON public.harvest_logs FOR INSERT
  WITH CHECK (auth.uid() = farmer_id);

-- Farmers can update their own harvest logs
CREATE POLICY "Farmers can update own harvest logs"
  ON public.harvest_logs FOR UPDATE
  USING (auth.uid() = farmer_id);

-- Carriers can view all pending harvest logs
CREATE POLICY "Carriers can view pending harvests"
  ON public.harvest_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'carrier'
    )
    AND status = 'pending'
  );

-- Carriers can view harvests they've been matched with
CREATE POLICY "Carriers can view matched harvests"
  ON public.harvest_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.logistics_bookings
      WHERE harvest_id = harvest_logs.id AND carrier_id = auth.uid()
    )
  );

-- Carriers can update harvest status (for matched harvests only)
CREATE POLICY "Carriers can update matched harvest status"
  ON public.harvest_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.logistics_bookings
      WHERE harvest_id = harvest_logs.id AND carrier_id = auth.uid()
    )
  );

-- Admins have full read access to harvest logs
CREATE POLICY "Admins can read all harvest logs"
  ON public.harvest_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 9. RLS Policies — Logistics Bookings Table
-- ============================================

-- Carriers can insert bookings (claim loads)
CREATE POLICY "Carriers can insert bookings"
  ON public.logistics_bookings FOR INSERT
  WITH CHECK (
    auth.uid() = carrier_id
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'carrier'
    )
  );

-- Carriers can read their own bookings
CREATE POLICY "Carriers can read own bookings"
  ON public.logistics_bookings FOR SELECT
  USING (auth.uid() = carrier_id);

-- Carriers can update their own bookings
CREATE POLICY "Carriers can update own bookings"
  ON public.logistics_bookings FOR UPDATE
  USING (auth.uid() = carrier_id);

-- Farmers can read bookings for their harvests
CREATE POLICY "Farmers can read bookings for own harvests"
  ON public.logistics_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.harvest_logs
      WHERE id = logistics_bookings.harvest_id AND farmer_id = auth.uid()
    )
  );

-- Admins have full read access to logistics bookings
CREATE POLICY "Admins can read all bookings"
  ON public.logistics_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 10. RLS Policies — IoT Telemetry Logs Table
-- ============================================

-- Farmers can read their own telemetry
CREATE POLICY "Farmers can read own telemetry"
  ON public.iot_telemetry_logs FOR SELECT
  USING (auth.uid() = farmer_id);

-- Farmers can insert their own telemetry
CREATE POLICY "Farmers can insert own telemetry"
  ON public.iot_telemetry_logs FOR INSERT
  WITH CHECK (auth.uid() = farmer_id);

-- Admins have full read access to telemetry
CREATE POLICY "Admins can read all telemetry"
  ON public.iot_telemetry_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 11. Enable Realtime on Key Tables
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.harvest_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_telemetry_logs;

-- ============================================
-- 12. Trigger: Auto-create user profile on signup
-- (This creates a row in public.users when
--  a new user signs up via Supabase Auth)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, phone_number, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone_number', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'farmer')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
