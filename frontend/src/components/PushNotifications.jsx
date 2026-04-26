/**
 * BidBlitz V2 - Push Notifications Manager
 * Requests permission, subscribes to push, handles notifications
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function usePushNotifications() {
  const [permission, setPermission] = useState(Notification.permission);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Failed to check push subscription:', err);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    if (permission === 'denied') {
      toast.error('Push-Benachrichtigungen wurden blockiert. Bitte in den Browser-Einstellungen aktivieren.');
      return false;
    }

    setLoading(true);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error('Push-Benachrichtigungen abgelehnt');
        setLoading(false);
        return false;
      }

      // Get VAPID public key from backend
      const vapidRes = await fetch(`${API_URL}/api/push/vapid-public-key`, {
        credentials: 'include'
      });
      const { publicKey } = await vapidRes.json();

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to backend
      const res = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(subscription.toJSON())
      });

      if (!res.ok) throw new Error('Subscription failed');

      setIsSubscribed(true);
      toast.success('🔔 Push-Benachrichtigungen aktiviert!');
      return true;

    } catch (err) {
      console.error('Push subscription error:', err);
      toast.error('Fehler beim Aktivieren der Benachrichtigungen');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from backend
        await fetch(`${API_URL}/api/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(subscription.toJSON())
        });

        // Unsubscribe from browser
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast.success('Push-Benachrichtigungen deaktiviert');
      return true;

    } catch (err) {
      console.error('Unsubscribe error:', err);
      toast.error('Fehler beim Deaktivieren');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      const res = await fetch(`${API_URL}/api/push/test`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.detail || 'Test fehlgeschlagen');
        return;
      }
      
      toast.success(`Test-Benachrichtigung gesendet an ${data.sent} Gerät(e)!`);
    } catch (err) {
      console.error('Test notification error:', err);
      toast.error('Test fehlgeschlagen');
    }
  };

  return {
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification,
    isSupported: 'serviceWorker' in navigator && 'PushManager' in window
  };
}

// Permission Request Modal Component
export function PushPermissionModal({ isOpen, onClose, onAccept }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-[#0A0A0F] border border-white/10 rounded-3xl p-6 max-w-sm w-full"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#00C2FF]/10 flex items-center justify-center mx-auto mb-4">
              <Bell size={32} className="text-[#00C2FF]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Benachrichtigungen aktivieren
            </h2>
            <p className="text-sm text-gray-400">
              Erhalte Echtzeit-Benachrichtigungen für:
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                🆘
              </div>
              <span>SOS-Alarme von Kindern</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                🚨
              </div>
              <span>Geofencing-Verstöße</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                🔋
              </div>
              <span>Niedriger Akku-Stand</span>
            </div>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/5 text-white text-sm font-medium"
            >
              Später
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onAccept}
              className="flex-1 py-3 rounded-xl bg-[#00C2FF] text-black text-sm font-bold"
            >
              Aktivieren
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Settings Toggle Component
export function PushNotificationToggle() {
  const { permission, isSubscribed, loading, subscribe, unsubscribe, sendTestNotification, isSupported } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-xs text-yellow-400">
          Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
        </p>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <Bell size={20} className="text-[#00C2FF]" />
          ) : (
            <BellOff size={20} className="text-gray-500" />
          )}
          <div>
            <p className="text-sm font-semibold text-white">Push-Benachrichtigungen</p>
            <p className="text-xs text-gray-500">
              {isSubscribed ? 'Aktiviert' : 'Deaktiviert'}
            </p>
          </div>
        </div>
        
        <motion.button
          onClick={handleToggle}
          disabled={loading}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-6 rounded-full relative transition-all ${
            isSubscribed ? 'bg-[#00C2FF]' : 'bg-white/10'
          }`}
        >
          {loading ? (
            <Loader2 size={14} className="absolute inset-0 m-auto animate-spin text-white" />
          ) : (
            <motion.div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
              animate={{ left: isSubscribed ? 'calc(100% - 22px)' : '2px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </motion.button>
      </div>

      {isSubscribed && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={sendTestNotification}
          className="w-full py-3 rounded-xl bg-white/5 text-[#00C2FF] text-sm font-medium hover:bg-white/10 transition-all"
        >
          Test-Benachrichtigung senden
        </motion.button>
      )}
    </div>
  );
}
