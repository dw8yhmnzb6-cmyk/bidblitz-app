import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { 
  Clock, Zap, AlertTriangle, TrendingUp, Flame,
  ChevronRight, Users, Trophy
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LastChancePage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [endingSoon, setEndingSoon] = useState({});
  const [hotAuctions, setHotAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const texts = {
    de: {
      title: 'Letzte Chance',
      subtitle: 'Auktionen die JETZT enden - schnell sein!',
      under1Min: 'Unter 1 Minute',
      under5Min: 'Unter 5 Minuten',
      under15Min: 'Unter 15 Minuten',
      under1Hour: 'Unter 1 Stunde',
      bidNow: 'JETZT BIETEN',
      noAuctions: 'Keine Auktionen in dieser Kategorie',
      hotAuctions: 'Heiße Auktionen',
      hotDesc: 'Viele Gebote in den letzten Minuten',
      bids: 'Gebote',
      recentBids: 'Gebote in 5 Min',
      currentPrice: 'Aktuell',
      endsIn: 'Endet in',
      seconds: 's',
      minutes: 'm',
      fire: 'HEISS',
      warm: 'Aktiv'
    },
    en: {
      title: 'Last Chance',
      subtitle: 'Auctions ending NOW - be quick!',
      under1Min: 'Under 1 Minute',
      under5Min: 'Under 5 Minutes',
      under15Min: 'Under 15 Minutes',
      under1Hour: 'Under 1 Hour',
      bidNow: 'BID NOW',
      noAuctions: 'No auctions in this category',
      hotAuctions: 'Hot Auctions',
      hotDesc: 'Lots of bids in the last minutes',
      bids: 'bids',
      recentBids: 'bids in 5 min',
      currentPrice: 'Current',
      endsIn: 'Ends in',
      seconds: 's',
      minutes: 'm',
      fire: 'HOT',
      warm: 'Active'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setNow(Date.now());
      fetchData();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [endingRes, hotRes] = await Promise.all([
        axios.get(`${API}/api/last-chance/ending-soon`),
        axios.get(`${API}/api/last-chance/hot`)
      ]);
      setEndingSoon(endingRes.data.brackets || {});
      setHotAuctions(hotRes.data.hot_auctions || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}${t.seconds}`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}${t.minutes} ${secs}${t.seconds}`;
  };

  const AuctionCard = ({ auction, urgency }) => {
    const remaining = Math.max(0, auction.remaining_seconds - Math.floor((Date.now() - now) / 1000));
    
    const urgencyColors = {
      critical: 'from-red-600 to-red-800 animate-pulse',
      high: 'from-orange-500 to-red-600',
      medium: 'from-yellow-500 to-orange-500',
      low: 'from-green-500 to-yellow-500'
    };
    
    return (
      <Link to={`/auctions/${auction.id}`} className="block">
        <div className={`glass-card rounded-xl p-4 border-2 transition-all hover:scale-102 ${
          urgency === 'critical' ? 'border-red-500 animate-pulse' : 
          urgency === 'high' ? 'border-orange-500' : 'border-yellow-500/50'
        }`}>
          <div className="flex items-center gap-4">
            {/* Product Image */}
            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
              {auction.product?.image_url ? (
                <img 
                  src={auction.product.image_url} 
                  alt={auction.product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-gray-500" />
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-grow min-w-0">
              <h4 className="text-white font-bold truncate">{auction.product?.name}</h4>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-green-400 font-bold">
                  €{(auction.current_price || 0).toFixed(2)}
                </span>
                <span className="text-gray-400 text-sm flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {auction.bid_count || 0} {t.bids}
                </span>
              </div>
            </div>
            
            {/* Timer & CTA */}
            <div className="text-right flex-shrink-0">
              <div className={`px-3 py-2 rounded-lg bg-gradient-to-r ${urgencyColors[urgency]} text-white font-mono font-bold text-lg`}>
                {formatTime(remaining)}
              </div>
              <Button 
                size="sm" 
                className="mt-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
              >
                <Zap className="w-3 h-3 mr-1" />
                {t.bidNow}
              </Button>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  const Section = ({ title, auctions, urgency, icon: Icon, color }) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${color}`} />
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <span className="px-2 py-1 rounded-full bg-white/10 text-sm text-gray-300">
          {auctions.length}
        </span>
      </div>
      
      {auctions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{t.noAuctions}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {auctions.map(auction => (
            <AuctionCard key={auction.id} auction={auction} urgency={urgency} />
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050509] py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-800 rounded w-1/3 mx-auto"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-24 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050509] py-8 px-4" data-testid="last-chance-page">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30 mb-4 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-bold">{t.title}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t.title}</h1>
          <p className="text-gray-400 text-lg">{t.subtitle}</p>
        </div>

        {/* Under 1 Minute - CRITICAL */}
        <Section 
          title={t.under1Min}
          auctions={endingSoon.under_1_min || []}
          urgency="critical"
          icon={AlertTriangle}
          color="text-red-500"
        />

        {/* Under 5 Minutes */}
        <Section 
          title={t.under5Min}
          auctions={endingSoon.under_5_min || []}
          urgency="high"
          icon={Clock}
          color="text-orange-500"
        />

        {/* Hot Auctions */}
        {hotAuctions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-bold text-white">{t.hotAuctions}</h2>
              <span className="text-gray-400 text-sm">({t.hotDesc})</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hotAuctions.map(auction => (
                <Link key={auction.id} to={`/auctions/${auction.id}`}>
                  <div className="glass-card rounded-xl p-4 border border-orange-500/30 hover:border-orange-500 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden">
                        {auction.product?.image_url ? (
                          <img src={auction.product.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-700" />
                        )}
                      </div>
                      <div className="flex-grow">
                        <h4 className="text-white font-bold truncate">{auction.product?.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            auction.heat_level === 'fire' ? 'bg-red-500 text-white animate-pulse' :
                            auction.heat_level === 'hot' ? 'bg-orange-500 text-white' :
                            'bg-yellow-500 text-black'
                          }`}>
                            {auction.heat_level === 'fire' ? '🔥 ' : ''}{auction.recent_bids} {t.recentBids}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold">€{(auction.current_price || 0).toFixed(2)}</div>
                        <div className="text-gray-400 text-sm">{formatTime(auction.remaining_seconds)}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Under 15 Minutes */}
        <Section 
          title={t.under15Min}
          auctions={endingSoon.under_15_min || []}
          urgency="medium"
          icon={Clock}
          color="text-yellow-500"
        />

        {/* Under 1 Hour */}
        <Section 
          title={t.under1Hour}
          auctions={endingSoon.under_1_hour || []}
          urgency="low"
          icon={Clock}
          color="text-green-500"
        />
      </div>
    </div>
  );
};

export default LastChancePage;
