'use client';

/**
 * app/dashboard/carrier/tracking/page.tsx
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  DirectionsRenderer,
} from '@react-google-maps/api';
import { useMapsKey } from '@/components/providers/MapsProvider';
import { useAuthStore } from '@/store/authStore';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PageContainer } from '@/components/ui/PageContainer';
import { MapPin, Navigation, Package, RefreshCw, Truck, AlertTriangle } from 'lucide-react';
import { getRouteBetweenPoints } from '@/lib/maps/googleMaps';
import CarrierLocationModal from '@/components/shared/CarrierLocationModal';

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const MAP_STYLE  = { width: '100%', height: '65vh', borderRadius: '0.75rem' };
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

type MapLayer = 'preview' | 'available' | 'active';

interface SupplyPoint {
  id: string; commodity_variety: string; quantity_volume: number;
  physical_address: string; computed_latitude: number; computed_longitude: number;
  submission_channel: string; evidence_status: string; harvest_photo_url: string | null;
  delivery_address: string | null; delivery_latitude: number | null; delivery_longitude: number | null;
}
interface DemandPoint {
  id: string; commodity_variety: string; quantity_volume: number;
  delivery_address: string; computed_latitude: number | null; computed_longitude: number | null;
}
interface AvailableJob extends SupplyPoint {
  users?: { full_name: string; phone_number: string } | null;
}
interface ActiveBooking {
  id: string; trade_request_id: string; carrier_name: string; carrier_phone: string;
  trade_request?: { commodity_variety: string; quantity_volume: number; physical_address: string;
    computed_latitude: number; computed_longitude: number; delivery_address: string | null;
    delivery_latitude: number | null; delivery_longitude: number | null; request_status: string;
    users?: { full_name: string; phone_number: string } | null;
    buyer?: { full_name: string; phone_number: string } | null;
  } | null;
  vehicle_states?: { id: string; current_latitude: number; current_longitude: number; current_address?: string | null; location_updated_at: string | null; carrier_status?: string; vehicle_license_expires_at?: string | null; plate_number?: string; vehicle_nickname?: string; } | null;
}
interface Vehicle { id: string; carrier_status: string; vehicle_license_expires_at?: string | null; current_latitude?: number | null; current_longitude?: number | null; current_address?: string | null; location_updated_at?: string | null; plate_number?: string; vehicle_nickname?: string; vehicle_verification_status?: string; }

export default function CarrierTrackingPage() {
  const router    = useRouter();
  const apiKey    = useMapsKey();
  const { profile } = useAuthStore();
  const supabase  = createClient();

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey, libraries: ['places'] });

  const [layer, setLayer]           = useState<MapLayer>('available');
  const [supply, setSupply]         = useState<SupplyPoint[]>([]);
  const [demands, setDemands]       = useState<DemandPoint[]>([]);
  const [jobs, setJobs]             = useState<AvailableJob[]>([]);
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [eligibleVehicles, setEligibleVehicles] = useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lastLocationUpdate = useRef<number>(0);

  const [jobToAccept, setJobToAccept] = useState<AvailableJob | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const [vRes, supplyRes, demandRes, jobsRes, bookingRes] = await Promise.all([
      supabase.from('vehicle_states').select('*').eq('carrier_id', profile.id),
      supabase.from('trade_requests').select('id, commodity_variety, quantity_volume, physical_address, computed_latitude, computed_longitude, submission_channel, evidence_status, harvest_photo_url, delivery_address, delivery_latitude, delivery_longitude').in('request_status', ['AWAITING_BUYER', 'EVIDENCE_PENDING']).not('computed_latitude', 'is', null).limit(80),
      supabase.from('buyer_demands').select('id, commodity_variety, quantity_volume, delivery_address, computed_latitude, computed_longitude').in('demand_status', ['AWAITING_SELLER']).not('computed_latitude', 'is', null).limit(60),
      supabase.from('trade_requests').select('id, commodity_variety, quantity_volume, physical_address, computed_latitude, computed_longitude, delivery_address, delivery_latitude, delivery_longitude, submission_channel, evidence_status, harvest_photo_url, users!trade_requests_user_id_fkey(full_name, phone_number)').eq('request_status', 'SEARCHING_LOGISTICS').not('buyer_id', 'is', null).not('computed_latitude', 'is', null).not('delivery_latitude', 'is', null).or('evidence_status.eq.provided,evidence_status.eq.exempted').limit(50),
      supabase.from('logistics_bookings').select('id, trade_request_id, carrier_name, carrier_phone, vehicle_states(id, current_latitude, current_longitude, location_updated_at), trade_request:trade_requests(commodity_variety, quantity_volume, physical_address, computed_latitude, computed_longitude, delivery_address, delivery_latitude, delivery_longitude, request_status, users!trade_requests_user_id_fkey(full_name, phone_number), buyer:users!trade_requests_buyer_id_fkey(full_name, phone_number))').eq('carrier_id', profile.id).eq('status', 'active').maybeSingle(),
    ]);

    if (vRes.data) {
      const vs = vRes.data as Vehicle[];
      setVehicles(vs);
      const eligible = vs.filter(v => {
        if (v.carrier_status !== 'available') return false;
        if (!v.vehicle_license_expires_at) return false;
        if (new Date(v.vehicle_license_expires_at) < new Date()) return false;
        if (v.vehicle_verification_status !== 'pending' && v.vehicle_verification_status !== 'verified') return false;
        return true;
      });
      setEligibleVehicles(eligible);
    }
    
    if (supplyRes.data) setSupply(supplyRes.data as unknown as SupplyPoint[]);
    if (demandRes.data) setDemands(demandRes.data as unknown as DemandPoint[]);
    if (jobsRes.data) setJobs(jobsRes.data as unknown as AvailableJob[]);
    
    if (bookingRes.data) {
      setActiveBooking(bookingRes.data as unknown as ActiveBooking);
      setLayer('active');
    }
    if (vRes.error || supplyRes.error || jobsRes.error) setError('Failed to load some map data. Please refresh.');
    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Route for active trip
  useEffect(() => {
    if (!isLoaded || !activeBooking?.trade_request || layer !== 'active') return;
    const tr = activeBooking.trade_request;
    const vs = activeBooking.vehicle_states;
    if (!tr.computed_latitude || !tr.delivery_latitude) return;
    const status = tr.request_status;
    let origin = null as { lat: number; lng: number } | null;
    let dest   = null as { lat: number; lng: number } | null;
    
    if (status === 'ALLOCATED') {
      if (vs?.current_latitude && vs?.current_longitude) {
        origin = { lat: vs.current_latitude, lng: vs.current_longitude };
        dest = { lat: tr.computed_latitude, lng: tr.computed_longitude };
      } else {
        origin = { lat: tr.computed_latitude, lng: tr.computed_longitude };
        dest = { lat: tr.delivery_latitude!, lng: tr.delivery_longitude! };
      }
    } else if (status === 'DISPATCHED' || status === 'FULFILLED') { 
      if (vs?.current_latitude && vs?.current_longitude) {
        origin = { lat: vs.current_latitude, lng: vs.current_longitude };
        dest = { lat: tr.delivery_latitude!, lng: tr.delivery_longitude! };
      } else {
        origin = { lat: tr.computed_latitude, lng: tr.computed_longitude };
        dest = { lat: tr.delivery_latitude!, lng: tr.delivery_longitude! };
      }
    }
    if (origin && dest) getRouteBetweenPoints(origin, dest, window.google).then(r => setDirections(r));
  }, [isLoaded, activeBooking, layer]);

  // Foreground Watch Position for Active Trip
  useEffect(() => {
    if (layer !== 'active' || !activeBooking || !activeBooking.vehicle_states?.id) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastLocationUpdate.current < 30000) return;
        lastLocationUpdate.current = now;
        
        await supabase.from('vehicle_states').update({
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
          location_updated_at: new Date().toISOString(),
        }).eq('id', activeBooking.vehicle_states!.id);
      },
      (err) => console.warn('watchPosition error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeBooking, layer, supabase]);

  const handleUpdateLocation = async () => {
    if (!activeBooking?.vehicle_states?.id) return;
    setUpdatingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.from('vehicle_states').update({
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
          location_updated_at: new Date().toISOString(),
        }).eq('id', activeBooking.vehicle_states!.id);
        if (error) setActionStatus({ type: 'error', message: 'Failed to update location.' });
        else { setActionStatus({ type: 'success', message: 'Location updated successfully.' }); await fetchData(); }
        setUpdatingLocation(false);
      },
      () => { setActionStatus({ type: 'error', message: 'Could not get GPS location.' }); setUpdatingLocation(false); },
      { timeout: 10000 }
    );
  };

  const handleConfirmLocationAndClaim = async (vehicleId: string, locationData?: { latitude: number, longitude: number, address: string | null }) => {
    if (!jobToAccept) return;
    setActionStatus(null);
    try {
      if (locationData) {
        const { error: vError } = await supabase.from('vehicle_states').update({
          current_latitude: locationData.latitude,
          current_longitude: locationData.longitude,
          current_address: locationData.address,
          location_updated_at: new Date().toISOString()
        }).eq('id', vehicleId);
        if (vError) throw new Error('Failed to update vehicle location.');
      }

      const vehicle = vehicles.find(v => v.id === vehicleId);
      const finalLat = locationData?.latitude ?? vehicle?.current_latitude;
      const finalLng = locationData?.longitude ?? vehicle?.current_longitude;
      
      let distance = 0;
      if (finalLat && finalLng && jobToAccept.computed_latitude && jobToAccept.computed_longitude) {
        distance = calculateHaversineDistance(finalLat, finalLng, jobToAccept.computed_latitude, jobToAccept.computed_longitude);
      }

      const { error: rpcError } = await supabase.rpc('rpc_claim_logistics_job', {
        p_trade_request_id: jobToAccept.id,
        p_vehicle_state_id: vehicleId,
        p_proximity_distance_km: distance
      });

      if (rpcError) throw new Error(rpcError.message || 'Unable to claim this logistics job.');

      setActionStatus({ type: 'success', message: 'Job accepted! You are now assigned to this delivery.' });
      setLayer('active');
      await fetchData();
    } catch(err: any) {
      setActionStatus({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setJobToAccept(null);
    }
  };

  const selectedJob = selectedId ? jobs.find(j => j.id === selectedId) : null;

  if (loadError) {
    return <PageContainer><Alert variant="error">Google Maps failed to load. Check Maps_Platform_API_Key and enable Maps JavaScript API in Google Cloud.</Alert></PageContainer>;
  }

  return (
    <PageContainer>
      <div className="mb-5">
        <Button variant="ghost" onClick={() => router.push('/dashboard/carrier')} className="mb-3">← Back to Dashboard</Button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Fleet & Tracking Map</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>View market opportunities and accept logistics jobs.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
            {activeBooking?.vehicle_states && (
              <Button size="sm" onClick={handleUpdateLocation} disabled={updatingLocation} isLoading={updatingLocation}>
                <Navigation className="w-4 h-4 mr-1" /> Update My Location
              </Button>
            )}
          </div>
        </div>
      </div>

      {actionStatus && (
        <Alert variant={actionStatus.type === 'success' ? 'success' : 'error'} className="mb-4">{actionStatus.message}</Alert>
      )}

      {/* Layer switcher */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { id: 'preview' as MapLayer, label: 'Market Preview', icon: Package },
          { id: 'available' as MapLayer, label: `Available Jobs (${jobs.length})`, icon: Truck },
          ...(activeBooking ? [{ id: 'active' as MapLayer, label: 'My Active Trip', icon: Navigation }] : []),
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setLayer(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${layer === id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-gray-700 hover:bg-black/5'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

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
            onLoad={m => { mapRef.current = m; }}
            options={{ streetViewControl: false, mapTypeControl: false }}
            onClick={() => setSelectedId(null)}
          >
            {/* ── Layer A: Market Preview ── */}
            {layer === 'preview' && <>
              {supply.map(s => (
                <Marker key={`s-${s.id}`} position={{ lat: s.computed_latitude, lng: s.computed_longitude }}
                  title={`Supply: ${s.commodity_variety}`}
                  icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#22c55e', fillOpacity: 0.8, strokeColor: '#fff', strokeWeight: 2, scale: 8 }} />
              ))}
              {demands.filter(d => d.computed_latitude).map(d => (
                <Marker key={`d-${d.id}`} position={{ lat: d.computed_latitude!, lng: d.computed_longitude! }}
                  title={`Demand: ${d.commodity_variety}`}
                  icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#3b82f6', fillOpacity: 0.8, strokeColor: '#fff', strokeWeight: 2, scale: 8 }} />
              ))}
            </>}

            {/* ── Layer B: Available Jobs ── */}
            {layer === 'available' && <>
              {jobs.map(job => (
                <React.Fragment key={job.id}>
                  <Marker position={{ lat: job.computed_latitude, lng: job.computed_longitude }}
                    title={`Pickup: ${job.commodity_variety}`}
                    icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#8b5cf6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 10 }}
                    onClick={() => setSelectedId(job.id)} />
                  {job.delivery_latitude && job.delivery_longitude && (
                    <Marker position={{ lat: job.delivery_latitude, lng: job.delivery_longitude }}
                      title={`Delivery: ${job.commodity_variety}`}
                      icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#3b82f6', fillOpacity: 0.8, strokeColor: '#fff', strokeWeight: 1.5, scale: 7 }} />
                  )}
                </React.Fragment>
              ))}

              {selectedJob && (
                <InfoWindow position={{ lat: selectedJob.computed_latitude, lng: selectedJob.computed_longitude }} onCloseClick={() => setSelectedId(null)}>
                  <div className="min-w-[240px] max-w-[300px] text-sm p-1 space-y-2">
                    {selectedJob.submission_channel === 'ussd' && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> USSD — Evidence Exempted
                      </span>
                    )}
                    {selectedJob.harvest_photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedJob.harvest_photo_url} alt="Harvest" className="w-full h-28 object-cover rounded" />
                    )}
                    <div>
                      <p className="font-bold text-base">{selectedJob.commodity_variety}</p>
                      <p className="text-gray-600">{selectedJob.quantity_volume} kg/tons</p>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p className="flex items-start gap-1"><MapPin className="w-3 h-3 shrink-0 mt-0.5 text-green-500" /> Pickup: {selectedJob.physical_address}</p>
                      {selectedJob.delivery_address && <p className="flex items-start gap-1"><MapPin className="w-3 h-3 shrink-0 mt-0.5 text-blue-500" /> Delivery: {selectedJob.delivery_address}</p>}
                    </div>
                    {eligibleVehicles.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded p-1.5">No eligible vehicle. Check your fleet status.</p>
                    ) : (
                      <Button className="w-full" onClick={() => setJobToAccept(selectedJob)}>
                        Accept This Job
                      </Button>
                    )}
                  </div>
                </InfoWindow>
              )}
            </>}

            {/* ── Layer C: Active Trip ── */}
            {layer === 'active' && activeBooking?.trade_request && (() => {
              const tr = activeBooking.trade_request;
              const vs = activeBooking.vehicle_states;
              return <>
                {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#6366f1', strokeWeight: 4 } }} />}
                {tr.computed_latitude && <Marker position={{ lat: tr.computed_latitude, lng: tr.computed_longitude }} title="Pickup" icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#22c55e', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 10 }} />}
                {tr.delivery_latitude && <Marker position={{ lat: tr.delivery_latitude, lng: tr.delivery_longitude! }} title="Delivery" icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#3b82f6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 10 }} />}
                {vs?.current_latitude && <Marker position={{ lat: vs.current_latitude, lng: vs.current_longitude }} title="Your Location" icon={{ path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, fillColor: '#f97316', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1.5, scale: 7 }} />}
              </>;
            })()}
          </GoogleMap>

          {/* Legends */}
          {layer === 'preview' && (
            <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
              <p className="font-semibold mb-1 text-gray-700 dark:text-gray-200">Market Preview</p>
              <p className="text-gray-500 text-[10px] mb-1">Informational only. Accept jobs from Available Jobs tab.</p>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Seller Supply</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Buyer Demand</span>
            </div>
          )}
          {layer === 'available' && (
            <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Pickup Point</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Delivery Point</span>
            </div>
          )}
          {layer === 'active' && (
            <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-md space-y-1">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Pickup</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Delivery</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> Your Location</span>
            </div>
          )}
        </div>
      )}

      {/* Active trip detail panel */}
      {layer === 'active' && activeBooking?.trade_request && (
        <div className="mt-4 p-4 rounded-xl border bg-[var(--card-bg)] space-y-2">
          <h3 className="font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-indigo-500" /> Active Trip Details</h3>
          {!activeBooking.vehicle_states?.current_latitude && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-lg text-sm flex items-start gap-2 my-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Your live location is currently unavailable. Please click <strong>Update My Location</strong> so the buyer and seller can track your progress.</p>
            </div>
          )}
          <p><span className="text-gray-500 text-sm">Commodity:</span> <span className="font-medium">{activeBooking.trade_request.commodity_variety} — {activeBooking.trade_request.quantity_volume} kg/tons</span></p>
          <p><span className="text-gray-500 text-sm">Pickup:</span> <span className="font-medium">{activeBooking.trade_request.physical_address}</span></p>
          {activeBooking.trade_request.delivery_address && <p><span className="text-gray-500 text-sm">Delivery:</span> <span className="font-medium">{activeBooking.trade_request.delivery_address}</span></p>}
          {activeBooking.trade_request.users && <p><span className="text-gray-500 text-sm">Seller:</span> <span className="font-medium">{activeBooking.trade_request.users.full_name}</span></p>}
        </div>
      )}

      {jobToAccept && (
        <CarrierLocationModal
          isOpen={!!jobToAccept}
          onClose={() => setJobToAccept(null)}
          eligibleVehicles={eligibleVehicles}
          onConfirm={handleConfirmLocationAndClaim}
        />
      )}
    </PageContainer>
  );
}
