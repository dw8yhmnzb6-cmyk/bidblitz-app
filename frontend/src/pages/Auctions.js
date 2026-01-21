import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Search, Flame, Clock, TrendingUp, Bell, BellOff, Star } from 'lucide-react';
import { toast } from 'sonner';

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

// Featured Auction Timer Component - Shows PAUSIERT when outside business hours
const FeaturedTimer = ({ endTime, serverTimeOffset = 0, isPaused = false }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  
  useEffect(() => {
    if (isPaused) return; // Don't update timer when paused
    
    const parseEndTime = (endTimeStr) => {
      if (!endTimeStr) return null;
      try {
        let date = new Date(endTimeStr);
        if (!isNaN(date.getTime())) return date;
        return null;
      } catch {
        return null;
      }
    };
    
    const calc = () => {
      const end = parseEndTime(endTime);
      if (!end) return;
      
      const now = new Date(Date.now() + serverTimeOffset);
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0 });
      } else {
        setTimeLeft({
          h: Math.floor(diff / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000)
        });
      }
    };
    
    calc();
    const int = setInterval(calc, 1000);
    return () => clearInterval(int);
  }, [endTime, serverTimeOffset, isPaused]);
  
  const pad = (n) => String(n).padStart(2, '0');
  
  // Show PAUSIERT when outside business hours
  if (isPaused) {
    return (
      <div className="flex items-center gap-2 text-lg font-bold text-orange-400">
        <span className="bg-orange-500/20 px-3 py-1 rounded animate-pulse">⏸ PAUSIERT</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 text-xl font-mono font-bold text-yellow-400">
      <span className="bg-black/50 px-2 py-1 rounded">{pad(timeLeft.h)}</span>
      <span className="text-white/50">:</span>
      <span className="bg-black/50 px-2 py-1 rounded">{pad(timeLeft.m)}</span>
      <span className="text-white/50">:</span>
      <span className="bg-black/50 px-2 py-1 rounded">{pad(timeLeft.s)}</span>
    </div>
  );
};

// Helper to parse ISO date correctly in all browsers (including Safari/iOS)
const parseEndTime = (endTimeStr) => {
  if (!endTimeStr) return null;
  
  try {
    // Method 1: Direct parsing (works in most browsers)
    let date = new Date(endTimeStr);
    
    // Check if parsing was successful
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Method 2: Manual parsing for Safari/iOS compatibility
    // Handle format: "2026-01-20T22:22:48.196591+00:00"
    const match = endTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|([+-])(\d{2}):(\d{2}))?$/);
    if (match) {
      const [, year, month, day, hour, minute, second, ms, tzSign, tzHour, tzMin] = match;
      
      // Create date in UTC
      date = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
        ms ? parseInt(ms.slice(0, 3)) : 0
      ));
      
      // Adjust for timezone offset if present
      if (tzSign && tzHour && tzMin) {
        const offsetMs = (parseInt(tzHour) * 60 + parseInt(tzMin)) * 60 * 1000;
        if (tzSign === '+') {
          date = new Date(date.getTime() - offsetMs);
        } else {
          date = new Date(date.getTime() + offsetMs);
        }
      }
      
      return date;
    }
    
    return null;
  } catch (e) {
    console.error('Date parsing error:', e, endTimeStr);
    return null;
  }
};

// Compact Auction Card for Mobile
const AuctionCard = ({ auction, product, reminders, onToggleReminder, isLoggedIn, serverTimeOffset, isPaused }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, ended: false, loading: true });
  const hasReminder = reminders?.includes(auction.id);
  
  useEffect(() => {
    const calc = () => {
      // Parse end_time properly (handle timezone)
      const endTime = parseEndTime(auction.end_time);
      
      // Safety check: if parsing failed
      if (!endTime || isNaN(endTime.getTime())) {
        console.error('Invalid end_time:', auction.end_time);
        setTimeLeft({ h: 0, m: 0, s: 0, ended: true, loading: false });
        return;
      }
      
      // Use server time offset if available (fixes devices with wrong system time)
      const now = serverTimeOffset 
        ? new Date(Date.now() + serverTimeOffset)
        : new Date();
      
      const diff = endTime.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, ended: true, loading: false });
      } else {
        setTimeLeft({
          h: Math.floor(diff / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000),
          ended: false,
          loading: false,
          paused: isPaused
        });
      }
    };
    
    // Calculate immediately
    calc();
    
    // Only set interval if not paused
    if (!isPaused) {
      const int = setInterval(calc, 1000);
      return () => clearInterval(int);
    }
  }, [auction.end_time, serverTimeOffset, isPaused]);
  
  // IMPORTANT: Only show as ended if backend status is 'ended'
  // Don't rely purely on local time calculation which can be affected by timezone issues
  const isEnded = auction.status === 'ended';
  const showAsTimerExpired = !timeLeft.loading && timeLeft.ended && auction.status !== 'active';
  const isUrgent = !isEnded && !showAsTimerExpired && !isPaused && timeLeft.h === 0 && timeLeft.m < 2;
  const pad = (n) => String(n).padStart(2, '0');
  
  // Short product name (max 20 chars)
  const shortName = product?.name?.length > 22 
    ? product.name.substring(0, 20) + '...' 
    : product?.name || 'Produkt';
  
  const discount = product?.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;

  const handleReminderClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleReminder) {
      onToggleReminder(auction.id, hasReminder);
    }
  };

  return (
    <Link 
      to={`/auctions/${auction.id}`}
      className="block"
      data-testid={`auction-card-${auction.id}`}
    >
      <div className={`bg-[#1a4a5e] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow ${isEnded ? 'opacity-60' : ''}`}>
        
        {/* Header: Badge + Timer + Reminder */}
        <div className="flex justify-between items-center px-2 py-1.5 bg-[#0d3040]">
          <div className="flex items-center gap-1">
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
              -{discount}%
            </span>
            {/* Reminder Button - only show for active auctions when logged in */}
            {isLoggedIn && !isEnded && (
              <button
                onClick={handleReminderClick}
                className={`p-1 rounded transition-colors ${
                  hasReminder 
                    ? 'bg-yellow-500/20 text-yellow-400' 
                    : 'bg-gray-700/50 text-gray-400 hover:text-yellow-400'
                }`}
                title={hasReminder ? 'Erinnerung aktiv' : 'Erinnere mich'}
                data-testid={`reminder-btn-${auction.id}`}
              >
                {hasReminder ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              </button>
            )}
          </div>
          {timeLeft.loading ? (
            <span className="text-gray-400 text-[11px]">...</span>
          ) : isPaused && !isEnded ? (
            <span className="text-orange-400 text-[10px] font-bold bg-orange-500/20 px-2 py-0.5 rounded animate-pulse">
              ⏸ PAUSIERT
            </span>
          ) : (
            <div className={`flex text-[11px] font-mono font-bold ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
              <span className="bg-black/30 px-1 rounded-l">{pad(timeLeft.h)}</span>
              <span className="text-white/50">:</span>
              <span className="bg-black/30 px-1">{pad(timeLeft.m)}</span>
              <span className="text-white/50">:</span>
              <span className={`px-1 rounded-r ${isUrgent ? 'bg-red-500 text-white' : 'bg-orange-400 text-black'}`}>
                {pad(timeLeft.s)}
              </span>
            </div>
          )}
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
            <div className="w-14 h-14 bg-white rounded flex items-center justify-center flex-shrink-0 overflow-hidden relative">
              <img
                src={product?.image_url || 'https://via.placeholder.com/56'}
                alt=""
                className="max-w-full max-h-full object-contain"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/56?text=?'; }}
              />
              {isEnded && (
                <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold rotate-[-10deg]">VERKAUFT</span>
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
  const { user, token } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState({});
  const [reminders, setReminders] = useState([]);
  const [featuredAuction, setFeaturedAuction] = useState(null);
  const [businessHours, setBusinessHours] = useState({ is_open: true });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  const fetchAuctions = useCallback(async () => {
    try {
      const requestStartTime = Date.now();
      
      const requests = [
        axios.get(`${API}/auctions`),
        axios.get(`${API}/products`),
        axios.get(`${API}/auctions/featured`).catch(() => ({ data: null })),
        axios.get(`${API}/auctions/business-hours`).catch(() => ({ data: { is_open: true } }))
      ];
      
      // Fetch reminders if logged in
      if (token) {
        requests.push(
          axios.get(`${API}/notifications/my-reminders`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { reminders: [] } }))
        );
      }
      
      const results = await Promise.all(requests);
      const auctionRes = results[0];
      const productRes = results[1];
      const featuredRes = results[2];
      const businessHoursRes = results[3];
      const remindersRes = results[4];
      
      // Calculate server time offset from response header or first auction's timestamp
      // This helps devices with wrong system time
      const serverDate = auctionRes.headers?.date;
      if (serverDate) {
        const serverTime = new Date(serverDate).getTime();
        const clientTime = requestStartTime;
        const offset = serverTime - clientTime;
        // Only apply offset if it's significant (more than 30 seconds)
        if (Math.abs(offset) > 30000) {
          setServerTimeOffset(offset);
          console.log(`Time offset detected: ${offset}ms (${Math.round(offset/1000)}s)`);
        }
      }
      
      setAuctions(auctionRes.data);
      const productMap = {};
      productRes.data.forEach(p => { productMap[p.id] = p; });
      setProducts(productMap);
      
      // Set featured auction
      if (featuredRes?.data) {
        setFeaturedAuction(featuredRes.data);
      }
      
      // Set business hours
      if (businessHoursRes?.data) {
        setBusinessHours(businessHoursRes.data);
      }
      
      // Set reminder auction IDs
      if (remindersRes?.data?.reminders) {
        setReminders(remindersRes.data.reminders.map(r => r.auction_id));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 30000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  // Toggle reminder for an auction
  const handleToggleReminder = async (auctionId, hasReminder) => {
    if (!token) {
      toast.error('Bitte melden Sie sich an');
      return;
    }
    
    try {
      if (hasReminder) {
        // Remove reminder
        await axios.delete(`${API}/notifications/auction-reminder/${auctionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setReminders(prev => prev.filter(id => id !== auctionId));
        toast.success('Erinnerung entfernt');
      } else {
        // Set reminder (5 min before end)
        const res = await axios.post(`${API}/notifications/auction-reminder/${auctionId}`, 
          { minutes_before: 5 },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setReminders(prev => [...prev, auctionId]);
        toast.success(`⏰ ${res.data.message}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Setzen der Erinnerung');
    }
  };

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
        
        {/* Business Hours Notice */}
        {!businessHours.is_open && (
          <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-xl p-4 mb-4 mt-2">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-orange-400" />
              <div>
                <p className="text-white font-semibold">Auktionen pausiert</p>
                <p className="text-gray-300 text-sm">
                  Unsere Auktionen laufen täglich von {businessHours.business_start} bis {businessHours.business_end} Uhr.
                  {businessHours.next_opening && (
                    <span className="text-orange-400 font-medium"> Nächste Öffnung: {new Date(businessHours.next_opening).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Featured/VIP Auction */}
        {featuredAuction && featuredAuction.status === 'active' && (
          <Link to={`/auctions/${featuredAuction.id}`} className="block mb-4 mt-2">
            <div className="relative bg-gradient-to-r from-[#1a4a5e] via-[#0d3a4d] to-[#1a4a5e] rounded-2xl overflow-hidden border-2 border-yellow-500/50 shadow-2xl shadow-yellow-500/10">
              {/* VIP Badge */}
              <div className="absolute top-3 left-3 z-10">
                <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <span>⭐</span> VIP AUKTION
                </span>
              </div>
              
              {/* Discount Badge */}
              <div className="absolute top-3 right-3 z-10">
                <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                  -{Math.round((1 - (featuredAuction.current_price / (featuredAuction.product?.retail_price || 100))) * 100)}%
                </span>
              </div>
              
              <div className="flex flex-col md:flex-row items-center p-4 md:p-6 gap-4">
                {/* Product Image */}
                <div className="w-full md:w-1/3 flex-shrink-0">
                  <img 
                    src={featuredAuction.product?.image_url || '/placeholder.png'} 
                    alt={featuredAuction.product?.name}
                    className="w-full h-40 md:h-48 object-contain bg-white/5 rounded-xl"
                  />
                </div>
                
                {/* Product Info */}
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                    {featuredAuction.product?.name}
                  </h2>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {featuredAuction.product?.description || 'Premium Produkt zum Schnäppchenpreis!'}
                  </p>
                  
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                    {/* Current Price */}
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Aktueller Preis</p>
                      <p className="text-3xl font-bold text-cyan-400">€{featuredAuction.current_price?.toFixed(2)}</p>
                    </div>
                    
                    {/* Retail Price */}
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">UVP</p>
                      <p className="text-lg text-gray-500 line-through">€{featuredAuction.product?.retail_price?.toFixed(2)}</p>
                    </div>
                    
                    {/* Timer */}
                    <div className="bg-black/30 rounded-lg px-4 py-2">
                      <p className="text-gray-400 text-xs text-center">Endet in</p>
                      <FeaturedTimer endTime={featuredAuction.end_time} serverTimeOffset={serverTimeOffset} isPaused={!businessHours.is_open} />
                    </div>
                  </div>
                </div>
                
                {/* Bid Button */}
                <div className="flex-shrink-0">
                  <button className={`font-bold py-3 px-8 rounded-xl text-lg transition-all transform shadow-lg ${
                    businessHours.is_open 
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black hover:scale-105' 
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`} disabled={!businessHours.is_open}>
                    {businessHours.is_open ? 'JETZT BIETEN' : '⏸ PAUSIERT'}
                  </button>
                </div>
              </div>
              
              {/* Activity Bar */}
              <div className="bg-black/30 px-4 py-2 flex items-center justify-between text-xs">
                <span className="text-gray-400">{featuredAuction.total_bids || 0} Gebote</span>
                <span className="text-gray-400">
                  {featuredAuction.last_bidder_name && `Letzter Bieter: ${featuredAuction.last_bidder_name}`}
                </span>
                <span className="text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Hohe Aktivität
                </span>
              </div>
            </div>
          </Link>
        )}
        
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
            {reminders.length > 0 && (
              <span className="ml-2 text-yellow-400">
                <Bell className="w-3 h-3 inline" /> {reminders.length} Erinnerungen
              </span>
            )}
            {serverTimeOffset !== 0 && (
              <span className="ml-2 text-orange-400" title="Zeitabweichung erkannt">
                ⚠️ Zeit-Sync
              </span>
            )}
          </span>
        </div>

        {/* Grid: 2 columns on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {sorted.map(auction => (
            <AuctionCard 
              key={auction.id} 
              auction={auction} 
              product={products[auction.product_id]}
              reminders={reminders}
              onToggleReminder={handleToggleReminder}
              isLoggedIn={!!token}
              serverTimeOffset={serverTimeOffset}
              isPaused={!businessHours.is_open}
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
