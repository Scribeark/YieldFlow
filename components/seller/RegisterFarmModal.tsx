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

const CROP_OPTIONS = [
  'Maize',
  'Rice',
  'Cassava',
  'Yam',
  'Sorghum',
  'Tomatoes',
  'Other'
];

interface RegisterFarmModalProps {
  userId: string;
  onSuccess: (newFarm: any) => void;
  onClose: () => void;
}

export function RegisterFarmModal({ userId, onSuccess, onClose }: RegisterFarmModalProps) {
  const supabase = createClient();
  
  const [farmName, setFarmName] = useState('');
  const [cropTypeSelect, setCropTypeSelect] = useState('Maize');
  const [customCropType, setCustomCropType] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [maturityDays, setMaturityDays] = useState('120');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const finalCropType = cropTypeSelect === 'Other' ? customCropType.trim() : cropTypeSelect;
    
    if (!finalCropType) {
      setError('Please enter a crop type.');
      return;
    }

    setSubmitting(true);
    
    const { data, error: apiError } = await createSellerFarm(supabase, userId, {
      name: farmName,
      cropType: finalCropType,
      plantingDate,
      maturityDays: parseInt(maturityDays, 10),
      address,
      latitude: latitude ? parseFloat(latitude) : 0,
      longitude: longitude ? parseFloat(longitude) : 0
    });
    
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to register farm.');
    } else {
      onSuccess(data);
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

          <form id="register-farm-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label>Farm Name</Label>
              <Input required value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. North Plot A" />
            </div>

            <div>
              <Label>Crop Type</Label>
              <Select required value={cropTypeSelect} onChange={(e) => setCropTypeSelect(e.target.value)}>
                {CROP_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              {cropTypeSelect === 'Other' && (
                <div className="mt-2">
                  <Input 
                    required 
                    value={customCropType} 
                    onChange={(e) => setCustomCropType(e.target.value)} 
                    placeholder="Enter custom crop type" 
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Planting Date</Label>
                <Input required type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
              </div>
              <div>
                <Label>Expected Maturity (Days)</Label>
                <Input required type="number" min="1" value={maturityDays} onChange={(e) => setMaturityDays(e.target.value)} />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold opacity-80">Location Details</h3>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          setLatitude(position.coords.latitude.toString());
                          setLongitude(position.coords.longitude.toString());
                        },
                        (err) => setError('Failed to retrieve GPS location. You can enter coordinates manually.')
                      );
                    } else {
                      setError('Geolocation is not supported by your browser.');
                    }
                  }}
                  className="text-xs h-7"
                >
                  Use current GPS location
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Physical Address / Location</Label>
                  <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 123 Farm Road, Kano" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Latitude (Optional)</Label>
                    <Input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="8.1333" />
                  </div>
                  <div>
                    <Label>Longitude (Optional)</Label>
                    <Input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="4.2667" />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end space-x-3 sticky bottom-0 bg-[var(--card-bg)] z-10">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="register-farm-form" variant="primary" disabled={submitting}>
            {submitting && <Loader2 size={16} className="animate-spin mr-2" />}
            Register Farm
          </Button>
        </div>
      </Card>
    </div>
  );
}
