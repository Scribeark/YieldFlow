'use client';

import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';
import VehicleRegistry from '@/components/carrier/VehicleRegistry';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';

interface Vehicle {
  id: string;
  vehicle_nickname: string;
  plate_number: string;
  vehicle_type: string;
  payload_capacity_baskets: number;
  carrier_status: string;
  vehicle_photo_url: string;
  vehicle_document_url?: string | null;
  vehicle_license_expires_at?: string | null;
  vehicle_verification_status?: string;
  is_active: boolean;
}

export default function FleetPage() {
  const { profile } = useAuthStore();
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVehicles = async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('vehicle_states')
      .select('*')
      .eq('carrier_id', profile.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
      
    if (data) {
      setVehicles(data as Vehicle[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, supabase]);

  const isExpired = (dateString?: string | null) => {
    if (!dateString) return true;
    return new Date(dateString) < new Date();
  };

  const handleDeactivate = async (vehicleId: string) => {
    if (!window.confirm("Are you sure? This action will remove this vehicle from active availability.")) {
      return;
    }
    
    try {
      const { error } = await supabase.rpc('rpc_deactivate_vehicle', { p_vehicle_state_id: vehicleId });
      if (error) {
        if (error.message.includes('active booking')) {
          alert('This vehicle is assigned to an active booking. Cancel or complete the booking before removing it.');
        } else {
          alert(error.message || 'Failed to deactivate vehicle.');
        }
      } else {
        alert('Vehicle successfully deactivated and removed from active availability.');
        loadVehicles();
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred.');
    }
  };

  return (
    <PageContainer>
      <div className="grid gap-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Fleet / Vehicles</h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          <VehicleRegistry onRegistered={() => window.location.reload()} />
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">My Registered Vehicles</h2>
              <Button variant="ghost" size="sm" onClick={loadVehicles} isLoading={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            {loading ? (
              <p>Loading fleet...</p>
            ) : vehicles.length === 0 ? (
              <DashboardCard 
                title="No Vehicles Found" 
                description="You have not registered any vehicles yet. Please register a vehicle to accept logistics jobs."
              />
            ) : (
              <div className="space-y-4">
                {vehicles.map((v) => {
                  const hasMissingDocs = !v.vehicle_license_expires_at;
                  const expired = isExpired(v.vehicle_license_expires_at);
                  
                  return (
                    <div key={v.id} className="bg-[var(--card-bg)] border border-[var(--border-color)] p-4 rounded-lg flex flex-col space-y-4">
                      <div className="flex items-start space-x-4">
                        {v.vehicle_photo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.vehicle_photo_url} alt={v.vehicle_nickname} className="w-24 h-24 object-cover rounded" />
                        )}
                        <div>
                          <h3 className="font-bold text-lg">{v.vehicle_nickname} ({v.plate_number})</h3>
                          <p className="text-sm opacity-80">{v.vehicle_type} - {v.payload_capacity_baskets} Baskets Capacity</p>
                          <p className="text-sm mt-2 font-medium">Status: <span className="uppercase">{v.carrier_status}</span></p>
                        </div>
                      </div>

                      {(() => {
                        if (!v.is_active || v.carrier_status === 'offline') {
                          return (
                            <div className="bg-gray-500/10 border border-gray-500 text-gray-500 p-3 rounded text-sm">
                              Vehicle inactive.
                            </div>
                          );
                        }
                        if (v.carrier_status === 'busy') {
                          return (
                            <div className="bg-blue-500/10 border border-blue-500 text-blue-700 dark:text-blue-400 p-3 rounded text-sm">
                              Vehicle currently assigned to an active booking.
                            </div>
                          );
                        }
                        if (hasMissingDocs) {
                          return (
                            <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-700 dark:text-yellow-400 p-3 rounded text-sm">
                              Vehicle compliance document required. Upload updated vehicle particulars before accepting logistics jobs.
                            </div>
                          );
                        }
                        if (expired) {
                          return (
                            <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded text-sm">
                              This vehicle document has expired. Renew and upload updated particulars before accepting logistics jobs.
                            </div>
                          );
                        }
                        if (v.vehicle_verification_status !== 'pending' && v.vehicle_verification_status !== 'verified') {
                           return (
                            <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-700 dark:text-yellow-400 p-3 rounded text-sm">
                              Vehicle verification failed. Please contact support.
                            </div>
                           );
                        }

                        return (
                          <div className="bg-green-500/10 border border-green-500 text-green-700 dark:text-green-400 p-3 rounded text-sm font-semibold">
                            Vehicle Eligible for Jobs
                          </div>
                        );
                      })()}
                      <div className="pt-2 border-t border-[var(--border-color)] group relative inline-block self-start mt-4">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => v.carrier_status !== 'busy' && handleDeactivate(v.id)}
                          className={`border border-red-200 ${v.carrier_status !== 'busy' ? 'text-red-600 hover:bg-red-50 bg-transparent' : 'opacity-50 cursor-not-allowed text-red-600 bg-transparent'}`}
                          disabled={v.carrier_status === 'busy'}
                        >
                          Deactivate Vehicle
                        </Button>
                        {v.carrier_status === 'busy' && (
                          <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            This vehicle is assigned to an active booking. Cancel or complete the booking before removing it.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
