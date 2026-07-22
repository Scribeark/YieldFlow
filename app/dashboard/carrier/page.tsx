'use client';

import React from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/PageContainer';
import { DashboardCard } from '@/components/ui/DashboardCard';

export default function CarrierDashboard() {
  return (
    <PageContainer>
      <div className="grid gap-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Carrier Dashboard</h1>
        
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/dashboard/carrier/fleet" className="block transition hover:-translate-y-1">
            <DashboardCard 
              title="Fleet / Vehicle Registration" 
              description="Register and manage your transport assets."
            />
          </Link>
          
          <Link href="/dashboard/carrier/jobs" className="block transition hover:-translate-y-1">
            <DashboardCard 
              title="Available Logistics Jobs" 
              description="Browse and claim ready-to-move harvest loads."
            />
          </Link>

          <Link href="/dashboard/carrier/active-bookings" className="block transition hover:-translate-y-1">
            <DashboardCard 
              title="Active Bookings" 
              description="View your current accepted jobs and dispatch status."
            />
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
