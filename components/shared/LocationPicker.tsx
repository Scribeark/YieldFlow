'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Search, MapPin, Loader2, Navigation, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { geocodeAddress, reverseGeocode } from '@/lib/maps/googleMaps';

interface LocationPickerProps {
  apiKey?: string;
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

interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export function LocationPicker({
  apiKey = '',
  address,
  lat,
  lng,
  onAddressChange,
  onLatChange,
  onLngChange,
  label = 'Physical Address / Location',
  placeholder = 'e.g. Kurudu, Abuja or Kano City Market',
  required = true,
  hideAdvancedCoordinates = true,
}: LocationPickerProps) {
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<any>(null);

  // Initialize Google Places AutocompleteService if available
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.maps?.places) {
      try {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      } catch (e) {
        console.warn('Places AutocompleteService initialization error:', e);
      }
    }
  }, []);

  // Fetch suggestions as user types
  const fetchSuggestions = useCallback((query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (autocompleteServiceRef.current) {
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'ng' },
        },
        (predictions: any[], status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(
              predictions.map((p) => ({
                placeId: p.place_id,
                description: p.description,
              }))
            );
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        }
      );
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    setShowSuggestions(false);
    onAddressChange(suggestion.description);
    setGeocoding(true);
    setError(null);
    setInfo(null);
    setSuccess(null);

    const result = await geocodeAddress(suggestion.description, apiKey);
    if (result) {
      onAddressChange(result.address);
      onLatChange(result.lat);
      onLngChange(result.lng);
      setSuccess(`Location resolved: ${result.address}`);
    } else {
      setInfo('Address selected. Coordinates will be refined automatically.');
    }
    setGeocoding(false);
  };

  const handleGeocode = async (customQuery?: string) => {
    const query = (customQuery || address).trim();
    if (!query) return;

    setShowSuggestions(false);
    setGeocoding(true);
    setError(null);
    setInfo(null);
    setSuccess(null);

    let result = await geocodeAddress(query, apiKey);

    // Fallback 1: Append Nigeria if missing
    if (!result && !query.toLowerCase().includes('nigeria')) {
      result = await geocodeAddress(`${query}, Nigeria`, apiKey);
    }

    if (result) {
      onAddressChange(result.address);
      onLatChange(result.lat);
      onLngChange(result.lng);
      setSuccess(`Location found: ${result.address}`);
    } else {
      setError('Address could not be resolved. Please enter your town/state or use current GPS.');
      if (!hideAdvancedCoordinates) setShowAdvanced(true);
    }
    setGeocoding(false);
  };

  const handleGps = async () => {
    if (!navigator.geolocation) {
      setError('Browser GPS not supported on this device. Please search for your address.');
      return;
    }
    setGpsLoading(true);
    setError(null);
    setInfo(null);
    setSuccess(null);
    setShowSuggestions(false);

    const getPos = (options: PositionOptions): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });
    };

    try {
      let pos: GeolocationPosition;
      try {
        pos = await getPos({ enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
      } catch (err: any) {
        if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
          pos = await getPos({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
        } else {
          throw err;
        }
      }

      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;

      // Always store coordinates numerically internally
      onLatChange(latitude);
      onLngChange(longitude);

      // Attempt reverse geocoding to get human-readable address
      try {
        const formattedAddress = await reverseGeocode(latitude, longitude, apiKey);
        if (formattedAddress && formattedAddress.trim()) {
          // Never put raw coordinates in the visible address field
          onAddressChange(formattedAddress);
          setSuccess(`GPS location acquired: ${formattedAddress}`);
        } else {
          // If reverse geocode is unavailable, do NOT write numbers to address
          setInfo('GPS coordinates acquired. Please enter or confirm your town/landmark name.');
        }
      } catch (e) {
        console.warn('Reverse geocoding error:', e);
        setInfo('GPS coordinates acquired. Please enter your town/street address.');
      }
    } catch (err: any) {
      console.warn('GPS acquisition error:', err);
      let errorMessage = 'Could not acquire GPS. Please search for your address manually.';
      if (err.code === err.PERMISSION_DENIED) {
        errorMessage = 'Location permission was denied. Please allow GPS access or enter an address.';
      } else if (err.code === err.TIMEOUT) {
        errorMessage = 'GPS request timed out. Please try again or search by address.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errorMessage = 'Device location unavailable. Please enter your address manually.';
      }
      setError(errorMessage);
    } finally {
      setGpsLoading(false);
    }
  };

  const hasCoordinates = lat !== '' && lng !== '' && lat != null && lng != null;

  return (
    <div className="space-y-3 relative">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <Label className="flex items-center text-sm font-medium">
          <MapPin size={14} className="mr-1 text-[var(--agri-primary)]" /> {label}
        </Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleGps}
          disabled={gpsLoading}
          className="text-xs h-7 px-2.5 bg-black/20 hover:bg-black/30 border border-white/10"
        >
          {gpsLoading ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Navigation size={12} className="mr-1.5 text-blue-400" />}
          Use current GPS location
        </Button>
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              required={required}
              value={address}
              onChange={(e) => {
                const val = e.target.value;
                onAddressChange(val);
                setSuccess(null);
                setError(null);
                setInfo(null);
                fetchSuggestions(val);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGeocode();
                }
              }}
              placeholder={placeholder}
              className="w-full pr-8"
              autoComplete="off"
            />
            {hasCoordinates && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-400" title="Coordinates captured">
                <CheckCircle2 size={14} />
              </span>
            )}
          </div>
          <Button
            type="button"
            onClick={() => handleGeocode()}
            disabled={geocoding || !address.trim()}
            className="shrink-0"
          >
            {geocoding ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </Button>
        </div>

        {/* Places Autocomplete Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 left-0 right-0 mt-1 bg-[#1a1f2e] border border-white/20 rounded-lg shadow-xl max-h-56 overflow-y-auto"
          >
            {suggestions.map((item) => (
              <button
                key={item.placeId}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 flex items-center gap-2 border-b border-white/5 last:border-b-0 transition-colors"
                onClick={() => handleSelectSuggestion(item)}
              >
                <MapPin size={12} className="shrink-0 text-[var(--agri-primary)] opacity-70" />
                <span className="truncate">{item.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}
      {info && <div className="text-xs text-yellow-300 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">{info}</div>}
      {success && <div className="text-xs text-green-400 bg-green-500/10 p-2 rounded border border-green-500/20">{success}</div>}

      {!hideAdvancedCoordinates && (
        <div className="pt-2 border-t border-white/5 mt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-xs opacity-60 hover:opacity-100 transition-opacity"
          >
            {showAdvanced ? <ChevronUp size={12} className="mr-1" /> : <ChevronDown size={12} className="mr-1" />}
            Advanced Coordinates {hasCoordinates && `(${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`}
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
                  placeholder="e.g. 8.9341"
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
                  placeholder="e.g. 7.5717"
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
