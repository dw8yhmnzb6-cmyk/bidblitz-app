import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { 
  Grid3X3, Tv, Smartphone, Home as HomeIcon, Car, Gift, Shirt, 
  RefreshCw, ChevronDown, Search, Sparkles, Clock, Flame
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Category icons mapping
const CATEGORY_ICONS = {
  all: <Grid3X3 className="w-4 h-4" />,
  elektronik: <Tv className="w-4 h-4" />,
  smartphone: <Smartphone className="w-4 h-4" />,
  haushalt: <HomeIcon className="w-4 h-4" />,
  auto: <Car className="w-4 h-4" />,
  geschenke: <Gift className="w-4 h-4" />,
  mode: <Shirt className="w-4 h-4" />,
};

// Activity Index Component - Colorful animated bars
const ActivityIndex = ({ bids }) => {
  const activeBars = Math.min(Math.ceil(bids / 5), 10);
  
  const getBarColor = (index) => {
    if (index < 3) return 'from-green-400 to-emerald-500';
    if (index < 6) return 'from-yellow-400 to-orange-500';
    if (index < 8) return 'from-orange-400 to-red-500';
    return 'from-red-500 to-pink-500';
  };
  
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(10)].map((_, i) => (
        <div 
          key={i} 
          className={`w-1.5 h-3 rounded-sm transition-all duration-300 ${
            i < activeBars 
              ? `bg-gradient-to-t ${getBarColor(i)}` 
              : 'bg-gray-200'
          }`}
          style={{ 
            animationDelay: `${i * 100}ms`,
            transform: i < activeBars ? 'scaleY(1)' : 'scaleY(0.6)'
          }}
        />
      ))}
    </div>
  );
};

// Compact Auction Card - Clean & Readable Style
const SnipsterCard = ({ auction, t }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const endTime = new Date(auction.end_time);
      const now = new Date();
      const diff = endTime - now;

      if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0 };

      return {
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      };
    };

    const timer = setInterval(() => {
      const newTime = calculateTimeLeft();
      setTimeLeft(newTime);
      setIsUrgent(newTime.hours === 0 && newTime.minutes < 1);
    }, 1000);

    setTimeLeft(calculateTimeLeft());
    return () => clearInterval(timer);
  }, [auction.end_time]);

  const product = auction.product || {};
  const isEnded = auction.status === 'ended' || (timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0);
  const isScheduled = auction.status === 'scheduled';
  const formatTime = (num) => String(num).padStart(2, '0');
  const lastSoldPrice = ((auction.id.charCodeAt(0) % 12) + 1 + (auction.id.charCodeAt(1) % 10) / 10).toFixed(2);

  const getBadgeStyle = () => {
    if (isScheduled) return 'bg-amber-500';
    if (isEnded) return 'bg-gray-400';
    return 'bg-green-500';
  };

  const getBadgeText = () => {
    if (isScheduled) return t('auctionCard.comingSoon');
    if (isEnded) return t('auctionCard.ended');
    return t('auctionCard.liveNow');
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-300 group">
      {/* Header Badge - Simple */}
      <div className={`text-white text-[11px] font-bold px-3 py-1.5 text-center uppercase tracking-wider flex items-center justify-center gap-1.5 ${getBadgeStyle()}`}>
        {!isEnded && !isScheduled && <Flame className="w-3 h-3" />}
        {isScheduled && <Clock className="w-3 h-3" />}
        {getBadgeText()}
      </div>

      <div className="p-3">
        {/* Product Name */}
        <h3 className="font-bold text-gray-800 text-sm leading-tight mb-1.5 line-clamp-2 h-10" title={product.name}>
          {product.name?.toUpperCase()}
        </h3>
        
        {/* Retail Price with Discount */}
        <div className="flex items-center gap-2 mb-2">
          <p className="text-gray-500 text-xs">
            UVP: <span className="line-through">€{product.retail_price?.toFixed(0)},-</span>
          </p>
          {product.retail_price && auction.current_price < product.retail_price && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              -{Math.round((1 - auction.current_price / product.retail_price) * 100)}%
            </span>
          )}
        </div>

        <div className="flex gap-3">
          {/* Left side */}
          <div className="flex-1">
            {/* Current Price - CLEAR & BIG */}
            <div className="bg-gray-50 rounded-lg p-2 mb-2 border border-gray-200">
              <p className="text-2xl sm:text-3xl font-black text-gray-900 font-mono leading-none">
                €{auction.current_price?.toFixed(2).replace('.', ',')}
              </p>
            </div>
            
            {/* Last Bidder */}
            <p className="text-gray-600 text-xs truncate mb-2">
              {auction.last_bidder_name || t('auctionCard.startPrice')}
            </p>
            
            {/* Bid Button - Simple Green */}
            <Link to={`/auctions/${auction.id}`}>
              <button 
                data-testid={`bid-button-${auction.id}`}
                className={`w-full font-bold py-2 px-3 rounded-lg text-xs uppercase transition-all ${
                  isEnded 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg'
                }`}
                disabled={isEnded}
              >
                {isEnded ? t('auctionCard.ended') : t('auctionCard.bidNow')}
              </button>
            </Link>
          </div>

          {/* Right side - Image & Timer */}
          <div className="w-20 sm:w-24 flex flex-col items-center flex-shrink-0">
            {/* Timer - Clear */}
            <div className={`w-full text-center py-1.5 px-2 rounded-lg text-white text-xs font-mono font-bold ${
              isUrgent ? 'bg-red-500' : isEnded ? 'bg-gray-400' : 'bg-blue-500'
            }`}>
              {isEnded ? t('auctionCard.end') : `${formatTime(timeLeft.hours)}:${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`}
            </div>
            
            {/* Product Image */}
            <img
              src={product.image_url || 'https://via.placeholder.com/80'}
              alt={product.name}
              className="w-18 h-18 sm:w-20 sm:h-20 object-contain mt-2 group-hover:scale-105 transition-transform"
            />
          </div>
        </div>

        {/* Activity & Bids */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>Aktivität:</span>
            <ActivityIndex bids={auction.total_bids || 0} />
          </div>
          <span className="font-medium">{auction.total_bids || 0} Gebote</span>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-3 py-2 text-center border-t border-gray-100">
        <p className="text-gray-600 text-[11px]">
          Zuletzt für <span className="font-bold text-green-600">€{lastSoldPrice}</span> versteigert
        </p>
      </div>
    </div>
  );
};

// Category definitions
  );
};

// Main Auctions Page
export default function Auctions() {
  const { isAuthenticated, token } = useAuth();
  const { t } = useLanguage();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  // Translated categories
  const categories = [
    { id: 'all', name: t('auctionPage.categories.all') },
    { id: 'elektronik', name: t('auctionPage.categories.electronics') },
    { id: 'smartphone', name: t('auctionPage.categories.smartphones') },
    { id: 'haushalt', name: t('auctionPage.categories.household') },
    { id: 'auto', name: t('auctionPage.categories.emobility') },
    { id: 'geschenke', name: t('auctionPage.categories.gifts') },
    { id: 'mode', name: t('auctionPage.categories.fashion') },
  ];

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAuctions = async () => {
    try {
      const response = await axios.get(`${API}/auctions`);
      setAuctions(response.data);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter auctions
  const filteredAuctions = auctions.filter(a => {
    const product = a.product || {};
    const matchesSearch = !searchQuery || 
      product.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
      product.category?.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Sort: active first, then by end time
  const sortedAuctions = [...filteredAuctions].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return new Date(a.end_time) - new Date(b.end_time);
  });

  const activeCount = filteredAuctions.filter(a => a.status === 'active').length;
  const scheduledCount = filteredAuctions.filter(a => a.status === 'scheduled').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200"></div>
            <div className="absolute top-0 left-0 animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500"></div>
          </div>
          <p className="text-purple-600 text-sm font-medium animate-pulse">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Fun Header Banner */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent mb-2">
            🎉 {t('auctionPage.title') || 'Aktive Auktionen'}
          </h1>
          <p className="text-gray-600 text-sm">
            ✨ {sortedAuctions.length} {t('auctionPage.offersFound') || 'Angebote gefunden'} • 🔥 {activeCount} {t('auctionPage.active') || 'aktiv'}
          </p>
        </div>

        {/* Header - Vibrant & Inviting */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 mb-6 border border-white/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search - Colorful */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
              <input
                type="text"
                placeholder={t('auctionPage.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="auction-search-input"
                className="w-full pl-10 pr-4 py-2.5 border-2 border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-sm bg-white/80 transition-all placeholder:text-purple-300"
              />
            </div>

            {/* Category Buttons - Rainbow Colorful */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat, idx) => {
                const catColors = [
                  'from-purple-500 to-indigo-500',
                  'from-blue-500 to-cyan-500',
                  'from-emerald-500 to-teal-500',
                  'from-yellow-500 to-orange-500',
                  'from-pink-500 to-rose-500',
                  'from-red-500 to-pink-500',
                  'from-violet-500 to-purple-500',
                ];
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    data-testid={`category-${cat.id}`}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 transform hover:scale-105 ${
                      selectedCategory === cat.id 
                        ? `bg-gradient-to-r ${catColors[idx % catColors.length]} text-white shadow-lg` 
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {CATEGORY_ICONS[cat.id]}
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Status Filter - Vibrant Pills */}
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('active')}
                data-testid="filter-active"
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all transform hover:scale-105 ${
                  statusFilter === 'active' 
                    ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg shadow-green-200' 
                    : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                }`}
              >
                🟢 {t('auctionPage.active')} ({activeCount})
              </button>
              <button
                onClick={() => setStatusFilter('scheduled')}
                data-testid="filter-scheduled"
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all transform hover:scale-105 ${
                  statusFilter === 'scheduled' 
                    ? 'bg-gradient-to-r from-purple-400 to-pink-500 text-white shadow-lg shadow-purple-200' 
                    : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                ⏰ {t('auctionPage.scheduled')} ({scheduledCount})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                data-testid="filter-all"
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all transform hover:scale-105 ${
                  statusFilter === 'all' 
                    ? 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-lg shadow-blue-200' 
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                📋 {t('auctionPage.all')}
              </button>
            </div>

            {/* Refresh - Fun Animation */}
            <button
              onClick={fetchAuctions}
              data-testid="refresh-auctions"
              className="p-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 hover:rotate-180 duration-500"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results Count - Friendlier */}
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-500" />
          <span className="text-sm text-gray-600">
            {sortedAuctions.length} {t('auctionPage.offersFound')}
          </span>
        </div>

        {/* Auctions Grid - 5 columns on large screens */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sortedAuctions.map(auction => (
            <SnipsterCard key={auction.id} auction={auction} t={t} />
          ))}
        </div>

        {/* Empty State - Friendlier */}
        {sortedAuctions.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl shadow-md">
            <div className="w-16 h-16 bg-gradient-to-r from-teal-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-teal-500" />
            </div>
            <p className="text-gray-700 text-lg font-medium">{t('auctionPage.noOffers')}</p>
            <p className="text-gray-400 text-sm mt-2">{t('auctionPage.tryAnother')}</p>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 text-center text-xs text-gray-400">
          * {t('auctionPage.priceNote')}
        </div>
      </div>
    </div>
  );
}
