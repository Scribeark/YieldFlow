export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_uid: string | null
          full_name: string
          phone_number: string
          declared_profession: 'Smallholder Farmer' | 'Commodity Trader' | 'Logistics Carrier' | 'Enterprise Buyer'
          age: number
          gender: string
          macro_region: string
          has_registered_device: boolean
          verification_status: string
          business_latitude: number | null
          business_longitude: number | null
          created_at: string
        }
        Insert: {
          id?: string
          auth_uid?: string | null
          full_name: string
          phone_number: string
          declared_profession: 'Smallholder Farmer' | 'Commodity Trader' | 'Logistics Carrier' | 'Enterprise Buyer'
          age: number
          gender: string
          macro_region: string
          has_registered_device?: boolean
          verification_status?: string
          business_latitude?: number | null
          business_longitude?: number | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      trade_requests: {
        Row: {
          id: string
          user_id: string
          buyer_id: string | null
          commodity_variety: string
          quantity_volume: number
          physical_address: string
          computed_latitude: number
          computed_longitude: number
          harvest_photo_url: string | null
          payment_status: string
          payment_reference: string
          payment_gateway: string
          request_status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          buyer_id?: string | null
          commodity_variety: string
          quantity_volume: number
          physical_address: string
          computed_latitude: number
          computed_longitude: number
          harvest_photo_url?: string | null
          payment_status?: string
          payment_reference: string
          payment_gateway?: string
          request_status?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['trade_requests']['Insert']>
      }
      vehicle_states: {
        Row: {
          id: string
          carrier_id: string
          payload_capacity_baskets: number
          current_latitude: number
          current_longitude: number
          carrier_status: 'available' | 'busy' | 'offline'
          vehicle_type: 'Motorcycle' | 'Tricycle' | 'Van' | 'Pickup Truck' | 'Truck'
          plate_number: string
          vehicle_nickname: string
          vehicle_photo_url: string
          updated_at: string
        }
        Insert: {
          id?: string
          carrier_id: string
          payload_capacity_baskets: number
          current_latitude: number
          current_longitude: number
          carrier_status?: 'available' | 'busy' | 'offline'
          vehicle_type: 'Motorcycle' | 'Tricycle' | 'Van' | 'Pickup Truck' | 'Truck'
          plate_number: string
          vehicle_nickname: string
          vehicle_photo_url: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['vehicle_states']['Insert']>
      }
      logistics_bookings: {
        Row: {
          id: string
          trade_request_id: string
          carrier_id: string
          carrier_name: string
          carrier_phone: string
          proximity_distance_km: number
          escrow_status: string
          dispatched_at: string | null
        }
        Insert: {
          id?: string
          trade_request_id: string
          carrier_id: string
          carrier_name: string
          carrier_phone: string
          proximity_distance_km: number
          escrow_status?: string
          dispatched_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['logistics_bookings']['Insert']>
      }
      iot_telemetry_logs: {
        Row: {
          id: string
          owner_id: string | null
          associated_lga: string
          soil_moisture_percentage: number
          ambient_temperature_celsius: number
          relative_humidity_percentage: number
          latitude: number
          longitude: number
          ingested_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          associated_lga: string
          soil_moisture_percentage: number
          ambient_temperature_celsius: number
          relative_humidity_percentage: number
          latitude: number
          longitude: number
          ingested_at?: string
        }
        Update: Partial<Database['public']['Tables']['iot_telemetry_logs']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
