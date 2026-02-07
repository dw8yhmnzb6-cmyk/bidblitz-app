import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Zap, Clock, Gift } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const HappyHourBanner = () => {
  const { language } = useLanguage();
  const [status, setStatus] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  const texts = {
    de: {
      happyHour: 'HAPPY HOUR',
      active: 'JETZT AKTIV!',
      multiplier: 'GEBOTE',
      endsIn: 'Endet in',
      startsIn: 'Startet in',
      buyNow: 'Jetzt Gebote kaufen!'
    },
    en: {
      happyHour: 'HAPPY HOUR',
      active: 'NOW ACTIVE!',
      multiplier: 'BIDS',
      endsIn: 'Ends in',
      startsIn: 'Starts in',
      buyNow: 'Buy Bids Now!'
    },
    sq: {
      happyHour: 'ORA E LUMTUR',
      active: 'AKTIVE TANI!',
      multiplier: 'OFERTA',
      endsIn: 'Përfundon në',
      startsIn: 'Fillon në',
      buyNow: 'Bli Oferta Tani!'
    },
    xk: {
      happyHour: 'ORA E LUMTUR',
      active: 'AKTIVE TANI!',
      multiplier: 'OFERTA',
      endsIn: 'Përfundon në',
      startsIn: 'Fillon në',
      buyNow: 'Bli Oferta Tani!'
    },
    tr: {
      happyHour: 'MUTLU SAAT',
      active: 'ŞİMDİ AKTİF!',
      multiplier: 'TEKLİF',
      endsIn: 'Bitiş',
      startsIn: 'Başlangıç',
      buyNow: 'Şimdi Teklif Al!'
    },
    fr: {
      happyHour: 'HAPPY HOUR',
      active: 'ACTIF MAINTENANT!',
      multiplier: 'OFFRES',
      endsIn: 'Se termine dans',
      startsIn: 'Commence dans',
      buyNow: 'Acheter des Offres!'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API}/api/gamification/happy-hour`);
        setStatus(res.data.status);
      } catch (err) {
        console.error('Error fetching happy hour status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!status) return;

    const updateTimer = () => {
      let targetTime;
      if (status.active && status.end_time) {
        targetTime = new Date(status.end_time);
      } else if (!status.active && status.next_start) {
        targetTime = new Date(status.next_start);
      } else {
        setTimeLeft('');
        return;
      }

      const now = new Date();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (!status) {
    // Debug: Show loading state briefly
    return null;
  }

  // Show active Happy Hour banner
  if (status.active) {
    return (
      <div 
        className="relative overflow-hidden bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white py-3 px-4 z-50"
        data-testid="happy-hour-banner"
        style={{ position: 'relative' }}
      >
        {/* Animated background */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjMiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjIiLz48L2c+PC9zdmc+')] opacity-30 animate-pulse"></div>
        
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 sm:gap-4 relative z-10">
          {/* Top Row on Mobile: Title + Multiplier */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
            {/* Icon and Title */}
            <div className="flex items-center gap-1">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" />
              <span className="font-black text-base sm:text-lg tracking-wider">{t.happyHour}</span>
            </div>

            {/* Multiplier */}
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-0.5">
              <span className="text-2xl sm:text-3xl font-black">{status.multiplier}x</span>
              <span className="text-xs sm:text-sm font-bold">{t.multiplier}</span>
            </div>
          </div>

          {/* Bottom Row on Mobile: Timer + CTA */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
            {/* Timer */}
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">{t.endsIn}:</span>
              <span className="font-mono font-bold text-sm sm:text-lg bg-black/30 px-2 rounded">
                {timeLeft}
              </span>
            </div>

            {/* CTA Button */}
            <a 
              href="/buy-bids"
              className="flex items-center gap-1 bg-white text-orange-600 font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-yellow-100 transition-all transform hover:scale-105 text-sm sm:text-base"
            >
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">{t.buyNow}</span>
              <span className="sm:hidden">Kaufen!</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show upcoming Happy Hour teaser (only if starting within 2 hours)
  if (status.starts_in_seconds && status.starts_in_seconds < 7200) {
    return (
      <div 
        className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-2 px-4"
        data-testid="happy-hour-teaser"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="text-sm">
            <span className="font-bold text-yellow-400">{t.happyHour}</span>
            {' '}{t.startsIn}:{' '}
            <span className="font-mono font-bold">{timeLeft}</span>
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default HappyHourBanner;
