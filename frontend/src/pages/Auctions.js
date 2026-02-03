import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'sonner';
import GlobalJackpot from '../components/GlobalJackpot';
import { HappyHourBanner, LuckyBidCounter, ExcitementStatusBar } from '../components/ExcitementFeatures';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Auction of the Day Component - Special highlight
const AuctionOfTheDay = memo(({ auction, product, onBid, t, language }) => {
  if (!auction || !product) return null;
  
  // Check if auction is still active (not expired)
  const endTime = new Date(auction.end_time).getTime();
  const isExpired = endTime <= Date.now();
  
  // If expired, don't render
  if (isExpired) return null;
  
  const discount = product.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;
  
  // Handle both last_bidder and last_bidder_name field names
  const lastBidder = auction.last_bidder_name || auction.last_bidder;
  
  // Get translated product name (fallback to default name)
  const productName = product.name_translations?.[language] || product.name;
  const productDescription = product.description_translations?.[language] || product.description;
  
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
          <div className="bg-red-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold animate-pulse">
            -{discount}%
          </div>
        </div>
        
        {/* Mobile: Stack layout, Desktop: Side by side */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Product Image */}
          <div className="w-full sm:w-28 h-24 sm:h-28 bg-white rounded-lg flex items-center justify-center shadow-inner border border-amber-200 flex-shrink-0">
            <img 
              src={product.image_url || 'https://via.placeholder.com/128'} 
              alt={product.name}
              className="max-w-full max-h-full object-contain p-2"
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
              onClick={(e) => { e.stopPropagation(); onBid(auction.id); }}
              className="mt-2 sm:mt-3 w-full py-2 sm:py-2.5 bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition-all hover:shadow-lg"
              data-testid="aotd-bid-button"
            >
              🔥 {t('auctionPage.bidNow')}
            </button>
          </div>
        </div>
        
        <div className="mt-2 sm:mt-3 pt-2 border-t border-amber-200 flex items-center justify-between text-[10px] sm:text-xs text-gray-500">
          <span>⚡ {auction.total_bids || 0} {t('auctionPage.bidsCount')}</span>
          <span>{t('auctionPage.lastSoldFor')} <span className="text-green-600 font-bold">€ {(product.retail_price * 0.01).toFixed(2).replace('.', ',')}</span></span>
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
      />
    </div>
  );
});

// Activity Index - Snipster Style (30-60%)
const ActivityIndex = memo(({ auctionId = '', t }) => {
  const hash = auctionId ? auctionId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 50;
  const filledCount = 3 + (hash % 4);
  
  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="text-[8px] text-gray-600">{t('auctionPage.activity')}:</span>
      <div className="flex gap-px">
        {[...Array(10)].map((_, i) => {
          let color = '#d1d5db';
          if (i < filledCount) {
            if (i < 2) color = '#22c55e';
            else if (i < 4) color = '#84cc16';
            else if (i < 6) color = '#eab308';
            else if (i < 8) color = '#f97316';
            else color = '#ef4444';
          }
          return <div key={i} className="w-1.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />;
        })}
      </div>
    </div>
  );
});

// ISOLATED Timer Component - Updates smoothly every second without visible flicker
const LiveTimer = memo(({ endTime }) => {
  const [display, setDisplay] = useState('--:--:--');
  const [isLow, setIsLow] = useState(false);
  
  useEffect(() => {
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
        return;
      }
      
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      const pad = (n) => String(n).padStart(2, '0');
      setDisplay(`${pad(h)}:${pad(m)}:${pad(s)}`);
      setIsLow(h === 0 && m === 0 && s <= 10);
    };
    
    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);
  
  return (
    <span className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-colors duration-300 ${isLow ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
      {display}
    </span>
  );
});

// ISOLATED Price Component - Only updates when price changes via WebSocket
const LivePrice = memo(({ price, bidderName, t }) => (
  <div>
    <span className="text-lg font-black text-gray-800">
      € {price?.toFixed(2).replace('.', ',')}
    </span>
    <p className="text-[9px] text-cyan-700 truncate">{bidderName || t('auctionPage.startPrice')}</p>
  </div>
));

// Static Product Info - Never re-renders
const ProductInfo = memo(({ name, retailPrice, imageUrl, discount }) => (
  <>
    <h3 className="text-[10px] font-bold text-gray-800 uppercase leading-tight mb-1 line-clamp-2 min-h-[24px]">
      {name}
    </h3>
    <p className="text-[8px] text-gray-500 mb-1">
      Vergleichspreis*: € {retailPrice?.toLocaleString('de-DE')},-
    </p>
    <div className="flex gap-2">
      <div className="flex-1">
        {/* Price slot - filled by parent */}
      </div>
      <div className="w-14 h-14 bg-white rounded flex items-center justify-center shadow-sm flex-shrink-0">
        <img src={imageUrl || 'https://via.placeholder.com/56'} alt="" className="max-w-full max-h-full object-contain" />
      </div>
    </div>
  </>
));

// Auction Card - Only Timer and Price update, rest is static
const AuctionCard = memo(({ auction, product, onBid, t, language }) => {
  if (!auction || !product) return null;
  
  // Get translated product name (fallback to default name)
  const productName = product.name_translations?.[language] || product.name;
  
  const discount = product.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;
  
  // Collect all badges for this auction
  const badges = [];
  
  // Discount badge (always show)
  badges.push(
    <span key="discount" className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">
      -{discount}%
    </span>
  );
  
  // Special auction type badges
  if (auction.is_vip_only) {
    badges.push(
      <span key="vip" className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[8px] font-bold">
        VIP
      </span>
    );
  }
  
  if (auction.is_beginner_only) {
    badges.push(
      <span key="beginner" className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">
        🎓
      </span>
    );
  }
  
  if (auction.is_free_auction) {
    badges.push(
      <span key="free" className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold" title={t('auctionPage.freeBidPayEnd')}>
        🎁 {t('auctionPage.filters.free').toUpperCase()}
      </span>
    );
  }
  
  if (auction.is_night_auction) {
    badges.push(
      <span key="night" className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[8px] font-bold" title={t('auctionPage.nightTime')}>
        🌙 {t('auctionPage.filters.night').toUpperCase()}
      </span>
    );
  }
  
  // Check if night auction is paused (daytime)
  const isNightPaused = auction.is_night_paused;
  
  // Header background color based on primary type
  let headerBg = 'bg-gradient-to-r from-cyan-500 to-cyan-600';
  if (auction.is_vip_only) headerBg = 'bg-gradient-to-r from-yellow-400 to-yellow-500';
  else if (auction.is_night_auction) headerBg = 'bg-gradient-to-r from-indigo-600 to-purple-600';
  else if (auction.is_free_auction) headerBg = 'bg-gradient-to-r from-green-500 to-emerald-500';
  else if (auction.is_beginner_only) headerBg = 'bg-gradient-to-r from-purple-500 to-violet-500';
  
  return (
    <div className={`bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg overflow-hidden border border-cyan-300 cursor-pointer hover:shadow-lg transition-shadow ${isNightPaused ? 'opacity-60' : ''}`}
         onClick={() => window.location.href = `/auctions/${auction.id}`}>
      
      {/* Header with Badges + Timer */}
      <div className={`${headerBg} text-white text-[9px] font-bold py-1 px-2 flex items-center justify-between`}>
        <div className="flex items-center gap-1 flex-wrap">
          {badges}
        </div>
        {isNightPaused ? (
          <span className="text-[8px] opacity-80">{auction.night_message || '🌙 23:30-06:00'}</span>
        ) : (
          <LiveTimer endTime={auction.end_time} />
        )}
      </div>
      
      {/* Free Auction Notice */}
      {auction.is_free_auction && (
        <div className="bg-green-100 text-green-800 text-[8px] px-2 py-0.5 text-center border-b border-green-200">
          ✓ {t('auctionPage.freeBidPayEnd')}
        </div>
      )}
      
      {/* Content */}
      <div className="p-2">
        <h3 className="text-[10px] font-bold text-gray-800 uppercase leading-tight mb-1 line-clamp-2 min-h-[24px]">
          {productName}
        </h3>
        <p className="text-[8px] text-gray-500 mb-1">
          {t('auctionPage.uvp')}: € {product.retail_price?.toLocaleString('de-DE')},-
        </p>
        
        <div className="flex gap-2">
          <div className="flex-1">
            <LivePrice price={auction.current_price} bidderName={auction.last_bidder_name} t={t} />
            
            <button 
              onClick={(e) => { e.stopPropagation(); onBid(auction.id); }}
              disabled={isNightPaused}
              className={`mt-2 w-full py-1.5 ${isNightPaused ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400'} text-white font-bold text-[10px] rounded`}
            >
              {isNightPaused ? `🌙 ${t('auctionPage.nightOnly')}` : t('auctionPage.bid')}
            </button>
          </div>
          
          <div className="w-14 h-14 bg-white rounded flex items-center justify-center shadow-sm flex-shrink-0">
            <img src={product.image_url || 'https://via.placeholder.com/56'} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        </div>
        
        <ActivityIndex auctionId={auction.id} t={t} />
      </div>
      
      <div className="bg-cyan-200/50 px-2 py-1 text-center">
        <p className="text-[8px] text-gray-600">
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

// Premium Card
const PremiumCard = memo(({ auction, product, onBid, t, language }) => {
  if (!auction || !product) return null;
  
  // Get translated product name (fallback to default name)
  const productName = product.name_translations?.[language] || product.name;
  
  return (
    <div className="bg-gradient-to-b from-cyan-100 to-cyan-200 rounded-lg p-3 border-2 border-cyan-400">
      <h2 className="text-sm font-bold text-gray-800 uppercase leading-tight mb-1">{productName}</h2>
      <p className="text-[10px] text-gray-600 mb-2">{t('auctionPage.comparePrice')}: € {product.retail_price?.toLocaleString('de-DE')},-</p>
      
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="mb-2">
            <LiveTimer endTime={auction.end_time} />
          </div>
          
          <div className="text-2xl font-black text-gray-800">
            € {auction.current_price?.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-[10px] text-cyan-700">{auction.last_bidder_name || t('auctionPage.startPrice')}</p>
          
          <button onClick={() => onBid(auction.id)}
            className="mt-2 w-full py-2 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-white font-bold text-sm rounded shadow-md">
            {t('auctionPage.bid')}
          </button>
          
          <ActivityIndex auctionId={auction.id} t={t} />
        </div>
        
        <div className="w-24 h-24 bg-white rounded flex items-center justify-center shadow">
          <img src={product.image_url || 'https://via.placeholder.com/96'} alt="" className="max-w-full max-h-full object-contain p-1" />
        </div>
      </div>
      
      <p className="text-[9px] text-gray-500 mt-2 text-center">
        {t('auctionPage.lastSoldFor')} <span className="text-green-600 font-bold">€ {(product.retail_price * 0.02).toFixed(2).replace('.', ',')}</span>
      </p>
    </div>
  );
});

// Trust Badges - Compact for mobile
const TrustBadges = memo(({ t }) => (
  <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
    <h3 className="text-[9px] font-bold text-gray-800 mb-2">{t('auctionPage.secure')}</h3>
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center gap-1.5 p-1.5 bg-green-50 rounded border border-green-200">
        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-[8px] font-bold text-green-800">SSL</p>
      </div>
      
      <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 rounded border border-blue-200">
        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <p className="text-[8px] font-bold text-blue-800">Stripe</p>
      </div>
      
      <div className="flex items-center gap-1.5 p-1.5 bg-amber-50 rounded border border-amber-200">
        <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <p className="text-[8px] font-bold text-amber-800">Dubai</p>
      </div>
      
      <div className="flex items-center gap-1.5 p-1.5 bg-purple-50 rounded border border-purple-200">
        <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        </div>
        <p className="text-[8px] font-bold text-purple-800">50K+</p>
      </div>
    </div>
  </div>
));

// Info Sidebar with Badge Legend - Compact for mobile
const InfoSidebar = memo(({ t }) => (
  <div className="space-y-2">
    {/* Trust Badges First */}
    <TrustBadges t={t} />
    
    <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
      <h3 className="text-[9px] font-bold text-gray-800 mb-2">{t('auctionPage.auctionTypes')}</h3>
      <div className="space-y-1.5">
        {/* Rabatt Badge */}
        <div className="flex items-center gap-2 p-1.5 bg-red-50 rounded border border-red-200">
          <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[7px] font-bold whitespace-nowrap">-95%</span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.discount')}</span>
        </div>
        
        {/* Anfänger */}
        <div className="flex items-center gap-2 p-1.5 bg-purple-50 rounded border border-purple-200">
          <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[7px] font-bold">🎓</span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.beginner')}</span>
        </div>
        
        {/* Gratis */}
        <div className="flex items-center gap-2 p-1.5 bg-green-50 rounded border border-green-200">
          <span className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[7px] font-bold">🎁</span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.free')}</span>
        </div>
        
        {/* VIP */}
        <div className="flex items-center gap-2 p-1.5 bg-yellow-50 rounded border border-yellow-200">
          <span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[7px] font-bold">⭐</span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.vipLabel')}</span>
        </div>
        
        {/* Nacht */}
        <div className="flex items-center gap-2 p-1.5 bg-indigo-50 rounded border border-indigo-200">
          <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[7px] font-bold">🌙</span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.night')} <b>½</b></span>
        </div>
        
        {/* Erinnerung */}
        <div className="flex items-center gap-2 p-1.5 bg-cyan-50 rounded border border-cyan-200">
          <span className="bg-cyan-500 text-white px-1.5 py-0.5 rounded text-[7px] font-bold">🔔</span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.alarm')}</span>
        </div>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
      <h3 className="text-[9px] font-bold text-gray-800 mb-2">{t('auctionPage.activity').toUpperCase()}</h3>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-green-500"></span>
          <span className="text-[8px] text-gray-700">{t('auctionPage.activityLow')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-yellow-500"></span>
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
  const { isAuthenticated, token, updateBidsBalance } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [auctionOfTheDay, setAuctionOfTheDay] = useState(null);
  const wsRef = useRef(null);
  
  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [auctionsRes, productsRes, aotdRes] = await Promise.all([
        axios.get(`${API}/auctions`), // Load ALL auctions (including ended)
        axios.get(`${API}/products`),
        axios.get(`${API}/auction-of-the-day`).catch(() => ({ data: null }))
      ]);
      
      const prodMap = {};
      productsRes.data.forEach(p => { prodMap[p.id] = p; });
      setProducts(prodMap);
      setAuctions(auctionsRes.data); // Don't filter - we need ended auctions too
      
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
    
    // Auto-refresh auctions every 5 seconds (reduced frequency to minimize UI churn)
    // The WebSocket handles real-time bid updates, this is just for status sync
    const refreshInterval = setInterval(() => {
      const silentFetch = async () => {
        try {
          const [auctionsRes, productsRes, aotdRes] = await Promise.all([
            axios.get(`${API}/auctions?status=active`),
            axios.get(`${API}/products`),
            axios.get(`${API}/auction-of-the-day`).catch(() => ({ data: null }))
          ]);
          
          // Only update if we have valid data
          if (auctionsRes.data && Array.isArray(auctionsRes.data)) {
            setAuctions(auctionsRes.data);
          }
          
          if (productsRes.data && Array.isArray(productsRes.data)) {
            const prodMap = {};
            productsRes.data.forEach(p => { prodMap[p.id] = p; });
            setProducts(prodMap);
          }
          
          // Update AOTD - ensure it has valid end_time
          if (aotdRes.data && aotdRes.data.id) {
            const aotdEndTime = new Date(aotdRes.data.end_time).getTime();
            // Only set AOTD if it's not expired
            if (aotdEndTime > Date.now()) {
              setAuctionOfTheDay(aotdRes.data);
            } else {
              // AOTD expired - clear it so system picks a new one on next fetch
              setAuctionOfTheDay(null);
            }
          }
        } catch (error) {
          // Silent fail - don't show errors for background refresh
          console.log('Background refresh failed:', error.message);
        }
      };
      silentFetch();
    }, 5000); // Every 5 seconds (WebSocket handles real-time updates)
    
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
      // Don't show toast for 404 errors (normal when auction not found or ended)
      if (error.response?.status === 404) {
        console.log('Auction not found or ended');
        return;
      }
      toast.error(error.response?.data?.detail || t('auctionPage.error'));
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
  
  // Count auctions by type - Night auctions always counted
  const auctionCounts = {
    live: publicAuctions.filter(a => a.status === 'active').length,
    anfaenger: publicAuctions.filter(a => (a.is_beginner_only || a.is_beginner_auction) && a.status === 'active').length,
    gratis: publicAuctions.filter(a => a.is_free_auction && a.status === 'active').length,
    nacht: publicAuctions.filter(a => a.is_night_auction).length,
    ende: auctions.filter(a => a.status === 'ended').length,
    vip: auctions.filter(a => a.is_vip_only && a.status === 'active').length
  };
  
  // Apply filter
  const getFilteredAuctions = () => {
    switch(activeFilter) {
      case 'anfaenger':
        return publicAuctions.filter(a => (a.is_beginner_only || a.is_beginner_auction) && a.status === 'active');
      case 'gratis':
        return publicAuctions.filter(a => a.is_free_auction && a.status === 'active');
      case 'nacht':
        // Night auctions always visible - show with timer/label when not night time
        return publicAuctions.filter(a => a.is_night_auction);
      case 'ende':
        // Show ALL ended auctions from the full auctions list
        return auctions.filter(a => a.status === 'ended');
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
    
    // For "Ende" filter, return ended auctions directly without filtering by status/time
    if (activeFilter === 'ende') {
      return filteredAuctions.filter(a => a.id !== premiumAuction?.id && a.id !== aotdId);
    }
    
    // Get valid auctions (exclude AOTD, premium, and truly ended)
    const validAuctions = filteredAuctions.filter(a => {
      if (a.id === premiumAuction?.id || a.id === aotdId) return false;
      // For night filter, show all night auctions regardless of status
      if (activeFilter === 'nacht') return true;
      if (a.status !== 'active') return false;
      // Only filter out if time is more than 5 seconds past (give buffer for refresh)
      const timeLeft = new Date(a.end_time).getTime() - Date.now();
      return timeLeft > -5000; // Keep auctions that ended within last 5 seconds
    });
    
    // Build a map for quick lookup
    const auctionMap = new Map(validAuctions.map(a => [a.id, a]));
    const currentIds = new Set(validAuctions.map(a => a.id));
    
    // If we have no stable order yet, create initial sorted order
    if (stableOrderRef.current.length === 0) {
      const sorted = [...validAuctions].sort((a, b) => {
        // Night auctions at the bottom
        if (a.is_night_auction && !b.is_night_auction) return 1;
        if (!a.is_night_auction && b.is_night_auction) return -1;
        // Sort by end_time (soonest first)
        return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
      });
      stableOrderRef.current = sorted.map(a => a.id);
    }
    
    // Build result using stable order
    const result = [];
    const usedIds = new Set();
    
    // First: Add auctions in their stable order (if they still exist)
    for (const id of stableOrderRef.current) {
      if (auctionMap.has(id)) {
        const auction = auctionMap.get(id);
        // Double check it's not ended (timer > -5s)
        const timeLeft = new Date(auction.end_time).getTime() - Date.now();
        if (timeLeft > -5000) {
          result.push(auction);
          usedIds.add(id);
        }
      }
    }
    
    // Second: Add any NEW auctions that appeared (e.g., from auto-restart)
    // Insert them in correct sorted position
    const newAuctions = validAuctions.filter(a => !usedIds.has(a.id));
    for (const newAuction of newAuctions) {
      // Find correct position to insert
      let insertIndex = result.length; // Default: end
      for (let i = 0; i < result.length; i++) {
        const existing = result[i];
        // Night auctions go to the bottom
        if (newAuction.is_night_auction && !existing.is_night_auction) {
          continue; // Keep looking
        }
        if (!newAuction.is_night_auction && existing.is_night_auction) {
          insertIndex = i;
          break;
        }
        // Same category: compare by end time
        if (new Date(newAuction.end_time).getTime() < new Date(existing.end_time).getTime()) {
          insertIndex = i;
          break;
        }
      }
      result.splice(insertIndex, 0, newAuction);
    }
    
    // Update stable order ref with current valid IDs
    stableOrderRef.current = result.map(a => a.id);
    
    return result;
  }, [filteredAuctions, premiumAuction?.id, aotdId, activeFilter]);
  
  // Get AOTD product
  const aotdProduct = auctionOfTheDay?.product || (auctionOfTheDay?.product_id ? products[auctionOfTheDay.product_id] : null);
  
  // Filter buttons config with translations - Night filter always visible
  const filterButtons = [
    { id: 'live', label: t('auctionPage.filters.live') || 'Live', count: auctionCounts.live, color: 'from-cyan-500 to-cyan-600' },
    { id: 'anfaenger', label: t('auctionPage.filters.beginner') || 'Anfänger', count: auctionCounts.anfaenger, color: 'from-purple-500 to-violet-500', icon: '🎓' },
    { id: 'gratis', label: t('auctionPage.filters.free') || 'Gutscheine', count: auctionCounts.gratis, color: 'from-green-500 to-emerald-500', icon: '🎫' },
    { id: 'nacht', label: t('auctionPage.filters.night') || 'Nacht', count: auctionCounts.nacht, color: 'from-indigo-600 to-purple-600', icon: '🌙' },
    { id: 'ende', label: t('auctionPage.filters.ending') || 'Ende', count: auctionCounts.ende, color: 'from-gray-500 to-gray-600' },
    { id: 'vip', label: t('auctionPage.filters.vip') || 'VIP', count: auctionCounts.vip, color: 'from-yellow-400 to-amber-500', icon: '⭐' }
  ];
  
  if (loading) {
    return (
      <div className="min-h-screen bg-cyan-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-600 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-200 to-cyan-300 p-2 pt-16 sm:pt-20" data-testid="auctions-page">
      
      {/* Global Jackpot - Top of Page */}
      <div className="max-w-4xl mx-auto mb-4">
        <GlobalJackpot />
      </div>
      
      {/* Excitement Status Bar */}
      <div className="max-w-7xl mx-auto mb-3">
        <ExcitementStatusBar />
      </div>
      
      <div className="text-center text-[10px] text-gray-600 mb-2">
        {new Date().toLocaleTimeString('de-DE')} | {publicAuctions.length} {t('auctionPage.liveAuctions') || 'Live-Auktionen'}
      </div>
      
      {/* Filter Buttons */}
      <div className="max-w-7xl mx-auto mb-3">
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
      <div className="flex gap-3 max-w-7xl mx-auto">
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
            />
          )}
          
          {/* Premium Card only shows if NO AOTD and on 'live' filter */}
          {activeFilter === 'live' && !auctionOfTheDay && premiumAuction && products[premiumAuction.product_id] && (
            <PremiumCard auction={premiumAuction} product={products[premiumAuction.product_id]} onBid={handleBid} t={t} language={language} />
          )}
          
          {/* Ad Banner - Only on live filter */}
          {activeFilter === 'live' && <AdBanner />}
          
          <h2 className="text-sm font-bold text-gray-800 mt-3 mb-2">
            {activeFilter === 'live' && t('auctionPage.liveAuctions')}
            {activeFilter === 'anfaenger' && `🎓 ${t('auctionPage.beginnerAuctions')}`}
            {activeFilter === 'gratis' && `🎁 ${t('auctionPage.freeAuctions')}`}
            {activeFilter === 'nacht' && `🌙 ${t('auctionPage.nightAuctions')}`}
            {activeFilter === 'ende' && t('auctionPage.endedAuctions')}
            {activeFilter === 'vip' && `⭐ ${t('auctionPage.vipAuctions')}`}
            {' '}({gridAuctions.length})
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
                <AuctionCard 
                  key={auction.id} 
                  auction={auction} 
                  product={products[auction.product_id] || auction.product} 
                  onBid={handleBid}
                  t={t}
                  language={language}
                />
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
    </div>
  );
}
