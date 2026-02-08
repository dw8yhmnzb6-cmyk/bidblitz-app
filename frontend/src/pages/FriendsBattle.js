import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Swords, Trophy, Users, Search, Check, X, Clock, 
  Zap, Crown, Target, Medal, RefreshCw, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

const API = process.env.REACT_APP_BACKEND_URL;

export default function FriendsBattle() {
  const { isAuthenticated, token, user } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [challenges, setChallenges] = useState({ received: [], sent: [], active: [] });
  const [activeBattles, setActiveBattles] = useState([]);
  const [history, setHistory] = useState({ history: [], stats: {} });
  const [leaderboard, setLeaderboard] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [auctions, setAuctions] = useState([]);

  const t = {
    de: {
      title: 'Friends Battle',
      subtitle: 'Fordere deine Freunde zum Bieter-Duell heraus!',
      active: 'Aktive Battles',
      challenges: 'Herausforderungen',
      history: 'Verlauf',
      leaderboard: 'Bestenliste',
      searchFriends: 'Freund suchen...',
      challenge: 'Herausfordern',
      noBattles: 'Keine aktiven Battles',
      startBattle: 'Starte dein erstes Battle!',
      yourBids: 'Deine Gebote',
      opponentBids: 'Gegner Gebote',
      winning: 'Du führst!',
      losing: 'Aufholen!',
      accept: 'Annehmen',
      decline: 'Ablehnen',
      pending: 'Ausstehend',
      won: 'Gewonnen',
      lost: 'Verloren',
      wins: 'Siege',
      losses: 'Niederlagen',
      winRate: 'Siegquote',
      selectAuction: 'Wähle eine Auktion',
      wagerBids: 'Einsatz (Gebote)',
      sendChallenge: 'Herausforderung senden'
    },
    en: {
      title: 'Friends Battle',
      subtitle: 'Challenge your friends to a bidding duel!',
      active: 'Active Battles',
      challenges: 'Challenges',
      history: 'History',
      leaderboard: 'Leaderboard',
      searchFriends: 'Search friend...',
      challenge: 'Challenge',
      noBattles: 'No active battles',
      startBattle: 'Start your first battle!',
      yourBids: 'Your Bids',
      opponentBids: 'Opponent Bids',
      winning: 'You\'re winning!',
      losing: 'Catch up!',
      accept: 'Accept',
      decline: 'Decline',
      pending: 'Pending',
      won: 'Won',
      lost: 'Lost',
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
      selectAuction: 'Select an auction',
      wagerBids: 'Wager (bids)',
      sendChallenge: 'Send Challenge'
    }
  }[langKey] || {};

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [challengesRes, activeRes, historyRes, leaderboardRes, auctionsRes] = await Promise.all([
        fetch(`${API}/api/friends-battle/challenges`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/friends-battle/active`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/friends-battle/history`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/friends-battle/leaderboard`),
        fetch(`${API}/api/auctions?status=active`)
      ]);

      if (challengesRes.ok) setChallenges(await challengesRes.json());
      if (activeRes.ok) setActiveBattles((await activeRes.json()).battles || []);
      if (historyRes.ok) setHistory(await historyRes.json());
      if (leaderboardRes.ok) setLeaderboard((await leaderboardRes.json()).leaderboard || []);
      if (auctionsRes.ok) setAuctions((await auctionsRes.json()).auctions || []);
    } catch (error) {
      console.error('Error fetching battle data:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`${API}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users?.filter(u => u.id !== user?.id) || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleChallenge = async (opponentId, auctionId, wagerBids = 0) => {
    try {
      const res = await fetch(`${API}/api/friends-battle/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          opponent_id: opponentId,
          auction_id: auctionId,
          wager_bids: wagerBids
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      toast.success(data.message);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const respondToChallenge = async (battleId, accept) => {
    try {
      const res = await fetch(`${API}/api/friends-battle/respond/${battleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ accept })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      toast.success(data.message);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <Swords className="w-16 h-16 text-violet-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-800">Friends Battle</h1>
          <p className="text-slate-500 mt-2">Bitte melde dich an, um Battles zu spielen!</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Swords className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-slate-500 mt-2">{t.subtitle}</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
            <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-800">{history.stats?.wins || 0}</p>
            <p className="text-sm text-slate-500">{t.wins}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
            <Target className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-800">{history.stats?.losses || 0}</p>
            <p className="text-sm text-slate-500">{t.losses}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
            <Medal className="w-6 h-6 text-violet-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-800">{history.stats?.win_rate || 0}%</p>
            <p className="text-sm text-slate-500">{t.winRate}</p>
          </div>
        </div>

        {/* Search & Challenge */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-500" />
            Freund herausfordern
          </h3>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchUsers(e.target.value);
              }}
              placeholder={t.searchFriends}
              className="pl-10"
            />
          </div>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2 mb-4">
              {searchResults.map(u => (
                <div 
                  key={u.id} 
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    selectedUser?.id === u.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200'
                  } cursor-pointer hover:border-violet-300`}
                  onClick={() => setSelectedUser(u)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      {u.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-medium text-slate-800">{u.username}</span>
                  </div>
                  {selectedUser?.id === u.id && <Check className="w-5 h-5 text-violet-500" />}
                </div>
              ))}
            </div>
          )}

          {/* Auction Selection when user is selected */}
          {selectedUser && (
            <div className="mt-4 p-4 bg-violet-50 rounded-xl">
              <p className="font-medium text-violet-800 mb-3">
                Battle mit {selectedUser.username} - {t.selectAuction}:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {auctions.slice(0, 12).map(auction => (
                  <button
                    key={auction.id}
                    onClick={() => handleChallenge(selectedUser.id, auction.id, 0)}
                    className="p-2 bg-white rounded-lg border border-violet-200 hover:border-violet-400 text-left text-sm"
                  >
                    <p className="font-medium text-slate-800 truncate">{auction.product?.name || 'Auktion'}</p>
                    <p className="text-violet-600">€{auction.current_price?.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'active', label: t.active, icon: Zap },
            { id: 'challenges', label: t.challenges, icon: Clock, badge: challenges.received?.length },
            { id: 'history', label: t.history, icon: Trophy },
            { id: 'leaderboard', label: t.leaderboard, icon: Crown }
          ].map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id 
                ? 'bg-violet-500 hover:bg-violet-600 text-white' 
                : 'border-slate-200 text-slate-600'
              }
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
              {tab.badge > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {tab.badge}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Active Battles Tab */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {activeBattles.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 shadow-lg border border-slate-100 text-center">
                <Swords className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t.noBattles}</p>
                <p className="text-sm text-slate-400">{t.startBattle}</p>
              </div>
            ) : (
              activeBattles.map(battle => (
                <div key={battle.id} className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={battle.auction_image || '/placeholder.png'} 
                        alt={battle.auction_title}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                      <div>
                        <h3 className="font-bold text-slate-800">{battle.auction_title}</h3>
                        <p className="text-sm text-slate-500">vs {battle.opponent_name}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      battle.is_winning 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {battle.is_winning ? t.winning : t.losing}
                    </span>
                  </div>
                  
                  {/* Score */}
                  <div className="flex items-center justify-center gap-8 py-4 bg-slate-50 rounded-xl">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-violet-600">{battle.your_bids}</p>
                      <p className="text-sm text-slate-500">{t.yourBids}</p>
                    </div>
                    <div className="text-2xl font-bold text-slate-300">VS</div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-slate-600">{battle.opponent_bids}</p>
                      <p className="text-sm text-slate-500">{t.opponentBids}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="space-y-4">
            {/* Received */}
            {challenges.received?.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-800 mb-3">Empfangene Herausforderungen</h3>
                {challenges.received.map(c => (
                  <div key={c.id} className="bg-white rounded-xl p-4 shadow border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{c.challenger_name}</p>
                      <p className="text-sm text-slate-500">{c.auction_title}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respondToChallenge(c.id, true)} className="bg-emerald-500 hover:bg-emerald-600">
                        <Check className="w-4 h-4 mr-1" />{t.accept}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respondToChallenge(c.id, false)}>
                        <X className="w-4 h-4 mr-1" />{t.decline}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Sent */}
            {challenges.sent?.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-800 mb-3">Gesendete Herausforderungen</h3>
                {challenges.sent.map(c => (
                  <div key={c.id} className="bg-white rounded-xl p-4 shadow border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{c.opponent_name}</p>
                      <p className="text-sm text-slate-500">{c.auction_title}</p>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">{t.pending}</span>
                  </div>
                ))}
              </div>
            )}
            
            {challenges.received?.length === 0 && challenges.sent?.length === 0 && (
              <div className="bg-white rounded-2xl p-12 shadow-lg border border-slate-100 text-center">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Keine Herausforderungen</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {history.history?.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 shadow-lg border border-slate-100 text-center">
                <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Noch keine Battles abgeschlossen</p>
              </div>
            ) : (
              history.history.map(h => (
                <div key={h.id} className="bg-white rounded-xl p-4 shadow border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      h.won ? 'bg-emerald-100' : 'bg-slate-100'
                    }`}>
                      {h.won ? <Trophy className="w-5 h-5 text-emerald-600" /> : <Target className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">vs {h.opponent_name}</p>
                      <p className="text-sm text-slate-500">{h.your_bids} : {h.opponent_bids}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    h.won ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {h.won ? t.won : t.lost}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            {leaderboard.map((l, idx) => (
              <div key={idx} className={`flex items-center justify-between p-4 ${
                idx < leaderboard.length - 1 ? 'border-b border-slate-100' : ''
              }`}>
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' :
                    idx === 1 ? 'bg-slate-200 text-slate-600' :
                    idx === 2 ? 'bg-amber-700/20 text-amber-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="font-medium text-slate-800">{l.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-slate-800">{l.wins}</span>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="p-12 text-center">
                <Crown className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Noch keine Bestenliste</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
