import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
    <h3 className="text-[10px] font-bold text-gray-800 mb-1">SICHER & VERTRAUENSWÜRDIG</h3>
    <div className="grid grid-cols-2 gap-1">
      <div className="flex items-center gap-1 p-1 bg-green-50 rounded border border-green-200">
        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <p className="text-[7px] font-bold text-green-800">SSL 256-Bit</p>
      </div>
      
      <div className="flex items-center gap-1 p-1 bg-blue-50 rounded border border-blue-200">
        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <p className="text-[7px] font-bold text-blue-800">Stripe/PayPal</p>
      </div>
      
      <div className="flex items-center gap-1 p-1 bg-amber-50 rounded border border-amber-200">
        <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <p className="text-[7px] font-bold text-amber-800">Dubai DSOA</p>
      </div>
      
      <div className="flex items-center gap-1 p-1 bg-purple-50 rounded border border-purple-200">
        <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-[7px] font-bold text-purple-800">50.000+</p>
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
      <h3 className="text-[10px] font-bold text-gray-800 mb-1">AUKTIONS-TYPEN</h3>
      <div className="space-y-1">
        {/* Rabatt Badge */}
        <div className="flex items-center gap-1 p-1 bg-red-50 rounded border border-red-200">
          <span className="bg-red-500 text-white px-1 py-0.5 rounded text-[7px] font-bold">-95%</span>
          <span className="text-[7px] text-gray-600">Rabatt vs. UVP</span>
        </div>
        
        {/* Anfänger */}
        <div className="flex items-center gap-1 p-1 bg-purple-50 rounded border border-purple-200">
          <span className="bg-purple-500 text-white px-1 py-0.5 rounded text-[7px] font-bold">🎓</span>
          <span className="text-[7px] text-gray-600">Anfänger (&lt;10 Siege)</span>
        </div>
        
        {/* Gratis */}
        <div className="flex items-center gap-1 p-1 bg-green-50 rounded border border-green-200">
          <span className="bg-green-500 text-white px-1 py-0.5 rounded text-[7px] font-bold">🎁</span>
          <span className="text-[7px] text-gray-600">Gratis (kostenlos)</span>
        </div>
        
        {/* VIP */}
        <div className="flex items-center gap-1 p-1 bg-yellow-50 rounded border border-yellow-200">
          <span className="bg-yellow-500 text-black px-1 py-0.5 rounded text-[7px] font-bold">⭐</span>
          <span className="text-[7px] text-gray-600">VIP-Mitglieder</span>
        </div>
        
        {/* Nacht */}
        <div className="flex items-center gap-1 p-1 bg-indigo-50 rounded border border-indigo-200">
          <span className="bg-indigo-600 text-white px-1 py-0.5 rounded text-[7px] font-bold">🌙</span>
          <span className="text-[7px] text-gray-600">Nacht 23:30-6h <b>½ Preis!</b></span>
        </div>
        
        {/* Erinnerung */}
        <div className="flex items-center gap-1 p-1 bg-cyan-50 rounded border border-cyan-200">
          <span className="bg-cyan-500 text-white px-1 py-0.5 rounded text-[7px] font-bold">🔔</span>
          <span className="text-[7px] text-gray-600">Erinnerung (5 Min)</span>
        </div>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
      <h3 className="text-[10px] font-bold text-gray-800 mb-1">AKTIVITÄT</h3>
      <div className="flex flex-wrap gap-1 text-[7px]">
        <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-green-500"></span>Wenig</span>
        <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-yellow-500"></span>Mittel</span>
        <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-orange-500"></span>Hoch</span>
        <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-red-500"></span>Sehr</span>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm">
      <h3 className="text-[10px] font-bold text-gray-800 mb-1">SO GEHT'S</h3>
      <ol className="text-[7px] text-gray-600 space-y-0.5">
        <li><b className="text-cyan-600">1.</b> Gebote kaufen</li>
        <li><b className="text-cyan-600">2.</b> Bieten</li>
        <li><b className="text-cyan-600">3.</b> Gewinnen!</li>
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
  const wsRef = useRef(null);
  
  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [auctionsRes, productsRes] = await Promise.all([
        axios.get(`${API}/auctions?status=active`),
        axios.get(`${API}/products`)
      ]);
      
      const prodMap = {};
      productsRes.data.forEach(p => { prodMap[p.id] = p; });
      setProducts(prodMap);
      setAuctions(auctionsRes.data.filter(a => a.status === 'active'));
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
        `${API}/auctions/place-bid/${auctionId}`,
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
  
  // Premium = VIP or first auction
  const premiumAuction = auctions.find(a => a.is_vip_only) || auctions[0];
  
  // Grid auctions - ALL auctions except premium
  const gridAuctions = auctions.filter(a => a.id !== premiumAuction?.id);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-cyan-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-600 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-200 to-cyan-300 p-2" data-testid="auctions-page">
      <div className="text-center text-[10px] text-gray-600 mb-1">
        {new Date().toLocaleTimeString('de-DE')} | {auctions.length} Live-Auktionen
      </div>
      
      {/* Always flex row layout - sidebar on right */}
      <div className="flex gap-2 max-w-7xl mx-auto">
        {/* Main Content - takes remaining space */}
        <div className="flex-1 min-w-0">
          {premiumAuction && products[premiumAuction.product_id] && (
            <PremiumCard auction={premiumAuction} product={products[premiumAuction.product_id]} onBid={handleBid} />
          )}
          
          <h2 className="text-xs font-bold text-gray-800 mt-2 mb-1">
            Live ({gridAuctions.length})
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
            {gridAuctions.map(auction => (
              <AuctionCard key={auction.id} auction={auction} product={products[auction.product_id]} onBid={handleBid} />
            ))}
          </div>
        </div>
        
        {/* Sidebar - Always on right, narrower on mobile */}
        <div className="w-28 sm:w-36 md:w-44 flex-shrink-0">
          <InfoSidebar />
        </div>
      </div>
      
      <p className="text-center text-[7px] text-gray-500 mt-1">* UVP = Vergleichspreis</p>
    </div>
  );
}
