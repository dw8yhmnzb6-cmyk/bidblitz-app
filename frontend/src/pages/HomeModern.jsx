/**
 * BidBlitz Home - Modern Premium Design
 * Komplett neu gestaltete Startseite mit Dark Theme
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'sonner';
import { 
  Timer, Flame, TrendingUp, Users, Zap, Award, Gift, Shield, Star, Crown, Clock, 
  ChevronRight, CheckCircle, Eye, Gavel, ArrowRight, Sparkles, Trophy, Heart,
  Search, Filter, Grid, List, Play, Pause, Volume2, Bell, Coins, Target,
  ShoppingCart, Percent, Tag, Package, Ticket, CreditCard
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Quick Actions für die Startseite
const QUICK_ACTIONS = [
  { emoji: '📷', name: 'Scan', route: '/scan', color: 'from-blue-500 to-cyan-500' },
  { emoji: '💳', name: 'Pay', route: '/bidblitz-pay', color: 'from-purple-500 to-pink-500' },
  { emoji: '⛏️', name: 'Mining', route: '/mining', color: 'from-amber-500 to-orange-500' },
  { emoji: '🚕', name: 'Ride', route: '/taxi', color: 'from-yellow-500 to-amber-500' },
  { emoji: '💸', name: 'Send', route: '/transfer', color: 'from-emerald-500 to-green-500' },
  { emoji: '🛍️', name: 'Shop', route: '/shop', color: 'from-rose-500 to-red-500' },
];

// Kategorien
const CATEGORIES = [
  { id: 'all', name: 'Alle', icon: Grid, color: 'from-violet-500 to-purple-600' },
  { id: 'electronics', name: 'Elektronik', icon: Zap, color: 'from-blue-500 to-cyan-500' },
  { id: 'fashion', name: 'Mode', icon: Tag, color: 'from-pink-500 to-rose-500' },
  { id: 'home', name: 'Haus', icon: Package, color: 'from-amber-500 to-orange-500' },
  { id: 'vouchers', name: 'Gutscheine', icon: Ticket, color: 'from-emerald-500 to-green-500' },
];

// Featured Banner
const FeaturedBanner = ({ onNavigate }) => (
  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 shadow-2xl shadow-purple-500/20 mx-4 mb-6">
    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtNi42MjcgMC0xMiA1LjM3My0xMiAxMnM1LjM3MyAxMiAxMiAxMiAxMi01LjM3MyAxMi0xMi01LjM3My0xMi0xMi0xMnoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-30" />
    
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <Zap className="w-3 h-3" /> FLASH SALE
        </span>
        <span className="text-white/70 text-sm">Endet in 23:59:41</span>
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
        Bis zu 20% Bonus + 5% Zinsen p.a.
      </h2>
      <p className="text-white/70 mb-4">Auf alle Einzahlungen ab €20</p>
      <button 
        onClick={() => onNavigate('/deposit')}
        className="bg-white text-purple-600 font-bold px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
      >
        Jetzt sichern <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// Jackpot Widget
const JackpotWidget = ({ amount }) => (
  <div className="mx-4 mb-6">
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 rounded-2xl p-4 shadow-xl shadow-amber-500/20">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-white/80 text-sm font-medium">JACKPOT</p>
            <p className="text-2xl font-bold text-white">{amount} Gebote</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white/80 text-xs">WERT</p>
          <p className="text-xl font-bold text-white">€{(amount * 0.5).toFixed(0)}</p>
        </div>
      </div>
    </div>
  </div>
);

// Live Counter
const LiveCounter = ({ count }) => (
  <div className="flex items-center gap-2 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-full px-3 py-1.5">
    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
    <span className="text-red-400 text-sm font-medium">LIVE</span>
    <span className="text-white text-sm font-bold">{count}</span>
  </div>
);

// Auction Card - Modern Design
const AuctionCard = ({ auction, onBid, onNavigate }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      if (!auction.end_time) return;
      const end = new Date(auction.end_time);
      const now = new Date();
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft('Beendet');
        return;
      }
      
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      if (hours > 0) {
        setTimeLeft(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction.end_time]);

  const savings = auction.product?.retail_price 
    ? Math.round((1 - auction.current_price / auction.product.retail_price) * 100)
    : 0;

  return (
    <div 
      className="group relative bg-gradient-to-br from-[#1a1a2e] to-[#252540] rounded-3xl overflow-hidden shadow-xl border border-white/5 hover:border-purple-500/30 transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {savings > 50 && (
          <span className="bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1">
            <Flame className="w-3 h-3" /> HOT
          </span>
        )}
        {auction.is_vip_only && (
          <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1">
            <Crown className="w-3 h-3" /> VIP
          </span>
        )}
      </div>

      {/* Wishlist */}
      <button className="absolute top-3 right-3 z-10 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500/50 transition-colors group/heart">
        <Heart className="w-4 h-4 text-white group-hover/heart:text-red-400 transition-colors" />
      </button>

      {/* Image */}
      <div className="relative aspect-square bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
        {auction.product?.image_url ? (
          <img 
            src={auction.product.image_url} 
            alt={auction.product?.name}
            className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-gray-600" />
          </div>
        )}
        
        {/* Overlay on hover */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute bottom-4 left-4 right-4">
            <button 
              onClick={() => onNavigate(`/auctions/${auction.id}`)}
              className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" /> Details ansehen
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Product Name */}
        <h3 className="text-white font-semibold mb-2 line-clamp-2 group-hover:text-purple-400 transition-colors">
          {auction.product?.name || 'Produkt'}
        </h3>

        {/* Timer */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
            timeLeft.includes(':') && parseInt(timeLeft) < 5 
              ? 'bg-red-500/20 text-red-400' 
              : 'bg-purple-500/20 text-purple-400'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            <span className="text-sm font-mono font-bold">{timeLeft || '00:00'}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Users className="w-3 h-3" />
            <span>{auction.total_bids || 0} Gebote</span>
          </div>
        </div>

        {/* Prices */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-gray-500 text-xs">Aktueller Preis</p>
            <p className="text-2xl font-bold text-white">€{(auction.current_price || 0).toFixed(2)}</p>
          </div>
          {auction.product?.retail_price && (
            <div className="text-right">
              <p className="text-gray-500 text-xs line-through">UVP €{auction.product.retail_price}</p>
              <p className="text-emerald-400 text-sm font-bold">-{savings}%</p>
            </div>
          )}
        </div>

        {/* Bid Button */}
        <button 
          onClick={() => onBid(auction.id)}
          className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Gavel className="w-4 h-4" /> Jetzt bieten
        </button>
      </div>
    </div>
  );
};

// Main Component
export default function HomeModern() {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const { t, language } = useLanguage();
  
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [jackpotAmount, setJackpotAmount] = useState(500);
  const [liveCount, setLiveCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAuctions();
    fetchJackpot();
  }, []);

  const fetchAuctions = async () => {
    try {
      const res = await axios.get(`${API}/auctions`);
      const activeAuctions = res.data.filter(a => a.status === 'active');
      setAuctions(activeAuctions);
      setLiveCount(activeAuctions.length);
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJackpot = async () => {
    try {
      const res = await axios.get(`${API}/excitement/global-jackpot`);
      setJackpotAmount(res.data.current_amount || 500);
    } catch (error) {
      setJackpotAmount(500);
    }
  };

  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error('Bitte melden Sie sich an, um zu bieten');
      navigate('/login');
      return;
    }
    
    try {
      await axios.post(`${API}/auctions/${auctionId}/bid`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Gebot abgegeben!');
      fetchAuctions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };

  const filteredAuctions = auctions.filter(auction => {
    if (searchQuery) {
      return auction.product?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#111827] to-[#0a0a1a] pt-20 pb-8">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Search Bar */}
      <div className="relative z-10 px-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Suche nach Produkten..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#252540]/80 backdrop-blur-sm border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="relative z-10 px-4 mb-6">
        <div className="grid grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={index}
              onClick={() => navigate(action.route)}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#252540]/80 backdrop-blur-sm border border-white/5 hover:border-purple-500/30 transition-all hover:scale-105 active:scale-95"
              data-testid={`quick-action-${action.name.toLowerCase()}`}
            >
              <span className="text-2xl mb-1">{action.emoji}</span>
              <span className="text-xs text-gray-400 font-medium">{action.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Featured Banner */}
      <FeaturedBanner onNavigate={navigate} />

      {/* Jackpot */}
      <JackpotWidget amount={jackpotAmount} />

      {/* Categories */}
      <div className="relative z-10 px-4 mb-6 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                    : 'bg-[#252540] text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Auctions Header */}
      <div className="relative z-10 px-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">Live Auktionen</h2>
          <LiveCounter count={liveCount} />
        </div>
        <Link to="/auctions" className="text-purple-400 text-sm font-medium hover:text-purple-300 transition-colors flex items-center gap-1">
          Alle anzeigen <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Auctions Grid */}
      <div className="relative z-10 px-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-[#252540] rounded-3xl h-80 animate-pulse" />
            ))}
          </div>
        ) : filteredAuctions.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAuctions.slice(0, 8).map((auction) => (
              <AuctionCard 
                key={auction.id}
                auction={auction}
                onBid={handleBid}
                onNavigate={navigate}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Keine Auktionen gefunden</p>
            <button 
              onClick={() => setSearchQuery('')}
              className="mt-4 text-purple-400 hover:text-purple-300 transition-colors"
            >
              Suche zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Trust Badges */}
      <div className="relative z-10 px-4 mt-8">
        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#252540] rounded-2xl p-6 border border-white/5">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-white font-semibold text-sm">100% Sicher</p>
              <p className="text-gray-500 text-xs">SSL verschlüsselt</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Award className="w-6 h-6 text-purple-400" />
              </div>
              <p className="text-white font-semibold text-sm">Echte Gewinne</p>
              <p className="text-gray-500 text-xs">Garantierte Lieferung</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                <CreditCard className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-white font-semibold text-sm">Sichere Zahlung</p>
              <p className="text-gray-500 text-xs">Alle Methoden</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 px-4 mt-8 mb-8">
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-3xl p-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative text-center">
            <Gift className="w-12 h-12 text-yellow-300 mx-auto mb-3" />
            <h3 className="text-2xl font-bold text-white mb-2">Jetzt registrieren!</h3>
            <p className="text-white/80 mb-4">Erhalte 10 Gratis-Gebote zum Start</p>
            <button 
              onClick={() => navigate('/register')}
              className="bg-white text-purple-600 font-bold px-8 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform"
            >
              Kostenlos starten
            </button>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
