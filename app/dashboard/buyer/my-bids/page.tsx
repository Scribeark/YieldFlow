'use client';

import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getMyBids } from '@/lib/api/buyer';
import { HandCoins, MapPin, Loader2, CalendarDays, Activity } from 'lucide-react';

export default function BuyerMyBidsPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) loadBids();
  }, [user]);

  const loadBids = async () => {
    setLoading(true);
    const { data, error: apiError } = await getMyBids(supabase, user!.id);
    if (apiError) {
      setError('Failed to load your bids.');
    } else {
      setBids(data || []);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'text-green-400 bg-green-500/20';
      case 'REJECTED': return 'text-red-400 bg-red-500/20';
      case 'PENDING': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>My Bids</h1>
        <p className="opacity-70 mt-1">Track the status of your active and historical harvest bids.</p>
      </div>

      {error && <Alert variant="error" title="Error" className="mb-6">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[var(--agri-primary)]" size={32} /></div>
      ) : bids.length === 0 ? (
        <Alert variant="info" title="No Bids Found">
          You have not placed any bids on harvest opportunities yet.
        </Alert>
      ) : (
        <div className="space-y-4">
          {bids.map((bid) => {
            const opp = bid.harvest_predictions;
            if (!opp) return null; // Defensive check

            return (
              <Card key={bid.id} className="border-l-4 border-l-[var(--agri-primary)] hover:border-white/30 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Left block: Opportunity Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wider ${getStatusColor(bid.bid_status)}`}>
                        {bid.bid_status}
                      </span>
                      <span className="text-xs opacity-60 flex items-center">
                        <CalendarDays size={12} className="mr-1" /> {new Date(bid.created_at).toLocaleDateString()}
                      </span>
                      {opp.bidding_origin === 'MANUAL' ? (
                        <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">Manual</span>
                      ) : (
                        <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center"><Activity size={12} className="mr-1" /> IoT</span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold mb-1">
                      {opp.farms?.crop_type || 'Unknown Crop'}
                    </h3>
                    <div className="text-sm opacity-80 flex items-center">
                      <MapPin size={14} className="mr-1" /> {opp.farms?.physical_address || 'Location hidden'}
                    </div>
                  </div>

                  {/* Middle block: Bid Details */}
                  <div className="bg-black/20 p-4 rounded-lg flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs opacity-60 mb-1">Your Bid Quantity</div>
                        <div className="font-bold text-lg">{bid.bid_quantity} {opp.expected_quantity_unit}</div>
                      </div>
                      <div>
                        <div className="text-xs opacity-60 mb-1">Your Price / Unit</div>
                        <div className="font-bold text-lg text-yellow-400">₦{bid.bid_price_per_unit.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                      <span className="text-xs opacity-60">Total Value</span>
                      <span className="font-bold">₦{(bid.bid_quantity * bid.bid_price_per_unit).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Right block: Actions */}
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {bid.bid_status === 'PENDING' && (
                      <Button variant="ghost" className="text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full" onClick={() => alert('Withdraw flow coming soon!')}>
                        Withdraw Bid
                      </Button>
                    )}
                    {bid.bid_status === 'ACCEPTED' && (
                      <Button variant="primary" className="w-full" onClick={() => alert('Proceed to order coming soon!')}>
                        View Order
                      </Button>
                    )}
                  </div>

                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
