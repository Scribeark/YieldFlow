'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { getSellerFarms, recordFarmActivity } from '@/lib/api/farms';
import { Loader2, Plus, FileText, CheckCircle, Activity, Camera, Droplets, Bug, Sprout, List } from 'lucide-react';

const ACTIVITY_TYPES = [
  'Irrigation', 'Fertiliser application', 'Weeding', 'Pest inspection',
  'Pesticide application', 'Disease inspection', 'Disease treatment',
  'Soil inspection', 'Crop growth inspection', 'Harvest preparation',
  'General farm inspection', 'Other'
];

export default function FarmRecordsPage() {
  const { profile } = useAuthStore();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [activities, setActivities] = useState<any[]>([]);
  
  const [showLogForm, setShowLogForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().substring(0, 16));
  const [payload, setPayload] = useState<any>({});

  const loadFarms = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await getSellerFarms(supabase, profile.id);
    if (error) {
      setError(error.message);
    } else if (data) {
      setFarms(data);
      if (data.length > 0) {
        setSelectedFarmId(data[0].id);
      }
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadFarms(); }, [loadFarms]);

  const loadActivities = useCallback(async () => {
    if (!selectedFarmId) return;
    const { data, error } = await supabase
      .from('farm_activity_logs')
      .select('*')
      .eq('farm_id', selectedFarmId)
      .order('recorded_at', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      // Filter by crop allocation if one is selected
      if (selectedCropId) {
        setActivities(data.filter(a => a.crop_allocation_id === selectedCropId || !a.crop_allocation_id));
      } else {
        setActivities(data);
      }
    }
  }, [selectedFarmId, selectedCropId]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  const handlePayloadChange = (field: string, value: string) => {
    setPayload((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) return setError('Please select a farm');
    
    setSubmitting(true);
    setError('');
    
    const { error: submitError } = await recordFarmActivity(supabase, {
      farmId: selectedFarmId,
      cropAllocationId: selectedCropId || undefined,
      activityType,
      recordedAt: new Date(recordedAt).toISOString(),
      payload
    });

    if (submitError) {
      setError(submitError.message);
    } else {
      setSuccessMsg('Activity logged successfully');
      setShowLogForm(false);
      setPayload({});
      loadActivities();
      setTimeout(() => setSuccessMsg(''), 3000);
    }
    setSubmitting(false);
  };

  const selectedFarm = farms.find(f => f.id === selectedFarmId);
  const cropAllocations = selectedFarm?.farm_crop_allocations || [];
  
  // Calculate IoT independent readiness
  const recentActivities = activities.slice(0, 10);
  const readinessScore = Math.min(100, (recentActivities.length * 10) + (cropAllocations.length * 10));
  const hasIoT = (selectedFarm?.iot_devices || []).length > 0;

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Farm Condition & Digital Records</h1>
          <p className="opacity-70 mt-1">Log activities and maintain your digital farm journal.</p>
        </div>
        <Button variant="primary" onClick={() => setShowLogForm(!showLogForm)}>
          <Plus size={16} className="mr-2" /> Log Activity
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {successMsg && <Alert variant="success" className="mb-4">{successMsg}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-1 md:col-span-2">
          <h2 className="text-lg font-bold mb-4">Select Farm & Crop</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Farm</label>
              <Select value={selectedFarmId} onChange={(e: any) => setSelectedFarmId(e.target.value)}>
                <option value="">-- Select Farm --</option>
                {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Crop Allocation (Optional)</label>
              <Select value={selectedCropId} onChange={(e: any) => setSelectedCropId(e.target.value)} disabled={!selectedFarmId}>
                <option value="">-- All / General --</option>
                {cropAllocations.map((c: any) => <option key={c.id} value={c.id}>{c.crop_type}</option>)}
              </Select>
            </div>
          </div>
        </Card>
        
        <Card className="col-span-1 bg-black/20">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Activity size={18} className="text-blue-400" /> Farm Readiness
          </h2>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-70">Readiness Indicator</span>
              <span className="font-bold">{readinessScore}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${readinessScore}%` }}></div>
            </div>
          </div>
          <p className="text-xs opacity-60">Based on recent activity logs and digital records. Visible to buyers as condition evidence.</p>
          
          {hasIoT && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold flex items-center gap-2 text-green-400">
                <Activity size={14} /> Live IoT Sensors Active
              </h3>
              <p className="text-xs opacity-60 mt-1">Providing real-time condition data to buyers.</p>
            </div>
          )}
        </Card>
      </div>

      {showLogForm && (
        <Card className="mb-8 border-primary/30">
          <h2 className="text-xl font-bold mb-4">Log New Activity</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Activity Type</label>
                <Select value={activityType} onChange={(e: any) => setActivityType(e.target.value)} required>
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Date & Time</label>
                <Input type="datetime-local" value={recordedAt} onChange={(e: any) => setRecordedAt(e.target.value)} required />
              </div>
            </div>

            {/* Dynamic Fields based on Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-white/10">
              {(activityType.includes('inspection') || activityType.includes('Harvest')) && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Crop Condition</label>
                    <Select value={payload.crop_condition || ''} onChange={(e: any) => handlePayloadChange('crop_condition', e.target.value)}>
                      <option value="">-- Select --</option>
                      <option value="Poor">Poor</option><option value="Fair">Fair</option><option value="Good">Good</option><option value="Excellent">Excellent</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Soil Condition</label>
                    <Select value={payload.soil_condition || ''} onChange={(e: any) => handlePayloadChange('soil_condition', e.target.value)}>
                      <option value="">-- Select --</option>
                      <option value="Very dry">Very dry</option><option value="Dry">Dry</option><option value="Normal">Normal</option><option value="Wet">Wet</option><option value="Waterlogged">Waterlogged</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Growth Stage</label>
                    <Input placeholder="e.g. Vegetative, Flowering" value={payload.growth_stage || ''} onChange={(e: any) => handlePayloadChange('growth_stage', e.target.value)} />
                  </div>
                </>
              )}

              {activityType === 'Irrigation' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Irrigation Adequacy</label>
                    <Select value={payload.irrigation_adequacy || ''} onChange={(e: any) => handlePayloadChange('irrigation_adequacy', e.target.value)}>
                      <option value="">-- Select --</option>
                      <option value="Insufficient">Insufficient</option><option value="Partial">Partial</option><option value="Adequate">Adequate</option><option value="Excessive">Excessive</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Water Quantity (Litres)</label>
                    <Input type="number" min="0" value={payload.water_quantity || ''} onChange={(e: any) => handlePayloadChange('water_quantity', e.target.value)} />
                  </div>
                </>
              )}

              {(activityType.includes('application') || activityType.includes('treatment')) && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Input Name (Fertilizer/Chemical)</label>
                    <Input value={payload.input_name || ''} onChange={(e: any) => handlePayloadChange('input_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Quantity</label>
                    <Input type="number" min="0" value={payload.input_quantity || ''} onChange={(e: any) => handlePayloadChange('input_quantity', e.target.value)} />
                  </div>
                </>
              )}

              {(activityType.includes('Pest') || activityType.includes('Disease')) && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Issue Name</label>
                    <Input value={payload.pest_issue || ''} onChange={(e: any) => handlePayloadChange('pest_issue', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Severity</label>
                    <Select value={payload.pest_severity || ''} onChange={(e: any) => handlePayloadChange('pest_severity', e.target.value)}>
                      <option value="">-- Select --</option>
                      <option value="None">None</option><option value="Low">Low</option><option value="Moderate">Moderate</option><option value="High">High</option>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-white/10">
              <label className="text-sm font-medium mb-1 block">Notes / Action Taken</label>
              <textarea 
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
                value={payload.notes || ''}
                onChange={(e) => handlePayloadChange('notes', e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowLogForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                Save Record
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Timeline */}
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <List size={20} className="text-primary" /> Activity Timeline
      </h2>
      
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : activities.length === 0 ? (
        <Card className="text-center p-12 opacity-60">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p>No activities recorded for this selection yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {activities.map((act) => (
            <Card key={act.id} className="border-l-4 border-l-primary flex flex-col md:flex-row justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg">{act.activity_type}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 opacity-70">
                    {new Date(act.recorded_at).toLocaleString()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm mt-3 opacity-80">
                  {act.crop_condition && <div><span className="opacity-60 text-xs block">Crop Condition</span> {act.crop_condition}</div>}
                  {act.soil_condition && <div><span className="opacity-60 text-xs block">Soil Condition</span> {act.soil_condition}</div>}
                  {act.growth_stage && <div><span className="opacity-60 text-xs block">Growth Stage</span> {act.growth_stage}</div>}
                  {act.irrigation_adequacy && <div><span className="opacity-60 text-xs block">Irrigation</span> {act.irrigation_adequacy} {act.water_quantity ? `(${act.water_quantity}L)` : ''}</div>}
                  {act.input_name && <div><span className="opacity-60 text-xs block">Input Applied</span> {act.input_name} {act.input_quantity ? `(${act.input_quantity})` : ''}</div>}
                  {act.pest_issue && <div><span className="opacity-60 text-xs block">Pest/Disease</span> {act.pest_issue} ({act.pest_severity})</div>}
                </div>
                
                {act.notes && (
                  <div className="mt-4 p-3 bg-black/20 rounded text-sm italic border-l-2 border-white/20">
                    "{act.notes}"
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
