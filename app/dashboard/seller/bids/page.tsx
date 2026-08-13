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
import {
  getSellerBidListings,
  rejectOffer,
  acceptOffer,
  counterHarvestBid,
  convertBidsToTrades,
  closeCropAllocationBidding,
  cancelProvisionalAgreement,
  deleteBid,
  cancelBulkSale,
  declareHarvestAvailable,
} from '@/lib/api/farms';
import {
  Layers, RefreshCw, Loader2, XCircle,
  ChevronDown, ChevronUp, AlertTriangle, ArrowRight,
  Package, Calendar, Ban, CheckCircle2, Sprout,
} from 'lucide-react';

// ── Error Boundary ────────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-500/30 bg-red-500/5 m-4">
          <h2 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2"><AlertTriangle /> Something went wrong rendering this section</h2>
          <p className="text-sm opacity-80">{this.state.error?.message}</p>
          <Button variant="secondary" className="mt-4" onClick={() => this.setState({ hasError: false, error: null })}>Try Again</Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcStats(prediction: any) {
  const bids: any[] = Array.isArray(prediction?.harvest_bids) ? prediction.harvest_bids : [];
  const max = prediction.expected_quantity_max || prediction.expected_quantity_volume || 0;
  const total = max;
  const accepted = bids
    .filter((b) => ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONVERTED_TO_TRADE'].includes(b.bid_status))
    .reduce((sum, b) => sum + (b.accepted_quantity || 0), 0);
  const pending = bids
    .filter((b) => b.bid_status === 'PENDING')
    .reduce((sum, b) => sum + (b.desired_quantity || 0), 0);
  const converted = bids
    .filter((b) => b.bid_status === 'CONVERTED_TO_TRADE')
    .reduce((sum, b) => sum + (b.accepted_quantity || 0), 0);
  return { total, accepted, remaining: Math.max(0, total - accepted), pending, converted };
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function isHarvestAvailable(pred: any): boolean {
  if (pred.harvest_available_at) return true;
  if (pred.bidding_status === 'HARVEST_CONFIRMED' || pred.bidding_status === 'CONVERTED_TO_TRADE') return true;
  if (pred.seller_maturity_at && new Date(pred.seller_maturity_at).getTime() <= Date.now()) return true;
  return false;
}

const BID_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  ACCEPTED: 'bg-green-500/20 text-green-400',
  PARTIALLY_ACCEPTED: 'bg-blue-500/20 text-blue-400',
  REJECTED: 'bg-red-500/20 text-red-400',
  WITHDRAWN: 'bg-gray-500/20 text-gray-400',
  CONVERTED_TO_TRADE: 'bg-purple-500/20 text-purple-400',
  EXPIRED: 'bg-gray-500/20 text-gray-400',
};

const BIDDING_STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-green-400 bg-green-500/10',
  ALLOCATED: 'text-blue-400 bg-blue-500/10',
  SELLER_REVIEWING: 'text-yellow-400 bg-yellow-500/10',
  HARVEST_CONFIRMED: 'text-purple-400 bg-purple-500/10',
  CONVERTED_TO_TRADE: 'text-gray-400 bg-gray-500/10',
  CLOSED: 'text-gray-400 bg-gray-500/10',
  CANCELLED: 'text-red-400 bg-red-500/10',
};

// ── Harvest Information Banner ───────────────────────────────────────────────

function HarvestInfoBanner({ pred }: { pred: any }) {
  const { seller_maturity_at, seller_note } = pred;
  const harvestReady = isHarvestAvailable(pred);

  return (
    <div className="mt-3 p-3 bg-black/20 rounded-lg border border-white/10 text-sm space-y-1.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-1">
          <Calendar size={12} /> Harvest Information
        </div>
        <div>
          {harvestReady ? (
            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
              <CheckCircle2 size={12} /> Harvest Available
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              Awaiting Harvest Availability
            </span>
          )}
        </div>
      </div>

      {seller_maturity_at && (
        <div className="flex items-center gap-2">
          <span className="opacity-60 w-36 flex-shrink-0 flex items-center gap-1"><Calendar size={11} /> Expected Harvest:</span>
          <span className="font-medium">{fmtDate(seller_maturity_at)}</span>
        </div>
      )}
      {pred.harvest_available_at && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span className="opacity-80 w-36 flex-shrink-0 flex items-center gap-1"><CheckCircle2 size={11} /> Availability Declared:</span>
          <span className="font-medium">{fmtDate(pred.harvest_available_at)}</span>
          <span className="opacity-60">({pred.availability_source || 'SELLER_DECLARATION'})</span>
        </div>
      )}
      {seller_note && (
        <div className="pt-1.5 border-t border-white/10 opacity-80 text-xs">{seller_note}</div>
      )}
    </div>
  );
}

// ── Accept Modal ──────────────────────────────────────────────────────────────

function AcceptModal({ bid, unit, onAccept, onClose }: { bid: any; unit: string; onAccept: (bidId: string) => Promise<void>; onClose: () => void }) {
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
        <h2 className="text-xl font-bold mb-4">Accept Offer</h2>
        <p className="text-sm opacity-80 mb-4">
          Accepting this offer creates a <strong>provisional agreement</strong> for <strong>{bid.desired_quantity} {unit}</strong> @ ₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}.
        </p>
        <p className="text-xs opacity-60 mb-4">
          Note: Provisional agreements wait until harvest availability before trade conversion.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>Confirm Accept</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Counteroffer Modal ────────────────────────────────────────────────────────

function CounterofferModal({ bid, remaining, unit, onCounter, onClose }: { bid: any; remaining: number; unit: string; onCounter: (bidId: string, qty: number, price: number, msg: string) => Promise<void>; onClose: () => void }) {
  const [qty, setQty] = useState(String(bid.desired_quantity));
  const [price, setPrice] = useState(String(bid.offered_price_per_unit));
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseInt(qty);
    const numPrice = parseFloat(price);
    if (!numQty || numQty <= 0 || numQty > remaining) { setErr(`Enter a quantity between 1 and ${remaining} ${unit}.`); return; }
    if (!numPrice || numPrice <= 0) { setErr('Enter a valid price.'); return; }
    setSubmitting(true);
    await onCounter(bid.id, numQty, numPrice, msg);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 sm:p-6">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Make Counteroffer</h2>
        <p className="text-sm opacity-80 mb-4">Buyer current terms: <strong>{bid.desired_quantity} {unit}</strong> @ ₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}.</p>
        {err && <Alert variant="error" className="mb-3">{err}</Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Counter Quantity ({unit}) (Max {remaining})</label>
            <Input type="number" min="1" max={remaining} value={qty} onChange={(e: any) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Counter Price (₦/{unit})</label>
            <Input type="number" step="0.01" min="1" value={price} onChange={(e: any) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Message to Buyer</label>
            <Input value={msg} onChange={(e: any) => setMsg(e.target.value)} placeholder="e.g., I can provide 500 units at this reference price." />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>Send Counteroffer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SellerBulkBiddingSalePage() {
  const { profile } = useAuthStore();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState<{ id: string; msg: string } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<{ id: string; msg: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingBidId, setProcessingBidId] = useState<string | null>(null);
  const [processingListingId, setProcessingListingId] = useState<string | null>(null);

  const [acceptModal, setAcceptModal] = useState<{ bid: any; unit: string } | null>(null);
  const [counterModal, setCounterModal] = useState<{ bid: any; remaining: number; unit: string } | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await getSellerBidListings(supabase, profile.id);
    if (fetchError) {
      setError('Failed to load listings: ' + fetchError.message);
    } else {
      setListings(data || []);
      if (data && data.length > 0 && !expandedId) setExpandedId(data[0].id);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const notify = (predId: string, msg: string, isError = false) => {
    if (isError) setActionError({ id: predId, msg });
    else setActionSuccess({ id: predId, msg });
    setTimeout(() => { setActionError(null); setActionSuccess(null); }, 5000);
  };

  // ── Seller actions ──────────────────────────────────────────────────────────

  const handleDeclareHarvestAvailable = async (predId: string) => {
    if (!window.confirm('Declare physical harvest available now? This allows evidence submission and trade conversion for accepted provisional agreements.')) return;
    setProcessingListingId(predId);
    const { error } = await declareHarvestAvailable(supabase, predId);
    if (error) notify(predId, error.message, true);
    else { notify(predId, 'Harvest declared available!'); await load(); }
    setProcessingListingId(null);
  };

  const handleReject = async (predId: string, bidId: string) => {
    if (!window.confirm('Reject this offer?')) return;
    setProcessingBidId(bidId);
    const { error } = await rejectOffer(supabase, bidId);
    if (error) notify(predId, error.message, true);
    else { notify(predId, 'Offer rejected.'); await load(); }
    setProcessingBidId(null);
  };

  const handleAccept = async (bidId: string) => {
    const pred = listings.find((l) => l.harvest_bids?.some((b: any) => b.id === bidId));
    setAcceptModal(null);
    setProcessingBidId(bidId);
    const { error } = await acceptOffer(supabase, bidId);
    if (error) notify(pred?.id || '', error.message, true);
    else { notify(pred?.id || '', 'Offer accepted as provisional agreement!'); await load(); }
    setProcessingBidId(null);
  };

  const handleCounter = async (bidId: string, qty: number, price: number, msg: string) => {
    const pred = listings.find((l) => l.harvest_bids?.some((b: any) => b.id === bidId));
    setCounterModal(null);
    setProcessingBidId(bidId);
    const { error } = await counterHarvestBid(supabase, { bidId, counterPrice: price, counterQuantity: qty, message: msg });
    if (error) notify(pred?.id || '', error.message, true);
    else { notify(pred?.id || '', 'Counteroffer sent.'); await load(); }
    setProcessingBidId(null);
  };

  const handleCancelProvisional = async (predId: string, bidId: string) => {
    const reason = window.prompt('Reason for cancelling this provisional agreement?', 'Cancelled by seller before trade establishment');
    if (reason === null) return;
    setProcessingBidId(bidId);
    const { error } = await cancelProvisionalAgreement(supabase, bidId, reason);
    if (error) notify(predId, error.message, true);
    else { notify(predId, 'Provisional agreement cancelled.'); await load(); }
    setProcessingBidId(null);
  };

  const handleHideBid = async (predId: string, bidId: string) => {
    setProcessingBidId(bidId);
    const { error } = await deleteBid(supabase, bidId);
    if (error) notify(predId, error.message, true);
    else { notify(predId, 'Bid record hidden.'); await load(); }
    setProcessingBidId(null);
  };

  const handleConvert = async (predId: string) => {
    if (!window.confirm('Convert accepted bids into trade requests? Buyers will be requested to provide pickup/delivery details and camera evidence.')) return;
    setConvertingId(predId);
    const { error } = await convertBidsToTrades(supabase, predId);
    if (error) notify(predId, error.message, true);
    else { notify(predId, 'Bids converted to trade requests!'); await load(); }
    setConvertingId(null);
  };

  const handleCloseListing = async (predId: string, allocId: string) => {
    if (!allocId) { alert('Cannot close: Missing allocation ID for this listing.'); return; }
    if (!window.confirm('Close this listing? This will end the bidding cycle.')) return;
    setProcessingListingId(predId);
    const { data, error } = await closeCropAllocationBidding(supabase, allocId);
    if (error) notify(predId, error.message, true);
    else if (data?.success === false) notify(predId, data.error, true);
    else { notify(predId, 'Listing closed.'); load(); }
    setProcessingListingId(null);
  };

  const handleCancelSale = async (predId: string) => {
    if (!window.confirm('Cancel this Bulk Bidding Sale? All pending bids will be rejected and the listing will be closed.')) return;
    setProcessingListingId(predId);
    const { error } = await cancelBulkSale(supabase, predId);
    if (error) notify(predId, error.message, true);
    else { notify(predId, 'Sale cancelled.'); load(); }
    setProcessingListingId(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Bulk Bidding Sale</h1>
          <p className="opacity-70 mt-1">Review buyer bids, manage provisional agreements, and declare harvest availability.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}><RefreshCw size={14} className="mr-1" /> Refresh</Button>
          <Link href="/dashboard/seller/sell"><Button variant="primary" size="sm">+ New Listing</Button></Link>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[var(--agri-primary)]" size={32} /></div>
      ) : listings.length === 0 ? (
        <Card className="text-center p-12">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-bold mb-2">No Active Listings</h2>
          <p className="opacity-60 mb-6">Create a Bulk Bidding Sale to start receiving buyer bids on your harvest.</p>
          <Link href="/dashboard/seller/sell">
            <Button variant="primary">Create Listing <ArrowRight size={16} className="ml-2" /></Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {listings.map((pred) => {
            const stats = calcStats(pred);
            const unit = pred.expected_quantity_unit || 'units';
            const bids: any[] = pred.harvest_bids || [];
            const isExpanded = expandedId === pred.id;
            const biddingColor = BIDDING_STATUS_COLOR[pred.bidding_status] || 'text-gray-400 bg-gray-500/10';
            const harvestReady = isHarvestAvailable(pred);

            const pendingBids = bids.filter((b) => b.bid_status === 'PENDING' || b.bid_status === 'BUYER_COUNTERED' || b.bid_status === 'SELLER_COUNTERED');
            const acceptedBids = bids.filter((b) => ['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(b.bid_status));
            const closedBids = bids.filter((b) => ['REJECTED', 'WITHDRAWN', 'CONVERTED_TO_TRADE', 'EXPIRED'].includes(b.bid_status));

            const isTerminal = ['CANCELLED', 'CLOSED', 'CONVERTED_TO_TRADE'].includes(pred.bidding_status);
            const isLocked = processingListingId === pred.id;

            return (
              <ErrorBoundary key={pred.id}>
                <Card className={`border-l-4 ${
                  harvestReady ? 'border-l-green-500' :
                  pred.bidding_status === 'CANCELLED' ? 'border-l-red-500' :
                  'border-l-blue-500'
                }`}>
                  {/* Header */}
                  <div
                    className="flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer p-2 hover:bg-white/5 rounded transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : pred.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Layers size={20} className="text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold">
                            {pred.farms?.name || 'Farm'} — {pred.farm_crop_allocations?.crop_type || pred.crop_type || 'Crop'}
                          </h2>
                          <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${biddingColor}`}>
                            {pred.bidding_status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm opacity-60 mt-0.5">
                          {bids.length} bid(s) · {new Date(pred.created_at).toLocaleDateString()}
                          {pred.asking_price_per_unit && ` · Asking ₦${Number(pred.asking_price_per_unit).toLocaleString()}/${unit}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronUp size={18} className="opacity-50" /> : <ChevronDown size={18} className="opacity-50" />}
                    </div>
                  </div>

                  {/* Harvest Information Banner */}
                  <HarvestInfoBanner pred={pred} />

                  {/* Quantity Stats */}
                  <div className={`grid gap-3 mt-4 p-4 bg-black/20 rounded-lg text-center ${stats.converted > 0 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Listed Quantity</div>
                      <div className="font-bold text-lg">{stats.total} <span className="text-xs opacity-70">{unit}</span></div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Provisionally Accepted</div>
                      <div className="font-bold text-lg text-green-400">{stats.accepted} <span className="text-xs opacity-70">{unit}</span></div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Remaining</div>
                      <div className="font-bold text-lg text-blue-400">{stats.remaining} <span className="text-xs opacity-70">{unit}</span></div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Pending Bids</div>
                      <div className="font-bold text-lg text-yellow-400">{stats.pending} <span className="text-xs opacity-70">{unit}</span></div>
                    </div>
                    {stats.converted > 0 && (
                      <div>
                        <div className="text-xs opacity-60 mb-1">Converted to Trade</div>
                        <div className="font-bold text-lg text-purple-400">{stats.converted} <span className="text-xs opacity-70">{unit}</span></div>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {stats.total > 0 && (
                    <div className="mt-2 relative h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all" style={{ width: `${(stats.accepted / stats.total) * 100}%` }} />
                    </div>
                  )}

                  {/* Action feedback */}
                  {actionError?.id === pred.id && <Alert variant="error" className="mt-3">{actionError?.msg}</Alert>}
                  {actionSuccess?.id === pred.id && <Alert variant="success" className="mt-3">{actionSuccess?.msg}</Alert>}

                  {/* Expanded bids section */}
                  {isExpanded && (
                    <div className="mt-5 space-y-4 border-t border-white/10 pt-5">

                      {/* Seller action buttons */}
                      <div className="flex flex-wrap gap-2">
                        {/* Declare Harvest Available Action */}
                        {!harvestReady && !isTerminal && (
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleDeclareHarvestAvailable(pred.id)}
                              disabled={isLocked || acceptedBids.length === 0}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                              title={acceptedBids.length === 0 ? 'Accept a provisional agreement first to declare harvest availability.' : undefined}
                            >
                              {isLocked ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sprout size={14} className="mr-1" />}
                              Declare Harvest Available
                            </Button>
                            {acceptedBids.length === 0 && (
                              <span className="text-[11px] opacity-60 text-yellow-400">
                                Accept a bid first to enable declaration.
                              </span>
                            )}
                          </div>
                        )}

                        {/* Convert to Trade Requests */}
                        {harvestReady && acceptedBids.length > 0 && !isTerminal && (
                          <Button variant="primary" size="sm" onClick={() => handleConvert(pred.id)} disabled={convertingId === pred.id}>
                            {convertingId === pred.id ? <Loader2 className="animate-spin mr-1" size={14} /> : <ArrowRight size={14} className="mr-1" />}
                            Convert to Trade Requests
                          </Button>
                        )}

                        {pred.bidding_status === 'CONVERTED_TO_TRADE' && (
                          <Link href="/dashboard/seller/requests">
                            <Button variant="secondary" size="sm"><ArrowRight size={14} className="mr-1" /> View in My Requests</Button>
                          </Link>
                        )}

                        {pred.bidding_status === 'OPEN' && pred.crop_allocation_id && (
                          <Button
                            variant="secondary" size="sm"
                            onClick={() => handleCloseListing(pred.id, pred.crop_allocation_id)}
                            disabled={isLocked}
                            className="text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
                          >
                            {isLocked ? <Loader2 className="animate-spin mr-1" size={14} /> : <XCircle size={14} className="mr-1" />}
                            Close Bidding
                          </Button>
                        )}

                        {!isTerminal && (
                          <Button
                            variant="secondary" size="sm"
                            onClick={() => handleCancelSale(pred.id)}
                            disabled={isLocked}
                            className="text-red-400 bg-red-500/10 hover:bg-red-500/20"
                          >
                            {isLocked ? <Loader2 className="animate-spin mr-1" size={14} /> : <Ban size={14} className="mr-1" />}
                            Cancel Sale
                          </Button>
                        )}
                      </div>

                      {bids.length === 0 && (
                        <p className="text-sm opacity-50 text-center py-4">No bids received yet. Share your listing with buyers.</p>
                      )}

                      {/* Pending Bids */}
                      {pendingBids.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Pending Bids ({pendingBids.length})</h3>
                          <div className="space-y-2">
                            {pendingBids.map((bid: any) => (
                              <div key={bid.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                                <div className="flex-1">
                                  <div className="font-medium">{bid?.buyer?.full_name || bid?.buyer_profile?.full_name || 'Buyer'}</div>
                                  {bid?.id && <NegotiationHistory bidId={bid.id} />}
                                  <div className="text-sm opacity-70">
                                    Wants: <strong>{bid.desired_quantity} {unit}</strong> · Offers: <strong>₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}</strong>
                                    {' '}· Total: <strong>₦{Number(bid.total_offer_value).toLocaleString()}</strong>
                                  </div>
                                  {bid.bid_status === 'SELLER_COUNTERED' && (
                                    <div className="text-xs text-yellow-400 mt-1">Waiting for buyer to review your counteroffer.</div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {(bid.bid_status === 'PENDING' || bid.bid_status === 'BUYER_COUNTERED') && (
                                    <>
                                      <Button size="sm" variant="primary" disabled={processingBidId === bid.id || stats.remaining <= 0} onClick={() => setAcceptModal({ bid, unit })}>
                                        {processingBidId === bid.id ? <Loader2 size={14} className="animate-spin" /> : 'Accept'}
                                      </Button>
                                      <Button size="sm" variant="secondary" disabled={processingBidId === bid.id || stats.remaining <= 0} onClick={() => setCounterModal({ bid, remaining: stats.remaining, unit })}>
                                        Counter
                                      </Button>
                                      <Button size="sm" variant="danger" disabled={processingBidId === bid.id} onClick={() => handleReject(pred.id, bid.id)} className="text-red-400 hover:bg-red-500/10 bg-transparent border border-red-400/30">
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Provisional Agreements */}
                      {acceptedBids.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Provisional Agreements ({acceptedBids.length})</h3>
                          <div className="space-y-2">
                            {acceptedBids.map((bid: any) => (
                              <div key={bid.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    <span>{bid?.buyer_profile?.full_name || 'Buyer'}</span>
                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold uppercase border border-green-500/30">
                                      Provisional Agreement Accepted
                                    </span>
                                  </div>
                                  {bid?.id && <NegotiationHistory bidId={bid.id} />}
                                  <div className="text-sm opacity-70 mt-1">
                                    Accepted: <strong className="text-green-400">{bid.accepted_quantity} {unit}</strong>
                                    {bid.bid_status === 'PARTIALLY_ACCEPTED' && <span className="text-xs text-yellow-400 ml-2">(Partial — requested {bid.desired_quantity})</span>}
                                    {' '}· ₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}
                                  </div>
                                  <div className="text-xs opacity-60 mt-1">
                                    {harvestReady ? (
                                      <span className="text-green-400 font-medium">Eligible for evidence submission & trade conversion.</span>
                                    ) : (
                                      <span>Waiting for expected harvest date or <em>Declare Harvest Available</em>.</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="secondary" disabled={processingBidId === bid.id} onClick={() => handleCancelProvisional(pred.id, bid.id)} className="text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs">
                                    {processingBidId === bid.id ? <Loader2 size={12} className="animate-spin" /> : 'Cancel Agreement'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Closed Bids */}
                      {closedBids.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Closed Bids ({closedBids.length})</h3>
                          <div className="space-y-2">
                            {closedBids.map((bid: any) => (
                              <div key={bid.id} className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-lg opacity-80">
                                <div>
                                  <div className="text-sm font-medium">{bid.buyer_profile?.full_name || 'Buyer'} · {bid.desired_quantity} {unit}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${BID_STATUS_STYLES[bid?.bid_status || 'UNKNOWN'] || 'bg-gray-500/20'}`}>
                                    {(bid?.bid_status || 'UNKNOWN').replace(/_/g, ' ')}
                                  </span>
                                  <Button size="sm" variant="ghost" disabled={processingBidId === bid.id} onClick={() => handleHideBid(pred.id, bid.id)} className="text-xs opacity-60 hover:opacity-100 h-6 px-2">
                                    Hide
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </ErrorBoundary>
            );
          })}
        </div>
      )}

      {/* Accept Modal */}
      {acceptModal && (
        <AcceptModal bid={acceptModal.bid} unit={acceptModal.unit} onAccept={handleAccept} onClose={() => setAcceptModal(null)} />
      )}
      {counterModal && (
        <CounterofferModal bid={counterModal.bid} remaining={counterModal.remaining} unit={counterModal.unit} onCounter={handleCounter} onClose={() => setCounterModal(null)} />
      )}
    </PageContainer>
  );
}
