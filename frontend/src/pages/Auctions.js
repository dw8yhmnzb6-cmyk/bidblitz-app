import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { RefreshCw, Search, Flame, Clock, TrendingUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Activity bar component
const ActivityBar = ({ level }) => {
  // level 0-10
  const bars = 5;
  const filledBars = Math.min(Math.ceil(level / 2), bars);
  
  return (
    <div className="flex gap-0.5">
      {[...Array(bars)].map((_, i) => (
        <div 
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i < filledBars 
              ? i < 2 ? 'bg-green-400' : i < 4 ? 'bg-yellow-400' : 'bg-red-500'
              : 'bg-gray-600'
          }`}
        />
      ))}
    </div>
  );
};

// Snipster-style Auction Card
const SnipsterCard = ({ auction, product, t }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const endTime = new Date(auction.end_time);
      const diff = endTime - now;
      
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, ended: true });
        return;
      }
      
      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        ended: false
      });
    };
    
    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [auction.end_time]);
  
  const isEnded = auction.status === 'ended' || timeLeft.ended;
  const isUrgent = !isEnded && timeLeft.hours === 0 && timeLeft.minutes < 1;
  const isScheduled = auction.status === 'scheduled';
  
  const formatTime = (num) => String(num).padStart(2, '0');
  
  // Activity level based on bids (0-10)
  const activityLevel = Math.min(10, Math.floor((auction.total_bids || 0) / 5));
  
  // Calculate discount percentage
  const discount = product?.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;

  // Last sold price (simulated based on product)
  const lastSoldPrice = product?.retail_price 
    ? (product.retail_price * (0.05 + (product.name?.charCodeAt(0) % 10) / 100)).toFixed(2)
    : '0.50';

  return (
    <Link 
      to={`/auctions/${auction.id}`}
      className="block group"
      data-testid={`auction-card-${auction.id}`}
    >
      <div className={`relative rounded-xl overflow-hidden transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl ${
        isEnded ? 'opacity-70' : ''
      }`} style={{ backgroundColor: '#1a5f7a' }}>
        
        {/* Top Section - Timer */}
        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-[#1a5f7a] to-[#2d7d9a]">
          {/* Discount Badge */}
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            -{discount}%
          </span>
          
          {/* Timer */}
          <div className={`flex items-center rounded overflow-hidden ${
            isUrgent ? 'animate-pulse' : ''
          }`}>
            <div className="bg-yellow-400 text-black text-xs font-mono font-bold px-1.5 py-0.5">
              {isEnded ? '00' : formatTime(timeLeft.hours)}
            </div>
            <span className="text-yellow-400 text-xs font-bold">:</span>
            <div className="bg-yellow-400 text-black text-xs font-mono font-bold px-1.5 py-0.5">
              {isEnded ? '00' : formatTime(timeLeft.minutes)}
            </div>
            <span className="text-yellow-400 text-xs font-bold">:</span>
            <div className={`text-xs font-mono font-bold px-1.5 py-0.5 ${
              isUrgent ? 'bg-red-500 text-white' : 'bg-orange-400 text-black'
            }`}>
              {isEnded ? '00' : formatTime(timeLeft.seconds)}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex">
          {/* Left Side - Info */}
          <div className="flex-1 p-2 min-w-0">
            {/* Product Name */}
            <h3 className="text-white text-xs font-bold leading-tight line-clamp-2 mb-1 min-h-[32px]">
              {product?.name || 'Produkt'}
            </h3>
            
            {/* Reference Price */}
            <p className="text-gray-300 text-[10px] mb-2">
              UVP: <span className="line-through">€{product?.retail_price?.toFixed(0) || '999'}</span>
            </p>
            
            {/* Current Price - BIG */}
            <div className="mb-1">
              <span className="text-white text-2xl font-black">
                €{auction.current_price?.toFixed(2).replace('.', ',')}
              </span>
            </div>
            
            {/* Last Bidder */}
            <p className="text-cyan-300 text-[10px] mb-2 truncate">
              {auction.last_bidder_name || 'Startpreis'}
            </p>
            
            {/* Activity Index */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-gray-400 text-[9px]">Aktivität:</span>
              <ActivityBar level={activityLevel} />
            </div>
            
            {/* Bid Button */}
            <button 
              className={`w-full font-bold py-1.5 px-2 rounded text-xs uppercase transition-all ${
                isEnded 
                  ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                  : isScheduled
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
              }`}
              disabled={isEnded}
            >
              {isEnded ? 'BEENDET' : isScheduled ? 'GEPLANT' : 'BIETEN'}
            </button>
          </div>
          
          {/* Right Side - Image */}
          <div className="w-24 flex-shrink-0 flex items-center justify-center p-2">
            <div className="relative w-full aspect-square bg-white rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src={product?.image_url || 'https://via.placeholder.com/96'}
                alt={product?.name || 'Produkt'}
                className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/96?text=Bild'; }}
              />
              
              {/* Sold overlay */}
              {isEnded && (
                <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
                  <span className="text-white font-bold text-xs rotate-[-15deg]">VERKAUFT</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Bottom - Last Sold Info */}
        <div className="bg-[#0f3d4d] px-2 py-1.5 text-center">
          <p className="text-gray-400 text-[9px]">
            Zuletzt versteigert für nur <span className="text-green-400 font-bold">€{lastSoldPrice}</span>
          </p>
        </div>
      </div>
    </Link>
  );
};

export default function Auctions() {
  const { t } = useLanguage();
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAuctions = useCallback(async () => {
    try {
      const [auctionRes, productRes] = await Promise.all([
        axios.get(`${API}/auctions`),
        axios.get(`${API}/products`)
      ]);
      
      setAuctions(auctionRes.data);
      
      // Create product lookup
      const productMap = {};
      productRes.data.forEach(p => { productMap[p.id] = p; });
      setProducts(productMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 30000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  // Filter auctions
  const filteredAuctions = auctions.filter(a => {
    // Status filter
    if (statusFilter === 'active' && a.status !== 'active') return false;
    if (statusFilter === 'scheduled' && a.status !== 'scheduled') return false;
    if (statusFilter === 'ended' && a.status !== 'ended') return false;
    
    // Search filter
    if (searchQuery) {
      const product = products[a.product_id];
      const productName = product?.name?.toLowerCase() || '';
      if (!productName.includes(searchQuery.toLowerCase())) return false;
    }
    
    return true;
  });

  // Sort: active first (by end time), then scheduled, then ended
  const sortedAuctions = [...filteredAuctions].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return new Date(a.end_time) - new Date(b.end_time);
  });

  const activeCount = auctions.filter(a => a.status === 'active').length;
  const scheduledCount = auctions.filter(a => a.status === 'scheduled').length;
  const endedCount = auctions.filter(a => a.status === 'ended').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1929] pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#1a3a52] pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-6 h-6 text-orange-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">Live-Auktionen</h1>
          </div>
          <p className="text-gray-400 text-sm">
            {activeCount} aktive Auktionen • Biete jetzt und spare bis zu 99%!
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1a3a52] border border-gray-600 text-white text-sm placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              data-testid="search-input"
            />
          </div>

          {/* Status Filters */}
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter('active')}
              data-testid="filter-active"
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                statusFilter === 'active' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-300 hover:bg-[#2a4a62]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Live ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              data-testid="filter-scheduled"
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                statusFilter === 'scheduled' 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-300 hover:bg-[#2a4a62]'
              }`}
            >
              <Clock className="w-3 h-3 inline mr-1" />
              Geplant ({scheduledCount})
            </button>
            <button
              onClick={() => setStatusFilter('ended')}
              data-testid="filter-ended"
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                statusFilter === 'ended' 
                  ? 'bg-gray-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-300 hover:bg-[#2a4a62]'
              }`}
            >
              Beendet ({endedCount})
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchAuctions}
            data-testid="refresh-auctions"
            className="p-2 rounded-lg bg-[#1a3a52] hover:bg-[#2a4a62] transition-all"
          >
            <RefreshCw className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Results Count */}
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-gray-400">
            {sortedAuctions.length} Auktionen gefunden
          </span>
        </div>

        {/* Auctions Grid - 2 columns on mobile, up to 4 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedAuctions.map(auction => (
            <SnipsterCard 
              key={auction.id} 
              auction={auction} 
              product={products[auction.product_id]}
              t={t} 
            />
          ))}
        </div>

        {/* Empty State */}
        {sortedAuctions.length === 0 && (
          <div className="text-center py-16 bg-[#1a3a52] rounded-2xl">
            <div className="w-16 h-16 bg-[#2a4a62] rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-white text-lg font-medium">Keine Auktionen gefunden</p>
            <p className="text-gray-400 text-sm mt-2">Versuche einen anderen Filter</p>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 text-center text-xs text-gray-500">
          * Alle Preise zzgl. Versandkosten. Vergleichspreise beziehen sich auf UVP.
        </div>
      </div>
    </div>
  );
}
