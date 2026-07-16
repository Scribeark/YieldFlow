'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Store, Search, Filter, Loader2, Tag, MapPin, CheckCircle2, ShoppingBag } from 'lucide-react';

export interface FarmInputListing {
  id: string;
  seller_id?: string;
  input_name: string;
  category: string;
  description?: string;
  price_ngn: number;
  quantity_available: number;
  unit?: string;
  photo_url?: string | null;
  region?: string;
  status?: string;
  created_at?: string;
}

export default function InputListings({ refreshKey = 0 }: { refreshKey?: number }) {
  const [listings, setListings] = useState<FarmInputListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('farm_input_listings')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching input listings:', error.message);
      } else if (data) {
        setListings(data as FarmInputListing[]);
      }
    } catch (err) {
      console.error('Listings error:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, refreshKey]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const filteredListings = listings.filter((l) =>
    l.input_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.description && l.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleBuyRequest = (listing: FarmInputListing) => {
    setOrderSuccess(`Order request sent for "${listing.input_name}"! The supplier will coordinate direct delivery.`);
    setTimeout(() => setOrderSuccess(null), 5000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
          <input
            type="text"
            placeholder="Search inputs by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 text-xs py-2"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter size={14} className="text-foreground-dim shrink-0" />
          {['all', 'seeds', 'fertilizer', 'pesticide', 'equipment'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-agri-primary text-white shadow-sm'
                  : 'bg-background-elevated text-foreground-muted hover:text-foreground border border-border/60'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {orderSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{orderSuccess}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-foreground-dim">
          <Loader2 size={24} className="animate-spin text-agri-primary mr-2" />
          <span className="text-xs">Loading marketplace supplies...</span>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background-elevated/40 p-12 text-center text-foreground-dim text-xs space-y-2">
          <Store size={28} className="mx-auto text-foreground-dim opacity-50" />
          <p>No agricultural inputs currently listed in this category.</p>
          <p className="text-[11px] text-foreground-muted">Suppliers can publish listings using the form above.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-background-card overflow-hidden transition-all hover:border-agri-primary/40 hover:shadow-md"
            >
              <div>
                {/* Photo Header */}
                <div className="h-44 w-full bg-background-elevated relative overflow-hidden">
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={item.input_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-foreground-dim">
                      <Store size={32} className="opacity-30 mb-1" />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">Standard Verified Supply</span>
                    </div>
                  )}
                  <span className="absolute top-2.5 left-2.5 rounded-md bg-black/70 backdrop-blur-md px-2 py-1 text-[10px] font-bold text-agri-primary-light uppercase border border-white/10">
                    {item.category}
                  </span>
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-foreground leading-snug">{item.input_name}</h4>
                  </div>

                  <p className="text-xs text-foreground-muted line-clamp-2">
                    {item.description || 'Verified agricultural input ready for localized farm distribution and planting.'}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-foreground-dim flex items-center gap-1">
                      <MapPin size={12} className="text-agri-primary-light" />
                      <span>{item.region || 'Ibadan Central Hub'}</span>
                    </span>
                    <span className="font-semibold text-foreground bg-background-elevated px-2 py-0.5 rounded border border-border/40">
                      {item.quantity_available} {item.unit || 'kg'} left
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-2 border-t border-border/40 bg-background/30 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-foreground-dim block">Price per {item.unit || 'kg'}</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    ₦{item.price_ngn.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleBuyRequest(item)}
                  className="btn btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <ShoppingBag size={14} />
                  <span>Order Input</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
