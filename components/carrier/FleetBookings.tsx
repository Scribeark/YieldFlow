'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabaseClient';
import type { TradeStatus } from '@/lib/types';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { Truck, Package, ArrowRight, Loader2, AlertCircle, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface BookingWithTrade {
  id: string;
  trade_request_id?: string | null;
  harvest_id?: string | null;
  carrier_id: string;
  pickup_time: string | null;
  delivery_time: string | null;
  status: TradeStatus;
  payer_id?: string | null;
  payment_status?: string | null;
  estimated_cost_ngn?: number | null;
  created_at: string;

  trade_requests?: {
    commodity_variety: string;
    quantity_volume?: number;
    quantity?: number;
    physical_address?: string;
    address?: string;
  } | null;
}

const statusBadgeClass: Record<string, string> = {
  pending: 'badge badge-pending',
  matched: 'badge badge-matched',
  in_transit: 'badge badge-in-transit',
  completed: 'badge badge-completed',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  matched: 'Dispatched / Matched',
  in_transit: 'In Transit',
  completed: 'Delivered',
};

const nextStatusMap: Record<string, string> = {
  matched: 'in_transit',
  in_transit: 'completed',
};

const nextStatusLabel: Record<string, string> = {
  matched: 'Start Transit',
  in_transit: 'Mark Completed',
};

export default function FleetBookings() {
  const { profile, user } = useAuthStore();
  const [bookings, setBookings] = useState<BookingWithTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carrierId = profile?.id || user?.id;

  const fetchBookings = useCallback(async () => {
    if (!carrierId) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('logistics_bookings')
        .select('*, trade_requests(commodity_variety, quantity_volume, physical_address)')
        .eq('carrier_id', carrierId)
        .order('created_at', { ascending: false });

      if (fetchError) throw new Error(fetchError.message);
      setBookings((data as BookingWithTrade[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch active fleet bookings');
    } finally {
      setLoading(false);
    }
  }, [carrierId]);

  const updateStatus = async (booking: BookingWithTrade) => {
    const nextSt = nextStatusMap[booking.status || 'matched'];
    if (!nextSt) return;

    setUpdating(booking.id);
    try {
      const updates: Record<string, string> = { status: nextSt };
      if (nextSt === 'in_transit') updates.pickup_time = new Date().toISOString();
      if (nextSt === 'completed') updates.delivery_time = new Date().toISOString();

      const { error: bookingError } = await supabase
        .from('logistics_bookings')
        .update(updates)
        .eq('id', booking.id);

      if (bookingError) throw new Error(bookingError.message);

      const reqId = booking.trade_request_id || booking.harvest_id;
      if (reqId) {
        await supabase.from('trade_requests').update({ status: nextSt }).eq('id', reqId);
      }

      await fetchBookings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  if (loading) return <TableSkeleton rows={5} />;

  if (error) {
    return (
      <div className="card p-6 border border-red-500/30 bg-red-500/10">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="card p-12 text-center border border-dashed border-border">
        <Truck size={40} className="mx-auto mb-3 text-foreground-dim" />
        <h4 className="text-sm font-bold text-foreground">No Active Fleet Bookings</h4>
        <p className="text-xs text-foreground-muted mt-1">Accept loads from the Available Harvests tab to dispatch your vehicles.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border border-border">
      <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-background-secondary/40">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-in-transit/10">
            <Truck size={18} className="text-status-in-transit" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Active Carrier Bookings</h3>
            <p className="text-xs text-foreground-dim">{bookings.length} active shipments assigned to fleet</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Commodity / Crop</th>
              <th>Quantity</th>
              <th>Pickup / Hub Address</th>
              <th>Logistics Settlement</th>
              <th>Transit Status</th>
              <th>Booked Date</th>
              <th>Dispatch Action</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => {
              const commodity = booking.trade_requests?.commodity_variety || 'Assorted Harvest';
              const qty = (booking.trade_requests as any)?.quantity_volume || booking.trade_requests?.quantity || 0;
              const location = (booking.trade_requests as any)?.physical_address || booking.trade_requests?.address || 'Standard Hub';
              const nextSt = nextStatusMap[booking.status || 'matched'];
              const estCost = booking.estimated_cost_ngn || (qty * 45);

              return (
                <tr key={booking.id}>
                  <td className="font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-agri-primary-light" />
                      {commodity}
                    </div>
                  </td>
                  <td className="font-semibold">{Number(qty).toLocaleString()} kg</td>
                  <td className="text-foreground-muted text-xs">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-foreground-dim" />
                      <span>{location}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-emerald-400">₦{Number(estCost).toLocaleString()}</span>
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/20 w-max">
                        {booking.payment_status === 'paid' ? 'Paid by Buyer' : 'Buyer Settlement Pending'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={statusBadgeClass[booking.status || 'matched'] || 'badge badge-matched'}>
                      {statusLabel[booking.status || 'matched'] || booking.status}
                    </span>
                  </td>
                  <td className="text-xs text-foreground-dim">
                    {booking.created_at ? format(new Date(booking.created_at), 'MMM d, HH:mm') : 'Recent'}
                  </td>

                  <td>
                    {nextSt ? (
                      <button
                        onClick={() => updateStatus(booking)}
                        disabled={updating === booking.id}
                        className="btn btn-primary btn-sm text-xs py-1 px-3 flex items-center gap-1"
                      >
                        {updating === booking.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>{nextStatusLabel[booking.status || 'matched']} <ArrowRight size={12} /></>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                        ✓ Delivered
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
