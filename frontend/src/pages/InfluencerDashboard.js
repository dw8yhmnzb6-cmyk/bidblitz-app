import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Star, Users, DollarSign, TrendingUp, Award, 
  ChevronRight, LogOut, Copy, CheckCircle, Clock,
  ArrowUp, Gift, Target, Crown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

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
  const [copied, setCopied] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const savedInfluencer = localStorage.getItem('influencer_data');
    if (savedInfluencer) {
      const data = JSON.parse(savedInfluencer);
      setInfluencer(data);
      setIsLoggedIn(true);
      fetchStats(data.code);
    }
  }, []);

  const fetchStats = async (code) => {
    try {
      const res = await axios.get(`${API}/influencer/stats/${code}`);
      setStats(res.data);
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
      localStorage.setItem('influencer_data', JSON.stringify(res.data.influencer));
      localStorage.setItem('token', res.data.token);
      toast.success(`Willkommen, ${res.data.influencer.name}!`);
      fetchStats(res.data.influencer.code);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('influencer_data');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setInfluencer(null);
    setStats(null);
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
        <div className="glass-card rounded-2xl p-6 border-l-4" style={{ borderColor: tierConfig.color }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#94A3B8] text-sm mb-1">Dein Influencer-Code</p>
              <div className="flex items-center gap-3">
                <code className="text-3xl font-bold text-[#FFD700] tracking-wider">
                  {influencer?.code?.toUpperCase()}
                </code>
                <Button onClick={copyCode} size="sm" variant="ghost" className="text-white">
                  {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-[#94A3B8] text-sm mt-2">
                Teile diesen Code mit deiner Community - sie erhalten Rabatt, du verdienst Provision!
              </p>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <p className="text-5xl font-bold" style={{ color: tierConfig.color }}>
                  {stats?.effective_commission || 10}%
                </p>
                <p className="text-[#94A3B8] text-sm">Aktuelle Provision</p>
                {stats?.tier_bonus > 0 && (
                  <p className="text-green-400 text-xs mt-1">+{stats.tier_bonus}% Tier-Bonus</p>
                )}
              </div>
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

            {/* Tier Steps */}
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(TIERS).map(([name, config]) => {
                const isActive = name === currentTier;
                const isUnlocked = (stats?.total_customers || 0) >= config.minCustomers;
                
                return (
                  <div 
                    key={name}
                    className={`p-4 rounded-xl text-center transition-all ${
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
                    <span className="text-2xl">{config.emoji}</span>
                    <p className="font-bold text-white mt-1">{name}</p>
                    <p className="text-xs" style={{ color: config.color }}>
                      {config.minCustomers === 0 ? '0-10' : `${config.minCustomers}+`} Kunden
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
    </div>
  );
}
