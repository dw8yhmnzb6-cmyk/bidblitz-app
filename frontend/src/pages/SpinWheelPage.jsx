/**
 * SpinWheelPage - Tägliches Gratis-Glücksrad
 * Backend: /api/spin-wheel/status, /api/spin-wheel/spin
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Gift, Crown, Clock } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const PRIZE_COLORS = [
  "#00D26A", "#00C2FF", "#A855F7", "#FFB800",
  "#FF6B9D", "#FFD700", "#3B82F6", "#EF4444",
];

function useCountdown(targetIso) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!targetIso) return;
    const t = new Date(targetIso).getTime();
    const tick = () => {
      const d = t - Date.now();
      if (d <= 0) return setLeft("Jetzt!");
      const h = Math.floor(d / 3600000);
      const m = Math.floor((d % 3600000) / 60000);
      setLeft(`${h}h ${m}m`);
    };
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
  }, [targetIso]);
  return left;
}

export default function SpinWheelPage({ onBack, onNavigate }) {
  const [data, setData] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastPrize, setLastPrize] = useState(null);
  const countdown = useCountdown(data?.next_reset);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/spin-wheel/status`, { credentials: "include" });
      const j = await r.json();
      setData(j);
    } catch { toast.error("Fehler beim Laden"); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const spin = async () => {
    if (!data || data.remaining === 0) return;
    setSpinning(true);
    setLastPrize(null);
    try {
      const r = await fetch(`${API}/api/spin-wheel/spin`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      const n = data.prizes.length;
      const segmentAngle = 360 / n;
      const target = 360 * 6 + (360 - (j.prize_index * segmentAngle + segmentAngle / 2));
      setRotation(prev => prev + target);
      setTimeout(() => {
        setLastPrize(j.prize);
        toast.success(`🎉 Du hast ${j.prize.label} gewonnen!`, { duration: 5000 });
        load();
        setSpinning(false);
      }, 4200);
    } catch (e) {
      toast.error(e.message);
      setSpinning(false);
    }
  };

  if (!data) return <div className="min-h-screen bg-[#060810] flex items-center justify-center"><Loader2 className="animate-spin text-white/40"/></div>;

  const n = data.prizes.length;
  const seg = 360 / n;
  const noMore = data.remaining === 0;

  return (
    <div data-testid="spin-wheel-page" className="min-h-screen pb-24"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,184,0,0.2), transparent 60%), #060810" }}>
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="spin-back">
            <ArrowLeft size={15} className="text-white/70"/>
          </button>
          <h1 className="text-[14px] font-bold text-white">Tägliches Glücksrad</h1>
          <div className="w-9"/>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Counter */}
        <div className="rounded-2xl p-3 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg,rgba(255,184,0,0.18),rgba(255,107,157,0.1))", border: "1px solid rgba(255,184,0,0.3)" }}>
          <div className="flex-1">
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Dein Glücksrad heute</p>
            <p className="text-[20px] font-black text-white leading-tight font-outfit">
              {data.remaining} / {data.limit} Spins
            </p>
            {data.is_premium && (
              <p className="text-[10px] text-[#FFD700] font-bold mt-0.5 flex items-center gap-1">
                <Crown size={10}/> Premium Bonus: {data.limit}×/Tag
              </p>
            )}
          </div>
          <div className="text-right">
            <Clock size={12} className="text-white/40 inline"/>
            <p className="text-[10px] text-white/60 mt-0.5">Reset in</p>
            <p className="text-[13px] font-black text-white tabular-nums">{countdown}</p>
          </div>
        </div>

        {/* Wheel */}
        <div className="relative mx-auto" style={{ width: 300, height: 300 }}>
          {/* Pointer */}
          <div className="absolute top-[-8px] left-1/2 transform -translate-x-1/2 z-20"
            style={{ width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: "22px solid #FFD700", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}/>
          <motion.div
            data-testid="spin-wheel-graphic"
            className="w-full h-full rounded-full relative overflow-hidden border-4"
            style={{ borderColor: "#FFD700", boxShadow: "0 0 30px rgba(255,215,0,0.4)" }}
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.23, 1, 0.32, 1] }}
          >
            {data.prizes.map((p, i) => {
              const startAngle = i * seg;
              // Conic gradient segment
              const color = PRIZE_COLORS[i % PRIZE_COLORS.length];
              return (
                <div key={i}
                  className="absolute inset-0"
                  style={{
                    clipPath: `polygon(50% 50%, ${50 + 60 * Math.sin((startAngle * Math.PI) / 180)}% ${50 - 60 * Math.cos((startAngle * Math.PI) / 180)}%, ${50 + 60 * Math.sin(((startAngle + seg) * Math.PI) / 180)}% ${50 - 60 * Math.cos(((startAngle + seg) * Math.PI) / 180)}%)`,
                    background: color,
                  }}>
                  <div className="absolute top-[12%] left-1/2 transform -translate-x-1/2 text-center"
                    style={{ transform: `translateX(-50%) rotate(${startAngle + seg / 2}deg)`, transformOrigin: "50% 150px" }}>
                    <p className="text-[10px] font-black text-white text-center whitespace-nowrap">{p.label}</p>
                  </div>
                </div>
              );
            })}
            {/* Center hub */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black border-4 border-[#FFD700] flex items-center justify-center z-10">
              <Gift size={22} className="text-[#FFD700]"/>
            </div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.button
          data-testid="spin-btn"
          onClick={spin}
          disabled={spinning || noMore}
          className="w-full py-4 rounded-2xl font-black text-[15px] text-black flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#FFD700,#FFB800)" }}
          whileTap={{ scale: 0.97 }}
        >
          {spinning ? <><Loader2 size={17} className="animate-spin"/>Dreht...</> :
           noMore ? "Morgen wieder!" :
           `🎰 Jetzt drehen (${data.remaining} übrig)`}
        </motion.button>

        {lastPrize && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-4 text-center"
            style={{ background: "rgba(0,210,106,0.15)", border: "1px solid rgba(0,210,106,0.3)" }}
            data-testid="last-prize">
            <p className="text-[10px] text-[#00D26A] font-bold uppercase tracking-wider">Dein Gewinn</p>
            <p className="text-[28px] font-black text-[#00D26A] mt-1">{lastPrize.label}</p>
            <p className="text-[11px] text-white/60 mt-1">Wurde gutgeschrieben ✓</p>
          </motion.div>
        )}

        {!data.is_premium && (
          <button onClick={() => onNavigate && onNavigate("/premium")}
            className="w-full py-3 rounded-xl text-[12px] text-white/60 hover:text-white bg-white/5 border border-white/10"
            data-testid="spin-upgrade">
            <Crown size={12} className="inline mr-1 text-[#FFD700]"/>
            Premium = 3× Spins pro Tag
          </button>
        )}

        {/* Prizes overview */}
        <div>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Gewinne</p>
          <div className="grid grid-cols-2 gap-1.5">
            {data.prizes.map((p, i) => (
              <div key={i} className="rounded-lg px-3 py-2 text-[11px] font-bold flex items-center gap-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: PRIZE_COLORS[i % PRIZE_COLORS.length] }}/>
                <span className="text-white">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
