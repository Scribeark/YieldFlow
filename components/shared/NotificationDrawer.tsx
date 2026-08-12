'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { getNotifications, markNotificationRead, markAllNotificationsRead, NotificationItem } from '@/lib/api/notifications';
import { Bell, CheckCheck, X, Loader2, Info, AlertTriangle, CheckCircle } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshCount?: () => void;
}

export function NotificationDrawer({ isOpen, onClose, onRefreshCount }: NotificationDrawerProps) {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const { data } = await getNotifications(supabase);
    setNotifications(data || []);
    setLoading(false);
    if (onRefreshCount) onRefreshCount();
  }, [supabase, onRefreshCount]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(supabase, id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    if (onRefreshCount) onRefreshCount();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(supabase);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    if (onRefreshCount) onRefreshCount();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-end">
      <div className="w-full max-w-md bg-[var(--agri-card-bg)] border-l border-white/10 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-2">
            <Bell className="text-[var(--agri-primary)]" size={20} />
            <h3 className="font-bold text-lg">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.is_read) && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-xs gap-1 opacity-80 hover:opacity-100">
                <CheckCheck size={14} /> Mark all read
              </Button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-sm opacity-60">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-sm opacity-50">No notifications yet.</div>
          ) : (
            notifications.map((item) => (
              <Card
                key={item.id}
                className={`p-3 border-l-4 transition-all ${
                  item.is_read ? 'opacity-70 border-l-gray-500 bg-white/5' : 'border-l-[var(--agri-primary)] bg-[var(--agri-primary)]/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {item.event_type.includes('CANCEL') ? (
                        <AlertTriangle size={14} className="text-red-400 shrink-0" />
                      ) : item.event_type.includes('CONFIRM') || item.event_type.includes('ACCEPT') ? (
                        <CheckCircle size={14} className="text-green-400 shrink-0" />
                      ) : (
                        <Info size={14} className="text-blue-400 shrink-0" />
                      )}
                      <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                        {item.event_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm">{item.message}</p>
                    <span className="text-[10px] opacity-50 block mt-2">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>

                  {!item.is_read && (
                    <button
                      onClick={() => handleMarkRead(item.id)}
                      title="Mark as read"
                      className="p-1 text-xs text-[var(--agri-primary)] hover:underline opacity-80 shrink-0"
                    >
                      Read
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
