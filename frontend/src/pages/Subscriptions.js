import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Crown, Check, Zap, Gift, Star, Shield, 
  Clock, Sparkles, ChevronRight, X
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const Subscriptions = () => {
  const { token, isAuthenticated, user } = useAuth();
  const { language } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  const texts = {
    de: {
      title: 'Gebot-Abonnements',
      subtitle: 'Jeden Monat automatisch Gebote erhalten und sparen!',
      monthly: '/Monat',
      bidsMonth: 'Gebote/Monat',
      savings: 'Ersparnis',
      currentPlan: 'Aktueller Plan',
      subscribe: 'Jetzt abonnieren',
      cancel: 'Kündigen',
      cancelConfirm: 'Abo zum Ende der Periode kündigen?',
      features: 'Vorteile',
      popular: 'Beliebt',
      premium: 'Premium',
      vipPlus: 'VIP+',
      vipPlusDesc: 'Das ultimative Paket für Power-Bieter',
      loginRequired: 'Bitte einloggen um zu abonnieren',
      renewsOn: 'Verlängert am',
      cancelingAt: 'Endet am',
      noPlan: 'Kein aktives Abo'
    },
    en: {
      title: 'Bid Subscriptions',
      subtitle: 'Receive bids automatically every month and save!',
      monthly: '/month',
      bidsMonth: 'bids/month',
      savings: 'Savings',
      currentPlan: 'Current Plan',
      subscribe: 'Subscribe Now',
      cancel: 'Cancel',
      cancelConfirm: 'Cancel subscription at end of period?',
      features: 'Features',
      popular: 'Popular',
      premium: 'Premium',
      vipPlus: 'VIP+',
      vipPlusDesc: 'The ultimate package for power bidders',
      loginRequired: 'Please login to subscribe',
      renewsOn: 'Renews on',
      cancelingAt: 'Ends on',
      noPlan: 'No active subscription'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    fetchPlans();
    if (isAuthenticated) {
      fetchCurrentSubscription();
    }
  }, [isAuthenticated]);

  const fetchPlans = async () => {
    try {
      const res = await axios.get(`${API}/api/subscriptions/plans`);
      setPlans(res.data.plans || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const res = await axios.get(`${API}/api/subscriptions/my-subscription`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentSub(res.data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
    }
  };

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      toast.error(t.loginRequired);
      return;
    }

    setSubscribing(true);
    try {
      const res = await axios.post(`${API}/api/subscriptions/subscribe/${planId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Abonnieren');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(t.cancelConfirm)) return;

    try {
      await axios.post(`${API}/api/subscriptions/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Abo wird zum Ende der Periode gekündigt');
      fetchCurrentSubscription();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'starter': return <Zap className="w-6 h-6" />;
      case 'pro': return <Star className="w-6 h-6" />;
      case 'vip_plus': return <Crown className="w-6 h-6" />;
      default: return <Gift className="w-6 h-6" />;
    }
  };

  const getPlanGradient = (planId) => {
    switch (planId) {
      case 'starter': return 'from-blue-500 to-cyan-500';
      case 'pro': return 'from-purple-500 to-pink-500';
      case 'vip_plus': return 'from-yellow-400 to-orange-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-white rounded w-1/3 mx-auto"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-96 bg-white rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="subscriptions-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 mb-4">
            <Gift className="w-5 h-5 text-purple-400" />
            <span className="text-gray-800 font-bold">Abo-Pläne</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            {t.title}
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Current Subscription */}
        {currentSub?.has_subscription && (
          <div className="glass-card rounded-xl p-6 mb-8 border border-purple-500/30">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPlanGradient(currentSub.subscription?.plan_id)} flex items-center justify-center`}>
                  {getPlanIcon(currentSub.subscription?.plan_id)}
                </div>
                <div>
                  <p className="text-gray-500 text-sm">{t.currentPlan}</p>
                  <h3 className="text-xl font-bold text-gray-800">{currentSub.plan?.name}</h3>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-gray-500 text-sm">
                    {currentSub.subscription?.cancel_at_period_end ? t.cancelingAt : t.renewsOn}
                  </p>
                  <p className="text-gray-800 font-medium">
                    {new Date(currentSub.subscription?.current_period_end).toLocaleDateString()}
                  </p>
                </div>
                {!currentSub.subscription?.cancel_at_period_end && (
                  <Button variant="outline" onClick={handleCancel}>
                    {t.cancel}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const isCurrentPlan = currentSub?.subscription?.plan_id === plan.id;
            const isVipPlus = plan.id === 'vip_plus';
            const isPro = plan.id === 'pro';

            return (
              <div
                key={plan.id}
                className={`relative glass-card rounded-2xl p-6 transition-all ${
                  isVipPlus 
                    ? 'border-2 border-yellow-500/50 hover:border-yellow-500' 
                    : isPro 
                      ? 'border-2 border-purple-500/50 hover:border-purple-500'
                      : 'hover:border-gray-300'
                }`}
              >
                {/* Popular Badge */}
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                    <span className="text-gray-800 text-sm font-bold">{t.popular}</span>
                  </div>
                )}

                {/* VIP+ Badge */}
                {isVipPlus && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
                    <span className="text-black text-sm font-bold">{t.premium}</span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6 pt-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getPlanGradient(plan.id)} flex items-center justify-center mx-auto mb-4`}>
                    {getPlanIcon(plan.id)}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-1">{plan.name}</h3>
                  {isVipPlus && (
                    <p className="text-gray-500 text-sm">{t.vipPlusDesc}</p>
                  )}
                </div>

                {/* Pricing */}
                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-gray-800">€{plan.price}</span>
                    <span className="text-gray-500">{t.monthly}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-bold">
                      {plan.bids_per_month} {t.bidsMonth}
                    </span>
                  </div>
                  <div className="mt-1 text-green-400 font-medium">
                    {plan.savings_percent}% {t.savings}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  {plan.features?.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 ${
                        isVipPlus ? 'text-yellow-400' : isPro ? 'text-purple-400' : 'text-green-400'
                      }`} />
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={subscribing || isCurrentPlan}
                  className={`w-full ${
                    isVipPlus 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:from-yellow-300' 
                      : isPro
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                        : ''
                  }`}
                >
                  {isCurrentPlan ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {t.currentPlan}
                    </>
                  ) : (
                    <>
                      {t.subscribe}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* VIP+ Benefits Section */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              <Crown className="w-8 h-8 text-yellow-400 inline-block mr-2" />
              {t.vipPlus} - Exklusive Vorteile
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-4 text-center border border-yellow-500/20">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </div>
              <h4 className="text-gray-800 font-bold">3x Glücksrad</h4>
              <p className="text-gray-500 text-sm">Pro Tag drehen</p>
            </div>

            <div className="glass-card rounded-xl p-4 text-center border border-yellow-500/20">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
                <Gift className="w-6 h-6 text-yellow-400" />
              </div>
              <h4 className="text-gray-800 font-bold">15% Rabatt</h4>
              <p className="text-gray-500 text-sm">Auf Sofort-Kauf</p>
            </div>

            <div className="glass-card rounded-xl p-4 text-center border border-yellow-500/20">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
                <Crown className="w-6 h-6 text-yellow-400" />
              </div>
              <h4 className="text-gray-800 font-bold">VIP+ Auktionen</h4>
              <p className="text-gray-500 text-sm">Exklusiver Zugang</p>
            </div>

            <div className="glass-card rounded-xl p-4 text-center border border-yellow-500/20">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
              <h4 className="text-gray-800 font-bold">5min Vorsprung</h4>
              <p className="text-gray-500 text-sm">Bei Flash-Auktionen</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscriptions;
