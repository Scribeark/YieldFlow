export const ROLES = {
  FARMER: 'Smallholder Farmer',
  TRADER: 'Commodity Trader',
  CARRIER: 'Logistics Carrier',
  BUYER: 'Commercial Buyer',
  LEGACY_BUYER: 'Enterprise Buyer'
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ROLE_ROUTES: Record<string, string> = {
  [ROLES.FARMER]: '/dashboard/seller',
  [ROLES.TRADER]: '/dashboard/seller',
  [ROLES.CARRIER]: '/dashboard/carrier',
  [ROLES.BUYER]: '/dashboard/buyer',
  [ROLES.LEGACY_BUYER]: '/dashboard/buyer'
};
