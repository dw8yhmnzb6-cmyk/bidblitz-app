import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Crown, Check, Zap, Star, Shield, Sparkles, Calendar, ArrowRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SubscriptionPage() {
  const { language } = useLanguage();
  const { token, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  const texts = {
    de: {
      title: 'Gebot-Abo',
      subtitle: 'Spare mit monatlichen Gebotspaketen',
      description: 'Hol dir jeden Monat automatisch neue Gebote zu reduzierten Preisen!',
      popular: 'Beliebt',
      perMonth: '/Monat',
      bidsPerMonth: 'Gebote pro Monat',
      bonusBids: 'Bonus-Gebote',
      vipAccess: 'VIP-Zugang',
      prioritySupport: 'Prioritäts-Support',
      exclusiveAuctions: 'Exklusive Auktionen',
      subscribe: 'Jetzt abonnieren',
      cancel: 'Kündigen',
      reactivate: 'Reaktivieren',
      currentPlan: 'Dein aktuelles Abo',
      noPlan: 'Kein aktives Abo',
      nextRenewal: 'Nächste Verlängerung',
      daysLeft: 'Tage übrig',
      cancelInfo: 'Abo wird zum Ende der Laufzeit gekündigt',
      features: 'Features',
      loginRequired: 'Bitte melde dich an um ein Abo abzuschließen',
      total: 'Gesamt Gebote'
    },
    en: {
      title: 'Bid Subscription',
      subtitle: 'Save with monthly bid packages',
      description: 'Get new bids automatically every month at reduced prices!',
      popular: 'Popular',
      perMonth: '/month',
      bidsPerMonth: 'Bids per month',
      bonusBids: 'Bonus bids',
      vipAccess: 'VIP Access',
      prioritySupport: 'Priority Support',
      exclusiveAuctions: 'Exclusive Auctions',
      subscribe: 'Subscribe Now',
      cancel: 'Cancel',
      reactivate: 'Reactivate',
      currentPlan: 'Your current subscription',
      noPlan: 'No active subscription',
      nextRenewal: 'Next renewal',
      daysLeft: 'days left',
      cancelInfo: 'Subscription will be canceled at end of period',
      features: 'Features',
      loginRequired: 'Please log in to subscribe',
      total: 'Total Bids'
    }
  };

  const t = texts[language] || texts.de;

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/api/subscription/plans`);
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMySubscription = async () => {
    try {
      const res = await fetch(`${API_URL}/api/subscription/my-subscription`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.has_subscription) {
        setMySubscription(data.subscription);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlans();
    if (token) {
      fetchMySubscription();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      toast.error(t.loginRequired);
      return;
    }

    setPurchasing(planId);
    try {
      const res = await fetch(`${API_URL}/api/subscription/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan_id: planId })
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Abonnieren');
    }
    setPurchasing(null);
  };

  const handleCancel = async () => {
    try {
      const res = await fetch(`${API_URL}/api/subscription/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchMySubscription();
      }
    } catch (err) {
      toast.error('Fehler beim Kündigen');
    }
  };

  const handleReactivate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/subscription/reactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchMySubscription();
      }
    } catch (err) {
      toast.error('Fehler beim Reaktivieren');
    }
  };

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'basic': return <Zap className="w-8 h-8" />;
      case 'pro': return <Star className="w-8 h-8" />;
      case 'elite': return <Crown className="w-8 h-8" />;
      default: return <Sparkles className="w-8 h-8" />;
    }
  };

  const getPlanColor = (planId) => {
    switch (planId) {
      case 'basic': return 'from-blue-500 to-cyan-500';
      case 'pro': return 'from-purple-500 to-pink-500';
      case 'elite': return 'from-yellow-500 to-orange-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D14] py-8 px-4" data-testid="subscription-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#F59E0B] mb-4">
            <Calendar className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-xl text-[#7C3AED]">{t.subtitle}</p>
          <p className="text-[#94A3B8] mt-2 max-w-xl mx-auto">{t.description}</p>
        </div>

        {/* Current Subscription */}
        {mySubscription && (
          <Card className="bg-gradient-to-r from-[#7C3AED]/20 to-[#10B981]/20 border-[#7C3AED]/30 mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getPlanColor(mySubscription.plan_id)} flex items-center justify-center`}>
                    {getPlanIcon(mySubscription.plan_id)}
                  </div>
                  <div>
                    <h3 className="text-white text-xl font-bold">{t.currentPlan}: {mySubscription.plan_name}</h3>
                    <p className="text-[#94A3B8]">
                      {mySubscription.bids_remaining} Gebote übrig • {mySubscription.days_until_renewal} {t.daysLeft}
                    </p>
                    {mySubscription.status === 'canceling' && (
                      <p className="text-yellow-400 text-sm mt-1">{t.cancelInfo}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {mySubscription.status === 'active' ? (
                    <Button 
                      variant="outline"
                      onClick={handleCancel}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      {t.cancel}
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleReactivate}
                      className="bg-gradient-to-r from-[#10B981] to-[#059669]"
                    >
                      {t.reactivate}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        {loading ? (
          <div className="text-center py-12 text-[#94A3B8]">Laden...</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`bg-[#1A1A2E] border-white/10 relative overflow-hidden ${
                  plan.popular ? 'ring-2 ring-[#7C3AED] scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-[#7C3AED] text-white">
                      <Star className="w-3 h-3 mr-1" />
                      {t.popular}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-0">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getPlanColor(plan.id)} mx-auto mb-4 flex items-center justify-center text-white`}>
                    {getPlanIcon(plan.id)}
                  </div>
                  <CardTitle className="text-white text-2xl">
                    {language === 'de' ? plan.name_de : plan.name}
                  </CardTitle>
                  <div className="mt-2">
                    <span className="text-4xl font-bold text-white">€{plan.price}</span>
                    <span className="text-[#94A3B8]">{t.perMonth}</span>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-6">
                  {/* Total Bids */}
                  <div className="bg-[#0D0D14] rounded-lg p-4 mb-4 text-center">
                    <p className="text-[#94A3B8] text-sm">{t.total}</p>
                    <p className="text-3xl font-bold text-[#10B981]">
                      {plan.total_bids}
                    </p>
                    <p className="text-[#94A3B8] text-xs">
                      {plan.bids_per_month} + {plan.bonus_bids} Bonus
                    </p>
                  </div>
                  
                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {(language === 'de' ? plan.features_de : plan.features_en)?.map((feature, i) => (
                      <li key={i} className="flex items-center text-[#94A3B8]">
                        <Check className="w-4 h-4 text-[#10B981] mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                    {plan.vip_access && (
                      <li className="flex items-center text-[#FFD700]">
                        <Crown className="w-4 h-4 mr-2" />
                        {t.vipAccess}
                      </li>
                    )}
                    {plan.priority_support && (
                      <li className="flex items-center text-[#A855F7]">
                        <Shield className="w-4 h-4 mr-2" />
                        {t.prioritySupport}
                      </li>
                    )}
                    {plan.exclusive_auctions && (
                      <li className="flex items-center text-[#F59E0B]">
                        <Sparkles className="w-4 h-4 mr-2" />
                        {t.exclusiveAuctions}
                      </li>
                    )}
                  </ul>
                  
                  <Button 
                    className={`w-full bg-gradient-to-r ${getPlanColor(plan.id)}`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={purchasing === plan.id || (mySubscription && mySubscription.status === 'active')}
                  >
                    {purchasing === plan.id ? 'Laden...' : t.subscribe}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
