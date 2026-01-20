import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { RefreshCw, Search, Flame, Clock, TrendingUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Simple Activity Dots
const ActivityDots = ({ bids }) => {
  const level = Math.min(5, Math.ceil((bids || 0) / 10));
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <div 
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < level 
              ? i < 2 ? 'bg-green-400' : i < 4 ? 'bg-yellow-400' : 'bg-red-400'
              : 'bg-gray-600'
          }`}
        />
      ))}
    </div>
  );
};

// Compact Auction Card for Mobile
const AuctionCard = ({ auction, product }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, ended: false });
  
  useEffect(() => {
    const calc = () => {
      const diff = new Date(auction.end_time) - new Date();
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, ended: true });
      } else {
        setTimeLeft({
          h: Math.floor(diff / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000),
          ended: false
        });
      }
    };
    calc();
    const int = setInterval(calc, 1000);
    return () => clearInterval(int);
  }, [auction.end_time]);
  
  const isEnded = auction.status === 'ended' || timeLeft.ended;
  const isUrgent = !isEnded && timeLeft.h === 0 && timeLeft.m < 2;
  const pad = (n) => String(n).padStart(2, '0');
  
  // Short product name (max 20 chars)
  const shortName = product?.name?.length > 22 
    ? product.name.substring(0, 20) + '...' 
    : product?.name || 'Produkt';
  
  const discount = product?.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;

  return (
    <Link 
      to={`/auctions/${auction.id}`}
      className="block"
      data-testid={`auction-card-${auction.id}`}
    >
      <div className={`bg-[#1a4a5e] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow ${isEnded ? 'opacity-60' : ''}`}>
        
        {/* Header: Badge + Timer */}
        <div className="flex justify-between items-center px-2 py-1.5 bg-[#0d3040]">
          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
            -{discount}%
          </span>
          <div className={`flex text-[11px] font-mono font-bold ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
            <span className="bg-black/30 px-1 rounded-l">{pad(timeLeft.h)}</span>
            <span className="text-white/50">:</span>
            <span className="bg-black/30 px-1">{pad(timeLeft.m)}</span>
            <span className="text-white/50">:</span>
            <span className={`px-1 rounded-r ${isUrgent ? 'bg-red-500 text-white' : 'bg-orange-400 text-black'}`}>
              {pad(timeLeft.s)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-2">
          {/* Product Name - Full width, truncated */}
          <h3 className="text-white text-[11px] font-semibold leading-tight mb-1 truncate" title={product?.name}>
            {shortName}
          </h3>
          
          {/* UVP */}
          <p className="text-gray-400 text-[9px] mb-1">
            UVP: <span className="line-through">€{product?.retail_price?.toFixed(0) || '999'}</span>
          </p>
          
          {/* Price + Image Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Price Block */}
            <div className="flex-1">
              <p className="text-white text-xl font-black leading-none">
                €{auction.current_price?.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-cyan-300 text-[9px] truncate mt-0.5">
                {auction.last_bidder_name || 'Startpreis'}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-gray-500 text-[8px]">Aktivität:</span>
                <ActivityDots bids={auction.total_bids} />
              </div>
            </div>
            
            {/* Product Image */}
            <div className="w-14 h-14 bg-white rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img
                src={product?.image_url || 'https://via.placeholder.com/56'}
                alt=""
                className="max-w-full max-h-full object-contain"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/56?text=?'; }}
              />
              {isEnded && (
                <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">VERKAUFT</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Bid Button */}
          <button 
            className={`w-full mt-2 py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${
              isEnded 
                ? 'bg-gray-500 text-gray-300' 
                : auction.status === 'scheduled'
                  ? 'bg-amber-500 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isEnded ? 'Beendet' : auction.status === 'scheduled' ? 'Geplant' : 'Bieten'}
          </button>
        </div>
        
        {/* Footer: Last Sold */}
        <div className="bg-[#0a2a38] px-2 py-1 text-center">
          <p className="text-[8px] text-gray-400">
            Zuletzt für <span className="text-green-400 font-semibold">€{((product?.retail_price || 100) * 0.08).toFixed(2)}</span>
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

  // Filter
  const filtered = auctions.filter(a => {
    if (statusFilter === 'active' && a.status !== 'active') return false;
    if (statusFilter === 'scheduled' && a.status !== 'scheduled') return false;
    if (statusFilter === 'ended' && a.status !== 'ended') return false;
    if (searchQuery) {
      const name = products[a.product_id]?.name?.toLowerCase() || '';
      if (!name.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0d2538] pt-16 pb-20">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        
        {/* Header */}
        <div className="py-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h1 className="text-lg font-bold text-white">Live-Auktionen</h1>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">
            {activeCount} aktiv • Spare bis zu 99%!
          </p>
        </div>

        {/* Filters - Compact */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[120px] max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 rounded bg-[#1a3a52] border border-gray-700 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              data-testid="search-input"
            />
          </div>

          {/* Status Buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter('active')}
              data-testid="filter-active"
              className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                statusFilter === 'active' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-400'
              }`}
            >
              Live ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              data-testid="filter-scheduled"
              className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                statusFilter === 'scheduled' 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-400'
              }`}
            >
              <Clock className="w-3 h-3 inline mr-0.5" />
              ({scheduledCount})
            </button>
            <button
              onClick={() => setStatusFilter('ended')}
              data-testid="filter-ended"
              className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                statusFilter === 'ended' 
                  ? 'bg-gray-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-400'
              }`}
            >
              Ende ({endedCount})
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchAuctions}
            data-testid="refresh-auctions"
            className="p-1.5 rounded bg-[#1a3a52] hover:bg-[#2a4a62]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>

        {/* Results Count */}
        <div className="mb-2 flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] text-gray-400">
            {sorted.length} Auktionen gefunden
          </span>
        </div>

        {/* Grid: 2 columns on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {sorted.map(auction => (
            <AuctionCard 
              key={auction.id} 
              auction={auction} 
              product={products[auction.product_id]}
            />
          ))}
        </div>

        {/* Empty State */}
        {sorted.length === 0 && (
          <div className="text-center py-12 bg-[#1a3a52] rounded-xl">
            <Search className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
            <p className="text-white text-sm font-medium">Keine Auktionen</p>
            <p className="text-gray-400 text-xs mt-1">Anderer Filter probieren</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-[9px] text-gray-600">
          * Preise zzgl. Versand
        </div>
      </div>
    </div>
  );
}
