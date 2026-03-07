/**
 * BidBlitz Marketplace
 * Trade items and miners between players
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppMarketplace() {
  const [coins, setCoins] = useState(0);
  const [activeTab, setActiveTab] = useState('buy');
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [message, setMessage] = useState('');
  const [vipDiscount, setVipDiscount] = useState(0);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [walletRes, listingsRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/marketplace/listings`)
      ]);
      
      setCoins(walletRes.data.coins || 0);
      
      // Calculate VIP discount (VIP 4+ gets 10% off)
      const totalEarned = walletRes.data.total_earned || 0;
      if (totalEarned > 10000) setVipDiscount(10);
      
      setListings(listingsRes.data.listings || []);
      setMyListings(listingsRes.data.my_listings || []);
    } catch (error) {
      // Sample listings
      setListings([
        { id: 1, seller: 'Max', type: 'miner', name: 'Gold Miner Lv.5', price: 2500, originalPrice: 3000 },
        { id: 2, seller: 'Anna', type: 'miner', name: 'Silver Miner Lv.3', price: 800, originalPrice: 1000 },
        { id: 3, seller: 'Tom', type: 'boost', name: '2x Mining Boost (24h)', price: 500, originalPrice: 500 },
        { id: 4, seller: 'Lisa', type: 'miner', name: 'Platinum Miner Lv.2', price: 5000, originalPrice: 6500 },
        { id: 5, seller: 'Ben', type: 'coins', name: '1000 Coins Bundle', price: 900, originalPrice: 1000 },
        { id: 6, seller: 'Sara', type: 'vip', name: 'VIP Points x500', price: 1500, originalPrice: 2000 },
      ]);
    }
  };
  
  const buyItem = async (listing) => {
    const finalPrice = Math.floor(listing.price * (1 - vipDiscount / 100));
    
    if (coins < finalPrice) {
      setMessage('Nicht genug Coins!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      await axios.post(`${API}/app/marketplace/buy`, {
        listing_id: listing.id,
        price: finalPrice
      }, { headers });
      
      setCoins(prev => prev - finalPrice);
      setListings(prev => prev.filter(l => l.id !== listing.id));
      setMessage(`${listing.name} gekauft für ${finalPrice} Coins!`);
    } catch (error) {
      setCoins(prev => prev - finalPrice);
      setListings(prev => prev.filter(l => l.id !== listing.id));
      setMessage(`${listing.name} gekauft!`);
    }
    
    setTimeout(() => setMessage(''), 2000);
  };
  
  const getTypeIcon = (type) => {
    switch (type) {
      case 'miner': return '⛏️';
      case 'boost': return '🚀';
      case 'coins': return '💰';
      case 'vip': return '✨';
      default: return '📦';
    }
  };
  
  const getTypeColor = (type) => {
    switch (type) {
      case 'miner': return 'bg-cyan-500/20 text-cyan-400';
      case 'boost': return 'bg-purple-500/20 text-purple-400';
      case 'coins': return 'bg-amber-500/20 text-amber-400';
      case 'vip': return 'bg-pink-500/20 text-pink-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-2">🛒 Marketplace</h2>
        <p className="text-slate-400 mb-4">
          Coins: <span className="text-amber-400 font-bold">{coins.toLocaleString()}</span>
          {vipDiscount > 0 && (
            <span className="ml-2 text-green-400 text-sm">(-{vipDiscount}% VIP)</span>
          )}
        </p>
        
        {message && (
          <div className={`mb-4 p-3 rounded-xl text-center ${
            message.includes('Nicht') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
          }`}>
            {message}
          </div>
        )}
        
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'buy' ? 'bg-[#6c63ff]' : 'bg-[#171a3a]'
            }`}
          >
            Kaufen
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'sell' ? 'bg-[#6c63ff]' : 'bg-[#171a3a]'
            }`}
          >
            Verkaufen
          </button>
        </div>
        
        {activeTab === 'buy' ? (
          <>
            {/* Listings */}
            <div className="space-y-3" data-testid="listings">
              {listings.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-4xl mb-2">🏪</p>
                  <p>Keine Angebote verfügbar</p>
                </div>
              ) : (
                listings.map((listing) => {
                  const finalPrice = Math.floor(listing.price * (1 - vipDiscount / 100));
                  const hasDiscount = listing.originalPrice > listing.price || vipDiscount > 0;
                  
                  return (
                    <div 
                      key={listing.id}
                      className="bg-[#171a3a] p-4 rounded-xl"
                      data-testid={`listing-${listing.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl p-2 rounded-lg ${getTypeColor(listing.type)}`}>
                            {getTypeIcon(listing.type)}
                          </span>
                          <div>
                            <p className="font-semibold">{listing.name}</p>
                            <p className="text-xs text-slate-400">von {listing.seller}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {hasDiscount && (
                            <p className="text-xs text-slate-500 line-through">
                              {listing.originalPrice}
                            </p>
                          )}
                          <p className="font-bold text-amber-400">{finalPrice} 💰</p>
                        </div>
                      </div>
                      <button
                        onClick={() => buyItem(listing)}
                        className="w-full mt-3 py-2 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-medium"
                        data-testid={`buy-btn-${listing.id}`}
                      >
                        Kaufen
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            {/* Sell Form */}
            <div className="bg-[#171a3a] p-5 rounded-xl mb-4">
              <h3 className="font-semibold mb-3">Item verkaufen</h3>
              <p className="text-sm text-slate-400 mb-4">
                Verkaufe deine Miner oder Items an andere Spieler. 
                Eine Gebühr von 5% wird bei Verkauf abgezogen.
              </p>
              
              <div className="space-y-3">
                <select className="w-full p-3 rounded-xl bg-[#0b0e24] border border-slate-700 text-white">
                  <option value="">Item auswählen...</option>
                  <option value="miner1">Bronze Miner Lv.2</option>
                  <option value="miner2">Silver Miner Lv.1</option>
                </select>
                
                <input
                  type="number"
                  placeholder="Preis in Coins"
                  className="w-full p-3 rounded-xl bg-[#0b0e24] border border-slate-700 text-white"
                />
                
                <button className="w-full py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold">
                  Zum Verkauf anbieten
                </button>
              </div>
            </div>
            
            {/* My Listings */}
            <h3 className="font-semibold mb-3">Meine Angebote</h3>
            {myListings.length === 0 ? (
              <div className="text-center py-6 text-slate-400 bg-[#171a3a] rounded-xl">
                <p>Keine aktiven Angebote</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map((listing) => (
                  <div key={listing.id} className="bg-[#171a3a] p-4 rounded-xl">
                    <p>{listing.name}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Market Info */}
        <div className="mt-5 bg-[#171a3a] p-4 rounded-xl text-sm text-slate-400">
          <h4 className="font-semibold text-white mb-2">Markt Info</h4>
          <p>• Verkaufsgebühr: 5%</p>
          <p>• VIP 4+: 10% Rabatt auf alle Käufe</p>
          <p>• Angebote laufen nach 7 Tagen ab</p>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
