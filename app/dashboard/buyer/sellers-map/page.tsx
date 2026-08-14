'use client';

/**
 * app/dashboard/buyer/sellers-map/page.tsx
 *
 * Buyer Map Tab — shows active seller listings and harvest opportunities on a Google Map.
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
import { createClient } from '@/lib/supabase/client';
import { confirmOrder, requestEvidence, ConfirmOrderParams, TradeRequestRow } from '@/lib/api/buyer';
import { DeliveryLocationModal, DeliveryLocation } from '@/components/shared/DeliveryLocationModal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PageContainer } from '@/components/ui/PageContainer';
import { MapPin, AlertTriangle, Package, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const MAP_STYLE = { width: '100%', height: '70vh', borderRadius: '0.75rem' };
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

export default function SellersMapPage() {
  const router = useRouter();
  const apiKey = useMapsKey();
  const supabase = createClient();

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey, libraries: ['places'] });

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tradeRes, bulkRes] = await Promise.all([
        supabase
          .from('trade_requests')
          .select('*')
          .in('request_status', ['AWAITING_BUYER', 'EVIDENCE_PENDING'])
          .is('buyer_id', null)
          .not('computed_latitude', 'is', null)
          .not('computed_longitude', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('bulk_offtake_listings')
          .select('*')
          .eq('listing_status', 'OPEN')
          .not('pickup_latitude', 'is', null)
          .not('pickup_longitude', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const tradeList = (tradeRes.data ?? []).map((t: any) => ({
        id: t.id,
        commodity_variety: t.commodity_variety,
        quantity_volume: t.quantity_volume,
        physical_address: t.physical_address,
        computed_latitude: t.computed_latitude,
        computed_longitude: t.computed_longitude,
        request_status: t.request_status,
        submission_channel: t.submission_channel,
        harvest_photo_url: t.harvest_photo_url,
        evidence_status: t.evidence_status,
        is_bulk: false,
      }));

      const bulkList = (bulkRes.data ?? []).map((b: any) => ({
        id: b.id,
        commodity_variety: b.crop_type,
        quantity_volume: b.listed_quantity,
        physical_address: b.pickup_address || 'Pickup Location',
        computed_latitude: b.pickup_latitude,
        computed_longitude: b.pickup_longitude,
        request_status: 'OPEN',
        submission_channel: 'bulk_offtake',
        harvest_photo_url: b.harvest_photo_url,
        evidence_status: b.evidence_status,
        asking_price_per_unit: b.asking_price_per_unit,
        quantity_unit: b.quantity_unit,
        is_bulk: true,
      }));

      setListings([...tradeList, ...bulkList]);
    } catch (err: any) {
      setError('Failed to load marketplace listings: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const selectedListing = selectedId ? listings.find(l => l.id === selectedId) : null;
  const pendingListing  = pendingConfirmId ? listings.find(l => l.id === pendingConfirmId) : null;

  const handleConfirmWithLocation = async (location: DeliveryLocation, confirmUssdExemption: boolean) => {
    if (!pendingConfirmId) return;
    setIsConfirming(true);
    const params: ConfirmOrderParams = {
      requestId: pendingConfirmId,
      deliveryAddress: location.address,
      deliveryLatitude: location.lat,
      deliveryLongitude: location.lng,
      confirmUssdExemption,
    };
    const { error } = await confirmOrder(supabase, params);
    if (error) {
      setActionStatus({ id: pendingConfirmId, type: 'error', message: error.message });
    } else {
      const cId = pendingConfirmId;
      setActionStatus({ id: cId, type: 'success', message: 'Order confirmed! Now searching for a carrier.' });
      setListings(prev => prev.filter(l => l.id !== cId));
      setSelectedId(null);
    }
    setPendingConfirmId(null);
    setIsConfirming(false);
  };

  const handleRequestEvidence = async (requestId: string) => {
    const { error } = await requestEvidence(supabase, requestId);
    if (error) {
      setActionStatus({ id: requestId, type: 'error', message: error.message });
    } else {
      setActionStatus({ id: requestId, type: 'success', message: 'Harvest Confirmation Photo requested from seller.' });
      setListings(prev => prev.map(l => l.id === requestId ? { ...l, request_status: 'EVIDENCE_PENDING' } : l));
      setSelectedId(null);
    }
  };

  if (loadError) {
    return (
      <PageContainer>
        <Alert variant="error">Google Maps could not be loaded. Please verify the Maps API key is configured.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-5">
        <Button variant="ghost" onClick={() => router.push('/dashboard/buyer')} className="mb-3">
          ← Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Available Harvests Map</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
              Geospatial view of active seller supply and harvest opportunities.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchListings} disabled={loading}>
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
            {listings.map(listing => (
              <Marker
                key={listing.id}
                position={{ lat: listing.computed_latitude, lng: listing.computed_longitude }}
                title={`${listing.commodity_variety} — ${listing.quantity_volume} units`}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: listing.is_bulk ? '#8b5cf6' : (listing.request_status === 'AWAITING_BUYER' ? '#22c55e' : '#f59e0b'),
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                  scale: 8,
                }}
                onClick={() => setSelectedId(listing.id)}
              />
            ))}

            {selectedListing && (
              <InfoWindow
                position={{ lat: selectedListing.computed_latitude, lng: selectedListing.computed_longitude }}
                onCloseClick={() => setSelectedId(null)}
              >
                <div className="p-1 text-gray-900 text-xs space-y-2 max-w-xs">
                  <div className="font-bold text-sm">{selectedListing.commodity_variety}</div>
                  <div className="opacity-75">{selectedListing.quantity_volume} {selectedListing.quantity_unit || 'kg/tons'}</div>
                  {selectedListing.asking_price_per_unit && (
                    <div className="font-semibold text-green-700">₦{Number(selectedListing.asking_price_per_unit).toLocaleString()} / {selectedListing.quantity_unit || 'unit'}</div>
                  )}
                  <div className="text-gray-600 truncate">{selectedListing.physical_address}</div>

                  {selectedListing.is_bulk ? (
                    <div className="pt-2">
                      <Link href="/dashboard/buyer/pre-harvest">
                        <button className="w-full bg-purple-600 text-white rounded px-3 py-1.5 font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-1">
                          View & Submit Bid <ArrowRight size={12} />
                        </button>
                      </Link>
                    </div>
                  ) : (
                    <div className="pt-1 flex flex-col gap-1">
                      <button
                        onClick={() => setPendingConfirmId(selectedListing.id)}
                        className="w-full bg-green-600 text-white rounded px-2 py-1 font-medium hover:bg-green-700 transition-colors"
                      >
                        Claim / Confirm Order
                      </button>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      )}

      {pendingConfirmId && pendingListing && (
        <DeliveryLocationModal
          apiKey={apiKey}
          listing={pendingListing}
          onConfirm={handleConfirmWithLocation}
          onCancel={() => setPendingConfirmId(null)}
          isLoading={isConfirming}
        />
      )}
    </PageContainer>
  );
}
