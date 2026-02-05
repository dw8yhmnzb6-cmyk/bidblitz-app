import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Swords, Trophy, Clock, Users, Target, Flame,
  Check, X, ChevronRight, Gift, Medal, Crown
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const FriendBattlePage = () => {
  const { token, user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [battles, setBattles] = useState({});
  const [battleTypes, setBattleTypes] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeForm, setChallengeForm] = useState({
    friendId: '',
    type: 'most_bids',
    duration: 24,
    stake: 10
  });

  const texts = {
    de: {
      title: 'Freunde-Battle',
      subtitle: 'Fordere deine Freunde heraus und gewinne Gebote!',
      pendingReceived: 'Erhaltene Herausforderungen',
      pendingSent: 'Gesendete Herausforderungen',
      activeBattles: 'Aktive Battles',
      completedBattles: 'Abgeschlossene Battles',
      leaderboard: 'Battle-Rangliste',
      challengeFriend: 'Freund herausfordern',
      friendId: 'Freund-ID (aus deren Profil)',
      battleType: 'Battle-Typ',
      duration: 'Dauer',
      hours: 'Stunden',
      stake: 'Einsatz',
      bids: 'Gebote',
      accept: 'Annehmen',
      decline: 'Ablehnen',
      vs: 'VS',
      you: 'Du',
      won: 'Gewonnen',
      lost: 'Verloren',
      pending: 'Ausstehend',
      active: 'Aktiv',
      score: 'Punkte',
      endsIn: 'Endet in',
      wins: 'Siege',
      totalWinnings: 'Gewonnene Gebote',
      startChallenge: 'Herausforderung senden',
      noBattles: 'Keine Battles',
      challengeDesc: 'Setze Gebote ein und miss dich mit Freunden!'
    },
    en: {
      title: 'Friend Battle',
      subtitle: 'Challenge your friends and win bids!',
      pendingReceived: 'Received Challenges',
      pendingSent: 'Sent Challenges',
      activeBattles: 'Active Battles',
      completedBattles: 'Completed Battles',
      leaderboard: 'Battle Leaderboard',
      challengeFriend: 'Challenge Friend',
      friendId: 'Friend ID (from their profile)',
      battleType: 'Battle Type',
      duration: 'Duration',
      hours: 'Hours',
      stake: 'Stake',
      bids: 'Bids',
      accept: 'Accept',
      decline: 'Decline',
      vs: 'VS',
      you: 'You',
      won: 'Won',
      lost: 'Lost',
      pending: 'Pending',
      active: 'Active',
      score: 'Score',
      endsIn: 'Ends in',
      wins: 'Wins',
      totalWinnings: 'Total Winnings',
      startChallenge: 'Send Challenge',
      noBattles: 'No battles',
      challengeDesc: 'Stake bids and compete with friends!'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [battlesRes, typesRes, lbRes] = await Promise.all([
        axios.get(`${API}/api/friend-battle/my-battles`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/friend-battle/types`),
        axios.get(`${API}/api/friend-battle/leaderboard`)
      ]);
      setBattles(battlesRes.data);
      setBattleTypes(typesRes.data.types || []);
      setLeaderboard(lbRes.data.leaderboard || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (battleId) => {
    try {
      await axios.post(`${API}/api/friend-battle/accept/${battleId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Battle gestartet!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const handleDecline = async (battleId) => {
    try {
      await axios.post(`${API}/api/friend-battle/decline/${battleId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Herausforderung abgelehnt');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const handleChallenge = async () => {
    try {
      await axios.post(`${API}/api/friend-battle/challenge`, {
        friend_id: challengeForm.friendId,
        challenge_type: challengeForm.type,
        duration_hours: challengeForm.duration,
        stake_bids: challengeForm.stake
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Herausforderung gesendet!');
      setShowChallenge(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const BattleCard = ({ battle, type }) => {
    const isChallenger = battle.challenger_id === user?.id;
    const myScore = isChallenger ? battle.challenger_score : battle.opponent_score;
    const theirScore = isChallenger ? battle.opponent_score : battle.challenger_score;
    const opponentName = isChallenger ? battle.opponent_name : battle.challenger_name;
    
    const battleType = battleTypes.find(bt => bt.id === battle.challenge_type);
    
    return (
      <div className="glass-card rounded-xl p-4 border border-purple-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{battleType?.icon || '⚔️'}</span>
            <span className="text-gray-800 font-bold">{battleType?.name || battle.challenge_type}</span>
          </div>
          <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-sm">
            {battle.stake_bids} {t.bids}
          </div>
        </div>
        
        {/* VS Display */}
        <div className="flex items-center justify-between py-3">
          <div className="text-center flex-1">
            <p className="text-gray-800 font-bold">{t.you}</p>
            {type === 'active' && (
              <p className="text-2xl font-bold text-green-400">{myScore}</p>
            )}
          </div>
          <div className="px-4">
            <Swords className="w-8 h-8 text-purple-400" />
          </div>
          <div className="text-center flex-1">
            <p className="text-gray-800 font-bold">{opponentName}</p>
            {type === 'active' && (
              <p className="text-2xl font-bold text-red-400">{theirScore}</p>
            )}
          </div>
        </div>
        
        {/* Actions */}
        {type === 'pending_received' && (
          <div className="flex gap-2 mt-3">
            <Button 
              onClick={() => handleAccept(battle.id)}
              className="flex-1 bg-green-600 hover:bg-green-500"
            >
              <Check className="w-4 h-4 mr-1" />
              {t.accept}
            </Button>
            <Button 
              onClick={() => handleDecline(battle.id)}
              variant="outline"
              className="flex-1 border-red-500 text-red-400"
            >
              <X className="w-4 h-4 mr-1" />
              {t.decline}
            </Button>
          </div>
        )}
        
        {type === 'active' && battle.end_time && (
          <div className="text-center text-sm text-gray-500 mt-2">
            <Clock className="w-4 h-4 inline mr-1" />
            {t.endsIn}: {new Date(battle.end_time).toLocaleString()}
          </div>
        )}
        
        {type === 'completed' && (
          <div className={`text-center py-2 rounded mt-2 ${
            battle.winner_id === user?.id 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            <Trophy className="w-4 h-4 inline mr-1" />
            {battle.winner_id === user?.id ? t.won : t.lost}
          </div>
        )}
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center">
          <Swords className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Bitte anmelden</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="h-12 bg-white rounded w-1/3 mx-auto"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-40 bg-white rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="friend-battle-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-4">
            <Swords className="w-5 h-5 text-purple-400" />
            <span className="text-purple-400 font-bold">Battle</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">{t.title}</h1>
          <p className="text-gray-500 text-lg">{t.subtitle}</p>
        </div>

        {/* Challenge Button */}
        <div className="mb-8 text-center">
          <Button 
            onClick={() => setShowChallenge(!showChallenge)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
          >
            <Swords className="w-4 h-4 mr-2" />
            {t.challengeFriend}
          </Button>
        </div>

        {/* Challenge Form */}
        {showChallenge && (
          <div className="glass-card rounded-xl p-6 mb-8 border border-purple-500/30">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{t.challengeFriend}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">{t.friendId}</label>
                <input
                  type="text"
                  value={challengeForm.friendId}
                  onChange={(e) => setChallengeForm({...challengeForm, friendId: e.target.value})}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-gray-200 rounded-lg text-gray-800"
                  placeholder="abc123..."
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500">{t.battleType}</label>
                <select
                  value={challengeForm.type}
                  onChange={(e) => setChallengeForm({...challengeForm, type: e.target.value})}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-gray-200 rounded-lg text-gray-800"
                >
                  {battleTypes.map(bt => (
                    <option key={bt.id} value={bt.id}>{bt.icon} {bt.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">{t.duration} ({t.hours})</label>
                <select
                  value={challengeForm.duration}
                  onChange={(e) => setChallengeForm({...challengeForm, duration: parseInt(e.target.value)})}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-gray-200 rounded-lg text-gray-800"
                >
                  <option value={6}>6 {t.hours}</option>
                  <option value={12}>12 {t.hours}</option>
                  <option value={24}>24 {t.hours}</option>
                  <option value={48}>48 {t.hours}</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">{t.stake} ({t.bids})</label>
                <select
                  value={challengeForm.stake}
                  onChange={(e) => setChallengeForm({...challengeForm, stake: parseInt(e.target.value)})}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-gray-200 rounded-lg text-gray-800"
                >
                  <option value={5}>5 {t.bids}</option>
                  <option value={10}>10 {t.bids}</option>
                  <option value={25}>25 {t.bids}</option>
                  <option value={50}>50 {t.bids}</option>
                </select>
              </div>
            </div>
            
            <Button 
              onClick={handleChallenge}
              className="w-full mt-4 bg-purple-600 hover:bg-purple-500"
            >
              {t.startChallenge}
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-4 text-center">
            <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{battles.total_wins || 0}</p>
            <p className="text-xs text-gray-500">{t.wins}</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <Swords className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{battles.total_battles || 0}</p>
            <p className="text-xs text-gray-500">{t.completedBattles}</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <Flame className="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{battles.active?.length || 0}</p>
            <p className="text-xs text-gray-500">{t.activeBattles}</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-800">{battles.pending_received?.length || 0}</p>
            <p className="text-xs text-gray-500">{t.pendingReceived}</p>
          </div>
        </div>

        {/* Pending Received */}
        {battles.pending_received?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-400" />
              {t.pendingReceived}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {battles.pending_received.map(b => (
                <BattleCard key={b.id} battle={b} type="pending_received" />
              ))}
            </div>
          </div>
        )}

        {/* Active Battles */}
        {battles.active?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              {t.activeBattles}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {battles.active.map(b => (
                <BattleCard key={b.id} battle={b} type="active" />
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              {t.leaderboard}
            </h2>
            <div className="space-y-3">
              {leaderboard.slice(0, 10).map((entry, idx) => (
                <div key={entry.user_id} className="flex items-center justify-between py-2 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      idx === 0 ? 'bg-yellow-500 text-black' :
                      idx === 1 ? 'bg-gray-400 text-black' :
                      idx === 2 ? 'bg-amber-600 text-black' :
                      'bg-white/10 text-gray-800'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-gray-800">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-yellow-400 font-bold">{entry.wins} {t.wins}</span>
                    <span className="text-gray-500 text-sm ml-2">(+{entry.total_winnings} {t.bids})</span>
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

export default FriendBattlePage;
