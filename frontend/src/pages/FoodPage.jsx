import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';
import FoodFilters from '../components/FoodFilters';
import ReviewModal from '../components/ReviewModal';
import SplitPaymentModal from '../components/SplitPaymentModal';

const API = process.env.REACT_APP_BACKEND_URL;

const ORDER_STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-blue-500/20 text-blue-400',
  preparing: 'bg-orange-500/20 text-orange-400',
  picked_up: 'bg-cyan-500/20 text-cyan-400',
  delivered: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const ORDER_STATUS_LABELS = {
  pending: 'Warte auf Bestätigung',
  confirmed: 'Bestätigt',
  preparing: 'Wird zubereitet',
  picked_up: 'Unterwegs',
  delivered: 'Geliefert',
  cancelled: 'Storniert',
};

const ORDER_STATUS_ICONS = {
  pending: '⏳',
  confirmed: '✅',
  preparing: '👨‍🍳',
  picked_up: '🛵',
  delivered: '📦',
  cancelled: '❌',
};

export default function FoodPage({ onNavigate }) {
  const { t } = useI18n();
  
  // Navigation helper (replaces useNavigate)
  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };
  
  // State
  const [view, setView] = useState('restaurants'); // restaurants, restaurant, cart, checkout, tracking, orders
  const [restaurants, setRestaurants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [menuCat, setMenuCat] = useState("");
  const [stamps, setStamps] = useState(0);
  const [extrasModal, setExtrasModal] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);
  const [filterFree, setFilterFree] = useState(false);
  const [filterFast, setFilterFast] = useState(false);
  const [filterTop, setFilterTop] = useState(false);
  const [filterNew, setFilterNew] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userBalance, setUserBalance] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState({ street: '', city: '', zip: '', notes: '' });
  
  // Polling ref
  const pollingRef = React.useRef(null);

  useEffect(() => {
    fetchUserData();
    fetchCategories();
    fetchRestaurants();
    checkActiveOrder();
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUserBalance(data.balance || 0);
      }
    } catch (err) {}
  };


  // Re-fetch when filters change
  useEffect(() => { fetchRestaurants(selectedCategory, searchQuery); }, [filterFree, filterFast, filterTop, filterNew]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API}/api/food/categories`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {}
  };

  const fetchRestaurants = async (category = '', search = '') => {
    setLoading(true);
    try {
      // Use filtered endpoint if any filter is active
      const hasFilters = filterFree || filterFast || filterTop || filterNew;
      let url;
      if (hasFilters) {
        url = `${API}/api/food/filtered?`;
        if (filterFree) url += `free_delivery=true&`;
        if (filterFast) url += `fast=true&`;
        if (filterTop) url += `top_rated=true&`;
        if (filterNew) url += `is_new=true&`;
        if (category) url += `category=${category}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;
      } else {
        url = `${API}/api/food/restaurants?limit=30`;
        if (category) url += `&category=${category}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
      }
      
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data.restaurants || []);
      }
    } catch (err) {
      setError('Fehler beim Laden der Restaurants');
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantDetails = async (restaurantId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/food/restaurant/${restaurantId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelectedRestaurant(data.restaurant);
        setView('restaurant');
      }
    } catch (err) {
      setError('Restaurant nicht gefunden');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveOrder = async () => {
    try {
      const res = await fetch(`${API}/api/food/active`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.has_active_order && data.order) {
          setActiveOrder(data.order);
          setView('tracking');
          startOrderPolling(data.order.order_id);
        }
      }
    } catch (err) {}
  };

  const startOrderPolling = (orderId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/food/order/${orderId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setActiveOrder(data.order);
          if (['delivered', 'cancelled'].includes(data.order.status)) {
            clearInterval(pollingRef.current);
            fetchUserData();
          }
        }
      } catch (err) {}
    }, 5000);
  };

  // Cart functions
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.item_id === item.id);
      if (existing) {
        return prev.map(i => i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(i => i.item_id !== itemId));
  };

  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.item_id === itemId) {
        const newQty = Math.max(0, i.quantity + delta);
        return newQty === 0 ? null : { ...i, quantity: newQty };
      }
      return i;
    }).filter(Boolean));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = selectedRestaurant?.delivery_fee || 1.99;
  const serviceFee = cartTotal * 0.10;
  const smallOrderFee = cartTotal < 15 ? 2.00 : 0;
  const orderTotal = cartTotal + deliveryFee + serviceFee + smallOrderFee;

  // Place order
  const placeOrder = async () => {
    if (cart.length === 0 || !selectedRestaurant) return;
    
    if (!deliveryAddress.street || !deliveryAddress.city) {
      setError('Bitte Lieferadresse eingeben');
      return;
    }
    
    if (userBalance < orderTotal) {
      setError(`Nicht genug Guthaben. Benötigt: €${orderTotal.toFixed(2)}, Verfügbar: €${userBalance.toFixed(2)}. Bitte lade dein Wallet auf.`);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/api/food/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          restaurant_id: selectedRestaurant.restaurant_id,
          items: cart.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
          delivery_address: deliveryAddress,
          payment_method: 'wallet',
          tip: 0,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setActiveOrder(data.order);
        setCart([]);
        setView('tracking');
        setUserBalance(prev => prev - orderTotal);
        startOrderPolling(data.order.order_id);
      } else {
        const err = await res.json();
        setError(err.detail || 'Bestellung fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Cancel order
  const cancelOrder = async () => {
    if (!activeOrder) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/food/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order_id: activeOrder.order_id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (pollingRef.current) clearInterval(pollingRef.current);
        setActiveOrder(null);
        setView('restaurants');
        setUserBalance(data.new_balance);
      } else {
        const err = await res.json();
        setError(err.detail || 'Stornierung nicht möglich');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Confirm delivery
  const confirmDelivery = async () => {
    if (!activeOrder) return;
    
    try {
      const res = await fetch(`${API}/api/food/delivered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order_id: activeOrder.order_id }),
      });
      
      if (res.ok) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setActiveOrder(null);
        setView('restaurants');
      }
    } catch (err) {}
  };

  // Fetch order history
  const fetchOrderHistory = async () => {
    try {
      const res = await fetch(`${API}/api/food/orders`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrderHistory(data.orders || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (view === 'orders') fetchOrderHistory();
  }, [view]);

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => {
                if (view === 'restaurant') setView('restaurants');
                else if (view === 'cart' || view === 'checkout') setView('restaurant');
                else navigate('/');
              }} 
              className="p-2 -ml-2 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">BidBlitz Food</h1>
            <div className="flex items-center gap-3">
              {cart.length > 0 && view !== 'cart' && view !== 'checkout' && (
                <button
                  onClick={() => setView('cart')}
                  className="relative p-2 bg-orange-500/20 rounded-full"
                >
                  <span className="text-lg">🛒</span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-xs font-bold flex items-center justify-center text-black">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                </button>
              )}
              <div className="text-sm text-orange-400 font-medium">€{userBalance.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* RESTAURANTS LIST */}
          {view === 'restaurants' && (
            <motion.div
              key="restaurants"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Restaurant oder Küche suchen..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    fetchRestaurants(selectedCategory, e.target.value);
                  }}
                  className="w-full pl-12 pr-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
              </div>

              {/* Quick Filters — Lieferando Style */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {[
                  { id: "free", label: "Gratis Lieferung", icon: "🚚", active: filterFree },
                  { id: "fast", label: "Unter 30 Min", icon: "⚡", active: filterFast },
                  { id: "top", label: "Top Bewertet", icon: "⭐", active: filterTop },
                  { id: "new", label: "Neu", icon: "🆕", active: filterNew },
                ].map(f => (
                  <button key={f.id}
                    onClick={() => {
                      if (f.id === "free") setFilterFree(!f.active);
                      if (f.id === "fast") setFilterFast(!f.active);
                      if (f.id === "top") setFilterTop(!f.active);
                      if (f.id === "new") setFilterNew(!f.active);
                    }}
                    className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${f.active ? "bg-orange-500 text-black" : "bg-white/5 text-gray-400 border border-white/10"}`}>
                    <span>{f.icon}</span>{f.label}
                  </button>
                ))}
                <button
                  data-testid="food-adv-filters-btn"
                  onClick={() => setShowAdvFilters(true)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${advFilters && (advFilters.cuisine?.length || advFilters.dietary?.length || advFilters.rating_min) ? "bg-[#00C2FF] text-white" : "bg-white/5 text-gray-400 border border-white/10"}`}
                >
                  <span>🎚️</span>Mehr Filter
                </button>
              </div>

              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                <button
                  onClick={() => { setSelectedCategory(''); fetchRestaurants('', searchQuery); }}
                  className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                    !selectedCategory ? 'bg-orange-500 text-black' : 'bg-white/10 text-gray-400'
                  }`}
                >
                  Alle
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); fetchRestaurants(cat.id, searchQuery); }}
                    className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                      selectedCategory === cat.id ? 'bg-orange-500 text-black' : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Restaurant List */}
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-12 text-gray-500">Lädt Restaurants...</div>
                ) : restaurants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 mb-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <span className="text-4xl">🍽️</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Keine Restaurants</h3>
                    <p className="text-gray-400 text-sm max-w-xs mb-4">
                      {searchQuery || selectedCategory 
                        ? 'Keine Restaurants für diese Suche gefunden. Versuche andere Filter.'
                        : 'Derzeit sind keine Restaurants in deiner Nähe verfügbar. Schau später nochmal vorbei!'}
                    </p>
                    {(searchQuery || selectedCategory) && (
                      <button
                        onClick={() => { setSearchQuery(''); setSelectedCategory(''); fetchRestaurants(); }}
                        className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium"
                      >
                        Filter zurücksetzen
                      </button>
                    )}
                  </div>
                ) : (
                  restaurants.map((restaurant) => (
                    <motion.button
                      key={restaurant.restaurant_id}
                      onClick={() => fetchRestaurantDetails(restaurant.restaurant_id)}
                      className="w-full bg-[#111] rounded-2xl border border-white/10 overflow-hidden text-left hover:border-orange-500/30 transition-all"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="h-32 bg-gray-800 relative">
                        <img
                          src={restaurant.image}
                          alt={restaurant.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Restaurant'; }}
                        />
                        {!restaurant.is_open && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-red-400 font-bold">Geschlossen</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg">{restaurant.name}</h3>
                            <p className="text-sm text-gray-400 mt-1">
                              {'€'.repeat(restaurant.price_level || 2)} • {restaurant.delivery_time} Min
                            </p>
                          </div>
                          <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-lg">
                            <span className="text-yellow-400">★</span>
                            <span className="text-green-400 font-medium">{restaurant.rating}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(restaurant.free_delivery || restaurant.delivery_fee === 0) ? (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">Gratis Lieferung</span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">€{(restaurant.delivery_fee || 1.99).toFixed(2)} Lieferung</span>
                          )}
                          {restaurant.price_guarantee && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">Preis-Garantie</span>
                          )}
                          {restaurant.is_new && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold">NEU</span>
                          )}
                          {restaurant.stamps_enabled && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">🎟️ Stempelkarte</span>
                          )}
                          {restaurant.min_order && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">Min. €{restaurant.min_order}</span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))
                )}
              </div>

              {/* Active Order Banner */}
              {activeOrder && (
                <button
                  onClick={() => setView('tracking')}
                  className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto p-4 bg-orange-500 rounded-2xl text-black font-bold flex items-center justify-between shadow-2xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ORDER_STATUS_ICONS[activeOrder.status]}</span>
                    <span>Bestellung läuft</span>
                  </div>
                  <span>Anzeigen →</span>
                </button>
              )}

              {/* Orders History Button */}
              <button
                onClick={() => setView('orders')}
                className="w-full py-3 bg-white/5 rounded-xl text-gray-400 hover:bg-white/10"
              >
                📋 Bestellverlauf
              </button>
            </motion.div>
          )}

          {/* RESTAURANT DETAIL */}
          {view === 'restaurant' && selectedRestaurant && (
            <motion.div
              key="restaurant"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Restaurant Header */}
              <div className="-mx-4 -mt-6">
                <div className="h-48 bg-gray-800 relative">
                  <img
                    src={selectedRestaurant.image}
                    alt={selectedRestaurant.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                </div>
                <div className="px-4 -mt-12 relative z-10">
                  <h2 className="text-2xl font-bold">{selectedRestaurant.name}</h2>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      {selectedRestaurant.rating}
                    </span>
                    <span>•</span>
                    <span>{selectedRestaurant.delivery_time} Min</span>
                    <span>•</span>
                    <span>Min. €{(selectedRestaurant.min_order || 10).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Menu Categories Tabs */}
              {selectedRestaurant.menu_categories?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  <button onClick={() => setMenuCat("")} className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold ${!menuCat ? "bg-orange-500 text-black" : "bg-white/5 text-gray-400"}`}>Alle</button>
                  {selectedRestaurant.menu_categories.map(c => (
                    <button key={c.id} onClick={() => setMenuCat(c.id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold ${menuCat === c.id ? "bg-orange-500 text-black" : "bg-white/5 text-gray-400"}`}>{c.name}</button>
                  ))}
                </div>
              )}

              {/* Stamps/Loyalty Banner */}
              {selectedRestaurant.stamps_enabled && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
                  <span className="text-xl">🎟️</span>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-orange-400">Treuekarte aktiv</p>
                    <p className="text-[9px] text-gray-500">{selectedRestaurant.stamps_needed}x bestellen = Gratis-Essen!</p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array(selectedRestaurant.stamps_needed || 10).fill(0).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < (stamps || 0) ? "bg-orange-500" : "bg-white/10"}`} />
                    ))}
                  </div>
                </div>
              )}

              {/* Menu */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-300">Speisekarte</h3>
                
                {(selectedRestaurant.menu || []).filter(item => !menuCat || item.category === menuCat).map((item) => {
                  // Generate food image based on item name
                  const getFoodImage = (name) => {
                    const n = name.toLowerCase();
                    if (n.includes('döner') || n.includes('doner')) return 'https://images.unsplash.com/photo-1633321702518-7feccafb94d5?w=200&h=200&fit=crop';
                    if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop';
                    if (n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop';
                    if (n.includes('pasta') || n.includes('spaghetti')) return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=200&h=200&fit=crop';
                    if (n.includes('salat') || n.includes('salad')) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop';
                    if (n.includes('lahmacun')) return 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=200&h=200&fit=crop';
                    if (n.includes('pommes') || n.includes('fries')) return 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&h=200&fit=crop';
                    if (n.includes('kebab') || n.includes('grill')) return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=200&fit=crop';
                    if (n.includes('wrap')) return 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=200&h=200&fit=crop';
                    if (n.includes('box') || n.includes('teller')) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop';
                    if (n.includes('suppe') || n.includes('soup')) return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&h=200&fit=crop';
                    if (n.includes('falafel')) return 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb5?w=200&h=200&fit=crop';
                    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop';
                  };
                  
                  return (
                    <div
                      key={item.id}
                      className="p-4 bg-[#111] rounded-xl border border-white/10 flex items-center gap-4"
                    >
                      {/* Food Image */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800">
                        <img
                          src={item.image || getFoodImage(item.name)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop'; }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                        <p className="text-orange-400 font-bold mt-2">€{item.price.toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => {
                          if ((item.extras?.length > 0) || (item.sizes?.length > 0)) {
                            setExtrasModal(item);
                            setSelectedExtras([]);
                            setSelectedSize(item.sizes?.[0] || null);
                          } else {
                            addToCart(item);
                          }
                        }}
                        className="ml-2 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-black font-bold text-xl flex-shrink-0 hover:bg-orange-400 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Extras Modal */}
              <AnimatePresence>
                {extrasModal && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={() => setExtrasModal(null)}>
                    <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="w-full bg-[#111] rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                      <h3 className="text-lg font-bold mb-1">{extrasModal.name}</h3>
                      <p className="text-sm text-gray-400 mb-4">{extrasModal.description}</p>
                      
                      {extrasModal.sizes?.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 font-bold mb-2">Größe wählen</p>
                          <div className="space-y-1.5">
                            {extrasModal.sizes.map(s => (
                              <button key={s.id} onClick={() => setSelectedSize(s)}
                                className={`w-full p-3 rounded-xl flex justify-between text-sm ${selectedSize?.id === s.id ? "bg-orange-500/20 border border-orange-500/30 text-orange-400" : "bg-white/5 border border-white/5 text-gray-400"}`}>
                                <span>{s.name}</span>
                                <span>{s.price > 0 ? `+€${s.price.toFixed(2)}` : "Inkl."}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {extrasModal.extras?.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 font-bold mb-2">Extras</p>
                          <div className="space-y-1.5">
                            {extrasModal.extras.map(e => {
                              const isSelected = selectedExtras.some(se => se.id === e.id);
                              return (
                                <button key={e.id} onClick={() => setSelectedExtras(prev => isSelected ? prev.filter(x => x.id !== e.id) : [...prev, e])}
                                  className={`w-full p-3 rounded-xl flex justify-between text-sm ${isSelected ? "bg-orange-500/20 border border-orange-500/30 text-orange-400" : "bg-white/5 border border-white/5 text-gray-400"}`}>
                                  <span>{isSelected ? "✓ " : ""}{e.name}</span>
                                  <span>+€{e.price.toFixed(2)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {(() => {
                        const base = extrasModal.price;
                        const sizeExtra = selectedSize?.price || 0;
                        const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0);
                        const total = base + sizeExtra + extrasTotal;
                        return (
                          <button onClick={() => {
                            addToCart({ ...extrasModal, price: total, extras_detail: selectedExtras.map(e => e.name).join(", "), size_detail: selectedSize?.name || "" });
                            setExtrasModal(null);
                          }} className="w-full py-4 bg-orange-500 rounded-xl font-bold text-black">
                            In den Warenkorb · €{total.toFixed(2)}
                          </button>
                        );
                      })()}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cart Preview */}
              {cart.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto"
                >
                  <button
                    onClick={() => setView('cart')}
                    className="w-full p-4 bg-orange-500 rounded-2xl text-black font-bold flex items-center justify-between shadow-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-black/20 rounded-full flex items-center justify-center">
                        {cart.reduce((sum, i) => sum + i.quantity, 0)}
                      </span>
                      <span>Warenkorb ansehen</span>
                    </div>
                    <span>€{cartTotal.toFixed(2)}</span>
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* CART */}
          {view === 'cart' && (
            <motion.div
              key="cart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold">Warenkorb</h2>
              
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🛒</div>
                  <p className="text-gray-400">Dein Warenkorb ist leer</p>
                </div>
              ) : (
                <>
                  {/* Items */}
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.item_id}
                        className="p-4 bg-[#111] rounded-xl border border-white/10 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-orange-400 font-bold">€{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateQuantity(item.item_id, -1)}
                            className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.item_id, 1)}
                            className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-black"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-[#111] rounded-xl border border-white/10 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Zwischensumme</span>
                      <span>€{cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Liefergebühr</span>
                      <span>€{deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Servicegebühr (10%)</span>
                      <span>€{serviceFee.toFixed(2)}</span>
                    </div>
                    {smallOrderFee > 0 && (
                      <div className="flex justify-between text-sm text-yellow-400">
                        <span>Kleinbestellgebühr</span>
                        <span>€{smallOrderFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-3 border-t border-white/10">
                      <span>Gesamt</span>
                      <span className="text-orange-400">€{orderTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setView('checkout')}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl font-bold text-black text-lg"
                  >
                    Zur Kasse (€{orderTotal.toFixed(2)})
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* CHECKOUT */}
          {view === 'checkout' && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold">Lieferadresse</h2>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Straße & Hausnummer"
                  value={deliveryAddress.street}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, street: e.target.value }))}
                  className="w-full px-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="PLZ"
                    value={deliveryAddress.zip}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, zip: e.target.value }))}
                    className="px-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Stadt"
                    value={deliveryAddress.city}
                    onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                    className="px-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Lieferhinweise (optional)"
                  value={deliveryAddress.notes}
                  onChange={(e) => setDeliveryAddress(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-orange-500/50 focus:outline-none"
                />
              </div>

              {/* Payment - Wallet Only */}
              <div className={`p-4 rounded-xl border ${
                userBalance >= orderTotal 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <p className="text-gray-400 text-sm mb-2">Zahlungsmethode</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💳</span>
                    <div>
                      <span className="font-medium">BidBlitz Wallet</span>
                      <p className="text-xs text-gray-500">Nur Wallet-Zahlung möglich</p>
                    </div>
                  </div>
                  <span className={`font-bold ${userBalance >= orderTotal ? 'text-green-400' : 'text-red-400'}`}>
                    €{userBalance.toFixed(2)}
                  </span>
                </div>
                {userBalance < orderTotal && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-red-400 text-sm mb-2">
                      Du brauchst noch €{(orderTotal - userBalance).toFixed(2)} mehr
                    </p>
                    <button
                      onClick={() => navigate('/wallet')}
                      className="w-full py-2 bg-orange-500 text-black font-semibold rounded-lg"
                    >
                      Wallet aufladen
                    </button>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="p-4 bg-[#111] rounded-xl border border-white/10">
                <p className="font-semibold mb-3">{selectedRestaurant?.name}</p>
                <div className="space-y-2 text-sm">
                  {cart.map(item => (
                    <div key={item.item_id} className="flex justify-between text-gray-400">
                      <span>{item.quantity}x {item.name}</span>
                      <span>€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between font-bold">
                  <span>Gesamt</span>
                  <span className="text-orange-400">€{orderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Promo Code */}
              <div className="p-4 bg-[#111] rounded-2xl border border-white/10">
                <p className="text-xs text-gray-500 font-bold mb-2">Gutschein-Code</p>
                <div className="flex gap-2">
                  <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="WELCOME10" disabled={!!promoApplied}
                    className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none font-mono tracking-wider placeholder-gray-600 disabled:opacity-50" />
                  <button onClick={async () => {
                    if (promoApplied) { setPromoApplied(null); setPromoCode(""); return; }
                    try {
                      const r = await fetch(`${API}/api/extras/promo/redeem`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoCode }) });
                      const d = await r.json();
                      if (r.ok) { setPromoApplied({ code: promoCode, benefit: d.benefit }); setError(""); }
                      else setError(d.detail || "Code ungültig");
                    } catch { setError("Netzwerkfehler"); }
                  }} className={`px-4 py-2.5 rounded-xl font-bold text-sm ${promoApplied ? "bg-red-500/20 text-red-400 border border-red-500/20" : "bg-green-500/20 text-green-400 border border-green-500/20"}`}>
                    {promoApplied ? "Entfernen" : "Einlösen"}
                  </button>
                </div>
                {promoApplied && <p className="text-[10px] text-green-400 mt-1.5">✓ {promoApplied.code}: +€{promoApplied.benefit?.toFixed(2)} Guthaben!</p>}
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center">
                  {error}
                </div>
              )}

              {/* Place Order Button */}
              <button
                onClick={placeOrder}
                disabled={loading || userBalance < orderTotal}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl font-bold text-black text-lg disabled:opacity-50"
              >
                {loading ? 'Wird bestellt...' : userBalance < orderTotal ? 'Nicht genug Guthaben' : 'Jetzt bestellen'}
              </button>

              {/* Split Payment Button */}
              <button
                data-testid="food-split-pay-btn"
                onClick={() => {
                  setSplitOrderId(activeOrder?.order_id || `cart_${Date.now()}`);
                  setSplitTotal(orderTotal);
                  setShowSplit(true);
                }}
                className="w-full py-3 bg-[#121218] border border-[#00C2FF]/40 text-[#00C2FF] rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              >
                👥 Mit Freunden teilen (Split Pay)
              </button>
            </motion.div>
          )}

          {/* ORDER TRACKING */}
          {view === 'tracking' && activeOrder && (
            <motion.div
              key="tracking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Status */}
              <div className="text-center">
                <div className="text-6xl mb-4">{ORDER_STATUS_ICONS[activeOrder.status]}</div>
                <h2 className="text-xl font-bold">{ORDER_STATUS_LABELS[activeOrder.status]}</h2>
                <p className="text-gray-400 mt-2">
                  {activeOrder.status === 'pending' && 'Restaurant prüft deine Bestellung...'}
                  {activeOrder.status === 'confirmed' && 'Deine Bestellung wird vorbereitet'}
                  {activeOrder.status === 'preparing' && 'Koch bei der Arbeit!'}
                  {activeOrder.status === 'picked_up' && 'Fahrer ist unterwegs zu dir'}
                  {activeOrder.status === 'delivered' && 'Guten Appetit!'}
                </p>
              </div>

              {/* Progress */}
              <div className="flex items-center justify-between px-4">
                {['confirmed', 'preparing', 'picked_up', 'delivered'].map((status, idx) => (
                  <React.Fragment key={status}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      ['confirmed', 'preparing', 'picked_up', 'delivered'].indexOf(activeOrder.status) >= idx
                        ? 'bg-orange-500 text-black'
                        : 'bg-white/10 text-gray-500'
                    }`}>
                      {idx + 1}
                    </div>
                    {idx < 3 && (
                      <div className={`flex-1 h-1 mx-2 ${
                        ['confirmed', 'preparing', 'picked_up', 'delivered'].indexOf(activeOrder.status) > idx
                          ? 'bg-orange-500'
                          : 'bg-white/10'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* ETA */}
              {activeOrder.estimated_delivery && !['delivered', 'cancelled'].includes(activeOrder.status) && (
                <div className="p-4 bg-[#111] rounded-xl border border-white/10 text-center">
                  <p className="text-gray-400 text-sm">Geschätzte Lieferzeit</p>
                  <p className="text-2xl font-bold mt-1">
                    {new Date(activeOrder.estimated_delivery).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}

              {/* Courier Info */}
              {activeOrder.courier && (
                <div className="p-4 bg-[#111] rounded-xl border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center text-2xl">
                      🛵
                    </div>
                    <div>
                      <p className="font-semibold">{activeOrder.courier.name}</p>
                      <p className="text-sm text-gray-400">{activeOrder.courier.vehicle}</p>
                    </div>
                    <a href={`tel:${activeOrder.courier.phone}`} className="ml-auto p-3 bg-green-500/20 rounded-full text-green-400">
                      📞
                    </a>
                  </div>
                </div>
              )}

              {/* Order Details */}
              <div className="p-4 bg-[#111] rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={activeOrder.restaurant_image}
                    alt={activeOrder.restaurant_name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div>
                    <p className="font-semibold">{activeOrder.restaurant_name}</p>
                    <p className="text-sm text-gray-400">{activeOrder.items?.length} Artikel</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm border-t border-white/10 pt-4">
                  {(activeOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-gray-400">
                      <span>{item.quantity}x {item.name}</span>
                      <span>€{item.total?.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-2 border-t border-white/10">
                    <span>Gesamt</span>
                    <span className="text-orange-400">€{activeOrder.total?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {activeOrder.status === 'picked_up' && (
                <button
                  onClick={confirmDelivery}
                  className="w-full py-4 bg-green-500 rounded-xl font-bold text-black"
                >
                  ✅ Lieferung bestätigen
                </button>
              )}
              
              {['pending', 'confirmed'].includes(activeOrder.status) && (
                <button
                  onClick={cancelOrder}
                  disabled={loading}
                  className="w-full py-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-semibold"
                >
                  {loading ? 'Wird storniert...' : 'Bestellung stornieren'}
                </button>
              )}

              {activeOrder.status === 'delivered' && (
                <button
                  onClick={() => { setActiveOrder(null); setView('restaurants'); }}
                  className="w-full py-4 bg-orange-500 rounded-xl font-bold text-black"
                >
                  Neue Bestellung
                </button>
              )}
            </motion.div>
          )}

          {/* ORDER HISTORY */}
          {view === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-bold">Bestellverlauf</h2>
              
              {orderHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-gray-400">Noch keine Bestellungen</p>
                </div>
              ) : (
                orderHistory.map((order) => (
                  <div
                    key={order.order_id}
                    className="p-4 bg-[#111] rounded-xl border border-white/10"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={order.restaurant_image}
                        alt={order.restaurant_name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-semibold">{order.restaurant_name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <span className="text-sm text-gray-400">
                        {order.items?.length || 0} Artikel
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-orange-400">€{order.total?.toFixed(2)}</span>
                        {order.status === 'delivered' && (
                          <button
                            data-testid={`food-review-btn-${order.order_id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewTarget({ service_type: 'food', service_id: order.order_id });
                              setShowReview(true);
                            }}
                            className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold"
                          >⭐ Bewerten</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Super-App Modals */}
      <AnimatePresence>
        {showAdvFilters && (
          <FoodFilters
            onApply={(f) => {
              setAdvFilters(f);
              setShowAdvFilters(false);
              fetchRestaurants(selectedCategory, searchQuery);
            }}
            onClose={() => setShowAdvFilters(false)}
          />
        )}
      </AnimatePresence>
      <ReviewModal
        isOpen={showReview}
        onClose={() => setShowReview(false)}
        serviceType={reviewTarget?.service_type}
        serviceId={reviewTarget?.service_id}
        onSubmit={() => fetchOrderHistory()}
      />
      <SplitPaymentModal
        isOpen={showSplit}
        onClose={() => setShowSplit(false)}
        type="food"
        itemId={splitOrderId}
        totalAmount={splitTotal}
      />
    </div>
  );
}
