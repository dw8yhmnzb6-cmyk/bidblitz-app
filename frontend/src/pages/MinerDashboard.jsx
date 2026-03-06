/**
 * BidBlitz Miner Dashboard - Minimalistic Dark Theme
 * Clean card-based design matching the Super App style
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Cpu, Zap, Coins, TrendingUp, ArrowUpCircle, 
  Clock, ShoppingCart, History, Crown, Server,
  Gift, ChevronRight
} from 'lucide-react';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Miner Card - Minimalistic
const MinerCard = ({ miner, onUpgrade }) => {
  const tierColors = {
    bronze: '#cd7f32',
    silver: '#94a3b8',
    gold: '#fbbf24',
    platinum: '#06b6d4',
    diamond: '#a855f7'
  };
  
  return (
    <div className="bg-[#1c213f] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#6c63ff]/20 rounded-lg">
            <Server className="w-6 h-6 text-[#6c63ff]" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{miner.name}</h3>
            <span 
              className="text-xs font-medium uppercase"
              style={{ color: tierColors[miner.tier] }}
            >
              {miner.tier} • LVL {miner.level}
            </span>
          </div>
        </div>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="bg-[#0c0f22] rounded-lg p-2">
          <p className="text-cyan-400 font-bold">{miner.hashrate}</p>
          <p className="text-xs text-slate-500">TH/s</p>
        </div>
        <div className="bg-[#0c0f22] rounded-lg p-2">
          <p className="text-amber-400 font-bold">{miner.power}W</p>
          <p className="text-xs text-slate-500">Power</p>
        </div>
        <div className="bg-[#0c0f22] rounded-lg p-2">
          <p className="text-green-400 font-bold">+{miner.daily_reward}</p>
          <p className="text-xs text-slate-500">/Tag</p>
        </div>
      </div>
      
      <button
        onClick={() => onUpgrade(miner.id)}
        disabled={miner.level >= 10}
        className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
          miner.level >= 10
            ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            : 'bg-[#6c63ff] hover:bg-[#5a52e0] text-white'
        }`}
      >
        <ArrowUpCircle className="w-4 h-4" />
        {miner.level >= 10 ? 'Max Level' : `Upgrade (${Math.floor(miner.base_price * miner.level * 0.5)} Coins)`}
      </button>
    </div>
  );
};

export default function MinerDashboard() {
  const [stats, setStats] = useState(null);
  const [miners, setMiners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [statsRes, minersRes] = await Promise.all([
        axios.get(`${API}/app/mining/stats`, { headers }),
        axios.get(`${API}/app/miners/my`, { headers })
      ]);
      
      setStats(statsRes.data);
      setMiners(minersRes.data.miners || []);
    } catch (error) {
      console.error('Error fetching mining data:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);
  
  const handleClaim = async () => {
    setClaiming(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/miner/claim`, { headers });
      setMessage(res.data.message);
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Fehler beim Sammeln');
    } finally {
      setClaiming(false);
    }
  };
  
  const handleUpgrade = async (minerId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/miner/upgrade`, { miner_id: minerId }, { headers });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Upgrade fehlgeschlagen');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0f22] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-24">
      {/* Header */}
      <div className="p-5 pt-6">
        <h1 className="text-2xl font-bold mb-1">Mining</h1>
        <p className="text-slate-400 text-sm">Verwalte deine Mining-Farm</p>
      </div>
      
      {/* Main Stats Card */}
      <div className="px-5 mb-5">
        <div className="bg-[#1c213f] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <span className="text-slate-400">Balance</span>
            </div>
            <span className="text-2xl font-bold">{(stats?.coins || 0).toLocaleString()}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#0c0f22] rounded-xl p-3 text-center">
              <Cpu className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
              <p className="text-lg font-bold">{stats?.total_hashrate || 0}</p>
              <p className="text-xs text-slate-500">TH/s</p>
            </div>
            <div className="bg-[#0c0f22] rounded-xl p-3 text-center">
              <Zap className="w-5 h-5 mx-auto mb-1 text-purple-400" />
              <p className="text-lg font-bold">{stats?.total_power || 0}W</p>
              <p className="text-xs text-slate-500">Power</p>
            </div>
            <div className="bg-[#0c0f22] rounded-xl p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-400" />
              <p className="text-lg font-bold">+{stats?.daily_reward || 0}</p>
              <p className="text-xs text-slate-500">/Tag</p>
            </div>
          </div>
          
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-green-400 hover:to-emerald-500 transition-all disabled:opacity-50"
          >
            <Gift className={`w-5 h-5 ${claiming ? 'animate-bounce' : ''}`} />
            {claiming ? 'Sammeln...' : 'Belohnungen sammeln'}
          </button>
        </div>
      </div>
      
      {/* Message */}
      {message && (
        <div className={`mx-5 mb-4 p-3 rounded-xl text-sm ${
          message.includes('Keine') 
            ? 'bg-amber-500/20 text-amber-300' 
            : 'bg-green-500/20 text-green-300'
        }`}>
          {message}
        </div>
      )}
      
      {/* VIP Status */}
      {stats?.vip_level > 0 && (
        <div className="px-5 mb-5">
          <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-400">VIP Level {stats.vip_level}</p>
                <p className="text-xs text-amber-300/70">+{stats.vip_bonus}% Bonus</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Miners Section */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Server className="w-5 h-5 text-[#6c63ff]" />
            Deine Miner
            <span className="ml-1 px-2 py-0.5 bg-[#6c63ff]/20 text-[#6c63ff] text-xs rounded-full">
              {miners.length}
            </span>
          </h2>
          <Link to="/miner-market" className="text-[#6c63ff] text-sm flex items-center gap-1">
            Shop <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        {miners.length === 0 ? (
          <div className="bg-[#1c213f] rounded-xl p-8 text-center">
            <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Keine Miner</h3>
            <p className="text-slate-400 text-sm mb-4">Kaufe deinen ersten Miner!</p>
            <Link
              to="/miner-market"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6c63ff] text-white rounded-lg font-medium"
            >
              <ShoppingCart className="w-4 h-4" />
              Zum Shop
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {miners.map((miner) => (
              <MinerCard key={miner.id} miner={miner} onUpgrade={handleUpgrade} />
            ))}
          </div>
        )}
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
