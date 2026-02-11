import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getMappedLanguage } from '../i18n/translations';
import { Clock, Crown, Trophy, TrendingUp, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import GlobalJackpot from '../components/GlobalJackpot';
import { HappyHourBanner, LuckyBidCounter, ExcitementStatusBar } from '../components/ExcitementFeatures';
import LeaderboardWidget from '../components/LeaderboardWidget';
import LiveWinnerTicker from '../components/LiveWinnerTicker';
import VIPBenefitsBanner from '../components/VIPBenefitsBanner';
import DailyLoginStreak from '../components/DailyLoginStreak';
import ShareAndWin from '../components/ShareAndWin';
import WinnerGalleryHome from '../components/WinnerGalleryHome';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Activity Index - Snipster Style with colored squares (always 30-60%)
const ActivityIndex = memo(({ auctionId = '', language = 'de' }) => {
  // Calculate filled squares (3-6 out of 10) based on auction ID
  const hash = auctionId ? auctionId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 50;
  const filledCount = 3 + (hash % 4); // 3, 4, 5, or 6 filled (30-60%)
  
  // Activity index label translations
  const activityLabel = {
    de: 'Aktivitätsindex:',
    en: 'Activity Index:',
    sq: 'Indeksi i Aktivitetit:',
    tr: 'Aktivite Endeksi:',
    fr: "Indice d'Activité:"
  };
  
  // Colors for each square position
  const getColor = (index, filled) => {
    if (!filled) return '#4B5563'; // gray for unfilled
    if (index < 3) return '#22C55E'; // green
    if (index < 5) return '#84CC16'; // light green
    if (index < 7) return '#EAB308'; // yellow
    if (index < 9) return '#F97316'; // orange
    return '#EF4444'; // red
  };
  
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-400">{activityLabel[language] || activityLabel.de}</span>
        <div className="flex gap-0.5">
          {[...Array(10)].map((_, i) => (
            <div 
              key={i}
              className="w-2 h-3 rounded-sm"
              style={{ backgroundColor: getColor(i, i < filledCount) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// Home page translations
const homeTexts = {
  de: { 
    ended: 'Beendet', hrs: 'STD.', min: 'MIN.', sec: 'SEK.', startPrice: 'Startpreis', 
    beFirst: 'Sei der Erste!', bid: 'BIETEN', comparePrice: 'Vergleichspreis*', 
    lastSold: 'Zuletzt versteigert für nur', liveAuctions: 'Live Auktionen', 
    loading: 'Auktionen werden geladen...', noAuctions: 'Derzeit keine aktiven Auktionen', 
    pleaseTryLater: 'Bitte schauen Sie später wieder vorbei',
    pleaseLogin: 'Bitte anmelden um zu bieten', bidPlaced: 'Gebot platziert!', bidError: 'Fehler beim Bieten'
  },
  en: { 
    ended: 'Ended', hrs: 'HRS', min: 'MIN', sec: 'SEC', startPrice: 'Start Price', 
    beFirst: 'Be the first!', bid: 'BID', comparePrice: 'Compare at*', 
    lastSold: 'Last sold for only', liveAuctions: 'Live Auctions', 
    loading: 'Loading auctions...', noAuctions: 'No active auctions currently', 
    pleaseTryLater: 'Please check back later',
    pleaseLogin: 'Please log in to bid', bidPlaced: 'Bid placed!', bidError: 'Error placing bid'
  },
  sq: { 
    ended: 'Përfundoi', hrs: 'ORË', min: 'MIN', sec: 'SEK', startPrice: 'Çmimi Fillestar', 
    beFirst: 'Bëhu i pari!', bid: 'OFERTOHU', comparePrice: 'Krahasoni me*', 
    lastSold: 'Shitur për vetëm', liveAuctions: 'Ankande Live', 
    loading: 'Duke ngarkuar ankandet...', noAuctions: 'Asnjë ankand aktiv aktualisht', 
    pleaseTryLater: 'Ju lutem kontrolloni më vonë',
    pleaseLogin: 'Ju lutem hyni për të ofruar', bidPlaced: 'Oferta u vendos!', bidError: 'Gabim në vendosjen e ofertës'
  },
  tr: { 
    ended: 'Bitti', hrs: 'SAAT', min: 'DAK', sec: 'SN', startPrice: 'Başlangıç Fiyatı', 
    beFirst: 'İlk sen ol!', bid: 'TEKLİF VER', comparePrice: 'Karşılaştırma*', 
    lastSold: 'Son satış sadece', liveAuctions: 'Canlı Açık Artırmalar', 
    loading: 'Açık artırmalar yükleniyor...', noAuctions: 'Şu anda aktif açık artırma yok', 
    pleaseTryLater: 'Lütfen daha sonra tekrar kontrol edin',
    pleaseLogin: 'Teklif vermek için giriş yapın', bidPlaced: 'Teklif verildi!', bidError: 'Teklif verme hatası'
  },
  fr: { 
    ended: 'Terminé', hrs: 'H', min: 'MIN', sec: 'SEC', startPrice: 'Prix de départ', 
    beFirst: 'Soyez le premier!', bid: 'ENCHÉRIR', comparePrice: 'Comparez à*', 
    lastSold: 'Vendu dernièrement pour seulement', liveAuctions: 'Enchères en Direct', 
    loading: 'Chargement des enchères...', noAuctions: 'Pas d\'enchères actives actuellement', 
    pleaseTryLater: 'Veuillez revenir plus tard',
    pleaseLogin: 'Veuillez vous connecter pour enchérir', bidPlaced: 'Enchère placée!', bidError: 'Erreur lors de l\'enchère'
  },
  es: { 
    ended: 'Terminado', hrs: 'HRS', min: 'MIN', sec: 'SEG', startPrice: 'Precio inicial', 
    beFirst: '¡Sé el primero!', bid: 'PUJAR', comparePrice: 'Comparar con*', 
    lastSold: 'Último vendido por solo', liveAuctions: 'Subastas en Vivo', 
    loading: 'Cargando subastas...', noAuctions: 'No hay subastas activas actualmente', 
    pleaseTryLater: 'Por favor vuelve más tarde',
    pleaseLogin: 'Por favor inicia sesión para pujar', bidPlaced: '¡Puja realizada!', bidError: 'Error al pujar'
  }
};

// Live Timer - Shows DD:HH:MM:SS for long auctions
const LiveTimer = memo(({ endTime, onExpired, language = 'de' }) => {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0, expired: false });
  const expiredCalled = useRef(false);
  const ht = homeTexts[language] || homeTexts.de;
  
  // Day labels per language
  const dayLabels = {
    de: 'T', en: 'D', sq: 'D', tr: 'G', fr: 'J', es: 'D'
  };
  const dayLabel = dayLabels[langKey] || 'T';
  
  useEffect(() => {
    if (!endTime) return;
    expiredCalled.current = false;
    
    const calc = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = Math.max(0, end - now);
      
      if (diff <= 0) {
        setTime({ d: 0, h: 0, m: 0, s: 0, expired: true });
        if (!expiredCalled.current && onExpired) {
          expiredCalled.current = true;
          setTimeout(onExpired, 3000);
        }
        return;
      }
      
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        expired: false
      });
    };
    
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endTime, onExpired]);
  
  const pad = (n) => String(n).padStart(2, '0');
  
  if (time.expired) {
    return (
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-full px-4 py-2">
        <span className="text-white text-sm font-bold">{ht.ended}</span>
      </div>
    );
  }
  
  const urgent = time.d === 0 && time.h === 0 && time.m === 0 && time.s < 30;
  const isLong = time.d > 0 || time.h > 0;
  
  return (
    <div className={`rounded-full px-4 py-2 ${
      urgent ? 'bg-gradient-to-r from-red-600 to-red-700' : 
      isLong ? 'bg-gradient-to-r from-green-600 to-green-700' :
      'bg-gradient-to-r from-gray-800 to-gray-900'
    }`}>
      <div className="flex items-center gap-1 text-white">
        {time.d > 0 && (
          <>
            <span className="font-mono text-lg font-bold">{time.d}</span>
            <span className="text-xs text-gray-300">{dayLabel}</span>
          </>
        )}
        <span className="font-mono text-lg font-bold">{pad(time.h)}</span>
        <span className="text-xs text-gray-400">{ht.hrs}</span>
        <span className="font-mono text-lg font-bold">{pad(time.m)}</span>
        <span className="text-xs text-gray-400">{ht.min}</span>
        <span className={`font-mono text-lg font-bold ${urgent ? 'text-yellow-300' : ''}`}>{pad(time.s)}</span>
        <span className="text-xs text-gray-400">{ht.sec}</span>
      </div>
    </div>
  );
});

// Live Price Display - Only updates price and bidder
const LivePrice = memo(({ price, bidderName, language = 'de' }) => {
  const ht = homeTexts[language] || homeTexts.de;
  return (
    <div className="text-center my-4">
      <p className="text-4xl font-black text-gray-800">
        € {price?.toFixed(2).replace('.', ',')}
      </p>
      <p className="text-cyan-600 text-sm mt-1">
        {bidderName || ht.startPrice}
      </p>
    </div>
  );
});

// Premium Featured Auction - Snipster Style
const PremiumAuction = memo(({ auction, product, onBid, onRefresh, language = 'de' }) => {
  const navigate = useNavigate();
  const ht = homeTexts[language] || homeTexts.de;
  
  if (!auction || !product) return null;
  
  // Get translated product name
  const productName = product.name_translations?.[langKey] || product.name;
  
  return (
    <div 
      className="rounded-2xl overflow-hidden cursor-pointer mb-6"
      onClick={() => navigate(`/auctions/${auction.id}`)}
      style={{
        background: 'linear-gradient(180deg, #87CEEB 0%, #5BA3C6 100%)'
      }}
    >
      <div className="p-6">
        {/* Timer */}
        <div className="flex justify-center mb-4">
          <LiveTimer endTime={auction.end_time} onExpired={onRefresh} language={language} />
        </div>
        
        {/* Price and Bidder */}
        <div className="text-center mb-4">
          <p className="text-5xl font-black text-gray-800">
            € {auction.current_price?.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-cyan-700 text-lg mt-2">
            {auction.last_bidder_name || ht.beFirst}
          </p>
        </div>
        
        {/* Bid Button */}
        <div className="flex justify-center mb-4">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onBid(auction.id);
            }}
            className="px-16 py-3 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-white font-bold text-xl rounded-full shadow-lg transition-all transform hover:scale-105"
          >
            {ht.bid}
          </button>
        </div>
        
        {/* Activity Index */}
        <div className="flex justify-center">
          <ActivityIndex auctionId={auction.id} language={language} />
        </div>
      </div>
      
      {/* Product Info Section */}
      <div className="bg-white/90 p-4">
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
            <img 
              src={product.image_url || 'https://via.placeholder.com/96'}
              alt={productName}
              className="max-w-full max-h-full object-contain p-2"
            />
          </div>
          
          {/* Product Details */}
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800 leading-tight mb-1">
              {productName?.toUpperCase()}
            </h2>
            <p className="text-gray-600 text-sm">
              {ht.comparePrice}: € {product.retail_price?.toLocaleString(language === 'de' ? 'de-DE' : 'en-US')},-
            </p>
          </div>
        </div>
      </div>
      
      {/* Last Sold Footer */}
      <div className="bg-cyan-600 px-4 py-2 text-center">
        <p className="text-white text-sm">
          {ht.lastSold} <span className="font-bold">€ {(product.retail_price * 0.025).toFixed(2).replace('.', ',')}</span>
        </p>
      </div>
    </div>
  );
});

// Small Auction Card - Snipster Style
const AuctionCard = memo(({ auction, product, onBid, onRefresh, language = 'de', isAuthenticated = false, isVip = false }) => {
  const navigate = useNavigate();
  const ht = homeTexts[language] || homeTexts.de;
  
  if (!auction || !product) return null;
  
  // Get translated product name
  const productName = product.name_translations?.[langKey] || product.name;
  
  // Check if this is a VIP-only auction
  const isVipAuction = auction.is_vip_only;
  
  // Determine if user can bid
  const canBid = isAuthenticated && (!isVipAuction || isVip);
  
  // Button text based on auth/VIP status
  const getButtonConfig = () => {
    const btnTexts = {
      de: { login: '🔒 Anmelden', getVip: '⭐ VIP werden' },
      en: { login: '🔒 Login', getVip: '⭐ Become VIP' },
      sq: { login: '🔒 Hyr', getVip: '⭐ Bëhu VIP' },
      xk: { login: '🔒 Hyr', getVip: '⭐ Bëhu VIP' },
      tr: { login: '🔒 Giriş', getVip: '⭐ VIP Ol' },
      fr: { login: '🔒 Connexion', getVip: '⭐ Devenir VIP' }
    };
    const btnT = btnTexts[language] || btnTexts.de;
    
    if (!isAuthenticated) {
      return {
        text: btnT.login,
        action: () => navigate('/login'),
        style: 'bg-gray-400 hover:bg-gray-500'
      };
    }
    if (isVipAuction && !isVip) {
      return {
        text: btnT.getVip,
        action: () => navigate('/vip'),
        style: 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400'
      };
    }
    return {
      text: ht.bid,
      action: () => onBid(auction.id),
      style: 'bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400'
    };
  };
  
  const buttonConfig = getButtonConfig();
  
  return (
    <div 
      onClick={() => navigate(`/auctions/${auction.id}`)}
      className="rounded-xl overflow-hidden cursor-pointer hover:shadow-2xl transition-all relative"
      style={{
        background: isVipAuction 
          ? 'linear-gradient(180deg, #B8860B 0%, #8B6914 100%)'
          : 'linear-gradient(180deg, #4A7C9B 0%, #2D5A7B 100%)'
      }}
    >
      {/* VIP Badge */}
      {isVipAuction && (
        <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-yellow-400 to-amber-500 px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
          <Crown className="w-3 h-3 text-black" />
          <span className="text-black font-bold text-xs">VIP</span>
        </div>
      )}
      
      {/* Header with Timer */}
      <div className="p-3 flex justify-end">
        <LiveTimer endTime={auction.end_time} onExpired={onRefresh} language={language} />
      </div>
      
      {/* Content */}
      <div className="bg-white/95 p-4">
        <div className="flex gap-3">
          {/* Left: Product Info */}
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-800 leading-tight mb-2 line-clamp-2">
              {productName?.toUpperCase()}
            </h3>
            <p className="text-gray-500 text-xs mb-3">
              {ht.comparePrice}: € {product.retail_price?.toLocaleString(language === 'de' ? 'de-DE' : 'en-US')},-
            </p>
            
            {/* Price */}
            <p className="text-2xl font-black text-gray-800">
              € {auction.current_price?.toFixed(2).replace('.', ',')}
            </p>
            <p className="text-cyan-600 text-xs">
              {auction.last_bidder_name || ht.startPrice}
            </p>
            
            {/* Bid Button - Dynamic based on auth/VIP status */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                buttonConfig.action();
              }}
              className={`mt-3 w-full py-2 ${buttonConfig.style} text-white font-bold text-sm rounded-full transition-all`}
            >
              {buttonConfig.text}
            </button>
          </div>
          
          {/* Right: Product Image */}
          <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
            <img 
              src={product.image_url || 'https://via.placeholder.com/80'}
              alt=""
              className="max-w-full max-h-full object-contain p-1"
            />
          </div>
        </div>
        
        {/* Activity Index */}
        <ActivityIndex auctionId={auction.id} language={language} />
      </div>
      
      {/* Last Sold Footer */}
      <div className={`${isVipAuction ? 'bg-amber-600' : 'bg-cyan-600'} px-3 py-2 text-center`}>
        <p className="text-white text-xs">
          {ht.lastSold} <span className="font-bold">€ {(product.retail_price * 0.025).toFixed(2).replace('.', ',')}</span>
        </p>
      </div>
    </div>
  );
});

// Stats Bar
const StatsBar = memo(({ totalBids, activeUsers, activeAuctions, language = 'de' }) => {
  const statsTexts = {
    de: { liveAuctions: 'Live Auktionen', activeBidders: 'Aktive Bieter', bidsToday: 'Gebote heute' },
    en: { liveAuctions: 'Live Auctions', activeBidders: 'Active Bidders', bidsToday: 'Bids Today' },
    sq: { liveAuctions: 'Ankande Live', activeBidders: 'Ofertues Aktiv', bidsToday: 'Oferta Sot' },
    tr: { liveAuctions: 'Canlı Açık Artırmalar', activeBidders: 'Aktif Teklifçiler', bidsToday: 'Bugünkü Teklifler' },
    fr: { liveAuctions: 'Enchères en Direct', activeBidders: 'Enchérisseurs Actifs', bidsToday: 'Enchères Aujourd\'hui' }
  };
  const st = statsTexts[language] || statsTexts.de;
  
  return (
    <div className="bg-gradient-to-r from-[#2D5A7B] to-[#4A7C9B] rounded-xl p-4 mb-6">
      <div className="flex justify-around text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-yellow-300 mb-1">
            <Zap className="w-4 h-4" />
            <span className="font-bold text-xl">{activeAuctions}</span>
          </div>
          <p className="text-white/80 text-xs">{st.liveAuctions}</p>
        </div>
        <div className="border-l border-white/20" />
        <div>
          <div className="flex items-center justify-center gap-1 text-cyan-300 mb-1">
            <Users className="w-4 h-4" />
            <span className="font-bold text-xl">{activeUsers}</span>
          </div>
          <p className="text-white/80 text-xs">{st.activeBidders}</p>
        </div>
        <div className="border-l border-white/20" />
        <div>
          <div className="flex items-center justify-center gap-1 text-green-300 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="font-bold text-xl">{totalBids}</span>
          </div>
          <p className="text-white/80 text-xs">{st.bidsToday}</p>
        </div>
      </div>
    </div>
  );
});

export default function Home() {
  const { isAuthenticated, token, updateBidsBalance, isVip, user } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const navigate = useNavigate();
  
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBids: 0, activeUsers: 0 });
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const [auctionsRes, productsRes] = await Promise.all([
        axios.get(`${API}/auctions?status=active`),
        axios.get(`${API}/products`)
      ]);
      
      const prodMap = {};
      productsRes.data.forEach(p => { prodMap[p.id] = p; });
      setProducts(prodMap);
      setAuctions(auctionsRes.data.filter(a => a.status === 'active'));
      
      const totalBids = auctionsRes.data.reduce((sum, a) => sum + (a.total_bids || 0), 0);
      const uniqueBidders = new Set(auctionsRes.data.map(a => a.last_bidder_id).filter(Boolean)).size;
      setStats({ totalBids, activeUsers: uniqueBidders + 15 });
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // WebSocket for real-time updates - ONLY updates numbers, not whole cards
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
      if (!wsUrl) return;
      
      const ws = new WebSocket(`${wsUrl}/api/ws/auctions`);
      wsRef.current = ws;
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'bid_update' && message.data) {
            // ONLY update the specific auction's numbers - not the whole card
            setAuctions(prev => prev.map(a => 
              a.id === message.auction_id
                ? { 
                    ...a, 
                    current_price: message.data.current_price,
                    total_bids: message.data.total_bids,
                    last_bidder_name: message.data.last_bidder_name,
                    end_time: message.data.end_time || a.end_time
                  }
                : a
            ));
            
            setStats(prev => ({
              ...prev,
              totalBids: prev.totalBids + 1
            }));
          }
          
          if (message.type === 'auction_restarted' && message.data) {
            setAuctions(prev => prev.map(a => 
              a.id === message.auction_id
                ? { ...a, ...message.data }
                : a
            ));
          }
          
          if (message.type === 'auction_ended') {
            setAuctions(prev => prev.filter(a => a.id !== message.auction_id));
          }
          
        } catch (error) {
          console.error('WebSocket error:', error);
        }
      };
      
      ws.onclose = () => {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };
      
      ws.onerror = () => ws.close();
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Get translations with language mapping (xk -> sq)
  const mappedLang = getMappedLanguage(language);
  const ht = homeTexts[mappedLang] || homeTexts[langKey] || homeTexts.de;
  
  // Handle bid
  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error(ht.pleaseLogin);
      navigate('/login');
      return;
    }
    
    try {
      const res = await axios.post(
        `${API}/auctions/place-bid/${auctionId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(ht.bidPlaced);
      if (res.data.bids_remaining !== undefined) {
        updateBidsBalance(res.data.bids_remaining);
      }
    } catch (error) {
      // Check if it's an authentication error
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error(ht.pleaseLogin);
        navigate('/login');
        return;
      }
      toast.error(error.response?.data?.detail || ht.bidError);
    }
  };
  
  // Get premium auction (VIP or highest retail price)
  const premiumAuction = auctions.find(a => a.is_vip_only) || 
    auctions.reduce((max, a) => {
      const price = products[a.product_id]?.retail_price || 0;
      const maxPrice = products[max?.product_id]?.retail_price || 0;
      return price > maxPrice ? a : max;
    }, auctions[0]);
  
  // ALL other auctions (no limit - show everything on one page)
  const otherAuctions = auctions.filter(a => a.id !== premiumAuction?.id);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#87CEEB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-600 border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #5BA3C6 100%)' }} data-testid="home-page">
      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* Live Winner Ticker - Social Proof */}
        <LiveWinnerTicker />
        
        {/* Daily Login Streak - Gamification */}
        {isAuthenticated && <DailyLoginStreak />}
        
        {/* VIP Benefits Banner - Only for non-VIP users */}
        {!isVip && <VIPBenefitsBanner isVIP={isVip} />}
        
        {/* Share & Win Feature */}
        {isAuthenticated && <ShareAndWin />}
        
        {/* Global Jackpot - Prominent Position */}
        <GlobalJackpot className="mb-6" />
        
        {/* Excitement Status Bar */}
        <ExcitementStatusBar className="mb-4" />
        
        {/* Stats Bar */}
        <StatsBar 
          totalBids={stats.totalBids}
          activeUsers={stats.activeUsers}
          activeAuctions={auctions.length}
          language={mappedLang}
        />
        
        {/* Premium Auction */}
        {premiumAuction && products[premiumAuction.product_id] && (
          <PremiumAuction 
            auction={premiumAuction}
            product={products[premiumAuction.product_id]}
            onBid={handleBid}
            onRefresh={fetchData}
            language={mappedLang}
          />
        )}
        
        {/* Winner Gallery & Testimonials */}
        <WinnerGalleryHome />
        
        {/* Leaderboard Widget - NEW */}
        <LeaderboardWidget 
          className="mb-6" 
          language={mappedLang}
        />
        
        {/* Live Auctions Section - ALL auctions on one page */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              {ht.liveAuctions} ({otherAuctions.length})
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherAuctions.map(auction => (
              <AuctionCard 
                key={auction.id}
                auction={auction}
                product={products[auction.product_id]}
                onBid={handleBid}
                onRefresh={fetchData}
                language={mappedLang}
                isAuthenticated={isAuthenticated}
                isVip={isVip}
              />
            ))}
          </div>
        </div>
        
        {/* Footer Note */}
        <p className="text-center text-xs text-gray-600 mt-8">
          * {mappedLang === 'en' ? 'Compare price is the manufacturer\'s suggested retail price' : 
             mappedLang === 'sq' ? 'Çmimi krahasues është çmimi i rekomanduar nga prodhuesi' :
             mappedLang === 'tr' ? 'Karşılaştırma fiyatı üreticinin önerdiği perakende fiyatıdır' :
             mappedLang === 'fr' ? 'Le prix comparé correspond au prix de vente conseillé par le fabricant' :
             'Vergleichspreis entspricht der unverbindlichen Preisempfehlung des Herstellers'}
        </p>
      </div>
    </div>
  );
}
