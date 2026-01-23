import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Clock, Trophy, TrendingUp, Users, ChevronRight, Zap } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Activity Index - Always shows 30-60%
const ActivityIndex = ({ auctionId = '' }) => {
  const hash = auctionId ? auctionId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 50;
  const position = 30 + (hash % 31);
  
  return (
    <div className="mt-2">
      <div className="text-[10px] text-gray-400 mb-1">Aktivitätsindex:</div>
      <div className="relative h-1.5 rounded-full overflow-hidden bg-gray-700">
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(to right, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #ef4444 100%)'
          }}
        />
        <div 
          className="absolute top-0 w-1 h-full bg-white rounded-full shadow-lg"
          style={{ 
            left: `${position}%`,
            boxShadow: '0 0 6px rgba(255,255,255,0.8)'
          }}
        />
      </div>
    </div>
  );
};

// Live Timer Component - Updates every second
const LiveTimer = ({ endTime, isUrgent, onExpired }) => {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0, expired: false });
  
  useEffect(() => {
    if (!endTime) return;
    
    const calc = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = Math.max(0, end - now);
      
      if (diff <= 0) {
        setTime({ h: 0, m: 0, s: 0, expired: true });
        if (onExpired) onExpired();
        return;
      }
      
      setTime({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        expired: false
      });
    };
    
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endTime, onExpired]);
  
  const pad = (n) => String(n).padStart(2, '0');
  const urgent = time.h === 0 && time.m < 1 && !time.expired;
  
  if (time.expired) {
    return <span className="text-cyan-400 text-xs animate-pulse">Neustart...</span>;
  }
  
  return (
    <div className={`flex items-center gap-1 font-mono font-bold ${urgent ? 'text-red-400' : 'text-white'}`}>
      <Clock className="w-3 h-3" />
      <span className="bg-black/30 px-1 rounded">{pad(time.h)}</span>
      <span>:</span>
      <span className="bg-black/30 px-1 rounded">{pad(time.m)}</span>
      <span>:</span>
      <span className={`px-1 rounded ${urgent ? 'bg-red-500 text-white' : 'bg-black/30'}`}>
        {pad(time.s)}
      </span>
    </div>
  );
};

// Premium Featured Auction
const PremiumAuction = ({ auction, product, onBid, onRefresh }) => {
  const navigate = useNavigate();
  
  if (!auction || !product) return null;
  
  return (
    <div 
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      onClick={() => navigate(`/auctions/${auction.id}`)}
      style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0c2340 50%, #0a1628 100%)'
      }}
    >
      {/* Premium Badge */}
      <div className="absolute top-4 left-4 z-10">
        <span className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <Trophy className="w-3 h-3" /> PREMIUM AUKTION
        </span>
      </div>
      
      {/* Timer Badge */}
      <div className={`absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur`}>
        <LiveTimer endTime={auction.end_time} onExpired={onRefresh} />
      </div>
      
      <div className="flex flex-col md:flex-row p-6 gap-6">
        {/* Product Image */}
        <div className="w-full md:w-1/2 flex items-center justify-center">
          <div className="bg-white rounded-xl p-4 shadow-2xl">
            <img 
              src={product.image_url || 'https://via.placeholder.com/300'}
              alt={product.name}
              className="w-full max-w-[280px] h-auto object-contain"
            />
          </div>
        </div>
        
        {/* Product Info */}
        <div className="w-full md:w-1/2 flex flex-col justify-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {product.name}
          </h2>
          
          <p className="text-gray-400 mb-4">
            Vergleichspreis*: <span className="line-through">€ {product.retail_price?.toLocaleString('de-DE')},-</span>
          </p>
          
          {/* Current Price */}
          <div className="mb-4">
            <span className="text-5xl font-black text-white">
              € {auction.current_price?.toFixed(2).replace('.', ',')}
            </span>
          </div>
          
          {/* Last Bidder */}
          <p className="text-cyan-400 mb-4">
            {auction.last_bidder_name || 'Sei der Erste!'}
          </p>
          
          {/* Activity Index */}
          <ActivityIndex auctionId={auction.id} />
          
          {/* Bid Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onBid(auction.id);
            }}
            className="mt-6 w-full md:w-auto px-12 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold text-xl rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            BIETEN
          </button>
        </div>
      </div>
    </div>
  );
};

// Small Auction Card
const AuctionCard = ({ auction, product, onBid, onRefresh }) => {
  const navigate = useNavigate();
  
  if (!auction || !product) return null;
  
  return (
    <div 
      onClick={() => navigate(`/auctions/${auction.id}`)}
      className="rounded-xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(145deg, #1e3a5f 0%, #0f2744 100%)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      {/* Timer Header */}
      <div className="px-3 py-2 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="flex items-center gap-1">
          {auction.is_vip_only && (
            <span className="bg-yellow-400 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">VIP</span>
          )}
          {auction.is_beginner_only && (
            <span className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">🎓</span>
          )}
          {auction.is_free_auction && (
            <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">GRATIS</span>
          )}
        </div>
        <LiveTimer endTime={auction.end_time} onExpired={onRefresh} />
      </div>
      
      {/* Content */}
      <div className="p-3">
        <h3 className="text-white text-sm font-bold mb-1 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        
        <p className="text-gray-400 text-xs mb-2">
          Vergleichspreis*: € {product.retail_price?.toLocaleString('de-DE')},-
        </p>
        
        <div className="flex gap-3">
          <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img 
              src={product.image_url || 'https://via.placeholder.com/64'}
              alt=""
              className="max-w-full max-h-full object-contain p-1"
            />
          </div>
          
          <div className="flex-1">
            <p className="text-2xl font-black text-white">
              € {auction.current_price?.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-cyan-400 text-xs truncate">
              {auction.last_bidder_name || 'Startpreis'}
            </p>
          </div>
        </div>
        
        <ActivityIndex auctionId={auction.id} />
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onBid(auction.id);
          }}
          className="w-full mt-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold text-sm rounded-lg transition-all"
        >
          BIETEN
        </button>
      </div>
    </div>
  );
};

// Stats Bar
const StatsBar = ({ totalBids, activeUsers, activeAuctions }) => (
  <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] rounded-xl p-4 mb-6">
    <div className="flex justify-around text-center">
      <div>
        <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
          <Zap className="w-4 h-4" />
          <span className="font-bold text-lg">{activeAuctions}</span>
        </div>
        <p className="text-gray-400 text-xs">Live Auktionen</p>
      </div>
      <div className="border-l border-gray-700" />
      <div>
        <div className="flex items-center justify-center gap-1 text-cyan-400 mb-1">
          <Users className="w-4 h-4" />
          <span className="font-bold text-lg">{activeUsers}</span>
        </div>
        <p className="text-gray-400 text-xs">Aktive Bieter</p>
      </div>
      <div className="border-l border-gray-700" />
      <div>
        <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
          <TrendingUp className="w-4 h-4" />
          <span className="font-bold text-lg">{totalBids}</span>
        </div>
        <p className="text-gray-400 text-xs">Gebote heute</p>
      </div>
    </div>
  </div>
);

export default function Home() {
  const { isAuthenticated, token, updateBidsBalance } = useAuth();
  const navigate = useNavigate();
  
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBids: 0, activeUsers: 0 });
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  // Fetch data from API
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
      
      const totalBids = auctionsRes.data.reduce((sum, a) => sum + (a.total_bids || 0), 0);
      const uniqueBidders = new Set(auctionsRes.data.map(a => a.last_bidder_id).filter(Boolean)).size;
      setStats({ totalBids, activeUsers: uniqueBidders + 15 });
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // WebSocket connection for real-time updates
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
      if (!wsUrl) return;
      
      const ws = new WebSocket(`${wsUrl}/ws/auctions/all_auctions`);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'bid_update' && message.data) {
            // Update the specific auction with new bid data
            setAuctions(prev => prev.map(a => 
              a.id === message.auction_id
                ? { 
                    ...a, 
                    current_price: message.data.current_price,
                    total_bids: message.data.total_bids,
                    last_bidder_name: message.data.last_bidder_name,
                    end_time: message.data.end_time || a.end_time
                  }
                : a
            ));
            
            // Update stats
            setStats(prev => ({
              ...prev,
              totalBids: prev.totalBids + 1
            }));
          }
          
          if (message.type === 'auction_restarted' && message.data) {
            // Update or add the restarted auction
            setAuctions(prev => {
              const exists = prev.find(a => a.id === message.auction_id);
              if (exists) {
                return prev.map(a => 
                  a.id === message.auction_id
                    ? { ...a, ...message.data }
                    : a
                );
              }
              return prev;
            });
          }
          
          if (message.type === 'auction_ended') {
            // Remove ended auction from list
            setAuctions(prev => prev.filter(a => a.id !== message.auction_id));
          }
          
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);
  
  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Refresh when timer expires (auction ended)
  const handleTimerExpired = useCallback(() => {
    // Small delay then refresh to get new auction data
    setTimeout(fetchData, 2000);
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
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };
  
  // Get premium auction (VIP or highest price)
  const premiumAuction = auctions.find(a => a.is_vip_only) || 
    auctions.reduce((max, a) => {
      const price = products[a.product_id]?.retail_price || 0;
      const maxPrice = products[max?.product_id]?.retail_price || 0;
      return price > maxPrice ? a : max;
    }, auctions[0]);
  
  // Other auctions
  const otherAuctions = auctions.filter(a => a.id !== premiumAuction?.id).slice(0, 8);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1929] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0f2744]" data-testid="home-page">
      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* Stats Bar */}
        <StatsBar 
          totalBids={stats.totalBids}
          activeUsers={stats.activeUsers}
          activeAuctions={auctions.length}
        />
        
        {/* Premium Auction */}
        {premiumAuction && products[premiumAuction.product_id] && (
          <div className="mb-8">
            <PremiumAuction 
              auction={premiumAuction}
              product={products[premiumAuction.product_id]}
              onBid={handleBid}
              onRefresh={handleTimerExpired}
            />
          </div>
        )}
        
        {/* Live Auctions Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Live-Auktionen
            </h2>
            <Link to="/auctions" className="text-blue-400 text-sm flex items-center gap-1 hover:text-blue-300">
              Alle ansehen <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {otherAuctions.map(auction => (
              <AuctionCard 
                key={auction.id}
                auction={auction}
                product={products[auction.product_id]}
                onBid={handleBid}
                onRefresh={handleTimerExpired}
              />
            ))}
          </div>
        </div>
        
        {/* Footer Note */}
        <p className="text-center text-[10px] text-gray-600 mt-8">
          * Vergleichspreis entspricht der unverbindlichen Preisempfehlung des Herstellers
        </p>
      </div>
    </div>
  );
}
