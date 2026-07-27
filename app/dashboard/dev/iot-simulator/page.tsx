'use client';

import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { 
  createSimulatedFarm, 
  generateBulkSensorReadings,
  getSimulatedFarms 
} from '@/lib/api/simulator';
import { Activity, Database, RefreshCw, Server, Zap, CheckCircle } from 'lucide-react';

type PresetType = 'NOT_READY' | 'WATCH' | 'READY_SOON' | 'BUYER_BIDDING_OPEN' | 'HARVEST_READY' | 'RISK_ALERT';

export default function IoTSimulatorPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [farms, setFarms] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [cropType, setCropType] = useState('Maize');
  const [maturityDays, setMaturityDays] = useState('120');
  const [plantingDate, setPlantingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  
  const [expectedQty, setExpectedQty] = useState('5000');
  const [expectedUnit, setExpectedUnit] = useState('KG');

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    const { data, error } = await getSimulatedFarms(supabase);
    if (data) setFarms(data);
  };

  const applyPreset = (type: PresetType) => {
    const d = new Date();
    let pDays = 0;
    let mDays = 120;
    
    switch (type) {
      case 'NOT_READY': pDays = 10; break;
      case 'WATCH': pDays = 40; break;
      case 'READY_SOON': pDays = 85; break;
      case 'BUYER_BIDDING_OPEN': pDays = 105; break;
      case 'HARVEST_READY': pDays = 120; break;
      case 'RISK_ALERT': pDays = 60; break;
    }
    
    d.setDate(d.getDate() - pDays);
    setPlantingDate(d.toISOString().split('T')[0]);
    setMaturityDays(mDays.toString());
    setMessage({ type: 'success', text: `Preset "${type}" applied. Ready to deploy.` });
  };

  const handleDeployScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);
    try {
      // 1. Create Farm, Device, and Prediction in one go
      const { farm, device, prediction, error } = await createSimulatedFarm(
        supabase, user.id, {
          cropType,
          plantingDate,
          maturityDays: parseInt(maturityDays),
          expectedQty: parseInt(expectedQty),
          expectedUnit
        }
      );
      if (error) throw error;

      // Calculate days to simulate
      const pDate = new Date(plantingDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - pDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Determine moisture base (Risk alert drops moisture below 20 to trigger logic)
      let baseMoisture = 60;
      if (diffDays === 60) {
        // We set RISK_ALERT at 60 days arbitrarily above, let's force low moisture
        baseMoisture = 15;
      }

      // 2. Fire telemetry
      if (device) {
        await generateBulkSensorReadings(supabase, farm.id, device.id, Math.min(diffDays, 30), baseMoisture);
      }
      
      setMessage({ type: 'success', text: `Simulation deployed successfully! Trigger computed.` });
      await loadFarms();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <PageContainer><p>Please log in.</p></PageContainer>;

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Server className="h-8 w-8 text-indigo-600" />
            IoT Simulator Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Developer tool to mock farm states and generate telemetry.
          </p>
        </div>
      </div>

      {message && (
        <Alert
          variant={message.type}
          className="mb-6"
        >
          {message.text}
        </Alert>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Farm Generation */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Demo Presets
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-6">
              <Button size="sm" variant="secondary" onClick={() => applyPreset('NOT_READY')}>Not Ready</Button>
              <Button size="sm" variant="secondary" onClick={() => applyPreset('WATCH')}>Watch</Button>
              <Button size="sm" variant="secondary" onClick={() => applyPreset('READY_SOON')}>Ready Soon</Button>
              <Button size="sm" variant="secondary" onClick={() => applyPreset('BUYER_BIDDING_OPEN')}>Bidding Open</Button>
              <Button size="sm" variant="secondary" onClick={() => applyPreset('HARVEST_READY')}>Harvest Ready</Button>
              <Button size="sm" variant="secondary" onClick={() => applyPreset('RISK_ALERT')} className="text-red-600 border-red-200 hover:bg-red-50">Risk Alert</Button>
            </div>

            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-t pt-4">
              <Activity className="h-5 w-5 text-green-500" />
              Custom Deployment
            </h2>
            <form onSubmit={handleDeployScenario} className="space-y-4">
              <div>
                <Label>Crop Type</Label>
                <Input 
                  value={cropType} 
                  onChange={e => setCropType(e.target.value)}
                  placeholder="e.g. Maize"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Planting Date</Label>
                  <Input 
                    type="date"
                    value={plantingDate} 
                    onChange={e => setPlantingDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Maturity Days</Label>
                  <Input 
                    type="number"
                    value={maturityDays} 
                    onChange={e => setMaturityDays(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expected Qty</Label>
                  <Input 
                    type="number"
                    value={expectedQty} 
                    onChange={e => setExpectedQty(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input 
                    value={expectedUnit} 
                    onChange={e => setExpectedUnit(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                Run Simulation Flow
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Active Farms & Actions */}
        <div className="xl:col-span-2">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" />
                Active Simulated Farms
              </h2>
              <Button variant="secondary" size="sm" onClick={loadFarms} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {farms.length === 0 ? (
              <p className="text-gray-500 italic">No farms generated yet.</p>
            ) : (
              <div className="space-y-6">
                {farms.map(farm => {
                  const hasDevice = farm.iot_devices && farm.iot_devices.length > 0;
                  const device = hasDevice ? farm.iot_devices[0] : null;
                  const activePrediction = farm.harvest_predictions?.find((p: any) => p.prediction_cycle_status === 'ACTIVE');

                  return (
                    <div key={farm.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4 border-b pb-4">
                        <div>
                          <h3 className="font-bold text-lg">{farm.name}</h3>
                          <p className="text-sm text-gray-500 flex gap-4 mt-1">
                            <span>Crop: {farm.crop_type}</span>
                            <span>Planted: {farm.planting_date}</span>
                            <span>Maturity: {farm.expected_maturity_days} days</span>
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">IoT Device</span>
                          {device ? (
                            <span className="text-sm text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3"/> {device.device_serial_number}
                            </span>
                          ) : (
                            <span className="text-sm text-red-500">None</span>
                          )}
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Readiness Score</span>
                          <span className="text-indigo-600 font-bold text-lg">
                            {activePrediction?.readiness_score ? `${Math.round(activePrediction.readiness_score)}%` : 'N/A'}
                          </span>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Status</span>
                          <span className={`text-sm font-bold ${
                            activePrediction?.readiness_status === 'HARVEST_READY' ? 'text-green-600' :
                            activePrediction?.readiness_status === 'BUYER_BIDDING_OPEN' ? 'text-blue-600' :
                            activePrediction?.readiness_status === 'RISK_ALERT' ? 'text-red-600' :
                            'text-gray-700 dark:text-gray-300'
                          }`}>
                            {activePrediction?.readiness_status || 'PENDING'}
                          </span>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Bidding State</span>
                          <span className="text-sm font-semibold">
                            {activePrediction?.bidding_status || 'CLOSED'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
