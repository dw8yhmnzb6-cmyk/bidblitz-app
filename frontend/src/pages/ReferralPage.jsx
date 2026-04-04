import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Gift, Copy, Check, Users, Award, ChevronLeft, Share2, Loader2
} from "lucide-react";
import { api } from "../services/api";
import { useI18n } from "../store";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

const ReferralPage = ({ onBack }) => {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [applyMsg, setApplyMsg] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.getMyReferral();
        setData(d);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const copyCode = () => {
    if (data?.referral_code) {
      navigator.clipboard.writeText(data.referral_code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = () => {
    const appUrl = `${window.location.origin}?ref=${data?.referral_code || ""}`;
    if (navigator.share) {
      navigator.share({ title: "BidBlitz", text: t("referral.share_text").replace("{code}", data?.referral_code || ""), url: appUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(appUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = async () => {
    if (!applyCode.trim()) return;
    setApplying(true);
    setApplyMsg(null);
    try {
      const res = await api.applyReferral(applyCode.trim());
      setApplyMsg({ type: "success", text: res.message });
      setApplyCode("");
    } catch (err) {
      setApplyMsg({ type: "error", text: err.message });
    } finally { setApplying(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={24} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  return (
    <motion.div
      data-testid="referral-page"
      className="min-h-screen"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3">
        <motion.button
          data-testid="referral-back-btn"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }} onClick={onBack}
        >
          <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">
          {t("referral.title")}
        </h1>
      </div>

      <div className="px-5 pb-8 space-y-5">
        {/* Hero Card */}
        <motion.div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(0,194,255,0.08), rgba(0,194,255,0.02))", border: "1px solid rgba(0,194,255,0.12)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ...slide }}
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none" style={{ background: "rgba(0,194,255,0.1)", filter: "blur(40px)" }} />
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "rgba(0,194,255,0.12)" }}>
              <Gift size={22} className="text-[#00C2FF]" />
            </div>
            <h2 className="text-[18px] font-bold text-white font-outfit mb-1">{t("referral.invite_title")}</h2>
            <p className="text-[12px] text-[#666] mb-4">{t("referral.invite_desc")}</p>

            {/* Code Display */}
            <div className="flex items-center gap-2 mb-3">
              <div
                data-testid="referral-code-display"
                className="flex-1 px-4 py-3 rounded-xl font-mono text-[16px] font-bold text-[#00C2FF] tracking-widest text-center"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,194,255,0.15)" }}
              >
                {data?.referral_code || "---"}
              </div>
              <motion.button
                data-testid="copy-referral-btn"
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: copied ? "rgba(0,210,106,0.15)" : "rgba(0,194,255,0.1)", border: `1px solid ${copied ? "rgba(0,210,106,0.3)" : "rgba(0,194,255,0.2)"}` }}
                whileTap={{ scale: 0.9 }} onClick={copyCode}
              >
                {copied ? <Check size={16} className="text-[#00D26A]" /> : <Copy size={16} className="text-[#00C2FF]" />}
              </motion.button>
            </div>

            <motion.button
              data-testid="share-referral-btn"
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-[13px]"
              style={{ background: "#00C2FF", color: "#020202" }}
              whileTap={{ scale: 0.96 }} onClick={shareLink}
            >
              <Share2 size={15} />
              {t("referral.share")}
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="grid grid-cols-3 gap-2"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ...slide }}
        >
          {[
            { label: t("referral.invited"), value: data?.total_referrals || 0, icon: Users, color: "#00C2FF" },
            { label: t("referral.rewarded"), value: data?.rewarded_referrals || 0, icon: Award, color: "#00D26A" },
            { label: t("referral.earned"), value: `${(data?.total_earned || 0).toFixed(2)}`, icon: Gift, color: "#FFB800" },
          ].map((s, i) => (
            <div key={i} className="rounded-xl px-3 py-3 text-center" style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <s.icon size={16} className="mx-auto mb-1.5" style={{ color: s.color }} />
              <p className="text-[16px] font-bold text-white font-outfit">{s.value}</p>
              <p className="text-[9px] text-[#444] font-semibold uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Apply Referral Code */}
        <motion.div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ...slide }}
        >
          <h3 className="text-[13px] font-semibold text-white font-outfit mb-3">{t("referral.have_code")}</h3>
          <div className="flex items-center gap-2">
            <input
              data-testid="apply-referral-input"
              type="text"
              value={applyCode}
              onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
              placeholder="BB-XXXXXX"
              className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[13px] text-white font-mono tracking-wider placeholder-[#333] outline-none focus:border-[#00C2FF]/30"
            />
            <motion.button
              data-testid="apply-referral-btn"
              className="px-4 py-2.5 rounded-xl text-[12px] font-semibold"
              style={{ background: "rgba(0,194,255,0.1)", border: "1px solid rgba(0,194,255,0.2)", color: "#00C2FF" }}
              whileTap={{ scale: 0.95 }} onClick={handleApply}
              disabled={applying}
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : t("referral.apply")}
            </motion.button>
          </div>
          {applyMsg && (
            <p className={`mt-2 text-[11px] font-medium ${applyMsg.type === "success" ? "text-[#00D26A]" : "text-[#FF4B4B]"}`}>
              {applyMsg.text}
            </p>
          )}
        </motion.div>

        {/* Reward Info */}
        <motion.div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ...slide }}
        >
          <h3 className="text-[13px] font-semibold text-white font-outfit mb-2">{t("referral.how_it_works")}</h3>
          <div className="space-y-2">
            {[
              { step: "1", text: t("referral.step_1") },
              { step: "2", text: t("referral.step_2") },
              { step: "3", text: t("referral.step_3") },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(0,194,255,0.1)" }}>
                  <span className="text-[10px] font-bold text-[#00C2FF]">{s.step}</span>
                </div>
                <p className="text-[12px] text-[#888] leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ReferralPage;
