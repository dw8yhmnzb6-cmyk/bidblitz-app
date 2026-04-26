/**
 * LotteryPage - Tägliche BLZ-Lotterie mit echten Sachpreisen
 * Backend: /api/lottery/current, /api/lottery/buy-tickets, /api/lottery/my-tickets
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Ticket, Loader2, Trophy, Sparkles, Clock, Gift, X, Star
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const TIER_STYLES = {
  grand: { color: "#FFD700", gradient: "linear-gradient(135deg,#FFD700,#FFA500)", emoji: "💎", glow: "rgba(255,215,0,0.4)" },
  big:   { color: "#A855F7", gradient: "linear-gradient(135deg,#A855F7,#EC4899)", emoji: "🏆", glow: "rgba(168,85,247,0.35)" },
  small: { color: "#00C2FF", gradient: "linear-gradient(135deg,#00C2FF,#0EA5E9)", emoji: "🎁", glow: "rgba(0,194,255,0.3)" },
  mini:  { color: "#00D26A", gradient: "linear-gradient(135deg,#00D26A,#10B981)", emoji: "✨", glow: "rgba(0,210,106,0.3)" },
};

function useCountdownToMidnight() {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const mid = new Date(now);
      mid.setUTCHours(24, 0, 0, 0);
      const d = mid - now;
      const h = Math.floor(d / 3_600_000);
      const m = Math.floor((d % 3_600_000) / 60_000);
      const s = Math.floor((d % 60_000) / 1000);
      setLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return left;
}

export default function LotteryPage({ onBack }) {
  const [data, setData] = useState(null);
  const [myDraws, setMyDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState(null); // { tier, item }
  const countdown = useCountdownToMidnight();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [curRes, mineRes] = await Promise.all([
        fetch(`${API}/api/lottery/current`, { credentials: "include" }),
        fetch(`${API}/api/lottery/my-tickets`, { credentials: "include" }),
      ]);
      const cur = await curRes.json();
      const mine = await mineRes.json();
      setData(cur);
      setMyDraws(mine.draws || []);
    } catch (err) {
      // Suppress iOS Safari "Body is disturbed or locked" transient errors silently
      const msg = String(err?.message || "");
      if (!/disturbed|locked|body/i.test(msg)) {
        toast.error("Fehler beim Laden");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const buy = async () => {
    setBuying(true);
    try {
      const r = await fetch(`${API}/api/lottery/buy-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantity: qty }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      toast.success(`${j.tickets_bought} Los(e) gekauft — ${j.cost} BLZ`);
      setQty(1);
      await load();
    } catch (e) {
      toast.error(e.message || "Kauf fehlgeschlagen");
    }
    setBuying(false);
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 size={22} className="animate-spin text-white/40" />
      </div>
    );
  }

  const draw = data.draw || {};
  const price = data.ticket_price_blz;
  const pool = data.prize_pool || {};
  const total = price * qty;

  // Total Sachwert in EUR (alle Sachpreise summiert)
  const totalValueEur = Object.values(pool).reduce((sum, tier) => {
    const items = tier.items || [];
    if (!items.length) return sum;
    // Durchschnittswert pro Item × Anzahl Gewinne
    const avg = items.reduce((a, it) => a + (it.value_eur || 0), 0) / items.length;
    return sum + avg * (tier.count_per_draw || 0);
  }, 0);

  return (
    <div data-testid="lottery-page" className="min-h-screen pb-24"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(168,85,247,0.22), transparent 50%), #050505" }}>
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#050505]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button onClick={onBack} data-testid="lottery-back"
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}>
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <h1 className="text-[14px] font-bold text-white">BLZ Lotterie</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Hero: Heutiger Sachwert + Countdown */}
        <motion.div
          data-testid="lottery-hero"
          className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#A855F7 0%,#EC4899 100%)" }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        >
          <Sparkles size={32} className="mx-auto text-white mb-2" />
          <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em]">Heutiger Sachpreis-Pool</p>
          <p className="text-[44px] font-black text-white leading-none mt-2 font-outfit tabular-nums">
            ~{Math.round(totalValueEur).toLocaleString("de-DE")}€
          </p>
          <p className="text-[12px] font-bold text-white/90 mt-1">an echten Sachpreisen</p>
          <div className="flex items-center justify-center gap-2 mt-4 bg-black/25 rounded-full py-2 px-4 inline-flex">
            <Clock size={12} className="text-white" />
            <p className="text-[11px] font-bold text-white">Ziehung in {countdown}</p>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div>
              <p className="text-[20px] font-black text-white tabular-nums">{draw.ticket_count || 0}</p>
              <p className="text-[9px] text-white/70 uppercase">Verkauft</p>
            </div>
            <div>
              <p className="text-[20px] font-black text-white tabular-nums">{price}</p>
              <p className="text-[9px] text-white/70 uppercase">BLZ / Los</p>
            </div>
          </div>
        </motion.div>

        {/* WAS KANNST DU GEWINNEN? — Prominent oben */}
        <div data-testid="lottery-prize-showcase">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={16} className="text-amber-400" />
            <h2 className="text-[13px] font-black text-white uppercase tracking-wider">
              Das kannst du gewinnen
            </h2>
          </div>

          <div className="space-y-4">
            {Object.entries(pool).map(([tierKey, tier]) => {
              const style = TIER_STYLES[tierKey] || TIER_STYLES.mini;
              const items = tier.items || [];
              return (
                <div key={tierKey} data-testid={`lottery-tier-${tierKey}`}>
                  {/* Tier Header */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[18px]">{style.emoji}</span>
                      <div>
                        <p className="text-[12px] font-black text-white uppercase tracking-wider">
                          {tier.label_de || tierKey}
                        </p>
                        <p className="text-[10px] text-white/50">
                          {tier.count_per_draw}× pro Ziehung
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-black tabular-nums" style={{ color: style.color }}>
                        +{tier.blz?.toLocaleString("de-DE")} BLZ
                      </p>
                      <p className="text-[9px] text-white/40 uppercase">Bonus</p>
                    </div>
                  </div>

                  {/* Items horizontal scroll */}
                  <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
                       style={{ scrollbarWidth: "none" }}>
                    {items.map((item, idx) => (
                      <motion.button
                        key={idx}
                        data-testid={`lottery-prize-${tierKey}-${idx}`}
                        onClick={() => setSelectedPrize({ tier: tierKey, tierData: tier, item, style })}
                        whileTap={{ scale: 0.96 }}
                        className="flex-shrink-0 w-[160px] rounded-2xl overflow-hidden text-left snap-start"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${style.color}30`,
                          boxShadow: `0 4px 20px ${style.glow}`,
                        }}
                      >
                        <div className="relative w-full h-[110px] overflow-hidden bg-white/5">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black"
                               style={{ background: style.gradient, color: "#000" }}>
                            {item.value_eur}€
                          </div>
                        </div>
                        <div className="p-2.5">
                          <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 min-h-[28px]">
                            {item.name}
                          </p>
                          <p className="text-[9px] text-white/40 mt-1">Tippen für Details</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buy Tickets */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider mb-3">
            Lose kaufen
          </p>
          <div className="flex items-center gap-3 mb-3">
            <motion.button
              data-testid="lottery-qty-minus"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white font-bold"
              whileTap={{ scale: 0.92 }}>−</motion.button>
            <div className="flex-1 text-center">
              <p className="text-[32px] font-black text-white tabular-nums font-outfit leading-none">{qty}</p>
              <p className="text-[10px] text-white/50 mt-1">Los{qty > 1 ? "e" : ""}</p>
            </div>
            <motion.button
              data-testid="lottery-qty-plus"
              onClick={() => setQty(Math.min(100, qty + 1))}
              className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white font-bold"
              whileTap={{ scale: 0.92 }}>+</motion.button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {[1, 5, 10, 25].map((n) => (
              <button
                key={n}
                data-testid={`lottery-quick-${n}`}
                onClick={() => setQty(n)}
                className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                  qty === n ? "bg-[#A855F7] text-white" : "bg-white/[0.04] text-white/70 border border-white/[0.06]"
                }`}
              >
                {n} × {price} BLZ
              </button>
            ))}
          </div>
          <motion.button
            data-testid="lottery-buy-btn"
            onClick={buy}
            disabled={buying}
            className="w-full py-4 rounded-2xl font-black text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}
            whileTap={{ scale: 0.97 }}
          >
            {buying ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
            {buying ? "Kauf läuft..." : `Kaufen für ${total} BLZ`}
          </motion.button>
          <p className="text-center text-[10px] text-white/40 mt-2">
            Jedes Los = 1 Chance auf alle oben gezeigten Preise
          </p>
        </div>

        {/* My Tickets History */}
        {myDraws.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={13} className="text-amber-400" />
              <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Meine Lose</h2>
            </div>
            <div className="space-y-1.5">
              {myDraws.map((d) => {
                const winTotal = (d.winners || []).reduce((a, w) => a + (w.prize_blz || 0), 0);
                return (
                  <div key={d.draw_date}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between"
                    data-testid={`lottery-draw-${d.draw_date}`}>
                    <div>
                      <p className="text-[12px] font-bold text-white">
                        {new Date(d.draw_date).toLocaleDateString("de-DE")}
                      </p>
                      <p className="text-[9px] text-white/40">
                        {d.my_tickets} Los(e) · {d.status === "closed" ? "Gezogen" : "Offen"}
                      </p>
                    </div>
                    <div className="text-right">
                      {winTotal > 0 ? (
                        <>
                          <p className="text-[13px] font-bold text-[#FFD700]">+{winTotal} BLZ</p>
                          <p className="text-[9px] text-[#FFD700]/70 uppercase">Gewonnen!</p>
                        </>
                      ) : d.status === "closed" ? (
                        <p className="text-[11px] text-white/40">Nicht gewonnen</p>
                      ) : (
                        <p className="text-[11px] text-[#00C2FF]">Wartet</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Prize Detail Modal */}
      <AnimatePresence>
        {selectedPrize && (
          <motion.div
            data-testid="lottery-prize-modal"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedPrize(null)}
          >
            <motion.div
              className="w-full sm:max-w-md bg-[#0a0a0a] border-t sm:border border-white/[0.08] rounded-t-3xl sm:rounded-3xl overflow-hidden"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <img
                  src={selectedPrize.item.image}
                  alt={selectedPrize.item.name}
                  className="w-full h-64 object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
                <button
                  data-testid="lottery-prize-modal-close"
                  onClick={() => setSelectedPrize(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center"
                >
                  <X size={16} className="text-white" />
                </button>
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1"
                     style={{ background: selectedPrize.style.gradient, color: "#000" }}>
                  <Star size={10} fill="#000" />
                  {selectedPrize.tierData.label_de}
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider"
                     style={{ color: selectedPrize.style.color }}>
                    Wert {selectedPrize.item.value_eur}€
                  </p>
                  <h3 className="text-[20px] font-black text-white leading-tight mt-1">
                    {selectedPrize.item.name}
                  </h3>
                </div>
                <p className="text-[13px] text-white/70 leading-relaxed">
                  {selectedPrize.item.description}
                </p>
                <div className="bg-white/[0.04] rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/50">Anzahl pro Ziehung</span>
                    <span className="text-white font-bold">{selectedPrize.tierData.count_per_draw}× Gewinner</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/50">Zusätzlicher BLZ-Bonus</span>
                    <span className="font-bold" style={{ color: selectedPrize.style.color }}>
                      +{selectedPrize.tierData.blz?.toLocaleString("de-DE")} BLZ
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/50">Preis pro Los</span>
                    <span className="text-white font-bold">{price} BLZ</span>
                  </div>
                </div>
                <motion.button
                  data-testid="lottery-prize-modal-buy"
                  onClick={() => { setSelectedPrize(null); buy(); }}
                  disabled={buying}
                  className="w-full py-3.5 rounded-2xl font-black text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: selectedPrize.style.gradient, color: "#000" }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Ticket size={16} />
                  Jetzt mitspielen ({total} BLZ)
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
