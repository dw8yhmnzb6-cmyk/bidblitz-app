import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Check, Zap, Store, Users, Shield, CreditCard,
  Smartphone, QrCode, Monitor, Star, Loader2, ChevronRight,
  BarChart3, Wifi, Package, Tablet
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const MerchantPricingPage = ({ onBack, onStartTrial }) => {
  const { t } = useI18n();
  const [pricing, setPricing] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPricing().then(d => { setPricing(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#020408" }}><Loader2 size={20} className="text-white/15 animate-spin" /></div>;
  }

  const plans = pricing?.plans || [];
  const terminals = pricing?.terminal_options || [];
  const fees = pricing?.fee_structure || {};

  const planColors = { starter: "#00E89D", professional: "#00E0FF", enterprise: "#FFB800" };

  return (
    <motion.div data-testid="merchant-pricing-page" className="min-h-screen pb-24" style={{ background: "#020408" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(2,4,8,0.9)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button data-testid="pricing-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[14px] font-bold text-white/90">{t("pricing.title") || "Merchant Plans & Pricing"}</h1>
            <p className="text-[8px] text-white/20">{t("pricing.subtitle") || "Transparent pricing for every business size"}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Plans */}
        <div className="space-y-3">
          {plans.map((plan, i) => {
            const color = planColors[plan.id] || "#00E0FF";
            const isSelected = selectedPlan === plan.id;
            return (
              <motion.div
                key={plan.id}
                data-testid={`plan-${plan.id}`}
                onClick={() => setSelectedPlan(plan.id)}
                className="rounded-2xl p-4 cursor-pointer backdrop-blur-xl"
                style={{
                  background: isSelected ? `${color}04` : "rgba(8,12,20,0.7)",
                  border: `1px solid ${isSelected ? `${color}20` : "rgba(255,255,255,0.04)"}`,
                  boxShadow: plan.popular ? `0 0 30px ${color}06` : "none",
                }}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-white/90">{plan.name}</h3>
                      {plan.popular && (
                        <span className="px-2 py-0.5 rounded-full text-[7px] font-bold" style={{ background: `${color}15`, color, border: `1px solid ${color}20` }}>
                          {t("pricing.popular") || "POPULAR"}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-white/25 mt-0.5">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    {plan.price === 0 ? (
                      <p className="text-[20px] font-black" style={{ color }}>{t("pricing.free") || "Free"}</p>
                    ) : (
                      <div>
                        <span className="text-[20px] font-black" style={{ color }}>{plan.price}</span>
                        <span className="text-[10px] text-white/20 ml-0.5">/mo</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {plan.features.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <Check size={10} style={{ color }} />
                      <span className="text-[9px] text-white/40">{f}</span>
                    </div>
                  ))}
                </div>

                {isSelected && (
                  <motion.button
                    data-testid={`select-plan-${plan.id}`}
                    onClick={(e) => { e.stopPropagation(); onStartTrial?.(); }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full py-3 rounded-xl text-[11px] font-bold mt-3 flex items-center justify-center gap-1"
                    style={{ background: `${color}10`, border: `1px solid ${color}20`, color }}
                  >
                    {plan.price === 0 ? (t("pricing.start_free") || "Start Free") : (t("pricing.choose_plan") || "Choose Plan")} <ChevronRight size={12} />
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Fee Structure */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[8px] text-white/15 uppercase tracking-widest font-bold mb-3">{t("pricing.fee_structure") || "TRANSACTION FEE STRUCTURE"}</p>
          <div className="space-y-2">
            {Object.entries(fees).map(([key, f]) => {
              const feeColor = f.rate <= 0.5 ? "#00E89D" : f.rate <= 1 ? "#00E0FF" : "#FFB800";
              return (
                <div key={key} className="flex items-center gap-3 py-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: feeColor }} />
                  <span className="text-[10px] text-white/50 flex-1">{f.label}</span>
                  <span className="text-[12px] font-bold font-mono" style={{ color: feeColor }}>{f.rate}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminal Hardware */}
        <div>
          <p className="text-[8px] text-white/15 uppercase tracking-widest font-bold mb-3 px-1">{t("pricing.terminal_hardware") || "TERMINAL HARDWARE"}</p>
          <div className="space-y-2">
            {terminals.map((term, i) => (
              <motion.div key={term.id} className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.1)" }}>
                  {term.id === "tablet_stand" ? <Tablet size={16} className="text-[#A855F7]" /> : <Monitor size={16} className="text-[#A855F7]" />}
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-white/80">{term.name}</p>
                  <p className="text-[8px] text-white/25">{term.description}</p>
                </div>
                <div className="text-right">
                  {term.price > 0 && <p className="text-[13px] font-black text-[#00E0FF] font-mono">{term.price} EUR</p>}
                  {term.monthly > 0 && <p className="text-[9px] text-white/25">{term.monthly}/mo</p>}
                  {term.price === 0 && term.monthly > 0 && <p className="text-[13px] font-black text-[#FFB800] font-mono">{term.monthly}/mo</p>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Hardware Features */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[8px] text-white/15 uppercase tracking-widest font-bold mb-3">{t("pricing.hw_features") || "TERMINAL FEATURES"}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Tablet, label: t("pricing.tablet_stand") || "Tablet Stand Setup", desc: "iPad / Android" },
              { icon: Smartphone, label: t("pricing.nfc_support") || "NFC Support", desc: "Contactless ready" },
              { icon: QrCode, label: t("pricing.scanner") || "Barcode Scanner", desc: "Instant scan" },
              { icon: Wifi, label: t("pricing.connectivity") || "WiFi + 4G", desc: "Always connected" },
              { icon: Shield, label: t("pricing.security") || "Secure Payments", desc: "End-to-end encrypted" },
              { icon: Package, label: t("pricing.kiosk") || "Kiosk Mode", desc: "Fullscreen POS" },
            ].map((f, i) => (
              <div key={i} className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}>
                <f.icon size={14} className="text-white/20" />
                <div>
                  <p className="text-[9px] font-bold text-white/50">{f.label}</p>
                  <p className="text-[7px] text-white/15">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default MerchantPricingPage;
