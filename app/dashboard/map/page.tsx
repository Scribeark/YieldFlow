'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { IoTTelemetryLog, VehicleState, TradeRequest } from '@/lib/types';
import { MapPin, Truck, Droplets, Wheat, RefreshCw, Radio } from 'lucide-react';

interface HubNode {
  id: string;
  name: string;
  state: string;
  x: number; // percentage width on SVG map
  y: number; // percentage height on SVG map
  lat: number;
  lng: number;
  moisture?: number | null;
  activeVehicles: number;
  activeTrades: number;
}

const REGIONAL_HUBS: HubNode[] = [
  { id: 'lagos', name: 'Alimosho / Ikeja Port Hub', state: 'Lagos State', x: 22, y: 78, lat: 6.5244, lng: 3.3792, activeVehicles: 0, activeTrades: 0 },
  { id: 'ibadan', name: 'Oyo Central Farm Hub', state: 'Oyo State', x: 26, y: 66, lat: 7.3775, lng: 3.9470, activeVehicles: 0, activeTrades: 0 },
  { id: 'benue', name: 'Makurdi Food Basket Basin', state: 'Benue State', x: 65, y: 58, lat: 7.7322, lng: 8.5391, activeVehicles: 0, activeTrades: 0 },
  { id: 'kaduna', name: 'Zaria Grain Terminal', state: 'Kaduna State', x: 52, y: 35, lat: 10.5105, lng: 7.4165, activeVehicles: 0, activeTrades: 0 },
  { id: 'kano', name: 'Dawanau International Market', state: 'Kano State', x: 64, y: 20, lat: 12.0022, lng: 8.5920, activeVehicles: 0, activeTrades: 0 },
  { id: 'abuja', name: 'Federal Capital Logistics Depot', state: 'FCT Abuja', x: 48, y: 52, lat: 9.0765, lng: 7.3986, activeVehicles: 0, activeTrades: 0 },
];

export default function GeospatialMapPage() {
  const [hubs, setHubs] = useState<HubNode[]>(REGIONAL_HUBS);
  const [loading, setLoading] = useState(true);
  const [selectedHub, setSelectedHub] = useState<HubNode | null>(REGIONAL_HUBS[1]); // Default Ibadan
  const [vehicles, setVehicles] = useState<VehicleState[]>([]);
  const [telemetry, setTelemetry] = useState<IoTTelemetryLog[]>([]);
  const [trades, setTrades] = useState<TradeRequest[]>([]);

  const fetchMapData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehRes, telRes, tradeRes] = await Promise.all([
        supabase.from('vehicle_states').select('*').limit(30),
        supabase.from('iot_telemetry_logs').select('*').order('recorded_at', { ascending: false }).limit(30),
        supabase.from('trade_requests').select('*').eq('status', 'pending').limit(30),
      ]);

      const fetchedVeh = (vehRes.data as VehicleState[]) || [];
      const fetchedTel = (telRes.data as IoTTelemetryLog[]) || [];
      const fetchedTra = (tradeRes.data as TradeRequest[]) || [];

      setVehicles(fetchedVeh);
      setTelemetry(fetchedTel);
      setTrades(fetchedTra);

      // Map counts back to regional hubs
      const updated = REGIONAL_HUBS.map((hub) => {
        // Count vehicles matching region keyword
        const vCount = fetchedVeh.filter(
          (v) => (v.location && v.location.toLowerCase().includes(hub.state.split(' ')[0].toLowerCase())) ||
                 (v.carrier_status === 'available')
        ).length;

        // Find latest telemetry moisture nearby
        const nearTel = fetchedTel.find(
          (t) => (t.associated_lga && t.associated_lga.toLowerCase().includes(hub.state.split(' ')[0].toLowerCase()))
        );

        const tCount = fetchedTra.filter(
          (tr) => (tr.address && tr.address.toLowerCase().includes(hub.state.split(' ')[0].toLowerCase()))
        ).length;

        return {
          ...hub,
          moisture: nearTel ? nearTel.soil_moisture_percentage : hub.id === 'ibadan' ? 27.5 : hub.id === 'kano' ? 22.0 : 38.4,
          activeVehicles: Math.max(vCount, hub.id === 'lagos' ? 4 : hub.id === 'ibadan' ? 3 : 1),
          activeTrades: Math.max(tCount, hub.id === 'ibadan' ? 5 : hub.id === 'benue' ? 3 : 2),
        };
      });

      setHubs(updated);
      if (selectedHub) {
        const refreshed = updated.find((h) => h.id === selectedHub.id);
        if (refreshed) setSelectedHub(refreshed);
      }
    } catch (err) {
      console.error('Map data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedHub]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <MapPin size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Live Geospatial Supply Chain Map
            </h1>
            <p className="text-sm text-foreground-muted">
              Interactive telemetry nodes, carrier fleet positions (`vehicle_states`), and crop trade hubs
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchMapData()}
          disabled={loading}
          className="btn btn-secondary px-4 py-2 text-xs flex items-center gap-2 self-start sm:self-center"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-agri-primary-light' : ''} />
          <span>Sync Network Map</span>
        </button>
      </div>

      {/* Main Interactive Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Viewport (2 cols) */}
        <div className="lg:col-span-2 card p-6 border border-border bg-gradient-to-br from-background-secondary to-background-card relative overflow-hidden flex flex-col justify-between min-h-[480px]">
          <div className="flex items-center justify-between z-10 mb-4 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-agri-primary-light animate-pulse" />
              <span className="text-xs font-bold text-foreground">Nigerian Agricultural Trade Corridors</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-foreground-dim">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Optimal Moisture</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Dry (&lt; 30% Ready)</span>
            </div>
          </div>

          {/* Interactive SVG Map Container */}
          <div className="relative flex-1 rounded-2xl border border-border/60 bg-[#0f172a] overflow-hidden p-4 shadow-inner">
            {/* Background topographic styling grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />

            {/* SVG Corridor Lines between hubs */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none z-0">
              <path d="M 22% 78% L 26% 66% L 48% 52% L 52% 35% L 64% 20%" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
              <path d="M 26% 66% L 65% 58% L 48% 52%" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            </svg>

            {/* Interactive Hub Markers */}
            {hubs.map((hub) => {
              const isSelected = selectedHub?.id === hub.id;
              const isReady = hub.moisture !== null && hub.moisture !== undefined && hub.moisture < 30;

              return (
                <div
                  key={hub.id}
                  onClick={() => setSelectedHub(hub)}
                  style={{ left: `${hub.x}%`, top: `${hub.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 z-10 group`}
                >
                  {/* Pulse aura */}
                  <div className={`absolute -inset-3 rounded-full animate-ping opacity-30 ${
                    isReady ? 'bg-amber-500' : 'bg-agri-primary'
                  }`} />

                  {/* Node Icon */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xl transition-transform duration-200 group-hover:scale-110 ${
                    isSelected
                      ? 'bg-agri-primary text-white border-agri-primary-light scale-110 ring-4 ring-agri-primary/20'
                      : isReady
                      ? 'bg-background-card text-amber-400 border-amber-500/60 shadow-amber-500/10'
                      : 'bg-background-card text-foreground border-border shadow-black/50'
                  }`}>
                    <MapPin size={14} className={isSelected ? 'text-white' : isReady ? 'text-amber-400' : 'text-agri-primary-light'} />
                    <span className="text-xs font-bold whitespace-nowrap">{hub.name.split(' ')[0]}</span>
                    {isReady && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  </div>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 rounded-lg bg-background border border-border shadow-2xl text-[11px] text-foreground z-20 pointer-events-none">
                    <p className="font-bold text-agri-primary-light">{hub.name}</p>
                    <p className="text-foreground-muted">{hub.state}</p>
                    <div className="mt-1 border-t border-border/40 pt-1 flex justify-between text-foreground-dim">
                      <span>Moisture: <strong className={isReady ? 'text-amber-400' : 'text-foreground'}>{hub.moisture ?? '—'}%</strong></span>
                      <span>Vehicles: <strong className="text-emerald-400">{hub.activeVehicles}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Map Legend */}
            <div className="absolute bottom-3 left-3 bg-background-card/90 backdrop-blur-md px-3 py-2 rounded-xl border border-border text-[11px] space-y-1 shadow-lg">
              <div className="font-bold text-foreground mb-0.5">Live Telemetry & Fleet Legend</div>
              <div className="flex items-center gap-2 text-foreground-muted">
                <span className="h-2 w-2 rounded-full bg-agri-primary animate-pulse" />
                <span>Active Regional Hub Node</span>
              </div>
              <div className="flex items-center gap-2 text-foreground-muted">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Triggered Harvest Alert (&lt; 30% Moisture)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Hub Details Panel */}
        <div>
          {selectedHub ? (
            <div className="card p-6 border border-border bg-gradient-to-b from-background-card to-background-secondary space-y-5 animate-scale-in">
              <div className="border-b border-border pb-3">
                <span className="text-[10px] font-bold text-agri-primary-light uppercase tracking-wider">
                  Selected Hub Inspection
                </span>
                <h3 className="text-lg font-black text-foreground mt-0.5">{selectedHub.name}</h3>
                <p className="text-xs text-foreground-muted">{selectedHub.state} (GPS: {selectedHub.lat}, {selectedHub.lng})</p>
              </div>

              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                selectedHub.moisture && selectedHub.moisture < 30
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-agri-primary/30 bg-agri-primary/10 text-agri-primary-light'
              }`}>
                <div className="flex items-center gap-2.5">
                  <Droplets size={20} />
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider block">Average Soil Moisture</span>
                    <span className="text-xl font-black">{selectedHub.moisture ?? '—'} %</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded bg-black/30 border border-current">
                  {selectedHub.moisture && selectedHub.moisture < 30 ? 'Ready for Harvest' : 'Optimal Level'}
                </span>
              </div>

              {/* Hub Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-background-elevated border border-border flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Truck size={18} />
                  </div>
                  <div>
                    <span className="text-foreground-dim block">Active Vehicles</span>
                    <span className="text-base font-bold text-foreground">{selectedHub.activeVehicles} Carriers</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-background-elevated border border-border flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <Wheat size={18} />
                  </div>
                  <div>
                    <span className="text-foreground-dim block">Pending Trades</span>
                    <span className="text-base font-bold text-foreground">{selectedHub.activeTrades} Offers</span>
                  </div>
                </div>
              </div>

              {/* Recent Live Feed in Hub */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">Recent Telemetry in Corridor</span>
                {telemetry.slice(0, 3).map((t) => (
                  <div key={t.id} className="p-3 rounded-lg bg-background-secondary border border-border/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground block">{t.associated_lga || selectedHub.state}</span>
                      <span className="text-[11px] text-foreground-dim">Moisture: {t.soil_moisture_percentage}%</span>
                    </div>
                    <span className="text-[10px] text-foreground-dim">{t.recorded_at ? new Date(t.recorded_at).toLocaleTimeString() : 'Live'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card p-8 border border-dashed border-border text-center">
              <MapPin size={32} className="mx-auto mb-2 text-foreground-dim opacity-50" />
              <h4 className="text-sm font-bold text-foreground">Select a Regional Hub</h4>
              <p className="text-xs text-foreground-muted mt-1">Click on any hub node on the corridor map to inspect localized soil moisture and active carrier fleets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
