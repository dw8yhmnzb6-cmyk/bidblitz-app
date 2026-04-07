/**
 * BidBlitz V2 - Manager Dashboard
 * Shows assigned influencers, override earnings, and team performance
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, TrendingUp, DollarSign, Award, ChevronRight,
  Loader2, ArrowUpRight, BarChart3, Crown, UserPlus
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

const InfluencerRow = ({ influencer, rank }) => (
  <motion.div
    className="flex items-center justify-between py-3 border-b border-white/5"
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: rank * 0.05 }}
  >
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#A855F7]/20 to-[#00C2FF]/20 flex items-center justify-center relative">
        <span className="text-[14px] font-bold text-white">{rank}</span>
        {rank === 1 && (
          <Crown size={10} className="text-[#FFB800] absolute -top-1 -right-1" />
        )}
      </div>
      <div>
        <p className="text-[13px] text-white font-medium">{influencer.name || influencer.email}</p>
        <p className="text-[10px] text-[#666]">{influencer.referral_code}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-[13px] font-bold text-white">{influencer.total_referrals || 0}</p>
      <p className="text-[10px] text-[#666]">Referrals</p>
    </div>
  </motion.div>
);

export const ManagerDashboard = () => {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#A855F7] animate-spin" />
      </div>
    );
  }

  if (!data?.is_influencer || data?.type !== "manager") {
    return (
      <div className="min-h-screen bg-[#050505] p-5 flex flex-col items-center justify-center">
        <Crown size={48} className="text-[#333] mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">{t("manager.not_approved") || "Manager-Zugang erforderlich"}</h2>
        <p className="text-[#666] text-sm text-center max-w-xs">
          {t("manager.apply_hint") || "Beantrage den Manager-Status, um ein Team von Influencern zu leiten."}
        </p>
      </div>
    );
  }

  const linkedInfluencers = data.linked_influencers || [];
  const totalTeamReferrals = linkedInfluencers.reduce((acc, i) => acc + (i.total_referrals || 0), 0);
  const totalTeamEarnings = linkedInfluencers.reduce((acc, i) => acc + (i.total_earned || 0), 0);

  return (
    <div className="min-h-screen bg-[#050505] pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Crown size={20} className="text-[#A855F7]" />
          <motion.h1
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {t("manager.dashboard") || "Manager Dashboard"}
          </motion.h1>
        </div>
        <p className="text-[13px] text-[#666]">
          {t("manager.welcome") || "Verwalte dein Influencer-Team"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="px-5 mb-5">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <StatCard
            icon={Users}
            label={t("manager.team_size") || "Team-Größe"}
            value={linkedInfluencers.length}
            color="#A855F7"
            delay={0.1}
          />
          <StatCard
            icon={TrendingUp}
            label={t("manager.total_referrals") || "Team-Referrals"}
            value={totalTeamReferrals}
            color="#00C2FF"
            delay={0.15}
          />
          <StatCard
            icon={DollarSign}
            label={t("manager.override_earned") || "Override verdient"}
            value={`€${(data.total_earned || 0).toFixed(2)}`}
            color="#FFB800"
            delay={0.2}
          />
        </div>
      </div>

      {/* Override Rate */}
      <motion.div
        className="mx-5 p-4 rounded-2xl mb-5"
        style={{
          background: "linear-gradient(135deg, #A855F715 0%, #A855F705 100%)",
          border: "1px solid #A855F720"
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#A855F7] font-medium mb-1">
              {t("manager.override_rate") || "Deine Override-Provision"}
            </p>
            <p className="text-[24px] font-bold text-white">{data.custom_rate || 3}%</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#A855F7]/10 flex items-center justify-center">
            <BarChart3 size={24} className="text-[#A855F7]" />
          </div>
        </div>
        <p className="text-[10px] text-[#666] mt-2">
          {t("manager.override_hint") || "Du erhältst diese Provision auf alle Umsätze deiner Influencer"}
        </p>
      </motion.div>

      {/* Team Performance */}
      <motion.div
        className="mx-5 p-4 rounded-2xl mb-5"
        style={{ background: "#0A0A0A", border: "1px solid #1A1A1A" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-[14px] font-semibold text-white mb-3">
          {t("manager.team_performance") || "Team-Leistung"}
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#666]">{t("manager.team_signups") || "Team-Anmeldungen"}</span>
            <span className="text-[14px] font-bold text-white">{totalTeamReferrals}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#666]">{t("manager.team_earnings") || "Team-Einnahmen"}</span>
            <span className="text-[14px] font-medium text-[#00D26A]">€{totalTeamEarnings.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#666]">{t("manager.your_override") || "Dein Override"}</span>
            <span className="text-[14px] font-bold text-[#A855F7]">€{(data.total_earned || 0).toFixed(2)}</span>
          </div>
        </div>
      </motion.div>

      {/* Linked Influencers */}
      <div className="mx-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-white">
            {t("manager.your_team") || "Dein Team"} ({linkedInfluencers.length})
          </h3>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "#0A0A0A", border: "1px solid #1A1A1A" }}>
          {linkedInfluencers.length > 0 ? (
            linkedInfluencers
              .sort((a, b) => (b.total_referrals || 0) - (a.total_referrals || 0))
              .map((inf, i) => (
                <InfluencerRow key={inf.user_id || i} influencer={inf} rank={i + 1} />
              ))
          ) : (
            <div className="py-8 text-center">
              <UserPlus size={32} className="text-[#333] mx-auto mb-2" />
              <p className="text-[12px] text-[#666]">
                {t("manager.no_influencers") || "Noch keine Influencer in deinem Team"}
              </p>
              <p className="text-[10px] text-[#444] mt-1">
                {t("manager.contact_admin") || "Kontaktiere den Admin, um Influencer zuzuweisen"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Override Commissions */}
      {data.recent_commissions?.length > 0 && (
        <div className="mx-5 mt-5">
          <h3 className="text-[14px] font-semibold text-white mb-3">
            {t("manager.recent_overrides") || "Letzte Override-Provisionen"}
          </h3>
          <div className="rounded-2xl p-4" style={{ background: "#0A0A0A", border: "1px solid #1A1A1A" }}>
            {data.recent_commissions.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-[12px] text-white">€{c.amount?.toFixed(2)}</p>
                  <p className="text-[9px] text-[#666]">{c.influencer_name || "Influencer"}</p>
                </div>
                <p className="text-[9px] text-[#444]">
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
