import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Auction of the Day Component - Special highlight
const AuctionOfTheDay = memo(({ auction, product, onBid }) => {
  if (!auction || !product) return null;
  
  const discount = product.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;
  
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
              <h2 className="text-sm sm:text-lg font-black text-amber-800 uppercase tracking-wide">Auktion des Tages</h2>
              <p className="text-[10px] sm:text-xs text-amber-600">Unser Top-Angebot heute!</p>
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
              {product.name}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-2">
              UVP: <span className="line-through">€ {product.retail_price?.toLocaleString('de-DE')},-</span>
            </p>
            
            <div className="flex items-center justify-between sm:items-end sm:gap-4">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500">Aktueller Preis</p>
                <p className="text-xl sm:text-2xl font-black text-amber-600">
                  € {auction.current_price?.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-[10px] sm:text-xs text-cyan-700">{auction.last_bidder_name || 'Startpreis'}</p>
              </div>
              
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Verbleibend</p>
                <LiveTimer endTime={auction.end_time} />
              </div>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); onBid(auction.id); }}
              className="mt-2 sm:mt-3 w-full py-2 sm:py-2.5 bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition-all hover:shadow-lg"
              data-testid="aotd-bid-button"
            >
              🔥 JETZT BIETEN
            </button>
          </div>
        </div>
        
        <div className="mt-2 sm:mt-3 pt-2 border-t border-amber-200 flex items-center justify-between text-[10px] sm:text-xs text-gray-500">
          <span>⚡ {auction.total_bids || 0} Gebote</span>
          <span>Zuletzt für <span className="text-green-600 font-bold">€ {(product.retail_price * 0.01).toFixed(2).replace('.', ',')}</span></span>
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
const ActivityIndex = memo(({ auctionId = '' }) => {
  const hash = auctionId ? auctionId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 50;
  const filledCount = 3 + (hash % 4);
  
  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="text-[8px] text-gray-600">Aktivität:</span>
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

// ISOLATED Timer Component - Updates independently every second
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
      
      // If diff is 0, the auction ended - show loading indicator
      if (diff === 0) {
        setDisplay('⏳');
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
  }, [endTime]); // Re-run when endTime changes from WebSocket
  
  return (
    <span className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded ${isLow ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
      {display}
    </span>
  );
});

// ISOLATED Price Component - Only updates when price changes via WebSocket
const LivePrice = memo(({ price, bidderName }) => (
  <div>
    <span className="text-lg font-black text-gray-800">
      € {price?.toFixed(2).replace('.', ',')}
    </span>
    <p className="text-[9px] text-cyan-700 truncate">{bidderName || 'Startpreis'}</p>
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
const AuctionCard = memo(({ auction, product, onBid }) => {
  if (!auction || !product) return null;
  
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
      <span key="free" className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">
        🎁
      </span>
    );
  }
  
  if (auction.is_night_auction) {
    badges.push(
      <span key="night" className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">
        🌙
      </span>
    );
  }
  
  // Header background color based on primary type
  let headerBg = 'bg-gradient-to-r from-cyan-500 to-cyan-600';
  if (auction.is_vip_only) headerBg = 'bg-gradient-to-r from-yellow-400 to-yellow-500';
  else if (auction.is_night_auction) headerBg = 'bg-gradient-to-r from-indigo-600 to-purple-600';
  else if (auction.is_free_auction) headerBg = 'bg-gradient-to-r from-green-500 to-emerald-500';
  else if (auction.is_beginner_only) headerBg = 'bg-gradient-to-r from-purple-500 to-violet-500';
  
  return (
    <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg overflow-hidden border border-cyan-300 cursor-pointer hover:shadow-lg transition-shadow"
         onClick={() => window.location.href = `/auctions/${auction.id}`}>
      
      {/* Header with Badges + Timer */}
      <div className={`${headerBg} text-white text-[9px] font-bold py-1 px-2 flex items-center justify-between`}>
        <div className="flex items-center gap-1 flex-wrap">
          {badges}
        </div>
        <LiveTimer endTime={auction.end_time} />
      </div>
      
      {/* Content */}
      <div className="p-2">
        <h3 className="text-[10px] font-bold text-gray-800 uppercase leading-tight mb-1 line-clamp-2 min-h-[24px]">
          {product.name}
        </h3>
        <p className="text-[8px] text-gray-500 mb-1">
          UVP: € {product.retail_price?.toLocaleString('de-DE')},-
        </p>
        
        <div className="flex gap-2">
          <div className="flex-1">
            <LivePrice price={auction.current_price} bidderName={auction.last_bidder_name} />
            
            <button 
              onClick={(e) => { e.stopPropagation(); onBid(auction.id); }}
              className="mt-2 w-full py-1.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-white font-bold text-[10px] rounded"
            >
              BIETEN
            </button>
          </div>
          
          <div className="w-14 h-14 bg-white rounded flex items-center justify-center shadow-sm flex-shrink-0">
            <img src={product.image_url || 'https://via.placeholder.com/56'} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        </div>
        
        <ActivityIndex auctionId={auction.id} />
      </div>
      
      <div className="bg-cyan-200/50 px-2 py-1 text-center">
        <p className="text-[8px] text-gray-600">
          Zuletzt für <span className="text-green-600 font-bold">€ {(product.retail_price * 0.03).toFixed(2).replace('.', ',')}</span>
        </p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if price or bidder changes
  return prevProps.auction.current_price === nextProps.auction.current_price &&
         prevProps.auction.last_bidder_name === nextProps.auction.last_bidder_name &&
         prevProps.auction.end_time === nextProps.auction.end_time;
});

// Premium Card
const PremiumCard = memo(({ auction, product, onBid }) => {
  if (!auction || !product) return null;
  
  return (
    <div className="bg-gradient-to-b from-cyan-100 to-cyan-200 rounded-lg p-3 border-2 border-cyan-400">
      <h2 className="text-sm font-bold text-gray-800 uppercase leading-tight mb-1">{product.name}</h2>
      <p className="text-[10px] text-gray-600 mb-2">Vergleichspreis*: € {product.retail_price?.toLocaleString('de-DE')},-</p>
      
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="mb-2">
            <LiveTimer endTime={auction.end_time} />
          </div>
          
          <div className="text-2xl font-black text-gray-800">
            € {auction.current_price?.toFixed(2).replace('.', ',')}
          </div>
          <p className="text-[10px] text-cyan-700">{auction.last_bidder_name || 'Startpreis'}</p>
          
          <button onClick={() => onBid(auction.id)}
            className="mt-2 w-full py-2 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-white font-bold text-sm rounded shadow-md">
            BIETEN
          </button>
          
          <ActivityIndex auctionId={auction.id} />
        </div>
        
        <div className="w-24 h-24 bg-white rounded flex items-center justify-center shadow">
          <img src={product.image_url || 'https://via.placeholder.com/96'} alt="" className="max-w-full max-h-full object-contain p-1" />
        </div>
      </div>
      
      <p className="text-[9px] text-gray-500 mt-2 text-center">
        Zuletzt für <span className="text-green-600 font-bold">€ {(product.retail_price * 0.02).toFixed(2).replace('.', ',')}</span>
      </p>
    </div>
  );
});

// Trust Badges - Compact for mobile
const TrustBadges = memo(() => (
  <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
    <h3 className="text-[9px] font-bold text-gray-800 mb-2">SICHER</h3>
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
const InfoSidebar = memo(() => (
  <div className="space-y-2">
    {/* Trust Badges First */}
    <TrustBadges />
    
    <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
      <h3 className="text-[9px] font-bold text-gray-800 mb-2">AUKTIONS-TYPEN</h3>
      <div className="space-y-1.5">
        {/* Rabatt Badge */}
        <div className="flex items-center gap-2 p-1.5 bg-red-50 rounded border border-red-200">
          <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[7px] font-bold whitespace-nowrap">-95%</span>
          <span className="text-[8px] text-gray-700">Rabatt</span>
        </div>
        
        {/* Anfänger */}
        <div className="flex items-center gap-2 p-1.5 bg-purple-50 rounded border border-purple-200">
          <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[7px] font-bold">🎓</span>
          <span className="text-[8px] text-gray-700">Anfänger</span>
        </div>
        
        {/* Gratis */}
        <div className="flex items-center gap-2 p-1.5 bg-green-50 rounded border border-green-200">
          <span className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[7px] font-bold">🎁</span>
          <span className="text-[8px] text-gray-700">Gratis</span>
        </div>
        
        {/* VIP */}
        <div className="flex items-center gap-2 p-1.5 bg-yellow-50 rounded border border-yellow-200">
          <span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[7px] font-bold">⭐</span>
          <span className="text-[8px] text-gray-700">VIP</span>
        </div>
        
        {/* Nacht */}
        <div className="flex items-center gap-2 p-1.5 bg-indigo-50 rounded border border-indigo-200">
          <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[7px] font-bold">🌙</span>
          <span className="text-[8px] text-gray-700">Nacht <b>½</b></span>
        </div>
        
        {/* Erinnerung */}
        <div className="flex items-center gap-2 p-1.5 bg-cyan-50 rounded border border-cyan-200">
          <span className="bg-cyan-500 text-white px-1.5 py-0.5 rounded text-[7px] font-bold">🔔</span>
          <span className="text-[8px] text-gray-700">Alarm</span>
        </div>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
      <h3 className="text-[9px] font-bold text-gray-800 mb-2">AKTIVITÄT</h3>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-green-500"></span>
          <span className="text-[8px] text-gray-700">Wenig</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-yellow-500"></span>
          <span className="text-[8px] text-gray-700">Mittel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-orange-500"></span>
          <span className="text-[8px] text-gray-700">Hoch</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500"></span>
          <span className="text-[8px] text-gray-700">Sehr hoch</span>
        </div>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
      <h3 className="text-[9px] font-bold text-gray-800 mb-2">SO GEHT'S</h3>
      <ol className="text-[8px] text-gray-700 space-y-1">
        <li className="flex items-center gap-1"><span className="font-bold text-cyan-600">1.</span> Kaufen</li>
        <li className="flex items-center gap-1"><span className="font-bold text-cyan-600">2.</span> Bieten</li>
        <li className="flex items-center gap-1"><span className="font-bold text-cyan-600">3.</span> Gewinnen</li>
      </ol>
    </div>
  </div>
));

export default function Auctions() {
  const { isAuthenticated, token, updateBidsBalance } = useAuth();
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
        axios.get(`${API}/auctions?status=active`),
        axios.get(`${API}/products`),
        axios.get(`${API}/auction-of-the-day`).catch(() => ({ data: null }))
      ]);
      
      const prodMap = {};
      productsRes.data.forEach(p => { prodMap[p.id] = p; });
      setProducts(prodMap);
      setAuctions(auctionsRes.data.filter(a => a.status === 'active'));
      
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
      
      const ws = new WebSocket(`${wsUrl}/ws/auctions/all_auctions`);
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
    
    // Auto-refresh auctions every 5 seconds (invisible to user)
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 5000);
    
    return () => clearInterval(refreshInterval);
  }, [fetchData]);
  
  // Handle bid
  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error('Bitte anmelden um zu bieten');
      navigate('/login');
      return;
    }
    
    try {
      const res = await axios.post(
        `${API}/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot platziert!');
      if (res.data.bids_remaining !== undefined) {
        updateBidsBalance(res.data.bids_remaining);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };
  
  // Filter out VIP auctions from homepage (VIP only visible on /vip page)
  const publicAuctions = auctions.filter(a => !a.is_vip_only);
  
  // Auction of the Day - exclude from grid if present
  const aotdId = auctionOfTheDay?.id;
  
  // Premium = first public auction (not AOTD)
  const premiumAuction = publicAuctions.find(a => a.id !== aotdId);
  
  // Grid auctions - ALL public auctions except premium and AOTD
  const gridAuctions = publicAuctions.filter(a => a.id !== premiumAuction?.id && a.id !== aotdId);
  
  // Get AOTD product
  const aotdProduct = auctionOfTheDay?.product || (auctionOfTheDay?.product_id ? products[auctionOfTheDay.product_id] : null);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-cyan-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-600 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-200 to-cyan-300 p-2" data-testid="auctions-page">
      <div className="text-center text-[10px] text-gray-600 mb-2">
        {new Date().toLocaleTimeString('de-DE')} | {publicAuctions.length} Live-Auktionen
      </div>
      
      {/* Main layout with trust badges on right */}
      <div className="flex gap-3 max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Auction of the Day - Top Highlight (replaces Premium Card when present) */}
          {auctionOfTheDay && aotdProduct && (
            <AuctionOfTheDay 
              auction={auctionOfTheDay} 
              product={aotdProduct} 
              onBid={handleBid} 
            />
          )}
          
          {/* Premium Card only shows if NO AOTD */}
          {!auctionOfTheDay && premiumAuction && products[premiumAuction.product_id] && (
            <PremiumCard auction={premiumAuction} product={products[premiumAuction.product_id]} onBid={handleBid} />
          )}
          
          {/* Ad Banner - Between Premium and Live Auctions */}
          <AdBanner />
          
          <h2 className="text-sm font-bold text-gray-800 mt-3 mb-2">
            Live-Auktionen ({gridAuctions.length})
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {gridAuctions.map(auction => (
              <AuctionCard key={auction.id} auction={auction} product={products[auction.product_id]} onBid={handleBid} />
            ))}
          </div>
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
      
      <p className="text-center text-[8px] text-gray-500 mt-2">* UVP = Vergleichspreis</p>
    </div>
  );
}
