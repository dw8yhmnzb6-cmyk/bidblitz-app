import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  Crown, 
  Check, 
  Sparkles, 
  Zap, 
  Gift,
  Shield,
  Star,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VIPBadge = ({ color, size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  return (
    <div 
      className={`${sizes[size]} rounded-full flex items-center justify-center`}
      style={{ backgroundColor: color }}
    >
      <Crown className={`${size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} text-black`} />
    </div>
  );
};

export default function VIP() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [vipStatus, setVipStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);

  useEffect(() => {
    fetchData();
    
    // Handle success redirect
    const sessionId = searchParams.get('session_id');
    if (sessionId && token) {
      activateSubscription(sessionId);
    }
    
    // Handle cancellation
    if (searchParams.get('canceled')) {
      toast.error('Zahlung abgebrochen');
    }
  }, [searchParams, token]);

  const fetchData = async () => {
    try {
      const [plansRes, statusRes] = await Promise.all([
        axios.get(`${API}/vip/plans`),
        token ? axios.get(`${API}/vip/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { is_vip: false } })) : Promise.resolve({ data: { is_vip: false } })
      ]);
      
      setPlans(plansRes.data);
      setVipStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching VIP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activateSubscription = async (sessionId) => {
    try {
      const response = await axios.post(
        `${API}/vip/activate?session_id=${sessionId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      fetchData();
      // Remove session_id from URL
      navigate('/vip', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Aktivierung fehlgeschlagen');
    }
  };

  const handleSubscribe = async (planId) => {
    if (!token) {
      toast.error('Bitte melden Sie sich an');
      navigate('/login');
      return;
    }
    
    setSubscribing(planId);
    
    try {
      const response = await axios.post(
        `${API}/vip/subscribe/${planId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      window.location.href = response.data.url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen des Abos');
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Möchten Sie Ihr VIP-Abo wirklich kündigen?')) return;
    
    try {
      const response = await axios.post(
        `${API}/vip/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kündigung fehlgeschlagen');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0d2538] pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0d2538] pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] flex items-center justify-center mx-auto mb-4">
            <Crown className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            VIP <span className="text-[#FFD700]">Mitgliedschaft</span>
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Werden Sie VIP und erhalten Sie jeden Monat Gratis-Gebote, exklusive Rabatte und mehr!
          </p>
        </div>

        {/* Current VIP Status */}
        {vipStatus?.is_vip && (
          <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 border border-[#FFD700]/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <VIPBadge color={vipStatus.badge_color} size="lg" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Sie sind {vipStatus.plan?.name}!
                  </h3>
                  <p className="text-gray-400">
                    {vipStatus.monthly_bids_remaining} Gratis-Gebote noch verfügbar diesen Monat
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Nächste Erneuerung</p>
                <p className="text-white font-semibold">
                  {new Date(vipStatus.next_renewal).toLocaleDateString('de-DE')}
                </p>
                <button 
                  onClick={handleCancel}
                  className="text-red-400 text-sm hover:underline mt-2"
                >
                  Abo kündigen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIP Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, index) => {
            const isCurrentPlan = vipStatus?.plan_id === plan.id;
            
            return (
              <div 
                key={plan.id}
                className={`relative rounded-2xl p-6 border transition-all ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-[#FFD700]/10 to-[#0d2538] border-[#FFD700]/50 scale-105' 
                    : 'bg-[#1a3a52]/50 border-gray-700/50 hover:border-gray-600'
                } ${isCurrentPlan ? 'ring-2 ring-[#FFD700]' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FFD700] text-black text-xs font-bold rounded-full">
                    BELIEBT
                  </div>
                )}
                
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                    AKTIV
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-4">
                  <VIPBadge color={plan.badge_color} />
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                </div>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">€{plan.price_monthly.toFixed(2)}</span>
                  <span className="text-gray-400">/Monat</span>
                </div>
                
                <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-[#FFD700]/10">
                  <Gift className="w-5 h-5 text-[#FFD700]" />
                  <span className="text-[#FFD700] font-bold">{plan.monthly_bids} Gratis-Gebote</span>
                  <span className="text-gray-400 text-sm">/Monat</span>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{benefit}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrentPlan || subscribing === plan.id}
                  className={`w-full py-3 font-bold ${
                    plan.popular 
                      ? 'bg-[#FFD700] hover:bg-[#FCD34D] text-black'
                      : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
                  }`}
                >
                  {subscribing === plan.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Wird verarbeitet...
                    </>
                  ) : isCurrentPlan ? (
                    'Aktuelles Abo'
                  ) : (
                    <>
                      Jetzt VIP werden
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Benefits Overview */}
        <div className="bg-[#1a3a52]/30 rounded-2xl p-8 border border-gray-700/50">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Warum VIP werden?
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-3">
                <Gift className="w-7 h-7 text-[#FFD700]" />
              </div>
              <h4 className="text-white font-semibold mb-1">Gratis-Gebote</h4>
              <p className="text-gray-400 text-sm">Jeden Monat neue Gebote automatisch auf Ihr Konto</p>
            </div>
            
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-green-400" />
              </div>
              <h4 className="text-white font-semibold mb-1">Rabatte</h4>
              <p className="text-gray-400 text-sm">Bis zu 15% Rabatt auf alle Gebotspakete</p>
            </div>
            
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-purple-400" />
              </div>
              <h4 className="text-white font-semibold mb-1">Exklusiv</h4>
              <p className="text-gray-400 text-sm">Zugang zu exklusiven Auktionen nur für VIPs</p>
            </div>
            
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-7 h-7 text-cyan-400" />
              </div>
              <h4 className="text-white font-semibold mb-1">Support</h4>
              <p className="text-gray-400 text-sm">Prioritäts-Support für alle Ihre Fragen</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 text-center">
          <p className="text-gray-400">
            Fragen zu VIP? <a href="/faq" className="text-[#FFD700] hover:underline">Hier finden Sie Antworten</a>
          </p>
        </div>
      </div>
    </div>
  );
}
