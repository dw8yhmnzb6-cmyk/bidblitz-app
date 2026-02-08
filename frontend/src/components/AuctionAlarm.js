import React, { useState, useEffect, memo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Bell, Clock, Zap, X, Check } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: "Auktions-Alarm",
    subtitle: "Werde benachrichtigt wenn deine Auktion endet",
    setAlarm: "Alarm setzen",
    alarmSet: "Alarm aktiv",
    removeAlarm: "Alarm entfernen",
    notifyBefore: "Benachrichtige mich",
    minutesBefore: "Minuten vorher",
    alarmSuccess: "Alarm wurde gesetzt!",
    alarmRemoved: "Alarm wurde entfernt",
    yourAlarms: "Deine Alarme",
    noAlarms: "Keine aktiven Alarme",
    endsIn: "Endet in"
  },
  en: {
    title: "Auction Alarm",
    subtitle: "Get notified when your auction ends",
    setAlarm: "Set alarm",
    alarmSet: "Alarm active",
    removeAlarm: "Remove alarm",
    notifyBefore: "Notify me",
    minutesBefore: "minutes before",
    alarmSuccess: "Alarm has been set!",
    alarmRemoved: "Alarm removed",
    yourAlarms: "Your alarms",
    noAlarms: "No active alarms",
    endsIn: "Ends in"
  },
  sq: {
    title: "Alarm Ankandi",
    subtitle: "Njoftohu kur ankandi yt përfundon",
    setAlarm: "Vendos alarm",
    alarmSet: "Alarmi aktiv",
    removeAlarm: "Hiq alarmin",
    notifyBefore: "Njoftomë",
    minutesBefore: "minuta para",
    alarmSuccess: "Alarmi u vendos!",
    alarmRemoved: "Alarmi u hoq",
    yourAlarms: "Alarmet e tua",
    noAlarms: "Asnjë alarm aktiv",
    endsIn: "Përfundon në"
  },
  xk: {
    title: "Alarm Ankandi",
    subtitle: "Njoftohu kur ankandi yt përfundon",
    setAlarm: "Vendos alarm",
    alarmSet: "Alarmi aktiv",
    removeAlarm: "Hiq alarmin",
    notifyBefore: "Njoftomë",
    minutesBefore: "minuta para",
    alarmSuccess: "Alarmi u vendos!",
    alarmRemoved: "Alarmi u hoq",
    yourAlarms: "Alarmet e tua",
    noAlarms: "Asnjë alarm aktiv",
    endsIn: "Përfundon në"
  },
  tr: {
    title: "Açık Artırma Alarmı",
    subtitle: "Açık artırma bittiğinde bildirim al",
    setAlarm: "Alarm kur",
    alarmSet: "Alarm aktif",
    removeAlarm: "Alarmı kaldır",
    notifyBefore: "Beni bildir",
    minutesBefore: "dakika önce",
    alarmSuccess: "Alarm kuruldu!",
    alarmRemoved: "Alarm kaldırıldı",
    yourAlarms: "Alarmların",
    noAlarms: "Aktif alarm yok",
    endsIn: "Bitiş"
  },
  fr: {
    title: "Alarme d'enchère",
    subtitle: "Soyez notifié quand votre enchère se termine",
    setAlarm: "Définir l'alarme",
    alarmSet: "Alarme active",
    removeAlarm: "Supprimer l'alarme",
    notifyBefore: "Me notifier",
    minutesBefore: "minutes avant",
    alarmSuccess: "Alarme définie!",
    alarmRemoved: "Alarme supprimée",
    yourAlarms: "Vos alarmes",
    noAlarms: "Pas d'alarme active",
    endsIn: "Se termine dans"
  }
};

// Inline alarm button for auction cards
const AuctionAlarmButton = memo(({ auctionId, endTime, isAlarmSet = false, onToggle }) => {
  const { isAuthenticated, token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [hasAlarm, setHasAlarm] = useState(isAlarmSet);
  const [loading, setLoading] = useState(false);
  
  const t = translations[langKey] || translations.de;
  
  const handleToggle = async () => {
    if (!isAuthenticated) {
      toast.error('Bitte melde dich an');
      return;
    }
    
    setLoading(true);
    try {
      if (hasAlarm) {
        await axios.delete(`${API}/countdown-alarm/${auctionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHasAlarm(false);
        toast.success(t.alarmRemoved);
      } else {
        await axios.post(`${API}/countdown-alarm/${auctionId}`, 
          { minutes_before: 5 },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setHasAlarm(true);
        toast.success(t.alarmSuccess);
      }
      onToggle?.(!hasAlarm);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`p-2 rounded-lg transition-all ${
        hasAlarm 
          ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      title={hasAlarm ? t.removeAlarm : t.setAlarm}
      data-testid={`auction-alarm-${auctionId}`}
    >
      <Bell className={`w-4 h-4 ${hasAlarm ? 'fill-current' : ''} ${loading ? 'animate-pulse' : ''}`} />
    </button>
  );
});

// Alarms list widget for dashboard
const AlarmsWidget = memo(() => {
  const { isAuthenticated, token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const t = translations[langKey] || translations.de;
  
  useEffect(() => {
    const fetchAlarms = async () => {
      if (!isAuthenticated || !token) {
        setLoading(false);
        return;
      }
      
      try {
        const res = await axios.get(`${API}/countdown-alarm/my-alarms`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAlarms(res.data || []);
      } catch (err) {
        console.error('Error fetching alarms:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAlarms();
  }, [isAuthenticated, token]);
  
  const removeAlarm = async (auctionId) => {
    try {
      await axios.delete(`${API}/countdown-alarm/${auctionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlarms(prev => prev.filter(a => a.auction_id !== auctionId));
      toast.success(t.alarmRemoved);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };
  
  if (!isAuthenticated || loading) return null;
  
  if (alarms.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm" data-testid="alarms-widget">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-800">{t.yourAlarms}</h3>
          <p className="text-xs text-gray-500">{alarms.length} {t.alarmSet?.toLowerCase()}</p>
        </div>
      </div>
      
      <div className="space-y-2">
        {alarms.slice(0, 5).map((alarm) => (
          <div 
            key={alarm.auction_id}
            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 truncate">{alarm.product_name || alarm.auction_id}</span>
            </div>
            <button
              onClick={() => removeAlarm(alarm.auction_id)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

export { AuctionAlarmButton, AlarmsWidget };
export default AuctionAlarmButton;
