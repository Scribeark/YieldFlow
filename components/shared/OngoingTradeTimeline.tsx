import React from 'react';
import { CheckCircle, Clock, Truck } from 'lucide-react';

interface TimelineProps {
  requestStatus: string;
  sellerPickupConfirmedAt: string | null;
  carrierPickupConfirmedAt: string | null;
  carrierDeliveryConfirmedAt: string | null;
  buyerDeliveryConfirmedAt: string | null;
  role: 'seller' | 'buyer' | 'carrier';
  onConfirmSellerPickup?: () => void;
  onConfirmCarrierPickup?: () => void;
  onConfirmCarrierDelivery?: () => void;
  onConfirmBuyerDelivery?: () => void;
  isConfirming?: boolean;
}

export function OngoingTradeTimeline({
  requestStatus,
  sellerPickupConfirmedAt,
  carrierPickupConfirmedAt,
  carrierDeliveryConfirmedAt,
  buyerDeliveryConfirmedAt,
  role,
  onConfirmSellerPickup,
  onConfirmCarrierPickup,
  onConfirmCarrierDelivery,
  onConfirmBuyerDelivery,
  isConfirming = false
}: TimelineProps) {
  
  const isAllocated = requestStatus === 'ALLOCATED';
  const isDispatched = requestStatus === 'DISPATCHED';
  const isFulfilled = requestStatus === 'FULFILLED';
  const isSearching = requestStatus === 'SEARCHING_LOGISTICS';

  const sellerConfirmedPickup = sellerPickupConfirmedAt !== null;
  const carrierConfirmedPickup = carrierPickupConfirmedAt !== null;
  const carrierConfirmedDelivery = carrierDeliveryConfirmedAt !== null;
  const buyerConfirmedDelivery = buyerDeliveryConfirmedAt !== null;

  return (
    <div className="w-full border rounded-lg bg-[var(--card-bg)] p-4 shadow-sm mt-4">
      <h4 className="font-bold mb-4 flex items-center gap-2">
        <Truck className="w-5 h-5 text-indigo-500" />
        Ongoing Trip Status
      </h4>
      
      <div className="space-y-4">
        {/* Phase 1: Carrier Assignment */}
        <div className={`p-3 rounded-md border ${isSearching ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} dark:bg-black/20 dark:border-gray-800`}>
          <div className="font-semibold text-sm flex items-center justify-between">
            <span>Phase 1: Carrier Assignment</span>
            {isSearching ? <span className="text-blue-600 text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> Waiting for carrier</span> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
          </div>
          {(isAllocated || isDispatched || isFulfilled) && (
            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" /> Carrier assigned and dispatched.
            </div>
          )}
        </div>

        {/* Phase 2: Pickup Handover */}
        <div className={`p-3 rounded-md border ${(isAllocated && !isDispatched && !isFulfilled) ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'} dark:bg-black/20 dark:border-gray-800`}>
          <div className="font-semibold text-sm flex items-center justify-between mb-2">
            <span>Phase 2: Pickup Handover</span>
            {(isDispatched || isFulfilled) ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-gray-400" />}
          </div>
          
          <div className="space-y-2 text-sm">
            {/* Seller confirmation UI */}
            <div className="flex items-center justify-between p-2 bg-white dark:bg-black/40 rounded border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-4 h-4 ${sellerConfirmedPickup ? 'text-emerald-500' : 'text-gray-300'}`} />
                <span className={sellerConfirmedPickup ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}>Seller handed over goods</span>
              </div>
              {role === 'seller' && (isAllocated || isDispatched || isFulfilled || sellerConfirmedPickup) && (
                <button 
                  onClick={onConfirmSellerPickup} 
                  disabled={isConfirming || sellerConfirmedPickup} 
                  className={`px-3 py-1 text-xs rounded transition-colors ${sellerConfirmedPickup ? 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:border-gray-700' : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'}`}
                >
                  {sellerConfirmedPickup ? 'Confirmed' : isConfirming ? 'Confirming...' : 'Confirm Goods Handed Over'}
                </button>
              )}
            </div>

            {/* Carrier confirmation UI */}
            <div className="flex items-center justify-between p-2 bg-white dark:bg-black/40 rounded border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-4 h-4 ${carrierConfirmedPickup ? 'text-emerald-500' : 'text-gray-300'}`} />
                <span className={carrierConfirmedPickup ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}>Carrier received goods</span>
              </div>
              {role === 'carrier' && (isAllocated || isDispatched || isFulfilled || carrierConfirmedPickup) && (
                <button 
                  onClick={onConfirmCarrierPickup} 
                  disabled={isConfirming || carrierConfirmedPickup} 
                  className={`px-3 py-1 text-xs rounded transition-colors ${carrierConfirmedPickup ? 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:border-gray-700' : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'}`}
                >
                  {carrierConfirmedPickup ? 'Confirmed' : isConfirming ? 'Confirming...' : 'Confirm Goods Received From Seller'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Phase 3: Delivery Handover */}
        <div className={`p-3 rounded-md border ${(isDispatched && !isFulfilled) ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'} dark:bg-black/20 dark:border-gray-800`}>
          <div className="font-semibold text-sm flex items-center justify-between mb-2">
            <span>Phase 3: Delivery Handover</span>
            {isFulfilled ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-gray-400" />}
          </div>
          
          <div className="space-y-2 text-sm">
            {/* Carrier confirmation UI */}
            <div className="flex items-center justify-between p-2 bg-white dark:bg-black/40 rounded border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-4 h-4 ${carrierConfirmedDelivery ? 'text-emerald-500' : 'text-gray-300'}`} />
                <span className={carrierConfirmedDelivery ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}>Carrier delivered goods</span>
              </div>
              {role === 'carrier' && (isDispatched || isFulfilled || carrierConfirmedDelivery) && (
                <button 
                  onClick={onConfirmCarrierDelivery} 
                  disabled={isConfirming || carrierConfirmedDelivery} 
                  className={`px-3 py-1 text-xs rounded transition-colors ${carrierConfirmedDelivery ? 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:border-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'}`}
                >
                  {carrierConfirmedDelivery ? 'Confirmed' : isConfirming ? 'Confirming...' : 'Confirm Goods Delivered'}
                </button>
              )}
            </div>

            {/* Buyer confirmation UI */}
            <div className="flex items-center justify-between p-2 bg-white dark:bg-black/40 rounded border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-4 h-4 ${buyerConfirmedDelivery ? 'text-emerald-500' : 'text-gray-300'}`} />
                <span className={buyerConfirmedDelivery ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}>Buyer received goods</span>
              </div>
              {role === 'buyer' && (isDispatched || isFulfilled || buyerConfirmedDelivery) && (
                <button 
                  onClick={onConfirmBuyerDelivery} 
                  disabled={isConfirming || buyerConfirmedDelivery} 
                  className={`px-3 py-1 text-xs rounded transition-colors ${buyerConfirmedDelivery ? 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:border-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'}`}
                >
                  {buyerConfirmedDelivery ? 'Confirmed' : isConfirming ? 'Confirming...' : 'Confirm Goods Received'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Phase 4: Completion */}
        <div className={`p-3 rounded-md border ${isFulfilled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'} dark:bg-black/20 dark:border-gray-800`}>
           <div className="font-semibold text-sm flex items-center justify-between">
            <span>Phase 4: Completion</span>
            {isFulfilled ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-gray-400" />}
          </div>
          {isFulfilled && (
            <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded border border-emerald-200">
              Sale and delivery completed. Settlement pending (payment disbursement will be processed in a future phase).
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
