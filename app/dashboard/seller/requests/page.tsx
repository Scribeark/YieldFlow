'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getSellerTradeRequests, uploadEvidence, TradeRequestRow } from '@/lib/api/seller';
import { uploadHarvestPhoto } from '@/lib/supabase/storage';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { OngoingTradeTimeline } from '@/components/shared/OngoingTradeTimeline';

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const CANCELLATION_REASONS = [
  'Stock no longer available',
  'Harvest quality issue',
  'Price/terms changed',
  'Location or pickup issue',
  'Seller changed mind',
  'Other'
];

const getStageTooltip = (status: string) => {
  switch (status) {
    case 'AWAITING_BUYER':      return 'Listing is open and awaiting buyer confirmation.';
    case 'EVIDENCE_PENDING':    return 'Evidence or exemption is required before buyer confirmation.';
    case 'SEARCHING_LOGISTICS': return 'Buyer and seller agreement is confirmed. Waiting for a logistics provider.';
    case 'ALLOCATED':           return 'Logistics provider has accepted the job. Awaiting pickup confirmation from both seller and carrier.';
    case 'DISPATCHED':          return 'Both seller and carrier have confirmed pickup. Goods are in transit. Normal cancellation is blocked.';
    case 'FULFILLED':           return 'Both carrier and buyer have confirmed delivery. Trade is complete and ready for payment settlement preparation.';
    case 'CANCELLED':           return 'Trade has been withdrawn and is no longer active.';
    default:                    return '';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'AWAITING_BUYER':      return { bg: 'rgba(234,179,8,0.2)',    text: '#eab308' };
    case 'EVIDENCE_PENDING':    return { bg: 'rgba(249,115,22,0.2)',   text: '#f97316' };
    case 'SEARCHING_LOGISTICS': return { bg: 'rgba(59,130,246,0.2)',   text: '#3b82f6' };
    case 'ALLOCATED':           return { bg: 'rgba(168,85,247,0.2)',   text: '#a855f7' };
    case 'DISPATCHED':          return { bg: 'rgba(99,102,241,0.2)',   text: '#6366f1' };
    case 'FULFILLED':           return { bg: 'rgba(16,185,129,0.2)',   text: '#10b981' };
    case 'CANCELLED':           return { bg: 'rgba(107,114,128,0.2)', text: '#6b7280' };
    default:                    return { bg: 'rgba(34,197,94,0.2)',    text: '#22c55e' };
  }
};

export default function MyRequestsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const supabase = createClient();

  const [requests, setRequests] = useState<TradeRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'listings' | 'ongoing' | 'completed' | 'cancelled'>('ongoing');

  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ id: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [pickupConfirmingId, setPickupConfirmingId] = useState<string | null>(null);

  const [cancelModalReqId, setCancelModalReqId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelNote, setCancelNote] = useState<string>('');

  const fetchRequests = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await getSellerTradeRequests(supabase, profile.id, 50);
    if (fetchError) {
      setError(`Failed to load requests: ${fetchError.message}`);
    } else if (data) {
      setRequests(data);
    }
    setIsLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, [fetchRequests]);

  const handlePhotoCapture = (capturedFile: File) => setFile(capturedFile);
  const handlePhotoClear = () => setFile(null);

  const handleUpload = async (reqId: string) => {
    if (!profile || !file) return;
    setIsUploading(true);
    setUploadStatus({ id: reqId, message: 'Uploading photo...', type: 'info' });
    const { url, error: uploadError } = await uploadHarvestPhoto(supabase, file, profile.id);
    if (uploadError) {
      setUploadStatus({ id: reqId, message: `Failed to upload: ${uploadError.message}`, type: 'error' });
      setIsUploading(false);
      return;
    }
    const { error: rpcError } = await uploadEvidence(supabase, reqId, url!);
    if (rpcError) {
      setUploadStatus({ id: reqId, message: `Failed to save evidence: ${rpcError.message}`, type: 'error' });
      setIsUploading(false);
      return;
    }
    setUploadStatus({ id: reqId, message: 'Evidence uploaded. The buyer must now review and final-confirm the order.', type: 'success' });
    setIsUploading(false);
    setFile(null);
    setActiveUploadId(null);
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, harvest_photo_url: url, evidence_status: 'provided' } : r));
  };

  const handleConfirmPickup = async (reqId: string) => {
    if (!window.confirm('Confirm that the goods have been handed over to the carrier? This action cannot be undone.')) return;
    setPickupConfirmingId(reqId);
    const { error: rpcError } = await supabase.rpc('rpc_confirm_seller_pickup_handover', { p_trade_request_id: reqId });
    if (rpcError) {
      setError(`Failed to confirm handover: ${rpcError.message}`);
    } else {
      await fetchRequests();
    }
    setPickupConfirmingId(null);
  };

  const handleCancelRequest = async () => {
    if (!cancelModalReqId) return;
    if (!cancelReason) { alert('Please select a cancellation reason.'); return; }
    setIsLoading(true);
    const { error: cancelError } = await supabase.rpc('rpc_cancel_seller_trade_request', {
      p_trade_request_id: cancelModalReqId,
      p_cancellation_reason: cancelReason,
      p_cancellation_note: cancelReason === 'Other' ? cancelNote : null
    });
    if (cancelError) {
      setError(`Failed to cancel request: ${cancelError.message}`);
    } else {
      setRequests(prev => prev.map(r => r.id === cancelModalReqId ? { ...r, request_status: 'CANCELLED' } : r));
      setCancelModalReqId(null);
      setCancelReason('');
      setCancelNote('');
    }
    setIsLoading(false);
  };

  const listingsRequests  = requests.filter(r => ['AWAITING_BUYER', 'EVIDENCE_PENDING'].includes(r.request_status));
  const ongoingRequests   = requests.filter(r => ['SEARCHING_LOGISTICS', 'ALLOCATED', 'DISPATCHED'].includes(r.request_status));
  const fulfilledRequests = requests.filter(r => r.request_status === 'FULFILLED');
  const cancelledRequests = requests.filter(r => r.request_status === 'CANCELLED');

  const renderRequestCard = (request: TradeRequestRow) => {
    const statusColors  = getStatusColor(request.request_status);
    
    const bookings = toArray(request.logistics_bookings);
    const activeBooking = bookings.find(b => b.status === 'active' || b.status === 'completed');
    const handoverStarted = activeBooking && (activeBooking.seller_pickup_confirmed_at !== null || activeBooking.carrier_pickup_confirmed_at !== null);

    const isCancellable = ['AWAITING_BUYER', 'EVIDENCE_PENDING', 'SEARCHING_LOGISTICS', 'ALLOCATED'].includes(request.request_status) && !handoverStarted;
    const isAlreadyCancelled = request.request_status === 'CANCELLED';
    const isAllocated   = request.request_status === 'ALLOCATED';
    const isDispatched  = request.request_status === 'DISPATCHED';
    const isSearching   = request.request_status === 'SEARCHING_LOGISTICS';
    const isFulfilled   = request.request_status === 'FULFILLED';

    const getCancelBlockReason = () => {
      if (handoverStarted && isAllocated) return 'Pickup handover is already in progress. Normal cancellation is no longer available.';
      if (isDispatched) return 'Goods have already left the seller. Normal cancellation is no longer available.';
      if (isFulfilled)  return 'This trade has been fulfilled and cannot be cancelled.';
      return 'This trade cannot be cancelled at this stage.';
    };

    const getCancelLabel = () => {
      if (request.buyer_id)       return 'Cancel Confirmed Order';
      if (request.buyer_demand_id) return 'Cancel Response';
      return 'Cancel Listing';
    };

    return (
      <Card key={request.id} className="flex flex-col md:flex-row gap-6 p-6">
        {/* Photo / Upload panel */}
        {request.harvest_photo_url ? (
          <div className="w-full md:w-48 h-32 flex-shrink-0 bg-black/10 rounded overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={request.harvest_photo_url} alt={request.commodity_variety} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full md:w-48 flex-shrink-0 flex flex-col space-y-4">
            <div className="h-32 rounded flex items-center justify-center text-sm bg-amber-100/50 text-amber-700 border border-amber-200">
              Missing Evidence
            </div>
            {request.interested_buyer_id && (
              <Alert variant="info" className="text-xs p-2 text-amber-700 bg-amber-100 border-amber-200">
                A buyer has requested evidence. Add a harvest photo to proceed.
              </Alert>
            )}
            {activeUploadId !== request.id ? (
              <Button variant="secondary" size="sm" onClick={() => setActiveUploadId(request.id)} className="w-full">
                Add Harvest Evidence
              </Button>
            ) : (
              <div className="space-y-2 border border-border p-3 rounded bg-black/5">
                <CameraCapture onCapture={handlePhotoCapture} onClear={handlePhotoClear} />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => handleUpload(request.id)} disabled={!file || isUploading} isLoading={isUploading && uploadStatus?.id === request.id} className="flex-1">
                    Upload
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setActiveUploadId(null); setFile(null); setUploadStatus(null); }} disabled={isUploading}>
                    Cancel
                  </Button>
                </div>
                {uploadStatus?.id === request.id && (
                  <p className={`text-xs mt-2 ${uploadStatus.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{uploadStatus.message}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Details */}
        <div className="flex-grow flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2 flex-col sm:flex-row gap-2">
              <h3 className="text-xl font-bold" style={{ color: 'var(--agri-primary-light)' }}>{request.commodity_variety}</h3>
              <div className="flex flex-col sm:items-end gap-2">
                <div className="group relative">
                  <span className="px-2 py-1 text-xs rounded font-bold uppercase cursor-help" style={{ backgroundColor: statusColors.bg, color: statusColors.text }}>
                    {request.request_status}
                  </span>
                  <div className="absolute bottom-full right-0 mb-2 w-52 p-2 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    {getStageTooltip(request.request_status)}
                  </div>
                </div>
                {request.buyer_demand_id && (
                  <span className="text-xs text-foreground-muted bg-black/5 px-2 py-1 rounded border border-border">
                    Demand Response: {request.buyer_demand_id.split('-')[0]}...
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{request.quantity_volume} units</p>
            <p className="text-sm mb-2" style={{ color: 'var(--foreground-muted)' }}>📍 {request.physical_address}</p>

            {/* Timeline for Ongoing Trades */}
            {(isSearching || isAllocated || isDispatched) && (
              <OngoingTradeTimeline
                requestStatus={request.request_status}
                sellerPickupConfirmedAt={activeBooking?.seller_pickup_confirmed_at || null}
                carrierPickupConfirmedAt={activeBooking?.carrier_pickup_confirmed_at || null}
                carrierDeliveryConfirmedAt={activeBooking?.carrier_delivery_confirmed_at || null}
                buyerDeliveryConfirmedAt={activeBooking?.buyer_delivery_confirmed_at || null}
                role="seller"
                onConfirmSellerPickup={() => handleConfirmPickup(request.id)}
                isConfirming={pickupConfirmingId === request.id}
              />
            )}
          </div>

          <div className="flex justify-between items-end mt-4">
            <div className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
              Submitted on {new Date(request.created_at).toLocaleDateString()}
            </div>
            {!isAlreadyCancelled && (
              <div className="group relative">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => isCancellable && setCancelModalReqId(request.id)}
                  disabled={isLoading || !isCancellable}
                  className={`border ${isCancellable ? 'text-red-600 border-red-200 hover:bg-red-50 bg-transparent' : 'opacity-50 cursor-not-allowed border-red-200 bg-transparent text-red-600'}`}
                >
                  {getCancelLabel()}
                </Button>
                {!isCancellable && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    {getCancelBlockReason()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.back()} className="mb-2">← Back to Dashboard</Button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>My Trade Requests</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchRequests} disabled={isLoading}>↻ Refresh</Button>
          <Link href="/dashboard/seller/sell"><Button>New Request</Button></Link>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="text-center p-12 mt-6">
          <p className="text-lg mb-4" style={{ color: 'var(--foreground-muted)' }}>You haven&apos;t submitted any trade requests yet.</p>
          <Link href="/dashboard/seller/sell"><Button>Sell Harvest</Button></Link>
        </Card>
      ) : (
        <div className="mt-6">
          <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b">
            <button onClick={() => setActiveTab('listings')} className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded ${activeTab === 'listings' ? 'bg-[var(--agri-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              My Listings ({listingsRequests.length})
            </button>
            <button onClick={() => setActiveTab('ongoing')} className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded ${activeTab === 'ongoing' ? 'bg-[var(--agri-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              Ongoing Trades ({ongoingRequests.length})
            </button>
            <button onClick={() => setActiveTab('completed')} className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded ${activeTab === 'completed' ? 'bg-[var(--agri-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              Completed Trades ({fulfilledRequests.length})
            </button>
            <button onClick={() => setActiveTab('cancelled')} className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded ${activeTab === 'cancelled' ? 'bg-[var(--agri-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              Cancelled Trades ({cancelledRequests.length})
            </button>
          </div>

          <div className="space-y-6">
            {activeTab === 'listings' && (
              <div>
                {listingsRequests.length === 0 ? <p className="text-gray-500">No active listings.</p> : (
                  <div className="grid gap-6">{listingsRequests.map(renderRequestCard)}</div>
                )}
              </div>
            )}

            {activeTab === 'ongoing' && (
              <div>
                {ongoingRequests.length === 0 ? <p className="text-gray-500">No ongoing trades at the moment.</p> : (
                  <div className="grid gap-6">{ongoingRequests.map(renderRequestCard)}</div>
                )}
              </div>
            )}

            {activeTab === 'completed' && (
              <div>
                {fulfilledRequests.length === 0 ? <p className="text-gray-500">No completed trades.</p> : (
                  <div className="grid gap-6">
                    {fulfilledRequests.map(r => (
                      <Card key={r.id} className="p-6 border-l-4 border-emerald-500">
                        <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                          <div>
                            <h3 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{r.commodity_variety}</h3>
                            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{r.quantity_volume} units · 📍 {r.physical_address}</p>
                          </div>
                          <span className="px-3 py-1 text-xs rounded-full font-bold uppercase bg-emerald-500/10 text-emerald-600">FULFILLED</span>
                        </div>
                        <div className="p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-lg text-sm text-emerald-700 dark:text-emerald-400">
                          ✅ Sale completed. Buyer has confirmed receipt. <strong>Settlement pending</strong> — payment disbursement will be processed.
                        </div>
                        <p className="text-xs mt-2" style={{ color: 'var(--foreground-dim)' }}>Trade ID: {r.id.split('-')[0]}... · {new Date(r.created_at).toLocaleDateString()}</p>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cancelled' && (
              <div>
                {cancelledRequests.length === 0 ? <p className="text-gray-500">No cancelled trades.</p> : (
                  <div className="grid gap-3">
                    {cancelledRequests.map(r => (
                      <Card key={r.id} className="p-4 opacity-60 border-l-4 border-gray-400">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <h3 className="font-semibold">{r.commodity_variety} · {r.quantity_volume} units</h3>
                            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>📍 {r.physical_address}</p>
                            {r.cancellation_reason && <p className="text-xs mt-1 text-gray-500">Reason: {r.cancellation_reason}</p>}
                          </div>
                          <span className="px-2 py-1 text-xs rounded font-bold uppercase bg-gray-500/10 text-gray-500">CANCELLED</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalReqId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Cancel Request</h2>
            <p className="text-sm text-foreground-muted mb-6">
              Please select a reason for cancelling. This helps us maintain a trustworthy marketplace.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <Label>Reason</Label>
                <select className="w-full h-10 px-3 rounded-md border text-sm mt-1 bg-transparent" value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                  <option value="" disabled>Select a reason...</option>
                  {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {cancelReason === 'Other' && (
                <div>
                  <Label>Please specify</Label>
                  <Input value={cancelNote} onChange={e => setCancelNote(e.target.value)} placeholder="Short explanation..." maxLength={100} />
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => { setCancelModalReqId(null); setCancelReason(''); setCancelNote(''); }} disabled={isLoading}>Go Back</Button>
              <Button variant="danger" onClick={handleCancelRequest} disabled={!cancelReason || isLoading || (cancelReason === 'Other' && !cancelNote)} isLoading={isLoading}>
                Confirm Cancellation
              </Button>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
