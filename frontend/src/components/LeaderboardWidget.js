import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Trophy, Crown, Medal, ChevronRight, Flame, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Widget translations
const widgetTexts = {
  de: {
    title: 'Wöchentliche Champions',
    subtitle: 'Top Bieter diese Woche',
    viewAll: 'Alle ansehen',
    points: 'Punkte',
    wins: 'Gewinne',
    bids: 'Gebote',
    noData: 'Noch keine Teilnehmer',
    joinNow: 'Jetzt mitmachen!',
    prize: 'Preis'
  },
  en: {
    title: 'Weekly Champions',
    subtitle: 'Top bidders this week',
    viewAll: 'View all',
    points: 'Points',
    wins: 'Wins',
    bids: 'Bids',
    noData: 'No participants yet',
    joinNow: 'Join now!',
    prize: 'Prize'
  },
  sq: {
    title: 'Kampionët Javore',
    subtitle: 'Ofertuesit kryesorë këtë javë',
    viewAll: 'Shiko të gjithë',
    points: 'Pikë',
    wins: 'Fitore',
    bids: 'Oferta',
    noData: 'Ende asnjë pjesëmarrës',
    joinNow: 'Bashkohu tani!',
    prize: 'Çmimi'
  },
  xk: {
    title: 'Kampionët Javore',
    subtitle: 'Ofertuesit kryesorë këtë javë',
    viewAll: 'Shiko të gjithë',
    points: 'Pikë',
    wins: 'Fitore',
    bids: 'Oferta',
    noData: 'Ende asnjë pjesëmarrës',
    joinNow: 'Bashkohu tani!',
    prize: 'Çmimi'
  },
  tr: {
    title: 'Haftalık Şampiyonlar',
    subtitle: 'Bu haftanın en iyi teklif verenleri',
    viewAll: 'Tümünü gör',
    points: 'Puan',
    wins: 'Kazanma',
    bids: 'Teklifler',
    noData: 'Henüz katılımcı yok',
    joinNow: 'Şimdi katıl!',
    prize: 'Ödül'
  },
  fr: {
    title: 'Champions de la Semaine',
    subtitle: 'Meilleurs enchérisseurs cette semaine',
    viewAll: 'Voir tout',
    points: 'Points',
    wins: 'Victoires',
    bids: 'Enchères',
    noData: 'Pas encore de participants',
    joinNow: 'Participez maintenant!',
    prize: 'Prix'
  }
};

// Leaderboard entry component
const LeaderboardEntry = memo(({ entry, rank, language = 'de' }) => {
  const t = widgetTexts[language] || widgetTexts.de;
  
  const getRankIcon = (r) => {
    switch(r) {
      case 1: return <Crown className="w-5 h-5 text-yellow-400" />;
      case 2: return <Medal className="w-5 h-5 text-gray-400" />;
      case 3: return <Medal className="w-5 h-5 text-orange-400" />;
      default: return <span className="text-gray-500 font-bold">{r}</span>;
    }
  };
  
  const getRankBg = (r) => {
    switch(r) {
      case 1: return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-400/50';
      case 2: return 'bg-gradient-to-r from-gray-400/10 to-gray-500/10 border-gray-400/30';
      case 3: return 'bg-gradient-to-r from-orange-400/10 to-orange-500/10 border-orange-400/30';
      default: return 'bg-white/50 border-gray-200';
    }
  };
  
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${getRankBg(rank)} transition-all hover:scale-[1.02]`}>
      {/* Rank */}
      <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center">
        {getRankIcon(rank)}
      </div>
      
      {/* User Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 truncate">{entry.username}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            {entry.score} {t.points}
          </span>
          {entry.wins > 0 && (
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-500" />
              {entry.wins} {t.wins}
            </span>
          )}
        </div>
      </div>
      
      {/* Prize Badge */}
      {entry.prize?.bids > 0 && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <Star className="w-3 h-3" />
          +{entry.prize.bids}
        </div>
      )}
    </div>
  );
});

// Main Widget Component
const LeaderboardWidget = memo(({ className = '', language = 'de' }) => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const t = widgetTexts[language] || widgetTexts.de;
  
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get(`${API}/api/tournaments/leaderboard?limit=3`);
        setLeaderboard(res.data.leaderboard || []);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        // Fallback mock data for demo
        setLeaderboard([
          { user_id: '1', username: 'BidMaster99', score: 1250, wins: 8, prize: { title: '1. Platz', bids: 100 } },
          { user_id: '2', username: 'LuckyBieter', score: 980, wins: 5, prize: { title: '2. Platz', bids: 50 } },
          { user_id: '3', username: 'AuctionPro', score: 750, wins: 3, prize: { title: '3. Platz', bids: 25 } }
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeaderboard();
  }, []);
  
  if (loading) {
    return (
      <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-100 rounded w-1/3"></div>
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden ${className}`} data-testid="leaderboard-widget">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{t.title}</h3>
              <p className="text-white/80 text-xs">{t.subtitle}</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/tournaments')}
            className="flex items-center gap-1 text-white/90 hover:text-white text-sm font-medium transition-colors"
          >
            {t.viewAll}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Leaderboard List */}
      <div className="p-4 space-y-2">
        {leaderboard.length === 0 ? (
          <div className="text-center py-6">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">{t.noData}</p>
            <button 
              onClick={() => navigate('/register')}
              className="mt-3 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-full text-sm hover:shadow-lg transition-all"
            >
              {t.joinNow}
            </button>
          </div>
        ) : (
          leaderboard.map((entry, index) => (
            <LeaderboardEntry 
              key={entry.user_id} 
              entry={entry} 
              rank={index + 1}
              language={language}
            />
          ))
        )}
      </div>
      
      {/* Footer CTA */}
      {leaderboard.length > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => navigate('/tournaments')}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Flame className="w-5 h-5" />
            {t.joinNow}
          </button>
        </div>
      )}
    </div>
  );
});

export default LeaderboardWidget;
