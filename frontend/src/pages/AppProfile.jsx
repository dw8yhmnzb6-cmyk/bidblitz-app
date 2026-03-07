/**
 * BidBlitz App Profile
 * User stats with Level system, Ranking, and actions
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppProfile() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('Afrim');
  const [coins, setCoins] = useState(12500);
  const [miners, setMiners] = useState(3);
  const [gamesWon, setGamesWon] = useState(47);
  const [referrals, setReferrals] = useState(5);
  const [level, setLevel] = useState(7);
  const [ranking, setRanking] = useState(3);
  const [xp, setXp] = useState(720);
  const [xpToNext, setXpToNext] = useState(1000);
  const [vipStatus, setVipStatus] = useState('Gold');
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    fetchProfile();
  }, []);
  
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [walletRes, minersRes, vipRes, refRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/miners/my`, { headers }),
        axios.get(`${API}/app/vip/status`, { headers }),
        axios.get(`${API}/app/referral/my-code`, { headers })
      ]);
      
      setCoins(walletRes.data.coins || 12500);
      setMiners(minersRes.data.count || 3);
      setReferrals(refRes.data.referrals || 5);
      
      // VIP data
      const vipPoints = vipRes.data.points || 720;
      setXp(vipPoints);
      
      // Calculate level from XP (100 XP per level)
      const calculatedLevel = Math.floor(vipPoints / 100) + 1;
      setLevel(calculatedLevel);
      setXpToNext((calculatedLevel) * 100);
      
      // VIP status based on level
      if (calculatedLevel >= 10) setVipStatus('Platinum');
      else if (calculatedLevel >= 7) setVipStatus('Gold');
      else if (calculatedLevel >= 4) setVipStatus('Silver');
      else setVipStatus('Bronze');
      
      // Get username
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const userData = JSON.parse(user);
          setUsername(userData.username || userData.name || 'User');
        } catch (e) {}
      }
      
      // Get games count
      try {
        const gamesRes = await axios.get(`${API}/app/games/history?limit=100`, { headers });
        setGamesWon(gamesRes.data.history?.length || 47);
      } catch (e) {}
      
    } catch (error) {
      console.log('Profile fetch error');
    }
  };
  
  const getVipColor = () => {
    switch (vipStatus) {
      case 'Platinum': return 'from-purple-500 to-pink-500';
      case 'Gold': return 'from-amber-400 to-yellow-500';
      case 'Silver': return 'from-slate-300 to-slate-400';
      default: return 'from-orange-400 to-amber-500';
    }
  };

  const getVipIcon = () => {
    switch (vipStatus) {
      case 'Platinum': return '💎';
      case 'Gold': return '👑';
      case 'Silver': return '🥈';
      default: return '🥉';
    }
  };

  const quickActions = [
    { icon: '🎮', label: 'Games', path: '/games' },
    { icon: '⛏️', label: 'Mining', path: '/miner' },
    { icon: '👥', label: 'Referral', path: '/app-referral' },
    { icon: '⭐', label: 'VIP', path: '/app-vip' },
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header with Settings */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Profil</h2>
          <button className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
            <span className="text-lg">⚙️</span>
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-center text-green-400">
            {message}
          </div>
        )}
        
        {/* Profile Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1c213f] to-[#171a3a] p-6 rounded-3xl mb-6 border border-white/10">
          {/* VIP Badge */}
          <div className={`absolute top-4 right-4 px-3 py-1 rounded-full bg-gradient-to-r ${getVipColor()} text-xs font-bold`}>
            {getVipIcon()} {vipStatus}
          </div>
          
          {/* Avatar & Name */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[#6c63ff] to-[#8b6dff] rounded-2xl flex items-center justify-center text-3xl font-bold">
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-2xl font-bold" data-testid="username">{username}</h3>
              <p className="text-slate-400">Level {level} • Rang #{ranking}</p>
            </div>
          </div>
          
          {/* Level Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Level {level}</span>
              <span className="text-slate-400">{xp}/{xpToNext} XP</span>
            </div>
            <div className="h-3 bg-black/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#6c63ff] to-[#8b6dff] rounded-full transition-all duration-500"
                style={{ width: `${(xp % 100)}%` }}
              />
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/20 p-3 rounded-xl text-center">
              <p className="text-2xl font-bold text-amber-400" data-testid="coins">{coins.toLocaleString()}</p>
              <p className="text-xs text-slate-400">Coins</p>
            </div>
            <div className="bg-black/20 p-3 rounded-xl text-center">
              <p className="text-2xl font-bold text-emerald-400" data-testid="games">{gamesWon}</p>
              <p className="text-xs text-slate-400">Games</p>
            </div>
            <div className="bg-black/20 p-3 rounded-xl text-center">
              <p className="text-2xl font-bold text-purple-400" data-testid="ranking">#{ranking}</p>
              <p className="text-xs text-slate-400">Ranking</p>
            </div>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⛏️</span>
              <span className="text-sm text-slate-400">Miners</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400" data-testid="miners">{miners}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">👥</span>
              <span className="text-sm text-slate-400">Referrals</span>
            </div>
            <p className="text-2xl font-bold text-purple-400" data-testid="refs">{referrals}</p>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 mb-6">
          <h3 className="font-semibold mb-4">Schnellzugriff</h3>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.path}
                className="p-3 bg-black/20 rounded-xl text-center hover:bg-[#6c63ff]/20 transition-all"
              >
                <span className="text-2xl block mb-1">{action.icon}</span>
                <span className="text-xs text-slate-400">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Level Tiers */}
        <div className="bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
          <h3 className="font-semibold mb-4">Level Stufen</h3>
          <div className="space-y-3">
            {[
              { name: 'Level 1-3', status: 'Bronze', icon: '🥉', color: 'from-orange-400 to-amber-500' },
              { name: 'Level 4-6', status: 'Silver', icon: '🥈', color: 'from-slate-300 to-slate-400' },
              { name: 'Level 7-9', status: 'Gold', icon: '👑', color: 'from-amber-400 to-yellow-500' },
              { name: 'Level 10+', status: 'Platinum', icon: '💎', color: 'from-purple-500 to-pink-500' },
            ].map((tier) => (
              <div 
                key={tier.name}
                className={`p-3 rounded-xl flex items-center justify-between ${
                  tier.status === vipStatus ? 'bg-[#6c63ff]/20 border border-[#6c63ff]/30' : 'bg-black/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{tier.icon}</span>
                  <div>
                    <p className="font-medium">{tier.status}</p>
                    <p className="text-xs text-slate-400">{tier.name}</p>
                  </div>
                </div>
                {tier.status === vipStatus && (
                  <span className="text-xs bg-[#6c63ff] px-2 py-1 rounded-full">Aktuell</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
