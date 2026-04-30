import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useI18n } from "../../store";
import { accentRed } from "./atoms";

/**
 * Countdown — Auction timer with final-battle pulse + ending-now critical state.
 * Shared between AuctionGridCard and AuctionDetail.
 */
export default function Countdown({ endsAt, status, size = "md" }) {
  const { t } = useI18n();
  const [rem, setRem] = useState(0);

  useEffect(() => {
    const tick = () => setRem(Math.max(0, Math.floor((new Date(endsAt) - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  if (status === "ended") return null;

  const d = Math.floor(rem / 86400);
  const h = Math.floor((rem % 86400) / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const s = rem % 60;
  const isFinalBattle = rem > 0 && rem <= 60;
  const crit = rem <= 20 && rem > 0;
  const ts = size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-xl";

  if (d > 0 || h > 0) {
    return (
      <div className="flex items-baseline gap-1 font-mono font-black tabular-nums select-none">
        {d > 0 && <><span className={`${ts} text-white/90`}>{d}</span><span className="text-xs text-white/30 mr-1">{t("auction.days")}</span></>}
        <span className={`${ts} text-white/90`}>{h}</span><span className="text-xs text-white/30 mr-1">{t("auction.hours")}</span>
        <span className={`${ts} text-white/60`}>{String(m).padStart(2, "0")}</span><span className="text-xs text-white/15">m</span>
      </div>
    );
  }

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
        <span className={`${ts} ${crit ? "text-[#FF4060]" : isFinalBattle ? "text-[#FF4060]" : "text-white/90"}`}
          style={crit ? { textShadow: "0 0 12px rgba(255,64,96,0.5)" } : isFinalBattle ? { textShadow: "0 0 8px rgba(255,64,96,0.3)" } : {}}>
          {String(m).padStart(2, "0")}
        </span>
        <span className={`text-base ${crit ? "text-[#FF4060]/50" : "text-white/15"}`}>:</span>
        <span className={`${ts} ${crit ? "text-[#FF4060]" : isFinalBattle ? "text-[#FF4060]" : "text-white/90"}`}
          style={crit ? { textShadow: "0 0 12px rgba(255,64,96,0.5)" } : isFinalBattle ? { textShadow: "0 0 8px rgba(255,64,96,0.3)" } : {}}>
          {String(s).padStart(2, "0")}
        </span>
        {(isFinalBattle || crit) && (
          <motion.div className="w-1.5 h-1.5 rounded-full ml-1.5"
            style={{ background: accentRed, boxShadow: `0 0 6px ${accentRed}` }}
            animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.3, repeat: Infinity }} />
        )}
      </motion.div>
    </div>
  );
}
