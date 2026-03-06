/**
 * BidBlitz Miner Market - Minimalistic Dark Theme
 * Purchase miners and special deals
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ShoppingCart, Coins, Zap, ArrowLeft,
  Server, Sparkles, CheckCircle, AlertCircle,
  TrendingUp, Gift, ChevronRight
} from 'lucide-react';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Tier colors
const tierColors = {
  bronze: '#cd7f32',
  silver: '#94a3b8',
  gold: '#fbbf24',
  platinum: '#06b6d4',
  diamond: '#a855f7'
};

// Market Miner Card
const MarketMinerCard = ({ miner, balance, onBuy, buying }) => {
  const canAfford = balance >= miner.price;
  const color = tierColors[miner.tier];
  
  return (
    <div className="bg-[#1c213f] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
            <Server className="w-6 h-6" style={{ color }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{miner.name}</h3>
            <span className="text-xs font-medium uppercase" style={{ color }}>
              {miner.tier}
            </span>
          </div>
        </div>
        {miner.limited && (
          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
            Limitiert
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-3 text-center text-sm">
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
      
      <div className="flex items-center justify-between p-2 bg-[#0c0f22] rounded-lg mb-3">
        <span className="text-slate-400 text-sm">Preis</span>
        <span className="font-bold text-amber-400 flex items-center gap-1">
          <Coins className="w-4 h-4" />
          {miner.price.toLocaleString()}
        </span>
      </div>
      
      <p className="text-center text-xs text-slate-500 mb-3">
        ROI: ~{Math.ceil(miner.price / miner.daily_reward)} Tage
      </p>
      
      <button
        onClick={() => onBuy(miner.id)}
        disabled={!canAfford || buying}
        className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
          canAfford
            ? 'bg-[#6c63ff] hover:bg-[#5a52e0] text-white'
            : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
        }`}
      >
        {buying ? (
          <>Kaufen...</>
        ) : canAfford ? (
          <>
            <ShoppingCart className="w-4 h-4" />
            Kaufen
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            Nicht genug
          </>
        )}
      </button>
    </div>
  );
};

export default function MinerMarket() {
  const navigate = useNavigate();
  const [miners, setMiners] = useState([]);
  const [deals, setDeals] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [marketRes, walletRes, dealsRes] = await Promise.all([
        axios.get(`${API}/app/market/miners`),
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/market/deals`)
      ]);
      
      setMiners(marketRes.data.miners || []);
      setBalance(walletRes.data.coins || 0);
      setDeals(dealsRes.data.deals || []);
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleBuy = async (minerTypeId) => {
    setBuying(true);
    setMessage({ type: '', text: '' });
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API}/app/miner/buy`, 
        { miner_type_id: minerTypeId },
        { headers }
      );
      
      setMessage({ type: 'success', text: res.data.message });
      setBalance(res.data.new_balance);
      
      setTimeout(() => navigate('/miner'), 1500);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Kauf fehlgeschlagen' 
      });
    } finally {
      setBuying(false);
    }
  };
  
  const addTestCoins = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/app/wallet/add-coins?amount=5000`, {}, { headers });
      setBalance(res.data.new_balance);
      setMessage({ type: 'success', text: '+5.000 Test-Coins!' });
    } catch (error) {
      console.error('Error adding coins:', error);
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
        <div className="flex items-center gap-3 mb-1">
          <Link to="/miner" className="p-1.5 bg-[#1c213f] rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <h1 className="text-2xl font-bold">Market</h1>
        </div>
        <p className="text-slate-400 text-sm ml-10">Kaufe neue Miner</p>
      </div>
      
      {/* Balance Bar */}
      <div className="px-5 mb-5">
        <div className="bg-[#1c213f] rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <span className="text-slate-400 text-sm">Guthaben:</span>
            <span className="font-bold text-amber-400">{balance.toLocaleString()}</span>
          </div>
          <button
            onClick={addTestCoins}
            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium"
          >
            +5000 Test
          </button>
        </div>
      </div>
      
      {/* Message */}
      {message.text && (
        <div className={`mx-5 mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-500/20 text-green-300' 
            : 'bg-red-500/20 text-red-300'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}
      
      {/* Deals */}
      {deals.length > 0 && (
        <div className="px-5 mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Deals
          </h2>
          {deals.map((deal) => (
            <div key={deal.id} className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-400" />
                  <span className="font-semibold">{deal.name}</span>
                </div>
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                  -{deal.discount}%
                </span>
              </div>
              <p className="text-sm text-slate-300 mb-3">{deal.description}</p>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 line-through text-sm">{deal.original_price}</span>
                  <span className="text-amber-400 font-bold ml-2">{deal.sale_price} Coins</span>
                </div>
                <button className="px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold text-sm">
                  Kaufen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Miners Grid */}
      <div className="px-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Server className="w-5 h-5 text-[#6c63ff]" />
          Alle Miner
        </h2>
        <div className="space-y-3">
          {miners.map((miner) => (
            <MarketMinerCard 
              key={miner.id} 
              miner={miner} 
              balance={balance}
              onBuy={handleBuy}
              buying={buying}
            />
          ))}
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
