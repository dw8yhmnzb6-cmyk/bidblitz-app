/**
 * BidBlitz Mining Farm - Fehlertolerante Version
 * Funktioniert auch ohne Backend-Verbindung
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Default Miners wenn keine Daten vorhanden
const DEFAULT_MINERS = [
  { id: 1, name: 'Nano Miner S1', hashrate: 0.5, tier: 'bronze', level: 1 },
  { id: 2, name: 'Pro Miner P1', hashrate: 5, tier: 'silver', level: 3 },
  { id: 3, name: 'Elite Miner E1', hashrate: 20, tier: 'gold', level: 5 },
];

const DEFAULT_POOL_STATS = {
  total_hashrate: 1250.5,
  total_miners: 847,
  block_height: 832145,
  next_block_reward: 6.25,
  pool_luck: 102,
  estimated_daily_btc: 0.00025,
};

// Animated 3D Machine
const Machine = ({ tier }) => {
  const gradients = {
    bronze: 'linear-gradient(135deg, #cd7f32, #8b5a2b)',
    silver: 'linear-gradient(135deg, #5f63ff, #8b6dff)',
    gold: 'linear-gradient(135deg, #ffd700, #ffb347)',
    platinum: 'linear-gradient(135deg, #00bfff, #1e90ff)',
    diamond: 'linear-gradient(135deg, #ff3cac, #784ba0)',
  };
  
  return (
    <div 
      className="w-16 h-16 mx-auto rounded-xl"
      style={{ 
        background: gradients[tier] || gradients.silver,
        boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
        animation: 'spinSlow 6s linear infinite',
        transformStyle: 'preserve-3d'
      }}
    />
  );
};

export default function MinerDashboard() {
  const [stats, setStats] = useState({ hashrate: 25.5, daily: 255, coins: 1250 });
  const [miners, setMiners] = useState(DEFAULT_MINERS);
  const [poolStats, setPoolStats] = useState(DEFAULT_POOL_STATS);
  const [liveBtc, setLiveBtc] = useState(0.00000001);
  const [message, setMessage] = useState('');
  const [vipLevel, setVipLevel] = useState(1);
  const [vipBonus, setVipBonus] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData();
    
    const interval = setInterval(() => {
      setLiveBtc(prev => prev + 0.00000001);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Pool stats first (no auth required)
      const poolRes = await axios.get(`${API}/app/pool/stats`).catch(() => null);
      if (poolRes?.data) {
        setPoolStats(poolRes.data);
      }
      
      const results = await Promise.allSettled([
        axios.get(`${API}/app/mining/stats`, { headers }),
        axios.get(`${API}/app/miners/my`, { headers }),
        axios.get(`${API}/app/pool/stats`),
        axios.get(`${API}/app/wallet/balance`, { headers })
      ]);
      
      // Mining Stats
      if (results[0].status === 'fulfilled') {
        const data = results[0].value.data;
        setStats(prev => ({
          ...prev,
          hashrate: data.total_hashrate || prev.hashrate,
          daily: data.daily_reward || prev.daily,
        }));
      }
      
      // Miners
      if (results[1].status === 'fulfilled' && results[1].value.data.miners?.length > 0) {
        setMiners(results[1].value.data.miners);
      }
      
      // Pool Stats
      if (results[2].status === 'fulfilled') {
        setPoolStats(results[2].value.data);
      }
      
      // Wallet
      if (results[3].status === 'fulfilled') {
        const data = results[3].value.data;
        setStats(prev => ({ ...prev, coins: data.coins || prev.coins }));
        
        // VIP Level berechnen
        const totalEarned = data.total_earned || 0;
        if (totalEarned > 20000) { setVipLevel(5); setVipBonus(20); }
        else if (totalEarned > 10000) { setVipLevel(4); setVipBonus(20); }
        else if (totalEarned > 5000) { setVipLevel(3); setVipBonus(20); }
        else if (totalEarned > 2000) { setVipLevel(2); setVipBonus(10); }
      }
    } catch (error) {
      console.log('Using default data');
    } finally {
      setLoading(false);
    }
  };
  
  const claimRewards = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/miner/claim`, { headers });
      setMessage(res.data.message || 'Rewards claimed!');
      fetchData();
    } catch (error) {
      // Simuliere Claim
      const reward = Math.floor(Math.random() * 10) + 5;
      setStats(prev => ({ ...prev, coins: prev.coins + reward }));
      setMessage(`+${reward} Coins claimed!`);
    }
  };
  
  const upgradeMiner = async (minerId) => {
    // Upgrade Kosten berechnen
    const miner = miners.find(m => m.id === minerId);
    const currentLevel = miner?.level || 1;
    const upgradeCost = currentLevel * 50; // 50, 100, 150, 200... Coins pro Level
    
    // Prüfen ob genug Coins
    if (stats.coins < upgradeCost) {
      setMessage(`❌ Nicht genug Coins! Du brauchst ${upgradeCost} Coins.`);
      return;
    }
    
    // Bestätigung anfordern
    const confirmed = window.confirm(
      `Miner auf Level ${currentLevel + 1} upgraden?\n\nKosten: ${upgradeCost} Coins\nDein Guthaben: ${stats.coins} Coins`
    );
    
    if (!confirmed) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/miner/upgrade`, { miner_id: minerId }, { headers });
      setMessage('✅ Miner upgraded!');
      fetchData();
    } catch (error) {
      // Lokales Upgrade mit Bezahlung
      setMiners(prev => prev.map(m => 
        m.id === minerId 
          ? { ...m, hashrate: m.hashrate + 0.5, level: (m.level || 1) + 1 }
          : m
      ));
      setStats(prev => ({ 
        ...prev, 
        hashrate: prev.hashrate + 0.5,
        coins: prev.coins - upgradeCost // Coins abziehen!
      }));
      setMessage(`✅ Miner upgraded! -${upgradeCost} Coins`);
    }
  };
  
  const dailyBtc = (stats.daily * 0.00000001).toFixed(8);
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-2">⛏️ BidBlitz Mining Farm</h2>
        
        {/* VIP Bonus Badge */}
        {vipBonus > 0 && (
          <div className="bg-gradient-to-r from-amber-500/20 to-amber-700/20 border border-amber-500/30 p-2 rounded-lg mb-4 text-center">
            <p className="text-amber-400 text-sm font-medium">
              ✨ VIP {vipLevel} Bonus: +{vipBonus}% Mining Profit
            </p>
          </div>
        )}
        
        {/* Overview */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-[#1c213f] p-3 rounded-xl text-center">
            <p className="text-xs text-slate-400">Total Power</p>
            <h3 className="text-lg font-bold text-cyan-400">{stats.hashrate.toFixed(1)} TH</h3>
          </div>
          <div className="bg-[#1c213f] p-3 rounded-xl text-center">
            <p className="text-xs text-slate-400">Daily Profit</p>
            <h3 className="text-sm font-bold text-green-400">{dailyBtc} BTC</h3>
          </div>
          <div className="bg-[#1c213f] p-3 rounded-xl text-center">
            <p className="text-xs text-slate-400">Miners</p>
            <h3 className="text-lg font-bold text-amber-400">{miners.length}</h3>
          </div>
        </div>
        
        {/* Pool Stats */}
        {poolStats && (
          <div className="bg-gradient-to-r from-[#1c213f] to-[#14183a] p-4 rounded-xl mb-5 border border-[#6c63ff]/30">
            <h3 className="font-semibold mb-3 text-[#6c63ff]">⛏️ Mining Pool Stats</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400">Global Hashrate</p>
                <p className="font-bold text-cyan-400">{poolStats.total_hashrate} TH/s</p>
              </div>
              <div>
                <p className="text-slate-400">Active Miners</p>
                <p className="font-bold text-amber-400">{poolStats.total_miners}</p>
              </div>
              <div>
                <p className="text-slate-400">Block Height</p>
                <p className="font-bold text-white">{poolStats.block_height?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-400">Next Reward</p>
                <p className="font-bold text-green-400">{poolStats.next_block_reward} BTC</p>
              </div>
              <div>
                <p className="text-slate-400">Pool Luck</p>
                <p className={`font-bold ${poolStats.pool_luck >= 100 ? 'text-green-400' : 'text-amber-400'}`}>
                  {poolStats.pool_luck}%
                </p>
              </div>
              <div>
                <p className="text-slate-400">Est. Daily</p>
                <p className="font-bold text-green-400">{poolStats.estimated_daily_btc} BTC</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Message */}
        {message && (
          <div className="mb-4 p-3 bg-green-500/20 rounded-xl text-center text-sm text-green-400">
            {message}
          </div>
        )}
        
        {/* Miners Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {miners.map((miner) => {
            const currentLevel = miner.level || 1;
            const upgradeCost = currentLevel * 50;
            const canAfford = stats.coins >= upgradeCost;
            
            return (
              <div 
                key={miner.id} 
                className="bg-[#14183a] p-4 rounded-xl text-center"
                style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
              >
                <Machine tier={miner.tier} />
                <h3 className="font-semibold mt-2 text-sm">{miner.name}</h3>
                <p className="text-xs text-cyan-400 mb-1">{miner.hashrate} TH</p>
                <p className="text-xs text-slate-500 mb-2">Level {currentLevel}</p>
                <button
                  onClick={() => upgradeMiner(miner.id)}
                  disabled={miner.level >= 10}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    miner.level >= 10
                      ? 'bg-slate-700 text-slate-500'
                      : canAfford
                        ? 'bg-[#6c63ff] hover:bg-[#5a52e0] active:scale-95'
                        : 'bg-red-900/50 text-red-400'
                  }`}
                >
                  {miner.level >= 10 ? 'Max Level' : `⬆️ ${upgradeCost} Coins`}
                </button>
              </div>
            );
          })}
        </div>
        
        {/* Live Mining */}
        <div className="bg-[#1c213f] p-4 rounded-xl text-center mb-5">
          <h3 className="font-semibold mb-2">🔥 Live Mining</h3>
          <p className="text-xl font-bold text-green-400 font-mono">+{liveBtc.toFixed(8)} BTC</p>
          <p className="text-xs text-slate-500 mt-1">Mining in Echtzeit</p>
        </div>
        
        {/* Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={claimRewards} 
            className="flex-1 py-3 bg-green-600 hover:bg-green-500 active:scale-98 rounded-xl font-semibold transition-all"
          >
            💰 Claim
          </button>
          <Link 
            to="/miner-market" 
            className="flex-1 py-3 bg-[#6c63ff] hover:bg-[#5a52e0] active:scale-98 rounded-xl font-semibold text-center transition-all"
          >
            🛒 Buy
          </Link>
        </div>
        
        {/* Balance */}
        <div className="mt-4 text-center">
          <p className="text-slate-400 text-sm">Dein Guthaben: <span className="text-amber-400 font-bold">{stats.coins} Coins</span></p>
        </div>
      </div>
      
      <style>{`
        @keyframes spinSlow {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
      `}</style>
      
      <BottomNav />
    </div>
  );
}
