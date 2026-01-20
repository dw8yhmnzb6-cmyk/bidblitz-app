import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Bell, Check, Trash2, Settings, X, Gift, Trophy, AlertCircle, Info, Zap, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { 
  isPushSupported, 
  getNotificationPermission, 
  subscribeToPush, 
  unsubscribeFromPush, 
  isSubscribed,
  sendTestPush 
} from '../utils/pushNotifications';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Notification type icons
const TYPE_ICONS = {
  info: Info,
  success: Trophy,
  warning: AlertCircle,
  auction: Zap,
  reward: Gift
};

const TYPE_COLORS = {
  info: 'text-blue-400 bg-blue-400/10',
  success: 'text-green-400 bg-green-400/10',
  warning: 'text-yellow-400 bg-yellow-400/10',
  auction: 'text-purple-400 bg-purple-400/10',
  reward: 'text-pink-400 bg-pink-400/10'
};

export default function Notifications() {
  const { isAuthenticated, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    push_enabled: true,
    email_enabled: true,
    auction_ending: true,
    auction_won: true,
    outbid: true,
    daily_deals: true,
    new_auctions: false,
    marketing: false
  });
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');

  useEffect(() => {
    // Check if push notifications are supported
    setPushSupported(isPushSupported());
    if (isPushSupported()) {
      setPushPermission(getNotificationPermission());
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchPreferences();
      checkPushSubscription();
    }
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await axios.get(`${API}/notifications/preferences`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreferences(res.data);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const checkPushSubscription = async () => {
    try {
      // Check local subscription status
      const localSubscribed = await isSubscribed();
      
      // Also check server
      const res = await axios.get(`${API}/notifications/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPushSubscribed(localSubscribed && res.data.subscribed);
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  const handlePushSubscribe = async () => {
    setPushLoading(true);
    try {
      await subscribeToPush(token);
      setPushSubscribed(true);
      setPushPermission('granted');
      toast.success('Push-Benachrichtigungen aktiviert! 🔔');
      
      // Send test notification
      setTimeout(async () => {
        try {
          await sendTestPush(token);
        } catch (e) {
          console.log('Test push may have failed:', e);
        }
      }, 1000);
    } catch (error) {
      console.error('Push subscribe error:', error);
      if (error.message.includes('denied')) {
        toast.error('Berechtigung verweigert. Bitte erlauben Sie Benachrichtigungen in Ihren Browser-Einstellungen.');
        setPushPermission('denied');
      } else {
        toast.error('Fehler beim Aktivieren: ' + error.message);
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handlePushUnsubscribe = async () => {
    setPushLoading(true);
    try {
      await unsubscribeFromPush(token);
      setPushSubscribed(false);
      toast.success('Push-Benachrichtigungen deaktiviert');
    } catch (error) {
      toast.error('Fehler beim Deaktivieren');
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    try {
      const result = await sendTestPush(token);
      toast.success(result.message);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.put(`${API}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => 
        prev.map(n => n.id === id ? {...n, read: true} : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      toast.error('Fehler beim Markieren');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({...n, read: true})));
      setUnreadCount(0);
      toast.success('Alle als gelesen markiert');
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`${API}/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const updatePreferences = async (newPrefs) => {
    try {
      await axios.put(`${API}/notifications/preferences`, newPrefs, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreferences(prev => ({...prev, ...newPrefs}));
      toast.success('Einstellungen gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const requestPushPermission = async () => {
    if (!pushSupported) {
      toast.error('Push-Benachrichtigungen werden nicht unterstützt');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // In a real app, you'd register a service worker and get subscription
        toast.success('Push-Benachrichtigungen aktiviert!');
        setPushSubscribed(true);
        updatePreferences({ push_enabled: true });
      } else {
        toast.error('Berechtigung verweigert');
      }
    } catch (error) {
      toast.error('Fehler bei der Anfrage');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff/60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff/3600000)} Std.`;
    return date.toLocaleDateString('de-DE');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-[#0a1929]">
        <div className="glass-card p-8 rounded-xl text-center max-w-md">
          <Bell className="w-16 h-16 text-[#FFD700] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-4">Benachrichtigungen</h2>
          <p className="text-[#94A3B8] mb-6">Melden Sie sich an, um Ihre Benachrichtigungen zu sehen.</p>
          <Button className="btn-primary" onClick={() => window.location.href = '/login'}>
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gradient-to-b from-[#0a1929] to-[#0d2538]" data-testid="notifications-page">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FF4D4D] flex items-center justify-center">
              <Bell className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Benachrichtigungen</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-[#FFD700]">{unreadCount} ungelesen</p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={markAllAsRead}
                className="text-cyan-400 hover:text-cyan-300"
              >
                <Check className="w-4 h-4 mr-1" />
                Alle lesen
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-[#1a3a52] rounded-xl p-4 mb-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Benachrichtigungs-Einstellungen</h3>
              <button onClick={() => setShowSettings(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            
            {/* Push Notifications */}
            <div className="mb-4 p-3 bg-[#0a1929] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Push-Benachrichtigungen</p>
                  <p className="text-gray-400 text-xs">Im Browser benachrichtigt werden</p>
                </div>
                {pushSupported ? (
                  <button
                    onClick={requestPushPermission}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${
                      pushSubscribed 
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {pushSubscribed ? '✓ Aktiviert' : 'Aktivieren'}
                  </button>
                ) : (
                  <span className="text-gray-500 text-xs">Nicht unterstützt</span>
                )}
              </div>
            </div>
            
            {/* Notification Types */}
            <div className="space-y-2">
              {[
                { key: 'auction_ending', label: 'Auktion endet bald' },
                { key: 'auction_won', label: 'Auktion gewonnen' },
                { key: 'outbid', label: 'Überboten' },
                { key: 'daily_deals', label: 'Tägliche Angebote' },
                { key: 'new_auctions', label: 'Neue Auktionen' },
                { key: 'marketing', label: 'Aktionen & Newsletter' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between p-2 hover:bg-[#0a1929]/50 rounded cursor-pointer">
                  <span className="text-gray-300 text-sm">{label}</span>
                  <input
                    type="checkbox"
                    checked={preferences[key] || false}
                    onChange={(e) => updatePreferences({ [key]: e.target.checked })}
                    className="w-4 h-4 accent-[#FFD700]"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFD700]"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 bg-[#1a3a52] rounded-xl">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Keine Benachrichtigungen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const Icon = TYPE_ICONS[notif.type] || Info;
              const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.info;
              
              return (
                <div 
                  key={notif.id}
                  className={`bg-[#1a3a52] rounded-xl p-4 transition-all ${
                    !notif.read ? 'border-l-4 border-[#FFD700]' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium ${notif.read ? 'text-gray-300' : 'text-white'}`}>
                          {notif.title}
                        </h4>
                        <span className="text-gray-500 text-xs flex-shrink-0">
                          {formatDate(notif.created_at)}
                        </span>
                      </div>
                      
                      <p className="text-gray-400 text-sm mt-1">{notif.message}</p>
                      
                      {notif.link && (
                        <a 
                          href={notif.link}
                          className="text-cyan-400 text-xs mt-2 inline-block hover:underline"
                        >
                          Mehr erfahren →
                        </a>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-400/10 rounded"
                          title="Als gelesen markieren"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
