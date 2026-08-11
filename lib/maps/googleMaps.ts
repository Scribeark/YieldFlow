/**
 * lib/maps/googleMaps.ts
 *
 * Central module for all Google Maps Platform interactions.
 * All Geocoding and Directions API calls go through here.
 * No direct fetch/Google calls are scattered in page or component files.
 *
 * KEY HANDLING:
 * Maps_Platform_API_Key is a server-side env var (no NEXT_PUBLIC_ prefix).
 * It must be read in a Server Component and passed as a prop to Client Components.
 * Once passed to a Client Component and used to load Maps JavaScript,
 * it becomes visible in the browser — this is normal and expected for
 * the Maps JavaScript API. Restrict the key in Google Cloud Console with
 * HTTP referrer restrictions and API restrictions.
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
 * Geocodes an address string to latitude/longitude using the Google Geocoding API.
 * Only call this when the user submits an address — not on every keystroke or render.
 * Stores result to state; caller is responsible for persisting coordinates.
 */
export async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<GeocodeResult | null> {
  if (!address.trim() || !apiKey) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=ng`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      console.warn('[geocodeAddress] No result for:', address, 'Status:', data.status);
      return null;
    }

    const result = data.results[0];
    return {
      address: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };
  } catch (err) {
    console.error('[geocodeAddress] Error:', err);
    return null;
  }
}

/**
 * Reverse geocodes coordinates to a human-readable address.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<string | null> {
  if (lat == null || lng == null || !apiKey) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&region=ng`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      console.warn('[reverseGeocode] No result for:', lat, lng, 'Status:', data.status);
      return null;
    }

    return data.results[0].formatted_address;
  } catch (err) {
    console.error('[reverseGeocode] Error:', err);
    return null;
  }
}

/**
 * Requests a driving route between two points using the Google Directions API.
 * Returns the DirectionsResult which can be rendered by DirectionsRenderer.
 * Returns null if the route cannot be calculated.
 *
 * IMPORTANT: This uses the browser-side google.maps.DirectionsService.
 * Call this only inside a component where Maps JS is already loaded.
 */
export function getRouteBetweenPoints(
  origin: LatLng,
  destination: LatLng,
  google: typeof window.google
): Promise<google.maps.DirectionsResult | null> {
  return new Promise((resolve) => {
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
    EVIDENCE_PENDING: 'Evidence Pending',
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
    SEARCHING_LOGISTICS: '#3b82f6',
    ALLOCATED: '#8b5cf6',
    DISPATCHED: '#06b6d4',
    FULFILLED: '#22c55e',
    CANCELLED: '#6b7280',
  };
  return map[status] ?? '#6b7280';
}
