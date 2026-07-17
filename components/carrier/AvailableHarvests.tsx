'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabaseClient';
import type { TradeRequest } from '@/lib/types';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Package, MapPin, Scale, Clock, CheckCircle2, Loader2, Camera } from 'lucide-react';
import { format } from 'date-fns';

export default function AvailableHarvests() {
  const { profile, user } = useAuthStore();
  const [requests, setRequests] = useState<TradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carrierId = profile?.id || user?.id;

  const fetchPending = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('trade_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (fetchError) throw new Error(fetchError.message);
      setRequests((data as TradeRequest[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch available trade requests');
    } finally {
      setLoading(false);
    }
  }, []);

  const acceptLoad = async (req: TradeRequest) => {
    if (!carrierId) return;
    setAccepting(req.id);
    try {
      // 1. Update trade request status to 'matched'
      const { error: updateError } = await supabase
        .from('trade_requests')
        .update({ status: 'matched' })
        .eq('id', req.id);

      if (updateError) throw new Error(updateError.message);

      // 2. Insert booking record into logistics_bookings
      const { error: insertError } = await supabase
        .from('logistics_bookings')
        .insert({
          trade_request_id: req.id,
          carrier_id: carrierId,
          status: 'matched',
          pickup_time: new Date().toISOString(),
        });

      if (insertError && !insertError.message.includes('column "trade_request_id" of relation')) {
        // Fallback if schema uses harvest_id
        await supabase
          .from('logistics_bookings')
          .insert({
            harvest_id: req.id,
            carrier_id: carrierId,
            status: 'matched',
          });
      }

      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept load');
    } finally {
      setAccepting(null);
    }
  };

  useEffect(() => {
    fetchPending();

    const channel = supabase
      .channel('available-trade-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_requests',
      }, () => fetchPending())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPending]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-sm text-red-400">{error}</div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="card p-12 text-center border border-dashed border-border">
        <Package size={40} className="mx-auto mb-3 text-foreground-dim" />
        <h4 className="text-sm font-bold text-foreground">No Available Loads Right Now</h4>
        <p className="text-xs text-foreground-muted mt-1">
          When farmers and traders submit new harvest trade offers, they appear here immediately.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {requests.map((req) => (
        <div key={req.id} className="card p-5 border border-border transition-all hover:border-agri-primary/50 flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="badge badge-pending">Available Load</span>
              <span className="flex items-center gap-1 text-xs text-foreground-dim">
                <Clock size={12} />
                {req.created_at ? format(new Date(req.created_at), 'MMM d, HH:mm') : 'Just now'}
              </span>
            </div>

            {req.harvest_photo_url && (
              <div className="mb-3 overflow-hidden rounded-lg border border-border h-32 bg-background-elevated relative">
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={req.harvest_photo_url}
                  alt={req.commodity_variety}
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1">
                  <Camera size={10} /> Verified
                </div>
              </div>
            )}

            <h4 className="mb-2 text-base font-bold text-foreground">{req.commodity_variety}</h4>

            <div className="mb-4 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-agri-primary-light font-bold">
                <Scale size={14} className="text-agri-primary" />
                <span>{Number((req as any).quantity_volume || req.quantity || 0).toLocaleString()} kg / units</span>
              </div>
              <div className="flex items-center gap-2 text-foreground-muted">
                <MapPin size={14} className="text-foreground-dim shrink-0" />
                <span className="truncate">{(req as any).physical_address || req.address || 'Standard Farm Hub'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => acceptLoad(req)}
            disabled={accepting === req.id}
            className="btn btn-primary w-full text-xs py-2 mt-2"
          >
            {accepting === req.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <><CheckCircle2 size={14} /> Accept Harvest Load</>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
