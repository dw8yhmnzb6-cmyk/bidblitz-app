import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Trophy, Star, Target, Zap, Lock, Gift, Medal, Crown, Flame, Users } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_ICONS = {
  bidding: <Zap className="w-5 h-5" />,
  winning: <Trophy className="w-5 h-5" />,
  special: <Star className="w-5 h-5" />,
  social: <Users className="w-5 h-5" />,
  loyalty: <Medal className="w-5 h-5" />
};

const CATEGORY_COLORS = {
  bidding: 'from-blue-500 to-cyan-500',
  winning: 'from-yellow-500 to-orange-500',
  special: 'from-purple-500 to-pink-500',
  social: 'from-green-500 to-emerald-500',
  loyalty: 'from-red-500 to-rose-500'
};

export default function AchievementsPage() {
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const { token } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  const texts = {
    de: {
      title: 'Erfolge',
      subtitle: 'Sammle Abzeichen & verdiene Bonus-Gebote',
      earned: 'Verdient',
      locked: 'Gesperrt',
      progress: 'Fortschritt',
      reward: 'Belohnung',
      bids: 'Gebote',
      all: 'Alle',
      bidding: 'Bieten',
      winning: 'Gewinnen',
      special: 'Spezial',
      social: 'Sozial',
      loyalty: 'Treue',
      totalEarned: 'Gesamt verdient',
      completion: 'Abgeschlossen',
      nextUp: 'Nächste Erfolge',
      almostThere: 'Fast geschafft!'
    },
    en: {
      title: 'Achievements',
      subtitle: 'Collect badges & earn bonus bids',
      earned: 'Earned',
      locked: 'Locked',
      progress: 'Progress',
      reward: 'Reward',
      bids: 'bids',
      all: 'All',
      bidding: 'Bidding',
      winning: 'Winning',
      special: 'Special',
      social: 'Social',
      loyalty: 'Loyalty',
      totalEarned: 'Total earned',
      completion: 'Completed',
      nextUp: 'Next Achievements',
      almostThere: 'Almost there!'
    }
  };

  const t = texts[langKey] || texts.de;

  useEffect(() => {
    if (token) {
      fetchAchievements();
      fetchProgress();
    }
  }, [token]);

  const fetchAchievements = async () => {
    try {
      const res = await fetch(`${API_URL}/api/achievements/my-achievements?language=${language}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAchievements(data.achievements || []);
      setStats(data.stats);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchProgress = async () => {
    try {
      const res = await fetch(`${API_URL}/api/achievements/progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setProgress(data.progress || []);
    } catch (err) {
      console.error(err);
    }
  };

  const categories = ['all', 'bidding', 'winning', 'special', 'social', 'loyalty'];
  
  const filteredAchievements = activeCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === activeCategory);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="achievements-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] mb-4">
            <Trophy className="w-10 h-10 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-[#1A1A2E] border-gray-200">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-800">{stats.earned}/{stats.total}</p>
                <p className="text-xs text-gray-500">{t.earned}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#1A1A2E] border-gray-200">
              <CardContent className="p-4 text-center">
                <Target className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-800">{stats.progress_percent}%</p>
                <p className="text-xs text-gray-500">{t.completion}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#1A1A2E] border-gray-200">
              <CardContent className="p-4 text-center">
                <Gift className="w-8 h-8 text-[#7C3AED] mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-800">{stats.total_rewards_earned}</p>
                <p className="text-xs text-gray-500">{t.totalEarned} {t.bids}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Progress - Next Up */}
        {progress.length > 0 && (
          <Card className="bg-[#1A1A2E] border-gray-200 mb-6">
            <CardHeader>
              <CardTitle className="text-gray-800 flex items-center">
                <Flame className="w-5 h-5 mr-2 text-[#F59E0B]" />
                {t.nextUp}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {progress.slice(0, 3).map((p) => (
                <div key={p.id} className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{p.icon}</span>
                      <div>
                        <p className="text-gray-800 font-medium">{p.name}</p>
                        <p className="text-gray-500 text-xs">+{p.reward_bids} {t.bids}</p>
                      </div>
                    </div>
                    <Badge className={p.progress_percent >= 80 ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-white/10 text-gray-800'}>
                      {p.current}/{p.target}
                    </Badge>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-[#7C3AED] to-[#10B981] h-2 rounded-full transition-all"
                      style={{ width: `${p.progress_percent}%` }}
                    />
                  </div>
                  {p.progress_percent >= 80 && (
                    <p className="text-[#10B981] text-xs mt-1">{t.almostThere}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className={activeCategory === cat 
                ? 'bg-[#7C3AED]' 
                : 'border-gray-300 text-gray-800 hover:bg-white/5'
              }
            >
              {cat !== 'all' && CATEGORY_ICONS[cat]}
              <span className="ml-1">{t[cat]}</span>
            </Button>
          ))}
        </div>

        {/* Achievements Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Laden...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredAchievements.map((ach) => (
              <Card 
                key={ach.id} 
                className={`border-gray-200 transition-all ${
                  ach.earned 
                    ? 'bg-gradient-to-br from-[#1A1A2E] to-[#2D1F4E] border-[#7C3AED]/30' 
                    : 'bg-[#1A1A2E] opacity-60'
                }`}
              >
                <CardContent className="p-4 text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
                    ach.earned 
                      ? `bg-gradient-to-br ${CATEGORY_COLORS[ach.category] || 'from-gray-500 to-gray-600'}` 
                      : 'bg-white/10'
                  }`}>
                    <span className="text-3xl">{ach.icon}</span>
                  </div>
                  <h3 className="text-gray-800 font-medium mb-1">{ach.name}</h3>
                  <p className="text-gray-500 text-xs mb-2">{ach.description}</p>
                  <div className="flex items-center justify-center gap-2">
                    <Badge className={ach.earned ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-white/10 text-gray-500'}>
                      {ach.earned ? (
                        <>
                          <Star className="w-3 h-3 mr-1" />
                          {t.earned}
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 mr-1" />
                          {t.locked}
                        </>
                      )}
                    </Badge>
                    <Badge className="bg-[#7C3AED]/20 text-[#7C3AED]">
                      +{ach.reward_bids}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
