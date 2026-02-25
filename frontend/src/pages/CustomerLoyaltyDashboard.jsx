/**
 * Customer Loyalty Dashboard
 * Shows VIP tier status, points, cashback, and referral info
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Crown, Star, Gift, Users, TrendingUp, Coins, 
  Copy, Check, Share2, ArrowRight, Sparkles, Trophy,
  CreditCard, Percent, Clock, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function CustomerLoyaltyDashboard() {
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [cashbackHistory, setCashbackHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchLoyaltyData();
  }, [isAuthenticated, token]);

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true);
      const [statusRes, pointsRes, cashbackRes] = await Promise.all([
        fetch(`${API}/api/customer-loyalty/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/api/customer-loyalty/points/history`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/api/customer-loyalty/cashback/history`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setLoyaltyData(data);
      }
      
      if (pointsRes.ok) {
        const data = await pointsRes.json();
        setPointsHistory(data.history || []);
      }
      
      if (cashbackRes.ok) {
        const data = await cashbackRes.json();
        setCashbackHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const applyReferralCode = async () => {
    if (!referralCode.trim()) {
      toast.error('Bitte Empfehlungscode eingeben');
      return;
    }
    
    try {
      setApplyingCode(true);
      const res = await fetch(`${API}/api/customer-loyalty/referral/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: referralCode })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || 'Code eingelöst!');
        setReferralCode('');
        fetchLoyaltyData();
      } else {
        toast.error(data.detail || 'Ungültiger Code');
      }
    } catch (error) {
      toast.error('Fehler beim Einlösen');
    } finally {
      setApplyingCode(false);
    }
  };

  const copyReferralCode = () => {
    if (loyaltyData?.referral_code) {
      navigator.clipboard.writeText(loyaltyData.referral_code);
      setCopiedCode(true);
      toast.success('Code kopiert!');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const redeemPoints = async (points) => {
    try {
      const res = await fetch(`${API}/api/customer-loyalty/points/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ points })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message);
        fetchLoyaltyData();
      } else {
        toast.error(data.detail || 'Fehler beim Einlösen');
      }
    } catch (error) {
      toast.error('Fehler beim Einlösen');
    }
  };

  const getTierColor = (tier) => {
    const colors = {
      bronze: 'from-amber-600 to-orange-700',
      silver: 'from-gray-400 to-gray-600',
      gold: 'from-yellow-400 to-amber-500',
      platinum: 'from-purple-400 to-indigo-600'
    };
    return colors[tier] || colors.bronze;
  };

  const getTierIcon = (tier) => {
    if (tier === 'platinum') return <Crown className="w-8 h-8" />;
    if (tier === 'gold') return <Trophy className="w-8 h-8" />;
    return <Star className="w-8 h-8" />;
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-8 px-4 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Mein Treue-Programm</h1>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            Sammle Punkte, erhalte Cashback und steige im VIP-Level auf
          </p>
        </div>

        {/* VIP Status Card */}
        {loyaltyData && (
          <div className={`mb-8 rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br ${getTierColor(loyaltyData.tier)}`}>
            <div className="p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getTierIcon(loyaltyData.tier)}
                  <div>
                    <p className="text-sm opacity-80">Aktueller Status</p>
                    <h2 className="text-2xl font-bold">{loyaltyData.tier_name}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-80">Cashback</p>
                  <p className="text-2xl font-bold">{loyaltyData.cashback_percent}%</p>
                </div>
              </div>

              {/* Progress to next tier */}
              {loyaltyData.next_tier && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Fortschritt zu {loyaltyData.all_tiers[loyaltyData.next_tier]?.name}</span>
                    <span>€{loyaltyData.total_spent?.toFixed(2)} / €{loyaltyData.all_tiers[loyaltyData.next_tier]?.min_spent}</span>
                  </div>
                  <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (loyaltyData.total_spent / loyaltyData.all_tiers[loyaltyData.next_tier]?.min_spent) * 100)}%` 
                      }}
                    />
                  </div>
                  <p className="text-sm opacity-80 mt-1">
                    Noch €{loyaltyData.amount_to_next_tier?.toFixed(2)} bis zum nächsten Level
                  </p>
                </div>
              )}

              {/* Benefits */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-sm font-medium mb-2">Deine Vorteile:</p>
                <div className="flex flex-wrap gap-2">
                  {loyaltyData.benefits?.map((benefit, idx) => (
                    <span key={idx} className="px-3 py-1 bg-white/20 rounded-full text-sm">
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
            <Coins className="w-8 h-8 text-amber-500 mb-2" />
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Punkte</p>
            <p className="text-2xl font-bold">{loyaltyData?.points || 0}</p>
          </div>
          
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
            <Percent className="w-8 h-8 text-green-500 mb-2" />
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Cashback erhalten</p>
            <p className="text-2xl font-bold">€{loyaltyData?.cashback_earned?.toFixed(2) || '0.00'}</p>
          </div>
          
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
            <TrendingUp className="w-8 h-8 text-blue-500 mb-2" />
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Punktemultiplikator</p>
            <p className="text-2xl font-bold">{loyaltyData?.points_multiplier || 1}x</p>
          </div>
          
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
            <Users className="w-8 h-8 text-purple-500 mb-2" />
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Empfehlungen</p>
            <p className="text-2xl font-bold">{loyaltyData?.referral_count || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['overview', 'points', 'referral', 'tiers'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-amber-500 text-white'
                  : isDarkMode 
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'overview' && 'Übersicht'}
              {tab === 'points' && 'Punkte'}
              {tab === 'referral' && 'Empfehlen'}
              {tab === 'tiers' && 'VIP-Stufen'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
            <h3 className="text-xl font-bold mb-4">So funktioniert's</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h4 className="font-medium">Punkte sammeln</h4>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Erhalte 10 Punkte pro Euro Einkauf. Mit höheren VIP-Stufen bekommst du mehr!
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Percent className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h4 className="font-medium">Cashback erhalten</h4>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Je höher dein Level, desto mehr Cashback erhältst du automatisch bei jedem Einkauf.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h4 className="font-medium">Punkte einlösen</h4>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    100 Punkte = €1,00 Guthaben. Löse deine Punkte jederzeit ein!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'points' && (
          <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold">Deine Punkte</h3>
                <p className="text-3xl font-bold text-amber-500">{loyaltyData?.points || 0}</p>
              </div>
              <Button
                onClick={() => redeemPoints(100)}
                disabled={(loyaltyData?.points || 0) < 100}
                className="bg-amber-500 hover:bg-amber-600"
              >
                <Gift className="w-4 h-4 mr-2" />
                100 Punkte einlösen (€1)
              </Button>
            </div>
            
            <h4 className="font-medium mb-3">Verlauf</h4>
            {pointsHistory.length > 0 ? (
              <div className="space-y-3">
                {pointsHistory.slice(0, 10).map((item, idx) => (
                  <div key={idx} className={`flex justify-between items-center p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(item.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <span className={`font-bold ${item.points > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {item.points > 0 ? '+' : ''}{item.points}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Noch keine Punkte gesammelt</p>
            )}
          </div>
        )}

        {activeTab === 'referral' && (
          <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
            <h3 className="text-xl font-bold mb-4">Freunde werben</h3>
            
            {/* Your referral code */}
            <div className={`p-4 rounded-xl mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-amber-50'}`}>
              <p className={`text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Dein Empfehlungscode:</p>
              <div className="flex items-center gap-2">
                <code className="text-2xl font-bold text-amber-500">{loyaltyData?.referral_code}</code>
                <Button variant="ghost" size="sm" onClick={copyReferralCode}>
                  {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Du erhältst €5 für jeden Freund, der sich anmeldet. Dein Freund bekommt €2 Startguthaben!
              </p>
            </div>

            {/* Apply someone's code */}
            <div className="border-t pt-6">
              <h4 className="font-medium mb-3">Hast du einen Empfehlungscode?</h4>
              <div className="flex gap-2">
                <Input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="Code eingeben (z.B. REF-ABC123)"
                  className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}
                />
                <Button 
                  onClick={applyReferralCode}
                  disabled={applyingCode}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {applyingCode ? 'Wird geprüft...' : 'Einlösen'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tiers' && (
          <div className="space-y-4">
            {loyaltyData?.all_tiers && Object.entries(loyaltyData.all_tiers).map(([key, tier]) => (
              <div 
                key={key}
                className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg ${
                  loyaltyData.tier === key ? 'ring-2 ring-amber-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getTierColor(key)} flex items-center justify-center text-white`}>
                      {getTierIcon(key)}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{tier.name}</h4>
                      <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                        Ab €{tier.min_spent} Umsatz
                      </p>
                    </div>
                  </div>
                  {loyaltyData.tier === key && (
                    <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-sm font-medium">
                      Aktuell
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    {tier.cashback_percent}% Cashback
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    {tier.points_multiplier}x Punkte
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tier.benefits?.map((benefit, idx) => (
                    <span key={idx} className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      • {benefit}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
