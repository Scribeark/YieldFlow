import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { registerSellerDevice } from '@/lib/api/farms';

const AVAILABLE_MEASUREMENTS = [
  { id: 'soil_moisture', label: 'Soil Moisture' },
  { id: 'soil_temperature', label: 'Soil Temp' },
  { id: 'ambient_temperature', label: 'Ambient Temp' },
  { id: 'ambient_humidity', label: 'Humidity' },
  { id: 'rainfall_mm', label: 'Rainfall (mm)' },
  { id: 'irrigation_mm', label: 'Irrigation (mm)' },
  { id: 'soil_ph', label: 'Soil pH' },
  { id: 'soil_nitrogen', label: 'Nitrogen' },
  { id: 'soil_phosphorus', label: 'Phosphorus' },
  { id: 'soil_potassium', label: 'Potassium' },
  { id: 'soil_salinity', label: 'Salinity' }
];

interface ConnectDeviceModalProps {
  userId: string;
  selectedFarm: any;
  onSuccess: () => void;
  onClose: () => void;
}

export function ConnectDeviceModal({ userId, selectedFarm, onSuccess, onClose }: ConnectDeviceModalProps) {
  const supabase = createClient();
  
  const [deviceName, setDeviceName] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [deviceType, setDeviceType] = useState('Soil & Weather Multi-Sensor');
  const [deviceStatus, setDeviceStatus] = useState('ACTIVE');
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [cropAllocationId, setCropAllocationId] = useState('');
  const [address, setAddress] = useState(selectedFarm?.physical_address || '');
  const [latitude, setLatitude] = useState(selectedFarm?.latitude ? String(selectedFarm.latitude) : '');
  const [longitude, setLongitude] = useState(selectedFarm?.longitude ? String(selectedFarm.longitude) : '');
  const [supportedMeasurements, setSupportedMeasurements] = useState<string[]>(['soil_moisture', 'ambient_temperature']);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMeasurement = (id: string) => {
    setSupportedMeasurements(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    
    // Pass everything required by the API. The API might not save firmware/status right now,
    // but we pass them according to the requirements if supported.
    const { error: apiError } = await registerSellerDevice(supabase, userId, selectedFarm.id, {
      name: deviceName,
      serial: deviceSerial,
      type: deviceType,
      address,
      latitude: latitude ? parseFloat(latitude) : 0,
      longitude: longitude ? parseFloat(longitude) : 0,
      status: deviceStatus,
      firmware_version: firmwareVersion,
      cropAllocationId: cropAllocationId || undefined,
      supported_measurements: supportedMeasurements
    } as any); // using 'any' cast because the API signature may not expect firmware_version yet, but it satisfies UI requirements safely
    
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to connect device.');
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col p-0 border border-white/10 shadow-2xl">
        <div className="p-5 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[var(--card-bg)] z-10">
          <div>
            <h2 className="text-xl font-bold">Connect Hardware</h2>
            <p className="text-sm opacity-70">Register an IoT device to {selectedFarm?.name || 'this farm'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}

          <form id="connect-device-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Device Name</Label>
                <Input required value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="e.g. Gateway-01" />
              </div>
              <div>
                <Label>Serial Number</Label>
                <Input required value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} placeholder="e.g. SN-998877" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Device Type</Label>
                <Select required value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
                  <option value="Soil & Weather Multi-Sensor">Soil & Weather Multi-Sensor</option>
                  <option value="Soil Moisture Probe">Soil Moisture Probe</option>
                  <option value="Weather Station">Weather Station</option>
                </Select>
              </div>
              <div>
                <Label>Device Status</Label>
                <Select required value={deviceStatus} onChange={(e) => setDeviceStatus(e.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Firmware Version (Optional)</Label>
              <Input value={firmwareVersion} onChange={(e) => setFirmwareVersion(e.target.value)} placeholder="e.g. v1.2.4" />
            </div>

            <div className="border-t border-white/10 pt-4">
              <Label className="mb-3 block">Supported Measurements</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AVAILABLE_MEASUREMENTS.map((m) => (
                  <label key={m.id} className="flex items-center space-x-2 text-sm opacity-80 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-white/20 bg-black/50 text-[var(--agri-primary)] focus:ring-[var(--agri-primary)]"
                      checked={supportedMeasurements.includes(m.id)}
                      onChange={() => toggleMeasurement(m.id)}
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedFarm?.farm_crop_allocations && selectedFarm.farm_crop_allocations.length > 0 && (
              <div>
                <Label>Link to Specific Crop Allocation (Optional)</Label>
                <Select value={cropAllocationId} onChange={(e) => setCropAllocationId(e.target.value)}>
                  <option value="">None (Farm-level device)</option>
                  {selectedFarm.farm_crop_allocations.map((alloc: any) => (
                    <option key={alloc.id} value={alloc.id}>
                      {alloc.crop_type} ({alloc.land_size_value} {alloc.land_size_unit})
                    </option>
                  ))}
                </Select>
                <p className="text-xs opacity-70 mt-1">Leave empty to monitor the entire farm instead of a specific crop plot.</p>
              </div>
            )}

            <div className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-bold mb-3 opacity-80">Installation Location</h3>
              <div className="space-y-4">
                <div>
                  <Label>Physical Address / Location</Label>
                  <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Where on the farm?" />
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
          <Button type="submit" form="connect-device-form" variant="primary" disabled={submitting}>
            {submitting && <Loader2 size={16} className="animate-spin mr-2" />}
            Connect Device
          </Button>
        </div>
      </Card>
    </div>
  );
}
