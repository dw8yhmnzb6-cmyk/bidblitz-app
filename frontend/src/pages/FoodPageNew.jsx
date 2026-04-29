import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Search, ShoppingBag, Clock, Star, ChevronRight, X, MapPin, Bike } from 'lucide-react';
import { useI18n } from '../store/I18nContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function FoodPageNew({ onNavigate }) {
  const { t } = useI18n();
  
  const [view, setView] = useState('restaurants'); // restaurants, menu, tracking
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRestaurants();
    checkActiveOrder();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${API}/api/food/restaurants`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data.restaurants || []);
      }
    } catch {}
  };

  const checkActiveOrder = async () => {
    try {
      const res = await fetch(`${API}/api/food/active-order`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          setActiveOrder(data.order);
          setView('tracking');
        }
      }
    } catch {}
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.item_id === item.item_id);
      if (existing) {
        return prev.map(i => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const res = await fetch(`${API}/api/food/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          restaurant_id: selectedRestaurant.restaurant_id,
          items: cart,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveOrder(data.order);
        setView('tracking');
        setCart([]);
      }
    } catch {}
  };

  if (view === 'tracking' && activeOrder) {
    return <OrderTrackingView order={activeOrder} onBack={() => setView('restaurants')} />;
  }

  if (view === 'menu' && selectedRestaurant) {
    return (
      <RestaurantMenuView 
        restaurant={selectedRestaurant} 
        cart={cart}
        onAddToCart={addToCart}
        onBack={() => setView('restaurants')}
        onCheckout={placeOrder}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0F] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0B0B0F] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate?.('/')}
            className="w-10 h-10 rounded-full bg-[#121218] flex items-center justify-center"
          >
            <X size={20} className="text-gray-400" />
          </motion.button>
          
          <h1 className="text-xl font-bold text-white">Food Delivery</h1>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-full bg-[#121218] flex items-center justify-center relative"
          >
            <ShoppingBag size={20} className="text-gray-400" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#00C2FF] rounded-full text-xs font-bold flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search for food..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121218] text-white pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/50"
          />
        </div>
      </div>

      {/* Restaurants Grid */}
      <div className="p-4 space-y-3">
        {restaurants
          .filter(r => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((restaurant) => (
            <motion.button
              key={restaurant.restaurant_id}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedRestaurant(restaurant);
                setView('menu');
              }}
              className="w-full bg-[#121218] rounded-2xl overflow-hidden text-left"
            >
              <div className="h-40 bg-gradient-to-br from-gray-700 to-gray-800 relative">
                {restaurant.image && <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />}
                {restaurant.delivery_free && (
                  <span className="absolute top-2 left-2 px-3 py-1 bg-[#00C2FF] text-white text-xs font-bold rounded-full">
                    Free Delivery
                  </span>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold">{restaurant.name}</h3>
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-400" fill="currentColor" />
                    <span className="text-white text-sm font-medium">{restaurant.rating || 4.5}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{restaurant.delivery_time || '20-30'} min</span>
                  </div>
                  <span>•</span>
                  <span>{restaurant.category || 'Various'}</span>
                </div>
              </div>
            </motion.button>
          ))}
      </div>
    </div>
  );
}

function RestaurantMenuView({ restaurant, cart, onAddToCart, onBack, onCheckout }) {
  return (
    <div className="min-h-screen bg-[#0B0B0F] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0B0B0F] p-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#121218] flex items-center justify-center"
          >
            <X size={20} className="text-gray-400" />
          </motion.button>
          <h2 className="text-xl font-bold text-white">{restaurant.name}</h2>
        </div>
      </div>

      {/* Menu Items with Swipe-to-Add */}
      <div className="px-4 space-y-3">
        {(restaurant.menu || []).map((item) => (
          <SwipeToAddCard key={item.item_id} item={item} onAdd={onAddToCart} />
        ))}
      </div>

      {/* Checkout Button */}
      {cart.length > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-[#0B0B0F] border-t border-white/10"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onCheckout}
            className="w-full py-4 bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] rounded-full text-white font-bold flex items-center justify-between px-6"
          >
            <span>Checkout</span>
            <span>€{cart.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}</span>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

function SwipeToAddCard({ item, onAdd }) {
  const x = useMotionValue(0);
  const background = useTransform(x, [-100, 0, 100], ['#00C2FF', '#121218', '#00C2FF']);
  const scale = useTransform(x, [-100, 0, 100], [1.05, 1, 1.05]);

  const handleDragEnd = (event, info) => {
    if (Math.abs(info.offset.x) > 50) {
      onAdd(item);
    }
    x.set(0);
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      style={{ x, background, scale }}
      onDragEnd={handleDragEnd}
      className="p-4 rounded-2xl flex items-center gap-4 cursor-grab active:cursor-grabbing"
    >
      <div className="w-20 h-20 rounded-xl bg-gray-700 flex-shrink-0 overflow-hidden">
        {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium truncate">{item.name}</h4>
        <p className="text-gray-400 text-xs truncate">{item.description}</p>
        <p className="text-[#00C2FF] font-bold mt-1">€{item.price.toFixed(2)}</p>
      </div>
      <motion.div
        style={{ opacity: useTransform(x, [-100, 0, 100], [1, 0, 1]) }}
        className="text-white font-bold"
      >
        +
      </motion.div>
    </motion.div>
  );
}

function OrderTrackingView({ order, onBack }) {
  const [driverPosition, setDriverPosition] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDriverPosition(prev => (prev + 1) % 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const statusSteps = [
    { label: 'Order Placed', icon: '✅', active: true },
    { label: 'Preparing', icon: '👨‍🍳', active: order.status === 'preparing' || order.status === 'picked_up' || order.status === 'delivered' },
    { label: 'On the way', icon: '🛵', active: order.status === 'picked_up' || order.status === 'delivered' },
    { label: 'Delivered', icon: '🎉', active: order.status === 'delivered' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0F] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#121218] flex items-center justify-center"
        >
          <X size={20} className="text-gray-400" />
        </motion.button>
        <h2 className="text-xl font-bold text-white">Tracking Order</h2>
        <div className="w-10" />
      </div>

      {/* Animated Map */}
      <div className="relative h-64 bg-[#121218] rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
        
        {/* Animated delivery route */}
        <svg className="absolute inset-0 w-full h-full">
          <motion.path
            d="M 50 200 Q 150 100 250 50"
            stroke="#00C2FF"
            strokeWidth="3"
            fill="none"
            strokeDasharray="10 5"
            animate={{ strokeDashoffset: [0, -100] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
        </svg>

        {/* Animated driver icon */}
        <motion.div
          animate={{
            x: [50, 250],
            y: [200, 50],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute w-12 h-12 bg-[#00C2FF] rounded-full flex items-center justify-center shadow-lg"
        >
          <Bike size={24} className="text-white" />
        </motion.div>
      </div>

      {/* Status Steps */}
      <div className="space-y-4">
        {statusSteps.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`flex items-center gap-4 p-4 rounded-2xl ${step.active ? 'bg-[#00C2FF]/20' : 'bg-[#121218]'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${step.active ? 'bg-[#00C2FF]' : 'bg-gray-700'}`}>
              {step.icon}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${step.active ? 'text-white' : 'text-gray-500'}`}>{step.label}</p>
              {step.active && idx === statusSteps.findIndex(s => s.active) && (
                <p className="text-xs text-[#00C2FF]">In progress...</p>
              )}
            </div>
            {step.active && <div className="w-2 h-2 bg-[#00C2FF] rounded-full animate-pulse" />}
          </motion.div>
        ))}
      </div>

      {/* ETA */}
      <div className="bg-gradient-to-r from-[#00C2FF]/20 to-[#7B2CFF]/20 rounded-3xl p-6 text-center">
        <p className="text-gray-400 text-sm mb-2">Estimated Arrival</p>
        <p className="text-4xl font-bold text-white">12 min</p>
      </div>
    </div>
  );
}
