'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Truck, CheckCircle, Package } from 'lucide-react';
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
  trade_requests?: {
    commodity_variety: string;
    quantity_volume: number;
    physical_address: string;
    request_status: string;
  };
}

export default function ActiveBookings() {
  const { profile } = useAuthStore();
  const supabase = createClient();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    if (!profile) return;
    setLoading(true);
    // Fetch logistics bookings joined with trade requests
    // We want active bookings OR completed ones (for history)
    const { data } = await supabase
      .from('logistics_bookings')
      .select(`
        *,
        trade_requests (
          commodity_variety,
          quantity_volume,
          physical_address,
          request_status
        )
      `)
      .eq('carrier_id', profile.id)
      .in('status', ['active', 'completed'])
      .order('id', { ascending: false }); // simple order by id DESC as proxy for newest
      
    if (data) {
      setBookings(data as unknown as Booking[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, supabase]);

  const handleReleaseJob = async (tradeRequestId: string) => {
    if (!window.confirm("Are you sure? This action will remove this item from active availability. The job will be returned to the pool.")) {
      return;
    }
    
    try {
      const { error } = await supabase.rpc('rpc_release_logistics_booking', { p_trade_request_id: tradeRequestId });
      if (error) {
        alert(error.message || 'Failed to release job.');
      } else {
        await fetchBookings();
        alert('Job released successfully.');
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
            Refresh
          </Button>
        </div>

        {activeBookings.length === 0 ? (
          <div className="p-6 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-center opacity-80">
            You have no active logistics bookings. Go to Available Jobs to claim a load.
          </div>
        ) : (
          <div className="grid gap-4">
            {activeBookings.map(booking => {
              const isAllocated = (toArray(booking.trade_requests)[0])?.request_status === 'ALLOCATED';
              const isDispatched = (toArray(booking.trade_requests)[0])?.request_status === 'DISPATCHED';
              const handoverStarted = booking.seller_pickup_confirmed_at !== null || booking.carrier_pickup_confirmed_at !== null;
              const isReleasable = isAllocated && !handoverStarted;

              return (
                <div key={booking.id} className="p-6 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg flex flex-col md:flex-row justify-between items-start gap-6">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-xl text-[var(--agri-primary-light)]">
                        {(toArray(booking.trade_requests)[0])?.commodity_variety || 'Unknown Commodity'}
                      </h3>
                      <div className="md:hidden">
                        <span className="px-3 py-1 bg-[var(--agri-primary-dark)] text-white rounded text-xs font-semibold uppercase">
                          {(toArray(booking.trade_requests)[0])?.request_status || 'ALLOCATED'}
                        </span>
                      </div>
                    </div>
                    
                    <p className="font-medium">{(toArray(booking.trade_requests)[0])?.quantity_volume || 'N/A'} units</p>
                    <p className="text-sm opacity-80 flex items-center">
                      <span className="mr-2">📍 Pickup:</span> 
                      {(toArray(booking.trade_requests)[0])?.physical_address || 'N/A'}
                    </p>
                    <p className="text-sm opacity-80">Distance: {booking.proximity_distance_km ? booking.proximity_distance_km.toFixed(2) : 0} km</p>
                    
                    {isAllocated && !isDispatched && (
                      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-400/30 rounded flex flex-col gap-3 text-sm text-purple-700 dark:text-purple-400">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 shrink-0" />
                          <span>Proceed to seller location. Both you and the seller must confirm pickup handover.</span>
                        </div>
                      </div>
                    )}

                    {isDispatched && (
                      <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-400/30 rounded flex flex-col gap-3 text-sm text-indigo-700 dark:text-indigo-400">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 shrink-0" />
                          <span>Transport goods to buyer. Both you and the buyer must confirm delivery.</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <OngoingTradeTimeline
                        requestStatus={(toArray(booking.trade_requests)[0])?.request_status || 'ALLOCATED'}
                        sellerPickupConfirmedAt={booking.seller_pickup_confirmed_at}
                        carrierPickupConfirmedAt={booking.carrier_pickup_confirmed_at}
                        carrierDeliveryConfirmedAt={booking.carrier_delivery_confirmed_at}
                        buyerDeliveryConfirmedAt={booking.buyer_delivery_confirmed_at}
                        role="carrier"
                        onConfirmCarrierPickup={() => handleCarrierPickupConfirm(booking.trade_request_id)}
                        onConfirmCarrierDelivery={() => handleCarrierDeliveryConfirm(booking.trade_request_id)}
                        // To improve UX we could add loading states to timeline component, but currently it handles it via UI
                      />
                    </div>
                  </div>

                  <div className="md:text-right flex flex-col justify-between h-full min-w-[200px] border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="hidden md:block mb-4">
                      <span className="inline-block px-3 py-1 bg-[var(--agri-primary-dark)] text-white rounded text-sm font-semibold uppercase">
                        {(toArray(booking.trade_requests)[0])?.request_status || 'ALLOCATED'}
                      </span>
                      {booking.escrow_status && (
                        <p className="text-xs mt-2 opacity-70">Escrow: {booking.escrow_status}</p>
                      )}
                    </div>
                    
                    <div className="mt-auto group relative inline-block md:text-right">
                      <Button
                        variant="danger"
                        onClick={() => isReleasable && handleReleaseJob(booking.trade_request_id)}
                        className={`px-4 py-2 border w-full md:w-auto ${isReleasable ? 'border-red-200 bg-transparent text-red-600 hover:bg-red-50' : 'border-red-200 bg-transparent text-red-600 opacity-50 cursor-not-allowed'}`}
                        disabled={!isReleasable}
                      >
                        Release Job
                      </Button>
                      {!isReleasable && (
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center">
                          {handoverStarted && isAllocated 
                            ? 'Handover is in progress. Job cannot be released.' 
                            : 'This job is already in transit and cannot be released here.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History section */}
      {completedBookings.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-[var(--border-color)]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500" /> Delivery History
          </h2>
          <div className="grid gap-4">
            {completedBookings.map(booking => (
              <div key={booking.id} className="p-5 bg-[var(--card-bg)] border-l-4 border-emerald-500 rounded-lg flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">
                    {(toArray(booking.trade_requests)[0])?.commodity_variety || 'Unknown Commodity'}
                  </h3>
                  <p className="text-sm opacity-80">
                    {(toArray(booking.trade_requests)[0])?.quantity_volume || 'N/A'} units
                  </p>
                  <p className="text-sm opacity-80">
                    Pickup: {(toArray(booking.trade_requests)[0])?.physical_address || 'N/A'}
                  </p>
                  <p className="text-xs opacity-60 mt-1">Vehicle used: {booking.carrier_name}</p>
                </div>
                <div className="md:text-right">
                  <span className="inline-block px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold uppercase mb-3">
                    COMPLETED
                  </span>
                  <div className="p-3 bg-emerald-500/10 border border-emerald-400/30 rounded text-xs text-emerald-600 dark:text-emerald-400 max-w-xs md:ml-auto">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-3 h-3 shrink-0" />
                      <strong className="font-semibold">Logistics settlement pending</strong>
                    </div>
                    Delivery confirmed. Logistics payment will be processed to your account.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
