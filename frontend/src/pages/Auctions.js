import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Zap, Timer, Users, RefreshCw, Pause, Play, Trophy,
  CreditCard, Shield, Lock, ChevronRight, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Kompakte Auktionskarte im snipster-Stil
const CompactAuctionCard = ({ auction, onBid, isAuthenticated }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [startTimeLeft, setStartTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const calculateTimes = () => {
      const now = new Date();
      
      // End time
      const endTime = new Date(auction.end_time);
      const endDiff = endTime - now;
      if (endDiff > 0) {
        setTimeLeft({
          hours: Math.floor(endDiff / (1000 * 60 * 60)),
          minutes: Math.floor((endDiff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((endDiff % (1000 * 60)) / 1000)
        });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
      
      // Start time for scheduled
      if (auction.start_time && auction.status === 'scheduled') {
        const startTime = new Date(auction.start_time);
        const startDiff = startTime - now;
        if (startDiff > 0) {
          setStartTimeLeft({
            days: Math.floor(startDiff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((startDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((startDiff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((startDiff % (1000 * 60)) / 1000)
          });
        }
      }
    };
    
    calculateTimes();
    const timer = setInterval(calculateTimes, 1000);
    return () => clearInterval(timer);
  }, [auction]);

  const product = auction.product || {};
  const isEnded = auction.status === 'ended';
  const isScheduled = auction.status === 'scheduled';
  const isActive = auction.status === 'active';
  const isPaused = timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0 && isActive;
  
  // Activity index (based on total bids)
  const activityLevel = Math.min(auction.total_bids || 0, 10);
  
  // Last sold price (simulated - would come from database)
  const lastSoldPrice = (Math.random() * 30 + 5).toFixed(2);
  
  const formatTime = (num) => String(num).padStart(2, '0');

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow" data-testid={`auction-card-${auction.id}`}>
      {/* Header with status and category */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#e8f4f8] to-[#d4e8ed]">
        <span className="text-[10px] font-bold text-[#00838f] uppercase tracking-wider">
          {auction.total_bids > 20 ? 'FÜR PROFIS!' : 'LIVE'}
        </span>
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#f0f0f0] border border-gray-300">
          {isScheduled ? (
            <span className="text-[10px] font-bold text-orange-600">GEPLANT</span>
          ) : isPaused || isEnded ? (
            <>
              <Pause className="w-3 h-3 text-red-500" />
              <span className="text-[10px] font-bold text-red-500">PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 text-green-500" />
              <span className="text-[10px] font-bold text-green-500">LIVE</span>
            </>
          )}
        </div>
      </div>
      
      {/* Product Info */}
      <div className="p-3">
        <h3 className="text-xs font-bold text-gray-800 uppercase leading-tight line-clamp-2 mb-1" title={product.name}>
          {product.name}
        </h3>
        <p className="text-[10px] text-gray-500">
          Vergleichspreis*: € {product.retail_price?.toFixed(2) || '0.00'},-
        </p>
      </div>
      
      {/* Image and Price Section */}
      <div className="flex px-3 pb-3">
        {/* Price and Timer */}
        <div className="flex-1 space-y-2">
          {/* Current Price */}
          <div className="bg-[#f5f5f5] rounded p-2 text-center">
            <span className="text-2xl font-bold text-[#00838f]">
              € {auction.current_price?.toFixed(2)}
            </span>
          </div>
          
          {/* Current Bidder */}
          <p className="text-[10px] text-gray-600 text-center truncate">
            {auction.last_bidder_name || 'Noch keine Gebote'}
          </p>
          
          {/* Bid Button */}
          <Button 
            onClick={() => onBid && onBid(auction.id)}
            disabled={!isAuthenticated || isEnded || isScheduled}
            className="w-full bg-gradient-to-b from-[#4db6c5] to-[#00838f] hover:from-[#5cc5d4] hover:to-[#009aa8] text-white font-bold py-2 text-sm rounded"
            data-testid={`bid-btn-${auction.id}`}
          >
            BIETEN
          </Button>
        </div>
        
        {/* Product Image */}
        <div className="w-24 h-24 ml-3 flex-shrink-0">
          <img 
            src={product.image_url || 'https://via.placeholder.com/100'} 
            alt={product.name}
            className="w-full h-full object-contain rounded"
          />
        </div>
      </div>
      
      {/* Activity Index */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-gray-500">Aktivitätsindex:</span>
          <div className="flex gap-0.5">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-3 rounded-sm ${
                  i < activityLevel 
                    ? i < 3 ? 'bg-red-500' : i < 6 ? 'bg-yellow-500' : 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Timer Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
        {isScheduled ? (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-orange-600 font-medium">Startet in:</span>
            <span className="font-mono font-bold text-orange-600">
              {startTimeLeft.days > 0 && `${startTimeLeft.days}T `}
              {formatTime(startTimeLeft.hours)}:{formatTime(startTimeLeft.minutes)}:{formatTime(startTimeLeft.seconds)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">STD.</span>
              <span className="text-gray-400">MIN.</span>
              <span className="text-gray-400">SEK.</span>
            </div>
            <div className="flex items-center gap-2 font-mono font-bold">
              <span className={isEnded ? 'text-red-500' : 'text-gray-700'}>{formatTime(timeLeft.hours)}</span>
              <span className="text-gray-400">:</span>
              <span className={isEnded ? 'text-red-500' : 'text-gray-700'}>{formatTime(timeLeft.minutes)}</span>
              <span className="text-gray-400">:</span>
              <span className={isEnded ? 'text-red-500' : 'text-gray-700'}>{formatTime(timeLeft.seconds)}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Last Sold Info */}
      <div className="px-3 py-2 bg-[#e8f4f8] text-center">
        <span className="text-[10px] text-[#00838f]">
          Zuletzt versteigert für nur € {lastSoldPrice}
        </span>
      </div>
    </div>
  );
};

// Featured Auction (große Karte)
const FeaturedAuction = ({ auction, onBid, isAuthenticated }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    if (!auction) return;
    
    const calculateTime = () => {
      const endTime = new Date(auction.end_time);
      const now = new Date();
      const diff = endTime - now;
      
      if (diff > 0) {
        setTimeLeft({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000)
        });
      }
    };
    
    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [auction]);

  if (!auction) return null;
  
  const product = auction.product || {};
  const isEnded = auction.status === 'ended';
  const formatTime = (num) => String(num).padStart(2, '0');
  const activityLevel = Math.min(auction.total_bids || 0, 10);

  return (
    <div className="bg-gradient-to-r from-[#f97316] to-[#ea580c] rounded-xl p-4 mb-6 shadow-lg">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left: Info */}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white uppercase mb-2">{product.name}</h2>
          <p className="text-white/80 text-sm mb-4">{product.description?.slice(0, 100) || 'Premium Produkt zum Bieten!'}</p>
          <p className="text-white/70 text-xs">Vergleichspreis*: € {product.retail_price?.toFixed(2) || '0.00'},-</p>
          
          {/* Timer */}
          <div className="flex items-center gap-4 mt-4 bg-white/20 rounded-lg p-3">
            <div className="flex items-center gap-1 px-3 py-1 rounded bg-white/30">
              {isEnded ? (
                <span className="text-sm font-bold text-white">BEENDET</span>
              ) : (
                <>
                  <Pause className="w-4 h-4 text-white" />
                  <span className="text-xs font-bold text-white">PAUSE</span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-white font-mono">{formatTime(timeLeft.hours)}</div>
                <div className="text-[10px] text-white/70">STD</div>
              </div>
              <span className="text-2xl text-white/50">:</span>
              <div className="text-center">
                <div className="text-2xl font-bold text-white font-mono">{formatTime(timeLeft.minutes)}</div>
                <div className="text-[10px] text-white/70">MIN</div>
              </div>
              <span className="text-2xl text-white/50">:</span>
              <div className="text-center">
                <div className="text-2xl font-bold text-white font-mono">{formatTime(timeLeft.seconds)}</div>
                <div className="text-[10px] text-white/70">SEK</div>
              </div>
            </div>
          </div>
          
          {/* Price and Bid */}
          <div className="flex items-end gap-4 mt-4">
            <div>
              <p className="text-white/70 text-xs mb-1">Aktueller Preis:</p>
              <div className="text-4xl font-bold text-white">€ {auction.current_price?.toFixed(2)}</div>
              <p className="text-white/70 text-xs mt-1">{auction.last_bidder_name || 'Noch keine Gebote'}</p>
            </div>
            <Button 
              onClick={() => onBid && onBid(auction.id)}
              disabled={!isAuthenticated || isEnded}
              className="bg-gradient-to-b from-[#4db6c5] to-[#00838f] hover:from-[#5cc5d4] hover:to-[#009aa8] text-white font-bold py-3 px-8 text-lg rounded-lg shadow-lg"
            >
              BIETEN
            </Button>
          </div>
          
          {/* Activity Index */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs text-white/70">Aktivitätsindex:</span>
            <div className="flex gap-0.5">
              {[...Array(10)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3 h-4 rounded-sm ${
                    i < activityLevel 
                      ? i < 3 ? 'bg-red-400' : i < 6 ? 'bg-yellow-400' : 'bg-green-400'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Right: Image */}
        <div className="w-full md:w-64 h-48 md:h-auto flex items-center justify-center">
          <img 
            src={product.image_url || 'https://via.placeholder.com/200'} 
            alt={product.name}
            className="max-h-48 object-contain rounded-lg drop-shadow-xl"
          />
        </div>
      </div>
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ isAuthenticated }) => {
  return (
    <div className="space-y-4">
      {/* Login Box */}
      {!isAuthenticated && (
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-gray-700">LOGIN</span>
            <Link to="/forgot-password" className="text-[10px] text-[#00838f] hover:underline">
              Passwort vergessen
            </Link>
          </div>
          <div className="space-y-2">
            <Input placeholder="Benutzername" className="h-8 text-sm" />
            <Input type="password" placeholder="Passwort" className="h-8 text-sm" />
            <Button className="w-full bg-gradient-to-b from-[#4db6c5] to-[#00838f] text-white font-bold h-8 text-sm">
              EINLOGGEN
            </Button>
          </div>
          <div className="mt-3 text-center">
            <Link to="/register" className="text-[#00838f] text-xs font-bold hover:underline flex items-center justify-center gap-1">
              <Zap className="w-3 h-3" />
              3 FREIGEBOTE - Kostenlos anmelden
            </Link>
          </div>
        </div>
      )}
      
      {/* How it works */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-3 text-sm">DAS IST BIDBLITZ</h3>
        <ol className="space-y-2 text-xs text-gray-600">
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-[#00838f] text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</span>
            <span>Gebotspaket kaufen</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-[#00838f] text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</span>
            <span>Produkt auswählen und 1 Cent mehr bieten</span>
          </li>
          <li className="flex gap-2">
            <span className="w-5 h-5 rounded-full bg-[#00838f] text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</span>
            <span>Sobald die Zeit abgelaufen ist und niemand höher bietet, Produkt zum Schnäppchenpreis erwerben.</span>
          </li>
        </ol>
      </div>
      
      {/* Security */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-green-600" />
          <span className="font-bold text-gray-700 text-sm">SICHER BEZAHLEN!</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <img src="https://cdn-icons-png.flaticon.com/48/888/888870.png" alt="PayPal" className="h-6" />
          <img src="https://cdn-icons-png.flaticon.com/48/349/349221.png" alt="Visa" className="h-6" />
          <img src="https://cdn-icons-png.flaticon.com/48/349/349228.png" alt="Mastercard" className="h-6" />
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <Lock className="w-3 h-3" />
          <span>SSL verschlüsselt</span>
        </div>
      </div>
    </div>
  );
};

// Recently Ended Auctions
const RecentlyEndedAuctions = ({ auctions }) => {
  const endedAuctions = auctions.filter(a => a.status === 'ended').slice(0, 5);
  
  if (endedAuctions.length === 0) return null;
  
  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-white mb-4">Kürzlich beendete Auktionen</h3>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {endedAuctions.map((auction) => (
          <div key={auction.id} className="flex-shrink-0 w-40 bg-white rounded-lg p-3 shadow">
            <div className="text-xs font-bold text-gray-700 truncate">{auction.product?.name}</div>
            <div className="text-[#00838f] font-bold mt-1">€ {auction.current_price?.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500 mt-1">
              <Trophy className="w-3 h-3 inline mr-1 text-yellow-500" />
              {auction.winner_name || 'Kein Gewinner'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Auctions() {
  const { isAuthenticated, token, updateBidsBalance } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 5000);
    return () => clearInterval(interval);
  }, [filter]);

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

  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error('Bitte melden Sie sich an, um zu bieten');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot erfolgreich platziert!');
      updateBidsBalance(response.data.bids_remaining);
      fetchAuctions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };

  // Get featured auction (most bids or first active)
  const activeAuctions = auctions.filter(a => a.status === 'active');
  const scheduledAuctions = auctions.filter(a => a.status === 'scheduled');
  const featuredAuction = activeAuctions.sort((a, b) => (b.total_bids || 0) - (a.total_bids || 0))[0];
  const liveAuctions = activeAuctions.filter(a => a.id !== featuredAuction?.id);

  return (
    <div className="min-h-screen pt-20 pb-12 bg-gradient-to-b from-[#4db6c5] to-[#2d8a97]" data-testid="auctions-page">
      <div className="max-w-7xl mx-auto px-4">
        {/* Featured Auction */}
        {featuredAuction && (
          <FeaturedAuction 
            auction={featuredAuction} 
            onBid={handleBid} 
            isAuthenticated={isAuthenticated} 
          />
        )}
        
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Live-Auktionen</h2>
              <Button 
                onClick={fetchAuctions}
                variant="outline"
                size="sm"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Aktualisieren
              </Button>
            </div>
            
            {/* Auctions Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg h-72 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Active Auctions */}
                {liveAuctions.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                    {liveAuctions.map((auction) => (
                      <CompactAuctionCard
                        key={auction.id}
                        auction={auction}
                        onBid={handleBid}
                        isAuthenticated={isAuthenticated}
                      />
                    ))}
                  </div>
                )}
                
                {/* Scheduled Auctions */}
                {scheduledAuctions.length > 0 && (
                  <>
                    <h3 className="text-lg font-bold text-white mb-3 mt-6">Geplante Auktionen</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {scheduledAuctions.map((auction) => (
                        <CompactAuctionCard
                          key={auction.id}
                          auction={auction}
                          onBid={handleBid}
                          isAuthenticated={isAuthenticated}
                        />
                      ))}
                    </div>
                  </>
                )}
                
                {/* No auctions message */}
                {activeAuctions.length === 0 && scheduledAuctions.length === 0 && (
                  <div className="bg-white rounded-lg p-8 text-center">
                    <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-700">Keine aktiven Auktionen</h3>
                    <p className="text-gray-500 text-sm">Schauen Sie bald wieder vorbei!</p>
                  </div>
                )}
                
                {/* Recently Ended */}
                <RecentlyEndedAuctions auctions={auctions} />
              </>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <Sidebar isAuthenticated={isAuthenticated} />
          </div>
        </div>
        
        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-white/70 text-xs">
            * Vergleichspreis = UVP des Herstellers
          </p>
        </div>
      </div>
    </div>
  );
}
