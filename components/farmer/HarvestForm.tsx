'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabaseClient';
import { Droplets, Thermometer, Wind, MapPin, Plus, Loader2, CheckCircle2, Wheat, Scale, AlertCircle } from 'lucide-react';
import CameraCapture from '@/components/ui/CameraCapture';

const CROP_VARIETIES = ['Maize (White)', 'Maize (Yellow)', 'Cassava Tubers', 'Rice (Paddy)', 'Yam Tubers', 'Sorghum', 'Cocoa Beans', 'Palm Oil (Drums)', 'Groundnut'];

export default function HarvestForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'iot' | 'trade'>('iot');

  // IoT Telemetry Form States
  const [soilMoisture, setSoilMoisture] = useState('');
  const [temperature, setTemperature] = useState('');
  const [humidity, setHumidity] = useState('');
  const [lga, setLga] = useState('');
  
  // Trade Request Form States
  const [commodity, setCommodity] = useState('');
  const [quantity, setQuantity] = useState('');
  const [address, setAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDeviceRegistered = profile?.has_registered_device;

  const handleLogIoT = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (!isDeviceRegistered) {
        throw new Error('Please register your farm device in the toggle above before logging manual telemetry.');
      }

      const { error: insertError } = await supabase.from('iot_telemetry_logs').insert({
        owner_id: profile.id,
        soil_moisture_percentage: parseFloat(soilMoisture),
        temperature: temperature ? parseFloat(temperature) : null,
        humidity: humidity ? parseFloat(humidity) : null,
        associated_lga: lga || profile.macro_region || 'Lagos State',
        latitude: profile.business_latitude || 6.5244,
        longitude: profile.business_longitude || 3.3792,
      });

      if (insertError) throw new Error(insertError.message);

      setSuccess('IoT telemetry reading broadcast to YieldFlow network!');
      setSoilMoisture('');
      setTemperature('');
      setHumidity('');
      setLga('');
      onSubmitted?.();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log telemetry');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error: insertError } = await supabase.from('trade_requests').insert({
        user_id: profile.id,
        commodity_variety: commodity,
        quantity_volume: parseFloat(quantity),
        physical_address: address || profile.macro_region || 'Ibadan Central Farm',
        harvest_photo_url: photoUrl || null,
        request_status: 'pending',
      });

      if (insertError) throw new Error(insertError.message);

      setSuccess('Harvest trade request submitted! Buyers can now inspect and confirm your crop.');
      setCommodity('');
      setQuantity('');
      setAddress('');
      setPhotoUrl('');
      onSubmitted?.();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create trade request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 border border-border">
      {/* Tab Navigation */}
      <div className="flex border-b border-border mb-5">
        <button
          onClick={() => { setActiveTab('iot'); setError(null); setSuccess(null); }}
          className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'iot'
              ? 'border-agri-primary text-agri-primary-light'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Droplets size={16} />
          <span>Log IoT Telemetry</span>
        </button>
        <button
          onClick={() => { setActiveTab('trade'); setError(null); setSuccess(null); }}
          className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'trade'
              ? 'border-agri-primary text-agri-primary-light'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Wheat size={16} />
          <span>Create Trade Request</span>
        </button>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-agri-primary/20 bg-agri-primary/10 px-4 py-3 text-sm text-agri-primary-light animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-fade-in">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'iot' ? (
        <form onSubmit={handleLogIoT} className="space-y-4">
          {!isDeviceRegistered && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>Note: Your farm device must be active (`Register My Farm Device` toggle above) to log telemetry.</span>
            </div>
          )}

          <div>
            <label className="label">Soil Moisture Percentage (%) *</label>
            <div className="relative">
              <Droplets size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={soilMoisture}
                onChange={(e) => setSoilMoisture(e.target.value)}
                placeholder="e.g. 28.5 (Values < 30 trigger Readiness alert)"
                className="input pl-10"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Temperature (°C)</label>
              <div className="relative">
                <Thermometer size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="e.g. 31.2"
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="label">Humidity (%)</label>
              <div className="relative">
                <Wind size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
                <input
                  type="number"
                  step="0.1"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  placeholder="e.g. 64.0"
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Associated LGA / Region</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
              <input
                type="text"
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                placeholder="e.g. Alimosho LGA, Lagos"
                className="input pl-10"
              />
            </div>
          </div>

          <button type="submit" disabled={loading || !isDeviceRegistered} className="btn btn-primary w-full">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={16} /> Broadcast Telemetry Reading</>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreateTrade} className="space-y-4">
          <div>
            <label className="label">Commodity Variety *</label>
            <div className="relative">
              <Wheat size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
              <select
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="input pl-10 appearance-none"
                required
              >
                <option value="">Select commodity variety...</option>
                {CROP_VARIETIES.map((crop) => (
                  <option key={crop} value={crop}>{crop}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Quantity Available (kg / units) *</label>
            <div className="relative">
              <Scale size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
              <input
                type="number"
                min="1"
                step="0.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1200"
                className="input pl-10"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Pickup Address / Farm Hub</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Km 12 Oyo-Ibadan Expressway"
                className="input pl-10"
              />
            </div>
          </div>

          <CameraCapture
            bucketName="harvest-photos"
            onCapture={(url) => setPhotoUrl(url)}
            existingUrl={photoUrl}
            label="Harvest Inspection Photo"
          />

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={16} /> Submit Trade Offer to Buyers</>}
          </button>
        </form>
      )}
    </div>
  );
}
