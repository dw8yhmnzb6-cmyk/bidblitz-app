import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { X, Sparkles, Clock, Trophy, Gift, Zap, Crown, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Wheel segments configuration
const SEGMENTS = [
  { label: '1 Gebot', color: '#FF6B6B', textColor: '#fff' },
  { label: '2 Gebote', color: '#4ECDC4', textColor: '#fff' },
  { label: '3 Gebote', color: '#45B7D1', textColor: '#fff' },
  { label: '5 Gebote', color: '#96CEB4', textColor: '#fff' },
  { label: '10% Rabatt', color: '#FFEAA7', textColor: '#333' },
  { label: '1 Tag VIP', color: '#A855F7', textColor: '#fff' },
  { label: 'Nochmal!', color: '#10B981', textColor: '#fff' },
  { label: '10 Gebote!', color: '#FFD700', textColor: '#333' },
];

const SpinWheel = ({ isOpen, onClose }) => {
  const { token, user, refreshUser } = useAuth();
  const { language } = useLanguage();
  const [spinning, setSpinning] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [nextSpinTime, setNextSpinTime] = useState(null);
  const [result, setResult] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const wheelRef = useRef(null);

  const t = {
    de: {
      title: 'Glücksrad',
      subtitle: 'Drehe jeden Tag für Gratis-Preise!',
      spin: 'Drehen!',
      spinning: 'Dreht...',
      alreadySpun: 'Bereits gedreht!',
      nextSpin: 'Nächste Drehung in:',
      won: 'Gewonnen!',
      close: 'Schließen',
      congrats: 'Herzlichen Glückwunsch!',
      loginRequired: 'Bitte einloggen um zu drehen',
    },
    en: {
      title: 'Lucky Wheel',
      subtitle: 'Spin daily for free prizes!',
      spin: 'Spin!',
      spinning: 'Spinning...',
      alreadySpun: 'Already spun!',
      nextSpin: 'Next spin in:',
      won: 'You won!',
      close: 'Close',
      congrats: 'Congratulations!',
      loginRequired: 'Please login to spin',
    },
    sq: {
      title: 'Rrota e Fatit',
      subtitle: 'Rrotulloje çdo ditë për çmime falas!',
      spin: 'Rrotullo!',
      spinning: 'Duke u rrotulluar...',
      alreadySpun: 'Tashmë rrotulluar!',
      nextSpin: 'Rrotullimi tjetër:',
      won: 'Fitove!',
      close: 'Mbyll',
      congrats: 'Urime!',
      loginRequired: 'Ju lutem kyçuni për të rrotulluar',
    },
    xk: {
      title: 'Rrota e Fatit',
      subtitle: 'Rrotulloje çdo ditë për çmime falas!',
      spin: 'Rrotullo!',
      spinning: 'Duke u rrotulluar...',
      alreadySpun: 'Tashmë rrotulluar!',
      nextSpin: 'Rrotullimi tjetër:',
      won: 'Fitove!',
      close: 'Mbyll',
      congrats: 'Urime!',
      loginRequired: 'Ju lutem kyçuni për të rrotulluar',
    },
    tr: {
      title: 'Şans Çarkı',
      subtitle: 'Günlük çevir, ücretsiz ödüller kazan!',
      spin: 'Çevir!',
      spinning: 'Dönüyor...',
      alreadySpun: 'Bugün çevirdin!',
      nextSpin: 'Sonraki çevirme:',
      won: 'Kazandın!',
      close: 'Kapat',
      congrats: 'Tebrikler!',
      loginRequired: 'Çevirmek için giriş yapın',
    },
    fr: {
      title: 'Roue de la Chance',
      subtitle: 'Tournez chaque jour pour des prix gratuits!',
      spin: 'Tourner!',
      spinning: 'En rotation...',
      alreadySpun: 'Déjà tourné!',
      nextSpin: 'Prochain tour dans:',
      won: 'Vous avez gagné!',
      close: 'Fermer',
      congrats: 'Félicitations!',
      loginRequired: 'Veuillez vous connecter pour tourner',
    }
  };
  const text = t[language] || t.de;

  useEffect(() => {
    if (isOpen && token) {
      checkSpinStatus();
    }
  }, [isOpen, token]);

  const checkSpinStatus = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/wheel/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCanSpin(res.data.can_spin);
      setNextSpinTime(res.data.next_spin_time);
    } catch (err) {
      console.error('Error checking spin status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSpin = async () => {
    if (!canSpin || spinning) return;
    
    setSpinning(true);
    setResult(null);
    
    // Start spinning animation
    const randomSpins = 5 + Math.random() * 3;
    const randomSegment = Math.floor(Math.random() * SEGMENTS.length);
    const segmentAngle = 360 / SEGMENTS.length;
    const targetRotation = rotation + (randomSpins * 360) + (randomSegment * segmentAngle) + (segmentAngle / 2);
    
    setRotation(targetRotation);
    
    try {
      const res = await axios.post(`${API}/api/wheel/spin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Wait for animation to complete
      setTimeout(() => {
        setResult(res.data.prize);
        setSpinning(false);
        setCanSpin(false);
        
        // Refresh user to update bid balance
        if (refreshUser) refreshUser();
        
        toast.success(res.data.message);
      }, 4000);
      
    } catch (err) {
      setSpinning(false);
      const msg = err.response?.data?.detail || 'Fehler beim Drehen';
      toast.error(msg);
      checkSpinStatus();
    }
  };

  const formatTimeRemaining = (isoTime) => {
    if (!isoTime) return '';
    const target = new Date(isoTime);
    const now = new Date();
    const diff = target - now;
    
    if (diff <= 0) {
      checkSpinStatus();
      return '00:00:00';
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const [timeDisplay, setTimeDisplay] = useState('');
  
  useEffect(() => {
    if (nextSpinTime) {
      const interval = setInterval(() => {
        setTimeDisplay(formatTimeRemaining(nextSpinTime));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [nextSpinTime]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" 
      style={{ zIndex: 99999 }}
      data-testid="spin-wheel-modal"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative bg-white rounded-2xl p-4 sm:p-6 w-full max-w-[320px] sm:max-w-sm border border-amber-400 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-500 hover:text-gray-800 z-20"
          data-testid="close-wheel-btn"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{text.title}</h2>
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
          </div>
          <p className="text-gray-500 text-sm sm:text-base">{text.subtitle}</p>
        </div>
        
        {!token ? (
          <div className="text-center py-8">
            <p className="text-gray-500">{text.loginRequired}</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : (
          <>
            {/* Wheel Container - responsive size */}
            <div className="relative w-56 h-56 sm:w-72 sm:h-72 mx-auto mb-4 sm:mb-6">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-amber-500 drop-shadow-lg"></div>
              </div>
              
              {/* Wheel - Fixed for iPad/Safari */}
              <div 
                ref={wheelRef}
                className="w-full h-full rounded-full border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] overflow-hidden"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  WebkitTransform: `rotate(${rotation}deg)`,
                  WebkitTransition: spinning ? '-webkit-transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  willChange: 'transform',
                }}
              >
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {SEGMENTS.map((segment, i) => {
                    const angle = 360 / SEGMENTS.length;
                    const startAngle = i * angle - 90;
                    const endAngle = startAngle + angle;
                    
                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;
                    
                    const x1 = 100 + 100 * Math.cos(startRad);
                    const y1 = 100 + 100 * Math.sin(startRad);
                    const x2 = 100 + 100 * Math.cos(endRad);
                    const y2 = 100 + 100 * Math.sin(endRad);
                    
                    const largeArc = angle > 180 ? 1 : 0;
                    
                    const midAngle = startAngle + angle / 2;
                    const midRad = (midAngle * Math.PI) / 180;
                    const textX = 100 + 65 * Math.cos(midRad);
                    const textY = 100 + 65 * Math.sin(midRad);
                    
                    return (
                      <g key={i}>
                        <path
                          d={`M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`}
                          fill={segment.color}
                          stroke="#1A1A2E"
                          strokeWidth="1"
                        />
                        <text
                          x={textX}
                          y={textY}
                          fill={segment.textColor}
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                        >
                          {segment.label}
                        </text>
                      </g>
                    );
                  })}
                  {/* Center circle */}
                  <circle cx="100" cy="100" r="15" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="3" />
                  <text x="100" y="100" fill="#F59E0B" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                    GO
                  </text>
                </svg>
              </div>
            </div>
            
            {/* Result Display */}
            {result && (
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 text-center animate-pulse" data-testid="wheel-result">
                <p className="text-green-600 text-lg font-bold">{text.congrats}</p>
                <p className="text-gray-800 text-xl flex items-center justify-center gap-2 mt-2">
                  {result.type === 'bids' && <Zap className="w-5 h-5 text-amber-500" />}
                  {result.type === 'discount' && <Gift className="w-5 h-5 text-pink-500" />}
                  {result.type === 'vip_day' && <Crown className="w-5 h-5 text-purple-500" />}
                  {result.type === 'retry' && <RefreshCw className="w-5 h-5 text-green-500" />}
                  {result.label}
                </p>
                {result.code && (
                  <p className="text-amber-600 mt-2 font-mono text-sm">
                    Code: {result.code}
                  </p>
                )}
                {result.type === 'retry' && (
                  <p className="text-green-600 mt-2 text-sm font-medium">
                    {language === 'de' ? 'Du kannst nochmal drehen!' : 
                     language === 'sq' || language === 'xk' ? 'Mund të rrotullosh përsëri!' :
                     language === 'tr' ? 'Tekrar çevirebilirsin!' :
                     language === 'fr' ? 'Tu peux tourner à nouveau!' :
                     'You can spin again!'}
                  </p>
                )}
              </div>
            )}
            
            {/* Spin Button or Timer */}
            {canSpin ? (
              <Button
                onClick={handleSpin}
                onTouchEnd={(e) => { e.preventDefault(); handleSpin(); }}
                disabled={spinning}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-white font-bold text-lg py-6 touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                data-testid="spin-btn"
              >
                {spinning ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    {text.spinning}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    {text.spin}
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center p-4 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-gray-500 text-sm mb-1">{text.nextSpin}</p>
                <p className="text-2xl font-mono text-amber-500 flex items-center justify-center gap-2">
                  <Clock className="w-5 h-5" />
                  {timeDisplay || formatTimeRemaining(nextSpinTime)}
                </p>
              </div>
            )}
          </>
        )}
        </div>
    </div>
  );
};

export default SpinWheel;
