'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Truck, CheckCircle, Package, Navigation } from 'lucide-react';
import { OngoingTradeTimeline } from '@/components/shared/OngoingTradeTimeline';

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

interface Booking {
  id: string;
  trade_request_id: string;
  carrier_name: string;
  carrier_phone: string;
  proximity_distance_km: number;
  escrow_status?: string;
  status: string;
  dispatched_at: string | null;
  seller_pickup_confirmed_at: string | null;
  carrier_pickup_confirmed_at: string | null;
  carrier_delivery_confirmed_at: string | null;
  buyer_delivery_confirmed_at: string | null;
  vehicle_state_id: string | null;
  trade_requests?: {
    commodity_variety: string;
    quantity_volume: number;
    physical_address: string;
    computed_latitude: number | null;
    computed_longitude: number | null;
    delivery_address: string | null;
    delivery_latitude: number | null;
    delivery_longitude: number | null;
    request_status: string;
  };
  vehicle_states?: {
    id: string;
    current_latitude: number | null;
    current_longitude: number | null;
    location_updated_at: string | null;
  } | null;
}

export default function ActiveBookings() {
  const { profile } = useAuthStore();
  const supabase = createClient();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('logistics_bookings')
      .select(`
        *,
        trade_requests (
          commodity_variety, quantity_volume, physical_address, request_status,
          computed_latitude, computed_longitude,
          delivery_address, delivery_latitude, delivery_longitude
        ),
        vehicle_states ( id, current_latitude, current_longitude, location_updated_at )
      `)
      .eq('carrier_id', profile.id)
      .in('status', ['active', 'completed'])
      .order('id', { ascending: false });
    if (data) setBookings(data as unknown as Booking[]);
    setLoading(false);
  }, [profile, supabase]);

  const [updatingLocation, setUpdatingLocation] = useState(false);
  const lastLocationUpdate = useRef<number>(0);

  const handleUpdateLocation = async (vehicleStateId: string) => {
    setUpdatingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.from('vehicle_states').update({
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
          location_updated_at: new Date().toISOString(),
        }).eq('id', vehicleStateId);
        if (error) alert('Failed to update location: ' + error.message);
        else { await fetchBookings(); }
        setUpdatingLocation(false);
      },
      () => { alert('Could not get GPS location. Please enable browser location access.'); setUpdatingLocation(false); },
      { timeout: 10000 }
    );
  };

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Foreground Watch Position for Active Trip
  useEffect(() => {
    if (!profile) return;
    const activeBooking = bookings.find(b => b.status === 'active');
    if (!activeBooking || !activeBooking.vehicle_state_id) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        // Throttle to 30 seconds
        if (now - lastLocationUpdate.current < 30000) return;
        
        lastLocationUpdate.current = now;
        
        await supabase.from('vehicle_states').update({
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
          location_updated_at: new Date().toISOString(),
        }).eq('id', activeBooking.vehicle_state_id!);
      },
      (err) => console.warn('watchPosition error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [bookings, profile, supabase]);

  const handleReleaseJob = async (tradeRequestId: string) => {
    if (!window.confirm("Are you sure? This action will remove this item from active availability. The job will be returned to the pool.")) {
      return;
    }
    
    try {
      const { data, error } = await supabase.rpc('rpc_release_logistics_booking', { p_trade_request_id: tradeRequestId });
      if (error) {
        alert(error.message || 'Failed to release job.');
      } else {
        alert('Job released successfully.');
        router.refresh(); // force next cache invalidation
        await fetchBookings();
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred.');
    }
  };

  const handleCarrierPickupConfirm = async (tradeRequestId: string) => {
    if (!window.confirm("Confirm that you have received the goods from the seller? This action cannot be undone.")) return;
    const { error } = await supabase.rpc('rpc_confirm_carrier_pickup_handover', { p_trade_request_id: tradeRequestId });
    if (error) {
      alert(error.message || 'Failed to confirm pickup.');
    } else {
      await fetchBookings();
    }
  };

  const handleCarrierDeliveryConfirm = async (tradeRequestId: string) => {
    if (!window.confirm("Confirm that you have delivered the goods to the buyer? This action cannot be undone.")) return;
    const { error } = await supabase.rpc('rpc_confirm_carrier_delivery', { p_trade_request_id: tradeRequestId });
    if (error) {
      alert(error.message || 'Failed to confirm delivery.');
    } else {
      await fetchBookings();
    }
  };

  const activeBookings = bookings.filter(b => b.status === 'active');
  const completedBookings = bookings.filter(b => b.status === 'completed');

  if (loading) return <div className="p-8 text-center animate-pulse opacity-70">Loading bookings...</div>;

  return (
    <div className="space-y-10">
      {/* Active section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Current Jobs</h2>
          <Button variant="ghost" size="sm" onClick={fetchBookings} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {activeBookings.length === 0 ? (
          <div className="p-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-center opacity-70">
            <Package className="mx-auto w-10 h-10 mb-3 opacity-30" />
            <p>You have no active jobs.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {activeBookings.map(booking => {
              const trade = booking.trade_requests;
              if (!trade) return null;
              const vehicleState = booking.vehicle_states;
              
              const isAllocated = trade.request_status === 'ALLOCATED';
              const isDispatched = trade.request_status === 'DISPATCHED';

              return (
                <div key={booking.id} className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm flex flex-col">
                  {/* Header */}
                  <div className="p-4 border-b border-[var(--border-color)] bg-black/5 dark:bg-white/5 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">{trade.commodity_variety} <span className="text-sm font-normal text-gray-500">({trade.quantity_volume} kg)</span></h3>
                      <p className="text-xs text-gray-500">Booking ID: {booking.id.split('-')[0]}</p>
                    </div>
                    {isAllocated && !booking.seller_pickup_confirmed_at && (
                      <Button variant="ghost" size="sm" className="text-red-600 border border-red-200 hover:bg-red-50" onClick={() => handleReleaseJob(booking.trade_request_id)}>
                        Release Job
                      </Button>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 flex-1">
                    <OngoingTradeTimeline
                      requestStatus={trade.request_status}
                      role="carrier"
                      sellerPickupConfirmedAt={booking.seller_pickup_confirmed_at}
                      carrierPickupConfirmedAt={booking.carrier_pickup_confirmed_at}
                      carrierDeliveryConfirmedAt={booking.carrier_delivery_confirmed_at}
                      buyerDeliveryConfirmedAt={booking.buyer_delivery_confirmed_at}
                      pickupAddress={trade.physical_address}
                      pickupLat={trade.computed_latitude}
                      pickupLng={trade.computed_longitude}
                      deliveryAddress={trade.delivery_address}
                      deliveryLat={trade.delivery_latitude}
                      deliveryLng={trade.delivery_longitude}
                      carrierLat={vehicleState?.current_latitude}
                      carrierLng={vehicleState?.current_longitude}
                      locationUpdatedAt={vehicleState?.location_updated_at}
                    />

                    {/* Carrier Actions */}
                    <div className="mt-8 border-t border-[var(--border-color)] pt-6">
                      <h4 className="font-semibold text-sm mb-4">Carrier Actions</h4>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button 
                          onClick={() => handleUpdateLocation(booking.vehicle_state_id || vehicleState?.id || '')} 
                          variant="ghost" 
                          className="flex-1 border border-gray-200"
                          disabled={updatingLocation || (!booking.vehicle_state_id && !vehicleState?.id)}
                        >
                          <Navigation className={`w-4 h-4 mr-2 ${updatingLocation ? 'animate-bounce' : ''}`} />
                          Update My Location
                        </Button>

                        {/* Handover states */}
                        {isAllocated && booking.seller_pickup_confirmed_at && !booking.carrier_pickup_confirmed_at && (
                          <Button onClick={() => handleCarrierPickupConfirm(booking.trade_request_id)} className="flex-1 bg-green-600 hover:bg-green-700">
                            Confirm Received from Seller
                          </Button>
                        )}
                        {isDispatched && !booking.carrier_delivery_confirmed_at && (
                          <Button onClick={() => handleCarrierDeliveryConfirm(booking.trade_request_id)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            Confirm Delivered to Buyer
                          </Button>
                        )}
                      </div>
                      
                      <p className="text-xs text-center mt-3 text-gray-400">
                        {vehicleState?.location_updated_at 
                          ? `Location last updated: ${new Date(vehicleState.location_updated_at).toLocaleTimeString()}`
                          : 'Location not updated yet'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed section */}
      {completedBookings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Completed Jobs</h2>
          <div className="grid gap-4">
            {completedBookings.map(booking => {
              const trade = booking.trade_requests;
              return (
                <div key={booking.id} className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg flex justify-between items-center opacity-70">
                  <div>
                    <h3 className="font-semibold">{trade?.commodity_variety}</h3>
                    <p className="text-sm">Delivered to: {trade?.delivery_address}</p>
                  </div>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
