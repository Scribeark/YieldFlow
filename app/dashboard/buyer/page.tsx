'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import type { TradeRequest, IoTTelemetryLog } from '@/lib/types';
import { ShoppingCart, CheckCircle2, AlertCircle, Camera, Droplets, MapPin, Scale, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface EnrichedTradeRequest extends TradeRequest {
  moisture_percentage?: number | null;
  is_ready_for_harvest?: boolean;
}

export default function BuyerDashboard() {
  const { profile } = useAuthStore();
  const [requests, setRequests] = useState<EnrichedTradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [onlyReady, setOnlyReady] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<EnrichedTradeRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const fetchBuyerOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch available trade requests
      const { data: tradeData, error: tradeErr } = await supabase
        .from('trade_requests')
        .select('*')
        .in('status', ['pending', 'available'])
        .order('created_at', { ascending: false });

      if (tradeErr) throw new Error(tradeErr.message);

      const rawTrades = (tradeData as TradeRequest[]) || [];

      // 2. Fetch latest telemetry readings to determine moisture < 30 readiness
      const { data: telemetryData } = await supabase
        .from('iot_telemetry_logs')
        .select('owner_id, soil_moisture_percentage')
        .order('recorded_at', { ascending: false });

      const moistureMap = new Map<string, number>();
      if (telemetryData) {
        telemetryData.forEach((log: { owner_id: string | null; soil_moisture_percentage: number }) => {
          if (log.owner_id && !moistureMap.has(log.owner_id)) {
            moistureMap.set(log.owner_id, log.soil_moisture_percentage);
          }
        });
      }

      const enriched: EnrichedTradeRequest[] = rawTrades.map((req) => {
        const ownerId = req.owner_id || req.user_id || '';
        const moisture = moistureMap.has(ownerId) ? moistureMap.get(ownerId)! : null;
        const isReady = moisture !== null && moisture < 30;
        return {
          ...req,
          moisture_percentage: moisture,
          is_ready_for_harvest: isReady || req.status === 'ready',
        };
      });

      setRequests(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ready harvest marketplace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuyerOffers();
  }, [fetchBuyerOffers]);

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;

    // Universal "No photo, no confirm" security gate
    if (!selectedOrder.harvest_photo_url || selectedOrder.harvest_photo_url.trim() === '') {
      setError('Universal Security Gate: This harvest offer has no inspection photo. Verification cannot be confirmed without visual audit.');
      return;
    }

    setConfirming(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('trade_requests')
        .update({ status: 'confirmed_by_buyer' })
        .eq('id', selectedOrder.id);

      if (updateErr) throw new Error(updateErr.message);

      setOrderSuccess(true);
      setTimeout(() => {
        setOrderSuccess(false);
        setSelectedOrder(null);
        fetchBuyerOffers();
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Order confirmation failed');
    } finally {
      setConfirming(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = req.commodity_variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.address && req.address.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesReady = onlyReady ? req.is_ready_for_harvest : true;
    return matchesSearch && matchesReady;
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-agri-accent to-amber-500 shadow-lg shadow-agri-accent/20">
            <ShoppingCart size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {profile?.full_name || 'Enterprise Crop Buyer'}
            </h1>
            <p className="text-sm text-foreground-muted">
              Explore Farms Ready for Harvest (`soil_moisture &lt; 30%`), inspect verification photos, and lock in crop supply
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyReady(!onlyReady)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
              onlyReady
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm shadow-amber-500/20'
                : 'bg-background-elevated border-border text-foreground-muted hover:text-foreground'
            }`}
          >
            <Droplets size={14} className={onlyReady ? 'text-amber-400 animate-pulse' : ''} />
            <span>{onlyReady ? 'Showing Ready Farms Only (< 30% Moisture)' : 'Filter: Farms Ready for Harvest'}</span>
          </button>
        </div>
      </div>

      {orderSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400 animate-fade-in font-bold">
          <CheckCircle2 size={18} />
          <span>Harvest order verified and confirmed! Logistics carriers will now initiate pickup.</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 animate-fade-in">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card p-4 border border-border flex items-center gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-dim" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by commodity variety (e.g. Maize, Rice, Cocoa) or regional hub..."
            className="input pl-10 text-sm"
          />
        </div>
      </div>

      {/* Main Grid: Offers vs Inspection Modal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">Available Crop Marketplace ({filteredRequests.length})</h3>
            <span className="text-xs text-foreground-dim">Privacy Protected (No exact coordinates disclosed pre-order)</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card h-48 border border-border animate-pulse bg-background-secondary/30" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="card p-12 border border-dashed border-border text-center">
              <ShoppingCart size={40} className="mx-auto mb-3 text-foreground-dim opacity-50" />
              <h4 className="text-sm font-bold text-foreground">No Crop Offers Matching Filters</h4>
              <p className="text-xs text-foreground-muted max-w-sm mx-auto mt-1">
                Try clearing your search filters or check back shortly as farmers submit new harvest trade offers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => { setSelectedOrder(req); setError(null); }}
                  className={`card p-5 border transition-all cursor-pointer flex flex-col justify-between ${
                    selectedOrder?.id === req.id
                      ? 'border-agri-primary bg-agri-primary/5 shadow-md shadow-agri-primary/10'
                      : 'border-border hover:border-border-hover'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="badge badge-pending">Available Offer</span>
                      {req.is_ready_for_harvest ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
                          <Droplets size={10} /> Ready (&lt; 30%)
                        </span>
                      ) : req.moisture_percentage !== null ? (
                        <span className="text-[10px] text-foreground-dim font-mono">
                          Moisture: {req.moisture_percentage}%
                        </span>
                      ) : null}
                    </div>

                    {req.harvest_photo_url ? (
                      <div className="mb-3 overflow-hidden rounded-xl border border-border h-36 bg-background-elevated relative">
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={req.harvest_photo_url}
                          alt={req.commodity_variety}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1 font-bold">
                          <Camera size={10} /> Visual Inspection Ready
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3 flex h-36 items-center justify-center rounded-xl bg-background-elevated text-foreground-dim border border-border flex-col gap-1">
                        <Camera size={24} className="opacity-40" />
                        <span className="text-[10px]">No Photo Submitted</span>
                      </div>
                    )}

                    <h4 className="text-base font-black text-foreground">{req.commodity_variety}</h4>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-agri-primary-light">
                        <Scale size={14} className="text-agri-primary" />
                        <span>{Number(req.quantity).toLocaleString()} kg available</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground-muted">
                        <MapPin size={13} className="text-foreground-dim" />
                        <span className="truncate">{req.address || 'Regional Farm Hub'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-foreground-dim">
                    <span>{req.created_at ? format(new Date(req.created_at), 'MMM d, yyyy') : 'Recent'}</span>
                    <span className="text-agri-primary-light font-bold flex items-center gap-1">
                      Inspect & Verify →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Pane: Selected Order Inspection Card */}
        <div>
          {selectedOrder ? (
            <div className="card p-6 border border-agri-primary/40 bg-gradient-to-b from-background-card to-background-secondary sticky top-6 space-y-5 animate-scale-in">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] font-bold text-agri-primary-light uppercase tracking-wider block">
                    Buyer Inspection Audit
                  </span>
                  <h3 className="text-lg font-black text-foreground mt-0.5">Order Verification</h3>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-xs text-foreground-dim hover:text-foreground"
                >
                  ✕ Close
                </button>
              </div>

              {/* Photo Display Card */}
              <div>
                <span className="label">Mandatory Harvest Inspection Photo</span>
                {selectedOrder.harvest_photo_url ? (
                  <div className="overflow-hidden rounded-xl border border-border h-48 bg-black relative">
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={selectedOrder.harvest_photo_url}
                      alt={selectedOrder.commodity_variety}
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-md">
                      ✓ Visual Audit Pass
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-red-500/40 bg-red-500/10 text-center text-red-400 space-y-2">
                    <AlertCircle size={28} className="mx-auto" />
                    <p className="text-xs font-bold">No Photo Submitted</p>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      Universal Gate: Orders cannot be confirmed without a visual inspection photo from the farmer.
                    </p>
                  </div>
                )}
              </div>

              {/* Specs */}
              <div className="space-y-3 rounded-xl bg-background-elevated p-4 border border-border/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-foreground-dim">Commodity Variety:</span>
                  <span className="font-bold text-foreground">{selectedOrder.commodity_variety}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-dim">Volume / Weight:</span>
                  <span className="font-bold text-agri-primary-light">{Number(selectedOrder.quantity).toLocaleString()} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-dim">Pickup Hub:</span>
                  <span className="font-medium text-foreground text-right truncate max-w-[150px]">{selectedOrder.address || 'Standard Hub'}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <span className="text-foreground-dim">Readiness Status:</span>
                  <span className={`font-bold ${selectedOrder.is_ready_for_harvest ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {selectedOrder.is_ready_for_harvest ? 'Ready (< 30% Moisture)' : 'Standard Moisture'}
                  </span>
                </div>
              </div>

              {/* Confirm Action Button */}
              <button
                onClick={handleConfirmOrder}
                disabled={confirming || !selectedOrder.harvest_photo_url}
                className={`btn w-full py-3 text-sm font-bold shadow-lg flex items-center justify-center gap-2 ${
                  selectedOrder.harvest_photo_url
                    ? 'btn-primary shadow-agri-primary/20'
                    : 'border border-border bg-background-elevated text-foreground-dim cursor-not-allowed'
                }`}
              >
                {confirming ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Confirm Order Verification</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="card p-8 border border-dashed border-border text-center sticky top-6">
              <Search size={32} className="mx-auto mb-2 text-foreground-dim opacity-50" />
              <h4 className="text-sm font-bold text-foreground">Select a Crop Offer</h4>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                Click on any crop offer from the marketplace to perform the mandatory harvest photo inspection before confirming your order.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
