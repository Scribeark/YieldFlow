'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Package, Calendar, Clock, Image as ImageIcon, AlertTriangle, CheckCircle, Truck } from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getBuyerOrders, getDemandResponses, confirmOrder, TradeRequestRow, BuyerDemandRow } from '@/lib/api/buyer';
import { OngoingTradeTimeline } from '@/components/shared/OngoingTradeTimeline';

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getBlockedMessage = (status: string, handoverStarted: boolean = false) => {
  if (['DISPATCHED', 'FULFILLED'].includes(status)) {
    return 'This order is already in delivery flow and cannot be cancelled here.';
  }
  if (handoverStarted && status === 'ALLOCATED') {
    return 'Pickup handover is already in progress. Normal cancellation is no longer available.';
  }
  if (status === 'ALLOCATED') {
    return 'This order is already allocated to logistics and cannot be cancelled here.'; // Though wait, our schema update allows buyer cancellation IF handover hasn't started? Actually no, buyer cancellation might be blocked by product rules or just by handover. Wait, my SQL said: "If handover has started, raise exception... Return listing to pool instead of killing it". This means buyer CAN cancel during ALLOCATED as long as handover hasn't started! Let's update this message.
  }
  return 'This order cannot be cancelled.';
};

export default function BuyerOrdersPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const supabase = createClient();

  const [confirmedOrders, setConfirmedOrders] = useState<TradeRequestRow[]>([]);
  const [pendingEvidenceRequests, setPendingEvidenceRequests] = useState<TradeRequestRow[]>([]);
  const [demandResponses, setDemandResponses] = useState<(TradeRequestRow & { buyer_demands: BuyerDemandRow | null })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [deliveryConfirmingId, setDeliveryConfirmingId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'pending' | 'ongoing' | 'completed' | 'cancelled'>('ongoing');

  const fetchOrders = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);
    setError(null);
    
    const [ordersRes, demandsRes] = await Promise.all([
      getBuyerOrders(supabase, profile.id, 50),
      getDemandResponses(supabase, profile.id)
    ]);

    if (ordersRes.error) {
      setError(`Failed to fetch your orders: ${ordersRes.error.message}`);
    } else if (ordersRes.data) {
      const confirmed = ordersRes.data.filter(order => order.buyer_id === profile.id);
      const pending = ordersRes.data.filter(order => order.interested_buyer_id === profile.id && order.buyer_id === null);
      setConfirmedOrders(confirmed);
      setPendingEvidenceRequests(pending);
    }
    
    if (demandsRes.data) {
      setDemandResponses(demandsRes.data);
    }
    
    setIsLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();
  }, [fetchOrders]);

  const handleConfirm = async (requestId: string) => {
    if (!profile) return;
    setClaimingId(requestId);

    const { error } = await confirmOrder(supabase, requestId);

    if (error) {
      setError(`Failed to confirm response: ${error.message}`);
      setClaimingId(null);
    } else {
      await fetchOrders();
      setClaimingId(null);
    }
  };

  const handleCancelOrder = async (requestId: string) => {
    if (!window.confirm("Are you sure? This action will remove this item from active availability.")) return;
    
    setIsLoading(true);
    const { error } = await supabase.rpc('rpc_cancel_buyer_claim', { p_trade_request_id: requestId });
    if (error) {
      setError(`Failed to cancel order: ${error.message}`);
    } else {
      await fetchOrders();
      alert("Order cancelled successfully.");
    }
    setIsLoading(false);
  };

  const handleConfirmDelivery = async (requestId: string) => {
    if (!window.confirm('Confirm that you have physically received the goods? This action cannot be undone and will trigger settlement preparation.')) return;
    
    setDeliveryConfirmingId(requestId);
    const { error } = await supabase.rpc('rpc_confirm_buyer_delivery', { p_trade_request_id: requestId });
    
    if (error) {
      setError(`Failed to confirm delivery: ${error.message}`);
    } else {
      await fetchOrders();
    }
    setDeliveryConfirmingId(null);
  };

  const ongoingOrders = confirmedOrders.filter(o => ['SEARCHING_LOGISTICS', 'ALLOCATED', 'DISPATCHED'].includes(o.request_status));
  const fulfilledOrders = confirmedOrders.filter(o => o.request_status === 'FULFILLED');
  const cancelledOrders = confirmedOrders.filter(o => o.request_status === 'CANCELLED');

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/buyer')} className="mb-4">
            ← Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>My Claimed Orders</h1>
          <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>
            Review the trade requests you have successfully purchased or provisionally claimed.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchOrders} disabled={isLoading}>
          ↻ Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-foreground-muted animate-pulse">
          Loading your orders...
        </div>
      ) : confirmedOrders.length === 0 && pendingEvidenceRequests.length === 0 && demandResponses.length === 0 ? (
        <Card className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-foreground-muted mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Orders Yet</h3>
          <p className="text-foreground-muted mb-6">You have not claimed any trade requests yet.</p>
          <Button onClick={() => router.push('/dashboard/buyer/buy')}>
            Browse Available Harvests
          </Button>
        </Card>
      ) : (
        <div className="mt-6">
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-4 mb-6 border-b">
            <Button variant="ghost" onClick={() => router.push('/dashboard/buyer/demands')} className="border bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10">
              My Demands
            </Button>
            <Button variant="ghost" onClick={() => router.push('/dashboard/buyer/buy')} className="border bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10">
              Available Harvests
            </Button>
            <div className="w-px h-8 bg-border mx-2 self-center hidden sm:block"></div>
            
            <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded ${activeTab === 'pending' ? 'bg-[var(--agri-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              Pending Responses ({(demandResponses.length + pendingEvidenceRequests.length)})
            </button>
            <button onClick={() => setActiveTab('ongoing')} className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded ${activeTab === 'ongoing' ? 'bg-[var(--agri-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              Ongoing Trades ({ongoingOrders.length})
            </button>
            <button onClick={() => setActiveTab('completed')} className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded ${activeTab === 'completed' ? 'bg-[var(--agri-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              Completed Trades ({fulfilledOrders.length})
            </button>
            <button onClick={() => setActiveTab('cancelled')} className={`px-4 py-2 font-medium text-sm whitespace-nowrap rounded ${activeTab === 'cancelled' ? 'bg-[var(--agri-primary)] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}>
              Cancelled Trades ({cancelledOrders.length})
            </button>
          </div>
          {activeTab === 'pending' && (
            <div className="space-y-12">
              {demandResponses.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Demand Responses Awaiting Confirmation</h2>
                  <p className="text-sm text-foreground-muted mb-4">Sellers have responded to your demands. Review evidence and confirm.</p>
                  <div className="grid gap-6">
                    {demandResponses.map(order => (
                      <Card key={order.id} className="p-6 flex flex-col md:flex-row gap-6 items-start border-agri-primary bg-agri-primary/5">
                        {/* Image Thumbnail */}
                        <div className="w-full md:w-48 h-32 bg-black/5 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center border border-border">
                          {order.harvest_photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={order.harvest_photo_url} 
                              alt={order.commodity_variety} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-foreground-muted opacity-20" />
                          )}
                        </div>
    
                        {/* Order Details */}
                        <div className="flex-1 w-full">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                            <div>
                              <h3 className="text-xl font-bold text-foreground">Response: {order.commodity_variety}</h3>
                              <p className="text-agri-primary font-medium text-lg">{order.quantity_volume} units</p>
                            </div>
                            <div className="flex flex-col items-start sm:items-end gap-2">
                              <span className="text-xs bg-agri-primary/10 text-agri-primary px-3 py-1 rounded-full uppercase tracking-wider font-bold">
                                RESPONDED
                              </span>
                              <span className="text-xs text-foreground-muted bg-black/5 px-2 py-1 rounded">
                                Demand ID: {order.buyer_demand_id?.split('-')[0]}...
                              </span>
                            </div>
                          </div>
    
                          <div className="grid sm:grid-cols-2 gap-4 text-sm text-foreground-muted">
                            <div className="flex items-start">
                              <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{order.physical_address}</span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-2 shrink-0" />
                              <span>Submitted: {new Date(order.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
    
                          <div className="mt-4 pt-4 border-t border-border">
                            <Button 
                              className="w-full sm:w-auto"
                              onClick={() => handleConfirm(order.id)}
                              isLoading={claimingId === order.id}
                              disabled={claimingId !== null}
                            >
                              Confirm & Claim Order
                            </Button>
                            {(() => {
                              const isCancellable = !['ALLOCATED', 'DISPATCHED', 'FULFILLED'].includes(order.request_status);
                              return (
                                <div className="group relative sm:ml-4 mt-2 sm:mt-0 inline-block w-full sm:w-auto">
                                  <Button 
                                    variant="danger"
                                    className={`w-full sm:w-auto border border-red-200 ${isCancellable ? 'text-red-600 hover:bg-red-50 bg-transparent' : 'opacity-50 cursor-not-allowed text-red-600 bg-transparent'}`}
                                    onClick={() => isCancellable && handleCancelOrder(order.id)}
                                    disabled={claimingId !== null || isLoading || !isCancellable}
                                  >
                                    Cancel Order
                                  </Button>
                                  {!isCancellable && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center">
                                      {getBlockedMessage(order.request_status)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
    
              {pendingEvidenceRequests.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Pending Evidence Requests</h2>
                  <div className="grid gap-6">
                    {pendingEvidenceRequests.map(order => (
                      <Card key={order.id} className="p-6 flex flex-col md:flex-row gap-6 items-start border-amber-200 bg-amber-50/10">
                        {/* Image Thumbnail */}
                        <div className="w-full md:w-48 h-32 bg-black/5 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center border border-border">
                          <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                          <p className="text-xs text-amber-600 font-medium absolute mt-12">Pending Photo</p>
                        </div>
    
                        {/* Order Details */}
                        <div className="flex-1 w-full">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                            <div>
                              <h3 className="text-xl font-bold text-foreground">{order.commodity_variety}</h3>
                              <p className="text-agri-primary font-medium text-lg">{order.quantity_volume} units</p>
                            </div>
                            <div className="flex flex-col items-start sm:items-end gap-2">
                              <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full uppercase tracking-wider font-bold">
                                {order.request_status}
                              </span>
                              <span className="text-xs text-foreground-muted bg-black/5 px-2 py-1 rounded">
                                ID: {order.id.split('-')[0]}...
                              </span>
                            </div>
                          </div>
    
                          <div className="grid sm:grid-cols-2 gap-4 text-sm text-foreground-muted">
                            <div className="flex items-start">
                              <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{order.physical_address}</span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-2 shrink-0" />
                              <span>Submitted: {new Date(order.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
    
                          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
                            <div className="flex items-center text-sm text-amber-700 bg-amber-100/50 p-3 rounded-md">
                              <Clock className="h-4 w-4 mr-2 shrink-0" />
                              <span>Awaiting seller to upload harvest photo. Final confirmation disabled until evidence provided.</span>
                            </div>
                            {(() => {
                              const isCancellable = !['ALLOCATED', 'DISPATCHED', 'FULFILLED'].includes(order.request_status);
                              return (
                                <div className="group relative inline-block">
                                  <Button 
                                    variant="danger"
                                    className={`border border-red-200 ${isCancellable ? 'text-red-600 hover:bg-red-50 bg-transparent' : 'opacity-50 cursor-not-allowed text-red-600 bg-transparent'}`}
                                    onClick={() => isCancellable && handleCancelOrder(order.id)}
                                    disabled={isLoading || !isCancellable}
                                  >
                                    Cancel Claim
                                  </Button>
                                  {!isCancellable && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center">
                                      {getBlockedMessage(order.request_status)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ongoing' && ongoingOrders.length === 0 && (
            <div className="text-center py-16">
              <Truck className="mx-auto h-12 w-12 text-foreground-muted mb-4 opacity-30" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Ongoing Trades</h3>
              <p className="text-foreground-muted text-sm max-w-sm mx-auto">
                Once a seller has a confirmed order and a logistics carrier has been assigned, your trade will appear here with live handover controls.
              </p>
              <p className="text-foreground-muted text-xs mt-4 opacity-60">
                Expected statuses: SEARCHING_LOGISTICS · ALLOCATED · DISPATCHED
              </p>
            </div>
          )}

          {activeTab === 'ongoing' && ongoingOrders.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Ongoing Trades</h2>
              <div className="grid gap-6">
                {ongoingOrders.map(order => {
                  const bookings = toArray(order.logistics_bookings);
                  const activeBooking = bookings.find(b => b.status === 'active' || b.status === 'completed');

                  return (
                    <Card key={order.id} className="p-6 flex flex-col md:flex-row gap-6 items-start">
                      {/* Image Thumbnail */}
                      <div className="w-full md:w-48 h-32 bg-black/5 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center border border-border">
                        {order.harvest_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={order.harvest_photo_url} 
                            alt={order.commodity_variety} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-foreground-muted opacity-20" />
                        )}
                      </div>

                      {/* Order Details */}
                      <div className="flex-1 w-full">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                          <div>
                            <h3 className="text-xl font-bold text-foreground">{order.commodity_variety}</h3>
                            <p className="text-agri-primary font-medium text-lg">{order.quantity_volume} units</p>
                          </div>
                          <div className="flex flex-col items-start sm:items-end gap-2">
                            <span className="text-xs bg-agri-primary/10 text-agri-primary px-3 py-1 rounded-full uppercase tracking-wider font-bold">
                              {order.request_status}
                            </span>
                            <span className="text-xs text-foreground-muted bg-black/5 px-2 py-1 rounded">
                              ID: {order.id.split('-')[0]}...
                            </span>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 text-sm text-foreground-muted">
                          <div className="flex items-start">
                            <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{order.physical_address}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 shrink-0" />
                            <span>Submitted: {new Date(order.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
                            <OngoingTradeTimeline
                              requestStatus={order.request_status}
                              sellerPickupConfirmedAt={activeBooking?.seller_pickup_confirmed_at || null}
                              carrierPickupConfirmedAt={activeBooking?.carrier_pickup_confirmed_at || null}
                              carrierDeliveryConfirmedAt={activeBooking?.carrier_delivery_confirmed_at || null}
                              buyerDeliveryConfirmedAt={activeBooking?.buyer_delivery_confirmed_at || null}
                              role="buyer"
                              onConfirmBuyerDelivery={() => handleConfirmDelivery(order.id)}
                              isConfirming={deliveryConfirmingId === order.id}
                            />

                            {(() => {
                              const bookings = toArray(order.logistics_bookings);
                              const activeBooking = bookings.find(b => b.status === 'active' || b.status === 'completed');
                              const handoverStarted = activeBooking ? (activeBooking.seller_pickup_confirmed_at !== null || activeBooking.carrier_pickup_confirmed_at !== null) : false;
                              
                              const isCancellable = !['DISPATCHED', 'FULFILLED', 'CANCELLED'].includes(order.request_status) && !handoverStarted;
                              return (
                                <div className="group relative inline-block self-start mt-4 border-t border-gray-100 dark:border-gray-800 pt-4 w-full">
                                  <Button 
                                    variant="danger"
                                    size="sm"
                                    className={`border border-red-200 ${isCancellable ? 'text-red-600 hover:bg-red-50 bg-transparent' : 'opacity-50 cursor-not-allowed text-red-600 bg-transparent'}`}
                                    onClick={() => isCancellable && handleCancelOrder(order.id)}
                                    disabled={isLoading || !isCancellable}
                                  >
                                    Cancel Order
                                  </Button>
                                  {!isCancellable && (
                                    <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center">
                                      {getBlockedMessage(order.request_status, handoverStarted)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'completed' && fulfilledOrders.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Package className="w-6 h-6 text-emerald-500" /> Completed Orders
              </h2>
              <div className="grid gap-6">
                {fulfilledOrders.map(order => (
                  <Card key={order.id} className="p-6 border-l-4 border-emerald-500 flex flex-col md:flex-row gap-6 items-start">
                    {/* Image Thumbnail */}
                    <div className="w-full md:w-48 h-32 bg-black/5 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center border border-border">
                      {order.harvest_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={order.harvest_photo_url} 
                          alt={order.commodity_variety} 
                          className="w-full h-full object-cover grayscale opacity-80"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-foreground-muted opacity-20" />
                      )}
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 w-full">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                        <div>
                          <h3 className="text-xl font-bold text-foreground">{order.commodity_variety}</h3>
                          <p className="text-emerald-600 font-medium text-lg">{order.quantity_volume} units</p>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-2">
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase tracking-wider font-bold">
                            {order.request_status}
                          </span>
                          <span className="text-xs text-foreground-muted bg-black/5 px-2 py-1 rounded">
                            ID: {order.id.split('-')[0]}...
                          </span>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4 text-sm text-foreground-muted mb-4">
                        <div className="flex items-start">
                          <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">Source: {order.physical_address}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 shrink-0" />
                          <span>Submitted: {new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-lg flex items-start gap-2 text-emerald-700 dark:text-emerald-400 text-sm">
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold mb-1">Delivery confirmed.</p>
                          <p>Payment settlement will be processed to the seller and logistics provider.</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'completed' && fulfilledOrders.length === 0 && (
            <div className="text-center py-16">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-400 mb-4 opacity-30" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Completed Orders</h3>
              <p className="text-foreground-muted text-sm">Your fulfilled orders will appear here once a trade reaches FULFILLED status.</p>
            </div>
          )}

        </div>
      )}

      {activeTab === 'cancelled' && cancelledOrders.length > 0 && (
        <div className="mt-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Cancelled Orders</h2>
          <div className="grid gap-4">
            {cancelledOrders.map(order => (
              <Card key={order.id} className="p-4 opacity-60 border-l-4 border-gray-400">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold">{order.commodity_variety} · {order.quantity_volume} units</h3>
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>📍 {order.physical_address}</p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded font-bold uppercase bg-gray-500/10 text-gray-500">CANCELLED</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'cancelled' && cancelledOrders.length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold text-foreground mb-2">No Cancelled Orders</h3>
          <p className="text-foreground-muted text-sm">Cancelled orders will appear here.</p>
        </div>
      )}
    </PageContainer>
  );
}
