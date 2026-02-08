import React, { useState, useEffect, memo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Gift, Flame, Target, Trophy, Star, ChevronRight, Check } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: "Tägliche Quests",
    subtitle: "Erledige Aufgaben und verdiene Belohnungen!",
    progress: "Fortschritt",
    reward: "Belohnung",
    claim: "Abholen",
    completed: "Erledigt",
    bids: "Gebote",
    streak: "Streak",
    days: "Tage",
    quests: {
      daily_login: "Täglich einloggen",
      place_bids: "Platziere 5 Gebote",
      win_auction: "Gewinne eine Auktion",
      invite_friend: "Lade einen Freund ein",
      buy_bids: "Kaufe ein Gebotspaket",
      bid_auctions: "Biete auf Auktionen",
      total_bids: "Platziere Gebote",
      visit_page: "Seite besuchen",
      watch_auction: "Auktion beobachten",
      spin_wheel: "Drehe das Glücksrad",
      share_social: "Teile auf Social Media"
    },
    noQuests: "Keine aktiven Quests"
  },
  en: {
    title: "Daily Quests",
    subtitle: "Complete tasks and earn rewards!",
    progress: "Progress",
    reward: "Reward",
    claim: "Claim",
    completed: "Completed",
    bids: "Bids",
    streak: "Streak",
    days: "Days",
    quests: {
      daily_login: "Daily login",
      place_bids: "Place 5 bids",
      win_auction: "Win an auction",
      invite_friend: "Invite a friend",
      buy_bids: "Buy a bid package",
      bid_auctions: "Bid on auctions",
      total_bids: "Place bids",
      visit_page: "Visit page",
      watch_auction: "Watch an auction",
      spin_wheel: "Spin the wheel",
      share_social: "Share on social media"
    },
    noQuests: "No active quests"
  },
  sq: {
    title: "Detyrat Ditore",
    subtitle: "Përfundo detyrat dhe fito shpërblime!",
    progress: "Progresi",
    reward: "Shpërblimi",
    claim: "Merr",
    completed: "Përfunduar",
    bids: "Oferta",
    streak: "Streak",
    days: "Ditë",
    quests: {
      daily_login: "Hyr çdo ditë",
      place_bids: "Vendos 5 oferta",
      win_auction: "Fito një ankand",
      invite_friend: "Fto një mik",
      buy_bids: "Bli një paketë ofertash",
      bid_auctions: "Ofro në ankande",
      total_bids: "Vendos oferta",
      visit_page: "Vizito faqen",
      watch_auction: "Shiko ankandin",
      spin_wheel: "Rrotullo rrotën",
      share_social: "Shpërndaj në rrjete sociale"
    },
    noQuests: "Asnjë detyrë aktive"
  },
  xk: {
    title: "Detyrat Ditore",
    subtitle: "Përfundo detyrat dhe fito shpërblime!",
    progress: "Progresi",
    reward: "Shpërblimi",
    claim: "Merr",
    completed: "Përfunduar",
    bids: "Oferta",
    streak: "Streak",
    days: "Ditë",
    quests: {
      daily_login: "Hyr çdo ditë",
      place_bids: "Vendos 5 oferta",
      win_auction: "Fito një ankand",
      invite_friend: "Fto një mik",
      buy_bids: "Bli një paketë ofertash",
      bid_auctions: "Ofro në ankande",
      total_bids: "Vendos oferta",
      visit_page: "Vizito faqen",
      watch_auction: "Shiko ankandin",
      spin_wheel: "Rrotullo rrotën",
      share_social: "Shpërndaj në rrjete sociale"
    },
    noQuests: "Asnjë detyrë aktive"
  }
};

// Default quests if API doesn't return any
const DEFAULT_QUESTS = [
  { id: 'daily_login', type: 'daily_login', target: 1, progress: 0, reward_bids: 2, completed: false },
  { id: 'place_bids', type: 'place_bids', target: 5, progress: 0, reward_bids: 3, completed: false },
  { id: 'win_auction', type: 'win_auction', target: 1, progress: 0, reward_bids: 10, completed: false }
];

const QuestIcon = ({ type }) => {
  switch (type) {
    case 'daily_login':
      return <Star className="w-5 h-5" />;
    case 'place_bids':
      return <Target className="w-5 h-5" />;
    case 'win_auction':
      return <Trophy className="w-5 h-5" />;
    case 'invite_friend':
      return <Gift className="w-5 h-5" />;
    case 'buy_bids':
      return <Flame className="w-5 h-5" />;
    default:
      return <Star className="w-5 h-5" />;
  }
};

const QuestItem = memo(({ quest, t, onClaim, language }) => {
  const progress = Math.min(quest.progress || 0, quest.target || 1);
  const target = quest.target || 1;
  const progressPercent = (progress / target) * 100;
  const isComplete = progress >= target;
  const isClaimed = quest.claimed;
  
  // Get localized quest name - try backend data first, then fallback to translations
  const questName = language === 'de' 
    ? (quest.name_de || t.quests[quest.type] || quest.type)
    : (quest.name_en || t.quests[quest.type] || quest.type);
  
  return (
    <div className={`p-3 rounded-lg border ${isComplete ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${isComplete ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          {isComplete ? <Check className="w-5 h-5" /> : <QuestIcon type={quest.type} />}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800 truncate">{questName}</h4>
            <span className="text-xs font-bold text-amber-600">
              +{quest.reward_bids} {t.bids}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-cyan-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 whitespace-nowrap">
              {progress}/{target}
            </span>
          </div>
        </div>
        
        {/* Action Button */}
        {isComplete && !isClaimed && (
          <button
            onClick={() => onClaim(quest.id)}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
          >
            {t.claim}
          </button>
        )}
        {isClaimed && (
          <span className="text-xs text-green-600 font-semibold">
            ✓ {t.completed}
          </span>
        )}
      </div>
    </div>
  );
});

const DailyQuestsWidget = memo(() => {
  const { isAuthenticated, token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [quests, setQuests] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const t = translations[langKey] || translations.de;
  
  useEffect(() => {
    const fetchQuests = async () => {
      if (!isAuthenticated || !token) {
        setQuests(DEFAULT_QUESTS);
        setLoading(false);
        return;
      }
      
      try {
        const res = await axios.get(`${API}/daily/quests`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setQuests(res.data.quests || DEFAULT_QUESTS);
        setStreak(res.data.streak || 0);
      } catch (err) {
        console.error('Error fetching quests:', err);
        setQuests(DEFAULT_QUESTS);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuests();
  }, [isAuthenticated, token]);
  
  const handleClaim = async (questId) => {
    if (!isAuthenticated || !token) return;
    
    try {
      await axios.post(`${API}/daily/quests/${questId}/claim`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setQuests(prev => prev.map(q => 
        q.id === questId ? { ...q, claimed: true } : q
      ));
    } catch (err) {
      console.error('Error claiming quest:', err);
    }
  };
  
  if (!isAuthenticated) return null;
  
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32 mb-3"></div>
        <div className="space-y-2">
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm" data-testid="daily-quests-widget">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">{t.title}</h3>
            <p className="text-xs text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        
        {/* Streak Badge */}
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-full">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-amber-700">
              {streak} {t.days}
            </span>
          </div>
        )}
      </div>
      
      {/* Quests List */}
      <div className="space-y-2">
        {quests.length > 0 ? (
          quests.slice(0, 3).map((quest) => (
            <QuestItem key={quest.id} quest={quest} t={t} onClaim={handleClaim} language={language} />
          ))
        ) : (
          <p className="text-center text-gray-500 py-4">{t.noQuests}</p>
        )}
      </div>
      
      {/* View All Link */}
      {quests.length > 3 && (
        <div className="mt-3 text-center">
          <a 
            href="/dashboard" 
            className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700 font-semibold"
          >
            Alle Quests <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
});

export default DailyQuestsWidget;
