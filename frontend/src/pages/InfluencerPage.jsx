import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Copy, Check, Users, TrendingUp, Coins, Award, Link2, Shield, ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const glass = "backdrop-blur-xl";
const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const InfluencerPage = ({ onBack }) => {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [refs, setRefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showLinked, setShowLinked] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getInfluencerProfile().then(setData).catch(() => {}),
      api.getInfluencerReferrals().then(setRefs).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const shareUrl = `https://bidblitz.ae?ref=${refs?.referral_code || data?.referral_code || ""}`;
  const copyLink = () => { navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const shareWA = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Join BidBlitz - win premium products for pennies! ${shareUrl}`)}`, "_blank");

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}><Loader2 size={24} className="text-white/20 animate-spin" /></div>;

  if (!data?.is_influencer) {
    return (
      <motion.div className="min-h-screen pb-24" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: panelBorder }}>
          <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
            <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"><ArrowLeft size={15} className="text-white/40" /></motion.button>
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">Influencer Program</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(0,224,255,0.05)", border: "1px solid rgba(0,224,255,0.1)" }}>
            <Award size={28} className="text-[#00E0FF]/40" />
          </div>
          <h2 className="text-[18px] font-bold text-white/70 mb-2">Earn with BidBlitz</h2>
          <p className="text-[12px] text-white/25 mb-6 max-w-xs mx-auto">Invite users and earn up to 10% commission on every purchase they make. Contact admin to get started.</p>
          <div className="text-[10px] text-white/10">admin@bidblitz.ae</div>
        </div>
      </motion.div>
    );
  }

  const isManager = data.type === "manager";
  const rate = data.commission_rate || 10;

  return (
    <motion.div data-testid="influencer-page" className="min-h-screen pb-24" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: panelBorder }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"><ArrowLeft size={15} className="text-white/40" /></motion.button>
          <div>
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">{isManager ? "Manager Dashboard" : "Influencer Dashboard"}</h1>
            <p className="text-[9px] text-white/25">{rate}% Commission</p>
          </div>
          <div className="ml-auto px-2 py-1 rounded-lg" style={{ background: isManager ? "rgba(255,209,102,0.06)" : "rgba(0,224,255,0.06)", border: `1px solid ${isManager ? "rgba(255,209,102,0.1)" : "rgba(0,224,255,0.1)"}` }}>
            <span className={`text-[9px] font-bold ${isManager ? "text-[#FFD166]" : "text-[#00E0FF]"}`}>{isManager ? "MANAGER" : "INFLUENCER"}</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* Earnings Summary */}
        <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">{t("influencer.reward_balance") || "Reward Balance"}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[20px] font-black text-[#00E0FF] font-mono">{Math.round(data.total_earned)}</p>
              <p className="text-[8px] text-white/20 mt-0.5">{t("influencer.total_credits") || "Total Credits"}</p>
            </div>
            <div className="text-center">
              <p className="text-[20px] font-black text-[#FFD166] font-mono">{Math.round(data.pending_payout)}</p>
              <p className="text-[8px] text-white/20 mt-0.5">{t("influencer.pending") || "Pending"}</p>
            </div>
            <div className="text-center">
              <p className="text-[20px] font-black text-[#00E89D] font-mono">{Math.round(data.total_paid)}</p>
              <p className="text-[8px] text-white/20 mt-0.5">{t("influencer.credited") || "Credited"}</p>
            </div>
          </div>
        </motion.div>

        {/* Referral Link */}
        <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-2">Your Referral Link</p>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <Link2 size={12} className="text-[#00E0FF]/40 flex-shrink-0" />
            <span className="text-[10px] text-white/50 font-mono flex-1 truncate">{shareUrl}</span>
            <motion.button data-testid="inf-copy-link" onClick={copyLink} whileTap={{ scale: 0.9 }} className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center flex-shrink-0">
              {copied ? <Check size={11} className="text-[#00E89D]" /> : <Copy size={11} className="text-white/30" />}
            </motion.button>
          </div>
          <div className="flex gap-2 mt-2.5">
            <motion.button onClick={shareWA} whileTap={{ scale: 0.95 }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.12)" }}>
              <Smartphone size={10} className="text-[#25D366]" /><span className="text-[9px] font-bold text-[#25D366]">WhatsApp</span>
            </motion.button>
            <motion.button onClick={copyLink} whileTap={{ scale: 0.95 }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ background: "rgba(0,224,255,0.04)", border: "1px solid rgba(0,224,255,0.08)" }}>
              <Copy size={10} className="text-[#00E0FF]" /><span className="text-[9px] font-bold text-[#00E0FF]">{copied ? "Copied!" : "Copy Link"}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Referral Stats */}
        <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">Referral Stats</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
              <Users size={14} className="text-[#00E0FF]/40" />
              <div><p className="text-[16px] font-bold text-white/80">{refs?.total_referrals || 0}</p><p className="text-[8px] text-white/20">Total Referrals</p></div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
              <TrendingUp size={14} className="text-[#00E89D]/40" />
              <div><p className="text-[16px] font-bold text-white/80">{refs?.active_referrals || 0}</p><p className="text-[8px] text-white/20">Active Users</p></div>
            </div>
          </div>
        </motion.div>

        {/* Manager: Linked Influencers */}
        {isManager && data.linked_influencers?.length > 0 && (
          <motion.div className={`rounded-2xl overflow-hidden ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <motion.button onClick={() => setShowLinked(p => !p)} className="w-full flex items-center justify-between px-4 py-3" whileTap={{ scale: 0.99 }}>
              <span className="text-[11px] font-semibold text-white/60">Linked Influencers ({data.linked_influencers.length})</span>
              {showLinked ? <ChevronUp size={14} className="text-white/20" /> : <ChevronDown size={14} className="text-white/20" />}
            </motion.button>
            <AnimatePresence>
              {showLinked && (
                <motion.div className="px-4 pb-3 space-y-1.5" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {data.linked_influencers.map((inf, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.01] border border-white/[0.03]">
                      <div className="w-6 h-6 rounded-full bg-[#00E0FF]/5 flex items-center justify-center"><span className="text-[8px] font-bold text-[#00E0FF]">{(inf.user_name || "?")[0]}</span></div>
                      <div className="flex-1"><p className="text-[10px] text-white/60">{inf.user_name || inf.user_email}</p><p className="text-[8px] text-white/20">{inf.referral_code}</p></div>
                      <span className="text-[9px] text-[#00E89D] font-bold">{inf.commission_rate || "10"}%</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Recent Commissions */}
        {data.recent_commissions?.length > 0 && (
          <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">{t("influencer.recent_commissions") || "Recent Commissions"}</p>
            <div className="space-y-1.5">
              {data.recent_commissions.slice(0, 8).map((c, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${c.status === "credited" ? "bg-[#00E89D]" : "bg-[#FFD166]"}`} />
                  <span className="text-[10px] text-white/40 flex-1">{c.type === "override" ? "Override" : "Direct"}</span>
                  <span className="text-[10px] text-white/20">{c.rate}%</span>
                  <span className="text-[11px] font-bold text-[#00E0FF] font-mono">+{Math.round(c.amount)} Cr</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="text-center py-3"><p className="text-[9px] text-white/10">bidblitz.ae</p></div>
      </div>
    </motion.div>
  );
};

export default InfluencerPage;
