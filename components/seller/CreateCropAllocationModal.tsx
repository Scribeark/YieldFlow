import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createCropAllocationDraft } from '@/lib/api/farms';
import { CheckCircle } from 'lucide-react';

const CROP_OPTIONS = [
  'Maize',
  'Rice',
  'Cassava',
  'Yam',
  'Sorghum',
  'Tomatoes',
  'Other'
];

interface CreateCropAllocationModalProps {
  farmId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function CreateCropAllocationModal({ farmId, onSuccess, onClose }: CreateCropAllocationModalProps) {
  const supabase = createClient();
  
  const [cropTypeSelect, setCropTypeSelect] = useState('Maize');
  const [customCropType, setCustomCropType] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [maturityDays, setMaturityDays] = useState('120');
  const [landSizeValue, setLandSizeValue] = useState('');
  const [landSizeUnit, setLandSizeUnit] = useState('hectares');
  const [expectedHarvestMin, setExpectedHarvestMin] = useState('');
  const [expectedHarvestMax, setExpectedHarvestMax] = useState('');
  const [expectedHarvestUnit, setExpectedHarvestUnit] = useState('kg');
  const [minimumPricePerUnit, setMinimumPricePerUnit] = useState('');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPlot, setCreatedPlot] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const finalCropType = cropTypeSelect === 'Other' ? customCropType.trim() : cropTypeSelect;
    
    if (!finalCropType) {
      setError('Please enter a crop type.');
      return;
    }

    setSubmitting(true);
    
    const { error: apiError } = await createCropAllocationDraft(supabase, {
      farmId,
      cropType: finalCropType,
      plantingDate: plantingDate || undefined,
      expectedMaturityDays: maturityDays ? parseInt(maturityDays, 10) : undefined,
      landSizeValue: landSizeValue ? parseFloat(landSizeValue) : undefined,
      landSizeUnit: landSizeValue ? landSizeUnit : undefined,
      expectedHarvestMin: expectedHarvestMin ? parseInt(expectedHarvestMin, 10) : undefined,
      expectedHarvestMax: expectedHarvestMax ? parseInt(expectedHarvestMax, 10) : undefined,
      expectedHarvestUnit: expectedHarvestUnit,
      minimumPricePerUnit: minimumPricePerUnit ? parseFloat(minimumPricePerUnit) : undefined,
      notes: notes || undefined
    });
    
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to create crop allocation.');
    } else {
      setCreatedPlot(true);
    }
  };

  const resetForm = () => {
    setCropTypeSelect('Maize');
    setCustomCropType('');
    setPlantingDate('');
    setMaturityDays('120');
    setLandSizeValue('');
    setLandSizeUnit('hectares');
    setExpectedHarvestMin('');
    setExpectedHarvestMax('');
    setExpectedHarvestUnit('kg');
    setMinimumPricePerUnit('');
    setNotes('');
    setCreatedPlot(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col p-0 border border-white/10 shadow-2xl">
        <div className="p-5 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[var(--card-bg)] z-10">
          <div>
            <h2 className="text-xl font-bold">Declare Crop Plot</h2>
            <p className="text-sm opacity-70">Register a specific crop planted on this farm.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}

          {createdPlot ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
              <h3 className="text-xl font-bold mb-2">Crop Plot Declared!</h3>
              <p className="text-sm opacity-70 mb-6">Your crop plot has been successfully added to this farm.</p>
              
              <div className="flex flex-col gap-3">
                <Button variant="primary" onClick={resetForm}>
                  Add Another Crop Plot
                </Button>
                <Button variant="secondary" onClick={() => onSuccess()}>
                  Finish and Return
                </Button>
              </div>
            </div>
          ) : (
            <form id="create-allocation-form" onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label>Crop Type</Label>
                <Select required value={cropTypeSelect} onChange={(e) => setCropTypeSelect(e.target.value)}>
                  {CROP_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
                {cropTypeSelect === 'Other' && (
                  <div className="mt-2">
                    <Input 
                      required 
                      value={customCropType} 
                      onChange={(e) => setCustomCropType(e.target.value)} 
                      placeholder="Enter custom crop type" 
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Planting Date</Label>
                  <Input type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
                </div>
                <div>
                  <Label>Expected Maturity (Days)</Label>
                  <Input type="number" min="1" value={maturityDays} onChange={(e) => setMaturityDays(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                <div>
                  <Label>Plot Size (Optional)</Label>
                  <Input type="number" step="0.01" min="0" value={landSizeValue} onChange={(e) => setLandSizeValue(e.target.value)} placeholder="e.g. 2.5" />
                </div>
                <div>
                  <Label>Size Unit</Label>
                  <Select value={landSizeUnit} onChange={(e) => setLandSizeUnit(e.target.value)}>
                    <option value="hectares">Hectares</option>
                    <option value="acres">Acres</option>
                    <option value="square_meters">Square Meters</option>
                    <option value="plots">Plots</option>
                  </Select>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-4">
                <h3 className="text-sm font-bold mb-2 opacity-80">Expected Harvest (Optional, for Pre-Bidding)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min Quantity</Label>
                    <Input type="number" min="0" value={expectedHarvestMin} onChange={(e) => setExpectedHarvestMin(e.target.value)} placeholder="e.g. 5000" />
                  </div>
                  <div>
                    <Label>Max Quantity</Label>
                    <Input type="number" min="0" value={expectedHarvestMax} onChange={(e) => setExpectedHarvestMax(e.target.value)} placeholder="e.g. 6000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Weight Unit</Label>
                    <Select value={expectedHarvestUnit} onChange={(e) => setExpectedHarvestUnit(e.target.value)}>
                      <option value="kg">kg</option>
                      <option value="tons">Tons</option>
                      <option value="bags">Bags</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Min Price / Unit (Optional)</Label>
                    <Input type="number" step="0.01" min="0" value={minimumPricePerUnit} onChange={(e) => setMinimumPricePerUnit(e.target.value)} placeholder="e.g. 150.00" />
                  </div>
                </div>
              </div>
              
              <div className="border-t border-white/10 pt-4">
                <Label>Notes / Description (Optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special notes about this crop plot?" />
              </div>

            </form>
          )}
        </div>

        {!createdPlot && (
          <div className="p-5 border-t border-white/10 flex justify-end space-x-3 sticky bottom-0 bg-[var(--card-bg)] z-10">
            <Button type="button" variant="ghost" onClick={() => onSuccess()} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="create-allocation-form" variant="primary" disabled={submitting}>
              {submitting && <Loader2 size={16} className="animate-spin mr-2" />}
              Declare Plot
            </Button>
          </div>
        )}


      </Card>
    </div>
  );
}
