import React, { useState, useEffect, memo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Sparkles, TrendingUp, Clock, Target, Trophy, ChevronRight, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Translations for the component
const translations = {
  de: {
    title: "Für dich empfohlen",
    subtitle: "Basierend auf deiner Aktivität",
    recommendedForYou: "Speziell für dich",
    continueBidding: "Weiterbieten",
    hotRightNow: "Gerade beliebt",
    endingSoon: "Endet bald",
    similarToWon: "Ähnlich zu deinen Gewinnen",
    currentPrice: "Aktuell",
    yourBids: "Deine Gebote",
    bids: "Gebote",
    minutes: "Min",
    viewAll: "Alle ansehen",
    bidNow: "Bieten",
    loading: "Lade Empfehlungen...",
    noRecommendations: "Keine Empfehlungen verfügbar",
    loginForRecommendations: "Melde dich an für personalisierte Empfehlungen",
    refresh: "Aktualisieren"
  },
  en: {
    title: "Recommended for you",
    subtitle: "Based on your activity",
    recommendedForYou: "Just for you",
    continueBidding: "Continue bidding",
    hotRightNow: "Hot right now",
    endingSoon: "Ending soon",
    similarToWon: "Similar to your wins",
    currentPrice: "Current",
    yourBids: "Your bids",
    bids: "bids",
    minutes: "min",
    viewAll: "View all",
    bidNow: "Bid now",
    loading: "Loading recommendations...",
    noRecommendations: "No recommendations available",
    loginForRecommendations: "Login for personalized recommendations",
    refresh: "Refresh"
  },
  sq: {
    title: "Rekomanduar për ty",
    subtitle: "Bazuar në aktivitetin tënd",
    recommendedForYou: "Vetëm për ty",
    continueBidding: "Vazhdo të ofrosh",
    hotRightNow: "Popullore tani",
    endingSoon: "Përfundon së shpejti",
    similarToWon: "Ngjashëm me fitimet e tua",
    currentPrice: "Aktuale",
    yourBids: "Ofertat e tua",
    bids: "oferta",
    minutes: "min",
    viewAll: "Shiko të gjitha",
    bidNow: "Ofro tani",
    loading: "Duke ngarkuar rekomandimet...",
    noRecommendations: "Nuk ka rekomandime",
    loginForRecommendations: "Identifikohu për rekomandime personale",
    refresh: "Rifresko"
  },
  xk: {
    title: "Rekomanduar për ty",
    subtitle: "Bazuar në aktivitetin tënd",
    recommendedForYou: "Vetëm për ty",
    continueBidding: "Vazhdo të ofrosh",
    hotRightNow: "Popullore tani",
    endingSoon: "Përfundon së shpejti",
    similarToWon: "Ngjashëm me fitimet e tua",
    currentPrice: "Aktuale",
    yourBids: "Ofertat e tua",
    bids: "oferta",
    minutes: "min",
    viewAll: "Shiko të gjitha",
    bidNow: "Ofro tani",
    loading: "Duke ngarkuar rekomandimet...",
    noRecommendations: "Nuk ka rekomandime",
    loginForRecommendations: "Identifikohu për rekomandime personale",
    refresh: "Rifresko"
  },
  tr: {
    title: "Senin için önerilen",
    subtitle: "Aktivitene göre",
    recommendedForYou: "Sadece senin için",
    continueBidding: "Teklif vermeye devam et",
    hotRightNow: "Şu an popüler",
    endingSoon: "Yakında bitiyor",
    similarToWon: "Kazandıklarına benzer",
    currentPrice: "Güncel",
    yourBids: "Tekliflerin",
    bids: "teklif",
    minutes: "dk",
    viewAll: "Tümünü gör",
    bidNow: "Teklif ver",
    loading: "Öneriler yükleniyor...",
    noRecommendations: "Öneri yok",
    loginForRecommendations: "Kişisel öneriler için giriş yap",
    refresh: "Yenile"
  },
  fr: {
    title: "Recommandé pour vous",
    subtitle: "Basé sur votre activité",
    recommendedForYou: "Juste pour vous",
    continueBidding: "Continuer à enchérir",
    hotRightNow: "Populaire maintenant",
    endingSoon: "Se termine bientôt",
    similarToWon: "Similaire à vos gains",
    currentPrice: "Actuel",
    yourBids: "Vos enchères",
    bids: "enchères",
    minutes: "min",
    viewAll: "Voir tout",
    bidNow: "Enchérir",
    loading: "Chargement des recommandations...",
    noRecommendations: "Pas de recommandations",
    loginForRecommendations: "Connectez-vous pour des recommandations personnalisées",
    refresh: "Actualiser"
  }
};

// Single recommendation card
const RecommendationCard = memo(({ item, onBid, t }) => {
  if (!item) return null;
  
  return (
    <div 
      className="flex-shrink-0 w-40 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => window.location.href = `/auctions/${item.auction_id}`}
      data-testid={`recommendation-card-${item.auction_id}`}
    >
      {/* Product Image */}
      <div className="h-24 bg-gray-50 flex items-center justify-center p-2 relative">
        <img 
          src={item.product_image || 'https://via.placeholder.com/96'} 
          alt={item.product_name}
          className="max-h-full max-w-full object-contain"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 transition-colors" />
      </div>
      
      {/* Info */}
      <div className="p-2">
        <h4 className="text-xs font-semibold text-gray-800 line-clamp-2 min-h-[32px]">
          {item.product_name}
        </h4>
        
        <div className="mt-1 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500">{t.currentPrice}</p>
            <p className="text-sm font-bold text-cyan-600">
              € {item.current_price?.toFixed(2).replace('.', ',')}
            </p>
          </div>
          
          {item.your_bids && (
            <span className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">
              {item.your_bids} {t.bids}
            </span>
          )}
          
          {item.total_bids && (
            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
              {item.total_bids} {t.bids}
            </span>
          )}
          
          {item.minutes_left !== undefined && (
            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded animate-pulse">
              {item.minutes_left} {t.minutes}
            </span>
          )}
        </div>
        
        {item.reason && (
          <p className="mt-1 text-[9px] text-gray-500 line-clamp-1 italic">
            {item.reason}
          </p>
        )}
        
        <button
          onClick={(e) => { e.stopPropagation(); onBid(item.auction_id); }}
          className="mt-2 w-full py-1.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-white text-xs font-bold rounded transition-colors"
          data-testid={`recommendation-bid-${item.auction_id}`}
        >
          {t.bidNow}
        </button>
      </div>
    </div>
  );
});

// Section with horizontal scroll
const RecommendationSection = memo(({ title, icon: Icon, items, onBid, t, color = "cyan" }) => {
  if (!items || items.length === 0) return null;
  
  const colorClasses = {
    cyan: "from-cyan-500 to-cyan-600",
    orange: "from-orange-500 to-orange-600",
    red: "from-red-500 to-red-600",
    purple: "from-purple-500 to-purple-600",
    green: "from-green-500 to-green-600"
  };
  
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg bg-gradient-to-r ${colorClasses[color]} text-white`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-500">({items.length})</span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {items.map((item, idx) => (
          <RecommendationCard key={item.auction_id || idx} item={item} onBid={onBid} t={t} />
        ))}
      </div>
    </div>
  );
});

// Main component
const PersonalizedRecommendations = memo(({ onBid }) => {
  const { isAuthenticated, token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get translations
  const lang = language === 'xk' ? 'xk' : language;
  const t = translations[lang] || translations.de;
  
  const fetchRecommendations = async () => {
    if (!isAuthenticated || !token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await axios.get(`${API}/personalized/homepage`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchRecommendations();
  }, [isAuthenticated, token]);
  
  // Don't show if not logged in
  if (!isAuthenticated) {
    return (
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-4 mb-4 border border-cyan-200" data-testid="recommendations-login-prompt">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-cyan-500" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{t.title}</p>
            <p className="text-xs text-gray-600">{t.loginForRecommendations}</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200" data-testid="recommendations-loading">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-cyan-500 animate-spin" />
          <p className="text-sm text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return null; // Silent fail - don't show error to user
  }
  
  const { sections, greeting } = data;
  
  // Check if we have any recommendations
  const hasContent = 
    (sections?.recommended_for_you?.length > 0) ||
    (sections?.continue_bidding?.length > 0) ||
    (sections?.hot_right_now?.length > 0) ||
    (sections?.ending_soon?.length > 0) ||
    (sections?.similar_to_won?.length > 0);
  
  if (!hasContent) {
    return null;
  }
  
  return (
    <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200 shadow-sm" data-testid="personalized-recommendations">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">{t.title}</h2>
            <p className="text-xs text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        
        <button 
          onClick={fetchRecommendations}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={t.refresh}
          data-testid="recommendations-refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {/* Greeting */}
      {greeting && (
        <p className="text-sm text-gray-600 mb-4">
          {greeting[langKey] || greeting.de || greeting.en}
        </p>
      )}
      
      {/* Sections */}
      <div className="space-y-2">
        {/* Continue Bidding - Most important for engagement */}
        <RecommendationSection 
          title={t.continueBidding}
          icon={Target}
          items={sections?.continue_bidding}
          onBid={onBid}
          t={t}
          color="purple"
        />
        
        {/* Recommended for You */}
        <RecommendationSection 
          title={t.recommendedForYou}
          icon={Sparkles}
          items={sections?.recommended_for_you}
          onBid={onBid}
          t={t}
          color="cyan"
        />
        
        {/* Ending Soon - Urgency */}
        <RecommendationSection 
          title={t.endingSoon}
          icon={Clock}
          items={sections?.ending_soon}
          onBid={onBid}
          t={t}
          color="red"
        />
        
        {/* Hot Right Now */}
        <RecommendationSection 
          title={t.hotRightNow}
          icon={TrendingUp}
          items={sections?.hot_right_now}
          onBid={onBid}
          t={t}
          color="orange"
        />
        
        {/* Similar to Won */}
        <RecommendationSection 
          title={t.similarToWon}
          icon={Trophy}
          items={sections?.similar_to_won}
          onBid={onBid}
          t={t}
          color="green"
        />
      </div>
    </div>
  );
});

export default PersonalizedRecommendations;
