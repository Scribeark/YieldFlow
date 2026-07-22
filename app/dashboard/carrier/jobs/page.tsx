'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import AvailableJobs from '@/components/carrier/AvailableJobs';

export default function JobsPage() {
  return (
    <PageContainer>
      <div className="grid gap-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Available Logistics Jobs</h1>
        <p className="opacity-80">View and accept available harvest transport jobs near you.</p>
        
        <AvailableJobs />
      </div>
    </PageContainer>
  );
}
