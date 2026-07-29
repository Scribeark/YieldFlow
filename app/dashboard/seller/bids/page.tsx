'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import {
  getSellerBidListings,
  rejectHarvestBid,
  allocateHarvestBid,
  confirmPredictedHarvest,
  convertBidsToTrades
} from '@/lib/api/farms';
import {
  Activity, Layers, RefreshCw, Loader2, CheckCircle, XCircle,
  ChevronDown, ChevronUp, MapPin, AlertTriangle, ArrowRight, Package
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcStats(prediction: any) {
  const bids: any[] = prediction.harvest_bids || [];
  const total = prediction.expected_quantity_volume || 0;
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
};

// ── Accept Modal ──────────────────────────────────────────────────────────────

function AcceptModal({
  bid,
  remaining,
  unit,
  onAccept,
  onClose,
}: {
  bid: any;
  remaining: number;
  unit: string;
  onAccept: (bidId: string, qty: number) => Promise<void>;
  onClose: () => void;
}) {
  const max = Math.min(bid.desired_quantity, remaining);
  const [qty, setQty] = useState(String(bid.desired_quantity));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(qty);
    if (!num || num <= 0 || num > max) {
      setErr(`Enter a quantity between 1 and ${max} ${unit}.`);
      return;
    }
    setSubmitting(true);
    await onAccept(bid.id, num);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-[9999] p-4 pt-[10vh] overflow-y-auto">
      <Card className="w-full max-w-md my-8">
        <h2 className="text-xl font-bold mb-4">Accept Bid</h2>
        <p className="text-sm opacity-80 mb-4">
          Buyer requested <strong>{bid.desired_quantity} {unit}</strong> @ ₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}.<br />
          Max you can accept: <strong>{max} {unit}</strong> (remaining pool).
        </p>
        {err && <Alert variant="error" className="mb-3">{err}</Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Accepted Quantity ({unit})</label>
            <Input type="number" min="1" max={max} value={qty} onChange={(e) => setQty(e.target.value)} />
            {parseInt(qty) < bid.desired_quantity && parseInt(qty) > 0 && (
              <p className="text-xs text-yellow-400 mt-1">Partial acceptance — bid will be marked PARTIALLY_ACCEPTED.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Confirm Accept
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Confirm Harvest Modal ─────────────────────────────────────────────────────

function ConfirmHarvestModal({
  prediction,
  onConfirm,
  onClose,
}: {
  prediction: any;
  onConfirm: (params: { predictionId: string; finalQuantity: number; pickupAddress: string; pickupLatitude: number; pickupLongitude: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(String(prediction.expected_quantity_volume || ''));
  const [address, setAddress] = useState(prediction.farms?.physical_address || '');
  const [lat, setLat] = useState(String(prediction.farms?.latitude || '8.1333'));
  const [lng, setLng] = useState(String(prediction.farms?.longitude || '4.2667'));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) { setErr('Pickup address is required.'); return; }
    setSubmitting(true);
    await onConfirm({
      predictionId: prediction.id,
      finalQuantity: parseInt(qty),
      pickupAddress: address,
      pickupLatitude: parseFloat(lat) || 8.1333,
      pickupLongitude: parseFloat(lng) || 4.2667,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-[9999] p-4 pt-[10vh] overflow-y-auto">
      <Card className="w-full max-w-md my-8">
        <h2 className="text-xl font-bold mb-2">Confirm Harvest Ready</h2>
        <p className="text-sm opacity-80 mb-4">Confirm the actual harvest quantity and pickup details. This will lock in the allocation and allow conversion to trade requests.</p>
        {err && <Alert variant="error" className="mb-3">{err}</Alert>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Final Harvest Quantity ({prediction.expected_quantity_unit})</label>
            <Input required type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block flex items-center"><MapPin size={13} className="mr-1" /> Pickup Address</label>
            <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Physical farm / pickup address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Latitude</label>
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="8.1333" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Longitude</label>
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="4.2667" />
            </div>
          </div>
          <p className="text-xs opacity-50">Coordinates are used for logistics matching. Default values are pre-filled from your farm record.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle size={16} className="mr-1" />}
              Confirm Harvest
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SellerBidManagementPage() {
  const { profile } = useAuthStore();

  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState<{ id: string; msg: string } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<{ id: string; msg: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingBidId, setProcessingBidId] = useState<string | null>(null);

  // Modal states
  const [acceptModal, setAcceptModal] = useState<{ bid: any; remaining: number; unit: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<any | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await getSellerBidListings(supabase, profile.id);
    if (fetchError) {
      setError('Failed to load bid listings: ' + fetchError.message);
    } else {
      setListings(data || []);
      // auto-expand first listing
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

  const handleReject = async (predId: string, bidId: string) => {
    if (!window.confirm('Reject this bid? The buyer will be notified.')) return;
    setProcessingBidId(bidId);
    const { error } = await rejectHarvestBid(supabase, bidId);
    if (error) notify(predId, error.message, true);
    else { notify(predId, 'Bid rejected.'); await load(); }
    setProcessingBidId(null);
  };

  const handleAccept = async (bidId: string, qty: number) => {
    const pred = listings.find((l) => l.harvest_bids?.some((b: any) => b.id === bidId));
    setAcceptModal(null);
    setProcessingBidId(bidId);
    const { error } = await allocateHarvestBid(supabase, bidId, qty);
    if (error) notify(pred?.id || '', error.message, true);
    else { notify(pred?.id || '', `Bid accepted: ${qty} ${pred?.expected_quantity_unit}.`); await load(); }
    setProcessingBidId(null);
  };

  const handleConfirmHarvest = async (params: any) => {
    setConfirmModal(null);
    const { error } = await confirmPredictedHarvest(supabase, params);
    if (error) notify(params.predictionId, error.message, true);
    else { notify(params.predictionId, 'Harvest confirmed! You can now convert accepted bids to trade requests.'); await load(); }
  };

  const handleConvert = async (predId: string) => {
    if (!window.confirm('Convert all accepted bids into trade requests? Buyers will be notified to submit delivery details.')) return;
    setConvertingId(predId);
    const { error } = await convertBidsToTrades(supabase, predId);
    if (error) notify(predId, error.message, true);
    else { notify(predId, 'Bids converted to trade requests! Sellers should upload evidence.'); await load(); }
    setConvertingId(null);
  };

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Bid Management</h1>
          <p className="opacity-70 mt-1">Review, accept, and reject buyer bids on your harvest listings.</p>
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
          <h2 className="text-xl font-bold mb-2">No Active Listings with Bids</h2>
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
            const isIoT = pred.bidding_origin !== 'MANUAL';
            const biddingColor = BIDDING_STATUS_COLOR[pred.bidding_status] || 'text-gray-400 bg-gray-500/10';
            const pendingBids = bids.filter((b) => b.bid_status === 'PENDING');
            const acceptedBids = bids.filter((b) => ['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(b.bid_status));
            const closedBids = bids.filter((b) => ['REJECTED', 'WITHDRAWN', 'CONVERTED_TO_TRADE', 'EXPIRED'].includes(b.bid_status));

            const canConfirm = pred.bidding_status === 'ALLOCATED' && acceptedBids.length > 0;
            const canConvert = pred.bidding_status === 'HARVEST_CONFIRMED';

            return (
              <Card key={pred.id} className="overflow-hidden">
                {/* Header */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : pred.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isIoT ? 'bg-green-500/10' : 'bg-purple-500/10'}`}>
                      {isIoT ? <Activity size={20} className="text-green-400" /> : <Layers size={20} className="text-purple-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold">{pred.farms?.name || 'Farm'} — {pred.farms?.crop_type || 'Crop'}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${biddingColor}`}>{pred.bidding_status}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${isIoT ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}`}>
                          {isIoT ? 'IoT Predicted' : 'Manual Listing'}
                        </span>
                      </div>
                      <p className="text-sm opacity-60 mt-0.5">{bids.length} bid(s) · {new Date(pred.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronUp size={18} className="opacity-50" /> : <ChevronDown size={18} className="opacity-50" />}
                  </div>
                </div>

                {/* Quantity Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-4 bg-black/20 rounded-lg text-center">
                  <div>
                    <div className="text-xs opacity-60 mb-1">Total Listed</div>
                    <div className="font-bold text-lg">{stats.total} <span className="text-xs opacity-70">{unit}</span></div>
                  </div>
                  <div>
                    <div className="text-xs opacity-60 mb-1">Accepted</div>
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
                </div>

                {/* Quantity progress bar */}
                {stats.total > 0 && (
                  <div className="mt-2 relative h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all" style={{ width: `${(stats.accepted / stats.total) * 100}%` }} />
                  </div>
                )}

                {/* Action errors/successes */}
                {actionError?.id === pred.id && <Alert variant="error" className="mt-3">{actionError?.msg}</Alert>}
                {actionSuccess?.id === pred.id && <Alert variant="success" className="mt-3">{actionSuccess?.msg}</Alert>}

                {/* Expanded bids */}
                {isExpanded && (
                  <div className="mt-5 space-y-4 border-t border-white/10 pt-5">

                    {/* Seller action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {canConfirm && (
                        <Button variant="accent" size="sm" onClick={() => setConfirmModal(pred)}>
                          <CheckCircle size={14} className="mr-1" /> Confirm Harvest Ready
                        </Button>
                      )}
                      {canConvert && (
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
                    </div>

                    {bids.length === 0 && (
                      <p className="text-sm opacity-50 text-center py-4">No bids received yet. Share your listing with buyers.</p>
                    )}

                    {pendingBids.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Pending Bids ({pendingBids.length})</h3>
                        <div className="space-y-2">
                          {pendingBids.map((bid: any) => (
                            <div key={bid.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                              <div className="flex-1">
                                <div className="font-medium">{bid.buyer_profile?.full_name || 'Buyer'}</div>
                                <div className="text-sm opacity-70">
                                  Wants: <strong>{bid.desired_quantity} {unit}</strong> · Offers: <strong>₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}</strong>
                                  {' '}· Total: <strong>₦{Number(bid.total_offer_value).toLocaleString()}</strong>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm" variant="primary"
                                  disabled={processingBidId === bid.id || stats.remaining <= 0}
                                  onClick={() => setAcceptModal({ bid, remaining: stats.remaining, unit })}
                                >
                                  {processingBidId === bid.id ? <Loader2 size={14} className="animate-spin" /> : 'Accept'}
                                </Button>
                                <Button
                                  size="sm" variant="danger"
                                  disabled={processingBidId === bid.id}
                                  onClick={() => handleReject(pred.id, bid.id)}
                                  className="text-red-400 hover:bg-red-500/10 bg-transparent border border-red-400/30"
                                >
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {acceptedBids.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Accepted Bids ({acceptedBids.length})</h3>
                        <div className="space-y-2">
                          {acceptedBids.map((bid: any) => (
                            <div key={bid.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                              <div>
                                <div className="font-medium">{bid.buyer_profile?.full_name || 'Buyer'}</div>
                                <div className="text-sm opacity-70">
                                  Accepted: <strong className="text-green-400">{bid.accepted_quantity} {unit}</strong>
                                  {bid.bid_status === 'PARTIALLY_ACCEPTED' && <span className="text-xs text-yellow-400 ml-2">(Partial — requested {bid.desired_quantity})</span>}
                                  {' '}· ₦{Number(bid.offered_price_per_unit).toLocaleString()}/{unit}
                                </div>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${BID_STATUS_STYLES[bid.bid_status] || ''}`}>{bid.bid_status.replace('_', ' ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {closedBids.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Closed Bids ({closedBids.length})</h3>
                        <div className="space-y-2">
                          {closedBids.map((bid: any) => (
                            <div key={bid.id} className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-lg opacity-60">
                              <div>
                                <div className="text-sm font-medium">{bid.buyer_profile?.full_name || 'Buyer'} · {bid.desired_quantity} {unit}</div>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${BID_STATUS_STYLES[bid.bid_status] || ''}`}>{bid.bid_status.replace('_', ' ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Accept Modal */}
      {acceptModal && (
        <AcceptModal
          bid={acceptModal.bid}
          remaining={acceptModal.remaining}
          unit={acceptModal.unit}
          onAccept={handleAccept}
          onClose={() => setAcceptModal(null)}
        />
      )}

      {/* Confirm Harvest Modal */}
      {confirmModal && (
        <ConfirmHarvestModal
          prediction={confirmModal}
          onConfirm={handleConfirmHarvest}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </PageContainer>
  );
}
