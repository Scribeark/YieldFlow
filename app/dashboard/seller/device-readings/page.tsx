'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/PageContainer';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { Button } from '@/components/ui/Button';

export default function DeviceReadingsPlaceholder() {
  const router = useRouter();
  return (
    <PageContainer>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          ← Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Device Readings</h1>
      </div>
      
      <DashboardCard 
        title="Under Construction" 
        description="IoT sensor telemetry integration is currently under construction. Future updates will display live soil moisture and temperature readings here."
      />
    </PageContainer>
  );
}
