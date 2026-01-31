import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Star, TrendingUp, Users, DollarSign, BarChart3, 
  Copy, Check, Eye, ShoppingCart, Calendar, ArrowRight,
  Instagram, Youtube, Clock, Zap, Gift, LogOut, Gavel, Crown
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function InfluencerDashboard() {
  const navigate = useNavigate();
  const { loginAsInfluencer, logout: authLogout, user: authUser, isInfluencer } = useAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [influencer, setInfluencer] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Login form
  const [loginCode, setLoginCode] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  
  // Check if already logged in (either via localStorage or AuthContext)
  useEffect(() => {
    // If logged in via AuthContext as influencer
    if (authUser && isInfluencer) {
      const savedInfluencer = localStorage.getItem('influencer_data');
      if (savedInfluencer) {
        try {
          const data = JSON.parse(savedInfluencer);
          setInfluencer(data);
          setIsLoggedIn(true);
          fetchStats(data.code);
        } catch (e) {
          localStorage.removeItem('influencer_data');
        }
      }
    } else {
      // Check localStorage for influencer data
      const savedInfluencer = localStorage.getItem('influencer_data');
      if (savedInfluencer) {
        try {
          const data = JSON.parse(savedInfluencer);
          setInfluencer(data);
          setIsLoggedIn(true);
          fetchStats(data.code);
        } catch (e) {
          localStorage.removeItem('influencer_data');
        }
      }
    }
  }, [authUser, isInfluencer]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate influencer code and email
      const response = await axios.post(`${API}/influencer/login`, {
        code: loginCode.toLowerCase(),
        email: loginEmail
      });
      
      if (response.data.success) {
        // Save influencer data
        setInfluencer(response.data.influencer);
        setIsLoggedIn(true);
        localStorage.setItem('influencer_data', JSON.stringify(response.data.influencer));
        
        // Login to AuthContext with JWT token (enables bidding, VIP features)
        if (response.data.token && response.data.user) {
          loginAsInfluencer(response.data.token, response.data.user);
        }
        
        toast.success('Erfolgreich eingeloggt! Sie haben jetzt VIP-Zugang.');
        fetchStats(response.data.influencer.code);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login fehlgeschlagen. Bitte prüfen Sie Ihren Code und E-Mail.');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStats = async (code) => {
    try {
      const response = await axios.get(`${API}/influencer/stats/${code}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('influencer_data');
    authLogout(); // Also logout from AuthContext
    setIsLoggedIn(false);
    setInfluencer(null);
    setStats(null);
    toast.success('Ausgeloggt');
    navigate('/');
  };
  
  const copyCode = () => {
    if (influencer?.code) {
      navigator.clipboard.writeText(influencer.code);
      setCopied(true);
      toast.success('Code kopiert!');
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const copyLink = () => {
    const link = `https://bidblitz.de/register?ref=${influencer?.code}`;
    navigator.clipboard.writeText(link);
    toast.success('Link kopiert!');
  };
  
  // Login Page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4" data-testid="influencer-login">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mx-auto mb-4">
              <Star className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Influencer Login</h1>
            <p className="text-gray-400">
              Melden Sie sich an, um Ihre Statistiken und Einnahmen zu sehen
            </p>
          </div>
          
          {/* Login Form */}
          <div className="glass-card rounded-2xl p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label className="text-white">Ihr Influencer-Code</Label>
                <Input
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="z.B. maxpower"
                  className="bg-[#181824] border-white/10 text-white"
                  required
                />
              </div>
              <div>
                <Label className="text-white">E-Mail-Adresse</Label>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ihre@email.de"
                  className="bg-[#181824] border-white/10 text-white"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !loginCode || !loginEmail}
                className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold"
              >
                {loading ? 'Wird geprüft...' : 'Anmelden'}
              </Button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-gray-400 text-sm mb-3">Noch kein Influencer?</p>
              <Link to="/influencer-werden">
                <Button variant="outline" className="border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10">
                  Jetzt Partner werden →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Dashboard
  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="influencer-dashboard">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                <Star className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{influencer?.name}</h1>
                <p className="text-gray-400 flex items-center gap-2">
                  <span>Code:</span>
                  <code className="bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded font-bold">
                    {influencer?.code}
                  </code>
                  <button onClick={copyCode} className="text-yellow-400 hover:text-yellow-300">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </p>
              </div>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-white/20 text-white">
            <LogOut className="w-4 h-4 mr-2" />
            Ausloggen
          </Button>
        </div>
        
        {/* VIP Status Banner */}
        <div className="glass-card rounded-xl p-4 mb-6 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-bold flex items-center gap-2">
                  VIP-Status aktiv
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">KOSTENLOS</span>
                </p>
                <p className="text-gray-400 text-sm">Als Influencer haben Sie unbegrenzten VIP-Zugang!</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/auctions">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
                  <Gavel className="w-4 h-4 mr-2" />
                  Auktionen
                </Button>
              </Link>
              <Link to="/vip-auctions">
                <Button className="bg-purple-500 hover:bg-purple-600 text-white">
                  <Crown className="w-4 h-4 mr-2" />
                  VIP-Auktionen
                </Button>
              </Link>
              <Link to="/buy-bids">
                <Button className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Gebote kaufen
                </Button>
              </Link>
            </div>
          </div>
          {authUser && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-4">
              <span className="text-gray-400 text-sm">Ihr Guthaben:</span>
              <span className="text-2xl font-bold text-cyan-400">{authUser.bids_balance || 0} Gebote</span>
            </div>
          )}
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-400 text-sm">Code-Nutzungen</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.total_uses || 0}</p>
          </div>
          
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <ShoppingCart className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Käufe</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.total_purchases || 0}</p>
          </div>
          
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Generierter Umsatz</span>
            </div>
            <p className="text-3xl font-bold text-green-400">€{(stats?.total_revenue || 0).toFixed(2)}</p>
          </div>
          
          <div className="glass-card rounded-xl p-5 bg-gradient-to-br from-yellow-400/10 to-amber-500/10 border border-yellow-400/30">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 text-sm">Ihre Provision</span>
            </div>
            <p className="text-3xl font-bold text-yellow-400">€{(stats?.total_commission || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{influencer?.commission_percent || 10}% Provision</p>
          </div>
        </div>
        
        {/* Promo Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Share Link */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Ihr Empfehlungslink
            </h3>
            <div className="bg-[#181824] rounded-lg p-3 flex items-center gap-2">
              <code className="text-cyan-400 text-sm flex-1 truncate">
                https://bidblitz.de/register?ref={influencer?.code}
              </code>
              <Button size="sm" onClick={copyLink} className="bg-cyan-500 hover:bg-cyan-600">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-gray-400 text-sm mt-3">
              Teilen Sie diesen Link mit Ihren Followern. Bei jeder Registrierung und Kauf erhalten Sie Provision!
            </p>
          </div>
          
          {/* Code Promo */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-400" />
              Rabattcode für Follower
            </h3>
            <div className="bg-gradient-to-r from-yellow-400/20 to-amber-500/20 rounded-lg p-4 text-center border border-yellow-400/30">
              <p className="text-gray-400 text-sm mb-1">Mit Code</p>
              <p className="text-3xl font-black text-yellow-400">{influencer?.code?.toUpperCase()}</p>
              <p className="text-white text-sm mt-1">5% Rabatt auf den ersten Kauf!</p>
            </div>
            <p className="text-gray-400 text-sm mt-3">
              Ihre Follower geben den Code beim Checkout ein und sparen!
            </p>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Letzte Aktivitäten
          </h3>
          
          {stats?.recent_uses && stats.recent_uses.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_uses.map((use, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white">{use.user_name || 'Neuer Nutzer'}</p>
                      <p className="text-gray-500 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(use.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  {use.purchase_amount > 0 && (
                    <span className="text-green-400 font-bold">+€{use.purchase_amount.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Noch keine Aktivitäten</p>
              <p className="text-sm mt-1">Teilen Sie Ihren Code, um Einnahmen zu generieren!</p>
            </div>
          )}
        </div>
        
        {/* Social Profiles */}
        {(influencer?.instagram || influencer?.youtube || influencer?.tiktok) && (
          <div className="mt-6 flex items-center justify-center gap-4">
            {influencer.instagram && (
              <a href={`https://instagram.com/${influencer.instagram}`} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-pink-400 transition-colors">
                <Instagram className="w-6 h-6" />
              </a>
            )}
            {influencer.youtube && (
              <a href={`https://youtube.com/${influencer.youtube}`} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-red-500 transition-colors">
                <Youtube className="w-6 h-6" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
