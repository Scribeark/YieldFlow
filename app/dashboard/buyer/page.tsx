'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, ClipboardList, Map, Truck } from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';

export default function BuyerDashboard() {
  const { profile } = useAuthStore();

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
          Welcome, {profile?.full_name || 'Buyer'}
        </h1>
        <p className="mt-2 text-lg" style={{ color: 'var(--foreground-muted)' }}>
          Role: {profile?.declared_profession}
        </p>
      </div>

      {/* Primary Action */}
      <Card className="mb-8 p-8 flex flex-col md:flex-row items-center justify-between" style={{ backgroundColor: 'var(--agri-primary-light)', color: 'white' }}>
        <div className="mb-4 md:mb-0">
          <h2 className="text-2xl font-bold mb-2">Purchase Verified Harvests</h2>
          <p className="opacity-90 max-w-xl">
            Browse trade requests submitted directly by farmers and commodity traders. All listings require authentic photo evidence.
          </p>
        </div>
        <Link href="/dashboard/buyer/buy">
          <Button variant="secondary" className="px-8 py-6 text-lg shadow-lg">
            <ShoppingCart className="mr-2 h-6 w-6" /> Buy Now
          </Button>
        </Link>
      </Card>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Post Demand Link */}
        <Link href="/dashboard/buyer/demands/new" className="block h-full">
          <Card className="h-full p-6 hover:shadow-lg transition-shadow flex items-start cursor-pointer border border-agri-primary/20 bg-agri-primary/5">
            <div className="p-3 rounded-full mr-4 bg-agri-primary/20 text-agri-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2 text-agri-primary">Post Demand</h3>
              <p style={{ color: 'var(--foreground-muted)' }}>
                Request a specific commodity and let verified sellers respond with available harvests.
              </p>
            </div>
          </Card>
        </Link>

        {/* My Demands Link */}
        <Link href="/dashboard/buyer/demands" className="block h-full">
          <Card className="h-full p-6 hover:shadow-lg transition-shadow flex items-start cursor-pointer border border-amber-500/20 bg-amber-500/5">
            <div className="p-3 rounded-full mr-4 bg-amber-100 text-amber-600">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2 text-amber-600">My Demand Requests</h3>
              <p style={{ color: 'var(--foreground-muted)' }}>
                View your active demands and see sellers who have responded with harvest evidence.
              </p>
            </div>
          </Card>
        </Link>

        {/* Orders Link */}
        <Link href="/dashboard/buyer/orders" className="block h-full">
          <Card className="h-full p-6 hover:shadow-lg transition-shadow flex items-start cursor-pointer">
            <div className="p-3 rounded-full mr-4 bg-blue-100 text-blue-600">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>My Claimed Orders</h3>
              <p style={{ color: 'var(--foreground-muted)' }}>
                View the history and status of trade requests you have successfully claimed.
              </p>
            </div>
          </Card>
        </Link>

        {/* Sellers Map Link */}
        <Link href="/dashboard/buyer/sellers-map" className="block h-full">
          <Card className="h-full p-6 hover:shadow-lg transition-shadow flex items-start cursor-pointer">
            <div className="p-3 rounded-full mr-4 bg-purple-100 text-purple-600">
              <Map className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Sellers Map</h3>
              <p style={{ color: 'var(--foreground-muted)' }}>
                Geospatial view of active harvest listings across regions. (Pending Phase)
              </p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Logistics Note */}
      <Card className="p-6 flex items-start bg-black/5 border-l-4 border-l-blue-500">
        <Truck className="h-6 w-6 mr-4 text-blue-500 flex-shrink-0 mt-1" />
        <div>
          <h4 className="font-bold mb-1" style={{ color: 'var(--foreground)' }}>Logistics Process</h4>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Note: Fleet assignment and logistics tracking only begins <strong>after</strong> you confirm a trade request. Carrier tracking will unlock in the next phase.
          </p>
        </div>
      </Card>
    </PageContainer>
  );
}
