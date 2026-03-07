/**
 * BidBlitz Marketplace
 * Create listings and buy items from other players
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppMarketplace() {
  const [coins, setCoins] = useState(500);
  const [activeTab, setActiveTab] = useState('browse');
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [result, setResult] = useState('');
  const [buying, setBuying] = useState(null);
  
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
      
      setCoins(walletRes.data.coins || 500);
      setListings(listingsRes.data.listings || []);
      setMyListings(listingsRes.data.my_listings || []);
    } catch (error) {
      // Sample listings
      setListings([
        { id: 1, seller: 'Max', title: 'Gold Miner Lv.5', price: 2500, icon: '⛏️' },
        { id: 2, seller: 'Anna', title: 'Mystery Box x3', price: 120, icon: '🎁' },
        { id: 3, seller: 'Tom', title: '2x Boost (24h)', price: 500, icon: '🚀' },
        { id: 4, seller: 'Lisa', title: 'VIP Pass', price: 180, icon: '⭐' },
        { id: 5, seller: 'Ben', title: 'Auction Tickets x5', price: 120, icon: '🎫' },
      ]);
    }
  };

  const addItem = async () => {
    if (!newItemTitle.trim() || !newItemPrice) {
      setResult({ type: 'error', message: 'Bitte alle Felder ausfüllen!' });
      setTimeout(() => setResult(''), 3000);
      return;
    }

    const price = parseInt(newItemPrice);
    if (price <= 0) {
      setResult({ type: 'error', message: 'Ungültiger Preis!' });
      setTimeout(() => setResult(''), 3000);
      return;
    }

    const newListing = {
      id: Date.now(),
      seller: 'Du',
      title: newItemTitle,
      price: price,
      icon: '📦'
    };

    // Add to my listings
    setMyListings(prev => [...prev, newListing]);
    // Also add to browse
    setListings(prev => [...prev, newListing]);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/marketplace/create`, {
        title: newItemTitle,
        price: price
      }, { headers });
    } catch (error) {
      // Continue with local state
    }

    setNewItemTitle('');
    setNewItemPrice('');
    setResult({ type: 'success', message: 'Item gelistet! 🎉' });
    setTimeout(() => setResult(''), 3000);
  };

  const buyItem = async (listing) => {
    if (coins < listing.price) {
      setResult({ type: 'error', message: 'Nicht genug Coins!' });
      setTimeout(() => setResult(''), 3000);
      return;
    }

    if (listing.seller === 'Du') {
      setResult({ type: 'error', message: 'Du kannst dein eigenes Item nicht kaufen!' });
      setTimeout(() => setResult(''), 3000);
      return;
    }

    setBuying(listing.id);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/marketplace/buy`, {
        listing_id: listing.id,
        price: listing.price
      }, { headers });
    } catch (error) {
      // Continue with local update
    }

    setCoins(prev => prev - listing.price);
    setListings(prev => prev.filter(l => l.id !== listing.id));
    setResult({ type: 'success', message: `${listing.title} gekauft! 🎉` });
    
    setTimeout(() => {
      setResult('');
      setBuying(null);
    }, 2000);
  };

  const removeListing = (id) => {
    setMyListings(prev => prev.filter(l => l.id !== id));
    setListings(prev => prev.filter(l => l.id !== id));
    setResult({ type: 'success', message: 'Listing entfernt' });
    setTimeout(() => setResult(''), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-pink-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/super-app" className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              <span className="text-lg">←</span>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">🛒 Marketplace</h2>
              <p className="text-xs text-slate-400">Items kaufen & verkaufen</p>
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'browse', label: 'Durchsuchen', icon: '🔍' },
            { id: 'sell', label: 'Verkaufen', icon: '📤' },
            { id: 'my', label: 'Meine Items', icon: '📋' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-[#6c63ff] text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div className="space-y-3" data-testid="listings">
            {listings.length === 0 ? (
              <p className="text-center text-slate-500 py-10">Keine Items verfügbar</p>
            ) : (
              listings.map((listing) => (
                <div 
                  key={listing.id}
                  className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{listing.icon || '📦'}</span>
                    <div>
                      <h3 className="font-semibold">{listing.title}</h3>
                      <p className="text-xs text-slate-400">Verkäufer: {listing.seller}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-bold">{listing.price} 💰</p>
                    {listing.seller !== 'Du' && (
                      <button
                        onClick={() => buyItem(listing)}
                        disabled={buying === listing.id || coins < listing.price}
                        className={`mt-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          coins < listing.price
                            ? 'bg-slate-600 cursor-not-allowed opacity-50'
                            : buying === listing.id
                              ? 'bg-emerald-500'
                              : 'bg-[#6c63ff] hover:bg-[#8b6dff]'
                        }`}
                        data-testid={`buy-${listing.id}`}
                      >
                        {buying === listing.id ? '✓' : 'Kaufen'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Sell Tab */}
        {activeTab === 'sell' && (
          <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span>📤</span> Item erstellen
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Item Name..."
                className="w-full p-3.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-[#6c63ff] focus:outline-none"
                data-testid="item-title-input"
              />
              <input
                type="number"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Preis in Coins..."
                className="w-full p-3.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:border-[#6c63ff] focus:outline-none"
                data-testid="item-price-input"
              />
              <button
                onClick={addItem}
                className="w-full py-3.5 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold transition-all"
                data-testid="add-item-btn"
              >
                Item listen
              </button>
            </div>

            <div className="mt-6 p-4 bg-black/20 rounded-xl">
              <p className="text-sm text-slate-400">
                💡 <strong>Tipp:</strong> Faire Preise führen zu schnelleren Verkäufen! 
                Der Durchschnittspreis für Items liegt bei 100-500 Coins.
              </p>
            </div>
          </div>
        )}

        {/* My Items Tab */}
        {activeTab === 'my' && (
          <div className="space-y-3">
            {myListings.length === 0 ? (
              <div className="text-center py-10">
                <span className="text-4xl block mb-3">📋</span>
                <p className="text-slate-500">Keine eigenen Listings</p>
                <button
                  onClick={() => setActiveTab('sell')}
                  className="mt-4 px-6 py-2 bg-[#6c63ff] rounded-xl text-sm"
                >
                  Erstes Item listen
                </button>
              </div>
            ) : (
              myListings.map((listing) => (
                <div 
                  key={listing.id}
                  className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{listing.icon || '📦'}</span>
                    <div>
                      <h3 className="font-semibold">{listing.title}</h3>
                      <p className="text-xs text-slate-400">Dein Listing</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-bold">{listing.price} 💰</p>
                    <button
                      onClick={() => removeListing(listing.id)}
                      className="mt-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm transition-all"
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link 
            to="/store"
            className="bg-white/5 p-4 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-all border border-white/5"
          >
            <span className="text-2xl">🛍️</span>
            <span className="text-sm">Store</span>
          </Link>
          <Link 
            to="/live-auction"
            className="bg-white/5 p-4 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-all border border-white/5"
          >
            <span className="text-2xl">🔥</span>
            <span className="text-sm">Auktionen</span>
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
