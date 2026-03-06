/**
 * BidBlitz VIP Status
 * VIP Levels based on total coins earned, with benefits
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppVIP() {
  const [vipLevel, setVipLevel] = useState('VIP 1');
  const [totalEarned, setTotalEarned] = useState(1500);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    fetchVIPStatus();
  }, []);
  
  useEffect(() => {
    updateVIPLevel();
  }, [totalEarned]);
  
  const fetchVIPStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setTotalEarned(res.data.total_earned || 0);
    } catch (error) {
      console.log('VIP fetch error');
    }
  };
  
  const updateVIPLevel = () => {
    let level = 'VIP 1';
    if (totalEarned > 20000) level = 'VIP 5';
    else if (totalEarned > 10000) level = 'VIP 4';
    else if (totalEarned > 5000) level = 'VIP 3';
    else if (totalEarned > 2000) level = 'VIP 2';
    setVipLevel(level);
  };
  
  const earnCoins = async () => {
    const win = Math.floor(Math.random() * 200);
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API}/app/games/play`, 
        { game_type: 'vip_earn' },
        { headers }
      );
      
      // Update total earned
      const newTotal = totalEarned + (res.data.reward || win);
      setTotalEarned(newTotal);
      setMessage(`+${res.data.reward || win} Coins verdient!`);
    } catch (error) {
      setTotalEarned(prev => prev + win);
      setMessage(`+${win} Coins verdient!`);
    }
    
    setTimeout(() => setMessage(''), 2000);
  };
  
  const getVIPColor = () => {
    switch (vipLevel) {
      case 'VIP 5': return '#ffd700'; // Gold
      case 'VIP 4': return '#a855f7'; // Purple
      case 'VIP 3': return '#f59e0b'; // Orange
      case 'VIP 2': return '#94a3b8'; // Silver
      default: return '#6c63ff'; // Default
    }
  };
  
  const getNextLevel = () => {
    if (totalEarned <= 2000) return { level: 'VIP 2', needed: 2000 - totalEarned };
    if (totalEarned <= 5000) return { level: 'VIP 3', needed: 5000 - totalEarned };
    if (totalEarned <= 10000) return { level: 'VIP 4', needed: 10000 - totalEarned };
    if (totalEarned <= 20000) return { level: 'VIP 5', needed: 20000 - totalEarned };
    return null;
  };
  
  const nextLevel = getNextLevel();
  
  const benefits = [
    { level: 'VIP 1', benefit: 'Normal Rewards', unlocked: true },
    { level: 'VIP 2', benefit: '+10% Mining Profit', unlocked: totalEarned > 2000 },
    { level: 'VIP 3', benefit: '+20% Mining Profit', unlocked: totalEarned > 5000 },
    { level: 'VIP 4', benefit: '-10% Marketplace Fees', unlocked: totalEarned > 10000 },
    { level: 'VIP 5', benefit: 'Exclusive Games', unlocked: totalEarned > 20000 },
  ];
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-5">BidBlitz VIP Status</h2>
        
        {/* Message */}
        {message && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-center text-green-400">
            {message}
          </div>
        )}
        
        {/* VIP Card */}
        <div 
          className="p-6 rounded-2xl text-center mb-5"
          style={{
            background: 'linear-gradient(135deg, #5f63ff, #8b6dff)',
          }}
          data-testid="vip-card"
        >
          <p className="text-white/80 text-sm mb-1">Your VIP Level</p>
          <h1 
            className="text-4xl font-bold mb-4"
            style={{ color: getVIPColor() }}
            data-testid="vip-level"
          >
            {vipLevel}
          </h1>
          <p className="text-white/80 text-sm mb-1">Total Coins Earned</p>
          <h3 className="text-2xl font-bold" data-testid="total-earned">
            {totalEarned.toLocaleString()}
          </h3>
          
          {nextLevel && (
            <p className="mt-3 text-sm text-white/60">
              Noch {nextLevel.needed.toLocaleString()} Coins bis {nextLevel.level}
            </p>
          )}
        </div>
        
        {/* Benefits */}
        <div 
          className="bg-[#171a3a] p-5 rounded-2xl mb-5"
          data-testid="benefits-card"
        >
          <h3 className="font-semibold mb-4">VIP Benefits</h3>
          <ul className="space-y-3">
            {benefits.map((item, index) => (
              <li 
                key={index}
                className={`flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0 ${
                  item.unlocked ? 'text-white' : 'text-slate-500'
                }`}
              >
                <span>
                  <span className={item.unlocked ? 'text-green-400' : 'text-slate-600'}>
                    {item.unlocked ? '✓' : '○'}
                  </span>
                  {' '}{item.level}
                </span>
                <span className={`text-sm ${item.unlocked ? 'text-amber-400' : 'text-slate-500'}`}>
                  {item.benefit}
                </span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Earn Button */}
        <button
          onClick={earnCoins}
          className="w-full py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold
                     transition-colors active:scale-98"
          data-testid="earn-btn"
        >
          Earn Coins
        </button>
        
        {/* VIP Tier Info */}
        <div className="mt-5 bg-[#171a3a] p-4 rounded-xl text-sm text-slate-400">
          <h4 className="font-semibold text-white mb-2">VIP Stufen:</h4>
          <div className="space-y-1">
            <p>VIP 1 → 0 - 2.000 Coins</p>
            <p>VIP 2 → 2.001 - 5.000 Coins</p>
            <p>VIP 3 → 5.001 - 10.000 Coins</p>
            <p>VIP 4 → 10.001 - 20.000 Coins</p>
            <p>VIP 5 → 20.001+ Coins</p>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
