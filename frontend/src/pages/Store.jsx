/**
 * BidBlitz Store
 * Buy items with coins
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Store() {
  const [coins, setCoins] = useState(500);
  const [result, setResult] = useState('');
  const [inventory, setInventory] = useState([]);
  const [buying, setBuying] = useState('');

  const storeItems = [
    { 
      id: 'mystery_box', 
      name: 'Mystery Box', 
      price: 50, 
      icon: '🎁',
      description: 'Enthält zufällige Belohnungen!',
      color: 'from-purple-500/20 to-pink-500/10',
      border: 'border-purple-500/30'
    },
    { 
      id: 'vip_pass', 
      name: 'VIP Pass', 
      price: 200, 
      icon: '⭐',
      description: '24h VIP-Vorteile aktivieren',
      color: 'from-amber-500/20 to-yellow-500/10',
      border: 'border-amber-500/30'
    },
    { 
      id: 'auction_ticket', 
      name: 'Auction Ticket', 
      price: 30, 
      icon: '🎫',
      description: 'Zugang zu Premium-Auktionen',
      color: 'from-red-500/20 to-orange-500/10',
      border: 'border-red-500/30'
    },
    { 
      id: 'coin_booster', 
      name: 'Coin Booster', 
      price: 100, 
      icon: '🚀',
      description: '2x Coins für 1 Stunde',
      color: 'from-cyan-500/20 to-blue-500/10',
      border: 'border-cyan-500/30'
    },
    { 
      id: 'lucky_charm', 
      name: 'Lucky Charm', 
      price: 75, 
      icon: '🍀',
      description: '+10% Gewinnchance bei Spielen',
      color: 'from-emerald-500/20 to-green-500/10',
      border: 'border-emerald-500/30'
    },
    { 
      id: 'miner_upgrade', 
      name: 'Miner Upgrade', 
      price: 150, 
      icon: '⛏️',
      description: '+20% Mining-Geschwindigkeit',
      color: 'from-slate-500/20 to-slate-600/10',
      border: 'border-slate-500/30'
    },
  ];

  useEffect(() => {
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setCoins(res.data.coins || 500);
    } catch (error) {
      console.log('Coins error');
    }
  };

  const buyItem = async (item) => {
    if (coins < item.price) {
      setResult({ type: 'error', message: 'Nicht genug Coins!' });
      setTimeout(() => setResult(''), 3000);
      return;
    }

    setBuying(item.id);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/store/buy`, {
        item_id: item.id,
        price: item.price
      }, { headers });
    } catch (error) {
      // Continue with local update
    }

    setCoins(prev => prev - item.price);
    setInventory(prev => [...prev, item.id]);
    setResult({ type: 'success', message: `${item.name} gekauft! 🎉` });
    
    setTimeout(() => {
      setResult('');
      setBuying('');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/super-app" className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              <span className="text-lg">←</span>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">🛍️ Store</h2>
              <p className="text-xs text-slate-400">Items & Power-ups kaufen</p>
            </div>
          </div>
          <div className="bg-amber-500/20 px-4 py-2 rounded-xl border border-amber-500/30">
            <span className="text-amber-400 font-bold" data-testid="coins">{coins.toLocaleString()} 💰</span>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`mb-4 p-4 rounded-xl text-center font-medium ${
            result.type === 'success' 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {result.message}
          </div>
        )}

        {/* Store Items */}
        <div className="grid grid-cols-2 gap-4" data-testid="store-items">
          {storeItems.map((item) => (
            <div 
              key={item.id}
              className={`bg-gradient-to-br ${item.color} p-5 rounded-2xl border ${item.border} transition-all hover:scale-[1.02]`}
            >
              <span className="text-4xl block mb-3">{item.icon}</span>
              <h3 className="font-bold mb-1">{item.name}</h3>
              <p className="text-xs text-slate-400 mb-3">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold">{item.price} 💰</span>
                <button
                  onClick={() => buyItem(item)}
                  disabled={buying === item.id || coins < item.price}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                    coins < item.price
                      ? 'bg-slate-600 cursor-not-allowed opacity-50'
                      : buying === item.id
                        ? 'bg-emerald-500 cursor-wait'
                        : 'bg-[#6c63ff] hover:bg-[#8b6dff]'
                  }`}
                  data-testid={`buy-${item.id}`}
                >
                  {buying === item.id ? '✓' : 'Kaufen'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Inventory */}
        {inventory.length > 0 && (
          <div className="mt-6 bg-white/5 p-5 rounded-2xl border border-white/10">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>🎒</span> Dein Inventar
            </h3>
            <div className="flex flex-wrap gap-2">
              {inventory.map((itemId, idx) => {
                const item = storeItems.find(i => i.id === itemId);
                return (
                  <div key={idx} className="bg-black/20 px-3 py-2 rounded-lg flex items-center gap-2">
                    <span>{item?.icon}</span>
                    <span className="text-sm">{item?.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link 
            to="/app-vip"
            className="bg-gradient-to-br from-amber-500/20 to-yellow-500/10 p-4 rounded-xl flex items-center gap-3 border border-amber-500/20"
          >
            <span className="text-2xl">👑</span>
            <div>
              <p className="font-medium text-sm">VIP System</p>
              <p className="text-xs text-slate-400">Premium upgraden</p>
            </div>
          </Link>
          <Link 
            to="/market"
            className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 p-4 rounded-xl flex items-center gap-3 border border-purple-500/20"
          >
            <span className="text-2xl">🛒</span>
            <div>
              <p className="font-medium text-sm">Marketplace</p>
              <p className="text-xs text-slate-400">Items handeln</p>
            </div>
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
