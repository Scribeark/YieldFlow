import { SupabaseClient } from '@supabase/supabase-js';

// 1. Create simulated farm
export async function createSimulatedFarm(
  supabase: SupabaseClient<any>,
  userId: string,
  params: {
    cropType: string;
    plantingDate: string;
    maturityDays: number;
    expectedQty: number;
    expectedUnit: string;
  }
) {
  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .insert({
      user_id: userId,
      name: `Simulated Farm - ${params.cropType} (${Math.floor(Math.random() * 1000)})`,
      crop_type: params.cropType,
      planting_date: params.plantingDate,
      expected_maturity_days: params.maturityDays,
      physical_address: 'Simulated IoT Farm Location',
      latitude: 6.5244,
      longitude: 3.3792
    })
    .select()
    .single();
    
  if (farmError) return { error: farmError };

  // 2. Auto-register simulated IoT device
  const serial = `SIM-DEV-${Math.floor(Math.random() * 1000000)}`;
  const { data: device, error: deviceError } = await supabase
    .from('iot_devices')
    .insert({
      farm_id: farm.id,
      user_id: userId,
      device_name: 'Simulated Soil Sensor v2',
      device_serial_number: serial,
      device_type: 'SOIL_PROBE',
      device_status: 'ACTIVE',
      installation_latitude: 6.5244,
      installation_longitude: 3.3792,
      installation_address: 'Simulated IoT Farm Location',
      firmware_version: '2.0.1-mock'
    })
    .select()
    .single();

  if (deviceError) return { error: deviceError };

  // 3. Create active harvest prediction
  const { data: prediction, error: predictionError } = await supabase
    .from('harvest_predictions')
    .insert({
      farm_id: farm.id,
      prediction_cycle_status: 'ACTIVE',
      bidding_status: 'CLOSED',
      prediction_engine: 'hybrid_score',
      expected_quantity_volume: params.expectedQty,
      expected_quantity_unit: params.expectedUnit
    })
    .select()
    .single();

  if (predictionError) return { error: predictionError };

  return { farm, device, prediction };
}

// 4. Generate simulated sensor stream
export async function generateBulkSensorReadings(
  supabase: SupabaseClient<any>,
  farmId: string,
  deviceId: string,
  daysToSimulate: number,
  baseMoisture: number = 60
) {
  const readings = [];
  const now = new Date();
  
  for (let i = daysToSimulate; i >= 0; i--) {
    const recordDate = new Date(now);
    recordDate.setDate(now.getDate() - i);
    
    // Slight random drift for realism
    const drift = (Math.random() * 10) - 5;
    
    readings.push({
      farm_id: farmId,
      device_id: deviceId, // Explicitly linking to the registered device
      soil_moisture: Math.max(0, Math.min(100, baseMoisture + drift)),
      ambient_temperature: 25 + (Math.random() * 5),
      ambient_humidity: 70 + (Math.random() * 10),
      rainfall_mm: Math.random() > 0.8 ? Math.random() * 20 : 0, // Occasional rain
      recorded_at: recordDate.toISOString()
    });
  }

  // Insert in bulk
  const { data, error } = await supabase
    .from('iot_sensor_streams')
    .insert(readings)
    .select();

  return { data, error };
}

export async function getSimulatedFarms(supabase: SupabaseClient<any>) {
  const { data, error } = await supabase
    .from('farms')
    .select('*, iot_devices(*), harvest_predictions(*)')
    .order('created_at', { ascending: false });
    
  return { data, error };
}
