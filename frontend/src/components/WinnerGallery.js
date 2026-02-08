import React, { useState, useEffect, memo } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { Trophy, Star, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: "Echte Gewinner",
    subtitle: "Diese Kunden haben bereits gewonnen",
    savedLabel: "gespart",
    wonFor: "Gewonnen für",
    retailPrice: "UVP",
    noWinners: "Noch keine Gewinner diese Woche",
    viewAll: "Alle Gewinner ansehen"
  },
  en: {
    title: "Real Winners",
    subtitle: "These customers have already won",
    savedLabel: "saved",
    wonFor: "Won for",
    retailPrice: "RRP",
    noWinners: "No winners this week yet",
    viewAll: "View all winners"
  },
  sq: {
    title: "Fituesit e Vërtetë",
    subtitle: "Këta klientë kanë fituar tashmë",
    savedLabel: "kursyer",
    wonFor: "Fituar për",
    retailPrice: "MSRP",
    noWinners: "Ende asnjë fitues këtë javë",
    viewAll: "Shiko të gjithë fituesit"
  },
  xk: {
    title: "Fituesit e Vërtetë",
    subtitle: "Këta klientë kanë fituar tashmë",
    savedLabel: "kursyer",
    wonFor: "Fituar për",
    retailPrice: "MSRP",
    noWinners: "Ende asnjë fitues këtë javë",
    viewAll: "Shiko të gjithë fituesit"
  },
  tr: {
    title: "Gerçek Kazananlar",
    subtitle: "Bu müşteriler zaten kazandı",
    savedLabel: "tasarruf",
    wonFor: "Kazanıldı",
    retailPrice: "TSF",
    noWinners: "Bu hafta henüz kazanan yok",
    viewAll: "Tüm kazananları gör"
  },
  fr: {
    title: "Vrais Gagnants",
    subtitle: "Ces clients ont déjà gagné",
    savedLabel: "économisé",
    wonFor: "Gagné pour",
    retailPrice: "PVC",
    noWinners: "Pas encore de gagnants cette semaine",
    viewAll: "Voir tous les gagnants"
  }
};

const WinnerCard = memo(({ winner, t }) => {
  const product = winner.product || {};
  const savings = (product.retail_price || 0) - (winner.final_price || 0);
  const savingsPercent = product.retail_price ? Math.round((savings / product.retail_price) * 100) : 99;
  
  return (
    <div className="flex-shrink-0 w-64 bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
      {/* Winner Badge */}
      <div className="bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-800" />
          <span className="text-sm font-bold text-amber-900">{winner.winner_name || 'Gewinner'}</span>
        </div>
        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
          -{savingsPercent}%
        </span>
      </div>
      
      {/* Product Image */}
      <div className="h-32 bg-gray-50 flex items-center justify-center p-3">
        <img 
          src={product.image_url || 'https://via.placeholder.com/128'} 
          alt={product.name || 'Produkt'}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      
      {/* Product Info */}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-gray-800 line-clamp-2 min-h-[40px]">
          {product.name || 'Produkt'}
        </h4>
        
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500">{t.wonFor}</p>
            <p className="text-lg font-black text-green-600">
              € {(winner.final_price || 0).toFixed(2).replace('.', ',')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500">{t.retailPrice}</p>
            <p className="text-sm text-gray-400 line-through">
              € {(product.retail_price || 0).toLocaleString('de-DE')}
            </p>
          </div>
        </div>
        
        {/* Savings Badge */}
        <div className="mt-2 bg-green-50 rounded-lg p-2 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-green-600" />
          <span className="text-xs font-bold text-green-700">
            € {savings.toLocaleString('de-DE')} {t.savedLabel}!
          </span>
        </div>
      </div>
    </div>
  );
});

const WinnerGallery = memo(() => {
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollRef = React.useRef(null);
  
  const t = translations[langKey] || translations.de;
  
  useEffect(() => {
    const fetchWinners = async () => {
      try {
        const res = await axios.get(`${API}/winners?limit=10`);
        setWinners(res.data || []);
      } catch (err) {
        console.error('Error fetching winners:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWinners();
  }, []);
  
  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      const newPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      
      scrollRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };
  
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 mb-4 animate-pulse">
        <div className="h-6 bg-amber-200 rounded w-48 mb-2"></div>
        <div className="h-4 bg-amber-100 rounded w-64"></div>
      </div>
    );
  }
  
  if (winners.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 mb-4 border border-amber-200" data-testid="winner-gallery">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-white">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              {t.title}
              <span className="flex">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                ))}
              </span>
            </h2>
            <p className="text-xs text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        
        {/* Navigation Arrows */}
        <div className="flex gap-1">
          <button 
            onClick={() => scroll('left')}
            className="p-1.5 rounded-full bg-white shadow hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button 
            onClick={() => scroll('right')}
            className="p-1.5 rounded-full bg-white shadow hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* Winners Carousel */}
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
      >
        {winners.map((winner, idx) => (
          <WinnerCard key={winner.id || idx} winner={winner} t={t} />
        ))}
      </div>
      
      {/* View All Link */}
      <div className="mt-3 text-center">
        <a 
          href="/gewinner" 
          className="text-sm text-amber-600 hover:text-amber-700 font-semibold hover:underline"
        >
          {t.viewAll} →
        </a>
      </div>
    </div>
  );
});

export default WinnerGallery;
