import { supabase } from '@/lib/supabaseClient';
import type { VolumeDataPoint, StatusDistribution, EnvironmentalAverage, HarvestStatus } from '@/lib/types';
import { format, subDays } from 'date-fns';

export async function getVolumeTrends(): Promise<VolumeDataPoint[]> {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  const { data, error } = await supabase
    .from('trade_requests')
    .select('quantity_volume, created_at')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  const grouped: Record<string, number> = {};
  data.forEach((row: any) => {
    const date = format(new Date(row.created_at), 'MMM d');
    grouped[date] = (grouped[date] || 0) + Number(row.quantity_volume || 0);
  });

  return Object.entries(grouped).map(([date, total_kg]) => ({ date, total_kg }));
}

export async function getStatusDistribution(): Promise<StatusDistribution[]> {
  const { data, error } = await supabase
    .from('trade_requests')
    .select('request_status');

  if (error) throw new Error(error.message);
  if (!data) return [];

  const counts: Record<string, number> = {};
  data.forEach((row: any) => {
    const status = row.request_status || 'pending';
    counts[status] = (counts[status] || 0) + 1;
  });

  return Object.entries(counts).map(([status, count]) => ({
    status: status as HarvestStatus,
    count,
  }));
}

export async function getEnvironmentalAverages(): Promise<EnvironmentalAverage[]> {
  const { data, error } = await supabase
    .from('iot_telemetry_logs')
    .select('owner_id, soil_moisture_percentage, associated_lga');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  // Get locations cleanly from users table matching owner_id
  const ownerIds = [...new Set(data.map((d) => d.owner_id).filter(Boolean))];
  const { data: usersData } = await supabase
    .from('users')
    .select('id, macro_region')
    .in('id', ownerIds);

  const locationMap: Record<string, string> = {};
  usersData?.forEach((u) => {
    if (u.id && u.macro_region) {
      locationMap[u.id] = u.macro_region;
    }
  });

  const grouped: Record<string, { moistureSum: number; count: number }> = {};
  data.forEach((row) => {
    const location = row.associated_lga || (row.owner_id && locationMap[row.owner_id]) || 'Standard Hub';
    if (!grouped[location]) grouped[location] = { moistureSum: 0, count: 0 };
    grouped[location].moistureSum += Number(row.soil_moisture_percentage || 0);
    grouped[location].count += 1;
  });

  return Object.entries(grouped).map(([location, agg]) => ({
    location,
    avg_moisture: Math.round((agg.moistureSum / agg.count) * 10) / 10,
    avg_temperature: 28.5, // Standard baseline since temperature sensor column is not yet present on iot_telemetry_logs
  }));
}
