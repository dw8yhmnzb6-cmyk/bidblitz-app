/**
 * BidBlitz Super App Home - Quick Actions Dashboard
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const QUICK_ACTIONS = [
  { id: 1, name: 'Games', icon: '🎮', route: '/games', color: 'bg-purple-600' },
  { id: 2, name: 'Mining', icon: '⛏', route: '/mining', color: 'bg-amber-600' },
  { id: 3, name: 'Taxi', icon: '🚕', route: '/ride-pay', color: 'bg-yellow-500' },
  { id: 4, name: 'Scooter', icon: '🛴', route: '/ride-pay', color: 'bg-green-600' },
  { id: 5, name: 'Bike', icon: '🚲', route: '/ride-pay', color: 'bg-blue-600' },
  { id: 6, name: 'Market', icon: '🛒', route: '/auctions', color: 'bg-pink-600' },
  { id: 7, name: 'Lottery', icon: '🎲', route: '/games', color: 'bg-red-600' },
  { id: 8, name: 'Leaderboard', icon: '🏆', route: '/leaderboard', color: 'bg-violet-600' },
];

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [user, setUser] = useState(null);

  const userId = localStorage.getItem('userId') || 'guest_' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/bbz/coins/${userId}`);
      setCoins(res.data.coins || 0);
    } catch {
      setCoins(100);
    }

    // Check for logged in user
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const userRes = await axios.get(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(userRes.data);
      } catch {}
    }
  };

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: '#0f172a' }}>
      
      {/* Header */}
      <header className="flex justify-between items-center p-5">
        <h1 className="text-2xl font-bold">BidBlitz</h1>
        <span className="font-bold text-yellow-400">💰{coins.toLocaleString()}</span>
      </header>

      {/* Welcome Banner */}
      {user && (
        <div className="mx-5 mb-4 p-4 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600">
          <p className="text-sm text-white/70">Willkommen zurück,</p>
          <p className="text-lg font-bold">{user.first_name || user.email}</p>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-4 gap-3 px-5">
        {QUICK_ACTIONS.map(action => (
          <div
            key={action.id}
            onClick={() => navigate(action.route)}
            className={`${action.color} rounded-xl p-4 text-center cursor-pointer transition-all hover:scale-105 active:scale-95`}
          >
            <div className="text-2xl mb-1">{action.icon}</div>
            <div className="text-xs font-medium">{action.name}</div>
          </div>
        ))}
      </div>

      {/* Stats Section */}
      <div className="mt-6 px-5">
        <h2 className="text-lg font-semibold mb-3">📊 Deine Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-white/70">Coins</p>
            <p className="text-xl font-bold text-yellow-400">{coins.toLocaleString()} 🪙</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-sm text-white/70">Status</p>
            <p className="text-xl font-bold text-green-400">Aktiv ✓</p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-6 px-5">
        <h2 className="text-lg font-semibold mb-3">⚡ Schnellzugriff</h2>
        <div className="space-y-3">
          <div 
            onClick={() => navigate('/games')}
            className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-600/50 to-violet-600/50 border border-purple-500/30 cursor-pointer hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎮</span>
              <div>
                <p className="font-semibold">Spiele & Verdiene</p>
                <p className="text-xs text-white/70">20+ Spiele verfügbar</p>
              </div>
            </div>
            <span>→</span>
          </div>
          
          <div 
            onClick={() => navigate('/auctions')}
            className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-600/50 to-orange-600/50 border border-amber-500/30 cursor-pointer hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="font-semibold">Live Auktionen</p>
                <p className="text-xs text-white/70">iPhone 17, PS6 & mehr</p>
              </div>
            </div>
            <span>→</span>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around items-center py-3 px-4" style={{ background: '#111827' }}>
        <div onClick={() => navigate('/')} className="flex flex-col items-center cursor-pointer text-purple-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </div>
        <div onClick={() => navigate('/games')} className="flex flex-col items-center cursor-pointer text-white/70 hover:text-white">
          <span className="text-xl">🎮</span>
          <span className="text-xs">Games</span>
        </div>
        <div onClick={() => navigate('/wallet')} className="flex flex-col items-center cursor-pointer text-white/70 hover:text-white">
          <span className="text-xl">💰</span>
          <span className="text-xs">Wallet</span>
        </div>
        <div onClick={() => navigate('/profile')} className="flex flex-col items-center cursor-pointer text-white/70 hover:text-white">
          <span className="text-xl">👤</span>
          <span className="text-xs">Profil</span>
        </div>
      </nav>
    </div>
  );
}
