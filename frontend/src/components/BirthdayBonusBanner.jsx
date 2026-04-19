/**
 * BirthdayBonusBanner — Erscheint NUR am Geburtstag des Users
 * und zeigt Claim-Button für €10 + 20 BLZ
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Cake, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BirthdayBonusBanner({ isGuest }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    fetch(`${API}/api/birthday/status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, [isGuest]);

  const claim = async () => {
    setClaiming(true);
    try {
      const r = await fetch(`${API}/api/birthday/claim`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      toast.success(`🎂 Happy Birthday! €${j.eur} + ${j.blz} BLZ gutgeschrieben!`, { duration: 6000 });
      setData({ ...data, already_claimed: true });
    } catch (e) { toast.error(e.message); }
    setClaiming(false);
  };

  if (isGuest || !data || !data.is_birthday || data.already_claimed || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-testid="birthday-banner"
        className="rounded-2xl mb-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#FF6B9D 0%,#A855F7 50%,#FF8C42 100%)", boxShadow: "0 8px 32px rgba(255,107,157,0.35)" }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)" }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
        />
        <div className="relative px-4 py-3 flex items-center gap-3">
          <motion.div
            className="w-11 h-11 rounded-xl bg-white/25 flex items-center justify-center flex-shrink-0"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Cake size={22} className="text-white" strokeWidth={2.5}/>
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-white">🎉 Happy Birthday!</p>
            <p className="text-[11px] text-white/90 mt-0.5">
              Dein Geschenk: €{data.eur} + {data.blz} BLZ
            </p>
          </div>
          <motion.button
            data-testid="birthday-claim"
            onClick={claim}
            disabled={claiming}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white text-[#A855F7] rounded-xl text-[12px] font-black disabled:opacity-50"
          >
            {claiming ? <Loader2 size={13} className="animate-spin"/> : "Abholen"}
          </motion.button>
          <button onClick={() => setDismissed(true)} className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">
            <X size={11} className="text-white"/>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
