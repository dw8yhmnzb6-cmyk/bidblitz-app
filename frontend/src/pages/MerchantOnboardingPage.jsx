import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Store, Users, TrendingUp, Shield,
  Check, Loader2, CreditCard, Smartphone, QrCode,
  BarChart3, Clock, ChevronRight, Star, Rocket
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const MerchantOnboardingPage = ({ onBack }) => {
  const { t } = useI18n();
  const [step, setStep] = useState("landing");
  const [form, setForm] = useState({ plan: "starter" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submitTrial = async () => {
    if (!form.business_name || !form.contact_name || !form.email) {
      setError(t("onboarding.fill_required") || "Please fill all required fields");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.requestMerchantTrial(form);
      setSubmitted(true);
      setStep("success");
    } catch (e) {
      setError(e.message || "Submission failed");
    }
    setLoading(false);
  };

  const benefits = [
    { icon: Zap, title: t("onboarding.fast_payments") || "Lightning-Fast Payments", desc: t("onboarding.fast_payments_desc") || "Process payments in under 2 seconds. No waiting.", color: "#00E0FF" },
    { icon: Shield, title: t("onboarding.low_fees") || "Industry-Low Fees", desc: t("onboarding.low_fees_desc") || "Starting at just 0.3% — up to 10x less than competitors.", color: "#00E89D" },
    { icon: Users, title: t("onboarding.customer_growth") || "Customer Growth", desc: t("onboarding.customer_growth_desc") || "Access 100K+ BidBlitz users who prefer wallet payments.", color: "#FFB800" },
    { icon: BarChart3, title: t("onboarding.real_time") || "Real-Time Analytics", desc: t("onboarding.real_time_desc") || "Track revenue, shifts, and payments — live, on any device.", color: "#A855F7" },
    { icon: Smartphone, title: t("onboarding.any_device") || "Any Device is a Terminal", desc: t("onboarding.any_device_desc") || "Use any tablet or phone as your POS. No expensive hardware needed.", color: "#FF6B6B" },
    { icon: Store, title: t("onboarding.multi_branch") || "Multi-Branch Ready", desc: t("onboarding.multi_branch_desc") || "Manage unlimited branches, staff, and registers from one dashboard.", color: "#00C2FF" },
  ];

  const stats = [
    { val: "0.3%", label: t("onboarding.lowest_fee") || "Lowest Fee" },
    { val: "<2s", label: t("onboarding.payment_speed") || "Payment Speed" },
    { val: "30", label: t("onboarding.free_trial_days") || "Free Trial Days" },
    { val: "24/7", label: t("onboarding.support") || "Support" },
  ];

  const paymentMethods = [
    { icon: QrCode, label: "Barcode/QR", fee: "0.5%", color: "#00E89D" },
    { icon: Smartphone, label: "NFC Wallet", fee: "0.3%", color: "#00E0FF" },
    { icon: CreditCard, label: "Card/Contactless", fee: "2.5%", color: "#FFB800" },
  ];

  return (
    <motion.div data-testid="merchant-onboarding-page" className="min-h-screen pb-24" style={{ background: "#020408" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(2,4,8,0.9)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button data-testid="onboarding-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[14px] font-bold text-white/90">{t("onboarding.title") || "Become a Merchant"}</h1>
            <p className="text-[8px] text-white/20">{t("onboarding.subtitle") || "Start accepting payments today"}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        <AnimatePresence mode="wait">
          {step === "landing" && (
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* Hero */}
              <div className="text-center py-6">
                <motion.div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(0,224,255,0.1), rgba(0,232,157,0.1))", border: "1px solid rgba(0,224,255,0.15)" }}
                  animate={{ boxShadow: ["0 0 0px rgba(0,224,255,0)", "0 0 40px rgba(0,224,255,0.08)", "0 0 0px rgba(0,224,255,0)"] }}
                  transition={{ duration: 3, repeat: Infinity }}>
                  <Rocket size={28} className="text-[#00E0FF]" />
                </motion.div>
                <h2 className="text-[22px] font-black text-white/90 mb-2">{t("onboarding.hero_title") || "Accept Payments in Minutes"}</h2>
                <p className="text-[12px] text-white/30 max-w-xs mx-auto">{t("onboarding.hero_desc") || "Join thousands of businesses using BidBlitz for instant, low-fee payments."}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                {stats.map((s, i) => (
                  <motion.div key={i} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <p className="text-[16px] font-black font-mono text-[#00E0FF]">{s.val}</p>
                    <p className="text-[7px] text-white/20">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                {benefits.map((b, i) => (
                  <motion.div key={i} className="rounded-xl p-3 flex items-start gap-3"
                    style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                    <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${b.color}08`, border: `1px solid ${b.color}15` }}>
                      <b.icon size={16} style={{ color: b.color }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white/80">{b.title}</p>
                      <p className="text-[9px] text-white/25 mt-0.5">{b.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Payment Methods Preview */}
              <div className="rounded-2xl p-4" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <p className="text-[8px] text-white/15 uppercase tracking-widest font-bold mb-3">{t("onboarding.accepted_methods") || "ACCEPTED PAYMENT METHODS"}</p>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map((m, i) => (
                    <div key={i} className="rounded-xl p-3 text-center" style={{ background: `${m.color}04`, border: `1px solid ${m.color}10` }}>
                      <m.icon size={20} style={{ color: m.color }} className="mx-auto mb-1" />
                      <p className="text-[9px] font-bold" style={{ color: m.color }}>{m.label}</p>
                      <p className="text-[8px] text-white/20">{m.fee} fee</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Demo Button */}
              <motion.button data-testid="onboarding-demo-btn" onClick={() => setStep("demo")} whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
                style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)", color: "#00E0FF" }}>
                <BarChart3 size={14} /> {t("onboarding.live_demo") || "See Live Demo"}
              </motion.button>

              {/* Start Trial CTA */}
              <motion.button data-testid="onboarding-trial-btn" onClick={() => setStep("form")} whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-2xl text-[14px] font-black flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, rgba(0,232,157,0.15), rgba(0,224,255,0.1))", border: "1px solid rgba(0,232,157,0.25)", color: "#00E89D", boxShadow: "0 0 30px rgba(0,232,157,0.05)" }}>
                <Star size={16} /> {t("onboarding.start_free") || "Start 30-Day Free Trial"} <ChevronRight size={14} />
              </motion.button>
            </motion.div>
          )}

          {/* Demo View */}
          {step === "demo" && (
            <motion.div key="demo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(8,12,20,0.9)", border: "1px solid rgba(0,224,255,0.08)" }}>
                <div className="p-4 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <p className="text-[8px] text-white/15 uppercase tracking-widest font-bold">{t("onboarding.demo_terminal") || "DEMO: PAYMENT TERMINAL"}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-[8px] text-white/10 uppercase tracking-widest mb-2">AMOUNT</p>
                  <p className="text-[48px] font-black font-mono text-[#00E0FF]">24.90</p>
                  <p className="text-[10px] text-white/15 mb-4">EUR</p>
                  <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-4">
                    {[1,2,3,4,5,6,7,8,9,".",0,"DEL"].map(k => (
                      <div key={k} className="h-10 rounded-lg flex items-center justify-center text-[14px] font-mono text-white/20"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>{k}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-3">
                    <div className="py-2 rounded-lg text-center" style={{ background: "rgba(0,224,255,0.04)", border: "1px solid rgba(0,224,255,0.08)" }}>
                      <QrCode size={14} className="text-[#00E0FF] mx-auto" /><span className="text-[7px] text-[#00E0FF]">SCAN</span>
                    </div>
                    <div className="py-2 rounded-lg text-center" style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.08)" }}>
                      <QrCode size={14} className="text-[#00E89D] mx-auto" /><span className="text-[7px] text-[#00E89D]">QR</span>
                    </div>
                    <div className="py-2 rounded-lg text-center" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.08)" }}>
                      <Smartphone size={14} className="text-[#A855F7] mx-auto" /><span className="text-[7px] text-[#A855F7]">NFC</span>
                    </div>
                  </div>
                  <div className="py-3 rounded-xl text-[12px] font-bold text-[#00E89D]" style={{ background: "rgba(0,232,157,0.06)", border: "1px solid rgba(0,232,157,0.12)" }}>
                    START PAYMENT
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button onClick={() => setStep("landing")} whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold text-white/20" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  {t("common.back") || "Back"}
                </motion.button>
                <motion.button onClick={() => setStep("form")} whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl text-[11px] font-bold" style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.15)", color: "#00E89D" }}>
                  {t("onboarding.start_trial") || "Start Trial"} <ChevronRight size={12} className="inline" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Registration Form */}
          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="text-center py-3">
                <h2 className="text-[18px] font-bold text-white/90">{t("onboarding.form_title") || "Start Your Free Trial"}</h2>
                <p className="text-[10px] text-white/25">{t("onboarding.form_desc") || "30 days free — no credit card required"}</p>
              </div>

              <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}>
                {[
                  { key: "business_name", label: t("onboarding.business_name") || "Business Name", required: true },
                  { key: "contact_name", label: t("onboarding.contact_name") || "Contact Name", required: true },
                  { key: "email", label: t("onboarding.email") || "Email", type: "email", required: true },
                  { key: "phone", label: t("onboarding.phone") || "Phone (optional)" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[9px] text-white/25 uppercase tracking-widest font-bold mb-1 block">{f.label} {f.required && <span className="text-[#FF4757]">*</span>}</label>
                    <input
                      data-testid={`onboarding-${f.key}`}
                      type={f.type || "text"}
                      value={form[f.key] || ""}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[12px] text-white/80 placeholder:text-white/10 outline-none focus:border-[#00E0FF]/15 transition-colors"
                    />
                  </div>
                ))}

                <div>
                  <label className="text-[9px] text-white/25 uppercase tracking-widest font-bold mb-1 block">{t("onboarding.business_type") || "Business Type"}</label>
                  <select data-testid="onboarding-business-type" value={form.business_type || ""} onChange={e => setForm(p => ({ ...p, business_type: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[12px] text-white/80 outline-none">
                    <option value="" style={{ background: "#0a0c14" }}>{t("onboarding.select_type") || "Select..."}</option>
                    <option value="retail" style={{ background: "#0a0c14" }}>Retail / Shop</option>
                    <option value="food" style={{ background: "#0a0c14" }}>Restaurant / Food</option>
                    <option value="service" style={{ background: "#0a0c14" }}>Service Provider</option>
                    <option value="online" style={{ background: "#0a0c14" }}>Online / E-Commerce</option>
                    <option value="other" style={{ background: "#0a0c14" }}>Other</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.1)" }}>
                  <span className="text-[10px] text-[#FF4757]">{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <motion.button onClick={() => setStep("landing")} whileTap={{ scale: 0.95 }}
                  className="px-5 py-3 rounded-xl text-[11px] font-bold text-white/20" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  {t("common.back") || "Back"}
                </motion.button>
                <motion.button data-testid="onboarding-submit" onClick={submitTrial} disabled={loading} whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
                  style={{ background: "rgba(0,232,157,0.1)", border: "1px solid rgba(0,232,157,0.2)", color: "#00E89D" }}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <><Rocket size={14} /> {t("onboarding.submit") || "Start Free Trial"}</>}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Success */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(0,232,157,0.1)", border: "1px solid rgba(0,232,157,0.2)" }}>
                  <Check size={36} className="text-[#00E89D]" />
                </div>
              </motion.div>
              <h2 className="text-[20px] font-bold text-[#00E89D] mb-2">{t("onboarding.success_title") || "Welcome to BidBlitz!"}</h2>
              <p className="text-[12px] text-white/30 max-w-xs mx-auto mb-6">{t("onboarding.success_desc") || "Your 30-day free trial has started. We'll send setup instructions to your email."}</p>
              <motion.button onClick={onBack} whileTap={{ scale: 0.95 }}
                className="px-8 py-3 rounded-xl text-[12px] font-bold" style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)", color: "#00E0FF" }}>
                {t("common.done") || "Done"}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MerchantOnboardingPage;
