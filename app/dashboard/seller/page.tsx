'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { PageContainer } from '@/components/ui/PageContainer';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

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

      <div className="mb-8">
        <Link href="/dashboard/seller/sell">
          <Button size="lg" className="w-full sm:w-auto shadow-md">
            Sell Harvest
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Link href="/dashboard/seller/requests" className="block h-full">
          <DashboardCard 
            title="My Requests" 
            description="View and track your submitted trade requests."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer"
          />
        </Link>

        <Link href="/dashboard/seller/buyers-map" className="block h-full">
          <DashboardCard 
            title="Buyers Map" 
            description="[Placeholder] Map features are currently under construction and will be deployed in a future phase."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer opacity-80"
          />
        </Link>

        <Link href="/dashboard/seller/buyer-demands" className="block h-full">
          <DashboardCard 
            title="Active Buyer Demands" 
            description="View incoming requests from buyers and provide your harvest directly."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer border-agri-primary bg-agri-primary/5"
          />
        </Link>

        <Link href="/dashboard/seller/device-readings" className="block h-full">
          <DashboardCard 
            title="Device Readings" 
            description="[Placeholder] IoT integration is currently under construction."
            className="h-full hover:-translate-y-1 transition-transform cursor-pointer opacity-80"
          />
        </Link>
      </div>
      
      <Alert variant="info">
        Note: The Farm Inputs Marketplace is currently unavailable as the `farm_input_listings` and `trade_inquiries` infrastructure is not yet live.
      </Alert>
    </PageContainer>
  );
}
