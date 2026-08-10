'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createSellerFarm } from '@/lib/api/farms';
import { LocationPicker } from '@/components/shared/LocationPicker';



import { CheckCircle } from 'lucide-react';

interface RegisterFarmModalProps {
  userId: string;
  googleMapsApiKey: string;
  onSuccess: (newFarm: any, action: 'add_crop' | 'close') => void;
  onClose: () => void;
}

export function RegisterFarmModal({ userId, googleMapsApiKey, onSuccess, onClose }: RegisterFarmModalProps) {
  const supabase = createClient();
  
  const [farmName, setFarmName] = useState('');
  const [farmSizeValue, setFarmSizeValue] = useState('');
  const [farmSizeUnit, setFarmSizeUnit] = useState('hectares');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdFarm, setCreatedFarm] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    


    if (!latitude || !longitude) {
      setError('Please resolve the address or enter coordinates before registering the farm.');
      return;
    }

    setSubmitting(true);
    
    const { data, error: apiError } = await createSellerFarm(supabase, userId, {
      name: farmName,
      address,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      farmSizeValue: farmSizeValue ? parseFloat(farmSizeValue) : undefined,
      farmSizeUnit: farmSizeValue ? farmSizeUnit : undefined
    });
    
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to register farm.');
    } else {
      setCreatedFarm(data);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col p-0 border border-white/10 shadow-2xl">
        <div className="p-5 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[var(--card-bg)] z-10">
          <div>
            <h2 className="text-xl font-bold">Register New Farm</h2>
            <p className="text-sm opacity-70">Register a farm location to connect devices and monitor harvest readiness.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}

          {createdFarm ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
              <h3 className="text-xl font-bold mb-2">Farm Registered Successfully!</h3>
              <p className="text-sm opacity-70 mb-6">Your farm location has been saved. To start monitoring crop readiness and IoT sensors, you must add at least one crop plot.</p>
              
              <div className="flex flex-col gap-3">
                <Button variant="primary" onClick={() => onSuccess(createdFarm, 'add_crop')}>
                  Save Farm and Add First Crop
                </Button>
                <Button variant="secondary" onClick={() => onSuccess(createdFarm, 'close')}>
                  Save Farm and Add Crops Later
                </Button>
              </div>
            </div>
          ) : (
            <form id="register-farm-form" onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label>Farm Name</Label>
                <Input required value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. North Plot A" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total Farm Size</Label>
                  <Input type="number" min="0" step="0.01" value={farmSizeValue} onChange={(e) => setFarmSizeValue(e.target.value)} placeholder="e.g. 5" />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select value={farmSizeUnit} onChange={(e) => setFarmSizeUnit(e.target.value)}>
                    <option value="hectares">Hectares</option>
                    <option value="acres">Acres</option>
                    <option value="square_meters">Square Meters</option>
                    <option value="plots">Plots</option>
                  </Select>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <LocationPicker
                  apiKey={googleMapsApiKey}
                  address={address}
                  lat={latitude}
                  lng={longitude}
                  onAddressChange={setAddress}
                  onLatChange={(val) => setLatitude(val.toString())}
                  onLngChange={(val) => setLongitude(val.toString())}
                />
              </div>
            </form>
          )}
        </div>

        {!createdFarm && (
          <div className="p-5 border-t border-white/10 flex justify-end space-x-3 sticky bottom-0 bg-[var(--card-bg)] z-10">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="register-farm-form" variant="primary" disabled={submitting}>
              {submitting && <Loader2 size={16} className="animate-spin mr-2" />}
              Register Farm
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
