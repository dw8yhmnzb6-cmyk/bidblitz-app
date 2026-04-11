import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Clock, TrendingUp, ChevronRight,
  Coins, Loader2, X, User,
  Gavel, Trophy, ShieldCheck, Timer, Package, Truck, Globe, Check, Shield,
  Lock, Activity, Flame, Gift, Bot, AlertTriangle, Users,
  Heart, Share2, Copy, Bell, Sparkles, PartyPopper, XCircle,
  Wallet, CreditCard, Mail, Smartphone, Link2, Award, Crown, ChevronDown, ChevronUp
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { api } from "../services/api";
import GuestCTABar from "../components/GuestCTABar";

const POLL_MS = 2500;

/* ════════════════════════════════════════════
   SHARED ATOMS
   ════════════════════════════════════════════ */

const glass = "backdrop-blur-xl";
const panelBg = "rgba(8,12,20,0.65)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";
const accentCyan = "#00E0FF";
const accentGold = "#FFD166";
const accentGreen = "#00E89D";
const accentRed = "#FF4060";
const accentPurple = "#B068FF";

// ── Countdown ──
const Countdown = ({ endsAt, status, size = "md" }) => {
  const { t } = useI18n();
  const [rem, setRem] = useState(0);
  useEffect(() => {
    const c = () => setRem(Math.max(0, Math.floor((new Date(endsAt) - Date.now()) / 1000)));
    c(); const iv = setInterval(c, 1000); return () => clearInterval(iv);
  }, [endsAt]);
  if (status === "ended") return null;
  const d = Math.floor(rem / 86400), h = Math.floor((rem % 86400) / 3600), m = Math.floor((rem % 3600) / 60), s = rem % 60;
  const isFinalBattle = rem > 0 && rem <= 60;
  const crit = rem <= 20 && rem > 0;
  const ts = size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-xl";

  // Long timer (days/hours)
  if (d > 0 || h > 0) {
    return (
      <div className="flex items-baseline gap-1 font-mono font-black tabular-nums select-none">
        {d > 0 && <><span className={`${ts} text-white/90`}>{d}</span><span className="text-xs text-white/30 mr-1">{t("auction.days")}</span></>}
        <span className={`${ts} text-white/90`}>{h}</span><span className="text-xs text-white/30 mr-1">{t("auction.hours")}</span>
        <span className={`${ts} text-white/60`}>{String(m).padStart(2, "0")}</span><span className="text-xs text-white/15">m</span>
      </div>
    );
  }

  // Short timer (minutes:seconds) — with final battle
  return (
    <div className="flex flex-col items-center gap-1">
      {isFinalBattle && (
        <motion.div className="px-2 py-0.5 rounded-md mb-0.5"
          style={{ background: "rgba(255,64,96,0.15)", border: "1px solid rgba(255,64,96,0.25)" }}
          animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 0.5, repeat: Infinity }}>
          <span className="text-[8px] font-black text-[#FF4060] tracking-widest">{crit ? t("auction.ending_now") : t("auction.final_battle")}</span>
        </motion.div>
      )}
      <motion.div className="flex items-baseline gap-0.5 font-mono font-black tabular-nums select-none"
        animate={crit ? { scale: [1, 1.06, 1] } : {}} transition={{ duration: 0.45, repeat: crit ? Infinity : 0 }}>
        <span className={`${ts} ${crit ? "text-[#FF4060]" : isFinalBattle ? "text-[#FF4060]" : "text-white/90"}`} style={crit ? { textShadow: "0 0 12px rgba(255,64,96,0.5)" } : isFinalBattle ? { textShadow: "0 0 8px rgba(255,64,96,0.3)" } : {}}>
          {String(m).padStart(2, "0")}
        </span>
        <span className={`text-base ${crit ? "text-[#FF4060]/50" : "text-white/15"}`}>:</span>
        <span className={`${ts} ${crit ? "text-[#FF4060]" : isFinalBattle ? "text-[#FF4060]" : "text-white/90"}`} style={crit ? { textShadow: "0 0 12px rgba(255,64,96,0.5)" } : isFinalBattle ? { textShadow: "0 0 8px rgba(255,64,96,0.3)" } : {}}>
          {String(s).padStart(2, "0")}
        </span>
        {(isFinalBattle || crit) && <motion.div className="w-1.5 h-1.5 rounded-full ml-1.5" style={{ background: accentRed, boxShadow: `0 0 6px ${accentRed}` }} animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.3, repeat: Infinity }} />}
      </motion.div>
    </div>
  );
};

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
        <motion.button onClick={() => { setVisible(false); dismissedRef.current = true; }} className="absolute top-2 right-2 text-white/15 hover:text-white/40" whileTap={{ scale: 0.9 }}><X size={12} /></motion.button>
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
   BUY CREDITS MODAL
   ════════════════════════════════════════════ */
const PKGS = [
  { id: "10", credits: 10, price: 5, ppc: 0.50 },
  { id: "25", credits: 25, price: 10, ppc: 0.40, discount: 20 },
  { id: "50", credits: 50, price: 17.50, ppc: 0.35, discount: 30, deal: true },
  { id: "100", credits: 100, price: 29, ppc: 0.29, discount: 42, deal: true },
  { id: "250", credits: 250, price: 62.50, ppc: 0.25, discount: 50, deal: true, best: true },
];

const BuyCreditsModal = ({ open, onClose, onPurchased, balance }) => {
  const { t } = useI18n();
  const [step, setStep] = useState("select"); // select | confirm | processing | success
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [payMethod, setPayMethod] = useState("wallet"); // wallet | card | new
  const [savedCard, setSavedCard] = useState(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [msg, setMsg] = useState(null);
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);

  // Fetch saved card on open
  useEffect(() => {
    if (!open) { setStep("select"); setSelectedPkg(null); setMsg(null); return; }
    setLoadingCard(true);
    api.getAuctionSavedMethod()
      .then(d => { if (d.has_saved_method) { setSavedCard(d); setPayMethod("card"); } else { setSavedCard(null); setPayMethod("wallet"); } })
      .catch(() => setSavedCard(null))
      .finally(() => setLoadingCard(false));
    api.checkFirstPurchase().then(d => setIsFirstPurchase(d.is_first_purchase)).catch(() => {});
  }, [open]);

  const selectPkg = (p) => { setSelectedPkg(p); setMsg(null); setStep("confirm"); };

  const confirmPay = async () => {
    if (!selectedPkg) return;
    setStep("processing");
    setMsg(null);
    try {
      let r;
      if (payMethod === "card" && savedCard) {
        r = await api.buyBidCreditsDirect({ package_id: selectedPkg.id });
      } else {
        if (balance < selectedPkg.price) { setMsg({ ok: false, text: t("checkout.insufficient_wallet") }); setStep("confirm"); return; }
        r = await api.buyBidCredits({ package_id: selectedPkg.id });
      }
      setStep("success");
      setTimeout(() => { onPurchased(r); onClose(); setStep("select"); setSelectedPkg(null); setMsg(null); }, 1200);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
      setStep("confirm");
      // If card declined, reset to wallet
      if (e.message?.includes("declined") || e.message?.includes("No saved")) {
        setSavedCard(null); setPayMethod("wallet");
      }
    }
  };

  if (!open) return null;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={step === "processing" ? undefined : onClose} />
      <motion.div className={`relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden ${glass}`}
        style={{ background: "rgba(8,12,20,0.95)", border: panelBorder }}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", damping: 22 }}>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Select Package ── */}
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <h3 className="text-[14px] font-bold text-white/90 font-outfit">{t("auction.buy_credits")}</h3>
                <motion.button data-testid="credits-modal-close" onClick={onClose} whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center"><X size={13} className="text-white/40" /></motion.button>
              </div>
              <p className="px-5 text-[10px] text-[#444] mb-3">{t("auction.wallet_balance")}: <span className="text-white/60 font-semibold">{balance.toFixed(2)}</span></p>
              {isFirstPurchase && (
                <motion.div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(0,232,157,0.04)", border: "1px solid rgba(0,232,157,0.1)" }}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                  <Gift size={12} className="text-[#00E89D]" />
                  <span className="text-[9px] font-bold text-[#00E89D]">{t("lowcredits.bonus_credits")}</span>
                </motion.div>
              )}
              <div className="grid grid-cols-2 gap-2 px-5 pb-5">
                {PKGS.map(p => (
                  <motion.button key={p.id} data-testid={`credit-pkg-${p.id}`} onClick={() => selectPkg(p)}
                    className={`relative rounded-xl p-3 text-left ${glass}`}
                    style={{ background: p.best ? "rgba(0,224,255,0.02)" : "rgba(255,255,255,0.015)", border: p.best ? "1px solid rgba(0,224,255,0.08)" : panelBorder }}
                    whileTap={{ scale: 0.97 }} whileHover={{ borderColor: "rgba(0,224,255,0.12)" }}>
                    <div className="flex items-center gap-1.5 mb-1"><Coins size={11} className="text-[#FFD166]" /><span className="text-[15px] font-bold text-white/90">{p.credits}</span></div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#555] font-medium">{p.price.toFixed(2)}</span>
                      <span className="text-[8px] text-[#444]">{p.ppc.toFixed(2)}{t("discount.per_credit")}</span>
                    </div>
                    {p.discount && (
                      <span className={`absolute top-1.5 right-1.5 text-[7px] font-bold px-1.5 py-0.5 rounded-full ${p.best ? "bg-[#00E0FF]/10 text-[#00E0FF] border border-[#00E0FF]/15" : "bg-[#00E89D]/8 text-[#00E89D] border border-[#00E89D]/15"}`}>
                        {p.best ? t("discount.best_value") : `-${p.discount}%`}
                      </span>
                    )}
                    {isFirstPurchase && <span className="absolute bottom-1.5 right-1.5 text-[7px] font-bold text-[#00E89D]/60">+5</span>}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Confirm & Pay ── */}
          {step === "confirm" && selectedPkg && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                <motion.button data-testid="checkout-back-btn" onClick={() => { setStep("select"); setMsg(null); }} whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center"><ArrowLeft size={13} className="text-white/40" /></motion.button>
                <h3 className="text-[14px] font-bold text-white/90 font-outfit">{t("checkout.confirm_title")}</h3>
              </div>

              {/* Order Summary */}
              <div className="mx-5 mb-4 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: panelBorder }}>
                <p className="text-[9px] text-[#555] uppercase tracking-widest font-semibold mb-2.5">{t("checkout.summary")}</p>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,209,102,0.06)", border: "1px solid rgba(255,209,102,0.1)" }}>
                      <Coins size={13} className="text-[#FFD166]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-white/85">{selectedPkg.credits}x {t("checkout.credits")}{isFirstPurchase ? " + 5 Bonus" : ""}</p>
                      {selectedPkg.discount && <span className="text-[8px] text-[#00E89D] font-bold">-{selectedPkg.discount}% {t("discount.cheaper")}</span>}
                    </div>
                  </div>
                  <p className="text-[14px] font-bold text-white/90 font-mono">{selectedPkg.price.toFixed(2)}</p>
                </div>
                <div className="border-t border-white/[0.04] pt-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/60">{t("checkout.total")}</span>
                  <span className="text-[16px] font-black text-[#00E0FF] font-mono" style={{ textShadow: "0 0 8px rgba(0,224,255,0.12)" }}>{selectedPkg.price.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mx-5 mb-4">
                <p className="text-[9px] text-[#555] uppercase tracking-widest font-semibold mb-2">{t("checkout.select_method")}</p>
                <div className="space-y-2">
                  {/* Saved Card Option */}
                  {savedCard && (
                    <motion.button data-testid="pay-method-card" onClick={() => setPayMethod("card")}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${payMethod === "card" ? "bg-[#00E0FF]/[0.04] border border-[#00E0FF]/15" : "bg-white/[0.01] border border-white/[0.04]"}`}
                      whileTap={{ scale: 0.98 }}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${payMethod === "card" ? "bg-[#00E0FF]/8 border border-[#00E0FF]/12" : "bg-white/[0.02] border border-white/[0.04]"}`}>
                        <CreditCard size={14} className={payMethod === "card" ? "text-[#00E0FF]" : "text-white/20"} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-[11px] font-semibold ${payMethod === "card" ? "text-white/85" : "text-white/40"}`}>{savedCard.card_brand.charAt(0).toUpperCase() + savedCard.card_brand.slice(1)} ****{savedCard.card_last4}</p>
                        <p className="text-[9px] text-[#444]">{t("checkout.card_charged")}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payMethod === "card" ? "border-[#00E0FF]" : "border-white/10"}`}>
                        {payMethod === "card" && <div className="w-2 h-2 rounded-full bg-[#00E0FF]" />}
                      </div>
                    </motion.button>
                  )}

                  {/* Wallet Option */}
                  <motion.button data-testid="pay-method-wallet" onClick={() => setPayMethod("wallet")}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${payMethod === "wallet" ? "bg-[#00E89D]/[0.04] border border-[#00E89D]/15" : "bg-white/[0.01] border border-white/[0.04]"}`}
                    whileTap={{ scale: 0.98 }}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${payMethod === "wallet" ? "bg-[#00E89D]/8 border border-[#00E89D]/12" : "bg-white/[0.02] border border-white/[0.04]"}`}>
                      <Wallet size={14} className={payMethod === "wallet" ? "text-[#00E89D]" : "text-white/20"} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-[11px] font-semibold ${payMethod === "wallet" ? "text-white/85" : "text-white/40"}`}>{t("checkout.wallet")}</p>
                      <p className="text-[9px] text-[#444]">{balance.toFixed(2)} — {balance >= selectedPkg.price ? t("checkout.wallet_deducted") : t("checkout.insufficient_wallet")}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payMethod === "wallet" ? "border-[#00E89D]" : "border-white/10"}`}>
                      {payMethod === "wallet" && <div className="w-2 h-2 rounded-full bg-[#00E89D]" />}
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>{msg && !msg.ok && (
                <motion.div className="mx-5 mb-3 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "rgba(255,64,96,0.05)", border: "1px solid rgba(255,64,96,0.1)" }}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <AlertTriangle size={11} className="text-[#FF4060] flex-shrink-0" />
                  <p className="text-[10px] text-[#FF4060] font-medium">{msg.text}</p>
                </motion.div>
              )}</AnimatePresence>

              {/* Pay Now Button */}
              <div className="px-5 pb-4">
                <motion.button data-testid="checkout-pay-btn" onClick={confirmPay}
                  disabled={payMethod === "wallet" && balance < selectedPkg.price}
                  className="w-full py-3.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-30"
                  style={{
                    background: payMethod === "card" ? "rgba(0,224,255,0.1)" : "rgba(0,232,157,0.1)",
                    border: `1px solid ${payMethod === "card" ? "rgba(0,224,255,0.2)" : "rgba(0,232,157,0.2)"}`,
                    color: payMethod === "card" ? accentCyan : accentGreen,
                  }}
                  whileTap={{ scale: 0.97 }}>
                  <Zap size={14} />
                  {t("checkout.pay_now")} {selectedPkg.price.toFixed(2)}
                </motion.button>

                {/* Secure Badge */}
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <Shield size={10} className="text-[#00E89D]/40" />
                  <span className="text-[9px] text-[#333] font-medium">{t("checkout.secure")}</span>
                  <span className="text-[7px] text-[#222]">|</span>
                  <Lock size={9} className="text-[#333]/40" />
                  <span className="text-[9px] text-[#333] font-medium">Stripe</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Processing ── */}
          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center">
              <motion.div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.1)" }}
                animate={{ boxShadow: ["0 0 0px rgba(0,224,255,0)", "0 0 25px rgba(0,224,255,0.1)", "0 0 0px rgba(0,224,255,0)"] }}
                transition={{ duration: 1.5, repeat: Infinity }}>
                <Loader2 size={22} className="text-[#00E0FF] animate-spin" />
              </motion.div>
              <p className="text-[13px] text-white/70 font-semibold">{t("checkout.processing")}</p>
            </motion.div>
          )}

          {/* ── Success ── */}
          {step === "success" && selectedPkg && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
              <motion.div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: "rgba(0,232,157,0.08)", border: "1px solid rgba(0,232,157,0.15)" }}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                <Check size={22} className="text-[#00E89D]" />
              </motion.div>
              <p className="text-[14px] font-bold text-white/90 mb-1">{t("checkout.success")}</p>
              <p className="text-[22px] font-black text-[#00E89D] font-mono mb-1">+{selectedPkg.credits}</p>
              <p className="text-[10px] text-[#444]">{t("checkout.added_credits")}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   AUTO-BID MODAL
   ════════════════════════════════════════════ */
const AutoBidModal = ({ open, onClose, auctionId, onSet }) => {
  const { t } = useI18n();
  const [maxBids, setMaxBids] = useState(10);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { await api.setAutoBid({ auction_id: auctionId, max_bids: maxBids }); onSet(maxBids); onClose(); } catch {}
    setSaving(false);
  };
  if (!open) return null;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div className={`relative w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden ${glass}`}
        style={{ background: "rgba(8,12,20,0.92)", border: panelBorder }} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1"><Bot size={14} className="text-[#B068FF]" /><h3 className="text-[14px] font-bold text-white/90 font-outfit">{t("auction.auto_bid")}</h3></div>
          <p className="text-[10px] text-[#444]">{t("auction.auto_bid_desc")}</p>
        </div>
        <div className="px-5 pb-4">
          <label className="text-[9px] text-[#444] uppercase tracking-wider font-semibold mb-2 block">{t("auction.max_bids")}</label>
          <div className="flex items-center gap-3 mb-4">
            {[5, 10, 25, 50].map(v => (
              <motion.button key={v} onClick={() => setMaxBids(v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${maxBids === v ? "bg-[#B068FF]/12 border border-[#B068FF]/25 text-[#B068FF]" : "bg-white/[0.02] border border-white/[0.04] text-[#555]"}`}
                whileTap={{ scale: 0.95 }}>{v}</motion.button>
            ))}
          </div>
          <motion.button data-testid="auto-bid-confirm" onClick={submit} disabled={saving}
            className="w-full py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
            style={{ background: "rgba(176,104,255,0.1)", border: "1px solid rgba(176,104,255,0.2)", color: accentPurple }}
            whileTap={{ scale: 0.97 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <><Bot size={13} />{t("auction.activate_auto_bid")}</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   GRID CARD
   ════════════════════════════════════════════ */
const AuctionGridCard = ({ auction, onClick, t, idx, isWatched, onToggleWatch }) => {
  const isEnded = auction.status === "ended";
  const [rem, setRem] = useState(0);
  useEffect(() => {
    const c = () => setRem(Math.max(0, Math.floor((new Date(auction.ends_at) - Date.now()) / 1000)));
    c(); const iv = setInterval(c, 1000); return () => clearInterval(iv);
  }, [auction.ends_at]);

  const isFinalBattle = rem > 0 && rem <= 60;
  const isEndingNow = rem > 0 && rem <= 20;
  const d = Math.floor(rem / 86400), h = Math.floor((rem % 86400) / 3600), m = Math.floor((rem % 3600) / 60), s = rem % 60;
  const timerText = isEnded ? "ENDED" : d > 0 ? `${d}${t("auction.days")} ${h}${t("auction.hours")} ${String(m).padStart(2,"0")}m` : h > 0 ? `${h}${t("auction.hours")} ${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;

  return (
    <motion.button data-testid={`auction-card-${auction.auction_id}`} onClick={onClick}
      className={`w-full rounded-2xl overflow-hidden text-left relative group ${glass}`}
      style={{ background: panelBg, border: isFinalBattle ? "1px solid rgba(255,64,96,0.12)" : panelBorder, boxShadow: isFinalBattle ? "0 0 25px rgba(255,64,96,0.08)" : "0 2px 16px rgba(0,0,0,0.2)" }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04, duration: 0.35 }}>
      {!isEnded && (
        <motion.div className="absolute top-0 left-0 right-0 h-px z-10"
          style={{ background: isFinalBattle ? `linear-gradient(90deg, transparent, ${accentRed}, transparent)` : `linear-gradient(90deg, transparent, ${accentCyan}40, transparent)` }}
          animate={{ opacity: isFinalBattle ? [0.6, 1, 0.6] : [0.4, 1, 0.4] }} transition={{ duration: isFinalBattle ? 0.4 : 2.5, repeat: Infinity }} />
      )}
      <div className="relative w-full aspect-[4/3] overflow-hidden">
        {auction.image_url ? (
          <img src={auction.image_url} alt={auction.title} className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04] ${isEnded ? "opacity-30 grayscale" : ""}`} loading="lazy" />
        ) : (
          <div className="w-full h-full bg-[#060810] flex items-center justify-center"><Gavel size={24} className="text-white/5" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060810] via-transparent to-transparent opacity-70" />

        {/* Timer badge — dual mode */}
        <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-xl ${isFinalBattle ? "animate-pulse" : ""}`}
          style={{ background: isFinalBattle ? "rgba(255,64,96,0.85)" : "rgba(6,8,16,0.7)", border: `1px solid ${isFinalBattle ? "rgba(255,64,96,0.4)" : "rgba(255,255,255,0.06)"}` }}>
          <Timer size={8} className="text-white/70" />
          <span className="text-[10px] font-mono font-bold tabular-nums text-white">{timerText}</span>
        </div>

        {/* Final battle badge */}
        {isFinalBattle && !isEnded && (
          <motion.div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md backdrop-blur-xl z-20"
            style={{ background: "rgba(255,64,96,0.9)", border: "1px solid rgba(255,64,96,0.5)" }}
            animate={{ scale: [1, 1.04, 1], opacity: isEndingNow ? [0.8, 1, 0.8] : 1 }}
            transition={{ duration: isEndingNow ? 0.3 : 0.8, repeat: Infinity }}>
            <span className="text-[7px] font-black text-white tracking-widest">
              {isEndingNow ? t("auction.ending_now") : t("auction.final_battle")}
            </span>
          </motion.div>
        )}

        {/* Watchlist heart */}
        {onToggleWatch && !isEnded && (
          <motion.div data-testid={`watchlist-btn-${auction.auction_id}`}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-xl cursor-pointer z-20"
            style={{ background: isWatched ? "rgba(255,64,96,0.2)" : "rgba(6,8,16,0.6)", border: `1px solid ${isWatched ? "rgba(255,64,96,0.3)" : "rgba(255,255,255,0.06)"}` }}
            onClick={e => { e.stopPropagation(); onToggleWatch(auction.auction_id); }}
            whileTap={{ scale: 0.85 }}>
            <Heart size={11} className={isWatched ? "text-[#FF4060]" : "text-white/30"} fill={isWatched ? "#FF4060" : "none"} />
          </motion.div>
        )}
        {!onToggleWatch && auction.total_bids > 0 && !isEnded && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md backdrop-blur-xl bg-[#060810]/60 border border-white/[0.06]">
            <Flame size={8} className="text-[#FF8C42]" /><span className="text-[8px] font-bold text-white/70">{auction.total_bids}</span>
          </div>
        )}
        {auction.total_bids > 0 && !isEnded && onToggleWatch && (
          <div className="absolute bottom-8 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md backdrop-blur-xl bg-[#060810]/60 border border-white/[0.06]">
            <Flame size={8} className="text-[#FF8C42]" /><span className="text-[8px] font-bold text-white/70">{auction.total_bids}</span>
          </div>
        )}
        {!isEnded && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md backdrop-blur-xl"
            style={{ background: "rgba(0,232,157,0.7)", border: "1px solid rgba(0,232,157,0.25)" }}>
            <Truck size={7} className="text-white" /><span className="text-[7px] font-bold text-white tracking-wider">FREE SHIPPING</span>
          </div>
        )}
        {isEnded && auction.winner_name && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md backdrop-blur-xl bg-[#FFD166]/80 border border-[#FFD166]/30">
            <Trophy size={7} className="text-black/70" /><span className="text-[7px] font-bold text-black/70 truncate max-w-[70px]">{auction.winner_name}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className={`text-[11px] font-semibold leading-tight mb-2 line-clamp-2 ${isEnded ? "text-white/30" : "text-white/85"}`}>{auction.title}</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[7px] text-[#333] uppercase tracking-widest font-semibold mb-0.5">{t("auction.current_price")}</p>
            <p className={`text-[17px] font-black font-mono tabular-nums leading-none ${isEnded ? "text-[#FFD166]/60" : isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"}`}
              style={!isEnded ? { textShadow: isFinalBattle ? "0 0 12px rgba(255,64,96,0.2)" : "0 0 10px rgba(0,224,255,0.15)" } : {}}>
              {auction.current_price.toFixed(2)}
            </p>
            <p className="text-[8px] text-[#333] mt-0.5 line-through">{auction.retail_price.toFixed(2)}</p>
          </div>
          {!isEnded && (
            <motion.div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
              style={{ background: isFinalBattle ? "rgba(255,64,96,0.08)" : "rgba(0,224,255,0.06)", border: `1px solid ${isFinalBattle ? "rgba(255,64,96,0.15)" : "rgba(0,224,255,0.12)"}` }}
              whileHover={{ borderColor: isFinalBattle ? "rgba(255,64,96,0.3)" : "rgba(0,224,255,0.25)" }}>
              <Zap size={9} className={isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"} />
              <span className={`text-[9px] font-bold ${isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"}`}>{t("auction.bid_now")}</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.button>
  );
};

/* ════════════════════════════════════════════
   TRUST BAR
   ════════════════════════════════════════════ */
const TrustBar = ({ t, recentWinners }) => (
  <motion.div className={`rounded-2xl p-3 mb-3 ${glass}`} style={{ background: panelBg, border: panelBorder }}
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
    <div className="grid grid-cols-3 gap-1">
      {[
        { icon: Lock, color: accentGreen, text: t("auction.trust_secure") },
        { icon: Activity, color: accentCyan, text: t("auction.trust_realtime") },
        { icon: Truck, color: accentPurple, text: t("auction.trust_free_ship") },
      ].map((item, i) => (
        <div key={i} className={`flex items-center gap-1.5 justify-center ${i === 1 ? "border-x border-white/[0.03]" : ""}`}>
          <item.icon size={10} style={{ color: item.color }} /><span className="text-[8px] text-white/40 font-medium">{item.text}</span>
        </div>
      ))}
    </div>
    {recentWinners.length > 0 && (
      <div className="mt-2 pt-2 border-t border-white/[0.03] flex items-center gap-2 overflow-hidden">
        <Trophy size={9} className="text-[#FFD166] flex-shrink-0" />
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {recentWinners.slice(0, 3).map((w, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[8px] text-[#FFD166] font-semibold">{w.winner_name}</span>
              <span className="text-[7px] text-[#333]">{t("auction.won_item")}</span>
              <span className="text-[8px] text-white/30 truncate max-w-[70px]">{w.title}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </motion.div>
);

/* ════════════════════════════════════════════
   BID HISTORY ITEM
   ════════════════════════════════════════════ */
const BidRow = ({ bid, isLatest }) => (
  <motion.div className={`flex items-center justify-between py-2 px-3 ${isLatest ? "bg-[#00E0FF]/[0.02]" : ""}`}
    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: isLatest ? "rgba(0,224,255,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${isLatest ? "rgba(0,224,255,0.12)" : "rgba(255,255,255,0.03)"}` }}>
        {bid.is_auto ? <Bot size={8} className={isLatest ? "text-[#B068FF]" : "text-white/20"} /> : <User size={8} className={isLatest ? "text-[#00E0FF]" : "text-white/20"} />}
      </div>
      <span className={`text-[10px] font-medium truncate ${isLatest ? "text-white/85" : "text-white/40"}`}>{bid.user_name}</span>
      {bid.is_auto && <Bot size={8} className="text-[#B068FF]/50 flex-shrink-0" />}
    </div>
    <div className="flex items-center gap-2.5 flex-shrink-0">
      <span className={`text-[11px] font-mono font-bold tabular-nums ${isLatest ? "text-[#00E0FF]" : "text-white/30"}`}>{bid.bid_price.toFixed(2)}</span>
      <span className="text-[8px] text-[#333]">{new Date(bid.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
    </div>
  </motion.div>
);

/* ════════════════════════════════════════════
   AUCTION DETAIL
   ════════════════════════════════════════════ */
const AuctionDetail = ({ auctionId, onBack, isGuest, onAuthRequired, userCredits, onCreditsChanged }) => {
  const { t } = useI18n();
  const user = useUser();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [uniqueBidders, setUniqueBidders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [bidMsg, setBidMsg] = useState(null);
  const [autoBid, setAutoBid] = useState(null);
  const [showAutoBidModal, setShowAutoBidModal] = useState(false);
  const pollRef = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const r = await api.getAuction(auctionId);
      setAuction(r.auction); setBids(r.bids || []); setUniqueBidders(r.unique_bidders || 0);
    } catch {}
  }, [auctionId]);

  const fetchAutoBid = useCallback(async () => {
    if (isGuest) return;
    try { const r = await api.getAutoBid(auctionId); setAutoBid(r); } catch {}
  }, [auctionId, isGuest]);

  useEffect(() => {
    Promise.all([fetch(), fetchAutoBid()]).then(() => setLoading(false));
    pollRef.current = setInterval(fetch, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetch, fetchAutoBid]);

  const handleBid = async () => {
    if (isGuest) { onAuthRequired(); return; }
    if (userCredits < 1) { setBidMsg({ ok: false, text: t("auction.no_credits") }); return; }
    setBidding(true); setBidMsg(null);
    try {
      const r = await api.placeBid({ auction_id: auctionId });
      setAuction(p => ({ ...p, current_price: r.new_price, ends_at: r.ends_at, total_bids: r.total_bids, last_bidder_id: user.id, last_bidder_name: user.name }));
      setBids(p => [{ bid_id: Date.now().toString(), user_name: user.name, bid_price: r.new_price, created_at: new Date().toISOString() }, ...p].slice(0, 30));
      onCreditsChanged(r.remaining_credits);
    } catch (e) { setBidMsg({ ok: false, text: e.message }); }
    setBidding(false);
  };

  const cancelAuto = async () => {
    try { await api.cancelAutoBid(auctionId); setAutoBid({ active: false }); } catch {}
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}><Loader2 size={20} className="animate-spin text-[#00E0FF]" /></div>;
  if (!auction) return null;
  const isActive = auction.status === "active";
  const isEnded = auction.status === "ended";
  const isLeading = isActive && auction.last_bidder_id === user?.id;
  const isOutbid = isActive && auction.last_bidder_id && auction.last_bidder_id !== user?.id && bids.some(b => b.user_id === user?.id || b.user_name === user?.name);
  const savePct = auction.retail_price > 0 ? Math.round(((auction.retail_price - auction.current_price) / auction.retail_price) * 100) : 0;

  return (
    <motion.div className="min-h-screen" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Hero Image */}
      <div className="relative w-full aspect-[16/10] max-h-[300px] overflow-hidden">
        {auction.image_url ? <img src={auction.image_url} alt="" className={`w-full h-full object-cover ${isEnded ? "opacity-30 grayscale" : ""}`} /> : <div className="w-full h-full bg-[#060810]" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #040610 0%, #04061080 40%, transparent 100%)" }} />
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top,0px),16px)]">
          <motion.button data-testid="auction-back-btn" className={`w-9 h-9 rounded-full flex items-center justify-center ${glass}`}
            style={{ background: "rgba(6,8,16,0.6)", border: "1px solid rgba(255,255,255,0.06)" }} whileTap={{ scale: 0.88 }} onClick={onBack}>
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${glass}`} style={{ background: "rgba(6,8,16,0.6)", border: "1px solid rgba(255,209,102,0.15)" }}>
            <Coins size={10} className="text-[#FFD166]" /><span className="text-[10px] font-bold text-[#FFD166] tabular-nums">{userCredits}</span>
          </div>
        </div>
        {/* Badges on hero */}
        <div className="absolute bottom-12 left-4 flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-xl bg-[#00E89D]/70 border border-[#00E89D]/25">
          <Truck size={9} className="text-white" /><span className="text-[8px] font-bold text-white tracking-wider">FREE WORLDWIDE SHIPPING</span>
        </div>
        <div className="absolute bottom-12 right-4 flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-xl bg-[#060810]/60 border border-[#00E89D]/15">
          <ShieldCheck size={8} className="text-[#00E89D]" /><span className="text-[8px] font-semibold text-[#00E89D]">{auction.condition || "Brand New"}</span>
        </div>
      </div>

      <div className="px-5 -mt-5 pb-32 relative z-10 space-y-3">
        <h1 className="text-[17px] font-bold text-white/90 font-outfit leading-tight">{auction.title}</h1>
        <p className="text-[10px] text-white/30 leading-relaxed">{auction.description}</p>

        {/* Engagement: Leading / Outbid */}
        <AnimatePresence>
          {isLeading && (
            <motion.div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(0,232,157,0.05)", border: "1px solid rgba(0,232,157,0.1)" }}
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ShieldCheck size={12} className="text-[#00E89D]" /><span className="text-[10px] font-semibold text-[#00E89D]">{t("auction.you_leading")}</span>
            </motion.div>
          )}
          {isOutbid && (
            <motion.div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,64,96,0.05)", border: "1px solid rgba(255,64,96,0.1)" }}
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <AlertTriangle size={12} className="text-[#FF4060]" /><span className="text-[10px] font-semibold text-[#FF4060]">{t("auction.you_outbid")}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Price + Timer Panel */}
        <motion.div className={`rounded-2xl p-4 relative overflow-hidden ${glass}`} style={{ background: panelBg, border: panelBorder }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {isActive && <motion.div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentCyan}50, transparent)` }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[7px] text-[#444] uppercase tracking-widest font-semibold mb-1">{t("auction.current_price")}</p>
              <motion.p className="text-[30px] font-black font-mono tabular-nums leading-none" style={{ color: isEnded ? accentGold : accentCyan, textShadow: isEnded ? "none" : "0 0 16px rgba(0,224,255,0.2)" }}
                key={auction.current_price} initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 0.25 }}>
                {auction.current_price.toFixed(2)}
              </motion.p>
              <p className="text-[9px] text-[#333] mt-0.5"><span className="line-through">{auction.retail_price.toFixed(2)}</span>{savePct > 0 && <span className="text-[#00E89D] ml-1 font-semibold">-{savePct}%</span>}</p>
            </div>
            <div className="text-right">
              <p className="text-[7px] text-[#444] uppercase tracking-widest font-semibold mb-1">{isEnded ? t("auction.ended") : t("auction.time_left")}</p>
              {isActive && <Countdown endsAt={auction.ends_at} status={auction.status} size="lg" />}
              {isEnded && <div className="flex items-center gap-1"><Trophy size={14} className="text-[#FFD166]" /><span className="text-[12px] font-bold text-[#FFD166]">{auction.winner_name || "—"}</span></div>}
            </div>
          </div>
          <div className="flex items-center gap-4 pt-3 border-t border-white/[0.03]">
            <div className="flex items-center gap-1"><Gavel size={9} className="text-[#B068FF]" /><span className="text-[9px] text-white/40">{auction.total_bids} bids</span></div>
            <div className="flex items-center gap-1"><Users size={9} className="text-[#FFD166]" /><span className="text-[9px] text-white/40">{uniqueBidders} bidders</span></div>
            <div className="flex items-center gap-1"><TrendingUp size={9} className="text-[#00E89D]" /><span className="text-[9px] text-white/40">+0.01</span></div>
            <div className="flex items-center gap-1"><Clock size={9} className="text-[#FFD166]" /><span className="text-[9px] text-white/40">+10s</span></div>
          </div>
        </motion.div>

        {/* Bid + Auto-Bid Buttons */}
        {isActive && (
          <motion.div className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <AnimatePresence>{bidMsg && <motion.div className="px-3 py-2 rounded-xl text-[10px] font-medium bg-[#FF4060]/6 text-[#FF4060] border border-[#FF4060]/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{bidMsg.text}</motion.div>}</AnimatePresence>
            <motion.button data-testid="place-bid-btn" onClick={handleBid} disabled={bidding}
              className="w-full py-3.5 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${accentCyan}, #0090BB)`, boxShadow: `0 4px 24px rgba(0,224,255,0.2), inset 0 1px 0 rgba(255,255,255,0.08)` }}
              whileTap={{ scale: 0.97 }}>
              <motion.div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} />
              {bidding ? <Loader2 size={16} className="animate-spin text-white" /> : <><Zap size={16} className="text-white" /><span className="text-white relative z-10">{t("auction.place_bid")} (1 Credit)</span></>}
            </motion.button>
            <div className="flex gap-2">
              {autoBid?.active ? (
                <motion.button data-testid="cancel-auto-bid" onClick={cancelAuto}
                  className={`flex-1 py-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 ${glass}`}
                  style={{ background: "rgba(176,104,255,0.06)", border: "1px solid rgba(176,104,255,0.12)", color: accentPurple }}
                  whileTap={{ scale: 0.97 }}>
                  <Bot size={12} />{t("auction.auto_bid_active")} ({autoBid.bids_placed}/{autoBid.max_bids}) — {t("auction.cancel")}
                </motion.button>
              ) : (
                <motion.button data-testid="auto-bid-btn" onClick={() => isGuest ? onAuthRequired() : setShowAutoBidModal(true)}
                  className={`flex-1 py-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 ${glass}`}
                  style={{ background: "rgba(176,104,255,0.04)", border: "1px solid rgba(176,104,255,0.08)", color: "#888" }}
                  whileTap={{ scale: 0.97 }} whileHover={{ borderColor: "rgba(176,104,255,0.2)", color: accentPurple }}>
                  <Bot size={12} />{t("auction.auto_bid")}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Live Bid History */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <motion.div className="w-1.5 h-1.5 rounded-full bg-[#00E0FF]" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
              <p className="text-[8px] text-[#444] uppercase tracking-widest font-semibold">{t("auction.bid_history")}</p>
            </div>
            <span className="text-[8px] text-[#333]">{bids.length}</span>
          </div>
          <div className={`rounded-2xl overflow-hidden divide-y divide-white/[0.02] ${glass}`} style={{ background: panelBg, border: panelBorder }}>
            {bids.length === 0 ? (
              <div className="py-8 text-center"><Gavel size={16} className="text-white/5 mx-auto mb-2" /><p className="text-[10px] text-[#333]">{t("auction.no_bids_yet")}</p></div>
            ) : bids.slice(0, 12).map((b, i) => <BidRow key={b.bid_id || i} bid={b} isLatest={i === 0} />)}
          </div>
        </motion.div>

        {/* Features */}
        {auction.features?.length > 0 && (
          <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <p className="text-[8px] text-[#444] uppercase tracking-widest font-semibold mb-3">{t("auction.key_features")}</p>
            <div className="space-y-2">
              {auction.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(0,224,255,0.04)", border: "1px solid rgba(0,224,255,0.08)" }}>
                    <Check size={7} className="text-[#00E0FF]" />
                  </div>
                  <span className="text-[10px] text-white/45 leading-relaxed">{f}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Shipping */}
        <motion.div className={`rounded-2xl p-4 ${glass}`} style={{ background: panelBg, border: panelBorder }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <p className="text-[8px] text-[#444] uppercase tracking-widest font-semibold mb-3">{t("auction.shipping_info")}</p>
          <div className="space-y-2.5">
            {[
              { icon: Globe, color: accentCyan, label: t("auction.shipping_worldwide"), desc: t("auction.shipping_worldwide_desc") },
              { icon: Truck, color: accentPurple, label: t("auction.shipping_delivery"), desc: t("auction.shipping_delivery_desc") },
              { icon: Package, color: accentGold, label: t("auction.shipping_packaging"), desc: t("auction.shipping_packaging_desc") },
              { icon: Shield, color: accentGreen, label: t("auction.shipping_guarantee"), desc: t("auction.shipping_guarantee_desc") },
            ].map((it, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${it.color}06`, border: `1px solid ${it.color}10` }}>
                  <it.icon size={11} style={{ color: it.color }} />
                </div>
                <div className="flex-1 min-w-0"><p className="text-[10px] text-white/60 font-medium">{it.label}</p><p className="text-[9px] text-[#444] leading-relaxed">{it.desc}</p></div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <AutoBidModal open={showAutoBidModal} onClose={() => setShowAutoBidModal(false)} auctionId={auctionId}
        onSet={(max) => setAutoBid({ active: true, max_bids: max, bids_placed: 0 })} />
    </motion.div>
  );
};

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
const ReferralPanel = ({ t }) => {
  const [ref, setRef] = useState(null);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [applyMsg, setApplyMsg] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showBoard, setShowBoard] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(null);

  useEffect(() => {
    api.getAuctionReferral().then(setRef).catch(() => {});
    api.getReferralLeaderboard().then(d => setLeaderboard(d.leaderboard || [])).catch(() => {});
  }, []);

  const shareUrl = `https://bidblitz.ae?ref=${ref?.referral_code || ""}`;
  const shareMsg = t("share.invite_msg").replace("{code}", ref?.referral_code || "");

  const showShared = (via) => { setShareSuccess(via); setTimeout(() => setShareSuccess(null), 2500); };

  const copy = () => {
    navigator.clipboard.writeText(`${shareMsg}\n${shareUrl}`).then(() => { setCopied(true); showShared("copy"); setTimeout(() => setCopied(false), 2500); }).catch(() => {});
  };

  const shareWhatsApp = () => { window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg + "\n" + shareUrl)}`, "_blank"); showShared("whatsapp"); };
  const shareEmail = () => { window.open(`mailto:?subject=${encodeURIComponent("BidBlitz — " + t("auction.referral_title"))}&body=${encodeURIComponent(shareMsg + "\n\n" + shareUrl)}`, "_blank"); showShared("email"); };
  const shareNative = () => {
    if (navigator.share) { navigator.share({ title: "BidBlitz", text: shareMsg, url: shareUrl }).then(() => showShared("native")).catch(() => {}); }
    else copy();
  };

  const apply = async () => {
    if (!applyCode.trim()) return;
    try {
      const r = await api.applyAuctionReferral(applyCode.trim());
      setApplyMsg({ ok: true, text: `+${r.credits_awarded} Credits!` });
      setApplyCode("");
    } catch (e) { setApplyMsg({ ok: false, text: e.message }); }
  };

  if (!ref) return null;
  return (
    <motion.div className={`rounded-2xl overflow-hidden ${glass}`} style={{ background: panelBg, border: panelBorder }}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
      <div className="p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.1)" }}>
            <Share2 size={14} className="text-[#00E0FF]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/80">{t("auction.referral_title")}</p>
            <p className="text-[9px] text-white/25">{t("auction.referral_desc")}</p>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-[12px] font-mono font-bold text-[#00E0FF] tracking-wider">{ref.referral_code}</span>
          </div>
        </div>

        {/* Primary one-tap share button */}
        <motion.button data-testid="share-primary-btn" onClick={shareNative}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl mb-2.5"
          style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)" }}
          whileTap={{ scale: 0.97 }}
          whileHover={{ background: "rgba(0,224,255,0.1)", borderColor: "rgba(0,224,255,0.2)" }}>
          <Share2 size={14} className="text-[#00E0FF]" />
          <span className="text-[12px] font-bold text-[#00E0FF]">{t("share.native")}</span>
        </motion.button>

        {/* Share success feedback */}
        <AnimatePresence>
          {shareSuccess && (
            <motion.div className="flex items-center justify-center gap-2 py-2 mb-2.5 rounded-xl"
              style={{ background: "rgba(0,232,157,0.05)", border: "1px solid rgba(0,232,157,0.1)" }}
              initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2 }}>
              <Check size={12} className="text-[#00E89D]" />
              <span className="text-[10px] font-bold text-[#00E89D]">
                {shareSuccess === "copy" ? t("share.copied") : t("share.shared_success")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick share options row */}
        <div className="flex items-center gap-1.5">
          <motion.button data-testid="share-whatsapp" onClick={shareWhatsApp} whileTap={{ scale: 0.9 }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.12)" }}>
            <Smartphone size={10} className="text-[#25D366]" /><span className="text-[9px] font-bold text-[#25D366]">{t("share.whatsapp")}</span>
          </motion.button>
          <motion.button data-testid="share-email" onClick={shareEmail} whileTap={{ scale: 0.9 }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ background: "rgba(0,224,255,0.04)", border: "1px solid rgba(0,224,255,0.08)" }}>
            <Mail size={10} className="text-[#00E0FF]" /><span className="text-[9px] font-bold text-[#00E0FF]">{t("share.email")}</span>
          </motion.button>
          <motion.button data-testid="share-copy" onClick={copy} whileTap={{ scale: 0.9 }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ background: copied ? "rgba(0,232,157,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${copied ? "rgba(0,232,157,0.1)" : "rgba(255,255,255,0.05)"}` }}>
            {copied ? <Check size={10} className="text-[#00E89D]" /> : <Link2 size={10} className="text-white/30" />}
            <span className={`text-[9px] font-bold ${copied ? "text-[#00E89D]" : "text-white/30"}`}>{copied ? t("share.copied") : t("share.copy_link")}</span>
          </motion.button>
        </div>

        {/* Stats + apply */}
        <div className="flex items-center gap-3 mt-2.5">
          <div className="flex items-center gap-1">
            <Users size={8} className="text-[#00E0FF]/50" />
            <span className="text-[9px] text-white/20">{t("auction.referral_count")}: <span className="text-[#00E0FF] font-bold">{ref.referral_count}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <Coins size={8} className="text-[#FFD166]/50" />
            <span className="text-[9px] text-white/20">{t("referral.earned_total")}: <span className="text-[#FFD166] font-bold">{ref.referral_count * ref.bonus_per_referral}</span></span>
          </div>
          <div className="flex-1" />
          {!showApply ? (
            <motion.button onClick={() => setShowApply(true)} className="text-[9px] text-white/25 hover:text-white/50" whileTap={{ scale: 0.95 }}>{t("auction.referral_apply")}</motion.button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input data-testid="referral-apply-input" value={applyCode} onChange={e => setApplyCode(e.target.value)} placeholder="CODE"
                className="w-20 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-white/70 font-mono placeholder:text-white/10 outline-none focus:border-[#00E0FF]/20" />
              <motion.button data-testid="referral-apply-btn" onClick={apply} whileTap={{ scale: 0.95 }}
                className="px-2 py-1 rounded-lg bg-[#00E0FF]/8 border border-[#00E0FF]/15 text-[9px] font-bold text-[#00E0FF]">OK</motion.button>
            </div>
          )}
        </div>
        <AnimatePresence>{applyMsg && <motion.p className={`mt-1.5 text-[9px] font-medium ${applyMsg.ok ? "text-[#00E89D]" : "text-[#FF4060]"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{applyMsg.text}</motion.p>}</AnimatePresence>
      </div>

      {/* Leaderboard toggle */}
      {leaderboard.length > 0 && (
        <>
          <motion.button data-testid="referral-leaderboard-toggle" onClick={() => setShowBoard(p => !p)}
            className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-white/[0.03] text-[9px] text-white/20 hover:text-white/40 transition-colors"
            whileTap={{ scale: 0.98 }}>
            <Crown size={9} className="text-[#FFD166]/40" />
            <span className="font-semibold">{t("referral.leaderboard")}</span>
            {showBoard ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </motion.button>
          <AnimatePresence>
            {showBoard && (
              <motion.div className="px-3 pb-3 space-y-1" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                {leaderboard.slice(0, 5).map((l, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: i === 0 ? "rgba(255,209,102,0.03)" : "transparent" }}>
                    <span className={`text-[10px] font-bold w-4 text-center ${i === 0 ? "text-[#FFD166]" : i === 1 ? "text-white/40" : "text-white/20"}`}>#{i + 1}</span>
                    <span className="text-[10px] text-white/50 flex-1">{l.name}</span>
                    <span className="text-[9px] text-[#00E0FF] font-bold">{l.referrals}</span>
                    <span className="text-[8px] text-[#FFD166]/50">+{l.bonus}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
};

/* ════════════════════════════════════════════
   MAIN AUCTIONS PAGE
   ════════════════════════════════════════════ */
const AuctionsPage = ({ onNavigate, isGuest, isDemoMode, onAuthRequired, onLogin, onRegister, onStartDemo }) => {
  const { t } = useI18n();
  const user = useUser();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCredits, setShowCredits] = useState(false);
  const [credits, setCredits] = useState(0);
  const [filter, setFilter] = useState("all");
  const [watchlist, setWatchlist] = useState([]);
  const [auctionNotifs, setAuctionNotifs] = useState([]);
  const [showNotifToast, setShowNotifToast] = useState(false);
  const [winLose, setWinLose] = useState({ type: null, auction: null });
  const prevAuctionsRef = useRef([]);
  const pollRef = useRef(null);

  const fetchAuctions = useCallback(async () => { try { const r = await api.getAuctions(); setAuctions(r.auctions || []); } catch {} }, []);
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

  if (selected) return <AuctionDetail auctionId={selected} onBack={() => { setSelected(null); fetchAuctions(); fetchCredits(); fetchWatchlist(); }} isGuest={isGuest} onAuthRequired={onAuthRequired} userCredits={credits} onCreditsChanged={setCredits} />;

  const active = auctions.filter(a => a.status === "active" && (filter === "all" || a.category === filter));
  const ended = auctions.filter(a => a.status === "ended" && (filter === "all" || a.category === filter));
  const activeCats = [...new Set(auctions.filter(a => a.status === "active").map(a => a.category).filter(Boolean))];
  const winners = auctions.filter(a => a.status === "ended" && a.winner_name);

  return (
    <motion.div data-testid="auctions-page" className="min-h-screen" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Notification Toast */}
      <AnimatePresence>{showNotifToast && <NotifToast notifs={auctionNotifs} onDismiss={dismissNotif} />}</AnimatePresence>
      {/* Win/Lose Modal */}
      <AnimatePresence>{winLose.type && <WinLoseModal type={winLose.type} auction={winLose.auction} onClose={() => setWinLose({ type: null, auction: null })} t={t} />}</AnimatePresence>
      {/* Ambient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none" style={{ filter: "blur(160px)", background: "rgba(0,224,255,0.02)" }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),20px)] pb-2 relative z-10">
        <motion.button data-testid="auctions-back-btn" className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.04] flex items-center justify-center"
          whileTap={{ scale: 0.88 }} onClick={() => onNavigate("/")}>
          <ArrowLeft size={14} className="text-white/40" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-[14px] font-semibold font-outfit text-white/90 tracking-tight">{t("auction.title")}</h1>
          <p className="text-[9px] text-white/20">{t("auction.subtitle")}</p>
        </div>
        {!isGuest && (
          <motion.button data-testid="buy-credits-btn" onClick={() => setShowCredits(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${glass}`}
            style={{ background: "rgba(255,209,102,0.05)", border: "1px solid rgba(255,209,102,0.1)" }} whileTap={{ scale: 0.95 }}>
            <Coins size={11} className="text-[#FFD166]" /><span className="text-[11px] font-bold text-[#FFD166] tabular-nums">{credits}</span>
          </motion.button>
        )}
      </div>

      {isGuest && !isDemoMode && <GuestCTABar onLogin={onLogin} onRegister={onRegister} onStartDemo={onStartDemo} isDemoMode={isDemoMode} />}

      <div className="px-4 pb-8 relative z-10 space-y-3">
        {/* Daily Reward */}
        {!isGuest && <DailyReward onClaimed={setCredits} />}

        {/* Referral */}
        {!isGuest && <ReferralPanel t={t} />}

        {/* Trust */}
        <TrustBar t={t} recentWinners={winners} />

        {/* How it works */}
        <motion.div className={`rounded-2xl p-3 ${glass}`} style={{ background: panelBg, border: panelBorder }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <p className="text-[7px] text-[#444] uppercase tracking-widest font-semibold mb-2">{t("auction.how_it_works")}</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Coins, text: t("auction.step_buy"), color: accentGold },
              { icon: Zap, text: t("auction.step_bid"), color: accentCyan },
              { icon: Trophy, text: t("auction.step_win"), color: accentGreen },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-7 h-7 rounded-lg mx-auto mb-1 flex items-center justify-center" style={{ background: `${s.color}06`, border: `1px solid ${s.color}12` }}>
                  <s.icon size={12} style={{ color: s.color }} />
                </div>
                <p className="text-[8px] text-white/40 font-medium">{s.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {CATS.filter(c => c.id === "all" || activeCats.includes(c.id)).map(c => {
            const on = filter === c.id;
            return (
              <motion.button key={c.id} data-testid={`filter-${c.id}`} onClick={() => setFilter(c.id)}
                className={`px-3 py-1.5 rounded-full text-[9px] font-semibold whitespace-nowrap flex-shrink-0 transition-all ${glass}`}
                style={{ background: on ? `${c.color}10` : "rgba(255,255,255,0.015)", border: `1px solid ${on ? `${c.color}25` : "rgba(255,255,255,0.03)"}`, color: on ? c.color : "#444" }}
                whileTap={{ scale: 0.95 }}>{c.label}</motion.button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={18} className="animate-spin text-[#00E0FF]" /></div>
        ) : (
          <>
            {active.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <motion.div className="w-1.5 h-1.5 rounded-full bg-[#00E89D]" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                  <p className="text-[8px] text-[#444] uppercase tracking-widest font-semibold">{t("auction.live_auctions")}</p>
                  <span className="text-[8px] text-[#00E89D] font-bold">{active.length}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {active.map((a, i) => <AuctionGridCard key={a.auction_id} auction={a} onClick={() => setSelected(a.auction_id)} t={t} idx={i} isWatched={watchlist.includes(a.auction_id)} onToggleWatch={!isGuest ? toggleWatch : null} />)}
                </div>
              </motion.div>
            )}
            {ended.length > 0 && (
              <motion.div className="mt-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
                <p className="text-[8px] text-[#333] uppercase tracking-widest font-semibold mb-2.5">{t("auction.ended_auctions")}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {ended.map((a, i) => <AuctionGridCard key={a.auction_id} auction={a} onClick={() => setSelected(a.auction_id)} t={t} idx={i} />)}
                </div>
              </motion.div>
            )}
            {active.length === 0 && ended.length === 0 && <div className="py-16 text-center"><Gavel size={24} className="text-white/5 mx-auto mb-2" /><p className="text-[11px] text-[#333]">{t("auction.no_auctions")}</p></div>}
          </>
        )}
      </div>

      {!isGuest && <LowCreditsPopup credits={credits} onBuy={() => setShowCredits(true)} t={t} />}
      <BuyCreditsModal open={showCredits} onClose={() => setShowCredits(false)} onPurchased={r => setCredits(r.total_credits)} balance={isGuest ? 0 : (user?.balance || 0)} />
    </motion.div>
  );
};

export default AuctionsPage;
