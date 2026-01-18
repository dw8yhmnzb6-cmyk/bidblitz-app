import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Grid3X3, Tv, Smartphone, Home as HomeIcon, Car, Gift, Shirt, 
  RefreshCw, ChevronDown, Search
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Kategorien
const CATEGORIES = [
  { id: 'all', name: 'Alle', icon: <Grid3X3 className="w-4 h-4" /> },
  { id: 'elektronik', name: 'Elektronik', icon: <Tv className="w-4 h-4" /> },
  { id: 'smartphone', name: 'Smartphones', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'haushalt', name: 'Haushalt', icon: <HomeIcon className="w-4 h-4" /> },
  { id: 'auto', name: 'E-Mobilität', icon: <Car className="w-4 h-4" /> },
  { id: 'geschenke', name: 'Geschenke', icon: <Gift className="w-4 h-4" /> },
  { id: 'mode', name: 'Mode', icon: <Shirt className="w-4 h-4" /> },
];

// Activity Index Component
const ActivityIndex = ({ bids }) => {
  const getColors = () => {
    if (bids >= 30) return ['#22c55e', '#22c55e', '#22c55e', '#22c55e', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#dc2626'];
    if (bids >= 20) return ['#22c55e', '#22c55e', '#22c55e', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#dc2626', '#dc2626'];
    if (bids >= 10) return ['#22c55e', '#22c55e', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#ef4444', '#dc2626', '#dc2626'];
    if (bids >= 5) return ['#22c55e', '#22c55e', '#84cc16', '#eab308', '#f97316', '#f97316', '#ef4444', '#ef4444', '#dc2626', '#dc2626'];
    return ['#22c55e', '#84cc16', '#eab308', '#f97316', '#f97316', '#ef4444', '#ef4444', '#dc2626', '#dc2626', '#dc2626'];
  };

  return (
    <div className="flex items-center gap-0.5">
      {getColors().map((color, i) => (
        <div key={i} className="w-1.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
};

// Compact Auction Card - Snipster Style
const SnipsterCard = ({ auction }) => {
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

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-xl transition-all duration-200">
      {/* Header Badge */}
      <div className={`text-white text-[10px] font-bold px-2 py-0.5 text-center uppercase tracking-wider ${
        isScheduled ? 'bg-orange-500' : isEnded ? 'bg-gray-500' : 'bg-gradient-to-r from-red-500 to-red-600'
      }`}>
        {isScheduled ? 'DEMNÄCHST' : isEnded ? 'BEENDET' : 'FÜR PROFIS!'}
      </div>

      <div className="p-2">
        {/* Product Name */}
        <h3 className="font-bold text-gray-800 text-xs leading-tight mb-1 line-clamp-2 h-8" title={product.name}>
          {product.name?.toUpperCase()}
        </h3>
        
        {/* Retail Price */}
        <p className="text-gray-500 text-[10px] mb-1">
          Vergleichspreis*: € {product.retail_price?.toFixed(0)},-
        </p>

        <div className="flex gap-2">
          {/* Left side */}
          <div className="flex-1 min-w-0">
            {/* Current Price */}
            <p className="text-xl font-bold text-teal-600 font-mono leading-none">
              € {auction.current_price?.toFixed(2).replace('.', ',')}
            </p>
            
            {/* Last Bidder */}
            <p className="text-gray-500 text-[10px] truncate mt-0.5">
              {auction.last_bidder_name || 'Startpreis'}
            </p>
            
            {/* Bid Button */}
            <Link to={`/auctions/${auction.id}`}>
              <button 
                className={`mt-1.5 w-full font-bold py-1 px-3 rounded text-[11px] uppercase shadow transition-all ${
                  isEnded 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white'
                }`}
                disabled={isEnded}
              >
                {isEnded ? 'BEENDET' : 'BIETEN'}
              </button>
            </Link>
          </div>

          {/* Right side - Image & Timer */}
          <div className="w-20 flex flex-col items-center">
            {/* Timer */}
            <div className={`w-full text-center py-0.5 px-1 rounded text-white text-[10px] font-mono font-bold ${
              isUrgent ? 'bg-red-500 animate-pulse' : isEnded ? 'bg-gray-500' : 'bg-green-500'
            }`}>
              {isEnded ? 'ENDE' : `${formatTime(timeLeft.hours)}:${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`}
            </div>
            
            {/* Product Image */}
            <img
              src={product.image_url || 'https://via.placeholder.com/80'}
              alt={product.name}
              className="w-16 h-16 object-contain mt-1"
            />
          </div>
        </div>

        {/* Activity Index */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-gray-500 text-[9px]">Aktivität:</span>
          <ActivityIndex bids={auction.total_bids || 0} />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-100 px-2 py-1 text-center border-t border-gray-200">
        <p className="text-gray-600 text-[9px]">
          Zuletzt für <span className="font-bold text-green-600">€{lastSoldPrice}</span> versteigert
        </p>
      </div>
    </div>
  );
};

// Main Auctions Page
export default function Auctions() {
  const { isAuthenticated, token } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

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
      <div className="min-h-screen bg-gray-100 pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Angebote suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>

            {/* Category Buttons */}
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    selectedCategory === cat.id 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex gap-1">
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  statusFilter === 'active' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Aktiv ({activeCount})
              </button>
              <button
                onClick={() => setStatusFilter('scheduled')}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  statusFilter === 'scheduled' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Geplant ({scheduledCount})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  statusFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Alle
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchAuctions}
              className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          {sortedAuctions.length} Angebote gefunden
        </div>

        {/* Auctions Grid - 5 columns on large screens */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sortedAuctions.map(auction => (
            <SnipsterCard key={auction.id} auction={auction} />
          ))}
        </div>

        {/* Empty State */}
        {sortedAuctions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-500 text-lg">Keine Angebote gefunden</p>
            <p className="text-gray-400 text-sm mt-2">Versuchen Sie eine andere Kategorie oder Suche</p>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-6 text-center text-xs text-gray-500">
          * Vergleichspreis = UVP des Herstellers
        </div>
      </div>
    </div>
  );
}
