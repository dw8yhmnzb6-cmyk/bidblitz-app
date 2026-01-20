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

// Compact Auction Card - Vibrant & Friendly Style
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

  // Vibrant badge styling
  const getBadgeStyle = () => {
    if (isScheduled) return 'bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500';
    if (isEnded) return 'bg-gradient-to-r from-gray-400 to-gray-500';
    return 'bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500';
  };

  const getBadgeText = () => {
    if (isScheduled) return t('auctionCard.comingSoon');
    if (isEnded) return t('auctionCard.ended');
    return t('auctionCard.liveNow');
  };

  // Random fun accent colors for variety
  const accentColors = [
    { bg: 'from-blue-50 to-cyan-50', text: 'text-blue-600', border: 'border-blue-100' },
    { bg: 'from-purple-50 to-pink-50', text: 'text-purple-600', border: 'border-purple-100' },
    { bg: 'from-orange-50 to-amber-50', text: 'text-orange-600', border: 'border-orange-100' },
    { bg: 'from-green-50 to-emerald-50', text: 'text-green-600', border: 'border-green-100' },
    { bg: 'from-rose-50 to-pink-50', text: 'text-rose-600', border: 'border-rose-100' },
  ];
  const accent = accentColors[auction.id.charCodeAt(0) % accentColors.length];

  return (
    <div className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 ${accent.border} hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 group cursor-pointer`}>
      {/* Header Badge - Animated & Vibrant */}
      <div className={`text-white text-[11px] font-bold px-3 py-1.5 text-center uppercase tracking-wider flex items-center justify-center gap-1.5 ${getBadgeStyle()}`}>
        {!isEnded && !isScheduled && <Sparkles className="w-3.5 h-3.5 animate-pulse" />}
        {isScheduled && <Clock className="w-3.5 h-3.5 animate-bounce" />}
        {getBadgeText()}
      </div>

      <div className="p-3">
        {/* Product Name - Larger & Friendlier */}
        <h3 className={`font-bold ${accent.text} text-sm leading-tight mb-1.5 line-clamp-2 h-10 group-hover:scale-[1.02] transition-transform`} title={product.name}>
          {product.name?.toUpperCase()}
        </h3>
        
        {/* Retail Price with Discount Badge */}
        <div className="flex items-center gap-2 mb-2">
          <p className="text-gray-400 text-[11px]">
            {t('auctionCard.retailPrice')}: <span className="line-through">€{product.retail_price?.toFixed(0)},-</span>
          </p>
          {product.retail_price && auction.current_price < product.retail_price && (
            <span className="bg-gradient-to-r from-red-500 to-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              -{Math.round((1 - auction.current_price / product.retail_price) * 100)}%
            </span>
          )}
        </div>

        <div className="flex gap-3">
          {/* Left side */}
          <div className="flex-1">
            {/* Current Price - Big & Colorful */}
            <div className={`bg-gradient-to-r ${accent.bg} rounded-xl p-2 mb-2 border ${accent.border}`}>
              <p className={`text-xl sm:text-2xl font-black ${accent.text} font-mono leading-none tracking-tight`}>
                € {auction.current_price?.toFixed(2).replace('.', ',')}
              </p>
            </div>
            
            {/* Last Bidder with Avatar */}
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                <span className="text-white text-[8px] font-bold">{(auction.last_bidder_name || '?')[0]}</span>
              </div>
              <p className="text-gray-600 text-[11px] truncate font-medium">
                {auction.last_bidder_name || t('auctionCard.startPrice')}
              </p>
            </div>
            
            {/* Bid Button - Vibrant & Inviting */}
            <Link to={`/auctions/${auction.id}`}>
              <button 
                data-testid={`bid-button-${auction.id}`}
                className={`w-full font-bold py-2 px-3 rounded-xl text-xs uppercase shadow-lg transition-all transform hover:-translate-y-0.5 ${
                  isEnded 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' 
                    : 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white hover:shadow-xl'
                }`}
                disabled={isEnded}
              >
                {isEnded ? t('auctionCard.ended') : `🎯 ${t('auctionCard.bidNow')}`}
              </button>
            </Link>
          </div>

          {/* Right side - Image & Timer */}
          <div className="w-20 sm:w-24 flex flex-col items-center flex-shrink-0">
            {/* Timer - Vibrant Colors */}
            <div className={`w-full text-center py-1.5 px-2 rounded-xl text-white text-xs font-mono font-bold shadow-md ${
              isUrgent ? 'bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 animate-pulse' : 
              isEnded ? 'bg-gradient-to-r from-gray-400 to-gray-500' : 
              'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
            }`}>
              {isEnded ? '⏰ ' + t('auctionCard.end') : `${formatTime(timeLeft.hours)}:${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`}
            </div>
            
            {/* Product Image with Glow */}
            <div className="relative mt-2">
              <div className={`absolute inset-0 bg-gradient-to-br ${accent.bg} rounded-xl blur-md opacity-50 group-hover:opacity-80 transition-opacity`}></div>
              <img
                src={product.image_url || 'https://via.placeholder.com/80'}
                alt={product.name}
                className="relative w-18 h-18 sm:w-20 sm:h-20 object-contain group-hover:scale-110 transition-transform duration-300"
              />
            </div>
          </div>
        </div>

        {/* Activity & Bids - Colorful Stats */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-[10px] font-medium">{t('auctionCard.activity')}:</span>
            <ActivityIndex bids={auction.total_bids || 0} />
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="font-bold">{auction.total_bids || 0}</span> Gebote
          </div>
        </div>
      </div>

      {/* Footer - Friendly Success Message */}
      <div className={`bg-gradient-to-r ${accent.bg} px-3 py-2 text-center border-t ${accent.border}`}>
        <p className="text-gray-700 text-[10px] font-medium">
          ✨ {t('auctionCard.lastSold')} <span className={`font-bold ${accent.text}`}>€{lastSoldPrice}</span>
        </p>
      </div>
    </div>
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
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pt-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
          <p className="text-gray-500 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header - More colorful & inviting */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
              <input
                type="text"
                placeholder={t('auctionPage.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="auction-search-input"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-teal-400 text-sm bg-gray-50 transition-all"
              />
            </div>

            {/* Category Buttons - More colorful */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  data-testid={`category-${cat.id}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    selectedCategory === cat.id 
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {CATEGORY_ICONS[cat.id]}
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Status Filter - Colorful pills */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setStatusFilter('active')}
                data-testid="filter-active"
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  statusFilter === 'active' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                {t('auctionPage.active')} ({activeCount})
              </button>
              <button
                onClick={() => setStatusFilter('scheduled')}
                data-testid="filter-scheduled"
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  statusFilter === 'scheduled' 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' 
                    : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                }`}
              >
                {t('auctionPage.scheduled')} ({scheduledCount})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                data-testid="filter-all"
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  statusFilter === 'all' 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md' 
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
              >
                {t('auctionPage.all')}
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchAuctions}
              data-testid="refresh-auctions"
              className="p-2.5 rounded-xl bg-gradient-to-r from-gray-100 to-gray-50 hover:from-teal-50 hover:to-emerald-50 transition-all border border-gray-200 hover:border-teal-200"
            >
              <RefreshCw className="w-4 h-4 text-gray-500 hover:text-teal-500" />
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
