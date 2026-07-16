import { createClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ymihyyqdwwwdbsuhtjbv.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaWh5eXFkd3d3ZGJzdWh0amJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTU1NDMsImV4cCI6MjA5NzEzMTU0M30.xIKwl_tnab8bs5BUyk4PZEAIiEZAIypVq8q8J_H1Ql8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runConcurrentStressTest() {
  console.log('⚡ Starting YieldFlow Web Concurrent Stress Test Engine...\n');
  const startTime = performance.now();

  const totalOps = 80; // 80 simultaneous concurrent database operations
  let successCount = 0;
  let errorCount = 0;
  const latencies: number[] = [];

  // Fetch a baseline user to attach writes
  const { data: users } = await supabase.from('users').select('id').limit(1);
  const userId = users?.[0]?.id || '11111111-1111-1111-1111-111111111111';

  console.log(`📌 Using target user ID for concurrent load test: ${userId}`);


  console.log(`🔥 Firing ${totalOps} simultaneous concurrent read/write queries across 4 primary tables...`);

  const tasks = Array.from({ length: totalOps }).map(async (_, i) => {
    const opStart = performance.now();
    try {
      if (i % 4 === 0) {
        // Read active trade requests
        const { error } = await supabase.from('trade_requests').select('id, commodity_variety, status').limit(20);
        if (error) throw error;
      } else if (i % 4 === 1) {
        // Read telemetry logs
        const { error } = await supabase.from('iot_telemetry_logs').select('id, soil_moisture_percentage').limit(20);
        if (error) throw error;
      } else if (i % 4 === 2) {
        // Concurrent write: telemetry simulation
        const { error } = await supabase.from('iot_telemetry_logs').insert({
          owner_id: userId,
          associated_lga: `Stress Test LGA #${i}`,
          soil_moisture_percentage: Math.floor(Math.random() * 80) + 10,
          temperature: 28.5,
          humidity: 65.0,
        });
        if (error) throw error;
      } else {
        // Concurrent write: trade request simulation
        const { error } = await supabase.from('trade_requests').insert({
          user_id: userId,
          owner_id: userId,
          commodity_variety: `Stress Test Commodity #${i}`,
          quantity: 1000 + i * 10,
          address: `Stress Test Hub #${i}`,
          status: 'pending',
        });
        if (error) throw error;
      }

      successCount++;
    } catch (err: any) {
      errorCount++;
      // console.error(`Task #${i} failed:`, err.message);
    } finally {
      const opEnd = performance.now();
      latencies.push(opEnd - opStart);
    }
  });

  await Promise.all(tasks);
  const totalDuration = ((performance.now() - startTime) / 1000).toFixed(2);

  // Calculate stats
  latencies.sort((a, b) => a - b);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)]?.toFixed(1) || '0';
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)]?.toFixed(1) || '0';
  const throughput = (totalOps / parseFloat(totalDuration)).toFixed(1);

  console.log('\n========================================================');
  console.log('🏁 YIELDFLOW WEB STRESS TEST RESULTS');
  console.log('========================================================');
  console.log(`⏱️  Total Test Execution Time:   ${totalDuration} seconds`);
  console.log(`🚀 Total Operations Executed:    ${totalOps} concurrent requests`);
  console.log(`✅ Successful Operations:        ${successCount} (${((successCount / totalOps) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed Operations:            ${errorCount} (${((errorCount / totalOps) * 100).toFixed(1)}%)`);
  console.log(`📈 System Throughput:            ${throughput} operations / second`);
  console.log(`⚡ Average Response Latency:     ${avgLatency} ms`);
  console.log(`🕒 95th Percentile (p95):        ${p95Latency} ms`);
  console.log(`🕒 99th Percentile (p99):        ${p99Latency} ms`);
  console.log('========================================================\n');
}

runConcurrentStressTest();
