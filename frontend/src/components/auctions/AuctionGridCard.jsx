import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gavel, Trophy, Timer, Package, Truck, Eye, Zap, Heart, Bot } from "lucide-react";
import { localized } from "./atoms";

/**
 * AuctionGridCard — DealDash-style premium grid card with timer, bid count,
 * viewer counter, watchlist heart (non-button to avoid nested-button hydration).
 */
export default function AuctionGridCard({ auction, onClick, t, idx, isWatched, onToggleWatch, lang = "de" }) {
  const isEnded = auction.status === "ended";
  const loc = localized(auction, lang);
  const [rem, setRem] = useState(0);
  useEffect(() => {
    const c = () => setRem(Math.max(0, Math.floor((new Date(auction.ends_at) - Date.now()) / 1000)));
    c(); const iv = setInterval(c, 1000); return () => clearInterval(iv);
  }, [auction.ends_at]);

  const isFinalBattle = rem > 0 && rem <= 60;
  const isEndingNow = rem > 0 && rem <= 20;
  const isHot = auction.total_bids > 10;
  const d = Math.floor(rem / 86400), h = Math.floor((rem % 86400) / 3600), m = Math.floor((rem % 3600) / 60), s = rem % 60;
  
  // Calculate savings percentage
  const savePct = auction.retail_price > 0 ? Math.round(((auction.retail_price - auction.current_price) / auction.retail_price) * 100) : 0;

  return (
    <motion.button data-testid={`auction-card-${auction.auction_id}`} onClick={onClick}
      className="w-full rounded-2xl overflow-hidden text-left relative group"
      style={{ 
        background: "linear-gradient(180deg, rgba(12,16,28,0.95) 0%, rgba(8,12,22,0.98) 100%)", 
        border: isFinalBattle ? "1px solid rgba(255,64,96,0.25)" : isHot ? "1px solid rgba(255,138,66,0.15)" : "1px solid rgba(255,255,255,0.04)",
        boxShadow: isFinalBattle ? "0 8px 32px rgba(255,64,96,0.12), inset 0 1px 0 rgba(255,255,255,0.03)" : "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)"
      }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04, duration: 0.35 }}>
      
      {/* Premium top glow line */}
      {!isEnded && (
        <motion.div className="absolute top-0 left-0 right-0 h-[2px] z-10"
          style={{ 
            background: isFinalBattle 
              ? "linear-gradient(90deg, transparent 0%, #FF4060 20%, #FF6B8A 50%, #FF4060 80%, transparent 100%)" 
              : isHot 
                ? "linear-gradient(90deg, transparent 0%, #FF8C42 50%, transparent 100%)"
                : "linear-gradient(90deg, transparent 0%, rgba(0,224,255,0.6) 50%, transparent 100%)"
          }}
          animate={{ opacity: isFinalBattle ? [0.8, 1, 0.8] : [0.4, 0.8, 0.4] }} 
          transition={{ duration: isFinalBattle ? 0.5 : 2, repeat: Infinity }} />
      )}

      {/* Image Section with Premium Overlay */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-gradient-to-b from-[#0a0e1a] to-[#060810]">
        {auction.image_url ? (
          <img 
            src={auction.image_url} 
            alt={loc.title} 
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${isEnded ? "opacity-25 grayscale" : ""}`} 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={40} className="text-white/5" />
          </div>
        )}
        
        {/* Subtle vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ 
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(4,6,16,0.6) 100%)" 
        }} />

        {/* Premium Timer Badge — Top Left */}
        <div className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md ${isFinalBattle ? "animate-pulse" : ""}`}
          style={{ 
            background: isFinalBattle ? "rgba(255,64,96,0.9)" : "rgba(0,0,0,0.7)", 
            border: isFinalBattle ? "1px solid rgba(255,100,138,0.5)" : "1px solid rgba(255,255,255,0.08)",
            boxShadow: isFinalBattle ? "0 4px 16px rgba(255,64,96,0.3)" : "0 4px 12px rgba(0,0,0,0.3)"
          }}>
          <Timer size={10} className={isFinalBattle ? "text-white" : "text-white/60"} />
          <span className={`text-[11px] font-mono font-bold tabular-nums ${isFinalBattle ? "text-white" : "text-white/90"}`}>
            {isEnded ? "ENDED" : d > 0 ? `${d}T ${h}Std ${String(m).padStart(2,"0")}m` : h > 0 ? `${h}Std ${String(m).padStart(2,"0")}m` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
          </span>
        </div>

        {/* Bid Count Badge — Top Right (hidden when Bot badge occupies this spot) */}
        {auction.total_bids > 0 && !isEnded && !auction.bot_only && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1.5 rounded-xl backdrop-blur-md"
            style={{ 
              background: isHot ? "rgba(255,138,66,0.15)" : "rgba(0,0,0,0.6)", 
              border: isHot ? "1px solid rgba(255,138,66,0.3)" : "1px solid rgba(255,255,255,0.06)" 
            }}>
            <Gavel size={10} className={isHot ? "text-[#FF8C42]" : "text-white/50"} />
            <span className={`text-[11px] font-bold tabular-nums ${isHot ? "text-[#FF8C42]" : "text-white/70"}`}>{auction.total_bids}</span>
          </div>
        )}

        {/* Bid Count on Bot auctions — show next to Bot badge (slightly lower) */}
        {auction.total_bids > 0 && !isEnded && auction.bot_only && (
          <div className="absolute top-9 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md backdrop-blur-md z-10"
            style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Gavel size={8} className="text-white/50" />
            <span className="text-[9px] font-bold tabular-nums text-white/70">{auction.total_bids}</span>
          </div>
        )}

        {/* Live Viewer Counter — Top Left below timer */}
        {!isEnded && auction.viewer_count > 0 && (
          <div data-testid={`auction-viewers-${auction.auction_id}`}
               className="absolute top-12 left-2.5 flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-md"
               style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <Eye size={9} className="text-white/70" />
            <span className="text-[10px] font-bold tabular-nums text-white/90">{auction.viewer_count}</span>
          </div>
        )}

        {/* Watchlist Heart — single instance (non-button to avoid nested-button hydration error) */}
        {onToggleWatch && !isEnded && (
          <motion.div data-testid={`auction-watch-${auction.auction_id}`}
            role="button"
            tabIndex={0}
            aria-label={isWatched ? "Aus Merkliste entfernen" : "Auf Merkliste"}
            className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md cursor-pointer z-20"
            style={{
              background: isWatched ? "rgba(255,64,96,0.25)" : "rgba(0,0,0,0.5)",
              border: `1px solid ${isWatched ? "rgba(255,64,96,0.4)" : "rgba(255,255,255,0.08)"}`,
              boxShadow: isWatched ? "0 0 20px rgba(255,64,96,0.2)" : "none",
            }}
            onClick={(e) => { e.stopPropagation(); onToggleWatch(auction.auction_id); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggleWatch(auction.auction_id); } }}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.1 }}>
            <Heart size={14} className={isWatched ? "text-[#FF4060]" : "text-white/40"} fill={isWatched ? "#FF4060" : "none"} />
          </motion.div>
        )}

        {/* Bot-Only Badge — small, top-right below bid count (or alone) */}
        {!isEnded && auction.bot_only && (
          <div data-testid={`auction-bot-badge-${auction.auction_id}`}
            className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-1 rounded-md backdrop-blur-md z-10"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.92) 0%, rgba(99,102,241,0.92) 100%)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 2px 8px rgba(168,85,247,0.35)"
            }}>
            <Bot size={9} className="text-white" />
            <span className="text-[8px] font-black text-white tracking-wider uppercase leading-none">Bot</span>
          </div>
        )}

        {/* Free Shipping Badge — Bottom Left (hidden for bot-only auctions) */}
        {!isEnded && !auction.bot_only && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
            style={{ 
              background: "linear-gradient(135deg, rgba(0,232,157,0.9) 0%, rgba(0,200,140,0.9) 100%)", 
              boxShadow: "0 4px 12px rgba(0,232,157,0.25)"
            }}>
            <Truck size={10} className="text-white" />
            <span className="text-[9px] font-bold text-white tracking-wide">FREE SHIPPING</span>
          </div>
        )}

        {/* Winner Badge for Ended Auctions */}
        {isEnded && auction.winner_name && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
            style={{ 
              background: "linear-gradient(135deg, rgba(255,209,102,0.95) 0%, rgba(255,180,60,0.95) 100%)",
              boxShadow: "0 4px 12px rgba(255,209,102,0.25)"
            }}>
            <Trophy size={10} className="text-black/80" />
            <span className="text-[9px] font-bold text-black/80 truncate max-w-[80px]">{auction.winner_name}</span>
          </div>
        )}

        {/* Final Battle Overlay */}
        {isFinalBattle && !isEnded && (
          <motion.div className="absolute inset-x-0 top-12 flex justify-center z-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}>
            <motion.div className="px-3 py-1.5 rounded-full"
              style={{ 
                background: "linear-gradient(135deg, rgba(255,64,96,0.95) 0%, rgba(255,100,120,0.95) 100%)",
                boxShadow: "0 4px 20px rgba(255,64,96,0.4)"
              }}
              animate={{ scale: isEndingNow ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 0.4, repeat: isEndingNow ? Infinity : 0 }}>
              <span className="text-[10px] font-black text-white tracking-wider">
                {isEndingNow ? "⚡ ENDING NOW" : "🔥 FINAL BATTLE"}
              </span>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Content Section — Compact Mobile Layout */}
      <div className="px-3 py-2.5 space-y-2">
        {/* Product Title */}
        <h3 className={`text-[12px] font-semibold leading-tight line-clamp-2 min-h-[32px] ${isEnded ? "text-white/30" : "text-white/90"}`}>
          {loc.title}
        </h3>
        
        {/* Price + UVP */}
        <div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[7px] text-white/25 uppercase tracking-widest font-bold mb-0.5">PREIS</p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[7px] text-white/40">€</span>
                <motion.span 
                  key={auction.current_price}
                  className={`text-[22px] font-black font-mono tabular-nums leading-none ${isEnded ? "text-white/30" : isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"}`}
                  style={!isEnded ? { textShadow: isFinalBattle ? "0 0 20px rgba(255,64,96,0.3)" : "0 0 20px rgba(0,224,255,0.2)" } : {}}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}>
                  {auction.current_price.toFixed(2)}
                </motion.span>
              </div>
            </div>
            {auction.retail_price > 0 && !isEnded && (
              <div className="text-right pb-0.5">
                <p className="text-[9px] text-white/20 line-through">UVP €{auction.retail_price.toFixed(0)}</p>
                <p className="text-[11px] font-black text-[#00E89D]">-{savePct}%</p>
              </div>
            )}
          </div>
        </div>

        {/* Bid Button (hidden for bot-only — spectator mode) */}
        {!isEnded && !auction.bot_only && (
          <motion.div 
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl cursor-pointer"
            style={{ 
              background: isFinalBattle 
                ? "linear-gradient(135deg, rgba(255,64,96,0.15) 0%, rgba(255,64,96,0.08) 100%)" 
                : "linear-gradient(135deg, rgba(0,224,255,0.12) 0%, rgba(0,224,255,0.06) 100%)",
              border: `1px solid ${isFinalBattle ? "rgba(255,64,96,0.25)" : "rgba(0,224,255,0.2)"}`,
            }}
            whileTap={{ scale: 0.97 }}>
            <Zap size={13} className={isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"} />
            <span className={`text-[11px] font-bold ${isFinalBattle ? "text-[#FF4060]" : "text-[#00E0FF]"}`}>
              {t("auction.bid_now")} +0,01
            </span>
          </motion.div>
        )}

        {/* Bot-only spectator indicator */}
        {!isEnded && auction.bot_only && (
          <div
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(99,102,241,0.05) 100%)",
              border: "1px solid rgba(168,85,247,0.20)",
            }}>
            <Eye size={13} className="text-[#A855F7]" />
            <span className="text-[10px] font-bold text-[#A855F7]">Zuschauen — nur Bots bieten</span>
          </div>
        )}
      </div>
    </motion.button>
  );
}
