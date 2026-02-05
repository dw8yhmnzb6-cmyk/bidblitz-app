import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  TrendingUp, Trophy, Award, Zap, Target, Gift,
  Calendar, Clock, BarChart3, Star, Crown, Medal
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MyStatsPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [stats, setStats] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [loading, setLoading] = useState(true);

  const texts = {
    de: {
      title: 'Meine Statistiken',
      subtitle: 'Dein persönlicher Erfolgsüberblick',
      totalSavings: 'Gesamtersparnis',
      retailValue: 'Warenwert',
      totalPaid: 'Bezahlt',
      savingsPercent: 'Ersparnis',
      auctionsWon: 'Gewonnen',
      participated: 'Teilgenommen',
      winRate: 'Gewinnrate',
      bidsPlaced: 'Gebote platziert',
      bidsPurchased: 'Gebote gekauft',
      currentBalance: 'Aktuelles Guthaben',
      loginStreak: 'Login-Streak',
      maxStreak: 'Rekord-Streak',
      recentActivity: 'Letzte 30 Tage',
      achievements: 'Erfolge',
      unlocked: 'Freigeschaltet',
      memberSince: 'Mitglied seit',
      loyaltyPoints: 'Treuepunkte',
      level: 'Level'
    },
    en: {
      title: 'My Statistics',
      subtitle: 'Your personal success overview',
      totalSavings: 'Total Savings',
      retailValue: 'Retail Value',
      totalPaid: 'Total Paid',
      savingsPercent: 'Savings',
      auctionsWon: 'Won',
      participated: 'Participated',
      winRate: 'Win Rate',
      bidsPlaced: 'Bids Placed',
      bidsPurchased: 'Bids Purchased',
      currentBalance: 'Current Balance',
      loginStreak: 'Login Streak',
      maxStreak: 'Record Streak',
      recentActivity: 'Last 30 Days',
      achievements: 'Achievements',
      unlocked: 'Unlocked',
      memberSince: 'Member Since',
      loyaltyPoints: 'Loyalty Points',
      level: 'Level'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated]);

  const fetchStats = async () => {
    try {
      const [statsRes, achievementsRes] = await Promise.all([
        axios.get(`${API}/api/user-stats/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/user-stats/achievements`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setStats(statsRes.data);
      setAchievements(achievementsRes.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-800 rounded w-1/3"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const overview = stats?.overview || {};
  const auctions = stats?.auctions || {};
  const bids = stats?.bids || {};
  const loyalty = stats?.loyalty || {};
  const streaks = stats?.streaks || {};
  const recent = stats?.recent_activity || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="my-stats-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <span className="text-gray-800 font-bold">Statistiken</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {/* Savings Overview */}
        <div className="glass-card rounded-2xl p-8 mb-8 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-gray-500 text-sm mb-1">{t.totalSavings}</p>
              <p className="text-4xl font-bold text-green-400">€{overview.total_savings?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">{t.retailValue}</p>
              <p className="text-3xl font-bold text-gray-800">€{overview.total_retail_value?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">{t.totalPaid}</p>
              <p className="text-3xl font-bold text-gray-500">€{overview.total_paid?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">{t.savingsPercent}</p>
              <p className="text-4xl font-bold text-green-400">{overview.savings_percentage || 0}%</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Auctions Won */}
          <div className="glass-card rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-yellow-500/20 flex items-center justify-center mb-3">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{auctions.total_won || 0}</p>
            <p className="text-gray-500 text-sm">{t.auctionsWon}</p>
          </div>

          {/* Participated */}
          <div className="glass-card rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{auctions.total_participated || 0}</p>
            <p className="text-gray-500 text-sm">{t.participated}</p>
          </div>

          {/* Win Rate */}
          <div className="glass-card rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{auctions.win_rate || 0}%</p>
            <p className="text-gray-500 text-sm">{t.winRate}</p>
          </div>

          {/* Current Balance */}
          <div className="glass-card rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-green-500/20 flex items-center justify-center mb-3">
              <Zap className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{bids.current_balance || 0}</p>
            <p className="text-gray-500 text-sm">{t.currentBalance}</p>
          </div>

          {/* Bids Placed */}
          <div className="glass-card rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-orange-500/20 flex items-center justify-center mb-3">
              <BarChart3 className="w-6 h-6 text-orange-400" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{bids.total_placed || 0}</p>
            <p className="text-gray-500 text-sm">{t.bidsPlaced}</p>
          </div>

          {/* Login Streak */}
          <div className="glass-card rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/20 flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{streaks.current_login_streak || 0}</p>
            <p className="text-gray-500 text-sm">{t.loginStreak}</p>
          </div>

          {/* Loyalty Points */}
          <div className="glass-card rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-yellow-500/20 flex items-center justify-center mb-3">
              <Star className="w-6 h-6 text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-gray-800">{loyalty.available_points || 0}</p>
            <p className="text-gray-500 text-sm">{t.loyaltyPoints}</p>
          </div>

          {/* Level */}
          <div className="glass-card rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-cyan-500/20 flex items-center justify-center mb-3">
              <Crown className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{loyalty.level || 'Bronze'}</p>
            <p className="text-gray-500 text-sm">{t.level}</p>
          </div>
        </div>

        {/* Achievements */}
        {achievements && (
          <div className="glass-card rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-400" />
                {t.achievements}
              </h3>
              <span className="text-gray-500">
                {achievements.unlocked_count}/{achievements.total_count} {t.unlocked}
              </span>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {achievements.achievements?.map(ach => (
                <div 
                  key={ach.id}
                  className={`text-center p-4 rounded-xl transition-all ${
                    ach.unlocked 
                      ? 'bg-yellow-500/10 border border-yellow-500/30' 
                      : 'bg-white/5 opacity-50'
                  }`}
                  title={ach.description}
                >
                  <span className="text-3xl">{ach.icon}</span>
                  <p className={`text-sm font-medium mt-2 ${ach.unlocked ? 'text-gray-800' : 'text-gray-500'}`}>
                    {ach.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            {t.recentActivity}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-800">{recent.bids_last_30_days || 0}</p>
              <p className="text-gray-500 text-sm">Gebote platziert</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-400">{recent.wins_last_30_days || 0}</p>
              <p className="text-gray-500 text-sm">Auktionen gewonnen</p>
            </div>
          </div>
        </div>

        {/* Member Since */}
        {stats?.member_since && (
          <p className="text-center text-gray-500 text-sm mt-8">
            {t.memberSince}: {new Date(stats.member_since).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default MyStatsPage;
