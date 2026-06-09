import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gavel, Trophy, Timer, Package, Truck, Eye, Zap, Heart, Bot } from "lucide-react";
import { localized } from "./atoms";
import { getAuctionFallbackImage } from "./imageFallbacks";

function AuctionCardImage({ imageUrl, fallbackImage, title, isEnded }) {
  const [imageSrc, setImageSrc] = useState(imageUrl || fallbackImage);
  const [hideImage, setHideImage] = useState(false);

  if (hideImage) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Package size={44} className="text-white/5" />
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={title}
      className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${isEnded ? "opacity-25 grayscale" : ""}`}
      loading="lazy"
      onError={() => {
        if (imageSrc !== fallbackImage) setImageSrc(fallbackImage);
        else setHideImage(true);
      }}
    />
  );
}

export default function AuctionGridCard({ auction, onClick, t, idx, isWatched, onToggleWatch, lang = "de" }) {
  const isEnded = auction.status === "ended";
  const loc = localized(auction, lang);
  const [rem, setRem] = useState(0);
  const fallbackImage = getAuctionFallbackImage(auction);

  useEffect(() => {
    const calculate = () => setRem(Math.max(0, Math.floor((new Date(auction.ends_at) - Date.now()) / 1000)));
    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [auction.ends_at]);

  const isFinalBattle = rem > 0 && rem <= 60;
  const isEndingNow = rem > 0 && rem <= 20;
  const isHot = auction.total_bids > 10;
  const d = Math.floor(rem / 86400);
  const h = Math.floor((rem % 86400) / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const s = rem % 60;
  const logisticsLabel = auction.category === "marine" ? "ABHOLUNG / MARINA" : "FREE SHIPPING";
  const savePct = auction.retail_price > 0 ? Math.round(((auction.retail_price - auction.current_price) / auction.retail_price) * 100) : 0;
  const countdownLabel = isEnded
    ? "BEENDET"
    : d > 0
      ? `${d}T ${h}Std ${String(m).padStart(2, "0")}m`
      : h > 0
        ? `${h}Std ${String(m).padStart(2, "0")}m`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <motion.button
      data-testid={`auction-card-${auction.auction_id}`}
      onClick={onClick}
      className="w-full rounded-[26px] overflow-hidden text-left relative group"
      style={{
        background: "linear-gradient(180deg, rgba(12,16,28,0.98) 0%, rgba(8,12,22,0.99) 100%)",
        border: isFinalBattle ? "1px solid rgba(255,64,96,0.25)" : isHot ? "1px solid rgba(255,138,66,0.15)" : "1px solid rgba(255,255,255,0.05)",
        boxShadow: isFinalBattle ? "0 12px 36px rgba(255,64,96,0.12)" : "0 12px 36px rgba(0,0,0,0.28)",
      }}
      whileTap={{ scale: 0.985 }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.35 }}
    >
      {!isEnded && (
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] z-10"
          style={{
            background: isFinalBattle
              ? "linear-gradient(90deg, transparent 0%, #FF4060 20%, #FF6B8A 50%, #FF4060 80%, transparent 100%)"
              : isHot
                ? "linear-gradient(90deg, transparent 0%, #FF8C42 50%, transparent 100%)"
                : "linear-gradient(90deg, transparent 0%, rgba(0,224,255,0.6) 50%, transparent 100%)",
          }}
          animate={{ opacity: isFinalBattle ? [0.8, 1, 0.8] : [0.35, 0.8, 0.35] }}
          transition={{ duration: isFinalBattle ? 0.5 : 2, repeat: Infinity }}
        />
      )}

      <div className="relative w-full aspect-[1.18/1] overflow-hidden bg-gradient-to-b from-[#0a0e1a] to-[#060810]">
        <AuctionCardImage
          key={`${auction.auction_id}-${auction.image_url || fallbackImage}`}
          imageUrl={auction.image_url}
          fallbackImage={fallbackImage}
          title={loc.title}
          isEnded={isEnded}
        />

        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(4,6,16,0.18) 0%, rgba(4,6,16,0.05) 35%, rgba(4,6,16,0.65) 100%)" }} />

        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 z-10">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl backdrop-blur-md min-w-0 ${isFinalBattle ? "animate-pulse" : ""}`}
            style={{
              background: isFinalBattle ? "rgba(255,64,96,0.92)" : "rgba(0,0,0,0.72)",
              border: isFinalBattle ? "1px solid rgba(255,100,138,0.5)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Timer size={10} className={isFinalBattle ? "text-white" : "text-white/60"} />
            <span className={`text-[11px] font-mono font-bold tabular-nums truncate ${isFinalBattle ? "text-white" : "text-white/90"}`}>
              {countdownLabel}
            </span>
          </div>

          {!auction.bot_only && auction.total_bids > 0 && !isEnded && (
            <div
              className="flex items-center gap-1 px-2 py-1.5 rounded-2xl backdrop-blur-md shrink-0"
              style={{
                background: isHot ? "rgba(255,138,66,0.15)" : "rgba(0,0,0,0.6)",
                border: isHot ? "1px solid rgba(255,138,66,0.3)" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Gavel size={10} className={isHot ? "text-[#FF8C42]" : "text-white/50"} />
              <span className={`text-[11px] font-bold tabular-nums ${isHot ? "text-[#FF8C42]" : "text-white/70"}`}>{auction.total_bids}</span>
            </div>
          )}
        </div>

        {!isEnded && auction.viewer_count > 0 && (
          <div
            data-testid={`auction-viewers-${auction.auction_id}`}
            className="absolute top-[52px] left-2 flex items-center gap-1 px-2 py-1 rounded-xl backdrop-blur-md max-w-[54%] z-10"
            style={{ background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
            <Eye size={9} className="text-white/70" />
            <span className="text-[10px] font-bold tabular-nums text-white/90 truncate">{auction.viewer_count}</span>
          </div>
        )}

        {!isEnded && auction.bot_only && (
          <>
            <div
              data-testid={`auction-bot-badge-${auction.auction_id}`}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-xl backdrop-blur-md z-10"
              style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.92) 0%, rgba(99,102,241,0.92) 100%)",
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow: "0 2px 8px rgba(168,85,247,0.35)",
              }}
            >
              <Bot size={9} className="text-white" />
              <span className="text-[8px] font-black text-white tracking-wider uppercase leading-none">Bot</span>
            </div>
            {auction.total_bids > 0 && (
              <div className="absolute top-[52px] right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md backdrop-blur-md z-10" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Gavel size={8} className="text-white/50" />
                <span className="text-[9px] font-bold tabular-nums text-white/70">{auction.total_bids}</span>
              </div>
            )}
          </>
        )}

        {onToggleWatch && !isEnded && (
          <motion.div
            data-testid={`auction-watch-${auction.auction_id}`}
            role="button"
            tabIndex={0}
            aria-label={isWatched ? "Aus Merkliste entfernen" : "Auf Merkliste"}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md cursor-pointer z-20"
            style={{
              background: isWatched ? "rgba(255,64,96,0.25)" : "rgba(0,0,0,0.56)",
              border: `1px solid ${isWatched ? "rgba(255,64,96,0.4)" : "rgba(255,255,255,0.08)"}`,
              boxShadow: isWatched ? "0 0 20px rgba(255,64,96,0.2)" : "none",
            }}
            onClick={(e) => { e.stopPropagation(); onToggleWatch(auction.auction_id); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggleWatch(auction.auction_id); } }}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.04 }}
          >
            <Heart size={15} className={isWatched ? "text-[#FF4060]" : "text-white/45"} fill={isWatched ? "#FF4060" : "none"} />
          </motion.div>
        )}

        {!isEnded && !auction.bot_only && (
          <div
            data-testid={`auction-logistics-badge-${auction.auction_id}`}
            className="absolute bottom-2 left-2 right-[58px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl min-w-0 z-10"
            style={{ background: "linear-gradient(135deg, rgba(0,232,157,0.92) 0%, rgba(0,200,140,0.92) 100%)", boxShadow: "0 4px 12px rgba(0,232,157,0.25)" }}
          >
            <Truck size={10} className="text-white shrink-0" />
            <span className="text-[9px] font-bold text-white tracking-wide truncate">{logisticsLabel}</span>
          </div>
        )}

        {isEnded && auction.winner_name && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl z-10"
            style={{ background: "linear-gradient(135deg, rgba(255,209,102,0.95) 0%, rgba(255,180,60,0.95) 100%)", boxShadow: "0 4px 12px rgba(255,209,102,0.25)" }}
          >
            <Trophy size={10} className="text-black/80" />
            <span className="text-[9px] font-bold text-black/80 truncate max-w-[100px]">{auction.winner_name}</span>
          </div>
        )}

        {isFinalBattle && !isEnded && (
          <motion.div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center z-20" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div
              className="px-3 py-1.5 rounded-full"
              style={{ background: "linear-gradient(135deg, rgba(255,64,96,0.95) 0%, rgba(255,100,120,0.95) 100%)", boxShadow: "0 4px 20px rgba(255,64,96,0.4)" }}
              animate={{ scale: isEndingNow ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 0.4, repeat: isEndingNow ? Infinity : 0 }}
            >
              <span className="text-[10px] font-black text-white tracking-wider">{isEndingNow ? "⚡ ENDING NOW" : "🔥 FINAL BATTLE"}</span>
            </motion.div>
          </motion.div>
        )}
      </div>

      <div className="px-3.5 py-3.5 space-y-3">
        <h3 className={`text-[15px] sm:text-[16px] font-semibold leading-[1.08] line-clamp-2 min-h-[34px] ${isEnded ? "text-white/30" : "text-white/92"}`} data-testid={`auction-title-${auction.auction_id}`}>
          {loc.title}
        </h3>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <p className="text-[9px] text-white/28 uppercase tracking-[0.24em] font-bold mb-1">Preis</p>
            <div className="flex items-end gap-1">
              <span className="text-[10px] text-white/45 leading-none pb-1">€</span>
              <motion.span
                key={auction.current_price}
                className={`text-[28px] sm:text-[30px] font-black font-mono tabular-nums leading-none ${isEnded ? "text-white/30" : isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"}`}
                style={!isEnded ? { textShadow: isFinalBattle ? "0 0 20px rgba(255,64,96,0.3)" : "0 0 20px rgba(0,224,255,0.2)" } : {}}
                initial={{ scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {auction.current_price.toFixed(2)}
              </motion.span>
            </div>
          </div>

          {auction.retail_price > 0 && !isEnded && (
            <div className="text-right pb-1" data-testid={`auction-savings-${auction.auction_id}`}>
              <p className="text-[10px] text-white/25 line-through truncate">UVP €{auction.retail_price.toFixed(0)}</p>
              <p className="text-[15px] font-black text-[#00E89D] leading-none">-{savePct}%</p>
            </div>
          )}
        </div>

        {!isEnded && !auction.bot_only ? (
          <motion.div
            className="flex items-center justify-center gap-2 py-3 rounded-2xl cursor-pointer min-h-[48px]"
            style={{
              background: isFinalBattle
                ? "linear-gradient(135deg, rgba(255,64,96,0.15) 0%, rgba(255,64,96,0.08) 100%)"
                : "linear-gradient(135deg, rgba(0,224,255,0.12) 0%, rgba(0,224,255,0.06) 100%)",
              border: `1px solid ${isFinalBattle ? "rgba(255,64,96,0.25)" : "rgba(0,224,255,0.2)"}`,
            }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap size={15} className={isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"} />
            <span className={`text-[14px] sm:text-[14px] font-bold ${isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"}`}>
              {t("auction.bid_now")} +0,01
            </span>
          </motion.div>
        ) : !isEnded ? (
          <div
            className="flex items-center justify-center gap-1.5 py-3 rounded-2xl min-h-[48px]"
            style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(99,102,241,0.05) 100%)", border: "1px solid rgba(168,85,247,0.20)" }}
          >
            <Eye size={14} className="text-[#A855F7]" />
            <span className="text-[12px] font-bold text-[#A855F7] text-center">Zuschauen — nur Bots bieten</span>
          </div>
        ) : null}
      </div>
    </motion.button>
  );
}