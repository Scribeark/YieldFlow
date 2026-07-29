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
import { Store, Layers, Loader2, CheckCircle, ArrowRight, MapPin, Info } from 'lucide-react';

type ListingMode = 'standard' | 'bulk';

const UNITS = ['kg', 'tons', 'bags', 'baskets', 'crates', 'litres'];

const COMMODITY_OPTIONS = [
  'Maize', 'Rice', 'Cassava', 'Yam', 'Sorghum', 'Millet', 'Groundnut',
  'Soybean', 'Cowpea', 'Sesame', 'Tomato', 'Onion', 'Pepper', 'Other'
];

export default function SellerSellPage() {
  const { user, profile } = useAuthStore();

  const supabase = createClient();

  const [mode, setMode] = useState<ListingMode>('standard');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [farms, setFarms] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successId, setSuccessId] = useState('');

  // ── Standard Sale fields ──────────────────────────────────────────────────
  const [stdFarmId, setStdFarmId] = useState('');
  const [stdCommodity, setStdCommodity] = useState('Maize');
  const [stdQuantity, setStdQuantity] = useState('');
  const [stdAddress, setStdAddress] = useState('');
  const [stdLat, setStdLat] = useState(8.1333);
  const [stdLng, setStdLng] = useState(4.2667);

  // ── Bulk Bidding fields ───────────────────────────────────────────────────
  const [bulkFarmId, setBulkFarmId] = useState('');
  const [bulkCommodity, setBulkCommodity] = useState('Maize');
  const [bulkQuantity, setBulkQuantity] = useState('');
  const [bulkUnit, setBulkUnit] = useState('kg');
  const [bulkMinPrice, setBulkMinPrice] = useState('');
  const [bulkAddress, setBulkAddress] = useState('');
  const [bulkLat, setBulkLat] = useState(8.1333);
  const [bulkLng, setBulkLng] = useState(4.2667);

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

  const selectFarmForStandard = (fId: string, source = farms) => {
    setStdFarmId(fId);
    const farm = source.find((f) => f.id === fId);
    if (farm) {
      setStdCommodity(farm.crop_type || 'Maize');
      setStdAddress(farm.physical_address || '');
      setStdLat(farm.latitude || 8.1333);
      setStdLng(farm.longitude || 4.2667);
    }
  };

  const selectFarmForBulk = (fId: string, source = farms) => {
    setBulkFarmId(fId);
    const farm = source.find((f) => f.id === fId);
    if (farm) {
      setBulkCommodity(farm.crop_type || 'Maize');
      setBulkAddress(farm.physical_address || '');
      setBulkLat(farm.latitude || 8.1333);
      setBulkLng(farm.longitude || 4.2667);
    }
  };

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!profile) { setError('Profile not loaded.'); return; }
    if (!stdAddress.trim()) { setError('Pickup address is required.'); return; }

    setSubmitting(true);
    const { data, error: apiError } = await createTradeRequest(supabase, {
      user_id: profile.id,
      commodity_variety: stdCommodity,
      quantity_volume: parseInt(stdQuantity),
      physical_address: stdAddress,
      computed_latitude: stdLat,
      computed_longitude: stdLng,
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
    if (!bulkFarmId) { setError('Please select a farm.'); return; }
    if (!bulkAddress.trim()) { setError('Pickup address is required.'); return; }

    setSubmitting(true);
    const { data, error: apiError } = await createManualBiddingSale(supabase, {
      farmId: bulkFarmId,
      cropType: bulkCommodity,
      totalQuantity: parseInt(bulkQuantity),
      quantityUnit: bulkUnit,
      minPricePerUnit: parseFloat(bulkMinPrice),
      pickupAddress: bulkAddress,
      pickupLatitude: bulkLat,
      pickupLongitude: bulkLng
    });
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to create bulk bidding sale.');
    } else {
      setSuccess(`Bulk bidding opportunity published! Buyers can now place bids in ${bulkUnit}.`);
      setSuccessId('');
      setBulkQuantity('');
      setBulkMinPrice('');
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
                      <option value="" className="bg-[#1a1f2e]">— Enter address manually —</option>
                      {farms.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#1a1f2e]">{f.name} ({f.crop_type})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Commodity / Crop Type</Label>
                    <select className={selectStyle} value={stdCommodity} onChange={(e) => setStdCommodity(e.target.value)}>
                      {COMMODITY_OPTIONS.map((c) => <option key={c} value={c} className="bg-[#1a1f2e]">{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity (units / volume)</Label>
                    <Input required type="number" min="1" value={stdQuantity} onChange={(e) => setStdQuantity(e.target.value)} placeholder="e.g. 500" />
                    <p className="text-xs opacity-50">Standard listings do not carry a unit — buyers confirm the total volume.</p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-5">
                  <Label className="flex items-center"><MapPin size={14} className="mr-1" /> Pickup Address</Label>
                  <Input required value={stdAddress} onChange={(e) => setStdAddress(e.target.value)} placeholder="e.g. 12 Farm Road, Ogbomosho" />
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

              {farms.length === 0 ? (
                <Alert variant="info">
                  You need a farm registered before creating a bulk bidding sale.
                  <Link href="/dashboard/seller/device-readings">
                    <Button size="sm" className="mt-3">Register a Farm</Button>
                  </Link>
                </Alert>
              ) : (
                <form onSubmit={handleBulkSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label>Source Farm</Label>
                    <select required className={selectStyle} value={bulkFarmId} onChange={(e) => selectFarmForBulk(e.target.value)}>
                      {farms.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#1a1f2e]">{f.name} ({f.crop_type})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label>Commodity / Crop Type</Label>
                      <Input required value={bulkCommodity} onChange={(e) => setBulkCommodity(e.target.value)} placeholder="e.g. Maize" />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Available Quantity</Label>
                      <div className="flex space-x-2">
                        <Input required type="number" min="1" className="flex-1" value={bulkQuantity} onChange={(e) => setBulkQuantity(e.target.value)} placeholder="e.g. 500" />
                        <select className="w-28 bg-black/20 border border-white/20 rounded-md p-2 text-white outline-none focus:border-[var(--agri-primary)] transition-colors" value={bulkUnit} onChange={(e) => setBulkUnit(e.target.value)}>
                          {UNITS.map((u) => <option key={u} value={u} className="bg-[#1a1f2e]">{u}</option>)}
                        </select>
                      </div>
                      <p className="text-xs opacity-50 flex items-center"><Info size={11} className="mr-1" />All buyers will bid in <strong className="mx-1">{bulkUnit}</strong>. This unit cannot be changed after publishing.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Price per {bulkUnit} (₦)</Label>
                      <Input required type="number" min="1" step="0.01" value={bulkMinPrice} onChange={(e) => setBulkMinPrice(e.target.value)} placeholder="e.g. 2500" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center"><MapPin size={14} className="mr-1" /> Pickup Address</Label>
                      <Input required value={bulkAddress} onChange={(e) => setBulkAddress(e.target.value)} placeholder="e.g. 12 Farm Road, Ogbomosho" />
                    </div>
                  </div>

                  <div className="bg-black/20 p-4 rounded-lg text-sm opacity-80 border border-white/10">
                    <strong>How bulk bidding works:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Buyers bid for portions of your {bulkQuantity || '—'} {bulkUnit} at or above ₦{bulkMinPrice || '—'}/{bulkUnit}.</li>
                      <li>You review bids in Bid Management and accept or reject each one.</li>
                      <li>When ready, confirm the harvest and convert accepted bids into trade requests.</li>
                      <li>Each accepted buyer proceeds through the standard evidence → logistics flow.</li>
                    </ol>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full md:w-auto">
                      {submitting ? <><Loader2 className="animate-spin mr-2" size={18} />Publishing...</> : <>Publish Bulk Bidding Opportunity <ArrowRight size={16} className="ml-2" /></>}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
