'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import AvailableHarvests from '@/components/carrier/AvailableHarvests';
import FleetBookings from '@/components/carrier/FleetBookings';
import VehicleRegistry from '@/components/carrier/VehicleRegistry';
import { Truck, Package, ClipboardList, Radio } from 'lucide-react';

type Tab = 'fleet' | 'available' | 'bookings';

export default function CarrierDashboard() {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('fleet');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'fleet', label: 'My Vehicles & Fleet Status', icon: <Radio size={16} /> },
    { id: 'available', label: 'Available Load Board', icon: <Package size={16} /> },
    { id: 'bookings', label: 'Active Transit Bookings', icon: <ClipboardList size={16} /> },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-status-in-transit to-blue-400 shadow-lg shadow-status-in-transit/20">
            <Truck size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {profile?.full_name || 'Carrier Fleet Operator'}
            </h1>
            <p className="text-sm text-foreground-muted">
              Manage multi-vehicle registry, live fleet availability (`available`, `busy`, `offline`), and dispatch loads
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'border-agri-primary text-agri-primary-light'
                : 'border-transparent text-foreground-muted hover:text-foreground'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'fleet' ? (
        <VehicleRegistry />
      ) : activeTab === 'available' ? (
        <AvailableHarvests />
      ) : (
        <FleetBookings />
      )}
    </div>
  );
}
