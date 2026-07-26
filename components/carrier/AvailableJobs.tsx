'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Truck, AlertTriangle } from 'lucide-react';
import CarrierLocationModal from '../shared/CarrierLocationModal';

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

interface Job {
  id: string;
  commodity_variety: string;
  quantity_volume: number;
  physical_address: string;
  evidence_status: string;
  harvest_photo_url?: string;
  computed_latitude?: number;
  computed_longitude?: number;
  delivery_address?: string | null;
  users?: { full_name: string; phone_number: string } | null;
}

interface Vehicle {
  id: string;
  current_latitude: number | null;
  current_longitude: number | null;
  current_address?: string | null;
  location_updated_at?: string | null;
  vehicle_license_expires_at?: string | null;
  vehicle_verification_status?: string;
  carrier_status: string;
  plate_number?: string;
  vehicle_nickname?: string;
}

export default function AvailableJobs() {
  const { profile } = useAuthStore();
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [eligibleVehicles, setEligibleVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: vData, error: vError } = await supabase
      .from('vehicle_states')
      .select('*')
      .eq('carrier_id', profile.id);

    if (vError) console.error('Error fetching vehicles:', vError);

    const fetchedVehicles = (vData ?? []) as Vehicle[];
    setAllVehicles(fetchedVehicles);

    const eligible = fetchedVehicles.filter(v => {
      if (v.carrier_status !== 'available') return false;
      if (!v.vehicle_license_expires_at) return false;
      if (new Date(v.vehicle_license_expires_at) < new Date()) return false;
      if (v.vehicle_verification_status !== 'pending' && v.vehicle_verification_status !== 'verified') return false;
      return true;
    });
    setEligibleVehicles(eligible);

    const { data: jData, error: jError } = await supabase
      .from('trade_requests')
      .select('*, users!trade_requests_user_id_fkey(full_name, phone_number)')
      .eq('request_status', 'SEARCHING_LOGISTICS')
      .not('buyer_id', 'is', null)
      .not('delivery_address', 'is', null)
      .in('evidence_status', ['provided', 'exempted']);

    if (jError) {
      console.error('Error fetching jobs:', jError);
      setError('Failed to load available jobs. Please refresh.');
    }

    if (jData) {
      const validJobs = jData.filter(job => {
        if (job.evidence_status === 'provided' && !job.harvest_photo_url) return false;
        if (!job.computed_latitude || !job.computed_longitude) return false;
        return true;
      });
      setJobs(validJobs as unknown as Job[]);
    }

    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirmLocationAndClaim = async (vehicleId: string, locationData?: { latitude: number, longitude: number, address: string | null }) => {
    if (!selectedJob) return;
    setProcessingId(selectedJob.id);
    setError(null);
    setSelectedJob(null);

    try {
      if (locationData) {
        const { error: vError } = await supabase.from('vehicle_states').update({
          current_latitude: locationData.latitude,
          current_longitude: locationData.longitude,
          current_address: locationData.address,
          location_updated_at: new Date().toISOString()
        }).eq('id', vehicleId);
        if (vError) throw new Error('Failed to update vehicle location: ' + vError.message);
      }

      // Re-evaluate distance
      const vehicle = allVehicles.find(v => v.id === vehicleId);
      const finalLat = locationData?.latitude ?? vehicle?.current_latitude;
      const finalLng = locationData?.longitude ?? vehicle?.current_longitude;
      
      let distance = 0;
      if (finalLat && finalLng && selectedJob.computed_latitude && selectedJob.computed_longitude) {
        distance = calculateHaversineDistance(finalLat, finalLng, selectedJob.computed_latitude, selectedJob.computed_longitude);
      }

      const { error: rpcError } = await supabase.rpc('rpc_claim_logistics_job', {
        p_trade_request_id: selectedJob.id,
        p_vehicle_state_id: vehicleId,
        p_proximity_distance_km: distance
      });

      if (rpcError) throw new Error(rpcError.message || 'Unable to claim this logistics job.');

      setJobs(prev => prev.filter(j => j.id !== selectedJob.id));
      setEligibleVehicles(prev => prev.filter(v => v.id !== vehicleId));
      setAllVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, carrier_status: 'busy' } : v));
      
      alert('Job successfully claimed! View it in Active Bookings.');
    } catch(err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred while claiming job.');
    } finally {
      setProcessingId(null);
    }
  };

  const getUnavailableReason = (): string | null => {
    if (allVehicles.length === 0) return null;
    if (eligibleVehicles.length > 0) return null;
    const busy = allVehicles.filter(v => v.carrier_status === 'busy');
    if (busy.length > 0) return `Your vehicle is currently busy on another job.`;
    const offline = allVehicles.filter(v => v.carrier_status === 'offline');
    if (offline.length > 0) return 'Your vehicle is set to Offline.';
    return 'No eligible vehicle available. Check Fleet for expiry/status.';
  };

  const primaryVehicle = eligibleVehicles.length > 0 ? eligibleVehicles[0] : null;
  const isPrimaryLocationFresh = (() => {
    if (!primaryVehicle || !primaryVehicle.location_updated_at || !primaryVehicle.current_latitude || !primaryVehicle.current_longitude) return false;
    const diffMins = (new Date().getTime() - new Date(primaryVehicle.location_updated_at).getTime()) / 60000;
    return diffMins < 30;
  })();

  const sortedJobs = [...jobs];
  if (isPrimaryLocationFresh && primaryVehicle?.current_latitude && primaryVehicle?.current_longitude) {
    sortedJobs.sort((a, b) => {
      const distA = calculateHaversineDistance(primaryVehicle.current_latitude!, primaryVehicle.current_longitude!, a.computed_latitude!, a.computed_longitude!);
      const distB = calculateHaversineDistance(primaryVehicle.current_latitude!, primaryVehicle.current_longitude!, b.computed_latitude!, b.computed_longitude!);
      return distA - distB;
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] animate-pulse opacity-50" />
        ))}
      </div>
    );
  }

  if (allVehicles.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={fetchData} isLoading={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-lg text-center">
          <Truck className="mx-auto w-10 h-10 mb-3 opacity-30" />
          <h2 className="text-xl font-semibold mb-2">Register a vehicle first</h2>
          <p className="mb-4 opacity-80">You must have a registered, available, and unexpired vehicle to accept logistics jobs.</p>
          <Button onClick={() => window.location.href = '/dashboard/carrier/fleet'}>
            Go to Fleet
          </Button>
        </div>
      </div>
    );
  }

  const unavailableReason = getUnavailableReason();

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-semibold text-sm">{error}</p>
        </div>
      )}

      {unavailableReason && (
        <div className="bg-amber-500/10 border border-amber-400 text-amber-700 dark:text-amber-300 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm mb-1">Cannot accept jobs right now</p>
            <p className="text-sm">{unavailableReason}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm opacity-70">
          {jobs.length === 0
            ? 'No available logistics jobs right now.'
            : `${jobs.length} job${jobs.length !== 1 ? 's' : ''} available`}
        </p>
        <Button variant="ghost" size="sm" onClick={fetchData} isLoading={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="p-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-center">
          <Truck className="mx-auto w-10 h-10 mb-3 opacity-20" />
          <p className="opacity-70">No logistics jobs are currently searching for a carrier. Check back shortly.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedJobs.map(job => {
            const canAccept = eligibleVehicles.length > 0;
            const isUssd = job.evidence_status === 'exempted';
            
            let distanceText = 'Update location to calculate distance';
            if (isPrimaryLocationFresh && primaryVehicle?.current_latitude && primaryVehicle?.current_longitude && job.computed_latitude && job.computed_longitude) {
              const d = calculateHaversineDistance(primaryVehicle.current_latitude, primaryVehicle.current_longitude, job.computed_latitude, job.computed_longitude);
              distanceText = `${d.toFixed(1)} km away`;
            }

            return (
              <div
                key={job.id}
                className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl overflow-hidden"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Evidence / Photo panel */}
                  <div className="md:w-36 w-full h-32 md:h-auto bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 relative border-b md:border-b-0 md:border-r border-[var(--border-color)]">
                    {isUssd ? (
                      <div className="text-center p-3">
                        <AlertTriangle className="mx-auto w-7 h-7 text-amber-500 mb-1" />
                        <p className="text-[10px] text-amber-600 font-bold">USSD</p>
                        <p className="text-[10px] text-amber-500">No harvest photo</p>
                      </div>
                    ) : job.harvest_photo_url ? (
                      <img src={job.harvest_photo_url} alt="Harvest" className="w-full h-full object-cover" />
                    ) : null}
                    <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${isUssd ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
                      {isUssd ? 'Exempted' : 'Evidenced'}
                    </span>
                  </div>

                  {/* Job details */}
                  <div className="flex-1 p-4 flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg">{job.commodity_variety}</h3>
                        <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {distanceText}
                        </span>
                      </div>
                      <p className="text-sm opacity-80">Quantity: {job.quantity_volume} kg/tons</p>

                      <p className="text-sm text-gray-500 flex items-start gap-1">
                        <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-green-500 inline-block mt-1.5" />
                        Pickup: {job.physical_address}
                      </p>

                      <p className="text-sm text-gray-500 flex items-start gap-1">
                        <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-blue-500 inline-block mt-1.5" />
                        Delivery: {job.delivery_address}
                      </p>

                      {job.users && (
                        <p className="text-xs text-gray-400">
                          Seller: {job.users.full_name} · {job.users.phone_number}
                        </p>
                      )}

                      {isUssd && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 mt-1">
                          USSD listing — no harvest photo provided. Buyer has accepted evidence exemption.
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex flex-col items-start md:items-end gap-2 shrink-0 justify-center">
                      <Button
                        onClick={() => {
                          setError(null);
                          setSelectedJob(job);
                        }}
                        disabled={!canAccept || processingId === job.id}
                        isLoading={processingId === job.id}
                        className={!canAccept ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        Accept Load
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedJob && (
        <CarrierLocationModal
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          eligibleVehicles={eligibleVehicles}
          onConfirm={handleConfirmLocationAndClaim}
        />
      )}
    </div>
  );
}
