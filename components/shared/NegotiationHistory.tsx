'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { getBidNegotiationEvents } from '@/lib/api/farms';
import { Loader2, MessageSquare, History } from 'lucide-react';

export function NegotiationHistory({ bidId }: { bidId: string }) {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      const { data: payload, error } = await getBidNegotiationEvents(supabase, bidId);
      if (mounted) {
        if (error) {
          setError(error.message);
          setEvents([]);
        } else {
          const extractedEvents = Array.isArray(payload) ? payload : [];
          setEvents(extractedEvents);
        }
        setLoading(false);
      }
    };
    fetchHistory();
    return () => { mounted = false; };
  }, [bidId, supabase]);

  if (loading) {
    return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  if (error) {
    return <div className="text-sm text-red-400 p-2">{error}</div>;
  }

  const safeEvents = Array.isArray(events) ? events : [];

  if (safeEvents.length === 0) {
    return <div className="text-sm opacity-50 p-2">No negotiation activity yet.</div>;
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3 flex items-center gap-1">
        <History size={14} /> Negotiation History
      </h4>
      <div className="space-y-3">
        {safeEvents.map((evt: any) => {
          const isBuyer = evt.actor_role === 'BUYER';
          const isSystem = !evt.actor_role || evt.actor_role === 'SYSTEM';
          const alignClass = isSystem ? 'justify-center' : isBuyer ? 'justify-start' : 'justify-end';
          const bgClass = isSystem 
            ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' 
            : isBuyer 
              ? 'bg-yellow-500/10 border-yellow-500/20' 
              : 'bg-purple-500/10 border-purple-500/20';
          
          return (
            <div key={evt.id} className={`flex w-full ${alignClass}`}>
              <Card className={`p-3 max-w-[85%] sm:max-w-[70%] border ${bgClass}`}>
                <div className="flex justify-between items-center mb-1 gap-2">
                  <span className="text-xs font-bold uppercase">{evt.actor_role || 'SYSTEM'}</span>
                  <span className="text-[10px] opacity-60">{new Date(evt.created_at).toLocaleString()}</span>
                </div>
                
                <div className="text-sm font-medium mb-1">{(evt?.event_type || 'UNKNOWN').replace(/_/g, ' ')}</div>
                
                {(evt.offered_price_per_unit || evt.offered_quantity) ? (
                  <div className="text-xs opacity-80 grid grid-cols-2 gap-2 mt-2 bg-black/20 p-2 rounded">
                    {evt.offered_price_per_unit ? <div><span className="opacity-50">Price:</span> ₦{Number(evt.offered_price_per_unit).toLocaleString()}</div> : <div />}
                    {evt.offered_quantity ? <div><span className="opacity-50">Qty:</span> {evt.offered_quantity}</div> : <div />}
                  </div>
                ) : null}
                
                {evt.message && (
                  <div className="text-xs mt-2 italic opacity-90 flex items-start gap-1">
                    <MessageSquare size={12} className="mt-0.5 flex-shrink-0" />
                    &ldquo;{evt.message}&rdquo;
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
