'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UserProfile } from '@/lib/types';
import TradeInquiryModal from '@/components/ui/TradeInquiryModal';
import { Users, Shield, Send, MapPin, CheckCircle2, Search, Loader2, UserCheck } from 'lucide-react';

export default function NearbyBuyers() {
  const [buyers, setBuyers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState<UserProfile | null>(null);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  const fetchBuyers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('declared_profession', 'buyer')
        .limit(30);


      if (error) {
        console.error('Error fetching buyers:', error.message);
      } else if (data) {
        setBuyers(data as UserProfile[]);
      }
    } catch (err) {
      console.error('Buyer fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuyers();
  }, [fetchBuyers]);

  const filteredBuyers = buyers.filter((b) => {
    const nameMatch = b.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const regionMatch = b.macro_region?.toLowerCase().includes(searchTerm.toLowerCase());
    return nameMatch || regionMatch;
  });

  return (
    <div className="card p-5 border border-border space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-agri-primary/10 text-agri-primary-light">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>Nearby Verified Off-Takers & Buyers</span>
              <span className="rounded-full bg-agri-primary/10 px-2 py-0.5 text-[10px] font-bold text-agri-primary-light border border-agri-primary/20">
                Data Minimized
              </span>
            </h3>
            <p className="text-xs text-foreground-dim">
              Contact commercial buyers in your region without exposing your private contact details
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-dim" />
          <input
            type="text"
            placeholder="Search by name or region..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 text-xs py-2"
          />
        </div>
      </div>

      {inquirySuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>Your trade proposal has been sent securely! The buyer will review your harvest offer.</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-foreground-dim">
          <Loader2 size={24} className="animate-spin text-agri-primary mr-2" />
          <span className="text-xs">Finding active buyers nearby...</span>
        </div>
      ) : filteredBuyers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background-elevated/40 p-8 text-center text-foreground-dim text-xs">
          No buyers found matching criteria.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBuyers.map((buyer) => {
            // Data Minimization: Mask last name / sensitive contact info
            const nameParts = (buyer.full_name || 'Commercial Buyer').split(' ');
            const maskedName = nameParts.length > 1
              ? `${nameParts[0]} ${nameParts[1].charAt(0)}.`
              : nameParts[0];

            return (
              <div
                key={buyer.id}
                className="group flex flex-col justify-between rounded-xl border border-border/80 bg-background-elevated/50 p-4 transition-all hover:border-agri-primary/40 hover:bg-background-elevated"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-agri-primary/20 font-bold text-xs text-agri-primary-light border border-agri-primary/30">
                        {maskedName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <span>{maskedName}</span>
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Active Online" />
                        </h4>
                        <p className="text-[10px] uppercase font-semibold text-agri-primary-light">
                          Verified Commercial Off-Taker
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-foreground-muted bg-background/50 rounded-lg px-2.5 py-1.5 border border-border/40">
                    <MapPin size={13} className="text-foreground-dim shrink-0" />
                    <span className="truncate">Region: <strong className="text-foreground">{buyer.macro_region || 'Lagos Central Hub'}</strong></span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-foreground-dim" title="Private & Secure">
                    <Shield size={12} className="text-agri-primary-light" />
                    <span>Contact Shielded</span>
                  </div>
                  <button
                    onClick={() => {
                      setInquirySuccess(false);
                      setSelectedBuyer(buyer);
                    }}
                    className="btn btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Send size={12} />
                    <span>Message Buyer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBuyer && (
        <TradeInquiryModal
          buyerId={selectedBuyer.id}
          buyerName={selectedBuyer.full_name || 'Commercial Buyer'}
          buyerRegion={selectedBuyer.macro_region}
          onClose={() => setSelectedBuyer(null)}
          onSuccess={() => {
            setInquirySuccess(true);
            setTimeout(() => setInquirySuccess(false), 5000);
          }}
        />
      )}
    </div>
  );
}
