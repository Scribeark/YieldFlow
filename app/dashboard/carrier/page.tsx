'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import AvailableHarvests from '@/components/carrier/AvailableHarvests';
import FleetBookings from '@/components/carrier/FleetBookings';
import VehicleRegistry from '@/components/carrier/VehicleRegistry';
import RouteOptimizer from '@/components/carrier/RouteOptimizer';
import { Truck, Package, ClipboardList, Radio, Compass, Zap } from 'lucide-react';

type Tab = 'route' | 'fleet' | 'available' | 'bookings';

export default function CarrierDashboard() {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('route');

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'route', label: 'AI Route & GPS Tracking', icon: <Compass size={16} className="text-blue-400" />, badge: 'Live GPS' },
    { id: 'fleet', label: 'My Vehicles & Fleet Registry', icon: <Radio size={16} className="text-emerald-400" /> },
    { id: 'available', label: 'Available Load Board', icon: <Package size={16} className="text-amber-400" /> },
    { id: 'bookings', label: 'Active Transit Bookings', icon: <ClipboardList size={16} className="text-purple-400" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Vibrant Header Banner with Agricultural / Highway Backdrop */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-blue-950/80 via-slate-900 to-emerald-950/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
        <div className="absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-blue-500/20 blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-teal-400 p-0.5 shadow-xl shadow-blue-500/30">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950/50 backdrop-blur-md">
                <Truck size={28} className="text-white" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-blue-300 border border-blue-500/30">
                  Carrier & Logistics Portal
                </span>
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> Real-time Telemetry
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
                Welcome, {profile?.full_name || 'Carrier Fleet Operator'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-light mt-0.5">
                Optimize carrier haulage routes, simulate live GPS dispatch coordinates, and accept verified harvest loads.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs inside Header */}
        <div className="mt-8 flex gap-2 border-t border-white/10 pt-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap
                ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white shadow-lg shadow-blue-500/30 border border-blue-400/40'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-white/5'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="transition-all">
        {activeTab === 'route' ? (
          <RouteOptimizer />
        ) : activeTab === 'fleet' ? (
          <VehicleRegistry />
        ) : activeTab === 'available' ? (
          <AvailableHarvests />
        ) : (
          <FleetBookings />
        )}
      </div>
    </div>
  );
}
