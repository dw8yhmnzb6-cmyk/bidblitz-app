import { useState, useEffect, useCallback } from 'react';
import { X, Gift, Clock, Users, Zap, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * ExitIntentPopup - Shows when user is about to leave the page
 */
export function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already dismissed in this session
    if (sessionStorage.getItem('exitIntentDismissed')) {
      setDismissed(true);
      return;
    }

    const handleMouseLeave = (e) => {
      // Only trigger when mouse leaves through top of page
      if (e.clientY <= 0 && !dismissed && !isAuthenticated) {
        setShow(true);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [dismissed, isAuthenticated]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem('exitIntentDismissed', 'true');
  };

  const handleClaim = () => {
    handleDismiss();
    navigate('/register');
  };

  if (!show || isAuthenticated) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 relative shadow-2xl animate-scale-in">
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Gift className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Warte! 🎁
          </h2>
          <p className="text-gray-600 mb-4">
            Bevor du gehst - hier sind <span className="font-bold text-amber-600">5 Gratis-Gebote</span> für dich!
          </p>
          
          <div className="bg-amber-50 rounded-xl p-4 mb-6">
            <p className="text-amber-800 font-medium">
              Registriere dich jetzt und erhalte:
            </p>
            <ul className="text-amber-700 text-sm mt-2 space-y-1">
              <li>✓ 5 kostenlose Gebote</li>
              <li>✓ Zugang zu exklusiven Auktionen</li>
              <li>✓ Tägliche Belohnungen</li>
            </ul>
          </div>
          
          <Button 
            onClick={handleClaim}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-lg py-6"
          >
            Jetzt Gratis-Gebote sichern!
          </Button>
          
          <p className="text-xs text-gray-400 mt-3">
            Keine Kreditkarte erforderlich
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

/**
 * LiveActivityTicker - Shows real-time activity
 */
export function LiveActivityTicker({ activities = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Rotate through activities
  useEffect(() => {
    if (activities.length === 0) return;
    
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % activities.length);
        setVisible(true);
      }, 300);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [activities.length]);

  if (activities.length === 0) return null;

  const current = activities[currentIndex];

  return (
    <div className={`fixed bottom-4 left-4 z-40 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 max-w-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            {current.type === 'win' && <span className="text-lg">🏆</span>}
            {current.type === 'bid' && <Zap className="w-5 h-5 text-amber-500" />}
            {current.type === 'join' && <Users className="w-5 h-5 text-blue-500" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-800 font-medium truncate">
              {current.message}
            </p>
            <p className="text-xs text-gray-500">
              vor {current.time}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ViewerCount - Shows how many people are viewing
 */
export function ViewerCount({ count = 0, auctionId }) {
  const [viewers, setViewers] = useState(count);
  
  useEffect(() => {
    // Simulate slight fluctuations
    const interval = setInterval(() => {
      setViewers(prev => {
        const change = Math.floor(Math.random() * 5) - 2;
        return Math.max(1, prev + change);
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (viewers < 2) return null;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <div className="relative">
        <Users className="w-4 h-4 text-cyan-500" />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      </div>
      <span className="text-gray-600">
        <span className="font-bold text-cyan-600">{viewers}</span> schauen gerade
      </span>
    </div>
  );
}

/**
 * StockWarning - FOMO element for low stock
 */
export function StockWarning({ stock = 0, threshold = 5 }) {
  if (stock > threshold || stock <= 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
      <span className="text-red-500 animate-pulse">⚠️</span>
      <span className="text-red-700 text-sm font-medium">
        Nur noch {stock} auf Lager!
      </span>
    </div>
  );
}

/**
 * CountdownUrgency - Shows urgency countdown
 */
export function CountdownUrgency({ endTime, label = "Endet in" }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const end = new Date(endTime);
      const now = new Date();
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft('Beendet');
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      setIsUrgent(minutes < 5);
      
      if (minutes > 60) {
        const hours = Math.floor(minutes / 60);
        setTimeLeft(`${hours}h ${minutes % 60}m`);
      } else {
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
      isUrgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'
    }`}>
      <Clock className="w-4 h-4" />
      <span className="font-medium">{label}:</span>
      <span className="font-bold">{timeLeft}</span>
      {isUrgent && <span className="text-xs">🔥</span>}
    </div>
  );
}

/**
 * RecentWinnerBanner - Shows recent winner as social proof
 */
export function RecentWinnerBanner({ winner }) {
  const [visible, setVisible] = useState(true);

  if (!winner || !visible) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 animate-slide-down">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full px-6 py-2 shadow-lg flex items-center gap-3">
        <span className="text-lg">🎉</span>
        <span className="font-medium">
          <span className="font-bold">{winner.name}</span> hat gerade{' '}
          <span className="font-bold">{winner.product}</span> gewonnen!
        </span>
        <button onClick={() => setVisible(false)} className="ml-2 hover:opacity-70">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <style>{`
        @keyframes slide-down {
          from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        .animate-slide-down { animation: slide-down 0.4s ease-out; }
      `}</style>
    </div>
  );
}

/**
 * FirstTimeBuyerBadge - Shows first-time buyer bonus
 */
export function FirstTimeBuyerBadge({ discount = 50 }) {
  return (
    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl p-4 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          <Gift className="w-6 h-6" />
        </div>
        <div>
          <p className="font-bold text-lg">Erstkäufer-Bonus!</p>
          <p className="text-purple-200 text-sm">
            {discount}% mehr Gebote bei deinem ersten Kauf!
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * TrendingBadge - Shows trending auctions
 */
export function TrendingBadge({ bidCount = 0 }) {
  if (bidCount < 10) return null;

  return (
    <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium">
      <TrendingUp className="w-3 h-3" />
      Trending ({bidCount} Gebote)
    </div>
  );
}

export default ExitIntentPopup;
