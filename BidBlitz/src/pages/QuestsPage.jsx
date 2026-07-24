/**
 * QuestsPage — Tägliche Aufgaben (3 pro Tag)
 * Backend: /api/quests/today, /api/quests/claim/{quest_id}
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle, Target, Clock, Trophy, Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

function useCountdown(targetIso) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!targetIso) return;
    const t = new Date(targetIso).getTime();
    const tick = () => {
      const d = t - Date.now();
      if (d <= 0) return setLeft("Jetzt");
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

// Map each quest event to a target route
const QUEST_CTA = {
  login:              { label: "Du bist hier ✓", route: null },
  spin_wheel:         { label: "Glücksrad öffnen", route: "/spin-wheel" },
  classified_create:  { label: "Anzeige erstellen", route: "/classifieds" },
  referral_share:     { label: "Link teilen", route: "/affiliate" },
  marketplace_view:   { label: "Marketplace öffnen", route: "/marketplace" },
  taxi_estimate:      { label: "Taxi öffnen", route: "/taxi" },
  mine_tap:           { label: "Minen starten", route: "/mine" },
  notification_read:  { label: "Benachrichtigungen", route: "/notifications" },
  auction_view:       { label: "Auktionen ansehen", route: "/auctions" },
  profile_update:     { label: "Profil öffnen", route: "/profile" },
};

export default function QuestsPage({ onBack, onNavigate }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(null);
  const countdown = useCountdown(data?.next_reset);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/quests/today`, { credentials: "include" });
      const j = await r.json();
      setData(j);
    } catch { toast.error("Fehler beim Laden"); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const claim = async (questId) => {
    setClaiming(questId);
    try {
      const r = await fetch(`${API}/api/quests/claim/${questId}`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      let msg = `+${j.reward} BLZ`;
      if (j.all_claimed_bonus) msg += ` + Bonus ${j.all_claimed_bonus} BLZ 🏆`;
      toast.success(msg, { duration: 4000 });
      await load();
    } catch (e) { toast.error(e.message); }
    setClaiming(null);
  };

  if (!data) return <div className="min-h-screen bg-[#060810] flex items-center justify-center"><Loader2 className="animate-spin text-white/40"/></div>;

  const allDone = data.quests.every(q => q.claimed);

  return (
    <div data-testid="quests-page" className="min-h-screen pb-24"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(0,194,255,0.15), transparent 60%), #060810" }}>
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="quests-back">
            <ArrowLeft size={15} className="text-white/70"/>
          </button>
          <h1 className="text-[14px] font-bold text-white">Tägliche Quests</h1>
          <div className="w-9"/>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Header Summary */}
        <motion.div
          className="rounded-2xl p-5 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#00C2FF 0%,#A855F7 100%)" }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          data-testid="quests-summary"
        >
          <Target size={32} className="mx-auto text-white mb-2" strokeWidth={2.5}/>
          <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em]">Heutige Belohnung</p>
          <p className="text-[40px] font-black text-white mt-1 font-outfit leading-none tabular-nums">
            {data.total_reward_blz}
          </p>
          <p className="text-[13px] font-bold text-white/90 mt-0.5">BLZ + 20 Bonus bei allen 3</p>
          <div className="flex items-center justify-center gap-2 mt-3 bg-black/25 rounded-full py-1.5 px-3 w-fit mx-auto">
            <Clock size={11} className="text-white"/>
            <p className="text-[11px] font-bold text-white">Reset in {countdown}</p>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            <div>
              <p className="text-[18px] font-black text-white tabular-nums">{data.completed_count}/{data.quests.length}</p>
              <p className="text-[9px] text-white/70 uppercase">Erledigt</p>
            </div>
            <div>
              <p className="text-[18px] font-black text-white tabular-nums">{data.claimed_blz}</p>
              <p className="text-[9px] text-white/70 uppercase">Abgeholt</p>
            </div>
          </div>
        </motion.div>

        {allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-4 text-center"
            style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)" }}
            data-testid="all-done-banner"
          >
            <Trophy size={28} className="mx-auto text-[#FFD700] mb-1"/>
            <p className="text-[14px] font-black text-[#FFD700]">Alle Quests erledigt!</p>
            <p className="text-[11px] text-white/60 mt-0.5">Morgen warten neue auf dich 🚀</p>
          </motion.div>
        )}

        {/* Quests */}
        <div className="space-y-2">
          {data.quests.map((q, i) => {
            const cta = QUEST_CTA[q.event] || { label: "Öffnen", route: null };
            const pct = Math.min(100, (q.progress / q.target) * 100);
            const status = q.claimed ? "claimed" : q.completed ? "completed" : "active";
            return (
              <motion.div
                key={q.id}
                data-testid={`quest-${q.id}`}
                className="rounded-2xl p-3"
                style={{
                  background: status === "claimed" ? "rgba(0,210,106,0.08)" : "rgba(255,255,255,0.04)",
                  border: status === "claimed" ? "1px solid rgba(0,210,106,0.25)" :
                          status === "completed" ? "1px solid rgba(255,184,0,0.3)" :
                          "1px solid rgba(255,255,255,0.08)",
                }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: status === "claimed" ? "rgba(0,210,106,0.2)" :
                                  status === "completed" ? "rgba(255,184,0,0.2)" :
                                  "rgba(0,194,255,0.15)",
                    }}>
                    {status === "claimed" ? <CheckCircle size={17} className="text-[#00D26A]"/> :
                     status === "completed" ? <Gift size={16} className="text-[#FFB800]"/> :
                     <Target size={16} className="text-[#00C2FF]"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white">{q.title}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{q.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-black tabular-nums" style={{
                      color: status === "claimed" ? "#00D26A" : "#FFB800"
                    }}>
                      +{q.reward_blz}
                    </p>
                    <p className="text-[9px] text-white/40 uppercase">BLZ</p>
                  </div>
                </div>
                {/* Progress */}
                <div className="mb-2">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: status === "claimed" ? "#00D26A" :
                                    status === "completed" ? "#FFB800" : "#00C2FF"
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[9px] text-white/40 mt-1 text-right tabular-nums">
                    {q.progress} / {q.target}
                  </p>
                </div>
                {/* CTA */}
                {status === "active" && cta.route && (
                  <button onClick={() => onNavigate && onNavigate(cta.route)}
                    className="w-full py-2 rounded-xl text-[12px] font-bold bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/25"
                    data-testid={`quest-open-${q.id}`}>
                    {cta.label}
                  </button>
                )}
                {status === "active" && !cta.route && (
                  <p className="text-[11px] text-white/40 text-center py-1.5">{cta.label}</p>
                )}
                {status === "completed" && (
                  <motion.button
                    onClick={() => claim(q.id)}
                    disabled={claiming === q.id}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-2.5 rounded-xl text-[13px] font-black text-black bg-gradient-to-r from-[#FFD700] to-[#FFB800] disabled:opacity-50 flex items-center justify-center gap-1.5"
                    data-testid={`quest-claim-${q.id}`}
                  >
                    {claiming === q.id ? <Loader2 size={13} className="animate-spin"/> : <><Sparkles size={12}/>{q.reward_blz} BLZ abholen</>}
                  </motion.button>
                )}
                {status === "claimed" && (
                  <p className="text-[11px] font-bold text-[#00D26A] text-center py-1.5">
                    <CheckCircle size={11} className="inline mr-1"/> Abgeholt
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="text-[10px] text-white/30 text-center mt-6">
          Neue Quests jeden Tag um Mitternacht (UTC)
        </p>
      </div>
    </div>
  );
}
