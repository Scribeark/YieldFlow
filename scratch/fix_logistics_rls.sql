-- =====================================================================
-- FIX LOGISTICS BOOKINGS RLS POLICIES
-- File: fix_logistics_rls.sql
-- 
-- Root Cause Fix: The old policies referenced 'harvest_logs' which is 
-- no longer used, causing Supabase to silently return 0 rows for logistics_bookings
-- to both sellers and buyers. This patch drops the old policy and adds 
-- correct read/update policies mapping to 'trade_requests'.
-- =====================================================================

-- 1. Drop the outdated Farmer policy that relied on harvest_logs
DROP POLICY IF EXISTS "Farmers can read bookings for own harvests" ON public.logistics_bookings;
DROP POLICY IF EXISTS "Sellers can read bookings for own trades" ON public.logistics_bookings;
DROP POLICY IF EXISTS "Buyers can read bookings for own trades" ON public.logistics_bookings;

-- 2. Create the correct Seller Policy (read access)
CREATE POLICY "Sellers can read bookings for own trades"
  ON public.logistics_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_requests
      WHERE id = logistics_bookings.trade_request_id 
        AND user_id = public.get_current_user_id()
    )
  );

-- 3. Create the correct Buyer Policy (read access)
CREATE POLICY "Buyers can read bookings for own trades"
  ON public.logistics_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_requests
      WHERE id = logistics_bookings.trade_request_id 
        AND buyer_id = public.get_current_user_id()
    )
  );

-- =====================================================================
-- VERIFICATION
-- =====================================================================
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'logistics_bookings'
  AND policyname IN ('Sellers can read bookings for own trades', 'Buyers can read bookings for own trades');
