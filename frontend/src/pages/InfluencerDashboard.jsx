/**
 * BidBlitz V2 - Influencer Dashboard
 * Shows referral stats, commission history, and share options
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, TrendingUp, DollarSign, Link2, Copy, Check,
  Share2, Mail, MessageCircle, ExternalLink, ChevronRight,
  Award, Clock, Loader2, ArrowUpRight, Gift
} from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

const StatCard = ({ icon: Icon, label, value, subValue, color, delay }) => (
  <motion.div
    className="flex-1 min-w-[140px] p-4 rounded-2xl"
    style={{ background: "linear-gradient(145deg, #111 0%, #0A0A0A 100%)", border: "1px solid #1A1A1A" }}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon size={16} style={{ color }} />
      </div>
    </div>
    <p className="text-[22px] font-bold text-white">{value}</p>
    <p className="text-[11px] text-[#666] mt-0.5">{label}</p>
    {subValue && <p className="text-[10px] text-[#00D26A] mt-1">{subValue}</p>}
  </motion.div>
);

const CommissionRow = ({ entry }) => {
  const statusColors = {
    pending: "#FFB800",
    credited: "#00D26A",
    paid: "#00C2FF",
  };
  return (
    <motion.div
      className="flex items-center justify-between py-3 border-b border-white/5"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
          <Gift size={16} className="text-[#00C2FF]" />
        </div>
        <div>
          <p className="text-[13px] text-white font-medium">€{entry.amount?.toFixed(2)}</p>
          <p className="text-[10px] text-[#666]">{entry.type || "Commission"}</p>
        </div>
      </div>
      <div className="text-right">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: `${statusColors[entry.status] || "#666"}20`,
            color: statusColors[entry.status] || "#666"
          }}
        >
          {entry.status}
        </span>
        <p className="text-[9px] text-[#444] mt-1">
          {new Date(entry.created_at).toLocaleDateString()}
        </p>
      </div>
    </motion.div>
  );
};

export const InfluencerDashboard = () => {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API}/api/influencer/me`, { credentials: "include" });
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const copyLink = () => {
    if (data?.referral_code) {
      navigator.clipboard.writeText(`https://bidblitz.com/join?ref=${data.referral_code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareVia = (platform) => {
    const link = `https://bidblitz.com/join?ref=${data?.referral_code}`;
    const msg = t("influencer.share_msg") || `Tritt BidBlitz bei und erhalte tolle Belohnungen! Nutze meinen Code: ${data?.referral_code}`;
    
    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg + " " + link)}`, "_blank");
    } else if (platform === "email") {
      window.open(`mailto:?subject=BidBlitz Einladung&body=${encodeURIComponent(msg + "\n\n" + link)}`, "_blank");
    } else if (platform === "native" && navigator.share) {
      navigator.share({ title: "BidBlitz", text: msg, url: link });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00C2FF] animate-spin" />
      </div>
    );
  }

  if (!data?.is_influencer) {
    return (
      <div className="min-h-screen bg-[#050505] p-5 flex flex-col items-center justify-center">
        <Award size={48} className="text-[#333] mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">{t("influencer.not_approved") || "Noch nicht freigeschaltet"}</h2>
        <p className="text-[#666] text-sm text-center max-w-xs">
          {t("influencer.apply_hint") || "Beantrage den Influencer-Status in den Einstellungen, um Provisionen zu verdienen."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <motion.h1
          className="text-2xl font-bold text-white mb-1"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {t("influencer.dashboard") || "Influencer Dashboard"}
        </motion.h1>
        <p className="text-[13px] text-[#666]">
          {t("influencer.welcome") || "Verdiene Provisionen durch Empfehlungen"}
        </p>
      </div>

      {/* Referral Link Card */}
      <motion.div
        className="mx-5 p-4 rounded-2xl mb-5"
        style={{
          background: "linear-gradient(135deg, #00C2FF15 0%, #00C2FF05 100%)",
          border: "1px solid #00C2FF20"
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-[#00C2FF]" />
            <span className="text-[12px] text-[#00C2FF] font-medium">
              {t("influencer.your_code") || "Dein Referral-Code"}
            </span>
          </div>
          <span className="text-[18px] font-bold text-white tracking-wider">
            {data.referral_code}
          </span>
        </div>
        
        <div className="flex gap-2">
          <motion.button
            onClick={copyLink}
            className="flex-1 py-2.5 rounded-xl bg-[#00C2FF] text-[#0A0A0A] text-[12px] font-semibold flex items-center justify-center gap-1.5"
            whileTap={{ scale: 0.98 }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t("common.copied") || "Kopiert!" : t("influencer.copy_link") || "Link kopieren"}
          </motion.button>
          <motion.button
            onClick={() => shareVia("native")}
            className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.95 }}
          >
            <Share2 size={18} className="text-white" />
          </motion.button>
        </div>

        {/* Share Options */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => shareVia("whatsapp")}
            className="flex-1 py-2 rounded-lg bg-[#25D366]/10 text-[#25D366] text-[11px] font-medium flex items-center justify-center gap-1"
          >
            <MessageCircle size={12} /> WhatsApp
          </button>
          <button
            onClick={() => shareVia("email")}
            className="flex-1 py-2 rounded-lg bg-white/5 text-white text-[11px] font-medium flex items-center justify-center gap-1"
          >
            <Mail size={12} /> E-Mail
          </button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="px-5 mb-5">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <StatCard
            icon={Users}
            label={t("influencer.signups") || "Anmeldungen"}
            value={data.total_referrals || 0}
            color="#00C2FF"
            delay={0.15}
          />
          <StatCard
            icon={TrendingUp}
            label={t("influencer.purchases") || "Käufe"}
            value={data.active_referrals || 0}
            color="#00D26A"
            delay={0.2}
          />
          <StatCard
            icon={DollarSign}
            label={t("influencer.earned") || "Verdient"}
            value={`€${(data.total_earned || 0).toFixed(2)}`}
            subValue={data.pending_payout > 0 ? `+€${data.pending_payout.toFixed(2)} pending` : null}
            color="#FFB800"
            delay={0.25}
          />
        </div>
      </div>

      {/* Earnings Summary */}
      <motion.div
        className="mx-5 p-4 rounded-2xl mb-5"
        style={{ background: "#0A0A0A", border: "1px solid #1A1A1A" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-[14px] font-semibold text-white mb-3">
          {t("influencer.earnings_overview") || "Einnahmenübersicht"}
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#666]">{t("influencer.total_earned") || "Gesamt verdient"}</span>
            <span className="text-[14px] font-bold text-white">€{(data.total_earned || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#666]">{t("influencer.pending") || "Ausstehend"}</span>
            <span className="text-[14px] font-medium text-[#FFB800]">€{(data.pending_payout || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#666]">{t("influencer.paid_out") || "Ausgezahlt"}</span>
            <span className="text-[14px] font-medium text-[#00D26A]">€{(data.total_paid || 0).toFixed(2)}</span>
          </div>
          <div className="h-px bg-white/5 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#888]">{t("influencer.commission_rate") || "Deine Provision"}</span>
            <span className="text-[14px] font-bold text-[#00C2FF]">{data.custom_rate || 10}%</span>
          </div>
        </div>
      </motion.div>

      {/* Manager Info (if linked) */}
      {data.manager_id && (
        <motion.div
          className="mx-5 p-4 rounded-2xl mb-5"
          style={{ background: "#0A0A0A", border: "1px solid #A855F720" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Award size={14} className="text-[#A855F7]" />
            <span className="text-[11px] text-[#A855F7] font-medium">
              {t("influencer.your_manager") || "Dein Manager"}
            </span>
          </div>
          <p className="text-[14px] text-white font-medium">{data.manager_name || "Manager"}</p>
        </motion.div>
      )}

      {/* Recent Commissions */}
      <div className="mx-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-white">
            {t("influencer.recent_commissions") || "Letzte Provisionen"}
          </h3>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "#0A0A0A", border: "1px solid #1A1A1A" }}>
          {data.recent_commissions?.length > 0 ? (
            data.recent_commissions.slice(0, 5).map((c, i) => (
              <CommissionRow key={i} entry={c} />
            ))
          ) : (
            <div className="py-8 text-center">
              <Gift size={32} className="text-[#333] mx-auto mb-2" />
              <p className="text-[12px] text-[#666]">
                {t("influencer.no_commissions") || "Noch keine Provisionen"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InfluencerDashboard;
