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
import { Sprout, MapPin, Loader2, ArrowRight, Activity, CalendarDays, Layers, CheckCircle, RefreshCw } from 'lucide-react';

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
    if (apiError) setError('Failed to load harvest opportunities.');
    else setOpportunities(data || []);
    setLoading(false);
  };

  const getOriginBadge = (origin: string) => {
    if (origin === 'MANUAL') {
      return (
        <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center">
          <Layers size={11} className="mr-1" /> Manual Seller Listing
        </span>
      );
    }
    return (
      <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center">
        <Activity size={12} className="mr-1" /> IoT Predicted Harvest
      </span>
    );
  };

  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Upcoming Harvests</h1>
          <p className="opacity-70 mt-1">Browse IoT-predicted and seller-listed harvest opportunities open for bidding.</p>
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
          {opportunities.map((opp) => (
            <Card key={opp.id} className="flex flex-col h-full border-t-4 border-t-[var(--agri-primary)] hover:shadow-lg hover:shadow-[var(--agri-primary)]/10 transition-all">
              <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                {getOriginBadge(opp.bidding_origin)}
                <span className="text-xs opacity-60 flex items-center">
                  <CalendarDays size={12} className="mr-1" /> {new Date(opp.created_at).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-xl font-bold mb-1 flex items-center">
                <Sprout className="mr-2 text-[var(--agri-primary)]" />
                {opp.farms?.crop_type || 'Unknown Crop'}
              </h3>

              <div className="text-sm opacity-80 flex items-center mb-4">
                <MapPin size={14} className="mr-1 flex-shrink-0" />
                {opp.farms?.physical_address || 'Address shared after bid conversion'}
              </div>

              <div className="bg-black/20 p-4 rounded-lg mb-4 flex-grow">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs opacity-60 mb-1">Expected Harvest</div>
                    <div className="font-bold text-lg">
                      {opp.expected_quantity_min && opp.expected_quantity_max 
                        ? `${opp.expected_quantity_min} - ${opp.expected_quantity_max}` 
                        : opp.expected_quantity_volume} <span className="text-sm opacity-70">{opp.expected_quantity_unit}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-60 mb-1">Min Price / {opp.expected_quantity_unit}</div>
                    <div className="font-bold text-lg text-yellow-400">
                      {opp.minimum_price_per_unit ? `₦${Number(opp.minimum_price_per_unit).toLocaleString()}` : 'Negotiable'}
                    </div>
                  </div>
                </div>

                {opp.bidding_origin !== 'MANUAL' && opp.readiness_score != null && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs opacity-60">Farm Readiness Score</span>
                      <span className="text-xs font-bold text-green-400">{Math.round(opp.readiness_score)}/100</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className="bg-green-400 h-1.5 rounded-full transition-all" style={{ width: `${opp.readiness_score}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                className="w-full mt-auto"
                onClick={() => {
                  setBidSuccess('');
                  setSelectedOpportunity(opp);
                  setIsModalOpen(true);
                }}
              >
                Place Bid <ArrowRight size={16} className="ml-2" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <HarvestBidModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        opportunity={selectedOpportunity}
        onSuccess={() => {
          setIsModalOpen(false);
          setBidSuccess(`Bid placed on ${selectedOpportunity?.farms?.crop_type || 'this opportunity'}! Track it in My Bids.`);
          loadOpportunities();
        }}
      />
    </PageContainer>
  );
}
