import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { X, Loader2, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { startHarvestAnalysis } from '@/lib/api/farms';
import { format, addDays } from 'date-fns';

interface StartHarvestAnalysisModalProps {
  farm: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function StartHarvestAnalysisModal({ farm, onClose, onSuccess }: StartHarvestAnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [cropType, setCropType] = useState(farm.crop_type !== 'Unknown Crop' ? farm.crop_type : '');
  const [minQuantity, setMinQuantity] = useState<number | ''>('');
  const [maxQuantity, setMaxQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('kg');
  
  const expectedMaturityDate = farm.planting_date && farm.expected_maturity_days 
    ? addDays(new Date(farm.planting_date), farm.expected_maturity_days)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!cropType.trim() || cropType === 'Unknown Crop') {
      setError('Please provide a valid crop type.');
      return;
    }
    
    if (!minQuantity || Number(minQuantity) <= 0) {
      setError('Minimum expected quantity must be greater than 0.');
      return;
    }
    
    if (!maxQuantity || Number(maxQuantity) < Number(minQuantity)) {
      setError('Maximum expected quantity must be greater than or equal to minimum.');
      return;
    }
    
    if (!expectedMaturityDate) {
      setError('Farm is missing planting date or expected maturity days. Please update farm details first.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: apiError } = await startHarvestAnalysis(supabase, farm.id, {
        cropType,
        minQuantity: Number(minQuantity),
        maxQuantity: Number(maxQuantity),
        unit
      });

      if (apiError) throw new Error(apiError.message);
      
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to start harvest analysis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg bg-gray-900 border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
          <h3 className="font-bold text-lg">Start Harvest Analysis</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto">
          <p className="text-sm text-gray-300 mb-6">
            Configure the expected harvest parameters for <span className="font-bold text-white">{farm.name}</span>. 
            This information will be displayed to buyers when readiness reaches the bidding threshold.
          </p>

          {error && <Alert variant="error" className="mb-4">{error}</Alert>}

          <form id="start-analysis-form" onSubmit={handleSubmit} className="space-y-4">
            
            <div className="p-3 bg-white/5 rounded-lg border border-white/10 mb-2">
              <div className="flex items-center text-sm text-gray-300 mb-1">
                <Calendar size={14} className="mr-2" />
                Expected Maturity Timeline
              </div>
              <div className="font-medium">
                {expectedMaturityDate ? (
                  <span className="text-green-400">{format(expectedMaturityDate, 'MMM d, yyyy')}</span>
                ) : (
                  <span className="text-red-400">Missing planting date or maturity timeline.</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Based on {farm.expected_maturity_days || '?'} days from planting.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Crop Type</label>
              <input 
                type="text" 
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                placeholder="e.g. Arabica Coffee, Cassava"
                className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Min Expected Quantity</label>
                <input 
                  type="number" 
                  min="1"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Max Expected Quantity</label>
                <input 
                  type="number" 
                  min={minQuantity || 1}
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Unit of Measurement</label>
              <select 
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                required
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="tons">Tons</option>
                <option value="lbs">Pounds (lbs)</option>
                <option value="units">Units</option>
              </select>
            </div>
            
          </form>
        </div>
        
        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end space-x-3">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="start-analysis-form" variant="primary" disabled={loading || !expectedMaturityDate}>
            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            Start Analysis
          </Button>
        </div>
      </Card>
    </div>
  );
}
