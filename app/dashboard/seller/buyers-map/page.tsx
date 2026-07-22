'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/PageContainer';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { Button } from '@/components/ui/Button';

export default function BuyersMapPlaceholder() {
  const router = useRouter();
  return (
    <PageContainer>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          ← Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Buyers Map</h1>
      </div>
      
      <DashboardCard 
        title="Under Construction" 
        description="The real-time Buyers Map and spatial query features are currently under construction. They will be integrated in a future sprint once Google Maps setup is complete."
      />
    </PageContainer>
  );
}
