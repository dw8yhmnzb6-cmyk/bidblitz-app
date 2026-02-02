import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Gift, Clock, Users, Zap, Lock, Eye, EyeOff, 
  HelpCircle, Trophy, Star, Sparkles
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MysteryBoxPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [auctions, setAuctions] = useState([]);
  const [tiers, setTiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState('all');

  const texts = {
    de: {
      title: 'Mystery Boxen',
      subtitle: 'Überraschungsauktionen mit versteckten Premiumprodukte!',
      valueRange: 'Wert',
      currentPrice: 'Aktuell',
      bids: 'Gebote',
      endsIn: 'Endet in',
      bidNow: 'Jetzt bieten',
      loginToBid: 'Anmelden zum Bieten',
      noAuctions: 'Keine Mystery Boxen verfügbar',
      hint: 'Hinweis',
      howItWorks: 'So funktioniert es',
      step1: 'Wähle eine Mystery Box Stufe',
      step2: 'Biete wie bei einer normalen Auktion',
      step3: 'Gewinne und entdecke dein Produkt!',
      allTiers: 'Alle Stufen',
      revealed: 'Enthüllt',
      winner: 'Gewinner',
      ended: 'Beendet'
    },
    en: {
      title: 'Mystery Boxes',
      subtitle: 'Surprise auctions with hidden premium products!',
      valueRange: 'Value',
      currentPrice: 'Current',
      bids: 'Bids',
      endsIn: 'Ends in',
      bidNow: 'Bid Now',
      loginToBid: 'Login to Bid',
      noAuctions: 'No mystery boxes available',
      hint: 'Hint',
      howItWorks: 'How it Works',
      step1: 'Choose a mystery box tier',
      step2: 'Bid like a normal auction',
      step3: 'Win and discover your product!',
      allTiers: 'All Tiers',
      revealed: 'Revealed',
      winner: 'Winner',
      ended: 'Ended'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    fetchMysteryBoxes();
  }, []);

  const fetchMysteryBoxes = async () => {
    try {
      const res = await axios.get(`${API}/api/mystery-box/active`);
      setAuctions(res.data.auctions || []);
      setTiers(res.data.tiers || {});
    } catch (err) {
      console.error('Error fetching mystery boxes:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (endTime) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return t.ended;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const filteredAuctions = selectedTier === 'all' 
    ? auctions 
    : auctions.filter(a => a.tier === selectedTier);

  const tierOrder = ['bronze', 'silver', 'gold', 'diamond'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050509] py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-800 rounded w-1/3 mx-auto"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="h-64 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050509] py-8 px-4" data-testid="mystery-box-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-4">
            <Gift className="w-5 h-5 text-purple-400" />
            <span className="text-purple-400 font-bold">Mystery</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t.title}</h1>
          <p className="text-gray-400 text-lg">{t.subtitle}</p>
        </div>

        {/* How it Works */}
        <div className="glass-card rounded-xl p-6 mb-8 bg-gradient-to-r from-purple-500/5 to-pink-500/5 border border-purple-500/20">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            {t.howItWorks}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">1</div>
              <p className="text-gray-300 text-sm">{t.step1}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">2</div>
              <p className="text-gray-300 text-sm">{t.step2}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">3</div>
              <p className="text-gray-300 text-sm">{t.step3}</p>
            </div>
          </div>
        </div>

        {/* Tier Filter */}
        <div className="flex flex-wrap gap-3 mb-8 justify-center">
          <Button
            variant={selectedTier === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedTier('all')}
            className={selectedTier === 'all' ? 'bg-purple-600' : ''}
          >
            {t.allTiers}
          </Button>
          {tierOrder.map(tier => {
            const tierInfo = tiers[tier];
            if (!tierInfo) return null;
            return (
              <Button
                key={tier}
                variant={selectedTier === tier ? 'default' : 'outline'}
                onClick={() => setSelectedTier(tier)}
                style={{ 
                  backgroundColor: selectedTier === tier ? tierInfo.color : 'transparent',
                  borderColor: tierInfo.color,
                  color: selectedTier === tier ? '#000' : tierInfo.color
                }}
              >
                <span className="mr-1">{tierInfo.icon}</span>
                {tierInfo.name.replace(' Mystery Box', '')}
              </Button>
            );
          })}
        </div>

        {/* Tier Cards (when no auctions) */}
        {filteredAuctions.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-6">{t.noAuctions}</p>
            
            {/* Show tier info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {tierOrder.map(tier => {
                const tierInfo = tiers[tier];
                if (!tierInfo) return null;
                return (
                  <div 
                    key={tier}
                    className="glass-card rounded-xl p-4 text-center"
                    style={{ borderColor: `${tierInfo.color}50` }}
                  >
                    <span className="text-4xl mb-2 block">{tierInfo.icon}</span>
                    <h4 className="text-white font-bold">{tierInfo.name.replace(' Mystery Box', '')}</h4>
                    <p className="text-sm" style={{ color: tierInfo.color }}>
                      €{tierInfo.min_value} - €{tierInfo.max_value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Auctions Grid */}
        {filteredAuctions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuctions.map(auction => {
              const tierInfo = auction.tier_info || tiers[auction.tier] || {};
              
              return (
                <div 
                  key={auction.id}
                  className="glass-card rounded-xl overflow-hidden group hover:scale-[1.02] transition-transform"
                  style={{ borderColor: `${tierInfo.color}50` }}
                  data-testid={`mystery-box-${auction.id}`}
                >
                  {/* Mystery Image */}
                  <div 
                    className="h-48 flex items-center justify-center relative"
                    style={{ background: `linear-gradient(135deg, ${tierInfo.color}20, ${tierInfo.color}05)` }}
                  >
                    <div className="text-center">
                      <span className="text-7xl block mb-2">{tierInfo.icon}</span>
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <EyeOff className="w-4 h-4" />
                        <span className="text-sm">Produkt versteckt</span>
                      </div>
                    </div>
                    
                    {/* Value Badge */}
                    <div 
                      className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ backgroundColor: `${tierInfo.color}30`, color: tierInfo.color }}
                    >
                      {auction.value_range}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white mb-2" style={{ color: tierInfo.color }}>
                      {tierInfo.name}
                    </h3>
                    
                    {/* Hint */}
                    <div className="bg-white/5 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                        <Sparkles className="w-3 h-3" />
                        {t.hint}
                      </div>
                      <p className="text-gray-300 text-sm italic">"{auction.hint}"</p>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm mb-4">
                      <div>
                        <span className="text-gray-500">{t.currentPrice}</span>
                        <p className="text-xl font-bold text-green-400">€{(auction.current_price || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500">{t.endsIn}</span>
                        <p className="text-white font-mono flex items-center gap-1">
                          <Clock className="w-4 h-4 text-yellow-400" />
                          {formatTime(auction.end_time)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Bid Count */}
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {auction.bid_count || 0} {t.bids}
                      </span>
                      {auction.highest_bidder_name && (
                        <span className="text-yellow-400">
                          {auction.highest_bidder_name}
                        </span>
                      )}
                    </div>
                    
                    {/* Bid Button */}
                    <Link to={`/auctions/${auction.id}`}>
                      <Button 
                        className="w-full"
                        style={{ backgroundColor: tierInfo.color, color: '#000' }}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {isAuthenticated ? t.bidNow : t.loginToBid}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MysteryBoxPage;
