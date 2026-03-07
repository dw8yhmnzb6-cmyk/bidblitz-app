/**
 * BidBlitz Store
 * Buy items, coins, and VIP passes
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
  const [activeTab, setActiveTab] = useState('items');

  // Store items (buy with coins)
  const storeItems = [
    { id: 'mystery_box', name: 'Mystery Box', price: 50, icon: '🎁', description: 'Zufällige Belohnungen!', color: 'from-purple-500/20 to-pink-500/10', border: 'border-purple-500/30' },
    { id: 'vip_pass', name: 'VIP Pass', price: 200, icon: '⭐', description: '24h VIP-Vorteile', color: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/30' },
    { id: 'auction_ticket', name: 'Auction Ticket', price: 30, icon: '🎫', description: 'Premium-Auktionen', color: 'from-red-500/20 to-orange-500/10', border: 'border-red-500/30' },
    { id: 'coin_booster', name: 'Coin Booster', price: 100, icon: '🚀', description: '2x Coins 1h', color: 'from-cyan-500/20 to-blue-500/10', border: 'border-cyan-500/30' },
    { id: 'lucky_charm', name: 'Lucky Charm', price: 75, icon: '🍀', description: '+10% Gewinnchance', color: 'from-emerald-500/20 to-green-500/10', border: 'border-emerald-500/30' },
    { id: 'extra_spins', name: 'Extra Spins x3', price: 60, icon: '🎡', description: '+3 Spin Wheel Plays', color: 'from-pink-500/20 to-rose-500/10', border: 'border-pink-500/30' },
  ];

  // Coin packages (buy with real money)
  const coinPackages = [
    { id: 'coins_100', coins: 100, price: '1,00 €', icon: '💰', color: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/30', popular: false },
    { id: 'coins_1000', coins: 1000, price: '8,00 €', icon: '💰💰', color: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-500/30', popular: true, savings: '20%' },
    { id: 'coins_5000', coins: 5000, price: '30,00 €', icon: '💰💰💰', color: 'from-amber-500/20 to-red-500/10', border: 'border-amber-500/30', popular: false, savings: '40%' },
  ];

  // VIP Subscription
  const vipSubscription = {
    price: '9,99 €/Monat',
    benefits: ['2x Coins bei Spielen', 'Exklusive Spiele', 'Keine Werbung', '+50 Daily Coins', 'VIP Badge']
  };

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
      await axios.post(`${API}/app/store/buy`, { item_id: item.id, price: item.price }, { headers });
    } catch (error) {}

    setCoins(prev => prev - item.price);
    setInventory(prev => [...prev, item.id]);
    setResult({ type: 'success', message: `${item.name} gekauft! 🎉` });
    
    setTimeout(() => { setResult(''); setBuying(''); }, 2000);
  };

  const buyCoins = (pkg) => {
    setResult({ type: 'info', message: `Zahlungsseite wird geöffnet für ${pkg.coins} Coins...` });
    setTimeout(() => setResult(''), 3000);
    // Here you would integrate Stripe/PayPal
  };

  const watchAd = () => {
    setResult({ type: 'success', message: '+5 Coins für Werbung! 📺' });
    setCoins(prev => prev + 5);
    setTimeout(() => setResult(''), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
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
              <p className="text-xs text-slate-400">Items & Coins kaufen</p>
            </div>
          </div>
          <div className="bg-amber-500/20 px-4 py-2 rounded-xl border border-amber-500/30">
            <span className="text-amber-400 font-bold">{coins.toLocaleString()} 💰</span>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={`mb-4 p-4 rounded-xl text-center font-medium ${
            result.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : result.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>{result.message}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'items', label: 'Items', icon: '🎁' },
            { id: 'coins', label: 'Coins', icon: '💰' },
            { id: 'vip', label: 'VIP', icon: '👑' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id ? 'bg-[#6c63ff] text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span>{tab.icon}</span><span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Items Tab */}
        {activeTab === 'items' && (
          <div className="grid grid-cols-2 gap-4">
            {storeItems.map((item) => (
              <div key={item.id} className={`bg-gradient-to-br ${item.color} p-5 rounded-2xl border ${item.border}`}>
                <span className="text-4xl block mb-3">{item.icon}</span>
                <h3 className="font-bold mb-1">{item.name}</h3>
                <p className="text-xs text-slate-400 mb-3">{item.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-bold">{item.price} 💰</span>
                  <button
                    onClick={() => buyItem(item)}
                    disabled={buying === item.id || coins < item.price}
                    className={`px-4 py-2 rounded-xl font-medium text-sm ${
                      coins < item.price ? 'bg-slate-600 opacity-50' : buying === item.id ? 'bg-emerald-500' : 'bg-[#6c63ff] hover:bg-[#8b6dff]'
                    }`}
                  >{buying === item.id ? '✓' : 'Kaufen'}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coins Tab */}
        {activeTab === 'coins' && (
          <div className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-4">
              <h3 className="font-semibold mb-2">💶 Coins kaufen</h3>
              <p className="text-xs text-slate-400">Kaufe Coins mit echtem Geld</p>
            </div>
            
            {coinPackages.map((pkg) => (
              <div key={pkg.id} className={`bg-gradient-to-br ${pkg.color} p-5 rounded-2xl border ${pkg.border} relative`}>
                {pkg.popular && (
                  <span className="absolute top-3 right-3 px-2 py-1 bg-[#6c63ff] text-xs rounded-full font-bold">Beliebt</span>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{pkg.icon}</span>
                    <div>
                      <h3 className="font-bold text-lg">{pkg.coins.toLocaleString()} Coins</h3>
                      {pkg.savings && <p className="text-xs text-emerald-400">Spare {pkg.savings}!</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => buyCoins(pkg)}
                    className="px-5 py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-bold"
                  >{pkg.price}</button>
                </div>
              </div>
            ))}

            {/* Watch Ad */}
            <button
              onClick={watchAd}
              className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📺</span>
                <div className="text-left">
                  <p className="font-medium">Werbung schauen</p>
                  <p className="text-xs text-slate-400">Kostenlos +5 Coins</p>
                </div>
              </div>
              <span className="text-emerald-400 font-bold">+5 💰</span>
            </button>
          </div>
        )}

        {/* VIP Tab */}
        {activeTab === 'vip' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-500/20 to-yellow-500/10 p-6 rounded-3xl border border-amber-500/30">
              <div className="text-center mb-4">
                <span className="text-5xl">👑</span>
                <h3 className="text-2xl font-bold mt-2">VIP Game Pass</h3>
                <p className="text-3xl font-bold text-amber-400 mt-2">{vipSubscription.price}</p>
              </div>
              
              <div className="space-y-2 mb-6">
                {vipSubscription.benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-black/20 p-3 rounded-xl">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
              
              <button className="w-full py-4 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-bold text-lg">
                VIP aktivieren
              </button>
            </div>

            <Link to="/app-vip" className="block bg-white/5 p-4 rounded-xl text-center hover:bg-white/10">
              Einmalige VIP-Level ansehen →
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
