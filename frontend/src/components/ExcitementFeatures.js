import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Gift, Clock, Target, Swords, AlertTriangle, Sparkles, Trophy } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

// ==================== JACKPOT DISPLAY ====================
export function JackpotDisplay({ auctionId, className = '' }) {
  const [jackpot, setJackpot] = useState(null);

  useEffect(() => {
    const fetchJackpot = async () => {
      try {
        const res = await fetch(`${API}/api/excitement/jackpot/${auctionId}`);
        const data = await res.json();
        if (data.has_jackpot) {
          setJackpot(data);
        }
      } catch (err) {
        console.error('Jackpot fetch error:', err);
      }
    };
    fetchJackpot();
    const interval = setInterval(fetchJackpot, 5000);
    return () => clearInterval(interval);
  }, [auctionId]);

  if (!jackpot) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-xl p-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <Trophy className="w-6 h-6 text-black animate-bounce" />
        <div>
          <p className="text-black font-bold text-sm">JACKPOT</p>
          <p className="text-black text-xl font-black">
            +{jackpot.current_jackpot} Gebote
          </p>
        </div>
      </div>
      <p className="text-black/70 text-xs mt-1">Gewinner erhält den Jackpot!</p>
    </motion.div>
  );
}

// ==================== LUCKY BID COUNTER ====================
export function LuckyBidCounter({ className = '' }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API}/api/excitement/lucky-bid/status`);
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error('Lucky bid status error:', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const isClose = status.bids_until_lucky <= 10;

  return (
    <motion.div
      animate={isClose ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.5 }}
      className={`bg-gradient-to-r ${isClose ? 'from-[#10B981] to-[#059669]' : 'from-[#7C3AED] to-[#5B21B6]'} rounded-xl p-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <Gift className={`w-5 h-5 text-white ${isClose ? 'animate-bounce' : ''}`} />
        <div>
          <p className="text-white/80 text-xs">LUCKY BID</p>
          <p className="text-white font-bold">
            Noch <span className="text-2xl">{status.bids_until_lucky}</span> Gebote
          </p>
        </div>
      </div>
      <p className="text-white/60 text-xs mt-1">
        Gewinne {status.lucky_bid_reward} Gratis-Gebote!
      </p>
    </motion.div>
  );
}

// ==================== LUCKY BID CELEBRATION ====================
export function LuckyBidCelebration({ show, reward, onClose }) {
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          className="bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-3xl p-8 text-center max-w-md mx-4"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            <Gift className="w-24 h-24 text-black mx-auto" />
          </motion.div>
          <h2 className="text-4xl font-black text-black mt-4">🎉 LUCKY BID!</h2>
          <p className="text-2xl font-bold text-black mt-2">
            +{reward} Gratis-Gebote gewonnen!
          </p>
          <p className="text-black/70 mt-4">Tippen zum Schließen</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== HAPPY HOUR BANNER ====================
const happyHourTexts = {
  de: {
    title: 'HAPPY HOUR!',
    subtitle: 'DOPPELTE GEBOTE beim Kauf!',
    endsIn: 'Endet in'
  },
  en: {
    title: 'HAPPY HOUR!',
    subtitle: 'DOUBLE BIDS on purchase!',
    endsIn: 'Ends in'
  },
  sq: {
    title: 'ORA E LUMTUR!',
    subtitle: 'OFERTA TË DYFISHTA me blerje!',
    endsIn: 'Përfundon në'
  },
  xk: {
    title: 'ORA E LUMTUR!',
    subtitle: 'OFERTA TË DYFISHTA me blerje!',
    endsIn: 'Përfundon në'
  },
  tr: {
    title: 'MUTLU SAAT!',
    subtitle: 'Satın almada ÇİFT TEKLİF!',
    endsIn: 'Bitiş'
  },
  fr: {
    title: 'HAPPY HOUR!',
    subtitle: 'DOUBLE ENCHÈRES à l\'achat!',
    endsIn: 'Finit dans'
  }
};

export function HappyHourBanner({ className = '' }) {
  const { language, mappedLanguage } = useLanguage();
  const langKey = mappedLanguage || language;
  const t = happyHourTexts[langKey] || happyHourTexts.de;
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API}/api/excitement/happy-hour/status`);
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error('Happy hour status error:', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!status?.is_active) return null;

  const minutes = Math.floor(status.remaining_seconds / 60);
  const seconds = status.remaining_seconds % 60;

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`bg-gradient-to-r from-[#FF6B6B] via-[#FFE66D] to-[#FF6B6B] bg-[length:200%_100%] animate-gradient rounded-xl p-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 0.3 }}
          >
            <Zap className="w-8 h-8 text-black" />
          </motion.div>
          <div>
            <p className="text-black font-black text-lg">🔥 {t.title}</p>
            <p className="text-black/80 font-bold">{t.subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-black/60 text-sm">{t.endsIn}</p>
          <p className="text-black font-black text-2xl">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ==================== BLITZ COUNTDOWN ====================
export function BlitzCountdown({ remainingSeconds, className = '' }) {
  const isBlitz = remainingSeconds <= 10;
  const isCritical = remainingSeconds <= 5;

  if (!isBlitz) return null;

  return (
    <motion.div
      animate={isCritical ? {
        scale: [1, 1.1, 1],
        backgroundColor: ['#EF4444', '#DC2626', '#EF4444']
      } : {}}
      transition={{ repeat: Infinity, duration: 0.3 }}
      className={`absolute inset-0 pointer-events-none z-10 ${className}`}
    >
      {/* Pulsing red overlay */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ repeat: Infinity, duration: 0.5 }}
        className="absolute inset-0 bg-red-500/30 rounded-xl"
      />
      
      {/* Critical countdown text */}
      {isCritical && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 0.3 }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <span className="text-6xl font-black text-white drop-shadow-[0_0_20px_rgba(255,0,0,1)]">
            {remainingSeconds}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

// ==================== DUEL MODE DISPLAY ====================
export function DuelModeDisplay({ auctionId, className = '' }) {
  const [duel, setDuel] = useState(null);

  useEffect(() => {
    const checkDuel = async () => {
      try {
        const res = await fetch(`${API}/api/excitement/duel/check/${auctionId}`);
        const data = await res.json();
        if (data.is_duel) {
          setDuel(data);
        } else {
          setDuel(null);
        }
      } catch (err) {
        console.error('Duel check error:', err);
      }
    };
    checkDuel();
    const interval = setInterval(checkDuel, 3000);
    return () => clearInterval(interval);
  }, [auctionId]);

  if (!duel) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#EF4444] bg-[length:200%_100%] animate-gradient rounded-xl p-3 ${className}`}
    >
      <div className="flex items-center justify-center gap-3">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 0.3 }}
        >
          <Swords className="w-6 h-6 text-white" />
        </motion.div>
        <div className="text-center">
          <p className="text-white font-black">⚔️ DUELL!</p>
          <p className="text-white/90 text-sm font-bold">
            {duel.duelers[0]} vs. {duel.duelers[1]}
          </p>
        </div>
        <motion.div
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ repeat: Infinity, duration: 0.3 }}
        >
          <Swords className="w-6 h-6 text-white transform scale-x-[-1]" />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ==================== SNIPER ALERT ====================
export function SniperAlert({ show, sniperName, onClose }) {
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="fixed top-20 right-4 z-50 max-w-sm"
      >
        <motion.div
          animate={{ x: [0, 5, -5, 0] }}
          transition={{ repeat: 3, duration: 0.1 }}
          className="bg-gradient-to-r from-[#DC2626] to-[#B91C1C] rounded-xl p-4 shadow-2xl border-2 border-[#FCA5A5]"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
            >
              <AlertTriangle className="w-8 h-8 text-yellow-300" />
            </motion.div>
            <div>
              <p className="text-white font-black">⚠️ SNIPER ERKANNT!</p>
              <p className="text-white/90 text-sm">
                {sniperName} versucht in letzter Sekunde zu bieten!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-2 text-white/60 text-xs hover:text-white"
          >
            Schließen
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== TURBO AUCTION BADGE ====================
export function TurboBadge({ className = '' }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ repeat: Infinity, duration: 0.5 }}
      className={`bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] rounded-full px-3 py-1 ${className}`}
    >
      <div className="flex items-center gap-1">
        <Zap className="w-4 h-4 text-white" />
        <span className="text-white font-bold text-sm">TURBO</span>
      </div>
    </motion.div>
  );
}

// ==================== MYSTERY AUCTION CARD ====================
export function MysteryAuctionOverlay({ className = '' }) {
  return (
    <motion.div
      animate={{ opacity: [0.8, 1, 0.8] }}
      transition={{ repeat: Infinity, duration: 2 }}
      className={`absolute inset-0 bg-gradient-to-br from-[#1F2937] to-[#111827] rounded-xl flex items-center justify-center ${className}`}
    >
      <div className="text-center">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <Sparkles className="w-16 h-16 text-[#FFD700] mx-auto" />
        </motion.div>
        <p className="text-white font-black text-xl mt-2">🎲 MYSTERY</p>
        <p className="text-white/60 text-sm">Was verbirgt sich?</p>
      </div>
    </motion.div>
  );
}

// ==================== EXCITEMENT STATUS BAR ====================

const statusTranslations = {
  de: { live: "LIVE", hot: "HEISS", warm: "WARM", cold: "RUHIG" },
  en: { live: "LIVE", hot: "HOT", warm: "WARM", cold: "QUIET" },
  sq: { live: "LIVE", hot: "NXEHTË", warm: "NGROHTË", cold: "QETË" },
  xk: { live: "LIVE", hot: "NXEHTË", warm: "NGROHTË", cold: "QETË" },
  tr: { live: "CANLI", hot: "SICAK", warm: "ILIK", cold: "SAKİN" },
  fr: { live: "EN DIRECT", hot: "CHAUD", warm: "TIÈDE", cold: "CALME" },
  ar: { live: "مباشر", hot: "ساخن", warm: "دافئ", cold: "هادئ" },
  ae: { live: "مباشر", hot: "ساخن", warm: "دافئ", cold: "هادئ" },
  es: { live: "EN VIVO", hot: "CALIENTE", warm: "TIBIO", cold: "TRANQUILO" },
  it: { live: "DAL VIVO", hot: "CALDO", warm: "TIEPIDO", cold: "CALMO" }
};

export function ExcitementStatusBar({ className = '' }) {
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const t = statusTranslations[langKey] || statusTranslations.de;
  
  // Dynamic excitement level (35-90%)
  const [excitement, setExcitement] = useState(() => {
    // Random value between 35-90 on mount
    return Math.floor(Math.random() * (90 - 35 + 1)) + 35;
  });
  
  // Update excitement periodically to simulate live activity
  useEffect(() => {
    const interval = setInterval(() => {
      setExcitement(prev => {
        // Random change between -5 and +5
        const change = Math.floor(Math.random() * 11) - 5;
        const newValue = prev + change;
        // Keep within 35-90 range
        return Math.max(35, Math.min(90, newValue));
      });
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Determine status label based on excitement
  const getStatusLabel = () => {
    if (excitement >= 75) return { text: t.hot, color: 'bg-red-100 text-red-600' };
    if (excitement >= 55) return { text: t.warm, color: 'bg-orange-100 text-orange-600' };
    return { text: t.cold, color: 'bg-blue-100 text-blue-600' };
  };
  
  const status = getStatusLabel();
  
  return (
    <div className={`bg-white rounded-lg p-2 flex items-center gap-2 shadow-sm border border-cyan-200 ${className}`}>
      <div className="text-cyan-600 font-bold text-xs whitespace-nowrap">{t.live}</div>
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden min-w-[60px]">
        <div 
          className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-500"
          style={{ width: `${excitement}%` }}
        />
      </div>
      <div className="text-cyan-800 font-bold text-xs whitespace-nowrap">{excitement}%</div>
      <div className={`${status.color} px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap`}>
        🔥 {status.text}
      </div>
    </div>
  );
}

// CSS for gradient animation (add to your global CSS)
const styles = `
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.animate-gradient {
  animation: gradient 2s ease infinite;
}
`;

// Export all components
export default {
  JackpotDisplay,
  LuckyBidCounter,
  LuckyBidCelebration,
  HappyHourBanner,
  BlitzCountdown,
  DuelModeDisplay,
  SniperAlert,
  TurboBadge,
  MysteryAuctionOverlay,
  ExcitementStatusBar
};
