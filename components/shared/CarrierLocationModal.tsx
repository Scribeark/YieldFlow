import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { MapPin, Navigation, Truck, X } from 'lucide-react';
import { geocodeAddress } from '@/lib/maps/googleMaps';
import { useMapsKey } from '@/components/providers/MapsProvider';

interface Vehicle {
  id: string;
  plate_number?: string;
  vehicle_nickname?: string;
  current_latitude?: number | null;
  current_longitude?: number | null;
  current_address?: string | null;
  location_updated_at?: string | null;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address: string | null;
}

interface CarrierLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  eligibleVehicles: Vehicle[];
  onConfirm: (vehicleId: string, locationData?: LocationData) => void;
}

export default function CarrierLocationModal({
  isOpen,
  onClose,
  eligibleVehicles,
  onConfirm,
}: CarrierLocationModalProps) {
  const apiKey = useMapsKey();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [locationMode, setLocationMode] = useState<'gps' | 'manual' | 'saved' | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && eligibleVehicles.length > 0) {
      setSelectedVehicleId(eligibleVehicles[0].id);
      setLocationMode(null);
      setManualAddress('');
      setError(null);
    }
  }, [isOpen, eligibleVehicles]);

  if (!isOpen) return null;

  const selectedVehicle = eligibleVehicles.find(v => v.id === selectedVehicleId);

  const isLocationFresh = () => {
    if (!selectedVehicle || !selectedVehicle.location_updated_at) return false;
    if (!selectedVehicle.current_latitude || !selectedVehicle.current_longitude) return false;
    
    const updated = new Date(selectedVehicle.location_updated_at);
    const now = new Date();
    const diffMins = (now.getTime() - updated.getTime()) / 60000;
    return diffMins < 30;
  };

  const hasFreshLocation = isLocationFresh();

  const handleConfirm = async () => {
    if (!selectedVehicle) return;
    setError(null);
    setProcessing(true);

    try {
      if (hasFreshLocation) {
        onConfirm(selectedVehicle.id);
        return;
      }

      if (locationMode === 'gps') {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        onConfirm(selectedVehicle.id, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          address: null
        });
      } else if (locationMode === 'manual') {
        if (!manualAddress.trim()) {
          setError('Please enter a valid address.');
          setProcessing(false);
          return;
        }
        const coords = await geocodeAddress(manualAddress, apiKey);
        if (!coords) {
          setError('Could not find that address. Please be more specific.');
          setProcessing(false);
          return;
        }
        // Carrier location must only update vehicle_states. Do not write to trade_requests.delivery_*.
        onConfirm(selectedVehicle.id, {
          latitude: coords.lat,
          longitude: coords.lng,
          address: manualAddress
        });
      } else if (locationMode === 'saved') {
        if (!selectedVehicle.current_latitude || !selectedVehicle.current_longitude) {
          setError('No saved location found for this vehicle.');
          setProcessing(false);
          return;
        }
        // Carrier location must only update vehicle_states. Do not write to trade_requests.delivery_*.
        onConfirm(selectedVehicle.id, {
          latitude: selectedVehicle.current_latitude,
          longitude: selectedVehicle.current_longitude,
          address: selectedVehicle.current_address || null
        });
      } else {
        setError('Please select a location method.');
      }
    } catch (err: any) {
      console.error('Location error:', err);
      setError(err.message || 'Failed to determine location. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Truck className="w-5 h-5 mr-2 text-green-600" />
            Confirm your current carrier/vehicle location
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Vehicle Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Vehicle</label>
            {eligibleVehicles.length > 1 ? (
              <select
                value={selectedVehicleId}
                onChange={(e) => {
                  setSelectedVehicleId(e.target.value);
                  setLocationMode(null);
                }}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 p-2 border"
              >
                {eligibleVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number || 'Unknown Plate'} {v.vehicle_nickname ? `(${v.vehicle_nickname})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-gray-50 border rounded-lg text-gray-700 font-medium">
                {selectedVehicle?.plate_number || 'Vehicle'} {selectedVehicle?.vehicle_nickname ? `(${selectedVehicle.vehicle_nickname})` : ''}
              </div>
            )}
          </div>

          {/* Location Requirement */}
          {!hasFreshLocation ? (
            <div className="space-y-4">
              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4">
                <p className="font-semibold mb-1">This is your starting/current logistics location. It is not the buyer delivery address.</p>
                This vehicle's location is missing or stale. You must update your location to calculate distance and accept this job.
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setLocationMode('gps')}
                  className={`flex items-center p-4 border rounded-lg text-left transition-colors ${
                    locationMode === 'gps' ? 'border-green-600 bg-green-50 ring-1 ring-green-600' : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <Navigation className={`w-5 h-5 mr-3 ${locationMode === 'gps' ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <div className={`font-medium ${locationMode === 'gps' ? 'text-green-800' : 'text-gray-900'}`}>Use my current GPS location</div>
                    <div className="text-xs text-gray-500">Auto-detect your current position</div>
                  </div>
                </button>

                <button
                  onClick={() => setLocationMode('manual')}
                  className={`flex items-center p-4 border rounded-lg text-left transition-colors ${
                    locationMode === 'manual' ? 'border-green-600 bg-green-50 ring-1 ring-green-600' : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <MapPin className={`w-5 h-5 mr-3 ${locationMode === 'manual' ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <div className={`font-medium ${locationMode === 'manual' ? 'text-green-800' : 'text-gray-900'}`}>Enter my current vehicle address manually</div>
                    <div className="text-xs text-gray-500">Type your current street address</div>
                  </div>
                </button>
                
                {locationMode === 'manual' && (
                  <div className="pl-4 border-l-2 border-green-200 ml-2 py-2">
                    <input
                      type="text"
                      placeholder="e.g. 123 Main St, Abuja"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 p-2 border"
                    />
                  </div>
                )}

                {selectedVehicle?.current_latitude && selectedVehicle?.current_longitude && (
                  <button
                    onClick={() => setLocationMode('saved')}
                    className={`flex items-center p-4 border rounded-lg text-left transition-colors ${
                      locationMode === 'saved' ? 'border-green-600 bg-green-50 ring-1 ring-green-600' : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <Truck className={`w-5 h-5 mr-3 ${locationMode === 'saved' ? 'text-green-600' : 'text-gray-400'}`} />
                    <div>
                      <div className={`font-medium ${locationMode === 'saved' ? 'text-green-800' : 'text-gray-900'}`}>Use saved vehicle location</div>
                      <div className="text-xs text-gray-500">
                        {selectedVehicle.current_address || 'Last known coordinates'}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-green-50 text-green-800 p-4 rounded-lg flex items-start">
              <MapPin className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Location is fresh</p>
                <p className="text-sm mt-1 opacity-90">Your current location will be used to calculate proximity to the pickup point.</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="ghost" className="border border-gray-200" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing || (!hasFreshLocation && !locationMode)}>
            {processing ? 'Processing...' : 'Confirm & Accept'}
          </Button>
        </div>
      </div>
    </div>
  );
}
