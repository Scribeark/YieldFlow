'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabaseClient';
import type { TradeRequest } from '@/lib/types';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { ClipboardList, AlertCircle, Camera } from 'lucide-react';
import { format } from 'date-fns';

const statusBadgeClass: Record<string, string> = {
  pending: 'badge badge-pending',
  matched: 'badge badge-matched',
  in_transit: 'badge badge-in-transit',
  completed: 'badge badge-completed',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending (Available to Buyers/Carriers)',
  matched: 'Matched with Carrier',
  in_transit: 'In Transit',
  completed: 'Completed & Delivered',
};

export default function ActiveLogs() {
  const { profile } = useAuthStore();
  const [requests, setRequests] = useState<TradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!profile) return;
    try {
      // Query both user_id and owner_id columns for maximum coverage
      const { data, error: fetchError } = await supabase
        .from('trade_requests')
        .select('*')
        .or(`user_id.eq.${profile.id},owner_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw new Error(fetchError.message);
      setRequests((data as TradeRequest[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch active trade requests');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchRequests();

    if (!profile) return;

    const channel = supabase
      .channel(`farmer-trade-requests:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trade_requests',
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests, profile]);

  if (loading) return <TableSkeleton rows={5} />;

  if (error) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border border-border">
      <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-background-secondary/40">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-status-matched/10">
            <ClipboardList size={18} className="text-status-matched" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Active Trade Requests & Harvest Offers</h3>
            <p className="text-xs text-foreground-dim">{requests.length} active trade records</p>
          </div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-foreground-dim" />
          <p className="text-sm text-foreground-muted">No trade offers created yet. Use the tabbed form above to submit your first harvest offer.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Verification Photo</th>
                <th>Commodity Variety</th>
                <th>Quantity (kg / units)</th>
                <th>Pickup Location</th>
                <th>Trade Status</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td>
                    {req.harvest_photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={req.harvest_photo_url}
                        alt="Harvest verification"
                        className="h-10 w-10 rounded-lg object-cover border border-border shadow-sm"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background-elevated text-foreground-dim border border-border">
                        <Camera size={16} />
                      </div>
                    )}
                  </td>
                  <td className="font-bold text-foreground">{req.commodity_variety}</td>
                  <td className="font-semibold text-agri-primary-light">{Number(req.quantity).toLocaleString()}</td>
                  <td className="text-foreground-muted text-xs">{req.address || 'Standard Farm Hub'}</td>
                  <td>
                    <span className={statusBadgeClass[req.status || 'pending'] || 'badge badge-pending'}>
                      {statusLabel[req.status || 'pending'] || (req.status || 'pending')}
                    </span>
                  </td>
                  <td className="text-foreground-dim text-xs">
                    {req.created_at ? format(new Date(req.created_at), 'MMM d, yyyy HH:mm') : 'Recent'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
