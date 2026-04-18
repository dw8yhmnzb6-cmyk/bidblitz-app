/**
 * BlitzOffice - Idle Office Tycoon mit BLZ-Token Belohnungen
 * Inspiriert von "Office Life" / "Idle Office Tycoon" aber 100 % BidBlitz.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Coins, TrendingUp, Lock, Award,
  Trophy, RefreshCw, Sparkles, Clock, Gift, Crown
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const formatCash = (n) => {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
};

export const BlitzOfficePage = ({ onBack }) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localCash, setLocalCash] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [floatingCoins, setFloatingCoins] = useState([]);
  const tickIntervalRef = useRef(null);
  const offlineToastShownRef = useRef(false);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/blitz-office/state`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Bitte einloggen");
          return;
        }
        throw new Error("Fehler beim Laden");
      }
      const data = await res.json();
      setState(data);
      setLocalCash(data.cash);
      if (data.offline_earned > 0 && !offlineToastShownRef.current) {
        offlineToastShownRef.current = true;
        toast.success(`💰 Offline-Einnahmen: +${formatCash(data.offline_earned)} Cash`);
      }
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  // Local idle tick for smooth visual - server reconciles on actions
  useEffect(() => {
    if (!state) return;
    tickIntervalRef.current = setInterval(() => {
      setLocalCash(c => c + state.rate_per_sec / 10);
    }, 100);
    return () => clearInterval(tickIntervalRef.current);
  }, [state?.rate_per_sec]);

  // Refetch every 30s to reconcile with server
  useEffect(() => {
    const id = setInterval(loadState, 30000);
    return () => clearInterval(id);
  }, [loadState]);

  const addFloatingCoin = (x, y, value) => {
    const id = Date.now() + Math.random();
    setFloatingCoins(f => [...f, { id, x, y, value }]);
    setTimeout(() => {
      setFloatingCoins(f => f.filter(c => c.id !== id));
    }, 1000);
  };

  const handleTap = async (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    try {
      const res = await fetch(`${API}/api/blitz-office/click`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setLocalCash(data.cash);
      setState(s => s ? { ...s, cash: data.cash, total_earned: (s.total_earned || 0) + data.gained } : s);
      addFloatingCoin(x, y, data.gained);
    } catch {}
  };

  const handleHire = async (deptId) => {
    try {
      const res = await fetch(`${API}/api/blitz-office/hire`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dept_id: deptId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`${state.departments_info[deptId].name} Lvl ${data.new_level}! +${formatCash(data.rate_per_sec - (state.rate_per_sec || 0))}/s`);
      loadState();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleClaimBLZ = async () => {
    try {
      const res = await fetch(`${API}/api/blitz-office/claim-blz`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`🎁 +${data.blz_claimed} BLZ erhalten!`, { duration: 4000 });
      loadState();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleClaimDaily = async () => {
    try {
      const res = await fetch(`${API}/api/blitz-office/claim-daily`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`🎉 Daily-Bonus: +${data.blz} BLZ!`);
      loadState();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePrestige = async () => {
    if (!window.confirm("⚠ Alle Abteilungen werden zurückgesetzt!\n\nDafür erhältst du +15 % Einkommen für immer und Bonus-BLZ. Fortfahren?")) return;
    try {
      const res = await fetch(`${API}/api/blitz-office/prestige`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`👑 Prestige Lvl ${data.new_prestige}! +${data.bonus_blz} BLZ Bonus`, { duration: 5000 });
      loadState();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    try {
      const res = await fetch(`${API}/api/blitz-office/leaderboard?limit=20`);
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch {}
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <RefreshCw size={24} className="animate-spin text-white/40" />
      </div>
    );
  }

  const canClaimBLZ = (state.unclaimed_blz || 0) >= 1;
  const canPrestige = (state.total_earned || 0) >= 10_000_000;
  const departments = Object.values(state.departments_info || {});

  return (
    <div data-testid="blitz-office-page" className="min-h-screen pb-28 relative overflow-hidden"
      style={{ background: "radial-gradient(circle at 20% 10%, rgba(0,194,255,0.08), transparent 50%), radial-gradient(circle at 80% 90%, rgba(255,184,0,0.06), transparent 50%), #050505" }}>

      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#050505]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button
            data-testid="office-back-btn"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}
          >
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-white">{state.office_name}</span>
            {state.prestige_level > 0 && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                <Crown size={9} /> P{state.prestige_level}
              </span>
            )}
          </div>
          <motion.button
            data-testid="office-leaderboard-btn"
            onClick={openLeaderboard}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}
          >
            <Trophy size={14} className="text-amber-400" />
          </motion.button>
        </div>
      </div>

      {/* Cash Display + Tap Zone */}
      <div className="px-4 pt-6">
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.15em] mb-1">Büro-Kasse</p>
          <p className="text-[42px] font-black text-white font-outfit tabular-nums leading-none">
            €{formatCash(localCash)}
          </p>
          <p className="text-[12px] text-[#00D26A] font-semibold mt-1 flex items-center justify-center gap-1">
            <TrendingUp size={11} /> +€{formatCash(state.rate_per_sec)}/s
          </p>
        </motion.div>

        {/* Tap Zone */}
        <motion.div
          data-testid="office-tap-zone"
          onClick={handleTap}
          className="relative mx-auto w-full max-w-[280px] h-[140px] rounded-[28px] cursor-pointer select-none overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #00C2FF 0%, #0088CC 100%)",
            boxShadow: "0 12px 40px rgba(0,194,255,0.35), inset 0 2px 0 rgba(255,255,255,0.3)",
          }}
          whileTap={{ scale: 0.96 }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <Zap size={32} fill="currentColor" strokeWidth={0} />
            <p className="text-[14px] font-bold mt-1 uppercase tracking-wider">Tippen!</p>
            <p className="text-[10px] text-white/80 mt-0.5">+€{formatCash(state.rate_per_sec)} pro Tap</p>
          </div>
          {/* Floating coins */}
          <AnimatePresence>
            {floatingCoins.map(c => (
              <motion.div
                key={c.id}
                className="absolute pointer-events-none text-[14px] font-black text-yellow-300"
                style={{ left: c.x, top: c.y, textShadow: "0 2px 4px rgba(0,0,0,0.4)" }}
                initial={{ opacity: 1, y: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -50, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9 }}
              >
                +€{formatCash(c.value)}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Action Bar */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <motion.button
            data-testid="office-daily-btn"
            onClick={handleClaimDaily}
            className="py-2.5 rounded-xl flex flex-col items-center gap-0.5"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Gift size={14} className="text-[#A855F7]" />
            <span className="text-[10px] font-semibold text-[#A855F7]">Daily 10 BLZ</span>
          </motion.button>
          <motion.button
            data-testid="office-claim-blz-btn"
            onClick={handleClaimBLZ}
            disabled={!canClaimBLZ}
            className="py-2.5 rounded-xl flex flex-col items-center gap-0.5 disabled:opacity-40"
            style={{
              background: canClaimBLZ ? "linear-gradient(135deg,#00D26A,#00B358)" : "rgba(0,210,106,0.1)",
              border: "1px solid rgba(0,210,106,0.3)",
            }}
            whileTap={canClaimBLZ ? { scale: 0.95 } : {}}
          >
            <Sparkles size={14} className={canClaimBLZ ? "text-white" : "text-[#00D26A]"} />
            <span className={`text-[10px] font-semibold ${canClaimBLZ ? "text-white" : "text-[#00D26A]"}`}>
              +{state.unclaimed_blz || 0} BLZ
            </span>
          </motion.button>
          <motion.button
            data-testid="office-prestige-btn"
            onClick={handlePrestige}
            disabled={!canPrestige}
            className="py-2.5 rounded-xl flex flex-col items-center gap-0.5 disabled:opacity-40"
            style={{
              background: canPrestige ? "linear-gradient(135deg,#FFB800,#FF8C00)" : "rgba(255,184,0,0.1)",
              border: "1px solid rgba(255,184,0,0.3)",
            }}
            whileTap={canPrestige ? { scale: 0.95 } : {}}
          >
            <Crown size={14} className={canPrestige ? "text-white" : "text-[#FFB800]"} />
            <span className={`text-[10px] font-semibold ${canPrestige ? "text-white" : "text-[#FFB800]"}`}>
              Prestige
            </span>
          </motion.button>
        </div>
      </div>

      {/* Departments */}
      <div className="px-4 mt-6">
        <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.15em] mb-3">Abteilungen</h2>
        <div className="space-y-2">
          {departments.map((d) => {
            const affordable = state.cash >= d.next_cost;
            const locked = d.locked;
            return (
              <motion.button
                key={d.id}
                data-testid={`office-dept-${d.id}`}
                onClick={() => !locked && handleHire(d.id)}
                disabled={locked || !affordable}
                className="w-full rounded-2xl p-3 flex items-center gap-3 text-left transition-all disabled:opacity-50"
                style={{
                  background: locked ? "rgba(255,255,255,0.015)" :
                              affordable ? "rgba(0,194,255,0.07)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${locked ? "rgba(255,255,255,0.04)" :
                    affordable ? "rgba(0,194,255,0.25)" : "rgba(255,255,255,0.06)"}`,
                }}
                whileTap={(!locked && affordable) ? { scale: 0.98 } : {}}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] flex-shrink-0"
                  style={{ background: locked ? "rgba(255,255,255,0.03)" : "rgba(0,194,255,0.1)" }}>
                  {locked ? <Lock size={18} className="text-white/30" /> : d.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-bold text-white truncate">{d.name}</p>
                    {d.level > 0 && (
                      <span className="text-[10px] font-semibold text-[#00C2FF]">Lvl {d.level}</span>
                    )}
                  </div>
                  {locked ? (
                    <p className="text-[10px] text-white/40">Freischalten: €{formatCash(d.unlock_cost)} gesamt</p>
                  ) : d.level === 0 ? (
                    <p className="text-[10px] text-white/50">+€{formatCash(d.next_rate)}/s bei Einstellung</p>
                  ) : (
                    <p className="text-[10px] text-white/50">
                      €{formatCash(d.current_rate)}/s → €{formatCash(d.next_rate)}/s
                    </p>
                  )}
                </div>
                {!locked && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Kosten</p>
                    <p className={`text-[13px] font-bold ${affordable ? "text-[#00D26A]" : "text-white/50"}`}>
                      €{formatCash(d.next_cost)}
                    </p>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center"
            onClick={() => setShowLeaderboard(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full sm:max-w-md max-h-[80vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-[#0A0A0A] border border-white/[0.08] p-5"
              onClick={e => e.stopPropagation()}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={18} className="text-amber-400" />
                <h2 className="text-[15px] font-bold text-white">Top Büros</h2>
              </div>
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <p className="text-center text-white/40 py-6 text-[13px]">Noch keine Spieler</p>
                ) : leaderboard.map((e, i) => (
                  <div key={e.user_id} className="flex items-center gap-3 p-2.5 rounded-xl"
                    style={{ background: i < 3 ? "rgba(255,184,0,0.06)" : "rgba(255,255,255,0.02)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{
                        background: i === 0 ? "#FFB800" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.05)",
                        color: i < 3 ? "#000" : "#fff",
                      }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-white truncate">{e.display_name}</p>
                      <p className="text-[10px] text-white/50">{e.office_name}</p>
                    </div>
                    {e.prestige_level > 0 && (
                      <span className="text-[10px] font-bold text-amber-400">P{e.prestige_level}</span>
                    )}
                    <span className="text-[11px] font-bold text-[#00D26A]">€{formatCash(e.total_earned)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BlitzOfficePage;
