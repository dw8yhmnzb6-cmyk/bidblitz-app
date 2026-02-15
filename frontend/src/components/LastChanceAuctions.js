/**
 * Last Chance Auctions - Shows auctions ending soon
 * Creates urgency and FOMO
 */
import { useState, useEffect, memo } from 'react';
import { Clock, AlertTriangle, Flame, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { getProductName } from '../utils/productTranslation';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: 'LETZTE CHANCE',
    subtitle: 'Endet in weniger als 5 Minuten!',
    ending: 'Endet in',
    currentPrice: 'Aktuell',
    bidNow: 'Jetzt bieten',
    noAuctions: 'Keine Auktionen enden bald',
    viewAll: 'Alle ansehen'
  },
  en: {
    title: 'LAST CHANCE',
    subtitle: 'Ending in less than 5 minutes!',
    ending: 'Ends in',
    currentPrice: 'Current',
    bidNow: 'Bid Now',
    noAuctions: 'No auctions ending soon',
    viewAll: 'View All'
  },
  sq: {
    title: 'SHANSA E FUNDIT',
    subtitle: 'Përfundon për më pak se 5 minuta!',
    ending: 'Përfundon për',
    currentPrice: 'Aktuale',
    bidNow: 'Oferoni Tani',
    noAuctions: 'Asnjë ankand nuk përfundon së shpejti',
    viewAll: 'Shiko të Gjitha'
  },
  tr: {
    title: 'SON ŞANS',
    subtitle: '5 dakikadan az sürede bitiyor!',
    ending: 'Bitiyor',
    currentPrice: 'Güncel',
    bidNow: 'Şimdi Teklif Ver',
    noAuctions: 'Yakında biten açık artırma yok',
    viewAll: 'Tümünü Gör'
  }
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

// Compact horizontal scrolling widget
export const LastChanceWidget = memo(({ language = 'de', maxItems = 5 }) => {
  const navigate = useNavigate();
  const { language: contextLanguage } = useLanguage();
  const effectiveLang = language || contextLanguage || 'de';
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const t = translations[effectiveLang] || translations.de;
  
  // Fetch ending soon auctions
  useEffect(() => {
    const fetchEndingSoon = async () => {
      try {
        const res = await axios.get(`${API}/auctions/ending-soon?minutes=5&limit=${maxItems}`);
        const now = Date.now();
        // Filter out expired auctions
        const validAuctions = (res.data.auctions || res.data || []).filter(a => {
          const endTime = new Date(a.end_time).getTime();
          return endTime > now;
        });
        setAuctions(validAuctions);
      } catch (err) {
        // Fallback - get active auctions and filter
        try {
          const res = await axios.get(`${API}/auctions?status=active&limit=20`);
          const now = Date.now();
          const endingSoon = (res.data.auctions || res.data || [])
            .filter(a => {
              const endTime = new Date(a.end_time).getTime();
              const timeLeft = (endTime - now) / 1000;
              return timeLeft > 5 && timeLeft < 300; // More than 5 seconds, less than 5 minutes
            })
            .slice(0, maxItems);
          setAuctions(endingSoon);
        } catch (e) {
          setAuctions([]);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchEndingSoon();
    const interval = setInterval(fetchEndingSoon, 10000);
    return () => clearInterval(interval);
  }, [maxItems]);
  
  // Auto-remove expired auctions every second
  useEffect(() => {
    if (auctions.length === 0) return;
    
    const removeExpired = () => {
      const now = Date.now();
      setAuctions(prev => prev.filter(a => {
        const endTime = new Date(a.end_time).getTime();
        return endTime > now + 1000; // Remove if less than 1 second left
      }));
    };
    
    const timer = setInterval(removeExpired, 1000);
    return () => clearInterval(timer);
  }, [auctions.length > 0]);
  
  if (loading || auctions.length === 0) return null;
  
  return (
    <div 
      className="bg-gradient-to-r from-red-600 to-orange-500 rounded-xl p-4 shadow-lg"
      data-testid="last-chance-widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-300" />
          <span className="font-black text-white">{t.title}</span>
          <Flame className="w-5 h-5 text-yellow-300 animate-bounce" />
        </div>
        <button
          onClick={() => navigate('/auktionen')}
          className="text-white/80 text-xs hover:text-white flex items-center gap-1"
        >
          {t.viewAll}
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      
      <p className="text-white/80 text-xs mb-3">{t.subtitle}</p>
      
      {/* Horizontal scrolling auctions */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/30">
        {auctions.map((auction) => {
          const endTime = new Date(auction.end_time).getTime();
          const timeLeftSec = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          const product = auction.product || {};
          const productName = getProductName(product, effectiveLang);
          
          return (
            <div 
              key={auction.id}
              onClick={() => navigate(`/auction/${auction.id}`)}
              className="flex-shrink-0 w-36 bg-white/10 backdrop-blur rounded-lg p-3 cursor-pointer
                hover:bg-white/20 transition-colors"
            >
              {/* Timer */}
              <div className="flex items-center gap-1 mb-2">
                <Clock className="w-3 h-3 text-yellow-300" />
                <span className="text-yellow-300 font-mono font-bold text-sm">
                  {formatTime(timeLeftSec)}
                </span>
              </div>
              
              {/* Product name */}
              <p className="text-white text-xs font-medium truncate">
                {productName || 'Auktion'}
              </p>
              
              {/* Price */}
              <p className="text-white/70 text-[10px] mt-1">{t.currentPrice}</p>
              <p className="text-white font-bold">€{(auction.current_price || 0).toFixed(2)}</p>
              
              {/* Bid button */}
              <button className="mt-2 w-full py-1.5 bg-white text-red-600 text-xs font-bold rounded-lg
                hover:bg-yellow-300 transition-colors">
                {t.bidNow}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Full section component
const LastChanceSection = memo(({ language = 'de' }) => {
  const navigate = useNavigate();
  const { language: contextLanguage } = useLanguage();
  const effectiveLang = language || contextLanguage || 'de';
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const t = translations[effectiveLang] || translations.de;
  
  // Fetch ending soon auctions
  useEffect(() => {
    const fetchEndingSoon = async () => {
      try {
        const res = await axios.get(`${API}/auctions?status=active&limit=30`);
        const now = Date.now();
        const endingSoon = (res.data.auctions || res.data || [])
          .filter(a => {
            const endTime = new Date(a.end_time).getTime();
            const timeLeft = (endTime - now) / 1000;
            return timeLeft > 5 && timeLeft < 300; // More than 5 seconds, less than 5 minutes
          })
          .sort((a, b) => new Date(a.end_time) - new Date(b.end_time));
        setAuctions(endingSoon);
      } catch (err) {
        console.error('Error fetching ending soon:', err);
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEndingSoon();
    // Refresh every 30 seconds to get new ending-soon auctions (reduced from 15s)
    const refreshInterval = setInterval(fetchEndingSoon, 30000);
    return () => clearInterval(refreshInterval);
  }, []);
  
  // Auto-remove expired auctions every second
  useEffect(() => {
    if (auctions.length === 0) return;
    
    const removeExpired = () => {
      const now = Date.now();
      setAuctions(prev => prev.filter(a => {
        const endTime = new Date(a.end_time).getTime();
        return endTime > now + 1000; // Remove if less than 1 second left
      }));
    };
    
    const timer = setInterval(removeExpired, 1000);
    return () => clearInterval(timer);
  }, [auctions.length > 0]);
  
  // Auto-remove expired auctions from display every second
  useEffect(() => {
    if (auctions.length === 0) return;
    
    const checkExpired = () => {
      const now = Date.now();
      setAuctions(prev => prev.filter(a => {
        const endTime = new Date(a.end_time).getTime();
        return endTime > now;
      }));
    };
    
    const timer = setInterval(checkExpired, 1000);
    return () => clearInterval(timer);
  }, [auctions.length]);
  
  // Force re-render every second for countdown
  if (loading) return null;
  if (auctions.length === 0) return null;
  
  return (
    <div className="mb-8" data-testid="last-chance-section">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              {t.title}
              <Flame className="w-5 h-5 text-orange-500" />
            </h2>
            <p className="text-gray-500 text-sm">{t.subtitle}</p>
          </div>
        </div>
      </div>
      
      {/* Auctions grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {auctions.map((auction) => {
          const endTime = new Date(auction.end_time).getTime();
          const timeLeftSec = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          const product = auction.product || {};
          const productName = getProductName(product, effectiveLang);
          
          return (
            <div 
              key={auction.id}
              onClick={() => navigate(`/auction/${auction.id}`)}
              className="bg-gradient-to-br from-red-500 to-orange-500 rounded-xl p-3 cursor-pointer
                hover:from-red-600 hover:to-orange-600 transition-all transform hover:scale-105 shadow-lg"
            >
              {/* Urgent timer */}
              <div className="flex items-center justify-center gap-1 mb-2 py-1 bg-black/20 rounded-lg">
                <Clock className="w-4 h-4 text-yellow-300" />
                <span className="text-yellow-300 font-mono font-bold">
                  {formatTime(timeLeftSec)}
                </span>
              </div>
              
              {/* Product image */}
              {product.image_url && (
                <div className="w-full h-20 mb-2 rounded-lg overflow-hidden bg-white/10">
                  <img 
                    src={product.image_url} 
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {/* Product name */}
              <p className="text-white text-sm font-medium truncate">
                {productName || 'Auktion'}
              </p>
              
              {/* Price */}
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-white/70 text-xs">{t.currentPrice}</span>
                <span className="text-white font-bold text-lg">
                  €{(auction.current_price || 0).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

LastChanceWidget.displayName = 'LastChanceWidget';
LastChanceSection.displayName = 'LastChanceSection';

export { LastChanceSection };
export default LastChanceWidget;
