import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket';
import { Clock, Trophy, TrendingUp, Users, ChevronRight, Zap } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Activity Index - Always shows 30-60%
const ActivityIndex = ({ auctionId = '' }) => {
  // Stable position based on auction ID (30-60% range)
  const hash = auctionId ? auctionId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 50;
  const position = 30 + (hash % 31); // 30 to 60
  
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

// Premium Featured Auction (Large Card at Top)
const PremiumAuction = ({ auction, product, onBid, isLoggedIn }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!auction?.end_time) return;
    
    const calc = () => {
      const now = Date.now();
      const end = new Date(auction.end_time).getTime();
      const diff = Math.max(0, end - now);
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000)
      });
    };
    
    calc();
    const int = setInterval(calc, 1000);
    return () => clearInterval(int);
  }, [auction?.end_time]);
  
  if (!auction || !product) return null;
  
  const pad = (n) => String(n).padStart(2, '0');
  const isUrgent = timeLeft.h === 0 && timeLeft.m < 1;
  
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
      <div className={`absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg ${isUrgent ? 'bg-red-500' : 'bg-black/50 backdrop-blur'}`}>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-white" />
          <span className="text-white font-mono font-bold text-lg">
            {pad(timeLeft.h)}:{pad(timeLeft.m)}:{pad(timeLeft.s)}
          </span>
        </div>
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
          
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">
            {product.description || 'Premium-Produkt zum Schnäppchenpreis'}
          </p>
          
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
          
          {/* Last Sold */}
          <p className="text-xs text-gray-500 mt-4">
            Zuletzt versteigert für nur <span className="text-green-400 font-semibold">€ {(product.retail_price * 0.03).toFixed(2).replace('.', ',')}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

// Small Auction Card (Grid below Premium)
const AuctionCard = ({ auction, product, onBid, isLoggedIn }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!auction?.end_time) return;
    
    const calc = () => {
      const now = Date.now();
      const end = new Date(auction.end_time).getTime();
      const diff = Math.max(0, end - now);
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000)
      });
    };
    
    calc();
    const int = setInterval(calc, 1000);
    return () => clearInterval(int);
  }, [auction?.end_time]);
  
  if (!auction || !product) return null;
  
  const pad = (n) => String(n).padStart(2, '0');
  const isUrgent = timeLeft.h === 0 && timeLeft.m < 1;
  
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
      <div className={`px-3 py-2 flex items-center justify-between ${isUrgent ? 'bg-red-600' : 'bg-gradient-to-r from-blue-600 to-blue-700'}`}>
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
        <div className="flex items-center gap-1 text-white font-mono text-sm font-bold">
          <Clock className="w-3 h-3" />
          {pad(timeLeft.h)}:{pad(timeLeft.m)}:{pad(timeLeft.s)}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3">
        {/* Product Name */}
        <h3 className="text-white text-sm font-bold mb-1 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
        
        {/* Retail Price */}
        <p className="text-gray-400 text-xs mb-2">
          Vergleichspreis*: € {product.retail_price?.toLocaleString('de-DE')},-
        </p>
        
        {/* Image + Price */}
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
        
        {/* Activity Index */}
        <ActivityIndex auctionId={auction.id} />
        
        {/* Bid Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onBid(auction.id);
          }}
          className="w-full mt-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold text-sm rounded-lg transition-all"
        >
          BIETEN
        </button>
        
        {/* Last Sold */}
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          Zuletzt versteigert für nur <span className="text-green-400">€ {(product.retail_price * 0.04).toFixed(2).replace('.', ',')}</span>
        </p>
      </div>
    </div>
  );
};

// Recently Ended Auction (Horizontal Scroll)
const EndedAuctionCard = ({ auction, product }) => {
  const navigate = useNavigate();
  
  if (!product) return null;
  
  return (
    <div 
      onClick={() => navigate(`/auctions/${auction.id}`)}
      className="flex-shrink-0 w-40 rounded-lg overflow-hidden cursor-pointer bg-[#1a2a3a] hover:bg-[#1e3040] transition-colors"
    >
      <div className="relative">
        <img 
          src={product.image_url || 'https://via.placeholder.com/160'}
          alt=""
          className="w-full h-24 object-contain bg-white p-2"
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-white text-xs font-bold bg-green-500 px-2 py-1 rounded">
            € {auction.final_price?.toFixed(2) || auction.current_price?.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="p-2">
        <p className="text-white text-xs font-medium truncate">{product.name}</p>
        <p className="text-gray-400 text-[10px]">Vergleichspreis: € {product.retail_price},-</p>
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
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState({});
  const [endedAuctions, setEndedAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBids: 0, activeUsers: 0 });
  
  // WebSocket for real-time updates
  const { auctionData, bidNotification } = useAuctionWebSocket(null);
  
  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [auctionsRes, productsRes, endedRes] = await Promise.all([
        axios.get(`${API}/auctions?status=active`),
        axios.get(`${API}/products`),
        axios.get(`${API}/auctions?status=ended&limit=10`)
      ]);
      
      // Build products map
      const prodMap = {};
      productsRes.data.forEach(p => { prodMap[p.id] = p; });
      setProducts(prodMap);
      
      // Set auctions
      setAuctions(auctionsRes.data);
      setEndedAuctions(endedRes.data.slice(0, 6));
      
      // Calculate stats
      const totalBids = auctionsRes.data.reduce((sum, a) => sum + (a.total_bids || 0), 0);
      const uniqueBidders = new Set(auctionsRes.data.map(a => a.last_bidder_id).filter(Boolean)).size;
      setStats({ totalBids, activeUsers: uniqueBidders + Math.floor(Math.random() * 20) + 10 });
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Update from WebSocket
  useEffect(() => {
    if (auctionData && Array.isArray(auctionData)) {
      setAuctions(auctionData.filter(a => a.status === 'active'));
    } else if (auctionData && auctionData.auction_id) {
      setAuctions(prev => prev.map(a => 
        a.id === auctionData.auction_id
          ? { ...a, ...auctionData }
          : a
      ));
    }
  }, [auctionData]);
  
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
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };
  
  // Get premium auction (highest retail price or VIP)
  const premiumAuction = auctions.find(a => a.is_vip_only) || 
    auctions.reduce((max, a) => {
      const price = products[a.product_id]?.retail_price || 0;
      const maxPrice = products[max?.product_id]?.retail_price || 0;
      return price > maxPrice ? a : max;
    }, auctions[0]);
  
  // Other auctions (excluding premium)
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
              isLoggedIn={isAuthenticated}
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
                isLoggedIn={isAuthenticated}
              />
            ))}
          </div>
        </div>
        
        {/* Recently Ended Section */}
        {endedAuctions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-green-400" />
              Kürzlich beendete Auktionen
            </h2>
            
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {endedAuctions.map(auction => (
                <EndedAuctionCard 
                  key={auction.id}
                  auction={auction}
                  product={products[auction.product_id]}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Footer Note */}
        <p className="text-center text-[10px] text-gray-600 mt-8">
          * Vergleichspreis entspricht der unverbindlichen Preisempfehlung des Herstellers
        </p>
      </div>
    </div>
  );
}
