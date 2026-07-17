'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLoadScript, GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { supabase } from '@/lib/supabaseClient';
import type { IoTTelemetryLog, VehicleState, TradeRequest } from '@/lib/types';
import {
  MapPin,
  Truck,
  Droplets,
  Wheat,
  RefreshCw,
  Radio,
  Loader2,
  Activity,
  ArrowRightLeft,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_API_KEY = 'AIzaSyCt45_kXs1MbaP6fDv3bcMkPk0uh9cnOhA';

const MAP_CENTER = { lat: 9.082, lng: 8.6753 };
const MAP_ZOOM = 6;

const FALLBACK_HUBS: Record<string, { lat: number; lng: number }> = {
  lagos:  { lat: 6.5244,  lng: 3.3792 },
  ibadan: { lat: 7.3775,  lng: 3.947 },
  abuja:  { lat: 9.0579,  lng: 7.4951 },
  kano:   { lat: 12.0022, lng: 8.592 },
  kaduna: { lat: 10.5264, lng: 7.4383 },
  benue:  { lat: 7.3369,  lng: 8.7404 },
};

const FALLBACK_KEYS = Object.keys(FALLBACK_HUBS);

/** Picks a deterministic fallback hub based on a string id */
function fallbackCoords(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const key = FALLBACK_KEYS[Math.abs(hash) % FALLBACK_KEYS.length];
  // Small jitter so markers don't stack exactly
  const jitter = () => (Math.random() - 0.5) * 0.15;
  return {
    lat: FALLBACK_HUBS[key].lat + jitter(),
    lng: FALLBACK_HUBS[key].lng + jitter(),
  };
}

// ─── Dark map style ──────────────────────────────────────────────────────────
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#134e4a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5eead4' }] },
];

const MAP_OPTIONS: google.maps.MapOptions = {
  styles: DARK_MAP_STYLES,
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
};

const containerStyle = { width: '100%', height: '100%' };

// ─── Typed marker helpers ────────────────────────────────────────────────────
interface MarkerInfo {
  id: string;
  type: 'trade' | 'vehicle';
  position: google.maps.LatLngLiteral;
  title: string;
  details: Record<string, string>;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function GeospatialMapPage() {
  // Google Maps loader
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Data state
  const [trades, setTrades] = useState<TradeRequest[]>([]);
  const [vehicles, setVehicles] = useState<VehicleState[]>([]);
  const [telemetry, setTelemetry] = useState<IoTTelemetryLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeMarker, setActiveMarker] = useState<MarkerInfo | null>(null);

  const [simGPS, setSimGPS] = useState(true);
  const [simProgress, setSimProgress] = useState(20);
  const [simPos, setSimPos] = useState<google.maps.LatLngLiteral>({ lat: 7.2069, lng: 3.8322 });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (simGPS) {
      interval = setInterval(() => {
        setSimProgress((prev) => {
          const next = prev >= 100 ? 0 : prev + 3;
          // Interpolate Ibadan (7.3775, 3.9470) -> Lagos Port (6.5244, 3.3792)
          const lat = 7.3775 - ((7.3775 - 6.5244) * (next / 100));
          const lng = 3.9470 - ((3.9470 - 3.3792) * (next / 100));
          setSimPos({ lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) });
          return next;
        });
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [simGPS]);

  // ── Supabase fetch ──────────────────────────────────────────────────────────
  const fetchMapData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [tradeRes, vehRes, telRes] = await Promise.all([
        supabase.from('trade_requests').select('*').eq('status', 'pending').limit(50),
        supabase.from('vehicle_states').select('*').limit(50),
        supabase
          .from('iot_telemetry_logs')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(100),
      ]);

      setTrades((tradeRes.data as TradeRequest[]) || []);
      setVehicles((vehRes.data as VehicleState[]) || []);
      setTelemetry((telRes.data as IoTTelemetryLog[]) || []);
    } catch (err) {
      console.error('Map data fetch error:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // ── Initial fetch + real-time channel ───────────────────────────────────────
  useEffect(() => {
    fetchMapData();

    const channel = supabase
      .channel('map-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trade_requests' },
        () => fetchMapData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_states' },
        () => fetchMapData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'iot_telemetry_logs' },
        () => fetchMapData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMapData]);

  // ── Derived markers ─────────────────────────────────────────────────────────
  const markers: MarkerInfo[] = useMemo(() => {
    const list: MarkerInfo[] = [];

    // Green markers → pending harvest / trade requests
    trades.forEach((t) => {
      const hasGPS =
        t.address &&
        /\d/.test(t.address); // rough check — real GPS is on hub fallback
      // We use fallback coords because trade_requests has no lat/lng columns
      const pos = fallbackCoords(t.id);

      list.push({
        id: `trade-${t.id}`,
        type: 'trade',
        position: pos,
        title: t.commodity_variety || 'Harvest',
        details: {
          Commodity: t.commodity_variety ?? '—',
          Quantity: `${t.quantity ?? t.quantity_kg ?? '—'} kg`,
          Status: t.status ?? 'pending',
          Address: t.address ?? t.farm_location ?? '—',
        },
      });
    });

    // Blue markers → available vehicles
    vehicles.forEach((v) => {
      const hasGPS =
        typeof v.latitude === 'number' &&
        typeof v.longitude === 'number' &&
        v.latitude !== 0;
      const pos = hasGPS
        ? { lat: v.latitude!, lng: v.longitude! }
        : fallbackCoords(v.id);

      list.push({
        id: `veh-${v.id}`,
        type: 'vehicle',
        position: pos,
        title: v.vehicle_type || 'Vehicle',
        details: {
          Type: v.vehicle_type ?? '—',
          Status: v.carrier_status ?? '—',
          Location: v.location ?? '—',
        },
      });
    });

    return list;
  }, [trades, vehicles]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalTrades = trades.length;
    const availableVehicles = vehicles.filter(
      (v) => v.carrier_status === 'available',
    ).length;
    const inTransit = vehicles.filter(
      (v) => v.carrier_status === 'busy',
    ).length;

    const moistureValues = telemetry
      .map((t) => t.soil_moisture_percentage)
      .filter((v) => typeof v === 'number' && !Number.isNaN(v));
    const avgMoisture =
      moistureValues.length > 0
        ? moistureValues.reduce((a, b) => a + b, 0) / moistureValues.length
        : 0;

    return { totalTrades, availableVehicles, inTransit, avgMoisture };
  }, [trades, vehicles, telemetry]);

  // ── Render helpers ──────────────────────────────────────────────────────────
  const tradeIcon = useMemo(
    () =>
      isLoaded
        ? {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#22c55e',
            fillOpacity: 0.9,
            strokeColor: '#16a34a',
            strokeWeight: 2,
            scale: 9,
          }
        : undefined,
    [isLoaded],
  );

  const vehicleIcon = useMemo(
    () =>
      isLoaded
        ? {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: '#3b82f6',
            fillOpacity: 0.9,
            strokeColor: '#2563eb',
            strokeWeight: 2,
            scale: 6,
            rotation: 0,
          }
        : undefined,
    [isLoaded],
  );

  // ── Loading & Error states ──────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-red-400">
        <p>Failed to load Google Maps. Please check the API key.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-foreground-muted">
        <Loader2 size={40} className="animate-spin text-agri-primary-light" />
        <p className="text-sm font-medium">Loading Google Maps…</p>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
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
              Real-time fleet positions, pending harvests, and IoT soil telemetry across Nigeria
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => fetchMapData()}
            disabled={dataLoading}
            className="rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-all shadow-md"
          >
            <RefreshCw
              size={14}
              className={dataLoading ? 'animate-spin text-emerald-400' : ''}
            />
            <span>Sync Network Map</span>
          </button>
        </div>

      </div>

      {/* Map + Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Google Map — 3 cols on desktop */}
        <div className="lg:col-span-3 card border border-border bg-gradient-to-br from-background-secondary to-background-card relative overflow-hidden min-h-[520px] rounded-2xl">
          {/* Live indicator bar */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 py-2 bg-background-card/80 backdrop-blur-md border-b border-border/40">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-agri-primary-light animate-pulse" />
              <span className="text-xs font-bold text-foreground">
                Nigerian Agricultural Trade Corridors
              </span>
              {dataLoading && (
                <Loader2 size={12} className="animate-spin text-foreground-dim ml-2" />
              )}
            </div>
            <div className="flex items-center gap-4 text-[11px] text-foreground-dim">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Harvests
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Vehicles
              </span>
            </div>
          </div>

          {/* Map Canvas */}
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            options={MAP_OPTIONS}
            onClick={() => setActiveMarker(null)}
          >
            {markers.map((m) => (
              <MarkerF
                key={m.id}
                position={m.position}
                icon={m.type === 'trade' ? tradeIcon : vehicleIcon}
                title={m.title}
                onClick={() => setActiveMarker(m)}
              />
            ))}

            {/* Active GPS Dispatch Simulation Marker (Ibadan -> Lagos Corridor) */}
            {simGPS && (
              <MarkerF
                position={simPos}
                icon={
                  isLoaded
                    ? {
                        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                        fillColor: '#f59e0b',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2.5,
                        scale: 7.5,
                        rotation: 220,
                      }
                    : undefined
                }
                title="Active 3PL Dispatch: Cassava Haulage (Live GPS)"
                onClick={() =>
                  setActiveMarker({
                    id: 'sim-active-fleet',
                    type: 'vehicle',
                    position: simPos,
                    title: 'Active Haulage Fleet #104 (Plate: KJA-482XY)',
                    details: {
                      Status: 'In-Transit (68 km/h)',
                      Route: 'Ibadan Depot -> Lagos Port Hub',
                      Progress: `${simProgress}% (${Math.floor(128 * (simProgress/100))} km completed)`,
                      FuelEfficiency: 'Optimal (AI Route Bypassed Sagamu Toll Jam)',
                    },
                  })
                }
              />
            )}

            {activeMarker && (
              <InfoWindowF
                position={activeMarker.position}
                onCloseClick={() => setActiveMarker(null)}
              >
                <div className="min-w-[180px] p-1 text-gray-900">
                  <p className="text-sm font-bold mb-1 flex items-center gap-1.5">
                    {activeMarker.type === 'trade' ? (
                      <Wheat size={14} className="text-emerald-600" />
                    ) : (
                      <Truck size={14} className="text-blue-600" />
                    )}
                    {activeMarker.title}
                  </p>
                  <div className="space-y-0.5 text-xs text-gray-700">
                    {Object.entries(activeMarker.details).map(([k, v]) => (
                      <p key={k}>
                        <span className="font-semibold">{k}:</span> {v}
                      </p>
                    ))}
                  </div>
                </div>
              </InfoWindowF>
            )}
          </GoogleMap>
        </div>

        {/* Stats Panel — right side on desktop, below on mobile */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5 border border-border bg-gradient-to-b from-background-card to-background-secondary space-y-5 rounded-2xl">
            <div className="border-b border-border/40 pb-3">
              <span className="text-[10px] font-bold text-agri-primary-light uppercase tracking-wider">
                Network Overview
              </span>
              <h3 className="text-lg font-black text-foreground mt-0.5">
                Live Stats
              </h3>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              {/* Total Trades */}
              <div className="p-3 rounded-xl bg-background-elevated border border-border flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Wheat size={18} />
                </div>
                <div>
                  <span className="text-[11px] text-foreground-dim block">
                    Pending Trades
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {stats.totalTrades}
                  </span>
                </div>
              </div>

              {/* Available Vehicles */}
              <div className="p-3 rounded-xl bg-background-elevated border border-border flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Truck size={18} />
                </div>
                <div>
                  <span className="text-[11px] text-foreground-dim block">
                    Available Vehicles
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {stats.availableVehicles}
                  </span>
                </div>
              </div>

              {/* In-Transit */}
              <div className="p-3 rounded-xl bg-background-elevated border border-border flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <span className="text-[11px] text-foreground-dim block">
                    In-Transit
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {stats.inTransit}
                  </span>
                </div>
              </div>

              {/* Avg Moisture */}
              <div className="p-3 rounded-xl bg-background-elevated border border-border flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                  <Droplets size={18} />
                </div>
                <div>
                  <span className="text-[11px] text-foreground-dim block">
                    Avg Soil Moisture
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {stats.avgMoisture > 0
                      ? `${stats.avgMoisture.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent telemetry feed */}
          <div className="card p-5 border border-border bg-background-card rounded-2xl space-y-3">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <Activity size={14} className="text-agri-primary-light" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Latest Telemetry
              </span>
            </div>

            {telemetry.length === 0 && (
              <p className="text-xs text-foreground-dim py-2">No telemetry data yet.</p>
            )}

            {telemetry.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-lg bg-background-secondary border border-border/60 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-foreground block">
                    {t.associated_lga || 'Unknown LGA'}
                  </span>
                  <span className="text-[11px] text-foreground-dim">
                    Moisture: {t.soil_moisture_percentage}%
                    {t.temperature != null && ` · ${t.temperature}°C`}
                  </span>
                </div>
                <span className="text-[10px] text-foreground-dim whitespace-nowrap">
                  {t.recorded_at
                    ? new Date(t.recorded_at).toLocaleTimeString()
                    : 'Live'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
