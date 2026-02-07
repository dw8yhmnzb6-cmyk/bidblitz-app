import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, Gift } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations for the Jackpot component
const translations = {
  de: {
    jackpot: "JACKPOT",
    bids: "Gebote",
    value: "Wert",
    everyBid: "Jedes Gebot = +1 zum Jackpot",
    lastWinner: "Letzter Gewinner"
  },
  en: {
    jackpot: "JACKPOT",
    bids: "Bids",
    value: "Value",
    everyBid: "Every bid = +1 to Jackpot",
    lastWinner: "Last Winner"
  },
  sq: {
    jackpot: "JACKPOT",
    bids: "Oferta",
    value: "Vlera",
    everyBid: "Çdo ofertë = +1 në Jackpot",
    lastWinner: "Fituesi i Fundit"
  },
  xk: {
    jackpot: "JACKPOT",
    bids: "Oferta",
    value: "Vlera",
    everyBid: "Çdo ofertë = +1 në Jackpot",
    lastWinner: "Fituesi i Fundit"
  },
  tr: {
    jackpot: "JACKPOT",
    bids: "Teklifler",
    value: "Değer",
    everyBid: "Her teklif = +1 Jackpot'a",
    lastWinner: "Son Kazanan"
  },
  fr: {
    jackpot: "JACKPOT",
    bids: "Enchères",
    value: "Valeur",
    everyBid: "Chaque enchère = +1 au Jackpot",
    lastWinner: "Dernier Gagnant"
  },
  es: {
    jackpot: "JACKPOT",
    bids: "Pujas",
    value: "Valor",
    everyBid: "Cada puja = +1 al Jackpot",
    lastWinner: "Último Ganador"
  },
  it: {
    jackpot: "JACKPOT",
    bids: "Offerte",
    value: "Valore",
    everyBid: "Ogni offerta = +1 al Jackpot",
    lastWinner: "Ultimo Vincitore"
  },
  ru: {
    jackpot: "ДЖЕКПОТ",
    bids: "Ставки",
    value: "Стоимость",
    everyBid: "Каждая ставка = +1 к Джекпоту",
    lastWinner: "Последний Победитель"
  },
  zh: {
    jackpot: "大奖",
    bids: "竞价",
    value: "价值",
    everyBid: "每次竞价 = +1 大奖",
    lastWinner: "上次获奖者"
  },
  ja: {
    jackpot: "ジャックポット",
    bids: "入札",
    value: "価値",
    everyBid: "入札ごとに +1 ジャックポット",
    lastWinner: "前回の当選者"
  }
};

export default function GlobalJackpot({ className = '' }) {
  const { language } = useLanguage();
  const [jackpot, setJackpot] = useState(null);
  const [showIncrease, setShowIncrease] = useState(false);
  
  // Get translations
  const t = translations[language] || translations.de;

  useEffect(() => {
    const fetchJackpot = async () => {
      try {
        const res = await fetch(`${API}/api/excitement/global-jackpot`);
        const data = await res.json();
        
        if (jackpot && data.current_amount > jackpot.current_amount) {
          setShowIncrease(true);
          setTimeout(() => setShowIncrease(false), 1000);
        }
        
        setJackpot(data);
      } catch (err) {
        console.error('Jackpot fetch error:', err);
      }
    };

    fetchJackpot();
    const interval = setInterval(fetchJackpot, 3000);
    return () => clearInterval(interval);
  }, []);

  // Don't render if no jackpot data or if jackpot is disabled
  if (!jackpot || jackpot.is_active === false) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${className}`}
    >
      {/* Jackpot Card - Golden/Amber Style */}
      <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 rounded-xl p-4 shadow-lg overflow-hidden">
        {/* Animated Background Shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-shimmer" />
        
        <div className="relative flex items-center justify-between gap-3">
          {/* Left: Trophy */}
          <motion.div
            animate={{ rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex-shrink-0"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/90 rounded-full flex items-center justify-center shadow-inner">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600" />
            </div>
          </motion.div>

          {/* Center: Amount */}
          <div className="flex-grow text-center">
            <p className="text-amber-900 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              🏆 {t.jackpot}
            </p>
            <div className="flex items-baseline justify-center gap-1">
              <motion.span
                key={jackpot.current_amount}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-2xl sm:text-3xl font-black text-white"
              >
                {jackpot.current_amount.toLocaleString('de-DE')}
              </motion.span>
              <span className="text-sm sm:text-base font-bold text-white">
                {t.bids}
              </span>
              
              {/* +1 Animation */}
              <AnimatePresence>
                {showIncrease && (
                  <motion.span
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: -15 }}
                    exit={{ opacity: 0 }}
                    className="absolute text-white font-bold text-sm"
                  >
                    +1
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <p className="text-amber-100 text-[9px] sm:text-[10px]">
              {t.everyBid}
            </p>
          </div>

          {/* Right: Value */}
          <div className="flex-shrink-0 text-right">
            <div className="bg-white/90 rounded-lg px-2 py-1 shadow-inner">
              <p className="text-amber-900 text-[8px] sm:text-[9px] uppercase tracking-wider font-bold">{t.value}</p>
              <p className="text-amber-600 font-black text-sm sm:text-base">
                €{(jackpot.current_amount * 0.50).toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        {/* Last Winner (if exists) */}
        {jackpot.last_winner && (
          <div className="mt-2 pt-2 border-t border-amber-300 text-center">
            <p className="text-amber-100 text-[9px] sm:text-[10px]">
              🎉 {t.lastWinner}: <span className="font-bold text-white">{jackpot.last_winner}</span>
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Add shimmer animation to global CSS if not exists
const style = document.createElement('style');
style.textContent = `
@keyframes shimmer {
  0% { transform: translateX(-100%) skewX(-12deg); }
  100% { transform: translateX(200%) skewX(-12deg); }
}
.animate-shimmer {
  animation: shimmer 3s ease-in-out infinite;
}
`;
if (typeof document !== 'undefined' && !document.querySelector('[data-jackpot-style]')) {
  style.setAttribute('data-jackpot-style', 'true');
  document.head.appendChild(style);
}
