/**
 * BidBlitz Super App Home
 * Clean design with Wallet Card, 8-item Grid Menu, Activity Feed
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function SuperAppMinimal() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(1250);
  const [liveFeed, setLiveFeed] = useState([]);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchLiveFeed, 10000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [walletRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
      ]);
      
      setBalance(walletRes.data.coins || 0);
      fetchLiveFeed();
    } catch (error) {
      console.log('Data fetch error');
    }
  };
  
  const fetchLiveFeed = async () => {
    try {
      const res = await axios.get(`${API}/app/live-feed?limit=5`);
      setLiveFeed(res.data.feed || []);
    } catch (error) {
      console.log('Feed error');
    }
  };
  
  const addCoins = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/app/wallet/add-coins?amount=100`, {}, { headers });
      setBalance(res.data.new_balance);
      setMessage('+100 Coins hinzugefügt!');
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      setMessage('Fehler beim Hinzufügen');
    }
  };
  
  // Menu items with navigation
  const menuItems = [
    { emoji: '🚕', label: 'Taxi', path: '/taxi' },
    { emoji: '🛴', label: 'Scooter', path: '/scooter' },
    { emoji: '🎮', label: 'Games', path: '/games' },
    { emoji: '⛏️', label: 'Mining', path: '/miner' },
    { emoji: '🛍️', label: 'Marketplace', path: '/miner-market' },
    { emoji: '🎁', label: 'Rewards', path: '/daily' },
    { emoji: '👥', label: 'Referral', path: '/app-referral' },
    { emoji: '⚙️', label: 'Settings', path: '/app-profile' },
  ];
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-6">
        {/* Header */}
        <h2 className="text-2xl font-bold mb-5">BidBlitz</h2>
        
        {/* Wallet Card */}
        <div 
          className="p-6 rounded-2xl mb-6 text-center"
          style={{
            background: 'linear-gradient(135deg, #5f63ff, #8b6dff)',
          }}
          data-testid="wallet-card"
        >
          <p className="text-white/80 text-sm mb-1">Wallet Balance</p>
          <h1 className="text-3xl font-bold mb-4" data-testid="balance-display">
            {balance.toLocaleString()} Coins
          </h1>
          <button
            onClick={addCoins}
            className="px-5 py-2.5 bg-[#6c63ff] hover:bg-[#5a52e0] rounded-xl font-medium
                       transition-all active:scale-95"
            data-testid="add-coins-btn"
          >
            Add Coins
          </button>
        </div>
        
        {/* Message */}
        {message && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-center text-sm text-green-400">
            {message}
          </div>
        )}
        
        {/* 8-Item Grid Menu */}
        <div 
          className="grid grid-cols-4 gap-4 mb-6"
          data-testid="menu-grid"
        >
          {menuItems.map((item, index) => (
            <Link
              key={index}
              to={item.path}
              className="bg-[#1c213f] p-5 rounded-2xl text-center hover:bg-[#252b4d] 
                         transition-all active:scale-95 cursor-pointer"
              data-testid={`menu-item-${item.label.toLowerCase()}`}
            >
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-xs text-slate-300">{item.label}</div>
            </Link>
          ))}
        </div>
        
        {/* Recent Activity */}
        <div 
          className="bg-[#1c213f] p-5 rounded-2xl"
          data-testid="activity-feed"
        >
          <h3 className="font-semibold mb-3">Recent Activity</h3>
          <ul className="space-y-0">
            {liveFeed.length === 0 ? (
              <>
                <li className="py-3 border-b border-slate-700/50 text-slate-300 text-sm">+20 Coins from Game</li>
                <li className="py-3 border-b border-slate-700/50 text-slate-300 text-sm">+50 Coins Mining Reward</li>
                <li className="py-3 border-b border-slate-700/50 text-slate-300 text-sm">Purchased Starter Miner</li>
                <li className="py-3 text-slate-300 text-sm">Referral Bonus +100</li>
              </>
            ) : (
              liveFeed.slice(0, 5).map((item, idx) => (
                <li 
                  key={idx} 
                  className={`py-3 text-slate-300 text-sm ${
                    idx < liveFeed.length - 1 ? 'border-b border-slate-700/50' : ''
                  }`}
                >
                  {item.action}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
