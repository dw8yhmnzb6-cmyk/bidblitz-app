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
  const [display, setDisplay] = useState('00:00:10');
  const [isLow, setIsLow] = useState(false);
  
  useEffect(() => {
    if (!endTime) return;
    
    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = Math.max(3000, end - now); // Minimum 3 seconds
      
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.max(3, Math.floor((diff % 60000) / 1000));
      
      const pad = (n) => String(n).padStart(2, '0');
      setDisplay(`${pad(h)}:${pad(m)}:${pad(s)}`);
      setIsLow(h === 0 && m === 0 && s < 10);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);
  
  return (
    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${isLow ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
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
  
  // Badge config
  let badgeText = 'FÜR PROFIS!';
  let badgeColor = 'bg-orange-500';
  
  if (auction.is_free_auction) {
    badgeText = '🎁 GRATIS';
    badgeColor = 'bg-green-500';
  } else if (auction.is_beginner_only) {
    badgeText = '🎓 ANFÄNGER';
    badgeColor = 'bg-purple-500';
  } else if (auction.is_vip_only) {
    badgeText = '⭐ VIP';
    badgeColor = 'bg-yellow-500 text-black';
  } else if (auction.is_night_auction) {
    badgeText = '🌙 NACHT';
    badgeColor = 'bg-indigo-600';
  }
  
  const discount = product.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;
  
  return (
    <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg overflow-hidden border border-cyan-300 cursor-pointer hover:shadow-lg transition-shadow"
         onClick={() => window.location.href = `/auctions/${auction.id}`}>
      
      {/* Header with Badge + Timer */}
      <div className={`${badgeColor} text-white text-[9px] font-bold py-1 px-2 flex items-center justify-between`}>
        <span>{badgeText}</span>
        <LiveTimer endTime={auction.end_time} />
      </div>
      
      {/* Content */}
      <div className="p-2">
        <h3 className="text-[10px] font-bold text-gray-800 uppercase leading-tight mb-1 line-clamp-2 min-h-[24px]">
          {product.name}
        </h3>
        <p className="text-[8px] text-gray-500 mb-1">
          Vergleichspreis*: € {product.retail_price?.toLocaleString('de-DE')},-
        </p>
        
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <LivePrice price={auction.current_price} bidderName={auction.last_bidder_name} />
              <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${discount > 90 ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'}`}>
                -{discount}%
              </span>
            </div>
            
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

// Info Sidebar with Badge Legend
const InfoSidebar = memo(() => (
  <div className="space-y-3">
    <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-bold text-gray-800 mb-2">AUKTIONS-TYPEN</h3>
      <div className="space-y-1.5 text-[9px]">
        <div className="flex items-center gap-2">
          <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">FÜR PROFIS!</span>
          <span className="text-gray-600">Standard-Auktion</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">🎓 ANFÄNGER</span>
          <span className="text-gray-600">Nur &lt;10 Siege</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">🎁 GRATIS</span>
          <span className="text-gray-600">Kostenlos bieten</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[8px] font-bold">⭐ VIP</span>
          <span className="text-gray-600">Exklusiv für VIPs</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">🌙 NACHT</span>
          <span className="text-gray-600">22-6 Uhr</span>
        </div>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-bold text-gray-800 mb-2">AKTIVITÄTSINDEX</h3>
      <div className="space-y-1 text-[9px]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span className="text-gray-600">Wenig Aktivität</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500"></div>
          <span className="text-gray-600">Mittlere Aktivität</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-500"></div>
          <span className="text-gray-600">Hohe Aktivität</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span className="text-gray-600">Sehr hoch</span>
        </div>
        <p className="text-[8px] text-gray-500 mt-1">💡 Bei niedriger Aktivität = bessere Chancen!</p>
      </div>
    </div>
    
    <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-bold text-gray-800 mb-2">SO FUNKTIONIERT'S</h3>
      <ol className="text-[9px] text-gray-600 space-y-1">
        <li><span className="font-bold text-cyan-600">1.</span> Gebote kaufen</li>
        <li><span className="font-bold text-cyan-600">2.</span> Produkt wählen & bieten</li>
        <li><span className="font-bold text-cyan-600">3.</span> Gewinnen & sparen!</li>
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
  
  // Grid auctions (6 for no-scroll view)
  const gridAuctions = auctions.filter(a => a.id !== premiumAuction?.id).slice(0, 6);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-cyan-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-600 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-200 to-cyan-300 p-3" data-testid="auctions-page">
      <div className="text-center text-xs text-gray-600 mb-2">
        {new Date().toLocaleTimeString('de-DE')} | {auctions.length} Live-Auktionen
      </div>
      
      <div className="flex gap-3 max-w-6xl mx-auto">
        <div className="flex-1">
          {premiumAuction && products[premiumAuction.product_id] && (
            <PremiumCard auction={premiumAuction} product={products[premiumAuction.product_id]} onBid={handleBid} />
          )}
          
          <h2 className="text-sm font-bold text-gray-800 mt-3 mb-2">Live-Auktionen</h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {gridAuctions.map(auction => (
              <AuctionCard key={auction.id} auction={auction} product={products[auction.product_id]} onBid={handleBid} />
            ))}
          </div>
        </div>
        
        <div className="hidden md:block w-48 flex-shrink-0">
          <InfoSidebar />
        </div>
      </div>
      
      <p className="text-center text-[8px] text-gray-500 mt-2">* Vergleichspreis = UVP</p>
    </div>
  );
}
