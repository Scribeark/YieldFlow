'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { getHarvestOpportunities } from '@/lib/api/buyer';
import { HarvestBidModal } from '@/components/buyer/HarvestBidModal';
import {
  Sprout, MapPin, Loader2, ArrowRight, Layers,
  CheckCircle, RefreshCw, Calendar, Lock,
} from 'lucide-react';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function canBidNow(opp: any): { ok: boolean; reason?: string } {
  if (['CANCELLED', 'CLOSED', 'CONVERTED_TO_TRADE'].includes(opp.bidding_status)) {
    return { ok: false, reason: `This sale is ${opp.bidding_status.replace(/_/g, ' ').toLowerCase()}.` };
  }
  return { ok: true };
}

function HarvestTimelineRow({ opp }: { opp: any }) {
  const { seller_maturity_at, seller_note } = opp;
  if (!seller_maturity_at && !seller_note) return null;

  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5 text-xs">
      <div className="font-bold uppercase tracking-wider opacity-50 flex items-center gap-1 mb-1">
        <Calendar size={11} /> Harvest Information
      </div>
      {seller_maturity_at && (
        <div className="flex items-center gap-1.5 opacity-80">
          <Calendar size={10} className="flex-shrink-0" />
          <span className="opacity-60">Expected Harvest:</span>
          <span className="font-medium">{fmtDate(seller_maturity_at)}</span>
        </div>
      )}
      {seller_note && (
        <div className="pt-1 text-xs opacity-70 italic">
          {seller_note}
        </div>
      )}
    </div>
  );
}

export default function BuyerHarvestOpportunitiesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');

  const [selectedOpportunity, setSelectedOpportunity] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => { loadOpportunities(); }, []);

  const loadOpportunities = async () => {
    setLoading(true);
    setError('');
    const { data, error: apiError } = await getHarvestOpportunities(supabase);
    if (apiError) setError('Failed to load harvest opportunities: ' + (apiError.message || JSON.stringify(apiError)));
    else setOpportunities(data || []);
    setLoading(false);
  };

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Upcoming Harvests</h1>
          <p className="opacity-70 mt-1">Browse seller-listed harvest opportunities open for bidding.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadOpportunities} disabled={loading}>
          <RefreshCw size={14} className="mr-1" /> Refresh
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {bidSuccess && (
        <Alert variant="success" className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span><CheckCircle size={16} className="inline mr-2" />{bidSuccess}</span>
            <Link href="/dashboard/buyer/my-bids">
              <Button size="sm" variant="secondary">View My Bids →</Button>
            </Link>
          </div>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[var(--agri-primary)]" size={32} /></div>
      ) : opportunities.length === 0 ? (
        <Alert variant="info">
          There are currently no harvest opportunities open for bidding. Please check back later.
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {opportunities.map((opp) => {
            const bidCheck = canBidNow(opp);
            return (
              <Card key={opp.id} className="flex flex-col h-full border-t-4 border-t-[var(--agri-primary)] hover:shadow-lg hover:shadow-[var(--agri-primary)]/10 transition-all">
                <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                  <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center">
                    <Layers size={11} className="mr-1" /> Bulk Bidding Sale
                  </span>
                  <span className="text-xs opacity-60 flex items-center">
                    <Calendar size={12} className="mr-1" /> Listed {new Date(opp.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-1 flex items-center">
                  <Sprout className="mr-2 text-[var(--agri-primary)]" />
                  {opp.crop_type || 'Unknown Crop'}
                </h3>

                <div className="text-sm font-medium flex items-center mb-4 text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                  <MapPin size={15} className="mr-1.5 flex-shrink-0 text-emerald-400" />
                  <span className="truncate">{opp.pickup_address || (opp.seller_name ? `Farm in Nigeria (by ${opp.seller_name})` : 'Location Specified by Seller')}</span>
                </div>

                <div className="bg-black/20 p-4 rounded-lg mb-4 flex-grow">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs opacity-60 mb-1">Listed Quantity</div>
                      <div className="font-bold text-lg">
                        {opp.expected_quantity_min && opp.expected_quantity_max
                          ? `${opp.expected_quantity_min} – ${opp.expected_quantity_max}`
                          : opp.expected_quantity_volume}
                        {' '}<span className="text-sm opacity-70">{opp.expected_quantity_unit}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60 mb-1">Asking / {opp.expected_quantity_unit}</div>
                      <div className="font-bold text-lg text-yellow-400">
                        {opp.asking_price_per_unit
                          ? `₦${Number(opp.asking_price_per_unit).toLocaleString()}`
                          : opp.minimum_price_per_unit
                            ? `₦${Number(opp.minimum_price_per_unit).toLocaleString()}`
                            : 'Negotiable'}
                      </div>
                    </div>
                  </div>

                  <HarvestTimelineRow opp={opp} />
                </div>

                <div className="mt-auto">
                  {bidCheck.ok ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setBidSuccess('');
                        setSelectedOpportunity(opp);
                        setIsModalOpen(true);
                      }}
                      className="w-full"
                    >
                      Place Bid <ArrowRight size={14} className="ml-1" />
                    </Button>
                  ) : (
                    <div className="space-y-1.5">
                      <Button variant="secondary" className="w-full opacity-50 cursor-not-allowed" disabled>
                        <Lock size={14} className="mr-1" /> Bidding Closed
                      </Button>
                      <p className="text-xs text-center opacity-60">{bidCheck.reason}</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <HarvestBidModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        opportunity={selectedOpportunity}
        onSuccess={() => {
          setIsModalOpen(false);
          setBidSuccess(`Bid placed on ${selectedOpportunity?.crop_type || 'this opportunity'}! Track it in My Bids.`);
          loadOpportunities();
        }}
      />
    </PageContainer>
  );
}
