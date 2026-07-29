import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Alert } from '../ui/Alert';
import { createClient } from '@/lib/supabase/client';
import { placeHarvestBid } from '@/lib/api/buyer';
import { Loader2 } from 'lucide-react';

interface HarvestBidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  opportunity: any;
}

export function HarvestBidModal({ isOpen, onClose, onSuccess, opportunity }: HarvestBidModalProps) {
  const supabase = createClient();
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !opportunity) return null;

  const minPrice = opportunity.minimum_price_per_unit || 0;
  const availableQty = opportunity.expected_quantity_volume || 0;
  const unit = opportunity.expected_quantity_unit || 'units';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const qtyNum = parseInt(quantity);
    const priceNum = parseFloat(price);

    if (qtyNum <= 0 || qtyNum > availableQty) {
      setError(`Quantity must be between 1 and ${availableQty} ${unit}`);
      return;
    }
    
    if (minPrice > 0 && priceNum < minPrice) {
      setError(`Bid price cannot be lower than the minimum price (₦${minPrice})`);
      return;
    }

    setSubmitting(true);
    const { error: apiError } = await placeHarvestBid(supabase, {
      predictionId: opportunity.id,
      quantity: qtyNum,
      pricePerUnit: priceNum
    });
    setSubmitting(false);

    if (apiError) {
      setError(apiError.message || 'Failed to place bid.');
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2">Place Bid</h2>
        <p className="text-sm opacity-80 mb-6 border-b border-white/10 pb-4">
          Bidding on {opportunity.farms?.crop_type} from {opportunity.bidding_origin === 'IOT' ? 'IoT Prediction' : 'Manual Listing'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error" title="Error">{error}</Alert>}

          <div className="bg-black/20 p-3 rounded-lg mb-4 flex justify-between">
            <div>
              <div className="text-xs opacity-70">Available</div>
              <div className="font-bold">{availableQty} {unit}</div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-70">Min Price</div>
              <div className="font-bold text-yellow-400">
                {minPrice > 0 ? `₦${minPrice} / ${unit}` : 'Negotiable'}
              </div>
            </div>
          </div>

          <div>
            <Label>Your Bid Quantity ({unit})</Label>
            <Input 
              type="number" 
              required 
              min="1" 
              max={availableQty}
              value={quantity} 
              onChange={(e) => setQuantity(e.target.value)} 
              placeholder={`Max: ${availableQty}`}
            />
          </div>

          <div>
            <Label>Your Price per {unit} (₦)</Label>
            <Input 
              type="number" 
              required 
              min={minPrice > 0 ? minPrice : 1} 
              step="0.01"
              value={price} 
              onChange={(e) => setPrice(e.target.value)} 
              placeholder={`Min: ₦${minPrice}`}
            />
          </div>
          
          <div className="pt-4 border-t border-white/10">
            <div className="flex justify-between items-center mb-6">
              <span className="opacity-80">Total Estimated Cost:</span>
              <span className="font-bold text-xl">₦{((parseInt(quantity) || 0) * (parseFloat(price) || 0)).toLocaleString()}</span>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
                Submit Bid
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
