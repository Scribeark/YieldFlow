'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getSellerFarms, createManualBiddingSale } from '@/lib/api/farms';
import { Store, MapPin, Loader2, ArrowRight } from 'lucide-react';

export default function SellerSellPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [farms, setFarms] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [farmId, setFarmId] = useState('');
  const [cropType, setCropType] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('kg');
  const [minPrice, setMinPrice] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  // For demo, hardcoded lat/lng
  const [pickupLat] = useState(8.1333);
  const [pickupLng] = useState(4.2667);

  useEffect(() => {
    if (user) loadFarms();
  }, [user]);

  const loadFarms = async () => {
    setLoading(true);
    const { data } = await getSellerFarms(supabase, user!.id);
    setFarms(data || []);
    if (data && data.length > 0) {
      handleSelectFarm(data[0].id, data);
    }
    setLoading(false);
  };

  const handleSelectFarm = (fId: string, sourceFarms = farms) => {
    setFarmId(fId);
    const farm = sourceFarms.find(f => f.id === fId);
    if (farm) {
      setCropType(farm.crop_type || '');
      setPickupAddress(farm.physical_address || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!farmId) {
      setError('Please select a farm.');
      return;
    }

    setSubmitting(true);
    const { data, error: apiError } = await createManualBiddingSale(supabase, {
      farmId,
      cropType,
      totalQuantity: parseInt(totalQuantity),
      quantityUnit,
      minPricePerUnit: parseFloat(minPrice),
      pickupAddress,
      pickupLatitude: pickupLat,
      pickupLongitude: pickupLng
    });

    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to create sale.');
    } else {
      setSuccess('Marketplace listing successfully created! Buyers can now place bids.');
      // Reset some fields
      setTotalQuantity('');
      setMinPrice('');
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Create Marketplace Sale</h1>
        <p className="opacity-70 mt-1">List a manual harvest opportunity for buyers to bid on.</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card>
          <h2 className="text-xl font-bold mb-6 flex items-center border-b border-white/10 pb-4">
            <Store className="mr-2 text-[var(--agri-primary)]" /> Listing Details
          </h2>

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[var(--agri-primary)]" /></div>
          ) : farms.length === 0 ? (
            <Alert variant="info" title="No Farms Found">
              You must register a farm first before you can list produce for sale.
              <Button className="mt-4" onClick={() => router.push('/dashboard/seller/device-readings')}>Go to Farms</Button>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {error && <Alert variant="error" title="Error">{error}</Alert>}
              {success && <Alert variant="success" title="Success">{success}</Alert>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Source Farm</Label>
                  <select 
                    className="w-full bg-black/20 border border-white/20 rounded-md p-2 text-white outline-none focus:border-[var(--agri-primary)] transition-colors"
                    value={farmId}
                    onChange={(e) => handleSelectFarm(e.target.value)}
                    required
                  >
                    {farms.map(f => (
                      <option key={f.id} value={f.id} className="bg-[#1a1f2e]">{f.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Commodity / Crop Type</Label>
                  <Input 
                    required 
                    value={cropType} 
                    onChange={(e) => setCropType(e.target.value)} 
                    placeholder="e.g., Maize"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total Available Quantity</Label>
                  <div className="flex space-x-2">
                    <Input 
                      required 
                      type="number" 
                      min="1"
                      className="flex-1"
                      value={totalQuantity} 
                      onChange={(e) => setTotalQuantity(e.target.value)} 
                      placeholder="e.g., 500"
                    />
                    <select 
                      className="w-24 bg-black/20 border border-white/20 rounded-md p-2 text-white outline-none focus:border-[var(--agri-primary)] transition-colors"
                      value={quantityUnit}
                      onChange={(e) => setQuantityUnit(e.target.value)}
                    >
                      <option value="kg" className="bg-[#1a1f2e]">kg</option>
                      <option value="tons" className="bg-[#1a1f2e]">tons</option>
                      <option value="bags" className="bg-[#1a1f2e]">bags</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Minimum Price per {quantityUnit} (₦)</Label>
                  <Input 
                    required 
                    type="number" 
                    min="1"
                    step="0.01"
                    value={minPrice} 
                    onChange={(e) => setMinPrice(e.target.value)} 
                    placeholder="e.g., 2500"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-white/10 pt-6">
                <Label className="flex items-center"><MapPin size={16} className="mr-2" /> Pickup Address</Label>
                <Input 
                  required 
                  value={pickupAddress} 
                  onChange={(e) => setPickupAddress(e.target.value)} 
                  placeholder="e.g., 123 Farm Road, Ogbomosho"
                />
                <p className="text-xs opacity-60">This location will be shared with the buyer after bid conversion.</p>
              </div>

              <div className="pt-6 flex justify-end">
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="lg" 
                  disabled={submitting}
                  className="w-full md:w-auto"
                >
                  {submitting ? <Loader2 className="animate-spin mr-2" size={20} /> : <Store className="mr-2" size={20} />}
                  {submitting ? 'Publishing...' : 'Publish Listing to Marketplace'}
                  {!submitting && <ArrowRight className="ml-2" size={16} />}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
