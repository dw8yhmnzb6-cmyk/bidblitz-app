import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Shield, Eye, CreditCard, Zap,
  Check, Star, Crown, Loader2, Users
} from "lucide-react";
import { useI18n, useUser } from "../store";
import { api } from "../services/api";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

const BENEFITS = [
  { icon: Shield, key: "parental_control" },
  { icon: Eye, key: "spending_limits" },
  { icon: CreditCard, key: "txn_tracking" },
  { icon: Zap, key: "safe_payments" },
];

const KidsPaywall = ({ onBack, onSubscribed }) => {
  const { t } = useI18n();
  const user = useUser();
  const [plan, setPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    api.getKidsSubscription().then(d => {
      setSubStatus(d);
      if (d.status === "active" || d.status === "trial") {
        onSubscribed?.();
      }
    }).catch(() => {}).finally(() => setCheckingStatus(false));
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const data = await api.createKidsCheckout({ plan, origin_url: origin });
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (e) {
      setLoading(false);
    }
  };

  const handleTrial = async () => {
    setTrialLoading(true);
    try {
      await api.startKidsTrial();
      onSubscribed?.();
    } catch {
      setTrialLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={24} className="text-[#00C2FF] animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      data-testid="kids-paywall"
      className="min-h-screen relative"
      style={{ background: "#030303" }}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={slide}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button
          data-testid="kids-paywall-back"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }}
          onClick={onBack}
        >
          <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">{t("kids.title")}</h1>
      </div>

      <div className="px-5 pb-8 relative z-10 space-y-5">
        {/* Hero */}
        <motion.div
          className="rounded-2xl p-5 relative overflow-hidden text-center"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(0,194,255,0.06))", border: "1px solid rgba(168,85,247,0.1)" }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, ...slide }}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none" style={{ background: "rgba(168,85,247,0.12)", filter: "blur(35px)" }} />
          <motion.div
            className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Users size={26} strokeWidth={1.5} className="text-purple-400" />
          </motion.div>
          <h2 className="text-[18px] font-bold text-white font-outfit mb-1">{t("kids.hero_title")}</h2>
          <p className="text-[12px] text-[#555] font-medium">{t("kids.hero_desc")}</p>
        </motion.div>

        {/* Benefits */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, ...slide }}
        >
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{t("kids.benefits_title")}</p>
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.key}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.14 + i * 0.04, ...slide }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.12)" }}>
                <b.icon size={14} strokeWidth={1.5} className="text-purple-400" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-white/85">{t(`kids.benefit_${b.key}`)}</p>
              </div>
              <Check size={14} className="text-[#00D26A] ml-auto flex-shrink-0" />
            </motion.div>
          ))}
        </motion.div>

        {/* Plan selector */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, ...slide }}
        >
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{t("kids.choose_plan")}</p>

          {/* Yearly */}
          <motion.button
            data-testid="kids-plan-yearly"
            className="w-full rounded-xl p-4 text-left relative overflow-hidden"
            style={{
              background: plan === "yearly" ? "rgba(168,85,247,0.06)" : "rgba(255,255,255,0.015)",
              border: `1px solid ${plan === "yearly" ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.035)"}`,
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setPlan("yearly")}
          >
            {plan === "yearly" && (
              <motion.div
                className="absolute top-0 right-0 px-2.5 py-0.5 rounded-bl-lg text-[9px] font-bold"
                style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}
                layoutId="bestValue"
              >
                {t("kids.best_value")}
              </motion.div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={14} className="text-purple-400" />
                  <p className="text-[13px] font-semibold text-white">{t("kids.yearly")}</p>
                </div>
                <p className="text-[10px] text-[#555] font-medium mt-0.5">{t("kids.yearly_save")}</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-bold font-outfit" style={{ color: plan === "yearly" ? "#A855F7" : "rgba(255,255,255,0.7)" }}>49.99</p>
                <p className="text-[10px] text-[#444] font-medium">EUR / {t("kids.year")}</p>
              </div>
            </div>
          </motion.button>

          {/* Monthly */}
          <motion.button
            data-testid="kids-plan-monthly"
            className="w-full rounded-xl p-4 text-left"
            style={{
              background: plan === "monthly" ? "rgba(0,194,255,0.04)" : "rgba(255,255,255,0.015)",
              border: `1px solid ${plan === "monthly" ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.035)"}`,
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setPlan("monthly")}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Star size={14} className="text-[#00C2FF]" />
                  <p className="text-[13px] font-semibold text-white">{t("kids.monthly")}</p>
                </div>
                <p className="text-[10px] text-[#555] font-medium mt-0.5">{t("kids.monthly_flex")}</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-bold font-outfit" style={{ color: plan === "monthly" ? "#00C2FF" : "rgba(255,255,255,0.7)" }}>4.99</p>
                <p className="text-[10px] text-[#444] font-medium">EUR / {t("kids.month")}</p>
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          className="space-y-3 pt-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, ...slide }}
        >
          {subStatus?.trial_available && (
            <motion.button
              data-testid="kids-start-trial"
              className="w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
              style={{ background: "rgba(0,210,106,0.08)", border: "1px solid rgba(0,210,106,0.15)", color: "#00D26A" }}
              whileTap={{ scale: 0.97 }}
              onClick={handleTrial}
              disabled={trialLoading}
            >
              {trialLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {t("kids.start_trial")}
            </motion.button>
          )}

          <motion.button
            data-testid="kids-subscribe-btn"
            className="w-full py-3.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #A855F7, #7C3AED)",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(168,85,247,0.3)",
            }}
            whileTap={{ scale: 0.97 }}
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("kids.subscribe_now")} — EUR {plan === "yearly" ? "49.99" : "4.99"}
          </motion.button>

          <p className="text-[10px] text-[#333] text-center font-medium">{t("kids.cancel_anytime")}</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default KidsPaywall;
