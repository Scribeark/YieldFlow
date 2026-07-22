'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search } from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { createBuyerDemand } from '@/lib/api/buyer';

const COMMODITIES = [
  'Maize', 'Rice', 'Cassava', 'Yam', 'Sorghum', 'Millet', 
  'Soybean', 'Groundnut', 'Tomato', 'Onion', 'Pepper', 
  'Cocoa', 'Sesame', 'Other'
];

export default function NewDemandPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    commodity_variety: '',
    quantity_volume: '',
    delivery_address: '',
    computed_latitude: '',
    computed_longitude: '',
  });
  
  const [isOtherCommodity, setIsOtherCommodity] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{ type: 'success' | 'error' | 'info' | null, message: string | null }>({ type: null, message: null });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getApiKey = () => {
    return process.env.NEXT_PUBLIC_MAPS_PLATFORM_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  };

  const geocodeAddress = () => {
    if (!formData.delivery_address) {
      setLocationStatus({ type: 'error', message: 'Please enter a delivery address to find coordinates.' });
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
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(formData.delivery_address)}&key=${apiKey}`)
      .then(res => res.json())
      .then(data => {
        if (data.results && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          setFormData(prev => ({
            ...prev,
            computed_latitude: location.lat.toString(),
            computed_longitude: location.lng.toString(),
            delivery_address: data.results[0].formatted_address
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
    
    setIsLoading(true);
    setError(null);

    const payload = {
      buyer_id: profile.id,
      commodity_variety: formData.commodity_variety,
      quantity_volume: Number(formData.quantity_volume),
      delivery_address: formData.delivery_address,
      computed_latitude: formData.computed_latitude ? Number(formData.computed_latitude) : null,
      computed_longitude: formData.computed_longitude ? Number(formData.computed_longitude) : null,
      demand_status: 'AWAITING_SELLER'
    };

    const { error: insertError } = await createBuyerDemand(supabase, payload);

    if (insertError) {
      setError(`Failed to post demand: ${insertError.message}`);
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
  };

  if (success) {
    return (
      <PageContainer>
        <Card className="max-w-md mx-auto p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--agri-primary-light)' }}>Demand Posted!</h2>
          <p className="mb-8" style={{ color: 'var(--foreground-muted)' }}>
            Your demand request has been published. Verified sellers can now review it and respond with harvest evidence.
          </p>
          <Button onClick={() => router.push('/dashboard/buyer/demands')} className="w-full">
            View My Demands
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
            ← Back
          </Button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Post a Demand</h1>
          <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>
            Request a specific commodity and let verified sellers respond.
          </p>
        </div>

        <Card>
          {error && (
            <Alert variant="error" className="mb-6">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">1. Commodity Details</h3>
              
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
                  <Label>Required Quantity (kg/tons)</Label>
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

            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">2. Delivery Location</h3>
              
              <div>
                <Label>Delivery Address</Label>
                <div className="flex gap-2">
                  <Input 
                    required 
                    name="delivery_address" 
                    value={formData.delivery_address} 
                    onChange={handleInputChange} 
                    placeholder="e.g., Warehouse 4, North Farm, Kaduna" 
                  />
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={geocodeAddress}
                    isLoading={isGeocoding}
                    disabled={isGeocoding || !formData.delivery_address}
                    title="Find Coordinates from Address"
                  >
                    <Search size={16} />
                  </Button>
                </div>
                <p className="text-xs mt-1 text-foreground-muted">
                  Type your address and click the search icon to find the exact delivery coordinates.
                </p>
              </div>

              {locationStatus.message && (
                <Alert variant={locationStatus.type === 'error' ? 'error' : (locationStatus.type === 'success' ? 'success' : 'info')} className="text-sm py-2 px-3">
                  {locationStatus.message}
                </Alert>
              )}

              <input type="hidden" name="computed_latitude" value={formData.computed_latitude} />
              <input type="hidden" name="computed_longitude" value={formData.computed_longitude} />
              {formData.computed_latitude && (
                <div className="bg-black/5 p-3 rounded border border-border mt-2">
                  <p className="text-xs text-green-600 font-medium flex items-center">
                    <Check size={14} className="mr-1" /> Delivery coordinates attached securely.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <Button 
                type="submit" 
                isLoading={isLoading}
                disabled={isLoading || isGeocoding}
                className="w-full text-lg h-12"
              >
                Post Demand
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
