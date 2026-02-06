import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { 
  Trophy, Crown, Medal, Star, Clock, Users, 
  TrendingUp, Gift, ChevronRight, Flame
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function Tournaments() {
  const { isAuthenticated, token } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myPosition, setMyPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    fetchTournamentData();
  }, [isAuthenticated]);

  useEffect(() => {
    // Countdown timer
    if (timeRemaining > 0) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timeRemaining]);

  const fetchTournamentData = async () => {
    setLoading(true);
    try {
      const headers = isAuthenticated ? { Authorization: `Bearer ${token}` } : {};
      
      const [tournamentRes, leaderboardRes] = await Promise.all([
        axios.get(`${API}/api/tournaments/current`, { headers }),
        axios.get(`${API}/api/tournaments/leaderboard?limit=10`, { headers })
      ]);
      
      setTournament(tournamentRes.data.tournament);
      setTimeRemaining(tournamentRes.data.time_remaining_seconds || 0);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
      
      if (isAuthenticated) {
        const posRes = await axios.get(`${API}/api/tournaments/my-position`, { headers });
        setMyPosition(posRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) return `${days}T ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getMetricLabel = (metric) => {
    return {
      wins: 'Gewinne',
      bids: 'Gebote',
      savings: '€ gespart',
      streak: 'Tage Streak'
    }[metric] || 'Punkte';
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gradient-to-b from-cyan-50 to-cyan-100" data-testid="tournaments-page">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg mb-4">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Wöchentliches Turnier</h1>
          <p className="text-gray-500 mt-2">Kämpfe um die Spitze und gewinne Preise!</p>
        </div>

        {/* Current Tournament Card */}
        {tournament && (
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{tournament.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{tournament.name}</h2>
                  <p className="text-gray-500 text-sm">{tournament.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-orange-500">
                  <Clock className="w-5 h-5" />
                  <span className="font-bold text-lg">{formatTime(timeRemaining)}</span>
                </div>
                <p className="text-xs text-gray-400">verbleibend</p>
              </div>
            </div>
            
            {/* My Position */}
            {myPosition && myPosition.score > 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Dein aktueller Stand</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {myPosition.score} {getMetricLabel(tournament.metric)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-600 font-medium">Weiter so!</p>
                    <p className="text-sm text-gray-500">Top 10 = Preis!</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Prizes */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl p-3 text-center">
                <span className="text-2xl">🥇</span>
                <p className="font-bold text-amber-800">1. Platz</p>
                <p className="text-amber-600 text-sm">100 Gebote</p>
              </div>
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-3 text-center">
                <span className="text-2xl">🥈</span>
                <p className="font-bold text-gray-700">2. Platz</p>
                <p className="text-gray-600 text-sm">50 Gebote</p>
              </div>
              <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl p-3 text-center">
                <span className="text-2xl">🥉</span>
                <p className="font-bold text-orange-800">3. Platz</p>
                <p className="text-orange-600 text-sm">25 Gebote</p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-500" />
            Aktuelle Rangliste
          </h3>
          
          {leaderboard.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Noch keine Teilnehmer diese Woche</p>
              <p className="text-gray-400 text-sm">Sei der Erste!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry, index) => (
                <div 
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    index === 0 ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200' :
                    index === 1 ? 'bg-gray-50 border border-gray-200' :
                    index === 2 ? 'bg-orange-50 border border-orange-200' :
                    'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                    index === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : entry.rank}
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{entry.username}</p>
                    <p className="text-sm text-gray-500">
                      {entry.prize?.title || `Platz ${entry.rank}`}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-800">{entry.score}</p>
                    <p className="text-xs text-gray-400">{getMetricLabel(tournament?.metric)}</p>
                  </div>
                  
                  {entry.prize?.bids > 0 && (
                    <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
                      +{entry.prize.bids} 🎁
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call to Action */}
        {!isAuthenticated && (
          <div className="mt-6 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-2xl p-6 text-center text-white">
            <h3 className="text-xl font-bold mb-2">Jetzt mitmachen!</h3>
            <p className="mb-4 opacity-90">Melde dich an und kämpfe um die Spitze</p>
            <Button 
              className="bg-white text-cyan-600 hover:bg-cyan-50"
              onClick={() => window.location.href = '/register'}
            >
              Kostenlos registrieren
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
