'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getSellerFarms, createManualBiddingSale } from '@/lib/api/farms';
import { createTradeRequest } from '@/lib/api/seller';
import { LocationPicker } from '@/components/shared/LocationPicker';
import { Store, Layers, Loader2, CheckCircle, ArrowRight, Info } from 'lucide-react';
import { useMapsKey } from '@/components/providers/MapsProvider';

type ListingMode = 'standard' | 'bulk';

const UNITS = ['kg', 'tons', 'bags', 'baskets', 'crates', 'litres', 'units'];

const COMMODITY_OPTIONS = [
  'Maize', 'Rice', 'Cassava', 'Yam', 'Sorghum', 'Millet', 'Groundnut',
  'Soybean', 'Cowpea', 'Sesame', 'Tomato', 'Onion', 'Pepper', 'Other'
];

export default function SellerSellPage() {
  const { user, profile } = useAuthStore();
  const supabase = createClient();
  const mapsApiKey = useMapsKey();

  const [mode, setMode] = useState<ListingMode>('standard');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [farms, setFarms] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successId, setSuccessId] = useState('');

  // ── Standard Sale fields ──────────────────────────────────────────────────
  const [stdFarmId, setStdFarmId] = useState('');
  const [stdCommoditySelect, setStdCommoditySelect] = useState('Maize');
  const [stdCommodityCustom, setStdCommodityCustom] = useState('');
  const [stdQuantity, setStdQuantity] = useState('');
  const [stdUnit, setStdUnit] = useState('kg');
  const [stdAddress, setStdAddress] = useState('');
  const [stdLat, setStdLat] = useState<number | string>('');
  const [stdLng, setStdLng] = useState<number | string>('');

  // ── Bulk Bidding fields ───────────────────────────────────────────────────
  const [bulkFarmId, setBulkFarmId] = useState('');
  const [bulkCommoditySelect, setBulkCommoditySelect] = useState('Maize');
  const [bulkCommodityCustom, setBulkCommodityCustom] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState('');
  const [bulkUnit, setBulkUnit] = useState('kg');
  const [bulkMinPrice, setBulkMinPrice] = useState('');
  const [bulkAddress, setBulkAddress] = useState('');
  const [bulkLat, setBulkLat] = useState<number | string>('');
  const [bulkLng, setBulkLng] = useState<number | string>('');

  useEffect(() => {
    if (user) loadFarms();
  }, [user]);

  const loadFarms = async () => {
    setLoading(true);
    const { data } = await getSellerFarms(supabase, user!.id);
    const farmList = data || [];
    setFarms(farmList);
    if (farmList.length > 0) {
      selectFarmForStandard(farmList[0].id, farmList);
      selectFarmForBulk(farmList[0].id, farmList);
    }
    setLoading(false);
  };

  const getCommodityValue = (cropType: string) => {
    if (COMMODITY_OPTIONS.includes(cropType)) return cropType;
    return 'Other';
  };

  const selectFarmForStandard = (fId: string, source = farms) => {
    setStdFarmId(fId);
    const farm = source.find((f) => f.id === fId);
    if (farm) {
      const crop = farm.crop_type || 'Maize';
      setStdCommoditySelect(getCommodityValue(crop));
      if (getCommodityValue(crop) === 'Other') setStdCommodityCustom(crop);
      setStdAddress(farm.physical_address || '');
      setStdLat(farm.latitude || '');
      setStdLng(farm.longitude || '');
    }
  };

  const selectFarmForBulk = (fId: string, source = farms) => {
    setBulkFarmId(fId);
    const farm = source.find((f) => f.id === fId);
    if (farm) {
      const crop = farm.crop_type || 'Maize';
      setBulkCommoditySelect(getCommodityValue(crop));
      if (getCommodityValue(crop) === 'Other') setBulkCommodityCustom(crop);
      setBulkAddress(farm.physical_address || '');
      setBulkLat(farm.latitude || '');
      setBulkLng(farm.longitude || '');
    }
  };

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!profile) { setError('Profile not loaded.'); return; }
    
    const finalCommodity = stdCommoditySelect === 'Other' ? stdCommodityCustom.trim() : stdCommoditySelect;
    if (!finalCommodity) { setError('Commodity type is required.'); return; }
    if (!stdAddress.trim()) { setError('Pickup address is required.'); return; }

    setSubmitting(true);
    const { data, error: apiError } = await createTradeRequest(supabase, {
      user_id: profile.id,
      commodity_variety: finalCommodity,
      quantity_volume: parseInt(stdQuantity),
      quantity_unit: stdUnit,
      physical_address: stdAddress,
      computed_latitude: typeof stdLat === 'string' ? parseFloat(stdLat) : stdLat,
      computed_longitude: typeof stdLng === 'string' ? parseFloat(stdLng) : stdLng,
    });
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to create listing.');
    } else {
      setSuccess('Standard listing created! Buyers can now claim it directly.');
      setSuccessId(data?.id || '');
      setStdQuantity('');
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!profile) { setError('Profile not loaded.'); return; }
    
    const finalCommodity = bulkCommoditySelect === 'Other' ? bulkCommodityCustom.trim() : bulkCommoditySelect;
    if (!finalCommodity) { setError('Commodity type is required.'); return; }
    if (!bulkAddress.trim()) { setError('Pickup address is required.'); return; }

    setSubmitting(true);
    let finalFarmId = bulkFarmId;

    // If no farm was selected, we create one inline to satisfy the schema/RPC
    if (!finalFarmId) {
      const { data: newFarm, error: farmError } = await (supabase as any).from('farms').insert({
        user_id: profile.id,
        name: `Farm - ${bulkAddress.split(',')[0]}`,
        crop_type: finalCommodity,
        physical_address: bulkAddress,
        latitude: typeof bulkLat === 'string' ? parseFloat(bulkLat) : bulkLat,
        longitude: typeof bulkLng === 'string' ? parseFloat(bulkLng) : bulkLng
      }).select('id').single();

      if (farmError) {
        setError('Failed to create internal farm record: ' + farmError.message);
        setSubmitting(false);
        return;
      }
      finalFarmId = newFarm.id;
    }

    const { error: apiError } = await createManualBiddingSale(supabase, {
      farmId: finalFarmId,
      cropType: finalCommodity,
      totalQuantity: parseInt(bulkQuantity),
      quantityUnit: bulkUnit,
      minPricePerUnit: parseFloat(bulkMinPrice),
      pickupAddress: bulkAddress,
      pickupLatitude: typeof bulkLat === 'string' ? parseFloat(bulkLat) : bulkLat,
      pickupLongitude: typeof bulkLng === 'string' ? parseFloat(bulkLng) : bulkLng
    });
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to create bulk bidding sale.');
    } else {
      setSuccess(`Bulk bidding opportunity published! Buyers can now place bids in ${bulkUnit}.`);
      setSuccessId('');
      setBulkQuantity('');
      setBulkMinPrice('');
      if (!bulkFarmId) loadFarms(); // reload if we created one inline
    }
  };

  const selectStyle = 'w-full bg-black/20 border border-white/20 rounded-md p-2 text-white outline-none focus:border-[var(--agri-primary)] transition-colors';

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Sell / Create Listing</h1>
        <p className="opacity-70 mt-1">Choose a listing type to reach buyers on the marketplace.</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex space-x-1 mb-8 border border-white/10 rounded-lg p-1 max-w-md bg-black/10">
        <button
          onClick={() => { setMode('standard'); setError(''); setSuccess(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'standard' ? 'bg-[var(--agri-primary)] text-white shadow-md' : 'opacity-60 hover:opacity-100'}`}
        >
          <Store size={16} /> Standard Sale
        </button>
        <button
          onClick={() => { setMode('bulk'); setError(''); setSuccess(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'bulk' ? 'bg-[var(--agri-primary)] text-white shadow-md' : 'opacity-60 hover:opacity-100'}`}
        >
          <Layers size={16} /> Bulk Bidding Sale
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[var(--agri-primary)]" size={32} /></div>
      ) : (
        <div className="max-w-3xl">
          {/* Mode descriptions */}
          <Alert variant="info" className="mb-6">
            {mode === 'standard' ? (
              <>
                <strong>Standard Sale:</strong> Publish a listing at an open price. The first buyer to confirm claims the full quantity and proceeds to the existing trade/logistics flow.
              </>
            ) : (
              <>
                <strong>Bulk Bidding Sale:</strong> Sellers list a total quantity. Multiple buyers bid for portions (e.g. 10kg of 500kg). You review bids, accept or reject them, then confirm the harvest to convert accepted bids into trade requests. No IoT device required.
              </>
            )}
          </Alert>

          {error && <Alert variant="error" className="mb-4">{error}</Alert>}
          {success && (
            <Alert variant="success" className="mb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span><CheckCircle size={16} className="inline mr-2" />{success}</span>
                {successId ? (
                  <Link href="/dashboard/seller/requests"><Button size="sm" variant="secondary">View in My Requests</Button></Link>
                ) : (
                  <Link href="/dashboard/seller/bids"><Button size="sm" variant="secondary">Manage Bids</Button></Link>
                )}
              </div>
            </Alert>
          )}

          {/* ── STANDARD SALE FORM ─────────────────────────────────────────── */}
          {mode === 'standard' && (
            <Card>
              <h2 className="text-xl font-bold mb-6 flex items-center border-b border-white/10 pb-4">
                <Store className="mr-2 text-[var(--agri-primary)]" /> Standard Listing Details
              </h2>
              <form onSubmit={handleStandardSubmit} className="space-y-5">
                {farms.length > 0 && (
                  <div className="space-y-2">
                    <Label>Source Farm (optional — auto-fills location)</Label>
                    <select className={selectStyle} value={stdFarmId} onChange={(e) => selectFarmForStandard(e.target.value)}>
                      <option value="" className="bg-[#1a1f2e]">— Enter location manually —</option>
                      {farms.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#1a1f2e]">{f.name} ({f.crop_type})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Commodity / Crop Type</Label>
                    <select className={selectStyle} value={stdCommoditySelect} onChange={(e) => setStdCommoditySelect(e.target.value)}>
                      {COMMODITY_OPTIONS.map((c) => <option key={c} value={c} className="bg-[#1a1f2e]">{c}</option>)}
                    </select>
                    {stdCommoditySelect === 'Other' && (
                      <Input required className="mt-2" value={stdCommodityCustom} onChange={(e) => setStdCommodityCustom(e.target.value)} placeholder="Enter custom commodity" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <div className="flex space-x-2">
                      <Input required type="number" min="1" className="flex-1" value={stdQuantity} onChange={(e) => setStdQuantity(e.target.value)} placeholder="e.g. 500" />
                      <select className="w-28 bg-black/20 border border-white/20 rounded-md p-2 text-white outline-none focus:border-[var(--agri-primary)] transition-colors" value={stdUnit} onChange={(e) => setStdUnit(e.target.value)}>
                        {UNITS.map((u) => <option key={u} value={u} className="bg-[#1a1f2e]">{u}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-5">
                  <LocationPicker
                    apiKey={mapsApiKey}
                    address={stdAddress}
                    lat={stdLat}
                    lng={stdLng}
                    onAddressChange={setStdAddress}
                    onLatChange={setStdLat}
                    onLngChange={setStdLng}
                    label="Pickup / Farm Location"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full md:w-auto">
                    {submitting ? <><Loader2 className="animate-spin mr-2" size={18} />Publishing...</> : <>Publish Standard Listing <ArrowRight size={16} className="ml-2" /></>}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* ── BULK BIDDING SALE FORM ─────────────────────────────────────── */}
          {mode === 'bulk' && (
            <Card>
              <h2 className="text-xl font-bold mb-6 flex items-center border-b border-white/10 pb-4">
                <Layers className="mr-2 text-[var(--agri-primary)]" /> Bulk Bidding Sale Details
              </h2>
              <form onSubmit={handleBulkSubmit} className="space-y-5">
                {farms.length > 0 && (
                  <div className="space-y-2">
                    <Label>Source Farm (optional — auto-fills location)</Label>
                    <select className={selectStyle} value={bulkFarmId} onChange={(e) => selectFarmForBulk(e.target.value)}>
                      <option value="" className="bg-[#1a1f2e]">— Enter location manually —</option>
                      {farms.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#1a1f2e]">{f.name} ({f.crop_type})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Commodity / Crop Type</Label>
                    <select className={selectStyle} value={bulkCommoditySelect} onChange={(e) => setBulkCommoditySelect(e.target.value)}>
                      {COMMODITY_OPTIONS.map((c) => <option key={c} value={c} className="bg-[#1a1f2e]">{c}</option>)}
                    </select>
                    {bulkCommoditySelect === 'Other' && (
                      <Input required className="mt-2" value={bulkCommodityCustom} onChange={(e) => setBulkCommodityCustom(e.target.value)} placeholder="Enter custom commodity" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Total Available Quantity</Label>
                    <div className="flex space-x-2">
                      <Input required type="number" min="1" className="flex-1" value={bulkQuantity} onChange={(e) => setBulkQuantity(e.target.value)} placeholder="e.g. 500" />
                      <select className="w-28 bg-black/20 border border-white/20 rounded-md p-2 text-white outline-none focus:border-[var(--agri-primary)] transition-colors" value={bulkUnit} onChange={(e) => setBulkUnit(e.target.value)}>
                        {UNITS.map((u) => <option key={u} value={u} className="bg-[#1a1f2e]">{u}</option>)}
                      </select>
                    </div>
                    <p className="text-xs opacity-50 flex items-center"><Info size={11} className="mr-1" />All buyers will bid in <strong className="mx-1">{bulkUnit}</strong>.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Price per {bulkUnit} (₦)</Label>
                    <Input required type="number" min="1" step="0.01" value={bulkMinPrice} onChange={(e) => setBulkMinPrice(e.target.value)} placeholder="e.g. 2500" />
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-5">
                  <LocationPicker
                    apiKey={mapsApiKey}
                    address={bulkAddress}
                    lat={bulkLat}
                    lng={bulkLng}
                    onAddressChange={setBulkAddress}
                    onLatChange={setBulkLat}
                    onLngChange={setBulkLng}
                    label="Pickup / Farm Location"
                  />
                </div>

                <div className="bg-black/20 p-4 rounded-lg text-sm opacity-80 border border-white/10">
                  <strong>How bulk bidding works:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Buyers bid for portions of your {bulkQuantity || '—'} {bulkUnit} at or above ₦{bulkMinPrice || '—'}/{bulkUnit}.</li>
                    <li>You review bids in Bid Management and accept or reject each one.</li>
                    <li>When ready, confirm the harvest and convert accepted bids into trade requests.</li>
                  </ol>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full md:w-auto">
                    {submitting ? <><Loader2 className="animate-spin mr-2" size={18} />Publishing...</> : <>Publish Bulk Bidding Opportunity <ArrowRight size={16} className="ml-2" /></>}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
