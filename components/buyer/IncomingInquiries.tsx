'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { Inbox, CheckCircle2, MessageSquare, Clock, ShieldAlert, Loader2, ArrowRight } from 'lucide-react';

export interface TradeInquiry {
  id: string;
  sender_id: string;
  recipient_id: string;
  commodity: string;
  quantity_kg: number;
  message: string;
  status: string;
  created_at: string;
  users?: {
    full_name: string;
    macro_region: string;
  };
}

export default function IncomingInquiries() {
  const { profile } = useAuthStore();
  const [inquiries, setInquiries] = useState<TradeInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchInquiries = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trade_inquiries')
        .select('*, users:sender_id(full_name, macro_region)')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching inquiries:', error.message);
      } else if (data) {
        setInquiries(data as unknown as TradeInquiry[]);
      }
    } catch (err) {
      console.error('Inquiry error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleRespond = async (inquiry: TradeInquiry, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('trade_inquiries')
        .update({ status: newStatus })
        .eq('id', inquiry.id);

      if (error) throw new Error(error.message);

      setActionSuccess(`Inquiry marked as "${newStatus}". A formal trade request can now be verified.`);
      fetchInquiries();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error updating status:', err);
    }
  };

  if (!profile) return null;

  return (
    <div className="card p-5 border border-border space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Inbox size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>Incoming Farmer Trade Proposals</span>
              {inquiries.filter(i => i.status === 'pending').length > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-black">
                  {inquiries.filter(i => i.status === 'pending').length} New
                </span>
              )}
            </h3>
            <p className="text-xs text-foreground-dim">Direct data-minimized proposals sent from localized farmers</p>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-foreground-dim text-xs">
          <Loader2 size={20} className="animate-spin text-agri-primary mr-2" />
          <span>Loading incoming proposals...</span>
        </div>
      ) : inquiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background-elevated/30 p-8 text-center text-foreground-dim text-xs">
          No incoming trade proposals at this time. Farmers in your region can send proposals directly from their portal.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {inquiries.map((inquiry) => {
            const senderName = inquiry.users?.full_name || 'Verified Local Farmer';
            const senderRegion = inquiry.users?.macro_region || 'Ibadan Central Region';

            return (
              <div
                key={inquiry.id}
                className="rounded-xl border border-border bg-background-elevated/40 p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-agri-primary-light block">
                        Proposal from {senderRegion}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">{inquiry.commodity}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      inquiry.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {inquiry.status}
                    </span>
                  </div>

                  <p className="text-xs text-foreground-muted bg-background/60 p-2.5 rounded-lg border border-border/40 italic">
                    &ldquo;{inquiry.message}&rdquo;
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-foreground-dim">Offered Volume:</span>
                    <span className="font-extrabold text-foreground">{inquiry.quantity_kg.toLocaleString()} kg</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-foreground-dim flex items-center gap-1">
                    <Clock size={11} /> {new Date(inquiry.created_at).toLocaleDateString()}
                  </span>
                  {inquiry.status === 'pending' && (
                    <button
                      onClick={() => handleRespond(inquiry, 'accepted')}
                      className="btn btn-primary px-3 py-1.5 text-xs flex items-center gap-1 shadow-sm"
                    >
                      <span>Accept Negotiation</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
