import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ymihyyqdwwwdbsuhtjbv.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaWh5eXFkd3d3ZGJzdWh0amJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTU1NDMsImV4cCI6MjA5NzEzMTU0M30.xIKwl_tnab8bs5BUyk4PZEAIiEZAIypVq8q8J_H1Ql8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const REGIONS = ['Lagos Port Hub', 'Ibadan Central Hub', 'Kaduna Terminal', 'Kano Market Hub', 'Abuja Logistics Depot', 'Benue River Basin'];
const COMMODITIES = [
  'Cassava Tubers (Yellow Variety)',
  'White Cassava (TMS-30572)',
  'Hybrid Maize (DTMA-10)',
  'Ofada Rice Paddy',
  'White Sorghum Grain',
  'Raw Cocoa Beans (Grade A)',
  'Groundnut (Samsorg-14)',
  'Red Palm Oil (Unrefined)',
  'White Yam Tubers (Pona)',
];

const VEHICLE_TYPES = [
  'Refrigerated 15-Ton Truck',
  'Flatbed Articulated Trailer',
  'Covered Cargo Van (5-Ton)',
  'Heavy Duty Tipper Truck',
  'Agri-Logistics Light Duty Van',
];

async function runSeeder() {
  console.log('🌱 Starting YieldFlow Web Database Stress-Test Seeder...');

  try {
    // 1. Fetch existing users to attach realistic foreign keys
    const { data: users, error: userErr } = await supabase.from('users').select('id, full_name, declared_profession');
    if (userErr) throw userErr;

    const farmers = (users || []).filter(u => u.declared_profession === 'farmer');
    const carriers = (users || []).filter(u => u.declared_profession === 'carrier');
    const buyers = (users || []).filter(u => u.declared_profession === 'buyer');


    console.log(`📊 Found ${farmers.length} farmers, ${carriers.length} carriers, ${buyers.length} buyers.`);

    let farmerId = farmers[0]?.id || users?.[0]?.id;
    let carrierId = carriers[0]?.id || users?.[0]?.id;
    let buyerId = buyers[0]?.id || users?.[0]?.id;

    if (!farmerId) {
      console.log('⚡ No existing users found. Creating synthetic test profile accounts across roles...');
      const syntheticUsers = [
        { id: '11111111-1111-1111-1111-111111111111', full_name: 'Alhaji Musa (Simulated Farmer)', declared_profession: 'farmer', phone_number: '08024757252', macro_region: 'Ibadan Central Hub', verification_status: 'verified', business_latitude: 7.3775, business_longitude: 3.9470 },
        { id: '22222222-2222-2222-2222-222222222222', full_name: 'Chinedu Transport Fleet (Carrier)', declared_profession: 'carrier', phone_number: '08036386934', macro_region: 'Lagos Port Hub', verification_status: 'verified', business_latitude: 6.5244, business_longitude: 3.3792 },
        { id: '33333333-3333-3333-3333-333333333333', full_name: 'Dangote Agro-Processing (Buyer)', declared_profession: 'buyer', phone_number: '08012345678', macro_region: 'Kano Market Hub', verification_status: 'verified', business_latitude: 12.0022, business_longitude: 8.5920 },
      ];

      const { data: inserted, error: insertErr } = await supabase.from('users').upsert(syntheticUsers).select('id, declared_profession');
      if (insertErr) {
        console.warn('⚠️ Could not insert synthetic profiles (RLS check):', insertErr.message);
        // Fallback directly to deterministic UUIDs if RLS allows FK insertion directly
        farmerId = '11111111-1111-1111-1111-111111111111';
        carrierId = '22222222-2222-2222-2222-222222222222';
        buyerId = '33333333-3333-3333-3333-333333333333';
      } else if (inserted && inserted.length > 0) {
        farmerId = inserted.find(u => u.declared_profession === 'farmer')?.id || inserted[0].id;
        carrierId = inserted.find(u => u.declared_profession === 'carrier')?.id || inserted[0].id;
        buyerId = inserted.find(u => u.declared_profession === 'buyer')?.id || inserted[0].id;
      }
    }

    console.log(`📌 Using primary test IDs -> Farmer: ${farmerId}, Carrier: ${carrierId}, Buyer: ${buyerId}`);


    // 2. Seed 50 Trade Requests across Nigerian Hubs
    console.log('🌾 Seeding 50 active trade requests...');
    const tradePayloads = Array.from({ length: 50 }).map((_, i) => {
      const region = REGIONS[i % REGIONS.length];
      const commodity = COMMODITIES[i % COMMODITIES.length];
      const isReady = i % 3 !== 0; // ~66% ready
      return {
        user_id: farmerId,
        owner_id: farmerId,
        commodity_variety: `${commodity} [Simulated Load #${i + 1}]`,
        quantity: Math.floor(Math.random() * 4500) + 500,
        address: `${Math.floor(Math.random() * 80) + 1} Agricultural Bypass, ${region}`,
        status: i % 4 === 0 ? 'matched' : i % 7 === 0 ? 'confirmed_by_buyer' : 'pending',
        harvest_photo_url: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=800&q=80',
      };
    });

    const { error: tradeErr } = await supabase.from('trade_requests').insert(tradePayloads);
    if (tradeErr) console.error('Trade insert error:', tradeErr.message);
    else console.log('✅ Successfully seeded 50 trade requests.');

    // 3. Seed 30 Vehicle States
    console.log('🚛 Seeding 30 carrier transport assets...');
    const vehiclePayloads = Array.from({ length: 30 }).map((_, i) => {
      const region = REGIONS[i % REGIONS.length];
      return {
        carrier_id: carrierId || farmerId,
        vehicle_type: `${VEHICLE_TYPES[i % VEHICLE_TYPES.length]} (Plate: KJA-${100 + i}XY)`,
        carrier_status: i % 5 === 0 ? 'busy' : i % 8 === 0 ? 'offline' : 'available',
        location: region,
        latitude: 9.082 + (Math.random() - 0.5) * 4,
        longitude: 8.6753 + (Math.random() - 0.5) * 4,
        vehicle_photo_url: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80',
      };
    });

    const { error: vehErr } = await supabase.from('vehicle_states').insert(vehiclePayloads);
    if (vehErr) console.error('Vehicle insert error:', vehErr.message);
    else console.log('✅ Successfully seeded 30 vehicle status records.');

    // 4. Seed 60 IoT Telemetry Logs
    console.log('📡 Seeding 60 real-time IoT telemetry logs...');
    const telemetryPayloads = Array.from({ length: 60 }).map((_, i) => {
      const region = REGIONS[i % REGIONS.length];
      const moisture = Math.floor(Math.random() * 65) + 15; // 15% to 80%
      return {
        owner_id: farmerId,
        associated_lga: `${region.split(' ')[0]} Central LGA`,
        soil_moisture_percentage: moisture,
        temperature: parseFloat((24 + Math.random() * 12).toFixed(1)),
        humidity: parseFloat((45 + Math.random() * 40).toFixed(1)),
        latitude: 9.082 + (Math.random() - 0.5) * 3,
        longitude: 8.6753 + (Math.random() - 0.5) * 3,
      };
    });

    const { error: iotErr } = await supabase.from('iot_telemetry_logs').insert(telemetryPayloads);
    if (iotErr) console.error('IoT insert error:', iotErr.message);
    else console.log('✅ Successfully seeded 60 IoT telemetry logs.');

    // 5. Seed Farm Input Listings
    console.log('🏬 Seeding 15 farm input listings...');
    const inputPayloads = [
      { input_name: 'Certified Hybrid Cassava Stems (TME-419)', category: 'seeds', price_ngn: 12500, quantity_available: 100, unit: 'bundles' },
      { input_name: 'NPK 20-10-10 Soil Booster (50kg Bag)', category: 'fertilizer', price_ngn: 34000, quantity_available: 250, unit: 'bags' },
      { input_name: 'Organic Liquid Seaweed Bio-Fertilizer', category: 'fertilizer', price_ngn: 18500, quantity_available: 80, unit: 'litres' },
      { input_name: 'Broad-Spectrum Selective Herbicide (Atrazine 500)', category: 'pesticide', price_ngn: 14000, quantity_available: 120, unit: 'litres' },
      { input_name: 'Solar-Powered Automated Drip Irrigation Kit (1 Acre)', category: 'equipment', price_ngn: 450000, quantity_available: 15, unit: 'pieces' },
      { input_name: 'High-Yield Yellow Maize Seed (Sammaz-52)', category: 'seeds', price_ngn: 22000, quantity_available: 180, unit: 'bags' },
    ];

    const { error: inpErr } = await supabase.from('farm_input_listings').insert(
      inputPayloads.map(inp => ({
        seller_id: farmerId,
        ...inp,
        description: 'High-efficiency agricultural supply verified for local soil structures.',
        region: 'Ibadan Central Hub',
        status: 'available',
      }))
    );
    if (inpErr) console.warn('Input insert warning (table might need creation via Supabase SQL):', inpErr.message);
    else console.log('✅ Successfully seeded farm input listings.');

    console.log('\n🚀 Stress-test seeding completed! Your marketplace, map, and portals are now populated with simulated data.');
  } catch (err: any) {
    console.error('Seeder critical error:', err);
  }
}

runSeeder();
