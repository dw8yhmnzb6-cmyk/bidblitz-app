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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" data-testid="spin-wheel-modal">
      <div className="relative bg-gradient-to-br from-[#1A1A2E] to-[#16213E] rounded-2xl p-6 max-w-md w-full border border-yellow-500/30 shadow-2xl">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
          data-testid="close-wheel-btn"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">{text.title}</h2>
            <Sparkles className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-gray-400">{text.subtitle}</p>
        </div>
        
        {!token ? (
          <div className="text-center py-8">
            <p className="text-gray-400">{text.loginRequired}</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
          </div>
        ) : (
          <>
            {/* Wheel Container */}
            <div className="relative w-72 h-72 mx-auto mb-6">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg"></div>
              </div>
              
              {/* Wheel */}
              <div 
                ref={wheelRef}
                className="w-full h-full rounded-full border-4 border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.3)] overflow-hidden"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
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
                  <circle cx="100" cy="100" r="15" fill="#1A1A2E" stroke="#FFD700" strokeWidth="3" />
                  <text x="100" y="100" fill="#FFD700" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                    GO
                  </text>
                </svg>
              </div>
            </div>
            
            {/* Result Display */}
            {result && (
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-center animate-pulse" data-testid="wheel-result">
                <p className="text-green-400 text-lg font-bold">{text.congrats}</p>
                <p className="text-white text-xl flex items-center justify-center gap-2 mt-2">
                  {result.type === 'bids' && <Zap className="w-5 h-5 text-yellow-400" />}
                  {result.type === 'discount' && <Gift className="w-5 h-5 text-pink-400" />}
                  {result.type === 'vip_day' && <Crown className="w-5 h-5 text-purple-400" />}
                  {result.type === 'retry' && <RefreshCw className="w-5 h-5 text-green-400" />}
                  {result.label}
                </p>
                {result.code && (
                  <p className="text-yellow-400 mt-2 font-mono text-sm">
                    Code: {result.code}
                  </p>
                )}
              </div>
            )}
            
            {/* Spin Button or Timer */}
            {canSpin ? (
              <Button
                onClick={handleSpin}
                disabled={spinning}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-bold text-lg py-6"
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
              <div className="text-center p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">{text.nextSpin}</p>
                <p className="text-2xl font-mono text-yellow-400 flex items-center justify-center gap-2">
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
