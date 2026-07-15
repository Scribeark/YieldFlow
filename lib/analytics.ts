import { supabase } from '@/lib/supabaseClient';
import type { VolumeDataPoint, StatusDistribution, EnvironmentalAverage, HarvestStatus } from '@/lib/types';
import { format, subDays } from 'date-fns';

export async function getVolumeTrends(): Promise<VolumeDataPoint[]> {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  const { data, error } = await supabase
    .from('harvest_logs')
    .select('quantity_kg, created_at')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  const grouped: Record<string, number> = {};
  data.forEach((row) => {
    const date = format(new Date(row.created_at), 'MMM d');
    grouped[date] = (grouped[date] || 0) + Number(row.quantity_kg);
  });

  return Object.entries(grouped).map(([date, total_kg]) => ({ date, total_kg }));
}

export async function getStatusDistribution(): Promise<StatusDistribution[]> {
  const { data, error } = await supabase
    .from('harvest_logs')
    .select('status');

  if (error) throw new Error(error.message);
  if (!data) return [];

  const counts: Record<string, number> = {};
  data.forEach((row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
  });

  return Object.entries(counts).map(([status, count]) => ({
    status: status as HarvestStatus,
    count,
  }));
}

export async function getEnvironmentalAverages(): Promise<EnvironmentalAverage[]> {
  const { data, error } = await supabase
    .from('iot_telemetry_logs')
    .select('farmer_id, soil_moisture, temperature');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  // Get farmer locations
  const farmerIds = [...new Set(data.map((d) => d.farmer_id))];
  const { data: harvests } = await supabase
    .from('harvest_logs')
    .select('farmer_id, farm_location')
    .in('farmer_id', farmerIds);

  const farmerLocationMap: Record<string, string> = {};
  harvests?.forEach((h) => {
    if (!farmerLocationMap[h.farmer_id]) {
      farmerLocationMap[h.farmer_id] = h.farm_location;
    }
  });

  const grouped: Record<string, { moistureSum: number; tempSum: number; count: number }> = {};
  data.forEach((row) => {
    const location = farmerLocationMap[row.farmer_id] || 'Unknown';
    if (!grouped[location]) grouped[location] = { moistureSum: 0, tempSum: 0, count: 0 };
    grouped[location].moistureSum += Number(row.soil_moisture);
    grouped[location].tempSum += Number(row.temperature);
    grouped[location].count += 1;
  });

  return Object.entries(grouped).map(([location, agg]) => ({
    location,
    avg_moisture: Math.round((agg.moistureSum / agg.count) * 10) / 10,
    avg_temperature: Math.round((agg.tempSum / agg.count) * 10) / 10,
  }));
}
