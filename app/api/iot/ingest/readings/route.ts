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
      .select('id, farm_id, crop_allocation_id, device_status')
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

    // Prepare rows for insertion
    const insertRows = [];
    for (const r of readings) {
      // Basic validation
      if (typeof r.soil_moisture !== 'number' || 
          typeof r.ambient_temperature !== 'number' || 
          typeof r.ambient_humidity !== 'number') {
        return NextResponse.json({ error: 'Invalid payload structure. Ensure moisture, temp, and humidity are numeric.' }, { status: 400 });
      }

      insertRows.push({
        farm_id: device.farm_id,
        device_id: device.id,
        crop_allocation_id: device.crop_allocation_id,
        soil_moisture: r.soil_moisture,
        ambient_temperature: r.ambient_temperature,
        ambient_humidity: r.ambient_humidity,
        rainfall_mm: r.rainfall_mm || 0.0,
        recorded_at: r.recorded_at || new Date().toISOString(),
        ingestion_source: 'api',
        raw_payload: r
      });
    }

    // Insert readings
    const { error: insertError } = await supabase
      .from('iot_sensor_streams')
      .insert(insertRows);

    if (insertError) {
      console.error('[IoT Ingest] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to insert readings' }, { status: 500 });
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
      inserted: insertRows.length,
      device_id: device.id,
      farm_id: device.farm_id 
    }, { status: 201 });

  } catch (error: any) {
    console.error('[IoT Ingest] Uncaught Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
