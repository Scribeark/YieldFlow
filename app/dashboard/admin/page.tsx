'use client';

import React from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { ShieldCheck, Users, Activity, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function AdminDashboardPage() {
  const router = useRouter();

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center">
          <ShieldCheck className="mr-3 text-[var(--agri-primary)]" size={32} /> 
          Platform Governance
        </h1>
        <p className="opacity-70 mt-2">Manage users, view system analytics, and configure platform settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:border-white/30 transition-all cursor-pointer" onClick={() => router.push('/dashboard/admin/users')}>
          <Users size={32} className="text-blue-400 mb-4" />
          <h2 className="text-xl font-bold mb-2">User Management</h2>
          <p className="opacity-70 text-sm mb-4">View platform users, verify roles, and manage administrator access.</p>
          <Button variant="outline" className="w-full">Manage Users</Button>
        </Card>

        <Card className="hover:border-white/30 transition-all cursor-pointer" onClick={() => router.push('/dashboard/dev/iot-simulator')}>
          <Activity size={32} className="text-green-400 mb-4" />
          <h2 className="text-xl font-bold mb-2">IoT Simulator</h2>
          <p className="opacity-70 text-sm mb-4">Generate test farm data and telemetry for system validation.</p>
          <Button variant="outline" className="w-full">Open Simulator</Button>
        </Card>

        <Card className="opacity-50">
          <Settings size={32} className="text-gray-400 mb-4" />
          <h2 className="text-xl font-bold mb-2">Platform Settings</h2>
          <p className="opacity-70 text-sm mb-4">Configure global variables and readiness engine thresholds.</p>
          <Button variant="outline" className="w-full" disabled>Coming Soon</Button>
        </Card>
      </div>
    </PageContainer>
  );
}
