/**
 * lib/maps/googleMaps.ts
 *
 * Central module for all Google Maps Platform interactions.
 * All Geocoding and Directions API calls go through here.
 * Prioritizes window.google.maps.Geocoder (browser SDK) -> Server API route -> Direct REST.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

/**
 * Geocodes an address string to latitude/longitude.
 */
export async function geocodeAddress(
  address: string,
  apiKey?: string
): Promise<GeocodeResult | null> {
  if (!address || !address.trim()) return null;

  // 1. If running in browser and Google Maps JS SDK is loaded, use Geocoder directly
  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({
        address: address.trim(),
        componentRestrictions: { country: 'NG' },
      });
      if (response.results && response.results[0]) {
        const res = response.results[0];
        return {
          address: res.formatted_address,
          lat: res.geometry.location.lat(),
          lng: res.geometry.location.lng(),
        };
      }
    } catch (e) {
      console.warn('[geocodeAddress] JS Geocoder failed, trying fallback:', e);
    }
  }

  // 2. Try server-side proxy route (/api/maps/geocode)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/maps/geocode?address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'OK' && json.result) {
          return json.result;
        }
      }
    } catch (e) {
      console.warn('[geocodeAddress] Proxy fetch failed:', e);
    }
  }

  // 3. Fallback to direct Google Geocoding REST API if apiKey is provided
  const effectiveKey =
    apiKey ||
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_MAPS_PLATFORM_API_KEY ||
        process.env.Maps_Platform_API_Key ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      : '');

  if (effectiveKey) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${effectiveKey}&region=ng`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const result = data.results[0];
        return {
          address: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        };
      }
    } catch (err) {
      console.error('[geocodeAddress] REST fallback error:', err);
    }
  }

  return null;
}

/**
 * Reverse geocodes coordinates to a human-readable address.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey?: string
): Promise<string | null> {
  if (lat == null || lng == null) return null;

  // 1. If running in browser and Google Maps JS SDK is loaded, use Geocoder directly
  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({
        location: { lat, lng },
      });
      if (response.results && response.results[0]) {
        return response.results[0].formatted_address;
      }
    } catch (e) {
      console.warn('[reverseGeocode] JS Geocoder failed, trying fallback:', e);
    }
  }

  // 2. Try server-side proxy route (/api/maps/reverse-geocode)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'OK' && json.formatted_address) {
          return json.formatted_address;
        }
      }
    } catch (e) {
      console.warn('[reverseGeocode] Proxy fetch failed:', e);
    }
  }

  // 3. Fallback to direct REST API
  const effectiveKey =
    apiKey ||
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_MAPS_PLATFORM_API_KEY ||
        process.env.Maps_Platform_API_Key ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      : '');

  if (effectiveKey) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${effectiveKey}&region=ng`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        return data.results[0].formatted_address;
      }
    } catch (err) {
      console.error('[reverseGeocode] REST fallback error:', err);
    }
  }

  return null;
}

/**
 * Requests a driving route between two points using the Google Directions API.
 */
export function getRouteBetweenPoints(
  origin: LatLng,
  destination: LatLng,
  google: typeof window.google
): Promise<google.maps.DirectionsResult | null> {
  return new Promise((resolve) => {
    if (!google?.maps?.DirectionsService) {
      resolve(null);
      return;
    }
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          resolve(result);
        } else {
          console.warn('[getRouteBetweenPoints] Directions failed:', status);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Returns a human-readable label for a trade request status.
 */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    AWAITING_BUYER: 'Awaiting Buyer',
    EVIDENCE_PENDING: 'Harvest Photo Pending',
    AWAITING_HARVEST_CONFIRMATION: 'Harvest Photo Pending',
    SEARCHING_LOGISTICS: 'Searching for Carrier',
    ALLOCATED: 'Carrier Assigned',
    DISPATCHED: 'In Transit',
    FULFILLED: 'Delivered',
    CANCELLED: 'Cancelled',
  };
  return map[status] ?? status;
}

/**
 * Returns a hex colour for a map marker based on trade status.
 */
export function statusColour(status: string): string {
  const map: Record<string, string> = {
    AWAITING_BUYER: '#f59e0b',
    EVIDENCE_PENDING: '#f97316',
    AWAITING_HARVEST_CONFIRMATION: '#f97316',
    SEARCHING_LOGISTICS: '#3b82f6',
    ALLOCATED: '#8b5cf6',
    DISPATCHED: '#06b6d4',
    FULFILLED: '#22c55e',
    CANCELLED: '#6b7280',
  };
  return map[status] ?? '#6b7280';
}
