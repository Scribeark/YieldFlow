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
        Relationships: []
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
          submission_channel: string
          evidence_status: string
          interested_buyer_id: string | null
          evidence_requested_at: string | null
          buyer_demand_id: string | null
          evidence_exemption_reason: string | null
          evidence_exempted_at: string | null
          cancelled_by: string | null
          cancellation_reason: string | null
          cancellation_note: string | null
          cancelled_at: string | null
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
          submission_channel?: string
          evidence_status?: string
          interested_buyer_id?: string | null
          evidence_requested_at?: string | null
          buyer_demand_id?: string | null
          evidence_exemption_reason?: string | null
          evidence_exempted_at?: string | null
          cancelled_by?: string | null
          cancellation_reason?: string | null
          cancellation_note?: string | null
          cancelled_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['trade_requests']['Insert']>
        Relationships: []
      }
      buyer_demands: {
        Row: {
          id: string
          buyer_id: string
          commodity_variety: string
          quantity_volume: number
          delivery_address: string
          computed_latitude: number | null
          computed_longitude: number | null
          demand_status: string
          created_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          commodity_variety: string
          quantity_volume: number
          delivery_address: string
          computed_latitude?: number | null
          computed_longitude?: number | null
          demand_status?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['buyer_demands']['Insert']>
        Relationships: []
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
          vehicle_document_url: string | null
          vehicle_license_expires_at: string | null
          vehicle_verification_status: string
          vehicle_verified_at: string | null
          vehicle_rejection_reason: string | null
          updated_at: string
          is_active: boolean
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
          vehicle_document_url?: string | null
          vehicle_license_expires_at?: string | null
          vehicle_verification_status?: string
          vehicle_verified_at?: string | null
          vehicle_rejection_reason?: string | null
          updated_at?: string
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['vehicle_states']['Insert']>
        Relationships: []
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
          status: 'active' | 'released' | 'cancelled' | 'completed'
          vehicle_state_id: string | null
          seller_pickup_confirmed_at: string | null
          carrier_pickup_confirmed_at: string | null
          carrier_delivery_confirmed_at: string | null
          buyer_delivery_confirmed_at: string | null
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
          status?: 'active' | 'released' | 'cancelled' | 'completed'
          vehicle_state_id?: string | null
          seller_pickup_confirmed_at?: string | null
          carrier_pickup_confirmed_at?: string | null
          carrier_delivery_confirmed_at?: string | null
          buyer_delivery_confirmed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['logistics_bookings']['Insert']>
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rpc_request_evidence: {
        Args: { req_id: string }
        Returns: void
      }
      rpc_confirm_order: {
        Args: { req_id: string }
        Returns: void
      }
      rpc_upload_evidence: {
        Args: { req_id: string, photo_url: string }
        Returns: void
      }
      rpc_claim_logistics_job: {
        Args: {
          p_trade_request_id: string
          p_vehicle_state_id: string
          p_proximity_distance_km: number
        }
        Returns: void
      }
      rpc_release_logistics_booking: {
        Args: { p_trade_request_id: string }
        Returns: void
      }
      rpc_cancel_buyer_claim: {
        Args: { p_trade_request_id: string }
        Returns: void
      }
      rpc_cancel_seller_trade_request: {
        Args: { 
          p_trade_request_id: string
          p_cancellation_reason: string
          p_cancellation_note: string | null
        }
        Returns: void
      }
      rpc_cancel_buyer_demand: {
        Args: { p_demand_id: string }
        Returns: void
      }
      rpc_deactivate_vehicle: {
        Args: { p_vehicle_state_id: string }
        Returns: void
      }
      rpc_confirm_seller_pickup_handover: {
        Args: { p_trade_request_id: string }
        Returns: void
      }
      rpc_confirm_carrier_pickup_handover: {
        Args: { p_trade_request_id: string }
        Returns: void
      }
      rpc_confirm_carrier_delivery: {
        Args: { p_trade_request_id: string }
        Returns: void
      }
      rpc_confirm_buyer_delivery: {
        Args: { p_trade_request_id: string }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

