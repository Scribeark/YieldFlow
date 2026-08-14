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
import { MapPin, RefreshCw, Truck, Layers } from 'lucide-react';
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
  is_bulk_listing?: boolean;
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

    try {
      const [tradeRes, bulkRes] = await Promise.all([
        supabase
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
          .order('created_at', { ascending: false }),
        supabase
          .from('bulk_offtake_listings')
          .select('*')
          .eq('seller_id', profile.id)
          .not('listing_status', 'eq', 'CANCELLED')
          .not('pickup_latitude', 'is', null)
          .order('created_at', { ascending: false }),
      ]);

      const tradeList: TradeWithBooking[] = (tradeRes.data ?? []) as unknown as TradeWithBooking[];

      const bulkList: TradeWithBooking[] = (bulkRes.data ?? []).map((b: any) => ({
        id: b.id,
        commodity_variety: b.crop_type,
        quantity_volume: b.listed_quantity,
        physical_address: b.pickup_address || 'Pickup Location',
        computed_latitude: b.pickup_latitude,
        computed_longitude: b.pickup_longitude,
        delivery_address: null,
        delivery_latitude: null,
        delivery_longitude: null,
        request_status: b.listing_status || 'OPEN',
        submission_channel: 'bulk_offtake',
        created_at: b.created_at,
        is_bulk_listing: true,
      }));

      // Combine
      const combined = [...tradeList, ...bulkList.filter(b => !tradeList.some(t => t.id === b.id))];
      setTrades(combined);
    } catch (err: any) {
      setError('Failed to load listings map: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [profile, supabase]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const selected = selectedId ? trades.find(t => t.id === selectedId) : null;
  const activeBooking = selected?.logistics_bookings?.[0];
  const carrierLocation = activeBooking?.vehicle_states;

  if (loadError) {
    return (
      <PageContainer>
        <Alert variant="error">Google Maps could not be loaded. Please ensure NEXT_PUBLIC_MAPS_PLATFORM_API_Key is configured.</Alert>
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
              View your harvest supply and active trades geographically.
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
                  title={`Carrier for ${trade.commodity_variety}`}
                  icon={{
                    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    fillColor: '#f97316',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 1.5,
                    scale: 6,
                  }}
                  onClick={() => setSelectedId(trade.id)}
                />
              );
            })}

            {/* Selected Trade InfoWindow */}
            {selected && (
              <InfoWindow
                position={{ lat: selected.computed_latitude, lng: selected.computed_longitude }}
                onCloseClick={() => setSelectedId(null)}
              >
                <div className="p-1 text-gray-900 text-xs space-y-1.5 max-w-xs">
                  <div className="font-bold text-sm">{selected.commodity_variety}</div>
                  <div className="opacity-75">{selected.quantity_volume} units</div>
                  <div className="flex items-center gap-1 font-semibold">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColour(selected.request_status) }} />
                    {statusLabel(selected.request_status)}
                  </div>
                  <div className="pt-1 border-t border-gray-200">
                    <div className="text-[10px] uppercase font-bold text-gray-500">Pickup</div>
                    <div>{selected.physical_address}</div>
                  </div>
                  {selected.delivery_address && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-500">Delivery</div>
                      <div>{selected.delivery_address}</div>
                    </div>
                  )}
                  {carrierLocation?.current_latitude && (
                    <div className="text-orange-600 font-medium flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      Carrier on route
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      )}
    </PageContainer>
  );
}
