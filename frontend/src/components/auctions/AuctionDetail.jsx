import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, ChevronRight, Coins, Loader2, X, User,
  Trophy, ShieldCheck, Timer, Truck, Globe, Check, Shield,
  Flame, Gift, Bot, AlertTriangle, Users, Sparkles, Eye, Gavel,
  Clock, TrendingUp, Wallet, Package,
} from "lucide-react";
import { useUser, useI18n } from "../../store";
import { api } from "../../services/api";
import GuestCTABar from "../GuestCTABar";
import Countdown from "./Countdown";
import BuyCreditsModal from "./BuyCreditsModal";
import { POLL_MS, glass, panelBg, panelBorder, accentCyan, accentGreen, accentGold, accentRed, accentPurple } from "./atoms";
import { getAuctionFallbackImage } from "./imageFallbacks";

/* ─── BidRow (local to AuctionDetail) ─── */
const BidRow = ({ bid, isLatest }) => (
  <motion.div className={`flex items-center justify-between py-2 px-3 ${isLatest ? "bg-[#00E0FF]/[0.02]" : ""}`}
    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: isLatest ? "rgba(0,224,255,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${isLatest ? "rgba(0,224,255,0.12)" : "rgba(255,255,255,0.03)"}` }}>
        {bid.is_auto ? <Bot size={8} className={isLatest ? "text-[#B068FF]" : "text-white/20"} /> : <User size={8} className={isLatest ? "text-[#00E0FF]" : "text-white/20"} />}
      </div>
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold truncate ${isLatest ? "text-white/80" : "text-white/35"}`}>{bid.user_name}</p>
        <p className="text-[9px] text-white/20">{new Date(bid.created_at).toLocaleTimeString()}</p>
      </div>
    </div>
    <span className={`font-mono font-bold tabular-nums text-[12px] ${isLatest ? "text-[#00E0FF]" : "text-white/40"}`}>€{bid.bid_price.toFixed(2)}</span>
  </motion.div>
);

/* ─── AutoBidModal (local to AuctionDetail) ─── */
const AutoBidModal = ({ open, onClose, auctionId, onSet }) => {
  const { t } = useI18n();
  const [maxBids, setMaxBids] = useState(10);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { await api.setAutoBid(auctionId, maxBids); onSet(maxBids); onClose(); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  if (!open) return null;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <motion.div className={`relative w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl p-5 ${glass}`}
        style={{ background: panelBg, border: panelBorder }} initial={{ y: 40 }} animate={{ y: 0 }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[13px] font-bold text-white/80 font-outfit">{t("auction.auto_bid_title")}</h3>
          <motion.button data-testid="auto-bid-close" onClick={onClose} whileTap={{ scale: 0.9 }} className="w-7 h-7 rounded-full bg-white/[0.03] flex items-center justify-center"><X size={12} className="text-white/40" /></motion.button>
        </div>
        <p className="text-[10px] text-white/30 mb-4">{t("auction.auto_bid_desc")}</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[5, 10, 20, 50].map(v => (
            <motion.button key={v} onClick={() => setMaxBids(v)}
              className={`py-2 rounded-lg text-[13px] font-bold transition-colors ${maxBids === v ? "bg-[#B068FF]/8 text-[#B068FF] border border-[#B068FF]/15" : "bg-white/[0.02] text-white/30 border border-white/[0.04]"}`}
              whileTap={{ scale: 0.95 }}>{v}</motion.button>
          ))}
        </div>
        <motion.button data-testid="auto-bid-confirm" onClick={submit} disabled={saving}
          className="w-full py-3 rounded-xl text-[12px] font-bold bg-[#B068FF]/10 border border-[#B068FF]/20 text-[#B068FF] flex items-center justify-center gap-2 disabled:opacity-30"
          whileTap={{ scale: 0.97 }}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />} {t("auction.activate")}
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default function AuctionDetail({ auctionId, onBack, isGuest, onAuthRequired, userCredits, onCreditsChanged, onBuyCredits, onNavigate }) {
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
  const [showLocalCredits, setShowLocalCredits] = useState(false);
  const pollRef = useRef(null);
  const fallbackImage = getAuctionFallbackImage(auction || {});
  const [detailImage, setDetailImage] = useState("");
  const [hideDetailImage, setHideDetailImage] = useState(false);
  const galleryImages = Array.from(new Set((auction?.image_urls?.length ? auction.image_urls : [auction?.image_url]).filter(Boolean)));

  useEffect(() => {
    setHideDetailImage(false);
    setDetailImage(galleryImages[0] || auction?.image_url || fallbackImage);
  }, [auction?.image_url, auction?.image_urls, auction?.title, auction?.category, fallbackImage, galleryImages]);

  const fetch = useCallback(async () => {
    try {
      const r = await api.getAuction(auctionId);
      setAuction(r.auction); setBids(r.bids || []); setUniqueBidders(r.unique_bidders || 0);
    } catch (error) { void error; }
  }, [auctionId]);

  const fetchAutoBid = useCallback(async () => {
    if (isGuest) return;
    try { const r = await api.getAutoBid(auctionId); setAutoBid(r); } catch (error) { void error; }
  }, [auctionId, isGuest]);

  useEffect(() => {
    Promise.all([fetch(), fetchAutoBid()]).then(() => setLoading(false));
    pollRef.current = setInterval(fetch, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetch, fetchAutoBid]);

  const handleBid = async () => {
    if (isGuest) { onAuthRequired(); return; }
    if (userCredits < 1) {
      // Zeige Fehler + öffne Credits-Kauf-Modal automatisch
      setBidMsg({ ok: false, text: t("auction.no_credits") });
      setTimeout(() => {
        setShowLocalCredits(true); // Öffnet Credits-Kauf-Modal
      }, 800);
      return;
    }
    setBidding(true); setBidMsg(null);
    try {
      const r = await api.placeBid({ auction_id: auctionId });
      setAuction(p => ({ ...p, current_price: r.new_price, ends_at: r.ends_at, total_bids: r.total_bids, last_bidder_id: user.id, last_bidder_name: user.name }));
      setBids(p => [{ bid_id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, user_name: user.name, bid_price: r.new_price, created_at: new Date().toISOString() }, ...p].slice(0, 30));
      onCreditsChanged(r.remaining_credits);
    } catch (e) { setBidMsg({ ok: false, text: e.message }); }
    setBidding(false);
  };

  const cancelAuto = async () => {
    try { await api.cancelAutoBid(auctionId); setAutoBid({ active: false }); } catch (error) { void error; }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#040610" }}><Loader2 size={20} className="animate-spin text-[#00E0FF]" /></div>;
  if (!auction) return null;
  const isActive = auction.status === "active";
  const isEnded = auction.status === "ended";
  const isLeading = isActive && auction.last_bidder_id === user?.id;
  const isOutbid = isActive && auction.last_bidder_id && auction.last_bidder_id !== user?.id && bids.some(b => b.user_id === user?.id || b.user_name === user?.name);
  const savePct = auction.retail_price > 0 ? Math.round(((auction.retail_price - auction.current_price) / auction.retail_price) * 100) : 0;
  const logisticsLabel = auction.category === "marine" ? "ÜBERGABE NACH ABSPRACHE" : "FREE WORLDWIDE SHIPPING";

  return (
    <motion.div className="min-h-screen" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="auction-detail" data-scroll-page="true">
      {/* Hero Image */}
      <div className="relative w-full aspect-[16/10] max-h-[300px] overflow-hidden">
        {!hideDetailImage ? <img src={detailImage} alt={auction.title || ''} className={`w-full h-full object-cover ${isEnded ? "opacity-30 grayscale" : ""}`} onError={() => { if (detailImage !== fallbackImage) setDetailImage(fallbackImage); else setHideDetailImage(true); }} /> : <div className="w-full h-full bg-[#060810]" />}
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
        <div data-testid="auction-detail-logistics-badge" className="absolute bottom-12 left-4 flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-xl bg-[#00E89D]/70 border border-[#00E89D]/25">
          <Truck size={9} className="text-white" /><span className="text-[8px] font-bold text-white tracking-wider">{logisticsLabel}</span>
        </div>
        <div className="absolute bottom-12 right-4 flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-xl bg-[#060810]/60 border border-[#00E89D]/15">
          <ShieldCheck size={8} className="text-[#00E89D]" /><span className="text-[8px] font-semibold text-[#00E89D]">{auction.condition || "Brand New"}</span>
        </div>
      </div>

      <div className="px-5 -mt-5 pb-40 relative z-10 space-y-3">
        {galleryImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" data-testid="auction-detail-gallery">
            {galleryImages.map((img, idx) => {
              const active = img === detailImage;
              return (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  data-testid={`auction-detail-gallery-image-${idx}`}
                  onClick={() => { setHideDetailImage(false); setDetailImage(img); }}
                  className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden border transition-all"
                  style={{
                    borderColor: active ? "rgba(0,224,255,0.55)" : "rgba(255,255,255,0.08)",
                    boxShadow: active ? "0 0 0 1px rgba(0,224,255,0.18)" : "none",
                    background: "rgba(8,12,20,0.9)",
                  }}
                >
                  <img src={img} alt={`${auction.title || "auction"} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>
        )}
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

        {/* Bot-Only: Hide bid buttons — humans are spectators */}
        {isActive && auction.bot_only && (
          <motion.div data-testid="auction-bot-only-notice"
            className="rounded-2xl p-4 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(99,102,241,0.04) 100%)",
              border: "1px solid rgba(168,85,247,0.20)",
            }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Bot size={22} className="text-[#A855F7] mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#A855F7] mb-0.5">Bot-Auktion</p>
            <p className="text-[10px] text-white/50">
              Nur Bots dürfen hier bieten. Schau zu, wie der Preis sich entwickelt!
            </p>
          </motion.div>
        )}

        {/* KYC Banner — show BEFORE bid attempt if KYC not approved */}
        {isActive && !auction.bot_only && !isGuest && user.kyc_status !== "approved" && user.role !== "admin" && (
          <motion.div
            data-testid="kyc-required-banner"
            className="px-4 py-3 rounded-2xl text-center mb-2"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(217,119,6,0.05) 100%)",
              border: "1px solid rgba(245,158,11,0.30)",
            }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          >
            <ShieldCheck size={18} className="text-[#F59E0B] mx-auto mb-1.5" />
            <p className="text-[12px] font-bold text-[#F59E0B] mb-0.5">Identität verifizieren</p>
            <p className="text-[10px] text-white/60 mb-2">
              Um an Auktionen teilzunehmen, musst du dich einmalig verifizieren (~2 Min).
            </p>
            <button
              data-testid="kyc-verify-btn"
              onClick={() => onNavigate?.("/profile/kyc") || (window.location.href = "/profile/kyc")}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#F59E0B] text-black hover:bg-[#FBBF24] transition-colors"
            >
              Jetzt verifizieren →
            </button>
          </motion.div>
        )}

        {/* Bid + Auto-Bid Buttons */}
        {isActive && !auction.bot_only && (
          <motion.div className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <AnimatePresence>{bidMsg && <motion.div className="px-3 py-2 rounded-xl text-[10px] font-medium bg-[#FF4060]/6 text-[#FF4060] border border-[#FF4060]/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{bidMsg.text}</motion.div>}</AnimatePresence>
            <motion.button data-testid="place-bid-btn" onClick={handleBid} disabled={bidding}
              className="w-full py-3.5 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 relative overflow-hidden"
              style={{ 
                background: userCredits < 1 
                  ? `linear-gradient(135deg, ${accentRed}, #CC0033)` 
                  : `linear-gradient(135deg, ${accentCyan}, #0090BB)`, 
                boxShadow: userCredits < 1 
                  ? `0 4px 24px rgba(255,64,96,0.25), inset 0 1px 0 rgba(255,255,255,0.08)`
                  : `0 4px 24px rgba(0,224,255,0.2), inset 0 1px 0 rgba(255,255,255,0.08)` 
              }}
              whileTap={{ scale: 0.97 }}>
              <motion.div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} />
              {bidding ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : userCredits < 1 ? (
                <><Wallet size={16} className="text-white" /><span className="text-white relative z-10">Credits kaufen</span></>
              ) : (
                <><Zap size={16} className="text-white" /><span className="text-white relative z-10">{t("auction.place_bid")} (1 Credit)</span></>
              )}
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
            ) : bids.slice(0, 12).map((b, i) => <BidRow key={`bid-${b.bid_id || `fb-${i}`}`} bid={b} isLatest={i === 0} />)}
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
      <BuyCreditsModal open={showLocalCredits} onClose={() => setShowLocalCredits(false)}
        onPurchased={(r) => { onCreditsChanged?.(r.total_credits); setShowLocalCredits(false); }}
        balance={isGuest ? 0 : (user?.balance || 0)} />
    </motion.div>
  );
}
