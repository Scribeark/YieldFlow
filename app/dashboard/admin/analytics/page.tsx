'use client';

import { useState, useEffect } from 'react';
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getVolumeTrends, getStatusDistribution, getEnvironmentalAverages } from '@/lib/analytics';
import type { VolumeDataPoint, StatusDistribution, EnvironmentalAverage } from '@/lib/types';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { BarChart3, TrendingUp, PieChart as PieIcon, Thermometer } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  matched: '#3b82f6',
  in_transit: '#8b5cf6',
  completed: '#22c55e',
};

export default function AnalyticsPage() {
  const [volumeData, setVolumeData] = useState<VolumeDataPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusDistribution[]>([]);
  const [envData, setEnvData] = useState<EnvironmentalAverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [volumes, statuses, envAverages] = await Promise.all([
          getVolumeTrends(),
          getStatusDistribution(),
          getEnvironmentalAverages(),
        ]);
        setVolumeData(volumes);
        setStatusData(statuses);
        setEnvData(envAverages);
      } catch (err) {
        console.error('Analytics error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-agri-accent to-yellow-400 shadow-lg shadow-agri-accent/20">
          <BarChart3 size={24} className="text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Data Analytics Engine</h1>
          <p className="text-sm text-foreground-muted">Business Intelligence & Decision Support</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Volume Trends - Line Chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-agri-primary-light" />
            <h3 className="text-base font-semibold text-foreground">Harvest Volume Trends (30 Days)</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1a2332', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' }}
              />
              <Line type="monotone" dataKey="total_kg" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} name="Volume (kg)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution - Pie Chart */}
        <div className="card p-6">
          <div className="mb-6 flex items-center gap-2">
            <PieIcon size={18} className="text-status-matched" />
            <h3 className="text-base font-semibold text-foreground">Logistics Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }: { name?: string; value?: number }) => `${name}: ${value}`}
              >
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a2332', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Environmental Averages - Bar Chart */}
        <div className="card p-6">
          <div className="mb-6 flex items-center gap-2">
            <Thermometer size={18} className="text-orange-400" />
            <h3 className="text-base font-semibold text-foreground">Environmental Averages by Location</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={envData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="location" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1a2332', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' }}
              />
              <Legend />
              <Bar dataKey="avg_moisture" fill="#3b82f6" name="Soil Moisture (%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avg_temperature" fill="#ef4444" name="Temperature (°C)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
