/**
 * Countdown Deal Banner - Time-limited bid package offers
 * Shows urgency-driven deals that expire soon
 */
import { useState, useEffect, memo } from 'react';
import { Clock, Zap, Gift, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const translations = {
  de: {
    title: 'FLASH DEAL',
    subtitle: 'Nur noch',
    bids: 'Gebote',
    instead: 'statt',
    save: 'SPARE',
    claim: 'Jetzt sichern',
    hurry: 'Beeile dich!',
    hours: 'Std',
    mins: 'Min',
    secs: 'Sek'
  },
  en: {
    title: 'FLASH DEAL',
    subtitle: 'Only',
    bids: 'Bids',
    instead: 'instead of',
    save: 'SAVE',
    claim: 'Claim Now',
    hurry: 'Hurry up!',
    hours: 'hrs',
    mins: 'min',
    secs: 'sec'
  },
  sq: {
    title: 'OFERTË FLASH',
    subtitle: 'Vetëm',
    bids: 'Oferta',
    instead: 'në vend të',
    save: 'KURSE',
    claim: 'Merr Tani',
    hurry: 'Shpejto!',
    hours: 'orë',
    mins: 'min',
    secs: 'sek'
  },
  tr: {
    title: 'FLASH FIRSAT',
    subtitle: 'Sadece',
    bids: 'Teklif',
    instead: 'yerine',
    save: 'TASARRUF',
    claim: 'Şimdi Al',
    hurry: 'Acele et!',
    hours: 'saat',
    mins: 'dk',
    secs: 'sn'
  }
};

// Sample deals - in production these would come from backend
const DEALS = [
  { bids: 100, originalPrice: 49, salePrice: 29, discount: 40 },
  { bids: 50, originalPrice: 25, salePrice: 15, discount: 40 },
  { bids: 200, originalPrice: 89, salePrice: 59, discount: 34 }
];

const CountdownDealBanner = memo(({ language = 'de' }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 2, mins: 0, secs: 0 });
  const [currentDeal, setCurrentDeal] = useState(DEALS[0]);
  
  const t = translations[language] || translations.de;
  
  // Initialize timer based on session
  useEffect(() => {
    const dealEndTime = sessionStorage.getItem('deal_end_time');
    let endTime;
    
    if (dealEndTime) {
      endTime = parseInt(dealEndTime);
    } else {
      // Set deal to expire in 2 hours
      endTime = Date.now() + (2 * 60 * 60 * 1000);
      sessionStorage.setItem('deal_end_time', endTime.toString());
      
      // Rotate deal
      const dealIndex = Math.floor(Math.random() * DEALS.length);
      setCurrentDeal(DEALS[dealIndex]);
    }
    
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, endTime - now);
      
      if (diff === 0) {
        // Reset deal
        const newEndTime = Date.now() + (2 * 60 * 60 * 1000);
        sessionStorage.setItem('deal_end_time', newEndTime.toString());
        setCurrentDeal(DEALS[Math.floor(Math.random() * DEALS.length)]);
      }
      
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);
  
  if (dismissed) return null;
  
  const handleClaim = () => {
    if (!isAuthenticated) {
      navigate('/register');
    } else {
      navigate('/gebot-pakete');
    }
  };
  
  return (
    <div 
      className="relative overflow-hidden bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500"
      data-testid="countdown-deal-banner"
    >
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-yellow-300/20 rounded-full blur-xl" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Deal info */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex p-2 bg-white/20 rounded-full animate-bounce">
              <Zap className="w-6 h-6 text-yellow-300" />
            </div>
            
            <div className="text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="px-2 py-0.5 bg-white text-red-600 text-xs font-black rounded">
                  {t.title}
                </span>
                <span className="text-white/80 text-sm">{t.hurry}</span>
              </div>
              
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {currentDeal.bids} {t.bids}
                </span>
                <span className="text-white/70 text-sm">
                  {t.instead} <s>€{currentDeal.originalPrice}</s>
                </span>
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-black text-yellow-300">
                  €{currentDeal.salePrice}
                </span>
                <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                  {t.save} {currentDeal.discount}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Center: Timer */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Clock className="w-4 h-4 text-white/70" />
            <span className="text-white/70 text-sm">{t.subtitle}</span>
            <div className="flex gap-1">
              <div className="bg-black/30 px-2 py-1 rounded text-center min-w-[40px]">
                <span className="text-white font-mono font-bold text-lg">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-white/50 text-[10px] block">{t.hours}</span>
              </div>
              <span className="text-white font-bold self-start mt-1">:</span>
              <div className="bg-black/30 px-2 py-1 rounded text-center min-w-[40px]">
                <span className="text-white font-mono font-bold text-lg">{String(timeLeft.mins).padStart(2, '0')}</span>
                <span className="text-white/50 text-[10px] block">{t.mins}</span>
              </div>
              <span className="text-white font-bold self-start mt-1">:</span>
              <div className="bg-black/30 px-2 py-1 rounded text-center min-w-[40px]">
                <span className="text-white font-mono font-bold text-lg animate-pulse">{String(timeLeft.secs).padStart(2, '0')}</span>
                <span className="text-white/50 text-[10px] block">{t.secs}</span>
              </div>
            </div>
          </div>
          
          {/* Right: CTA */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleClaim}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-red-600 font-black rounded-full
                hover:bg-yellow-300 transition-all transform hover:scale-105 shadow-lg"
              data-testid="countdown-deal-cta"
            >
              <Gift className="w-4 h-4" />
              {t.claim}
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

CountdownDealBanner.displayName = 'CountdownDealBanner';

export default CountdownDealBanner;
