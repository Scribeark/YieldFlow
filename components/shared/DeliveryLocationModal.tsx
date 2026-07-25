'use client';

/**
 * components/shared/DeliveryLocationModal.tsx
 *
 * Modal that collects delivery address + coordinates from the buyer
 * before calling rpc_confirm_order.
 *
 * Supports two resolution strategies:
 *   1. Browser GPS (navigator.geolocation)
 *   2. Address input → Google Geocoding API
 *
 * Emits the resolved location via onConfirm callback.
 * Does NOT call rpc_confirm_order directly — caller handles that.
 */

import React, { useState } from 'react';
import { geocodeAddress } from '@/lib/maps/googleMaps';
import { MapPin, Navigation, AlertCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface DeliveryLocation {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  apiKey: string;
  listing: {
    commodity_variety: string;
    quantity_volume: number;
    submission_channel: string;
    evidence_status: string;
  };
  onConfirm: (location: DeliveryLocation, confirmUssdExemption: boolean) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeliveryLocationModal({ apiKey, listing, onConfirm, onCancel, isLoading }: Props) {
  const isUssd = listing.submission_channel === 'ussd' && !listing.evidence_status.includes('provided');
  const [mode, setMode] = useState<'gps' | 'address'>('gps');
  const [addressInput, setAddressInput] = useState('');
  const [resolved, setResolved] = useState<DeliveryLocation | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ussdChecked, setUssdChecked] = useState(false);

  const canConfirm = resolved !== null && (!isUssd || ussdChecked);

  // ─── GPS ──────────────────────────────────────────────────────────────────
  const handleGps = () => {
    if (!navigator.geolocation) {
      setError('Browser GPS not supported. Please enter your address instead.');
      setMode('address');
      return;
    }
    setGpsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Reverse geocode to get a readable address
        const result = await geocodeAddress(`${lat},${lng}`, apiKey);
        setResolved({
          address: result?.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          lat,
          lng,
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setError('Could not get GPS location. Please enter your address instead.');
        setMode('address');
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  };

  // ─── Address geocode ──────────────────────────────────────────────────────
  const handleGeocode = async () => {
    if (!addressInput.trim()) return;
    setGeocoding(true);
    setError(null);
    const result = await geocodeAddress(addressInput, apiKey);
    if (result) {
      setResolved(result);
    } else {
      setError('Address not found. Try adding city/state (e.g. "Kano Market, Kano State, Nigeria").');
    }
    setGeocoding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--card-bg,#fff)] dark:bg-gray-900 border border-[var(--border-color,#e5e7eb)] rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color,#e5e7eb)]">
          <div>
            <h2 className="font-bold text-lg">Confirm Delivery Location</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {listing.commodity_variety} — {listing.quantity_volume} kg/tons
            </p>
          </div>
          <button onClick={onCancel} className="p-1 rounded-full hover:bg-black/10 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* USSD warning */}
          {isUssd && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <p className="font-bold flex items-center gap-1 mb-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                USSD Low-Bandwidth Submission
              </p>
              <p className="text-xs">
                This listing was created via USSD. No harvest photo was provided. You are accepting the evidence exemption and assuming all associated risks.
              </p>
              <label className="flex items-start gap-2 mt-3 cursor-pointer text-xs font-medium">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ussdChecked}
                  onChange={e => setUssdChecked(e.target.checked)}
                />
                I understand and accept the USSD evidence exemption.
              </label>
            </div>
          )}

          {/* Mode selector */}
          <div className="flex rounded-lg overflow-hidden border border-[var(--border-color,#e5e7eb)]">
            <button
              onClick={() => setMode('gps')}
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${mode === 'gps' ? 'bg-indigo-600 text-white' : 'hover:bg-black/5'}`}
            >
              <Navigation className="w-3.5 h-3.5" /> Use My GPS
            </button>
            <button
              onClick={() => setMode('address')}
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${mode === 'address' ? 'bg-indigo-600 text-white' : 'hover:bg-black/5'}`}
            >
              <MapPin className="w-3.5 h-3.5" /> Enter Address
            </button>
          </div>

          {/* GPS mode */}
          {mode === 'gps' && !resolved && (
            <Button
              className="w-full"
              onClick={handleGps}
              disabled={gpsLoading}
              isLoading={gpsLoading}
            >
              {gpsLoading ? 'Getting Location…' : 'Detect My Location'}
            </Button>
          )}

          {/* Address mode */}
          {mode === 'address' && (
            <div className="flex gap-2">
              <input
                type="text"
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                placeholder="e.g. Kano City Market, Kano State"
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color,#e5e7eb)] text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button onClick={handleGeocode} disabled={geocoding || !addressInput.trim()} isLoading={geocoding} className="shrink-0">
                Find
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}

          {/* Resolved location */}
          {resolved && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              <p className="font-bold flex items-center gap-1 mb-1">
                <MapPin className="w-4 h-4 shrink-0" /> Delivery Location Set
              </p>
              <p className="text-xs break-words">{resolved.address}</p>
              <button
                className="text-xs text-green-600 underline mt-1"
                onClick={() => { setResolved(null); setError(null); }}
              >
                Change location
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={onCancel} className="flex-1" disabled={isLoading}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!canConfirm || isLoading}
              isLoading={isLoading}
              onClick={() => resolved && onConfirm(resolved, isUssd && ussdChecked)}
            >
              {isLoading ? 'Confirming…' : 'Confirm Order'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
