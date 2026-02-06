import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { 
  Trophy, Star, Zap, Target, TrendingUp, Gift, Crown,
  Calendar, Award, Users, BarChart3, Clock, ChevronRight,
  Flame, Medal, Sparkles, Lock
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function MyStats() {
  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [dailyReward, setDailyReward] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimingReward, setClaimingReward] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated, token]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, achievementsRes, dailyRes, leaderboardRes] = await Promise.all([
        axios.get(`${API}/api/user-stats/overview`, { headers }),
        axios.get(`${API}/api/user-stats/achievements`, { headers }),
        axios.get(`${API}/api/user-stats/daily-reward-status`, { headers }),
        axios.get(`${API}/api/user-stats/leaderboard?type=weekly&limit=5`, { headers })
      ]);
      
      setStats(statsRes.data);
      setAchievements(achievementsRes.data);
      setDailyReward(dailyRes.data);
      setLeaderboard(leaderboardRes.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimDailyReward = async () => {
    setClaimingReward(true);
    try {
      const response = await axios.post(
        `${API}/api/user-stats/claim-daily-reward`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        // Celebration animation
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        toast.success(
          <div className="text-center">
            <p className="font-bold text-lg">🎁 Belohnung erhalten!</p>
            <p className="text-amber-600">+{response.data.reward.bids} Gebote</p>
            <p className="text-purple-600">+{response.data.reward.xp} XP</p>
            {response.data.reward.milestone_message && (
              <p className="text-green-600 mt-1">{response.data.reward.milestone_message}</p>
            )}
          </div>
        );
        
        // Refresh data
        fetchAllData();
      } else {
        toast.info(response.data.message);
      }
    } catch (error) {
      toast.error('Fehler beim Abholen der Belohnung');
    } finally {
      setClaimingReward(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100">
        <div className="bg-white p-8 rounded-xl text-center max-w-md shadow-lg border border-gray-200">
          <BarChart3 className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-4">Meine Statistiken</h2>
          <p className="text-gray-600 mb-6">Melde dich an, um deine Statistiken und Erfolge zu sehen.</p>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => navigate('/login')}>
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gradient-to-b from-cyan-50 to-cyan-100" data-testid="my-stats-page">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Meine Statistiken</h1>
              <p className="text-gray-500">Deine Erfolge und Fortschritte</p>
            </div>
          </div>
        </div>

        {/* Daily Reward Card */}
        {dailyReward && (
          <div className={`mb-6 p-5 rounded-xl border-2 transition-all ${
            dailyReward.can_claim 
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 animate-pulse-slow' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  dailyReward.can_claim 
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
                    : 'bg-gray-300'
                }`}>
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Tägliche Belohnung</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <Flame className={`w-4 h-4 ${dailyReward.current_streak > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                    <span className="text-gray-600">{dailyReward.current_streak} Tage Streak</span>
                    {dailyReward.next_milestone && (
                      <span className="text-gray-400">• Noch {dailyReward.next_milestone.remaining} bis {dailyReward.next_milestone.days}-Tage-Bonus</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {dailyReward.can_claim && (
                  <span className="text-amber-600 font-bold">+{dailyReward.potential_reward} Gebote</span>
                )}
                <Button
                  onClick={claimDailyReward}
                  disabled={!dailyReward.can_claim || claimingReward}
                  className={dailyReward.can_claim 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-500'
                  }
                >
                  {claimingReward ? (
                    <span className="animate-spin">⏳</span>
                  ) : dailyReward.can_claim ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Abholen!
                    </>
                  ) : (
                    'Bereits abgeholt'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            icon={<Trophy className="w-5 h-5" />}
            label="Gewonnen"
            value={stats?.auctions?.total_won || 0}
            color="amber"
          />
          <StatCard 
            icon={<Zap className="w-5 h-5" />}
            label="Gebote platziert"
            value={stats?.bids?.total_placed || 0}
            color="blue"
          />
          <StatCard 
            icon={<TrendingUp className="w-5 h-5" />}
            label="Gespart"
            value={`€${stats?.overview?.total_savings?.toFixed(0) || 0}`}
            color="green"
          />
          <StatCard 
            icon={<Target className="w-5 h-5" />}
            label="Gewinnrate"
            value={`${stats?.auctions?.win_rate || 0}%`}
            color="purple"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Übersicht', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'achievements', label: 'Erfolge', icon: <Award className="w-4 h-4" /> },
            { id: 'leaderboard', label: 'Rangliste', icon: <Users className="w-4 h-4" /> }
          ].map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id 
                ? 'bg-cyan-600 text-white' 
                : 'border-gray-200 text-gray-600'
              }
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Savings Breakdown */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Spar-Übersicht
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Originalwert</span>
                  <span className="font-bold text-gray-800">€{stats?.overview?.total_retail_value?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bezahlt</span>
                  <span className="font-bold text-gray-800">€{stats?.overview?.total_paid?.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-green-600 font-medium">Ersparnis</span>
                  <div className="text-right">
                    <span className="font-bold text-green-600 text-xl">€{stats?.overview?.total_savings?.toFixed(2)}</span>
                    <span className="text-green-500 text-sm ml-2">({stats?.overview?.savings_percentage}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Streak & Loyalty */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Streaks & Treue
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Login-Streak</span>
                    <span className="font-bold text-orange-500">{stats?.streaks?.current_login_streak || 0} Tage</span>
                  </div>
                  <Progress value={Math.min((stats?.streaks?.current_login_streak || 0) / 30 * 100, 100)} className="h-2" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Längster Streak</span>
                  <span className="font-bold text-gray-800">{stats?.streaks?.max_login_streak || 0} Tage</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Treuepunkte</span>
                  <span className="font-bold text-purple-600">{stats?.loyalty?.available_points || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Treue-Level</span>
                  <span className="font-bold text-amber-500">{stats?.loyalty?.level || 'Bronze'}</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 md:col-span-2">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Letzte 30 Tage
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{stats?.recent_activity?.bids_last_30_days || 0}</p>
                  <p className="text-sm text-gray-600">Gebote</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats?.recent_activity?.wins_last_30_days || 0}</p>
                  <p className="text-sm text-gray-600">Gewinne</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{stats?.auctions?.total_participated || 0}</p>
                  <p className="text-sm text-gray-600">Teilnahmen</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{stats?.bids?.current_balance || 0}</p>
                  <p className="text-sm text-gray-600">Gebote übrig</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'achievements' && achievements && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Erfolge ({achievements.unlocked_count}/{achievements.total_count})
              </h3>
              <div className="flex items-center gap-2">
                <Progress value={achievements.completion_percentage} className="w-32 h-2" />
                <span className="text-sm text-gray-500">{achievements.completion_percentage}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {achievements.achievements?.map((ach) => (
                <div
                  key={ach.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    ach.unlocked 
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' 
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="text-3xl mb-2">{ach.icon}</div>
                  <h4 className={`font-bold ${ach.unlocked ? 'text-gray-800' : 'text-gray-500'}`}>
                    {ach.name}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">{ach.description}</p>
                  {!ach.unlocked && (
                    <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
                      <Lock className="w-3 h-3" />
                      Noch nicht freigeschaltet
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && leaderboard && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-500" />
              Wöchentliche Rangliste
            </h3>
            <div className="space-y-3">
              {leaderboard.leaderboard?.map((entry, index) => (
                <div 
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-3 rounded-lg ${
                    index === 0 ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200' :
                    index === 1 ? 'bg-gray-100 border border-gray-200' :
                    index === 2 ? 'bg-orange-50 border border-orange-200' :
                    'bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    index === 0 ? 'bg-amber-400 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-orange-400 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : entry.rank}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{entry.username}</p>
                    <p className="text-sm text-gray-500">{entry.xp || 0} XP</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-600">{entry.wins} Gewinne</p>
                    <p className="text-sm text-green-500">€{entry.total_savings?.toFixed(0)} gespart</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    amber: 'bg-amber-50 border-amber-200 text-amber-600',
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600'
  };
  
  return (
    <div className={`p-4 rounded-xl border-2 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
