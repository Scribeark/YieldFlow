'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import type { VehicleState, VehicleStatus } from '@/lib/types';
import { Truck, Plus, CheckCircle2, AlertCircle, MapPin, Loader2, Radio } from 'lucide-react';
import CameraCapture from '@/components/ui/CameraCapture';

export default function VehicleRegistry() {
  const { profile, user } = useAuthStore();
  const [vehicles, setVehicles] = useState<VehicleState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [vehicleType, setVehicleType] = useState('Refrigerated 15-Ton Truck');
  const [photoUrl, setPhotoUrl] = useState('');
  const [locationStr, setLocationStr] = useState('Lagos Logistics Hub');
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  const carrierId = profile?.id || user?.id;

  const fetchVehicles = useCallback(async () => {
    if (!carrierId) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from('vehicle_states')
        .select('*')
        .or(`carrier_id.eq.${carrierId}`)
        .order('created_at', { ascending: false });

      if (fetchErr) throw new Error(fetchErr.message);
      setVehicles((data as VehicleState[]) || []);
    } catch (err: unknown) {
      console.error('Failed to fetch vehicles:', err);
    } finally {
      setLoading(false);
    }
  }, [carrierId]);

  useEffect(() => {
    fetchVehicles();
    if (!carrierId) return;

    const channel = supabase
      .channel(`carrier-vehicles:${carrierId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_states' },
        () => fetchVehicles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carrierId, fetchVehicles]);

  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierId) return;
    setSubmitting(true);
    setError(null);

    try {
      const { error: insertErr } = await supabase.from('vehicle_states').insert({
        carrier_id: carrierId,
        carrier_status: 'available',
        vehicle_type: vehicleType,
        vehicle_photo_url: photoUrl || null,
        location: locationStr,
        latitude: profile?.business_latitude || 6.5244,
        longitude: profile?.business_longitude || 3.3792,
      });

      if (insertErr) throw new Error(insertErr.message);

      setFormSuccess(true);
      setShowForm(false);
      setPhotoUrl('');
      fetchVehicles();
      setTimeout(() => setFormSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (vehicleId: string, newStatus: VehicleStatus) => {
    try {
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicleId ? { ...v, carrier_status: newStatus } : v))
      );

      const { error: updateErr } = await supabase
        .from('vehicle_states')
        .update({ carrier_status: newStatus })
        .eq('id', vehicleId);

      if (updateErr) throw new Error(updateErr.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update vehicle status');
      fetchVehicles();
    }
  };

  const statusColors: Record<string, string> = {
    available: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    busy: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    offline: 'border-border bg-background-elevated text-foreground-dim',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-5 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-agri-primary/10 text-agri-primary-light">
            <Truck size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Multi-Vehicle Fleet Registry</h3>
            <p className="text-xs text-foreground-dim">
              {vehicles.length} active vehicles registered to your fleet
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2 self-start sm:self-center shrink-0"
        >
          <Plus size={16} />
          <span>Register New Vehicle</span>
        </button>
      </div>

      {formSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400 animate-fade-in">
          <CheckCircle2 size={16} />
          <span>Vehicle registered to fleet successfully! Ready to accept logistics loads.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 animate-fade-in">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form Modal/Card */}
      {showForm && (
        <div className="card p-6 border border-agri-primary/30 bg-background-secondary/80 animate-scale-in">
          <h4 className="text-sm font-bold text-foreground mb-4">Register New Fleet Vehicle</h4>
          <form onSubmit={handleRegisterVehicle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Vehicle Type / Specification *</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="input appearance-none"
                  required
                >
                  <option value="Refrigerated 15-Ton Truck">Refrigerated 15-Ton Truck</option>
                  <option value="Flatbed 10-Ton Lorry">Flatbed 10-Ton Lorry</option>
                  <option value="Covered 5-Ton Delivery Van">Covered 5-Ton Delivery Van</option>
                  <option value="Heavy Duty Farm Tractor / Trailer">Heavy Duty Farm Tractor / Trailer</option>
                  <option value="Agri-Express Motorcycle / Tricycle">Agri-Express Motorcycle / Tricycle</option>
                </select>
              </div>

              <div>
                <label className="label">Current Hub / GPS Location *</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
                  <input
                    type="text"
                    value={locationStr}
                    onChange={(e) => setLocationStr(e.target.value)}
                    placeholder="e.g. Ikeja Depot, Lagos"
                    className="input pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <CameraCapture
              bucketName="vehicle-photos"
              onCapture={(url) => setPhotoUrl(url)}
              existingUrl={photoUrl}
              label="Vehicle Verification Photo"
            />

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary flex-1 text-sm"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary flex-1 text-sm flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Register Vehicle to Active Fleet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Multi-Vehicle Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-48 border border-border animate-pulse bg-background-secondary/30" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="card p-12 border border-dashed border-border text-center">
          <Truck size={36} className="mx-auto mb-3 text-foreground-dim opacity-50" />
          <h4 className="text-sm font-bold text-foreground">No Vehicles Registered</h4>
          <p className="text-xs text-foreground-muted max-w-sm mx-auto mt-1">
            Register your transport vehicles to start accepting harvest loads and broadcasting live GPS tracking.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <div key={v.id} className="card p-5 border border-border flex flex-col justify-between hover:border-border-hover transition-all">
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${statusColors[v.carrier_status || 'available'] || statusColors.available}`}>
                      <Radio size={12} className={v.carrier_status === 'available' ? 'animate-pulse text-emerald-400' : ''} />
                      {v.carrier_status || 'Available'}
                    </span>
                  </div>
                  <span className="text-[11px] text-foreground-dim font-mono truncate max-w-[80px]">
                    ID: {v.id.substring(0, 6)}
                  </span>
                </div>

                {v.vehicle_photo_url && (
                  <div className="mb-3 overflow-hidden rounded-lg border border-border h-32 bg-background-elevated">
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={v.vehicle_photo_url}
                      alt={v.vehicle_type || 'Vehicle'}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                )}

                <h4 className="text-sm font-bold text-foreground">{v.vehicle_type || 'Carrier Vehicle'}</h4>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-foreground-muted">
                  <MapPin size={14} className="text-agri-accent shrink-0" />
                  <span className="truncate">{v.location || 'Active Route Hub'}</span>
                </div>
              </div>

              {/* Status Toggles */}
              <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-3 gap-1.5">
                {(['available', 'busy', 'offline'] as VehicleStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(v.id, st)}
                    className={`py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                      v.carrier_status === st
                        ? st === 'available'
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/20'
                          : st === 'busy'
                          ? 'bg-amber-500 text-white border-amber-400 shadow-sm shadow-amber-500/20'
                          : 'bg-background-elevated text-foreground border-border font-extrabold'
                        : 'bg-background text-foreground-dim border-border/40 hover:bg-background-elevated hover:text-foreground-muted'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
