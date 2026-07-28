'use client';

import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getSellerFarms, createSellerFarm, registerSellerDevice, getDeviceReadings } from '@/lib/api/farms';
import { Thermometer, Droplets, CloudRain, Activity, MapPin, Plus, Cpu, RefreshCw, BarChart2, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SellerDeviceReadingsPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<any | null>(null);
  const [deviceReadings, setDeviceReadings] = useState<any[]>([]);
  
  // Modals state
  const [showCreateFarm, setShowCreateFarm] = useState(false);
  const [showRegisterDevice, setShowRegisterDevice] = useState(false);
  
  // Create Farm state
  const [farmName, setFarmName] = useState('');
  const [cropType, setCropType] = useState('Maize');
  const [plantingDate, setPlantingDate] = useState('');
  const [maturityDays, setMaturityDays] = useState('120');
  const [address, setAddress] = useState('');
  
  // Register Device state
  const [deviceName, setDeviceName] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');

  useEffect(() => {
    if (user) loadFarms();
  }, [user]);

  useEffect(() => {
    if (selectedFarm?.iot_devices?.[0]) {
      loadReadings(selectedFarm.iot_devices[0].id);
    } else {
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
      // refresh selected farm
      const refreshed = data.find(f => f.id === selectedFarm.id);
      setSelectedFarm(refreshed || data[0]);
    }
    setLoading(false);
  };

  const loadReadings = async (deviceId: string) => {
    const { data } = await getDeviceReadings(supabase, deviceId, 10);
    setDeviceReadings(data || []);
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await createSellerFarm(supabase, user.id, {
      name: farmName,
      cropType,
      plantingDate,
      maturityDays: parseInt(maturityDays),
      address,
      latitude: 0,
      longitude: 0
    });
    setShowCreateFarm(false);
    loadFarms();
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFarm) return;
    await registerSellerDevice(supabase, user.id, selectedFarm.id, {
      name: deviceName,
      serial: deviceSerial,
      type: 'Soil & Weather Multi-Sensor',
      address: selectedFarm.physical_address || 'Farm Location',
      latitude: selectedFarm.latitude || 0,
      longitude: selectedFarm.longitude || 0
    });
    setShowRegisterDevice(false);
    loadFarms();
  };

  // Status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HARVEST_READY': return 'text-green-500 bg-green-500/10';
      case 'BUYER_BIDDING_OPEN': return 'text-blue-500 bg-blue-500/10';
      case 'RISK_ALERT': return 'text-red-500 bg-red-500/10';
      case 'READY_SOON': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>IoT Farm Dashboard</h1>
          <p className="opacity-70 mt-1">Monitor crop readiness and hardware telemetry</p>
        </div>
        <Button onClick={() => setShowCreateFarm(true)} className="mt-4 md:mt-0 flex items-center">
          <Plus size={16} className="mr-2" /> Register New Farm
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Farm List */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-xl font-bold mb-4">Your Farms</h2>
          {loading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-white/10 rounded w-3/4"></div>
                <div className="h-4 bg-white/10 rounded w-1/2"></div>
              </div>
            </div>
          ) : farms.length === 0 ? (
            <Alert variant="info" title="No Farms Found">
              You haven't registered any farms yet. Register a farm to connect IoT devices and track predictions.
            </Alert>
          ) : (
            farms.map((farm) => {
              const activePred = farm.harvest_predictions?.find((p: any) => p.prediction_cycle_status === 'ACTIVE');
              
              return (
                <Card 
                  key={farm.id} 
                  className={`cursor-pointer transition-all ${selectedFarm?.id === farm.id ? 'border-[var(--agri-primary)] border-2 shadow-lg shadow-[var(--agri-primary)]/20' : 'hover:border-white/30'}`}
                  onClick={() => setSelectedFarm(farm)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{farm.name || 'Unnamed Farm'}</h3>
                    {activePred && (
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(activePred.readiness_status)}`}>
                        {activePred.readiness_status}
                      </span>
                    )}
                  </div>
                  <div className="text-sm opacity-80 flex items-center mb-1">
                    <MapPin size={14} className="mr-2" /> {farm.physical_address || 'No address set'}
                  </div>
                  <div className="text-sm opacity-80 flex items-center">
                    <Cpu size={14} className="mr-2" /> 
                    {farm.iot_devices?.length > 0 ? (
                      <span className="text-green-400">{farm.iot_devices.length} Device(s) Active</span>
                    ) : (
                      <span className="text-red-400">No Devices Connected</span>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Right Col: Selected Farm Detail */}
        <div className="lg:col-span-8">
          {selectedFarm ? (
            <div className="space-y-6">
              
              {/* Top Meta */}
              <Card>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{selectedFarm.name}</h2>
                    <div className="flex space-x-4 text-sm opacity-80">
                      <span><strong>Crop:</strong> {selectedFarm.crop_type}</span>
                      <span><strong>Planted:</strong> {new Date(selectedFarm.planting_date).toLocaleDateString()}</span>
                      <span><strong>Maturity:</strong> {selectedFarm.expected_maturity_days} days</span>
                    </div>
                  </div>
                  
                  {!selectedFarm.iot_devices || selectedFarm.iot_devices.length === 0 ? (
                    <Button onClick={() => setShowRegisterDevice(true)} variant="accent">
                      <Cpu size={16} className="mr-2" /> Connect Hardware
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => loadReadings(selectedFarm.iot_devices[0].id)}>
                      <RefreshCw size={16} className="mr-2" /> Refresh Data
                    </Button>
                  )}
                </div>
              </Card>

              {/* Prediction Engine State */}
              {selectedFarm.harvest_predictions?.map((pred: any) => {
                if (pred.prediction_cycle_status !== 'ACTIVE') return null;
                return (
                  <Card key={pred.id} className="border-[var(--agri-primary)] bg-[var(--agri-primary)]/5">
                    <h3 className="font-bold flex items-center mb-4">
                      <BarChart2 className="mr-2" /> Hybrid Prediction Engine
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-black/20 p-3 rounded-lg">
                        <div className="text-xs opacity-70 mb-1">Score (0-100)</div>
                        <div className="text-2xl font-bold">{Math.round(pred.readiness_score || 0)}</div>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <div className="text-xs opacity-70 mb-1">System State</div>
                        <div className={`text-sm font-bold mt-1 px-2 py-1 rounded inline-block ${getStatusColor(pred.readiness_status)}`}>
                          {pred.readiness_status}
                        </div>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <div className="text-xs opacity-70 mb-1">Expected Yield</div>
                        <div className="text-xl font-bold">{pred.expected_quantity_volume || '0'} {pred.expected_quantity_unit}</div>
                      </div>
                      <div className="bg-black/20 p-3 rounded-lg">
                        <div className="text-xs opacity-70 mb-1">Market State</div>
                        <div className="text-xl font-bold">{pred.bidding_status || 'CLOSED'}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Telemetry Visualizer */}
              {selectedFarm.iot_devices?.length > 0 && (
                <Card>
                  <h3 className="font-bold flex items-center mb-4 border-b border-white/10 pb-4">
                    <Activity className="mr-2" /> Real-time Telemetry (Device: {selectedFarm.iot_devices[0].device_serial_number})
                  </h3>
                  
                  {deviceReadings.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg flex items-center">
                          <Droplets size={32} className="text-blue-400 mr-4" />
                          <div>
                            <div className="text-sm opacity-70">Soil Moisture</div>
                            <div className="text-2xl font-bold">{deviceReadings[0].soil_moisture_percentage}%</div>
                          </div>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg flex items-center">
                          <Thermometer size={32} className="text-red-400 mr-4" />
                          <div>
                            <div className="text-sm opacity-70">Temperature</div>
                            <div className="text-2xl font-bold">{deviceReadings[0].ambient_temperature_celsius}°C</div>
                          </div>
                        </div>
                        <div className="bg-cyan-500/10 border border-cyan-500/30 p-4 rounded-lg flex items-center">
                          <CloudRain size={32} className="text-cyan-400 mr-4" />
                          <div>
                            <div className="text-sm opacity-70">Humidity</div>
                            <div className="text-2xl font-bold">{deviceReadings[0].ambient_humidity_percentage}%</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs uppercase bg-black/20">
                            <tr>
                              <th className="px-4 py-3">Timestamp</th>
                              <th className="px-4 py-3">Moisture</th>
                              <th className="px-4 py-3">Temp</th>
                              <th className="px-4 py-3">Humidity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deviceReadings.map((r, i) => (
                              <tr key={i} className="border-b border-white/5">
                                <td className="px-4 py-2">{new Date(r.recorded_at).toLocaleString()}</td>
                                <td className="px-4 py-2 text-blue-400">{r.soil_moisture_percentage}%</td>
                                <td className="px-4 py-2 text-red-400">{r.ambient_temperature_celsius}°C</td>
                                <td className="px-4 py-2 text-cyan-400">{r.ambient_humidity_percentage}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 opacity-60">
                      <Activity size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Hardware connected but no readings received yet.</p>
                      <p className="text-sm mt-2">Make sure your gateway is powered on and streaming to the /sensor endpoint.</p>
                    </div>
                  )}
                </Card>
              )}

            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center opacity-60">
                <MapPin size={48} className="mx-auto mb-4 opacity-50" />
                <p>Select a farm to view telemetry</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE FARM MODAL */}
      {showCreateFarm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Register New Farm</h2>
            <form onSubmit={handleCreateFarm} className="space-y-4">
              <div>
                <Label>Farm Name</Label>
                <Input required value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. North Plot A" />
              </div>
              <div>
                <Label>Crop Type</Label>
                <Input required value={cropType} onChange={(e) => setCropType(e.target.value)} placeholder="e.g. Maize" />
              </div>
              <div>
                <Label>Planting Date</Label>
                <Input required type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
              </div>
              <div>
                <Label>Expected Maturity (Days)</Label>
                <Input required type="number" value={maturityDays} onChange={(e) => setMaturityDays(e.target.value)} />
              </div>
              <div>
                <Label>Physical Address / Location</Label>
                <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 123 Farm Road, Ogbomosho" />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setShowCreateFarm(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Register Farm</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* REGISTER DEVICE MODAL */}
      {showRegisterDevice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Connect Hardware</h2>
            <p className="text-sm opacity-80 mb-4">Register an IoT gateway to {selectedFarm?.name}</p>
            <form onSubmit={handleRegisterDevice} className="space-y-4">
              <div>
                <Label>Device Name</Label>
                <Input required value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="e.g. Gateway-01" />
              </div>
              <div>
                <Label>Serial Number</Label>
                <Input required value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} placeholder="e.g. SN-998877" />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setShowRegisterDevice(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Connect Device</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

    </PageContainer>
  );
}
