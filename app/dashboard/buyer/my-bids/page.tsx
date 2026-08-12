'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NegotiationHistory } from '@/components/shared/NegotiationHistory';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getMyBids, cancelAcceptedHarvestBid } from '@/lib/api/buyer';
import { withdrawOffer, acceptOffer, rejectOffer, counterHarvestBid } from '@/lib/api/farms';
import { HandCoins, MapPin, Loader2, CalendarDays, Activity, Layers, RefreshCw, CheckCircle, XCircle, ArrowRight, Info, MessageSquare } from 'lucide-react';

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  PENDING:           { badge: 'bg-yellow-500/20 text-yellow-400',  label: 'Pending' },
  ACCEPTED:          { badge: 'bg-green-500/20 text-green-400',    label: 'Accepted' },
  PARTIALLY_ACCEPTED:{ badge: 'bg-blue-500/20 text-blue-400',      label: 'Partial Accept' },
  REJECTED:          { badge: 'bg-red-500/20 text-red-400',        label: 'Rejected' },
  WITHDRAWN:         { badge: 'bg-gray-500/20 text-gray-400',      label: 'Withdrawn' },
  CONVERTED_TO_TRADE:{ badge: 'bg-purple-500/20 text-purple-400',  label: 'Converted to Trade' },
  EXPIRED:           { badge: 'bg-gray-500/20 text-gray-400',      label: 'Expired' },
};


// ── Modals ──────────────────────────────────────────────────────────────────

function AcceptModal({
  bid,
  unit,
  onAccept,
  onClose,
}: {
  bid: any;
  unit: string;
  onAccept: (bidId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onAccept(bid.id);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 sm:p-6">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Accept Counteroffer</h2>
        <p className="text-sm opacity-80 mb-4">
          You are accepting the current terms: <strong>{bid.desired_quantity} {unit}</strong> @ ₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              Confirm Accept
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function CounterofferModal({
  bid,
  unit,
  onCounter,
  onClose,
}: {
  bid: any;
  unit: string;
  onCounter: (bidId: string, qty: number, price: number, msg: string) => Promise<void>;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(String(bid.desired_quantity));
  const [price, setPrice] = useState(String(bid.offered_price_per_unit));
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseInt(qty);
    const numPrice = parseFloat(price);
    if (!numQty || numQty <= 0) {
      setErr(`Enter a valid quantity.`);
      return;
    }
    if (!numPrice || numPrice <= 0) {
      setErr('Enter a valid price.');
      return;
    }
    setSubmitting(true);
    await onCounter(bid.id, numQty, numPrice, msg);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 sm:p-6">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Make Counteroffer</h2>
        <p className="text-sm opacity-80 mb-4">
          Current terms: <strong>{bid.desired_quantity} {unit}</strong> @ ₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}.
        </p>
        {err && <Alert variant="error" className="mb-3">{err}</Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Counter Quantity ({unit})</label>
            <Input type="number" min="1" value={qty} onChange={(e: any) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Counter Price (₦/{unit})</label>
            <Input type="number" step="0.01" min="1" value={price} onChange={(e: any) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Message to Seller</label>
            <Input value={msg} onChange={(e: any) => setMsg(e.target.value)} placeholder="e.g., This is my final offer." />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              Send Counteroffer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function BuyerMyBidsPage() {
  const { profile } = useAuthStore();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<any[]>([]);
  const [pageError, setPageError] = useState('');
  const [actionState, setActionState] = useState<{ id: string; status: 'loading' | 'error' | 'success'; msg: string } | null>(null);
  const [acceptModal, setAcceptModal] = useState<{ bid: any; unit: string } | null>(null);
  const [counterModal, setCounterModal] = useState<{ bid: any; unit: string } | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await getMyBids(supabase);
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
    if (!window.confirm('Withdraw this bid? This cannot be undone.')) return;
    setActionState({ id: bid.id, status: 'loading', msg: '' });
    const { error } = await withdrawOffer(supabase, bid.id);
    if (error) notify(bid.id, error.message, true);
    else { notify(bid.id, 'Bid withdrawn successfully.'); await load(); }
  };

  const handleAccept = async (bidId: string) => {
    setAcceptModal(null);
    setActionState({ id: bidId, status: 'loading', msg: '' });
    const { error } = await acceptOffer(supabase, bidId);
    if (error) notify(bidId, error.message, true);
    else { notify(bidId, 'Offer accepted!'); await load(); }
  };

  const handleReject = async (bidId: string) => {
    if (!window.confirm('Reject this offer?')) return;
    setActionState({ id: bidId, status: 'loading', msg: '' });
    const { error } = await rejectOffer(supabase, bidId);
    if (error) notify(bidId, error.message, true);
    else { notify(bidId, 'Offer rejected.'); await load(); }
  };

  const handleCounter = async (bidId: string, qty: number, price: number, msg: string) => {
    setCounterModal(null);
    setActionState({ id: bidId, status: 'loading', msg: '' });
    const { error } = await counterHarvestBid(supabase, { bidId, counterPrice: price, counterQuantity: qty, message: msg });
    if (error) notify(bidId, error.message, true);
    else { notify(bidId, 'Counteroffer sent.'); await load(); }
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
      case 'BUYER_COUNTERED':
        return 'Waiting for the seller to review your bid.';
      case 'SELLER_COUNTERED':
        return 'Seller has sent a counteroffer. Please review.';
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

  const activeBids = bids.filter((b) => ['PENDING', 'SELLER_COUNTERED', 'BUYER_COUNTERED', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE'].includes(b.bid_status));
  const closedBids = bids.filter((b) => ['REJECTED', 'WITHDRAWN', 'CANCELLED', 'EXPIRED'].includes(b.bid_status));

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

    // Safely format the converted location requiring both fields
    const convertedLocation = opp.farm_name && opp.farm_physical_address
      ? `${opp.farm_name} - ${opp.farm_physical_address}`
      : 'Location hidden until trade conversion';

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
                  <Activity size={11} className="mr-1" /> Predicted Harvest
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
              {opp.crop_type || 'Unknown Crop'}
            </h3>
            <div className="text-sm opacity-70 flex items-center mb-2">
              <MapPin size={13} className="mr-1 flex-shrink-0" />
              {convertedLocation}
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
            {/* BUYER_COUNTERED or PENDING: Only withdraw allowed */}
            {(bid.bid_status === 'PENDING' || bid.bid_status === 'BUYER_COUNTERED') && (
              <Button
                variant="ghost" size="sm"
                className="text-red-400 hover:bg-red-500/10 border border-red-400/20 w-full"
                disabled={isActioning}
                onClick={() => handleWithdraw(bid)}
              >
                {isActioning ? <Loader2 size={14} className="animate-spin mr-1" /> : <XCircle size={14} className="mr-1" />}
                Withdraw Bid
              </Button>
            )}

            {/* SELLER_COUNTERED: Buyer can Accept, Reject, Counter, Withdraw */}
            {bid.bid_status === 'SELLER_COUNTERED' && (
              <>
                <Button
                  variant="primary" size="sm" className="w-full"
                  disabled={isActioning}
                  onClick={() => setAcceptModal({ bid, unit })}
                >
                  <CheckCircle size={14} className="mr-1" /> Accept
                </Button>
                <Button
                  variant="accent" size="sm" className="w-full"
                  disabled={isActioning}
                  onClick={() => setCounterModal({ bid, unit })}
                >
                  <MessageSquare size={14} className="mr-1" /> Counter
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="text-orange-400 hover:bg-orange-500/10 border border-orange-400/20 w-full"
                  disabled={isActioning}
                  onClick={() => handleReject(bid.id)}
                >
                  <XCircle size={14} className="mr-1" /> Reject
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="text-red-400 hover:bg-red-500/10 border border-red-400/20 w-full"
                  disabled={isActioning}
                  onClick={() => handleWithdraw(bid)}
                >
                  {isActioning ? <Loader2 size={14} className="animate-spin mr-1" /> : <XCircle size={14} className="mr-1" />}
                  Withdraw Bid
                </Button>
              </>
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
        <div className="mt-4 border-t border-white/10 pt-4">
          <NegotiationHistory bidId={bid.id} />
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
      {acceptModal && (
        <AcceptModal
          bid={acceptModal.bid}
          unit={acceptModal.unit}
          onAccept={handleAccept}
          onClose={() => setAcceptModal(null)}
        />
      )}
      {counterModal && (
        <CounterofferModal
          bid={counterModal.bid}
          unit={counterModal.unit}
          onCounter={handleCounter}
          onClose={() => setCounterModal(null)}
        />
      )}
    </PageContainer>
  );
}
