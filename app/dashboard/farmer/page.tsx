'use client';

import { useAuthStore } from '@/store/authStore';
import HarvestForm from '@/components/farmer/HarvestForm';
import ActiveLogs from '@/components/farmer/ActiveLogs';
import IoTReadout from '@/components/farmer/IoTReadout';
import DeviceRegistrationToggle from '@/components/farmer/DeviceRegistrationToggle';
import { Wheat } from 'lucide-react';

export default function FarmerDashboard() {
  const { profile } = useAuthStore();

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-agri-primary to-agri-primary-light shadow-lg shadow-agri-primary/20">
            <Wheat size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {profile?.full_name || 'Farmer & Trader'}
            </h1>
            <p className="text-sm text-foreground-muted">
              Manage farm telemetry, register sensors, and create live trade requests
            </p>
          </div>
        </div>
      </div>

      {/* IoT Farm Device Registration Toggle Card */}
      <DeviceRegistrationToggle />

      {/* Live IoT Sensor Telemetry Readout & Readiness Alerts */}
      <div className="card p-5 border border-border">
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
    </div>
  );
}
