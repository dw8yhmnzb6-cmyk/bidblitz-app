import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Cpu, Server, Zap, Flame, Atom, ChevronRight,
  ArrowUpRight, ArrowDownLeft, Send, Gift, Copy, Check,
  Loader2, TrendingUp, Clock, Shield, Star, Wallet, RefreshCw,
  ChevronUp, DollarSign, BarChart3, Users
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const sl = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Request failed");
  return d;
}

const TIER_ICONS = { cpu: Cpu, server: Server, zap: Zap, flame: Flame, atom: Atom };
const TIER_COLORS = { starter: "#00E89D", pro: "#00C2FF", elite: "#A855F7", titan: "#FF6B6B", quantum: "#FFD700" };

const VIP_COLORS = { Bronze: "#CD7F32", Silver: "#C0C0C0", Gold: "#FFD700", Platinum: "#E5E4E2", Diamond: "#B9F2FF" };

const tabs = ["dashboard", "miners", "wallet", "shop", "vip"];

export default function MiningPage({ onBack }) {
  const user = useUser();
  const { t } = useI18n();
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [packages, setPackages] = useState([]);
  const [buying, setBuying] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [upgrading, setUpgrading] = useState(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendAmt, setSendAmt] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [upgradeCosts, setUpgradeCosts] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [confirmPkg, setConfirmPkg] = useState(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, pkgs, costs] = await Promise.all([
        api("/api/mining/dashboard"),
        api("/api/mining/packages"),
        api("/api/mining/upgrade-costs"),
      ]);
      setData(dash);
      setPackages(pkgs.packages || []);
      setUpgradeCosts(costs.costs || {});
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const claimDaily = async () => {
    setClaiming(true);
    try {
      const r = await api("/api/mining/claim-daily", { method: "POST" });
      toast.success(`+${r.claimed.toFixed(4)} BLZ claimed!`);
      load();
    } catch (e) { toast.error(e.message); }
    setClaiming(false);
  };

  const buyMiner = async (pkgId) => {
    setBuying(pkgId);
    try {
      const r = await api("/api/mining/buy-miner", { method: "POST", body: JSON.stringify({ package_id: pkgId }) });
      setConfirmPkg(null);
      const pkg = packages.find(p => p.id === pkgId);
      setPurchaseSuccess(pkg);
      setTimeout(() => setPurchaseSuccess(null), 3500);
      toast.success(t("mining.purchased") || "Miner purchased!");
      load();
    } catch (e) { toast.error(e.message); }
    setBuying(null);
  };

  const upgradeMiner = async (minerId, type) => {
    setUpgrading(`${minerId}-${type}`);
    try {
      const r = await api("/api/mining/upgrade", { method: "POST", body: JSON.stringify({ miner_id: minerId, upgrade_type: type }) });
      toast.success(`Upgraded to Lv.${r.new_level}!`);
      load();
    } catch (e) { toast.error(e.message); }
    setUpgrading(null);
  };

  const withdraw = async () => {
    const amt = parseFloat(withdrawAmt);
    if (!amt || amt <= 0) return;
    setWithdrawing(true);
    try {
      const r = await api("/api/mining/withdraw", { method: "POST", body: JSON.stringify({ amount: amt }) });
      toast.success(`Converted ${amt.toFixed(4)} BLZ → €${r.received_eur.toFixed(2)}`);
      setShowWithdraw(false);
      setWithdrawAmt("");
      load();
    } catch (e) { toast.error(e.message); }
    setWithdrawing(false);
  };

  const sendBLZ = async () => {
    const amt = parseFloat(sendAmt);
    if (!amt || amt <= 0 || !sendEmail) return;
    setSending(true);
    try {
      await api("/api/mining/send", { method: "POST", body: JSON.stringify({ recipient_email: sendEmail, amount: amt }) });
      toast.success(`Sent ${amt.toFixed(4)} BLZ!`);
      setShowSend(false);
      setSendAmt("");
      setSendEmail("");
      load();
    } catch (e) { toast.error(e.message); }
    setSending(false);
  };

  const copyRef = () => {
    if (data?.referral?.code) {
      navigator.clipboard.writeText(data.referral.code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/15 font-medium outline-none bg-white/[0.03] border border-white/[0.06] focus:border-[#00E89D]/30";

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={24} className="animate-spin text-[#00E89D]" />
      </div>
    );
  }

  const w = data?.wallet || {};
  const m = data?.mining || {};
  const vip = data?.vip || {};
  const reward = data?.daily_reward || {};
  const ref = data?.referral || {};
  const miners = data?.miners || [];
  const txns = data?.recent_transactions || [];

  return (
    <motion.div data-testid="mining-page" className="min-h-screen pb-24 relative" style={{ background: "#030303" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(0,232,157,0.04) 0%, transparent 70%)" }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button data-testid="mining-back-btn" className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }} onClick={onBack}>
          <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-[16px] font-bold font-outfit text-white tracking-tight">{t("mining.title") || "Mining"}</h1>
          <p className="text-[10px] text-white/20 font-medium">{t("mining.subtitle") || "Mine BLZ tokens with virtual rigs"}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: `${VIP_COLORS[vip.name] || "#CD7F32"}10`, border: `1px solid ${VIP_COLORS[vip.name] || "#CD7F32"}20` }}>
          <Star size={10} style={{ color: VIP_COLORS[vip.name] }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: VIP_COLORS[vip.name] }}>{vip.name || "Bronze"}</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-5 mb-4 relative z-10">
        <div className="flex gap-1.5">
          {tabs.map(tb => (
            <motion.button key={tb} onClick={() => setTab(tb)} whileTap={{ scale: 0.95 }}
              data-testid={`mining-tab-${tb}`}
              className={`flex-1 py-2 rounded-xl text-[11px] font-semibold capitalize transition-all ${
                tab === tb ? "bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/20" : "bg-white/[0.02] text-white/25 border border-white/[0.04]"
              }`}>
              {t(`mining.tab_${tb}`) || tb}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-5 relative z-10">
        <AnimatePresence mode="wait">

          {/* ════ DASHBOARD ════ */}
          {tab === "dashboard" && (
            <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">

              {/* Balance Card */}
              <motion.div className="rounded-2xl p-4 relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, rgba(0,232,157,0.06) 0%, rgba(0,194,255,0.03) 100%)", border: "1px solid rgba(0,232,157,0.1)" }}
                initial={{ y: 10 }} animate={{ y: 0 }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#00E89D]/10 flex items-center justify-center">
                      <Wallet size={14} className="text-[#00E89D]" />
                    </div>
                    <div>
                      <p className="text-[9px] text-white/25 uppercase tracking-[0.1em] font-semibold">BLZ Balance</p>
                      <p className="text-[22px] font-bold font-outfit text-white tracking-tight">{w.blz_balance?.toFixed(4) || "0.0000"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-white/20">EUR Value</p>
                    <p className="text-[15px] font-bold font-outfit text-[#00E89D]">{"\u20AC"}{w.eur_value?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button data-testid="mining-withdraw-btn" onClick={() => setShowWithdraw(!showWithdraw)}
                    className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-white/[0.04] text-white/60 border border-white/[0.06] flex items-center justify-center gap-1"
                    whileTap={{ scale: 0.96 }}>
                    <ArrowUpRight size={12} /> {t("mining.withdraw") || "Withdraw"}
                  </motion.button>
                  <motion.button data-testid="mining-send-btn" onClick={() => setShowSend(!showSend)}
                    className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-white/[0.04] text-white/60 border border-white/[0.06] flex items-center justify-center gap-1"
                    whileTap={{ scale: 0.96 }}>
                    <Send size={12} /> {t("mining.send") || "Send"}
                  </motion.button>
                </div>
              </motion.div>

              {/* Withdraw Panel */}
              <AnimatePresence>
                {showWithdraw && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden rounded-2xl p-3 space-y-2" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.08)" }}>
                    <p className="text-[10px] text-white/30">{t("mining.withdraw_desc") || "Convert BLZ to EUR (1 BLZ = €0.10)"}</p>
                    <input data-testid="withdraw-amount" type="number" step="0.01" min="0" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                      placeholder="Amount in BLZ" className={inputCls} />
                    <div className="flex gap-2">
                      <motion.button data-testid="withdraw-confirm" onClick={withdraw} disabled={withdrawing}
                        className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15"
                        whileTap={{ scale: 0.96 }}>{withdrawing ? <Loader2 size={12} className="animate-spin mx-auto" /> : `Convert → €${(parseFloat(withdrawAmt || 0) * 0.10).toFixed(2)}`}</motion.button>
                      <motion.button onClick={() => setShowWithdraw(false)} className="px-4 py-2 rounded-xl text-[11px] text-white/30 bg-white/[0.02]"
                        whileTap={{ scale: 0.96 }}>{t("mining.cancel") || "Cancel"}</motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Send Panel */}
              <AnimatePresence>
                {showSend && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden rounded-2xl p-3 space-y-2" style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.08)" }}>
                    <input data-testid="send-email" type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                      placeholder="Recipient email" className={inputCls} />
                    <input data-testid="send-amount" type="number" step="0.01" min="0" value={sendAmt} onChange={e => setSendAmt(e.target.value)}
                      placeholder="Amount BLZ" className={inputCls} />
                    <div className="flex gap-2">
                      <motion.button data-testid="send-confirm" onClick={sendBLZ} disabled={sending}
                        className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/15"
                        whileTap={{ scale: 0.96 }}>{sending ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Send BLZ"}</motion.button>
                      <motion.button onClick={() => setShowSend(false)} className="px-4 py-2 rounded-xl text-[11px] text-white/30 bg-white/[0.02]"
                        whileTap={{ scale: 0.96 }}>Cancel</motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mining Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Hashrate", value: `${m.total_hashrate?.toFixed(0) || 0} TH/s`, color: "#00E89D", icon: Zap },
                  { label: t("mining.daily") || "Daily", value: `${m.daily_earnings_blz?.toFixed(4) || 0} BLZ`, color: "#00C2FF", icon: TrendingUp },
                  { label: t("mining.rigs") || "Rigs", value: m.active_miners || 0, color: "#A855F7", icon: Server },
                ].map((s, i) => (
                  <motion.div key={s.label} className="rounded-xl p-2.5 text-center relative overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <s.icon size={14} className="mx-auto mb-1" style={{ color: s.color }} />
                    <p className="text-[13px] font-bold font-outfit text-white/90">{s.value}</p>
                    <p className="text-[8px] text-white/20 uppercase tracking-wider">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Daily Claim */}
              <motion.div className="rounded-2xl p-3.5 flex items-center justify-between"
                style={{ background: reward.claimed ? "rgba(255,255,255,0.01)" : "rgba(0,232,157,0.04)", border: `1px solid ${reward.claimed ? "rgba(255,255,255,0.03)" : "rgba(0,232,157,0.12)"}` }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: reward.claimed ? "rgba(255,255,255,0.03)" : "rgba(0,232,157,0.1)" }}>
                    <Gift size={16} className={reward.claimed ? "text-white/20" : "text-[#00E89D]"} />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-white/80">{t("mining.daily_reward") || "Daily Mining Reward"}</p>
                    <p className="text-[10px] text-white/25">{reward.claimed ? (t("mining.claimed") || "Claimed today") : `+${reward.amount?.toFixed(4) || 0} BLZ`}</p>
                    {(data?.streak || 0) > 1 && (
                      <p className="text-[8px] text-[#FFD700]/60 font-medium mt-0.5">{data.streak} {t("mining.day_streak") || "day streak"}</p>
                    )}
                  </div>
                </div>
                <motion.button data-testid="mining-claim-btn" onClick={claimDaily} disabled={claiming || reward.claimed}
                  className={`px-4 py-2 rounded-xl text-[11px] font-bold ${reward.claimed ? "bg-white/[0.02] text-white/15" : "bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15"}`}
                  whileTap={reward.claimed ? {} : { scale: 0.95 }}>
                  {claiming ? <Loader2 size={12} className="animate-spin" /> : reward.claimed ? <Check size={14} /> : (t("mining.claim") || "Claim")}
                </motion.button>
              </motion.div>

              {/* Referral Boost Indicator */}
              {ref.boost_active && (
                <motion.div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2"
                  style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.1)" }}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                  <TrendingUp size={13} className="text-[#A855F7]" />
                  <div className="flex-1">
                    <p className="text-[10px] text-[#A855F7] font-semibold">{t("mining.ref_boost") || "Referral Boost Active"}</p>
                    <p className="text-[8px] text-white/20">+{((ref.bonus_rate || 0.05) * 100).toFixed(0)}% {t("mining.ref_boost_desc") || "bonus on your earnings"}</p>
                  </div>
                  <span className="text-[11px] font-bold font-mono text-[#A855F7]">+{ref.boost_bonus_blz?.toFixed(4) || "0"} BLZ/d</span>
                </motion.div>
              )}

              {/* Referral */}
              <motion.div className="rounded-2xl p-3.5"
                style={{ background: "rgba(255,215,0,0.02)", border: "1px solid rgba(255,215,0,0.08)" }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users size={13} className="text-[#FFD700]" />
                    <p className="text-[11px] font-semibold text-white/70">{t("mining.referral") || "Referral"}</p>
                  </div>
                  <span className="text-[10px] text-white/25">{ref.count || 0} {t("mining.referred") || "referred"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[13px] font-mono font-bold text-[#FFD700] tracking-wider">{ref.code || "..."}</div>
                  <motion.button data-testid="mining-copy-ref" onClick={copyRef}
                    className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center border border-[#FFD700]/15"
                    whileTap={{ scale: 0.9 }}>
                    {copied ? <Check size={14} className="text-[#00E89D]" /> : <Copy size={14} className="text-[#FFD700]" />}
                  </motion.button>
                </div>
                <p className="text-[9px] text-white/15 mt-1.5">{t("mining.referral_desc") || "Share & earn 5% of your referrals' mining rewards"}</p>
              </motion.div>

              {/* Recent Txns */}
              {txns.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                  <p className="text-[9px] text-white/20 uppercase tracking-[0.12em] font-semibold mb-2">{t("mining.recent") || "Recent Activity"}</p>
                  <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}>
                    {txns.slice(0, 5).map((tx, i) => {
                      const isPos = (tx.amount_blz || 0) > 0 || (tx.amount_eur || 0) > 0;
                      return (
                        <div key={tx.txn_id || i} className={`flex items-center gap-3 px-3.5 py-2.5 ${i < Math.min(txns.length, 5) - 1 ? "border-b border-white/[0.025]" : ""}`}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: isPos ? "rgba(0,232,157,0.08)" : "rgba(255,71,87,0.08)" }}>
                            {isPos ? <ArrowDownLeft size={11} className="text-[#00E89D]" /> : <ArrowUpRight size={11} className="text-[#FF4757]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-white/60 truncate">{tx.description}</p>
                            <p className="text-[8px] text-white/15">{tx.created_at?.slice(0, 16)}</p>
                          </div>
                          <span className={`text-[12px] font-bold font-mono ${isPos ? "text-[#00E89D]" : "text-[#FF4757]"}`}>
                            {tx.amount_blz ? `${tx.amount_blz > 0 ? "+" : ""}${tx.amount_blz.toFixed(4)} BLZ` : `€${Math.abs(tx.amount_eur || 0).toFixed(2)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ════ MINERS ════ */}
          {tab === "miners" && (
            <motion.div key="miners" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-semibold">{t("mining.your_miners") || "Your Miners"} ({miners.length})</p>
                <motion.button onClick={() => setTab("shop")} className="text-[10px] text-[#00E89D] font-medium flex items-center gap-1" whileTap={{ scale: 0.95 }}>
                  {t("mining.buy_more") || "Buy More"} <ChevronRight size={12} />
                </motion.button>
              </div>

              {miners.length === 0 && (
                <div className="text-center py-12">
                  <Cpu size={32} className="mx-auto text-white/10 mb-3" />
                  <p className="text-[13px] text-white/30 mb-1">{t("mining.no_miners") || "No miners yet"}</p>
                  <p className="text-[10px] text-white/15 mb-4">{t("mining.no_miners_desc") || "Purchase your first miner to start earning BLZ"}</p>
                  <motion.button onClick={() => setTab("shop")} className="px-5 py-2.5 rounded-xl text-[12px] font-semibold bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15"
                    whileTap={{ scale: 0.95 }}>{t("mining.go_shop") || "Browse Miners"}</motion.button>
                </div>
              )}

              {miners.map((mn, idx) => {
                const Icon = TIER_ICONS[mn.icon] || Cpu;
                const color = TIER_COLORS[mn.package_id] || "#00E89D";
                const effectiveHash = (mn.hashrate * (1 + mn.power_level * 0.1)).toFixed(1);
                const effectiveEff = ((mn.efficiency + mn.efficiency_level * 0.01) * 100).toFixed(1);
                const pCost = upgradeCosts?.power?.[mn.power_level + 1];
                const eCost = upgradeCosts?.efficiency?.[mn.efficiency_level + 1];

                return (
                  <motion.div key={mn.miner_id} className="rounded-2xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.015)", border: `1px solid ${color}15` }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}10` }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white/90">{mn.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] font-mono text-white/40"><Zap size={9} className="inline" style={{ color }} /> {effectiveHash} TH/s</span>
                          <span className="text-[10px] font-mono text-white/40"><BarChart3 size={9} className="inline text-[#00C2FF]" /> {effectiveEff}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-white/20">Lv.{mn.power_level}/{mn.efficiency_level}</p>
                      </div>
                    </div>

                    {/* Upgrade buttons */}
                    <div className="px-4 pb-3 flex gap-2">
                      <motion.button
                        data-testid={`upgrade-power-${mn.miner_id}`}
                        onClick={() => upgradeMiner(mn.miner_id, "power")}
                        disabled={upgrading === `${mn.miner_id}-power` || !pCost}
                        className="flex-1 py-2 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 bg-white/[0.03] border border-white/[0.05] text-white/50 disabled:opacity-30"
                        whileTap={{ scale: 0.95 }}>
                        {upgrading === `${mn.miner_id}-power` ? <Loader2 size={10} className="animate-spin" /> : <>
                          <ChevronUp size={10} className="text-[#00E89D]" /> Power {pCost ? `€${pCost}` : "MAX"}
                        </>}
                      </motion.button>
                      <motion.button
                        data-testid={`upgrade-eff-${mn.miner_id}`}
                        onClick={() => upgradeMiner(mn.miner_id, "efficiency")}
                        disabled={upgrading === `${mn.miner_id}-efficiency` || !eCost}
                        className="flex-1 py-2 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 bg-white/[0.03] border border-white/[0.05] text-white/50 disabled:opacity-30"
                        whileTap={{ scale: 0.95 }}>
                        {upgrading === `${mn.miner_id}-efficiency` ? <Loader2 size={10} className="animate-spin" /> : <>
                          <ChevronUp size={10} className="text-[#00C2FF]" /> Efficiency {eCost ? `€${eCost}` : "MAX"}
                        </>}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ════ WALLET ════ */}
          {tab === "wallet" && (
            <motion.div key="wallet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Balances */}
              <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.08)" }}>
                <p className="text-[10px] text-white/25 uppercase tracking-[0.1em] mb-1">BLZ Balance</p>
                <p className="text-[28px] font-bold font-outfit text-white">{w.blz_balance?.toFixed(4) || "0.0000"}</p>
                <p className="text-[13px] text-[#00E89D] font-semibold">{"\u20AC"}{w.eur_value?.toFixed(2) || "0.00"}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t("mining.total_mined") || "Mined", value: w.total_mined?.toFixed(2) || "0", color: "#00E89D" },
                  { label: t("mining.withdrawn") || "Withdrawn", value: w.total_withdrawn?.toFixed(2) || "0", color: "#FF6B6B" },
                  { label: "Rate", value: "€0.10/BLZ", color: "#FFD700" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <p className="text-[12px] font-bold font-outfit" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[8px] text-white/20 uppercase mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Transaction History with Filter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] text-white/20 uppercase tracking-[0.12em] font-semibold">{t("mining.history") || "History"}</p>
                  <div className="flex items-center gap-1">
                    {["today", "all"].map(f => (
                      <motion.button key={f} data-testid={`history-filter-${f}`} onClick={() => setHistoryFilter(f)} whileTap={{ scale: 0.95 }}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold capitalize ${historyFilter === f
                          ? "bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15"
                          : "bg-white/[0.02] text-white/20 border border-white/[0.04]"}`}>
                        {f === "today" ? (t("mining.filter_today") || "Today") : (t("mining.filter_all") || "All")}
                      </motion.button>
                    ))}
                    <motion.button onClick={load} className="ml-1 text-white/15" whileTap={{ scale: 0.95 }}>
                      <RefreshCw size={11} />
                    </motion.button>
                  </div>
                </div>

                {(() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const filtered = historyFilter === "today"
                    ? txns.filter(tx => tx.created_at?.startsWith(today))
                    : txns;
                  const typeColors = {
                    mining_reward: "#00E89D", referral_bonus: "#A855F7",
                    purchase: "#FF6B6B", upgrade: "#FFB800",
                    withdraw: "#00C2FF", send: "#FF4757", receive: "#00E89D",
                  };
                  const typeLabels = {
                    mining_reward: "Claim", referral_bonus: "Referral",
                    purchase: "Purchase", upgrade: "Upgrade",
                    withdraw: "Withdraw", send: "Send", receive: "Receive",
                  };

                  return (
                    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}>
                      {filtered.length === 0 && (
                        <p className="text-center py-8 text-[11px] text-white/15">
                          {historyFilter === "today" ? (t("mining.no_txns_today") || "No transactions today") : (t("mining.no_txns") || "No transactions yet")}
                        </p>
                      )}
                      {filtered.map((tx, i) => {
                        const isPos = (tx.amount_blz || 0) > 0;
                        const tc = typeColors[tx.type] || "#666";
                        const tl = typeLabels[tx.type] || tx.type;
                        return (
                          <div key={tx.txn_id || i} data-testid={`txn-row-${tx.txn_id || i}`}
                            className={`flex items-center gap-3 px-3.5 py-2.5 ${i < filtered.length - 1 ? "border-b border-white/[0.025]" : ""}`}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: isPos ? "rgba(0,232,157,0.08)" : "rgba(255,71,87,0.08)" }}>
                              {isPos ? <ArrowDownLeft size={11} className="text-[#00E89D]" /> : <ArrowUpRight size={11} className="text-[#FF4757]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-white/60 truncate">{tx.description}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider"
                                  style={{ background: `${tc}12`, color: tc, border: `1px solid ${tc}18` }}>{tl}</span>
                                <span className="text-[8px] text-white/15">{tx.created_at?.slice(0, 10)} {tx.created_at?.slice(11, 16)}</span>
                              </div>
                            </div>
                            <span className={`text-[12px] font-bold font-mono ${isPos ? "text-[#00E89D]" : "text-white/40"}`}>
                              {tx.amount_blz ? `${tx.amount_blz > 0 ? "+" : ""}${tx.amount_blz.toFixed(4)}` : `€${Math.abs(tx.amount_eur || 0).toFixed(2)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}

          {/* ════ SHOP ════ */}
          {tab === "shop" && (
            <motion.div key="shop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">

              {/* Package Comparison Table */}
              <motion.div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.04)" }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <BarChart3 size={11} className="text-[#00C2FF]" />
                  <p className="text-[10px] text-white/30 font-semibold uppercase tracking-[0.1em]">{t("mining.compare") || "Compare Packages"}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]" data-testid="package-compare-table">
                    <thead>
                      <tr className="border-b border-white/[0.03]">
                        <th className="text-left px-3 py-2 text-white/20 font-medium">{t("mining.compare_pkg") || "Package"}</th>
                        <th className="text-right px-2 py-2 text-white/20 font-medium">{t("mining.compare_price") || "Price"}</th>
                        <th className="text-right px-2 py-2 text-white/20 font-medium">TH/s</th>
                        <th className="text-right px-2 py-2 text-white/20 font-medium">{t("mining.compare_daily") || "Daily"}</th>
                        <th className="text-right px-2 py-2 text-white/20 font-medium">ROI</th>
                        <th className="text-right px-3 py-2 text-white/20 font-medium">{t("mining.compare_yearly") || "Yearly"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages.map((pkg) => {
                        const color = TIER_COLORS[pkg.id] || "#00E89D";
                        const dailyBlz = pkg.hashrate * 0.5 * pkg.base_efficiency;
                        const dailyEur = dailyBlz * 0.10;
                        const roi = Math.ceil(pkg.price_eur / dailyEur);
                        const yearly = dailyEur * 365;
                        const isBest = pkg.id === "elite";
                        return (
                          <tr key={pkg.id} className={`border-b border-white/[0.015] ${isBest ? "relative" : ""}`}
                            style={isBest ? { background: "rgba(168,85,247,0.04)" } : {}}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white/70" style={{ color }}>{pkg.name}</span>
                                {isBest && <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/20">BEST</span>}
                              </div>
                            </td>
                            <td className="text-right px-2 py-2 font-mono font-bold text-white/50">{"\u20AC"}{pkg.price_eur.toLocaleString()}</td>
                            <td className="text-right px-2 py-2 font-mono text-white/40">{pkg.hashrate}</td>
                            <td className="text-right px-2 py-2 font-mono text-[#00E89D]">{"\u20AC"}{dailyEur.toFixed(3)}</td>
                            <td className="text-right px-2 py-2 font-mono text-[#FFD700]">{roi}d</td>
                            <td className="text-right px-3 py-2 font-mono font-bold text-[#00C2FF]">{"\u20AC"}{yearly.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-semibold">{t("mining.shop_title") || "Miner Packages"}</p>

              {packages.map((pkg, idx) => {
                const Icon = TIER_ICONS[pkg.icon] || Cpu;
                const color = TIER_COLORS[pkg.id] || "#00E89D";
                const dailyBlz = pkg.hashrate * 0.5 * pkg.base_efficiency;
                const dailyEur = dailyBlz * 0.10;
                const roi = Math.ceil(pkg.price_eur / dailyEur);
                const isBest = pkg.id === "elite";

                return (
                  <motion.div key={pkg.id} data-testid={`miner-pkg-${pkg.id}`}
                    className="rounded-2xl p-4 relative overflow-hidden"
                    style={{ background: isBest ? "rgba(168,85,247,0.03)" : "rgba(255,255,255,0.015)", border: `1px solid ${isBest ? "rgba(168,85,247,0.15)" : `${color}15`}` }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none" style={{ background: color, filter: "blur(50px)", opacity: 0.05 }} />
                    {isBest && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider"
                        style={{ background: "rgba(168,85,247,0.12)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.2)" }}>
                        {t("mining.best_value") || "Best Value"}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                        <Icon size={20} style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-bold text-white/90">{pkg.name}</p>
                        <p className="text-[11px] font-mono text-white/30">{pkg.hashrate} TH/s · {(pkg.base_efficiency * 100).toFixed(0)}% eff.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[18px] font-bold font-outfit" style={{ color }}>{"\u20AC"}{pkg.price_eur.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={10} className="text-[#00E89D]" />
                        <span className="text-[10px] text-white/30">{dailyBlz.toFixed(4)} BLZ/day ({"\u20AC"}{dailyEur.toFixed(3)})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={10} className="text-[#FFD700]" />
                        <span className="text-[10px] text-white/30">ROI ~{roi} {t("mining.days") || "days"}</span>
                      </div>
                    </div>
                    <motion.button
                      data-testid={`buy-miner-${pkg.id}`}
                      onClick={() => setConfirmPkg(pkg)}
                      className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5"
                      style={{ background: `${color}12`, color, border: `1px solid ${color}20` }}
                      whileTap={{ scale: 0.96 }}>
                      {t("mining.select") || "Select Package"} <ChevronRight size={14} />
                    </motion.button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ════ VIP ════ */}
          {tab === "vip" && (
            <motion.div key="vip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Current VIP */}
              <motion.div className="rounded-2xl p-5 text-center relative overflow-hidden"
                style={{ background: `${VIP_COLORS[vip.name] || "#CD7F32"}08`, border: `1px solid ${VIP_COLORS[vip.name] || "#CD7F32"}15` }}
                initial={{ y: 10 }} animate={{ y: 0 }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 0%, ${VIP_COLORS[vip.name]}08 0%, transparent 60%)` }} />
                <Star size={32} className="mx-auto mb-2" style={{ color: VIP_COLORS[vip.name] }} />
                <p className="text-[20px] font-bold font-outfit" style={{ color: VIP_COLORS[vip.name] }}>{vip.name}</p>
                <p className="text-[11px] text-white/30 mt-1">+{((vip.bonus || 0) * 100).toFixed(0)}% Mining Bonus</p>

                {vip.next_level && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-white/20">{vip.name}</span>
                      <span className="text-[9px] text-white/20">{vip.next_level.name}</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <motion.div className="h-full rounded-full" style={{ background: VIP_COLORS[vip.name] }}
                        initial={{ width: 0 }} animate={{ width: `${vip.progress || 0}%` }} transition={{ duration: 0.6 }} />
                    </div>
                    <p className="text-[9px] text-white/15 mt-1">{m.total_hashrate?.toFixed(0) || 0} / {vip.next_level.min_hashrate} TH/s ({vip.progress?.toFixed(0) || 0}%)</p>
                  </div>
                )}
              </motion.div>

              {/* All Levels */}
              <p className="text-[9px] text-white/20 uppercase tracking-[0.12em] font-semibold">{t("mining.vip_levels") || "VIP Levels"}</p>
              {[
                { name: "Bronze", hash: "0", bonus: "0%", color: "#CD7F32" },
                { name: "Silver", hash: "100", bonus: "+2%", color: "#C0C0C0" },
                { name: "Gold", hash: "500", bonus: "+5%", color: "#FFD700" },
                { name: "Platinum", hash: "2,000", bonus: "+10%", color: "#E5E4E2" },
                { name: "Diamond", hash: "10,000", bonus: "+15%", color: "#B9F2FF" },
              ].map((lv, i) => {
                const isActive = vip.name === lv.name;
                return (
                  <motion.div key={lv.name}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isActive ? "" : ""}`}
                    style={{
                      background: isActive ? `${lv.color}08` : "rgba(255,255,255,0.01)",
                      border: `1px solid ${isActive ? `${lv.color}20` : "rgba(255,255,255,0.025)"}`,
                    }}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <Star size={16} style={{ color: lv.color }} />
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold" style={{ color: isActive ? lv.color : "rgba(255,255,255,0.5)" }}>{lv.name}</p>
                      <p className="text-[9px] text-white/15">{lv.hash} TH/s required</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-bold font-mono" style={{ color: lv.color }}>{lv.bonus}</p>
                      <p className="text-[8px] text-white/15">bonus</p>
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full" style={{ background: lv.color, boxShadow: `0 0 8px ${lv.color}` }} />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ════ Purchase Confirmation Modal ════ */}
      <AnimatePresence>
        {confirmPkg && (
          <motion.div data-testid="purchase-confirm-modal" className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmPkg(null)} />
            <motion.div className="relative w-full max-w-md mx-auto rounded-t-3xl overflow-hidden"
              style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)", borderBottom: "none" }}
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
              <div className="p-6 space-y-4">
                {(() => {
                  const Icon = TIER_ICONS[confirmPkg.icon] || Cpu;
                  const color = TIER_COLORS[confirmPkg.id] || "#00E89D";
                  const dailyBlz = confirmPkg.hashrate * 0.5 * confirmPkg.base_efficiency;
                  const dailyEur = dailyBlz * 0.10;
                  const yearlyEur = dailyEur * 365;
                  return (
                    <>
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                          <Icon size={28} style={{ color }} />
                        </div>
                        <h3 className="text-[18px] font-bold font-outfit text-white">{t("mining.confirm_purchase") || "Confirm Purchase"}</h3>
                        <p className="text-[11px] text-white/30 mt-1">{confirmPkg.name}</p>
                      </div>

                      <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        {[
                          { l: t("mining.confirm_hash") || "Hashrate", v: `${confirmPkg.hashrate} TH/s`, c: color },
                          { l: t("mining.confirm_eff") || "Efficiency", v: `${(confirmPkg.base_efficiency * 100).toFixed(0)}%`, c: "#00C2FF" },
                          { l: t("mining.confirm_daily_earn") || "Daily Earnings", v: `${dailyBlz.toFixed(4)} BLZ (€${dailyEur.toFixed(3)})`, c: "#00E89D" },
                          { l: t("mining.confirm_yearly") || "Yearly Earnings", v: `€${yearlyEur.toFixed(1)}`, c: "#FFD700" },
                        ].map(r => (
                          <div key={r.l} className="flex items-center justify-between">
                            <span className="text-[11px] text-white/30">{r.l}</span>
                            <span className="text-[12px] font-bold font-mono" style={{ color: r.c }}>{r.v}</span>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl p-3 flex items-center justify-between"
                        style={{ background: `${color}06`, border: `1px solid ${color}12` }}>
                        <span className="text-[12px] text-white/50 font-medium">{t("mining.confirm_total") || "Total"}</span>
                        <span className="text-[20px] font-bold font-outfit" style={{ color }}>{"\u20AC"}{confirmPkg.price_eur.toLocaleString()}</span>
                      </div>

                      <div className="flex gap-2">
                        <motion.button onClick={() => setConfirmPkg(null)} whileTap={{ scale: 0.96 }}
                          className="flex-1 py-3 rounded-xl text-[12px] font-semibold bg-white/[0.04] text-white/40 border border-white/[0.06]">
                          {t("mining.cancel") || "Cancel"}
                        </motion.button>
                        <motion.button data-testid="confirm-buy-btn" onClick={() => buyMiner(confirmPkg.id)} disabled={buying}
                          whileTap={{ scale: 0.96 }}
                          className="flex-1 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5"
                          style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                          {buying ? <Loader2 size={14} className="animate-spin" /> : <>{t("mining.confirm_buy") || "Buy Now"} <ChevronRight size={14} /></>}
                        </motion.button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ Purchase Success Overlay ════ */}
      <AnimatePresence>
        {purchaseSuccess && (
          <motion.div data-testid="purchase-success-overlay" className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div className="relative text-center p-8"
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 250 }}>
              <motion.div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(0,232,157,0.1)", border: "1px solid rgba(0,232,157,0.2)" }}
                initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ delay: 0.1, duration: 0.5 }}>
                <Check size={36} className="text-[#00E89D]" />
              </motion.div>
              <motion.h3 className="text-[22px] font-bold font-outfit text-white mb-1"
                initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                {t("mining.success_title") || "Miner Activated!"}
              </motion.h3>
              <motion.p className="text-[13px] text-white/40 mb-2"
                initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                {purchaseSuccess.name} · {purchaseSuccess.hashrate} TH/s
              </motion.p>
              <motion.p className="text-[11px] text-[#00E89D]/60"
                initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                {t("mining.success_desc") || "Your miner is now earning BLZ tokens!"}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
