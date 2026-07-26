BEGIN;

ALTER TABLE public.logistics_bookings
DROP CONSTRAINT IF EXISTS logistics_bookings_trade_request_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_logistics_bookings_one_active_per_trade
ON public.logistics_bookings (trade_request_id)
WHERE status = 'active';

COMMIT;
