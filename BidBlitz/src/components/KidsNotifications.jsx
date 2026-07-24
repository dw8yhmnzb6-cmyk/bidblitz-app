/**
 * BidBlitz V2 - Kids Notifications Component
 * Shows parent notifications about child activities
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, CheckCheck, X, Wallet, Lock, Unlock,
  AlertTriangle, ShoppingBag, Gift, Clock, RefreshCw, Loader2
} from 'lucide-react';
import { api } from '../services/api';

const KidsNotifications = ({ onClose, embedded = false }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.getKidsNotifications(50, false);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Real-time polling every 15 seconds
    const interval = setInterval(() => {
      loadNotifications();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await api.markKidsNotificationRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllKidsNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const getIcon = (eventType, severity) => {
    switch (eventType) {
      case 'child_payment':
        return <ShoppingBag size={16} className="text-red-400" />;
      case 'money_received':
        return <Gift size={16} className="text-green-400" />;
      case 'limit_warning':
        return <AlertTriangle size={16} className="text-yellow-400" />;
      case 'wallet_locked':
        return <Lock size={16} className="text-red-400" />;
      case 'wallet_unlocked':
        return <Unlock size={16} className="text-green-400" />;
      case 'payment_blocked':
        return <X size={16} className="text-red-400" />;
      default:
        return <Bell size={16} className="text-[#00C2FF]" />;
    }
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'alert':
        return 'border-red-500/20 bg-red-500/5';
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-500/5';
      default:
        return 'border-white/5 bg-white/[0.02]';
    }
  };

  const content = (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-[#00C2FF]" />
          <h3 className="text-sm font-semibold text-white">Benachrichtigungen</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#00C2FF] text-black text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-white/5"
          >
            <RefreshCw size={14} className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[10px] text-[#00C2FF] font-medium"
            >
              Alle gelesen
            </button>
          )}
          {onClose && !embedded && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="text-[#00C2FF] animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-8 rounded-xl bg-white/[0.01] border border-dashed border-white/5">
          <Bell size={24} className="text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Keine Benachrichtigungen</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl border ${getSeverityStyle(notification.severity)} ${
                !notification.is_read ? 'ring-1 ring-[#00C2FF]/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notification.severity === 'alert' ? 'bg-red-500/10' :
                  notification.severity === 'warning' ? 'bg-yellow-500/10' :
                  'bg-[#00C2FF]/10'
                }`}>
                  {getIcon(notification.event_type, notification.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-semibold text-white">{notification.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{notification.message}</p>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkRead(notification.id)}
                        className="p-1 rounded hover:bg-white/5 flex-shrink-0"
                        title="Als gelesen markieren"
                      >
                        <Check size={12} className="text-[#00C2FF]" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-500">
                      {new Date(notification.created_at).toLocaleDateString('de-DE', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    {notification.child_name && (
                      <>
                        <span className="text-[10px] text-gray-600">•</span>
                        <span className="text-[10px] text-[#00C2FF]">{notification.child_name}</span>
                      </>
                    )}
                    {notification.amount && (
                      <>
                        <span className="text-[10px] text-gray-600">•</span>
                        <span className="text-[10px] font-medium text-white">€{notification.amount.toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-[#0A0A0A] rounded-2xl border border-white/10 p-4 max-h-[80vh] overflow-hidden"
      >
        {content}
      </motion.div>
    </motion.div>
  );
};

export default KidsNotifications;
