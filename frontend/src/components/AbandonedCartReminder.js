/**
 * Abandoned Cart Reminder - Floating widget that reminds users about unpurchased items
 * Shows when user has items in cart and hasn't completed purchase
 */
import { useState, useEffect, memo } from 'react';
import { ShoppingCart, X, ArrowRight, Clock, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: 'Nicht vergessen!',
    subtitle: 'Du hast noch Artikel im Warenkorb',
    items: 'Artikel',
    value: 'Wert',
    completeNow: 'Jetzt abschließen',
    expires: 'Reservierung läuft ab in',
    bonus: '+10% Bonus wenn du jetzt kaufst!',
    minutes: 'Min'
  },
  en: {
    title: "Don't forget!",
    subtitle: 'You have items in your cart',
    items: 'Items',
    value: 'Value',
    completeNow: 'Complete Now',
    expires: 'Reservation expires in',
    bonus: '+10% bonus if you buy now!',
    minutes: 'min'
  },
  tr: {
    title: 'Unutma!',
    subtitle: 'Sepetinde ürünler var',
    items: 'Ürün',
    value: 'Değer',
    completeNow: 'Şimdi Tamamla',
    expires: 'Rezervasyon bitiyor',
    bonus: 'Şimdi alırsan +%10 bonus!',
    minutes: 'dk'
  },
  sq: {
    title: 'Mos harro!',
    subtitle: 'Ke artikuj në shportë',
    items: 'Artikuj',
    value: 'Vlera',
    completeNow: 'Përfundo Tani',
    expires: 'Rezervimi skadon për',
    bonus: '+10% bonus nëse blej tani!',
    minutes: 'min'
  }
};

const AbandonedCartReminder = memo(({ language = 'de' }) => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 30 minutes default
  
  const t = translations[language] || translations.de;
  
  // Fetch cart data
  useEffect(() => {
    const fetchCart = async () => {
      if (!isAuthenticated || !token) return;
      
      try {
        const res = await axios.get(`${API}/abandoned-cart/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data && res.data.items && res.data.items.length > 0) {
          setCart(res.data);
          
          // Calculate time left
          if (res.data.expires_at) {
            const expiresAt = new Date(res.data.expires_at).getTime();
            const now = Date.now();
            const diff = Math.max(0, Math.floor((expiresAt - now) / 60000));
            setTimeLeft(diff);
          }
        }
      } catch (err) {
        // No cart or error - don't show reminder
        setCart(null);
      }
    };
    
    fetchCart();
    
    // Check every minute
    const interval = setInterval(fetchCart, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, token]);
  
  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 60000);
    
    return () => clearInterval(timer);
  }, [timeLeft]);
  
  // Don't show if no cart, dismissed, or not authenticated
  if (!cart || dismissed || !isAuthenticated || cart.items?.length === 0) {
    return null;
  }
  
  const totalValue = cart.total || cart.items?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;
  const itemCount = cart.items?.length || 0;
  
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300"
      data-testid="abandoned-cart-reminder"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-w-sm">
        {/* Urgency header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Clock className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">
              {t.expires} {timeLeft} {t.minutes}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="relative">
              <div className="p-2 bg-orange-100 rounded-xl">
                <ShoppingCart className="w-6 h-6 text-orange-500" />
              </div>
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            </div>
            <div>
              <h4 className="font-bold text-gray-800">{t.title}</h4>
              <p className="text-sm text-gray-500">{t.subtitle}</p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex justify-between mb-3 p-3 bg-gray-50 rounded-xl">
            <div className="text-center">
              <p className="text-xs text-gray-500">{t.items}</p>
              <p className="text-lg font-bold text-gray-800">{itemCount}</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-xs text-gray-500">{t.value}</p>
              <p className="text-lg font-bold text-emerald-600">€{totalValue.toFixed(2)}</p>
            </div>
          </div>
          
          {/* Bonus badge */}
          <div className="flex items-center gap-2 mb-3 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
            <Gift className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-emerald-700 font-medium">{t.bonus}</span>
          </div>
          
          {/* CTA */}
          <button
            onClick={() => navigate('/gebot-pakete')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-red-500 
              text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition-all 
              transform hover:scale-[1.02] shadow-lg"
            data-testid="cart-complete-btn"
          >
            {t.completeNow}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

AbandonedCartReminder.displayName = 'AbandonedCartReminder';

export default AbandonedCartReminder;
