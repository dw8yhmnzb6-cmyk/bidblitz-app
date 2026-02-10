import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
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

// Notification translations
const notifTexts = {
  de: {
    title: 'Benachrichtigungen',
    unread: 'ungelesen',
    markAllRead: 'Alle lesen',
    settings: 'Einstellungen',
    settingsTitle: 'Benachrichtigungs-Einstellungen',
    pushNotifications: 'Push-Benachrichtigungen',
    pushBlocked: 'Blockiert - Bitte in Browser-Einstellungen erlauben',
    pushDesc: 'Im Browser benachrichtigt werden',
    pushEnabled: 'Push-Benachrichtigungen aktiviert!',
    pushDisabled: 'Push-Benachrichtigungen deaktiviert',
    pushDenied: 'Berechtigung verweigert. Bitte erlauben Sie Benachrichtigungen in Ihren Browser-Einstellungen.',
    pushError: 'Fehler beim Aktivieren: ',
    pushReceive: 'Sie erhalten Push-Benachrichtigungen auf diesem Gerät',
    activate: 'Aktivieren',
    activating: 'Aktiviere...',
    activated: '✓ Aktiviert',
    notSupported: 'Nicht unterstützt',
    auctionEnding: 'Auktion endet bald',
    auctionWon: 'Auktion gewonnen',
    outbid: 'Überboten',
    nightAuctions: '🌙 Nacht-Auktionen starten',
    nightAuctionsHint: 'Um 23:30 benachrichtigt werden',
    dailyDeals: 'Tägliche Angebote',
    newAuctions: 'Neue Auktionen',
    marketing: 'Aktionen & Newsletter',
    noNotifications: 'Keine Benachrichtigungen',
    learnMore: 'Mehr erfahren →',
    justNow: 'Gerade eben',
    minAgo: 'vor {n} Min.',
    hoursAgo: 'vor {n} Std.',
    markRead: 'Als gelesen markieren',
    delete: 'Löschen',
    allMarkedRead: 'Alle als gelesen markiert',
    deleted: 'Gelöscht',
    savedSettings: 'Einstellungen gespeichert',
    errorMarking: 'Fehler beim Markieren',
    errorDeleting: 'Fehler beim Löschen',
    errorSaving: 'Fehler beim Speichern',
    loginRequired: 'Melden Sie sich an, um Ihre Benachrichtigungen zu sehen.',
    login: 'Anmelden'
  },
  en: {
    title: 'Notifications',
    unread: 'unread',
    markAllRead: 'Mark all read',
    settings: 'Settings',
    settingsTitle: 'Notification Settings',
    pushNotifications: 'Push Notifications',
    pushBlocked: 'Blocked - Please allow in browser settings',
    pushDesc: 'Get notified in your browser',
    pushEnabled: 'Push notifications enabled!',
    pushDisabled: 'Push notifications disabled',
    pushDenied: 'Permission denied. Please allow notifications in your browser settings.',
    pushError: 'Error enabling: ',
    pushReceive: 'You will receive push notifications on this device',
    activate: 'Activate',
    activating: 'Activating...',
    activated: '✓ Activated',
    notSupported: 'Not supported',
    auctionEnding: 'Auction ending soon',
    auctionWon: 'Auction won',
    outbid: 'Outbid',
    nightAuctions: '🌙 Night auctions start',
    nightAuctionsHint: 'Get notified at 23:30',
    dailyDeals: 'Daily deals',
    newAuctions: 'New auctions',
    marketing: 'Promotions & Newsletter',
    noNotifications: 'No notifications',
    learnMore: 'Learn more →',
    justNow: 'Just now',
    minAgo: '{n} min ago',
    hoursAgo: '{n} hours ago',
    markRead: 'Mark as read',
    delete: 'Delete',
    allMarkedRead: 'All marked as read',
    deleted: 'Deleted',
    savedSettings: 'Settings saved',
    errorMarking: 'Error marking',
    errorDeleting: 'Error deleting',
    errorSaving: 'Error saving',
    loginRequired: 'Please log in to see your notifications.',
    login: 'Login'
  },
  sq: {
    title: 'Njoftimet',
    unread: 'pa lexuar',
    markAllRead: 'Shëno të gjitha të lexuara',
    settings: 'Cilësimet',
    settingsTitle: 'Cilësimet e Njoftimeve',
    pushNotifications: 'Push Njoftimet',
    pushBlocked: 'Bllokuar - Ju lutem lejoni në cilësimet e shfletuesit',
    pushDesc: 'Merrni njoftime në shfletuesin tuaj',
    pushEnabled: 'Push njoftimet u aktivizuan!',
    pushDisabled: 'Push njoftimet u çaktivizuan',
    pushDenied: 'Leja u refuzua. Ju lutem lejoni njoftimet në cilësimet e shfletuesit.',
    pushError: 'Gabim në aktivizim: ',
    pushReceive: 'Do të merrni push njoftime në këtë pajisje',
    activate: 'Aktivizo',
    activating: 'Duke aktivizuar...',
    activated: '✓ Aktivizuar',
    notSupported: 'Nuk mbështetet',
    auctionEnding: 'Ankandi përfundon së shpejti',
    auctionWon: 'Ankandi u fitua',
    outbid: 'U tejkalua',
    nightAuctions: '🌙 Ankandet e natës fillojnë',
    nightAuctionsHint: 'Njoftohuni në 23:30',
    dailyDeals: 'Ofertat ditore',
    newAuctions: 'Ankande të reja',
    marketing: 'Promocione & Newsletter',
    noNotifications: 'Asnjë njoftim',
    learnMore: 'Mëso më shumë →',
    justNow: 'Pikërisht tani',
    minAgo: '{n} min më parë',
    hoursAgo: '{n} orë më parë',
    markRead: 'Shëno si të lexuar',
    delete: 'Fshij',
    allMarkedRead: 'Të gjitha u shënuan si të lexuara',
    deleted: 'U fshi',
    savedSettings: 'Cilësimet u ruajtën',
    errorMarking: 'Gabim në shënim',
    errorDeleting: 'Gabim në fshirje',
    errorSaving: 'Gabim në ruajtje',
    loginRequired: 'Ju lutem hyni për të parë njoftimet tuaja.',
    login: 'Hyr'
  },
  xk: {
    title: 'Njoftimet',
    unread: 'pa lexuar',
    markAllRead: 'Shëno të gjitha të lexuara',
    settings: 'Cilësimet',
    settingsTitle: 'Cilësimet e Njoftimeve',
    pushNotifications: 'Push Njoftimet',
    pushBlocked: 'Bllokuar - Ju lutem lejoni në cilësimet e shfletuesit',
    pushDesc: 'Merrni njoftime në shfletuesin tuaj',
    pushEnabled: 'Push njoftimet u aktivizuan!',
    pushDisabled: 'Push njoftimet u çaktivizuan',
    pushDenied: 'Leja u refuzua. Ju lutem lejoni njoftimet në cilësimet e shfletuesit.',
    pushError: 'Gabim në aktivizim: ',
    pushReceive: 'Do të merrni push njoftime në këtë pajisje',
    activate: 'Aktivizo',
    activating: 'Duke aktivizuar...',
    activated: '✓ Aktivizuar',
    notSupported: 'Nuk mbështetet',
    auctionEnding: 'Ankandi përfundon së shpejti',
    auctionWon: 'Ankandi u fitua',
    outbid: 'U tejkalua',
    nightAuctions: '🌙 Ankandet e natës fillojnë',
    nightAuctionsHint: 'Njoftohuni në 23:30',
    dailyDeals: 'Ofertat ditore',
    newAuctions: 'Ankande të reja',
    marketing: 'Promocione & Newsletter',
    noNotifications: 'Asnjë njoftim',
    learnMore: 'Mëso më shumë →',
    justNow: 'Pikërisht tani',
    minAgo: '{n} min më parë',
    hoursAgo: '{n} orë më parë',
    markRead: 'Shëno si të lexuar',
    delete: 'Fshij',
    allMarkedRead: 'Të gjitha u shënuan si të lexuara',
    deleted: 'U fshi',
    savedSettings: 'Cilësimet u ruajtën',
    errorMarking: 'Gabim në shënim',
    errorDeleting: 'Gabim në fshirje',
    errorSaving: 'Gabim në ruajtje',
    loginRequired: 'Ju lutem hyni për të parë njoftimet tuaja.',
    login: 'Hyr'
  },
  tr: {
    title: 'Bildirimler',
    unread: 'okunmamış',
    markAllRead: 'Tümünü okundu işaretle',
    settings: 'Ayarlar',
    settingsTitle: 'Bildirim Ayarları',
    pushNotifications: 'Push Bildirimleri',
    pushBlocked: 'Engellendi - Lütfen tarayıcı ayarlarından izin verin',
    pushDesc: 'Tarayıcınızda bildirim alın',
    pushEnabled: 'Push bildirimleri etkinleştirildi!',
    pushDisabled: 'Push bildirimleri devre dışı bırakıldı',
    pushDenied: 'İzin reddedildi. Lütfen tarayıcı ayarlarından bildirimlere izin verin.',
    pushError: 'Etkinleştirme hatası: ',
    pushReceive: 'Bu cihazda push bildirimleri alacaksınız',
    activate: 'Etkinleştir',
    activating: 'Etkinleştiriliyor...',
    activated: '✓ Etkin',
    notSupported: 'Desteklenmiyor',
    auctionEnding: 'Açık artırma bitiyor',
    auctionWon: 'Açık artırma kazanıldı',
    outbid: 'Geçildiniz',
    nightAuctions: '🌙 Gece açık artırmaları başlıyor',
    nightAuctionsHint: '23:30\'da bildirim alın',
    dailyDeals: 'Günlük fırsatlar',
    newAuctions: 'Yeni açık artırmalar',
    marketing: 'Promosyonlar & Bülten',
    noNotifications: 'Bildirim yok',
    learnMore: 'Daha fazla →',
    justNow: 'Az önce',
    minAgo: '{n} dk önce',
    hoursAgo: '{n} saat önce',
    markRead: 'Okundu işaretle',
    delete: 'Sil',
    allMarkedRead: 'Tümü okundu işaretlendi',
    deleted: 'Silindi',
    savedSettings: 'Ayarlar kaydedildi',
    errorMarking: 'İşaretleme hatası',
    errorDeleting: 'Silme hatası',
    errorSaving: 'Kaydetme hatası',
    loginRequired: 'Bildirimlerinizi görmek için giriş yapın.',
    login: 'Giriş'
  },
  fr: {
    title: 'Notifications',
    unread: 'non lues',
    markAllRead: 'Tout marquer comme lu',
    settings: 'Paramètres',
    settingsTitle: 'Paramètres de notification',
    pushNotifications: 'Notifications Push',
    pushBlocked: 'Bloqué - Veuillez autoriser dans les paramètres du navigateur',
    pushDesc: 'Recevoir des notifications dans votre navigateur',
    pushEnabled: 'Notifications push activées!',
    pushDisabled: 'Notifications push désactivées',
    pushDenied: 'Permission refusée. Veuillez autoriser les notifications dans les paramètres du navigateur.',
    pushError: 'Erreur d\'activation: ',
    pushReceive: 'Vous recevrez des notifications push sur cet appareil',
    activate: 'Activer',
    activating: 'Activation...',
    activated: '✓ Activé',
    notSupported: 'Non supporté',
    auctionEnding: 'Enchère se termine bientôt',
    auctionWon: 'Enchère gagnée',
    outbid: 'Surenchéri',
    nightAuctions: '🌙 Enchères de nuit commencent',
    nightAuctionsHint: 'Soyez notifié à 23:30',
    dailyDeals: 'Offres quotidiennes',
    newAuctions: 'Nouvelles enchères',
    marketing: 'Promotions & Newsletter',
    noNotifications: 'Aucune notification',
    learnMore: 'En savoir plus →',
    justNow: 'À l\'instant',
    minAgo: 'il y a {n} min',
    hoursAgo: 'il y a {n} h',
    markRead: 'Marquer comme lu',
    delete: 'Supprimer',
    allMarkedRead: 'Tout marqué comme lu',
    deleted: 'Supprimé',
    savedSettings: 'Paramètres enregistrés',
    errorMarking: 'Erreur de marquage',
    errorDeleting: 'Erreur de suppression',
    errorSaving: 'Erreur d\'enregistrement',
    loginRequired: 'Veuillez vous connecter pour voir vos notifications.',
    login: 'Connexion'
  }
};

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
  const { language } = useLanguage();
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
    marketing: false,
    night_auction_start: true
  });
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  
  const t = notifTexts[language] || notifTexts.de;

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
      toast.success(t.pushEnabled + ' 🔔');
      
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
        toast.error(t.pushDenied);
        setPushPermission('denied');
      } else {
        toast.error(t.pushError + error.message);
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
      toast.success(t.pushDisabled);
    } catch (error) {
      toast.error(t.errorSaving);
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
      toast.error(t.errorMarking);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({...n, read: true})));
      setUnreadCount(0);
      toast.success(t.allMarkedRead);
    } catch (error) {
      toast.error(t.errorMarking);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`${API}/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success(t.deleted);
    } catch (error) {
      toast.error(t.errorDeleting);
    }
  };

  const updatePreferences = async (newPrefs) => {
    try {
      await axios.put(`${API}/notifications/preferences`, newPrefs, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreferences(prev => ({...prev, ...newPrefs}));
      toast.success(t.savedSettings);
    } catch (error) {
      toast.error(t.errorSaving);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return t.justNow;
    if (diff < 3600000) return t.minAgo.replace('{n}', Math.floor(diff/60000));
    if (diff < 86400000) return t.hoursAgo.replace('{n}', Math.floor(diff/3600000));
    return date.toLocaleDateString(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'tr' ? 'tr-TR' : 'en-US');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100">
        <div className="bg-white p-8 rounded-xl text-center max-w-md shadow-lg border border-gray-200">
          <Bell className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-4">{t.title}</h2>
          <p className="text-gray-600 mb-6">{t.loginRequired}</p>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => window.location.href = '/login'}>
            {t.login}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gradient-to-b from-cyan-50 to-cyan-100" data-testid="notifications-page">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{t.title}</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-amber-600">{unreadCount} {t.unread}</p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={markAllAsRead}
                className="text-cyan-600 hover:text-cyan-700"
              >
                <Check className="w-4 h-4 mr-1" />
                {t.markAllRead}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-800 font-semibold">{t.settingsTitle}</h3>
              <button onClick={() => setShowSettings(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            {/* Push Notifications */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-gray-800 font-medium">{t.pushNotifications}</p>
                  <p className="text-gray-500 text-xs">
                    {pushPermission === 'denied' 
                      ? t.pushBlocked
                      : t.pushDesc
                    }
                  </p>
                </div>
                {pushSupported ? (
                  <div className="flex gap-2">
                    {pushSubscribed ? (
                      <>
                        <button
                          onClick={handleTestPush}
                          className="px-2 py-1.5 rounded text-xs font-medium bg-cyan-100 text-cyan-600 hover:bg-cyan-200"
                          title="Test"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                        <button
                          onClick={handlePushUnsubscribe}
                          disabled={pushLoading}
                          className="px-3 py-1.5 rounded text-xs font-medium bg-green-100 text-green-600 hover:bg-red-100 hover:text-red-600"
                        >
                          {pushLoading ? '...' : t.activated}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handlePushSubscribe}
                        disabled={pushLoading || pushPermission === 'denied'}
                        className={`px-3 py-1.5 rounded text-xs font-medium ${
                          pushPermission === 'denied'
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-cyan-500 text-white hover:bg-cyan-600'
                        }`}
                      >
                        {pushLoading ? t.activating : t.activate}
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs">{t.notSupported}</span>
                )}
              </div>
              {pushSubscribed && (
                <p className="text-green-600 text-[10px]">
                  ✓ {t.pushReceive}
                </p>
              )}
            </div>
            
            {/* Notification Types */}
            <div className="space-y-2">
              {[
                { key: 'auction_ending', label: t.auctionEnding },
                { key: 'auction_won', label: t.auctionWon },
                { key: 'outbid', label: t.outbid },
                { key: 'night_auction_start', label: t.nightAuctions, hint: t.nightAuctionsHint },
                { key: 'daily_deals', label: t.dailyDeals },
                { key: 'new_auctions', label: t.newAuctions },
                { key: 'marketing', label: t.marketing },
              ].map(({ key, label, hint }) => (
                <label key={key} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
                  <div>
                    <span className="text-gray-600 text-sm">{label}</span>
                    {hint && <p className="text-gray-400 text-xs">{hint}</p>}
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences[key] || false}
                    onChange={(e) => updatePreferences({ [key]: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">{t.noNotifications}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const Icon = TYPE_ICONS[notif.type] || Info;
              const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.info;
              
              return (
                <div 
                  key={notif.id}
                  className={`bg-white rounded-xl p-4 transition-all shadow-sm border border-gray-200 ${
                    !notif.read ? 'border-l-4 border-l-amber-500' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium ${notif.read ? 'text-gray-500' : 'text-gray-800'}`}>
                          {notif.title}
                        </h4>
                        <span className="text-gray-400 text-xs flex-shrink-0">
                          {formatDate(notif.created_at)}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mt-1">{notif.message}</p>
                      
                      {notif.link && (
                        <a 
                          href={notif.link}
                          className="text-cyan-600 text-xs mt-2 inline-block hover:underline"
                        >
                          {t.learnMore}
                        </a>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                          title={t.markRead}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        title={t.delete}
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
