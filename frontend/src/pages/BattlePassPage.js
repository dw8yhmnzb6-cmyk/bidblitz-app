import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getFeatureTranslation } from '../i18n/featureTranslations';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Trophy, Star, Lock, Check, Gift, Zap, Crown,
  ChevronLeft, ChevronRight, Clock, Sparkles, Shield
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const BattlePassPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [visibleTiers, setVisibleTiers] = useState({ start: 0, end: 10 });

  // Use centralized translations with fallback for specific keys
  const ft = getFeatureTranslation('battlePass', language);
  const t = {
    ...ft,
    title: ft.title || 'Battle Pass',
    season: ft.season || 'Season',
    tier: ft.tier || 'Tier',
    free: ft.free || 'Free',
    premium: ft.premium || 'Premium',
    getPremium: language === 'de' ? 'Premium holen' : 'Get Premium',
    getPremiumPlus: language === 'de' ? 'Premium+ (inkl. 25 Tier-Skips)' : 'Premium+ (incl. 25 Tier Skips)',
    owned: language === 'de' ? 'Besitzt' : 'Owned',
    claim: ft.claimReward || 'Claim',
    claimed: ft.claimed || 'Claimed',
    locked: ft.locked || 'Locked',
    daysLeft: ft.daysLeft || 'days left',
    currentTier: ft.currentTier || 'Current Tier',
    xpToNext: language === 'de' ? 'XP zum nächsten Tier' : 'XP to next tier',
    maxTier: language === 'de' ? 'MAX erreicht!' : 'MAX reached!',
    rewards: language === 'de' ? 'Belohnungen' : 'Rewards',
    purchaseSuccess: language === 'de' ? 'Battle Pass erfolgreich gekauft!' : 'Battle Pass purchased successfully!',
    premiumPerks: language === 'de' ? 'Premium Vorteile' : 'Premium Perks',
    perk1: ft.exclusiveRewards || 'Unlock all Premium rewards',
    perk2: ft.megaReward || 'Exclusive Tier 50 Mega reward',
    perk3: ft.vipDays || 'VIP days and bonus bids',
    perk4: language === 'de' ? 'Premium+ enthält 25 Tier-Skips!' : 'Premium+ includes 25 Tier Skips!'
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (searchParams.get('purchased') === 'true') {
      toast.success(t.purchaseSuccess);
      fetchData();
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/battle-pass/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
      
      // Center view on current tier
      const currentTier = res.data.user_progress?.current_tier || 0;
      const start = Math.max(0, currentTier - 3);
      setVisibleTiers({ start, end: start + 10 });
    } catch (err) {
      console.error('Error fetching battle pass:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (premiumPlus = false) => {
    setPurchasing(true);
    try {
      const res = await axios.post(`${API}/api/battle-pass/purchase`, 
        { premium_plus: premiumPlus },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Kauf');
    } finally {
      setPurchasing(false);
    }
  };

  const handleClaim = async (tier, track) => {
    setClaiming(true);
    try {
      const res = await axios.post(`${API}/api/battle-pass/claim/${tier}?track=${track}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    } finally {
      setClaiming(false);
    }
  };

  const scrollTiers = (direction) => {
    const step = 5;
    if (direction === 'left') {
      setVisibleTiers(prev => ({
        start: Math.max(0, prev.start - step),
        end: Math.max(10, prev.end - step)
      }));
    } else {
      const maxTier = data?.max_tier || 50;
      setVisibleTiers(prev => ({
        start: Math.min(maxTier - 10, prev.start + step),
        end: Math.min(maxTier, prev.end + step)
      }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050509] py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-800 rounded w-1/3 mx-auto"></div>
            <div className="h-32 bg-gray-800 rounded-xl"></div>
            <div className="h-64 bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const season = data?.season || {};
  const progress = data?.user_progress || {};
  const rewards = data?.rewards || [];
  const hasPremium = progress.has_premium;
  const currentTier = progress.current_tier || 0;
  const maxTier = data?.max_tier || 50;

  return (
    <div className="min-h-screen bg-[#050509] py-8 px-4" data-testid="battle-pass-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
            style={{ backgroundColor: `${season.theme?.color}20` }}
          >
            <span className="text-2xl">{season.theme?.icon}</span>
            <span className="text-white font-bold">{season.name}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">{t.title}</h1>
          <div className="flex items-center justify-center gap-4 text-gray-400">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>{season.days_remaining} {t.daysLeft}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="glass-card rounded-2xl p-6 mb-8" style={{ borderColor: `${season.theme?.color}50` }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Current Tier */}
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">{t.currentTier}</p>
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold"
                style={{ backgroundColor: `${season.theme?.color}30`, color: season.theme?.color }}
              >
                {currentTier}
              </div>
            </div>

            {/* XP Progress */}
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold">{t.tier} {currentTier}</span>
                <span className="text-white font-bold">
                  {currentTier < maxTier ? `${t.tier} ${currentTier + 1}` : t.maxTier}
                </span>
              </div>
              <div className="h-6 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                  style={{ 
                    width: `${progress.xp_progress_percent || 0}%`,
                    backgroundColor: season.theme?.color 
                  }}
                >
                  {progress.xp_progress_percent > 20 && (
                    <span className="text-black text-xs font-bold">
                      {progress.xp_in_tier}/{data?.xp_per_tier} XP
                    </span>
                  )}
                </div>
              </div>
              {currentTier < maxTier && (
                <p className="text-center text-gray-400 text-sm mt-2">
                  {progress.xp_to_next_tier} {t.xpToNext}
                </p>
              )}
            </div>

            {/* Premium Status */}
            <div className="text-center">
              {hasPremium ? (
                <div className="px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Crown className="w-6 h-6 text-yellow-400" />
                    <span className="text-yellow-400 font-bold">{t.owned}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={() => handlePurchase(false)}
                    disabled={purchasing}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {t.getPremium} - €{data?.prices?.premium}
                  </Button>
                  <Button
                    onClick={() => handlePurchase(true)}
                    disabled={purchasing}
                    variant="outline"
                    className="w-full border-yellow-500/50 text-yellow-400 text-xs"
                  >
                    {t.getPremiumPlus} - €{data?.prices?.premium_plus}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Premium Perks (if not owned) */}
        {!hasPremium && (
          <div className="glass-card rounded-xl p-6 mb-8 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border border-yellow-500/20">
            <h3 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5" />
              {t.premiumPerks}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-gray-300 text-sm">{t.perk1}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-gray-300 text-sm">{t.perk2}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-gray-300 text-sm">{t.perk3}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-bold">{t.perk4}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tier Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollTiers('left')}
            disabled={visibleTiers.start === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-gray-400">
            {t.tier} {visibleTiers.start + 1} - {Math.min(visibleTiers.end, maxTier)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollTiers('right')}
            disabled={visibleTiers.end >= maxTier}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Rewards Track */}
        <div className="glass-card rounded-2xl p-6 overflow-x-auto">
          <div className="min-w-max">
            {/* Tier Numbers */}
            <div className="flex gap-2 mb-4">
              {rewards.slice(visibleTiers.start, visibleTiers.end).map((reward, index) => {
                const tier = visibleTiers.start + index + 1;
                const isUnlocked = tier <= currentTier;
                const isCurrent = tier === currentTier + 1;
                
                return (
                  <div 
                    key={tier}
                    className={`w-24 h-10 rounded-lg flex items-center justify-center font-bold transition-all ${
                      isCurrent 
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' 
                        : isUnlocked 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    {tier}
                  </div>
                );
              })}
            </div>

            {/* Free Track */}
            <div className="flex gap-2 mb-2">
              <div className="w-16 flex items-center justify-center text-gray-400 font-bold text-sm">
                {t.free}
              </div>
              {rewards.slice(visibleTiers.start, visibleTiers.end).map((reward, index) => {
                const tier = visibleTiers.start + index + 1;
                const isUnlocked = tier <= currentTier;
                const isClaimed = progress.claimed_free?.includes(tier);
                const freeReward = reward.free;
                
                return (
                  <div 
                    key={`free-${tier}`}
                    className={`w-24 h-24 rounded-xl flex flex-col items-center justify-center p-2 transition-all ${
                      !freeReward 
                        ? 'bg-white/5 border border-white/10'
                        : isClaimed 
                          ? 'bg-green-500/10 border border-green-500/30'
                          : isUnlocked 
                            ? 'bg-blue-500/10 border-2 border-blue-500/50 cursor-pointer hover:border-blue-500'
                            : 'bg-white/5 border border-white/10'
                    }`}
                    onClick={() => freeReward && isUnlocked && !isClaimed && handleClaim(tier, 'free')}
                  >
                    {freeReward ? (
                      <>
                        <span className="text-2xl mb-1">{freeReward.icon}</span>
                        <span className="text-xs text-center text-gray-300 line-clamp-2">
                          {freeReward.name}
                        </span>
                        {isClaimed && <Check className="w-4 h-4 text-green-400 mt-1" />}
                        {isUnlocked && !isClaimed && (
                          <span className="text-xs text-blue-400 mt-1">{t.claim}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Premium Track */}
            <div className="flex gap-2">
              <div className="w-16 flex items-center justify-center">
                <Crown className="w-5 h-5 text-yellow-400" />
              </div>
              {rewards.slice(visibleTiers.start, visibleTiers.end).map((reward, index) => {
                const tier = visibleTiers.start + index + 1;
                const isUnlocked = tier <= currentTier;
                const isClaimed = progress.claimed_premium?.includes(tier);
                const premiumReward = reward.premium;
                const canClaim = hasPremium && isUnlocked && !isClaimed;
                
                return (
                  <div 
                    key={`premium-${tier}`}
                    className={`w-24 h-24 rounded-xl flex flex-col items-center justify-center p-2 transition-all relative ${
                      !premiumReward 
                        ? 'bg-yellow-500/5 border border-yellow-500/20'
                        : isClaimed 
                          ? 'bg-yellow-500/10 border border-yellow-500/30'
                          : canClaim 
                            ? 'bg-yellow-500/10 border-2 border-yellow-500/50 cursor-pointer hover:border-yellow-500'
                            : isUnlocked && !hasPremium
                              ? 'bg-yellow-500/5 border border-yellow-500/30'
                              : 'bg-yellow-500/5 border border-yellow-500/20'
                    }`}
                    onClick={() => premiumReward && canClaim && handleClaim(tier, 'premium')}
                  >
                    {!hasPremium && !isClaimed && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                        <Lock className="w-6 h-6 text-yellow-400/50" />
                      </div>
                    )}
                    {premiumReward ? (
                      <>
                        <span className="text-2xl mb-1">{premiumReward.icon}</span>
                        <span className="text-xs text-center text-yellow-300 line-clamp-2">
                          {premiumReward.name}
                        </span>
                        {isClaimed && <Check className="w-4 h-4 text-green-400 mt-1" />}
                        {canClaim && (
                          <span className="text-xs text-yellow-400 mt-1">{t.claim}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-yellow-600">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tier 50 Special */}
        {currentTier >= 45 && (
          <div className="mt-8 glass-card rounded-2xl p-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">
              🏆 Tier 50 MEGA BELOHNUNG
            </h3>
            <p className="text-purple-400 text-lg mb-4">
              50 Gebote + 14 Tage VIP-Status!
            </p>
            {currentTier >= 50 && hasPremium && !progress.claimed_premium?.includes(50) && (
              <Button
                onClick={() => handleClaim(50, 'premium')}
                disabled={claiming}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                <Trophy className="w-5 h-5 mr-2" />
                MEGA BELOHNUNG ABHOLEN!
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BattlePassPage;
