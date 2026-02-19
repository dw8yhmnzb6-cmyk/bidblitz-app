/**
 * AchievementsPage - Display all achievements with earned status
 * Shows user's achievement progress and badges
 */
import { useState, useEffect } from 'react';
import { Trophy, Star, Lock, Check, Sparkles, Medal, Crown, Target } from 'lucide-react';

const translations = {
  de: {
    title: 'Achievements',
    subtitle: 'Sammle Abzeichen & Punkte',
    totalPoints: 'Gesamtpunkte',
    earned: 'Verdient',
    locked: 'Gesperrt',
    progress: 'Fortschritt',
    rarity: {
      common: 'Gewöhnlich',
      uncommon: 'Ungewöhnlich',
      rare: 'Selten',
      epic: 'Episch',
      legendary: 'Legendär'
    },
    earnedOn: 'Verdient am',
    points: 'Punkte'
  },
  en: {
    title: 'Achievements',
    subtitle: 'Collect badges & points',
    totalPoints: 'Total Points',
    earned: 'Earned',
    locked: 'Locked',
    progress: 'Progress',
    rarity: {
      common: 'Common',
      uncommon: 'Uncommon',
      rare: 'Rare',
      epic: 'Epic',
      legendary: 'Legendary'
    },
    earnedOn: 'Earned on',
    points: 'Points'
  },
  sq: {
    title: 'Arritjet',
    subtitle: 'Mblidh distinktive & pikë',
    totalPoints: 'Pikët Totale',
    earned: 'E fituar',
    locked: 'E kyçur',
    progress: 'Progresi',
    rarity: {
      common: 'E zakonshme',
      uncommon: 'Jo e zakonshme',
      rare: 'E rrallë',
      epic: 'Epike',
      legendary: 'Legjendare'
    },
    earnedOn: 'E fituar më',
    points: 'Pikë'
  },
  tr: {
    title: 'Başarılar',
    subtitle: 'Rozetler & puanlar topla',
    totalPoints: 'Toplam Puan',
    earned: 'Kazanıldı',
    locked: 'Kilitli',
    progress: 'İlerleme',
    rarity: {
      common: 'Yaygın',
      uncommon: 'Nadir',
      rare: 'Çok Nadir',
      epic: 'Epik',
      legendary: 'Efsanevi'
    },
    earnedOn: 'Kazanıldı',
    points: 'Puan'
  }
};

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getRarityColor = (rarity) => {
  switch (rarity) {
    case 'common': return 'from-gray-400 to-gray-500';
    case 'uncommon': return 'from-green-400 to-green-500';
    case 'rare': return 'from-blue-400 to-blue-500';
    case 'epic': return 'from-purple-400 to-purple-500';
    case 'legendary': return 'from-yellow-400 to-orange-500';
    default: return 'from-gray-400 to-gray-500';
  }
};

const getRarityBorder = (rarity) => {
  switch (rarity) {
    case 'common': return 'border-gray-300';
    case 'uncommon': return 'border-green-300';
    case 'rare': return 'border-blue-300';
    case 'epic': return 'border-purple-300';
    case 'legendary': return 'border-yellow-300';
    default: return 'border-gray-300';
  }
};

const AchievementsPage = ({ language = 'de', token }) => {
  const [achievements, setAchievements] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const t = translations[language] || translations.de;

  const fetchAchievements = async () => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API}/gamification/my-achievements?language=${language}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAchievements(data);
      }
    } catch (err) {
      console.error('Error fetching achievements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAchievements();
  }, [token, language]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!achievements) return null;

  const earnedAchievements = achievements.achievements.filter(a => a.earned);
  const lockedAchievements = achievements.achievements.filter(a => !a.earned);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="achievements-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-7 h-7" />
              {t.title}
            </h2>
            <p className="text-purple-100 mt-1">{t.subtitle}</p>
          </div>
          <Sparkles className="w-10 h-10 text-yellow-300/50" />
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>{t.progress}</span>
            <span>{achievements.earned_count}/{achievements.total_count} ({achievements.completion_percentage}%)</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all"
              style={{ width: `${achievements.completion_percentage}%` }}
            />
          </div>
        </div>
        
        {/* Total Points */}
        <div className="mt-4 flex items-center gap-2">
          <div className="bg-white/20 rounded-xl px-4 py-2 inline-flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-300" />
            <span className="font-bold text-xl">{achievements.total_points}</span>
            <span className="text-sm opacity-80">{t.totalPoints}</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Earned Achievements */}
        {earnedAchievements.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              {t.earned} ({earnedAchievements.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {earnedAchievements.map((achievement) => (
                <div 
                  key={achievement.id}
                  className={`relative rounded-xl p-4 border-2 ${getRarityBorder(achievement.rarity)} bg-gradient-to-br from-white to-gray-50 hover:shadow-lg transition-all`}
                >
                  <div className="text-center">
                    <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${getRarityColor(achievement.rarity)} flex items-center justify-center text-3xl shadow-lg`}>
                      {achievement.icon}
                    </div>
                    <h4 className="font-bold text-gray-800 mt-3">{achievement.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{achievement.description}</p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${getRarityColor(achievement.rarity)} text-white`}>
                        {t.rarity[achievement.rarity]}
                      </span>
                      <span className="text-xs text-amber-600 font-semibold">+{achievement.points} {t.points}</span>
                    </div>
                    {achievement.earned_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        {t.earnedOn} {new Date(achievement.earned_at).toLocaleDateString('de-DE')}
                      </p>
                    )}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Check className="w-5 h-5 text-green-500 bg-green-100 rounded-full p-0.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Achievements */}
        {lockedAchievements.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-500 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t.locked} ({lockedAchievements.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {lockedAchievements.map((achievement) => (
                <div 
                  key={achievement.id}
                  className="relative rounded-xl p-4 border border-gray-200 bg-gray-50 opacity-60 hover:opacity-80 transition-all"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gray-300 flex items-center justify-center text-3xl grayscale">
                      {achievement.icon}
                    </div>
                    <h4 className="font-bold text-gray-600 mt-3">{achievement.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">{achievement.description}</p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400 text-white">
                        {t.rarity[achievement.rarity]}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold">+{achievement.points} {t.points}</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Lock className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AchievementsPage;
