/**
 * DailyLoginReward - Daily login reward claiming component
 * Shows streak progress and allows claiming daily rewards
 */
import { useState, useEffect } from 'react';
import { Calendar, Gift, Flame, Star, ChevronRight, Check, Sparkles, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner';

const translations = {
  de: {
    title: 'Tägliche Belohnung',
    claim: 'Jetzt abholen!',
    claimed: 'Bereits abgeholt',
    streak: 'Tage-Streak',
    longestStreak: 'Längster Streak',
    nextReward: 'Nächste Belohnung',
    daysRemaining: 'Tage noch',
    freeBids: 'Gratis-Gebote',
    bonus: 'Bonus',
    vipDays: 'VIP-Tage',
    day: 'Tag',
    comingSoon: 'Demnächst',
    streakBroken: 'Streak unterbrochen! Starte neu.',
    todayReward: 'Heutige Belohnung',
    milestones: 'Meilensteine',
    totalClaimed: 'Insgesamt abgeholt'
  },
  en: {
    title: 'Daily Reward',
    claim: 'Claim now!',
    claimed: 'Already claimed',
    streak: 'Day Streak',
    longestStreak: 'Longest Streak',
    nextReward: 'Next Reward',
    daysRemaining: 'days left',
    freeBids: 'Free Bids',
    bonus: 'Bonus',
    vipDays: 'VIP Days',
    day: 'Day',
    comingSoon: 'Coming soon',
    streakBroken: 'Streak broken! Start fresh.',
    todayReward: "Today's Reward",
    milestones: 'Milestones',
    totalClaimed: 'Total Claimed'
  },
  sq: {
    title: 'Shpërblimi Ditor',
    claim: 'Merr tani!',
    claimed: 'Tashmë e marrë',
    streak: 'Ditë Streak',
    longestStreak: 'Streak më i gjatë',
    nextReward: 'Shpërblimi Tjetër',
    daysRemaining: 'ditë mbeten',
    freeBids: 'Oferta Falas',
    bonus: 'Bonus',
    vipDays: 'Ditë VIP',
    day: 'Dita',
    comingSoon: 'Së shpejti',
    streakBroken: 'Streak u prish! Fillo nga fillimi.',
    todayReward: 'Shpërblimi i Sotëm',
    milestones: 'Pikat kryesore',
    totalClaimed: 'Gjithsej të marra'
  },
  tr: {
    title: 'Günlük Ödül',
    claim: 'Şimdi al!',
    claimed: 'Zaten alındı',
    streak: 'Gün Serisi',
    longestStreak: 'En Uzun Seri',
    nextReward: 'Sonraki Ödül',
    daysRemaining: 'gün kaldı',
    freeBids: 'Ücretsiz Teklifler',
    bonus: 'Bonus',
    vipDays: 'VIP Günleri',
    day: 'Gün',
    comingSoon: 'Yakında',
    streakBroken: 'Seri bozuldu! Yeniden başla.',
    todayReward: 'Bugünün Ödülü',
    milestones: 'Kilometre Taşları',
    totalClaimed: 'Toplam Alınan'
  }
};

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DailyLoginReward = ({ language = 'de', token, onRewardClaimed, compact = false }) => {
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const t = translations[language] || translations.de;

  const fetchStreakData = async () => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API}/gamification/login-streak`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStreakData(data);
      }
    } catch (err) {
      console.error('Error fetching streak data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreakData();
  }, [token]);

  const claimReward = async () => {
    if (!token || claiming) return;
    
    setClaiming(true);
    try {
      const res = await fetch(`${API}/gamification/daily-login`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        
        const message = language === 'de' ? data.message_de : data.message_en;
        toast.success(message);
        
        if (data.new_badge) {
          toast.success(`🏅 Achievement: ${data.new_badge.name}`, { duration: 5000 });
        }
        
        // Refresh data
        fetchStreakData();
        
        if (onRewardClaimed) {
          onRewardClaimed(data);
        }
      } else if (data.already_claimed) {
        toast.info(language === 'de' ? data.message_de : data.message_en);
      }
    } catch (err) {
      toast.error('Fehler beim Abholen der Belohnung');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-4 animate-pulse ${compact ? '' : 'p-6'}`}>
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!streakData) return null;

  const canClaim = streakData.can_claim;
  const currentStreak = streakData.current_streak;
  const nextReward = streakData.next_reward;

  // Compact mode for sidebar/header
  if (compact) {
    return (
      <div 
        className={`relative overflow-hidden rounded-xl p-3 cursor-pointer transition-all ${
          canClaim 
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600' 
            : 'bg-gray-100 text-gray-600'
        }`}
        onClick={canClaim ? claimReward : undefined}
        data-testid="daily-login-compact"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            canClaim ? 'bg-white/20' : 'bg-gray-200'
          }`}>
            {canClaim ? (
              <Gift className="w-5 h-5" />
            ) : (
              <Check className="w-5 h-5 text-green-500" />
            )}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${canClaim ? 'text-white' : 'text-gray-700'}`}>
              {canClaim ? t.claim : t.claimed}
            </p>
            <div className="flex items-center gap-1">
              <Flame className={`w-4 h-4 ${canClaim ? 'text-yellow-300' : 'text-orange-400'}`} />
              <span className="text-xs">{currentStreak} {t.streak}</span>
            </div>
          </div>
          {canClaim && nextReward && (
            <div className="text-right">
              <span className="text-lg font-bold">+{nextReward.free_bids}</span>
              <span className="text-xs block opacity-80">{t.freeBids}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full mode
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden relative" data-testid="daily-login-reward">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 5)]
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-7 h-7" />
              {t.title}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                <Flame className="w-4 h-4 text-yellow-300" />
                <span className="font-bold">{currentStreak}</span>
                <span className="text-sm opacity-80">{t.streak}</span>
              </div>
              <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
                <Trophy className="w-4 h-4 text-yellow-300" />
                <span className="text-sm">{t.longestStreak}: {streakData.longest_streak}</span>
              </div>
            </div>
          </div>
          <Sparkles className="w-12 h-12 text-yellow-300/30" />
        </div>
      </div>

      <div className="p-6">
        {/* Streak Warning */}
        {!streakData.streak_valid && currentStreak > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-500" />
            <span className="text-red-700 text-sm font-medium">{t.streakBroken}</span>
          </div>
        )}

        {/* Today's Reward / Claim Button */}
        <div className={`rounded-2xl p-6 mb-6 text-center ${
          canClaim 
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200' 
            : 'bg-gray-50 border border-gray-200'
        }`}>
          <p className="text-sm text-gray-600 mb-2">{t.todayReward}</p>
          
          {nextReward && (
            <div className="mb-4">
              <div className="text-4xl font-black text-amber-600 mb-1">
                +{nextReward.free_bids}
              </div>
              <div className="text-lg text-gray-600">{t.freeBids}</div>
              {nextReward.bonus > 0 && (
                <div className="text-green-600 font-semibold mt-1">+€{nextReward.bonus} {t.bonus}</div>
              )}
              {nextReward.vip_days > 0 && (
                <div className="text-purple-600 font-semibold mt-1">+{nextReward.vip_days} {t.vipDays}</div>
              )}
            </div>
          )}
          
          <button
            onClick={claimReward}
            disabled={!canClaim || claiming}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
              canClaim
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {claiming ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ...
              </span>
            ) : canClaim ? (
              <span className="flex items-center justify-center gap-2">
                <Gift className="w-6 h-6" />
                {t.claim}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-6 h-6" />
                {t.claimed}
              </span>
            )}
          </button>
        </div>

        {/* Upcoming Milestones */}
        {streakData.upcoming_milestones && streakData.upcoming_milestones.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              {t.milestones}
            </h3>
            <div className="space-y-2">
              {streakData.upcoming_milestones.map((milestone, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <span className="font-bold text-amber-600">{milestone.day}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">{t.day} {milestone.day}</p>
                    <p className="text-xs text-gray-500">{milestone.days_remaining} {t.daysRemaining}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-600">+{milestone.reward.free_bids}</p>
                    {milestone.reward.bonus > 0 && (
                      <p className="text-xs text-green-600">+€{milestone.reward.bonus}</p>
                    )}
                    {milestone.reward.vip_days > 0 && (
                      <p className="text-xs text-purple-600">+{milestone.reward.vip_days} VIP</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-4 pt-4 border-t text-center text-sm text-gray-500">
          {t.totalClaimed}: <span className="font-semibold text-gray-700">{streakData.total_rewards_claimed || 0}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti {
          0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          width: 10px;
          height: 10px;
          animation: confetti 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default DailyLoginReward;
