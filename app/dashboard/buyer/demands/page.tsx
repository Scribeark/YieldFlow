'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, ShoppingCart, Calendar } from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getBuyerDemands, getDemandResponses, BuyerDemandRow, TradeRequestRow } from '@/lib/api/buyer';

export default function MyDemandsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const supabase = createClient();

  const [demands, setDemands] = useState<BuyerDemandRow[]>([]);
  const [responses, setResponses] = useState<(TradeRequestRow & { buyer_demands: BuyerDemandRow | null })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!profile) return;
      setIsLoading(true);
      setError(null);
      
      const [demandsRes, responsesRes] = await Promise.all([
        getBuyerDemands(supabase, profile.id),
        getDemandResponses(supabase, profile.id)
      ]);

      if (demandsRes.error) {
        setError(`Failed to fetch demands: ${demandsRes.error.message}`);
      } else {
        setDemands(demandsRes.data || []);
      }

      if (responsesRes.error) {
        // Just log it, don't crash the demands view
        console.error('Failed to fetch responses', responsesRes.error);
      } else {
        setResponses(responsesRes.data || []);
      }
      
      setIsLoading(false);
    }
    
    fetchData();
  }, [profile, supabase]);

  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleConfirm = async (requestId: string) => {
    if (!profile) return;
    setClaimingId(requestId);

    const { confirmOrder } = await import('@/lib/api/buyer');
    const { error } = await confirmOrder(supabase, requestId);

    if (error) {
      setError(`Failed to confirm response: ${error.message}`);
      setClaimingId(null);
    } else {
      // Re-fetch to update state
      const [demandsRes, responsesRes] = await Promise.all([
        getBuyerDemands(supabase, profile.id),
        getDemandResponses(supabase, profile.id)
      ]);
      if (demandsRes.data) setDemands(demandsRes.data);
      if (responsesRes.data) setResponses(responsesRes.data);
      setClaimingId(null);
    }
  };

  const handleCancelDemand = async (demandId: string) => {
    if (!window.confirm("Are you sure? This action will remove this item from active availability.")) return;
    
    setIsLoading(true);
    const { error } = await supabase.rpc('rpc_cancel_buyer_demand', { p_demand_id: demandId });
    if (error) {
      setError(`Failed to cancel demand: ${error.message}`);
    } else {
      // Re-fetch to update state
      const [demandsRes, responsesRes] = await Promise.all([
        getBuyerDemands(supabase, profile!.id),
        getDemandResponses(supabase, profile!.id)
      ]);
      if (demandsRes.data) setDemands(demandsRes.data);
      if (responsesRes.data) setResponses(responsesRes.data);
      alert("Demand cancelled successfully.");
    }
    setIsLoading(false);
  };

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/buyer')} className="mb-2">
            ← Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>My Demand Requests</h1>
        </div>
        <Link href="/dashboard/buyer/demands/new">
          <Button>Post New Demand</Button>
        </Link>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : demands.length === 0 ? (
        <Card className="text-center p-12">
          <ShoppingCart className="mx-auto h-12 w-12 text-foreground-muted mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Demands Posted</h3>
          <p className="text-foreground-muted mb-6">You haven&apos;t requested any commodities yet.</p>
          <Link href="/dashboard/buyer/demands/new">
            <Button>Post a Demand</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6">
            {demands.map((demand) => {
              const demandResponses = responses.filter(r => r.buyer_demand_id === demand.id);
              
              return (
                <Card key={demand.id} className="p-6 border-l-4" style={{ 
                  borderLeftColor: demand.demand_status === 'AWAITING_SELLER' ? 'var(--agri-primary)' : 
                                   demand.demand_status === 'FULFILLED' ? '#10b981' : '#6b7280'
                }}>
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                          {demand.commodity_variety}
                        </h3>
                        <span 
                          className="px-3 py-1 text-xs rounded-full font-bold uppercase"
                          style={{ 
                            backgroundColor: demand.demand_status === 'AWAITING_SELLER' ? 'rgba(34, 197, 94, 0.1)' : 
                                             demand.demand_status === 'FULFILLED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                            color: demand.demand_status === 'AWAITING_SELLER' ? 'var(--agri-primary)' : 
                                   demand.demand_status === 'FULFILLED' ? '#10b981' : '#6b7280'
                          }}
                        >
                          {demand.demand_status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <p className="text-xl font-medium mb-4" style={{ color: 'var(--agri-primary-light)' }}>
                        {demand.quantity_volume} units
                      </p>
                      
                      <div className="grid sm:grid-cols-2 gap-2 text-sm text-foreground-muted">
                        <div className="flex items-start">
                          <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{demand.delivery_address}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 shrink-0" />
                          <span>Posted: {new Date(demand.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      {(() => {
                        const isCancellable = demand.demand_status === 'AWAITING_SELLER';
                        if (demand.demand_status === 'CANCELLED') return null; // hide if completely cancelled
                        return (
                          <div className="mt-4 group relative inline-block">
                            <Button 
                              variant="danger"
                              className={`border border-red-200 ${isCancellable ? 'text-red-600 hover:bg-red-50 bg-transparent' : 'opacity-50 cursor-not-allowed text-red-600 bg-transparent'}`}
                              onClick={() => isCancellable && handleCancelDemand(demand.id)}
                              disabled={isLoading || !isCancellable}
                            >
                              Cancel Demand
                            </Button>
                            {!isCancellable && (
                              <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                This demand cannot be cancelled because it has active responses or is fulfilled.
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    
                    
                    {/* Responses List */}
                    {demandResponses.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-border">
                        <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Seller Responses ({demandResponses.length})</h4>
                        <div className="grid gap-4">
                          {demandResponses.map(response => (
                            <div key={response.id} className="bg-black/5 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start">
                              <div className="w-full sm:w-24 h-24 bg-black/10 rounded flex-shrink-0 flex items-center justify-center overflow-hidden border border-border">
                                {response.harvest_photo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={response.harvest_photo_url} alt="Harvest Evidence" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs text-foreground-muted text-center px-1">No Photo</span>
                                )}
                              </div>
                              <div className="flex-1 w-full">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <div className="font-bold text-foreground">Response ID: {response.id.split('-')[0]}</div>
                                    <div className="text-sm font-medium text-agri-primary">{response.quantity_volume} units</div>
                                  </div>
                                  <span className="px-2 py-1 text-[10px] bg-black/10 rounded font-bold uppercase">
                                    {response.request_status}
                                  </span>
                                </div>
                                <div className="text-xs text-foreground-muted mb-3 line-clamp-1">
                                  📍 {response.physical_address}
                                </div>
                                <Button 
                                  size="sm"
                                  className="w-full sm:w-auto"
                                  disabled={claimingId !== null || response.request_status !== 'AWAITING_BUYER'}
                                  isLoading={claimingId === response.id}
                                  onClick={() => handleConfirm(response.id)}
                                >
                                  Final Confirm & Claim
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Responses Summary Empty */}
                    {demand.demand_status === 'AWAITING_SELLER' && demandResponses.length === 0 && (
                      <div className="mt-6 pt-6 border-t border-border flex justify-center">
                        <div className="text-sm text-foreground-muted text-center p-4 bg-black/5 rounded-lg w-full">
                          Waiting for sellers to provide harvest evidence. No responses yet.
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
