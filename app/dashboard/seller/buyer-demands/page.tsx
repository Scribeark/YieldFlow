'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Search, PlusCircle, Calendar } from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { getOpenBuyerDemands, BuyerDemandRow } from '@/lib/api/seller';

export default function BuyerDemandsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [demands, setDemands] = useState<BuyerDemandRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDemands() {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await getOpenBuyerDemands(supabase, 50);

      if (error) {
        setError(`Failed to fetch buyer demands: ${error.message}`);
      } else if (data) {
        setDemands(data);
      }
      
      setIsLoading(false);
    }
    
    fetchDemands();
  }, [supabase]);

  const handleProvideHarvest = (demandId: string, commodity: string) => {
    // Navigate to the sell page, passing the demand ID and commodity as query params
    // so the sell form can pre-fill and link them
    router.push(`/dashboard/seller/sell?demand_id=${demandId}&commodity=${encodeURIComponent(commodity)}`);
  };

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/seller')} className="mb-2">
            ← Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Open Buyer Demands</h1>
          <p className="mt-2" style={{ color: 'var(--foreground-muted)' }}>
            Enterprise Buyers are looking for these commodities. Fulfill a demand directly.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : demands.length === 0 ? (
        <Card className="text-center p-12">
          <Search className="mx-auto h-12 w-12 text-foreground-muted mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Open Demands</h3>
          <p className="text-foreground-muted mb-6">No active buyer demands are available right now.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {demands.map((demand) => (
            <Card key={demand.id} className="p-6 flex flex-col justify-between h-full border-t-4 border-agri-primary">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                      {demand.commodity_variety}
                    </h3>
                    <p className="text-xl font-medium" style={{ color: 'var(--agri-primary-light)' }}>
                      {demand.quantity_volume} units needed
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs bg-agri-primary/10 text-agri-primary rounded uppercase font-bold">
                    Open
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-foreground-muted mb-6">
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                    <span>Delivery: {demand.delivery_address}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 shrink-0" />
                    <span>Posted: {new Date(demand.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-border">
                <Button 
                  className="w-full shadow-md hover:shadow-lg transition-shadow"
                  onClick={() => handleProvideHarvest(demand.id, demand.commodity_variety)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Provide Harvest
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
