-- Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_declared_profession_check;

-- Add the new constraint with Commercial Buyer replacing Enterprise Buyer
ALTER TABLE public.users ADD CONSTRAINT users_declared_profession_check CHECK (
  (declared_profession)::text = ANY (ARRAY[
    ('Smallholder Farmer'::character varying)::text,
    ('Commodity Trader'::character varying)::text,
    ('Logistics Carrier'::character varying)::text,
    ('Commercial Buyer'::character varying)::text,
    ('Enterprise Buyer'::character varying)::text -- Keep for backward compatibility during active sessions
  ])
);

-- Update existing Enterprise Buyer rows to Commercial Buyer
UPDATE public.users SET declared_profession = 'Commercial Buyer' WHERE declared_profession = 'Enterprise Buyer';
