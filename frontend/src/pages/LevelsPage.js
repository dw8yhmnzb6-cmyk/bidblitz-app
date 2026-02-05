import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getFeatureTranslation } from '../i18n/featureTranslations';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { 
  Crown, Star, Award, Zap, Gift, Truck, 
  ChevronRight, Trophy, Sparkles, TrendingUp
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LevelBadge = ({ level, size = 'md' }) => {
  const levelData = {
    bronze: { icon: '🥉', color: '#CD7F32', bg: 'from-amber-700 to-amber-900' },
    silver: { icon: '🥈', color: '#C0C0C0', bg: 'from-gray-400 to-gray-600' },
    gold: { icon: '🥇', color: '#FFD700', bg: 'from-yellow-400 to-yellow-600' },
    platinum: { icon: '💠', color: '#E5E4E2', bg: 'from-cyan-200 to-cyan-400' },
    diamond: { icon: '💎', color: '#B9F2FF', bg: 'from-cyan-300 to-blue-400' }
  };

  const data = levelData[level] || levelData.bronze;
  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-xl bg-gradient-to-br ${data.bg} flex items-center justify-center shadow-lg`}>
      <span>{data.icon}</span>
    </div>
  );
};

const LevelsPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [levelData, setLevelData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [xpHistory, setXpHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use centralized translations
  const ft = getFeatureTranslation('levels', language);
  const t = {
    ...ft,
    title: language === 'de' ? 'Level-System' : 'Level System',
    subtitle: ft.subtitle || 'Level up and unlock exclusive benefits!',
    currentLevel: ft.currentLevel || 'Current Level',
    xpProgress: language === 'de' ? 'XP Fortschritt' : 'XP Progress',
    nextLevel: language === 'de' ? 'Nächstes Level' : 'Next Level',
    xpNeeded: language === 'de' ? 'XP benötigt' : 'XP needed',
    yourPerks: language === 'de' ? 'Deine Vorteile' : 'Your Perks',
    allLevels: language === 'de' ? 'Alle Level' : 'All Levels',
    leaderboard: language === 'de' ? 'XP Rangliste' : 'XP Leaderboard',
    howToEarn: ft.howToEarnXp || 'How to earn XP',
    perBid: language === 'de' ? 'XP pro Gebot' : 'XP per bid',
    perWin: language === 'de' ? 'XP pro Gewinn' : 'XP per win',
    perPurchase: language === 'de' ? 'XP pro €10 Kauf' : 'XP per €10 purchase',
    perLogin: language === 'de' ? 'XP pro Tag Login' : 'XP per daily login',
    perReview: language === 'de' ? 'XP pro Bewertung' : 'XP per review',
    perReferral: language === 'de' ? 'XP pro Empfehlung' : 'XP per referral',
    unlockAt: language === 'de' ? 'Freischalten bei' : 'Unlock at',
    xp: 'XP',
    rank: language === 'de' ? 'Platz' : 'Rank',
    recentXp: language === 'de' ? 'Letzte XP-Aktivität' : 'Recent XP Activity'
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const requests = [axios.get(`${API}/api/levels/leaderboard`)];
      
      if (isAuthenticated && token) {
        requests.push(
          axios.get(`${API}/api/levels/my-level`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API}/api/levels/xp-history?limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
      }
      
      const results = await Promise.all(requests);
      setLeaderboard(results[0].data.leaderboard || []);
      
      if (results[1]) setLevelData(results[1].data);
      if (results[2]) setXpHistory(results[2].data.history || []);
    } catch (err) {
      console.error('Error fetching level data:', err);
    } finally {
      setLoading(false);
    }
  };

  const levelOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const levelNames = {
    bronze: { de: 'Bronze', en: 'Bronze' },
    silver: { de: 'Silber', en: 'Silver' },
    gold: { de: 'Gold', en: 'Gold' },
    platinum: { de: 'Platin', en: 'Platinum' },
    diamond: { de: 'Diamant', en: 'Diamond' }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-white rounded w-1/3 mx-auto"></div>
            <div className="h-48 bg-white rounded-xl"></div>
            <div className="grid grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-40 bg-white rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allLevels = levelData?.all_levels || {};
  const currentLevel = levelData?.current_level || 'bronze';
  const currentXp = levelData?.current_xp || 0;
  const progressPercent = levelData?.progress_percent || 0;
  const xpToNext = levelData?.xp_to_next_level || 0;
  const nextLevel = levelData?.next_level;

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="levels-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 mb-4">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-800 font-bold">Level System</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500 text-lg">{t.subtitle}</p>
        </div>

        {/* Current Level Card */}
        {isAuthenticated && levelData && (
          <div className="glass-card rounded-2xl p-8 mb-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <LevelBadge level={currentLevel} size="lg" />
              
              <div className="flex-1 text-center md:text-left">
                <p className="text-gray-500 text-sm mb-1">{t.currentLevel}</p>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  {levelNames[currentLevel]?.[language] || currentLevel}
                </h2>
                <p className="text-purple-400 font-bold">{currentXp} XP</p>
              </div>

              {nextLevel && (
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">{t.xpProgress}</span>
                    <span className="text-gray-800 font-bold">{progressPercent}%</span>
                  </div>
                  <div className="h-4 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t.nextLevel}: {levelNames[nextLevel.name?.toLowerCase()]?.[language]}</span>
                    <span className="text-purple-400">{xpToNext} {t.xpNeeded}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Current Perks */}
            {levelData.perks && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-gray-800 font-bold mb-3">{t.yourPerks}</h3>
                <div className="flex flex-wrap gap-3">
                  {allLevels[currentLevel]?.perks_de?.map((perk, i) => (
                    <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                      ✓ {perk}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* How to Earn XP */}
        <div className="glass-card rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            {t.howToEarn}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <Zap className="w-6 h-6 text-blue-400 mx-auto mb-1" />
              <p className="text-gray-800 font-bold">1 {t.xp}</p>
              <p className="text-gray-500 text-xs">{t.perBid}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              <p className="text-gray-800 font-bold">50 {t.xp}</p>
              <p className="text-gray-500 text-xs">{t.perWin}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <Gift className="w-6 h-6 text-green-400 mx-auto mb-1" />
              <p className="text-gray-800 font-bold">10 {t.xp}</p>
              <p className="text-gray-500 text-xs">{t.perPurchase}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <Star className="w-6 h-6 text-orange-400 mx-auto mb-1" />
              <p className="text-gray-800 font-bold">5 {t.xp}</p>
              <p className="text-gray-500 text-xs">{t.perLogin}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <Award className="w-6 h-6 text-purple-400 mx-auto mb-1" />
              <p className="text-gray-800 font-bold">15 {t.xp}</p>
              <p className="text-gray-500 text-xs">{t.perReview}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <TrendingUp className="w-6 h-6 text-pink-400 mx-auto mb-1" />
              <p className="text-gray-800 font-bold">100 {t.xp}</p>
              <p className="text-gray-500 text-xs">{t.perReferral}</p>
            </div>
          </div>
        </div>

        {/* All Levels */}
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t.allLevels}</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {levelOrder.map((level, index) => {
            const levelInfo = allLevels[level] || {};
            const isCurrentLevel = level === currentLevel;
            const isUnlocked = levelOrder.indexOf(currentLevel) >= index;
            
            return (
              <div 
                key={level}
                className={`glass-card rounded-xl p-5 text-center transition-all ${
                  isCurrentLevel 
                    ? 'border-2 border-purple-500 ring-2 ring-purple-500/20' 
                    : isUnlocked 
                      ? 'opacity-100' 
                      : 'opacity-50'
                }`}
              >
                <LevelBadge level={level} size="md" />
                <h4 className="text-gray-800 font-bold mt-3">
                  {levelNames[level]?.[language] || level}
                </h4>
                <p className="text-gray-500 text-sm mb-3">
                  {levelInfo.min_xp || 0}+ {t.xp}
                </p>
                
                <div className="space-y-1 text-left">
                  {levelInfo.perks_de?.slice(0, 3).map((perk, i) => (
                    <p key={i} className="text-xs text-gray-500 truncate">
                      • {perk}
                    </p>
                  ))}
                  {levelInfo.perks_de?.length > 3 && (
                    <p className="text-xs text-purple-400">
                      +{levelInfo.perks_de.length - 3} mehr...
                    </p>
                  )}
                </div>

                {isCurrentLevel && (
                  <div className="mt-3 px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold">
                    Aktuell
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Leaderboard & History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              {t.leaderboard}
            </h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${
                  i < 3 ? 'bg-yellow-500/10' : 'bg-white/5'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center font-bold ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-600' : i === 2 ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      {entry.rank}
                    </span>
                    <span className="text-xl">{entry.level_icon}</span>
                    <span className="text-gray-800">{entry.user_name}</span>
                  </div>
                  <span className="text-purple-400 font-bold">{entry.xp} XP</span>
                </div>
              ))}
            </div>
          </div>

          {/* XP History */}
          {isAuthenticated && xpHistory.length > 0 && (
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                {t.recentXp}
              </h3>
              <div className="space-y-2">
                {xpHistory.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-gray-800 text-sm">{tx.description}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-green-400 font-bold">+{tx.xp} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LevelsPage;
