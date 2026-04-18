/**
 * LotteryPage - Tägliche BLZ-Lotterie
 * Backend: /api/lottery/current, /api/lottery/buy-tickets, /api/lottery/my-tickets
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Ticket, Loader2, Trophy, Sparkles, Clock, Zap, Gift
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const TIER_STYLES = {
  grand: { color: "#FFD700", label: "Jackpot", emoji: "💎" },
  big: { color: "#A855F7", label: "Groß", emoji: "🏆" },
  small: { color: "#00C2FF", label: "Klein", emoji: "🎁" },
  mini: { color: "#00D26A", label: "Mini", emoji: "✨" },
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
  const countdown = useCountdownToMidnight();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, mine] = await Promise.all([
        fetch(`${API}/api/lottery/current`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/lottery/my-tickets`, { credentials: "include" }).then(r => r.json()),
      ]);
      setData(cur);
      setMyDraws(mine.draws || []);
    } catch {
      toast.error("Fehler beim Laden");
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
  const totalPrizeBlz = Object.values(pool).reduce(
    (a, t) => a + (t.blz || 0) * (t.count_per_draw || 0), 0
  );

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

      <div className="p-4 space-y-4">
        {/* Jackpot Hero */}
        <motion.div
          className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#A855F7 0%,#EC4899 100%)" }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        >
          <Sparkles size={32} className="mx-auto text-white mb-2" />
          <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em]">Heutiger Preispool</p>
          <p className="text-[48px] font-black text-white leading-none mt-2 font-outfit tabular-nums">
            {totalPrizeBlz.toLocaleString("de-DE")}
          </p>
          <p className="text-[14px] font-bold text-white/90 mt-1">BLZ</p>
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
        </div>

        {/* Prize Tiers */}
        <div>
          <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">
            Gewinnklassen
          </h2>
          <div className="space-y-2">
            {Object.entries(pool).map(([key, cfg]) => {
              const style = TIER_STYLES[key] || TIER_STYLES.mini;
              return (
                <div key={key}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex items-center gap-3"
                  data-testid={`lottery-tier-${key}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px]"
                    style={{ background: `${style.color}20`, border: `1px solid ${style.color}40` }}>
                    {style.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-white">{style.label}</p>
                    <p className="text-[10px] text-white/50">{cfg.count_per_draw}× pro Ziehung</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-black tabular-nums" style={{ color: style.color }}>
                      {cfg.blz.toLocaleString("de-DE")}
                    </p>
                    <p className="text-[9px] text-white/50 uppercase">BLZ</p>
                  </div>
                </div>
              );
            })}
          </div>
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
    </div>
  );
}
