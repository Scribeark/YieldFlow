'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Truck, AlertTriangle } from 'lucide-react';

// Haversine distance calculator
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
}

interface Vehicle {
  id: string;
  current_latitude: number;
  current_longitude: number;
  vehicle_license_expires_at?: string | null;
  vehicle_verification_status?: string;
  carrier_status: string; // 'available' | 'busy' | 'offline'
  license_plate?: string;
  vehicle_type?: string;
}

export default function AvailableJobs() {
  const { profile } = useAuthStore();
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  // All registered vehicles (any status)
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  // Eligible = available + valid license + verified/pending
  const [eligibleVehicles, setEligibleVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Always clear loading — even if profile is missing
    if (!profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch ALL of the carrier's vehicles (any carrier_status)
    const { data: vData, error: vError } = await supabase
      .from('vehicle_states')
      .select('*')
      .eq('carrier_id', profile.id);

    if (vError) {
      console.error('Error fetching vehicles:', vError);
    }

    const fetchedVehicles = (vData ?? []) as Vehicle[];
    setAllVehicles(fetchedVehicles);

    // Eligible = available + unexpired license + verified or pending
    const eligible = fetchedVehicles.filter(v => {
      if (v.carrier_status !== 'available') return false;
      if (!v.vehicle_license_expires_at) return false;
      if (new Date(v.vehicle_license_expires_at) < new Date()) return false;
      if (v.vehicle_verification_status !== 'pending' && v.vehicle_verification_status !== 'verified') return false;
      return true;
    });
    setEligibleVehicles(eligible);

    // Always fetch SEARCHING_LOGISTICS jobs regardless of vehicle availability
    const { data: jData, error: jError } = await supabase
      .from('trade_requests')
      .select('*, users!trade_requests_user_id_fkey(full_name, phone_number), logistics_bookings(status)')
      .eq('request_status', 'SEARCHING_LOGISTICS')
      .not('buyer_id', 'is', null)
      .or('evidence_status.eq.provided,evidence_status.eq.exempted');

    if (jError) {
      console.error('Error fetching jobs:', jError);
      setError('Failed to load available jobs. Please refresh.');
    }

    if (jData) {
      const validJobs = jData.filter(job => {
        // Must have photo if evidence_status === 'provided'
        if (job.evidence_status === 'provided' && !job.harvest_photo_url) return false;
        // Exclude jobs that already have an active logistics booking
        const activeBookings = ((job as unknown as { logistics_bookings: { status: string }[] }).logistics_bookings)
          ?.filter(b => b.status === 'active') || [];
        if (activeBookings.length > 0) return false;
        return true;
      });
      setJobs(validJobs as unknown as Job[]);
    }

    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleClaimJob = async (job: Job) => {
    if (!profile || eligibleVehicles.length === 0) return;
    setProcessingId(job.id);
    setError(null);

    try {
      const primaryVehicle = eligibleVehicles[0];
      let vLat = primaryVehicle.current_latitude;
      let vLon = primaryVehicle.current_longitude;

      if (!vLat || !vLon) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
          });
          vLat = position.coords.latitude;
          vLon = position.coords.longitude;
        } catch (err) {
          console.warn('Geolocation fallback failed, using 0,0', err);
          vLat = 0;
          vLon = 0;
        }
      }

      let distance = 0;
      if (vLat !== 0 && vLon !== 0 && job.computed_latitude && job.computed_longitude) {
        distance = calculateHaversineDistance(vLat, vLon, job.computed_latitude, job.computed_longitude);
      }

      const { error: rpcError } = await supabase.rpc('rpc_claim_logistics_job', {
        p_trade_request_id: job.id,
        p_vehicle_state_id: primaryVehicle.id,
        p_proximity_distance_km: distance
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Unable to claim this logistics job. Please refresh and try again.');
      }

      // Optimistically remove the claimed job and mark vehicle busy
      setJobs(prev => prev.filter(j => j.id !== job.id));
      setEligibleVehicles(prev => prev.filter(v => v.id !== primaryVehicle.id));
      setAllVehicles(prev => prev.map(v => v.id === primaryVehicle.id ? { ...v, carrier_status: 'busy' } : v));

      alert('Job successfully claimed! View it in Active Bookings.');
    } catch (err: unknown) {
      const e = err as Error;
      console.error(e);
      setError(e.message || 'Unable to claim this logistics job. Please refresh and try again.');
    } finally {
      setProcessingId(null);
    }
  };

  // ─── Compute availability banner message ────────────────────────────────────
  const busyVehicles = allVehicles.filter(v => v.carrier_status === 'busy');
  const offlineVehicles = allVehicles.filter(v => v.carrier_status === 'offline');
  const expiredVehicles = allVehicles.filter(v => {
    if (!v.vehicle_license_expires_at) return true;
    return new Date(v.vehicle_license_expires_at) < new Date();
  });

  const getUnavailableReason = (): string | null => {
    if (allVehicles.length === 0) return null; // Handled by separate block
    if (eligibleVehicles.length > 0) return null; // Has eligible — no banner needed
    if (busyVehicles.length > 0 && eligibleVehicles.length === 0) {
      return `Your ${busyVehicles.length > 1 ? busyVehicles.length + ' vehicles are' : 'vehicle is'} currently busy on another job. You can browse available jobs but cannot accept another until a job is completed.`;
    }
    if (offlineVehicles.length > 0 && eligibleVehicles.length === 0) {
      return 'Your vehicle is set to Offline. Update its status in Fleet to accept jobs.';
    }
    if (expiredVehicles.length > 0 && eligibleVehicles.length === 0) {
      return 'Your vehicle licence has expired. Update it in Fleet before accepting new jobs.';
    }
    return 'No eligible vehicle available. Check your Fleet for vehicle status and licence expiry.';
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

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
            Go to Fleet / Vehicle Registration
          </Button>
        </div>
      </div>
    );
  }

  const unavailableReason = getUnavailableReason();

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-semibold text-sm">{error}</p>
        </div>
      )}

      {/* Vehicle unavailability banner — shown even when jobs exist */}
      {unavailableReason && (
        <div className="bg-amber-500/10 border border-amber-400 text-amber-700 dark:text-amber-300 p-4 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm mb-1">Cannot accept jobs right now</p>
            <p className="text-sm">{unavailableReason}</p>
            <button
              onClick={() => window.location.href = '/dashboard/carrier/fleet'}
              className="text-sm underline mt-2 inline-block"
            >
              Go to Fleet →
            </button>
          </div>
        </div>
      )}

    // Refresh + header
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

      {/* Jobs list */}
      {jobs.length === 0 ? (
        <div className="p-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-center">
          <Truck className="mx-auto w-10 h-10 mb-3 opacity-20" />
          <p className="opacity-70">No logistics jobs are currently searching for a carrier. Check back shortly.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map(job => {
            const canAccept = eligibleVehicles.length > 0;
            const isUssd = job.evidence_status === 'exempted';
            const hasPhoto = Boolean(job.harvest_photo_url);
            const jobWithSeller = job as unknown as Job & { users?: { full_name: string; phone_number: string } | null; delivery_address?: string | null };
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
                    ) : hasPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={job.harvest_photo_url!} alt="Harvest" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-3 text-gray-400">
                        <Truck className="mx-auto w-7 h-7 mb-1 opacity-30" />
                        <p className="text-[10px]">No photo</p>
                      </div>
                    )}
                    {/* Evidence badge */}
                    <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${isUssd ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
                      {isUssd ? 'Exempted' : 'Evidenced'}
                    </span>
                  </div>

                  {/* Job details */}
                  <div className="flex-1 p-4 flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex-1 space-y-1.5">
                      <h3 className="font-bold text-lg">{job.commodity_variety}</h3>
                      <p className="text-sm opacity-80">Quantity: {job.quantity_volume} kg/tons</p>

                      {/* Pickup */}
                      <p className="text-sm text-gray-500 flex items-start gap-1">
                        <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-green-500 inline-block mt-1.5" />
                        Pickup: {job.physical_address}
                      </p>

                      {/* Delivery */}
                      {jobWithSeller.delivery_address ? (
                        <p className="text-sm text-gray-500 flex items-start gap-1">
                          <span className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-blue-500 inline-block mt-1.5" />
                          Delivery: {jobWithSeller.delivery_address}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Delivery address not yet confirmed</p>
                      )}

                      {/* Seller contact */}
                      {jobWithSeller.users && (
                        <p className="text-xs text-gray-400">
                          Seller: {jobWithSeller.users.full_name} · {jobWithSeller.users.phone_number}
                        </p>
                      )}

                      {/* USSD notice */}
                      {isUssd && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 mt-1">
                          USSD listing — no harvest photo provided. Buyer has accepted evidence exemption.
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex flex-col items-start md:items-end gap-2 shrink-0 justify-center">
                      <Button
                        onClick={() => canAccept && handleClaimJob(job)}
                        disabled={!canAccept || processingId === job.id}
                        isLoading={processingId === job.id}
                        className={!canAccept ? 'opacity-50 cursor-not-allowed' : ''}
                      >
                        {processingId === job.id ? 'Claiming...' : 'Accept Load'}
                      </Button>
                      {!canAccept && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 max-w-[200px] text-right">
                          {busyVehicles.length > 0 ? 'Vehicle busy — complete current job first' : 'No eligible vehicle'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
