/**
 * PremiumLaunchBanner - Launch-Event Banner für HomePage
 * Nur sichtbar für eingeloggte Nicht-Premium User während des Launch-Fensters
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, X, Zap } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

function useCountdown(targetIso) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();
    const tick = () => {
      const d = target - Date.now();
      if (d <= 0) { setLeft("0h"); return; }
      const days = Math.floor(d / 86_400_000);
      const h = Math.floor((d % 86_400_000) / 3_600_000);
      const m = Math.floor((d % 3_600_000) / 60_000);
      setLeft(days > 0 ? `${days}d ${h}h` : `${h}h ${m}m`);
    };
    tick();
    const i = setInterval(tick, 60_000);
    return () => clearInterval(i);
  }, [targetIso]);
  return left;
}

export function PremiumLaunchBanner({ isGuest, onNavigate }) {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("bb_premium_banner_dismissed") === "1"; } catch { return false; }
  });
  const countdown = useCountdown(data?.launch_ends_at);

  useEffect(() => {
    if (isGuest) return;
    fetch(`${API}/api/premium/status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {});
  }, [isGuest]);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("bb_premium_banner_dismissed", "1"); } catch {}
  };

  // Only show: logged in + launch active + not already premium + not dismissed
  if (isGuest || !data || !data.launch_active || data.active || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-testid="premium-launch-banner"
        className="rounded-[18px] mb-4 relative overflow-hidden cursor-pointer"
        style={{
          background: "linear-gradient(135deg,#FFD700 0%,#FFB800 50%,#FF8C42 100%)",
          boxShadow: "0 8px 32px rgba(255,184,0,0.25)",
        }}
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.3 }}
        onClick={() => onNavigate("/premium")}
      >
        {/* Shimmer overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
          }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }}
        />
        <div className="relative px-4 py-3 flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl bg-black/15 flex items-center justify-center flex-shrink-0"
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          >
            <Crown size={20} className="text-black" strokeWidth={2.5} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="inline-block bg-black text-[#FFD700] text-[9px] font-black px-1.5 py-[1px] rounded-md uppercase tracking-wider">
                −{data.discount_pct}%
              </span>
              <p className="text-[12px] font-black text-black leading-tight">
                Launch-Special
              </p>
            </div>
            <p className="text-[11px] font-bold text-black/85 leading-tight mt-0.5 truncate">
              <Zap size={10} className="inline text-black mr-0.5 -mt-0.5" />
              2× Mining · 0€ Gebühren · nur {data.price_eur} €/Monat
            </p>
            {countdown && (
              <p className="text-[9px] font-bold text-black/60 uppercase tracking-wider mt-0.5">
                Noch {countdown} · {new Date(data.launch_ends_at).toLocaleDateString("de-DE")}
              </p>
            )}
          </div>
          <motion.button
            data-testid="premium-banner-dismiss"
            className="w-6 h-6 rounded-full bg-black/15 flex items-center justify-center flex-shrink-0"
            whileTap={{ scale: 0.85 }}
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
          >
            <X size={11} className="text-black" strokeWidth={2.5} />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PremiumLaunchBanner;
