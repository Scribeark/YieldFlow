'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, MapPin, Package, Calendar, Image as ImageIcon } from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getAvailableTradeRequests, confirmOrder, requestEvidence, TradeRequestRow, ConfirmOrderParams } from '@/lib/api/buyer';
import { DeliveryLocationModal, DeliveryLocation } from '@/components/shared/DeliveryLocationModal';
import { useMapsKey } from '@/components/providers/MapsProvider';

// apiKey is injected at the page level by the Server Component wrapper below
interface BuyPageClientProps {
  apiKey: string;
}

function BuyPageClient({ apiKey }: BuyPageClientProps) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const supabase = createClient();

  const [requests, setRequests] = useState<TradeRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null);

  // Modal state
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    async function fetchRequests() {
      setIsLoading(true);
      setError(null);
      const { data, error } = await getAvailableTradeRequests(supabase, 30);
      if (error) setError(`Failed to fetch trade requests: ${error.message}`);
      else setRequests(data || []);
      setIsLoading(false);
    }
    fetchRequests();
  }, [supabase]);

  const pendingRequest = pendingConfirmId ? requests.find(r => r.id === pendingConfirmId) : null;

  const handleConfirmWithLocation = async (location: DeliveryLocation, confirmUssdExemption: boolean) => {
    if (!pendingConfirmId || !profile) return;
    setIsConfirming(true);
    setClaimStatus(null);

    const params: ConfirmOrderParams = {
      requestId: pendingConfirmId,
      deliveryAddress: location.address,
      deliveryLatitude: location.lat,
      deliveryLongitude: location.lng,
      confirmUssdExemption,
    };

    const { error } = await confirmOrder(supabase, params);

    if (error) {
      setClaimStatus({ id: pendingConfirmId, type: 'error', message: `Failed to confirm: ${error.message}` });
      setIsConfirming(false);
    } else {
      setClaimStatus({ id: pendingConfirmId, type: 'success', message: 'Order Confirmed! Logistics matching has been initiated.' });
      const confirmedId = pendingConfirmId;
      setPendingConfirmId(null);
      setIsConfirming(false);
      setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== confirmedId));
        setClaimStatus(null);
      }, 3000);
    }
  };

  const handleRequestEvidence = async (requestId: string) => {
    if (!profile) return;
    setClaimingId(requestId);
    setClaimStatus(null);
    const { error } = await requestEvidence(supabase, requestId);
    if (error) {
      setClaimStatus({ id: requestId, type: 'error', message: `Failed to request evidence: ${error.message}` });
      setClaimingId(null);
    } else {
      setClaimStatus({ id: requestId, type: 'success', message: 'Evidence Requested! The seller will be notified.' });
      setTimeout(() => {
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, request_status: 'EVIDENCE_PENDING', interested_buyer_id: profile.id } : r));
        setClaimingId(null);
      }, 3000);
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/dashboard/buyer')} className="mb-4">
          ← Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Available Harvests</h1>
        <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>
          Review and purchase trade requests from verified sellers.
        </p>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {isLoading ? (
        <div className="text-center py-12 text-foreground-muted animate-pulse">Loading available trade requests...</div>
      ) : requests.length === 0 ? (
        <Card className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-foreground-muted mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Harvests Available</h3>
          <p className="text-foreground-muted">There are currently no new trade requests awaiting buyers.</p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {requests.map(request => {
            const hasPhoto = Boolean(request.harvest_photo_url);
            const isUssd = request.submission_channel === 'ussd';
            const isNoPhotoUssd = isUssd && !hasPhoto;
            const isClaiming = claimingId === request.id;
            const status = claimStatus?.id === request.id ? claimStatus : null;

            return (
              <Card key={request.id} className="flex flex-col overflow-hidden">
                {/* Photo / placeholder */}
                <div className="h-48 bg-black/5 relative flex items-center justify-center border-b border-border">
                  {hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={request.harvest_photo_url!} alt={request.commodity_variety} className="w-full h-full object-cover" />
                  ) : isNoPhotoUssd ? (
                    <div className="text-center p-4 w-full">
                      <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                      <p className="text-xs text-amber-600 font-bold">USSD Listing</p>
                      <p className="text-xs text-amber-500">No harvest photo provided. Seller submitted through a low-bandwidth channel. Buyer may accept evidence exemption.</p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-xs text-gray-500">No photo</p>
                    </div>
                  )}
                  {/* Channel badge */}
                  {isUssd && (
                    <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      USSD
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{request.commodity_variety}</h3>
                      <p className="text-agri-primary font-medium">{request.quantity_volume} kg/tons</p>
                    </div>
                    <span className="text-xs bg-black/5 px-2 py-1 rounded-full uppercase tracking-wider text-foreground-muted">
                      {request.request_status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-6 flex-1 text-sm text-foreground-muted">
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{request.physical_address}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 shrink-0" />
                      <span>{new Date(request.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    {status?.type === 'error' && <Alert variant="error" className="mb-4 text-xs py-2 px-3">{status.message}</Alert>}
                    {status?.type === 'success' ? (
                      <div className="bg-green-50 text-green-700 p-3 rounded-md flex items-center text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" />
                        {status.message}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {hasPhoto ? (
                          <Button className="w-full" onClick={() => setPendingConfirmId(request.id)} disabled={isClaiming}>
                            Confirm & Claim Order
                          </Button>
                        ) : isNoPhotoUssd ? (
                          <>
                            <Button
                              className="w-full mb-1"
                              onClick={() => handleRequestEvidence(request.id)}
                              isLoading={isClaiming}
                              disabled={isClaiming || request.interested_buyer_id !== null}
                              variant={request.interested_buyer_id !== null ? 'secondary' : 'primary'}
                            >
                              {request.interested_buyer_id !== null ? 'Evidence Requested' : 'Request Evidence'}
                            </Button>
                            <Button
                              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => setPendingConfirmId(request.id)}
                              disabled={isClaiming}
                            >
                              Accept Under USSD Exemption
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-amber-600 font-medium flex items-center mb-2">
                              <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                              Purchase disabled: No photo evidence
                            </p>
                            <Button className="w-full" disabled>Confirm & Claim Order</Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delivery location modal */}
      {pendingConfirmId && pendingRequest && (
        <DeliveryLocationModal
          apiKey={apiKey}
          listing={pendingRequest}
          onConfirm={handleConfirmWithLocation}
          onCancel={() => { setPendingConfirmId(null); setIsConfirming(false); }}
          isLoading={isConfirming}
        />
      )}
    </PageContainer>
  );
}

// ─── Page entry point — reads Maps key from context ─────────────────────────
export default function BuyPage() {
  const apiKey = useMapsKey();
  return <BuyPageClient apiKey={apiKey} />;
}
