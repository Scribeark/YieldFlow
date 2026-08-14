'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { NegotiationHistory } from '@/components/shared/NegotiationHistory';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { HarvestPhotoModal } from '@/components/shared/HarvestPhotoModal';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import {
  getSellerBidListings,
  rejectOffer,
  acceptOffer,
  counterHarvestBid,
  cancelProvisionalAgreement,
  deleteBid,
  cancelBulkOfftakeListing,
  hideBulkOfftakeListing,
  declareHarvestAvailable,
} from '@/lib/api/farms';
import {
  Layers, RefreshCw, Loader2,
  ChevronDown, ChevronUp, AlertTriangle, ArrowRight,
  Package, Calendar, Ban, CheckCircle2, Sprout, Camera, EyeOff, MapPin, Archive
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
          <h2 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle /> Something went wrong rendering this section
          </h2>
          <p className="text-sm opacity-80">{this.state.error?.message}</p>
          <Button variant="secondary" className="mt-4" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

// ── Authoritative Quantity Accounting Helper ──────────────────────────────────

function calcStats(listing: any) {
  const bids: any[] = Array.isArray(listing?.harvest_bids) ? listing.harvest_bids : [];
  const total = Number(listing.listed_quantity || listing.expected_quantity_max || listing.expected_quantity_volume || 0);

  const accepted = bids
    .filter((b) => ['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(b.bid_status))
    .reduce((sum, b) => sum + Number(b.accepted_quantity || b.desired_quantity || 0), 0);

  const pending = bids
    .filter((b) => ['PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED'].includes(b.bid_status))
    .reduce((sum, b) => sum + Number(b.desired_quantity || 0), 0);

  const converted = bids
    .filter((b) => b.bid_status === 'CONVERTED_TO_TRADE')
    .reduce((sum, b) => sum + Number(b.accepted_quantity || b.desired_quantity || 0), 0);

  const remaining = Math.max(0, total - accepted - converted);

  return {
    total,
    accepted,
    established: converted,
    remaining,
    pending,
    offerCount: bids.length,
  };
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function isHarvestAvailable(listing: any): boolean {
  if (listing.harvest_available_at) return true;
  if (listing.listing_status === 'HARVEST_CONFIRMED' || listing.listing_status === 'CONVERTED_TO_TRADE') return true;
  if (listing.expected_harvest_at && new Date(listing.expected_harvest_at).getTime() <= Date.now()) return true;
  if (listing.seller_maturity_at && new Date(listing.seller_maturity_at).getTime() <= Date.now()) return true;
  return false;
}

const BID_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  BUYER_COUNTERED: 'bg-amber-500/20 text-amber-400',
  SELLER_COUNTERED: 'bg-blue-500/20 text-blue-400',
  ACCEPTED: 'bg-green-500/20 text-green-400',
  PARTIALLY_ACCEPTED: 'bg-teal-500/20 text-teal-400',
  REJECTED: 'bg-red-500/20 text-red-400',
  WITHDRAWN: 'bg-gray-500/20 text-gray-400',
  CONVERTED_TO_TRADE: 'bg-purple-500/20 text-purple-400',
  EXPIRED: 'bg-gray-500/20 text-gray-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

const LISTING_STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-green-400 bg-green-500/10 border-green-500/20',
  ALLOCATED: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  SELLER_REVIEWING: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  HARVEST_CONFIRMED: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  CONVERTED_TO_TRADE: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  CLOSED: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  CANCELLED: 'text-red-400 bg-red-500/10 border-red-500/20',
};

// ── Harvest Information Banner ───────────────────────────────────────────────

function HarvestInfoBanner({ listing }: { listing: any }) {
  const harvestReady = isHarvestAvailable(listing);
  const targetDate = listing.expected_harvest_at || listing.seller_maturity_at;

  return (
    <div className="mt-3 p-3 bg-black/20 rounded-lg border border-white/10 text-sm space-y-1.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-1">
          <Calendar size={12} /> Harvest Timeline & Confirmation
        </div>
        <div>
          {harvestReady ? (
            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
              <CheckCircle2 size={12} /> Harvest Ready for Photo Confirmation
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              Awaiting Expected Harvest Date
            </span>
          )}
        </div>
      </div>

      {targetDate && (
        <div className="flex items-center gap-2">
          <span className="opacity-60 w-44 flex-shrink-0 flex items-center gap-1">
            <Calendar size={11} /> Expected Harvest Date:
          </span>
          <span className="font-medium">{fmtDate(targetDate)}</span>
        </div>
      )}

      {listing.pickup_address && (
        <div className="flex items-center gap-2 text-xs opacity-80">
          <span className="opacity-60 w-44 flex-shrink-0 flex items-center gap-1">
            <MapPin size={11} /> Pickup Location:
          </span>
          <span className="truncate">{listing.pickup_address}</span>
        </div>
      )}

      {listing.harvest_available_at && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span className="opacity-80 w-44 flex-shrink-0 flex items-center gap-1">
            <CheckCircle2 size={11} /> Availability Declared:
          </span>
          <span className="font-medium">{fmtDate(listing.harvest_available_at)}</span>
        </div>
      )}

      {listing.seller_note && (
        <div className="pt-1.5 border-t border-white/10 opacity-80 text-xs">{listing.seller_note}</div>
      )}
    </div>
  );
}

// ── Counteroffer Modal ────────────────────────────────────────────────────────

function CounterofferModal({
  bid,
  remaining,
  unit,
  onCounter,
  onClose,
}: {
  bid: any;
  remaining: number;
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 sm:p-6 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#131722] border-white/20">
        <h2 className="text-xl font-bold mb-3">Make Counteroffer</h2>
        <p className="text-sm opacity-80 mb-4">
          Buyer current terms: <strong>{bid.desired_quantity} {unit}</strong> @ ₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}.
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
            <label className="text-sm font-medium mb-1 block">Message to Buyer</label>
            <Input value={msg} onChange={(e: any) => setMsg(e.target.value)} placeholder="e.g. I can supply this volume at ₦4,500/bag." />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Send Counteroffer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Cancel Listing Modal ──────────────────────────────────────────────────────

function CancelListingModal({
  listingId,
  cropType,
  onConfirm,
  onClose,
}: {
  listingId: string;
  cropType: string;
  onConfirm: (listingId: string, reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('Crop unavailable or terms changed');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const finalReason = reason === 'Other' ? (customReason.trim() || 'Other') : reason;
    await onConfirm(listingId, finalReason);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 sm:p-6 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#131722] border-white/20">
        <h2 className="text-xl font-bold mb-2 text-red-400 flex items-center gap-2">
          <Ban size={20} /> Cancel Listing
        </h2>
        <p className="text-sm opacity-80 mb-4">
          Are you sure you want to cancel the listing for <strong>{cropType}</strong>? Any open purchase offers will be cancelled, and the listing will be moved to history.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Cancellation Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-black/20 border border-white/20 rounded-md p-2 text-white outline-none focus:border-[var(--agri-primary)]"
            >
              <option value="Crop unavailable or terms changed" className="bg-[#1a1f2e]">Crop unavailable or terms changed</option>
              <option value="Harvest yield changed" className="bg-[#1a1f2e]">Harvest yield changed</option>
              <option value="Sold through private channel" className="bg-[#1a1f2e]">Sold through private channel</option>
              <option value="Logistics/Location issue" className="bg-[#1a1f2e]">Logistics / Location issue</option>
              <option value="Other" className="bg-[#1a1f2e]">Other (specify)</option>
            </select>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="text-sm font-medium mb-1 block">Custom Reason</label>
              <Input
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter cancellation reason..."
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
              Keep Listing
            </Button>
            <Button variant="danger" type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Confirm Cancellation
            </Button>
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

  // Tabs: Active vs History
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Modals
  const [counterModal, setCounterModal] = useState<{ bid: any; remaining: number; unit: string } | null>(null);
  const [cancelModalListing, setCancelModalListing] = useState<{ id: string; cropType: string } | null>(null);
  const [photoModal, setPhotoModal] = useState<{ listingId: string; bidId?: string; cropType: string } | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await getSellerBidListings(supabase, profile.id);
    if (fetchError) {
      setError('Failed to load listings: ' + ((fetchError as any)?.message || 'Unknown error'));
    } else {
      setListings(data || []);
      if (data && data.length > 0 && !expandedId) {
        setExpandedId(data[0].id);
      }
    }
    setLoading(false);
  }, [profile, expandedId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (listingId: string, msg: string, isError = false) => {
    if (isError) setActionError({ id: listingId, msg });
    else setActionSuccess({ id: listingId, msg });
    setTimeout(() => {
      setActionError(null);
      setActionSuccess(null);
    }, 5000);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleDeclareHarvestAvailable = async (listingId: string) => {
    if (!window.confirm('Declare physical harvest ready for photo confirmation?')) return;
    setProcessingListingId(listingId);
    const { error } = await declareHarvestAvailable(supabase, listingId);
    if (error) {
      notify(listingId, (error as any)?.message || 'Failed to declare harvest available', true);
    } else {
      notify(listingId, 'Harvest declared ready! You can now upload a Harvest Confirmation Photo.');
      await load();
    }
    setProcessingListingId(null);
  };

  const handleAccept = async (listingId: string, bidId: string) => {
    setProcessingBidId(bidId);
    const { error } = await acceptOffer(supabase, bidId);
    if (error) {
      notify(listingId, (error as any)?.message || 'Failed to accept offer', true);
    } else {
      notify(listingId, 'Purchase offer accepted as provisional agreement! Trade request record created automatically.');
      await load();
    }
    setProcessingBidId(null);
  };

  const handleReject = async (listingId: string, bidId: string) => {
    if (!window.confirm('Reject this purchase offer?')) return;
    setProcessingBidId(bidId);
    const { error } = await rejectOffer(supabase, bidId);
    if (error) {
      notify(listingId, (error as any)?.message || 'Failed to reject offer', true);
    } else {
      notify(listingId, 'Offer rejected.');
      await load();
    }
    setProcessingBidId(null);
  };

  const handleCounter = async (bidId: string, qty: number, price: number, msg: string) => {
    const listing = listings.find((l) => l.harvest_bids?.some((b: any) => b.id === bidId));
    setCounterModal(null);
    setProcessingBidId(bidId);
    const { error } = await counterHarvestBid(supabase, {
      bidId,
      counterPrice: price,
      counterQuantity: qty,
      message: msg,
    });
    if (error) {
      notify(listing?.id || '', (error as any)?.message || 'Failed to send counteroffer', true);
    } else {
      notify(listing?.id || '', 'Counteroffer sent to buyer.');
      await load();
    }
    setProcessingBidId(null);
  };

  const handleCancelProvisional = async (listingId: string, bidId: string) => {
    const reason = window.prompt('Reason for cancelling this provisional agreement?', 'Cancelled by seller before trade establishment');
    if (reason === null) return;
    setProcessingBidId(bidId);
    const { error } = await cancelProvisionalAgreement(supabase, bidId, reason);
    if (error) {
      notify(listingId, (error as any)?.message || 'Failed to cancel agreement', true);
    } else {
      notify(listingId, 'Provisional agreement cancelled.');
      await load();
    }
    setProcessingBidId(null);
  };

  const handleCancelListing = async (listingId: string, reason: string) => {
    setCancelModalListing(null);
    setProcessingListingId(listingId);
    const { error } = await cancelBulkOfftakeListing(supabase, listingId, reason);
    if (error) {
      notify(listingId, (error as any)?.message || 'Failed to cancel listing', true);
    } else {
      notify(listingId, 'Listing cancelled and moved to history.');
      await load();
    }
    setProcessingListingId(null);
  };

  const handleHideListing = async (listingId: string) => {
    setProcessingListingId(listingId);
    const { error } = await hideBulkOfftakeListing(supabase, listingId);
    if (error) {
      notify(listingId, (error as any)?.message || 'Failed to hide listing', true);
    } else {
      notify(listingId, 'Listing hidden from active view.');
      await load();
    }
    setProcessingListingId(null);
  };

  const handleHideBid = async (listingId: string, bidId: string) => {
    setProcessingBidId(bidId);
    const { error } = await deleteBid(supabase, bidId);
    if (error) {
      notify(listingId, error.message, true);
    } else {
      notify(listingId, 'Bid record hidden.');
      await load();
    }
    setProcessingBidId(null);
  };

  // Filter active vs historical
  const visibleListings = listings.filter((l) => !l.seller_hidden);
  const activeListings = visibleListings.filter((l) => !['CANCELLED', 'CLOSED'].includes(l.listing_status));
  const historicalListings = visibleListings.filter((l) => ['CANCELLED', 'CLOSED'].includes(l.listing_status));
  const displayedListings = activeTab === 'active' ? activeListings : historicalListings;

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            Bulk Bidding Sale
          </h1>
          <p className="opacity-70 mt-1">
            Manage bulk offtake listings, review buyer purchase offers, and submit Harvest Confirmation Photos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
          <Link href="/dashboard/seller/sell">
            <Button variant="primary" size="sm">+ New Listing</Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 border border-white/10 rounded-lg p-1 max-w-xs bg-black/10">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'active' ? 'bg-[var(--agri-primary)] text-white shadow' : 'opacity-60 hover:opacity-100'
          }`}
        >
          Active ({activeListings.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'history' ? 'bg-[var(--agri-primary)] text-white shadow' : 'opacity-60 hover:opacity-100'
          }`}
        >
          History ({historicalListings.length})
        </button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-[var(--agri-primary)]" size={32} />
        </div>
      ) : displayedListings.length === 0 ? (
        <Card className="text-center p-12">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-bold mb-2">
            {activeTab === 'active' ? 'No Active Listings' : 'No Historical Listings'}
          </h2>
          <p className="opacity-60 mb-6">
            {activeTab === 'active'
              ? 'Create a Bulk Bidding Sale to start receiving buyer purchase offers.'
              : 'Closed and cancelled listings will appear here.'}
          </p>
          {activeTab === 'active' && (
            <Link href="/dashboard/seller/sell">
              <Button variant="primary">
                Create Listing <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {displayedListings.map((listing) => {
            const stats = calcStats(listing);
            const unit = listing.quantity_unit || 'bags';
            const bids: any[] = listing.harvest_bids || [];
            const isExpanded = expandedId === listing.id;
            const statusColor = LISTING_STATUS_COLOR[listing.listing_status] || 'text-gray-400 bg-gray-500/10 border-gray-500/20';
            const harvestReady = isHarvestAvailable(listing);

            const pendingBids = bids.filter((b) => ['PENDING', 'BUYER_COUNTERED', 'SELLER_COUNTERED'].includes(b.bid_status));
            const acceptedBids = bids.filter((b) => ['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(b.bid_status));
            const closedBids = bids.filter((b) => ['REJECTED', 'WITHDRAWN', 'CONVERTED_TO_TRADE', 'CANCELLED', 'EXPIRED'].includes(b.bid_status));

            const isTerminal = ['CANCELLED', 'CLOSED'].includes(listing.listing_status);
            const isLocked = processingListingId === listing.id;

            return (
              <ErrorBoundary key={listing.id}>
                <Card
                  className={`border-l-4 ${
                    listing.listing_status === 'CANCELLED'
                      ? 'border-l-red-500'
                      : harvestReady
                      ? 'border-l-green-500'
                      : 'border-l-blue-500'
                  }`}
                >
                  {/* Header */}
                  <div
                    className="flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer p-2 hover:bg-white/5 rounded transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
                        <Layers size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold">{listing.crop_type}</h2>
                          <span className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase border ${statusColor}`}>
                            {listing.listing_status?.replace(/_/g, ' ')}
                          </span>
                          {listing.evidence_status === 'PROVIDED' && (
                            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Photo Provided
                            </span>
                          )}
                        </div>
                        <p className="text-sm opacity-60 mt-0.5">
                          {bids.length} purchase offer(s) · Created {fmtDate(listing.created_at)}
                          {listing.asking_price_per_unit > 0 &&
                            ` · Asking ₦${Number(listing.asking_price_per_unit).toLocaleString()}/${unit}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 md:mt-0">
                      {isExpanded ? <ChevronUp size={18} className="opacity-50" /> : <ChevronDown size={18} className="opacity-50" />}
                    </div>
                  </div>

                  {/* Harvest Info Banner */}
                  <HarvestInfoBanner listing={listing} />

                  {/* Authoritative Global Quantity Display */}
                  <div className={`grid gap-3 mt-4 p-4 bg-black/20 rounded-lg text-center ${stats.established > 0 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Listed Quantity</div>
                      <div className="font-bold text-lg">{stats.total.toLocaleString()} <span className="text-xs opacity-70">{unit}</span></div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Provisionally Agreed</div>
                      <div className="font-bold text-lg text-green-400">{stats.accepted.toLocaleString()} <span className="text-xs opacity-70">{unit}</span></div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Remaining</div>
                      <div className="font-bold text-lg text-blue-400">{stats.remaining.toLocaleString()} <span className="text-xs opacity-70">{unit}</span></div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Pending Offers</div>
                      <div className="font-bold text-lg text-yellow-400">{stats.pending.toLocaleString()} <span className="text-xs opacity-70">{unit}</span></div>
                    </div>
                    {stats.established > 0 && (
                      <div>
                        <div className="text-xs opacity-60 mb-1">Established Trade</div>
                        <div className="font-bold text-lg text-purple-400">{stats.established.toLocaleString()} <span className="text-xs opacity-70">{unit}</span></div>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {stats.total > 0 && (
                    <div className="mt-2 relative h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((stats.accepted + stats.established) / stats.total) * 100)}%` }}
                      />
                    </div>
                  )}

                  {/* Action Feedback */}
                  {actionError?.id === listing.id && <Alert variant="error" className="mt-3">{actionError?.msg}</Alert>}
                  {actionSuccess?.id === listing.id && <Alert variant="success" className="mt-3">{actionSuccess?.msg}</Alert>}

                  {/* Expanded Section */}
                  {isExpanded && (
                    <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        {/* Declare harvest ready */}
                        {!harvestReady && !isTerminal && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleDeclareHarvestAvailable(listing.id)}
                            disabled={isLocked || acceptedBids.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                            title={acceptedBids.length === 0 ? 'Accept a purchase offer first to enable harvest declaration.' : undefined}
                          >
                            {isLocked ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sprout size={14} className="mr-1" />}
                            Declare Harvest Ready
                          </Button>
                        )}

                        {/* Harvest Confirmation Photo Button */}
                        {harvestReady && acceptedBids.length > 0 && !isTerminal && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setPhotoModal({ listingId: listing.id, cropType: listing.crop_type })}
                            className="bg-blue-600 hover:bg-blue-500 text-white"
                          >
                            <Camera size={14} className="mr-1.5" />
                            {listing.evidence_status === 'PROVIDED' ? 'Replace Harvest Confirmation Photo' : 'Upload Harvest Confirmation Photo'}
                          </Button>
                        )}

                        {/* Cancel Listing */}
                        {!isTerminal && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setCancelModalListing({ id: listing.id, cropType: listing.crop_type })}
                            disabled={isLocked}
                            className="text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20"
                          >
                            {isLocked ? <Loader2 className="animate-spin mr-1" size={14} /> : <Ban size={14} className="mr-1" />}
                            Cancel Listing
                          </Button>
                        )}

                        {/* Hide from My Listings for terminal records */}
                        {isTerminal && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleHideListing(listing.id)}
                            disabled={isLocked}
                            className="text-gray-400 bg-gray-500/10 hover:bg-gray-500/20"
                          >
                            <EyeOff size={14} className="mr-1" />
                            Hide from My Listings
                          </Button>
                        )}
                      </div>

                      {/* Harvest Photo Display if already provided */}
                      {listing.harvest_photo_url && (
                        <div className="p-3 bg-black/30 rounded-lg border border-white/10 flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={listing.harvest_photo_url}
                              alt="Harvest Confirmation"
                              className="w-14 h-14 object-cover rounded-md border border-white/20"
                            />
                            <div>
                              <div className="text-xs font-bold text-green-400 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Harvest Confirmation Photo Submitted
                              </div>
                              <div className="text-[11px] opacity-60 mt-0.5">
                                Visible to buyers with provisional agreements for review.
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setPhotoModal({ listingId: listing.id, cropType: listing.crop_type })}
                            className="text-xs h-7"
                          >
                            <RefreshCw size={11} className="mr-1" /> Replace Photo
                          </Button>
                        </div>
                      )}

                      {bids.length === 0 && (
                        <p className="text-sm opacity-50 text-center py-4">
                          No purchase offers received yet. Your listing is visible to commercial buyers on the marketplace.
                        </p>
                      )}

                      {/* Pending Purchase Offers */}
                      {pendingBids.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">
                            Pending Purchase Offers ({pendingBids.length})
                          </h3>
                          <div className="space-y-2">
                            {pendingBids.map((bid: any) => (
                              <div
                                key={bid.id}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {bid?.buyer?.full_name || bid?.buyer_profile?.full_name || 'Commercial Buyer'}
                                  </div>
                                  {bid?.id && <NegotiationHistory bidId={bid.id} />}
                                  <div className="text-sm opacity-70 mt-1">
                                    Wants: <strong>{bid.desired_quantity} {unit}</strong> · Offers: <strong>₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}</strong>
                                    {' '}· Total: <strong>₦{Number(bid.desired_quantity * bid.offered_price_per_unit).toLocaleString()}</strong>
                                  </div>
                                  {bid.bid_status === 'SELLER_COUNTERED' && (
                                    <div className="text-xs text-yellow-400 mt-1">
                                      Waiting for buyer to review your counteroffer.
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {['PENDING', 'BUYER_COUNTERED'].includes(bid.bid_status) && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        disabled={processingBidId === bid.id || stats.remaining <= 0}
                                        onClick={() => handleAccept(listing.id, bid.id)}
                                      >
                                        {processingBidId === bid.id ? <Loader2 size={14} className="animate-spin" /> : 'Accept'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={processingBidId === bid.id || stats.remaining <= 0}
                                        onClick={() => setCounterModal({ bid, remaining: stats.remaining, unit })}
                                      >
                                        Counter
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="danger"
                                        disabled={processingBidId === bid.id}
                                        onClick={() => handleReject(listing.id, bid.id)}
                                        className="text-red-400 hover:bg-red-500/10 bg-transparent border border-red-400/30"
                                      >
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
                          <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">
                            Provisional Offtake Agreements ({acceptedBids.length})
                          </h3>
                          <div className="space-y-2">
                            {acceptedBids.map((bid: any) => (
                              <div
                                key={bid.id}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg"
                              >
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    <span>{bid?.buyer?.full_name || bid?.buyer_profile?.full_name || 'Commercial Buyer'}</span>
                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold uppercase border border-green-500/30">
                                      Provisional Agreement Agreed
                                    </span>
                                  </div>
                                  {bid?.id && <NegotiationHistory bidId={bid.id} />}
                                  <div className="text-sm opacity-70 mt-1">
                                    Quantity: <strong className="text-green-400">{bid.accepted_quantity || bid.desired_quantity} {unit}</strong>
                                    {' '}· Price: <strong>₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}</strong>
                                    {' '}· Total: <strong>₦{Number((bid.accepted_quantity || bid.desired_quantity) * bid.offered_price_per_unit).toLocaleString()}</strong>
                                  </div>
                                  <div className="text-xs opacity-70 mt-1">
                                    {listing.evidence_status === 'PROVIDED' ? (
                                      <span className="text-blue-400">Harvest Confirmation Photo submitted — awaiting buyer review.</span>
                                    ) : harvestReady ? (
                                      <span className="text-emerald-400 font-medium">Ready: Upload Harvest Confirmation Photo to activate buyer review & logistics.</span>
                                    ) : (
                                      <span>Awaiting expected harvest date or <em>Declare Harvest Ready</em>.</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {harvestReady && listing.evidence_status !== 'PROVIDED' && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => setPhotoModal({ listingId: listing.id, bidId: bid.id, cropType: listing.crop_type })}
                                      className="text-xs"
                                    >
                                      <Camera size={12} className="mr-1" /> Add Photo
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={processingBidId === bid.id}
                                    onClick={() => handleCancelProvisional(listing.id, bid.id)}
                                    className="text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs"
                                  >
                                    {processingBidId === bid.id ? <Loader2 size={12} className="animate-spin" /> : 'Cancel Agreement'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Closed / Historical Bids */}
                      {closedBids.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">
                            Closed Offers ({closedBids.length})
                          </h3>
                          <div className="space-y-2">
                            {closedBids.map((bid: any) => (
                              <div
                                key={bid.id}
                                className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-lg opacity-80"
                              >
                                <div>
                                  <div className="text-sm font-medium">
                                    {bid?.buyer?.full_name || bid?.buyer_profile?.full_name || 'Commercial Buyer'} · {bid.desired_quantity} {unit}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${BID_STATUS_STYLES[bid?.bid_status || 'UNKNOWN'] || 'bg-gray-500/20'}`}>
                                    {(bid?.bid_status || 'UNKNOWN').replace(/_/g, ' ')}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={processingBidId === bid.id}
                                    onClick={() => handleHideBid(listing.id, bid.id)}
                                    className="text-xs opacity-60 hover:opacity-100 h-6 px-2"
                                  >
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

      {/* Counter Modal */}
      {counterModal && (
        <CounterofferModal
          bid={counterModal.bid}
          remaining={counterModal.remaining}
          unit={counterModal.unit}
          onCounter={handleCounter}
          onClose={() => setCounterModal(null)}
        />
      )}

      {/* Cancel Listing Modal */}
      {cancelModalListing && (
        <CancelListingModal
          listingId={cancelModalListing.id}
          cropType={cancelModalListing.cropType}
          onConfirm={handleCancelListing}
          onClose={() => setCancelModalListing(null)}
        />
      )}

      {/* Harvest Confirmation Photo Modal */}
      {photoModal && (
        <HarvestPhotoModal
          isOpen={true}
          listingId={photoModal.listingId}
          bidId={photoModal.bidId}
          cropType={photoModal.cropType}
          sellerId={profile?.id || ''}
          onUploadSuccess={() => {
            load();
          }}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </PageContainer>
  );
}
