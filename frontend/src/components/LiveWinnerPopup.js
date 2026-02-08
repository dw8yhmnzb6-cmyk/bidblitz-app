import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, X, Sparkles } from 'lucide-react';

/**
 * Live Winner Popup Component
 * Shows real-time notifications when someone wins an auction
 * Creates FOMO and social proof
 */

// Translations
const translations = {
  de: {
    justWon: 'hat gerade gewonnen!',
    for: 'für nur',
    saved: 'gespart',
    viewWinners: 'Alle Gewinner',
    congrats: 'Herzlichen Glückwunsch!'
  },
  en: {
    justWon: 'just won!',
    for: 'for only',
    saved: 'saved',
    viewWinners: 'All Winners',
    congrats: 'Congratulations!'
  },
  tr: {
    justWon: 'kazandı!',
    for: 'sadece',
    saved: 'tasarruf',
    viewWinners: 'Tüm Kazananlar',
    congrats: 'Tebrikler!'
  },
  fr: {
    justWon: 'vient de gagner!',
    for: 'pour seulement',
    saved: 'économisé',
    viewWinners: 'Tous les Gagnants',
    congrats: 'Félicitations!'
  },
  es: {
    justWon: '¡acaba de ganar!',
    for: 'por solo',
    saved: 'ahorrado',
    viewWinners: 'Todos los Ganadores',
    congrats: '¡Felicidades!'
  },
  sq: {
    justWon: 'sapo fitoi!',
    for: 'për vetëm',
    saved: 'kursyer',
    viewWinners: 'Të Gjithë Fituesit',
    congrats: 'Urime!'
  },
  xk: {
    justWon: 'sapo fitoi!',
    for: 'për vetëm',
    saved: 'kursyer',
    viewWinners: 'Të Gjithë Fituesit',
    congrats: 'Urime!'
  }
};

// Language mapping for regional variants
const langMapping = {
  'xk': 'sq',  // Kosovo -> Albanian
  'us': 'en',  // US English -> English  
  'ae': 'ar', // UAE -> Arabic
};

const getMappedLang = (lang) => langMapping[lang] || lang;

const LiveWinnerPopup = ({ language = 'de' }) => {
  const [winners, setWinners] = useState([]);
  const [currentWinner, setCurrentWinner] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  const langKey = getMappedLang(language);
  const t = translations[langKey] || translations.de;

  // Fetch recent winners
  const fetchWinners = useCallback(async () => {
    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      const res = await fetch(`${API}/api/winners?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setWinners(data || []);
      }
    } catch (e) {
      console.error('Error fetching winners:', e);
    }
  }, []);

  // Show random winner popup periodically
  useEffect(() => {
    fetchWinners();
    
    // Refresh winners every 30 seconds
    const fetchInterval = setInterval(fetchWinners, 30000);
    
    // Show popup every 45-90 seconds
    const showPopup = () => {
      if (winners.length > 0) {
        const randomWinner = winners[Math.floor(Math.random() * winners.length)];
        setCurrentWinner(randomWinner);
        setIsVisible(true);
        
        // Hide after 6 seconds
        setTimeout(() => setIsVisible(false), 6000);
      }
    };
    
    // Initial delay of 10 seconds
    const initialTimeout = setTimeout(() => {
      showPopup();
      // Then show every 45-90 seconds
      const popupInterval = setInterval(showPopup, 45000 + Math.random() * 45000);
      return () => clearInterval(popupInterval);
    }, 10000);
    
    return () => {
      clearInterval(fetchInterval);
      clearTimeout(initialTimeout);
    };
  }, [winners.length, fetchWinners]);

  // Listen for WebSocket winner events
  useEffect(() => {
    const wsUrl = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
    if (!wsUrl) return;

    const ws = new WebSocket(`${wsUrl}/api/ws/auctions`);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'auction_ended' && msg.data?.winner_name) {
          setCurrentWinner({
            winner_name: msg.data.winner_name,
            final_price: msg.data.final_price,
            product: msg.data.product,
            ended_at: new Date().toISOString()
          });
          setIsVisible(true);
          setTimeout(() => setIsVisible(false), 8000);
        }
      } catch (e) {}
    };

    return () => ws.close();
  }, []);

  if (!isVisible || !currentWinner) return null;

  const product = currentWinner.product || {};
  const savings = product.retail_price 
    ? Math.round((1 - (currentWinner.final_price || 0) / product.retail_price) * 100)
    : 95;

  return (
    <div 
      className="fixed bottom-20 left-4 z-50 animate-slide-in-left"
      data-testid="winner-popup"
    >
      <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 rounded-xl p-1 shadow-2xl max-w-sm">
        <div className="bg-white rounded-lg p-4 relative">
          {/* Close button */}
          <button 
            onClick={() => setIsVisible(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
          
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-amber-600 font-bold text-sm flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                {t.congrats}
              </p>
            </div>
          </div>
          
          {/* Winner Info */}
          <div className="flex gap-3">
            {/* Product Image */}
            <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt="" 
                  className="max-w-full max-h-full object-contain p-1"
                />
              ) : (
                <Trophy className="w-8 h-8 text-yellow-500" />
              )}
            </div>
            
            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="text-gray-800 font-bold text-sm">
                {currentWinner.winner_name} {t.justWon}
              </p>
              <p className="text-gray-500 text-xs truncate">
                {product.name || 'Premium Produkt'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-green-600 font-bold">
                  {t.for} €{(currentWinner.final_price || 0).toFixed(2)}
                </span>
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  -{savings}%
                </span>
              </div>
            </div>
          </div>
          
          {/* View All Winners Link */}
          <button 
            onClick={() => navigate('/winners')}
            className="mt-3 w-full py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-white font-bold text-xs rounded-lg transition-all"
          >
            {t.viewWinners} →
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-in-left {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LiveWinnerPopup;
