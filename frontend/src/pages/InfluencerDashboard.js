import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Star, Users, DollarSign, TrendingUp, Award, 
  ChevronRight, LogOut, Copy, CheckCircle, Clock,
  ArrowUp, Gift, Target, Crown, Wallet, CreditCard, Send, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tier configurations
const TIERS = {
  Bronze: { color: '#CD7F32', emoji: '🥉', minCustomers: 0, bonus: 0 },
  Silber: { color: '#C0C0C0', emoji: '🥈', minCustomers: 11, bonus: 2 },
  Gold: { color: '#FFD700', emoji: '🥇', minCustomers: 51, bonus: 3 },
  Platin: { color: '#E5E4E2', emoji: '💎', minCustomers: 101, bonus: 5 }
};

export default function InfluencerDashboard() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [influencer, setInfluencer] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', code: '' });
  const [payoutHistory, setPayoutHistory] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    payment_method: 'paypal',
    payment_details: ''
  });
  const [copied, setCopied] = useState(false);

  // Check if already logged in and validate session
  useEffect(() => {
    const checkSavedSession = async () => {
      const savedInfluencer = localStorage.getItem('influencer_data');
      const savedToken = localStorage.getItem('influencer_token');
      
      if (savedInfluencer && savedToken) {
        try {
          const data = JSON.parse(savedInfluencer);
          
          // Verify the session is still valid by fetching stats
          const res = await axios.get(`${API}/influencer/stats/${data.code}`);
          
          if (res.data) {
            setInfluencer(data);
            setIsLoggedIn(true);
            setStats(res.data);
            
            // Also fetch payout history
            try {
              const payoutRes = await axios.get(`${API}/influencer/payout/history/${data.code}`);
              setPayoutHistory(payoutRes.data);
            } catch (e) {
              console.log('Payout history not available');
            }
          }
        } catch (error) {
          // Session invalid - clear storage
          console.log('Session expired, clearing storage');
          localStorage.removeItem('influencer_data');
          localStorage.removeItem('influencer_token');
        }
      }
    };
    
    checkSavedSession();
  }, []);

  const fetchStats = async (code) => {
    try {
      const res = await axios.get(`${API}/influencer/stats/${code}`);
      setStats(res.data);
      // Also fetch payout history
      const payoutRes = await axios.get(`${API}/influencer/payout/history/${code}`);
      setPayoutHistory(payoutRes.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/influencer/login`, loginForm);
      setInfluencer(res.data.influencer);
      setIsLoggedIn(true);
      // Save both influencer data AND token with consistent naming
      localStorage.setItem('influencer_data', JSON.stringify(res.data.influencer));
      localStorage.setItem('influencer_token', res.data.token);
      localStorage.setItem('token', res.data.token); // Also save as general token for API calls
      toast.success(`Willkommen, ${res.data.influencer.name}!`);
      fetchStats(res.data.influencer.code);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutRequest = async () => {
    if (!payoutForm.amount || !payoutForm.payment_details) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }
    try {
      const res = await axios.post(`${API}/influencer/payout/request`, {
        code: influencer.code,
        amount: parseFloat(payoutForm.amount),
        payment_method: payoutForm.payment_method,
        payment_details: payoutForm.payment_details
      });
      toast.success(res.data.message);
      setShowPayoutModal(false);
      setPayoutForm({ amount: '', payment_method: 'paypal', payment_details: '' });
      fetchStats(influencer.code);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler bei der Anfrage');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('influencer_data');
    localStorage.removeItem('influencer_token');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setInfluencer(null);
    setStats(null);
    setPayoutHistory(null);
    toast.success('Erfolgreich abgemeldet');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(influencer?.code || '');
    setCopied(true);
    toast.success('Code kopiert!');
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTier = stats?.current_tier || 'Bronze';
  const tierConfig = TIERS[currentTier] || TIERS.Bronze;
  const progressPercent = stats?.next_tier_at 
    ? Math.min(100, ((stats.total_customers || 0) / stats.next_tier_at) * 100)
    : 100;

  // Login Form
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD700] to-[#F59E0B] flex items-center justify-center mx-auto mb-4">
              <Star className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Influencer Portal</h1>
            <p className="text-[#94A3B8]">Melden Sie sich an, um Ihre Statistiken zu sehen</p>
          </div>

          <form onSubmit={handleLogin} className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <Label className="text-white">E-Mail</Label>
              <Input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                placeholder="ihre@email.de"
                className="mt-1 bg-[#181824] border-white/10 text-white"
                required
              />
            </div>
            <div>
              <Label className="text-white">Influencer-Code</Label>
              <Input
                value={loginForm.code}
                onChange={(e) => setLoginForm({...loginForm, code: e.target.value})}
                placeholder="Ihr Code"
                className="mt-1 bg-[#181824] border-white/10 text-white"
                required
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#FFD700] to-[#F59E0B] text-black font-bold hover:opacity-90"
            >
              {loading ? 'Wird geladen...' : 'Anmelden'}
            </Button>
          </form>

          <p className="text-center text-[#94A3B8] text-sm mt-6">
            Noch kein Influencer?{' '}
            <button 
              onClick={() => navigate('/influencer/apply')}
              className="text-[#FFD700] hover:underline"
            >
              Jetzt bewerben
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-[#0A0A0F] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${tierConfig.color}20` }}
            >
              {tierConfig.emoji}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{influencer?.name}</h1>
              <p className="text-[#94A3B8]">
                <span style={{ color: tierConfig.color }}>{currentTier}</span> Influencer
              </p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-white/10 text-white">
            <LogOut className="w-4 h-4 mr-2" />
            Abmelden
          </Button>
        </div>

        {/* Your Code Card */}
        <div className="glass-card rounded-2xl p-4 md:p-6 border-l-4" style={{ borderColor: tierConfig.color }}>
          {/* Mobile: Stack vertically, Desktop: Side by side */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <p className="text-[#94A3B8] text-sm mb-1">Dein Influencer-Code</p>
              <div className="flex items-center gap-3">
                <code className="text-2xl md:text-3xl font-bold text-[#FFD700] tracking-wider">
                  {influencer?.code?.toUpperCase()}
                </code>
                <Button onClick={copyCode} size="sm" variant="ghost" className="text-white">
                  {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-[#94A3B8] text-xs md:text-sm mt-2 leading-relaxed">
                Teile diesen Code mit deiner Community - sie erhalten Rabatt, du verdienst Provision!
              </p>
            </div>
            {/* Commission display - visible on mobile too */}
            <div className="flex md:block items-center justify-between md:text-right bg-[#181824] md:bg-transparent p-3 md:p-0 rounded-lg">
              <span className="text-[#94A3B8] text-sm md:hidden">Aktuelle Provision</span>
              <p className="text-3xl md:text-5xl font-bold" style={{ color: tierConfig.color }}>
                {stats?.effective_commission || 10}%
              </p>
              <p className="text-[#94A3B8] text-sm hidden md:block">Aktuelle Provision</p>
              {stats?.tier_bonus > 0 && (
                <p className="text-green-400 text-xs mt-1 hidden md:block">+{stats.tier_bonus}% Tier-Bonus</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-[#06B6D4]" />
              <span className="text-[#94A3B8] text-sm">Kunden</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.total_customers || 0}</p>
          </div>
          
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-[#10B981]" />
              <span className="text-[#94A3B8] text-sm">Umsatz</span>
            </div>
            <p className="text-3xl font-bold text-[#10B981]">€{stats?.total_revenue?.toFixed(2) || '0.00'}</p>
          </div>
          
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-[#F59E0B]" />
              <span className="text-[#94A3B8] text-sm">Verdient</span>
            </div>
            <p className="text-3xl font-bold text-[#F59E0B]">€{stats?.total_commission?.toFixed(2) || '0.00'}</p>
          </div>
          
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Gift className="w-5 h-5 text-[#7C3AED]" />
              <span className="text-[#94A3B8] text-sm">Käufe</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.total_purchases || 0}</p>
          </div>
        </div>

        {/* Payout Card */}
        <div className="glass-card rounded-2xl p-4 md:p-6 border-l-4 border-[#10B981]">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 md:w-6 md:h-6 text-[#10B981]" />
              Auszahlung
            </h2>
            <Button 
              onClick={() => setShowPayoutModal(true)}
              disabled={(payoutHistory?.available_balance || 0) < 10}
              className="bg-[#10B981] hover:bg-[#059669] px-3 md:px-6 text-sm md:text-base"
              data-testid="request-payout-btn"
            >
              <Send className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Auszahlung anfordern</span>
              <span className="sm:hidden">Anfordern</span>
            </Button>
          </div>
          
          {/* Stats Grid - Stacked on mobile, row on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
            <div className="flex justify-between sm:block p-3 sm:p-0 bg-[#181824] sm:bg-transparent rounded-lg">
              <p className="text-[#94A3B8] text-sm">Gesamt verdient</p>
              <p className="text-xl md:text-2xl font-bold text-[#F59E0B]">€{payoutHistory?.total_earned?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="flex justify-between sm:block p-3 sm:p-0 bg-[#181824] sm:bg-transparent rounded-lg">
              <p className="text-[#94A3B8] text-sm">Bereits ausgezahlt</p>
              <p className="text-xl md:text-2xl font-bold text-[#94A3B8]">€{payoutHistory?.total_paid?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="flex justify-between sm:block p-3 sm:p-0 bg-[#181824] sm:bg-transparent rounded-lg">
              <p className="text-[#94A3B8] text-sm">Verfügbar</p>
              <p className="text-xl md:text-2xl font-bold text-[#10B981]">€{payoutHistory?.available_balance?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
          
          {(payoutHistory?.available_balance || 0) < 10 && (
            <p className="text-[#F59E0B] text-sm mt-3">
              Mindestauszahlung: €10.00
            </p>
          )}

          {/* Payout History */}
          {payoutHistory?.payouts?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h3 className="text-white font-semibold mb-3">Letzte Auszahlungen</h3>
              <div className="space-y-2">
                {payoutHistory.payouts.slice(0, 3).map((payout, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-[#181824] rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-[#94A3B8]" />
                      <div>
                        <p className="text-white">€{payout.amount.toFixed(2)}</p>
                        <p className="text-[#94A3B8] text-xs">{payout.payment_method}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        payout.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        payout.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {payout.status === 'completed' ? 'Ausgezahlt' : 
                         payout.status === 'pending' ? 'In Bearbeitung' : 'Abgelehnt'}
                      </span>
                      <p className="text-[#94A3B8] text-xs mt-1">
                        {new Date(payout.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tier Progress */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Crown className="w-6 h-6" style={{ color: tierConfig.color }} />
            Dein Tier-Fortschritt
          </h2>
          
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="relative">
              <div className="h-4 bg-[#181824] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${progressPercent}%`,
                    background: `linear-gradient(90deg, ${tierConfig.color}, ${TIERS[Object.keys(TIERS).find(t => TIERS[t].minCustomers > (stats?.total_customers || 0)) || 'Platin'].color})`
                  }}
                />
              </div>
              {stats?.next_tier_at && (
                <p className="text-center text-[#94A3B8] text-sm mt-2">
                  Noch <span className="text-white font-bold">{stats.customers_to_next_tier}</span> Kunden bis zum nächsten Tier
                </p>
              )}
            </div>

            {/* Tier Steps - Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(TIERS).map(([name, config]) => {
                const isActive = name === currentTier;
                const isUnlocked = (stats?.total_customers || 0) >= config.minCustomers;
                
                return (
                  <div 
                    key={name}
                    data-testid={`tier-${name.toLowerCase()}`}
                    className={`p-3 md:p-4 rounded-xl text-center transition-all ${
                      isActive 
                        ? 'ring-2' 
                        : isUnlocked 
                          ? 'bg-white/5' 
                          : 'bg-[#181824] opacity-50'
                    }`}
                    style={{ 
                      ringColor: isActive ? config.color : 'transparent',
                      backgroundColor: isActive ? `${config.color}15` : undefined
                    }}
                  >
                    <span className="text-xl md:text-2xl">{config.emoji}</span>
                    <p className="font-bold text-white mt-1 text-sm md:text-base">{name}</p>
                    <p className="text-xs" style={{ color: config.color }}>
                      {config.minCustomers === 0 ? '0-10' : `${config.minCustomers}+`}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {config.bonus === 0 ? 'Basis' : `+${config.bonus}%`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#7C3AED]" />
            Letzte Aktivitäten
          </h2>
          
          {stats?.recent_activity?.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {stats.recent_activity.map((activity, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#181824] border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.type === 'purchase' ? 'bg-green-500/20' : 'bg-blue-500/20'
                    }`}>
                      {activity.type === 'purchase' 
                        ? <DollarSign className="w-5 h-5 text-green-400" />
                        : <Users className="w-5 h-5 text-blue-400" />
                      }
                    </div>
                    <div>
                      <p className="text-white font-medium">{activity.customer_name}</p>
                      <p className="text-[#94A3B8] text-xs">
                        {activity.type === 'purchase' ? 'Kauf getätigt' : 'Hat sich angemeldet'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {activity.type === 'purchase' && (
                      <>
                        <p className="text-[#10B981] font-bold">€{activity.amount.toFixed(2)}</p>
                        <p className="text-[#F59E0B] text-xs">+€{activity.commission.toFixed(2)} Provision</p>
                      </>
                    )}
                    <p className="text-[#94A3B8] text-xs">
                      {new Date(activity.date).toLocaleDateString('de-DE', { 
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#94A3B8] mx-auto mb-4" />
              <p className="text-[#94A3B8]">Noch keine Aktivitäten</p>
              <p className="text-[#94A3B8] text-sm mt-1">Teile deinen Code, um loszulegen!</p>
            </div>
          )}
        </div>

        {/* Tips Card */}
        <div className="glass-card rounded-2xl p-6 border-l-4 border-[#7C3AED]">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#7C3AED]" />
            Tipps für mehr Erfolg
          </h3>
          <ul className="space-y-2 text-[#94A3B8]">
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-[#7C3AED] mt-0.5 flex-shrink-0" />
              <span>Erwähne deinen Code regelmäßig in deinen Posts und Stories</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-[#7C3AED] mt-0.5 flex-shrink-0" />
              <span>Erkläre deiner Community die Vorteile von Penny-Auktionen</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-[#7C3AED] mt-0.5 flex-shrink-0" />
              <span>Je mehr Kunden du bringst, desto höher wird deine Provision! 🚀</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F0F16] rounded-2xl p-6 w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-[#10B981]" />
                Auszahlung anfordern
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPayoutModal(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-[#181824] rounded-xl">
                <p className="text-[#94A3B8] text-sm">Verfügbares Guthaben</p>
                <p className="text-3xl font-bold text-[#10B981]">
                  €{payoutHistory?.available_balance?.toFixed(2) || '0.00'}
                </p>
              </div>

              <div>
                <Label className="text-white">Auszahlungsbetrag (€)</Label>
                <Input
                  type="number"
                  min="10"
                  step="0.01"
                  max={payoutHistory?.available_balance || 0}
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm({...payoutForm, amount: e.target.value})}
                  placeholder="Min. 10.00"
                  className="mt-1 bg-[#181824] border-white/10 text-white"
                />
              </div>

              <div>
                <Label className="text-white">Zahlungsmethode</Label>
                <Select 
                  value={payoutForm.payment_method}
                  onValueChange={(v) => setPayoutForm({...payoutForm, payment_method: v})}
                >
                  <SelectTrigger className="mt-1 bg-[#181824] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181824] border-white/10">
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="bank_transfer">Banküberweisung</SelectItem>
                    <SelectItem value="crypto">Kryptowährung</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white">
                  {payoutForm.payment_method === 'paypal' ? 'PayPal E-Mail' :
                   payoutForm.payment_method === 'bank_transfer' ? 'IBAN' :
                   'Wallet-Adresse'}
                </Label>
                <Input
                  value={payoutForm.payment_details}
                  onChange={(e) => setPayoutForm({...payoutForm, payment_details: e.target.value})}
                  placeholder={
                    payoutForm.payment_method === 'paypal' ? 'ihre@email.de' :
                    payoutForm.payment_method === 'bank_transfer' ? 'DE89370400440532013000' :
                    '0x...'
                  }
                  className="mt-1 bg-[#181824] border-white/10 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowPayoutModal(false)}
                className="border-white/20 text-white"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handlePayoutRequest}
                disabled={!payoutForm.amount || parseFloat(payoutForm.amount) < 10 || !payoutForm.payment_details}
                className="bg-[#10B981] hover:bg-[#059669]"
              >
                <Send className="w-4 h-4 mr-1" />
                Anfordern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
