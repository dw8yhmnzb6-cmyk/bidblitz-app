import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { 
  Trophy, Lock, Gift, ArrowLeft, Zap, Star, Crown, 
  Target, Moon, Sun, Heart, Users, Sparkles, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// All achievement definitions
const ALL_ACHIEVEMENTS = [
  { id: "first_win", name: "Erster Sieg", name_en: "First Win", description: "Gewinne deine erste Auktion", description_en: "Win your first auction", icon: "🏆", bids_reward: 5, category: "wins" },
  { id: "wins_10", name: "Sammler", name_en: "Collector", description: "Gewinne 10 Auktionen", description_en: "Win 10 auctions", icon: "🎯", bids_reward: 20, category: "wins" },
  { id: "wins_50", name: "Profi", name_en: "Pro", description: "Gewinne 50 Auktionen", description_en: "Win 50 auctions", icon: "⭐", bids_reward: 100, category: "wins" },
  { id: "wins_100", name: "Meister", name_en: "Master", description: "Gewinne 100 Auktionen", description_en: "Win 100 auctions", icon: "👑", bids_reward: 250, category: "wins" },
  { id: "night_owl", name: "Nachteule", name_en: "Night Owl", description: "Gewinne 5 Nacht-Auktionen", description_en: "Win 5 night auctions", icon: "🦉", bids_reward: 15, category: "special" },
  { id: "early_bird", name: "Frühaufsteher", name_en: "Early Bird", description: "Biete vor 8 Uhr morgens", description_en: "Bid before 8 AM", icon: "🐦", bids_reward: 5, category: "special" },
  { id: "big_spender", name: "Großzügig", name_en: "Big Spender", description: "Kaufe Gebote für über €100", description_en: "Buy bids worth over €100", icon: "💎", bids_reward: 30, category: "spending" },
  { id: "lucky_winner", name: "Glückspilz", name_en: "Lucky Winner", description: "Gewinne mit nur 1 Gebot", description_en: "Win with just 1 bid", icon: "🍀", bids_reward: 10, category: "special" },
  { id: "streak_7", name: "Wochensieger", name_en: "Week Champion", description: "7 Tage Login-Streak", description_en: "7 day login streak", icon: "🔥", bids_reward: 10, category: "streak" },
  { id: "streak_30", name: "Monatssieger", name_en: "Month Champion", description: "30 Tage Login-Streak", description_en: "30 day login streak", icon: "💪", bids_reward: 50, category: "streak" },
  { id: "referral_5", name: "Werber", name_en: "Recruiter", description: "Werbe 5 Freunde", description_en: "Refer 5 friends", icon: "👥", bids_reward: 25, category: "social" },
  { id: "beginner_champ", name: "Anfänger-Champion", name_en: "Beginner Champ", description: "Gewinne 3 Anfänger-Auktionen", description_en: "Win 3 beginner auctions", icon: "🎓", bids_reward: 15, category: "special" },
];

const CATEGORY_LABELS = {
  de: { wins: "Siege", special: "Spezial", spending: "Einkäufe", streak: "Streak", social: "Sozial" },
  en: { wins: "Wins", special: "Special", spending: "Spending", streak: "Streak", social: "Social" }
};

export default function Achievements() {
  const { user, token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [achievements, setAchievements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const texts = {
    de: {
      title: "Erfolge",
      subtitle: "Sammle Badges und verdiene Bonus-Gebote!",
      earned: "Verdient",
      locked: "Noch nicht freigeschaltet",
      reward: "Belohnung",
      bids: "Gebote",
      progress: "Fortschritt",
      all: "Alle",
      loginRequired: "Melde dich an, um deine Erfolge zu sehen",
      totalEarned: "Verdiente Badges",
      totalRewards: "Bonus-Gebote verdient",
      backToAuctions: "Zurück zu Auktionen"
    },
    en: {
      title: "Achievements",
      subtitle: "Collect badges and earn bonus bids!",
      earned: "Earned",
      locked: "Not yet unlocked",
      reward: "Reward",
      bids: "Bids",
      progress: "Progress",
      all: "All",
      loginRequired: "Log in to see your achievements",
      totalEarned: "Badges Earned",
      totalRewards: "Bonus Bids Earned",
      backToAuctions: "Back to Auctions"
    },
    sq: {
      title: "Arritjet",
      subtitle: "Mblidh distinktive dhe fito oferta bonus!",
      earned: "Fituar",
      locked: "Nuk është hapur ende",
      reward: "Shpërblimi",
      bids: "Oferta",
      progress: "Progresi",
      all: "Të gjitha",
      loginRequired: "Kyçu për të parë arritjet e tua",
      totalEarned: "Distinktive të Fituara",
      totalRewards: "Oferta Bonus të Fituara",
      backToAuctions: "Kthehu te Ankandat"
    }
  };
  const t = texts[langKey] || texts.de;
  const catLabels = CATEGORY_LABELS[language] || CATEGORY_LABELS.de;

  useEffect(() => {
    if (token) {
      fetchAchievements();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchAchievements = async () => {
    try {
      const res = await axios.get(`${API}/auth/achievements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAchievements(res.data);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const earnedIds = new Set(achievements?.earned?.map(a => a.id) || []);
  
  const filteredAchievements = ALL_ACHIEVEMENTS.filter(a => 
    selectedCategory === 'all' || a.category === selectedCategory
  );

  const totalBidsEarned = achievements?.earned?.reduce((sum, a) => sum + (a.bids_reward || 0), 0) || 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#0d2137] py-8 px-4">
        <div className="max-w-4xl mx-auto text-center py-20">
          <Trophy className="w-20 h-20 text-[#7C3AED] mx-auto mb-6 opacity-50" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">{t.loginRequired}</h1>
          <Link to="/login">
            <Button className="bg-[#7C3AED] hover:bg-[#6D28D9]">
              Anmelden
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#0d2137] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4">
            <ArrowLeft className="w-4 h-4" />
            {t.backToAuctions}
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center">
                <Trophy className="w-8 h-8 text-gray-800" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{t.title}</h1>
                <p className="text-gray-500">{t.subtitle}</p>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex gap-4">
              <div className="glass-card rounded-xl px-6 py-4 text-center">
                <p className="text-3xl font-bold text-[#7C3AED]">{achievements?.total_earned || 0}</p>
                <p className="text-gray-500 text-sm">/ {achievements?.total_available || 12}</p>
                <p className="text-gray-800 text-xs mt-1">{t.totalEarned}</p>
              </div>
              <div className="glass-card rounded-xl px-6 py-4 text-center">
                <p className="text-3xl font-bold text-[#10B981]">+{totalBidsEarned}</p>
                <p className="text-gray-500 text-sm">{t.bids}</p>
                <p className="text-gray-800 text-xs mt-1">{t.totalRewards}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[#7C3AED] text-gray-800'
                : 'bg-white text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.all} ({ALL_ACHIEVEMENTS.length})
          </button>
          {Object.keys(catLabels).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#7C3AED] text-gray-800'
                  : 'bg-white text-gray-500 hover:text-gray-800'
              }`}
            >
              {catLabels[cat]} ({ALL_ACHIEVEMENTS.filter(a => a.category === cat).length})
            </button>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="glass-card rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-800 font-medium">{t.progress}</span>
            <span className="text-[#7C3AED] font-bold">
              {achievements?.total_earned || 0} / {achievements?.total_available || 12}
            </span>
          </div>
          <div className="h-3 bg-white rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] rounded-full transition-all duration-500"
              style={{ width: `${((achievements?.total_earned || 0) / (achievements?.total_available || 12)) * 100}%` }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAchievements.map((achievement) => {
              const isEarned = earnedIds.has(achievement.id);
              const name = language === 'en' ? achievement.name_en : achievement.name;
              const description = language === 'en' ? achievement.description_en : achievement.description;
              
              return (
                <div
                  key={achievement.id}
                  className={`glass-card rounded-xl p-6 transition-all duration-300 ${
                    isEarned 
                      ? 'border border-[#7C3AED]/50 bg-[#7C3AED]/10' 
                      : 'opacity-60 hover:opacity-80'
                  }`}
                  data-testid={`achievement-${achievement.id}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl ${
                      isEarned 
                        ? 'bg-gradient-to-br from-[#7C3AED] to-[#06B6D4]' 
                        : 'bg-white'
                    }`}>
                      {isEarned ? (
                        achievement.icon
                      ) : (
                        <Lock className="w-6 h-6 text-gray-500" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-gray-800 font-bold">{name}</h3>
                        {isEarned && (
                          <CheckCircle className="w-4 h-4 text-[#10B981]" />
                        )}
                      </div>
                      <p className="text-gray-500 text-sm mb-3">{description}</p>
                      
                      {/* Reward */}
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                        isEarned ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-white text-gray-500'
                      }`}>
                        <Gift className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          +{achievement.bids_reward} {t.bids}
                        </span>
                        {isEarned && (
                          <span className="text-xs">✓ {t.earned}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tips Section */}
        <div className="mt-8 glass-card rounded-xl p-6 border-l-4 border-[#F59E0B]">
          <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#F59E0B]" />
            Tipps zum Freischalten
          </h3>
          <ul className="space-y-2 text-gray-500 text-sm">
            <li>🎯 <strong className="text-gray-800">Erster Sieg:</strong> Nimm an einer Auktion teil und gewinne!</li>
            <li>🔥 <strong className="text-gray-800">Streak-Bonus:</strong> Melde dich 7 Tage hintereinander an</li>
            <li>🦉 <strong className="text-gray-800">Nachteule:</strong> Gewinne Auktionen zwischen 22:00 und 6:00 Uhr</li>
            <li>🍀 <strong className="text-gray-800">Glückspilz:</strong> Manchmal reicht ein einziges Gebot zum Sieg!</li>
            <li>👥 <strong className="text-gray-800">Werber:</strong> Teile deinen Empfehlungscode mit Freunden</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
