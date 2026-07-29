'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getMyBids, withdrawHarvestBid, cancelAcceptedHarvestBid } from '@/lib/api/buyer';
import {
  HandCoins, MapPin, Loader2, CalendarDays, Activity, Layers,
  RefreshCw, CheckCircle, XCircle, ArrowRight, Info
} from 'lucide-react';

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  PENDING:           { badge: 'bg-yellow-500/20 text-yellow-400',  label: 'Pending' },
  ACCEPTED:          { badge: 'bg-green-500/20 text-green-400',    label: 'Accepted' },
  PARTIALLY_ACCEPTED:{ badge: 'bg-blue-500/20 text-blue-400',      label: 'Partial Accept' },
  REJECTED:          { badge: 'bg-red-500/20 text-red-400',        label: 'Rejected' },
  WITHDRAWN:         { badge: 'bg-gray-500/20 text-gray-400',      label: 'Withdrawn' },
  CONVERTED_TO_TRADE:{ badge: 'bg-purple-500/20 text-purple-400',  label: 'Converted to Trade' },
  EXPIRED:           { badge: 'bg-gray-500/20 text-gray-400',      label: 'Expired' },
};

export default function BuyerMyBidsPage() {
  const { profile } = useAuthStore();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<any[]>([]);
  const [pageError, setPageError] = useState('');
  const [actionState, setActionState] = useState<{ id: string; status: 'loading' | 'error' | 'success'; msg: string } | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    // harvest_bids.buyer_id references public.users.id, not auth.uid()
    const { data, error } = await getMyBids(supabase, profile.id);
    if (error) setPageError('Failed to load your bids.');
    else setBids(data || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const notify = (bidId: string, msg: string, isError = false) => {
    setActionState({ id: bidId, status: isError ? 'error' : 'success', msg });
    setTimeout(() => setActionState(null), 5000);
  };

  const handleWithdraw = async (bid: any) => {
    if (!window.confirm('Withdraw this PENDING bid? This cannot be undone.')) return;
    setActionState({ id: bid.id, status: 'loading', msg: '' });
    const { error } = await withdrawHarvestBid(supabase, bid.id);
    if (error) notify(bid.id, error.message, true);
    else { notify(bid.id, 'Bid withdrawn successfully.'); await load(); }
  };

  const handleCancelAccepted = async (bid: any) => {
    if (!window.confirm(
      `Cancel your accepted bid for ${bid.accepted_quantity || bid.desired_quantity} ${bid.harvest_predictions?.expected_quantity_unit}? ` +
      `The quantity will be returned to the seller's pool.`
    )) return;
    setActionState({ id: bid.id, status: 'loading', msg: '' });
    const { error } = await cancelAcceptedHarvestBid(supabase, bid.id);
    if (error) notify(bid.id, error.message, true);
    else { notify(bid.id, 'Bid cancelled. Quantity returned to seller pool.'); await load(); }
  };

  const getLifecycleNote = (bid: any) => {
    switch (bid.bid_status) {
      case 'PENDING':
        return 'Waiting for the seller to review and accept your bid.';
      case 'ACCEPTED':
      case 'PARTIALLY_ACCEPTED':
        return 'Seller has accepted your bid. Awaiting harvest confirmation and conversion to a trade request.';
      case 'CONVERTED_TO_TRADE':
        return 'Your bid has been converted into a trade request. Visit My Orders to track delivery.';
      case 'REJECTED':
        return 'The seller rejected this bid. You may place a new bid on another opportunity.';
      case 'WITHDRAWN':
        return 'You withdrew this bid.';
      default:
        return '';
    }
  };

  const activeBids = bids.filter((b) => ['PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE'].includes(b.bid_status));
  const closedBids = bids.filter((b) => ['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(b.bid_status));

  const renderBid = (bid: any) => {
    const opp = bid.harvest_predictions;
    if (!opp) return null;
    const unit = opp.expected_quantity_unit || 'units';
    const isIoT = opp.bidding_origin !== 'MANUAL';
    const style = STATUS_STYLES[bid.bid_status] || STATUS_STYLES.EXPIRED;
    const isActioning = actionState?.id === bid.id && actionState?.status === 'loading';

    // What quantity was accepted (for PARTIALLY_ACCEPTED, accepted_quantity may be less)
    const effectiveQty = bid.accepted_quantity ?? bid.desired_quantity;
    const effectiveTotal = effectiveQty * Number(bid.offered_price_per_unit);

    return (
      <Card key={bid.id} className={`border-l-4 ${bid.bid_status === 'PENDING' ? 'border-l-yellow-500' : bid.bid_status === 'CONVERTED_TO_TRADE' ? 'border-l-purple-500' : 'border-l-[var(--agri-primary)]'} transition-all`}>
        {/* Action feedback for this specific bid */}
        {actionState?.id === bid.id && actionState?.status === 'error' && (
          <Alert variant="error" className="mb-3">{actionState?.msg}</Alert>
        )}
        {actionState?.id === bid.id && actionState?.status === 'success' && (
          <Alert variant="success" className="mb-3">{actionState?.msg}</Alert>
        )}

        <div className="flex flex-col md:flex-row md:items-start gap-4">

          {/* Left: Opportunity Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wide ${style.badge}`}>
                {style.label}
              </span>
              {isIoT ? (
                <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded font-bold flex items-center">
                  <Activity size={11} className="mr-1" /> IoT Predicted Harvest
                </span>
              ) : (
                <span className="bg-purple-500/10 text-purple-400 text-xs px-2 py-1 rounded font-bold flex items-center">
                  <Layers size={11} className="mr-1" /> Manual Seller Listing
                </span>
              )}
              <span className="text-xs opacity-50 flex items-center">
                <CalendarDays size={11} className="mr-1" /> {new Date(bid.created_at).toLocaleDateString()}
              </span>
            </div>

            <h3 className="text-lg font-bold mb-1">
              {opp.farms?.crop_type || 'Unknown Crop'}
            </h3>
            <div className="text-sm opacity-70 flex items-center mb-2">
              <MapPin size={13} className="mr-1 flex-shrink-0" />
              {opp.farms?.physical_address || 'Location hidden until trade conversion'}
            </div>

            {/* Lifecycle note */}
            <p className="text-xs opacity-50 flex items-center gap-1 mt-1">
              <Info size={12} className="flex-shrink-0" /> {getLifecycleNote(bid)}
            </p>
          </div>

          {/* Middle: Bid Numbers */}
          <div className="bg-black/20 p-4 rounded-lg flex-shrink-0 min-w-[200px]">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-xs opacity-60 mb-0.5">Your Bid Qty</div>
                <div className="font-bold">{bid.desired_quantity} <span className="text-xs opacity-70">{unit}</span></div>
              </div>
              <div>
                <div className="text-xs opacity-60 mb-0.5">Price / {unit}</div>
                <div className="font-bold text-yellow-400">₦{Number(bid.offered_price_per_unit).toLocaleString()}</div>
              </div>
            </div>

            {bid.bid_status === 'PARTIALLY_ACCEPTED' && (
              <div className="text-xs text-blue-400 mb-2">
                ✓ Seller accepted {bid.accepted_quantity} {unit} (of {bid.desired_quantity} requested)
              </div>
            )}

            <div className="border-t border-white/10 pt-2 flex justify-between items-center">
              <span className="text-xs opacity-60">Total Value</span>
              <span className="font-bold text-sm">₦{effectiveTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col gap-2 min-w-[140px]">
            {bid.bid_status === 'PENDING' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:bg-red-500/10 border border-red-400/20 w-full"
                disabled={isActioning}
                onClick={() => handleWithdraw(bid)}
              >
                {isActioning ? <Loader2 size={14} className="animate-spin mr-1" /> : <XCircle size={14} className="mr-1" />}
                Withdraw Bid
              </Button>
            )}

            {(bid.bid_status === 'ACCEPTED' || bid.bid_status === 'PARTIALLY_ACCEPTED') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-400 hover:bg-orange-500/10 border border-orange-400/20 w-full"
                disabled={isActioning}
                onClick={() => handleCancelAccepted(bid)}
              >
                {isActioning ? <Loader2 size={14} className="animate-spin mr-1" /> : <XCircle size={14} className="mr-1" />}
                Cancel Bid
              </Button>
            )}

            {bid.bid_status === 'CONVERTED_TO_TRADE' && (
              <Link href="/dashboard/buyer/orders">
                <Button variant="primary" size="sm" className="w-full">
                  <ArrowRight size={14} className="mr-1" /> View Order
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>My Bids</h1>
          <p className="opacity-70 mt-1">Track the status of your harvest bids across the full lifecycle.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className="mr-1" /> Refresh
        </Button>
      </div>

      {pageError && <Alert variant="error" className="mb-4">{pageError}</Alert>}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-[var(--agri-primary)]" size={32} />
        </div>
      ) : bids.length === 0 ? (
        <Alert variant="info">
          You have not placed any bids yet.{' '}
          <Link href="/dashboard/buyer/pre-harvest" className="underline">Browse Harvest Opportunities →</Link>
        </Alert>
      ) : (
        <div className="space-y-8">
          {/* Active bids */}
          {activeBids.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <HandCoins size={20} className="text-[var(--agri-primary)]" /> Active Bids
                <span className="text-sm opacity-50 font-normal">({activeBids.length})</span>
              </h2>
              <div className="space-y-4">
                {activeBids.map(renderBid)}
              </div>
            </section>
          )}

          {/* Closed / historical */}
          {closedBids.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-4 opacity-60 flex items-center gap-2">
                Historical Bids
                <span className="text-sm font-normal">({closedBids.length})</span>
              </h2>
              <div className="space-y-3 opacity-70">
                {closedBids.map(renderBid)}
              </div>
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}
