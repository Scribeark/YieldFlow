'use client';

/**
 * app/dashboard/seller/buyers-map/page.tsx
 *
 * Seller Map Tab — shows the seller's own listings and their current
 * trade status on a Google Map, including pickup, delivery, and carrier
 * location where available.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
} from '@react-google-maps/api';
import { useMapsKey } from '@/components/providers/MapsProvider';
import { useAuthStore } from '@/store/authStore';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PageContainer } from '@/components/ui/PageContainer';
import { MapPin, RefreshCw, Truck } from 'lucide-react';
import { statusLabel, statusColour } from '@/lib/maps/googleMaps';

const MAP_STYLE = { width: '100%', height: '70vh', borderRadius: '0.75rem' };
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

interface TradeWithBooking {
  id: string;
  commodity_variety: string;
  quantity_volume: number;
  physical_address: string;
  computed_latitude: number;
  computed_longitude: number;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  request_status: string;
  submission_channel: string;
  created_at: string;
  logistics_bookings?: {
    carrier_name: string;
    carrier_phone: string;
    vehicle_states?: {
      current_latitude: number;
      current_longitude: number;
      location_updated_at: string | null;
    } | null;
  }[];
}

export default function BuyersMapPage() {
  const router = useRouter();
  const apiKey = useMapsKey();
  const { profile } = useAuthStore();
  const supabase = createClient();

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey, libraries: ['places'] });

  const [trades, setTrades] = useState<TradeWithBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('trade_requests')
      .select(`
        id, commodity_variety, quantity_volume, physical_address,
        computed_latitude, computed_longitude, delivery_address,
        delivery_latitude, delivery_longitude, request_status,
        submission_channel, created_at,
        logistics_bookings(
          carrier_name, carrier_phone,
          vehicle_states(current_latitude, current_longitude, location_updated_at)
        )
      `)
      .eq('user_id', profile.id)
      .not('request_status', 'eq', 'CANCELLED')
      .not('computed_latitude', 'is', null)
      .order('created_at', { ascending: false });

    if (error) setError('Failed to load trades: ' + error.message);
    else setTrades((data ?? []) as unknown as TradeWithBooking[]);
    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const selected = selectedId ? trades.find(t => t.id === selectedId) : null;
  const activeBooking = selected?.logistics_bookings?.[0];
  const carrierLocation = activeBooking?.vehicle_states;

  if (loadError) {
    return (
      <PageContainer>
        <Alert variant="error">Google Maps failed to load. Check that Maps_Platform_API_Key is correct and Maps JavaScript API is enabled.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-5">
        <Button variant="ghost" onClick={() => router.push('/dashboard/seller')} className="mb-3">
          ← Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>My Listings Map</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
              View your listings and active trades geographically.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchTrades} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {!isLoaded ? (
        <div className="flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-sm opacity-60" style={MAP_STYLE}>
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading map…
        </div>
      ) : (
        <div className="relative">
          <GoogleMap
            mapContainerStyle={MAP_STYLE}
            center={NIGERIA_CENTER}
            zoom={6}
            options={{ streetViewControl: false, mapTypeControl: false }}
            onClick={() => setSelectedId(null)}
          >
            {trades.map(trade => (
              <Marker
                key={`pickup-${trade.id}`}
                position={{ lat: trade.computed_latitude, lng: trade.computed_longitude }}
                title={`${trade.commodity_variety} — ${statusLabel(trade.request_status)}`}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: statusColour(trade.request_status),
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                  scale: 9,
                }}
                onClick={() => setSelectedId(trade.id)}
              />
            ))}

            {/* Delivery markers */}
            {trades.filter(t => t.delivery_latitude && t.delivery_longitude).map(trade => (
              <Marker
                key={`delivery-${trade.id}`}
                position={{ lat: trade.delivery_latitude!, lng: trade.delivery_longitude! }}
                title={`Delivery: ${trade.commodity_variety}`}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.7,
                  strokeColor: '#fff',
                  strokeWeight: 1.5,
                  scale: 7,
                }}
              />
            ))}

            {/* Carrier markers */}
            {trades.map(trade => {
              const loc = trade.logistics_bookings?.[0]?.vehicle_states;
              if (!loc?.current_latitude) return null;
              return (
                <Marker
                  key={`carrier-${trade.id}`}
                  position={{ lat: loc.current_latitude, lng: loc.current_longitude }}
                  title="Carrier Location"
                  icon={{
                    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    fillColor: '#f97316',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 1.5,
                    scale: 5,
                  }}
                />
              );
            })}

            {selected && (
              <InfoWindow
                position={{ lat: selected.computed_latitude, lng: selected.computed_longitude }}
                onCloseClick={() => setSelectedId(null)}
              >
                <div className="min-w-[220px] max-w-[280px] text-sm p-1">
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 text-white" style={{ backgroundColor: statusColour(selected.request_status) }}>
                    {statusLabel(selected.request_status)}
                  </span>
                  <p className="font-bold text-base">{selected.commodity_variety}</p>
                  <p className="text-gray-600">{selected.quantity_volume} kg/tons</p>
                  <p className="text-gray-500 text-xs flex items-start gap-1 mt-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" /> {selected.physical_address}
                  </p>
                  {selected.delivery_address && (
                    <p className="text-gray-500 text-xs flex items-start gap-1 mt-1">
                      <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-blue-500" /> Delivery: {selected.delivery_address}
                    </p>
                  )}
                  {activeBooking && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-100 rounded text-xs">
                      <p className="font-bold flex items-center gap-1 text-orange-700">
                        <Truck className="w-3 h-3" /> Carrier: {activeBooking.carrier_name}
                      </p>
                      <p className="text-gray-600">{activeBooking.carrier_phone}</p>
                      {carrierLocation && (
                        <p className="text-gray-400 mt-0.5">Location: {carrierLocation.location_updated_at ? new Date(carrierLocation.location_updated_at).toLocaleTimeString() : 'Unknown'}</p>
                      )}
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Status legend */}
          <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-md flex flex-col gap-1.5">
            {['AWAITING_BUYER', 'SEARCHING_LOGISTICS', 'ALLOCATED', 'DISPATCHED', 'FULFILLED'].map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: statusColour(s) }} />
                {statusLabel(s)}
              </span>
            ))}
            <span className="flex items-center gap-1.5 mt-1 border-t pt-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Delivery Point</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> Carrier</span>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
