// Push Notification Settings Component
import { useState, useEffect } from 'react';
import { Bell, BellOff, Check, X, Zap, Trophy, AlertCircle, Gift, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PushNotificationSettings({ token }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [settings, setSettings] = useState({
    auction_ending: true,
    outbid: true,
    won: true,
    new_auctions: true,
    promotions: true,
    daily_reward: true
  });

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if (supported && token) {
      checkSubscriptionStatus();
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [token]);

  const checkSubscriptionStatus = async () => {
    try {
      const res = await fetch(`${API}/api/push/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setIsSubscribed(data.subscribed);
      }
    } catch (error) {
      console.error('Error checking push status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API}/api/push/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const subscribeToPush = async () => {
    setSubscribing(true);
    
    try {
      // Get VAPID public key
      const keyRes = await fetch(`${API}/api/push/vapid-key`);
      if (!keyRes.ok) {
        throw new Error('Could not get VAPID key');
      }
      const { public_key } = await keyRes.json();
      
      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.ready;
      
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Benachrichtigungen wurden blockiert');
        return;
      }
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key)
      });
      
      // Send subscription to server
      const subJson = subscription.toJSON();
      const res = await fetch(`${API}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys
        })
      });
      
      if (res.ok) {
        setIsSubscribed(true);
        toast.success('Push-Benachrichtigungen aktiviert! 🔔');
      } else {
        throw new Error('Server error');
      }
    } catch (error) {
      console.error('Push subscription error:', error);
      toast.error('Fehler beim Aktivieren der Benachrichtigungen');
    } finally {
      setSubscribing(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setSubscribing(true);
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }
      
      // Remove from server
      await fetch(`${API}/api/push/unsubscribe`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsSubscribed(false);
      toast.success('Push-Benachrichtigungen deaktiviert');
    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast.error('Fehler beim Deaktivieren');
    } finally {
      setSubscribing(false);
    }
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      await fetch(`${API}/api/push/settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [key]: value })
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      // Revert on error
      setSettings({ ...settings, [key]: !value });
    }
  };

  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  if (!isSupported) {
    return (
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-3 text-gray-500">
          <BellOff className="w-5 h-5" />
          <p>Push-Benachrichtigungen werden von deinem Browser nicht unterstützt.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-5 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isSubscribed ? 'bg-[#10B981]/20' : 'bg-gray-200'
          }`}>
            {isSubscribed ? (
              <Bell className="w-6 h-6 text-[#10B981]" />
            ) : (
              <BellOff className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="text-gray-800 font-bold">Push-Benachrichtigungen</h3>
            <p className="text-sm text-gray-500">
              {isSubscribed ? 'Aktiv - Du erhältst Benachrichtigungen' : 'Inaktiv - Aktiviere für Updates'}
            </p>
          </div>
        </div>
        
        <Button
          onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
          disabled={subscribing}
          className={isSubscribed 
            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
            : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
          }
        >
          {subscribing ? (
            <span className="animate-spin">⏳</span>
          ) : isSubscribed ? (
            <>
              <BellOff className="w-4 h-4 mr-2" />
              Deaktivieren
            </>
          ) : (
            <>
              <Bell className="w-4 h-4 mr-2" />
              Aktivieren
            </>
          )}
        </Button>
      </div>

      {/* Settings - only show if subscribed */}
      {isSubscribed && (
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <h4 className="font-semibold text-gray-700 text-sm">Benachrichtigungstypen</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-gray-800 font-medium">Auktion endet bald</p>
                  <p className="text-gray-500 text-xs">Benachrichtigung wenn deine Auktionen enden</p>
                </div>
              </div>
              <Switch
                checked={settings.auction_ending}
                onCheckedChange={(val) => updateSetting('auction_ending', val)}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-gray-800 font-medium">Überboten</p>
                  <p className="text-gray-500 text-xs">Wenn jemand dein Gebot übertrifft</p>
                </div>
              </div>
              <Switch
                checked={settings.outbid}
                onCheckedChange={(val) => updateSetting('outbid', val)}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-gray-800 font-medium">Gewonnen!</p>
                  <p className="text-gray-500 text-xs">Wenn du eine Auktion gewinnst</p>
                </div>
              </div>
              <Switch
                checked={settings.won}
                onCheckedChange={(val) => updateSetting('won', val)}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-gray-800 font-medium">Neue Auktionen</p>
                  <p className="text-gray-500 text-xs">Neue Produkte in deinen Lieblingskategorien</p>
                </div>
              </div>
              <Switch
                checked={settings.new_auctions}
                onCheckedChange={(val) => updateSetting('new_auctions', val)}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Gift className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="text-gray-800 font-medium">Aktionen & Rabatte</p>
                  <p className="text-gray-500 text-xs">Sonderangebote und Promotionen</p>
                </div>
              </div>
              <Switch
                checked={settings.promotions}
                onCheckedChange={(val) => updateSetting('promotions', val)}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-gray-800 font-medium">Tägliche Belohnung</p>
                  <p className="text-gray-500 text-xs">Erinnerung für deine tägliche Belohnung</p>
                </div>
              </div>
              <Switch
                checked={settings.daily_reward}
                onCheckedChange={(val) => updateSetting('daily_reward', val)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
