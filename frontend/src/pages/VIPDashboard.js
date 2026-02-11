import { useState, useEffect } from 'react';
import { Crown, Star, Gift, Zap, Shield, Trophy, ChevronRight, Sparkles, Check, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: 'VIP-Status',
    subtitle: 'Deine exklusiven Vorteile',
    currentTier: 'Aktuelles Level',
    nextTier: 'Nächstes Level',
    progress: 'Fortschritt',
    spent: 'Ausgegeben',
    toNextLevel: 'bis zum nächsten Level',
    benefits: 'Vorteile',
    discount: 'Rabatt auf Gebote',
    dailySpins: 'Tägliche Glücksrad-Spins',
    prioritySupport: 'Priority Support',
    exclusiveAuctions: 'Exklusive Auktionen',
    cashback: 'Cashback',
    allTiers: 'Alle VIP-Stufen',
    buyBids: 'Gebote kaufen',
    maxLevel: 'Höchstes Level erreicht!',
    unlocked: 'Freigeschaltet',
    locked: 'Gesperrt'
  },
  en: {
    title: 'VIP Status',
    subtitle: 'Your exclusive benefits',
    currentTier: 'Current Level',
    nextTier: 'Next Level',
    progress: 'Progress',
    spent: 'Spent',
    toNextLevel: 'to next level',
    benefits: 'Benefits',
    discount: 'Discount on bids',
    dailySpins: 'Daily wheel spins',
    prioritySupport: 'Priority Support',
    exclusiveAuctions: 'Exclusive Auctions',
    cashback: 'Cashback',
    allTiers: 'All VIP Tiers',
    buyBids: 'Buy Bids',
    maxLevel: 'Maximum level reached!',
    unlocked: 'Unlocked',
    locked: 'Locked'
  }
};

export default function VIPDashboard() {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = translations[language] || translations.de;
  
  const [status, setStatus] = useState(null);
  const [allTiers, setAllTiers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchVIPStatus();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchVIPStatus = async () => {
    try {
      const [statusRes, tiersRes] = await Promise.all([
        axios.get(`${API}/vip-tiers/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/vip-tiers/all-tiers`)
      ]);
      setStatus(statusRes.data);
      setAllTiers(tiersRes.data.tiers || {});
    } catch (error) {
      console.error('Error fetching VIP status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierIcon = (tier) => {
    const icons = {
      bronze: <Star className="w-6 h-6" />,
      silver: <Shield className="w-6 h-6" />,
      gold: <Crown className="w-6 h-6" />,
      platinum: <Trophy className="w-6 h-6" />
    };
    return icons[tier] || <Star className="w-6 h-6" />;
  };

  const getTierGradient = (tier) => {
    const gradients = {
      bronze: 'from-amber-600 to-amber-800',
      silver: 'from-gray-400 to-gray-600',
      gold: 'from-yellow-400 to-amber-500',
      platinum: 'from-gray-300 to-gray-500'
    };
    return gradients[tier] || gradients.bronze;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 pt-20 px-4">
        <div className="max-w-2xl mx-auto text-center py-20">
          <Crown className="w-20 h-20 mx-auto mb-6 text-yellow-400" />
          <h1 className="text-3xl font-bold text-white mb-4">{t.title}</h1>
          <p className="text-purple-200 mb-8">Melde dich an, um deinen VIP-Status zu sehen</p>
          <Button 
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 font-bold px-8 py-3"
          >
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
  const currentTierIndex = tierOrder.indexOf(status?.current_tier || 'bronze');

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-indigo-900 to-purple-900 pt-20 pb-24 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-4">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span className="text-purple-200 text-sm">{t.subtitle}</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
        </div>

        {/* Current Status Card */}
        <div className={`bg-gradient-to-r ${getTierGradient(status?.current_tier)} rounded-2xl p-6 mb-8 shadow-2xl relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white">
                  {getTierIcon(status?.current_tier)}
                </div>
                <div>
                  <p className="text-white/70 text-sm">{t.currentTier}</p>
                  <h2 className="text-3xl font-bold text-white">{status?.tier_name}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-sm">{t.spent}</p>
                <p className="text-2xl font-bold text-white">€{status?.total_spent?.toFixed(2)}</p>
              </div>
            </div>

            {/* Progress to next tier */}
            {status?.next_tier && (
              <div className="bg-black/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/80 text-sm">{t.progress}</span>
                  <span className="text-white font-medium">
                    €{status?.amount_to_next_tier?.toFixed(2)} {t.toNextLevel}
                  </span>
                </div>
                <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${status?.progress_percent || 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-white/60">{status?.tier_name}</span>
                  <span className="text-white flex items-center gap-1">
                    <ChevronRight className="w-4 h-4" />
                    {status?.next_tier_name}
                  </span>
                </div>
              </div>
            )}

            {!status?.next_tier && (
              <div className="bg-black/20 rounded-xl p-4 text-center">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
                <p className="text-white font-medium">{t.maxLevel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Current Benefits */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-300" />
            {t.benefits}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-1">
                {status?.benefits?.discount}%
              </div>
              <p className="text-purple-200 text-sm">{t.discount}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">
                {status?.benefits?.daily_spins}x
              </div>
              <p className="text-purple-200 text-sm">{t.dailySpins}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-400 mb-1">
                {status?.benefits?.cashback}%
              </div>
              <p className="text-purple-200 text-sm">{t.cashback}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className={`text-3xl mb-1 ${status?.benefits?.priority_support ? 'text-green-400' : 'text-gray-500'}`}>
                {status?.benefits?.priority_support ? <Check className="w-8 h-8 mx-auto" /> : <Lock className="w-8 h-8 mx-auto" />}
              </div>
              <p className="text-purple-200 text-sm">{t.prioritySupport}</p>
            </div>
          </div>
        </div>

        {/* All Tiers Overview */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            {t.allTiers}
          </h3>
          
          <div className="space-y-4">
            {tierOrder.map((tierKey, index) => {
              const tier = allTiers[tierKey];
              if (!tier) return null;
              
              const isCurrentTier = tierKey === status?.current_tier;
              const isUnlocked = index <= currentTierIndex;
              
              return (
                <div 
                  key={tierKey}
                  className={`relative rounded-xl p-4 transition-all ${
                    isCurrentTier 
                      ? 'bg-gradient-to-r ' + getTierGradient(tierKey) + ' ring-2 ring-white/50'
                      : isUnlocked
                        ? 'bg-white/10'
                        : 'bg-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isUnlocked ? 'bg-white/20 text-white' : 'bg-gray-600/50 text-gray-400'
                      }`}>
                        {getTierIcon(tierKey)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-bold text-white">{tier.name}</h4>
                          {isCurrentTier && (
                            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                              Aktuell
                            </span>
                          )}
                        </div>
                        <p className="text-white/60 text-sm">
                          Ab €{tier.min_spent} Ausgaben
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center hidden sm:block">
                        <p className="text-white font-bold">{tier.discount}%</p>
                        <p className="text-white/50 text-xs">Rabatt</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="text-white font-bold">{tier.daily_spins}x</p>
                        <p className="text-white/50 text-xs">Spins</p>
                      </div>
                      <div className="text-center hidden md:block">
                        <p className="text-white font-bold">{tier.cashback}%</p>
                        <p className="text-white/50 text-xs">Cashback</p>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUnlocked ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-500'
                      }`}>
                        {isUnlocked ? <Check className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Button
            onClick={() => navigate('/buy-bids')}
            className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-gray-900 font-bold px-8 py-4 text-lg"
          >
            <Zap className="w-5 h-5 mr-2" />
            {t.buyBids}
          </Button>
          <p className="text-purple-300/60 text-sm mt-3">
            Kaufe Gebote und steige schneller auf!
          </p>
        </div>
      </div>
    </div>
  );
}
