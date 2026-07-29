'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { PageContainer } from '@/components/ui/PageContainer';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { Button } from '@/components/ui/Button';

export default function SellerDashboard() {
  const { profile } = useAuthStore();

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Seller Dashboard</h1>
        {profile && (
          <p className="text-lg" style={{ color: 'var(--foreground-muted)' }}>
            Welcome back, <span className="font-semibold" style={{ color: 'var(--agri-primary-light)' }}>{profile.full_name}</span> ({profile.declared_profession})
          </p>
        )}
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/dashboard/seller/sell">
          <Button size="lg" className="shadow-md">+ Create Listing</Button>
        </Link>
        <Link href="/dashboard/seller/bids">
          <Button size="lg" variant="secondary">Manage Bids</Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/seller/requests" className="block h-full">
          <DashboardCard
            title="My Requests"
            description="View and track your active trade requests. Upload evidence and manage ongoing orders."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer"
          />
        </Link>

        <Link href="/dashboard/seller/bids" className="block h-full">
          <DashboardCard
            title="Bid Management"
            description="Review buyer bids on your harvest opportunities. Accept, partially accept, or reject bids."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer"
          />
        </Link>

        <Link href="/dashboard/seller/buyer-demands" className="block h-full">
          <DashboardCard
            title="Active Buyer Demands"
            description="View incoming requests from buyers and respond with your available harvest supply."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer"
          />
        </Link>

        <Link href="/dashboard/seller/device-readings" className="block h-full">
          <DashboardCard
            title="Farm & IoT Devices"
            description="Register farms, connect IoT sensors, monitor crop readiness scores, and track telemetry readings."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer"
          />
        </Link>

        <Link href="/dashboard/seller/buyers-map" className="block h-full">
          <DashboardCard
            title="Buyers Map"
            description="View buyer locations and active demand zones on the map."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer"
          />
        </Link>
      </div>
    </PageContainer>
  );
}
