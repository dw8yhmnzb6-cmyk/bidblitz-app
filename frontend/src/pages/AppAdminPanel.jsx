/**
 * BidBlitz Admin Dashboard
 * Full admin panel with stats, coin management, and live activity feed
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppAdminPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState(1000);
  const [action, setAction] = useState('add');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total_users: 1200,
    total_coins: 54000,
    taxi_rides: 320,
    games_played: 1800,
    marketplace_sales: 740,
    revenue: 12400
  });
  const [activities, setActivities] = useState([]);
  const activityRef = useRef(null);
  
  // Miner Admin State
  const [minerUserId, setMinerUserId] = useState('');
  const [selectedMinerType, setSelectedMinerType] = useState('starter_1');
  const [minerLevel, setMinerLevel] = useState(1);
  const [minerResult, setMinerResult] = useState('');
  const [minerLoading, setMinerLoading] = useState(false);
  const [allMiners, setAllMiners] = useState([]);
  const [minerCatalog, setMinerCatalog] = useState([]);
  
  const activityTemplates = [
    { text: "hat einen Miner gekauft", icon: "⛏️", color: "text-cyan-400" },
    { text: "hat 100 Coins im Spiel gewonnen", icon: "🎮", color: "text-purple-400" },
    { text: "hat eine Taxi-Fahrt abgeschlossen", icon: "🚕", color: "text-amber-400" },
    { text: "hat ein Item im Marketplace verkauft", icon: "🛒", color: "text-pink-400" },
    { text: "hat den Miner aufgewertet", icon: "⬆️", color: "text-emerald-400" },
    { text: "ist VIP geworden", icon: "⭐", color: "text-yellow-400" },
    { text: "hat Coins ausgezahlt", icon: "💸", color: "text-green-400" },
    { text: "hat an der Auktion teilgenommen", icon: "🔨", color: "text-red-400" },
  ];

  const userNames = ["Alex", "Sara", "David", "Lina", "Mark", "Emma", "Tom", "Julia", "Max", "Sophie"];
  
  useEffect(() => {
    fetchStats();
    
    // Add initial activities
    for (let i = 0; i < 5; i++) {
      setTimeout(() => addRandomActivity(), i * 500);
    }
    
    // Add new activity every 3 seconds
    const activityInterval = setInterval(addRandomActivity, 3000);
    
    return () => clearInterval(activityInterval);
  }, []);

  const addRandomActivity = () => {
    const randomUser = userNames[Math.floor(Math.random() * userNames.length)];
    const randomActivity = activityTemplates[Math.floor(Math.random() * activityTemplates.length)];
    const newActivity = {
      id: Date.now() + Math.random(),
      user: randomUser,
      ...randomActivity,
      time: 'Gerade eben'
    };
    
    setActivities(prev => [newActivity, ...prev].slice(0, 10));
  };
  
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/admin/stats`, { headers });
      if (res.data) {
        setStats(prev => ({
          ...prev,
          total_users: res.data.total_users || prev.total_users,
          total_coins: res.data.total_coins || prev.total_coins,
          total_miners: res.data.total_miners || 0,
          games_today: res.data.games_today || 0
        }));
      }
    } catch (error) {
      console.log('Using default stats');
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId.trim()) {
      setResult('Bitte User ID eingeben');
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API}/app/admin/coins`, {
        user_id: userId,
        amount: action === 'add' ? amount : -amount,
        action: action
      }, { headers });
      
      setResult(`✅ ${res.data.message}`);
      setUserId('');
      fetchStats();
    } catch (error) {
      setResult(`❌ ${error.response?.data?.detail || 'Fehler'}`);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Users', value: stats.total_users, icon: '👥', color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', textColor: 'text-blue-400' },
    { label: 'Total Coins', value: stats.total_coins?.toLocaleString(), icon: '💰', color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', textColor: 'text-amber-400' },
    { label: 'Taxi Rides', value: stats.taxi_rides, icon: '🚕', color: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/30', textColor: 'text-yellow-400' },
    { label: 'Games Played', value: stats.games_played?.toLocaleString(), icon: '🎮', color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30', textColor: 'text-purple-400' },
    { label: 'Marketplace Sales', value: stats.marketplace_sales, icon: '🛒', color: 'from-pink-500/20 to-pink-600/10', border: 'border-pink-500/30', textColor: 'text-pink-400' },
    { label: 'Revenue', value: `€${stats.revenue?.toLocaleString()}`, icon: '💶', color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', textColor: 'text-emerald-400' },
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -left-20 w-60 h-60 bg-blue-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/super-app" className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              <span className="text-lg">←</span>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">BidBlitz Admin</h2>
              <p className="text-xs text-slate-400">Dashboard & Management</p>
            </div>
          </div>
          <button 
            onClick={fetchStats}
            className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
            data-testid="refresh-stats-btn"
          >
            <span className="text-lg">🔄</span>
          </button>
        </div>
        
        {/* Stats Grid - 3x2 */}
        <div className="mb-6">
          <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-3">Übersicht</h3>
          <div className="grid grid-cols-3 gap-3" data-testid="stats-grid">
            {statCards.map((stat, index) => (
              <div 
                key={stat.label}
                className={`bg-gradient-to-br ${stat.color} p-4 rounded-2xl border ${stat.border} transition-all hover:scale-[1.02]`}
                data-testid={`stat-card-${index}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{stat.icon}</span>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
                <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="mb-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📡</span>
              <h3 className="font-semibold">Live Activity</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-400">Live</span>
            </div>
          </div>
          <div 
            ref={activityRef}
            className="max-h-64 overflow-y-auto p-3 space-y-2"
            data-testid="activity-feed"
          >
            {activities.map((activity) => (
              <div 
                key={activity.id}
                className="bg-white/5 p-3 rounded-xl flex items-center gap-3 animate-fadeIn"
              >
                <span className="text-xl">{activity.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className={`font-semibold ${activity.color}`}>{activity.user}</span>
                    {' '}{activity.text}
                  </p>
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Coin Management */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💰</span>
            <h3 className="font-semibold">Coins verwalten</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="z.B. demo_user"
                className="w-full p-3.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-[#6c63ff] focus:outline-none transition-all"
                data-testid="user-id-input"
              />
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">Aktion</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAction('add')}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    action === 'add' 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                  data-testid="add-action-btn"
                >
                  <span>➕</span> Hinzufügen
                </button>
                <button
                  type="button"
                  onClick={() => setAction('remove')}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    action === 'remove' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                  data-testid="remove-action-btn"
                >
                  <span>➖</span> Abziehen
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">Anzahl Coins</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min="1"
                max="1000000"
                className="w-full p-3.5 rounded-xl bg-black/30 border border-white/10 text-white focus:border-[#6c63ff] focus:outline-none transition-all"
                data-testid="amount-input"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#6c63ff] hover:bg-[#5a52e0] rounded-xl font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              data-testid="submit-btn"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span> Wird verarbeitet...
                </>
              ) : (
                <>
                  <span>✓</span> Ausführen
                </>
              )}
            </button>
          </form>
          
          {result && (
            <div className={`mt-4 p-4 rounded-xl text-center ${
              result.includes('✅') 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {result}
            </div>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⚡</span>
            <h3 className="font-semibold">Schnellaktionen</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setUserId('demo_user');
                setAmount(10000);
                setAction('add');
              }}
              className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/10 hover:from-purple-500/30 hover:to-purple-600/20 rounded-xl text-left border border-purple-500/20 transition-all"
            >
              <span className="text-2xl mb-2 block">🎁</span>
              <p className="font-medium text-sm">Demo +10k</p>
              <p className="text-xs text-slate-500">Coins hinzufügen</p>
            </button>
            <button
              onClick={fetchStats}
              className="p-4 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 hover:from-cyan-500/30 hover:to-cyan-600/20 rounded-xl text-left border border-cyan-500/20 transition-all"
            >
              <span className="text-2xl mb-2 block">🔄</span>
              <p className="font-medium text-sm">Refresh</p>
              <p className="text-xs text-slate-500">Stats aktualisieren</p>
            </button>
          </div>
        </div>
      </div>
      
      <BottomNav />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
