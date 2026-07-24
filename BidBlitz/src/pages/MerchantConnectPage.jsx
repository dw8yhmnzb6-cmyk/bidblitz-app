import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, Check, Shield, TrendingUp, Wallet, Clock, AlertCircle } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const glass = "backdrop-blur-xl";
const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";
const accentCyan = "#00E0FF";
const accentGold = "#FFD166";
const accentGreen = "#00E89D";

const MerchantConnectPage = ({ onBack }) => {
  const { t, lang } = useI18n();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  const merchantConnectFallback = {
    de: { title: "Stripe Connect", desc: "Starte Auszahlungen für deine Verkäufe" },
    en: { title: "Stripe Connect", desc: "Start payouts for your sales" },
    sq: { title: "Stripe Connect", desc: "Nis tërheqjet për shitjet e tua" },
    ar: { title: "ابدأ السحوبات لمبيعاتك", desc: "ابدأ السحوبات لمبيعاتك" },
  }[locale] || { title: "Stripe Connect", desc: "Start payouts for your sales" };
  const merchantConnectTitle = t("merchant.connect_title") === "merchant.connect_title" ? merchantConnectFallback.title : t("merchant.connect_title");
  const merchantConnectDesc = t("merchant.connect_desc") === "merchant.connect_desc" ? merchantConnectFallback.desc : t("merchant.connect_desc");
  const [status, setStatus] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getConnectStatus().then(setStatus).catch(() => {}),
      api.getMerchantEarnings().then(setEarnings).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const startOnboarding = async () => {
    setOnboarding(true);
    try {
      const r = await api.createConnectAccount({ business_name: "" });
      if (r.onboarding_url) window.open(r.onboarding_url, "_blank");
      setTimeout(() => api.getConnectStatus().then(setStatus), 3000);
    } catch (e) {
      console.error(e);
    }
    setOnboarding(false);
  };

  const isActive = status?.status === "active";
  const isPending = status?.connected && status?.status === "pending";

  return (
    <motion.div data-testid="merchant-connect-page" className="min-h-screen pb-24" style={{ background: "#040610" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
            className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div>
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">{merchantConnectTitle}</h1>
            <p className="text-[10px] text-white/25">{merchantConnectDesc}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="text-white/20 animate-spin" /></div>
        ) : (
          <>
            {/* Status Card */}
            <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: isActive ? "rgba(0,232,157,0.06)" : "rgba(0,224,255,0.06)", border: `1px solid ${isActive ? "rgba(0,232,157,0.12)" : "rgba(0,224,255,0.1)"}` }}>
                  <Shield size={18} className={isActive ? "text-[#00E89D]" : "text-[#00E0FF]"} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-white/85">Stripe Connect</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#00E89D]" : isPending ? "bg-[#FFD166]" : "bg-white/10"}`} />
                    <span className={`text-[10px] font-semibold ${isActive ? "text-[#00E89D]" : isPending ? "text-[#FFD166]" : "text-white/25"}`}>
                      {isActive ? t("merchant.status_active") : isPending ? t("merchant.status_pending") : "Not connected"}
                    </span>
                  </div>
                </div>
                {status?.account_id && <span className="text-[8px] font-mono text-white/15">{status.account_id.slice(0, 12)}...</span>}
              </div>

              {!status?.connected && (
                <motion.button data-testid="connect-start-btn" onClick={startOnboarding} disabled={onboarding}
                  className="w-full py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
                  style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)", color: accentCyan }}
                  whileTap={{ scale: 0.97 }}>
                  {onboarding ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                  {t("merchant.onboarding")}
                </motion.button>
              )}

              {isPending && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-2"
                  style={{ background: "rgba(255,209,102,0.04)", border: "1px solid rgba(255,209,102,0.1)" }}>
                  <Clock size={12} className="text-[#FFD166]" />
                  <span className="text-[10px] text-[#FFD166] font-medium">Onboarding in progress — complete on Stripe</span>
                </div>
              )}

              {isActive && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-2"
                  style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.1)" }}>
                  <Check size={12} className="text-[#00E89D]" />
                  <span className="text-[10px] text-[#00E89D] font-medium">Payments & Payouts enabled</span>
                </div>
              )}
            </motion.div>

            {/* Earnings Card */}
            <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">{t("merchant.earnings")}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[18px] font-black text-[#00E0FF] font-mono">{(earnings?.total_earned || 0).toFixed(2)}</p>
                  <p className="text-[8px] text-white/20 mt-0.5">{t("merchant.earnings")}</p>
                </div>
                <div className="text-center">
                  <p className="text-[18px] font-black text-[#FFD166] font-mono">{(earnings?.pending_payout || 0).toFixed(2)}</p>
                  <p className="text-[8px] text-white/20 mt-0.5">{t("merchant.pending_payout")}</p>
                </div>
                <div className="text-center">
                  <p className="text-[18px] font-black text-[#00E89D] font-mono">{(earnings?.total_paid_out || 0).toFixed(2)}</p>
                  <p className="text-[8px] text-white/20 mt-0.5">{t("merchant.total_paid")}</p>
                </div>
              </div>
            </motion.div>

            {/* Domain branding */}
            <motion.div className="text-center py-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <p className="text-[10px] text-white/10 font-medium">Powered by <span className="text-[#00E0FF]/30">bidblitz.ae</span></p>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default MerchantConnectPage;
