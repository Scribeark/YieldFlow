'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import UserGrid from '@/components/admin/UserGrid';
import LogisticsTable from '@/components/admin/LogisticsTable';
import { ShieldCheck, Users, Wheat, Truck, BarChart3 } from 'lucide-react';
import Link from 'next/link';

type Tab = 'users' | 'logistics';

interface Stats {
  totalFarmers: number;
  totalCarriers: number;
  totalHarvests: number;
  totalBookings: number;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [stats, setStats] = useState<Stats>({ totalFarmers: 0, totalCarriers: 0, totalHarvests: 0, totalBookings: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [farmers, carriers, harvests, bookings] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'farmer'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'carrier'),
        supabase.from('harvest_logs').select('id', { count: 'exact', head: true }),
        supabase.from('logistics_bookings').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalFarmers: farmers.count || 0,
        totalCarriers: carriers.count || 0,
        totalHarvests: harvests.count || 0,
        totalBookings: bookings.count || 0,
      });
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Farmers', value: stats.totalFarmers, icon: <Wheat size={20} />, color: 'text-agri-primary-light', bg: 'bg-agri-primary/10' },
    { label: 'Carriers', value: stats.totalCarriers, icon: <Truck size={20} />, color: 'text-status-in-transit', bg: 'bg-status-in-transit/10' },
    { label: 'Harvests', value: stats.totalHarvests, icon: <BarChart3 size={20} />, color: 'text-agri-accent', bg: 'bg-agri-accent/10' },
    { label: 'Bookings', value: stats.totalBookings, icon: <Users size={20} />, color: 'text-status-matched', bg: 'bg-status-matched/10' },
  ];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: 'Users', icon: <Users size={16} /> },
    { id: 'logistics', label: 'Logistics Overview', icon: <Truck size={16} /> },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-status-matched to-blue-400 shadow-lg shadow-status-matched/20">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-foreground-muted">System governance & oversight</p>
          </div>
        </div>
        <Link href="/dashboard/admin/analytics" className="btn btn-primary btn-sm">
          <BarChart3 size={14} /> Analytics
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-foreground-dim">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'border-agri-primary text-agri-primary-light'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' ? <UserGrid /> : <LogisticsTable />}
    </div>
  );
}
