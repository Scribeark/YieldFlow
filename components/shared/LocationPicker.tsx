'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Search, MapPin, Loader2, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import { geocodeAddress, reverseGeocode } from '@/lib/maps/googleMaps';

interface LocationPickerProps {
  apiKey: string;
  address: string;
  lat: number | string;
  lng: number | string;
  onAddressChange: (val: string) => void;
  onLatChange: (val: number | string) => void;
  onLngChange: (val: number | string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  hideAdvancedCoordinates?: boolean;
}

export function LocationPicker({
  apiKey,
  address,
  lat,
  lng,
  onAddressChange,
  onLatChange,
  onLngChange,
  label = "Physical Address / Location",
  placeholder = "e.g. 12 Farm Road, Kano",
  required = true,
  hideAdvancedCoordinates = false
}: LocationPickerProps) {
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleGeocode = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setError(null);
    setSuccess(null);
    
    let result = await geocodeAddress(address, apiKey);
    
    // Fallback 1: Append Nigeria if missing
    if (!result && !address.toLowerCase().includes('nigeria')) {
      result = await geocodeAddress(`${address}, Nigeria`, apiKey);
    }

    if (result) {
      onAddressChange(result.address);
      onLatChange(result.lat);
      onLngChange(result.lng);
      setSuccess(`Location found: ${result.address}`);
      setShowAdvanced(false);
    } else {
      setError('Address could not be found. Try adding city/state or use current GPS location.');
      if (!hideAdvancedCoordinates) setShowAdvanced(true);
    }
    setGeocoding(false);
  };

  const handleGps = () => {
    if (!navigator.geolocation) {
      setError('Browser GPS not supported. Please search for your address instead.');
      return;
    }
    setGpsLoading(true);
    setError(null);
    setSuccess(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        onLatChange(pos.coords.latitude);
        onLngChange(pos.coords.longitude);
        
        // Reverse geocode to get a readable address if possible
        try {
          const formattedAddress = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, apiKey);
          if (formattedAddress) {
            onAddressChange(formattedAddress);
          } else {
            // Fallback cleanly to stringified coordinates if reverse geocoding fails
            onAddressChange(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
          }
        } catch (e) {
          console.error("Reverse geocode failed:", e);
          onAddressChange(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        }
        
        setSuccess('GPS location acquired.');
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        let errorMessage = 'Could not get GPS location. Please search for your address instead.';
        if (err.code === err.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied. Please enable GPS access or search manually.';
        } else if (err.code === err.TIMEOUT) {
          errorMessage = 'GPS request timed out. Please try again or search manually.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMessage = 'Location unavailable. Please search manually.';
        }
        setError(errorMessage);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="flex items-center"><MapPin size={14} className="mr-1" /> {label}</Label>
        <Button 
          type="button" 
          variant="secondary" 
          size="sm" 
          onClick={handleGps}
          disabled={gpsLoading}
          className="text-xs h-7"
        >
          {gpsLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : <Navigation size={12} className="mr-1" />}
          Use current GPS location
        </Button>
      </div>

      <div className="flex gap-2">
        <Input 
          required={required}
          value={address} 
          onChange={(e) => {
            onAddressChange(e.target.value);
            setSuccess(null); // Clear success if they start typing again
          }} 
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleGeocode();
            }
          }}
          placeholder={placeholder} 
          className="flex-1"
        />
        <Button 
          type="button" 
          onClick={handleGeocode} 
          disabled={geocoding || !address.trim()} 
          className="shrink-0"
        >
          {geocoding ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </Button>
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}
      {success && <div className="text-xs text-green-400">{success}</div>}

      {!hideAdvancedCoordinates && (
        <div className="pt-2 border-t border-white/5 mt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-xs opacity-60 hover:opacity-100 transition-opacity"
        >
          {showAdvanced ? <ChevronUp size={12} className="mr-1" /> : <ChevronDown size={12} className="mr-1" />}
          Advanced Coordinates
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input 
                required={required} 
                type="number" 
                step="any" 
                value={lat} 
                onChange={(e) => onLatChange(e.target.value)} 
                placeholder="e.g. 8.1333" 
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input 
                required={required} 
                type="number" 
                step="any" 
                value={lng} 
                onChange={(e) => onLngChange(e.target.value)} 
                placeholder="e.g. 4.2667" 
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
