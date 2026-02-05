import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Gift, Star, Coins, Zap, Crown, Truck, 
  ChevronRight, History, Award, Sparkles
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const LoyaltyPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  const texts = {
    de: {
      title: 'Treuepunkte',
      subtitle: 'Sammle Punkte und löse sie für Belohnungen ein!',
      availablePoints: 'Verfügbare Punkte',
      lifetimePoints: 'Gesamte Punkte',
      level: 'Level',
      redeem: 'Einlösen',
      notEnough: 'Nicht genug Punkte',
      rewards: 'Belohnungen',
      history: 'Punkteverlauf',
      howToEarn: 'So sammelst du Punkte',
      perEuro: 'Punkte pro €1 Einkauf',
      perWin: 'Bonus-Punkte pro Gewinn',
      nextReward: 'Nächste Belohnung in',
      points: 'Punkten',
      redeemSuccess: 'Erfolgreich eingelöst!'
    },
    en: {
      title: 'Loyalty Points',
      subtitle: 'Collect points and redeem them for rewards!',
      availablePoints: 'Available Points',
      lifetimePoints: 'Lifetime Points',
      level: 'Level',
      redeem: 'Redeem',
      notEnough: 'Not enough points',
      rewards: 'Rewards',
      history: 'Point History',
      howToEarn: 'How to earn points',
      perEuro: 'points per €1 purchase',
      perWin: 'bonus points per win',
      nextReward: 'Next reward in',
      points: 'points',
      redeemSuccess: 'Successfully redeemed!'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    if (isAuthenticated) {
      fetchLoyaltyData();
    }
  }, [isAuthenticated]);

  const fetchLoyaltyData = async () => {
    try {
      const res = await axios.get(`${API}/api/loyalty/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLoyaltyData(res.data);
    } catch (err) {
      console.error('Error fetching loyalty data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (tierIndex) => {
    setRedeeming(true);
    try {
      const res = await axios.post(`${API}/api/loyalty/redeem/${tierIndex}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message || t.redeemSuccess);
      fetchLoyaltyData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Einlösen');
    } finally {
      setRedeeming(false);
    }
  };

  const getTierIcon = (reward) => {
    if (reward.includes('bids')) return <Zap className="w-6 h-6" />;
    if (reward.includes('shipping')) return <Truck className="w-6 h-6" />;
    if (reward.includes('vip')) return <Crown className="w-6 h-6" />;
    return <Gift className="w-6 h-6" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-gray-800 rounded-xl"></div>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const balance = loyaltyData?.balance || {};
  const tiers = loyaltyData?.redemption_tiers || [];
  const transactions = loyaltyData?.transactions || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="loyalty-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 mb-4">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-800 font-bold">Loyalty Program</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {/* Balance Card */}
        <div className="glass-card rounded-2xl p-8 mb-8 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-gray-500 text-sm mb-1">{t.availablePoints}</p>
              <p className="text-4xl font-bold text-yellow-400">{balance.available_points || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">{t.lifetimePoints}</p>
              <p className="text-4xl font-bold text-gray-800">{balance.lifetime_points || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">{t.level}</p>
              <p className="text-4xl font-bold text-orange-400">{balance.level || 'Bronze'}</p>
            </div>
          </div>

          {loyaltyData?.next_tier && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t.nextReward}: {loyaltyData.next_tier.description}</span>
                <span className="text-yellow-400 font-bold">
                  {loyaltyData.points_to_next} {t.points}
                </span>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                  style={{ 
                    width: `${Math.min(100, (balance.available_points / loyaltyData.next_tier.points) * 100)}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* How to Earn */}
        <div className="glass-card rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            {t.howToEarn}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Coins className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-800 font-bold">10 {t.perEuro}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-800 font-bold">50 {t.perWin}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rewards Grid */}
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t.rewards}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {tiers.map((tier, index) => {
            const canRedeem = (balance.available_points || 0) >= tier.points;
            
            return (
              <div 
                key={tier.reward}
                className={`glass-card rounded-xl p-5 transition-all ${
                  canRedeem ? 'border border-yellow-500/50 hover:border-yellow-500' : 'opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    canRedeem ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-500'
                  }`}>
                    {getTierIcon(tier.reward)}
                  </div>
                  <div>
                    <p className="text-gray-800 font-bold">{tier.description}</p>
                    <p className="text-yellow-400 font-medium">{tier.points} Punkte</p>
                  </div>
                </div>
                
                <Button
                  onClick={() => handleRedeem(index)}
                  disabled={!canRedeem || redeeming}
                  className={`w-full ${
                    canRedeem 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:from-yellow-300'
                      : 'bg-gray-700 text-gray-500'
                  }`}
                >
                  {canRedeem ? t.redeem : t.notEnough}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Transaction History */}
        {transactions.length > 0 && (
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-500" />
              {t.history}
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {transactions.map((tx, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-gray-800 text-sm">{tx.description}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`font-bold ${tx.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoyaltyPage;
