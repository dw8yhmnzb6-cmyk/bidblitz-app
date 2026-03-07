/**
 * BidBlitz VIP Level System
 * XP-based leveling with progress bar
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppVIP() {
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    fetchVIPStatus();
  }, []);
  
  const fetchVIPStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.get(`${API}/app/vip/status`, { headers });
      setLevel(res.data.level || 1);
      setXp(res.data.xp || 0);
      setTotalCoins(res.data.total_earned || 0);
    } catch (error) {
      // Load from localStorage
      const savedXp = parseInt(localStorage.getItem('vipXp') || '0');
      const savedLevel = parseInt(localStorage.getItem('vipLevel') || '1');
      setXp(savedXp);
      setLevel(savedLevel);
    }
  };
  
  const earnXP = async () => {
    let newXp = xp + 10;
    let newLevel = level;
    
    if (newXp >= 100) {
      newLevel++;
      newXp = 0;
      setMessage(`🎉 Level Up! Du bist jetzt Level ${newLevel}!`);
    } else {
      setMessage(`+10 XP verdient!`);
    }
    
    setXp(newXp);
    setLevel(newLevel);
    
    // Save to localStorage
    localStorage.setItem('vipXp', newXp.toString());
    localStorage.setItem('vipLevel', newLevel.toString());
    
    // Save to backend
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/vip/add-xp?xp=10`, {}, { headers });
    } catch (error) {
      console.log('XP save error');
    }
    
    setTimeout(() => setMessage(''), 2000);
  };
  
  const getLevelBadge = () => {
    if (level >= 50) return { name: 'Diamond', color: '#00bcd4', icon: '💎' };
    if (level >= 30) return { name: 'Platinum', color: '#a855f7', icon: '👑' };
    if (level >= 20) return { name: 'Gold', color: '#f59e0b', icon: '🥇' };
    if (level >= 10) return { name: 'Silver', color: '#94a3b8', icon: '🥈' };
    if (level >= 5) return { name: 'Bronze', color: '#cd7f32', icon: '🥉' };
    return { name: 'Starter', color: '#6c63ff', icon: '⭐' };
  };
  
  const badge = getLevelBadge();
  
  const benefits = [
    { level: 1, benefit: 'Basis Features', unlocked: level >= 1 },
    { level: 5, benefit: '+5% Daily Bonus', unlocked: level >= 5 },
    { level: 10, benefit: '+10% Mining Profit', unlocked: level >= 10 },
    { level: 20, benefit: '+20% Game Rewards', unlocked: level >= 20 },
    { level: 30, benefit: 'Exclusive Games', unlocked: level >= 30 },
    { level: 50, benefit: 'VIP Support', unlocked: level >= 50 },
  ];
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-5">🏆 BidBlitz VIP Level</h2>
        
        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-xl text-center ${
            message.includes('Level Up') ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
          }`}>
            {message}
          </div>
        )}
        
        {/* Level Card */}
        <div 
          className="p-6 rounded-2xl text-center mb-5"
          style={{
            background: `linear-gradient(135deg, ${badge.color}33, ${badge.color}11)`,
            border: `2px solid ${badge.color}55`
          }}
        >
          <p className="text-5xl mb-2">{badge.icon}</p>
          <p className="text-sm text-slate-400 mb-1">Your Level</p>
          <h1 className="text-4xl font-bold mb-2" style={{ color: badge.color }}>
            {level}
          </h1>
          <p className="text-sm" style={{ color: badge.color }}>{badge.name}</p>
          
          <div className="mt-4">
            <p className="text-sm text-slate-400 mb-1">XP Points: <span className="text-white font-bold">{xp}</span> / 100</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-5">
          <div className="w-full h-5 bg-[#1f2245] rounded-xl overflow-hidden">
            <div 
              className="h-full rounded-xl transition-all duration-500"
              style={{ 
                width: `${xp}%`,
                background: badge.color
              }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1 text-center">
            {100 - xp} XP bis Level {level + 1}
          </p>
        </div>
        
        {/* Use App Button */}
        <button
          onClick={earnXP}
          className="w-full py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold
                     transition-colors active:scale-98 mb-5"
        >
          Use App (+10 XP)
        </button>
        
        {/* Benefits */}
        <div className="bg-[#171a3a] p-5 rounded-2xl">
          <h3 className="font-semibold mb-4">Level Benefits</h3>
          <div className="space-y-3">
            {benefits.map((item, index) => (
              <div 
                key={index}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  item.unlocked ? 'bg-green-500/10' : 'bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={item.unlocked ? 'text-green-400' : 'text-slate-600'}>
                    {item.unlocked ? '✓' : '○'}
                  </span>
                  <span className={item.unlocked ? 'text-white' : 'text-slate-500'}>
                    Level {item.level}
                  </span>
                </div>
                <span className={`text-sm ${item.unlocked ? 'text-amber-400' : 'text-slate-600'}`}>
                  {item.benefit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
