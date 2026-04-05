import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Zap, Shield, Users, Store, CreditCard, Smartphone, QrCode,
  BarChart3, Clock, Check, ChevronRight, ArrowRight, Globe,
  Monitor, Key, RefreshCw, Scan, Wifi, Lock, Eye, Star,
  Layers, TrendingUp, ChevronDown, Loader2, X, UserPlus,
  LogIn, Mail, Building2
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const API = process.env.REACT_APP_BACKEND_URL;

// ── Animated section wrapper ──
const Section = ({ children, className = "", id }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.section
      ref={ref}
      id={id}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
};

const MerchantLandingPage = ({ onNavigate }) => {
  const { t, lang: language, setLang: setLanguage, LANGUAGES: languages } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [authMode, setAuthMode] = useState(null); // null | "login" | "register"
  const [authForm, setAuthForm] = useState({});
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [pricing, setPricing] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api.getPricing().then(d => setPricing(d)).catch(() => {});
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogin = async () => {
    if (!authForm.email || !authForm.password) { setAuthError(t("auth.fill_all") || "Fill all fields"); return; }
    setAuthLoading(true); setAuthError("");
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authForm.email, password: authForm.password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Login failed");
      window.location.href = "/";
    } catch (e) { setAuthError(e.message); }
    setAuthLoading(false);
  };

  const handleRegister = async () => {
    if (!authForm.name || !authForm.email || !authForm.password) { setAuthError(t("auth.fill_all") || "Fill all fields"); return; }
    if (authForm.password !== authForm.confirm) { setAuthError(t("auth.pw_mismatch") || "Passwords don't match"); return; }
    setAuthLoading(true); setAuthError("");
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authForm.name, email: authForm.email,
          password: authForm.password, requested_role: "merchant",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Registration failed");
      setAuthSuccess(t("ml.register_success") || "Registration submitted! Admin will approve your merchant account.");
      setAuthMode(null);
    } catch (e) { setAuthError(e.message); }
    setAuthLoading(false);
  };

  const benefits = [
    { icon: Zap, key: "fast_payments", color: "#00E0FF" },
    { icon: Shield, key: "low_fees", color: "#00E89D" },
    { icon: QrCode, key: "qr_payments", color: "#A855F7" },
    { icon: Scan, key: "barcode_payments", color: "#FFB800" },
    { icon: Smartphone, key: "nfc_ready", color: "#FF6B6B" },
    { icon: BarChart3, key: "live_tracking", color: "#00C2FF" },
    { icon: Store, key: "branch_mgmt", color: "#FF8C42" },
  ];

  const steps = [
    { num: "01", key: "step_register", icon: UserPlus, color: "#00E0FF" },
    { num: "02", key: "step_approval", icon: Shield, color: "#FFB800" },
    { num: "03", key: "step_branch", icon: Store, color: "#00E89D" },
    { num: "04", key: "step_register_device", icon: Key, color: "#A855F7" },
    { num: "05", key: "step_accept", icon: Zap, color: "#00E0FF" },
  ];

  const paymentMethods = [
    { icon: Zap, key: "pm_wallet", fee: "0.3–0.5%", color: "#00E89D" },
    { icon: Scan, key: "pm_barcode", fee: "0.5%", color: "#00E0FF" },
    { icon: QrCode, key: "pm_qr", fee: "0.5%", color: "#A855F7" },
    { icon: Smartphone, key: "pm_nfc", fee: "0.3%", color: "#FF6B6B" },
    { icon: CreditCard, key: "pm_card", fee: "2.5%", color: "#FFB800" },
  ];

  const features = [
    { icon: Store, key: "ft_multi_branch" },
    { icon: Monitor, key: "ft_registers" },
    { icon: Key, key: "ft_api_keys" },
    { icon: Eye, key: "ft_live_revenue" },
    { icon: BarChart3, key: "ft_reports" },
    { icon: RefreshCw, key: "ft_refunds" },
    { icon: Clock, key: "ft_shifts" },
    { icon: Users, key: "ft_staff" },
  ];

  const trustItems = [
    { icon: Lock, key: "tr_secure" },
    { icon: Shield, key: "tr_approval" },
    { icon: Store, key: "tr_branch_control" },
    { icon: Monitor, key: "tr_register_track" },
    { icon: Mail, key: "tr_support" },
  ];

  return (
    <div data-testid="merchant-landing-page" className="min-h-screen" style={{ background: "#020408" }}>

      {/* ══════════════════════════════════════ */}
      {/* STICKY HEADER */}
      {/* ══════════════════════════════════════ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(2,4,8,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.03)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00E0FF] to-[#00E89D] flex items-center justify-center">
              <Zap size={14} className="text-[#020408]" />
            </div>
            <span className="text-[14px] font-black text-white/90 tracking-wide">BIDBLITZ</span>
            <span className="text-[8px] text-[#00E0FF]/40 font-bold tracking-widest">MERCHANT</span>
          </div>

          {/* Nav */}
          <div className="hidden md:flex items-center gap-5">
            {["benefits", "how", "pricing", "features"].map(s => (
              <a key={s} href={`#${s}`} className="text-[11px] text-white/30 hover:text-white/60 transition-colors font-medium">
                {t(`ml.nav_${s}`) || s.charAt(0).toUpperCase() + s.slice(1)}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative">
              <motion.button
                data-testid="lang-switcher"
                onClick={() => setShowLangMenu(!showLangMenu)}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold text-white/30 hover:text-white/50 transition-colors"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
              >
                <Globe size={10} /> {(language || "en").toUpperCase()} <ChevronDown size={8} />
              </motion.button>
              <AnimatePresence>
                {showLangMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-50 max-h-[300px] overflow-y-auto"
                    style={{ background: "rgba(8,12,20,0.98)", border: "1px solid rgba(255,255,255,0.06)", minWidth: 120 }}
                  >
                    {(languages || []).map(l => (
                      <button
                        key={l.code}
                        onClick={() => { setLanguage(l.code); setShowLangMenu(false); }}
                        className={`w-full px-3 py-2 text-left text-[10px] font-medium hover:bg-white/[0.03] transition-colors ${language === l.code ? "text-[#00E0FF]" : "text-white/40"}`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              data-testid="header-login"
              onClick={() => setAuthMode("login")}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white/40 hover:text-white/60 transition-colors"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {t("ml.login") || "Login"}
            </motion.button>
            <motion.button
              data-testid="header-register"
              onClick={() => setAuthMode("register")}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
              style={{ background: "rgba(0,232,157,0.1)", border: "1px solid rgba(0,232,157,0.2)", color: "#00E89D" }}
            >
              {t("ml.register") || "Register"}
            </motion.button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════ */}
      {/* 1. HERO SECTION */}
      {/* ══════════════════════════════════════ */}
      <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-24 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.04]"
            style={{ background: "radial-gradient(ellipse, #00E0FF, transparent)" }} />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: "rgba(0,224,255,0.04)", border: "1px solid rgba(0,224,255,0.08)" }}>
              <Zap size={10} className="text-[#00E0FF]" />
              <span className="text-[9px] text-[#00E0FF] font-bold tracking-wider">{t("ml.badge") || "FOR SHOPS · RESTAURANTS · CHAINS · FRANCHISES"}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white/95 leading-[1.1] mb-5">
              {t("ml.hero_title") || "Accept Payments."} <br />
              <span className="bg-gradient-to-r from-[#00E0FF] to-[#00E89D] bg-clip-text text-transparent">
                {t("ml.hero_title2") || "Grow Your Business."}
              </span>
            </h1>
            <p className="text-base sm:text-lg text-white/30 max-w-xl mx-auto mb-8 leading-relaxed">
              {t("ml.hero_desc") || "Lower fees than traditional card payments. Accept wallet, barcode, QR, and NFC-ready payments. Manage branches, staff, and registers. See live revenue and reports."}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <motion.button
                data-testid="hero-register"
                onClick={() => setAuthMode("register")}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, rgba(0,232,157,0.15), rgba(0,224,255,0.1))", border: "1px solid rgba(0,232,157,0.25)", color: "#00E89D", boxShadow: "0 0 40px rgba(0,232,157,0.06)" }}
              >
                <UserPlus size={15} /> {t("ml.hero_register") || "Merchant Register"} <ChevronRight size={14} />
              </motion.button>
              <motion.button
                data-testid="hero-login"
                onClick={() => setAuthMode("login")}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
              >
                <LogIn size={15} /> {t("ml.hero_login") || "Merchant Login"}
              </motion.button>
              <motion.button
                data-testid="hero-demo"
                onClick={() => { const el = document.getElementById("pricing"); el?.scrollIntoView({ behavior: "smooth" }); }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2"
                style={{ background: "rgba(0,224,255,0.04)", border: "1px solid rgba(0,224,255,0.08)", color: "#00E0FF" }}
              >
                <Eye size={15} /> {t("ml.hero_demo") || "Request Demo"}
              </motion.button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div className="grid grid-cols-4 gap-3 mt-12 max-w-lg mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            {[
              { val: "0.3%", label: t("ml.stat_fee") || "Lowest Fee" },
              { val: "<2s", label: t("ml.stat_speed") || "Payment Speed" },
              { val: "24/7", label: t("ml.stat_support") || "Support" },
              { val: "100K+", label: t("ml.stat_users") || "Users" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>
                <p className="text-[16px] sm:text-[18px] font-black font-mono text-[#00E0FF]">{s.val}</p>
                <p className="text-[7px] text-white/15">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════ */}
      {/* 2. BENEFITS SECTION */}
      {/* ══════════════════════════════════════ */}
      <Section id="benefits" className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-[9px] text-[#00E0FF]/40 uppercase tracking-[0.3em] font-bold mb-2">{t("ml.benefits_tag") || "WHY BIDBLITZ"}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white/80">{t("ml.benefits_title") || "Everything You Need to Accept Payments"}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                className="group rounded-2xl p-4 cursor-default"
                style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.03)" }}
                whileHover={{ borderColor: `${b.color}20`, y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center transition-all" style={{ background: `${b.color}08`, border: `1px solid ${b.color}12` }}>
                  <b.icon size={18} style={{ color: b.color }} />
                </div>
                <h3 className="text-[12px] font-bold text-white/80 mb-1">{t(`ml.b_${b.key}`) || b.key}</h3>
                <p className="text-[9px] text-white/25 leading-relaxed">{t(`ml.b_${b.key}_d`) || ""}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* 3. HOW IT WORKS */}
      {/* ══════════════════════════════════════ */}
      <Section id="how" className="py-16 sm:py-20" style={{ background: "rgba(0,224,255,0.01)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-[9px] text-[#00E89D]/40 uppercase tracking-[0.3em] font-bold mb-2">{t("ml.how_tag") || "GETTING STARTED"}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white/80">{t("ml.how_title") || "Start Accepting Payments in 5 Steps"}</h2>
          </div>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-4 rounded-2xl p-4"
                style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.03)" }}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}08`, border: `1px solid ${s.color}15` }}>
                  <span className="text-[16px] font-black font-mono" style={{ color: s.color }}>{s.num}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-[12px] font-bold text-white/80">{t(`ml.${s.key}`) || s.key}</h3>
                  <p className="text-[9px] text-white/25">{t(`ml.${s.key}_d`) || ""}</p>
                </div>
                <s.icon size={18} style={{ color: `${s.color}40` }} />
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* 4. PAYMENT METHODS */}
      {/* ══════════════════════════════════════ */}
      <Section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-[9px] text-[#A855F7]/40 uppercase tracking-[0.3em] font-bold mb-2">{t("ml.pm_tag") || "PAYMENT METHODS"}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white/80">{t("ml.pm_title") || "Accept Every Payment Type"}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {paymentMethods.map((m, i) => (
              <motion.div
                key={i}
                className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.03)" }}
                whileHover={{ borderColor: `${m.color}20`, scale: 1.02 }}
              >
                <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: `${m.color}08`, border: `1px solid ${m.color}12` }}>
                  <m.icon size={20} style={{ color: m.color }} />
                </div>
                <p className="text-[11px] font-bold text-white/70 mb-1">{t(`ml.${m.key}`) || m.key}</p>
                <p className="text-[10px] font-bold font-mono" style={{ color: m.color }}>{m.fee}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* 5. MERCHANT FEATURES */}
      {/* ══════════════════════════════════════ */}
      <Section id="features" className="py-16 sm:py-20" style={{ background: "rgba(0,232,157,0.01)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-[9px] text-[#FFB800]/40 uppercase tracking-[0.3em] font-bold mb-2">{t("ml.ft_tag") || "FEATURES"}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white/80">{t("ml.ft_title") || "Professional Merchant Tools"}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {features.map((f, i) => (
              <motion.div
                key={i}
                className="rounded-xl p-3 text-center"
                style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.03)" }}
                whileHover={{ borderColor: "rgba(0,224,255,0.1)" }}
              >
                <f.icon size={18} className="mx-auto mb-2 text-[#00E0FF]/40" />
                <p className="text-[10px] font-bold text-white/50">{t(`ml.${f.key}`) || f.key}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* 6. PRICING / FEES */}
      {/* ══════════════════════════════════════ */}
      <Section id="pricing" className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-[9px] text-[#00E89D]/40 uppercase tracking-[0.3em] font-bold mb-2">{t("ml.pricing_tag") || "PRICING"}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white/80">{t("ml.pricing_title") || "Simple, Transparent Fees"}</h2>
            <p className="text-[10px] text-white/20 mt-2 max-w-md mx-auto">{t("ml.pricing_desc") || "Lower fees for BidBlitz Wallet payments. Higher fees for card/contactless. No hidden charges."}</p>
          </div>

          {pricing?.plans ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {pricing.plans.map((plan, i) => {
                const colors = ["#00E89D", "#00E0FF", "#FFB800"];
                const c = colors[i] || "#00E0FF";
                return (
                  <motion.div
                    key={plan.id}
                    className="rounded-2xl p-5"
                    style={{
                      background: plan.popular ? `${c}04` : "rgba(8,12,20,0.7)",
                      border: `1px solid ${plan.popular ? `${c}20` : "rgba(255,255,255,0.03)"}`,
                      boxShadow: plan.popular ? `0 0 40px ${c}06` : "none",
                    }}
                    whileHover={{ y: -3 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[14px] font-bold text-white/90">{plan.name}</h3>
                      {plan.popular && (
                        <span className="px-2 py-0.5 rounded-full text-[7px] font-bold" style={{ background: `${c}15`, color: c }}>{t("pricing.popular") || "POPULAR"}</span>
                      )}
                    </div>
                    <div className="mb-3">
                      {plan.price === 0 ? (
                        <span className="text-[24px] font-black" style={{ color: c }}>{t("pricing.free") || "Free"}</span>
                      ) : (
                        <><span className="text-[24px] font-black" style={{ color: c }}>{plan.price}</span><span className="text-[10px] text-white/20"> /mo</span></>
                      )}
                    </div>
                    <p className="text-[9px] text-white/25 mb-3">{plan.description}</p>
                    <div className="space-y-1.5">
                      {plan.features.map((f, fi) => (
                        <div key={fi} className="flex items-center gap-2">
                          <Check size={9} style={{ color: c }} />
                          <span className="text-[9px] text-white/35">{f}</span>
                        </div>
                      ))}
                    </div>
                    <motion.button
                      onClick={() => setAuthMode("register")}
                      whileTap={{ scale: 0.95 }}
                      className="w-full py-2.5 rounded-xl text-[10px] font-bold mt-4 flex items-center justify-center gap-1"
                      style={{ background: `${c}08`, border: `1px solid ${c}15`, color: c }}
                    >
                      {plan.price === 0 ? (t("ml.start_free") || "Start Free") : (t("ml.choose_plan") || "Choose Plan")} <ChevronRight size={10} />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          ) : null}

          {/* Fee comparison */}
          <div className="rounded-2xl p-5 max-w-lg mx-auto" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.03)" }}>
            <p className="text-[8px] text-white/15 uppercase tracking-widest font-bold mb-3">{t("ml.fee_comparison") || "FEE COMPARISON"}</p>
            <div className="space-y-2">
              {[
                { method: "BidBlitz Wallet", fee: "0.5%", color: "#00E89D" },
                { method: "NFC Wallet", fee: "0.3%", color: "#00E0FF" },
                { method: "Barcode/QR", fee: "0.5%", color: "#A855F7" },
                { method: "Card/Contactless", fee: "2.5%", color: "#FFB800" },
              ].map((f, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: f.color }} />
                    <span className="text-[10px] text-white/40">{f.method}</span>
                  </div>
                  <span className="text-[12px] font-bold font-mono" style={{ color: f.color }}>{f.fee}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* 7. TRUST SECTION */}
      {/* ══════════════════════════════════════ */}
      <Section className="py-16 sm:py-20" style={{ background: "rgba(0,224,255,0.01)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-[9px] text-[#00E0FF]/40 uppercase tracking-[0.3em] font-bold mb-2">{t("ml.trust_tag") || "TRUST & SECURITY"}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white/80">{t("ml.trust_title") || "Built for Professional Merchants"}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {trustItems.map((tr, i) => (
              <div key={i} className="rounded-xl p-3 text-center" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.03)" }}>
                <tr.icon size={18} className="mx-auto mb-2 text-[#00E89D]/50" />
                <p className="text-[9px] font-bold text-white/40">{t(`ml.${tr.key}`) || tr.key}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* 8. CTA SECTION */}
      {/* ══════════════════════════════════════ */}
      <Section className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white/90 mb-4">
            {t("ml.cta_title") || "Ready to Start?"}
          </h2>
          <p className="text-[12px] text-white/25 mb-8 max-w-md mx-auto">
            {t("ml.cta_desc") || "Join thousands of businesses already using BidBlitz. Register now and start accepting payments today."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <motion.button
              data-testid="cta-register"
              onClick={() => setAuthMode("register")}
              whileTap={{ scale: 0.97 }}
              className="w-full sm:w-auto px-10 py-4 rounded-xl text-[14px] font-black flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, rgba(0,232,157,0.15), rgba(0,224,255,0.1))", border: "1px solid rgba(0,232,157,0.25)", color: "#00E89D", boxShadow: "0 0 40px rgba(0,232,157,0.06)" }}
            >
              <UserPlus size={16} /> {t("ml.cta_register") || "Register as Merchant"} <ArrowRight size={14} />
            </motion.button>
            <motion.button
              onClick={() => setAuthMode("login")}
              whileTap={{ scale: 0.97 }}
              className="w-full sm:w-auto px-10 py-4 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
            >
              <LogIn size={16} /> {t("ml.cta_login") || "Login as Merchant"}
            </motion.button>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ══════════════════════════════════════ */}
      <footer className="py-8 border-t border-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-[#00E0FF] to-[#00E89D] flex items-center justify-center">
              <Zap size={8} className="text-[#020408]" />
            </div>
            <span className="text-[10px] font-bold text-white/30">BIDBLITZ</span>
          </div>
          <p className="text-[8px] text-white/10">{t("ml.footer") || "Secure payment solutions for modern businesses"}</p>
        </div>
      </footer>

      {/* ══════════════════════════════════════ */}
      {/* 9. AUTH MODAL */}
      {/* ══════════════════════════════════════ */}
      <AnimatePresence>
        {authMode && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setAuthMode(null); setAuthError(""); }} />
            <motion.div
              className="relative w-full max-w-sm rounded-2xl p-6"
              style={{ background: "rgba(8,12,20,0.98)", border: "1px solid rgba(0,224,255,0.08)" }}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            >
              <button onClick={() => { setAuthMode(null); setAuthError(""); }} className="absolute top-3 right-3 text-white/20 hover:text-white/40">
                <X size={16} />
              </button>

              <div className="text-center mb-5">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)" }}>
                  {authMode === "login" ? <LogIn size={18} className="text-[#00E0FF]" /> : <UserPlus size={18} className="text-[#00E89D]" />}
                </div>
                <h3 className="text-[16px] font-bold text-white/90">
                  {authMode === "login" ? (t("ml.login_title") || "Merchant Login") : (t("ml.register_title") || "Merchant Registration")}
                </h3>
                <p className="text-[9px] text-white/20 mt-1">
                  {authMode === "login" ? (t("ml.login_desc") || "Sign in to your merchant account") : (t("ml.register_desc") || "Create account — admin will approve merchant access")}
                </p>
              </div>

              {/* Toggle */}
              <div className="flex gap-1 mb-4 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.02)" }}>
                <button
                  onClick={() => { setAuthMode("login"); setAuthError(""); }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-colors ${authMode === "login" ? "bg-[#00E0FF]/10 text-[#00E0FF]" : "text-white/20"}`}
                >
                  {t("ml.login") || "Login"}
                </button>
                <button
                  onClick={() => { setAuthMode("register"); setAuthError(""); }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-colors ${authMode === "register" ? "bg-[#00E89D]/10 text-[#00E89D]" : "text-white/20"}`}
                >
                  {t("ml.register") || "Register"}
                </button>
              </div>

              <div className="space-y-3">
                {authMode === "register" && (
                  <input
                    data-testid="ml-name"
                    placeholder={t("auth.name") || "Full name"}
                    value={authForm.name || ""}
                    onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[12px] text-white/80 placeholder:text-white/10 outline-none focus:border-[#00E0FF]/15"
                  />
                )}
                <input
                  data-testid="ml-email"
                  type="email"
                  placeholder={t("auth.email") || "Email address"}
                  value={authForm.email || ""}
                  onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[12px] text-white/80 placeholder:text-white/10 outline-none focus:border-[#00E0FF]/15"
                />
                <input
                  data-testid="ml-password"
                  type="password"
                  placeholder={t("auth.password") || "Password"}
                  value={authForm.password || ""}
                  onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[12px] text-white/80 placeholder:text-white/10 outline-none focus:border-[#00E0FF]/15"
                />
                {authMode === "register" && (
                  <input
                    data-testid="ml-confirm"
                    type="password"
                    placeholder={t("auth.confirm") || "Confirm password"}
                    value={authForm.confirm || ""}
                    onChange={e => setAuthForm(p => ({ ...p, confirm: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[12px] text-white/80 placeholder:text-white/10 outline-none focus:border-[#00E0FF]/15"
                  />
                )}
              </div>

              {authError && (
                <div className="mt-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.1)" }}>
                  <span className="text-[9px] text-[#FF4757]">{authError}</span>
                </div>
              )}

              <motion.button
                data-testid="ml-submit"
                onClick={authMode === "login" ? handleLogin : handleRegister}
                disabled={authLoading}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 rounded-xl text-[12px] font-bold mt-4 flex items-center justify-center gap-2"
                style={{
                  background: authMode === "login" ? "rgba(0,224,255,0.1)" : "rgba(0,232,157,0.1)",
                  border: `1px solid ${authMode === "login" ? "rgba(0,224,255,0.2)" : "rgba(0,232,157,0.2)"}`,
                  color: authMode === "login" ? "#00E0FF" : "#00E89D",
                }}
              >
                {authLoading ? <Loader2 size={14} className="animate-spin" /> : (
                  authMode === "login" ? (t("ml.login") || "Login") : (t("ml.register") || "Register")
                )}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success message */}
      <AnimatePresence>
        {authSuccess && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAuthSuccess("")} />
            <motion.div className="relative w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: "rgba(8,12,20,0.98)", border: "1px solid rgba(0,232,157,0.15)" }}
              initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(0,232,157,0.1)" }}>
                <Check size={28} className="text-[#00E89D]" />
              </div>
              <p className="text-[13px] text-white/80 font-bold mb-2">{t("ml.success") || "Success!"}</p>
              <p className="text-[10px] text-white/30">{authSuccess}</p>
              <motion.button onClick={() => setAuthSuccess("")} whileTap={{ scale: 0.95 }}
                className="mt-4 px-6 py-2 rounded-xl text-[10px] font-bold" style={{ background: "rgba(0,224,255,0.08)", color: "#00E0FF" }}>
                {t("common.done") || "Done"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MerchantLandingPage;
