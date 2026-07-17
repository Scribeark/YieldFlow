'use client';

import { useAuthStore } from '@/store/authStore';
import HarvestForm from '@/components/farmer/HarvestForm';
import ActiveLogs from '@/components/farmer/ActiveLogs';
import IoTReadout from '@/components/farmer/IoTReadout';
import DeviceRegistrationToggle from '@/components/farmer/DeviceRegistrationToggle';
import NearbyBuyers from '@/components/farmer/NearbyBuyers';
import { Wheat, Sprout, Sparkles, Activity } from 'lucide-react';

export default function FarmerDashboard() {
  const { profile } = useAuthStore();

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Vibrant Agricultural Header Banner with Hero Visual Backdrop */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-72 w-72 rounded-full bg-emerald-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute right-1/3 bottom-0 -mb-16 h-64 w-64 rounded-full bg-amber-500/15 blur-[90px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 p-0.5 shadow-xl shadow-emerald-500/30">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950/50 backdrop-blur-md">
                <Wheat size={28} className="text-amber-300 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 border border-emerald-500/30">
                  Farmer & Trader Portal
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-300">
                  <Sparkles size={13} /> Multi-Commodity Ready
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
                Welcome, {profile?.full_name || 'Farmer Operator'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-light mt-0.5">
                Monitor real-time soil telemetry, log verified harvest inspections with PWA rear camera, and connect with direct off-takers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* IoT Farm Device Registration Toggle Card */}
      <DeviceRegistrationToggle />

      {/* Live IoT Sensor Telemetry Readout & Readiness Alerts */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur-xl shadow-xl">
        <IoTReadout />
      </div>

      {/* Middle Row: Dual Telemetry/Trade Form & Active Trade Offers Table */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <HarvestForm />
        </div>
        <div className="lg:col-span-2">
          <ActiveLogs />
        </div>
      </div>

      {/* Bottom Row: Nearby Verified Buyers with Data Minimization */}
      <NearbyBuyers />
    </div>
  );
}
