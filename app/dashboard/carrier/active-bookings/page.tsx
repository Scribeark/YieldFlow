'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import ActiveBookings from '@/components/carrier/ActiveBookings';

export default function ActiveBookingsPage() {
  return (
    <PageContainer>
      <div className="grid gap-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Active Bookings</h1>
        <p className="opacity-80">View the logistics jobs you have accepted and are currently handling.</p>
        
        <ActiveBookings />
      </div>
    </PageContainer>
  );
}
