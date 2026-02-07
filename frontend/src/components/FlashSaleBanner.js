import React, { useState, useEffect, memo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Zap, Clock, Tag, ShoppingCart, Flame, Gift } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: "Blitzangebot",
    subtitle: "Nur für kurze Zeit!",
    endsIn: "Endet in",
    hours: "Std",
    minutes: "Min",
    seconds: "Sek",
    bids: "Gebote",
    originalPrice: "Statt",
    save: "Spare",
    buyNow: "Jetzt kaufen",
    popular: "Beliebt",
    limited: "Begrenzt",
    soldOut: "Ausverkauft",
    noFlashSales: "Aktuell keine Blitzangebote"
  },
  en: {
    title: "Flash Sale",
    subtitle: "Limited time only!",
    endsIn: "Ends in",
    hours: "hrs",
    minutes: "min",
    seconds: "sec",
    bids: "Bids",
    originalPrice: "Was",
    save: "Save",
    buyNow: "Buy now",
    popular: "Popular",
    limited: "Limited",
    soldOut: "Sold out",
    noFlashSales: "No flash sales at the moment"
  },
  sq: {
    title: "Shitje Blic",
    subtitle: "Vetëm për kohë të kufizuar!",
    endsIn: "Përfundon në",
    hours: "orë",
    minutes: "min",
    seconds: "sek",
    bids: "Oferta",
    originalPrice: "Ishte",
    save: "Kurse",
    buyNow: "Bli tani",
    popular: "Popullore",
    limited: "E kufizuar",
    soldOut: "E shitur",
    noFlashSales: "Asnjë shitje blic aktualisht"
  },
  xk: {
    title: "Shitje Blic",
    subtitle: "Vetëm për kohë të kufizuar!",
    endsIn: "Përfundon në",
    hours: "orë",
    minutes: "min",
    seconds: "sek",
    bids: "Oferta",
    originalPrice: "Ishte",
    save: "Kurse",
    buyNow: "Bli tani",
    popular: "Popullore",
    limited: "E kufizuar",
    soldOut: "E shitur",
    noFlashSales: "Asnjë shitje blic aktualisht"
  },
  tr: {
    title: "Flaş Satış",
    subtitle: "Sadece sınırlı süre!",
    endsIn: "Bitiş",
    hours: "sa",
    minutes: "dk",
    seconds: "sn",
    bids: "Teklifler",
    originalPrice: "Eski fiyat",
    save: "Tasarruf",
    buyNow: "Şimdi al",
    popular: "Popüler",
    limited: "Sınırlı",
    soldOut: "Tükendi",
    noFlashSales: "Şu an flaş satış yok"
  },
  fr: {
    title: "Vente Flash",
    subtitle: "Durée limitée!",
    endsIn: "Se termine dans",
    hours: "h",
    minutes: "min",
    seconds: "sec",
    bids: "Enchères",
    originalPrice: "Avant",
    save: "Économisez",
    buyNow: "Acheter",
    popular: "Populaire",
    limited: "Limité",
    soldOut: "Épuisé",
    noFlashSales: "Pas de vente flash actuellement"
  }
};

const CountdownTimer = memo(({ endTime, t }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = Math.max(0, end - now);
      
      return {
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      };
    };
    
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [endTime]);
  
  return (
    <div className="flex items-center gap-1 text-white">
      <Clock className="w-4 h-4" />
      <span className="font-mono font-bold">
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
});

const FlashSaleCard = memo(({ sale, onBuy, t }) => {
  const discountPercent = sale.discount_percent || Math.round((1 - sale.flash_price / sale.original_price) * 100);
  
  return (
    <div className="relative bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-4 text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>
      
      {/* Popular Badge */}
      {sale.popular && (
        <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
          <Flame className="w-3 h-3" />
          {t.popular}
        </div>
      )}
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-300" />
            <span className="font-bold">{sale.name}</span>
          </div>
          <CountdownTimer endTime={sale.end_time} t={t} />
        </div>
        
        {/* Bids Amount */}
        <div className="text-center mb-3">
          <p className="text-5xl font-black">{sale.bids}</p>
          <p className="text-orange-200">{t.bids}</p>
        </div>
        
        {/* Pricing */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="text-orange-200 line-through text-lg">
            €{sale.original_price?.toFixed(2)}
          </span>
          <span className="text-3xl font-black">
            €{sale.flash_price?.toFixed(2)}
          </span>
          <span className="bg-yellow-400 text-yellow-900 text-sm font-bold px-2 py-1 rounded">
            -{discountPercent}%
          </span>
        </div>
        
        {/* Buy Button */}
        <button
          onClick={() => onBuy(sale)}
          className="w-full py-3 bg-white text-orange-600 font-bold rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
          data-testid={`flash-sale-buy-${sale.id}`}
        >
          <ShoppingCart className="w-5 h-5" />
          {t.buyNow}
        </button>
      </div>
    </div>
  );
});

const FlashSaleBanner = memo(() => {
  const { isAuthenticated, token } = useAuth();
  const { language } = useLanguage();
  const [flashSales, setFlashSales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const t = translations[language] || translations.de;
  
  useEffect(() => {
    const fetchFlashSales = async () => {
      try {
        const res = await axios.get(`${API}/flash-sales/active`);
        setFlashSales(res.data || []);
      } catch (err) {
        console.error('Error fetching flash sales:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFlashSales();
    // Refresh every minute
    const interval = setInterval(fetchFlashSales, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const handleBuy = async (sale) => {
    if (!isAuthenticated) {
      toast.error('Bitte melde dich an um zu kaufen');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/flash-sales/${sale.id}/purchase`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Kauf');
    }
  };
  
  if (loading || flashSales.length === 0) {
    return null;
  }
  
  return (
    <div className="mb-4" data-testid="flash-sale-banner">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">{t.title}</h2>
          <p className="text-xs text-gray-500">{t.subtitle}</p>
        </div>
      </div>
      
      {/* Sales Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flashSales.slice(0, 3).map((sale) => (
          <FlashSaleCard key={sale.id} sale={sale} onBuy={handleBuy} t={t} />
        ))}
      </div>
    </div>
  );
});

export default FlashSaleBanner;
