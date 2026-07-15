'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { Cpu, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function DeviceRegistrationToggle() {
  const { profile, updateProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const isRegistered = Boolean(profile.has_registered_device);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = !isRegistered;
      const { error: updateErr } = await supabase
        .from('users')
        .update({ has_registered_device: nextStatus })
        .eq('id', profile.id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      await updateProfile({ has_registered_device: nextStatus });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update device registration status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 border border-agri-primary/20 bg-gradient-to-br from-background-card to-background-secondary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
            isRegistered ? 'bg-agri-primary/20 text-agri-primary-light' : 'bg-background-elevated text-foreground-dim'
          }`}>
            <Cpu size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">IoT Telemetry Farm Device</h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isRegistered
                  ? 'bg-agri-primary/10 text-agri-primary-light border border-agri-primary/20'
                  : 'bg-background-elevated text-foreground-dim border border-border'
              }`}>
                {isRegistered ? <CheckCircle2 size={12} /> : null}
                {isRegistered ? 'Registered & Active' : 'Unregistered'}
              </span>
            </div>
            <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
              {isRegistered
                ? 'Your farm sensor node is registered. You can submit soil moisture and environmental readings directly to Vercel/Supabase.'
                : 'Enable device registration to link hardware sensors to your profile and broadcast soil telemetry readings.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`btn px-4 py-2 text-sm font-semibold transition-all ${
              isRegistered
                ? 'border border-border bg-background-elevated text-foreground-muted hover:border-red-500/50 hover:text-red-400'
                : 'btn-primary'
            }`}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isRegistered ? (
              'Deactivate Device'
            ) : (
              'Register My Farm Device'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
