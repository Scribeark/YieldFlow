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
import { getSellerFarms, saveBulkSale } from '@/lib/api/farms';
import { createTradeRequest } from '@/lib/api/seller';
import { LocationPicker } from '@/components/shared/LocationPicker';
import { Store, Layers, Loader2, CheckCircle, ArrowRight, Info, Calendar } from 'lucide-react';
import { useMapsKey } from '@/components/providers/MapsProvider';

type ListingMode = 'standard' | 'bulk';

const UNITS = ['kg', 'tons', 'bags', 'baskets', 'crates', 'litres', 'units'];

const COMMODITY_OPTIONS = [
  'Maize', 'Rice', 'Cassava', 'Yam', 'Sorghum', 'Millet', 'Groundnut',
  'Soybean', 'Cowpea', 'Sesame', 'Tomato', 'Onion', 'Pepper', 'Other'
];

/** Parse a date string to ISO string. */
function toISO(dtLocal: string): string | null {
  if (!dtLocal) return null;
  return new Date(dtLocal).toISOString();
}

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

  // ── Bulk Sale fields ──────────────────────────────────────────────────────
  const [bulkFarmId, setBulkFarmId] = useState('');
  const [bulkAllocId, setBulkAllocId] = useState('');
  const [bulkAllocations, setBulkAllocations] = useState<any[]>([]);
  const [bulkCommoditySelect, setBulkCommoditySelect] = useState('Maize');
  const [bulkCommodityCustom, setBulkCommodityCustom] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState('');
  const [bulkUnit, setBulkUnit] = useState('kg');
  const [bulkAskingPrice, setBulkAskingPrice] = useState('');
  const [bulkAddress, setBulkAddress] = useState('');
  const [bulkLat, setBulkLat] = useState<number | string>('');
  const [bulkLng, setBulkLng] = useState<number | string>('');

  // Simplified Harvest Dates
  const [plantingDate, setPlantingDate] = useState('');
  const [sellerMaturityAt, setSellerMaturityAt] = useState('');
  const [sellerNote, setSellerNote] = useState('');

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
    setBulkAllocId('');
    const farm = source.find((f) => f.id === fId);
    if (farm) {
      const crop = farm.crop_type || 'Maize';
      setBulkCommoditySelect(getCommodityValue(crop));
      if (getCommodityValue(crop) === 'Other') setStdCommodityCustom(crop);
      setBulkAddress(farm.physical_address || '');
      setBulkLat(farm.latitude || '');
      setBulkLng(farm.longitude || '');
      const allocs: any[] = Array.isArray(farm.farm_crop_allocations) ? farm.farm_crop_allocations : [];
      setBulkAllocations(allocs.filter((a) => a.allocation_status !== 'ARCHIVED'));
    } else {
      setBulkAllocations([]);
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
    if (!bulkQuantity || parseInt(bulkQuantity) <= 0) { setError('Expected quantity must be greater than 0.'); return; }
    if (!bulkAskingPrice || parseFloat(bulkAskingPrice) <= 0) { setError('Asking price must be greater than 0.'); return; }

    if (plantingDate && sellerMaturityAt && new Date(sellerMaturityAt) <= new Date(plantingDate)) {
      setError('Expected harvest date must be after the planting date.'); return;
    }

    let finalFarmId = bulkFarmId;
    setSubmitting(true);

    if (!finalFarmId) {
      const { data: newFarm, error: farmError } = await (supabase as any).from('farms').insert({
        user_id: profile.id,
        name: `Farm – ${bulkAddress.split(',')[0]}`,
        crop_type: finalCommodity,
        physical_address: bulkAddress,
        latitude: typeof bulkLat === 'string' ? parseFloat(bulkLat) : bulkLat,
        longitude: typeof bulkLng === 'string' ? parseFloat(bulkLng) : bulkLng
      }).select('id').single();

      if (farmError) {
        setError('Failed to create farm record: ' + farmError.message);
        setSubmitting(false);
        return;
      }
      finalFarmId = newFarm.id;
    }

    const { error: apiError } = await saveBulkSale(supabase, {
      farmId: finalFarmId,
      cropAllocationId: bulkAllocId || undefined,
      cropType: finalCommodity,
      expectedQuantityVolume: parseInt(bulkQuantity),
      expectedQuantityUnit: bulkUnit,
      askingPricePerUnit: parseFloat(bulkAskingPrice),
      pickupAddress: bulkAddress || undefined,
      pickupLatitude: bulkLat ? (typeof bulkLat === 'string' ? parseFloat(bulkLat) : bulkLat) : undefined,
      pickupLongitude: bulkLng ? (typeof bulkLng === 'string' ? parseFloat(bulkLng) : bulkLng) : undefined,
      sellerMaturityAt: toISO(sellerMaturityAt),
      sellerNote: [
        plantingDate ? `Planting Date: ${plantingDate}` : null,
        sellerNote.trim() || null
      ].filter(Boolean).join(' | ') || null,
    });
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to create bulk bidding sale.');
    } else {
      setSuccess('Bulk Bidding Sale created and open for buyer bids!');
      setSuccessId('');
      setBulkQuantity('');
      setBulkAskingPrice('');
      setPlantingDate('');
      setSellerMaturityAt('');
      setSellerNote('');
      if (!bulkFarmId) loadFarms();
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
          <Alert variant="info" className="mb-6">
            {mode === 'standard' ? (
              <>
                <strong>Standard Sale:</strong> Publish a listing at an open price. The first buyer to confirm claims the full quantity and proceeds directly to trade.
              </>
            ) : (
              <>
                <strong>Bulk Bidding Sale:</strong> Set your expected quantity and asking price. Buyers submit bids for portions. Bidding is open immediately. Accepted bids become provisional agreements that wait for harvest availability.
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
                    hideAdvancedCoordinates={true}
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

                {/* Farm + Crop Allocation */}
                {farms.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label>Farm</Label>
                      <select className={selectStyle} value={bulkFarmId} onChange={(e) => selectFarmForBulk(e.target.value)}>
                        <option value="" className="bg-[#1a1f2e]">— Enter location manually —</option>
                        {farms.map((f) => (
                          <option key={f.id} value={f.id} className="bg-[#1a1f2e]">{f.name}</option>
                        ))}
                      </select>
                    </div>
                    {bulkAllocations.length > 0 && (
                      <div className="space-y-2">
                        <Label>Crop Allocation (optional)</Label>
                        <select className={selectStyle} value={bulkAllocId} onChange={(e) => setBulkAllocId(e.target.value)}>
                          <option value="" className="bg-[#1a1f2e]">— None —</option>
                          {bulkAllocations.map((a) => (
                            <option key={a.id} value={a.id} className="bg-[#1a1f2e]">{a.crop_type} {a.expected_harvest_max ? `(${a.expected_harvest_max} ${a.expected_harvest_unit})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Commodity + Quantity */}
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
                    <Label>Expected Quantity</Label>
                    <div className="flex space-x-2">
                      <Input required type="number" min="1" className="flex-1" value={bulkQuantity} onChange={(e) => setBulkQuantity(e.target.value)} placeholder="e.g. 500" />
                      <select className="w-28 bg-black/20 border border-white/20 rounded-md p-2 text-white outline-none focus:border-[var(--agri-primary)] transition-colors" value={bulkUnit} onChange={(e) => setBulkUnit(e.target.value)}>
                        {UNITS.map((u) => <option key={u} value={u} className="bg-[#1a1f2e]">{u}</option>)}
                      </select>
                    </div>
                    <p className="text-xs opacity-50 flex items-center"><Info size={11} className="mr-1" />Buyers will bid in <strong className="mx-1">{bulkUnit}</strong>.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Asking or Reference Price per {bulkUnit} (₦)</Label>
                    <Input required type="number" min="1" step="0.01" value={bulkAskingPrice} onChange={(e) => setBulkAskingPrice(e.target.value)} placeholder="e.g. 2500" />
                  </div>
                </div>

                {/* Harvest Timeline */}
                <div className="border-t border-white/10 pt-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-4 flex items-center gap-2">
                    <Calendar size={14} /> Harvest Timeline
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label>Planting Date (optional)</Label>
                      <Input
                        type="date"
                        value={plantingDate}
                        onChange={(e) => setPlantingDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Harvest Date (optional)</Label>
                      <Input
                        type="date"
                        value={sellerMaturityAt}
                        onChange={(e) => setSellerMaturityAt(e.target.value)}
                        min={plantingDate || undefined}
                      />
                      <p className="text-xs opacity-50">When you expect the physical harvest to be ready.</p>
                    </div>
                  </div>
                </div>

                {/* Pickup location */}
                <div className="space-y-2 border-t border-white/10 pt-5">
                  <LocationPicker
                    apiKey={mapsApiKey}
                    address={bulkAddress}
                    lat={bulkLat}
                    lng={bulkLng}
                    onAddressChange={setBulkAddress}
                    onLatChange={setBulkLat}
                    onLngChange={setBulkLng}
                    label="Pickup / Farm Location (optional)"
                    hideAdvancedCoordinates={true}
                  />
                </div>

                {/* Seller note */}
                <div className="space-y-2">
                  <Label>Seller Note (optional)</Label>
                  <textarea
                    className="w-full bg-black/20 border border-white/20 rounded-md p-3 text-white outline-none focus:border-[var(--agri-primary)] transition-colors text-sm resize-none"
                    rows={3}
                    value={sellerNote}
                    onChange={(e) => setSellerNote(e.target.value)}
                    placeholder="Any additional information for buyers — e.g. crop quality, pickup directions, harvest conditions."
                  />
                </div>

                {/* Flow overview */}
                <div className="bg-black/20 p-4 rounded-lg text-sm opacity-80 border border-white/10">
                  <strong>How bulk bidding works:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Bidding is open immediately upon publishing. Buyers bid for portions of your harvest.</li>
                    <li>Accepting a bid creates a provisional agreement.</li>
                    <li>When expected harvest date arrives (or when you click <em>Declare Harvest Available</em>), accepted bids become eligible for evidence submission & trade conversion.</li>
                    <li>Submit camera-only harvest evidence to verify the trade and enable carrier logistics.</li>
                  </ol>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full md:w-auto">
                    {submitting ? <><Loader2 className="animate-spin mr-2" size={18} />Publishing...</> : <>Publish Bulk Bidding Sale <ArrowRight size={16} className="ml-2" /></>}
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
