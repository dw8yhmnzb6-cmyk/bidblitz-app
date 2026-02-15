/**
 * Flash Sales Banner Component
 * Shows time-limited special offers for bid bundles
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Timer, Zap, Gift, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: {
    flashSale: 'Flash Sale',
    endsIn: 'Endet in',
    hours: 'Std',
    minutes: 'Min',
    seconds: 'Sek',
    bids: 'Gebote',
    bonus: 'Bonus',
    total: 'Gesamt',
    save: 'SPARE',
    buyNow: 'Jetzt kaufen',
    limitedOffer: 'Limitiertes Angebot',
    onlyToday: 'Nur heute',
    firstPurchase: 'Nur für Erstkäufer',
    weekendSpecial: 'Wochenend-Special'
  },
  en: {
    flashSale: 'Flash Sale',
    endsIn: 'Ends in',
    hours: 'hrs',
    minutes: 'min',
    seconds: 'sec',
    bids: 'Bids',
    bonus: 'Bonus',
    total: 'Total',
    save: 'SAVE',
    buyNow: 'Buy Now',
    limitedOffer: 'Limited Offer',
    onlyToday: 'Today Only',
    firstPurchase: 'First-time buyers only',
    weekendSpecial: 'Weekend Special'
  },
  tr: {
    flashSale: 'Flaş Satış',
    endsIn: 'Bitiyor',
    hours: 'sa',
    minutes: 'dk',
    seconds: 'sn',
    bids: 'Teklif',
    bonus: 'Bonus',
    total: 'Toplam',
    save: 'TASARRUF',
    buyNow: 'Şimdi Al',
    limitedOffer: 'Sınırlı Teklif',
    onlyToday: 'Sadece Bugün',
    firstPurchase: 'Sadece yeni müşteriler',
    weekendSpecial: 'Hafta Sonu Özel'
  },
  sq: {
    flashSale: 'Shitje Flash',
    endsIn: 'Mbaron në',
    hours: 'orë',
    minutes: 'min',
    seconds: 'sek',
    bids: 'Oferta',
    bonus: 'Bonus',
    total: 'Totali',
    save: 'KURSE',
    buyNow: 'Bli Tani',
    limitedOffer: 'Ofertë e Limituar',
    onlyToday: 'Vetëm Sot',
    firstPurchase: 'Vetëm për blerësit e rinj',
    weekendSpecial: 'Speciale Fundjavë'
  },
  fr: {
    flashSale: 'Vente Flash',
    endsIn: 'Se termine dans',
    hours: 'h',
    minutes: 'min',
    seconds: 's',
    bids: 'Enchères',
    bonus: 'Bonus',
    total: 'Total',
    save: 'ÉCONOMISEZ',
    buyNow: 'Acheter',
    limitedOffer: 'Offre Limitée',
    onlyToday: "Aujourd'hui seulement",
    firstPurchase: 'Nouveaux clients uniquement',
    weekendSpecial: 'Spécial Week-end'
  }
};

const FlashSalesBanner = ({ onPurchase }) => {
  const { isAuthenticated, token } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.de;
  
  const [flashSales, setFlashSales] = useState([]);
  const [endsInHours, setEndsInHours] = useState(24);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [loading, setLoading] = useState(true);

  // Fetch flash sales
  const fetchFlashSales = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API}/api/bid-bundles/flash-sales`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFlashSales(data.flash_sales || []);
        setEndsInHours(data.ends_in_hours || 24);
      }
    } catch (err) {
      console.error('Error fetching flash sales:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchFlashSales();
  }, [fetchFlashSales]);

  // Countdown timer
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      
      const diff = endOfDay - now;
      
      if (diff > 0) {
        setCountdown({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000)
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle purchase
  const handlePurchase = async (sale) => {
    if (!isAuthenticated) {
      toast.error(language === 'de' ? 'Bitte melde dich an' : 'Please log in');
      window.location.href = '/login?redirect=/buy-bids';
      return;
    }

    try {
      const response = await fetch(`${API}/api/bid-bundles/purchase/${sale.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.checkout_url) {
        // Redirect to checkout
        window.location.href = data.checkout_url;
      } else if (response.ok) {
        // Fallback - redirect to buy-bids with package selected
        window.location.href = `/buy-bids?package=${sale.id}`;
      } else {
        toast.error(data.detail || 'Fehler beim Kauf');
      }
    } catch (err) {
      // Fallback - just go to buy-bids page
      console.error('Purchase error:', err);
      window.location.href = `/buy-bids?package=${sale.id}`;
    }
  };

  if (loading || !isAuthenticated || flashSales.length === 0) {
    return null;
  }

  return (
    <div className="w-full" data-testid="flash-sales-banner">
      {flashSales.map((sale, index) => (
        <div 
          key={sale.id || index}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 p-4 mb-4 shadow-lg"
        >
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-transparent to-yellow-500/20 animate-pulse" />
          
          {/* Flash icon */}
          <div className="absolute top-2 left-2">
            <Zap className="w-6 h-6 text-yellow-300 animate-bounce" />
          </div>
          
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left side - Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-bold text-white">
                  ⚡ {t.flashSale}
                </span>
                {sale.first_purchase_only && (
                  <span className="px-2 py-1 bg-green-500/30 rounded-full text-xs text-white">
                    <Gift className="w-3 h-3 inline mr-1" />
                    {t.firstPurchase}
                  </span>
                )}
                {sale.valid_days && (
                  <span className="px-2 py-1 bg-blue-500/30 rounded-full text-xs text-white">
                    🗓️ {t.weekendSpecial}
                  </span>
                )}
              </div>
              
              <h3 className="text-xl md:text-2xl font-bold text-white mb-1">
                {sale.name_translations?.[language] || sale.name}
              </h3>
              
              <div className="flex items-center justify-center md:justify-start gap-4 text-white/90">
                <span className="text-lg">
                  <strong className="text-2xl">{sale.bids}</strong> {t.bids}
                </span>
                <span className="text-yellow-200 font-bold">
                  +{sale.bonus_bids} {t.bonus}!
                </span>
                <span className="text-green-200 text-sm">
                  = {sale.bids + sale.bonus_bids} {t.total}
                </span>
              </div>
            </div>
            
            {/* Center - Countdown */}
            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-4 py-2">
              <Timer className="w-5 h-5 text-yellow-300" />
              <div className="flex items-center gap-1 text-white font-mono">
                <div className="bg-black/40 rounded px-2 py-1">
                  <span className="text-xl font-bold">{String(countdown.hours).padStart(2, '0')}</span>
                  <span className="text-xs ml-1">{t.hours}</span>
                </div>
                <span className="text-xl">:</span>
                <div className="bg-black/40 rounded px-2 py-1">
                  <span className="text-xl font-bold">{String(countdown.minutes).padStart(2, '0')}</span>
                  <span className="text-xs ml-1">{t.minutes}</span>
                </div>
                <span className="text-xl">:</span>
                <div className="bg-black/40 rounded px-2 py-1">
                  <span className="text-xl font-bold">{String(countdown.seconds).padStart(2, '0')}</span>
                  <span className="text-xs ml-1">{t.seconds}</span>
                </div>
              </div>
            </div>
            
            {/* Right side - Price & CTA */}
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className="text-center md:text-right">
                {sale.original_price && (
                  <span className="text-white/60 line-through text-sm mr-2">
                    €{sale.original_price.toFixed(2)}
                  </span>
                )}
                <span className="text-3xl font-bold text-white">
                  €{sale.price.toFixed(2)}
                </span>
              </div>
              
              {sale.original_price && (
                <span className="px-3 py-1 bg-green-500 rounded-full text-white text-sm font-bold">
                  {t.save} {Math.round((1 - sale.price / sale.original_price) * 100)}%
                </span>
              )}
              
              <Button
                onClick={() => handlePurchase(sale)}
                className="bg-white text-red-600 hover:bg-yellow-100 font-bold px-6 py-2 rounded-full shadow-lg transform hover:scale-105 transition-all"
                data-testid={`flash-sale-buy-${sale.id}`}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {t.buyNow}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
          
          {/* Bottom badge */}
          {sale.badge && (
            <div className="absolute bottom-2 right-2 text-white/80 text-xs">
              {sale.badge}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FlashSalesBanner;
