/**
 * BidBlitz Premium
 * Canonical backend: /api/subscription
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Crown, Check, Loader2, Sparkles, Shield, BarChart3,
  Rocket, Repeat2, Wallet, BadgePercent,
} from "lucide-react";
import { toast } from "sonner";
import { isIOSBlocked } from "../utils/iosGuards";
import { IOSNotAvailable } from "../components/IOSNotAvailable";

const API = process.env.REACT_APP_BACKEND_URL;

const ICONS = [Shield, BadgePercent, Sparkles, BarChart3, Rocket, Repeat2];

export default function PremiumPage({ onBack }) {
  const [plan, setPlan] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [benefits, setBenefits] = useState(null);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [mutatingRenewal, setMutatingRenewal] = useState(false);
  const purchaseAttemptKeyRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        fetch(`${API}/api/subscription/plans`, { credentials: "include" }),
        fetch(`${API}/api/subscription/my`, { credentials: "include" }),
      ]);
      const plansJson = await plansRes.json().catch(() => ({}));
      const subJson = await subRes.json().catch(() => ({}));
      if (!plansRes.ok) throw new Error(plansJson.detail || "Premium-Pläne konnten nicht geladen werden");
      if (!subRes.ok) throw new Error(subJson.detail || "Abo-Status konnte nicht geladen werden");

      setPlan((plansJson.plans || []).find((item) => item.id === "premium") || null);
      setSubscription(subJson.has_subscription ? subJson.subscription : null);
      setBenefits(subJson.benefits || null);
    } catch (error) {
      toast.error(error.message || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { purchaseAttemptKeyRef.current = null; }, [billingCycle]);

  const purchase = async () => {
    if (!plan || subscription) return;
    if (!purchaseAttemptKeyRef.current) {
      purchaseAttemptKeyRef.current = typeof crypto?.randomUUID === "function"
        ? `premium-${crypto.randomUUID()}`
        : `premium-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const idempotencyKey = purchaseAttemptKeyRef.current;
    setPurchasing(true);
    try {
      const response = await fetch(`${API}/api/subscription/buy`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          plan: "premium",
          billing_cycle: billingCycle,
          auto_renew: true,
          idempotency_key: idempotencyKey,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Premium-Kauf fehlgeschlagen");

      purchaseAttemptKeyRef.current = null;
      toast.success(data.message || "Premium aktiviert");
      await load();
    } catch (error) {
      toast.error(error.message || "Premium-Kauf fehlgeschlagen");
    } finally {
      setPurchasing(false);
    }
  };

  const cancelAutoRenew = async () => {
    if (!subscription?.auto_renew) return;
    if (!window.confirm("Auto-Verlängerung wirklich deaktivieren? Die Vorteile bleiben bis zum Enddatum aktiv.")) return;
    setMutatingRenewal(true);
    try {
      const response = await fetch(`${API}/api/subscription/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "user_cancelled_auto_renew" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Kündigung fehlgeschlagen");
      toast.success(data.message || "Auto-Verlängerung deaktiviert");
      await load();
    } catch (error) {
      toast.error(error.message || "Kündigung fehlgeschlagen");
    } finally {
      setMutatingRenewal(false);
    }
  };

  const enableAutoRenew = async () => {
    if (subscription?.auto_renew) return;
    setMutatingRenewal(true);
    try {
      const response = await fetch(`${API}/api/subscription/toggle-auto-renew`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Auto-Verlängerung konnte nicht aktiviert werden");
      toast.success("Auto-Verlängerung aktiviert");
      await load();
    } catch (error) {
      toast.error(error.message || "Fehler");
    } finally {
      setMutatingRenewal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 size={24} className="animate-spin text-white/40" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="text-center">
          <Crown size={40} className="mx-auto text-[#FFB800] mb-3" />
          <p className="font-bold">Premium ist momentan nicht verfügbar.</p>
          <button onClick={onBack} className="mt-4 px-5 py-2 rounded-xl bg-white text-black font-bold">Zurück</button>
        </div>
      </div>
    );
  }

  const isPremium = subscription?.plan === "premium";
  const hasOtherPlan = !!subscription && !isPremium;
  const iosLocked = isIOSBlocked("premium-upgrade") && !subscription;
  const price = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;

  return (
    <div
      data-testid="premium-page"
      className="min-h-screen pb-24 text-white"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,184,0,0.18), transparent 50%), #050505" }}
    >
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#050505]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button
            onClick={onBack}
            data-testid="premium-back"
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}
          >
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <h1 className="text-[14px] font-bold">BidBlitz Premium</h1>
          <div className="w-9" />
        </div>
      </div>

      {iosLocked && <IOSNotAvailable feature="Premium-Kauf" testId="premium-ios-blocked" />}

      <div className={`p-4 space-y-4 ${iosLocked ? "pointer-events-none opacity-40" : ""}`}>
        <motion.div
          className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#FFD700 0%,#FFB800 40%,#FF8C42 100%)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Crown size={48} className="mx-auto text-black mb-2" strokeWidth={2.5} />
          <p className="text-[10px] font-black text-black/70 uppercase tracking-[0.2em]">
            {isPremium ? "Dein Abo" : "Upgrade"}
          </p>
          <p className="text-[32px] font-black text-black leading-none mt-1">
            {isPremium ? "Premium aktiv ✓" : "Premium"}
          </p>
          {isPremium && subscription?.expires_at ? (
            <>
              <p className="text-[12px] text-black/80 mt-2">
                Gültig bis {new Date(subscription.expires_at).toLocaleDateString("de-DE")}
              </p>
              <p className="text-[10px] text-black/70 mt-1">
                Auto-Verlängerung: {subscription.auto_renew ? "aktiv" : "aus"}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-black/80 mt-2 font-semibold">
              {plan.price_monthly.toFixed(2)} € / Monat · {plan.price_yearly.toFixed(2)} € / Jahr
            </p>
          )}
        </motion.div>

        <div className="grid grid-cols-2 gap-2">
          {(plan.features || []).map((feature, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <motion.div
                key={feature}
                className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2 bg-[#FFB800]/10 border border-[#FFB800]/20">
                  <Icon size={15} className="text-[#FFB800]" />
                </div>
                <p className="text-[12px] font-bold leading-tight">{feature}</p>
              </motion.div>
            );
          })}
        </div>

        {!subscription && (
          <>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
              <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider mb-3">Abrechnung</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "monthly", label: `${plan.price_monthly.toFixed(2)} €`, sub: "monatlich" },
                  { id: "yearly", label: `${plan.price_yearly.toFixed(2)} €`, sub: `jährlich · ${plan.yearly_savings.toFixed(2)} € sparen` },
                ].map((option) => (
                  <motion.button
                    key={option.id}
                    data-testid={`premium-cycle-${option.id}`}
                    onClick={() => setBillingCycle(option.id)}
                    className="py-3 rounded-xl border transition-all"
                    style={{
                      background: billingCycle === option.id ? "rgba(255,184,0,0.15)" : "rgba(255,255,255,0.02)",
                      borderColor: billingCycle === option.id ? "#FFB800" : "rgba(255,255,255,0.08)",
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <p className={`text-[15px] font-black ${billingCycle === option.id ? "text-[#FFB800]" : "text-white"}`}>
                      {option.label}
                    </p>
                    <p className="text-[9px] text-white/50 mt-0.5">{option.sub}</p>
                    {billingCycle === option.id && <Check size={12} className="inline-block text-[#FFB800] mt-1" />}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.05] p-3 flex items-center gap-2">
              <Wallet size={15} className="text-cyan-400" />
              <p className="text-[10px] text-white/60">Zahlung über dein BidBlitz EUR-Wallet · {price.toFixed(2)} €</p>
            </div>

            <motion.button
              data-testid="premium-purchase-btn"
              onClick={purchase}
              disabled={purchasing}
              className="w-full py-4 rounded-2xl font-black text-[14px] text-black flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#FFD700,#FFB800)" }}
              whileTap={{ scale: 0.97 }}
            >
              {purchasing ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
              {purchasing ? "Wird aktiviert..." : "Premium aktivieren"}
            </motion.button>
          </>
        )}

        {isPremium && (
          <div className="space-y-2">
            <button
              onClick={subscription.auto_renew ? cancelAutoRenew : enableAutoRenew}
              disabled={mutatingRenewal}
              className="w-full py-3.5 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="premium-renew-toggle"
            >
              {mutatingRenewal ? <Loader2 size={15} className="animate-spin" /> : <Repeat2 size={15} />}
              {subscription.auto_renew ? "Auto-Verlängerung deaktivieren" : "Auto-Verlängerung aktivieren"}
            </button>
            <p className="text-[10px] text-white/40 text-center">
              Deine Vorteile bleiben bis zum aktuellen Enddatum aktiv.
            </p>
          </div>
        )}

        {hasOtherPlan && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            Du hast bereits {subscription.plan_name || subscription.plan}. Ein Wechsel auf Premium wird über den Abo-Upgrade-Flow durchgeführt.
          </div>
        )}

        {benefits?.has_subscription && (
          <div className="text-[10px] text-white/30 text-center">
            Aktives Paket: {benefits.plan || subscription?.plan}
          </div>
        )}
      </div>
    </div>
  );
}
