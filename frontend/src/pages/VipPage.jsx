/**
 * BidBlitz V2 - VIP Subscriptions Page
 * Premium subscription plans with real wallet payment
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Star, Crown, Check, Zap, Shield, Gift,
  TrendingUp, Loader2, AlertCircle, Sparkles
} from 'lucide-react';
import { useI18n, useUser } from '../store';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const PLAN_ICONS = {
  basic: Star,
  premium: Crown,
  pro: Zap,
};

export default function VipPage({ onBack, onNavigate }) {
  const { t } = useI18n();
  const user = useUser();
  
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [balance, setBalance] = useState(0);

  // Fetch plans and current subscription
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, subRes, balRes] = await Promise.all([
          fetch(`${API}/api/subscription/plans`),
          fetch(`${API}/api/subscription/my`, { credentials: 'include' }),
          fetch(`${API}/api/wallet/balance`, { credentials: 'include' })
        ]);
        
        if (plansRes.ok) {
          const data = await plansRes.json();
          setPlans(data.plans || []);
        }
        
        if (subRes.ok) {
          const data = await subRes.json();
          setCurrentSub(data.has_subscription ? data.subscription : null);
        }
        
        if (balRes.ok) {
          const data = await balRes.json();
          setBalance(data.balance || 0);
        }
      } catch (e) {
        console.error('Failed to load subscription data', e);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleBuy = async (planId) => {
    const plan = plans.find(p => p.id === planId);
    const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    
    if (balance < price) {
      toast.error(`Nicht genug Guthaben. €${price.toFixed(2)} benötigt.`);
      return;
    }

    setBuying(planId);
    try {
      const res = await fetch(`${API}/api/subscription/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plan: planId,
          billing_cycle: billingCycle,
          auto_renew: true
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        toast.success(`${plan.name} aktiviert!`);
        setCurrentSub(data.subscription);
        setBalance(data.new_balance);
      } else {
        toast.error(data.detail || 'Kauf fehlgeschlagen');
      }
    } catch (e) {
      toast.error('Verbindungsfehler');
    }
    setBuying(null);
  };

  const handleCancel = async () => {
    if (!currentSub) return;
    
    try {
      const res = await fetch(`${API}/api/subscription/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'User cancelled' })
      });
      
      const data = await res.json();
      
      if (res.ok && data.ok) {
        toast.success('Abo gekündigt');
        setCurrentSub({ ...currentSub, auto_renew: false });
      }
    } catch (e) {
      toast.error('Fehler beim Kündigen');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={32} className="text-[#00C2FF] animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      data-testid="vip-page"
      className="min-h-screen pb-20"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-4">
        <div className="flex items-center gap-3">
          <motion.button
            data-testid="vip-back-btn"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft size={16} className="text-white/50" />
          </motion.button>
          <div>
            <h1 className="text-[18px] font-semibold text-white font-outfit flex items-center gap-2">
              VIP Subscriptions
              <Crown size={16} className="text-[#FFD700]" />
            </h1>
            <p className="text-[11px] text-[#444]">Premium-Vorteile freischalten</p>
          </div>
        </div>
      </div>

      <div className="px-5">
        {/* Current Balance */}
        <motion.div
          className="rounded-xl p-4 mb-5 flex items-center justify-between"
          style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.1)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <p className="text-[10px] text-[#555] uppercase">Dein Guthaben</p>
            <p className="text-[20px] font-bold text-white">€{balance.toFixed(2)}</p>
          </div>
          <motion.button
            onClick={() => onNavigate?.('/wallet')}
            className="px-4 py-2 rounded-lg text-[11px] font-semibold"
            style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}
            whileTap={{ scale: 0.95 }}
          >
            Aufladen
          </motion.button>
        </motion.div>

        {/* Current Subscription */}
        {currentSub && (
          <motion.div
            className="rounded-2xl p-5 mb-5"
            style={{ 
              background: `linear-gradient(135deg, ${currentSub.plan === 'pro' ? '#FFD700' : currentSub.plan === 'premium' ? '#A855F7' : '#3B82F6'}15, transparent)`,
              border: `1px solid ${currentSub.plan === 'pro' ? '#FFD700' : currentSub.plan === 'premium' ? '#A855F7' : '#3B82F6'}30`
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Crown size={18} style={{ color: currentSub.plan === 'pro' ? '#FFD700' : currentSub.plan === 'premium' ? '#A855F7' : '#3B82F6' }} />
                <span className="text-[14px] font-bold text-white">{currentSub.plan_name} Aktiv</span>
              </div>
              <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase" 
                style={{ background: "rgba(0,210,106,0.15)", color: "#00D26A" }}>
                AKTIV
              </span>
            </div>
            <p className="text-[11px] text-[#555] mb-3">
              Läuft bis: {new Date(currentSub.expires_at).toLocaleDateString('de-DE')}
            </p>
            <div className="flex gap-2">
              {currentSub.auto_renew && (
                <motion.button
                  onClick={handleCancel}
                  className="px-3 py-2 rounded-lg text-[10px] font-semibold"
                  style={{ background: "rgba(255,71,87,0.1)", color: "#FF4757" }}
                  whileTap={{ scale: 0.95 }}
                >
                  Kündigen
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <motion.button
            onClick={() => setBillingCycle('monthly')}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold"
            style={{ 
              background: billingCycle === 'monthly' ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.03)",
              color: billingCycle === 'monthly' ? "#00C2FF" : "#555"
            }}
            whileTap={{ scale: 0.95 }}
          >
            Monatlich
          </motion.button>
          <motion.button
            onClick={() => setBillingCycle('yearly')}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold flex items-center gap-1"
            style={{ 
              background: billingCycle === 'yearly' ? "rgba(0,210,106,0.15)" : "rgba(255,255,255,0.03)",
              color: billingCycle === 'yearly' ? "#00D26A" : "#555"
            }}
            whileTap={{ scale: 0.95 }}
          >
            Jährlich
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00D26A]/20 text-[#00D26A]">-17%</span>
          </motion.button>
        </div>

        {/* Plans */}
        <div className="space-y-4">
          {plans.map((plan, i) => {
            const Icon = PLAN_ICONS[plan.id] || Star;
            const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
            const isCurrentPlan = currentSub?.plan === plan.id;
            const canUpgrade = currentSub && plans.findIndex(p => p.id === currentSub.plan) < i;

            return (
              <motion.div
                key={plan.id}
                data-testid={`plan-${plan.id}`}
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{ 
                  background: plan.id === 'pro' 
                    ? "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,140,0,0.04))" 
                    : "rgba(255,255,255,0.02)", 
                  border: `1px solid ${plan.color}30`
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                {plan.id === 'premium' && (
                  <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-[8px] font-bold uppercase"
                    style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}>
                    BELIEBT
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${plan.color}15`, border: `1px solid ${plan.color}25` }}>
                    <Icon size={22} style={{ color: plan.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[16px] font-bold text-white mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-[24px] font-bold text-white">€{price.toFixed(2)}</span>
                      <span className="text-[11px] text-[#555]">/{billingCycle === 'yearly' ? 'Jahr' : 'Monat'}</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-[10px] text-[#00D26A] mb-3">
                        Spare €{plan.yearly_savings?.toFixed(2) || ((plan.price_monthly * 12) - plan.price_yearly).toFixed(2)}/Jahr
                      </p>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="mt-4 space-y-2">
                  {plan.features?.slice(0, 4).map((feature, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <Check size={12} style={{ color: plan.color }} />
                      <span className="text-[11px] text-[#888]">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <motion.button
                  onClick={() => !isCurrentPlan && handleBuy(plan.id)}
                  disabled={buying === plan.id || isCurrentPlan}
                  className="w-full mt-4 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
                  style={{ 
                    background: isCurrentPlan ? "rgba(255,255,255,0.03)" : `${plan.color}20`,
                    color: isCurrentPlan ? "#555" : plan.color,
                    border: `1px solid ${isCurrentPlan ? "transparent" : plan.color}30`
                  }}
                  whileTap={!isCurrentPlan ? { scale: 0.97 } : {}}
                >
                  {buying === plan.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isCurrentPlan ? (
                    <>
                      <Check size={14} />
                      Aktueller Plan
                    </>
                  ) : canUpgrade ? (
                    <>
                      <TrendingUp size={14} />
                      Upgrade
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Jetzt kaufen
                    </>
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* Benefits Overview */}
        <motion.div
          className="mt-6 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-[13px] font-semibold text-white mb-4 flex items-center gap-2">
            <Gift size={14} className="text-[#FFD700]" />
            VIP Vorteile
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Zap, label: "Reduzierte Gebühren", color: "#00C2FF" },
              { icon: Gift, label: "Gratis Boosts", color: "#00D26A" },
              { icon: Shield, label: "Priority Support", color: "#A855F7" },
              { icon: TrendingUp, label: "Höherer Cashback", color: "#FFB800" },
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <benefit.icon size={14} style={{ color: benefit.color }} />
                <span className="text-[10px] text-[#888]">{benefit.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
