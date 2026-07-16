'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { Send, Loader2, X, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';

interface TradeInquiryModalProps {
  buyerId: string;
  buyerName: string;
  buyerRegion?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TradeInquiryModal({
  buyerId,
  buyerName,
  buyerRegion,
  onClose,
  onSuccess,
}: TradeInquiryModalProps) {
  const { profile } = useAuthStore();
  const [commodity, setCommodity] = useState('Cassava Tubers (Yellow Variety)');
  const [quantityKg, setQuantityKg] = useState('1000');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError(null);

    try {
      const { error: insertErr } = await supabase.from('trade_inquiries').insert({
        sender_id: profile.id,
        recipient_id: buyerId,
        commodity: commodity.trim(),
        quantity_kg: parseFloat(quantityKg) || 0,
        message: message.trim() || `I have ${quantityKg}kg of ${commodity} ready for inspection in ${profile.macro_region || 'Ibadan Central Region'}.`,
        status: 'pending',
      });

      if (insertErr) throw new Error(insertErr.message);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Inquiry error:', err);
      setError(err.message || 'Failed to send inquiry to buyer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="card max-w-md w-full p-6 relative border border-agri-primary/30 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-foreground-dim hover:bg-background-elevated hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-agri-primary/10 text-agri-primary-light">
            <Send size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Send Trade Inquiry</h3>
            <p className="text-xs text-foreground-dim">To: <span className="text-foreground font-semibold">{buyerName}</span> {buyerRegion ? `(${buyerRegion})` : ''}</p>
          </div>
        </div>

        {/* Data Minimization Notice */}
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-agri-primary/20 bg-agri-primary/5 p-3 text-xs text-foreground-muted">
          <ShieldAlert size={16} className="mt-0.5 text-agri-primary-light shrink-0" />
          <p>
            <strong className="text-foreground">Data Minimization Active:</strong> Your phone number and exact farm coordinates remain private. The buyer will receive your inquiry and can initiate verified trade negotiation through the platform.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="label">Commodity Variety</label>
            <input
              type="text"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Available Volume (in kg)</label>
            <input
              type="number"
              min="1"
              step="any"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Message / Delivery Notes</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`I have ${quantityKg || '1000'}kg of ready crops available. Let me know if you are interested.`}
              className="input py-2.5 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1 text-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !commodity.trim() || !quantityKg}
              className="btn btn-primary flex-1 text-sm flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Send size={15} /> Send Trade Proposal</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
