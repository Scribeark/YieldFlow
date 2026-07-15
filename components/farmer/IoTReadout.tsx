'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import type { IoTTelemetryLog } from '@/lib/types';
import { Droplets, Thermometer, Wind, MapPin, RefreshCw, AlertTriangle, CheckCircle, Radio } from 'lucide-react';

export default function IoTReadout() {
  const { profile } = useAuthStore();
  const [readings, setReadings] = useState<IoTTelemetryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReadings = useCallback(async (isRefresh = false) => {
    if (!profile) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase
        .from('iot_telemetry_logs')
        .select('*')
        .eq('owner_id', profile.id)
        .order('recorded_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) {
        console.error('Failed to fetch IoT readings:', error);
      } else if (data) {
        setReadings(data as IoTTelemetryLog[]);
      }
    } catch (err) {
      console.error('Error in IoTReadout:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchReadings();

    // Subscribe to real-time telemetry changes for this owner
    if (!profile) return;
    const channel = supabase
      .channel(`iot_telemetry:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'iot_telemetry_logs',
          filter: `owner_id=eq.${profile.id}`,
        },
        (payload) => {
          setReadings((prev) => [payload.new as IoTTelemetryLog, ...prev.slice(0, 5)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReadings, profile]);

  if (loading && readings.length === 0) {
    return (
      <div className="card p-6 border border-border animate-pulse flex items-center justify-center h-48">
        <div className="flex items-center gap-2 text-foreground-dim text-sm">
          <RefreshCw size={16} className="animate-spin" />
          <span>Synchronizing live IoT telemetry streams...</span>
        </div>
      </div>
    );
  }

  const latest = readings[0] || null;
  const isReadyForHarvest = latest && latest.soil_moisture_percentage < 30;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-agri-primary-light animate-pulse" />
          <h3 className="text-base font-bold text-foreground">Live IoT Telemetry Feed</h3>
        </div>
        <button
          onClick={() => fetchReadings(true)}
          disabled={refreshing}
          className="btn btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin text-agri-primary-light' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Latest Reading Highlights */}
      {latest ? (
        <div className="space-y-4">
          <div className={`card p-4 border transition-all ${
            isReadyForHarvest
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-agri-primary/30 bg-agri-primary/5'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white ${
                  isReadyForHarvest ? 'bg-amber-500 shadow-md shadow-amber-500/30' : 'bg-agri-primary shadow-md shadow-agri-primary/30'
                }`}>
                  {isReadyForHarvest ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isReadyForHarvest ? 'text-amber-400' : 'text-agri-primary-light'
                    }`}>
                      {isReadyForHarvest ? 'Harvest Threshold Triggered (< 30% Moisture)' : 'Optimal Soil Balance'}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted">
                    Last recorded at {latest.recorded_at ? new Date(latest.recorded_at).toLocaleString() : latest.created_at ? new Date(latest.created_at).toLocaleString() : 'Just now'}
                  </p>
                </div>
              </div>

              {latest.associated_lga && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground-dim bg-background-card px-2.5 py-1 rounded-lg border border-border">
                  <MapPin size={13} className="text-agri-accent" />
                  <span>{latest.associated_lga}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Moisture Card */}
            <div className="card p-4 border border-border flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Droplets size={24} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-foreground-dim uppercase tracking-wider block">
                  Soil Moisture
                </span>
                <span className="text-xl font-black text-foreground mt-0.5 block">
                  {latest.soil_moisture_percentage}%
                </span>
                <span className="text-[10px] text-foreground-muted">
                  {latest.soil_moisture_percentage < 30 ? 'Dry / Ready for harvest' : 'Adequately hydrated'}
                </span>
              </div>
            </div>

            {/* Temperature Card */}
            <div className="card p-4 border border-border flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <Thermometer size={24} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-foreground-dim uppercase tracking-wider block">
                  Ambient Temperature
                </span>
                <span className="text-xl font-black text-foreground mt-0.5 block">
                  {latest.temperature ?? '—'} °C
                </span>
                <span className="text-[10px] text-foreground-muted">
                  Regional thermal sensor
                </span>
              </div>
            </div>

            {/* Humidity Card */}
            <div className="card p-4 border border-border flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <Wind size={24} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-foreground-dim uppercase tracking-wider block">
                  Air Humidity
                </span>
                <span className="text-xl font-black text-foreground mt-0.5 block">
                  {latest.humidity ?? '—'} %
                </span>
                <span className="text-[10px] text-foreground-muted">
                  Atmospheric readout
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-8 border border-dashed border-border text-center">
          <Droplets size={32} className="mx-auto mb-2 text-foreground-dim opacity-50" />
          <h4 className="text-sm font-bold text-foreground">No IoT Readings Logged Yet</h4>
          <p className="text-xs text-foreground-muted max-w-sm mx-auto mt-1">
            Once your farm device is registered, you can log telemetry readings manually below or connect physical hardware via our webhook/edge endpoints.
          </p>
        </div>
      )}
    </div>
  );
}
