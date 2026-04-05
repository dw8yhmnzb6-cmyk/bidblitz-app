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
  const [children, setChildren] = useState([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);

  // Load children from backend
  useEffect(() => {
    api.listChildren()
      .then(d => setChildren(d.children || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addChild = async () => {
    const name = newChildName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const child = await api.createChild({ name, weekly_limit: 15 });
      setChildren(prev => [...prev, child]);
      setNewChildName("");
      setShowAddChild(false);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const updateLimit = async (childId, newLimit) => {
    setChildren(prev => prev.map(c => c.child_id === childId ? { ...c, weekly_limit: newLimit } : c));
    try {
      await api.updateChild(childId, { weekly_limit: newLimit });
    } catch {
      // silent
    }
  };

  const removeChild = async (childId) => {
    setChildren(prev => prev.filter(c => c.child_id !== childId));
    try {
      await api.deleteChild(childId);
    } catch {
      // silent
    }
  };

  const expiresAt = subStatus?.expires_at;
  const trialDaysLeft = subStatus?.status === "trial" && expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / 86400000)) : null;

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
          <span data-testid="kids-sub-status" className="text-[10px] text-[#FFD700] font-semibold uppercase tracking-wider">
            {subStatus?.status === "trial" ? `${t("kids.trial_badge")} (${trialDaysLeft}${t("kids.days_short")})` : t("kids.active_badge")}
          </span>
        </div>
      </div>

      <div className="px-5 pb-28 space-y-4">
        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="text-[#00C2FF] animate-spin" />
          </div>
        ) : (<>
        {/* Overview stats */}
        <motion.div className="grid grid-cols-3 gap-2.5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          {[
            { icon: Users, label: t("kids.stat_children"), value: children.length, color: "#00C2FF" },
            { icon: TrendingDown, label: t("kids.stat_week"), value: `€${children.reduce((s, c) => s + (c.spent || 0), 0).toFixed(2)}`, color: "#FF6B6B" },
            { icon: Wallet, label: t("kids.stat_limit"), value: `€${children.reduce((s, c) => s + (c.weekly_limit || 0), 0).toFixed(2)}`, color: "#00D26A" },
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
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">{t("kids.children_title")}</p>

          {children.length === 0 && !showAddChild && (
            <motion.div className="rounded-2xl p-6 text-center" style={{ background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.06)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Users size={28} className="text-[#222] mx-auto mb-2" />
              <p className="text-[12px] text-[#444] font-medium mb-1">{t("kids.no_children") || "No children added yet"}</p>
              <p className="text-[10px] text-[#333]">{t("kids.add_first") || "Add your first child to get started"}</p>
            </motion.div>
          )}

          <div className="space-y-2.5">
            {children.map((child) => {
              const limit = child.weekly_limit || 0;
              const spent = child.spent || 0;
              const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
              const danger = pct > 80;
              const isSelected = selectedChild === child.child_id;
              return (
                <motion.div key={child.child_id} data-testid={`child-card-${child.child_id}`}
                  className="rounded-2xl p-4 cursor-pointer transition-colors"
                  style={{
                    background: isSelected ? "rgba(0,194,255,0.04)" : "rgba(255,255,255,0.015)",
                    border: `1px solid ${isSelected ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.035)"}`,
                  }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedChild(isSelected ? null : child.child_id)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white relative"
                      style={{ background: `${child.color}20`, border: `2px solid ${child.color}40` }}>
                      {child.avatar}
                      {isSelected && <motion.div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#00C2FF] flex items-center justify-center"
                        initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check size={8} className="text-white" strokeWidth={3} />
                      </motion.div>}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-white">{child.name}</p>
                      <p className="text-[10px] text-[#444] font-medium">€{spent.toFixed(2)} / €{limit.toFixed(2)} {t("kids.weekly")}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[14px] font-bold ${danger ? "text-[#FF4757]" : "text-[#00D26A]"}`}>{pct.toFixed(0)}%</p>
                      <p className="text-[9px] text-[#333] font-medium">{t("kids.used")}</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <motion.div className="h-full rounded-full" style={{ background: danger ? "#FF4757" : child.color, width: `${pct}%` }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
                  </div>
                  {/* Expanded controls when selected */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[10px] text-[#444] font-medium whitespace-nowrap">{t("kids.weekly_limit")}:</span>
                          <input data-testid={`child-limit-${child.child_id}`} type="range" min={5} max={100} step={5} value={limit}
                            onChange={e => { e.stopPropagation(); updateLimit(child.child_id, Number(e.target.value)); }}
                            onClick={e => e.stopPropagation()}
                            className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-[#00C2FF]"
                            style={{ background: "rgba(255,255,255,0.06)" }} />
                          <span className="text-[11px] font-semibold text-white min-w-[40px] text-right">€{limit}</span>
                        </div>
                        <motion.button data-testid={`remove-child-${child.child_id}`}
                          className="mt-2.5 w-full py-2 rounded-xl text-[11px] font-medium text-[#FF4757]/60 border border-[#FF4757]/10"
                          whileTap={{ scale: 0.97 }}
                          onClick={(e) => { e.stopPropagation(); removeChild(child.child_id); }}>
                          {t("kids.remove_child") || "Remove Child"}
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                  placeholder={t("kids.child_name_placeholder")} autoFocus
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#333] font-medium outline-none"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                  onKeyDown={e => e.key === "Enter" && addChild()} />
                <div className="flex gap-2">
                  <motion.button data-testid="add-child-confirm" onClick={addChild} disabled={saving}
                    className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/15 flex items-center justify-center gap-1.5"
                    whileTap={{ scale: 0.97 }}>
                    {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                    {t("kids.add_child")}
                  </motion.button>
                  <motion.button onClick={() => setShowAddChild(false)}
                    className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#444] bg-white/[0.02] border border-white/[0.04]"
                    whileTap={{ scale: 0.97 }}>{t("kids.cancel")}</motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.button data-testid="add-child-btn" onClick={() => setShowAddChild(true)}
                className="w-full mt-2.5 py-3 rounded-2xl flex items-center justify-center gap-2 text-[12px] font-medium text-[#00C2FF]/60 border border-dashed border-[#00C2FF]/15"
                whileTap={{ scale: 0.98 }}>
                <PlusCircle size={14} /> {t("kids.add_child_profile")}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Features */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">{t("kids.features_title")}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Shield, title: t("kids.feat_controls"), desc: t("kids.feat_controls_desc"), color: "#00C2FF" },
              { icon: Eye, title: t("kids.feat_alerts"), desc: t("kids.feat_alerts_desc"), color: "#FFB800" },
              { icon: BarChart3, title: t("kids.feat_reports"), desc: t("kids.feat_reports_desc"), color: "#A855F7" },
              { icon: Clock, title: t("kids.feat_time"), desc: t("kids.feat_time_desc"), color: "#00D26A" },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                <f.icon size={16} style={{ color: f.color }} className="mb-2" />
                <p className="text-[12px] font-semibold text-white mb-0.5">{f.title}</p>
                <p className="text-[10px] text-[#444] font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
        </>)}
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
      const data = await api.startKidsTrial();
      setSubStatus({ status: "trial", plan: "trial", trial_available: false, expires_at: data.expires_at, started_at: new Date().toISOString() });
      setShowDashboard(true);
    } catch {
      setTrialLoading(false);
    }
  };

  // Handle Stripe checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kidsResult = params.get("kids_sub");
    const sessionId = params.get("session_id");
    if (kidsResult === "success" && sessionId) {
      window.history.replaceState({}, "", window.location.pathname);
      api.verifyKidsCheckout(sessionId).then(d => {
        if (d.status === "active") {
          setSubStatus({ status: "active", plan: d.plan, trial_available: false, expires_at: d.expires_at });
          setShowDashboard(true);
        }
      }).catch(() => {});
    }
  }, []);

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

        {/* Expired notice */}
        {subStatus?.status === "expired" && (
          <motion.div data-testid="kids-expired-notice"
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Clock size={16} className="text-[#FF4757] flex-shrink-0" />
            <p className="text-[12px] text-[#FF4757] font-medium">{t("kids.expired_notice")}</p>
          </motion.div>
        )}

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
