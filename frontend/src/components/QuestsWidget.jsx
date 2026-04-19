/**
 * QuestsWidget — kompakter Banner auf HomePage
 * Zeigt Progress und navigiert zur QuestsPage
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Target, ChevronRight, Trophy } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function QuestsWidget({ isGuest, onNavigate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (isGuest) return;
    fetch(`${API}/api/quests/today`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, [isGuest]);

  if (isGuest || !data || !data.quests) return null;

  const total = data.quests.length;
  const done = data.completed_count || 0;
  const unclaimedRewards = data.quests
    .filter(q => q.completed && !q.claimed)
    .reduce((sum, q) => sum + (q.reward_blz || 0), 0);
  const allDone = done === total && data.quests.every(q => q.claimed);

  return (
    <motion.button
      data-testid="quests-widget"
      onClick={() => onNavigate && onNavigate("/quests")}
      whileTap={{ scale: 0.98 }}
      className="w-full rounded-2xl mb-4 relative overflow-hidden text-left"
      style={{
        background: allDone
          ? "linear-gradient(135deg,rgba(0,210,106,0.18),rgba(0,194,255,0.08))"
          : unclaimedRewards > 0
          ? "linear-gradient(135deg,rgba(255,184,0,0.18),rgba(255,107,157,0.08))"
          : "linear-gradient(135deg,rgba(0,194,255,0.15),rgba(168,85,247,0.08))",
        border: allDone ? "1px solid rgba(0,210,106,0.25)" :
                unclaimedRewards > 0 ? "1px solid rgba(255,184,0,0.3)" :
                "1px solid rgba(0,194,255,0.25)",
      }}
    >
      {unclaimedRewards > 0 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)" }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
        />
      )}
      <div className="relative px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: allDone ? "rgba(0,210,106,0.25)" :
                        unclaimedRewards > 0 ? "rgba(255,184,0,0.25)" :
                        "rgba(0,194,255,0.25)",
          }}>
          {allDone ? <Trophy size={18} className="text-[#00D26A]"/> : <Target size={18} className="text-[#00C2FF]"/>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-black text-white">Tägliche Quests</p>
            {unclaimedRewards > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#FFB800] text-black text-[9px] font-black">
                +{unclaimedRewards} BLZ wartet!
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/60 mt-0.5">
            {allDone ? "Alle erledigt! Komm morgen wieder." : `${done} von ${total} erledigt · ${data.total_reward_blz} BLZ möglich`}
          </p>
          <div className="flex gap-1 mt-1.5">
            {data.quests.map((q, i) => (
              <div key={i} className="flex-1 h-1 rounded-full" style={{
                background: q.claimed ? "#00D26A" : q.completed ? "#FFB800" : "rgba(255,255,255,0.1)",
              }}/>
            ))}
          </div>
        </div>
        <ChevronRight size={15} className="text-white/40"/>
      </div>
    </motion.button>
  );
}
