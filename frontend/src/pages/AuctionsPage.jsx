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
import LazyErrorBoundary from "../components/LazyErrorBoundary";
import ReferralPanel from "../components/auctions/ReferralPanel";
import Countdown from "../components/auctions/Countdown";
import AuctionGridCard from "../components/auctions/AuctionGridCard";
import KYCBanner from "../components/KYCBanner";
import { POLL_MS, LIST_POLL_MS, glass, panelBg, panelBorder, accentCyan, accentGold, accentGreen, accentRed, accentPurple, localized } from "../components/auctions/atoms";
import { BidBlitzPageShell } from "../components/design/BidBlitzPageShell";
import { MoneyAmount } from "../components/design/MoneyAmount";
import { PrimaryButton } from "../components/design/BidBlitzButtons";

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
    } catch (error) { void error; }
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
  { id: "laptops", label: "Laptops", color: accentCyan },
  { id: "tablets", label: "Tablets", color: "#FF8C42" },
  { id: "xr", label: "XR", color: "#E040FB" },
  { id: "robots", label: "Robots", color: "#FF6B6B" },
  { id: "tech", label: "Tech", color: accentGreen },
  { id: "mobility", label: "Mobility", color: accentGold },
];

/* ════════════════════════════════════════════
   WIN / LOSE MODAL
   ════════════════════════════════════════════ */
const WinLoseModal = ({ type, auction, onClose, onClaimPrize, t }) => {
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
          <motion.button data-testid="winlose-close-btn" onClick={isWin ? onClaimPrize : onClose}
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

const WinnerCheckoutModal = ({
  open,
  checkout,
  loading,
  paying,
  error,
  form,
  onChange,
  onPay,
  onClose,
}) => {
  if (!open) return null;
  const paid = checkout?.payment_status === "paid";
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={paying ? undefined : onClose} />
      <motion.div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-[#FFD166]/20 bg-[#080C14] p-5"
        initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }}
        data-testid="auction-winner-checkout"
      >
        <button onClick={onClose} disabled={paying} className="absolute right-4 top-4 text-white/40 disabled:opacity-30"><X size={18} /></button>
        <div className="flex items-center gap-3 pr-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FFD166]/20 bg-[#FFD166]/10"><Package size={20} className="text-[#FFD166]" /></div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#FFD166]/70">Gewinner-Checkout</p>
            <h3 className="text-lg font-black text-white">{checkout?.title || "Auktionsgewinn"}</h3>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-[#FFD166]" /></div>
        ) : paid ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[#00E89D]/20 bg-[#00E89D]/10 p-4" data-testid="winner-order-paid">
              <div className="flex items-center gap-2 text-[#00E89D]"><Check size={18} /><span className="font-bold">Bestellung bezahlt</span></div>
              <p className="mt-2 text-sm text-white/65">Order-ID: {checkout?.order_id}</p>
              <p className="text-sm text-white/65">Endpreis: €{Number(checkout?.final_price || 0).toFixed(2)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <Truck size={16} className="mb-2 text-[#00C2FF]" />
                <p className="text-xs font-bold text-white/80">Versand kostenlos</p>
                <p className="mt-1 text-[10px] text-white/40">Fulfillment: {checkout?.fulfillment_status || "pending"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <Globe size={16} className="mb-2 text-[#A855F7]" />
                <p className="text-xs font-bold text-white/80">{checkout?.shipping_address?.country || "Versandland"}</p>
                {checkout?.tracking_number ? (
                  <>
                    <p className="mt-1 text-[10px] text-white/50">{checkout?.carrier || "Carrier"}</p>
                    <p className="mt-1 break-all font-mono text-[10px] text-[#00C2FF]" data-testid="winner-tracking-number">{checkout.tracking_number}</p>
                  </>
                ) : (
                  <p className="mt-1 text-[10px] text-white/40">Tracking erst nach echter Übergabe an Versand</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 text-sm font-bold text-white/80">Schließen</button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">Zu zahlen</p>
                <p className="mt-1 text-2xl font-black text-[#00E0FF]">€{Number(checkout?.total_due || 0).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-[#00E89D]">0,00 € Versand</p>
                <p className="text-[10px] text-white/35">weltweit kostenlos</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["full_name", "Vor- und Nachname"],
                ["phone", "Telefon (optional)"],
                ["address_line1", "Straße + Hausnummer"],
                ["address_line2", "Adresszusatz (optional)"],
                ["postal_code", "PLZ"],
                ["city", "Stadt"],
                ["country", "Land"],
              ].map(([key, label]) => (
                <label key={key} className={key === "address_line1" || key === "address_line2" ? "sm:col-span-2" : ""}>
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</span>
                  <input
                    value={form[key] || ""}
                    onChange={(e) => onChange(key, e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none focus:border-[#00C2FF]/40"
                    data-testid={`winner-checkout-${key}`}
                  />
                </label>
              ))}
            </div>

            {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="winner-checkout-error">{error}</div>}
            <button
              onClick={onPay}
              disabled={paying}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E89D] py-3.5 text-sm font-black text-black disabled:opacity-50"
              data-testid="winner-checkout-pay"
            >
              {paying ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
              {paying ? "Zahlung wird verarbeitet…" : `Mit Wallet bezahlen · €${Number(checkout?.total_due || 0).toFixed(2)}`}
            </button>
            <p className="text-center text-[10px] text-white/30">Die Bestellung wird erst nach erfolgreicher zentraler Wallet-Buchung als bezahlt markiert.</p>
          </div>
        )}
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
  const [activity, setActivity] = useState({ bids: 0, activeAuctions: 0, hot: false });
  
  useEffect(() => {
    // Calculate activity from auctions
    const totalBids = auctions.filter(a => a.status === "active").reduce((sum, a) => sum + (a.total_bids || 0), 0);
    const activeCount = auctions.filter(a => a.status === "active").length;
    const hotAuctions = auctions.filter(a => a.status === "active" && a.remaining_seconds && a.remaining_seconds < 120).length;
    
    setActivity({
      bids: totalBids,
      activeAuctions: activeCount,
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
          <span className="text-[9px] text-white/50">{activity.activeAuctions} aktive Auktionen</span>
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
const AuctionsPage = ({ onNavigate, isGuest, isDemoMode, onAuthRequired, onLogin, onRegister, onStartDemo, routeParams = {} }) => {
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
  const [winnerCheckoutOpen, setWinnerCheckoutOpen] = useState(false);
  const [winnerCheckout, setWinnerCheckout] = useState(null);
  const [winnerCheckoutLoading, setWinnerCheckoutLoading] = useState(false);
  const [winnerCheckoutPaying, setWinnerCheckoutPaying] = useState(false);
  const [winnerCheckoutError, setWinnerCheckoutError] = useState("");
  const [winnerCheckoutForm, setWinnerCheckoutForm] = useState({
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
    city: "",
    country: "",
  });
  const winnerCheckoutKeyRef = useRef(null);
  const prevAuctionsRef = useRef([]);
  const pollRef = useRef(null);

  const fetchAuctions = useCallback(async () => {
    try {
      const r = await api.getAuctions();
      setAuctions(r.auctions || []);
    } catch (e) {
      console.error('Fetch auctions failed:', e);
    }
  }, []);
  const fetchCredits = useCallback(async () => { if (isGuest) return; try { const r = await api.getBidCredits(); setCredits(r.bid_credits || 0); } catch (error) { void error; } }, [isGuest]);
  const fetchWatchlist = useCallback(async () => { if (isGuest) return; try { const r = await api.getWatchlist(); setWatchlist(r.watchlist || []); } catch (error) { void error; } }, [isGuest]);
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
    } catch (error) { void error; }
  }, [isGuest, auctionNotifs]);

  useEffect(() => {
    Promise.all([fetchAuctions(), fetchCredits(), fetchWatchlist()]).then(() => setLoading(false));
    pollRef.current = setInterval(() => { fetchAuctions(); fetchNotifs(); }, LIST_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchAuctions, fetchCredits, fetchWatchlist, fetchNotifs]);

  useEffect(() => {
    if (routeParams?.auction_id && selected !== routeParams.auction_id) {
      setSelected(routeParams.auction_id);
    }
  }, [routeParams?.auction_id, selected]);

  // Stripe Success Redirect Handler — poll /credits-purchase-status when URL has ?status=success&session_id=
  useEffect(() => {
    if (isGuest) return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const sessionId = params.get("session_id");
    const purchaseId = params.get("credit_purchase");
    if (!sessionId || !purchaseId) return;

    const cleanupUrl = () => {
      const url = new URL(window.location.href);
      ["status", "session_id", "credit_purchase"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, "", url.toString());
    };

    if (status === "cancel") {
      import("sonner").then(({ toast }) => toast.info("Zahlung abgebrochen"));
      cleanupUrl();
      return;
    }

    if (status !== "success") return;

    let attempts = 0;
    let cancelled = false;
    const API_URL = process.env.REACT_APP_BACKEND_URL;

    const poll = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const r = await fetch(`${API_URL}/api/auctions/credits-purchase-status/${sessionId}`, { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          if (d.status === "completed" && d.credits_added > 0) {
            const { toast } = await import("sonner");
            toast.success(`✓ ${d.credits_added} Credits gutgeschrieben!`);
            await fetchCredits();
            cleanupUrl();
            return;
          }
        }
      } catch (error) { void error; }
      if (attempts < 12) setTimeout(poll, 1500);
      else {
        import("sonner").then(({ toast }) => toast.info("Zahlung wird verarbeitet… Du erhältst eine E-Mail."));
        cleanupUrl();
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [isGuest, fetchCredits]);

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

  const openWinnerCheckout = async (auction) => {
    if (!auction?.auction_id) return;
    setWinLose({ type: null, auction: null });
    setWinnerCheckoutOpen(true);
    setWinnerCheckoutLoading(true);
    setWinnerCheckoutError("");
    setWinnerCheckoutForm((prev) => ({ ...prev, full_name: prev.full_name || user?.name || "" }));
    try {
      const data = await api.getAuctionWinnerCheckout(auction.auction_id);
      setWinnerCheckout(data);
      if (data.shipping_address) {
        setWinnerCheckoutForm((prev) => ({ ...prev, ...data.shipping_address }));
      }
    } catch (e) {
      setWinnerCheckoutError(e.message || "Gewinner-Checkout konnte nicht geladen werden.");
    } finally {
      setWinnerCheckoutLoading(false);
    }
  };

  const payWinnerCheckout = async () => {
    if (!winnerCheckout?.auction_id || winnerCheckoutPaying) return;
    const required = ["full_name", "address_line1", "postal_code", "city", "country"];
    if (required.some((key) => !String(winnerCheckoutForm[key] || "").trim())) {
      setWinnerCheckoutError("Bitte fülle Name, Straße, PLZ, Stadt und Land vollständig aus.");
      return;
    }
    const attemptStorageKey = `bidblitz:auction-winner:${user?.id || user?.email || "unknown"}:${winnerCheckout.auction_id}`;
    if (!winnerCheckoutKeyRef.current && typeof window !== "undefined") {
      winnerCheckoutKeyRef.current = window.sessionStorage.getItem(attemptStorageKey);
    }
    if (!winnerCheckoutKeyRef.current) {
      winnerCheckoutKeyRef.current = typeof crypto?.randomUUID === "function"
        ? `auction-winner-${crypto.randomUUID()}`
        : `auction-winner-${Date.now()}-${winnerCheckout.auction_id}`;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(attemptStorageKey, winnerCheckoutKeyRef.current);
      }
    }
    setWinnerCheckoutPaying(true);
    setWinnerCheckoutError("");
    try {
      const data = await api.payAuctionWinnerCheckout(winnerCheckout.auction_id, {
        ...winnerCheckoutForm,
        idempotency_key: winnerCheckoutKeyRef.current,
      });
      winnerCheckoutKeyRef.current = null;
      if (typeof window !== "undefined") window.sessionStorage.removeItem(attemptStorageKey);
      setWinnerCheckout(data);
      await fetchAuctions();
    } catch (e) {
      if (e?.status === 400) {
        winnerCheckoutKeyRef.current = null;
        if (typeof window !== "undefined") window.sessionStorage.removeItem(attemptStorageKey);
      }
      setWinnerCheckoutError(e.message || "Zahlung fehlgeschlagen.");
    } finally {
      setWinnerCheckoutPaying(false);
    }
  };

  const toggleWatch = async (auctionId) => {
    if (isGuest) { onAuthRequired(); return; }
    try {
      const r = await api.toggleWatchlist(auctionId);
      if (r.watched) setWatchlist(p => [...p, auctionId]);
      else setWatchlist(p => p.filter(id => id !== auctionId));
    } catch (error) {
      import("sonner").then(({ toast }) => toast.error(error?.message || "Watchlist konnte nicht geändert werden."));
    }
  };

  const dismissNotif = () => {
    setShowNotifToast(false);
    api.markAuctionNotificationsRead().catch(() => {});
  };

  if (selected) return (
    <LazyErrorBoundary onReset={() => setSelected(null)}>
      <Suspense fallback={<AuctionLazyFallback />}>
        <AuctionDetail auctionId={selected} onBack={() => { if (routeParams?.auction_id) { onNavigate('/auctions'); } else { setSelected(null); } fetchAuctions(); fetchCredits(); fetchWatchlist(); }} isGuest={isGuest} onAuthRequired={onAuthRequired} userCredits={credits} onCreditsChanged={setCredits} onBuyCredits={() => setShowCredits(true)} onNavigate={onNavigate} />
      </Suspense>
    </LazyErrorBoundary>
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
  const pendingWins = (!isGuest && user?.id)
    ? auctions.filter(a =>
        a.status === "ended"
        && a.winner_id === user.id
        && !a.requires_manual_review
        && a.winner_payment_status !== "paid"
      )
    : [];
  const paidWins = (!isGuest && user?.id)
    ? auctions.filter(a =>
        a.status === "ended"
        && a.winner_id === user.id
        && a.winner_payment_status === "paid"
      )
    : [];

  return (
    <motion.div data-testid="auctions-page" className="min-h-screen" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Notification Toast */}
      <AnimatePresence>{showNotifToast && <NotifToast notifs={auctionNotifs} onDismiss={dismissNotif} />}</AnimatePresence>
      {/* Win/Lose Modal */}
      <AnimatePresence>{winLose.type && <WinLoseModal type={winLose.type} auction={winLose.auction} onClose={() => setWinLose({ type: null, auction: null })} onClaimPrize={() => openWinnerCheckout(winLose.auction)} t={t} />}</AnimatePresence>
      <AnimatePresence>
        {winnerCheckoutOpen && (
          <WinnerCheckoutModal
            open={winnerCheckoutOpen}
            checkout={winnerCheckout}
            loading={winnerCheckoutLoading}
            paying={winnerCheckoutPaying}
            error={winnerCheckoutError}
            form={winnerCheckoutForm}
            onChange={(key, value) => { setWinnerCheckoutForm((prev) => ({ ...prev, [key]: value })); setWinnerCheckoutError(""); }}
            onPay={payWinnerCheckout}
            onClose={() => { if (!winnerCheckoutPaying) { setWinnerCheckoutOpen(false); setWinnerCheckoutError(""); } }}
          />
        )}
      </AnimatePresence>
      {/* Ambient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-[600px] h-[60vw] max-h-[400px] rounded-full pointer-events-none" style={{ filter: "blur(160px)", background: "rgba(0,224,255,0.02)" }} />

      <BidBlitzPageShell
        title={t("auction.title")}
        subtitle={t("auction.subtitle")}
        onBack={() => onNavigate("/")}
        onHome={() => onNavigate("/")}
        contentClassName="relative z-10"
        testId="auctions-page-shell"
        headerActions={!isGuest ? (
          <PrimaryButton data-testid="buy-credits-btn" onClick={() => setShowCredits(true)} className="px-4">
            <Coins size={14} />
            <MoneyAmount value={credits} locale={lang} className="text-sm font-black text-[#08111D]" testId="auction-credits-balance" />
          </PrimaryButton>
        ) : null}
      >
      {isGuest && !isDemoMode && <GuestCTABar onLogin={onLogin} onRegister={onRegister} onStartDemo={onStartDemo} isDemoMode={isDemoMode} />}

      <div className="pb-8 relative z-10 space-y-3">
        {/* Daily Reward */}
        {!isGuest && <DailyReward onClaimed={setCredits} />}

        {/* Referral */}
        {!isGuest && <ReferralPanel t={t} />}

        {/* Trust */}
        <TrustBar t={t} recentWinners={winners} />

        {pendingWins.length > 0 && (
          <div className="space-y-2" data-testid="auction-pending-wins">
            {pendingWins.slice(0, 3).map((auc) => (
              <div key={auc.auction_id} className="flex items-center gap-3 rounded-2xl border border-[#FFD166]/20 bg-[#FFD166]/[0.07] p-3">
                {auc.image_url ? (
                  <img src={auc.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#FFD166]/10"><Trophy size={20} className="text-[#FFD166]" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFD166]/70">Gewonnen · Zahlung offen</p>
                  <p className="truncate text-sm font-bold text-white/85">{auc.title}</p>
                  <p className="text-xs text-[#00E0FF]">Endpreis €{Number(auc.current_price || 0).toFixed(2)} · Versand kostenlos</p>
                </div>
                <button
                  onClick={() => openWinnerCheckout(auc)}
                  className="rounded-xl border border-[#FFD166]/25 bg-[#FFD166]/10 px-3 py-2 text-xs font-black text-[#FFD166]"
                  data-testid={`auction-pay-win-${auc.auction_id}`}
                >
                  Bezahlen
                </button>
              </div>
            ))}
          </div>
        )}

        {paidWins.length > 0 && (
          <div className="space-y-2" data-testid="auction-paid-wins">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00E89D]/70">Meine Bestellungen</p>
              <p className="text-[10px] text-white/30">{paidWins.length} bezahlt</p>
            </div>
            {paidWins.slice(0, 5).map((auc) => {
              const fulfillment = auc.winner_fulfillment_status || "pending";
              return (
                <div key={auc.auction_id} className="flex items-center gap-3 rounded-2xl border border-[#00E89D]/15 bg-[#00E89D]/[0.05] p-3">
                  {auc.image_url ? (
                    <img src={auc.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#00E89D]/10"><Package size={20} className="text-[#00E89D]" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#00E89D]/70">Bezahlt · {fulfillment}</p>
                    <p className="truncate text-sm font-bold text-white/85">{auc.title}</p>
                    <p className="text-xs text-white/40">Endpreis €{Number(auc.current_price || 0).toFixed(2)} · Versand kostenlos</p>
                  </div>
                  <button
                    onClick={() => openWinnerCheckout(auc)}
                    className="rounded-xl border border-[#00E89D]/20 bg-[#00E89D]/10 px-3 py-2 text-xs font-black text-[#00E89D]"
                    data-testid={`auction-order-win-${auc.auction_id}`}
                  >
                    Bestellung
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Premium How It Works — DealDash Style */}
        {!isGuest && <div className="px-4"><KYCBanner onNavigate={onNavigate} /></div>}
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
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Suchen..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-[12px] text-white placeholder-white/30 focus:outline-none focus:border-[#00C2FF]/40"
              style={{ WebkitTextFillColor: "#ffffff" }}
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
            style={{ WebkitTextFillColor: "#ffffff" }}
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
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
      </BidBlitzPageShell>

      {!isGuest && <LowCreditsPopup credits={credits} onBuy={() => setShowCredits(true)} t={t} />}
      <LazyErrorBoundary onReset={() => setShowCredits(false)}>
        <Suspense fallback={null}>
          <BuyCreditsModal open={showCredits} onClose={() => setShowCredits(false)} onPurchased={r => setCredits(r.total_credits)} balance={isGuest ? 0 : (user?.balance || 0)} />
        </Suspense>
      </LazyErrorBoundary>    </motion.div>
  );
};

export default AuctionsPage;
