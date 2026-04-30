import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Clock, TrendingUp, ChevronRight,
  Coins, Loader2, X, User,
  Gavel, Trophy, ShieldCheck, Timer, Package, Truck, Globe, Check, Shield,
  Lock, Activity, Flame, Gift, Bot, AlertTriangle, Users,
  Heart, Share2, Copy, Bell, Sparkles, PartyPopper, XCircle, Eye,
  Wallet, CreditCard, Mail, Smartphone, Link2, Award, Crown, ChevronDown, ChevronUp
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { api } from "../services/api";
import GuestCTABar from "../components/GuestCTABar";
import ReferralPanel from "../components/auctions/ReferralPanel";
import Countdown from "../components/auctions/Countdown";
import AuctionGridCard from "../components/auctions/AuctionGridCard";
import { POLL_MS, glass, panelBg, panelBorder, accentCyan, accentGold, accentGreen, accentRed, accentPurple, localized } from "../components/auctions/atoms";

// Lazy: only when user opens detail / credit-buy flow (saves ~50KB initial bundle)
const AuctionDetail = lazy(() => import("../components/auctions/AuctionDetail"));
const BuyCreditsModal = lazy(() => import("../components/auctions/BuyCreditsModal"));

const AuctionLazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }} data-testid="auctions-lazy-fallback">
    <Loader2 size={20} className="animate-spin text-[#00E0FF]" />
  </div>
);



/* ════════════════════════════════════════════
   DAILY REWARD
   ════════════════════════════════════════════ */
const DailyReward = ({ onClaimed }) => {
  const { t } = useI18n();
  const [available, setAvailable] = useState(false);
  const [secs, setSecs] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    api.checkDailyReward().then(d => { setAvailable(d.available); setSecs(d.remaining_seconds || 0); }).catch(() => {});
    api.getBidStreak().then(d => setStreak(d.streak || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    if (secs <= 0 || available) return;
    const iv = setInterval(() => setSecs(p => { if (p <= 1) { setAvailable(true); return 0; } return p - 1; }), 1000);
    return () => clearInterval(iv);
  }, [secs, available]);

  const claim = async () => {
    setClaiming(true);
    try {
      const r = await api.claimDailyReward();
      onClaimed(r.total_credits);
      setShowDone(true); setAvailable(false);
      setSecs(86400);
      setTimeout(() => setShowDone(false), 2500);
    } catch {}
    setClaiming(false);
  };

  const hh = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60);

  return (
    <motion.div className={`rounded-2xl p-3 ${glass}`}
      style={{ background: panelBg, border: panelBorder, boxShadow: available ? `0 0 20px rgba(0,232,157,0.06)` : "none" }}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
      <div className="flex items-center gap-3">
        <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: available ? "rgba(0,232,157,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${available ? "rgba(0,232,157,0.15)" : "rgba(255,255,255,0.04)"}` }}
          animate={available ? { boxShadow: ["0 0 0px rgba(0,232,157,0)", "0 0 16px rgba(0,232,157,0.15)", "0 0 0px rgba(0,232,157,0)"] } : {}}
          transition={{ duration: 2, repeat: Infinity }}>
          <Gift size={16} className={available ? "text-[#00E89D]" : "text-white/20"} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-white/80">{t("auction.daily_reward")}</p>
          <div className="flex items-center gap-2">
            {available ? (
              <p className="text-[9px] text-[#00E89D] font-medium">{t("auction.daily_available")}</p>
            ) : (
              <p className="text-[9px] text-[#444] font-medium">{hh}h {mm}m</p>
            )}
            {streak > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,138,66,0.06)", border: "1px solid rgba(255,138,66,0.12)" }}>
                <Flame size={8} className="text-[#FF8C42]" />
                <span className="text-[8px] font-bold text-[#FF8C42]">{streak} {t("auction.streak_days")}</span>
              </div>
            )}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {showDone ? (
            <motion.div key="done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="px-3 py-1.5 rounded-lg bg-[#00E89D]/10 border border-[#00E89D]/20">
              <span className="text-[10px] font-bold text-[#00E89D]">+3</span>
            </motion.div>
          ) : (
            <motion.button key="btn" data-testid="daily-reward-btn" onClick={claim} disabled={!available || claiming}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${available ? "bg-[#00E89D]/10 border border-[#00E89D]/20 text-[#00E89D]" : "bg-white/[0.02] border border-white/[0.04] text-[#333]"}`}
              whileTap={available ? { scale: 0.95 } : {}}>
              {claiming ? <Loader2 size={12} className="animate-spin" /> : t("auction.claim")}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   LOW CREDITS POPUP
   ════════════════════════════════════════════ */
const LowCreditsPopup = ({ credits, onBuy, t }) => {
  const [visible, setVisible] = useState(false);
  const [isFirst, setIsFirst] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (dismissedRef.current || credits > 3) { setVisible(false); return; }
    api.checkFirstPurchase().then(d => { setIsFirst(d.is_first_purchase); setVisible(true); }).catch(() => setVisible(true));
  }, [credits]);

  if (!visible) return null;
  return (
    <motion.div className="fixed bottom-20 left-4 right-4 z-[45] max-w-md mx-auto"
      initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", damping: 22 }}>
      <div className={`rounded-2xl p-4 relative overflow-hidden ${glass}`}
        style={{ background: "rgba(8,12,20,0.95)", border: "1px solid rgba(255,209,102,0.1)", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <motion.div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentGold}40, transparent)` }}
          animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} />
        <motion.button onClick={() => { setVisible(false); dismissedRef.current = true; }} className="absolute top-2 right-2 text-white/60 hover:text-white/90 bg-white/5 hover:bg-white/10 rounded-full p-1.5" whileTap={{ scale: 0.9 }}><X size={14} /></motion.button>
        <div className="flex items-start gap-3">
          <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,209,102,0.06)", border: "1px solid rgba(255,209,102,0.12)" }}
            animate={{ boxShadow: ["0 0 0px rgba(255,209,102,0)", "0 0 16px rgba(255,209,102,0.12)", "0 0 0px rgba(255,209,102,0)"] }}
            transition={{ duration: 2, repeat: Infinity }}>
            <Zap size={16} className="text-[#FFD166]" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-[#FFD166] mb-0.5">{t("lowcredits.title")}</p>
            <p className="text-[9px] text-white/30 mb-2">{t("lowcredits.subtitle")}</p>
            {isFirst && (
              <motion.div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mb-2 w-fit"
                style={{ background: "rgba(0,232,157,0.05)", border: "1px solid rgba(0,232,157,0.1)" }}
                initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <Gift size={9} className="text-[#00E89D]" />
                <span className="text-[8px] font-bold text-[#00E89D]">{t("lowcredits.bonus_credits")}</span>
              </motion.div>
            )}
            <motion.button data-testid="low-credits-buy-btn" onClick={() => { onBuy(); setVisible(false); dismissedRef.current = true; }}
              className="px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1.5"
              style={{ background: "rgba(255,209,102,0.08)", border: "1px solid rgba(255,209,102,0.15)", color: accentGold }}
              whileTap={{ scale: 0.95 }}>
              <Coins size={11} />{t("lowcredits.get_credits")}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   PREMIUM TRUST BAR — DealDash Style
   ════════════════════════════════════════════ */
const TrustBar = ({ t, recentWinners }) => (
  <motion.div className="rounded-2xl overflow-hidden" 
    style={{ 
      background: "linear-gradient(180deg, rgba(12,16,28,0.9) 0%, rgba(8,12,22,0.95) 100%)", 
      border: "1px solid rgba(255,255,255,0.04)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.2)"
    }}
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
    <div className="p-4">
      <div className="flex items-center justify-between">
        {[
          { icon: Lock, color: accentGreen, text: t("auction.trust_secure"), subtext: "100% Sicher" },
          { icon: Activity, color: accentCyan, text: t("auction.trust_realtime"), subtext: "Live-Gebote" },
          { icon: Truck, color: accentPurple, text: t("auction.trust_free_ship"), subtext: "Weltweit" },
        ].map((item, i) => (
          <div key={i} className={`flex-1 flex items-center justify-center gap-3 py-2 ${i === 1 ? "border-x border-white/[0.04]" : ""}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
              style={{ background: `${item.color}10`, border: `1px solid ${item.color}15` }}>
              <item.icon size={16} style={{ color: item.color }} />
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] text-white/60 font-semibold">{item.text}</p>
              <p className="text-[9px] text-white/25">{item.subtext}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
    {recentWinners.length > 0 && (
      <div className="px-4 py-3 border-t border-white/[0.04]" style={{ background: "rgba(255,209,102,0.02)" }}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Trophy size={14} className="text-[#FFD166]" />
            <span className="text-[10px] text-white/40 font-medium">Letzte Gewinner:</span>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide">
            {recentWinners.slice(0, 3).map((w, i) => (
              <div key={i} className="flex items-center gap-2 flex-shrink-0 px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,209,102,0.06)", border: "1px solid rgba(255,209,102,0.1)" }}>
                <Crown size={10} className="text-[#FFD166]" />
                <span className="text-[10px] text-[#FFD166] font-semibold">{w.winner_name}</span>
                <span className="text-[9px] text-white/30 truncate max-w-[80px]">{w.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </motion.div>
);

/* ════════════════════════════════════════════
   CATEGORIES
   ════════════════════════════════════════════ */
const CATS = [
  { id: "all", label: "All", color: accentCyan },
  { id: "phones", label: "Phones", color: accentPurple },
  { id: "gaming", label: "Gaming", color: "#FF6B6B" },
  { id: "audio", label: "Audio", color: accentGreen },
  { id: "wearables", label: "Wearables", color: accentGold },
  { id: "laptops", label: "Laptops", color: accentCyan },
  { id: "tablets", label: "Tablets", color: "#FF8C42" },
  { id: "xr", label: "XR", color: "#E040FB" },
  { id: "tvs", label: "TVs", color: "#26C6DA" },
  { id: "robots", label: "Robots", color: "#FF6B6B" },
  { id: "smarthome", label: "Smart Home", color: accentGreen },
  { id: "home", label: "Home", color: "#FF8C42" },
];

/* ════════════════════════════════════════════
   WIN / LOSE MODAL
   ════════════════════════════════════════════ */
const WinLoseModal = ({ type, auction, onClose, t }) => {
  if (!type || !auction) return null;
  const isWin = type === "won";
  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <motion.div className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden"
        style={{ background: "rgba(8,12,20,0.95)", border: isWin ? "1px solid rgba(255,209,102,0.15)" : panelBorder }}
        initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 20 }}>
        {isWin && <motion.div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(255,209,102,0.06) 0%, transparent 70%)" }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />}
        <div className="pt-8 pb-4 px-6 text-center relative z-10">
          <motion.div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: isWin ? "rgba(255,209,102,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${isWin ? "rgba(255,209,102,0.2)" : "rgba(255,255,255,0.05)"}` }}
            animate={isWin ? { boxShadow: ["0 0 0px rgba(255,209,102,0)", "0 0 30px rgba(255,209,102,0.15)", "0 0 0px rgba(255,209,102,0)"] } : {}}
            transition={{ duration: 2, repeat: Infinity }}>
            {isWin ? <Trophy size={28} className="text-[#FFD166]" /> : <Clock size={28} className="text-white/20" />}
          </motion.div>
          <h2 className="text-[20px] font-black font-outfit mb-1" style={{ color: isWin ? accentGold : "rgba(255,255,255,0.5)" }}>{isWin ? t("auction.you_won_title") : t("auction.you_lost_title")}</h2>
          <p className="text-[11px] text-white/30 mb-4">{isWin ? t("auction.you_won_subtitle") : t("auction.you_lost_subtitle")}</p>
          {auction.image_url && <img src={auction.image_url} alt="" className="w-full h-32 object-cover rounded-xl mb-3 opacity-80" />}
          <p className="text-[12px] font-semibold text-white/70 mb-1">{auction.title}</p>
          {isWin && <p className="text-[22px] font-black font-mono text-[#00E0FF] mb-4" style={{ textShadow: "0 0 12px rgba(0,224,255,0.2)" }}>{auction.current_price?.toFixed(2)}</p>}
          <motion.button data-testid="winlose-close-btn" onClick={onClose}
            className="w-full py-3 rounded-xl text-[12px] font-bold"
            style={{ background: isWin ? "rgba(255,209,102,0.1)" : "rgba(0,224,255,0.06)", border: `1px solid ${isWin ? "rgba(255,209,102,0.2)" : "rgba(0,224,255,0.1)"}`, color: isWin ? accentGold : accentCyan }}
            whileTap={{ scale: 0.97 }}>
            {isWin ? t("auction.claim_prize") : t("auction.browse_more")}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   WALLET TOP-UP PUSH BANNER
   ════════════════════════════════════════════ */
const WalletTopUpBanner = ({ balance, onTopUp, t }) => {
  const [dismissed, setDismissed] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  if (dismissed || balance >= 20) return null;
  
  const amounts = [
    { value: 10, bonus: 0, label: "+€10" },
    { value: 20, bonus: 0, label: "+€20" },
    { value: 50, bonus: 10, label: "+€50", tag: "+10% Bonus" },
    { value: 100, bonus: 20, label: "+€100", tag: "+20% Bonus", best: true },
  ];
  
  const handleTopUp = async (amt) => {
    setSelectedAmount(amt.value);
    setProcessing(true);
    try {
      const res = await api.createStripeTopup({ amount: amt.value, origin_url: window.location.href });
      if (res.checkout_url) window.location.href = res.checkout_url;
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };
  
  return (
    <motion.div className={`rounded-2xl overflow-hidden mb-3 ${glass}`}
      style={{ background: "linear-gradient(135deg, rgba(255,64,96,0.08) 0%, rgba(255,209,102,0.04) 100%)", border: "1px solid rgba(255,64,96,0.15)" }}
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,64,96,0.1)", border: "1px solid rgba(255,64,96,0.2)" }}>
              <AlertTriangle size={14} className="text-[#FF4060]" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/90">{t("wallet.low_balance") || "Guthaben niedrig"}</p>
              <p className="text-[9px] text-white/40">{t("wallet.topup_continue") || "Jetzt aufladen um weiterzubieten"}</p>
            </div>
          </div>
          <motion.button onClick={() => setDismissed(true)} whileTap={{ scale: 0.9 }} className="text-white/20">
            <X size={14} />
          </motion.button>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          {amounts.map((amt) => (
            <motion.button
              key={amt.value}
              data-testid={`topup-${amt.value}`}
              onClick={() => handleTopUp(amt)}
              disabled={processing}
              className={`relative py-2.5 rounded-xl text-center transition-all ${
                amt.best 
                  ? "bg-gradient-to-br from-[#FFD166]/20 to-[#FFD166]/5 border border-[#FFD166]/30" 
                  : "bg-white/[0.03] border border-white/[0.06]"
              }`}
              whileTap={{ scale: 0.95 }}
              whileHover={{ borderColor: amt.best ? "rgba(255,209,102,0.5)" : "rgba(255,255,255,0.15)" }}
            >
              {amt.tag && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[6px] font-bold whitespace-nowrap"
                  style={{ background: amt.best ? "#FFD166" : "rgba(0,232,157,0.15)", color: amt.best ? "#000" : "#00E89D" }}>
                  {amt.tag}
                </span>
              )}
              <span className={`text-[12px] font-bold ${amt.best ? "text-[#FFD166]" : "text-white/70"}`}>
                {selectedAmount === amt.value && processing ? "..." : amt.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   LIVE ACTIVITY INDICATOR
   ════════════════════════════════════════════ */
const LiveActivityBar = ({ auctions, t }) => {
  const [activity, setActivity] = useState({ bids: 0, watching: 0, hot: false });
  
  useEffect(() => {
    // Calculate activity from auctions
    const totalBids = auctions.filter(a => a.status === "active").reduce((sum, a) => sum + (a.total_bids || 0), 0);
    const activeCount = auctions.filter(a => a.status === "active").length;
    const hotAuctions = auctions.filter(a => a.status === "active" && a.remaining_seconds && a.remaining_seconds < 120).length;
    
    setActivity({
      bids: totalBids,
      watching: Math.floor(activeCount * 3 + Math.random() * 10),
      hot: hotAuctions > 0,
    });
  }, [auctions]);
  
  return (
    <motion.div className={`rounded-xl px-3 py-2 flex items-center justify-between mb-3 ${glass}`}
      style={{ background: activity.hot ? "rgba(255,64,96,0.04)" : "rgba(0,224,255,0.02)", border: `1px solid ${activity.hot ? "rgba(255,64,96,0.1)" : "rgba(0,224,255,0.06)"}` }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <motion.div className="w-2 h-2 rounded-full" style={{ background: activity.hot ? accentRed : accentGreen }}
            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
          <span className="text-[9px] font-bold" style={{ color: activity.hot ? accentRed : accentGreen }}>LIVE</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame size={10} className="text-[#FF8C42]" />
          <span className="text-[9px] text-white/50">{activity.bids} {t("auction.bids_total") || "Gebote"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users size={10} className="text-[#B068FF]" />
          <span className="text-[9px] text-white/50">{activity.watching} {t("auction.watching") || "schauen zu"}</span>
        </div>
      </div>
      {activity.hot && (
        <motion.div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,64,96,0.1)", border: "1px solid rgba(255,64,96,0.2)" }}
          animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 0.8, repeat: Infinity }}>
          <Zap size={8} className="text-[#FF4060]" />
          <span className="text-[8px] font-bold text-[#FF4060]">{t("auction.ending_soon") || "ENDET BALD"}</span>
        </motion.div>
      )}
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   NOTIFICATION TOAST
   ════════════════════════════════════════════ */
const NotifToast = ({ notifs, onDismiss }) => {
  if (!notifs || notifs.length === 0) return null;
  const n = notifs[0];
  const isOutbid = n.type === "outbid";
  const color = isOutbid ? accentRed : n.type === "won" ? accentGold : accentCyan;
  return (
    <motion.div className="fixed top-4 left-4 right-4 z-[55] max-w-md mx-auto"
      initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl`}
        style={{ background: "rgba(8,12,20,0.92)", border: `1px solid ${color}25`, boxShadow: `0 4px 20px ${color}10` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
          {isOutbid ? <AlertTriangle size={14} style={{ color }} /> : n.type === "won" ? <Trophy size={14} style={{ color }} /> : <Bell size={14} style={{ color }} />}
        </div>
        <p className="text-[11px] text-white/70 font-medium flex-1 line-clamp-2">{n.message}</p>
        <motion.button onClick={onDismiss} whileTap={{ scale: 0.9 }} className="text-white/20 hover:text-white/50"><X size={14} /></motion.button>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   REFERRAL PANEL (with sharing + leaderboard)
   ════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   MAIN AUCTIONS PAGE
   ════════════════════════════════════════════ */
const AuctionsPage = ({ onNavigate, isGuest, isDemoMode, onAuthRequired, onLogin, onRegister, onStartDemo }) => {
  const { t, lang } = useI18n();
  const user = useUser();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCredits, setShowCredits] = useState(false);
  const [credits, setCredits] = useState(0);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("ending_soon"); // ending_soon | low_price | most_bids
  const [showFilters, setShowFilters] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [auctionNotifs, setAuctionNotifs] = useState([]);
  const [showNotifToast, setShowNotifToast] = useState(false);
  const [winLose, setWinLose] = useState({ type: null, auction: null });
  const prevAuctionsRef = useRef([]);
  const pollRef = useRef(null);

  const fetchAuctions = useCallback(async () => {
    try {
      // Clear any cached auction data first
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          if (key.includes('auction') || key.includes('bidblitz-api')) {
            await caches.delete(key);
          }
        }
      }
      const r = await api.getAuctions();
      setAuctions(r.auctions || []);
    } catch (e) {
      console.error('Fetch auctions failed:', e);
    }
  }, []);
  const fetchCredits = useCallback(async () => { if (isGuest) return; try { const r = await api.getBidCredits(); setCredits(r.bid_credits || 0); } catch {} }, [isGuest]);
  const fetchWatchlist = useCallback(async () => { if (isGuest) return; try { const r = await api.getWatchlist(); setWatchlist(r.watchlist || []); } catch {} }, [isGuest]);
  const fetchNotifs = useCallback(async () => {
    if (isGuest) return;
    try {
      const r = await api.getAuctionNotifications();
      const unread = (r.notifications || []).filter(n => !n.read);
      if (unread.length > 0 && unread[0].created_at !== auctionNotifs[0]?.created_at) {
        setAuctionNotifs(unread);
        setShowNotifToast(true);
        setTimeout(() => setShowNotifToast(false), 5000);
      }
    } catch {}
  }, [isGuest, auctionNotifs]);

  useEffect(() => {
    Promise.all([fetchAuctions(), fetchCredits(), fetchWatchlist()]).then(() => setLoading(false));
    pollRef.current = setInterval(() => { fetchAuctions(); fetchNotifs(); }, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchAuctions, fetchCredits, fetchWatchlist, fetchNotifs]);

  // Detect win/lose when auctions transition from active to ended
  useEffect(() => {
    if (isGuest || !user?.id) return;
    const prev = prevAuctionsRef.current;
    for (const auc of auctions) {
      if (auc.status !== "ended") continue;
      const prevAuc = prev.find(p => p.auction_id === auc.auction_id);
      if (!prevAuc || prevAuc.status !== "active") continue;
      // This auction just ended
      if (auc.winner_id === user.id) {
        setWinLose({ type: "won", auction: auc });
      } else {
        // Check if user was a bidder (check last_bidder or bids)
        const wasBidder = prevAuc.last_bidder_id === user.id;
        if (wasBidder) setWinLose({ type: "lost", auction: auc });
      }
    }
    prevAuctionsRef.current = auctions;
  }, [auctions, isGuest, user?.id]);

  const toggleWatch = async (auctionId) => {
    if (isGuest) { onAuthRequired(); return; }
    try {
      const r = await api.toggleWatchlist(auctionId);
      if (r.watched) setWatchlist(p => [...p, auctionId]);
      else setWatchlist(p => p.filter(id => id !== auctionId));
    } catch {}
  };

  const dismissNotif = () => {
    setShowNotifToast(false);
    api.markAuctionNotificationsRead().catch(() => {});
  };

  if (selected) return (
    <Suspense fallback={<AuctionLazyFallback />}>
      <AuctionDetail auctionId={selected} onBack={() => { setSelected(null); fetchAuctions(); fetchCredits(); fetchWatchlist(); }} isGuest={isGuest} onAuthRequired={onAuthRequired} userCredits={credits} onCreditsChanged={setCredits} onBuyCredits={() => setShowCredits(true)} />
    </Suspense>
  );

  // Apply search + category + sort
  const applyFiltersAndSort = (list) => {
    let arr = [...list];
    if (categoryFilter !== "all") arr = arr.filter(a => a.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      arr = arr.filter(a => {
        const loc = localized(a, lang);
        return (loc.title || "").toLowerCase().includes(q)
            || (loc.description || "").toLowerCase().includes(q)
            || (a.title || "").toLowerCase().includes(q);
      });
    }
    if (sortBy === "low_price") arr.sort((a, b) => (a.current_price || 0) - (b.current_price || 0));
    else if (sortBy === "most_bids") arr.sort((a, b) => (b.total_bids || 0) - (a.total_bids || 0));
    else if (sortBy === "ending_soon") arr.sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at));
    return arr;
  };

  const active = applyFiltersAndSort(auctions.filter(a => a.status === "active" && (filter === "all" || a.category === filter)));
  const ended = applyFiltersAndSort(auctions.filter(a => a.status === "ended" && (filter === "all" || a.category === filter)));
  const activeCats = [...new Set(auctions.filter(a => a.status === "active").map(a => a.category).filter(Boolean))];
  const winners = auctions.filter(a => a.status === "ended" && a.winner_name);

  return (
    <motion.div data-testid="auctions-page" className="min-h-screen" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Notification Toast */}
      <AnimatePresence>{showNotifToast && <NotifToast notifs={auctionNotifs} onDismiss={dismissNotif} />}</AnimatePresence>
      {/* Win/Lose Modal */}
      <AnimatePresence>{winLose.type && <WinLoseModal type={winLose.type} auction={winLose.auction} onClose={() => setWinLose({ type: null, auction: null })} t={t} />}</AnimatePresence>
      {/* Ambient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-[600px] h-[60vw] max-h-[400px] rounded-full pointer-events-none" style={{ filter: "blur(160px)", background: "rgba(0,224,255,0.02)" }} />

      {/* Premium Header — DealDash Style */}
      <div className="relative z-10">
        <div className="flex items-center gap-4 px-5 pt-[max(env(safe-area-inset-top,0px),20px)] pb-4">
          <motion.button data-testid="auctions-back-btn" 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ 
              background: "rgba(255,255,255,0.03)", 
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}
            whileTap={{ scale: 0.9 }} 
            whileHover={{ background: "rgba(255,255,255,0.06)" }}
            onClick={() => onNavigate("/")}>
            <ArrowLeft size={16} className="text-white/50" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[18px] font-bold font-outfit text-white tracking-tight">{t("auction.title")}</h1>
            <p className="text-[11px] text-white/30">{t("auction.subtitle")}</p>
          </div>
          {!isGuest && (
            <motion.button data-testid="buy-credits-btn" onClick={() => setShowCredits(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ 
                background: "linear-gradient(135deg, rgba(255,209,102,0.12) 0%, rgba(255,209,102,0.06) 100%)", 
                border: "1px solid rgba(255,209,102,0.2)",
                boxShadow: "0 4px 16px rgba(255,209,102,0.1)"
              }} 
              whileTap={{ scale: 0.95 }}
              whileHover={{ borderColor: "rgba(255,209,102,0.35)" }}>
              <Coins size={14} className="text-[#FFD166]" />
              <span className="text-[13px] font-bold text-[#FFD166] tabular-nums">{credits}</span>
            </motion.button>
          )}
        </div>
      </div>

      {isGuest && !isDemoMode && <GuestCTABar onLogin={onLogin} onRegister={onRegister} onStartDemo={onStartDemo} isDemoMode={isDemoMode} />}

      <div className="px-4 pb-8 relative z-10 space-y-3">
        {/* Daily Reward */}
        {!isGuest && <DailyReward onClaimed={setCredits} />}

        {/* Referral */}
        {!isGuest && <ReferralPanel t={t} />}

        {/* Trust */}
        <TrustBar t={t} recentWinners={winners} />

        {/* Premium How It Works — DealDash Style */}
        <motion.div className="rounded-2xl overflow-hidden" 
          style={{ 
            background: "linear-gradient(180deg, rgba(12,16,28,0.9) 0%, rgba(8,12,22,0.95) 100%)", 
            border: "1px solid rgba(255,255,255,0.04)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.2)"
          }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="p-4">
            <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold mb-3">{t("auction.how_it_works")}</p>
            <div className="flex items-center justify-between">
              {[
                { icon: Coins, text: t("auction.step_buy"), subtext: "Credits kaufen", color: accentGold, num: "1" },
                { icon: Zap, text: t("auction.step_bid"), subtext: "Bieten +0,01€", color: accentCyan, num: "2" },
                { icon: Trophy, text: t("auction.step_win"), subtext: "Gewinnen & Sparen", color: accentGreen, num: "3" },
              ].map((s, i) => (
                <div key={i} className="flex-1 text-center relative">
                  {i < 2 && (
                    <div className="absolute top-5 right-0 w-full h-[1px]" style={{ background: "linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)" }} />
                  )}
                  <motion.div 
                    className="w-12 h-12 rounded-2xl mx-auto mb-2 flex items-center justify-center relative" 
                    style={{ 
                      background: `linear-gradient(135deg, ${s.color}15 0%, ${s.color}08 100%)`, 
                      border: `1px solid ${s.color}20`,
                      boxShadow: `0 4px 16px ${s.color}10`
                    }}
                    whileHover={{ scale: 1.05, boxShadow: `0 8px 24px ${s.color}20` }}>
                    <s.icon size={20} style={{ color: s.color }} />
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: s.color, color: "#000" }}>{s.num}</span>
                  </motion.div>
                  <p className="text-[11px] text-white/80 font-semibold">{s.text}</p>
                  <p className="text-[9px] text-white/30">{s.subtext}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Premium Category Filters — Pill Style */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
          {CATS.filter(c => c.id === "all" || activeCats.includes(c.id)).map(c => {
            const on = filter === c.id;
            return (
              <motion.button key={c.id} data-testid={`filter-${c.id}`} onClick={() => setFilter(c.id)}
                className="relative px-4 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
                style={{ 
                  background: on 
                    ? `linear-gradient(135deg, ${c.color}20 0%, ${c.color}10 100%)` 
                    : "rgba(255,255,255,0.02)", 
                  border: `1px solid ${on ? `${c.color}35` : "rgba(255,255,255,0.05)"}`, 
                  color: on ? c.color : "rgba(255,255,255,0.4)",
                  boxShadow: on ? `0 4px 16px ${c.color}15` : "none"
                }}
                whileTap={{ scale: 0.95 }}
                whileHover={{ borderColor: on ? `${c.color}50` : "rgba(255,255,255,0.1)" }}>
                {on && (
                  <motion.div 
                    className="absolute inset-0 rounded-xl" 
                    style={{ background: `${c.color}08` }}
                    layoutId="activeFilter"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">{c.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Suche + Sortierung */}
        <div className="flex gap-2 mt-2">
          <div className="flex-1 relative">
            <input
              data-testid="auction-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suchen..."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-[12px] text-white placeholder-white/30 focus:outline-none focus:border-[#00C2FF]/40"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/>
            </svg>
          </div>
          <select
            data-testid="auction-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#00C2FF]/40"
          >
            <option value="ending_soon" className="bg-[#0a0a0a]">Endet bald</option>
            <option value="low_price" className="bg-[#0a0a0a]">Niedrigster Preis</option>
            <option value="most_bids" className="bg-[#0a0a0a]">Meiste Gebote</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={18} className="animate-spin text-[#00E0FF]" /></div>
        ) : (
          <>
            {active.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
                {/* Premium Section Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className="w-3 h-3 rounded-full" 
                      style={{ background: "#00E89D", boxShadow: "0 0 12px rgba(0,232,157,0.5)" }}
                      animate={{ opacity: [1, 0.4, 1], scale: [1, 1.15, 1] }} 
                      transition={{ duration: 1.5, repeat: Infinity }} 
                    />
                    <h2 className="text-[13px] font-bold text-white/90 uppercase tracking-wider">{t("auction.live_auctions")}</h2>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold" 
                      style={{ background: "rgba(0,232,157,0.1)", border: "1px solid rgba(0,232,157,0.2)", color: "#00E89D" }}>
                      {active.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/30">
                    <Activity size={12} />
                    <span className="text-[10px] font-medium">LIVE</span>
                  </div>
                </div>
                {/* Premium Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {active.map((a, i) => <AuctionGridCard key={a.auction_id} auction={a} onClick={() => setSelected(a.auction_id)} t={t} idx={i} isWatched={watchlist.includes(a.auction_id)} onToggleWatch={!isGuest ? toggleWatch : null} lang={lang} />)}
                </div>
              </motion.div>
            )}
            {ended.length > 0 && (
              <motion.div className="mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <h2 className="text-[13px] font-bold text-white/40 uppercase tracking-wider">{t("auction.ended_auctions")}</h2>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold" 
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                    {ended.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {ended.map((a, i) => <AuctionGridCard key={a.auction_id} auction={a} onClick={() => setSelected(a.auction_id)} t={t} idx={i} lang={lang} />)}
                </div>
              </motion.div>
            )}
            {active.length === 0 && ended.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" 
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <Gavel size={28} className="text-white/10" />
                </div>
                <p className="text-[13px] text-white/30 font-medium">{t("auction.no_auctions")}</p>
                <p className="text-[11px] text-white/15 mt-1">Neue Auktionen starten bald</p>
              </div>
            )}
          </>
        )}
      </div>

      {!isGuest && <LowCreditsPopup credits={credits} onBuy={() => setShowCredits(true)} t={t} />}
      <Suspense fallback={null}>
        <BuyCreditsModal open={showCredits} onClose={() => setShowCredits(false)} onPurchased={r => setCredits(r.total_credits)} balance={isGuest ? 0 : (user?.balance || 0)} />
      </Suspense>    </motion.div>
  );
};

export default AuctionsPage;
