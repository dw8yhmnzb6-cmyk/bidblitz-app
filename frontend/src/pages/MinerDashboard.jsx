/**
 * BidBlitz Mining Farm - With Pool Stats & VIP Bonus
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

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
      className="w-16 h-16 mx-auto rounded-xl animate-spin-slow"
      style={{ 
        background: gradients[tier] || gradients.silver,
        boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
      }}
    />
  );
};

export default function MinerDashboard() {
  const [stats, setStats] = useState({ hashrate: 0, daily: 0, coins: 0 });
  const [miners, setMiners] = useState([]);
  const [poolStats, setPoolStats] = useState(null);
  const [liveBtc, setLiveBtc] = useState(0.00000001);
  const [message, setMessage] = useState('');
  const [vipLevel, setVipLevel] = useState(1);
  const [vipBonus, setVipBonus] = useState(0);
  
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
      
      const [statsRes, minersRes, poolRes, walletRes] = await Promise.all([
        axios.get(`${API}/app/mining/stats`, { headers }),
        axios.get(`${API}/app/miners/my`, { headers }),
        axios.get(`${API}/app/pool/stats`),
        axios.get(`${API}/app/wallet/balance`, { headers })
      ]);
      
      // Calculate VIP level and bonus
      const totalEarned = walletRes.data.total_earned || 0;
      let level = 1, bonus = 0;
      if (totalEarned > 20000) { level = 5; bonus = 20; }
      else if (totalEarned > 10000) { level = 4; bonus = 20; }
      else if (totalEarned > 5000) { level = 3; bonus = 20; }
      else if (totalEarned > 2000) { level = 2; bonus = 10; }
      setVipLevel(level);
      setVipBonus(bonus);
      
      setStats({
        hashrate: statsRes.data.total_hashrate || 0,
        daily: statsRes.data.daily_reward || 0,
        coins: walletRes.data.coins || 0
      });
      setMiners(minersRes.data.miners || []);
      setPoolStats(poolRes.data);
    } catch (error) {
      console.log('Data error');
    }
  };
  
  const claimRewards = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/miner/claim`, { headers });
      setMessage(res.data.message);
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Error');
    }
  };
  
  const upgradeMiner = async (minerId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/miner/upgrade`, { miner_id: minerId }, { headers });
      setMessage('Miner upgraded!');
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Upgrade failed');
    }
  };
  
  const dailyBtc = (stats.daily * 0.00000001).toFixed(8);
  
  return (
    <div className="min-h-screen bg-[#0c0f22] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-5">BidBlitz Mining Farm</h2>
        
        {/* Overview */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-[#1c213f] p-3 rounded-xl text-center">
            <p className="text-xs text-slate-400">Total Power</p>
            <h3 className="text-lg font-bold text-cyan-400">{stats.hashrate} TH</h3>
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
        {miners.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {miners.map((miner) => (
              <div 
                key={miner.id} 
                className="bg-[#14183a] p-4 rounded-xl text-center"
                style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
              >
                <Machine tier={miner.tier} />
                <h3 className="font-semibold mt-2 text-sm">{miner.name}</h3>
                <p className="text-xs text-cyan-400 mb-2">{miner.hashrate} TH</p>
                <button
                  onClick={() => upgradeMiner(miner.id)}
                  disabled={miner.level >= 10}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    miner.level >= 10
                      ? 'bg-slate-700 text-slate-500'
                      : 'bg-[#6c63ff] hover:bg-[#5a52e0]'
                  }`}
                >
                  {miner.level >= 10 ? 'Max' : 'Upgrade'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#1c213f] p-6 rounded-xl text-center mb-5">
            <p className="text-slate-400 mb-3">No miners yet</p>
            <Link to="/miner-market" className="inline-block px-5 py-2 bg-[#6c63ff] rounded-lg font-medium">
              Buy Miner
            </Link>
          </div>
        )}
        
        {/* Live Mining */}
        <div className="bg-[#1c213f] p-4 rounded-xl text-center mb-5">
          <h3 className="font-semibold mb-2">Live Mining</h3>
          <p className="text-xl font-bold text-green-400 font-mono">+{liveBtc.toFixed(8)} BTC</p>
        </div>
        
        {/* Buttons */}
        <div className="flex gap-3">
          <button onClick={claimRewards} className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold">
            Claim
          </button>
          <Link to="/miner-market" className="flex-1 py-3 bg-[#6c63ff] hover:bg-[#5a52e0] rounded-xl font-semibold text-center">
            Buy
          </Link>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spinSlow {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        .animate-spin-slow {
          animation: spinSlow 6s linear infinite;
          transform-style: preserve-3d;
        }
      `}</style>
      
      <BottomNav />
    </div>
  );
}
