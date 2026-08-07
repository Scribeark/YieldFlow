'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getSellerFarms, getDeviceReadings, confirmPredictedHarvest, convertBidsToTrades, archiveFarm, openCropAllocationBidding } from '@/lib/api/farms';
import { 
  Thermometer, Droplets, CloudRain, Activity, MapPin, Plus, Cpu, 
  RefreshCw, BarChart2, CheckCircle, AlertTriangle, Loader2, ArrowRight,
  TrendingUp, Wifi, Target, Sprout, ShoppingCart, Truck, Leaf, XCircle, Trash2, Archive
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RegisterFarmModal } from '@/components/seller/RegisterFarmModal';
import { ConnectDeviceModal } from '@/components/seller/ConnectDeviceModal';
import { CreateCropAllocationModal } from '@/components/seller/CreateCropAllocationModal';
import { useMapsKey } from '@/components/providers/MapsProvider';
import { generateDeviceIngestionKey, retireDevice } from '@/lib/api/devices';
import { Copy, Key } from 'lucide-react';

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

const getFreshnessState = (lastSeenAt: string | null) => {
  if (!lastSeenAt) return { state: 'NO_DATA', color: 'text-gray-400 bg-gray-500/20' };
  const diffHours = (new Date().getTime() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60);
  if (diffHours < 3) return { state: 'FRESH', color: 'text-green-400 bg-green-500/20' };
  if (diffHours <= 12) return { state: 'DELAYED', color: 'text-yellow-400 bg-yellow-500/20' };
  return { state: 'STALE', color: 'text-red-400 bg-red-500/20' };
};

export default function SellerDeviceReadingsPage() {
  const { user, profile } = useAuthStore();
  const supabase = createClient();
  const mapsApiKey = useMapsKey();
  
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<any | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [deviceReadings, setDeviceReadings] = useState<any[]>([]);

  // Modals state
  const [showCreateFarm, setShowCreateFarm] = useState(false);
  const [showRegisterDevice, setShowRegisterDevice] = useState(false);
  const [showCreateAllocation, setShowCreateAllocation] = useState(false);
  
  // Action state
  const [convertingPredId, setConvertingPredId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [generatedKey, setGeneratedKey] = useState<{ id: string, key: string } | null>(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  useEffect(() => {
    if (profile?.id) loadFarms();
  }, [profile?.id]);

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
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await getSellerFarms(supabase, profile.id);
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

  const handleGenerateKey = async (deviceId: string, isRotation: boolean = false) => {
    if (isRotation) {
      if (!window.confirm("Are you sure you want to rotate the ingestion key? This will permanently invalidate the previous key and any devices using it will lose access.")) return;
    }
    setIsGeneratingKey(true);
    setActionError('');
    setActionSuccess('');
    setGeneratedKey(null);

    const res = await generateDeviceIngestionKey(deviceId);
    if ('error' in res) {
      setActionError(res.error);
    } else {
      setGeneratedKey({ id: deviceId, key: res.rawKey });
      setActionSuccess('Key generated successfully! Copy it now, it will not be shown again.');
      loadFarms(); // Reload to get updated ingest_key_hash existence
    }
    setIsGeneratingKey(false);
  };
  const [isArchivingFarm, setIsArchivingFarm] = useState(false);
  const [retiringDeviceId, setRetiringDeviceId] = useState<string | null>(null);
  const [isOpeningBidding, setIsOpeningBidding] = useState<string | null>(null);

  const handleOpenBidding = async (allocId: string) => {
    if (!window.confirm("Open this crop plot for buyer bidding?")) return;
    setIsOpeningBidding(allocId);
    setActionError('');
    try {
      const { data, error } = await openCropAllocationBidding(supabase, allocId);
      if (error) throw new Error(error.message);
      if (data && data.success === false) throw new Error(data.error);
      setActionSuccess('Bidding opened successfully!');
      loadFarms();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Failed to open bidding.');
    } finally {
      setIsOpeningBidding(null);
    }
  };

  const handleArchiveFarm = async (farmId: string) => {
    if (!window.confirm("Are you sure you want to archive this farm? This will retire all associated devices. Historical data will be preserved.")) return;
    
    setIsArchivingFarm(true);
    setActionError('');
    try {
      const supabase = createClient();
      const { data, error: apiError } = await archiveFarm(supabase, farmId);
      
      if (apiError) throw new Error(apiError.message);
      
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to archive farm');
      }

      // Success
      if (selectedFarm?.id === farmId) {
        setSelectedFarm(null);
        setSelectedDevice(null);
      }
      loadFarms(); // reload the list
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Failed to archive farm.');
    } finally {
      setIsArchivingFarm(false);
    }
  };

  const handleRetireDevice = async (deviceId: string) => {
    if (!window.confirm("Are you sure you want to retire this device? It will stop receiving new readings. Historical data will be preserved.")) return;
    
    setRetiringDeviceId(deviceId);
    setActionError('');
    try {
      const res = await retireDevice(deviceId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to retire device');
      }
      
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(null);
      }
      loadFarms(); // reload list
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Failed to retire device.');
    } finally {
      setRetiringDeviceId(null);
    }
  };



  // Computed summary metrics
  const totalFarms = farms.length;
  const connectedDevices = farms.reduce((sum, f) => sum + (f.iot_devices?.filter((d: any) => d.device_status !== 'RETIRED').length || 0), 0);
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
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Farm & Device Monitor</h1>
          <p className="opacity-70 mt-1">Manage farm locations, connected devices, readings, and harvest readiness.</p>
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

      {/* C. Farm Monitoring Flow UI */}
      <div className="mb-8 p-4 rounded-xl border border-[var(--agri-primary)]/20 bg-[var(--agri-primary)]/5">
        <h3 className="text-sm font-bold opacity-80 mb-3 flex items-center"><Target size={14} className="mr-2"/> Farm Monitoring Flow</h3>
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 overflow-x-auto text-xs pb-2 whitespace-nowrap">
          <div className="flex items-center gap-2"><MapPin size={16} className="text-green-500"/> 1. Farm Setup</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><Cpu size={16} className="text-blue-500"/> 2. Connect Device</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><Activity size={16} className="text-yellow-500"/> 3. Device Readings</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><BarChart2 size={16} className="text-purple-500"/> 4. Harvest Analysis</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><Sprout size={16} className="text-[var(--agri-primary)]"/> 5. Readiness Status</div>
          <ArrowRight size={14} className="opacity-30 hidden md:block" />
          <div className="flex items-center gap-2"><ShoppingCart size={16} className="text-orange-500"/> 6. Buyer Bidding</div>
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
                Register your first farm to connect devices, track readings, and unlock harvest predictions.
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
                        <Wifi size={12} className={farm.iot_devices?.filter((d: any) => d.device_status !== 'RETIRED').length > 0 ? 'text-green-400 mr-1' : 'text-gray-500 mr-1'} />
                        {farm.iot_devices?.filter((d: any) => d.device_status !== 'RETIRED').length || 0} Device(s)
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
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => handleArchiveFarm(selectedFarm.id)}
                    disabled={isArchivingFarm}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-white"
                  >
                    {isArchivingFarm ? <Loader2 size={16} className="animate-spin mr-2" /> : <Archive size={16} className="mr-2" />}
                    Archive Farm
                  </Button>
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

                {selectedFarm.iot_devices && selectedFarm.iot_devices.filter((d: any) => d.device_status !== 'RETIRED').length > 0 ? (
                  <div className="space-y-2">
                    {selectedFarm.iot_devices.filter((d: any) => d.device_status !== 'RETIRED').map((device: any) => (
                      <div 
                        key={device.id} 
                        className={`p-3 rounded-lg flex items-center justify-between transition-colors border ${selectedDevice?.id === device.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-black/20'}`}
                      >
                        <div className="flex flex-col flex-1">
                          <span className="font-bold text-sm">{device.device_name}</span>
                          <span className="text-xs opacity-60">SN: {device.device_serial_number} • {device.device_type}</span>
                          <div className="text-[10px] opacity-40 font-mono mt-1 mb-1">Device ID: {device.id}</div>
                          {device.firmware_version && <span className="text-[10px] opacity-40">Firmware: {device.firmware_version}</span>}
                          
                          <div className="mt-2 pt-2 border-t border-white/5 text-[10px] space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="opacity-60">Ingestion Key:</span>
                              {device.ingest_key_hash ? (
                                <span className="text-green-400 font-bold flex items-center"><CheckCircle size={10} className="mr-1"/> Active</span>
                              ) : (
                                <span className="text-red-400 flex items-center"><XCircle size={10} className="mr-1"/> None</span>
                              )}
                            </div>
                            {device.ingest_key_last_used_at && (
                              <div className="opacity-50">Key last used: {new Date(device.ingest_key_last_used_at).toLocaleString()}</div>
                            )}
                          </div>
                          
                          {generatedKey?.id === device.id && (
                            <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs">
                              <div className="font-bold text-green-400 mb-1">New Key Generated (Copy now):</div>
                              <div className="flex items-center gap-2">
                                <code className="bg-black p-1 px-2 rounded font-mono flex-1 select-all break-all">{generatedKey?.key}</code>
                                <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(generatedKey?.key || '')} className="h-7 px-2 shrink-0">
                                  <Copy size={12} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end justify-between self-stretch">
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-green-400 tracking-wider flex items-center justify-end mb-1">
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-1"></div>
                              {device.device_status}
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <div className="text-[10px] opacity-50">
                                {device.last_seen_at ? `Seen: ${new Date(device.last_seen_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Never'}
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${getFreshnessState(device.last_seen_at).color}`}>
                                {getFreshnessState(device.last_seen_at).state}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              disabled={isGeneratingKey}
                              onClick={() => handleGenerateKey(device.id, !!device.ingest_key_hash)} 
                              className="h-7 text-[10px] border-white/20 hover:border-white/40"
                            >
                              <Key size={12} className="mr-1"/>
                              {device.ingest_key_hash ? 'Rotate Key' : 'Generate Key'}
                            </Button>
                            {selectedDevice?.id !== device.id && (
                              <Button size="sm" variant="secondary" onClick={() => { setSelectedDevice(device); loadReadings(device.id); }} className="h-7 text-[10px]">
                                View Readings
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              disabled={retiringDeviceId === device.id}
                              onClick={() => handleRetireDevice(device.id)} 
                              className="h-7 text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/30 px-2"
                            >
                              {retiringDeviceId === device.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-white/10 rounded-lg bg-black/10">
                    <Wifi size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium mb-1">No devices connected to this farm.</p>
                    <p className="text-xs opacity-60">Connect a device to begin tracking readings for harvest analysis.</p>
                  </div>
                )}
              </Card>

              {/* Sensor Readings & Chart Section */}
              {selectedDevice && (
                <Card>
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                    <h3 className="font-bold flex items-center">
                      <Activity className="mr-2 text-green-400" /> Device Readings
                    </h3>
                    <div className="text-xs opacity-60 bg-black/30 px-2 py-1 rounded-md">
                      Showing readings for: <strong>{selectedDevice.device_name}</strong>
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
                      <p className="text-xs opacity-60">Use the simulator or connect an active device to start receiving readings.</p>
                    </div>
                  )}
                </Card>
              )}

              {/* Crop Allocations & Marketplace Trigger */}
              <Card className="border-t-4 border-t-[var(--agri-primary)]">
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                  <h3 className="font-bold flex items-center">
                    <Sprout className="mr-2 text-[var(--agri-primary)]" /> Crop Plots & Harvest Bidding
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateAllocation(true)}>
                    <Plus size={14} className="mr-1"/> Add Crop Plot
                  </Button>
                </div>

                {selectedFarm.farm_crop_allocations && selectedFarm.farm_crop_allocations.length > 0 ? (
                  <div className="space-y-4">
                    {selectedFarm.farm_crop_allocations.map((alloc: any) => {
                      const activePred = alloc.harvest_predictions?.find((p: any) => p.prediction_cycle_status === 'ACTIVE');
                      return (
                        <div key={alloc.id} className="bg-black/20 p-4 rounded-lg border border-white/5 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold flex items-center"><Leaf size={14} className="mr-1 text-green-400"/> {alloc.crop_type}</h4>
                              <div className="text-xs opacity-60">
                                Size: {alloc.land_size_value} {alloc.land_size_unit} • Planted: {alloc.planting_date ? new Date(alloc.planting_date).toLocaleDateString() : 'N/A'} • Maturity: {alloc.expected_maturity_days} days
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <span className={`px-2 py-1 rounded font-bold border ${alloc.allocation_status === 'ACTIVE' ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>
                                {alloc.allocation_status}
                              </span>
                            </div>
                          </div>

                          {/* Prediction / Bidding Status */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                              <div className="text-xs opacity-50 uppercase tracking-wider mb-2 font-bold">IoT Readiness</div>
                              {activePred ? (
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between"><span>Score:</span> <span className="font-mono font-bold">{activePred.readiness_score?.toFixed(1) || '0.0'} / 100</span></div>
                                  <div className="flex justify-between items-center">
                                    <span>Status:</span> 
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${getStatusColor(activePred.readiness_status)}`}>{activePred.readiness_status}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs opacity-50 py-2 text-center">No active readings analysis yet. Connect a device to this plot or farm.</div>
                              )}
                            </div>
                            
                            <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                              <div className="text-xs opacity-50 uppercase tracking-wider mb-2 font-bold">Marketplace Status</div>
                              {activePred?.bidding_status === 'OPEN' ? (
                                <div className="text-center text-blue-400 flex flex-col items-center">
                                  <ShoppingCart size={16} className="mb-1" />
                                  <div className="text-xs font-bold">Bidding is OPEN</div>
                                  <Link href="/dashboard/seller/bids"><Button size="sm" variant="secondary" className="mt-2 h-6 text-[10px]">View Bids</Button></Link>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <div className="text-xs opacity-60 mb-2">Bidding is CLOSED</div>
                                  <Button size="sm" variant="primary" className="h-6 text-[10px]" disabled={isOpeningBidding === alloc.id} onClick={() => handleOpenBidding(alloc.id)}>
                                    {isOpeningBidding === alloc.id ? <Loader2 size={12} className="animate-spin mr-1" /> : <Target size={12} className="mr-1" />} Open Bidding
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          {activePred && ['ALLOCATED', 'HARVEST_CONFIRMED'].includes(activePred.bidding_status) && (
                            <div className="border-t border-white/10 pt-3 flex gap-2">
                              {activePred.bidding_status === 'ALLOCATED' && (
                                <Button variant="secondary" size="sm" onClick={() => alert("To confirm harvest and setup pickup details, use the Manage Bids view.")}>
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
                                  else { setActionSuccess('Bids converted to trades!'); loadFarms(); }
                                }}>
                                  {convertingPredId === activePred.id ? <Loader2 size={14} className="animate-spin mr-1" /> : <ArrowRight size={14} className="mr-1" />}
                                  Convert to Trades
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-black/20 border-dashed border-white/10 rounded-lg">
                    <Sprout size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold opacity-80 mb-1">No crop plots declared.</p>
                    <p className="text-xs opacity-50 mb-4">Declare a crop plot to start IoT tracking and open buyer bidding.</p>
                    <Button variant="primary" size="sm" onClick={() => setShowCreateAllocation(true)}>
                      <Plus size={16} className="mr-2" />
                      Add Crop Plot
                    </Button>
                  </div>
                )}
                
                {actionError && <Alert variant="error" className="mt-4">{actionError}</Alert>}
                {actionSuccess && <Alert variant="success" className="mt-4">{actionSuccess}</Alert>}
              </Card>

            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-12">
              <div className="text-center">
                <MapPin size={48} className="mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold mb-2">Select a farm</h3>
                <p className="text-sm opacity-60">Click a farm from the list to view its connected devices, readings, and harvest readiness.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateFarm && profile?.id && (
        <RegisterFarmModal 
          userId={profile.id}
          googleMapsApiKey={mapsApiKey}
          onClose={() => setShowCreateFarm(false)}
          onSuccess={(newFarm) => {
            setShowCreateFarm(false);
            loadFarms();
            if (newFarm && newFarm[0]) setSelectedFarm(newFarm[0]);
          }}
        />
      )}

      {showRegisterDevice && selectedFarm && profile?.id && (
        <ConnectDeviceModal
          userId={profile.id}
          selectedFarm={selectedFarm}
          onClose={() => setShowRegisterDevice(false)}
          onSuccess={() => {
            setShowRegisterDevice(false);
            loadFarms();
          }}
        />
      )}

      {showCreateAllocation && selectedFarm && (
        <CreateCropAllocationModal
          farmId={selectedFarm.id}
          onClose={() => setShowCreateAllocation(false)}
          onSuccess={() => {
            setShowCreateAllocation(false);
            setActionSuccess('Crop plot created successfully.');
            loadFarms();
          }}
        />
      )}
    </PageContainer>
  );
}
