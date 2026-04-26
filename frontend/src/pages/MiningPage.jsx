import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Cpu, Server, Zap, Flame, Atom, ChevronRight,
  ArrowUpRight, ArrowDownLeft, Send, Gift, Copy, Check,
  Loader2, TrendingUp, Clock, Shield, Star, Wallet, RefreshCw,
  ChevronUp, DollarSign, BarChart3, Users, ShoppingBag,
  CreditCard, Rocket, Lock, Snowflake, Tag, X, Percent, Share2
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const sl = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  let d = {};
  try {
    const cloned = r.clone();
    d = await cloned.json();
  } catch {
    try { const text = await r.text(); d = { detail: text }; } catch { /* body consumed */ }
  }
  if (!r.ok) throw new Error(d.detail || d.message || "Request failed");
  return d;
}

const TIER_ICONS = { cpu: Cpu, server: Server, zap: Zap, flame: Flame, atom: Atom };
const TIER_COLORS = { starter: "#00E89D", pro: "#00C2FF", elite: "#A855F7", titan: "#FF6B6B", quantum: "#FFD700" };

const VIP_COLORS = { Bronze: "#CD7F32", Silver: "#C0C0C0", Gold: "#FFD700", Platinum: "#E5E4E2", Diamond: "#B9F2FF" };

// ── Auto-Reward Countdown Component ──
function AutoRewardCard({ reward, data, t }) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!reward?.claimed || !reward?.next_reward_at) {
      setCountdown("");
      return;
    }
    const target = new Date(reward.next_reward_at).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("00:00:00"); return; }
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setCountdown(`${h}:${m}:${s}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [reward?.claimed, reward?.next_reward_at]);

  const isClaimed = reward?.claimed;
  const streak = data?.streak || 0;

  return (
    <motion.div data-testid="auto-reward-card" className="rounded-2xl p-3.5"
      style={{
        background: isClaimed ? "rgba(0,232,157,0.02)" : "rgba(0,232,157,0.05)",
        border: `1px solid ${isClaimed ? "rgba(0,232,157,0.06)" : "rgba(0,232,157,0.15)"}`,
      }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,232,157,0.1)" }}>
            <RefreshCw size={15} className={`text-[#00E89D] ${!isClaimed ? "animate-spin" : ""}`} style={!isClaimed ? { animationDuration: "3s" } : {}} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white/80">{t("mining.auto_reward") || "Auto Mining Reward"}</p>
            {isClaimed ? (
              <>
                <p className="text-[10px] text-[#00E89D] font-medium">
                  +{reward.amount?.toFixed(4) || 0} BLZ {t("mining.auto_collected") || "collected"}
                </p>
                {streak > 1 && (
                  <p className="text-[8px] text-[#FFD700]/60 font-medium mt-0.5">{streak} {t("mining.day_streak") || "day streak"}</p>
                )}
              </>
            ) : (
              <p className="text-[10px] text-white/30">{t("mining.auto_pending") || "Calculating reward..."} (+{reward?.amount?.toFixed(4) || 0} BLZ)</p>
            )}
          </div>
        </div>
        <div className="text-right">
          {isClaimed && countdown ? (
            <div>
              <p className="text-[8px] text-white/20 uppercase tracking-wider">{t("mining.next_reward") || "Next reward"}</p>
              <p data-testid="reward-countdown" className="text-[14px] font-bold font-mono text-[#00C2FF] tabular-nums">{countdown}</p>
            </div>
          ) : isClaimed ? (
            <Check size={16} className="text-[#00E89D]" />
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#00E89D]/10">
              <Clock size={10} className="text-[#00E89D]" />
              <span className="text-[9px] text-[#00E89D] font-semibold">{t("mining.auto_active") || "Auto"}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const tabs = ["dashboard", "miners", "wallet", "shop", "marketplace", "card", "launchpad", "vip"];

export default function MiningPage({ onBack, onNavigate }) {
  const user = useUser();
  const { t } = useI18n();
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [packages, setPackages] = useState([]);
  const [buying, setBuying] = useState(null);
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
  const [purchaseError, setPurchaseError] = useState(null);
  const [billingType, setBillingType] = useState("onetime");
  const [marketplace, setMarketplace] = useState([]);
  const [listMiner, setListMiner] = useState(null);
  const [listPrice, setListPrice] = useState("");
  const [listing, setListing] = useState(false);
  const [buyingListing, setBuyingListing] = useState(null);
  const [cardData, setCardData] = useState(null);
  const [launchpad, setLaunchpad] = useState([]);
  const [buyingLaunch, setBuyingLaunch] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, pkgs, costs, mkt, crd, lp] = await Promise.all([
        api("/api/mining/dashboard").catch(() => ({})),
        api("/api/mining/packages").catch(() => ({ packages: [] })),
        api("/api/mining/upgrade-costs").catch(() => ({ costs: {} })),
        api("/api/mining/marketplace").catch(() => ({ listings: [] })),
        api("/api/mining/card").catch(() => null),
        api("/api/mining/launchpad").catch(() => ({ projects: [] })),
      ]);
      setData(dash);
      setPackages(pkgs.packages || []);
      setUpgradeCosts(costs.costs || {});
      setMarketplace(mkt.listings || []);
      setCardData(crd);
      setLaunchpad(lp.projects || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const buyMiner = async (pkgId) => {
    setPurchaseError(null);
    setBuying(pkgId);
    try {
      const r = await api("/api/mining/buy-miner", { method: "POST", body: JSON.stringify({ package_id: pkgId, billing: billingType }) });
      setConfirmPkg(null);
      const pkg = packages.find(p => p.id === pkgId);
      setPurchaseSuccess({ ...pkg, new_balance: r.new_balance });
      setTimeout(() => setPurchaseSuccess(null), 3500);
      toast.success(t("mining.purchased") || "Miner purchased!");
      load();
    } catch (e) {
      const msg = e.message || "Purchase failed";
      if (msg.toLowerCase().includes("insufficient")) {
        setPurchaseError(t("mining.err_balance") || "Insufficient wallet balance. Please top up your wallet first.");
      } else {
        setPurchaseError(msg);
      }
    }
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

  const shareRef = async () => {
    const code = data?.referral?.code;
    if (!code) return;
    const url = `${window.location.origin}?ref=${code}`;
    const text = `Verdiene BLZ mit BidBlitz Mining! Nutze meinen Code: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "BidBlitz Mining", text, url });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
      toast.success(t("mining.link_copied") || "Link kopiert!");
    }
  };

  // Marketplace handlers
  const listMinerForSale = async () => {
    const price = parseFloat(listPrice);
    if (!listMiner || !price || price <= 0) return;
    setListing(true);
    try {
      await api("/api/mining/marketplace/list", { method: "POST", body: JSON.stringify({ miner_id: listMiner, price_blz: price }) });
      toast.success(t("mining.listed") || "Miner listed!");
      setListMiner(null); setListPrice("");
      load();
    } catch (e) { toast.error(e.message); }
    setListing(false);
  };

  const buyFromMarketplace = async (listingId) => {
    setBuyingListing(listingId);
    try {
      const r = await api("/api/mining/marketplace/buy", { method: "POST", body: JSON.stringify({ listing_id: listingId }) });
      toast.success(`Bought ${r.miner_name}!`);
      load();
    } catch (e) { toast.error(e.message); }
    setBuyingListing(null);
  };

  const cancelListing = async (listingId) => {
    try {
      await api("/api/mining/marketplace/cancel", { method: "POST", body: JSON.stringify({ listing_id: listingId }) });
      toast.success(t("mining.cancelled") || "Listing cancelled");
      load();
    } catch (e) { toast.error(e.message); }
  };

  const buyLaunchpad = async (projectId) => {
    setBuyingLaunch(projectId);
    try {
      const r = await api("/api/mining/launchpad/buy", { method: "POST", body: JSON.stringify({ project_id: projectId }) });
      toast.success(`${r.miner_name} ${t("mining.activated") || "activated"}! (${r.hashrate} TH/s)`);
      load();
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("Insufficient")) {
        toast.error(t("mining.err_need_more") || "Guthaben reicht nicht. Lade dein Wallet auf.");
      } else if (msg.includes("VIP")) {
        toast.error(t("mining.err_vip") || "VIP-Level zu niedrig für diesen Miner.");
      } else if (msg.includes("already")) {
        toast.error(t("mining.err_already") || "Du hast diesen Miner bereits.");
      } else {
        toast.error(msg || "Request failed");
      }
    }
    setBuyingLaunch(null);
  };

  const toggleCardFreeze = async () => {
    try {
      const r = await api("/api/mining/card/freeze", { method: "POST" });
      toast.success(r.frozen ? (t("mining.card_frozen") || "Card frozen") : (t("mining.card_unfrozen") || "Card unfrozen"));
      load();
    } catch (e) { toast.error(e.message); }
  };

  const upgradeCard = async (tier) => {
    try {
      const r = await api("/api/mining/card/upgrade", { method: "POST", body: JSON.stringify({ tier }) });
      toast.success(`Upgraded to ${r.new_tier}!`);
      load();
    } catch (e) { toast.error(e.message); }
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

      {/* Ambient glow - more premium */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-[600px] h-[60vw] max-h-[400px] pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(0,232,157,0.06) 0%, rgba(0,194,255,0.02) 40%, transparent 70%)" }} />
      <div className="fixed bottom-0 right-0 w-[300px] h-[300px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.03) 0%, transparent 60%)" }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-4 relative z-10">
        <motion.button data-testid="mining-back-btn" className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center backdrop-blur-sm"
          whileTap={{ scale: 0.88 }} onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={1.5} className="text-white/60" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-[17px] font-bold text-white tracking-tight">{t("mining.title") || "Mining"}</h1>
          <p className="text-[10px] text-white/30 font-medium tracking-wide">{t("mining.subtitle") || "Mine BLZ tokens with virtual rigs"}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-sm" style={{ background: `${VIP_COLORS[vip.name] || "#CD7F32"}08`, border: `1px solid ${VIP_COLORS[vip.name] || "#CD7F32"}25` }}>
          <Star size={11} style={{ color: VIP_COLORS[vip.name] }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: VIP_COLORS[vip.name] }}>{vip.name || "Bronze"}</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-5 mb-4 relative z-10">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {tabs.map(tb => {
            const tabLabels = { dashboard: "Dashboard", miners: "Miner", wallet: "Wallet", shop: "Shop", marketplace: "Markt", card: "Karte", launchpad: "Launch", vip: "VIP" };
            return (
              <motion.button key={tb} onClick={() => setTab(tb)} whileTap={{ scale: 0.95 }}
                data-testid={`mining-tab-${tb}`}
                className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-[11px] font-bold capitalize transition-all ${
                  tab === tb 
                    ? "bg-[#00E89D]/15 text-[#00E89D] border border-[#00E89D]/30 shadow-lg shadow-[#00E89D]/5" 
                    : "bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/50"
                }`}>
                {t(`mining.tab_${tb}`) || tabLabels[tb] || tb}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="px-5 relative z-10">
        <AnimatePresence mode="wait">

          {/* ════ DASHBOARD ════ */}
          {tab === "dashboard" && (
            <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">

              {/* ── BlitzMine (Pi-Style Tap-to-Earn) Banner ── */}
              <motion.button
                data-testid="mining-blitzmine-banner"
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate?.("/blitz-mine")}
                className="w-full rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(255,215,0,0.10), rgba(0,194,255,0.06))",
                  border: "1px solid rgba(255,215,0,0.25)",
                  boxShadow: "0 4px 20px rgba(255,215,0,0.08)",
                }}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "radial-gradient(circle, #FFD70030, transparent)", border: "1px solid #FFD700" }}>
                  <Zap size={20} className="text-[#FFD700]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-bold text-white">BlitzMine <span className="text-[9px] text-[#FFD700] font-semibold">NEU</span></p>
                  <p className="text-[10px] text-white/60">Tippe täglich – verdiene BLZ passiv (Pi Network Style)</p>
                </div>
                <ChevronRight size={16} className="text-white/40" />
              </motion.button>

              {/* Balance Card — Premium Glassmorphism */}
              <motion.div className="rounded-3xl p-5 relative overflow-hidden"
                style={{ 
                  background: "linear-gradient(160deg, rgba(0,232,157,0.10) 0%, rgba(0,194,255,0.05) 50%, rgba(168,85,247,0.03) 100%)", 
                  border: "1px solid rgba(0,232,157,0.18)",
                  boxShadow: "0 8px 32px rgba(0,232,157,0.06), inset 0 1px 0 rgba(255,255,255,0.04)"
                }}
                initial={{ y: 10 }} animate={{ y: 0 }}>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(0,232,157,0.12) 0%, transparent 70%)" }} />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(0,194,255,0.08) 0%, transparent 70%)" }} />
                
                <div className="flex items-start justify-between mb-5 relative z-10">
                  <div>
                    <p className="text-[11px] text-white/50 uppercase tracking-[0.15em] font-bold mb-2">BLZ Balance</p>
                    <p className="text-[32px] font-black text-white tracking-tight leading-none">{w.blz_balance?.toFixed(4) || "0.0000"}</p>
                    <p className="text-[15px] font-bold text-[#00E89D] mt-1.5">{"\u20AC"}{w.eur_value?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" 
                    style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.2)", boxShadow: "0 4px 16px rgba(0,232,157,0.1)" }}>
                    <Wallet size={24} className="text-[#00E89D]" />
                  </div>
                </div>
                <div className="flex gap-2.5 relative z-10">
                  <motion.button data-testid="mining-withdraw-btn" onClick={() => setShowWithdraw(!showWithdraw)}
                    className="flex-1 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all"
                    style={{ background: "rgba(0,232,157,0.12)", border: "1px solid rgba(0,232,157,0.25)", color: "#00E89D" }}
                    whileTap={{ scale: 0.96 }}>
                    <ArrowUpRight size={15} /> {t("mining.withdraw") || "Auszahlen"}
                  </motion.button>
                  <motion.button data-testid="mining-send-btn" onClick={() => setShowSend(!showSend)}
                    className="flex-1 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all"
                    style={{ background: "rgba(0,194,255,0.10)", border: "1px solid rgba(0,194,255,0.22)", color: "#00C2FF" }}
                    whileTap={{ scale: 0.96 }}>
                    <Send size={15} /> {t("mining.send") || "Senden"}
                  </motion.button>
                </div>
              </motion.div>

              {/* Withdraw Panel */}
              <AnimatePresence>
                {showWithdraw && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden rounded-2xl p-4 space-y-3" style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.12)", boxShadow: "0 4px 20px rgba(0,232,157,0.05)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpRight size={14} className="text-[#00E89D]" />
                      <p className="text-[12px] font-bold text-white">BLZ in EUR umwandeln</p>
                    </div>
                    <p className="text-[10px] text-white/40">1 BLZ = €0,10 · Direkt auf dein Wallet</p>
                    <input data-testid="withdraw-amount" type="number" step="0.01" min="0" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                      placeholder="Betrag in BLZ" className={inputCls} />
                    {withdrawAmt > 0 && (
                      <div className="text-center p-2 rounded-xl bg-[#00E89D]/5 border border-[#00E89D]/10">
                        <p className="text-[13px] font-bold text-[#00E89D]">{parseFloat(withdrawAmt || 0).toFixed(2)} BLZ → €{(parseFloat(withdrawAmt || 0) * 0.10).toFixed(2)}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <motion.button data-testid="withdraw-confirm" onClick={withdraw} disabled={withdrawing}
                        className="flex-1 py-3 rounded-xl text-[12px] font-bold bg-[#00E89D]/15 text-[#00E89D] border border-[#00E89D]/25 flex items-center justify-center"
                        whileTap={{ scale: 0.96 }}>{withdrawing ? <Loader2 size={14} className="animate-spin" /> : "Auszahlen"}</motion.button>
                      <motion.button onClick={() => setShowWithdraw(false)} className="px-5 py-3 rounded-xl text-[12px] font-bold text-white/40 bg-white/[0.03] border border-white/[0.06]"
                        whileTap={{ scale: 0.96 }}>Abbrechen</motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Send Panel */}
              <AnimatePresence>
                {showSend && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden rounded-2xl p-4 space-y-3" style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.12)", boxShadow: "0 4px 20px rgba(0,194,255,0.05)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Send size={14} className="text-[#00C2FF]" />
                      <p className="text-[12px] font-bold text-white">BLZ an Nutzer senden</p>
                    </div>
                    <input data-testid="send-email" type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                      placeholder="E-Mail des Empfängers" className={inputCls} />
                    <input data-testid="send-amount" type="number" step="0.01" min="0" value={sendAmt} onChange={e => setSendAmt(e.target.value)}
                      placeholder="Betrag in BLZ" className={inputCls} />
                    <div className="flex gap-2">
                      <motion.button data-testid="send-confirm" onClick={sendBLZ} disabled={sending}
                        className="flex-1 py-3 rounded-xl text-[12px] font-bold bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/25 flex items-center justify-center gap-1.5"
                        whileTap={{ scale: 0.96 }}>{sending ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> Senden</>}</motion.button>
                      <motion.button onClick={() => setShowSend(false)} className="px-5 py-3 rounded-xl text-[12px] font-bold text-white/40 bg-white/[0.03] border border-white/[0.06]"
                        whileTap={{ scale: 0.96 }}>Abbrechen</motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mining Stats — Glass Cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Hashrate", value: `${m.total_hashrate?.toFixed(0) || 0}`, unit: "TH/s", color: "#00E89D", icon: Zap },
                  { label: t("mining.daily") || "Täglich", value: `${m.daily_earnings_blz?.toFixed(4) || 0}`, unit: "BLZ", color: "#00C2FF", icon: TrendingUp },
                  { label: t("mining.rigs") || "Rigs", value: m.active_miners || 0, unit: "aktiv", color: "#A855F7", icon: Server },
                ].map((s, i) => (
                  <motion.div key={s.label} className="rounded-2xl p-4 text-center relative overflow-hidden"
                    style={{ 
                      background: `linear-gradient(180deg, ${s.color}08 0%, ${s.color}02 100%)`, 
                      border: `1px solid ${s.color}18`,
                      boxShadow: `0 4px 20px ${s.color}05, inset 0 1px 0 rgba(255,255,255,0.03)`
                    }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" 
                      style={{ background: `${s.color}10`, border: `1px solid ${s.color}22`, boxShadow: `0 2px 8px ${s.color}10` }}>
                      <s.icon size={18} style={{ color: s.color }} />
                    </div>
                    <p className="text-[18px] font-black text-white leading-none">{s.value}</p>
                    <p className="text-[10px] font-bold mt-1" style={{ color: s.color }}>{s.unit}</p>
                    <p className="text-[9px] text-white/30 uppercase tracking-[0.15em] mt-1.5 font-bold">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Earnings Overview — Premium Card */}
              <motion.div className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)" }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <div className="px-4 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <TrendingUp size={15} className="text-[#00C2FF]" />
                  <p className="text-[12px] text-white/60 font-bold uppercase tracking-[0.12em]">{t("mining.earnings_overview") || "Ertragsübersicht"}</p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
                  {[
                    { label: t("mining.earn_daily") || "Täglich", blz: m.daily_earnings_blz?.toFixed(4) || "0", eur: m.daily_earnings_eur?.toFixed(4) || "0", color: "#00E89D" },
                    { label: t("mining.earn_monthly") || "Monatlich", blz: m.monthly_earnings_blz?.toFixed(2) || "0", eur: m.monthly_earnings_eur?.toFixed(2) || "0", color: "#00C2FF" },
                    { label: t("mining.earn_yearly") || "Jährlich", blz: m.yearly_earnings_blz?.toFixed(0) || "0", eur: m.yearly_earnings_eur?.toFixed(0) || "0", color: "#FFD700" },
                  ].map(s => (
                    <div key={s.label} className="py-5 px-3 text-center">
                      <p className="text-[16px] font-black font-mono leading-none" style={{ color: s.color }}>{s.blz}</p>
                      <p className="text-[10px] font-bold text-white/35 mt-1">BLZ</p>
                      <p className="text-[13px] font-bold font-mono text-white/55 mt-1.5">{"\u20AC"}{s.eur}</p>
                      <p className="text-[9px] text-white/25 uppercase mt-2 tracking-[0.15em] font-bold">{s.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Meine Miner — per-miner earnings */}
              {miners.length > 0 && (
                <motion.div className="space-y-2"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server size={11} className="text-[#A855F7]" />
                      <p className="text-[10px] text-white/25 uppercase tracking-[0.1em] font-semibold">{t("mining.my_miners") || "Meine Miner"} ({miners.length})</p>
                    </div>
                    <motion.button onClick={() => setTab("shop")} className="text-[9px] text-[#00E89D] font-medium flex items-center gap-0.5" whileTap={{ scale: 0.95 }}>
                      + {t("mining.buy_more") || "Kaufen"} <ChevronRight size={10} />
                    </motion.button>
                  </div>
                  {miners.map((mn, idx) => {
                    const Icon = TIER_ICONS[mn.icon] || Cpu;
                    const color = TIER_COLORS[mn.package_id] || "#00E89D";
                    const billing = mn.billing || {};
                    return (
                      <motion.div key={mn.miner_id} className="rounded-2xl p-4 flex items-center gap-3.5"
                        style={{ background: `${color}04`, border: `1px solid ${color}15` }}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.16 + idx * 0.03 }}>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                          <Icon size={18} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-[12px] font-bold text-white truncate">{mn.name}</p>
                            {billing.type && billing.type !== "onetime" && (
                              <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] font-bold border border-[#00C2FF]/15">
                                {billing.type === "monthly" ? "ABO" : "JAHR"}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-white/35">{mn.effective_hashrate || mn.hashrate} TH/s · Eff. {((mn.effective_efficiency || mn.efficiency) * 100).toFixed(0)}%</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[13px] font-black font-mono text-[#00E89D]">+{mn.daily_blz?.toFixed(4) || "0"}</p>
                          <p className="text-[9px] text-white/25 font-medium">BLZ/{t("mining.day") || "Tag"}</p>
                          <p className="text-[9px] text-white/35 font-mono">{"\u20AC"}{mn.daily_eur?.toFixed(3) || "0"}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {/* Auto Daily Reward Status */}
              <AutoRewardCard reward={reward} data={data} t={t} />

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
                  <motion.button data-testid="mining-share-ref" onClick={shareRef}
                    className="w-10 h-10 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center border border-[#00C2FF]/15"
                    whileTap={{ scale: 0.9 }}>
                    <Share2 size={14} className="text-[#00C2FF]" />
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
                    mining_reward: "Auto Reward", referral_bonus: "Referral",
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

          {/* ════ SHOP (GoMining-Style) ════ */}
          {tab === "shop" && (
            <motion.div key="shop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* Title */}
              <div className="text-center mb-2">
                <h2 className="text-[18px] font-bold font-outfit text-white">{t("mining.shop_create") || "Miner erstellen"}</h2>
                <p className="text-[11px] text-white/30 mt-0.5">{t("mining.shop_desc") || "Dein Miner fürs Leben — täglich BLZ verdienen"}</p>
              </div>

              {/* Billing Toggle: Einmalig / Monatlich / Jährlich */}
              <div className="flex rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { key: "onetime", label: t("mining.bill_once") || "Einmalig" },
                  { key: "monthly", label: t("mining.bill_month") || "Monatlich" },
                  { key: "yearly", label: t("mining.bill_year") || "Jährlich" },
                ].map(b => (
                  <motion.button key={b.key} data-testid={`billing-${b.key}`}
                    onClick={() => setBillingType(b.key)}
                    className={`flex-1 py-2.5 text-[11px] font-semibold transition-all relative ${
                      billingType === b.key
                        ? "bg-white/[0.08] text-white"
                        : "text-white/30 hover:text-white/50"
                    }`}
                    whileTap={{ scale: 0.97 }}>
                    {b.label}
                    {b.key !== "onetime" && billingType === b.key && (
                      <span className="absolute -top-1 -right-1 px-1 py-0.5 rounded text-[7px] font-bold bg-[#FF4757] text-white">
                        -{b.key === "monthly" ? "30" : "40"}%
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Package Cards */}
              {packages.map((pkg, idx) => {
                const Icon = TIER_ICONS[pkg.icon] || Cpu;
                const color = TIER_COLORS[pkg.id] || "#00E89D";
                const pricing = pkg.pricing?.[billingType] || pkg.pricing?.onetime || {};
                const currentPrice = pricing.price || pkg.price_eur;
                const originalPrice = pricing.original || pkg.price_eur;
                const discount = pricing.discount || 0;
                const isBest = pkg.id === "elite";
                const isSelected = confirmPkg?.id === pkg.id;
                const billingLabel = billingType === "monthly" ? "/Mo" : billingType === "yearly" ? "/Jahr" : "";

                return (
                  <motion.div key={pkg.id} data-testid={`miner-pkg-${pkg.id}`}
                    onClick={() => { setConfirmPkg(pkg); setPurchaseError(null); }}
                    className={`rounded-2xl p-4 relative overflow-hidden cursor-pointer transition-all ${isSelected ? "ring-1" : ""}`}
                    style={{
                      background: isSelected ? `${color}08` : isBest ? "rgba(168,85,247,0.03)" : "rgba(255,255,255,0.015)",
                      border: `1px solid ${isSelected ? `${color}40` : isBest ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)"}`,
                      ringColor: isSelected ? color : "transparent",
                    }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                    whileTap={{ scale: 0.98 }}>

                    {/* Discount Badge */}
                    {discount > 0 && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[8px] font-bold bg-[#FF4757] text-white">
                        MINUS {Math.round(discount * 100)}%
                      </div>
                    )}

                    {/* Best Value Badge */}
                    {isBest && !discount && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[8px] font-bold bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/20">
                        BEST
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                        <Icon size={18} style={{ color }} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp size={11} className="text-[#00E89D]" />
                          <span className="text-[14px] font-bold font-outfit text-white">{pkg.hashrate} TH/s</span>
                        </div>
                        <p className="text-[10px] font-mono text-white/30 mb-1.5">{pkg.daily_blz} BLZ / {t("mining.day") || "Tag"}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#FFD700]/10 text-[#FFD700] font-bold border border-[#FFD700]/15">ROI {pkg.roi_pct}%</span>
                          <span className="text-[8px] text-white/15">{pkg.name}</span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right flex-shrink-0">
                        {discount > 0 && (
                          <p className="text-[10px] text-white/20 line-through font-mono">{"\u20AC"}{originalPrice.toFixed(2)}</p>
                        )}
                        <p className="text-[16px] font-bold font-outfit" style={{ color }}>
                          {"\u20AC"}{currentPrice.toFixed(2)}
                        </p>
                        {billingLabel && (
                          <p className="text-[9px] text-white/25 font-medium">{billingLabel}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Summary + Buy Section */}
              {confirmPkg && (() => {
                const pricing = confirmPkg.pricing?.[billingType] || {};
                const price = pricing.price || confirmPkg.price_eur;
                const mainBalance = w.main_balance_eur ?? 0;
                const canAfford = mainBalance >= price;
                const color = TIER_COLORS[confirmPkg.id] || "#00E89D";

                return (
                  <motion.div className="rounded-2xl p-4 space-y-3"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

                    {/* Earnings Summary */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: t("mining.earn_daily") || "Täglich", value: `${confirmPkg.daily_blz} BLZ`, sub: `€${confirmPkg.daily_eur}`, color: "#00E89D" },
                        { label: t("mining.earn_monthly") || "Monatlich", value: `${(confirmPkg.daily_blz * 30).toFixed(1)} BLZ`, sub: `€${confirmPkg.monthly_eur}`, color: "#00C2FF" },
                        { label: t("mining.earn_yearly") || "Jährlich", value: `${(confirmPkg.daily_blz * 365).toFixed(0)} BLZ`, sub: `€${confirmPkg.yearly_eur}`, color: "#FFD700" },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl p-2 text-center" style={{ background: `${s.color}06`, border: `1px solid ${s.color}10` }}>
                          <p className="text-[11px] font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                          <p className="text-[9px] font-mono text-white/25">{s.sub}</p>
                          <p className="text-[7px] text-white/15 uppercase mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Price + Balance */}
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] text-white/40">{t("mining.today_due") || "Heute fällig"}</span>
                      <span className="text-[16px] font-bold font-outfit" style={{ color }}>{"\u20AC"}{price.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between px-1 pt-1 border-t border-white/[0.04]">
                      <span className="text-[10px] text-white/25">{t("mining.your_balance") || "Dein Guthaben"}</span>
                      <span className={`text-[12px] font-bold font-mono ${canAfford ? "text-[#00E89D]" : "text-[#FF4757]"}`}>{"\u20AC"}{mainBalance.toFixed(2)}</span>
                    </div>

                    {!canAfford && (
                      <p data-testid="balance-warning" className="text-[10px] text-[#FF4757] font-medium px-1">
                        {t("mining.err_need_more") || `Du brauchst noch €${(price - mainBalance).toFixed(2)}. Lade dein Wallet auf.`}
                      </p>
                    )}

                    {purchaseError && (
                      <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}>
                        <Shield size={11} className="text-[#FF4757]" />
                        <p className="text-[10px] text-[#FF4757]">{purchaseError}</p>
                      </div>
                    )}

                    {billingType !== "onetime" && (
                      <p className="text-[8px] text-white/15 text-center">
                        {billingType === "monthly"
                          ? (t("mining.renew_monthly") || `Verlängert sich automatisch für €${price.toFixed(2)} / Monat`)
                          : (t("mining.renew_yearly") || `Verlängert sich automatisch für €${price.toFixed(2)} / Jahr`)}
                      </p>
                    )}

                    {/* Buy Button */}
                    <motion.button
                      data-testid="confirm-buy-btn"
                      onClick={() => buyMiner(confirmPkg.id)}
                      disabled={buying || !canAfford}
                      className={`w-full py-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 ${!canAfford ? "opacity-40 cursor-not-allowed" : ""}`}
                      style={{ background: canAfford ? `${color}15` : "rgba(255,255,255,0.02)", color: canAfford ? color : "rgba(255,255,255,0.2)", border: `1px solid ${canAfford ? `${color}25` : "rgba(255,255,255,0.04)"}` }}
                      whileTap={canAfford ? { scale: 0.96 } : {}}>
                      {buying ? <Loader2 size={14} className="animate-spin" /> : (
                        <>{billingType !== "onetime" ? (t("mining.subscribe") || "Abonnieren") : (t("mining.buy_now") || "Jetzt kaufen")} <ChevronRight size={14} /></>
                      )}
                    </motion.button>
                  </motion.div>
                );
              })()}
            </motion.div>
          )}

          {/* ════ MARKETPLACE ════ */}
          {tab === "marketplace" && (
            <motion.div key="marketplace" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={12} className="text-[#FF6B6B]" />
                  <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-semibold">{t("mining.mkt_title") || "Marketplace"} ({marketplace.length})</p>
                </div>
                <motion.button onClick={load} className="text-white/15" whileTap={{ scale: 0.95 }}><RefreshCw size={11} /></motion.button>
              </div>

              {/* Sell own miner */}
              {miners.filter(mn => mn.status === "active").length > 0 && (
                <motion.div className="rounded-2xl p-3.5" style={{ background: "rgba(255,107,107,0.03)", border: "1px solid rgba(255,107,107,0.08)" }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-[10px] text-[#FF6B6B] font-semibold mb-2">{t("mining.mkt_sell") || "List your miner for sale"}</p>
                  <div className="flex items-center gap-2">
                    <select data-testid="list-miner-select" value={listMiner || ""} onChange={e => setListMiner(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl text-[11px] bg-white/[0.03] border border-white/[0.06] text-white/70 outline-none">
                      <option value="">{t("mining.mkt_select") || "Select miner..."}</option>
                      {miners.filter(mn => mn.status === "active").map(mn => (
                        <option key={mn.miner_id} value={mn.miner_id}>{mn.name} ({mn.hashrate} TH/s)</option>
                      ))}
                    </select>
                    <input data-testid="list-price-input" type="number" step="1" min="1" placeholder="BLZ" value={listPrice} onChange={e => setListPrice(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl text-[11px] bg-white/[0.03] border border-white/[0.06] text-white/70 outline-none font-mono" />
                    <motion.button data-testid="list-miner-btn" onClick={listMinerForSale} disabled={listing || !listMiner || !listPrice}
                      className="px-3 py-2 rounded-xl text-[10px] font-bold bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/15 disabled:opacity-30"
                      whileTap={{ scale: 0.95 }}>
                      {listing ? <Loader2 size={10} className="animate-spin" /> : <><Tag size={10} className="inline mr-1" />{t("mining.mkt_list") || "List"}</>}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Listings */}
              {marketplace.length === 0 && (
                <div className="text-center py-10">
                  <ShoppingBag size={28} className="mx-auto text-white/10 mb-2" />
                  <p className="text-[12px] text-white/25">{t("mining.mkt_empty") || "No listings yet"}</p>
                  <p className="text-[10px] text-white/15">{t("mining.mkt_empty_d") || "Be the first to list a miner for sale"}</p>
                </div>
              )}

              {marketplace.map((ls, idx) => {
                const Icon = TIER_ICONS[ls.icon] || Cpu;
                const color = TIER_COLORS[ls.package_id] || "#00E89D";
                const isOwn = ls.seller_id === (user?.id || "");
                return (
                  <motion.div key={ls.listing_id} data-testid={`listing-${ls.listing_id}`}
                    className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}10` }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-white/80 truncate">{ls.miner_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-mono text-white/30"><Zap size={8} className="inline" /> {ls.hashrate} TH/s</span>
                          <span className="text-[9px] text-white/20">Pwr Lv.{ls.power_level} · Eff Lv.{ls.efficiency_level}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-bold font-mono text-[#FFD700]">{ls.price_blz} BLZ</p>
                        <p className="text-[9px] text-white/20">{"\u20AC"}{ls.price_eur}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/15">{t("mining.mkt_seller") || "Seller"}: {ls.seller_name}</span>
                      {isOwn ? (
                        <motion.button onClick={() => cancelListing(ls.listing_id)} className="px-3 py-1.5 rounded-lg text-[9px] font-semibold bg-white/[0.03] text-white/30 border border-white/[0.05]"
                          whileTap={{ scale: 0.95 }}><X size={9} className="inline mr-0.5" /> {t("mining.mkt_cancel") || "Cancel"}</motion.button>
                      ) : (
                        <motion.button data-testid={`buy-listing-${ls.listing_id}`} onClick={() => buyFromMarketplace(ls.listing_id)} disabled={buyingListing === ls.listing_id}
                          className="px-4 py-1.5 rounded-lg text-[9px] font-bold bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15"
                          whileTap={{ scale: 0.95 }}>
                          {buyingListing === ls.listing_id ? <Loader2 size={10} className="animate-spin" /> : (t("mining.mkt_buy") || "Buy")}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ════ CARD ════ */}
          {tab === "card" && (
            <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {cardData?.card && (() => {
                const c = cardData.card;
                const cardColor = c.color || "#C0C0C0";
                const tiers = cardData.tiers || [];
                const currentIdx = tiers.findIndex(t2 => t2.tier === c.tier);
                const txns2 = cardData.recent_transactions || [];
                return (
                  <>
                    {/* Card Visual */}
                    <motion.div className="rounded-3xl p-5 relative overflow-hidden h-48"
                      style={{ background: `linear-gradient(135deg, ${cardColor}18 0%, ${cardColor}05 100%)`, border: `1px solid ${cardColor}20` }}
                      initial={{ y: 10 }} animate={{ y: 0 }}>
                      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none" style={{ background: cardColor, filter: "blur(60px)", opacity: 0.08 }} />
                      <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CreditCard size={16} style={{ color: cardColor }} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: cardColor }}>{c.tier_name} Card</span>
                          </div>
                          <motion.button data-testid="card-freeze-btn" onClick={toggleCardFreeze} whileTap={{ scale: 0.9 }}
                            className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold flex items-center gap-1 ${c.frozen ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/15" : "bg-white/[0.04] text-white/30 border border-white/[0.05]"}`}>
                            {c.frozen ? <><Lock size={8} /> {t("mining.card_unfreeze") || "Unfreeze"}</> : <><Snowflake size={8} /> {t("mining.card_freeze") || "Freeze"}</>}
                          </motion.button>
                        </div>
                        <div>
                          <p className="text-[17px] font-mono font-bold text-white/60 tracking-[0.2em] mb-1">{c.card_number}</p>
                          <p className="text-[9px] text-white/20 font-mono">{c.card_id}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[8px] text-white/15 uppercase">{t("mining.card_limit") || "Daily Limit"}</p>
                            <p className="text-[12px] font-bold font-mono" style={{ color: cardColor }}>{"\u20AC"}{c.daily_limit}</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-white/15 uppercase">Cashback</p>
                            <p className="text-[12px] font-bold font-mono" style={{ color: cardColor }}>{(c.cashback_rate * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-white/15 uppercase">{t("mining.card_remaining") || "Remaining"}</p>
                            <p className="text-[12px] font-bold font-mono text-[#00E89D]">{"\u20AC"}{cardData.remaining_limit}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Card Stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}>
                        <p className="text-[12px] font-bold font-outfit text-white/60">{"\u20AC"}{c.total_spent?.toFixed(2) || "0.00"}</p>
                        <p className="text-[8px] text-white/15 uppercase">{t("mining.card_spent") || "Total Spent"}</p>
                      </div>
                      <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}>
                        <p className="text-[12px] font-bold font-outfit text-[#00E89D]">{c.total_cashback?.toFixed(2) || "0"} BLZ</p>
                        <p className="text-[8px] text-white/15 uppercase">{t("mining.card_cashback_total") || "Total Cashback"}</p>
                      </div>
                    </div>

                    {/* Upgrade Card */}
                    <div>
                      <p className="text-[9px] text-white/20 uppercase tracking-[0.12em] font-semibold mb-2">{t("mining.card_upgrade") || "Upgrade Card"}</p>
                      <div className="space-y-1.5">
                        {tiers.map((tier, i) => {
                          const isCurrent = tier.tier === c.tier;
                          const isLocked = i <= currentIdx;
                          return (
                            <motion.div key={tier.tier} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                              style={{
                                background: isCurrent ? `${tier.color}08` : "rgba(255,255,255,0.01)",
                                border: `1px solid ${isCurrent ? `${tier.color}18` : "rgba(255,255,255,0.025)"}`,
                              }}
                              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                              <CreditCard size={14} style={{ color: tier.color, opacity: isLocked && !isCurrent ? 0.3 : 1 }} />
                              <div className="flex-1">
                                <p className="text-[11px] font-semibold" style={{ color: isCurrent ? tier.color : "rgba(255,255,255,0.4)" }}>{tier.name}</p>
                                <p className="text-[8px] text-white/15">{"\u20AC"}{tier.daily_limit}/d · {(tier.cashback * 100).toFixed(0)}% cashback</p>
                              </div>
                              {isCurrent ? (
                                <span className="text-[8px] font-bold text-[#00E89D] uppercase">Current</span>
                              ) : !isLocked ? (
                                <motion.button data-testid={`upgrade-card-${tier.tier}`} onClick={() => upgradeCard(tier.tier)}
                                  className="px-2.5 py-1 rounded-lg text-[9px] font-bold" style={{ background: `${tier.color}12`, color: tier.color, border: `1px solid ${tier.color}20` }}
                                  whileTap={{ scale: 0.95 }}>{tier.cost_blz} BLZ</motion.button>
                              ) : (
                                <Check size={12} className="text-white/10" />
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card Transactions */}
                    {txns2.length > 0 && (
                      <div>
                        <p className="text-[9px] text-white/20 uppercase tracking-[0.12em] font-semibold mb-2">{t("mining.card_txns") || "Card Transactions"}</p>
                        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}>
                          {txns2.slice(0, 8).map((tx, i) => (
                            <div key={tx.txn_id} className={`flex items-center gap-3 px-3.5 py-2.5 ${i < Math.min(txns2.length, 8) - 1 ? "border-b border-white/[0.025]" : ""}`}>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.03]">
                                <CreditCard size={11} className="text-white/30" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-white/50 truncate">{tx.merchant}</p>
                                <p className="text-[8px] text-white/15">{tx.created_at?.slice(0, 16)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] font-bold font-mono text-[#FF4757]">-{"\u20AC"}{tx.amount_eur?.toFixed(2)}</p>
                                {tx.cashback_blz > 0 && <p className="text-[8px] text-[#00E89D] font-mono">+{tx.cashback_blz} BLZ</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}

          {/* ════ LAUNCHPAD ════ */}
          {tab === "launchpad" && (
            <motion.div key="launchpad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Rocket size={12} className="text-[#A855F7]" />
                <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-semibold">{t("mining.lp_title") || "Launchpad"} — {t("mining.lp_subtitle") || "Exclusive Limited Miners"}</p>
              </div>

              {launchpad.length === 0 && (
                <div className="text-center py-10">
                  <Rocket size={28} className="mx-auto text-white/10 mb-2" />
                  <p className="text-[12px] text-white/25">{t("mining.lp_empty") || "No active launches"}</p>
                </div>
              )}

              {launchpad.map((p, idx) => {
                const Icon = TIER_ICONS[p.icon] || Atom;
                const soldPct = p.total_supply > 0 ? Math.round((p.sold / p.total_supply) * 100) : 0;
                const remaining = p.total_supply - (p.sold || 0);
                const colors = { "fusion-x1": "#B9F2FF", "neural-v2": "#FFD700", "solar-mk3": "#FF6B6B" };
                const color = colors[p.project_id] || "#A855F7";

                return (
                  <motion.div key={p.project_id} data-testid={`launch-${p.project_id}`}
                    className="rounded-2xl overflow-hidden relative"
                    style={{ background: "rgba(255,255,255,0.015)", border: `1px solid ${color}12` }}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
                    <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none" style={{ background: color, filter: "blur(60px)", opacity: 0.05 }} />

                    {/* Header */}
                    <div className="p-4 pb-3">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center relative" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                          <Icon size={22} style={{ color }} />
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#A855F7] flex items-center justify-center">
                            <Rocket size={8} className="text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[15px] font-bold font-outfit text-white">{p.name}</h3>
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider" style={{ background: `${color}15`, color, border: `1px solid ${color}20` }}>LAUNCH</span>
                          </div>
                          <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">{p.description}</p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {[
                          { l: "Hashrate", v: `${(p.hashrate + (p.bonus_hashrate || 0)).toLocaleString()} TH/s`, c: color },
                          { l: "Efficiency", v: `${(p.efficiency * 100).toFixed(0)}%`, c: "#00C2FF" },
                          { l: "Bonus", v: `+${p.bonus_hashrate || 0} TH/s`, c: "#00E89D" },
                          { l: t("mining.lp_vip") || "Min VIP", v: p.min_vip, c: "#FFD700" },
                        ].map(s => (
                          <div key={s.l} className="text-center">
                            <p className="text-[11px] font-bold font-mono" style={{ color: s.c }}>{s.v}</p>
                            <p className="text-[7px] text-white/15 uppercase">{s.l}</p>
                          </div>
                        ))}
                      </div>

                      {/* Supply Progress */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white/20">{t("mining.lp_sold") || "Sold"}: {p.sold || 0}/{p.total_supply}</span>
                          <span className="text-[9px] font-bold" style={{ color: remaining <= 10 ? "#FF4757" : "#00E89D" }}>{remaining} {t("mining.lp_left") || "left"}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                          <motion.div className="h-full rounded-full" style={{ background: color }}
                            initial={{ width: 0 }} animate={{ width: `${soldPct}%` }} transition={{ duration: 0.5 }} />
                        </div>
                      </div>

                      {/* Buy */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[18px] font-bold font-outfit" style={{ color }}>{"\u20AC"}{p.price_eur}</p>
                          <p className="text-[9px] text-white/15">{p.price_blz} BLZ</p>
                        </div>
                        <motion.button data-testid={`buy-launch-${p.project_id}`} onClick={() => buyLaunchpad(p.project_id)} disabled={buyingLaunch === p.project_id || remaining <= 0}
                          className="px-5 py-2.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-30"
                          style={{ background: `${color}12`, color, border: `1px solid ${color}20` }}
                          whileTap={{ scale: 0.96 }}>
                          {buyingLaunch === p.project_id ? <Loader2 size={14} className="animate-spin" /> :
                            remaining <= 0 ? (t("mining.lp_sold_out") || "Sold Out") : <><Rocket size={13} /> {t("mining.lp_buy") || "Mint Now"}</>}
                        </motion.button>
                      </div>
                    </div>
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

      {/* ════ Purchase Success Overlay ════ */}
      <AnimatePresence>
        {purchaseSuccess && (
          <motion.div data-testid="purchase-success-overlay" className="fixed inset-0 z-[10000] flex items-center justify-center"
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
              <motion.p className="text-[11px] text-[#00E89D]/60 mb-1"
                initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                {t("mining.success_desc") || "Your miner is now earning BLZ tokens!"}
              </motion.p>
              {purchaseSuccess.new_balance != null && (
                <motion.p className="text-[10px] text-white/20 font-mono"
                  initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
                  {t("mining.new_balance") || "New balance"}: {"\u20AC"}{purchaseSuccess.new_balance.toFixed(2)}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
