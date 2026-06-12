import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Flame, Gift, Trophy, Star, Zap, Target,
  Check, Loader2, Bell, ChevronRight, Clock, Wallet, Download, Filter, Crown, BadgeDollarSign
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const glass = "backdrop-blur-xl";
const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const STREAK_LABELS = {
  1: { icon: Flame, color: "#FF6B6B" },
  2: { icon: Flame, color: "#FF8C42" },
  3: { icon: Flame, color: "#FFB800" },
  4: { icon: Flame, color: "#FFD166" },
  5: { icon: Star, color: "#00E0FF" },
  6: { icon: Star, color: "#A855F7" },
  7: { icon: Trophy, color: "#FFD700" },
};

const MILESTONE_ICONS = {
  first_topup: Zap,
  first_bid: Target,
  first_win: Trophy,
  first_invite: Gift,
};

const RewardsPage = ({ onBack }) => {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimingMs, setClaimingMs] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [justClaimed, setJustClaimed] = useState(null);
  const [dashboardV3, setDashboardV3] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("");
  const [merchantRewardDraft, setMerchantRewardDraft] = useState({ title: "", description: "", reward_type: "voucher", cost_bidcoins: 100, cashback_amount: 0, voucher_code: "", free_product_name: "" });
  const [creatingMerchantReward, setCreatingMerchantReward] = useState(false);

  const load = useCallback(async () => {
    try {
      const [status, notifsData] = await Promise.all([
        api.getRewardStatus(),
        api.getRewardNotifications().catch(() => ({ notifications: [] })),
      ]);
      setData(status);
      setNotifs(notifsData.notifications || []);
      const v3 = await api.getRewardsDashboardV3().catch(() => null);
      setDashboardV3(v3);
    } catch (error) {
      void error;
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const claimDaily = async () => {
    setClaiming(true);
    try {
      const res = await api.claimRewardsDailyReward();
      setJustClaimed({
        credits: res.credits_awarded,
        streak: res.streak_day,
        comeback: res.comeback_bonus,
        comebackMsg: res.comeback_message,
      });
      await load();
    } catch (error) {
      void error;
    }
    setClaiming(false);
  };

  const claimMilestone = async (id) => {
    setClaimingMs(id);
    try {
      await api.claimMilestone(id);
      await load();
    } catch (error) {
      void error;
    }
    setClaimingMs(null);
  };

  const exportCsv = async () => {
    try { await api.exportRewardsHistoryCSV(historyFilter); } catch (error) { void error; }
  };

  const exportPdf = async () => {
    try { await api.exportRewardsHistoryPDF(historyFilter); } catch (error) { void error; }
  };

  const createMerchantReward = async () => {
    setCreatingMerchantReward(true);
    try {
      await api.createMerchantRewardV3(merchantRewardDraft);
      setMerchantRewardDraft({ title: "", description: "", reward_type: "voucher", cost_bidcoins: 100, cashback_amount: 0, voucher_code: "", free_product_name: "" });
      await load();
    } catch (error) {
      void error;
    }
    setCreatingMerchantReward(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}>
        <Loader2 size={24} className="text-white/20 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}>
        <p className="text-white/20 text-sm">{t("common.error") || "Error"}</p>
      </div>
    );
  }

  const streakRewards = data.streak_rewards || {};

  return (
    <motion.div data-testid="rewards-page" className="min-h-screen pb-24" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: panelBorder }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button data-testid="rewards-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">{t("rewards.title") || "Rewards"}</h1>
            <p className="text-[9px] text-white/25">{t("rewards.subtitle") || "Earn credits daily"}</p>
          </div>
          <motion.button
            data-testid="rewards-notif-btn"
            onClick={() => { setShowNotifs(p => !p); api.markRewardNotificationsRead().catch(() => {}); }}
            whileTap={{ scale: 0.9 }}
            className="relative w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"
          >
            <Bell size={14} className="text-white/30" />
            {data.unread_notifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF6B6B] text-[7px] font-bold text-white flex items-center justify-center">
                {data.unread_notifications}
              </span>
            )}
          </motion.button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* Just Claimed Animation */}
        <AnimatePresence>
          {justClaimed && (
            <motion.div
              className={`rounded-2xl p-5 text-center ${glass}`}
              style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.12)" }}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6 }}
              >
                <Gift size={32} className="text-[#00E89D] mx-auto mb-2" />
              </motion.div>
              <p className="text-[16px] font-black text-[#00E89D] font-mono">+{justClaimed.credits} Credits</p>
              <p className="text-[10px] text-white/30 mt-1">{t("rewards.day") || "Day"} {justClaimed.streak} {t("rewards.streak") || "Streak"}</p>
              {justClaimed.comeback > 0 && (
                <p className="text-[10px] text-[#FFD166] mt-1">+ {justClaimed.comeback} {t("rewards.comeback_bonus") || "Comeback Bonus"}</p>
              )}
              <motion.button onClick={() => setJustClaimed(null)} className="mt-3 text-[10px] text-white/20 underline">{t("common.close") || "Close"}</motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Total Credits Earned */}
        <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-[#555] uppercase tracking-widest font-semibold">{t("rewards.total_earned") || "Total Earned"}</p>
              <p className="text-[28px] font-black text-[#00E0FF] font-mono mt-1">{data.total_reward_credits || 0}</p>
              <p className="text-[9px] text-white/20">{t("rewards.reward_credits") || "Reward Credits"}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-[#555] uppercase tracking-widest font-semibold">{t("rewards.balance") || "Balance"}</p>
              <p className="text-[22px] font-black text-white/70 font-mono mt-1">{data.total_credits || 0}</p>
              <p className="text-[9px] text-white/20">{t("rewards.bid_credits") || "Bid Credits"}</p>
            </div>
          </div>
        </motion.div>

        {dashboardV3 && (
          <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} data-testid="rewards-v3-dashboard-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">Rewards Center V3</p>
                <p className="text-[12px] text-white/70 mt-1">BidCoins · Cashback · Streak · Challenges</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-[#FFD700] font-bold flex items-center gap-1" data-testid="rewards-v3-badge-pill">
                <Crown size={12} /> {dashboardV3.active_badge}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <V3Card icon={BadgeDollarSign} label="BidCoins" value={dashboardV3.available_bidcoins} color="#00E0FF" testid="rewards-v3-bidcoins" />
              <V3Card icon={Wallet} label="Cashback" value={`€${(dashboardV3.cashback_balance || 0).toFixed(2)}`} color="#00E89D" testid="rewards-v3-cashback" />
              <V3Card icon={Flame} label="Streak" value={dashboardV3.active_streak} color="#FF6B6B" testid="rewards-v3-streak" />
              <V3Card icon={Target} label="Challenges" value={dashboardV3.current_challenges?.length || 0} color="#FFD166" testid="rewards-v3-challenges" />
            </div>
          </motion.div>
        )}

        {/* Daily Reward Claim */}
        <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: data.can_claim ? "rgba(0,232,157,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${data.can_claim ? "rgba(0,232,157,0.15)" : "rgba(255,255,255,0.04)"}` }}>
              <Gift size={18} className={data.can_claim ? "text-[#00E89D]" : "text-white/15"} />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-white/80">{t("rewards.daily_reward") || "Daily Reward"}</p>
              <p className="text-[9px] text-white/25">
                {data.can_claim
                  ? `${t("rewards.claim_now") || "Claim"} +${data.next_reward} Credits`
                  : t("rewards.already_claimed") || "Already claimed today"}
              </p>
            </div>
            <motion.button
              data-testid="claim-daily-btn"
              onClick={claimDaily}
              disabled={!data.can_claim || claiming}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 rounded-xl text-[11px] font-bold disabled:opacity-20"
              style={{
                background: data.can_claim ? "rgba(0,232,157,0.1)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${data.can_claim ? "rgba(0,232,157,0.2)" : "rgba(255,255,255,0.04)"}`,
                color: data.can_claim ? "#00E89D" : "#333",
              }}
            >
              {claiming ? <Loader2 size={12} className="animate-spin" /> : data.can_claim ? (t("rewards.claim") || "Claim") : <Check size={12} />}
            </motion.button>
          </div>

          {/* Comeback bonus indicator */}
          {data.comeback_available && (
            <motion.div
              className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
              style={{ background: "rgba(255,209,102,0.04)", border: "1px solid rgba(255,209,102,0.1)" }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Zap size={12} className="text-[#FFD166]" />
              <span className="text-[10px] text-[#FFD166] font-medium">
                {t("rewards.welcome_back") || "Welcome back!"} +{data.comeback_bonus} {t("rewards.bonus_credits") || "Bonus Credits"}
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Streak Progress */}
        <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">{t("rewards.streak_progress") || "Streak Progress"}</p>
            {data.streak_active && (
              <span className="px-2 py-0.5 rounded-full text-[8px] font-bold" style={{ background: "rgba(255,107,107,0.08)", color: "#FF6B6B", border: "1px solid rgba(255,107,107,0.15)" }}>
                {data.streak} {t("rewards.days") || "Days"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const done = data.streak >= day && data.streak_active;
              const current = data.streak === day && data.streak_active;
              const sConf = STREAK_LABELS[day];
              const Icon = sConf.icon;
              return (
                <motion.div
                  key={day}
                  data-testid={`streak-day-${day}`}
                  className="flex flex-col items-center py-2 rounded-xl"
                  style={{
                    background: done ? `${sConf.color}08` : "rgba(255,255,255,0.01)",
                    border: `1px solid ${current ? `${sConf.color}30` : done ? `${sConf.color}10` : "rgba(255,255,255,0.03)"}`,
                  }}
                  animate={current ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Icon size={14} style={{ color: done ? sConf.color : "#222" }} />
                  <p className="text-[8px] font-bold mt-1" style={{ color: done ? sConf.color : "#333" }}>{t("rewards.day") || "D"}{day}</p>
                  <p className="text-[7px] mt-0.5" style={{ color: done ? `${sConf.color}90` : "#222" }}>+{streakRewards[day] || day}</p>
                </motion.div>
              );
            })}
          </div>
          {!data.streak_active && (
            <p className="text-[9px] text-white/15 text-center mt-2">{t("rewards.streak_hint") || "Claim daily to build your streak!"}</p>
          )}
        </motion.div>

        {/* Milestones */}
        <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">{t("rewards.milestones") || "Milestones"}</p>
          <div className="space-y-2">
            {(data.milestones || []).map((ms) => {
              const Icon = MILESTONE_ICONS[ms.id] || Target;
              const canClaim = ms.completed && !ms.claimed;
              return (
                <div key={ms.id} data-testid={`milestone-${ms.id}`} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: ms.claimed ? "rgba(0,232,157,0.03)" : canClaim ? "rgba(0,224,255,0.03)" : "rgba(255,255,255,0.01)", border: `1px solid ${ms.claimed ? "rgba(0,232,157,0.08)" : canClaim ? "rgba(0,224,255,0.08)" : "rgba(255,255,255,0.03)"}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ms.claimed ? "rgba(0,232,157,0.08)" : canClaim ? "rgba(0,224,255,0.06)" : "rgba(255,255,255,0.02)" }}>
                    {ms.claimed ? <Check size={14} className="text-[#00E89D]" /> : <Icon size={14} className={canClaim ? "text-[#00E0FF]" : "text-white/15"} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold" style={{ color: ms.claimed ? "#00E89D" : canClaim ? "#fff" : "#444" }}>
                      {t(`rewards.ms_${ms.id}`) || ms.id.replace(/_/g, " ")}
                    </p>
                    <p className="text-[8px]" style={{ color: ms.claimed ? "#00E89D80" : "#333" }}>+{ms.credits} Credits</p>
                  </div>
                  {canClaim && (
                    <motion.button
                      data-testid={`claim-milestone-${ms.id}`}
                      onClick={() => claimMilestone(ms.id)}
                      disabled={claimingMs === ms.id}
                      whileTap={{ scale: 0.9 }}
                      className="px-3 py-1.5 rounded-lg text-[9px] font-bold"
                      style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)", color: "#00E0FF" }}
                    >
                      {claimingMs === ms.id ? <Loader2 size={10} className="animate-spin" /> : t("rewards.claim") || "Claim"}
                    </motion.button>
                  )}
                  {ms.claimed && <span className="text-[8px] text-[#00E89D] font-bold">{t("rewards.claimed") || "Claimed"}</span>}
                  {!ms.completed && !ms.claimed && <span className="text-[8px] text-white/10">{t("rewards.locked") || "Locked"}</span>}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Notifications */}
        <AnimatePresence>
          {showNotifs && notifs.length > 0 && (
            <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">{t("rewards.notifications") || "Reward Notifications"}</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {notifs.slice(0, 10).map((n, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${n.read ? "bg-white/10" : "bg-[#00E0FF]"}`} />
                    <span className="text-[10px] text-white/40 flex-1">
                      {n.type === "daily_reward" && `${t("rewards.daily_reward") || "Daily"} +${n.credits} (${t("rewards.day") || "Day"} ${n.streak_day})`}
                      {n.type === "milestone" && `${t("rewards.milestone_unlocked") || "Milestone"}: +${n.credits}`}
                    </span>
                    <span className="text-[8px] text-white/15">{n.created_at?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {dashboardV3 && (
          <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} data-testid="rewards-v3-history-card">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">Rewards History</p>
              <div className="flex items-center gap-2">
                <button onClick={exportCsv} className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] flex items-center gap-1" data-testid="rewards-export-csv"><Download size={12} /> CSV</button>
                <button onClick={exportPdf} className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] flex items-center gap-1" data-testid="rewards-export-pdf"><Download size={12} /> PDF</button>
              </div>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <Filter size={12} className="text-white/30" />
              <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)} className="bg-transparent text-[11px] text-white/70 outline-none w-full" data-testid="rewards-history-filter">
                <option value="">Alle</option>
                <option value="daily_login">Daily Login</option>
                <option value="referral">Referral</option>
                <option value="merchant_loyalty">Merchant Loyalty</option>
                <option value="cashback">Cashback</option>
                <option value="promotion_rewards">Promotion Rewards</option>
                <option value="walk_earn">Walk & Earn</option>
              </select>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(dashboardV3.history || []).filter((item) => !historyFilter || item.source_type === historyFilter).slice(0, 30).map((item, idx) => (
                <div key={`${item.event_id || idx}`} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 flex items-center justify-between" data-testid={`rewards-history-item-${idx}`}>
                  <div>
                    <p className="text-[11px] text-white/80 font-medium">{item.description || item.source_type}</p>
                    <p className="text-[8px] text-white/25">{item.created_at?.slice(0, 16)} · {item.source_type}</p>
                  </div>
                  <span className="text-[11px] font-bold text-[#00E89D]">+{item.bidcoins || 0}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {dashboardV3 && (
          <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} data-testid="merchant-rewards-v3-card">
            <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-3">Merchant Rewards</p>
            <div className="grid grid-cols-1 gap-2 mb-4">
              <input value={merchantRewardDraft.title} onChange={(e) => setMerchantRewardDraft((p) => ({ ...p, title: e.target.value }))} placeholder="Reward Titel" className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-white outline-none" data-testid="merchant-reward-title-input" />
              <input value={merchantRewardDraft.description} onChange={(e) => setMerchantRewardDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Beschreibung" className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-white outline-none" data-testid="merchant-reward-description-input" />
              <div className="grid grid-cols-2 gap-2">
                <select value={merchantRewardDraft.reward_type} onChange={(e) => setMerchantRewardDraft((p) => ({ ...p, reward_type: e.target.value }))} className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-white outline-none" data-testid="merchant-reward-type-select">
                  <option value="voucher">Gutschein</option>
                  <option value="free_product">Gratisprodukt</option>
                  <option value="cashback">Cashback</option>
                </select>
                <input type="number" value={merchantRewardDraft.cost_bidcoins} onChange={(e) => setMerchantRewardDraft((p) => ({ ...p, cost_bidcoins: Number(e.target.value || 0) }))} placeholder="BidCoins" className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-white outline-none" data-testid="merchant-reward-cost-input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={merchantRewardDraft.voucher_code} onChange={(e) => setMerchantRewardDraft((p) => ({ ...p, voucher_code: e.target.value }))} placeholder="Voucher Code" className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-white outline-none" data-testid="merchant-reward-voucher-input" />
                <input value={merchantRewardDraft.free_product_name} onChange={(e) => setMerchantRewardDraft((p) => ({ ...p, free_product_name: e.target.value }))} placeholder="Gratisprodukt" className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px] text-white outline-none" data-testid="merchant-reward-product-input" />
              </div>
              <button onClick={createMerchantReward} disabled={creatingMerchantReward} className="px-4 py-2 rounded-xl bg-[#00E0FF]/10 border border-[#00E0FF]/20 text-[#00E0FF] text-[11px] font-bold" data-testid="merchant-reward-create-btn">
                {creatingMerchantReward ? "Speichert..." : "Merchant Reward anlegen"}
              </button>
            </div>
            <div className="space-y-2">
              {(dashboardV3.merchant_rewards || []).slice(0, 6).map((reward, idx) => (
                <div key={reward.reward_id || idx} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-white/85">{reward.title}</p>
                    <p className="text-[8px] text-white/30">{reward.reward_type} · {reward.merchant_name || "Merchant"}</p>
                  </div>
                  <span className="text-[11px] font-bold text-[#FFD166]">{reward.cost_bidcoins} BC</span>
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

function V3Card({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3" data-testid={testid}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <span className="text-[9px] text-white/30 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[20px] font-black" style={{ color }}>{value}</p>
    </div>
  );
}

export default RewardsPage;
