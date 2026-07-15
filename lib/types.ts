// ============================================
// Agri-Data Hub / YieldFlow — Real Schema Types
// ============================================

export type UserRole = 'farmer' | 'trader' | 'carrier' | 'buyer' | 'admin' | string;

export type TradeStatus = 'pending' | 'matched' | 'in_transit' | 'completed' | string;
export type HarvestStatus = TradeStatus;

export type VehicleStatus = 'available' | 'busy' | 'offline' | string;

export interface UserProfile {
  id: string; // Postgres UUID (auto-generated independently of auth_uid)
  auth_uid?: string | null; // Links to Supabase Auth session UID
  full_name: string;
  phone_number?: string | null;
  age?: number | null;
  gender?: string | null;
  declared_profession: UserRole;
  role?: UserRole; // legacy alias
  macro_region?: string | null;
  verification_status?: string | null;
  business_latitude?: number | null;
  business_longitude?: number | null;
  has_registered_device?: boolean | null;
  created_at?: string;
}

export interface TradeRequest {
  id: string;
  user_id?: string | null; // FK to users.id
  owner_id?: string | null; // alternative FK column
  farmer_id?: string | null; // legacy alias
  commodity_variety: string;
  crop_type?: string; // legacy alias
  quantity: number;
  quantity_kg?: number; // legacy alias
  address?: string | null;
  farm_location?: string; // legacy alias
  harvest_photo_url?: string | null;
  status?: TradeStatus;
  created_at?: string;
  // Joined or enriched fields
  users?: UserProfile | null;
}

export type HarvestLog = TradeRequest;

export interface IoTTelemetryLog {
  id: string;
  owner_id?: string | null; // FK to users.id
  soil_moisture_percentage: number;
  temperature?: number | null;
  humidity?: number | null;
  associated_lga?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  recorded_at?: string;
  created_at?: string;
}

export interface VehicleState {
  id: string;
  carrier_id: string; // FK to users.id or auth_uid
  carrier_status: VehicleStatus;
  vehicle_type?: string | null;
  vehicle_photo_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  created_at?: string;
}

export interface LogisticsBooking {
  id: string;
  trade_request_id?: string | null;
  harvest_id?: string | null; // legacy fallback
  carrier_id: string;
  pickup_time?: string | null;
  delivery_time?: string | null;
  status: TradeStatus;
  created_at?: string;
  trade_requests?: TradeRequest | null;
  users?: UserProfile | null;
}

// Phone normalization utility matching Africa's Talking E.164 canonical format
export function normalizeNigerianPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (cleaned.startsWith('+234')) return cleaned;
  if (cleaned.startsWith('234')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+234' + cleaned.substring(1);
  return cleaned;
}

// Analytics and Marketplace types
export interface ReadyFarmSummary {
  owner_id: string;
  commodity_variety: string;
  region: string;
  readiness_status: string;
  soil_moisture_percentage: number;
  recorded_at?: string;
}

export interface VolumeDataPoint {
  date: string;
  total_kg: number;
  commodity?: string;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface EnvironmentalAverage {
  location: string;
  avg_moisture: number;
  avg_temperature: number;
}
