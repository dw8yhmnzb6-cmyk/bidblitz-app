/**
 * BidBlitz V2 - Marketplace Page
 * Like eBay Kleinanzeigen - Browse, Buy, Sell
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';
import KYCBanner from '../components/KYCBanner';
import { Search, Plus, Heart, MapPin, ChevronLeft, X, Send, Sparkles, Filter, Grid, List } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_ICONS = {
  electronics: '📱',
  fashion: '👕',
  home: '🏠',
  vehicles: '🚗',
  sports: '⚽',
  toys: '🧸',
  books: '📚',
  music: '🎸',
  garden: '🌱',
  pets: '🐕',
  services: '🔧',
  other: '📦',
};

export default function MarketplacePage({ onNavigate, routeParams = {} }) {
  const { t } = useI18n();
  
  // Navigation helper (replaces useNavigate)
  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };
  
  // State
  const [view, setView] = useState('browse'); // browse, detail, create, messages, my-listings
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  const [userBalance, setUserBalance] = useState(0);
  const [myListings, setMyListings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  
  // Create form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: 'other',
    location: '',
    negotiable: false,
    shipping_available: false,
    shipping_cost: '',
    images: [],
  });
  
  // Message state
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const openListingById = useCallback(async (listingId) => {
    if (!listingId) return;
    try {
      setView('detail');
      const res = await fetch(`${API}/api/marketplace/catalog/${listingId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelectedListing(data);
        setView('detail');
      }
    } catch (err) {
      void err;
    }
  }, []);

  // Fetch data
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/api/marketplace/list?sort=${sortBy}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, selectedCategory, searchQuery]);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUserBalance(data.balance || 0);
      }
    } catch (err) { void err; }
  };

  const fetchMyListings = async () => {
    try {
      const res = await fetch(`${API}/api/marketplace/dashboard/my-listings`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMyListings(data.listings || []);
      }
    } catch (err) { void err; }
  };

  const fetchFavorites = async () => {
    try {
      const res = await fetch(`${API}/api/marketplace/meta/favorites`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites?.map(f => f.listing_id) || []);
      }
    } catch (err) { void err; }
  };

  useEffect(() => {
    fetchListings();
    fetchUserData();
    fetchFavorites();
  }, [fetchListings]);

  useEffect(() => {
    if (view === 'my-listings') {
      fetchMyListings();
    }
  }, [view]);

  useEffect(() => {
    const listingId = routeParams?.listing_id || new URLSearchParams(window.location.search).get('listing_id');
    if (listingId && selectedListing?.listing_id !== listingId) {
      openListingById(listingId);
    }
  }, [openListingById, routeParams?.listing_id, selectedListing?.listing_id]);

  useEffect(() => {
    if (routeParams?.tab === 'my-listings') {
      setView('my-listings');
      return;
    }
    if (routeParams?.tab === 'create') {
      setView('create');
    }
  }, [routeParams?.tab]);

  // View listing detail
  const viewListing = async (listing) => {
    try {
      const res = await fetch(`${API}/api/marketplace/catalog/${listing.listing_id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelectedListing(data);
        setView('detail');
      }
    } catch (err) { void err; }
  };

  // Toggle favorite
  const toggleFavorite = async (listingId, e) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`${API}/api/marketplace/${listingId}/favorite`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.favorited) {
          setFavorites([...favorites, listingId]);
        } else {
          setFavorites(favorites.filter(id => id !== listingId));
        }
      }
    } catch (err) { void err; }
  };

  // Create listing
  const createListing = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/marketplace/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price),
          shipping_cost: form.shipping_available ? parseFloat(form.shipping_cost) : null,
        }),
      });
      if (res.ok) {
        setForm({ title: '', description: '', price: '', category: 'other', location: '', negotiable: false, shipping_available: false, shipping_cost: '', images: [] });
        setView('my-listings');
        fetchMyListings();
      }
    } catch (err) { void err; }
    setLoading(false);
  };

  // Buy item
  const buyItem = async () => {
    if (!selectedListing) return;
    
    if (userBalance < selectedListing.price) {
      alert(`Nicht genug Guthaben. Benötigt: €${selectedListing.price.toFixed(2)}`);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/marketplace/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listing_id: selectedListing.listing_id }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserBalance(data.new_balance);
        alert(data.message);
        setView('browse');
        fetchListings();
      } else {
        const err = await res.json();
        alert(err.detail || 'Fehler beim Kauf');
      }
    } catch (err) { void err; }
    setLoading(false);
  };

  // Contact seller
  const contactSeller = async () => {
    if (!selectedListing || !messageText.trim()) return;
    
    setSendingMessage(true);
    try {
      const res = await fetch(`${API}/api/marketplace/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listing_id: selectedListing.listing_id,
          message: messageText,
        }),
      });
      if (res.ok) {
        setMessageText('');
        alert('Nachricht gesendet!');
      }
    } catch (err) { void err; }
    setSendingMessage(false);
  };

  // Delete listing
  const deleteListing = async (listingId) => {
    if (!window.confirm('Anzeige wirklich löschen?')) return;
    try {
      const res = await fetch(`${API}/api/marketplace/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchMyListings();
      }
    } catch (err) { void err; }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => view === 'browse' ? navigate('/') : (view === 'detail' && routeParams?.listing_id ? navigate('/marketplace') : setView('browse'))} className="p-2 -ml-2 text-gray-400 hover:text-white" data-testid="marketplace-back-button">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Marketplace</h1>
            <div className="text-sm text-cyan-400 font-medium">€{userBalance.toFixed(2)}</div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {[
              { id: 'browse', label: 'Stöbern' },
              { id: 'my-listings', label: 'Meine' },
              { id: 'create', label: 'Verkaufen' },
              { id: 'dashboard', label: 'Dashboard' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.id === 'dashboard' ? navigate('/marketplace-dashboard?tab=flash-sales') : setView(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  view === tab.id || (tab.id === 'dashboard' && routeParams?.tab === 'flash-sales')
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                data-testid={`marketplace-tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="mb-3"><KYCBanner onNavigate={onNavigate} /></div>
        <AnimatePresence mode="wait">
          {/* BROWSE VIEW */}
          {view === 'browse' && (
            <motion.div
              key="browse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500"
                  />
                </div>
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="p-3 bg-[#111] border border-white/10 rounded-xl"
                >
                  {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
                </button>
              </div>

              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                    !selectedCategory ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400'
                  }`}
                >
                  Alle
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap flex items-center gap-1 ${
                      selectedCategory === cat.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {CATEGORY_ICONS[cat.id]} {cat.label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{listings.length} Anzeigen</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-sm text-gray-400 border-none"
                >
                  <option value="newest">Neueste</option>
                  <option value="price_low">Preis ↑</option>
                  <option value="price_high">Preis ↓</option>
                </select>
              </div>

              {/* Listings */}
              {loading ? (
                <div className="text-center py-12 text-gray-500">Laden...</div>
              ) : listings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🛒</div>
                  <p className="text-gray-400">Keine Anzeigen gefunden</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-3">
                  {listings.map((listing) => {
                    const hasBoost = listing.boost && listing.boost.expires_at > new Date().toISOString();
                    const isVip = listing.is_vip;
                    
                    return (
                      <motion.div
                        key={listing.listing_id}
                        onClick={() => viewListing(listing)}
                        className={`bg-[#111] rounded-xl overflow-hidden cursor-pointer transition-all ${
                          hasBoost 
                            ? 'border-2 border-yellow-500/50 shadow-[0_0_20px_rgba(255,200,0,0.15)]' 
                            : isVip 
                              ? 'border-2 border-[#FFD700]/40 shadow-[0_0_15px_rgba(255,215,0,0.1)]'
                              : 'border border-white/5 hover:border-cyan-500/30'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="aspect-square bg-[#1a1a1a] relative">
                          {listing.images?.[0] ? (
                            <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl">
                              {CATEGORY_ICONS[listing.category] || '📦'}
                            </div>
                          )}
                          {/* Boost Badge */}
                          {hasBoost && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded text-xs font-bold text-black flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> BOOST
                            </div>
                          )}
                          {/* VIP Badge */}
                          {isVip && !hasBoost && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded text-xs font-bold text-black flex items-center gap-1">
                              ⭐ VIP
                            </div>
                          )}
                          {/* Both badges */}
                          {hasBoost && isVip && (
                            <div className="absolute top-8 left-2 px-2 py-0.5 bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded text-xs font-bold text-black flex items-center gap-1">
                              ⭐ VIP
                            </div>
                          )}
                          <button
                            onClick={(e) => toggleFavorite(listing.listing_id, e)}
                            className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full"
                          >
                            <Heart className={`w-4 h-4 ${favorites.includes(listing.listing_id) ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                          </button>
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-sm truncate">{listing.title}</p>
                          <p className="text-cyan-400 font-bold">€{listing.price.toFixed(2)}</p>
                          {listing.location && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {listing.location}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {listings.map((listing) => (
                    <motion.div
                      key={listing.listing_id}
                      onClick={() => viewListing(listing)}
                      className="flex gap-3 bg-[#111] rounded-xl p-3 border border-white/5 cursor-pointer hover:border-cyan-500/30"
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="w-24 h-24 bg-[#1a1a1a] rounded-lg flex-shrink-0 flex items-center justify-center text-3xl">
                        {listing.images?.[0] ? (
                          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          CATEGORY_ICONS[listing.category] || '📦'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{listing.title}</p>
                        <p className="text-cyan-400 font-bold text-lg">€{listing.price.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{listing.description}</p>
                        {listing.location && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" /> {listing.location}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => toggleFavorite(listing.listing_id, e)}
                        className="p-2"
                      >
                        <Heart className={`w-5 h-5 ${favorites.includes(listing.listing_id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* DETAIL VIEW */}
          {view === 'detail' && selectedListing && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Image */}
              <div className="aspect-video bg-[#111] rounded-2xl flex items-center justify-center text-6xl">
                {selectedListing.images?.[0] ? (
                  <img src={selectedListing.images[0]} alt={selectedListing.title} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  CATEGORY_ICONS[selectedListing.category] || '📦'
                )}
              </div>

              {/* Info */}
              <div className="bg-[#111] rounded-2xl p-4 border border-white/5" data-testid="marketplace-detail-card">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold">{selectedListing.title}</h2>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">€{selectedListing.price.toFixed(2)}</p>
                    {selectedListing.negotiable && (
                      <span className="text-sm text-green-400">VB</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => toggleFavorite(selectedListing.listing_id, e)}
                    className="p-2 bg-white/5 rounded-full"
                  >
                    <Heart className={`w-6 h-6 ${favorites.includes(selectedListing.listing_id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <span className="px-2 py-1 bg-white/5 rounded text-xs">
                    {CATEGORY_ICONS[selectedListing.category]} {selectedListing.category_label}
                  </span>
                  {selectedListing.shipping_available && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                      📦 Versand möglich
                    </span>
                  )}
                </div>
                
                <p className="mt-4 text-gray-300 whitespace-pre-wrap">{selectedListing.description}</p>
                
                {selectedListing.location && (
                  <div className="flex items-center gap-2 mt-4 text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedListing.location}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center font-bold">
                    {selectedListing.seller?.name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-medium">{selectedListing.seller?.name || selectedListing.seller_name}</p>
                    <p className="text-xs text-gray-500">Mitglied seit {selectedListing.seller?.member_since?.split('T')[0]}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm text-gray-400">
                <span>👁 {selectedListing.views} Aufrufe</span>
                <span>❤️ {selectedListing.favorites} Favoriten</span>
              </div>

              {/* Contact Seller */}
              <div className="bg-[#111] rounded-2xl p-4 border border-white/5">
                <h3 className="font-semibold mb-3">Verkäufer kontaktieren</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nachricht schreiben..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="flex-1 px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl"
                  />
                  <button
                    onClick={contactSeller}
                    disabled={sendingMessage || !messageText.trim()}
                    className="p-3 bg-cyan-500 rounded-xl disabled:opacity-50"
                  >
                    <Send className="w-5 h-5 text-black" />
                  </button>
                </div>
              </div>

              {/* Buy Button */}
              <button
                onClick={buyItem}
                disabled={loading || selectedListing.status !== 'active'}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black text-lg disabled:opacity-50"
              >
                {selectedListing.status !== 'active' 
                  ? 'Nicht verfügbar'
                  : loading 
                    ? 'Wird gekauft...' 
                    : `Jetzt kaufen - €${selectedListing.price.toFixed(2)}`
                }
              </button>
            </motion.div>
          )}

          {/* CREATE VIEW */}
          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-bold">Anzeige erstellen</h2>
              
              <form onSubmit={createListing} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Titel *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Was verkaufst du?"
                    required
                    className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Beschreibung *</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Beschreibe deinen Artikel..."
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl resize-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Preis (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Kategorie</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl"
                    >
                      {Object.entries(CATEGORY_ICONS).map(([id, icon]) => (
                        <option key={id} value={id}>{icon} {id}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Standort</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="z.B. Berlin"
                    className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl"
                  />
                </div>
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.negotiable}
                      onChange={(e) => setForm({ ...form, negotiable: e.target.checked })}
                      className="w-5 h-5 rounded bg-[#111] border-white/10"
                    />
                    <span className="text-sm">Verhandelbar (VB)</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.shipping_available}
                      onChange={(e) => setForm({ ...form, shipping_available: e.target.checked })}
                      className="w-5 h-5 rounded bg-[#111] border-white/10"
                    />
                    <span className="text-sm">Versand möglich</span>
                  </label>
                </div>
                
                {form.shipping_available && (
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Versandkosten (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.shipping_cost}
                      onChange={(e) => setForm({ ...form, shipping_cost: e.target.value })}
                      className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl"
                    />
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black"
                >
                  {loading ? 'Wird erstellt...' : 'Anzeige erstellen'}
                </button>
              </form>
            </motion.div>
          )}

          {/* MY LISTINGS VIEW */}
          {view === 'my-listings' && (
            <motion.div
              key="my-listings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-bold">Meine Anzeigen</h2>
              
              {myListings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-gray-400">Noch keine Anzeigen</p>
                  <button
                    onClick={() => setView('create')}
                    className="mt-4 px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl"
                  >
                    Erste Anzeige erstellen
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myListings.map((listing) => (
                    <div
                      key={listing.listing_id}
                      className="flex gap-3 bg-[#111] rounded-xl p-3 border border-white/5"
                    >
                      <div className="w-20 h-20 bg-[#1a1a1a] rounded-lg flex-shrink-0 flex items-center justify-center text-2xl">
                        {CATEGORY_ICONS[listing.category] || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{listing.title}</p>
                        <p className="text-cyan-400 font-bold">€{listing.price.toFixed(2)}</p>
                        <div className="flex gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            listing.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            listing.status === 'sold' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {listing.status === 'active' ? 'Aktiv' : listing.status === 'sold' ? 'Verkauft' : 'Inaktiv'}
                          </span>
                          <span className="text-xs text-gray-500">👁 {listing.views}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteListing(listing.listing_id)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FAB - Create Listing */}
      {view === 'browse' && (
        <button
          onClick={() => setView('create')}
          className="fixed bottom-24 right-4 p-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full shadow-lg shadow-cyan-500/30"
        >
          <Plus className="w-6 h-6 text-black" />
        </button>
      )}
    </div>
  );
}
