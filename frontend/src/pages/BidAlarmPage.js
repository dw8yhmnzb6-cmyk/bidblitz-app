import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Bell, BellOff, Clock, Trash2, Plus, Target, 
  Zap, ChevronRight, Settings, Volume2, VolumeX
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Gebot-Alarm',
    subtitle: 'Werde benachrichtigt wenn Auktionen enden!',
    activeAlarms: 'Aktive Alarme',
    noAlarms: 'Keine Alarme aktiv',
    createAlarm: 'Alarm erstellen',
    notifyAt: 'Benachrichtigen bei',
    seconds: 'Sekunden',
    beforeEnd: 'vor Ende',
    delete: 'Löschen',
    auction: 'Auktion',
    currentPrice: 'Aktueller Preis',
    timeLeft: 'Verbleibend',
    addAlarm: 'Alarm hinzufügen',
    selectAuction: 'Wähle eine Auktion',
    alarmSet: 'Alarm gesetzt!',
    alarmDeleted: 'Alarm gelöscht',
    loginRequired: 'Bitte anmelden',
    loginToUse: 'Melde dich an um Alarme zu setzen',
    quickAlarm: 'Schnell-Alarm',
    customAlarm: 'Benutzerdefiniert',
    preset10s: '10 Sek',
    preset30s: '30 Sek',
    preset60s: '1 Min',
    preset120s: '2 Min',
    soundEnabled: 'Ton an',
    soundDisabled: 'Ton aus',
    loading: 'Laden...',
    minutes: 'Min',
    hours: 'Std'
  },
  en: {
    title: 'Bid Alarm',
    subtitle: 'Get notified when auctions are ending!',
    activeAlarms: 'Active Alarms',
    noAlarms: 'No active alarms',
    createAlarm: 'Create Alarm',
    notifyAt: 'Notify at',
    seconds: 'seconds',
    beforeEnd: 'before end',
    delete: 'Delete',
    auction: 'Auction',
    currentPrice: 'Current Price',
    timeLeft: 'Time Left',
    addAlarm: 'Add Alarm',
    selectAuction: 'Select an auction',
    alarmSet: 'Alarm set!',
    alarmDeleted: 'Alarm deleted',
    loginRequired: 'Please login',
    loginToUse: 'Login to set alarms',
    quickAlarm: 'Quick Alarm',
    customAlarm: 'Custom',
    preset10s: '10 sec',
    preset30s: '30 sec',
    preset60s: '1 min',
    preset120s: '2 min',
    soundEnabled: 'Sound on',
    soundDisabled: 'Sound off',
    loading: 'Loading...',
    minutes: 'min',
    hours: 'hrs'
  },
  sq: {
    title: 'Alarmi i Ofertave',
    subtitle: 'Merr njoftim kur ankandat përfundojnë!',
    activeAlarms: 'Alarmet Aktive',
    noAlarms: 'Asnjë alarm aktiv',
    createAlarm: 'Krijo Alarm',
    notifyAt: 'Njofto në',
    seconds: 'sekonda',
    beforeEnd: 'para fundit',
    delete: 'Fshi',
    auction: 'Ankand',
    currentPrice: 'Çmimi Aktual',
    timeLeft: 'Koha e Mbetur',
    addAlarm: 'Shto Alarm',
    selectAuction: 'Zgjidh një ankand',
    alarmSet: 'Alarmi u vendos!',
    alarmDeleted: 'Alarmi u fshi',
    loginRequired: 'Ju lutem identifikohuni',
    loginToUse: 'Identifikohuni për të vendosur alarme',
    quickAlarm: 'Alarm i Shpejtë',
    customAlarm: 'Personalizuar',
    preset10s: '10 sek',
    preset30s: '30 sek',
    preset60s: '1 min',
    preset120s: '2 min',
    soundEnabled: 'Tingulli aktiv',
    soundDisabled: 'Tingulli çaktivizuar',
    loading: 'Duke ngarkuar...',
    minutes: 'min',
    hours: 'orë'
  }
};

const BidAlarmPage = () => {
  const { isAuthenticated, token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;

  const [alarms, setAlarms] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [notifySeconds, setNotifySeconds] = useState(10);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const [alarmsRes, auctionsRes] = await Promise.all([
        fetch(`${API}/api/bid-alarm/my-alarms`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/auctions?status=active&limit=20`)
      ]);

      if (alarmsRes.ok) {
        const data = await alarmsRes.json();
        setAlarms(data.alarms || []);
      }

      if (auctionsRes.ok) {
        const data = await auctionsRes.json();
        setAuctions(data.auctions || []);
      }
    } catch (err) {
      console.error('Error fetching alarms:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCreateAlarm = async () => {
    if (!selectedAuction) {
      toast.error(t.selectAuction);
      return;
    }

    try {
      const res = await fetch(`${API}/api/bid-alarm/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          auction_id: selectedAuction,
          notify_at_seconds: notifySeconds
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(t.alarmSet);
        setShowCreate(false);
        setSelectedAuction(null);
        fetchData();
      } else {
        toast.error(data.detail || 'Error');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleDeleteAlarm = async (alarmId) => {
    try {
      const res = await fetch(`${API}/api/bid-alarm/${alarmId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success(t.alarmDeleted);
        setAlarms(alarms.filter(a => a.id !== alarmId));
      }
    } catch (err) {
      toast.error('Error');
    }
  };

  const handleToggleAlarm = async (auctionId) => {
    try {
      const res = await fetch(`${API}/api/bid-alarm/toggle/${auctionId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchData();
      }
    } catch (err) {
      toast.error('Error');
    }
  };

  const formatTimeLeft = (endTime) => {
    if (!endTime) return '--:--';
    const now = new Date();
    const end = new Date(endTime);
    const diff = Math.max(0, end - now) / 1000;

    if (diff < 60) return `${Math.floor(diff)} ${t.seconds}`;
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t.minutes}`;
    return `${Math.floor(diff / 3600)} ${t.hours}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-red-900/20 to-gray-900 pt-20 px-4">
        <div className="max-w-md mx-auto text-center py-16">
          <Bell className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400 mb-6">{t.loginToUse}</p>
          <Button onClick={() => navigate('/login')} className="bg-red-500 hover:bg-red-600">
            {t.loginRequired}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-red-900/20 to-gray-900 pt-20 pb-24 px-4" data-testid="bid-alarm-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Bell className="w-10 h-10 text-red-500" />
            <h1 className="text-3xl font-black text-white">{t.title}</h1>
          </div>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Sound Toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              soundEnabled
                ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                : 'bg-gray-700 text-gray-400 border border-gray-600'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            {soundEnabled ? t.soundEnabled : t.soundDisabled}
          </button>
        </div>

        {/* Create Alarm Button */}
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-4 rounded-xl font-bold text-lg mb-6"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t.createAlarm}
        </Button>

        {/* Create Alarm Form */}
        {showCreate && (
          <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 mb-6 border border-red-500/30">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-red-500" />
              {t.createAlarm}
            </h3>

            {/* Time Presets */}
            <div className="mb-4">
              <label className="text-gray-300 text-sm mb-2 block">{t.notifyAt}</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { val: 10, label: t.preset10s },
                  { val: 30, label: t.preset30s },
                  { val: 60, label: t.preset60s },
                  { val: 120, label: t.preset120s }
                ].map((preset) => (
                  <button
                    key={preset.val}
                    onClick={() => setNotifySeconds(preset.val)}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      notifySeconds === preset.val
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Auction Selection */}
            <div className="mb-4">
              <label className="text-gray-300 text-sm mb-2 block">{t.selectAuction}</label>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {auctions.slice(0, 10).map((auction) => (
                  <button
                    key={auction.id}
                    onClick={() => setSelectedAuction(auction.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                      selectedAuction === auction.id
                        ? 'bg-red-600/20 border border-red-500'
                        : 'bg-gray-700/50 border border-transparent hover:border-gray-600'
                    }`}
                  >
                    <div className="w-12 h-12 bg-gray-600 rounded overflow-hidden flex-shrink-0">
                      {auction.product_image && (
                        <img src={auction.product_image} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{auction.product_name || t.auction}</p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-yellow-400">€{auction.current_price?.toFixed(2)}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeLeft(auction.end_time)}
                        </span>
                      </div>
                    </div>
                    {selectedAuction === auction.id && (
                      <Bell className="w-5 h-5 text-red-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Create Button */}
            <Button
              onClick={handleCreateAlarm}
              disabled={!selectedAuction}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600"
            >
              <Bell className="w-5 h-5 mr-2" />
              {t.addAlarm} ({notifySeconds} {t.seconds} {t.beforeEnd})
            </Button>
          </div>
        )}

        {/* Active Alarms */}
        <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-red-500" />
          {t.activeAlarms}
        </h2>

        {loading ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
            <p className="text-gray-400 mt-4">{t.loading}</p>
          </div>
        ) : alarms.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl">
            <BellOff className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">{t.noAlarms}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alarms.map((alarm) => (
              <div
                key={alarm.id}
                className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-red-500/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                    {alarm.auction?.product_image && (
                      <img src={alarm.auction.product_image} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold">{alarm.auction?.product_name || t.auction}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="text-yellow-400">€{alarm.auction?.current_price?.toFixed(2) || '0.00'}</span>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeLeft(alarm.auction?.end_time)}
                      </span>
                    </div>
                    <p className="text-red-400 text-xs mt-1">
                      {t.notifyAt} {alarm.notify_at_seconds} {t.seconds} {t.beforeEnd}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/auctions/${alarm.auction_id}`)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteAlarm(alarm.id)}
                    className="p-2 bg-red-600/20 hover:bg-red-600/40 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Alarm Section */}
        {auctions.length > 0 && (
          <div className="mt-8">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              {t.quickAlarm}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {auctions.slice(0, 4).map((auction) => {
                const hasAlarm = alarms.some(a => a.auction_id === auction.id);
                return (
                  <button
                    key={auction.id}
                    onClick={() => handleToggleAlarm(auction.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                      hasAlarm
                        ? 'bg-red-600/20 border border-red-500'
                        : 'bg-gray-800/50 border border-gray-700 hover:border-red-500/50'
                    }`}
                  >
                    <div className="w-12 h-12 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                      {auction.product_image && (
                        <img src={auction.product_image} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{auction.product_name}</p>
                      <p className="text-gray-400 text-sm">{formatTimeLeft(auction.end_time)}</p>
                    </div>
                    {hasAlarm ? (
                      <Bell className="w-6 h-6 text-red-500" />
                    ) : (
                      <BellOff className="w-6 h-6 text-gray-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BidAlarmPage;
