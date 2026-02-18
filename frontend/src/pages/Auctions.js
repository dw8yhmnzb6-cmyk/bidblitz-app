import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'sonner';
import GlobalJackpot from '../components/GlobalJackpot';
import { HappyHourBanner, ExcitementStatusBar } from '../components/ExcitementFeatures';
import { PriceGuaranteeSection } from '../components/PriceGuarantee';
import { LastChanceSection } from '../components/LastChanceAuctions';
import { TopBidderBadge } from '../components/TopBidderLeaderboard';
import ExitIntentPopup from '../components/ExitIntentPopup';
import WinnerGalleryHome from '../components/WinnerGalleryHome';
import VoucherAuctionsSection from '../components/VoucherAuctionsSection';
import { 
  Timer, Flame, TrendingUp, Users, Zap, Award, Gift, Shield, Star, Crown, Clock, 
  ChevronRight, CheckCircle, Eye, Gavel, ArrowRight, Sparkles, UserPlus, Mail, Lock
} from 'lucide-react';
// Note: LiveTimer, LivePrice, ProductInfo, ActivityIndex, TrustBadges are defined locally for this page

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Quick Registration translations
const quickRegisterTexts = {
  de: {
    title: 'Jetzt kostenlos registrieren',
    subtitle: '10 Gratis Gebote sichern!',
    namePlaceholder: 'Vollständiger Name',
    emailPlaceholder: 'E-Mail Adresse',
    passwordPlaceholder: 'Passwort wählen',
    submitBtn: 'Kostenlos starten',
    terms: 'Mit der Registrierung akzeptierst du unsere AGB',
    benefits: ['10 Gratis Gebote', 'Keine Kreditkarte nötig', 'Sofort loslegen']
  },
  en: {
    title: 'Register for free now',
    subtitle: 'Get 10 Free Bids!',
    namePlaceholder: 'Full name',
    emailPlaceholder: 'Email address',
    passwordPlaceholder: 'Choose password',
    submitBtn: 'Start for free',
    terms: 'By registering you accept our Terms & Conditions',
    benefits: ['10 Free Bids', 'No credit card needed', 'Start immediately']
  },
  sq: {
    title: 'Regjistrohu falas tani',
    subtitle: 'Merr 50 Oferta Falas!',
    namePlaceholder: 'Emri i plotë',
    emailPlaceholder: 'Adresa e emailit',
    passwordPlaceholder: 'Zgjidhni fjalëkalimin',
    submitBtn: 'Fillo falas',
    terms: 'Duke u regjistruar pranoni Kushtet tona',
    benefits: ['50 Oferta Falas', 'Pa kartë krediti', 'Fillo menjëherë']
  },
  xk: {
    title: 'Regjistrohu falas tani',
    subtitle: 'Merr 50 Oferta Falas!',
    namePlaceholder: 'Emri i plotë',
    emailPlaceholder: 'Adresa e emailit',
    passwordPlaceholder: 'Zgjidhni fjalëkalimin',
    submitBtn: 'Fillo falas',
    terms: 'Duke u regjistruar pranoni Kushtet tona',
    benefits: ['50 Oferta Falas', 'Pa kartë krediti', 'Fillo menjëherë']
  },
  tr: {
    title: 'Şimdi ücretsiz kayıt ol',
    subtitle: '50 Ücretsiz Teklif Al!',
    namePlaceholder: 'Ad Soyad',
    emailPlaceholder: 'E-posta adresi',
    passwordPlaceholder: 'Şifre seçin',
    submitBtn: 'Ücretsiz başla',
    terms: 'Kayıt olarak Şartlarımızı kabul etmiş olursunuz',
    benefits: ['50 Ücretsiz Teklif', 'Kredi kartı gerekmez', 'Hemen başla']
  },
  fr: {
    title: 'Inscrivez-vous gratuitement',
    subtitle: 'Obtenez 50 enchères gratuites!',
    namePlaceholder: 'Nom complet',
    emailPlaceholder: 'Adresse email',
    passwordPlaceholder: 'Choisir mot de passe',
    submitBtn: 'Commencer gratuitement',
    terms: "En vous inscrivant, vous acceptez nos conditions",
    benefits: ['50 Enchères gratuites', 'Pas de carte de crédit', 'Commencer immédiatement']
  }
};

// Quick Register Section Component
const QuickRegisterSection = memo(({ language = 'de', navigate }) => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const t = quickRegisterTexts[language] || quickRegisterTexts.de;
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register`, {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
      
      if (response.data) {
        toast.success('Registrierung erfolgreich! Bitte einloggen.');
        navigate('/login');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail;
      if (typeof errorMsg === 'string') {
        toast.error(errorMsg);
      } else if (Array.isArray(errorMsg)) {
        toast.error(errorMsg[0]?.msg || 'Registrierung fehlgeschlagen');
      } else {
        toast.error('Registrierung fehlgeschlagen');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 rounded-3xl p-6 sm:p-8 shadow-2xl text-white"
      data-testid="quick-register-section"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full mb-4">
          <Gift className="w-5 h-5 text-yellow-300" />
          <span className="font-bold">{t.subtitle}</span>
          <Sparkles className="w-4 h-4 text-yellow-300" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black">{t.title}</h2>
      </div>
      
      {/* Benefits */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {t.benefits.map((benefit, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full text-sm">
            <CheckCircle className="w-4 h-4 text-green-300" />
            <span>{benefit}</span>
          </div>
        ))}
      </div>
      
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder={t.namePlaceholder}
            className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 
              focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all"
            data-testid="quick-register-name"
          />
        </div>
        
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder={t.emailPlaceholder}
            className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 
              focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all"
            data-testid="quick-register-email"
          />
        </div>
        
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            placeholder={t.passwordPlaceholder}
            className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 
              focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all"
            data-testid="quick-register-password"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white text-purple-600 font-black text-lg rounded-xl
            hover:bg-yellow-300 transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50
            active:scale-95 touch-manipulation"
          data-testid="quick-register-submit"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {t.submitBtn}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
      
      {/* Terms */}
      <p className="text-center text-xs text-white/60 mt-4">
        {t.terms}
      </p>
    </div>
  );
});

QuickRegisterSection.displayName = 'QuickRegisterSection';

// Auction of the Day Component - Special highlight
const AuctionOfTheDay = memo(({ auction, product, onBid, t, language, langKey, isAuthenticated = false, isVip = false, navigate }) => {
  if (!auction || !product) return null;
  
  // Check if auction is still active (not expired)
  const endTime = new Date(auction.end_time).getTime();
  const isExpired = endTime <= Date.now();
  
  // If expired, don't render
  if (isExpired) return null;
  
  const discount = product.retail_price && product.retail_price > auction.current_price
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;
  
  // Handle both last_bidder and last_bidder_name field names
  const lastBidder = auction.last_bidder_name || auction.last_bidder;
  
  // Get translated product name (fallback to default name)
  const effectiveLangKey = langKey || language;
  const productName = product.name_translations?.[effectiveLangKey] || product.name;
  const productDescription = product.description_translations?.[effectiveLangKey] || product.description;
  
  // Check if VIP auction
  const isVipAuction = auction.is_vip_only;
  
  // Determine button config
  const getButtonConfig = () => {
    const buttonTexts = {
      de: { loginToBid: 'Anmelden zum Bieten', getVipToBid: 'VIP werden zum Bieten' },
      en: { loginToBid: 'Login to Bid', getVipToBid: 'Get VIP to Bid' },
      sq: { loginToBid: 'Hyr për të ofruar', getVipToBid: 'Bëhu VIP për të ofruar' },
      xk: { loginToBid: 'Hyr për të ofruar', getVipToBid: 'Bëhu VIP për të ofruar' },
      tr: { loginToBid: 'Teklif vermek için giriş yapın', getVipToBid: 'Teklif vermek için VIP olun' },
      fr: { loginToBid: 'Connectez-vous pour enchérir', getVipToBid: 'Devenez VIP pour enchérir' }
    };
    const btnT = buttonTexts[language] || buttonTexts.de;
    
    if (!isAuthenticated) {
      return {
        text: '🔒 ' + btnT.loginToBid,
        action: () => navigate('/login'),
        style: 'bg-gray-500 hover:bg-gray-600'
      };
    }
    if (isVipAuction && !isVip) {
      return {
        text: '⭐ ' + btnT.getVipToBid,
        action: () => navigate('/vip'),
        style: 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500'
      };
    }
    return {
      text: '🔥 ' + t('auctionPage.bidNow'),
      action: () => onBid(auction.id),
      style: 'bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400'
    };
  };
  
  const buttonConfig = getButtonConfig();
  
  return (
    <div 
      className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 rounded-xl p-1 mb-4 shadow-lg cursor-pointer" 
      data-testid="auction-of-the-day"
      onClick={() => window.location.href = `/auctions/${auction.id}`}
    >
      <div className="bg-gradient-to-b from-amber-50 to-white rounded-lg p-3 sm:p-4">
        {/* Header with crown icon */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl">👑</span>
            <div>
              <h2 className="text-sm sm:text-lg font-black text-amber-800 uppercase tracking-wide">{t('auctionPage.auctionOfDay')}</h2>
              <p className="text-[10px] sm:text-xs text-amber-600">{t('auctionPage.topOffer')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isVipAuction && (
              <span className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                ⭐ VIP
              </span>
            )}
            {discount > 0 && discount <= 100 && (
              <div className="bg-red-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold ">
                -{Math.min(99, discount)}%
              </div>
            )}
          </div>
        </div>
        
        {/* Mobile: Stack layout, Desktop: Side by side */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Product Image */}
          <div className="w-full sm:w-28 h-24 sm:h-28 bg-white rounded-lg flex items-center justify-center shadow-inner border border-amber-200 flex-shrink-0">
            <img 
              src={product.image_url || 'https://via.placeholder.com/128'} 
              alt={productName}
              className="max-w-full max-h-full object-contain p-2"
              loading="lazy"
              decoding="async"
              onError={(e) => { e.target.src = 'https://via.placeholder.com/128?text=?'; }}
            />
          </div>
          
          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-gray-800 uppercase leading-tight mb-1 line-clamp-2">
              {productName}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-2">
              {t('auctionPage.uvp')}: <span className="line-through">€ {product.retail_price?.toLocaleString('de-DE')},-</span>
            </p>
            
            <div className="flex items-center justify-between sm:items-end sm:gap-4">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500">{t('auctionPage.currentPrice')}</p>
                <p className="text-xl sm:text-2xl font-black text-amber-600">
                  € {auction.current_price?.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-[10px] sm:text-xs text-cyan-700">{lastBidder || t('auctionPage.startPrice')}</p>
              </div>
              
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">{t('auctionPage.remaining')}</p>
                <LiveTimer endTime={auction.end_time} />
              </div>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); buttonConfig.action(); }}
              className={`mt-2 sm:mt-3 w-full py-2 sm:py-2.5 ${buttonConfig.style} text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition-all hover:shadow-lg`}
              data-testid="aotd-bid-button"
            >
              {buttonConfig.text}
            </button>
          </div>
        </div>
        
        <div className="mt-2 sm:mt-3 pt-2 border-t border-amber-200 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-xs text-gray-500">
          <span className="whitespace-nowrap">⚡ {auction.total_bids || 0} {t('auctionPage.bidsCount')}</span>
          <span className="whitespace-nowrap truncate max-w-[120px] sm:max-w-none">{t('auctionPage.lastSoldFor')} <span className="text-green-600 font-bold">€ {(product.retail_price * 0.01).toFixed(2).replace('.', ',')}</span></span>
        </div>
      </div>
    </div>
  );
});

// Ad Banner Component - Loads from admin
const AdBanner = memo(() => {
  const [banner, setBanner] = useState(null);
  
  useEffect(() => {
    const fetchBanner = async () => {
      try {
        const res = await axios.get(`${API}/admin/public/banners?position=homepage_middle`);
        if (res.data && res.data.length > 0) {
          setBanner(res.data[0]);
        }
      } catch (error) {
        // No banner available - that's ok
      }
    };
    fetchBanner();
  }, []);
  
  if (!banner) return null;
  
  const handleClick = async () => {
    try {
      await axios.post(`${API}/admin/public/banners/${banner.id}/click`);
    } catch (e) {}
    
    if (banner.link_url) {
      window.open(banner.link_url, '_blank');
    }
  };
  
  return (
    <div 
      className="my-3 cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
      onClick={handleClick}
    >
      <img 
        src={banner.image_url} 
        alt={banner.title}
        className="w-full h-auto object-cover"
        style={{ maxHeight: '120px' }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
});

// Activity Index - micro-component showing auction heat
const ActivityIndex = memo(({ auctionId, t }) => {
  const activity = Math.floor(Math.random() * 100);
  let activityLevel, activityColor;
  
  if (activity > 80) {
    activityLevel = t('auctionPage.activityHot');
    activityColor = 'bg-red-500 text-white';
  } else if (activity > 50) {
    activityLevel = t('auctionPage.activityActive');
    activityColor = 'bg-yellow-400 text-yellow-900';
  } else {
    activityLevel = t('auctionPage.activityCalm');
    activityColor = 'bg-gray-200 text-gray-600';
  }
  
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden min-w-[40px]">
        <div 
          className={`h-full ${activity > 80 ? 'bg-red-500' : activity > 50 ? 'bg-yellow-400' : 'bg-gray-400'}`}
          style={{ width: `${activity}%` }}
        />
      </div>
      <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${activityColor}`}>
        {activityLevel}
      </span>
    </div>
  );
});

// ISOLATED Timer Component - Shows DD:HH:MM:SS for long auctions, HH:MM:SS for short
const LiveTimer = memo(({ endTime, isPaused }) => {
  const [display, setDisplay] = useState('--:--:--');
  const [isLow, setIsLow] = useState(false);
  const [isLong, setIsLong] = useState(false); // For auctions > 1 hour
  const intervalRef = useRef(null);
  
  useEffect(() => {
    // Clear previous interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // If paused, show pause indicator
    if (isPaused) {
      setDisplay('⏸️');
      setIsLow(false);
      setIsLong(false);
      return;
    }
    
    if (!endTime) {
      setDisplay('--:--:--');
      return;
    }
    
    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = Math.max(0, end - now);
      
      // If diff is 0, the auction ended
      if (diff === 0) {
        setDisplay('00:00:00');
        setIsLow(true);
        setIsLong(false);
        return;
      }
      
      const days = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      const pad = (n) => String(n).padStart(2, '0');
      
      // Show days if more than 0 days remaining - compact format for mobile
      if (days > 0) {
        setDisplay(`${days}d ${pad(h)}:${pad(m)}`);
        setIsLong(true);
        setIsLow(false);
      } else if (h > 0) {
        // Show hours if more than 0 hours remaining
        setDisplay(`${pad(h)}:${pad(m)}:${pad(s)}`);
        setIsLong(true);
        setIsLow(false);
      } else {
        // Short timer - minutes and seconds only
        setDisplay(`${pad(m)}:${pad(s)}`);
        setIsLong(false);
        setIsLow(m === 0 && s <= 30);
      }
    };
    
    updateTimer(); // Initial update
    intervalRef.current = setInterval(updateTimer, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [endTime, isPaused]);
  
  return (
    <span className={`font-mono text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded transition-colors duration-300 whitespace-nowrap ${
      isPaused ? 'bg-indigo-600 text-white' :
      isLow ? 'bg-red-500 text-white ' : 
      isLong ? 'bg-green-600 text-white' : 
      'bg-blue-600 text-white'
    }`}>
      {display}
    </span>
  );
});

// ISOLATED Price Component - Only updates when price changes via WebSocket
const LivePrice = memo(({ price, bidderName, t }) => (
  <div>
    <span className="text-xl font-black text-gray-800">
      € {price?.toFixed(2).replace('.', ',')}
    </span>
    <p className="text-xs text-cyan-700 truncate">{bidderName || t('auctionPage.startPrice')}</p>
  </div>
));

// Static Product Info - Never re-renders
const ProductInfo = memo(({ name, retailPrice, imageUrl, discount }) => (
  <>
    <h3 className="text-sm font-bold text-gray-800 leading-tight mb-1 line-clamp-2 min-h-[40px]">
      {name}
    </h3>
    <p className="text-xs text-gray-500 mb-2">
      Vergleichspreis*: € {retailPrice?.toLocaleString('de-DE')},-
    </p>
    <div className="flex gap-3">
      <div className="flex-1">
        {/* Price slot - filled by parent */}
      </div>
      <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
        <img src={imageUrl || 'https://via.placeholder.com/64'} alt="" className="max-w-full max-h-full object-contain" loading="lazy" decoding="async" />
      </div>
    </div>
  </>
));

// Auction Card - Only Timer and Price update, rest is static
const AuctionCard = memo(({ auction, product, onBid, t, language, langKey, isAuthenticated = false, isVip = false, navigate }) => {
  if (!auction || !product) return null;
  
  // Get translated product name and description (fallback to default)
  const effectiveLangKey = langKey || language;
  const productName = product.name_translations?.[effectiveLangKey] || product.name;
  const productDescription = product.description_translations?.[effectiveLangKey] || product.description || product.short_description;
  
  const discount = product.retail_price && product.retail_price > auction.current_price
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;
  
  // Check if this is a VIP-only auction
  const isVipAuction = auction.is_vip_only;
  
  // Determine button configuration based on auth/VIP status
  const getButtonConfig = () => {
    const buttonTexts = {
      de: { login: 'Anmelden', getVip: 'VIP werden' },
      en: { login: 'Login', getVip: 'Get VIP' },
      sq: { login: 'Hyr', getVip: 'Bëhu VIP' },
      xk: { login: 'Hyr', getVip: 'Bëhu VIP' },
      tr: { login: 'Giriş', getVip: 'VIP Ol' },
      fr: { login: 'Connexion', getVip: 'Devenir VIP' }
    };
    const btnT = buttonTexts[language] || buttonTexts.de;
    
    if (!isAuthenticated) {
      return {
        text: '🔒 ' + btnT.login,
        action: () => navigate('/login'),
        style: 'bg-gray-500 hover:bg-gray-600',
        disabled: false
      };
    }
    if (isVipAuction && !isVip) {
      return {
        text: '⭐ ' + btnT.getVip,
        action: () => navigate('/vip'),
        style: 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400',
        disabled: false
      };
    }
    return {
      text: t('auctionPage.bid'),
      action: () => onBid(auction.id),
      style: 'bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400',
      disabled: false
    };
  };
  
  const buttonConfig = getButtonConfig();
  
  // Collect all badges for this auction
  const badges = [];
  
  // Discount badge - only show if discount is positive and reasonable
  // Cap at 99% to avoid showing "100%" which looks odd
  if (discount > 0 && discount <= 100) {
    badges.push(
      <span key="discount" className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
        -{Math.min(99, discount)}%
      </span>
    );
  }
  
  // Special auction type badges
  if (auction.is_vip_only) {
    badges.push(
      <span key="vip" className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">
        VIP
      </span>
    );
  }
  
  if (auction.is_beginner_only) {
    badges.push(
      <span key="beginner" className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
        🎓
      </span>
    );
  }
  
  // Note: is_free_auction no longer gets special badge - shown as normal auction
  
  if (auction.is_night_auction) {
    badges.push(
      <span key="night" className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold" title={t('auctionPage.nightTime')}>
        🌙
      </span>
    );
  }
  
  // Check if night auction is paused (daytime) - check both is_night_paused flag and status
  const isNightPaused = auction.is_night_paused || auction.status === 'night_paused';
  
  // Header background color based on primary type
  let headerBg = 'bg-gradient-to-r from-cyan-500 to-cyan-600';
  if (auction.is_vip_only) headerBg = 'bg-gradient-to-r from-yellow-400 to-yellow-500';
  else if (auction.is_night_auction) headerBg = 'bg-gradient-to-r from-indigo-600 to-purple-600';
  else if (auction.is_beginner_only) headerBg = 'bg-gradient-to-r from-purple-500 to-violet-500';
  
  return (
    <div className={`bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg overflow-hidden border border-cyan-300 cursor-pointer hover:shadow-lg transition-shadow min-h-[280px] flex flex-col ${isNightPaused ? 'opacity-60' : ''}`}
         onClick={() => window.location.href = `/auctions/${auction.id}`}>
      
      {/* Header with Badges + Timer - Fixed height, no overlap */}
      <div className={`${headerBg} text-white text-[10px] sm:text-xs font-bold py-1 px-2 flex items-center justify-between h-7 sm:h-8 flex-shrink-0 gap-1`}>
        <div className="flex items-center gap-0.5 flex-shrink-0 max-w-[45%] overflow-hidden">
          {badges}
        </div>
        <div className="flex-shrink-0">
          {isNightPaused ? (
            <span className="text-[10px] opacity-80">{auction.night_message || '🌙 23:30-06:00'}</span>
          ) : (
            <LiveTimer endTime={auction.end_time} />
          )}
        </div>
      </div>
      
      {/* Content - Flex grow to fill space */}
      <div className="p-3 flex-1 flex flex-col">
        {/* Product Name - Fixed height */}
        <h3 className="text-sm font-bold text-gray-800 leading-snug mb-2 h-[40px] line-clamp-2 overflow-hidden" style={{ wordBreak: 'break-word' }}>
          {productName}
        </h3>
        
        {/* UVP - Fixed height */}
        <p className="text-xs text-gray-500 mb-2 h-4 overflow-hidden">
          {t('auctionPage.uvp')}: € {product.retail_price?.toLocaleString('de-DE')},-
        </p>
        
        {/* Price and Image Row - Flex grow */}
        <div className="flex gap-3 items-start flex-1">
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <LivePrice price={auction.current_price} bidderName={auction.last_bidder_name} t={t} />
            
            <button 
              onClick={(e) => { e.stopPropagation(); buttonConfig.action(); }}
              disabled={isNightPaused || buttonConfig.disabled}
              className={`mt-2 w-full py-2 ${isNightPaused ? 'bg-gray-400 cursor-not-allowed' : buttonConfig.style} text-white font-bold text-sm rounded-lg flex-shrink-0`}
            >
              {isNightPaused ? `🌙 ${t('auctionPage.nightOnly')}` : buttonConfig.text}
            </button>
          </div>
          
          {/* Image container with fixed size and loading placeholder */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden">
            <img 
              src={product.image_url || 'https://via.placeholder.com/64'} 
              alt="" 
              className="max-w-full max-h-full object-contain p-1"
              loading="lazy"
              onError={(e) => { e.target.src = 'https://via.placeholder.com/64?text=?'; }}
            />
          </div>
        </div>
        
        <ActivityIndex auctionId={auction.id} t={t} />
      </div>
      
      {/* Footer - Fixed height */}
      <div className="bg-cyan-200/50 px-3 py-2 text-center h-10 flex-shrink-0">
        <p className="text-xs text-gray-600">
          {t('auctionPage.lastSoldFor')} <span className="text-green-600 font-bold">€ {(product.retail_price * 0.03).toFixed(2).replace('.', ',')}</span>
        </p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render if price, bidder, language, or translations change
  return prevProps.auction.current_price === nextProps.auction.current_price &&
         prevProps.auction.last_bidder_name === nextProps.auction.last_bidder_name &&
         prevProps.auction.end_time === nextProps.auction.end_time &&
         prevProps.language === nextProps.language &&
         prevProps.t === nextProps.t;
});

// Ended Auction Card
const EndedAuctionCard = memo(({ auction, product, t, language, langKey }) => {
  if (!auction || !product) return null;
  
  // Get translated product name (fallback to default name)
  const effectiveLangKey = langKey || language;
  const productName = product.name_translations?.[effectiveLangKey] || product.name;
  
  const discount = product.retail_price 
    ? Math.round((1 - auction.final_price / product.retail_price) * 100)
    : 99;
  
  // Handle both end_time (from active auctions) and ended_at (from auction history)
  const endTime = auction.ended_at || auction.end_time;
  
  return (
    <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-xl overflow-hidden border border-gray-300 opacity-80 cursor-pointer hover:opacity-100 transition-opacity"
         onClick={() => window.location.href = `/auctions/${auction.id || auction.auction_id}`}>
      
      <div className="bg-gradient-to-r from-gray-400 to-gray-500 text-white text-xs font-bold py-1.5 px-3 flex items-center justify-between">
        <span className="bg-gray-600 text-white px-2 py-0.5 rounded text-xs">
          {t('auctionPage.ended')}
        </span>
        <span className="text-xs">
          -{discount}%
        </span>
      </div>
      
      <div className="p-3">
        {/* Product Name - Full width, wrap text */}
        <h3 className="text-sm font-bold text-gray-600 leading-snug mb-2" style={{ wordBreak: 'break-word' }}>
          {productName}
        </h3>
        
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{t('auctionPage.soldFor')}</p>
            <span className="text-xl font-black text-gray-700">
              € {auction.final_price?.toFixed(2).replace('.', ',')}
            </span>
            <p className="text-xs text-green-600 mt-1">
              👤 {auction.winner_name || '---'}
            </p>
          </div>
          
          <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <img src={product.image_url || 'https://via.placeholder.com/64'} alt="" className="max-w-full max-h-full object-contain grayscale p-1" loading="lazy" decoding="async" />
          </div>
        </div>
      </div>
      
      <div className="bg-gray-300/50 px-3 py-1.5 text-center">
        <p className="text-[10px] text-gray-500">
          {t('auctionPage.endedAt')} {endTime ? new Date(endTime).toLocaleString('de-DE', { 
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
          }) : '---'}
        </p>
      </div>
    </div>
  );
});

// Premium Card
const PremiumCard = memo(({ auction, product, onBid, t, language, langKey }) => {
  if (!auction || !product) return null;
  
  // Get translated product name (fallback to default name)
  const effectiveLangKey = langKey || language;
  const productName = product.name_translations?.[effectiveLangKey] || product.name;
  
  return (
    <div className="bg-gradient-to-b from-cyan-100 to-cyan-200 rounded-xl p-4 border-2 border-cyan-400">
      <h2 className="text-base font-bold text-gray-800 leading-tight mb-1">{productName}</h2>
      <p className="text-xs text-gray-600 mb-2">{t('auctionPage.comparePrice')}: € {product.retail_price?.toLocaleString('de-DE')},-</p>
      
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="mb-2">
            <LiveTimer endTime={auction.end_time} />
          </div>
          
          <div className="text-2xl font-black text-gray-800">
            € {auction.current_price?.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-xs text-cyan-700">{auction.last_bidder_name || t('auctionPage.startPrice')}</p>
          
          <button onClick={() => onBid(auction.id)}
            className="mt-2 w-full py-2.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-white font-bold text-sm rounded-lg shadow-md">
            {t('auctionPage.bid')}
          </button>
          
          <ActivityIndex auctionId={auction.id} t={t} />
        </div>
        
        <div className="w-28 h-28 bg-white rounded-lg flex items-center justify-center shadow">
          <img src={product.image_url || 'https://via.placeholder.com/112'} alt="" className="max-w-full max-h-full object-contain p-1" loading="lazy" decoding="async" />
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-2 text-center">
        {t('auctionPage.lastSoldFor')} <span className="text-green-600 font-bold">€ {(product.retail_price * 0.02).toFixed(2).replace('.', ',')}</span>
      </p>
    </div>
  );
});

// Trust Badges - Compact for mobile
const TrustBadges = memo(({ t }) => (
  <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
    <h3 className="text-xs font-bold text-gray-800 mb-2">{t('auctionPage.secure')}</h3>
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-xs font-bold text-green-800">SSL</p>
      </div>
      
      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <p className="text-xs font-bold text-blue-800">Stripe</p>
      </div>
      
      <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
        <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <p className="text-xs font-bold text-amber-800">Dubai</p>
      </div>
      
      <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
        <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        </div>
        <p className="text-xs font-bold text-purple-800">50K+</p>
      </div>
    </div>
  </div>
));

// Info Sidebar with Badge Legend - Compact for mobile
const InfoSidebar = memo(({ t }) => (
  <div className="space-y-3">
    {/* Trust Badges First */}
    <TrustBadges t={t} />
    
    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-bold text-gray-800 mb-2">{t('auctionPage.auctionTypes')}</h3>
      <div className="space-y-2">
        {/* Rabatt Badge */}
        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
          <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">-95%</span>
          <span className="text-xs text-gray-700">{t('auctionPage.discount')}</span>
        </div>
        
        {/* Anfänger */}
        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
          <span className="bg-purple-500 text-white px-2 py-0.5 rounded text-xs font-bold">🎓</span>
          <span className="text-xs text-gray-700">{t('auctionPage.beginner')}</span>
        </div>
        
        {/* Gratis */}
        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
          <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs font-bold">🎁</span>
          <span className="text-xs text-gray-700">{t('auctionPage.free')}</span>
        </div>
        
        {/* VIP */}
        <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
          <span className="bg-yellow-500 text-black px-2 py-0.5 rounded text-xs font-bold">⭐</span>
          <span className="text-xs text-gray-700">{t('auctionPage.vipLabel')}</span>
        </div>
        
        {/* Nacht */}
        <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg border border-indigo-200">
          <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-xs font-bold">🌙</span>
          <span className="text-xs text-gray-700">{t('auctionPage.night')} <b>½</b></span>
        </div>
        
        {/* Erinnerung */}
        <div className="flex items-center gap-2 p-2 bg-cyan-50 rounded-lg border border-cyan-200">
          <span className="bg-cyan-500 text-white px-2 py-0.5 rounded text-xs font-bold">🔔</span>
          <span className="text-xs text-gray-700">{t('auctionPage.alarm')}</span>
        </div>
      </div>
    </div>
    
    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-bold text-gray-800 mb-2">{t('auctionPage.activity').toUpperCase()}</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-green-500"></span>
          <span className="text-xs text-gray-700">{t('auctionPage.activityLow')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-yellow-500"></span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.activityMedium')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-orange-500"></span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.activityHigh')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500"></span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.activityVeryHigh')}</span>
        </div>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
      <h3 className="text-[9px] font-bold text-gray-800 mb-2">{t('auctionPage.howItWorks')}</h3>
      <ol className="text-[8px] text-gray-700 space-y-1">
        <li className="flex items-center gap-1"><span className="font-bold text-cyan-600">1.</span> {t('auctionPage.step1')}</li>
        <li className="flex items-center gap-1"><span className="font-bold text-cyan-600">2.</span> {t('auctionPage.step2')}</li>
        <li className="flex items-center gap-1"><span className="font-bold text-cyan-600">3.</span> {t('auctionPage.step3')}</li>
      </ol>
    </div>
  </div>
));

export default function Auctions() {
  const { isAuthenticated, token, updateBidsBalance, user, isVip } = useAuth();
  const { t, language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const navigate = useNavigate();
  const location = useLocation();
  
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [auctionOfTheDay, setAuctionOfTheDay] = useState(null);
  const wsRef = useRef(null);
  
  const [endedAuctions, setEndedAuctions] = useState([]);
  
  // Auto-scroll to element based on URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const scrollTarget = params.get('scrollTo');
    
    if (scrollTarget) {
      // Wait a bit for content to load, then scroll
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById(scrollTarget);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
      
      return () => clearTimeout(scrollTimer);
    }
  }, [location.search]);
  
  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [auctionsRes, productsRes, aotdRes, endedRes] = await Promise.all([
        axios.get(`${API}/auctions`),
        axios.get(`${API}/products`),
        axios.get(`${API}/auction-of-the-day`).catch(() => ({ data: null })),
        axios.get(`${API}/auctions/ended`).catch(() => ({ data: [] })) // Get ended auctions from history
      ]);
      
      const prodMap = {};
      productsRes.data.forEach(p => { prodMap[p.id] = p; });
      setProducts(prodMap);
      setAuctions(auctionsRes.data);
      setEndedAuctions(endedRes.data || []);
      
      // Set Auction of the Day
      if (aotdRes.data && aotdRes.data.id) {
        setAuctionOfTheDay(aotdRes.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // WebSocket - Only updates price and bidder, NOT whole card
  useEffect(() => {
    const connectWS = () => {
      const wsUrl = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
      if (!wsUrl) return;
      
      const ws = new WebSocket(`${wsUrl}/api/ws/auctions`);
      wsRef.current = ws;
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'bid_update' && msg.data) {
            // ONLY update price and bidder - timer updates itself
            setAuctions(prev => prev.map(a => 
              a.id === msg.auction_id
                ? { 
                    ...a, 
                    current_price: msg.data.current_price,
                    last_bidder_name: msg.data.last_bidder_name,
                    total_bids: msg.data.total_bids,
                    end_time: msg.data.end_time // Timer will pick this up
                  }
                : a
            ));
            
            // Also update AOTD if it matches
            setAuctionOfTheDay(prev => {
              if (prev && prev.id === msg.auction_id) {
                return {
                  ...prev,
                  current_price: msg.data.current_price,
                  last_bidder_name: msg.data.last_bidder_name,
                  total_bids: msg.data.total_bids,
                  end_time: msg.data.end_time
                };
              }
              return prev;
            });
          }
          if (msg.type === 'auction_restarted' && msg.data) {
            setAuctions(prev => prev.map(a => 
              a.id === msg.auction_id ? { ...a, ...msg.data } : a
            ));
          }
        } catch (e) {}
      };
      
      ws.onclose = () => setTimeout(connectWS, 3000);
    };
    
    connectWS();
    return () => wsRef.current?.close();
  }, []);
  
  useEffect(() => {
    fetchData();
    
    // DISABLED: Auto-refresh removed - WebSocket handles ALL real-time updates
    // The constant setAuctions() calls were causing UI re-renders and "jumping" cards
    // If status sync is needed, implement a more surgical update that only changes
    // specific auction properties rather than replacing the entire array
    
    // Minimal background sync - ONLY for ended auctions and AOTD (every 60 seconds)
    const refreshInterval = setInterval(async () => {
      try {
        // Only fetch ended auctions and AOTD - NOT active auctions (WebSocket handles those)
        const [aotdRes, endedRes] = await Promise.all([
          axios.get(`${API}/auction-of-the-day`).catch(() => ({ data: null })),
          axios.get(`${API}/auctions/ended`).catch(() => ({ data: [] }))
        ]);
        
        if (endedRes.data && Array.isArray(endedRes.data)) {
          setEndedAuctions(endedRes.data);
        }
        
        // Update AOTD - ensure it has valid end_time
        if (aotdRes.data && aotdRes.data.id) {
          const aotdEndTime = new Date(aotdRes.data.end_time).getTime();
          if (aotdEndTime > Date.now()) {
            setAuctionOfTheDay(prev => {
              // Only update if ID changed or null
              if (!prev || prev.id !== aotdRes.data.id) {
                return aotdRes.data;
              }
              return prev;
            });
          } else {
            setAuctionOfTheDay(null);
          }
        }
      } catch (error) {
        console.log('Background refresh failed:', error.message);
      }
    }, 60000); // Every 60 seconds for minimal sync
    
    return () => clearInterval(refreshInterval);
  }, []);  // Empty dependency - only run once on mount
  
  // Handle bid
  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error(t('auctionPage.pleaseLogin'));
      navigate('/login');
      return;
    }
    
    try {
      const res = await axios.post(
        `${API}/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t('auctionPage.bidPlaced'));
      if (res.data.bids_remaining !== undefined) {
        updateBidsBalance(res.data.bids_remaining);
      }
    } catch (error) {
      // Don't show toast for silent errors (404, network errors, etc.)
      if (error.isSilentError || error.suppressToast || error.response?.status === 404) {
        console.log('Auction not found or ended');
        return;
      }
      const detail = error.response?.data?.detail;
      if (detail) {
        toast.error(detail);
      } else {
        toast.error(t('auctionPage.error'));
      }
    }
  };
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState('live');
  
  // Check if it's night time (23:30 - 06:00) - user's local time
  const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
  const isNightTime = currentHour >= 23.5 || currentHour < 6;
  
  // Filter out VIP auctions from homepage (VIP only visible on /vip page)
  // Night auctions are ALWAYS visible but marked, day auctions always visible
  const publicAuctions = auctions.filter(a => {
    if (a.is_vip_only) return false;
    return true;
  });
  
  // Helper function to check if a product is a voucher/gift card
  const isVoucherProduct = (productId) => {
    const product = products[productId];
    if (!product) return false;
    const category = (product.category || '').toLowerCase();
    // Show all voucher categories (bidblitz vouchers + external vouchers)
    return category === 'bidblitz gutscheine' || 
           category === 'gutscheine' || 
           category.includes('voucher') ||
           category.includes('gutschein');
  };

  // Helper to check voucher auctions by flag
  const isVoucherAuction = (auction) => {
    return auction.is_voucher === true || isVoucherProduct(auction.product_id);
  };

  // Helper function to check if it's a restaurant voucher auction
  const isRestaurantAuction = (auction) => {
    // Check all possible ways a restaurant auction could be marked
    return auction.is_restaurant === true ||
           auction.auction_type === 'restaurant_voucher' || 
           auction.category === 'restaurant_voucher' ||
           (auction.product && auction.product.category === 'Restaurants') ||
           (auction.product && auction.product.category === 'restaurant_voucher');
  };

  // Count auctions by type - Night auctions always counted
  const auctionCounts = {
    live: publicAuctions.filter(a => a.status === 'active').length,
    anfaenger: publicAuctions.filter(a => (a.is_beginner_only || a.is_beginner_auction) && a.status === 'active').length,
    gratis: publicAuctions.filter(a => isVoucherAuction(a) && a.status === 'active').length,
    restaurant: publicAuctions.filter(a => isRestaurantAuction(a) && a.status === 'active').length,
    nacht: publicAuctions.filter(a => a.is_night_auction).length,
    ende: endedAuctions.length, // Use endedAuctions from auction_history
    vip: auctions.filter(a => a.is_vip_only && a.status === 'active').length
  };
  
  // Apply filter
  const getFilteredAuctions = () => {
    switch(activeFilter) {
      case 'anfaenger':
        return publicAuctions.filter(a => (a.is_beginner_only || a.is_beginner_auction) && a.status === 'active');
      case 'gratis':
        // Filter by product category - show all voucher products
        return publicAuctions.filter(a => isVoucherAuction(a) && a.status === 'active');
      case 'restaurant':
        // Filter restaurant voucher auctions
        return publicAuctions.filter(a => isRestaurantAuction(a) && a.status === 'active');
      case 'nacht':
        // Night auctions always visible - show with timer/label when not night time
        return publicAuctions.filter(a => a.is_night_auction);
      case 'ende':
        // Use the endedAuctions from auction_history API
        return endedAuctions;
      case 'vip':
        return auctions.filter(a => a.is_vip_only && a.status === 'active');
      case 'live':
      default:
        return publicAuctions.filter(a => a.status === 'active');
    }
  };
  
  // Auction of the Day - exclude from grid if present
  const aotdId = auctionOfTheDay?.id;
  
  // Premium = first public auction (not AOTD)
  const premiumAuction = publicAuctions.find(a => a.id !== aotdId && a.status === 'active');
  
  // Filtered auctions for grid
  const filteredAuctions = getFilteredAuctions();
  
  // Stable sorting: Maintain card positions, only remove truly ended auctions
  // Use a ref to track the stable order of auction IDs
  const stableOrderRef = useRef([]);
  const lastFilterRef = useRef(activeFilter);
  
  // Grid auctions with stable positioning
  const gridAuctions = useMemo(() => {
    // Reset stable order when filter changes
    if (lastFilterRef.current !== activeFilter) {
      stableOrderRef.current = [];
      lastFilterRef.current = activeFilter;
    }
    
    // For ALL filters, show all filtered auctions without exclusions
    // The AOTD and Premium sections are bonus displays, not exclusions
    let result = filteredAuctions.filter(a => {
      // For ended filter, show all
      if (activeFilter === 'ende') return true;
      // For night filter, show all night auctions
      if (activeFilter === 'nacht') return true;
      // For live and other filters, check status and time
      if (a.status !== 'active' && a.status !== 'night_paused') return false;
      const timeLeft = new Date(a.end_time).getTime() - Date.now();
      return timeLeft > -5000;
    });
    
    // Sort by day/night based on current time
    // Day time (6:00-23:30): Day auctions first, night auctions at bottom
    // Night time (23:30-6:00): Night auctions first, day auctions at bottom
    if (activeFilter === 'live') {
      result = [...result].sort((a, b) => {
        const aIsNight = a.is_night_auction || false;
        const bIsNight = b.is_night_auction || false;
        
        if (aIsNight === bIsNight) return 0; // Same type, keep original order
        
        if (isNightTime) {
          // Night time: Night auctions first (true before false)
          return aIsNight ? -1 : 1;
        } else {
          // Day time: Day auctions first (false before true)
          return aIsNight ? 1 : -1;
        }
      });
    }
    
    return result;
  }, [filteredAuctions, activeFilter, isNightTime]);
  
  // Get AOTD product
  const aotdProduct = auctionOfTheDay?.product || (auctionOfTheDay?.product_id ? products[auctionOfTheDay.product_id] : null);
  
  // Filter buttons config with translations - Night filter always visible
  const filterButtons = [
    { id: 'live', label: t('auctionPage.filters.live') || 'Live', count: auctionCounts.live, color: 'from-cyan-500 to-cyan-600' },
    { id: 'anfaenger', label: t('auctionPage.filters.beginner') || 'Anfänger', count: auctionCounts.anfaenger, color: 'from-purple-500 to-violet-500', icon: '🎓' },
    { id: 'gratis', label: t('auctionPage.filters.free') || 'Gutschein', count: auctionCounts.gratis, color: 'from-green-500 to-emerald-500', icon: '🎫' },
    { id: 'restaurant', label: 'Restaurant', count: auctionCounts.restaurant, color: 'from-orange-500 to-amber-500', icon: '🍽️' },
    { id: 'nacht', label: t('auctionPage.filters.night') || 'Nacht', count: auctionCounts.nacht, color: 'from-indigo-600 to-purple-600', icon: '🌙' },
    { id: 'ende', label: t('auctionPage.filters.ending') || 'Ende', count: auctionCounts.ende, color: 'from-gray-500 to-gray-600' },
    { id: 'vip', label: t('auctionPage.filters.vip') || 'VIP', count: auctionCounts.vip, color: 'from-yellow-400 to-amber-500', icon: '⭐' }
  ];
  
  // Show skeleton loading instead of full page spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-200 to-cyan-300 p-2 pt-4 overflow-x-hidden">
        {/* Skeleton for Features Banner */}
        <div className="max-w-7xl mx-auto mb-3 px-2">
          <div className="h-12 bg-white/50 rounded-xl animate-pulse" />
        </div>
        
        {/* Skeleton for Jackpot */}
        <div className="max-w-4xl mx-auto mb-4 px-2">
          <div className="h-20 bg-white/50 rounded-xl animate-pulse" />
        </div>
        
        {/* Skeleton for Filter Buttons */}
        <div className="max-w-7xl mx-auto mb-3 px-2">
          <div className="flex gap-2 justify-center">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-8 w-20 bg-white/50 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
        
        {/* Skeleton for Auction Grid */}
        <div className="max-w-7xl mx-auto px-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
              <div key={i} className="bg-white/50 rounded-lg h-[280px] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-200 to-cyan-300 p-2 pt-4 overflow-x-hidden" data-testid="auctions-page">
      
      {/* Exit Intent Popup DISABLED - was causing layout jitter */}
      {/* <ExitIntentPopup /> */}
      
      {/* Features-Link Banner */}
      <div className="max-w-7xl mx-auto mb-3 px-2">
        <Link 
          to="/features" 
          className="block bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-3 text-center text-white font-bold hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg"
        >
          ✨ {t('auctionPage.discoverFeatures') || 'Entdecke alle Features & Extras'} →
        </Link>
      </div>
      
      {/* Global Jackpot - Top of Page */}
      <div className="max-w-4xl mx-auto mb-4 px-2">
        <GlobalJackpot />
      </div>
      
      {/* Excitement Status Bar */}
      <div className="max-w-7xl mx-auto mb-3 px-2">
        <ExcitementStatusBar />
      </div>
      
      {/* Last Chance Auctions - Ending Soon */}
      <div className="max-w-7xl mx-auto mb-4 px-2">
        <LastChanceSection language={language} />
      </div>
      
      <div className="text-center text-[10px] text-gray-600 mb-2">
        {new Date().toLocaleTimeString('de-DE')} | {publicAuctions.length} {t('auctionPage.liveAuctions') || 'Live-Auktionen'}
      </div>
      
      {/* Filter Buttons */}
      <div className="max-w-7xl mx-auto mb-3 px-2 overflow-x-auto scrollbar-hide">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {filterButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => setActiveFilter(btn.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                activeFilter === btn.id
                  ? `bg-gradient-to-r ${btn.color} text-white shadow-lg scale-105`
                  : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow'
              }`}
            >
              {btn.icon && <span>{btn.icon}</span>}
              {btn.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeFilter === btn.id ? 'bg-white/20' : 'bg-gray-200'
              }`}>
                {btn.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Main layout with trust badges on right */}
      <div className="flex gap-3 max-w-7xl mx-auto px-2">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Auction of the Day - Only show on 'live' filter */}
          {activeFilter === 'live' && auctionOfTheDay && aotdProduct && (
            <AuctionOfTheDay 
              auction={auctionOfTheDay} 
              product={aotdProduct} 
              onBid={handleBid}
              t={t}
              language={language}
              langKey={langKey}
              isAuthenticated={isAuthenticated}
              isVip={isVip}
              navigate={navigate}
            />
          )}
          
          {/* Premium Card only shows if NO AOTD and on 'live' filter */}
          {activeFilter === 'live' && !auctionOfTheDay && premiumAuction && products[premiumAuction.product_id] && (
            <PremiumCard auction={premiumAuction} product={products[premiumAuction.product_id]} onBid={handleBid} t={t} language={language} langKey={langKey} />
          )}
          
          {/* Ad Banner DISABLED - could cause layout shifts */}
          {/* {activeFilter === 'live' && <AdBanner />} */}
          
          <h2 className="text-sm font-bold text-gray-800 mt-3 mb-2">
            {activeFilter === 'live' && t('auctionPage.liveAuctions')}
            {activeFilter === 'anfaenger' && `🎓 ${t('auctionPage.beginnerAuctions')}`}
            {activeFilter === 'gratis' && `🎫 ${t('auctionPage.voucherAuctions') || 'Gebote-Gutscheine'}`}
            {activeFilter === 'restaurant' && `🍽️ Restaurant-Gutscheine`}
            {activeFilter === 'nacht' && `🌙 ${t('auctionPage.nightAuctions')}`}
            {activeFilter === 'ende' && t('auctionPage.endedAuctions')}
            {activeFilter === 'vip' && `⭐ ${t('auctionPage.vipAuctions')}`}
            {' '}({auctionCounts[activeFilter] || gridAuctions.length})
          </h2>
          
          {gridAuctions.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p className="text-lg">{t('auctionPage.noAuctionsInCategory')}</p>
              <button 
                onClick={() => setActiveFilter('live')}
                className="mt-2 text-cyan-600 underline"
              >
                {t('auctionPage.showAllLive')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {gridAuctions.map(auction => (
                activeFilter === 'ende' ? (
                  <EndedAuctionCard 
                    key={auction.id || auction.auction_id} 
                    auction={auction} 
                    product={products[auction.product_id] || auction.product}
                    t={t}
                    language={language}
                    langKey={langKey}
                  />
                ) : (
                  <AuctionCard 
                    key={auction.id} 
                    auction={auction} 
                    product={products[auction.product_id] || auction.product} 
                    onBid={handleBid}
                    t={t}
                    language={language}
                    langKey={langKey}
                    isAuthenticated={isAuthenticated}
                    isVip={isVip}
                    navigate={navigate}
                  />
                )
              ))}
            </div>
          )}
        </div>
        
        {/* Trust Badges - Right Side (hidden on mobile) */}
        <div className="hidden sm:flex flex-col gap-2 w-24">
          {/* SSL */}
          <div className="bg-white rounded-lg p-2 border border-green-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-[9px] font-bold text-green-800">SSL</p>
                <p className="text-[7px] text-green-600">256-Bit</p>
              </div>
            </div>
          </div>
          
          {/* Stripe */}
          <div className="bg-white rounded-lg p-2 border border-blue-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className="text-[9px] font-bold text-blue-800">Stripe</p>
                <p className="text-[7px] text-blue-600">PayPal</p>
              </div>
            </div>
          </div>
          
          {/* Dubai */}
          <div className="bg-white rounded-lg p-2 border border-amber-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <div>
                <p className="text-[9px] font-bold text-amber-800">Dubai</p>
                <p className="text-[7px] text-amber-600">DSOA</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <p className="text-center text-[8px] text-gray-500 mt-2">{t('auctionPage.priceNote')}</p>
      
      {/* Horizontal Ended Auctions Carousel - Only on live filter */}
      {activeFilter === 'live' && endedAuctions.length > 0 && (
        <div className="max-w-7xl mx-auto mt-6 px-2" data-testid="ended-auctions-carousel">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="text-gray-500">🏆</span>
              {t('auctionPage.recentWinners') || 'Kürzlich Beendet'}
            </h2>
            <button 
              onClick={() => setActiveFilter('ende')}
              className="text-xs text-cyan-600 hover:text-cyan-800 font-medium"
            >
              {t('auctionPage.showAll') || 'Alle anzeigen'} →
            </button>
          </div>
          <div className="relative">
            <div 
              className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 scroll-smooth"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {endedAuctions.slice(0, 10).map((auction) => (
                <div 
                  key={auction.id || auction.auction_id} 
                  className="flex-shrink-0 w-48"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <EndedAuctionCard 
                    auction={auction} 
                    product={products[auction.product_id] || auction.product}
                    t={t}
                    language={language}
                    langKey={langKey}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Price Guarantee Section */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PriceGuaranteeSection language={langKey} />
      </div>
      
      {/* Winner Gallery - Social Proof Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <WinnerGalleryHome />
      </div>
      
      {/* Quick Registration Section - Scroll target always exists */}
      <div id="quick-register" className="max-w-2xl mx-auto px-4 py-8 scroll-mt-20">
        {!isAuthenticated && (
          <QuickRegisterSection language={langKey} navigate={navigate} />
        )}
      </div>
    </div>
  );
}
