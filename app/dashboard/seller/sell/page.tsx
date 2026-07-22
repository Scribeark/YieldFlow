'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, UploadCloud, Check, Search } from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { createTradeRequest } from '@/lib/api/seller';
import { uploadHarvestPhoto } from '@/lib/supabase/storage';

const COMMODITIES = [
  'Maize', 'Rice', 'Cassava', 'Yam', 'Sorghum', 'Millet', 
  'Soybean', 'Groundnut', 'Tomato', 'Onion', 'Pepper', 
  'Cocoa', 'Sesame', 'Other'
];

export default function SellHarvestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demandId = searchParams.get('demand_id');
  const presetCommodity = searchParams.get('commodity');
  
  const { profile } = useAuthStore();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    commodity_variety: '',
    quantity_volume: '',
    physical_address: '',
    computed_latitude: '',
    computed_longitude: '',
  });
  
  const [isOtherCommodity, setIsOtherCommodity] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  useEffect(() => {
    if (presetCommodity) {
      if (COMMODITIES.includes(presetCommodity)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData(prev => ({ ...prev, commodity_variety: presetCommodity }));
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOtherCommodity(true);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData(prev => ({ ...prev, commodity_variety: presetCommodity }));
      }
    }
  }, [presetCommodity]);

  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{ type: 'success' | 'error' | 'info' | null, message: string | null }>({ type: null, message: null });
  
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoCapture = (capturedFile: File) => {
    setFile(capturedFile);
  };

  const handlePhotoClear = () => {
    setFile(null);
  };

  const getApiKey = () => {
    return process.env.NEXT_PUBLIC_MAPS_PLATFORM_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  };

  const requestLocation = () => {
    setIsLocating(true);
    setLocationStatus({ type: null, message: null });
    
    if (!navigator.geolocation) {
      setLocationStatus({ 
        type: 'error', 
        message: 'Geolocation is not supported by your browser. Please type your address below and click "Find Coordinates from Address".' 
      });
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setFormData(prev => ({
          ...prev,
          computed_latitude: lat.toString(),
          computed_longitude: lng.toString(),
        }));
        
        // Reverse Geocoding Attempt
        const apiKey = getApiKey();
        if (apiKey) {
          setLocationStatus({ type: 'info', message: 'Location captured. Attempting reverse geocoding...' });
          fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
            .then(res => res.json())
            .then(data => {
              if (data.results && data.results.length > 0) {
                setFormData(prev => ({
                  ...prev,
                  physical_address: data.results[0].formatted_address
                }));
                setLocationStatus({ type: 'success', message: 'Location captured and address auto-filled!' });
              } else {
                setLocationStatus({ type: 'success', message: 'Location captured (address auto-fill failed: no results).' });
              }
            })
            .catch(err => {
              console.error('Geocoding error:', err);
              setLocationStatus({ type: 'success', message: 'Location captured (address auto-fill failed: network error).' });
            })
            .finally(() => {
              setIsLocating(false);
            });
        } else {
          setLocationStatus({ type: 'success', message: 'Location captured (Google Maps API key missing for auto-fill).' });
          setIsLocating(false);
        }
      },
      (geoError) => {
        console.error('Geolocation error:', geoError);
        let errorMsg = 'Failed to get location. Please enable GPS permissions.';
        if (geoError.code === 1) errorMsg = 'Location access denied by user.';
        if (geoError.code === 2) errorMsg = 'Position unavailable.';
        if (geoError.code === 3) errorMsg = 'Location request timed out.';
        
        setLocationStatus({ 
          type: 'error', 
          message: `${errorMsg} Fallback: Type your address and click "Find Coordinates from Address".` 
        });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const geocodeAddress = () => {
    if (!formData.physical_address) {
      setLocationStatus({ type: 'error', message: 'Please enter a physical address to find coordinates.' });
      return;
    }
    
    setIsGeocoding(true);
    setLocationStatus({ type: null, message: null });
    
    const apiKey = getApiKey();
    if (!apiKey) {
      setLocationStatus({ type: 'error', message: 'Google Maps API key missing. Cannot find coordinates.' });
      setIsGeocoding(false);
      return;
    }

    setLocationStatus({ type: 'info', message: 'Finding coordinates...' });
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(formData.physical_address)}&key=${apiKey}`)
      .then(res => res.json())
      .then(data => {
        if (data.results && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          setFormData(prev => ({
            ...prev,
            computed_latitude: location.lat.toString(),
            computed_longitude: location.lng.toString(),
            physical_address: data.results[0].formatted_address // Optionally standardize
          }));
          setLocationStatus({ type: 'success', message: 'Coordinates found from address!' });
        } else {
          setLocationStatus({ type: 'error', message: 'Could not find coordinates for this address.' });
        }
      })
      .catch(err => {
        console.error('Geocoding error:', err);
        setLocationStatus({ type: 'error', message: 'Failed to geocode address due to a network error.' });
      })
      .finally(() => {
        setIsGeocoding(false);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (!formData.computed_latitude || !formData.computed_longitude) {
      setError('A valid location is required. Please use GPS or find coordinates from your typed address.');
      return;
    }

    if (!file) {
      setError('A valid harvest photo is required. Please capture a live photo.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setStatusMessage('Uploading harvest photo to secure storage...');

    let harvestPhotoUrl = null;

    // 1. Upload genuine photo file
    const { url, error: uploadError } = await uploadHarvestPhoto(supabase, file, profile.id);
    if (uploadError) {
      setError(`Failed to upload photo: ${uploadError.message}`);
      setIsLoading(false);
      setStatusMessage(null);
      return;
    }
    harvestPhotoUrl = url;

    setStatusMessage('Saving trade request data...');

    // 2. Insert trade request
    const payload = {
      user_id: profile.id,
      commodity_variety: formData.commodity_variety,
      quantity_volume: Number(formData.quantity_volume),
      physical_address: formData.physical_address,
      computed_latitude: Number(formData.computed_latitude),
      computed_longitude: Number(formData.computed_longitude),
      harvest_photo_url: harvestPhotoUrl,
      buyer_demand_id: demandId || null,
    };

    const { error: insertError } = await createTradeRequest(supabase, payload);

    if (insertError) {
      setError(`Failed to create trade request: ${insertError.message}`);
      setIsLoading(false);
      setStatusMessage(null);
      return;
    }

    // 3. Success state
    setSuccess(true);
    setIsLoading(false);
    setStatusMessage(null);
  };

  if (success) {
    return (
      <PageContainer>
        <Card className="max-w-md mx-auto p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--agri-primary-light)' }}>Harvest Submitted!</h2>
          <p className="mb-8" style={{ color: 'var(--foreground-muted)' }}>
            Your trade request has been securely submitted to the marketplace. Buyers and logistics partners can now view your listing.
          </p>
          <Button onClick={() => router.push('/dashboard/seller/requests')} className="w-full">
            View My Requests
          </Button>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            ← Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Sell Harvest</h1>
          <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>
            Submit a new verified trade request to the marketplace.
          </p>
        </div>

        <Card>
          {error && (
            <Alert variant="error" className="mb-6">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Phase 1: Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">1. Harvest Details</h3>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <Label>Commodity Variety</Label>
                  <select
                    required
                    className="w-full h-10 px-3 rounded-md border text-sm mt-1"
                    style={{ 
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--foreground)'
                    }}
                    value={isOtherCommodity ? 'Other' : formData.commodity_variety}
                    onChange={(e) => {
                      if (e.target.value === 'Other') {
                        setIsOtherCommodity(true);
                        setFormData({ ...formData, commodity_variety: '' });
                      } else {
                        setIsOtherCommodity(false);
                        setFormData({ ...formData, commodity_variety: e.target.value });
                      }
                    }}
                  >
                    <option value="" disabled>Select a commodity</option>
                    {COMMODITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  
                  {isOtherCommodity && (
                    <div className="mt-4">
                      <Label>Specify Other Commodity</Label>
                      <Input 
                        required 
                        name="commodity_variety" 
                        value={formData.commodity_variety} 
                        onChange={handleInputChange} 
                        placeholder="e.g., Watermelon" 
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <Label>Quantity (kg/tons)</Label>
                  <Input 
                    required 
                    type="number" 
                    step="0.01"
                    min="0"
                    name="quantity_volume" 
                    value={formData.quantity_volume} 
                    onChange={handleInputChange} 
                    placeholder="e.g., 500" 
                  />
                </div>
              </div>
            </div>

            {/* Phase 2: Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">2. GPS Location & Address</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>
                Precise GPS coordinates are required. Use your device GPS, or type your address and find the coordinates.
              </p>
              
              <div className="bg-black/5 p-4 rounded-lg border border-border space-y-4">
                <Button 
                  type="button" 
                  variant={formData.computed_latitude ? 'secondary' : 'primary'}
                  onClick={requestLocation} 
                  isLoading={isLocating}
                  disabled={isLocating || isGeocoding}
                  className="w-full sm:w-auto"
                >
                  <MapPin size={16} className="mr-2" />
                  {formData.computed_latitude ? 'Update GPS Location' : 'Use My Current Location'}
                </Button>

                {locationStatus.message && (
                  <Alert variant={locationStatus.type === 'error' ? 'error' : (locationStatus.type === 'success' ? 'success' : 'info')} className="text-sm py-2 px-3">
                    {locationStatus.message}
                  </Alert>
                )}

                <input type="hidden" name="computed_latitude" value={formData.computed_latitude} required />
                <input type="hidden" name="computed_longitude" value={formData.computed_longitude} required />
                {formData.computed_latitude && (
                  <p className="text-xs text-green-600 font-medium mt-2 flex items-center">
                    <Check size={14} className="mr-1" /> GPS Coordinates attached securely.
                  </p>
                )}
              </div>
              
              <div>
                <Label>Physical Address</Label>
                <div className="flex gap-2">
                  <Input 
                    required 
                    name="physical_address" 
                    value={formData.physical_address} 
                    onChange={handleInputChange} 
                    placeholder="e.g., Warehouse 4, North Farm, Kaduna" 
                  />
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={geocodeAddress}
                    isLoading={isGeocoding}
                    disabled={isLocating || isGeocoding || !formData.physical_address}
                    title="Find Coordinates from Address"
                  >
                    <Search size={16} />
                  </Button>
                </div>
                <p className="text-xs mt-1 text-foreground-muted">
                  If GPS fails, type your address and click the search icon to find your coordinates.
                </p>
              </div>
            </div>

            {/* Phase 3: Evidence */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">3. Harvest Evidence</h3>
              <CameraCapture onCapture={handlePhotoCapture} onClear={handlePhotoClear} />
            </div>

            {/* Submission */}
            <div className="pt-4 border-t">
              {statusMessage && (
                <div className="flex items-center text-sm font-medium text-agri-primary mb-4 justify-center">
                  <UploadCloud className="animate-bounce mr-2 h-4 w-4" />
                  {statusMessage}
                </div>
              )}
              <Button 
                type="submit" 
                isLoading={isLoading}
                disabled={isLoading || isLocating || isGeocoding}
                className="w-full text-lg h-12"
              >
                Submit Trade Request
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
