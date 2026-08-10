import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/iot/ingest/readings',
    method: 'POST required for ingestion'
  }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const deviceKey = request.headers.get('x-device-key');
    if (!deviceKey) {
      return NextResponse.json({ error: 'Missing x-device-key header' }, { status: 401 });
    }

    // Initialize Supabase service role client since devices are not users
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[IoT Ingest] Missing Supabase configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash incoming key and verify identity
    const keyHash = crypto.createHash('sha256').update(deviceKey).digest('hex');

    const { data: device, error: deviceError } = await supabase
      .from('iot_devices')
      .select('id, farm_id, crop_allocation_id, device_status, ingestion_mode, supported_measurements')
      .eq('ingest_key_hash', keyHash)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Invalid device key or device not found' }, { status: 401 });
    }

    if (device.device_status !== 'ACTIVE') {
      return NextResponse.json({ error: `Device is not active. Current status: ${device.device_status}` }, { status: 403 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    let readings = [];

    // Normalize single vs batch payload
    if (payload.readings && Array.isArray(payload.readings)) {
      readings = payload.readings;
    } else {
      readings = [payload];
    }

    if (readings.length === 0) {
      return NextResponse.json({ error: 'No readings found in payload' }, { status: 400 });
    }

    // Fallback timestamp for the entire batch if missing
    const defaultRecordedAt = new Date().toISOString();
    
    // Ensure all readings have recorded_at and normalize them
    readings = readings.map((r: any) => ({
      ...r,
      recorded_at: r.recorded_at || defaultRecordedAt
    }));

    const supported = device.supported_measurements || [];
    const ingestionSource = device.ingestion_mode === 'simulator' ? 'github_simulator' : 'direct_device';

    // Prepare Base Streams
    const insertRows = readings.map((r: any) => ({
      farm_id: device.farm_id,
      device_id: device.id,
      crop_allocation_id: device.crop_allocation_id,
      soil_moisture: supported.includes('soil_moisture') && typeof r.soil_moisture === 'number' ? r.soil_moisture : null,
      ambient_temperature: supported.includes('ambient_temperature') && typeof r.ambient_temperature === 'number' ? r.ambient_temperature : null,
      ambient_humidity: supported.includes('ambient_humidity') && typeof r.ambient_humidity === 'number' ? r.ambient_humidity : null,
      rainfall_mm: supported.includes('rainfall_mm') && typeof r.rainfall_mm === 'number' ? r.rainfall_mm : 0.0,
      recorded_at: r.recorded_at,
      ingestion_source: ingestionSource,
      raw_payload: r
    }));

    // Upsert Base Streams (Handles Deduplication on device_id + recorded_at)
    const { data: insertedStreams, error: insertError } = await supabase
      .from('iot_sensor_streams')
      .upsert(insertRows, { onConflict: 'device_id,recorded_at' })
      .select('id, recorded_at');

    if (insertError) {
      console.error('[IoT Ingest] Insert error (streams):', insertError);
      return NextResponse.json({ error: 'Failed to insert base readings' }, { status: 500 });
    }

    // Map stream IDs for Specialized Observations
    const streamMap = new Map();
    if (insertedStreams) {
      insertedStreams.forEach((s: any) => streamMap.set(s.recorded_at, s.id));
    }

    const specializedObservations: any[] = [];
    
    for (const r of readings) {
      const streamId = streamMap.get(r.recorded_at);
      if (!streamId) continue;
      if (Array.isArray(r.specialized_observations)) {
        for (const obs of r.specialized_observations) {
          if (supported.includes(obs.metric_code) && typeof obs.numeric_value === 'number') {
            specializedObservations.push({
              stream_id: streamId,
              device_id: device.id,
              farm_id: device.farm_id,
              crop_allocation_id: device.crop_allocation_id,
              metric_code: obs.metric_code,
              numeric_value: obs.numeric_value,
              unit: obs.unit || '',
              recorded_at: r.recorded_at
            });
          }
        }
      }
    }

    // Upsert Specialized Observations if any
    if (specializedObservations.length > 0) {
      const { error: obsError } = await supabase
        .from('iot_sensor_observations')
        .upsert(specializedObservations, { onConflict: 'device_id,metric_code,recorded_at' });

      if (obsError) {
        console.error('[IoT Ingest] Insert error (observations):', obsError);
        // We do not fail the whole request if only specialized obs fail, 
        // but it's important to log.
      }
    }

    // Update device last_seen and key usage asynchronously
    const now = new Date().toISOString();
    await supabase
      .from('iot_devices')
      .update({
        last_seen_at: now,
        ingest_key_last_used_at: now
      })
      .eq('id', device.id);

    return NextResponse.json({ 
      success: true, 
      inserted_streams: insertRows.length,
      inserted_observations: specializedObservations.length,
      device_id: device.id,
      farm_id: device.farm_id 
    }, { status: 201 });

  } catch (error: any) {
    console.error('[IoT Ingest] Uncaught Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
