'use client';

/**
 * components/shared/TripMap.tsx
 *
 * Shared Google Maps component used by Seller, Buyer, and Carrier dashboards.
 *
 * Renders:
 *  - Seller pickup marker (green)
 *  - Buyer delivery marker (blue)
 *  - Carrier current location marker (orange, optional)
 *  - Route polyline via Directions API (between relevant points per lifecycle status)
 *  - Info windows with address labels
 *
 * Accepts apiKey as a prop (read server-side and passed down; browser-visible by design).
 * Does not geocode — expects raw coordinates from the database.
 * Does not poll — caller refreshes as needed.
 */

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  DirectionsRenderer,
} from '@react-google-maps/api';
import { getRouteBetweenPoints } from '@/lib/maps/googleMaps';
import { MapPin, Navigation, AlertCircle, RefreshCw } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TripMapProps {
  apiKey: string;
  requestStatus: string;

  // Seller pickup (from trade_requests)
  pickupAddress?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;

  // Buyer delivery (from trade_requests — present after buyer confirms)
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;

  // Carrier current location (from vehicle_states — optional)
  carrierLat?: number | null;
  carrierLng?: number | null;
  locationUpdatedAt?: string | null;

  // Display mode
  role?: 'seller' | 'buyer' | 'carrier';
  compact?: boolean; // smaller height for embedded timeline use
}

const MAP_CONTAINER_STYLE_FULL = { width: '100%', height: '400px', borderRadius: '0.75rem' };
const MAP_CONTAINER_STYLE_COMPACT = { width: '100%', height: '260px', borderRadius: '0.5rem' };
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

// ─── Staleness check ────────────────────────────────────────────────────────
function isLocationStale(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true;
  const age = Date.now() - new Date(updatedAt).getTime();
  return age > 15 * 60 * 1000; // stale if > 15 minutes
}

// ─── Component ──────────────────────────────────────────────────────────────
function TripMapInner({
  apiKey,
  requestStatus,
  pickupAddress,
  pickupLat,
  pickupLng,
  deliveryAddress,
  deliveryLat,
  deliveryLng,
  carrierLat,
  carrierLng,
  locationUpdatedAt,
  role,
  compact = false,
}: TripMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: ['places'],
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [activeInfoWindow, setActiveInfoWindow] = useState<'pickup' | 'delivery' | 'carrier' | null>(null);

  const hasPickup = pickupLat != null && pickupLng != null;
  const hasDelivery = deliveryLat != null && deliveryLng != null;
  const hasCarrier = carrierLat != null && carrierLng != null;

  // ─── Route calculation ────────────────────────────────────────────────────
  const calculateRoute = useCallback(async () => {
    if (!isLoaded || !hasPickup) return;
    setRouteError(false);

    let origin: { lat: number; lng: number } | null = null;
    let dest: { lat: number; lng: number } | null = null;

    if (requestStatus === 'ALLOCATED' && hasCarrier) {
      // Carrier → Pickup
      origin = { lat: carrierLat!, lng: carrierLng! };
      dest   = { lat: pickupLat!, lng: pickupLng! };
    } else if ((requestStatus === 'DISPATCHED' || requestStatus === 'FULFILLED') && hasDelivery) {
      // Pickup → Delivery
      origin = { lat: pickupLat!, lng: pickupLng! };
      dest   = { lat: deliveryLat!, lng: deliveryLng! };
    }

    if (origin && dest) {
      const result = await getRouteBetweenPoints(origin, dest, window.google);
      if (result) {
        setDirectionsResult(result);
      } else {
        setDirectionsResult(null);
        setRouteError(true);
      }
    } else {
      setDirectionsResult(null);
    }
  }, [isLoaded, requestStatus, hasPickup, hasDelivery, hasCarrier, pickupLat, pickupLng, deliveryLat, deliveryLng, carrierLat, carrierLng]);

  useEffect(() => {
    calculateRoute();
  }, [calculateRoute]);

  // ─── Fit bounds ───────────────────────────────────────────────────────────
  const fitBounds = useCallback(() => {
    if (!mapRef.current || !isLoaded) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasAny = false;
    if (hasPickup)   { bounds.extend({ lat: pickupLat!,   lng: pickupLng! });   hasAny = true; }
    if (hasDelivery) { bounds.extend({ lat: deliveryLat!, lng: deliveryLng! }); hasAny = true; }
    if (hasCarrier)  { bounds.extend({ lat: carrierLat!,  lng: carrierLng! });  hasAny = true; }
    if (hasAny) mapRef.current.fitBounds(bounds, 80);
  }, [isLoaded, hasPickup, hasDelivery, hasCarrier, pickupLat, pickupLng, deliveryLat, deliveryLng, carrierLat, carrierLng]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    fitBounds();
  }, [fitBounds]);

  // ─── Loading / Error states ───────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Map failed to load. Check that Maps_Platform_API_Key is correct and Maps JavaScript API is enabled.</span>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 text-sm opacity-60"
           style={compact ? MAP_CONTAINER_STYLE_COMPACT : MAP_CONTAINER_STYLE_FULL}>
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Loading map…
      </div>
    );
  }

  const staleCarrier = isLocationStale(locationUpdatedAt);

  return (
    <div className="space-y-2">
      {/* Stale location warning */}
      {hasCarrier && staleCarrier && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Carrier location may be outdated (last updated: {locationUpdatedAt ? new Date(locationUpdatedAt).toLocaleTimeString() : 'unknown'})
        </div>
      )}

      {/* Route error notice */}
      {routeError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-gray-600 text-xs">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Route could not be calculated. Markers are still shown.
        </div>
      )}

      <GoogleMap
        mapContainerStyle={compact ? MAP_CONTAINER_STYLE_COMPACT : MAP_CONTAINER_STYLE_FULL}
        center={hasPickup ? { lat: pickupLat!, lng: pickupLng! } : NIGERIA_CENTER}
        zoom={hasPickup ? 10 : 6}
        onLoad={onMapLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: !compact,
          zoomControl: true,
        }}
      >
        {/* Directions route polyline */}
        {directionsResult && (
          <DirectionsRenderer
            directions={directionsResult}
            options={{
              suppressMarkers: true, // we draw our own markers
              polylineOptions: { strokeColor: '#6366f1', strokeWeight: 4, strokeOpacity: 0.8 },
            }}
          />
        )}

        {/* Pickup marker — green */}
        {hasPickup && (
          <>
            <Marker
              position={{ lat: pickupLat!, lng: pickupLng! }}
              title="Pickup Point"
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#22c55e',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 10,
              }}
              onClick={() => setActiveInfoWindow('pickup')}
            />
            {activeInfoWindow === 'pickup' && (
              <InfoWindow
                position={{ lat: pickupLat!, lng: pickupLng! }}
                onCloseClick={() => setActiveInfoWindow(null)}
              >
                <div className="text-xs p-1 max-w-[200px]">
                  <p className="font-bold text-green-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Pickup Point
                  </p>
                  <p>{pickupAddress ?? 'Seller location'}</p>
                </div>
              </InfoWindow>
            )}
          </>
        )}

        {/* Delivery marker — blue */}
        {hasDelivery && (
          <>
            <Marker
              position={{ lat: deliveryLat!, lng: deliveryLng! }}
              title="Delivery Point"
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 10,
              }}
              onClick={() => setActiveInfoWindow('delivery')}
            />
            {activeInfoWindow === 'delivery' && (
              <InfoWindow
                position={{ lat: deliveryLat!, lng: deliveryLng! }}
                onCloseClick={() => setActiveInfoWindow(null)}
              >
                <div className="text-xs p-1 max-w-[200px]">
                  <p className="font-bold text-blue-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Delivery Point
                  </p>
                  <p>{deliveryAddress ?? 'Buyer location'}</p>
                </div>
              </InfoWindow>
            )}
          </>
        )}

        {/* Carrier marker — orange */}
        {hasCarrier && (
          <>
            <Marker
              position={{ lat: carrierLat!, lng: carrierLng! }}
              title="Carrier Location"
              icon={{
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                fillColor: staleCarrier ? '#9ca3af' : '#f97316',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 1.5,
                scale: 6,
                rotation: 0,
              }}
              onClick={() => setActiveInfoWindow('carrier')}
            />
            {activeInfoWindow === 'carrier' && (
              <InfoWindow
                position={{ lat: carrierLat!, lng: carrierLng! }}
                onCloseClick={() => setActiveInfoWindow(null)}
              >
                <div className="text-xs p-1 max-w-[200px]">
                  <p className="font-bold text-orange-700 mb-1 flex items-center gap-1">
                    <Navigation className="w-3 h-3" /> Carrier
                  </p>
                  {staleCarrier
                    ? <p className="text-amber-600">Location may be outdated</p>
                    : <p>Currently en route</p>
                  }
                </div>
              </InfoWindow>
            )}
          </>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 px-1">
        {hasPickup   && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Pickup</span>}
        {hasDelivery && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Delivery</span>}
        {hasCarrier  && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> Carrier</span>}
      </div>
    </div>
  );
}

export const TripMap = memo(TripMapInner);
