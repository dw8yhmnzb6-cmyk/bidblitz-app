import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Shield, Eye, CreditCard, Zap,
  Check, Star, Crown, Loader2, Users, PlusCircle,
  TrendingDown, Wallet, Clock, BarChart3
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

// ── Kids Dashboard (post-subscription) ──
const KidsDashboard = ({ onBack, t, subStatus }) => {
  const [children, setChildren] = useState([
    { id: 1, name: "Child 1", avatar: "C1", weeklyLimit: 20, spent: 8.50, color: "#00C2FF" },
  ]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");

  const addChild = () => {
    if (!newChildName.trim()) return;
    const colors = ["#A855F7", "#00D26A", "#FFB800", "#FF6B6B"];
    const c = { id: Date.now(), name: newChildName.trim(), avatar: newChildName[0]?.toUpperCase() || "?", weeklyLimit: 15, spent: 0, color: colors[children.length % colors.length] };
    setChildren([...children, c]);
    setNewChildName(""); setShowAddChild(false);
  };

  const updateLimit = (id, newLimit) => {
    setChildren(children.map(c => c.id === id ? { ...c, weeklyLimit: newLimit } : c));
  };

  const trialDaysLeft = subStatus?.trial_end ? Math.max(0, Math.ceil((new Date(subStatus.trial_end) - new Date()) / 86400000)) : null;

  return (
    <motion.div data-testid="kids-dashboard" className="min-h-screen relative" style={{ background: "#030303" }}
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={slide}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button data-testid="kids-dashboard-back" className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }} onClick={onBack}>
          <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">BidBlitz Kids</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <Crown size={12} className="text-[#FFD700]" />
          <span className="text-[10px] text-[#FFD700] font-semibold uppercase tracking-wider">
            {subStatus?.status === "trial" ? `Trial (${trialDaysLeft}d left)` : "Active"}
          </span>
        </div>
      </div>

      <div className="px-5 pb-28 space-y-4">
        {/* Overview stats */}
        <motion.div className="grid grid-cols-3 gap-2.5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          {[
            { icon: Users, label: "Children", value: children.length, color: "#00C2FF" },
            { icon: TrendingDown, label: "This Week", value: `€${children.reduce((s, c) => s + c.spent, 0).toFixed(2)}`, color: "#FF6B6B" },
            { icon: Wallet, label: "Total Limit", value: `€${children.reduce((s, c) => s + c.weeklyLimit, 0).toFixed(2)}`, color: "#00D26A" },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
              <s.icon size={16} style={{ color: s.color }} className="mx-auto mb-1.5" />
              <p className="text-[15px] font-bold text-white font-outfit">{s.value}</p>
              <p className="text-[9px] text-[#444] font-medium uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Children list */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">Children</p>
          <div className="space-y-2.5">
            {children.map((child) => {
              const pct = child.weeklyLimit > 0 ? Math.min(100, (child.spent / child.weeklyLimit) * 100) : 0;
              const danger = pct > 80;
              return (
                <motion.div key={child.id} data-testid={`child-card-${child.id}`}
                  className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
                  whileHover={{ scale: 1.005 }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white"
                      style={{ background: `${child.color}20`, border: `2px solid ${child.color}40` }}>
                      {child.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-white">{child.name}</p>
                      <p className="text-[10px] text-[#444] font-medium">€{child.spent.toFixed(2)} / €{child.weeklyLimit.toFixed(2)} weekly</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[14px] font-bold ${danger ? "text-[#FF4757]" : "text-[#00D26A]"}`}>{pct.toFixed(0)}%</p>
                      <p className="text-[9px] text-[#333] font-medium">used</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <motion.div className="h-full rounded-full" style={{ background: danger ? "#FF4757" : child.color, width: `${pct}%` }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
                  </div>
                  {/* Limit slider */}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-[10px] text-[#444] font-medium whitespace-nowrap">Weekly Limit:</span>
                    <input data-testid={`child-limit-${child.id}`} type="range" min={5} max={100} step={5} value={child.weeklyLimit}
                      onChange={e => updateLimit(child.id, Number(e.target.value))}
                      className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-[#00C2FF]"
                      style={{ background: "rgba(255,255,255,0.06)" }} />
                    <span className="text-[11px] font-semibold text-white min-w-[40px] text-right">€{child.weeklyLimit}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Add child button */}
          <AnimatePresence>
            {showAddChild ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2.5 rounded-2xl p-4 space-y-3"
                style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                <input data-testid="add-child-name" value={newChildName} onChange={e => setNewChildName(e.target.value)}
                  placeholder="Child name" autoFocus
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#333] font-medium outline-none"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  onKeyDown={e => e.key === "Enter" && addChild()} />
                <div className="flex gap-2">
                  <motion.button data-testid="add-child-confirm" onClick={addChild}
                    className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/15"
                    whileTap={{ scale: 0.97 }}>Add Child</motion.button>
                  <motion.button onClick={() => setShowAddChild(false)}
                    className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#444] bg-white/[0.02] border border-white/[0.04]"
                    whileTap={{ scale: 0.97 }}>Cancel</motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.button data-testid="add-child-btn" onClick={() => setShowAddChild(true)}
                className="w-full mt-2.5 py-3 rounded-2xl flex items-center justify-center gap-2 text-[12px] font-medium text-[#00C2FF]/60 border border-dashed border-[#00C2FF]/15"
                whileTap={{ scale: 0.98 }}>
                <PlusCircle size={14} /> Add Child Profile
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Activity summary */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">Features</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Shield, title: "Parental Controls", desc: "Approve transactions", color: "#00C2FF" },
              { icon: Eye, title: "Spending Alerts", desc: "Real-time notifications", color: "#FFB800" },
              { icon: BarChart3, title: "Weekly Reports", desc: "Spending breakdowns", color: "#A855F7" },
              { icon: Clock, title: "Time Limits", desc: "Transaction schedules", color: "#00D26A" },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                <f.icon size={16} style={{ color: f.color }} className="mb-2" />
                <p className="text-[12px] font-semibold text-white mb-0.5">{f.title}</p>
                <p className="text-[10px] text-[#444] font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const KidsPaywall = ({ onBack, onSubscribed }) => {
  const { t } = useI18n();
  const user = useUser();
  const [plan, setPlan] = useState("yearly");
  const [loading, setLoading] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    api.getKidsSubscription().then(d => {
      setSubStatus(d);
      if (d.status === "active" || d.status === "trial") {
        setShowDashboard(true);
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
      setShowDashboard(true);
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

  if (showDashboard) {
    return <KidsDashboard onBack={onBack} t={t} subStatus={subStatus} />;
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
