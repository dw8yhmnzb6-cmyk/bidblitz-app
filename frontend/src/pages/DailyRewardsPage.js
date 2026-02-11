import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getFeatureTranslation } from '../i18n/featureTranslations';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Calendar, Gift, Star, Check, Clock, Zap,
  Trophy, Target, ChevronRight, Sparkles, Crown
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const DailyRewardsPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [quests, setQuests] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [powerHour, setPowerHour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState(0);

  // Use centralized translations with local fallback
  const ft = getFeatureTranslation('dailyRewards', language);
  
  // Daily Rewards page texts
  const dailyTexts = {
    de: {
      dailyRewards: 'Tägliche Belohnungen',
      subtitle: 'Komm jeden Tag vorbei und hol dir deine Boni!',
      inProgress: 'In Arbeit',
      allCompleted: 'Alle Quests erledigt!',
      bonusReward: 'Bonus-Belohnung',
      resetsIn: 'Reset in',
      claimToday: 'Heute abholen',
      alreadyClaimed: 'Bereits abgeholt',
      nextReward: 'Nächste Belohnung',
      powerHourActive: 'Power Hour aktiv!',
      powerHourNext: 'Nächste Power Hour',
      hours: 'Stunden'
    },
    en: {
      subtitle: 'Come back every day and claim your bonuses!',
      inProgress: 'In Progress',
      allCompleted: 'All quests completed!',
      bonusReward: 'Bonus Reward',
      resetsIn: 'Resets in',
      claimToday: 'Claim Today',
      alreadyClaimed: 'Already Claimed',
      nextReward: 'Next Reward',
      powerHourActive: 'Power Hour Active!',
      powerHourNext: 'Next Power Hour',
      hours: 'Hours'
    },
    sq: {
      subtitle: 'Kthehuni çdo ditë dhe merrni bonuset tuaja!',
      inProgress: 'Në progres',
      allCompleted: 'Të gjitha detyrat u përfunduan!',
      bonusReward: 'Shpërblim Bonus',
      resetsIn: 'Rifreskim në',
      claimToday: 'Merr Sot',
      alreadyClaimed: 'Tashmë Marrë',
      nextReward: 'Shpërblimi i Ardhshëm',
      powerHourActive: 'Power Hour aktiv!',
      powerHourNext: 'Power Hour i ardhshëm',
      hours: 'Orë'
    },
    xk: {
      subtitle: 'Kthehuni çdo ditë dhe merrni bonuset tuaja!',
      inProgress: 'Në progres',
      allCompleted: 'Të gjitha detyrat u përfunduan!',
      bonusReward: 'Shpërblim Bonus',
      resetsIn: 'Rifreskim në',
      claimToday: 'Merr Sot',
      alreadyClaimed: 'Tashmë Marrë',
      nextReward: 'Shpërblimi i Ardhshëm',
      powerHourActive: 'Power Hour aktiv!',
      powerHourNext: 'Power Hour i ardhshëm',
      hours: 'Orë'
    },
    tr: {
      subtitle: 'Her gün gelin ve bonuslarınızı alın!',
      inProgress: 'Devam Ediyor',
      allCompleted: 'Tüm görevler tamamlandı!',
      bonusReward: 'Bonus Ödül',
      resetsIn: 'Sıfırlanma',
      claimToday: 'Bugün Al',
      alreadyClaimed: 'Zaten Alındı',
      nextReward: 'Sonraki Ödül',
      powerHourActive: 'Power Hour aktif!',
      powerHourNext: 'Sonraki Power Hour',
      hours: 'Saat'
    },
    fr: {
      subtitle: 'Revenez chaque jour et réclamez vos bonus!',
      inProgress: 'En cours',
      allCompleted: 'Toutes les quêtes terminées!',
      bonusReward: 'Récompense Bonus',
      resetsIn: 'Réinitialisation dans',
      claimToday: 'Réclamer Aujourd\'hui',
      alreadyClaimed: 'Déjà réclamé',
      nextReward: 'Prochaine récompense',
      powerHourActive: 'Power Hour actif!',
      powerHourNext: 'Prochain Power Hour',
      hours: 'Heures'
    }
  };
  const dT = dailyTexts[language] || dailyTexts.de;
  
  const t = {
    ...ft,
    title: ft.title || 'Daily Rewards',
    subtitle: dT.subtitle,
    dailyQuests: ft.dailyQuests || 'Daily Quests',
    loginCalendar: ft.loginCalendar || 'Login Calendar',
    powerHour: ft.powerHour || 'Power Hour',
    claim: ft.claim || 'Claim',
    claimed: ft.claimed || 'Claimed',
    completed: ft.completed || 'Completed',
    inProgress: dT.inProgress,
    allCompleted: dT.allCompleted,
    bonusReward: dT.bonusReward,
    day: ft.day || 'Day',
    today: ft.today || 'Today',
    resetsIn: dT.resetsIn,
    claimToday: dT.claimToday,
    alreadyClaimed: dT.alreadyClaimed,
    streak: ft.streak || 'Streak',
    nextReward: dT.nextReward,
    powerHourActive: dT.powerHourActive,
    powerHourNext: dT.powerHourNext,
    doubleXp: ft.doubleXp || 'Double XP',
    hours: dT.hours
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [questsRes, calendarRes, powerHourRes] = await Promise.all([
        axios.get(`${API}/api/daily/quests`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/daily/login-calendar`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/power-hour/status`)
      ]);
      
      setQuests(questsRes.data);
      setCalendar(calendarRes.data);
      setPowerHour(powerHourRes.data);
      setTimeUntilReset(questsRes.data.seconds_until_reset || 0);
    } catch (err) {
      console.error('Error fetching daily data:', err);
    } finally {
      setLoading(false);
    }
  };

  const claimQuestReward = async (questId) => {
    setClaiming(true);
    try {
      const res = await axios.post(`${API}/api/daily/quests/claim/${questId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`+${res.data.bids_earned} Gebote, +${res.data.xp_earned} XP!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    } finally {
      setClaiming(false);
    }
  };

  const claimAllBonus = async () => {
    setClaiming(true);
    try {
      const res = await axios.post(`${API}/api/daily/quests/claim-all-bonus`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    } finally {
      setClaiming(false);
    }
  };

  const claimLoginReward = async () => {
    setClaiming(true);
    try {
      const res = await axios.post(`${API}/api/daily/login-calendar/claim`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${res.data.icon} ${res.data.message}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    } finally {
      setClaiming(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-white rounded w-1/3 mx-auto"></div>
            <div className="h-64 bg-white rounded-xl"></div>
            <div className="h-48 bg-white rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const questList = quests?.quests || [];
  const allCompleted = quests?.all_completed;
  const allBonusClaimed = quests?.all_completed_bonus_claimed;

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="daily-rewards-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 mb-4">
            <Calendar className="w-5 h-5 text-orange-400" />
            <span className="text-gray-800 font-bold">{t.dailyRewards || 'Tägliche Belohnungen'}</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {/* Power Hour Banner */}
        {powerHour?.is_active && (
          <div className="glass-card rounded-xl p-4 mb-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-8 h-8 text-yellow-400" />
                <div>
                  <h3 className="text-yellow-400 font-bold">{t.powerHourActive}</h3>
                  <p className="text-gray-800">{powerHour.name} - {powerHour.multiplier}x XP!</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-yellow-400 font-mono text-xl font-bold">
                  {formatTime(powerHour.seconds_remaining)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Daily Quests */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-400" />
              {t.dailyQuests}
            </h2>
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{t.resetsIn}: {formatTime(timeUntilReset)}</span>
            </div>
          </div>

          <div className="space-y-4">
            {questList.map(quest => (
              <div 
                key={quest.id}
                className={`p-4 rounded-xl transition-all ${
                  quest.completed 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : 'bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{quest.icon}</span>
                    <div>
                      <h3 className="text-gray-800 font-bold">{quest.name}</h3>
                      <p className="text-gray-500 text-sm">{quest.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-yellow-400 text-sm">+{quest.reward_bids} Gebote</span>
                        <span className="text-purple-400 text-sm">+{quest.reward_xp} XP</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress */}
                    <div className="text-right">
                      <p className={`font-bold ${quest.completed ? 'text-green-400' : 'text-gray-800'}`}>
                        {quest.progress}/{quest.target}
                      </p>
                      <p className="text-xs text-gray-500">
                        {quest.completed ? t.completed : t.inProgress}
                      </p>
                    </div>

                    {/* Claim Button */}
                    {quest.completed && !quest.claimed && (
                      <Button
                        onClick={() => claimQuestReward(quest.id)}
                        disabled={claiming}
                        className="bg-gradient-to-r from-green-500 to-emerald-500"
                      >
                        {t.claim}
                      </Button>
                    )}
                    {quest.claimed && (
                      <div className="px-4 py-2 bg-gray-700 rounded-lg text-gray-500">
                        <Check className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      quest.completed ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* All Completed Bonus */}
          {allCompleted && (
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crown className="w-8 h-8 text-yellow-400" />
                  <div>
                    <h3 className="text-gray-800 font-bold">{t.allCompleted}</h3>
                    <p className="text-purple-400">+5 Gebote, +50 XP {t.bonusReward}!</p>
                  </div>
                </div>
                {!allBonusClaimed ? (
                  <Button
                    onClick={claimAllBonus}
                    disabled={claiming}
                    className="bg-gradient-to-r from-purple-500 to-pink-500"
                  >
                    <Gift className="w-4 h-4 mr-2" />
                    {t.claim}
                  </Button>
                ) : (
                  <div className="px-4 py-2 bg-gray-700 rounded-lg text-gray-500 flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    {t.claimed}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Login Calendar */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-orange-400" />
              {t.loginCalendar}
            </h2>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-800 font-bold">{t.day} {calendar?.current_day || 0}</span>
            </div>
          </div>

          {/* Claim Today Button */}
          {calendar?.can_claim_today && (
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <span className="text-2xl">{calendar?.next_reward?.icon || '🎁'}</span>
                  </div>
                  <div>
                    <h3 className="text-gray-800 font-bold">{t.today}: {t.day} {(calendar?.current_day || 0) + 1}</h3>
                    <p className="text-green-400">+{calendar?.next_reward?.amount || 0} Gebote</p>
                  </div>
                </div>
                <Button
                  onClick={claimLoginReward}
                  disabled={claiming}
                  className="bg-gradient-to-r from-green-500 to-emerald-500"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  {t.claimToday}
                </Button>
              </div>
            </div>
          )}

          {!calendar?.can_claim_today && (
            <div className="mb-6 p-4 rounded-xl bg-white shadow-md border border-gray-700">
              <div className="flex items-center gap-3">
                <Check className="w-6 h-6 text-green-400" />
                <span className="text-gray-500">{t.alreadyClaimed}</span>
              </div>
            </div>
          )}

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {(calendar?.calendar || []).slice(0, 28).map((day, index) => {
              const isPast = index < (calendar?.current_day || 0);
              const isCurrent = index === (calendar?.current_day || 0);
              const isWeekBonus = (index + 1) % 7 === 0;
              
              return (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center p-1 transition-all ${
                    isPast 
                      ? 'bg-green-500/20 border border-green-500/30' 
                      : isCurrent
                        ? 'bg-yellow-500/20 border-2 border-yellow-500 animate-pulse'
                        : isWeekBonus
                          ? 'bg-purple-500/10 border border-purple-500/30'
                          : 'bg-white/5'
                  }`}
                >
                  <span className={`text-lg ${isPast ? 'opacity-50' : ''}`}>{day.icon}</span>
                  <span className={`text-xs font-bold ${
                    isPast ? 'text-green-400' : isCurrent ? 'text-yellow-400' : 'text-gray-500'
                  }`}>
                    +{day.amount}
                  </span>
                  {isPast && <Check className="w-3 h-3 text-green-400" />}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30"></div>
              <span className="text-gray-500">Abgeholt</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500"></div>
              <span className="text-gray-500">{t.today}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-500/10 border border-purple-500/30"></div>
              <span className="text-gray-500">Wochen-Bonus</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyRewardsPage;
