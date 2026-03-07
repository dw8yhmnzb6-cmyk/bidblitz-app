/**
 * BidBlitz Super App Dashboard
 * Modern 8-card grid with glassmorphism design + Sponsored Ads
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function SuperAppMinimal() {
  const [balance, setBalance] = useState(0);
  const [notifications, setNotifications] = useState(0);
  const [userName, setUserName] = useState('User');
  const [adIndex, setAdIndex] = useState(0);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [stats, setStats] = useState(null);
  
  const ads = [
    { text: "🍽️ Restaurant Promotion - 20% Discount", color: "from-orange-500/20 to-red-500/10", border: "border-orange-500/30" },
    { text: "🚕 Taxi Bonus Ride - 10 Coins Cashback", color: "from-amber-500/20 to-yellow-500/10", border: "border-amber-500/30" },
    { text: "🎮 BidBlitz Games Tournament - Join Now!", color: "from-purple-500/20 to-pink-500/10", border: "border-purple-500/30" },
    { text: "⭐ VIP Membership Offer - 50% Off!", color: "from-cyan-500/20 to-blue-500/10", border: "border-cyan-500/30" },
  ];
  
  useEffect(() => {
    fetchData();
    // Auto-rotate ads every 5 seconds
    const adInterval = setInterval(() => {
      setAdIndex(prev => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(adInterval);
  }, []);
  
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [walletRes, dailyRes, statsRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/core/daily/status`, { headers }),
        axios.get(`${API}/app/core/stats/overview`, { headers })
      ]);
      
      setBalance(walletRes.data.coins || 0);
      setUserName(walletRes.data.username || 'User');
      setDailyStatus(dailyRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.log('Data error');
    }
  };

  const claimDaily = async () => {
    setClaiming(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/app/core/daily/claim`, {}, { headers });
      setBalance(res.data.new_balance);
      setDailyStatus(prev => ({ ...prev, claimed_today: true, day: res.data.day, streak: res.data.streak }));
    } catch (error) {
      console.log('Claim error');
    } finally {
      setClaiming(false);
    }
  };

  const nextAd = () => {
    setAdIndex(prev => (prev + 1) % ads.length);
  };
  
  const cards = [
    { id: 'scan', icon: '📷', label: 'Scan', desc: 'QR scannen', path: '/scooter', gradient: 'from-cyan-500 to-cyan-600' },
    { id: 'pay', icon: '💳', label: 'Pay', desc: 'Auszahlen', path: '/withdraw', gradient: 'from-emerald-500 to-emerald-600' },
    { id: 'mining', icon: '⛏️', label: 'Mining', desc: 'BBZ verdienen', path: '/miner', gradient: 'from-purple-500 to-purple-600' },
    { id: 'wallet', icon: '👛', label: 'Wallet', desc: 'Mein Geld', path: '/app-wallet', gradient: 'from-pink-500 to-pink-600' },
    { id: 'market', icon: '🛒', label: 'Market', desc: 'Kaufen', path: '/marketplace', gradient: 'from-blue-500 to-blue-600' },
    { id: 'games', icon: '🎮', label: 'Games', desc: 'Spielen', path: '/games', gradient: 'from-red-500 to-red-600' },
  ];
  
  const engagementCards = [
    { id: 'referral', icon: '👥', label: 'Referral', path: '/referral' },
    { id: 'daily', icon: '🎁', label: 'Daily Reward', path: '/missions' },
    { id: 'treasure', icon: '🗺️', label: 'Treasure', path: '/map' },
    { id: 'leaderboard', icon: '🏆', label: 'Leaderboard', path: '/app-leaderboard' },
  ];

  const categoryTabs = [
    { id: 'auktionen', label: 'Auktionen', icon: '📍' },
    { id: 'mobility', label: 'Mobility', icon: '🚗' },
    { id: 'essen', label: 'Essen', icon: '🍔' },
    { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  ];
  
  const [activeCategory, setActiveCategory] = useState('auktionen');

  const quickLinks = [
    { icon: '🎯', label: 'Missionen', path: '/missions' },
    { icon: '🗺️', label: 'Map', path: '/map' },
    { icon: '📍', label: 'Routen', path: '/favorite-routes' },
    { icon: '⭐', label: 'Ratings', path: '/driver-ratings' },
    { icon: '🏆', label: 'Ranking', path: '/app-leaderboard' },
    { icon: '🎖️', label: 'Badges', path: '/app-achievements' },
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-40 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>
      
      <div className="relative p-5">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-slate-400 text-sm">Willkommen zurück 👋</p>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {userName}
            </h2>
          </div>
          <Link 
            to="/app-notifications"
            className="relative p-3 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
            data-testid="notifications-btn"
          >
            <span className="text-xl">🔔</span>
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold animate-pulse">
                {notifications}
              </span>
            )}
          </Link>
        </div>
        
        {/* Balance Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#6c63ff] via-[#8b6dff] to-[#a78bfa] p-6 rounded-3xl mb-6 shadow-2xl shadow-purple-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl translate-y-10 -translate-x-10"></div>
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">💰</span>
              <p className="text-white/80 text-sm font-medium">Wallet Balance</p>
            </div>
            <p className="text-4xl font-bold mb-4 tracking-tight">{balance.toLocaleString()} <span className="text-xl font-normal opacity-80">Coins</span></p>
            
            <div className="flex gap-3">
              <Link 
                to="/withdraw"
                className="flex-1 py-3 px-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-sm font-medium text-center transition-all border border-white/20"
                data-testid="withdraw-btn"
              >
                💸 Auszahlen
              </Link>
              <Link 
                to="/analytics"
                className="flex-1 py-3 px-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-sm font-medium text-center transition-all border border-white/20"
                data-testid="analytics-btn"
              >
                📊 Analytics
              </Link>
            </div>
          </div>
        </div>

        {/* Sponsored Ads Banner */}
        <div className="mb-6" data-testid="sponsored-ads">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Sponsored</p>
            <button 
              onClick={nextAd}
              className="text-xs text-[#6c63ff] hover:text-[#8b6dff] transition-colors"
              data-testid="next-ad-btn"
            >
              Nächste →
            </button>
          </div>
          <div 
            className={`bg-gradient-to-r ${ads[adIndex].color} p-5 rounded-2xl border ${ads[adIndex].border} transition-all duration-500`}
          >
            <p className="text-center text-lg font-medium">{ads[adIndex].text}</p>
          </div>
          <div className="flex justify-center gap-1.5 mt-3">
            {ads.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setAdIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === adIndex ? 'bg-[#6c63ff] w-6' : 'bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Daily Reward Card */}
        {dailyStatus && (
          <div className="mb-6 bg-gradient-to-br from-amber-500/20 to-orange-500/10 p-5 rounded-2xl border border-amber-500/30" data-testid="daily-reward-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔥</span>
                <div>
                  <p className="font-bold text-white">Tägliche Belohnung</p>
                  <p className="text-xs text-amber-400/80">Streak: {dailyStatus.streak || 0} Tage</p>
                </div>
              </div>
              <button
                onClick={claimDaily}
                disabled={dailyStatus.claimed_today || claiming}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all ${
                  dailyStatus.claimed_today 
                    ? 'bg-white/10 text-slate-400 cursor-not-allowed' 
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
                data-testid="claim-daily-btn"
              >
                {claiming ? '...' : dailyStatus.claimed_today ? '✓ Abgeholt' : `+${dailyStatus.next_reward} Coins`}
              </button>
            </div>
            <div className="flex gap-1">
              {dailyStatus.rewards?.map((reward, idx) => (
                <div 
                  key={idx}
                  className={`flex-1 py-2 rounded-lg text-center text-xs font-medium ${
                    idx < (dailyStatus.day || 0) 
                      ? 'bg-amber-500/40 text-amber-200' 
                      : idx === (dailyStatus.day || 0) && !dailyStatus.claimed_today
                        ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {reward}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions Row - Mobile Scrollable */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
          <Link to="/scooter" className="flex-none w-16 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 active:bg-cyan-500/40 rounded-xl text-center transition-all border border-cyan-500/30 touch-manipulation">
            <span className="text-2xl">📷</span>
            <p className="text-xs text-cyan-400 mt-1">Scan</p>
          </Link>
          <Link to="/withdraw" className="flex-none w-16 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/40 rounded-xl text-center transition-all border border-emerald-500/30 touch-manipulation">
            <span className="text-2xl">💳</span>
            <p className="text-xs text-emerald-400 mt-1">Pay</p>
          </Link>
          <Link to="/miner" className="flex-none w-16 py-3 bg-purple-500/20 hover:bg-purple-500/30 active:bg-purple-500/40 rounded-xl text-center transition-all border border-purple-500/30 touch-manipulation">
            <span className="text-2xl">⛏️</span>
            <p className="text-xs text-purple-400 mt-1">Mining</p>
          </Link>
          <Link to="/taxi" className="flex-none w-16 py-3 bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 rounded-xl text-center transition-all border border-amber-500/30 touch-manipulation">
            <span className="text-2xl">🚕</span>
            <p className="text-xs text-amber-400 mt-1">Ride</p>
          </Link>
          <Link to="/friends" className="flex-none w-16 py-3 bg-pink-500/20 hover:bg-pink-500/30 active:bg-pink-500/40 rounded-xl text-center transition-all border border-pink-500/30 touch-manipulation">
            <span className="text-2xl">💸</span>
            <p className="text-xs text-pink-400 mt-1">Send</p>
          </Link>
          <Link to="/store" className="flex-none w-16 py-3 bg-blue-500/20 hover:bg-blue-500/30 active:bg-blue-500/40 rounded-xl text-center transition-all border border-blue-500/30 touch-manipulation">
            <span className="text-2xl">🛍️</span>
            <p className="text-xs text-blue-400 mt-1">Shop</p>
          </Link>
        </div>
        
        {/* 6-Card Grid - Mobile Optimized */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-300">Quick Actions</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {cards.map((card) => (
              <Link
                key={card.id}
                to={card.path}
                className="group relative bg-white/5 backdrop-blur-sm p-4 rounded-2xl text-center cursor-pointer transition-all duration-300 hover:scale-105 hover:bg-white/10 border border-white/5 hover:border-white/20 active:scale-95"
                data-testid={`card-${card.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Navigating to:', card.path);
                }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} rounded-2xl opacity-0 group-hover:opacity-20 group-active:opacity-30 transition-opacity pointer-events-none`}></div>
                <p className="text-3xl sm:text-4xl mb-2 group-hover:scale-110 group-active:scale-95 transition-transform pointer-events-none">{card.icon}</p>
                <p className="text-sm font-semibold text-white/90 pointer-events-none">{card.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block pointer-events-none">{card.desc}</p>
              </Link>
            ))}
          </div>
        </div>
        
        {/* Quick Actions Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link 
            to="/app-referral"
            className="group relative overflow-hidden bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 p-5 rounded-2xl flex items-center gap-4 hover:from-emerald-500/30 hover:to-emerald-600/20 transition-all border border-emerald-500/20"
            data-testid="invite-friends-btn"
          >
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              👥
            </div>
            <div>
              <p className="font-bold text-white">Freunde einladen</p>
              <p className="text-xs text-emerald-400/80">+100 Coins pro Einladung</p>
            </div>
          </Link>
          <Link 
            to="/app-vip"
            className="group relative overflow-hidden bg-gradient-to-br from-amber-500/20 to-amber-600/10 p-5 rounded-2xl flex items-center gap-4 hover:from-amber-500/30 hover:to-amber-600/20 transition-all border border-amber-500/20"
            data-testid="vip-btn"
          >
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              ⭐
            </div>
            <div>
              <p className="font-bold text-white">VIP Status</p>
              <p className="text-xs text-amber-400/80">Level up für Bonus!</p>
            </div>
          </Link>
        </div>
        
        {/* More Features */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">✨</span>
            <h3 className="font-semibold text-white">Mehr Features</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {quickLinks.map((link) => (
              <Link 
                key={link.label}
                to={link.path} 
                className="p-3 text-center text-sm hover:bg-[#6c63ff]/20 rounded-xl transition-all group"
              >
                <span className="text-lg group-hover:scale-110 inline-block transition-transform">{link.icon}</span>
                <p className="text-xs text-slate-400 mt-1">{link.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
