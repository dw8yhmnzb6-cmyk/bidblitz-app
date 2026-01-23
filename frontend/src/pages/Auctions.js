import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket';
import { RefreshCw, Search, Flame, Clock, TrendingUp, Bell, BellOff, Star, Heart, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Activity Index Bar - Snipster Style with gradient and pointer
const ActivityIndex = ({ bids, auctionId = '' }) => {
  // Create stable position based on auction ID
  const stableOffset = auctionId ? (auctionId.charCodeAt(0) % 15) : 8;
  const baseLevel = 35 + stableOffset;
  const bidBonus = Math.min(20, (bids || 0) * 0.2);
  const position = Math.min(60, baseLevel + bidBonus);
  
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400">Aktivitätsindex:</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{
        background: 'linear-gradient(to right, #22c55e 0%, #84cc16 30%, #eab308 50%, #f97316 70%, #ef4444 100%)'
      }}>
        {/* Pointer */}
        <div 
          className="absolute top-0 w-0.5 h-full bg-white shadow-lg"
          style={{ 
            left: `${position}%`,
            transition: 'left 0.5s ease-out',
            boxShadow: '0 0 4px rgba(255,255,255,0.8)'
          }}
        />
      </div>
    </div>
  );
};

// Snipster-Style Auction Card - Clean, Professional Design
const AuctionCard = ({ auction, product, texts, hasReminder, onToggleReminder, serverTimeOffset, isLoggedIn }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, loading: true, ended: false });
  const isPaused = auction.is_paused;
  
  useEffect(() => {
    if (auction.end_time) {
      const calc = () => {
        const now = Date.now() + serverTimeOffset;
        const end = new Date(auction.end_time).getTime();
        const diff = Math.max(0, end - now);
        const totalSeconds = Math.floor(diff / 1000);
        setTimeLeft({
          h: Math.floor(totalSeconds / 3600),
          m: Math.floor((totalSeconds % 3600) / 60),
          s: totalSeconds % 60,
          loading: false,
          ended: diff <= 0
        });
      };
      calc();
      const int = setInterval(calc, 1000);
      return () => clearInterval(int);
    }
  }, [auction.end_time, serverTimeOffset, isPaused]);
  
  const isEnded = auction.status === 'ended';
  const isUrgent = !isEnded && timeLeft.h === 0 && timeLeft.m < 1;
  const pad = (n) => String(n).padStart(2, '0');
  
  // Calculate discount
  const discount = product?.retail_price 
    ? Math.round((1 - auction.current_price / product.retail_price) * 100)
    : 99;

  return (
    <Link 
      to={`/auctions/${auction.id}`}
      className="block group"
      data-testid={`auction-card-${auction.id}`}
    >
      <div className={`rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 ${isEnded ? 'opacity-60' : ''}`}
        style={{
          background: 'linear-gradient(145deg, #1e3a5f 0%, #0f2744 100%)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        {/* Timer Bar at Top */}
        <div className={`px-3 py-2 flex items-center justify-between ${isUrgent ? 'bg-red-600' : 'bg-gradient-to-r from-blue-600 to-blue-800'}`}>
          <div className="flex items-center gap-2">
            {/* Badges */}
            {auction.is_beginner_only && (
              <span className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">🎓</span>
            )}
            {auction.is_free_auction && (
              <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">GRATIS</span>
            )}
            {auction.is_vip_only && (
              <span className="bg-yellow-400 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">⭐ VIP</span>
            )}
            {auction.is_night_auction && (
              <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">🌙</span>
            )}
          </div>
          
          {/* Timer */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-white/70" />
            {timeLeft.loading ? (
              <span className="text-white text-xs">--:--:--</span>
            ) : timeLeft.ended && auction.status === 'active' ? (
              <span className="text-white text-xs animate-pulse">Neustart...</span>
            ) : (
              <div className="flex items-center text-white font-mono text-sm font-bold">
                <span className="bg-black/30 px-1 rounded">{pad(timeLeft.h)}</span>
                <span className="mx-0.5">:</span>
                <span className="bg-black/30 px-1 rounded">{pad(timeLeft.m)}</span>
                <span className="mx-0.5">:</span>
                <span className={`px-1 rounded ${isUrgent ? 'bg-white text-red-600' : 'bg-black/30'}`}>
                  {pad(timeLeft.s)}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-3">
          {/* Product Title */}
          <h3 className="text-white text-sm font-bold leading-tight mb-1 line-clamp-2 min-h-[2.5rem]" 
              title={product?.name}>
            {product?.name || 'Produkt'}
          </h3>
          
          {/* Retail Price */}
          <p className="text-gray-400 text-xs mb-3">
            Vergleichspreis*: <span className="line-through">€ {product?.retail_price?.toLocaleString('de-DE') || '999'},-</span>
          </p>
          
          {/* Image + Price Row */}
          <div className="flex gap-3">
            {/* Product Image */}
            <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
              <img
                src={product?.image_url || 'https://via.placeholder.com/80'}
                alt={product?.name || ''}
                className="max-w-full max-h-full object-contain p-1"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=?'; }}
              />
            </div>
            
            {/* Price Block */}
            <div className="flex-1 flex flex-col justify-between">
              {/* Current Price */}
              <div>
                <p className="text-2xl font-black text-white leading-none">
                  € {auction.current_price?.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-cyan-400 text-xs mt-1 truncate">
                  {auction.last_bidder_name || 'Startpreis'}
                </p>
              </div>
              
              {/* Discount Badge */}
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                  -{discount}%
                </span>
                {isLoggedIn && !isEnded && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onToggleReminder) onToggleReminder(auction.id, hasReminder);
                    }}
                    className={`p-1 rounded transition-colors ${
                      hasReminder ? 'bg-yellow-500/30 text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
                    }`}
                  >
                    {hasReminder ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Activity Index */}
          <ActivityIndex bids={auction.total_bids} auctionId={auction.id} />
          
          {/* Bid Button */}
          <button 
            className={`w-full mt-3 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-200 ${
              isEnded 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
            }`}
          >
            {isEnded ? 'BEENDET' : 'BIETEN'}
          </button>
        </div>
        
        {/* Last Sold Footer */}
        <div className="bg-black/30 px-3 py-1.5 text-center border-t border-white/5">
          <p className="text-[10px] text-gray-400">
            Zuletzt versteigert für nur <span className="text-green-400 font-bold">€ {((product?.retail_price || 100) * 0.05).toFixed(2).replace('.', ',')}</span>
          </p>
        </div>
      </div>
    </Link>
  );
};
const auctionTranslations = {
  de: {
    vipAuction: "VIP AUKTION",
    currentPrice: "Aktueller Preis",
    endsIn: "Endet in",
    bids: "Gebote",
    highActivity: "Hohe Aktivität",
    liveAuctions: "Live-Auktionen",
    activeCount: "aktiv",
    saveUpTo: "Spare bis zu 99%!",
    search: "Suchen...",
    live: "Live",
    end: "Ende",
    auctionsFound: "Auktionen gefunden",
    reminders: "Erinnerungen",
    timeSync: "Zeit-Sync",
    noAuctions: "Keine Auktionen",
    tryOther: "Anderer Filter probieren",
    bidNow: "JETZT BIETEN",
    paused: "PAUSIERT",
    auctionsPaused: "Auktionen pausiert",
    businessHoursInfo: "Unsere Auktionen laufen täglich von",
    to: "bis",
    nextOpening: "Nächste Öffnung",
    rrp: "UVP",
    startPrice: "Startpreis",
    activity: "Aktivität",
    lastSold: "Zuletzt für",
    ended: "Beendet",
    scheduled: "Geplant",
    bid: "Bieten",
    sold: "VERKAUFT",
    remindMe: "Erinnere mich",
    reminderActive: "Erinnerung aktiv",
    pricesNote: "Preise zzgl. Versand",
    addToWishlist: "Zur Wunschliste",
    removeFromWishlist: "Von Wunschliste entfernen",
    wishlistAdded: "Zur Wunschliste hinzugefügt",
    wishlistRemoved: "Von Wunschliste entfernt",
    auctionOfDay: "AUKTION DES TAGES"
  },
  en: {
    vipAuction: "VIP AUCTION",
    currentPrice: "Current Price",
    endsIn: "Ends in",
    bids: "Bids",
    highActivity: "High Activity",
    liveAuctions: "Live Auctions",
    activeCount: "active",
    saveUpTo: "Save up to 99%!",
    search: "Search...",
    live: "Live",
    end: "Ended",
    auctionsFound: "auctions found",
    reminders: "Reminders",
    timeSync: "Time Sync",
    noAuctions: "No auctions",
    tryOther: "Try another filter",
    bidNow: "BID NOW",
    paused: "PAUSED",
    auctionsPaused: "Auctions paused",
    businessHoursInfo: "Our auctions run daily from",
    to: "to",
    nextOpening: "Next opening",
    rrp: "RRP",
    startPrice: "Start price",
    activity: "Activity",
    lastSold: "Last sold for",
    ended: "Ended",
    scheduled: "Scheduled",
    bid: "Bid",
    sold: "SOLD",
    remindMe: "Remind me",
    reminderActive: "Reminder active",
    pricesNote: "Prices excl. shipping"
  },
  sq: {
    vipAuction: "ANKAND VIP",
    currentPrice: "Çmimi Aktual",
    endsIn: "Përfundon në",
    bids: "Oferta",
    highActivity: "Aktivitet i lartë",
    liveAuctions: "Ankande Live",
    activeCount: "aktive",
    saveUpTo: "Kurse deri në 99%!",
    search: "Kërko...",
    live: "Live",
    end: "Fund",
    auctionsFound: "ankande u gjetën",
    reminders: "Kujtues",
    timeSync: "Sinkronizim kohe",
    noAuctions: "Nuk ka ankande",
    tryOther: "Provo filter tjetër",
    bidNow: "OFERONI TANI",
    paused: "PUSHUAR",
    auctionsPaused: "Ankandet janë pushuar",
    businessHoursInfo: "Ankandet tona zhvillohen çdo ditë nga",
    to: "deri",
    nextOpening: "Hapja e radhës",
    rrp: "Çmimi",
    startPrice: "Çmimi fillestar",
    activity: "Aktiviteti",
    lastSold: "Shitur së fundmi për",
    ended: "Përfunduar",
    scheduled: "Planifikuar",
    bid: "Oferoni",
    sold: "SHITUR",
    remindMe: "Më kujto",
    reminderActive: "Kujtues aktiv",
    pricesNote: "Çmimet pa transport"
  },
  tr: {
    vipAuction: "VIP AÇIK ARTIRMA",
    currentPrice: "Güncel Fiyat",
    endsIn: "Biter",
    bids: "Teklifler",
    highActivity: "Yüksek Aktivite",
    liveAuctions: "Canlı Açık Artırmalar",
    activeCount: "aktif",
    saveUpTo: "%99'a kadar tasarruf et!",
    search: "Ara...",
    live: "Canlı",
    end: "Bitti",
    auctionsFound: "açık artırma bulundu",
    reminders: "Hatırlatıcılar",
    timeSync: "Zaman Senk.",
    noAuctions: "Açık artırma yok",
    tryOther: "Başka filtre dene",
    bidNow: "ŞİMDİ TEKLİF VER",
    paused: "DURAKLADI",
    auctionsPaused: "Açık artırmalar duraklatıldı",
    businessHoursInfo: "Açık artırmalarımız her gün",
    to: "ile",
    nextOpening: "Sonraki açılış",
    rrp: "TSF",
    startPrice: "Başlangıç fiyatı",
    activity: "Aktivite",
    lastSold: "Son satış",
    ended: "Bitti",
    scheduled: "Planlandı",
    bid: "Teklif Ver",
    sold: "SATILDI",
    remindMe: "Hatırlat",
    reminderActive: "Hatırlatıcı aktif",
    pricesNote: "Fiyatlar kargo hariç"
  },
  fr: {
    vipAuction: "ENCHÈRE VIP",
    currentPrice: "Prix actuel",
    endsIn: "Se termine dans",
    bids: "Enchères",
    highActivity: "Haute activité",
    liveAuctions: "Enchères en direct",
    activeCount: "actives",
    saveUpTo: "Économisez jusqu'à 99%!",
    search: "Rechercher...",
    live: "En direct",
    end: "Terminé",
    auctionsFound: "enchères trouvées",
    reminders: "Rappels",
    timeSync: "Sync. temps",
    noAuctions: "Pas d'enchères",
    tryOther: "Essayez un autre filtre",
    bidNow: "ENCHÉRIR",
    paused: "EN PAUSE",
    auctionsPaused: "Enchères en pause",
    businessHoursInfo: "Nos enchères sont ouvertes de",
    to: "à",
    nextOpening: "Prochaine ouverture",
    rrp: "Prix conseillé",
    startPrice: "Prix de départ",
    activity: "Activité",
    lastSold: "Dernière vente",
    ended: "Terminé",
    scheduled: "Prévu",
    bid: "Enchérir",
    sold: "VENDU",
    remindMe: "Me rappeler",
    reminderActive: "Rappel actif",
    pricesNote: "Prix hors livraison"
  }
};

// Helper to get auction translations for current language
const getAuctionText = (lang, key) => {
  const langTrans = auctionTranslations[lang] || auctionTranslations.de;
  return langTrans[key] || auctionTranslations.de[key] || key;
};

// Featured Auction Timer Component - Shows PAUSIERT when outside business hours
const FeaturedTimer = ({ endTime, serverTimeOffset = 0, isPaused = false, pausedText = "PAUSIERT" }) => {
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
        <span className="bg-orange-500/20 px-3 py-1 rounded animate-pulse">⏸ {pausedText}</span>
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


export default function Auctions() {
  const { t, language } = useLanguage();
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
  
  // WebSocket for real-time updates
  const { isConnected, auctionData, bidNotification } = useAuctionWebSocket(null);
  
  // Get texts for current language
  const texts = auctionTranslations[language] || auctionTranslations.de;

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
    // Only do backup polling every 60 seconds - WebSocket handles real-time updates
    // This is just a fallback in case WebSocket connection drops
    const interval = setInterval(() => {
      if (!isConnected) {
        fetchAuctions();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAuctions, isConnected]);

  // Update auctions from WebSocket in real-time
  useEffect(() => {
    if (auctionData && Array.isArray(auctionData)) {
      // Full state update from WebSocket
      setAuctions(auctionData);
    } else if (auctionData && auctionData.auction_id) {
      // Single auction update (bid_update)
      setAuctions(prev => prev.map(auction => 
        auction.id === auctionData.auction_id
          ? {
              ...auction,
              current_price: auctionData.current_price ?? auction.current_price,
              end_time: auctionData.end_time ?? auction.end_time,
              last_bidder_name: auctionData.last_bidder_name ?? auction.last_bidder_name,
              total_bids: auctionData.total_bids ?? auction.total_bids
            }
          : auction
      ));
      
      // Also update featured auction if it matches
      setFeaturedAuction(prev => {
        if (prev && prev.id === auctionData.auction_id) {
          return {
            ...prev,
            current_price: auctionData.current_price ?? prev.current_price,
            end_time: auctionData.end_time ?? prev.end_time,
            last_bidder_name: auctionData.last_bidder_name ?? prev.last_bidder_name,
            total_bids: auctionData.total_bids ?? prev.total_bids
          };
        }
        return prev;
      });
    }
  }, [auctionData]);

  // Show bid notification toast
  useEffect(() => {
    if (bidNotification) {
      toast.info(bidNotification.message, {
        description: `Neuer Preis: €${bidNotification.price?.toFixed(2)}`,
        duration: 2000
      });
    }
  }, [bidNotification]);

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
    if (statusFilter === 'beginner' && (a.status !== 'active' || !a.is_beginner_only)) return false;
    if (statusFilter === 'free' && (a.status !== 'active' || !a.is_free_auction)) return false;
    if (statusFilter === 'vip' && (a.status !== 'active' || !a.is_vip_only)) return false;
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
  const beginnerCount = auctions.filter(a => a.is_beginner_only && a.status === 'active').length;
  const freeCount = auctions.filter(a => a.is_free_auction && a.status === 'active').length;
  const vipCount = auctions.filter(a => a.is_vip_only && a.status === 'active').length;
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
                <p className="text-white font-semibold">{texts.auctionsPaused}</p>
                <p className="text-gray-300 text-sm">
                  {texts.businessHoursInfo} {businessHours.business_start} {texts.to} {businessHours.business_end}.
                  {businessHours.next_opening && (
                    <span className="text-orange-400 font-medium"> {texts.nextOpening}: {new Date(businessHours.next_opening).toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
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
                  <span>⭐</span> {texts.vipAuction}
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
                    {featuredAuction.product?.description || ''}
                  </p>
                  
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                    {/* Current Price */}
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">{texts.currentPrice}</p>
                      <p className="text-3xl font-bold text-cyan-400">€{featuredAuction.current_price?.toFixed(2)}</p>
                    </div>
                    
                    {/* Retail Price */}
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">{texts.rrp}</p>
                      <p className="text-lg text-gray-500 line-through">€{featuredAuction.product?.retail_price?.toFixed(2)}</p>
                    </div>
                    
                    {/* Timer */}
                    <div className="bg-black/30 rounded-lg px-4 py-2">
                      <p className="text-gray-400 text-xs text-center">{texts.endsIn}</p>
                      <FeaturedTimer endTime={featuredAuction.end_time} serverTimeOffset={serverTimeOffset} isPaused={!businessHours.is_open} pausedText={texts.paused} />
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
                    {businessHours.is_open ? texts.bidNow : `⏸ ${texts.paused}`}
                  </button>
                </div>
              </div>
              
              {/* Activity Bar */}
              <div className="bg-black/30 px-4 py-2 flex items-center justify-between text-xs">
                <span className="text-gray-400">{featuredAuction.total_bids || 0} {texts.bids}</span>
                <span className="text-gray-400">
                  {featuredAuction.last_bidder_name && featuredAuction.last_bidder_name}
                </span>
                <span className="text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {texts.highActivity}
                </span>
              </div>
            </div>
          </Link>
        )}
        
        {/* Header */}
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h1 className="text-lg font-bold text-white">{texts.liveAuctions}</h1>
            </div>
            {/* Live Connection Status */}
            <div className="flex items-center gap-2 text-xs">
              {isConnected ? (
                <span className="flex items-center gap-1 text-green-400">
                  <Wifi className="w-3 h-3" /> Live
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-500">
                  <WifiOff className="w-3 h-3" /> Polling
                </span>
              )}
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">
            {activeCount} {texts.activeCount} • {texts.saveUpTo}
          </p>
        </div>

        {/* Filters - Compact */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[120px] max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder={texts.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 rounded bg-[#1a3a52] border border-gray-700 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              data-testid="search-input"
            />
          </div>

          {/* Status Buttons */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setStatusFilter('active')}
              data-testid="filter-active"
              className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                statusFilter === 'active' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-400'
              }`}
            >
              {texts.live} ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('beginner')}
              data-testid="filter-beginner"
              className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                statusFilter === 'beginner' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-400'
              }`}
            >
              🎓 {texts.beginner || 'Anfänger'} ({beginnerCount})
            </button>
            <button
              onClick={() => setStatusFilter('free')}
              data-testid="filter-free"
              className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                statusFilter === 'free' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-[#1a3a52] text-gray-400'
              }`}
            >
              🎁 Gratis ({freeCount})
            </button>
            <button
              onClick={() => setStatusFilter('vip')}
              data-testid="filter-vip"
              className={`px-2 py-1.5 rounded text-[10px] font-medium ${
                statusFilter === 'vip' 
                  ? 'bg-yellow-500 text-black' 
                  : 'bg-[#1a3a52] text-gray-400'
              }`}
            >
              ⭐ VIP ({vipCount})
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
              {texts.end} ({endedCount})
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
            {sorted.length} {texts.auctionsFound}
            {reminders.length > 0 && (
              <span className="ml-2 text-yellow-400">
                <Bell className="w-3 h-3 inline" /> {reminders.length} {texts.reminders}
              </span>
            )}
            {serverTimeOffset !== 0 && (
              <span className="ml-2 text-orange-400" title={texts.timeSync}>
                ⚠️ {texts.timeSync}
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
              texts={texts}
            />
          ))}
        </div>

        {/* Empty State */}
        {sorted.length === 0 && (
          <div className="text-center py-12 bg-[#1a3a52] rounded-xl">
            <Search className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
            <p className="text-white text-sm font-medium">{texts.noAuctions}</p>
            <p className="text-gray-400 text-xs mt-1">{texts.tryOther}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-[9px] text-gray-600">
          * {texts.pricesNote}
        </div>
      </div>
    </div>
  );
}
