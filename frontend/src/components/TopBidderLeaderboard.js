/**
 * Top Bidder Badge - Shows daily top bidder and rewards
 * Gamification element to encourage more bidding
 */
import { useState, useEffect, memo } from 'react';
import { Trophy, Crown, Star, Flame, Gift } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: 'Bieter des Tages',
    subtitle: 'Top Bieter heute',
    youAre: 'Du bist',
    place: 'Platz',
    bidsToday: 'Gebote heute',
    reward: 'Tagessieger bekommt',
    freeBids: 'Gratis-Gebote',
    yourBids: 'Deine Gebote',
    leader: 'Führend',
    you: '(Du)'
  },
  en: {
    title: 'Bidder of the Day',
    subtitle: 'Top bidders today',
    youAre: 'You are',
    place: 'Place',
    bidsToday: 'Bids today',
    reward: 'Daily winner gets',
    freeBids: 'Free bids',
    yourBids: 'Your bids',
    leader: 'Leading',
    you: '(You)'
  },
  sq: {
    title: 'Ofertuesi i Ditës',
    subtitle: 'Ofertuesit kryesorë sot',
    youAre: 'Ti je',
    place: 'Vendi',
    bidsToday: 'Oferta sot',
    reward: 'Fituesi ditor merr',
    freeBids: 'Oferta falas',
    yourBids: 'Ofertat e tua',
    leader: 'Kryesues',
    you: '(Ti)'
  },
  tr: {
    title: 'Günün Teklif Vereni',
    subtitle: 'Bugünün en iyi teklif verenleri',
    youAre: 'Sen',
    place: 'Sıra',
    bidsToday: 'Bugünkü teklifler',
    reward: 'Günlük kazanan alır',
    freeBids: 'Ücretsiz teklif',
    yourBids: 'Senin tekliflerin',
    leader: 'Lider',
    you: '(Sen)'
  }
};

// Compact widget for sidebar/navbar
export const TopBidderBadge = memo(({ language = 'de' }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [topBidders, setTopBidders] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userBids, setUserBids] = useState(0);
  
  const t = translations[language] || translations.de;
  
  useEffect(() => {
    const fetchTopBidders = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API}/gamification/top-bidders/today`, { headers });
        setTopBidders(res.data.top_bidders || []);
        if (res.data.user_rank) {
          setUserRank(res.data.user_rank);
          setUserBids(res.data.user_bids || 0);
        }
      } catch (err) {
        // Use mock data
        setTopBidders([
          { name: 'Max M.', bids: 45 },
          { name: 'Anna S.', bids: 38 },
          { name: 'Tim K.', bids: 32 }
        ]);
      }
    };
    
    fetchTopBidders();
    const interval = setInterval(fetchTopBidders, 60000);
    return () => clearInterval(interval);
  }, [token]);
  
  if (topBidders.length === 0) return null;
  
  const leader = topBidders[0];
  
  return (
    <div 
      className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 
        rounded-xl p-3 shadow-sm"
      data-testid="top-bidder-badge"
    >
      <div className="flex items-center gap-2 mb-2">
        <Crown className="w-5 h-5 text-amber-500" />
        <span className="text-sm font-bold text-gray-800">{t.title}</span>
      </div>
      
      {/* Leader */}
      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-amber-400 to-orange-400 
        rounded-lg text-white mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          <span className="font-bold text-sm">{leader.name}</span>
        </div>
        <span className="text-xs font-medium">{leader.bids} {t.bidsToday}</span>
      </div>
      
      {/* User position if authenticated */}
      {isAuthenticated && userRank && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>{t.youAre} #{userRank}</span>
          <span>{userBids} {t.bidsToday}</span>
        </div>
      )}
      
      {/* Reward info */}
      <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-600">
        <Gift className="w-3 h-3" />
        <span>{t.reward}: <strong>10 {t.freeBids}</strong></span>
      </div>
    </div>
  );
});

// Full leaderboard component
const TopBidderLeaderboard = memo(({ language = 'de' }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [topBidders, setTopBidders] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userBids, setUserBids] = useState(0);
  
  const t = translations[language] || translations.de;
  
  useEffect(() => {
    const fetchTopBidders = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API}/gamification/top-bidders/today?limit=10`, { headers });
        setTopBidders(res.data.top_bidders || []);
        if (res.data.user_rank) {
          setUserRank(res.data.user_rank);
          setUserBids(res.data.user_bids || 0);
        }
      } catch (err) {
        // Mock data
        setTopBidders([
          { name: 'Max M.', bids: 45, avatar: null },
          { name: 'Anna S.', bids: 38, avatar: null },
          { name: 'Tim K.', bids: 32, avatar: null },
          { name: 'Lisa B.', bids: 28, avatar: null },
          { name: 'Jan P.', bids: 25, avatar: null }
        ]);
      }
    };
    
    fetchTopBidders();
    const interval = setInterval(fetchTopBidders, 30000);
    return () => clearInterval(interval);
  }, [token]);
  
  const getRankIcon = (index) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Trophy className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-gray-500 font-bold">{index + 1}</span>;
  };
  
  const getRankBg = (index) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-400 to-amber-400 text-white';
    if (index === 1) return 'bg-gray-100';
    if (index === 2) return 'bg-amber-50';
    return 'bg-white';
  };
  
  return (
    <div 
      className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      data-testid="top-bidder-leaderboard"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-full">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{t.title}</h3>
            <p className="text-white/80 text-sm">{t.subtitle}</p>
          </div>
        </div>
        
        {/* Reward banner */}
        <div className="mt-3 flex items-center gap-2 p-2 bg-white/20 rounded-lg">
          <Gift className="w-4 h-4" />
          <span className="text-sm">{t.reward}: <strong>10 {t.freeBids}</strong></span>
          <Flame className="w-4 h-4 text-yellow-300 animate-pulse" />
        </div>
      </div>
      
      {/* Leaderboard */}
      <div className="p-4 space-y-2">
        {topBidders.map((bidder, index) => {
          const isCurrentUser = isAuthenticated && bidder.user_id === user?.id;
          
          return (
            <div 
              key={index}
              className={`flex items-center justify-between p-3 rounded-xl transition-all ${getRankBg(index)} 
                ${isCurrentUser ? 'ring-2 ring-amber-400' : ''}`}
            >
              <div className="flex items-center gap-3">
                {getRankIcon(index)}
                <div>
                  <span className={`font-medium ${index === 0 ? 'text-white' : 'text-gray-800'}`}>
                    {bidder.name}
                    {isCurrentUser && <span className="ml-1 text-xs">{t.you}</span>}
                  </span>
                  {index === 0 && (
                    <span className="ml-2 text-xs bg-white/30 px-2 py-0.5 rounded-full">
                      {t.leader}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Star className={`w-4 h-4 ${index === 0 ? 'text-yellow-200' : 'text-amber-400'}`} />
                <span className={`font-bold ${index === 0 ? 'text-white' : 'text-gray-700'}`}>
                  {bidder.bids}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* User position if not in top 10 */}
      {isAuthenticated && userRank && userRank > 10 && (
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 flex items-center justify-center bg-amber-200 rounded-full font-bold text-amber-700">
                {userRank}
              </span>
              <span className="font-medium text-gray-800">{t.youAre} #{userRank}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-gray-700">{userBids}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

TopBidderBadge.displayName = 'TopBidderBadge';
TopBidderLeaderboard.displayName = 'TopBidderLeaderboard';

export default TopBidderLeaderboard;
