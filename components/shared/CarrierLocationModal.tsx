import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { MapPin, Navigation, Truck, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { geocodeAddress, reverseGeocode } from '@/lib/maps/googleMaps';
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
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsData, setGpsData] = useState<LocationData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && eligibleVehicles.length > 0) {
      setSelectedVehicleId(eligibleVehicles[0].id);
      setLocationMode(null);
      setManualAddress('');
      setGpsData(null);
      setGpsLoading(false);
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

  const acquireGps = async (): Promise<LocationData | null> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Please enter your address manually.');
      return null;
    }

    setGpsLoading(true);
    setError(null);

    const getPos = (options: PositionOptions): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
    };

    try {
      let pos: GeolocationPosition;
      try {
        // Try high accuracy with short timeout
        pos = await getPos({ enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
      } catch (err: any) {
        if (err.code === 1) { // PERMISSION_DENIED
          throw err;
        }
        // Fallback to standard accuracy with longer timeout & cached position
        pos = await getPos({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
      }

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      let humanAddress: string | null = null;
      try {
        humanAddress = await reverseGeocode(lat, lng, apiKey);
      } catch (e) {
        console.warn('Reverse geocode error:', e);
      }

      const result: LocationData = {
        latitude: lat,
        longitude: lng,
        address: humanAddress || `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      };

      setGpsData(result);
      setGpsLoading(false);
      return result;
    } catch (err: any) {
      setGpsLoading(false);
      console.error('GPS acquisition error:', err);
      let msg = 'Could not determine GPS location. Please enter your vehicle location manually.';
      if (err.code === 1) {
        msg = 'Location permission denied by browser. Please enable location permissions or enter your address manually.';
      } else if (err.code === 3) {
        msg = 'GPS acquisition timed out. Please try again or enter your address manually.';
      }
      setError(msg);
      return null;
    }
  };

  const handleSelectGpsMode = async () => {
    setLocationMode('gps');
    if (!gpsData) {
      await acquireGps();
    }
  };

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
        let loc = gpsData;
        if (!loc) {
          loc = await acquireGps();
        }
        if (!loc) {
          setProcessing(false);
          return;
        }
        onConfirm(selectedVehicle.id, loc);
      } else if (locationMode === 'manual') {
        if (!manualAddress.trim()) {
          setError('Please enter a valid address.');
          setProcessing(false);
          return;
        }
        const coords = await geocodeAddress(manualAddress, apiKey);
        if (!coords) {
          setError('Could not find that address. Please be more specific with city and state.');
          setProcessing(false);
          return;
        }
        onConfirm(selectedVehicle.id, {
          latitude: coords.lat,
          longitude: coords.lng,
          address: coords.address || manualAddress
        });
      } else if (locationMode === 'saved') {
        if (!selectedVehicle.current_latitude || !selectedVehicle.current_longitude) {
          setError('No saved location found for this vehicle.');
          setProcessing(false);
          return;
        }
        onConfirm(selectedVehicle.id, {
          latitude: selectedVehicle.current_latitude,
          longitude: selectedVehicle.current_longitude,
          address: selectedVehicle.current_address || null
        });
      } else {
        setError('Please select a location method.');
        setProcessing(false);
      }
    } catch (err: any) {
      console.error('Location confirmation error:', err);
      setError(err.message || 'Failed to determine location. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#131722] text-white border border-white/20 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
          <h2 className="text-lg font-semibold flex items-center">
            <Truck className="w-5 h-5 mr-2 text-[var(--agri-primary,#10b981)]" />
            Confirm your current carrier/vehicle location
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Vehicle Selection */}
          <div>
            <label className="block text-sm font-medium opacity-80 mb-2">Select Vehicle</label>
            {eligibleVehicles.length > 1 ? (
              <select
                value={selectedVehicleId}
                onChange={(e) => {
                  setSelectedVehicleId(e.target.value);
                  setLocationMode(null);
                }}
                className="w-full bg-black/30 border border-white/20 rounded-lg p-2.5 text-white outline-none focus:border-[var(--agri-primary,#10b981)] transition-colors"
              >
                {eligibleVehicles.map(v => (
                  <option key={v.id} value={v.id} className="bg-[#1a1f2e]">
                    {v.plate_number || 'Unknown Plate'} {v.vehicle_nickname ? `(${v.vehicle_nickname})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-black/20 border border-white/10 rounded-lg font-medium opacity-90">
                {selectedVehicle?.plate_number || 'Vehicle'} {selectedVehicle?.vehicle_nickname ? `(${selectedVehicle.vehicle_nickname})` : ''}
              </div>
            )}
          </div>

          {/* Location Requirement */}
          {!hasFreshLocation ? (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3.5 rounded-lg text-sm">
                <p className="font-semibold mb-1">This is your starting/current logistics location. It is not the buyer delivery address.</p>
                This vehicle's location is missing or stale. You must update your location to calculate distance and accept this job.
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* GPS Option */}
                <button
                  type="button"
                  onClick={handleSelectGpsMode}
                  className={`flex items-start p-4 border rounded-lg text-left transition-all ${
                    locationMode === 'gps'
                      ? 'border-[var(--agri-primary,#10b981)] bg-[var(--agri-primary,#10b981)]/10 ring-1 ring-[var(--agri-primary,#10b981)]'
                      : 'border-white/10 bg-black/20 hover:border-white/30'
                  }`}
                >
                  {gpsLoading ? (
                    <Loader2 className="w-5 h-5 mr-3 text-[var(--agri-primary,#10b981)] animate-spin mt-0.5 shrink-0" />
                  ) : (
                    <Navigation className={`w-5 h-5 mr-3 mt-0.5 shrink-0 ${locationMode === 'gps' ? 'text-[var(--agri-primary,#10b981)]' : 'text-gray-400'}`} />
                  )}
                  <div className="flex-1">
                    <div className="font-medium flex items-center justify-between">
                      <span>Use my current GPS location</span>
                      {gpsData && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-normal">
                          <CheckCircle2 size={12} /> Captured
                        </span>
                      )}
                    </div>
                    <div className="text-xs opacity-60 mt-0.5">
                      {gpsLoading
                        ? 'Acquiring GPS position from browser…'
                        : gpsData
                        ? gpsData.address || `Coordinates: ${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)}`
                        : 'Auto-detect your current position via device GPS'}
                    </div>
                  </div>
                </button>

                {/* Manual Address Option */}
                <button
                  type="button"
                  onClick={() => setLocationMode('manual')}
                  className={`flex items-start p-4 border rounded-lg text-left transition-all ${
                    locationMode === 'manual'
                      ? 'border-[var(--agri-primary,#10b981)] bg-[var(--agri-primary,#10b981)]/10 ring-1 ring-[var(--agri-primary,#10b981)]'
                      : 'border-white/10 bg-black/20 hover:border-white/30'
                  }`}
                >
                  <MapPin className={`w-5 h-5 mr-3 mt-0.5 shrink-0 ${locationMode === 'manual' ? 'text-[var(--agri-primary,#10b981)]' : 'text-gray-400'}`} />
                  <div>
                    <div className="font-medium">Enter my current vehicle address manually</div>
                    <div className="text-xs opacity-60 mt-0.5">Type your current street address, town, or city</div>
                  </div>
                </button>
                
                {locationMode === 'manual' && (
                  <div className="pl-4 border-l-2 border-[var(--agri-primary,#10b981)]/40 ml-2 py-2">
                    <input
                      type="text"
                      placeholder="e.g. 123 Main St, Kurudu, Abuja"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-lg p-2.5 text-white outline-none focus:border-[var(--agri-primary,#10b981)] transition-colors text-sm"
                    />
                  </div>
                )}

                {/* Saved Vehicle Location Option */}
                {selectedVehicle?.current_latitude && selectedVehicle?.current_longitude && (
                  <button
                    type="button"
                    onClick={() => setLocationMode('saved')}
                    className={`flex items-start p-4 border rounded-lg text-left transition-all ${
                      locationMode === 'saved'
                        ? 'border-[var(--agri-primary,#10b981)] bg-[var(--agri-primary,#10b981)]/10 ring-1 ring-[var(--agri-primary,#10b981)]'
                        : 'border-white/10 bg-black/20 hover:border-white/30'
                    }`}
                  >
                    <Truck className={`w-5 h-5 mr-3 mt-0.5 shrink-0 ${locationMode === 'saved' ? 'text-[var(--agri-primary,#10b981)]' : 'text-gray-400'}`} />
                    <div>
                      <div className="font-medium">Use saved vehicle location</div>
                      <div className="text-xs opacity-60 mt-0.5">
                        {selectedVehicle.current_address || `${selectedVehicle.current_latitude.toFixed(4)}, ${selectedVehicle.current_longitude.toFixed(4)}`}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-4 rounded-lg flex items-start">
              <CheckCircle2 className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-green-400" />
              <div>
                <p className="font-medium">Location is fresh</p>
                <p className="text-sm mt-1 opacity-80">Your vehicle's active location is verified and will be used to calculate proximity to the pickup point.</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={processing || gpsLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={processing || gpsLoading || (!hasFreshLocation && !locationMode && !gpsData)}
          >
            {processing ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Processing…
              </>
            ) : (
              'Confirm & Accept'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
