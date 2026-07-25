-- =====================================================================
-- FIX LOGISTICS CARRIER RLS POLICIES FOR TRADE REQUESTS
-- File: carrier_rls_patch.sql
-- =====================================================================

DROP POLICY IF EXISTS "Carriers can read trade requests for own bookings" ON public.trade_requests;

CREATE POLICY "Carriers can read trade requests for own bookings"
ON public.trade_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.logistics_bookings lb
    JOIN public.users u
      ON u.id = lb.carrier_id
    WHERE lb.trade_request_id = trade_requests.id
      AND u.auth_uid = auth.uid()
  )
);

-- =====================================================================
-- VERIFICATION
-- =====================================================================
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'trade_requests'
  AND policyname = 'Carriers can read trade requests for own bookings';
