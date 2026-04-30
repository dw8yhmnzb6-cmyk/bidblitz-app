import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';
import FoodFilters from '../components/FoodFilters';
import ReviewModal from '../components/ReviewModal';
import SplitPaymentModal from '../components/SplitPaymentModal';
import GroupOrderModal from '../components/GroupOrderModal';
import GroupTrackerBanner from '../components/GroupTrackerBanner';

import RestaurantListView from '../components/food/RestaurantListView';
import RestaurantDetailView from '../components/food/RestaurantDetailView';
import MenuItemExtrasModal from '../components/food/MenuItemExtrasModal';
import CartView from '../components/food/CartView';
import CheckoutView from '../components/food/CheckoutView';
import OrderTrackingView from '../components/food/OrderTrackingView';
import OrderHistoryView from '../components/food/OrderHistoryView';

const API = process.env.REACT_APP_BACKEND_URL;

export default function FoodPage({ onNavigate }) {
  useI18n();

  const navigate = (path) => { if (onNavigate) onNavigate(path); };

  // View state
  const [view, setView] = useState('restaurants');

  // Data
  const [restaurants, setRestaurants] = useState([]);
  const [, setCategories] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);

  // Filters
  const [selectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFree, setFilterFree] = useState(false);
  const [filterTop, setFilterTop] = useState(false);
  const [filterFast] = useState(false);
  const [filterNew] = useState(false);

  // Cart / address
  const [userAddress] = useState('Barmer Straße 45');
  const [deliveryMode, setDeliveryMode] = useState('delivery');
  const [cart, setCart] = useState([]);
  const [menuCat, setMenuCat] = useState('');
  const [stamps] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState({ street: '', city: '', zip: '', notes: '' });

  // Extras modal
  const [extrasModal, setExtrasModal] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);

  // Promo
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);

  // Misc
  const [userBalance, setUserBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Super-app modals
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [showSplit, setShowSplit] = useState(false);
  const [splitOrderId, setSplitOrderId] = useState(null);
  const [splitTotal, setSplitTotal] = useState(0);
  const [showGroupOrder, setShowGroupOrder] = useState(false);

  const pollingRef = useRef(null);

  // Derived
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = selectedRestaurant?.delivery_fee || 1.99;
  const serviceFee = cartTotal * 0.10;
  const smallOrderFee = cartTotal < 15 ? 2.00 : 0;
  const orderTotal = cartTotal + deliveryFee + serviceFee + smallOrderFee;

  useEffect(() => {
    fetchUserData();
    fetchCategories();
    fetchRestaurants();
    checkActiveOrder();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchRestaurants(selectedCategory, searchQuery); /* eslint-disable-next-line */ }, [filterFree, filterFast, filterTop, filterNew]);

  useEffect(() => { if (view === 'orders') fetchOrderHistory(); /* eslint-disable-next-line */ }, [view]);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setUserBalance(d.balance || 0);
      }
    } catch {}
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API}/api/food/categories`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setCategories(d.categories || []);
      }
    } catch {}
  };

  const fetchRestaurants = async (category = '', search = '') => {
    setLoading(true);
    try {
      const hasFilters = filterFree || filterFast || filterTop || filterNew;
      let url;
      if (hasFilters) {
        url = `${API}/api/food/filtered?`;
        if (filterFree) url += 'free_delivery=true&';
        if (filterFast) url += 'fast=true&';
        if (filterTop) url += 'top_rated=true&';
        if (filterNew) url += 'is_new=true&';
        if (category) url += `category=${category}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;
      } else {
        url = `${API}/api/food/restaurants?limit=30`;
        if (category) url += `&category=${category}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setRestaurants(d.restaurants || []);
      }
    } catch {
      setError('Fehler beim Laden der Restaurants');
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantDetails = async (rid) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/food/restaurant/${rid}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setSelectedRestaurant(d.restaurant);
        setView('restaurant');
      }
    } catch {
      setError('Restaurant nicht gefunden');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveOrder = async () => {
    try {
      const res = await fetch(`${API}/api/food/active`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        if (d.has_active_order && d.order) {
          setActiveOrder(d.order);
          setView('tracking');
          startOrderPolling(d.order.order_id);
        }
      }
    } catch {}
  };

  const startOrderPolling = (orderId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/food/order/${orderId}`, { credentials: 'include' });
        if (res.ok) {
          const d = await res.json();
          setActiveOrder(d.order);
          if (['delivered', 'cancelled'].includes(d.order.status)) {
            clearInterval(pollingRef.current);
            fetchUserData();
          }
        }
      } catch {}
    }, 5000);
  };

  // Cart
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_id === item.id);
      if (existing) return prev.map((i) => (i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { item_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.item_id === itemId) {
            const q = Math.max(0, i.quantity + delta);
            return q === 0 ? null : { ...i, quantity: q };
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  // Orders
  const placeOrder = async () => {
    if (cart.length === 0 || !selectedRestaurant) return;
    if (!deliveryAddress.street || !deliveryAddress.city) {
      setError('Bitte Lieferadresse eingeben');
      return;
    }
    if (userBalance < orderTotal) {
      setError(`Nicht genug Guthaben. Benötigt: €${orderTotal.toFixed(2)}, Verfügbar: €${userBalance.toFixed(2)}.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/food/order`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: selectedRestaurant.restaurant_id,
          items: cart.map((i) => ({ item_id: i.item_id, quantity: i.quantity })),
          delivery_address: deliveryAddress,
          payment_method: 'wallet',
          tip: 0,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setActiveOrder(d.order);
        setCart([]);
        setView('tracking');
        setUserBalance((p) => p - orderTotal);
        startOrderPolling(d.order.order_id);
      } else {
        const e = await res.json();
        setError(e.detail || 'Bestellung fehlgeschlagen');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async () => {
    if (!activeOrder) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/food/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: activeOrder.order_id }),
      });
      if (res.ok) {
        const d = await res.json();
        if (pollingRef.current) clearInterval(pollingRef.current);
        setActiveOrder(null);
        setView('restaurants');
        setUserBalance(d.new_balance);
      } else {
        const e = await res.json();
        setError(e.detail || 'Stornierung nicht möglich');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelivery = async () => {
    if (!activeOrder) return;
    try {
      const res = await fetch(`${API}/api/food/delivered`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: activeOrder.order_id }),
      });
      if (res.ok) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setActiveOrder(null);
        setView('restaurants');
      }
    } catch {}
  };

  const fetchOrderHistory = async () => {
    try {
      const res = await fetch(`${API}/api/food/orders`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setOrderHistory(d.orders || []);
      }
    } catch {}
  };

  // Extras modal handlers
  const openExtras = (item) => {
    setExtrasModal(item);
    setSelectedExtras([]);
    setSelectedSize(item.sizes?.[0] || null);
  };

  const confirmExtras = (total) => {
    addToCart({
      ...extrasModal,
      price: total,
      extras_detail: selectedExtras.map((e) => e.name).join(', '),
      size_detail: selectedSize?.name || '',
    });
    setExtrasModal(null);
  };

  const toggleExtra = (e) => {
    setSelectedExtras((prev) =>
      prev.some((se) => se.id === e.id) ? prev.filter((x) => x.id !== e.id) : [...prev, e]
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="food-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
              <span className="font-bold text-white text-lg">{userAddress}</span>
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeliveryMode(deliveryMode === 'delivery' ? 'pickup' : 'delivery')}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm transition-colors ${
                  deliveryMode === 'delivery' ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-white/60'
                }`}
              >
                <span className="text-lg">🚴</span>
                <span>Lieferung</span>
              </button>
              <button
                data-testid="food-cart-icon"
                onClick={() => setView('cart')}
                className="relative p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <span className="text-xl">🛒</span>
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <GroupTrackerBanner serviceType="food" onOpenGroup={() => setShowGroupOrder(true)} />

          {view === 'restaurants' && (
            <RestaurantListView
              loading={loading}
              restaurants={restaurants}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              filterFree={filterFree}
              filterTop={filterTop}
              activeOrder={activeOrder}
              onSearchChange={(v) => { setSearchQuery(v); fetchRestaurants(selectedCategory, v); }}
              onFilterFreeToggle={() => setFilterFree((v) => !v)}
              onFilterTopToggle={() => setFilterTop((v) => !v)}
              onResetFilters={() => { setSearchQuery(''); fetchRestaurants(); }}
              onOpenRestaurant={fetchRestaurantDetails}
              onViewOrders={() => setView('orders')}
              onOpenTracking={() => setView('tracking')}
            />
          )}

          {view === 'restaurant' && selectedRestaurant && (
            <RestaurantDetailView
              restaurant={selectedRestaurant}
              menuCat={menuCat}
              stamps={stamps}
              cart={cart}
              cartTotal={cartTotal}
              onSetMenuCat={setMenuCat}
              onAddItem={addToCart}
              onOpenExtras={openExtras}
              onOpenCart={() => setView('cart')}
            />
          )}

          {view === 'cart' && (
            <CartView
              cart={cart}
              cartTotal={cartTotal}
              deliveryFee={deliveryFee}
              serviceFee={serviceFee}
              smallOrderFee={smallOrderFee}
              orderTotal={orderTotal}
              onUpdateQty={updateQuantity}
              onProceedCheckout={() => setView('checkout')}
            />
          )}

          {view === 'checkout' && (
            <CheckoutView
              deliveryAddress={deliveryAddress}
              onChangeAddress={setDeliveryAddress}
              userBalance={userBalance}
              orderTotal={orderTotal}
              cart={cart}
              selectedRestaurant={selectedRestaurant}
              promoCode={promoCode}
              promoApplied={promoApplied}
              error={error}
              loading={loading}
              onSetPromoCode={setPromoCode}
              onApplyPromo={(p) => { setPromoApplied(p); setError(''); }}
              onRemovePromo={() => { setPromoApplied(null); setPromoCode(''); }}
              onPlaceOrder={placeOrder}
              onSplitPay={() => {
                setSplitOrderId(activeOrder?.order_id || `cart_${Date.now()}`);
                setSplitTotal(orderTotal);
                setShowSplit(true);
              }}
              onGroupOrder={() => setShowGroupOrder(true)}
              onNavigate={navigate}
              onSetError={setError}
            />
          )}

          {view === 'tracking' && activeOrder && (
            <OrderTrackingView
              activeOrder={activeOrder}
              loading={loading}
              onCancel={cancelOrder}
              onConfirm={confirmDelivery}
              onNewOrder={() => { setActiveOrder(null); setView('restaurants'); }}
            />
          )}

          {view === 'orders' && (
            <OrderHistoryView
              orderHistory={orderHistory}
              onReviewOrder={(orderId) => {
                setReviewTarget({ service_type: 'food', service_id: orderId });
                setShowReview(true);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <MenuItemExtrasModal
        item={extrasModal}
        selectedSize={selectedSize}
        selectedExtras={selectedExtras}
        onSelectSize={setSelectedSize}
        onToggleExtra={toggleExtra}
        onConfirm={confirmExtras}
        onClose={() => setExtrasModal(null)}
      />

      <AnimatePresence>
        {showAdvFilters && (
          <FoodFilters
            onApply={() => { setShowAdvFilters(false); fetchRestaurants(selectedCategory, searchQuery); }}
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
      <GroupOrderModal
        isOpen={showGroupOrder}
        onClose={() => setShowGroupOrder(false)}
        serviceType="food"
      />
    </div>
  );
}
