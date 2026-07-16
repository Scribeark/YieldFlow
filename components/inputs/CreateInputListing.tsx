'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import CameraCapture from '@/components/ui/CameraCapture';
import { Plus, Loader2, Store, CheckCircle2, AlertCircle, Package } from 'lucide-react';

interface CreateInputListingProps {
  onCreated: () => void;
}

export default function CreateInputListing({ onCreated }: CreateInputListingProps) {
  const { profile } = useAuthStore();
  const [inputName, setInputName] = useState('');
  const [category, setCategory] = useState('seeds');
  const [description, setDescription] = useState('');
  const [priceNgn, setPriceNgn] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertErr } = await supabase.from('farm_input_listings').insert({
        seller_id: profile.id,
        input_name: inputName.trim(),
        category,
        description: description.trim(),
        price_ngn: parseFloat(priceNgn) || 0,
        quantity_available: parseFloat(quantity) || 1,
        unit,
        photo_url: photoUrl || null,
        region: profile.macro_region || 'Ibadan Central Hub',
        status: 'available',
      });

      if (insertErr) throw new Error(insertErr.message);

      setSuccess('Farm input listed successfully on the marketplace!');
      setInputName('');
      setDescription('');
      setPriceNgn('');
      setQuantity('');
      setPhotoUrl('');
      onCreated();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Listing creation error:', err);
      setError(err.message || 'Failed to create input listing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 border border-border space-y-4">
      <div className="flex items-center gap-3 border-b border-border/60 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-agri-primary/10 text-agri-primary-light">
          <Package size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">List Farm Input for Sale</h3>
          <p className="text-xs text-foreground-dim">Supply seeds, fertilizers, or tools to verified farmers</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="label">Product / Input Name</label>
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="e.g. Improved Hybrid Maize Seed (DTMA-10)"
            className="input"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input py-2"
            >
              <option value="seeds">Seeds & Seedlings</option>
              <option value="fertilizer">Fertilizer & Soil Boosters</option>
              <option value="pesticide">Pesticides & Herbicides</option>
              <option value="equipment">Tools & Equipment</option>
              <option value="other">Other Agricultural Supplies</option>
            </select>
          </div>
          <div>
            <label className="label">Unit of Measure</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="input py-2"
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="bags">Bags (50kg / 25kg)</option>
              <option value="litres">Litres (L)</option>
              <option value="pieces">Pieces / Units</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Price per Unit (₦ NGN)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={priceNgn}
              onChange={(e) => setPriceNgn(e.target.value)}
              placeholder="e.g. 15000"
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Quantity Available</label>
            <input
              type="number"
              min="1"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              className="input"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Description & Application Notes</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide planting guidelines or product specifications..."
            className="input py-2 resize-none"
          />
        </div>

        <CameraCapture
          bucketName="harvest-photos"
          onCapture={(url) => setPhotoUrl(url)}
          existingUrl={photoUrl}
          label="Product Verification Photo"
        />

        <button
          type="submit"
          disabled={loading || !inputName.trim() || !priceNgn}
          className="btn btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={15} /> Publish Input to Marketplace</>}
        </button>
      </form>
    </div>
  );
}
