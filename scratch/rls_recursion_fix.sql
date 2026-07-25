-- =====================================================================
-- RLS RECURSION FIX PATCH
-- File: rls_recursion_fix.sql
-- =====================================================================

-- 1. DROP THE RECURSIVE POLICIES
DROP POLICY IF EXISTS "Sellers can read bookings for own trades" ON public.logistics_bookings;
DROP POLICY IF EXISTS "Buyers can read bookings for own trades" ON public.logistics_bookings;
DROP POLICY IF EXISTS "Carriers can read trade requests for own bookings" ON public.trade_requests;


-- 2. CREATE SECURITY DEFINER HELPER FOR CURRENT APP USER
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.users WHERE auth_uid = auth.uid() LIMIT 1;
$$;


-- 3. CREATE SECURITY DEFINER HELPER FOR READING LOGISTICS_BOOKINGS
CREATE OR REPLACE FUNCTION public.can_read_logistics_booking(
  p_trade_request_id uuid,
  p_carrier_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_is_owner boolean;
BEGIN
  v_user_id := public.current_app_user_id();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Carrier matches
  IF v_user_id = p_carrier_id THEN
    RETURN true;
  END IF;

  -- Seller or Buyer matches on trade_request
  SELECT EXISTS (
    SELECT 1 FROM public.trade_requests 
    WHERE id = p_trade_request_id 
    AND (user_id = v_user_id OR buyer_id = v_user_id)
  ) INTO v_is_owner;

  RETURN v_is_owner;
END;
$$;


-- 4. CREATE SECURITY DEFINER HELPER FOR CARRIER READING TRADE_REQUESTS
CREATE OR REPLACE FUNCTION public.can_carrier_read_trade_request(
  p_trade_request_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_is_carrier boolean;
BEGIN
  v_user_id := public.current_app_user_id();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- User is a carrier on a booking linked to this trade request
  SELECT EXISTS (
    SELECT 1 FROM public.logistics_bookings 
    WHERE trade_request_id = p_trade_request_id 
    AND carrier_id = v_user_id
  ) INTO v_is_carrier;

  RETURN v_is_carrier;
END;
$$;


-- 5. RECREATE NON-RECURSIVE POLICIES

-- For logistics_bookings:
CREATE POLICY "Users can read relevant logistics bookings"
ON public.logistics_bookings
FOR SELECT
USING (
  public.can_read_logistics_booking(trade_request_id, carrier_id)
);

-- For trade_requests (carrier access):
CREATE POLICY "Carriers can read assigned trade requests"
ON public.trade_requests
FOR SELECT
USING (
  public.can_carrier_read_trade_request(id)
);


-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Verify Policies on logistics_bookings
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'logistics_bookings';

-- Verify Policies on trade_requests
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'trade_requests'
AND policyname = 'Carriers can read assigned trade requests';

-- Verify Helper Functions Security Definer Status
SELECT p.proname, p.prosecdef, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN ('current_app_user_id', 'can_read_logistics_booking', 'can_carrier_read_trade_request');

-- =====================================================================
-- MANUAL TEST QUERIES
-- Replace '<YOUR_AUTH_UID>' with a valid user's auth.uid() to test
-- =====================================================================
/*
-- 1. Test as a seller or buyer reading logistics_bookings
SET request.jwt.claim.sub = '<SELLER_AUTH_UID>';
SELECT * FROM public.logistics_bookings;

-- 2. Test as a carrier reading trade_requests
SET request.jwt.claim.sub = '<CARRIER_AUTH_UID>';
SELECT * FROM public.trade_requests;
*/
