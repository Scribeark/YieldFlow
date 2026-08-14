-- 20260814194500_fix_v8_seller_bids_rls.sql

-- 1. Enable RLS on harvest_bids and bid_negotiation_events
ALTER TABLE public.harvest_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_negotiation_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies on harvest_bids to avoid conflicts
DROP POLICY IF EXISTS "Sellers can view bids on own predictions" ON public.harvest_bids;
DROP POLICY IF EXISTS "Buyers can view own bids" ON public.harvest_bids;
DROP POLICY IF EXISTS "Sellers can view bids on own bulk offtake listings" ON public.harvest_bids;
DROP POLICY IF EXISTS "harvest_bids_select_policy" ON public.harvest_bids;

-- 3. Create unified SELECT policy on harvest_bids for both Buyers and Sellers (V8 + Legacy)
CREATE POLICY "harvest_bids_select_policy" ON public.harvest_bids
FOR SELECT TO authenticated
USING (
  -- A. Buyer who placed the bid
  buyer_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  OR
  -- B. Seller who owns the V8 bulk offtake listing
  bulk_offtake_listing_id IN (
    SELECT id FROM public.bulk_offtake_listings 
    WHERE seller_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  )
  OR
  -- C. Seller who owns the legacy harvest prediction farm
  prediction_id IN (
    SELECT id FROM public.harvest_predictions 
    WHERE farm_id IN (
      SELECT id FROM public.farms 
      WHERE user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
    )
  )
);

-- 4. Drop existing restrictive policies on bid_negotiation_events
DROP POLICY IF EXISTS "Participants can view their negotiation events" ON public.bid_negotiation_events;
DROP POLICY IF EXISTS "bid_negotiation_events_select_policy" ON public.bid_negotiation_events;

-- 5. Create unified SELECT policy on bid_negotiation_events for participants (V8 + Legacy)
CREATE POLICY "bid_negotiation_events_select_policy" ON public.bid_negotiation_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.harvest_bids hb
    LEFT JOIN public.bulk_offtake_listings bol ON bol.id = hb.bulk_offtake_listing_id
    LEFT JOIN public.harvest_predictions hp ON hp.id = hb.prediction_id
    LEFT JOIN public.farms f ON f.id = hp.farm_id
    WHERE hb.id = bid_negotiation_events.bid_id
      AND (
        hb.buyer_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
        OR bol.seller_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
        OR f.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
      )
  )
);

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
