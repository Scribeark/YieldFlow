'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

// Haversine distance calculator
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
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
  carrier_status: string;
}

export default function AvailableJobs() {
  const { profile } = useAuthStore();
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    // Fetch user's registered vehicles
    const { data: vData } = await supabase
      .from('vehicle_states')
      .select('*')
      .eq('carrier_id', profile.id)
      .eq('carrier_status', 'available');
    
    if (vData) {
      // Filter eligible vehicles
      const eligibleVehicles = vData.filter(v => {
        if (!v.vehicle_license_expires_at) return false;
        if (new Date(v.vehicle_license_expires_at) < new Date()) return false;
        if (v.vehicle_verification_status !== 'pending' && v.vehicle_verification_status !== 'verified') return false;
        return true;
      });
      setVehicles(eligibleVehicles as Vehicle[]);
    }

    // Fetch logistics ready jobs
    const { data: jData } = await supabase
      .from('trade_requests')
      .select('*, users!trade_requests_user_id_fkey(full_name, phone_number), logistics_bookings(status)')
      .eq('request_status', 'SEARCHING_LOGISTICS')
      .not('buyer_id', 'is', null)
      .or('evidence_status.eq.provided,evidence_status.eq.exempted');

    if (jData) {
      // Enforce harvest_photo_url for provided
      const validJobs = jData.filter(job => {
        if (job.evidence_status === 'provided' && !job.harvest_photo_url) return false;
        // Exclude jobs that already have an active logistics booking
        const activeBookings = ((job as unknown as { logistics_bookings: { status: string }[] }).logistics_bookings)?.filter(b => b.status === 'active') || [];
        if (activeBookings.length > 0) return false;
        return true;
      });
      setJobs(validJobs as unknown as Job[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, supabase]);

  const handleClaimJob = async (job: Job) => {
    if (!profile || vehicles.length === 0) return;
    setProcessingId(job.id);
    setError(null);

    try {
      const primaryVehicle = vehicles[0];
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
          console.warn('Geolocation fallback failed, using 0', err);
          vLat = 0;
          vLon = 0;
        }
      }

      let distance = 0;
      if (vLat !== 0 && vLon !== 0 && job.computed_latitude && job.computed_longitude) {
        distance = calculateHaversineDistance(vLat, vLon, job.computed_latitude, job.computed_longitude);
      }

      // Call the RPC to claim the job
      const { error: rpcError } = await supabase.rpc('rpc_claim_logistics_job', {
        p_trade_request_id: job.id,
        p_vehicle_state_id: primaryVehicle.id,
        p_proximity_distance_km: distance
      });

      if (rpcError) {
        throw new Error('Unable to claim this logistics job. Please refresh and try again.');
      }

      // Success
      setJobs(jobs.filter(j => j.id !== job.id));
      alert('Job successfully claimed! You can view it in your Active Bookings.');
      
      // We also update local vehicles state to reflect 'busy'
      setVehicles(vehicles.filter(v => v.id !== primaryVehicle.id));

    } catch (err: unknown) {
      const e = err as Error;
      console.error(e);
      setError(e.message || 'Unable to claim this logistics job. Please refresh and try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <p>Loading available jobs...</p>;

  if (vehicles.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={fetchData} isLoading={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-2">Register a vehicle before accepting logistics jobs.</h2>
          <p className="mb-4 opacity-80">You must have an available, unexpired, and registered vehicle to claim active jobs.</p>
          <Button onClick={() => window.location.href='/dashboard/carrier/fleet'}>
            Go to Fleet / Vehicle Registration
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={fetchData} isLoading={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="p-6 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-center opacity-80">
            No available logistics jobs matching your criteria at the moment. Check back later.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={fetchData} isLoading={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="grid gap-4">
          {jobs.map(job => (
            <div key={job.id} className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h3 className="font-bold text-lg">{job.commodity_variety}</h3>
                <p className="text-sm opacity-80">Quantity: {job.quantity_volume}</p>
                <p className="text-sm opacity-80">Location: {job.physical_address}</p>
                <div className="mt-2 text-xs font-semibold inline-block px-2 py-1 bg-green-500/20 text-green-500 rounded">
                  {job.evidence_status === 'exempted' ? 'USSD Exempted' : 'Photo Provided'}
                </div>
              </div>
              <div className="mt-4 md:mt-0">
                <Button 
                  onClick={() => handleClaimJob(job)} 
                  disabled={processingId === job.id}
                >
                  {processingId === job.id ? 'Claiming...' : 'Accept Load'}
                </Button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
