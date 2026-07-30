'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getSellerFarms, getDeviceReadings, confirmPredictedHarvest, convertBidsToTrades } from '@/lib/api/farms';
import { 
  Thermometer, Droplets, CloudRain, Activity, MapPin, Plus, Cpu, 
  RefreshCw, BarChart2, CheckCircle, AlertTriangle, Loader2, ArrowRight,
  TrendingUp, Wifi, Target, Sprout, ShoppingCart, Truck, Leaf
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RegisterFarmModal } from '@/components/seller/RegisterFarmModal';
import { ConnectDeviceModal } from '@/components/seller/ConnectDeviceModal';

// Status color helper for badges
const getStatusColor = (status: string) => {
  switch (status) {
    case 'HARVEST_READY': return 'text-green-500 bg-green-500/10 border-green-500/20';
    case 'BUYER_BIDDING_OPEN': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    case 'RISK_ALERT': return 'text-red-500 bg-red-500/10 border-red-500/20';
    case 'READY_SOON': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    case 'WATCH': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    case 'NOT_READY': return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
};

export default function SellerDeviceReadingsPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<any | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [deviceReadings, setDeviceReadings] = useState<any[]>([]);

  // Modals state
  const [showCreateFarm, setShowCreateFarm] = useState(false);
  const [showRegisterDevice, setShowRegisterDevice] = useState(false);
  
  // Action state
  const [convertingPredId, setConvertingPredId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    if (user) loadFarms();
  }, [user]);

  useEffect(() => {
    if (selectedFarm?.iot_devices?.[0]) {
      const dev = selectedFarm.iot_devices[0];
      setSelectedDevice(dev);
      loadReadings(dev.id);
    } else {
      setSelectedDevice(null);
      setDeviceReadings([]);
    }
  }, [selectedFarm]);

  const loadFarms = async () => {
    setLoading(true);
    const { data } = await getSellerFarms(supabase, user!.id);
    setFarms(data || []);
    if (data && data.length > 0 && !selectedFarm) {
      setSelectedFarm(data[0]);
    } else if (data && selectedFarm) {
      const refreshed = data.find(f => f.id === selectedFarm.id);
      setSelectedFarm(refreshed || data[0]);
    }
    setLoading(false);
  };

  const loadReadings = async (deviceId: string) => {
    // Fetch last 30 readings for better chart trends
    const { data } = await getDeviceReadings(supabase, deviceId, 30);
    // Sort chronological for charts
    const sorted = [...(data || [])].reverse(); 
    setDeviceReadings(sorted);
  };

  const activePred = selectedFarm?.harvest_predictions?.find((p: any) => p.prediction_cycle_status === 'ACTIVE');

  // Computed summary metrics
  const totalFarms = farms.length;
  const connectedDevices = farms.reduce((sum, f) => sum + (f.iot_devices?.length || 0), 0);
  const activeReadings = deviceReadings.length; // From current selected device context
  const readyFarms = farms.filter(f => f.harvest_predictions?.some((p: any) => 
    p.prediction_cycle_status === 'ACTIVE' && ['READY_SOON', 'HARVEST_READY', 'BUYER_BIDDING_OPEN'].includes(p.readiness_status)
  )).length;
  const riskFarms = farms.filter(f => f.harvest_predictions?.some((p: any) => 
    p.prediction_cycle_status === 'ACTIVE' && p.readiness_status === 'RISK_ALERT'
  )).length;

  return (
    <PageContainer>
      {/* A. Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Farm IoT Monitor</h1>
          <p className="opacity-70 mt-1">Manage farm locations, IoT devices, sensor readings, and harvest readiness.</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          {selectedFarm && (
            <Button onClick={() => setShowRegisterDevice(true)} variant="secondary" className="flex items-center">
              <Cpu size={16} className="mr-2" /> Connect Device
            </Button>
          )}
          <Button onClick={() => setShowCreateFarm(true)} variant="primary" className="flex items-center">
            <Plus size={16} className="mr-2" /> Register Farm
          </Button>
        </div>
      </div>

      {/* B. Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="p-4 bg-white/5 border border-white/10 flex flex-col justify-center items-center text-center">
          <div className="text-2xl font-bold">{totalFarms}</div>
          <div className="text-xs opacity-70 uppercase tracking-wider mt-1">Total Farms</div>
        </Card>
        <Card className="p-4 bg-white/5 border border-white/10 flex flex-col justify-center items-center text-center">
          <div className="text-2xl font-bold text-blue-400">{connectedDevices}</div>
          <div className="text-xs opacity-70 uppercase tracking-wider mt-1">Connected Devices</div>
        </Card>
        <Card className="p-4 bg-white/5 border border-white/10 flex flex-col justify-center items-center text-center">
          <div className="text-2xl font-bold text-green-400">{activeReadings}</div>
          <div className="text-xs opacity-70 uppercase tracking-wider mt-1">Active Readings</div>
        </Card>
        <Card className="p-4 bg-white/5 border border-white/10 flex flex-col justify-center items-center text-center">
          <div className="text-2xl font-bold text-yellow-400">{readyFarms}</div>
          <div className="text-xs opacity-70 uppercase tracking-wider mt-1">Near Readiness</div>
        </Card>
        <Card className="p-4 bg-white/5 border border-red-500/20 flex flex-col justify-center items-center text-center">
          <div className="text-2xl font-bold text-red-400">{riskFarms}</div>
          <div className="text-xs opacity-70 uppercase tracking-wider mt-1">Risk Alerts</div>
        </Card>
      </div>

      {/* C. IoT Pipeline Explanation Section */}
      <div className="mb-8 p-4 rounded-xl border border-[var(--agri-primary)]/20 bg-[var(--agri-primary)]/5">
        <h3 className="text-sm font-bold opacity-80 mb-3 flex items-center"><Target size={14} className="mr-2"/> Platform IoT Pipeline</h3>
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 overflow-x-auto text-xs pb-2 whitespace-nowrap">
          <div className="flex items-center gap-2"><MapPin size={16} className="text-green-500"/> 1. Farm Setup</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><Cpu size={16} className="text-blue-500"/> 2. Connect Device</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><Activity size={16} className="text-yellow-500"/> 3. Data Ingestion</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><BarChart2 size={16} className="text-purple-500"/> 4. Prediction Engine</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><Sprout size={16} className="text-[var(--agri-primary)]"/> 5. Readiness State</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><ShoppingCart size={16} className="text-orange-500"/> 6. Marketplace Bidding</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* D. Left Col: Farm List Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold flex items-center"><MapPin className="mr-2 opacity-80" size={20} /> Your Farms</h2>
          </div>
          
          {loading ? (
            <div className="animate-pulse space-y-4">
              <Card className="h-32 bg-white/5" />
              <Card className="h-32 bg-white/5" />
            </div>
          ) : farms.length === 0 ? (
            <Card className="text-center py-12 border-dashed border-2 border-white/10">
              <Sprout size={48} className="mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-bold mb-2">No farms registered yet</h3>
              <p className="text-sm opacity-60 mb-6 max-w-xs mx-auto">
                Register your first farm to connect IoT devices, track sensor telemetry, and unlock harvest predictions.
              </p>
              <Button onClick={() => setShowCreateFarm(true)} variant="primary">
                Register First Farm
              </Button>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
              {farms.map((farm) => {
                const fPred = farm.harvest_predictions?.find((p: any) => p.prediction_cycle_status === 'ACTIVE');
                return (
                  <Card 
                    key={farm.id} 
                    className={`cursor-pointer transition-all ${selectedFarm?.id === farm.id ? 'border-[var(--agri-primary)] border-2 shadow-lg shadow-[var(--agri-primary)]/10 bg-[var(--agri-primary)]/5' : 'hover:border-white/30'}`}
                    onClick={() => setSelectedFarm(farm)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-lg">{farm.name || 'Unnamed Farm'}</h3>
                      {fPred && (
                        <span className={`text-[10px] px-2 py-1 rounded-md font-bold border ${getStatusColor(fPred.readiness_status)}`}>
                          {fPred.readiness_status}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs opacity-70 mb-3">
                      <div className="flex items-center"><Leaf size={12} className="mr-1"/> {farm.crop_type}</div>
                      <div className="flex items-center"><Target size={12} className="mr-1"/> {farm.expected_maturity_days} days</div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                      <div className="flex items-center opacity-80">
                        <MapPin size={12} className="mr-1" /> 
                        <span className="truncate max-w-[120px]">{farm.physical_address || 'No address set'}</span>
                      </div>
                      <div className="flex items-center">
                        <Wifi size={12} className={farm.iot_devices?.length > 0 ? 'text-green-400 mr-1' : 'text-gray-500 mr-1'} />
                        {farm.iot_devices?.length || 0} Device(s)
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* E. Right Col: Selected Farm Detail Panel */}
        <div className="lg:col-span-8">
          {selectedFarm ? (
            <div className="space-y-6">
              
              {/* Farm Overview */}
              <Card>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{selectedFarm.name}</h2>
                    <p className="text-sm opacity-60 flex items-center">
                      <MapPin size={14} className="mr-1"/> {selectedFarm.physical_address}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-black/20 p-3 rounded-lg">
                    <div className="text-xs opacity-50 mb-1">Crop Type</div>
                    <div className="font-bold flex items-center"><Leaf size={14} className="mr-2 text-green-400"/> {selectedFarm.crop_type}</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded-lg">
                    <div className="text-xs opacity-50 mb-1">Planting Date</div>
                    <div className="font-bold">{new Date(selectedFarm.planting_date).toLocaleDateString()}</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded-lg">
                    <div className="text-xs opacity-50 mb-1">Expected Maturity</div>
                    <div className="font-bold">{selectedFarm.expected_maturity_days} Days</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded-lg">
                    <div className="text-xs opacity-50 mb-1">Coordinates</div>
                    <div className="font-bold font-mono text-sm">{selectedFarm.latitude?.toFixed(4)}, {selectedFarm.longitude?.toFixed(4)}</div>
                  </div>
                </div>
              </Card>

              {/* Device Management Section */}
              <Card>
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                  <h3 className="font-bold flex items-center">
                    <Cpu className="mr-2 text-blue-400" /> Device Management
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowRegisterDevice(true)}>
                    <Plus size={14} className="mr-1"/> Connect Device
                  </Button>
                </div>

                {selectedFarm.iot_devices && selectedFarm.iot_devices.length > 0 ? (
                  <div className="space-y-2">
                    {selectedFarm.iot_devices.map((device: any) => (
                      <div 
                        key={device.id} 
                        className={`p-3 rounded-lg flex items-center justify-between transition-colors border ${selectedDevice?.id === device.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-black/20'}`}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{device.device_name}</span>
                          <span className="text-xs opacity-60">SN: {device.device_serial_number} • {device.device_type}</span>
                          {device.firmware_version && <span className="text-[10px] opacity-40">Firmware: {device.firmware_version}</span>}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-[10px] uppercase font-bold text-green-400 tracking-wider flex items-center justify-end">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-1"></div>
                                {device.device_status}
                              </div>
                              <div className="text-[10px] opacity-50">
                                {device.last_seen_at ? `Last seen: ${new Date(device.last_seen_at).toLocaleString()}` : 'Never seen'}
                              </div>
                            </div>
                          </div>
                          {selectedDevice?.id !== device.id && (
                            <Button size="sm" variant="secondary" onClick={() => { setSelectedDevice(device); loadReadings(device.id); }} className="h-7 text-xs">
                              Select & View Readings
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-white/10 rounded-lg bg-black/10">
                    <Wifi size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium mb-1">No devices connected to this farm.</p>
                    <p className="text-xs opacity-60">Connect a device to begin receiving sensor readings into the ingestion layer.</p>
                  </div>
                )}
              </Card>

              {/* Sensor Readings & Chart Section */}
              {selectedDevice && (
                <Card>
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                    <h3 className="font-bold flex items-center">
                      <Activity className="mr-2 text-green-400" /> Sensor Readings (Ingestion Layer)
                    </h3>
                    <div className="text-xs opacity-60 bg-black/30 px-2 py-1 rounded-md">
                      Showing telemetry for: <strong>{selectedDevice.device_name}</strong>
                    </div>
                  </div>

                  {deviceReadings.length > 0 ? (
                    <div className="space-y-6">
                      {/* Latest Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                          <div className="flex items-center text-xs opacity-60 mb-2"><Droplets size={12} className="mr-1 text-blue-400"/> Soil Moisture</div>
                          <div className="text-xl font-bold">{deviceReadings[deviceReadings.length-1].soil_moisture}%</div>
                        </div>
                        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                          <div className="flex items-center text-xs opacity-60 mb-2"><Thermometer size={12} className="mr-1 text-red-400"/> Ambient Temp</div>
                          <div className="text-xl font-bold">{deviceReadings[deviceReadings.length-1].ambient_temperature}°C</div>
                        </div>
                        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                          <div className="flex items-center text-xs opacity-60 mb-2"><CloudRain size={12} className="mr-1 text-cyan-400"/> Humidity</div>
                          <div className="text-xl font-bold">{deviceReadings[deviceReadings.length-1].ambient_humidity}%</div>
                        </div>
                        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                          <div className="flex items-center text-xs opacity-60 mb-2"><Activity size={12} className="mr-1 text-purple-400"/> Last Recorded</div>
                          <div className="text-xs font-bold pt-1">{new Date(deviceReadings[deviceReadings.length-1].recorded_at).toLocaleTimeString()}</div>
                        </div>
                      </div>

                      {/* Chart Trends */}
                      <div className="h-64 w-full bg-black/20 rounded-lg p-4 border border-white/5">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={deviceReadings} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="recorded_at" tickFormatter={(t) => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} stroke="#666" fontSize={10} />
                            <YAxis stroke="#666" fontSize={10} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '12px' }}
                              labelFormatter={(l) => new Date(l).toLocaleString()}
                            />
                            <Line type="monotone" name="Moisture (%)" dataKey="soil_moisture" stroke="#60a5fa" strokeWidth={2} dot={false} />
                            <Line type="monotone" name="Temp (°C)" dataKey="ambient_temperature" stroke="#f87171" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Data Table */}
                      <div className="max-h-48 overflow-y-auto border border-white/10 rounded-lg">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs uppercase bg-black/40 sticky top-0">
                            <tr>
                              <th className="px-3 py-2">Timestamp</th>
                              <th className="px-3 py-2">Moisture</th>
                              <th className="px-3 py-2">Temp</th>
                              <th className="px-3 py-2">Humidity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {[...deviceReadings].reverse().map((r: any, idx: number) => (
                              <tr key={idx} className="hover:bg-white/5">
                                <td className="px-3 py-2 opacity-70 text-xs">{new Date(r.recorded_at).toLocaleString()}</td>
                                <td className="px-3 py-2">{r.soil_moisture}%</td>
                                <td className="px-3 py-2">{r.ambient_temperature}°C</td>
                                <td className="px-3 py-2">{r.ambient_humidity}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-white/10 rounded-lg bg-black/10">
                      <Activity size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium mb-1">No readings recorded yet.</p>
                      <p className="text-xs opacity-60">Use the IoT simulator or connect active hardware to start streaming telemetry.</p>
                    </div>
                  )}
                </Card>
              )}

              {/* Prediction Engine & Marketplace Trigger */}
              {activePred ? (
                <Card className="border-t-4 border-t-purple-500">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                    <h3 className="font-bold flex items-center">
                      <BarChart2 className="mr-2 text-purple-400" /> Prediction & Marketplace State
                    </h3>
                    <div className="text-[10px] opacity-60">
                      Engine: {activePred.prediction_engine || 'Hybrid MVP'} • Updated: {new Date(activePred.updated_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                      <h4 className="text-xs uppercase opacity-50 font-bold tracking-wider">Model Output</h4>
                      <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="text-sm">Readiness Score</span>
                        <span className="font-mono font-bold text-lg">{activePred.readiness_score?.toFixed(1) || '0.0'} / 100</span>
                      </div>
                      <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="text-sm">Readiness Status</span>
                        <span className={`text-xs px-2 py-1 rounded-md font-bold border ${getStatusColor(activePred.readiness_status)}`}>
                          {activePred.readiness_status}
                        </span>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                        <div className="text-xs opacity-60 mb-1">Predicted Harvest Window</div>
                        <div className="font-bold text-sm">
                          {activePred.predicted_harvest_start ? new Date(activePred.predicted_harvest_start).toLocaleDateString() : 'N/A'} 
                          {' → '} 
                          {activePred.predicted_harvest_end ? new Date(activePred.predicted_harvest_end).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-xs uppercase opacity-50 font-bold tracking-wider">Marketplace Trigger</h4>
                      
                      {['BUYER_BIDDING_OPEN', 'HARVEST_READY'].includes(activePred.readiness_status) ? (
                        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg flex flex-col items-center justify-center h-full text-center">
                          <ShoppingCart size={24} className="text-blue-400 mb-2" />
                          <h5 className="font-bold text-blue-400 mb-1">Harvest is open to buyers!</h5>
                          <p className="text-xs opacity-80 mb-3">The model determined this crop is ready for the marketplace. Bidding is {activePred.bidding_status}.</p>
                          <Link href="/dashboard/seller/bids" className="w-full">
                            <Button variant="primary" className="w-full text-sm">View & Manage Bids</Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="bg-black/20 border border-dashed border-white/20 p-4 rounded-lg flex flex-col items-center justify-center h-full text-center">
                          <Target size={24} className="opacity-30 mb-2" />
                          <h5 className="font-bold opacity-80 mb-1">Not open for bidding yet.</h5>
                          <p className="text-xs opacity-60">Readiness score must reach the threshold to trigger marketplace visibility.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Area */}
                  {actionError && <Alert variant="error" className="mb-3">{actionError}</Alert>}
                  {actionSuccess && <Alert variant="success" className="mb-3">{actionSuccess}</Alert>}
                  
                  <div className="border-t border-white/10 pt-4 flex flex-wrap gap-3 items-center">
                    <span className="text-xs opacity-50 font-bold uppercase tracking-wider mr-2">Quick Actions:</span>
                    
                    {activePred.bidding_status === 'ALLOCATED' && (
                      <Button variant="secondary" size="sm" onClick={() => {
                        // Normally opens Confirm Harvest Modal (handled via /dashboard/seller/bids in this flow to avoid duplication, or implement here)
                        alert("To confirm harvest and setup pickup details, use the Manage Bids view.");
                      }}>
                        <CheckCircle size={14} className="mr-1" /> Prepare Harvest Confirmation
                      </Button>
                    )}
                    
                    {activePred.bidding_status === 'HARVEST_CONFIRMED' && (
                      <Button variant="primary" size="sm" disabled={convertingPredId === activePred.id} onClick={async () => {
                        if (!window.confirm('Convert all accepted bids into trade requests?')) return;
                        setConvertingPredId(activePred.id);
                        setActionError('');
                        const { error } = await convertBidsToTrades(supabase, activePred.id);
                        setConvertingPredId(null);
                        if (error) setActionError(error.message);
                        else { setActionSuccess('Bids converted to trades! Check My Requests.'); loadFarms(); }
                      }}>
                        {convertingPredId === activePred.id ? <Loader2 size={14} className="animate-spin mr-1" /> : <ArrowRight size={14} className="mr-1" />}
                        Convert to Trades
                      </Button>
                    )}
                    
                    <Link href="/dashboard/seller/bids">
                      <Button variant="ghost" size="sm">Manage Bids Hub</Button>
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card className="text-center py-8 bg-black/20 border-dashed border-white/10">
                  <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-bold opacity-80 mb-1">No active prediction cycle.</p>
                  <p className="text-xs opacity-50">Create a listing from the Sell page to initialize a prediction cycle for this farm.</p>
                </Card>
              )}

            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-12">
              <div className="text-center">
                <MapPin size={48} className="mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold mb-2">Select a farm</h3>
                <p className="text-sm opacity-60">Click a farm from the list to view its devices, telemetry, and harvest readiness.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateFarm && (
        <RegisterFarmModal 
          userId={user!.id}
          onClose={() => setShowCreateFarm(false)}
          onSuccess={(newFarm) => {
            setShowCreateFarm(false);
            loadFarms();
            if (newFarm && newFarm[0]) setSelectedFarm(newFarm[0]);
          }}
        />
      )}

      {showRegisterDevice && selectedFarm && (
        <ConnectDeviceModal
          userId={user!.id}
          selectedFarm={selectedFarm}
          onClose={() => setShowRegisterDevice(false)}
          onSuccess={() => {
            setShowRegisterDevice(false);
            loadFarms();
          }}
        />
      )}
    </PageContainer>
  );
}
