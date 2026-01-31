import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Crown, Lock, Zap, Clock, TrendingUp, Star, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Timer Component with Pause support
const AuctionTimer = ({ endTime, isPaused = false }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  
  useEffect(() => {
    // Don't count down if paused
    if (isPaused) {
      const end = new Date(endTime);
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      
      if (diff > 0) {
        setTimeLeft({
          h: Math.floor(diff / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000)
        });
      }
      return; // Don't set interval when paused
    }
    
    const calc = () => {
      const end = new Date(endTime);
      const now = new Date();
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
  }, [endTime, isPaused]);
  
  const pad = (n) => String(n).padStart(2, '0');
  
  // Show PAUSIERT when outside business hours
  if (isPaused) {
    return (
      <div className="flex items-center gap-1 font-bold text-orange-400">
        <span className="bg-orange-500/20 px-3 py-1 rounded text-sm animate-pulse">⏸ PAUSIERT</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 font-mono text-lg font-bold text-yellow-400">
      <span className="bg-black/50 px-2 py-1 rounded">{pad(timeLeft.h)}</span>
      <span>:</span>
      <span className="bg-black/50 px-2 py-1 rounded">{pad(timeLeft.m)}</span>
      <span>:</span>
      <span className="bg-black/50 px-2 py-1 rounded">{pad(timeLeft.s)}</span>
    </div>
  );
};

export default function VIPAuctions() {
  const { t } = useLanguage();
  const { user, token, isVip: authIsVip, isInfluencer } = useAuth();
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [businessHours, setBusinessHours] = useState({ is_open: true });

  const fetchVIPAuctions = useCallback(async () => {
    try {
      const [auctionsRes, businessHoursRes, userRes] = await Promise.all([
        axios.get(`${API}/auctions/vip-only`).catch(() => ({ data: [] })),
        axios.get(`${API}/auctions/business-hours`).catch(() => ({ data: { is_open: true } })),
        token ? axios.get(`${API}/vip/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { is_vip: false } })) : Promise.resolve({ data: { is_vip: false } })
      ]);
      
      setAuctions(auctionsRes.data || []);
      setBusinessHours(businessHoursRes.data || { is_open: true });
      // Use VIP status from API or from AuthContext (for influencers)
      setIsVip(userRes.data?.is_vip || userRes.data?.vip_status === 'active' || authIsVip || isInfluencer);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [token, authIsVip, isInfluencer]);

  useEffect(() => {
    fetchVIPAuctions();
    // Auto-refresh every 10 seconds for real-time updates
    const interval = setInterval(fetchVIPAuctions, 10000);
    return () => clearInterval(interval);
  }, [fetchVIPAuctions]);

  // WebSocket for real-time price updates
  useEffect(() => {
    const wsUrl = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
    if (!wsUrl) return;
    
    const ws = new WebSocket(`${wsUrl}/api/ws/auctions`);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'bid_update' && msg.data) {
          setAuctions(prev => prev.map(a => 
            a.id === msg.auction_id 
              ? { 
                  ...a, 
                  current_price: msg.data.current_price ?? a.current_price,
                  end_time: msg.data.end_time ?? a.end_time,
                  last_bidder_name: msg.data.last_bidder_name ?? a.last_bidder_name,
                  total_bids: msg.data.total_bids ?? a.total_bids
                }
              : a
          ));
        }
      } catch (e) {}
    };
    
    return () => ws.close();
  }, []);

  const handleBid = async (auctionId) => {
    if (!token) {
      toast.error('Bitte melden Sie sich an');
      navigate('/login');
      return;
    }
    
    if (!isVip) {
      toast.error('Diese Auktion ist nur für VIP-Mitglieder');
      return;
    }
    
    try {
      await axios.post(`${API}/auctions/${auctionId}/bid`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Gebot platziert!');
      fetchVIPAuctions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0d2538] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a2e] via-[#0d1929] to-[#0a1929] pt-16 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Business Hours Notice */}
        {!businessHours.is_open && (
          <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-xl p-4 mb-4 mt-2">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-orange-400" />
              <div>
                <p className="text-white font-semibold">Auktionen pausiert</p>
                <p className="text-gray-300 text-sm">
                  Unsere Auktionen laufen täglich von {businessHours.business_start || '09:00'} bis {businessHours.business_end || '24:00'} Uhr.
                  {businessHours.next_opening && (
                    <span className="text-orange-400 font-medium"> Nächste Öffnung: {new Date(businessHours.next_opening).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* VIP Header */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-6 py-2 rounded-full mb-4">
            <Crown className="w-6 h-6 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-lg">VIP BEREICH</span>
            <Crown className="w-6 h-6 text-yellow-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Exklusive VIP-Auktionen
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Premium-Produkte mit weniger Konkurrenz - nur für unsere VIP-Mitglieder
          </p>
        </div>

        {/* VIP Status Banner */}
        {!isVip && (
          <div className="bg-gradient-to-r from-purple-900/50 to-orange-900/50 border border-yellow-500/30 rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Lock className="w-10 h-10 text-black" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Werden Sie VIP-Mitglied!
                </h2>
                <p className="text-gray-300 mb-4">
                  Erhalten Sie Zugang zu exklusiven Auktionen, monatliche Bonus-Gebote und weniger Konkurrenz bei Premium-Produkten.
                </p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Exklusive Auktionen</span>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Zap className="w-4 h-4" />
                    <span>Monatliche Bonus-Gebote</span>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Star className="w-4 h-4" />
                    <span>Weniger Konkurrenz</span>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <Link to="/vip">
                  <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold py-3 px-8 text-lg">
                    VIP werden
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* VIP Auctions Grid */}
        {auctions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {auctions.map((auction) => (
              <div 
                key={auction.id}
                className={`relative bg-gradient-to-b from-[#1a2a42] to-[#0d1829] rounded-xl overflow-hidden border-2 ${
                  isVip ? 'border-yellow-500/50' : 'border-gray-700/50'
                } transition-all hover:border-yellow-500 hover:shadow-lg hover:shadow-yellow-500/10`}
              >
                {/* Prominent VIP Badge - Top Left Corner */}
                <div className="absolute top-0 left-0 z-20">
                  <div className="bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 px-4 py-2 rounded-br-xl shadow-lg">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-5 h-5 text-black" />
                      <span className="text-black font-black text-lg tracking-wide">VIP</span>
                    </div>
                  </div>
                </div>
                
                {/* Discount Badge */}
                <div className="absolute top-2 right-2 z-10">
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    -{Math.round((1 - (auction.current_price / (auction.product?.retail_price || 100))) * 100)}%
                  </span>
                </div>
                
                {/* Product Image - visible for all, slight blur for non-VIP */}
                <Link to={isVip ? `/auctions/${auction.id}` : '#'} onClick={(e) => !isVip && e.preventDefault()}>
                  <div className="relative h-40 bg-white/5 mt-6">
                    <img 
                      src={auction.product?.image_url || '/placeholder.png'}
                      alt={auction.product?.name}
                      className={`w-full h-full object-contain p-4 ${!isVip ? 'opacity-70' : ''}`}
                    />
                    {/* Lock icon for non-VIP */}
                    {!isVip && (
                      <div className="absolute bottom-2 right-2">
                        <Lock className="w-5 h-5 text-yellow-400 drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                </Link>
                
                {/* Product Info - always visible */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                    {auction.product?.name}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-gray-400 text-xs">Aktueller Preis</p>
                      <p className="text-xl font-bold text-cyan-400">€{auction.current_price?.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">UVP</p>
                      <p className="text-gray-500 line-through text-sm">€{auction.product?.retail_price?.toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {/* Timer */}
                  <div className="flex items-center justify-center bg-black/30 rounded-lg py-2 mb-3">
                    <Clock className="w-4 h-4 text-gray-400 mr-2" />
                    <AuctionTimer endTime={auction.end_time} isPaused={!businessHours.is_open} />
                  </div>
                  
                  {/* Bid Button */}
                  <Button 
                    onClick={() => handleBid(auction.id)}
                    disabled={!isVip || !businessHours.is_open}
                    className={`w-full ${
                      !businessHours.is_open
                        ? 'bg-orange-600/50 text-orange-200 cursor-not-allowed'
                        : isVip 
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black' 
                          : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    } font-bold`}
                  >
                    {!businessHours.is_open ? (
                      <>⏸ PAUSIERT</>
                    ) : isVip ? (
                      <>
                        <Zap className="w-4 h-4 mr-1" />
                        BIETEN
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-1" />
                        VIP ERFORDERLICH
                      </>
                    )}
                  </Button>
                  
                  {/* Activity Info */}
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span>{auction.total_bids || 0} Gebote</span>
                    {auction.last_bidder_name && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        {auction.last_bidder_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Crown className="w-16 h-16 text-yellow-500/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Keine VIP-Auktionen verfügbar</h3>
            <p className="text-gray-400 mb-6">Schauen Sie später wieder vorbei für exklusive VIP-Angebote!</p>
            <Link to="/auctions">
              <Button variant="outline" className="border-yellow-500 text-yellow-500">
                Zu den regulären Auktionen
              </Button>
            </Link>
          </div>
        )}
        
        {/* VIP Benefits Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-900/30 to-transparent border border-purple-500/20 rounded-xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Crown className="w-7 h-7 text-purple-400" />
            </div>
            <h3 className="text-white font-bold mb-2">Exklusiver Zugang</h3>
            <p className="text-gray-400 text-sm">Bieten Sie auf Auktionen, die nur VIP-Mitgliedern vorbehalten sind</p>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-900/30 to-transparent border border-yellow-500/20 rounded-xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Zap className="w-7 h-7 text-yellow-400" />
            </div>
            <h3 className="text-white font-bold mb-2">Monatliche Bonus-Gebote</h3>
            <p className="text-gray-400 text-sm">Erhalten Sie jeden Monat kostenlose Gebote als VIP-Mitglied</p>
          </div>
          
          <div className="bg-gradient-to-br from-cyan-900/30 to-transparent border border-cyan-500/20 rounded-xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Star className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-white font-bold mb-2">Weniger Konkurrenz</h3>
            <p className="text-gray-400 text-sm">Höhere Gewinnchancen durch kleinere Bietergruppen</p>
          </div>
        </div>
      </div>
    </div>
  );
}
