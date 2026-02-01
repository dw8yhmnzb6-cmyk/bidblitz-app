import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { X, Gift, Sparkles, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Wheel segments with prizes
const prizes = [
  { id: 1, label: '1', value: 1, type: 'bids', color: '#FF6B6B', probability: 25 },
  { id: 2, label: '2', value: 2, type: 'bids', color: '#4ECDC4', probability: 20 },
  { id: 3, label: '3', value: 3, type: 'bids', color: '#45B7D1', probability: 15 },
  { id: 4, label: '5', value: 5, type: 'bids', color: '#96CEB4', probability: 10 },
  { id: 5, label: '10%', value: 10, type: 'discount', color: '#FFEAA7', probability: 12 },
  { id: 6, label: 'VIP', value: 1, type: 'vip_day', color: '#DDA0DD', probability: 5 },
  { id: 7, label: '🔄', value: 0, type: 'retry', color: '#FF9FF3', probability: 8 },
  { id: 8, label: '10', value: 10, type: 'bids', color: '#54A0FF', probability: 5 },
];

// Translations
const wheelTexts = {
  de: {
    title: 'Glücksrad',
    subtitle: 'Drehe täglich für Gratis-Preise!',
    spin: 'DREHEN!',
    spinning: 'Dreht...',
    alreadySpun: 'Morgen wieder!',
    close: 'Schließen',
    wonBids: 'Glückwunsch! Du hast {value} Gratis-Gebote gewonnen!',
    wonDiscount: 'Super! {value}% Rabatt auf dein nächstes Gebotspaket!',
    wonVip: 'Wow! Du hast 1 Tag VIP-Mitgliedschaft gewonnen!',
    wonRetry: 'Nochmal drehen! Du hast einen Freidreh gewonnen!',
    loginRequired: 'Bitte melde dich an um zu drehen',
    nextSpin: 'Nächster Dreh in',
    hours: 'Std',
    minutes: 'Min',
    bids: 'Gebote',
    discount: 'Rabatt',
    vipDay: 'VIP Tag',
    freeRetry: 'Freidreh'
  },
  en: {
    title: 'Lucky Wheel',
    subtitle: 'Spin daily for free prizes!',
    spin: 'SPIN!',
    spinning: 'Spinning...',
    alreadySpun: 'Come back tomorrow!',
    close: 'Close',
    wonBids: 'Congratulations! You won {value} free bids!',
    wonDiscount: 'Great! {value}% discount on your next bid package!',
    wonVip: 'Wow! You won 1 day VIP membership!',
    wonRetry: 'Spin again! You won a free retry!',
    loginRequired: 'Please login to spin',
    nextSpin: 'Next spin in',
    hours: 'hrs',
    minutes: 'min',
    bids: 'Bids',
    discount: 'Discount',
    vipDay: 'VIP Day',
    freeRetry: 'Free Retry'
  },
  tr: {
    title: 'Şans Çarkı',
    subtitle: 'Ücretsiz ödüller için günlük çevirin!',
    spin: 'ÇEVİR!',
    spinning: 'Dönüyor...',
    alreadySpun: 'Yarın tekrar gel!',
    close: 'Kapat',
    wonBids: 'Tebrikler! {value} ücretsiz teklif kazandın!',
    wonDiscount: 'Harika! Sonraki teklif paketinde {value}% indirim!',
    wonVip: 'Vay! 1 günlük VIP üyelik kazandın!',
    wonRetry: 'Tekrar çevir! Ücretsiz çevirme hakkı kazandın!',
    loginRequired: 'Çevirmek için giriş yapın',
    nextSpin: 'Sonraki çevirme',
    hours: 'sa',
    minutes: 'dk',
    bids: 'Teklifler',
    discount: 'İndirim',
    vipDay: 'VIP Günü',
    freeRetry: 'Ücretsiz Çevirme'
  },
  sq: {
    title: 'Rrota e Fatit',
    subtitle: 'Rrotullo çdo ditë për çmime falas!',
    spin: 'RROTULLONI!',
    spinning: 'Duke u rrotulluar...',
    alreadySpun: 'Kthehu nesër!',
    close: 'Mbyll',
    wonBids: 'Urime! Fituat {value} oferta falas!',
    wonDiscount: 'Shkëlqyeshëm! {value}% zbritje në paketën e ardhshme!',
    wonVip: 'Uau! Fituat 1 ditë anëtarësim VIP!',
    wonRetry: 'Rrotullo përsëri! Fituat një rrotullim falas!',
    loginRequired: 'Ju lutem hyni për të rrotulluar',
    nextSpin: 'Rrotullimi i ardhshëm',
    hours: 'orë',
    minutes: 'min',
    bids: 'Oferta',
    discount: 'Zbritje',
    vipDay: 'Ditë VIP',
    freeRetry: 'Rrotullim Falas'
  },
  fr: {
    title: 'Roue de la Fortune',
    subtitle: 'Tournez chaque jour pour des prix gratuits!',
    spin: 'TOURNER!',
    spinning: 'Tourne...',
    alreadySpun: 'Revenez demain!',
    close: 'Fermer',
    wonBids: 'Félicitations! Vous avez gagné {value} enchères gratuites!',
    wonDiscount: 'Super! {value}% de réduction sur votre prochain forfait!',
    wonVip: 'Wow! Vous avez gagné 1 jour VIP!',
    wonRetry: 'Tournez encore! Vous avez gagné un tour gratuit!',
    loginRequired: 'Connectez-vous pour tourner',
    nextSpin: 'Prochain tour dans',
    hours: 'h',
    minutes: 'min',
    bids: 'Enchères',
    discount: 'Réduction',
    vipDay: 'Jour VIP',
    freeRetry: 'Tour Gratuit'
  }
};

export default function SpinWheel({ isOpen, onClose }) {
  const { language } = useLanguage();
  const { isAuthenticated, token, refreshUser } = useAuth();
  const t = wheelTexts[language] || wheelTexts.de;
  
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [canSpin, setCanSpin] = useState(true);
  const [nextSpinTime, setNextSpinTime] = useState(null);
  const [wonPrize, setWonPrize] = useState(null);
  const [hasRetry, setHasRetry] = useState(false);

  // Check if user can spin today
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      checkSpinStatus();
    }
  }, [isAuthenticated, isOpen]);

  const checkSpinStatus = async () => {
    try {
      const response = await axios.get(`${API}/wheel/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCanSpin(response.data.can_spin);
      if (response.data.next_spin_time) {
        setNextSpinTime(new Date(response.data.next_spin_time));
      }
    } catch (error) {
      console.error('Error checking spin status:', error);
    }
  };

  const spinWheel = async () => {
    if (!isAuthenticated) {
      toast.error(t.loginRequired);
      return;
    }
    
    if (!canSpin && !hasRetry) {
      toast.error(t.alreadySpun);
      return;
    }

    setSpinning(true);
    setWonPrize(null);
    
    try {
      const response = await axios.post(`${API}/wheel/spin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const prize = response.data.prize;
      const prizeIndex = prizes.findIndex(p => p.type === prize.type && p.value === prize.value);
      
      // Calculate rotation to land on the prize
      const segmentAngle = 360 / prizes.length;
      const targetAngle = prizeIndex * segmentAngle;
      const spins = 5; // Number of full rotations
      const finalRotation = rotation + (spins * 360) + (360 - targetAngle) + (segmentAngle / 2);
      
      setRotation(finalRotation);
      
      // Wait for animation to complete
      setTimeout(() => {
        setSpinning(false);
        setWonPrize(prize);
        
        // Show appropriate message
        if (prize.type === 'bids') {
          toast.success(t.wonBids.replace('{value}', prize.value));
          refreshUser();
        } else if (prize.type === 'discount') {
          toast.success(t.wonDiscount.replace('{value}', prize.value));
        } else if (prize.type === 'vip_day') {
          toast.success(t.wonVip);
        } else if (prize.type === 'retry') {
          toast.success(t.wonRetry);
          setHasRetry(true);
          setCanSpin(true);
          return;
        }
        
        setCanSpin(false);
        setHasRetry(false);
        setNextSpinTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
      }, 5000);
      
    } catch (error) {
      setSpinning(false);
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  // Countdown timer
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0 });
  
  useEffect(() => {
    if (!nextSpinTime || canSpin) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const diff = nextSpinTime - now;
      
      if (diff <= 0) {
        setCanSpin(true);
        setNextSpinTime(null);
        return;
      }
      
      setCountdown({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [nextSpinTime, canSpin]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] rounded-3xl p-6 max-w-md w-full relative overflow-hidden">
        {/* Background sparkles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <Sparkles
              key={i}
              className="absolute text-yellow-400/20 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                width: `${10 + Math.random() * 20}px`
              }}
            />
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 relative">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Gift className="w-8 h-8 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">{t.title}</h2>
          </div>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Wheel */}
        <div className="relative w-72 h-72 mx-auto mb-6">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
          </div>
          
          {/* Wheel SVG */}
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full drop-shadow-2xl"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
            }}
          >
            {prizes.map((prize, index) => {
              const angle = (360 / prizes.length);
              const startAngle = index * angle - 90;
              const endAngle = startAngle + angle;
              
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              
              const x1 = 100 + 95 * Math.cos(startRad);
              const y1 = 100 + 95 * Math.sin(startRad);
              const x2 = 100 + 95 * Math.cos(endRad);
              const y2 = 100 + 95 * Math.sin(endRad);
              
              const largeArc = angle > 180 ? 1 : 0;
              
              const textAngle = startAngle + angle / 2;
              const textRad = (textAngle * Math.PI) / 180;
              const textX = 100 + 60 * Math.cos(textRad);
              const textY = 100 + 60 * Math.sin(textRad);
              
              return (
                <g key={prize.id}>
                  <path
                    d={`M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={prize.color}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  <text
                    x={textX}
                    y={textY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#000"
                    fontSize="14"
                    fontWeight="bold"
                    transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
                  >
                    {prize.label}
                  </text>
                </g>
              );
            })}
            {/* Center circle */}
            <circle cx="100" cy="100" r="20" fill="#FFD700" stroke="#fff" strokeWidth="3" />
            <circle cx="100" cy="100" r="8" fill="#fff" />
          </svg>
        </div>

        {/* Prize won display */}
        {wonPrize && !spinning && (
          <div className="text-center mb-4 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
            <div className="flex items-center justify-center gap-2 text-yellow-400">
              <Zap className="w-6 h-6" />
              <span className="text-xl font-bold">
                {wonPrize.type === 'bids' && `+${wonPrize.value} ${t.bids}!`}
                {wonPrize.type === 'discount' && `${wonPrize.value}% ${t.discount}!`}
                {wonPrize.type === 'vip_day' && `1 ${t.vipDay}!`}
                {wonPrize.type === 'retry' && t.freeRetry}
              </span>
            </div>
          </div>
        )}

        {/* Spin button or countdown */}
        {canSpin || hasRetry ? (
          <Button
            onClick={spinWheel}
            disabled={spinning}
            className="w-full py-4 text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black rounded-xl"
            data-testid="spin-button"
          >
            {spinning ? t.spinning : t.spin}
          </Button>
        ) : (
          <div className="text-center p-4 bg-gray-800/50 rounded-xl">
            <p className="text-gray-400 mb-2">{t.nextSpin}</p>
            <p className="text-2xl font-bold text-white">
              {countdown.hours} {t.hours} {countdown.minutes} {t.minutes}
            </p>
          </div>
        )}

        {/* Prize legend */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-center">
          <div className="text-gray-400">
            <div className="w-4 h-4 rounded-full bg-[#FF6B6B] mx-auto mb-1" />
            1-3 {t.bids}
          </div>
          <div className="text-gray-400">
            <div className="w-4 h-4 rounded-full bg-[#54A0FF] mx-auto mb-1" />
            5-10 {t.bids}
          </div>
          <div className="text-gray-400">
            <div className="w-4 h-4 rounded-full bg-[#FFEAA7] mx-auto mb-1" />
            {t.discount}
          </div>
          <div className="text-gray-400">
            <div className="w-4 h-4 rounded-full bg-[#DDA0DD] mx-auto mb-1" />
            VIP
          </div>
        </div>
      </div>
    </div>
  );
}
