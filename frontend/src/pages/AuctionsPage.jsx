import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Clock, TrendingUp, ChevronRight,
  Coins, DollarSign, Loader2, X, User, Tag,
  Gavel, Trophy, ShieldCheck, Timer
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { api } from "../services/api";
import GuestCTABar from "../components/GuestCTABar";

const POLL_INTERVAL = 2500;

// ── Countdown Timer ──
const CountdownTimer = ({ endsAt, status }) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(endsAt) - Date.now()) / 1000));
      setRemaining(diff);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  if (status === "ended") return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 15;
  const isCritical = remaining <= 5;

  return (
    <div className="flex items-center gap-2">
      <motion.div
        className="flex items-baseline gap-0.5 font-mono font-bold tabular-nums"
        animate={isCritical ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
      >
        <span className={`text-2xl ${isCritical ? "text-[#FF4757]" : isUrgent ? "text-[#FFB800]" : "text-white"}`}>
          {String(mins).padStart(2, "0")}
        </span>
        <span className={`text-lg ${isCritical ? "text-[#FF4757]/60" : "text-white/30"}`}>:</span>
        <span className={`text-2xl ${isCritical ? "text-[#FF4757]" : isUrgent ? "text-[#FFB800]" : "text-white"}`}>
          {String(secs).padStart(2, "0")}
        </span>
      </motion.div>
      {isUrgent && (
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ background: isCritical ? "#FF4757" : "#FFB800" }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}
    </div>
  );
};

// ── Mini Countdown for auction cards ──
const MiniCountdown = ({ endsAt, status }) => {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () => setRemaining(Math.max(0, Math.floor((new Date(endsAt) - Date.now()) / 1000)));
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  if (status === "ended") return <span className="text-[10px] text-[#FF4757] font-semibold">ENDED</span>;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const urgent = remaining <= 30;
  return (
    <span className={`text-[11px] font-mono font-bold tabular-nums ${urgent ? "text-[#FF4757]" : "text-white/70"}`}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
};

// ── Credit Packages Modal ──
const PACKAGES = [
  { id: "10", credits: 10, price: 5 },
  { id: "25", credits: 25, price: 10 },
  { id: "50", credits: 50, price: 18 },
  { id: "100", credits: 100, price: 30 },
];

const BuyCreditsModal = ({ open, onClose, onPurchased, balance }) => {
  const { t } = useI18n();
  const [buying, setBuying] = useState(null);
  const [msg, setMsg] = useState(null);

  const handleBuy = async (pkg) => {
    if (balance < pkg.price) {
      setMsg({ ok: false, text: t("auction.insufficient_balance") });
      return;
    }
    setBuying(pkg.id); setMsg(null);
    try {
      const res = await api.buyBidCredits({ package_id: pkg.id });
      setMsg({ ok: true, text: `+${res.credits_added} Credits` });
      setTimeout(() => { onPurchased(res); onClose(); setMsg(null); }, 1200);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
    setBuying(null);
  };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-[15px] font-bold text-white font-outfit">{t("auction.buy_credits")}</h3>
            <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center">
              <X size={14} className="text-white/50" />
            </motion.button>
          </div>
          <p className="px-5 text-[11px] text-[#555] mb-3">{t("auction.wallet_balance")}: <span className="text-white/70 font-semibold">{balance.toFixed(2)}</span></p>
          <div className="grid grid-cols-2 gap-2 px-5 pb-3">
            {PACKAGES.map(pkg => (
              <motion.button key={pkg.id} data-testid={`credit-pkg-${pkg.id}`}
                onClick={() => handleBuy(pkg)} disabled={buying === pkg.id}
                className="relative rounded-xl p-3 text-left transition-all group"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                whileTap={{ scale: 0.97 }}
                whileHover={{ borderColor: "rgba(0,194,255,0.2)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Coins size={12} className="text-[#FFB800]" />
                  <span className="text-[15px] font-bold text-white">{pkg.credits}</span>
                </div>
                <span className="text-[11px] text-[#555] font-medium">{pkg.price.toFixed(2)}</span>
                {pkg.credits >= 50 && (
                  <span className="absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#00D26A]/10 text-[#00D26A] border border-[#00D26A]/20">
                    DEAL
                  </span>
                )}
                {buying === pkg.id && <Loader2 size={14} className="absolute top-3 right-3 animate-spin text-[#00C2FF]" />}
              </motion.button>
            ))}
          </div>
          <AnimatePresence>
            {msg && (
              <motion.div className={`mx-5 mb-4 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2 ${msg.ok ? "bg-[#00D26A]/8 text-[#00D26A] border border-[#00D26A]/15" : "bg-[#FF4757]/8 text-[#FF4757] border border-[#FF4757]/15"}`}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {msg.text}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="h-1" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ── Auction Card (list view) ──
const AuctionCard = ({ auction, onClick }) => {
  const isEnded = auction.status === "ended";
  const iconMap = {
    "iPhone": "smartphone",
    "PlayStation": "gamepad",
    "AirPods": "headphones",
    "Galaxy Watch": "watch",
  };
  const matchedIcon = Object.entries(iconMap).find(([k]) => auction.title.includes(k));

  return (
    <motion.button data-testid={`auction-card-${auction.auction_id}`}
      onClick={onClick}
      className="w-full rounded-2xl p-4 text-left relative overflow-hidden group"
      style={{
        background: isEnded ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isEnded ? "rgba(255,255,255,0.03)" : "rgba(0,194,255,0.08)"}`,
      }}
      whileTap={{ scale: 0.98 }}
      whileHover={{ borderColor: isEnded ? "rgba(255,255,255,0.05)" : "rgba(0,194,255,0.18)" }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      {!isEnded && (
        <motion.div className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(0,194,255,0.3), transparent)" }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }} />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isEnded ? (
              <Trophy size={12} className="text-[#FFB800] flex-shrink-0" />
            ) : (
              <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <Gavel size={12} className="text-[#00C2FF] flex-shrink-0" />
              </motion.div>
            )}
            <h3 className={`text-[13px] font-semibold truncate ${isEnded ? "text-white/50" : "text-white/90"}`}>
              {auction.title}
            </h3>
            {auction.category && (
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.05] text-[#555] flex-shrink-0">
                {auction.category}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#444] truncate mb-2">{auction.description}</p>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-[#333] uppercase tracking-wider font-semibold">Price</p>
              <p className={`text-[16px] font-bold font-mono tabular-nums ${isEnded ? "text-[#FFB800]" : "text-[#00C2FF]"}`}>
                {auction.current_price.toFixed(2)}
              </p>
            </div>
            <div className="w-px h-6 bg-white/[0.04]" />
            <div>
              <p className="text-[9px] text-[#333] uppercase tracking-wider font-semibold">Retail</p>
              <p className="text-[12px] text-[#555] font-medium line-through">{auction.retail_price.toFixed(2)}</p>
            </div>
            <div className="w-px h-6 bg-white/[0.04]" />
            <div>
              <p className="text-[9px] text-[#333] uppercase tracking-wider font-semibold">Bids</p>
              <p className="text-[12px] text-white/60 font-bold">{auction.total_bids}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: isEnded ? "rgba(255,71,87,0.06)" : "rgba(0,194,255,0.06)", border: `1px solid ${isEnded ? "rgba(255,71,87,0.1)" : "rgba(0,194,255,0.1)"}` }}>
            <Timer size={10} className={isEnded ? "text-[#FF4757]" : "text-[#00C2FF]"} />
            <MiniCountdown endsAt={auction.ends_at} status={auction.status} />
          </div>
          {isEnded && auction.winner_name && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFB800]/6 border border-[#FFB800]/10">
              <Trophy size={9} className="text-[#FFB800]" />
              <span className="text-[9px] text-[#FFB800] font-semibold truncate max-w-[80px]">{auction.winner_name}</span>
            </div>
          )}
          <ChevronRight size={14} className="text-[#222] mt-1" />
        </div>
      </div>
    </motion.button>
  );
};

// ── Bid History Item ──
const BidHistoryItem = ({ bid, isLatest }) => (
  <motion.div className={`flex items-center justify-between py-2 px-3 rounded-lg ${isLatest ? "bg-[#00C2FF]/[0.03]" : ""}`}
    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: isLatest ? "rgba(0,194,255,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${isLatest ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)"}` }}>
        <User size={10} className={isLatest ? "text-[#00C2FF]" : "text-white/30"} />
      </div>
      <span className={`text-[11px] font-medium truncate ${isLatest ? "text-white/90" : "text-white/50"}`}>
        {bid.user_name}
      </span>
    </div>
    <div className="flex items-center gap-3 flex-shrink-0">
      <span className={`text-[12px] font-mono font-bold tabular-nums ${isLatest ? "text-[#00C2FF]" : "text-white/40"}`}>
        {bid.bid_price.toFixed(2)}
      </span>
      <span className="text-[9px] text-[#333]">
        {new Date(bid.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
    </div>
  </motion.div>
);

// ── Auction Detail View ──
const AuctionDetail = ({ auctionId, onBack, isGuest, onAuthRequired, userCredits, onCreditsChanged }) => {
  const { t } = useI18n();
  const user = useUser();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [bidMsg, setBidMsg] = useState(null);
  const pollRef = useRef(null);
  const [bidFlash, setBidFlash] = useState(false);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await api.getAuction(auctionId);
      setAuction(res.auction);
      setBids(res.bids || []);
    } catch {}
  }, [auctionId]);

  useEffect(() => {
    fetchAuction().then(() => setLoading(false));
    pollRef.current = setInterval(fetchAuction, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchAuction]);

  const handleBid = async () => {
    if (isGuest) { onAuthRequired(); return; }
    if (userCredits < 1) { setBidMsg({ ok: false, text: t("auction.no_credits") }); return; }
    setBidding(true); setBidMsg(null);
    try {
      const res = await api.placeBid({ auction_id: auctionId });
      setAuction(prev => ({
        ...prev,
        current_price: res.new_price,
        ends_at: res.ends_at,
        total_bids: res.total_bids,
        last_bidder_name: user.name,
        last_bidder_id: user.id,
      }));
      setBids(prev => [{
        bid_id: Date.now().toString(),
        user_name: user.name,
        bid_price: res.new_price,
        created_at: new Date().toISOString(),
      }, ...prev].slice(0, 30));
      onCreditsChanged(res.remaining_credits);
      setBidFlash(true);
      setTimeout(() => setBidFlash(false), 600);
    } catch (e) {
      setBidMsg({ ok: false, text: e.message });
    }
    setBidding(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <Loader2 size={24} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }
  if (!auction) return null;

  const isActive = auction.status === "active";
  const isEnded = auction.status === "ended";
  const isWinner = isEnded && auction.winner_id === user?.id;
  const savings = auction.retail_price - auction.current_price;
  const savingsPercent = auction.retail_price > 0 ? Math.round((savings / auction.retail_price) * 100) : 0;

  return (
    <motion.div className="min-h-screen relative" style={{ background: "#030303" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Ambient glow */}
      <motion.div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
        style={{ filter: "blur(120px)", background: bidFlash ? "rgba(0,210,106,0.08)" : "rgba(0,194,255,0.04)" }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button data-testid="auction-back-btn"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }} onClick={onBack}>
          <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight flex-1 truncate">{auction.title}</h1>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFB800]/8 border border-[#FFB800]/15">
          <Coins size={11} className="text-[#FFB800]" />
          <span className="text-[11px] font-bold text-[#FFB800] tabular-nums">{userCredits}</span>
        </div>
      </div>

      <div className="px-5 pb-32 relative z-10 space-y-4">
        {/* Price + Timer Hero */}
        <motion.div className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "rgba(255,255,255,0.015)", border: `1px solid ${isEnded ? "rgba(255,184,0,0.1)" : "rgba(0,194,255,0.08)"}` }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {isActive && (
            <motion.div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(0,194,255,0.5), transparent)" }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }} />
          )}

          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[9px] text-[#444] uppercase tracking-wider font-semibold mb-1">{t("auction.current_price")}</p>
              <motion.p className="text-[36px] font-black font-mono tabular-nums leading-none"
                style={{ color: isEnded ? "#FFB800" : "#00C2FF" }}
                key={auction.current_price}
                initial={{ scale: 1.1, color: "#00FF88" }}
                animate={{ scale: 1, color: isEnded ? "#FFB800" : "#00C2FF" }}
                transition={{ duration: 0.4 }}>
                {auction.current_price.toFixed(2)}
              </motion.p>
              <p className="text-[10px] text-[#333] mt-1">
                <span className="line-through">{auction.retail_price.toFixed(2)}</span>
                {savingsPercent > 0 && <span className="text-[#00D26A] ml-1.5 font-semibold">-{savingsPercent}%</span>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-[#444] uppercase tracking-wider font-semibold mb-1">
                {isEnded ? t("auction.ended") : t("auction.time_left")}
              </p>
              {isActive && <CountdownTimer endsAt={auction.ends_at} status={auction.status} />}
              {isEnded && (
                <div className="flex items-center gap-1.5">
                  <Trophy size={14} className="text-[#FFB800]" />
                  <span className="text-[13px] font-bold text-[#FFB800]">{auction.winner_name || "—"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5">
              <Gavel size={11} className="text-[#A855F7]" />
              <span className="text-[11px] text-white/50">{auction.total_bids} bids</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={11} className="text-[#00D26A]" />
              <span className="text-[11px] text-white/50">+0.01/bid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={11} className="text-[#FFB800]" />
              <span className="text-[11px] text-white/50">+10s/bid</span>
            </div>
          </div>
        </motion.div>

        {isWinner && (
          <motion.div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.15)" }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Trophy size={20} className="text-[#FFB800]" />
            <div>
              <p className="text-[13px] font-bold text-[#FFB800]">{t("auction.you_won")}</p>
              <p className="text-[10px] text-[#FFB800]/60">{t("auction.won_desc")}</p>
            </div>
          </motion.div>
        )}

        {/* Bid Button */}
        {isActive && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <AnimatePresence>
              {bidMsg && (
                <motion.div className="mb-2 px-3 py-2 rounded-xl text-[11px] font-medium bg-[#FF4757]/8 text-[#FF4757] border border-[#FF4757]/15"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {bidMsg.text}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button data-testid="place-bid-btn"
              onClick={handleBid} disabled={bidding}
              className="w-full py-4 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #00C2FF, #0088CC)",
                boxShadow: "0 4px 24px rgba(0,194,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
              whileTap={{ scale: 0.97 }}
              whileHover={{ boxShadow: "0 6px 32px rgba(0,194,255,0.35), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
              <motion.div className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }}
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
              {bidding ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <>
                  <Zap size={18} className="text-white" />
                  <span className="text-white relative z-10">{t("auction.place_bid")} (1 Credit)</span>
                </>
              )}
            </motion.button>
          </motion.div>
        )}

        {/* Live Bid History */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-[#333] uppercase tracking-wider font-semibold">{t("auction.bid_history")}</p>
            <span className="text-[9px] text-[#333]">{bids.length} bids</span>
          </div>
          <div className="rounded-2xl overflow-hidden divide-y divide-white/[0.02]"
            style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}>
            {bids.length === 0 ? (
              <div className="py-8 text-center">
                <Gavel size={20} className="text-[#222] mx-auto mb-2" />
                <p className="text-[11px] text-[#333]">{t("auction.no_bids_yet")}</p>
              </div>
            ) : (
              bids.slice(0, 15).map((bid, i) => (
                <BidHistoryItem key={bid.bid_id || i} bid={bid} isLatest={i === 0} />
              ))
            )}
          </div>
        </motion.div>

        {/* Auction description */}
        {auction.description && (
          <motion.div className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="text-[9px] text-[#333] uppercase tracking-wider font-semibold mb-2">{t("auction.about")}</p>
            <p className="text-[12px] text-white/50 leading-relaxed">{auction.description}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Category config
const CATEGORIES = [
  { id: "all", label: "All", color: "#00C2FF" },
  { id: "phones", label: "Phones", color: "#A855F7" },
  { id: "gaming", label: "Gaming", color: "#FF6B6B" },
  { id: "audio", label: "Audio", color: "#00D26A" },
  { id: "wearables", label: "Wearables", color: "#FFB800" },
  { id: "laptops", label: "Laptops", color: "#00C2FF" },
  { id: "tablets", label: "Tablets", color: "#FF8C42" },
  { id: "xr", label: "XR", color: "#E040FB" },
  { id: "home", label: "Home", color: "#26C6DA" },
];

// ── Main Auctions Page ──
const AuctionsPage = ({ onNavigate, isGuest, isDemoMode, onAuthRequired, onLogin, onRegister, onStartDemo }) => {
  const { t } = useI18n();
  const user = useUser();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [credits, setCredits] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const pollRef = useRef(null);

  const fetchAuctions = useCallback(async () => {
    try {
      const res = await api.getAuctions();
      setAuctions(res.auctions || []);
    } catch {}
  }, []);

  const fetchCredits = useCallback(async () => {
    if (isGuest) return;
    try {
      const res = await api.getBidCredits();
      setCredits(res.bid_credits || 0);
    } catch {}
  }, [isGuest]);

  useEffect(() => {
    Promise.all([fetchAuctions(), fetchCredits()]).then(() => setLoading(false));
    pollRef.current = setInterval(fetchAuctions, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchAuctions, fetchCredits]);

  if (selectedAuction) {
    return (
      <AuctionDetail
        auctionId={selectedAuction}
        onBack={() => { setSelectedAuction(null); fetchAuctions(); }}
        isGuest={isGuest}
        onAuthRequired={onAuthRequired}
        userCredits={credits}
        onCreditsChanged={setCredits}
      />
    );
  }

  const active = auctions.filter(a => a.status === "active" && (activeFilter === "all" || a.category === activeFilter));
  const ended = auctions.filter(a => a.status === "ended" && (activeFilter === "all" || a.category === activeFilter));
  const activeCategories = [...new Set(auctions.filter(a => a.status === "active").map(a => a.category).filter(Boolean))];

  return (
    <motion.div data-testid="auctions-page" className="min-h-screen relative" style={{ background: "#030303" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Ambient glow */}
      <motion.div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
        style={{ filter: "blur(140px)", background: "rgba(168,85,247,0.04)" }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button data-testid="auctions-back-btn"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }} onClick={() => onNavigate("/")}>
          <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">{t("auction.title")}</h1>
          <p className="text-[10px] text-[#444]">{t("auction.subtitle")}</p>
        </div>
        {!isGuest && (
          <motion.button data-testid="buy-credits-btn"
            onClick={() => setShowCreditsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.15)" }}
            whileTap={{ scale: 0.95 }}>
            <Coins size={12} className="text-[#FFB800]" />
            <span className="text-[12px] font-bold text-[#FFB800] tabular-nums">{credits}</span>
          </motion.button>
        )}
      </div>

      {isGuest && !isDemoMode && (
        <GuestCTABar onLogin={onLogin} onRegister={onRegister} onStartDemo={onStartDemo} isDemoMode={isDemoMode} />
      )}

      <div className="px-5 pb-8 relative z-10">
        {/* How it works */}
        <motion.div className="rounded-2xl p-4 mb-4"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <p className="text-[9px] text-[#444] uppercase tracking-wider font-semibold mb-2.5">{t("auction.how_it_works")}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Coins, text: t("auction.step_buy"), color: "#FFB800" },
              { icon: Zap, text: t("auction.step_bid"), color: "#00C2FF" },
              { icon: Trophy, text: t("auction.step_win"), color: "#00D26A" },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center"
                  style={{ background: `${step.color}0A`, border: `1px solid ${step.color}18` }}>
                  <step.icon size={14} style={{ color: step.color }} />
                </div>
                <p className="text-[10px] text-white/50 font-medium leading-tight">{step.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Category Filter Tabs */}
        <motion.div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-1 px-1 scrollbar-hide"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          {CATEGORIES.filter(c => c.id === "all" || activeCategories.includes(c.id)).map(cat => {
            const isActive = activeFilter === cat.id;
            return (
              <motion.button key={cat.id} data-testid={`filter-${cat.id}`}
                onClick={() => setActiveFilter(cat.id)}
                className="px-3 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
                style={{
                  background: isActive ? `${cat.color}15` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isActive ? `${cat.color}30` : "rgba(255,255,255,0.04)"}`,
                  color: isActive ? cat.color : "#555",
                }}
                whileTap={{ scale: 0.95 }}>
                {cat.label}
              </motion.button>
            );
          })}
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[#00C2FF]" />
          </div>
        ) : (
          <>
            {/* Active Auctions */}
            {active.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="flex items-center gap-2 mb-3">
                  <motion.div className="w-2 h-2 rounded-full bg-[#00D26A]"
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                  <p className="text-[9px] text-[#444] uppercase tracking-wider font-semibold">{t("auction.live_auctions")}</p>
                  <span className="text-[9px] text-[#00D26A] font-bold">{active.length}</span>
                </div>
                <div className="space-y-2.5 mb-6">
                  {active.map(auc => (
                    <AuctionCard key={auc.auction_id} auction={auc} onClick={() => setSelectedAuction(auc.auction_id)} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Ended Auctions */}
            {ended.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <p className="text-[9px] text-[#333] uppercase tracking-wider font-semibold mb-3">{t("auction.ended_auctions")}</p>
                <div className="space-y-2.5">
                  {ended.map(auc => (
                    <AuctionCard key={auc.auction_id} auction={auc} onClick={() => setSelectedAuction(auc.auction_id)} />
                  ))}
                </div>
              </motion.div>
            )}

            {auctions.length === 0 && (
              <div className="py-16 text-center">
                <Gavel size={28} className="text-[#222] mx-auto mb-3" />
                <p className="text-[13px] text-[#444] font-medium">{t("auction.no_auctions")}</p>
              </div>
            )}
          </>
        )}
      </div>

      <BuyCreditsModal
        open={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
        onPurchased={(res) => { setCredits(res.total_credits); }}
        balance={isGuest ? 0 : (user.balance || 0)}
      />
    </motion.div>
  );
};

export default AuctionsPage;
