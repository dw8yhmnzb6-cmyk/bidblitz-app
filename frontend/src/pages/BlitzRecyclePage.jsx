/**
 * BlitzRecycle - Trash-to-BLZ Idle Tycoon
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Sparkles, RefreshCw, Gift, Crown, Trophy, Recycle
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (n) => {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
};

export const BlitzRecyclePage = ({ onBack }) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [floaters, setFloaters] = useState([]);
  const [showLB, setShowLB] = useState(false);
  const [lb, setLB] = useState([]);
  const offlineShownRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/blitz-recycle/state`, { credentials: "include" });
      const data = await res.json();
      setState(data);
      if (data.offline_earned && Object.keys(data.offline_earned).length && !offlineShownRef.current) {
        offlineShownRef.current = true;
        const total = Object.values(data.offline_earned).reduce((a, b) => a + b, 0);
        if (total > 0) toast.success(`🗑️ Offline: +${fmt(total)} Müll gesammelt!`);
      }
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const addFloater = (x, y, text) => {
    const id = Date.now() + Math.random();
    setFloaters(f => [...f, { id, x, y, text }]);
    setTimeout(() => setFloaters(f => f.filter(c => c.id !== id)), 900);
  };

  const handleTap = async (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    try {
      const res = await fetch(`${API}/api/blitz-recycle/tap`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      addFloater(x, y, `${data.icon} +${fmt(data.gained)}`);
      setState(s => {
        if (!s) return s;
        const newTrash = { ...s.trash_types };
        if (newTrash[data.trash_type]) {
          newTrash[data.trash_type] = { ...newTrash[data.trash_type], inventory: newTrash[data.trash_type].inventory + data.gained };
        }
        return { ...s, trash_types: newTrash, inventory: { ...s.inventory, [data.trash_type]: (s.inventory?.[data.trash_type] || 0) + data.gained } };
      });
    } catch {}
  };

  const sellAll = async () => {
    try {
      const res = await fetch(`${API}/api/blitz-recycle/sell-all`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`💰 +€${data.total_revenue.toFixed(2)}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const sellOne = async (tid) => {
    try {
      const res = await fetch(`${API}/api/blitz-recycle/sell`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trash_type: tid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`+€${data.revenue.toFixed(2)} (${fmt(data.sold_quantity)}× zu €${data.unit_price.toFixed(4)})`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const upgrade = async (uid) => {
    try {
      const res = await fetch(`${API}/api/blitz-recycle/upgrade`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upgrade_id: uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`⬆️ ${state.upgrades_info[uid].name} Lvl ${data.new_level}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const claimBLZ = async () => {
    try {
      const res = await fetch(`${API}/api/blitz-recycle/claim-blz`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`🎁 +${data.blz_claimed} BLZ!`, { duration: 4000 });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const claimDaily = async () => {
    try {
      const res = await fetch(`${API}/api/blitz-recycle/claim-daily`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`🌞 Daily: +${data.blz} BLZ`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doPrestige = async () => {
    if (!window.confirm("⚠ Alles wird zurückgesetzt für +20% permanent und Bonus-BLZ. Sicher?")) return;
    try {
      const res = await fetch(`${API}/api/blitz-recycle/prestige`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      toast.success(`👑 Prestige ${data.new_prestige}! +${data.bonus_blz} BLZ`, { duration: 5000 });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openLB = async () => {
    setShowLB(true);
    try {
      const res = await fetch(`${API}/api/blitz-recycle/leaderboard`);
      const data = await res.json();
      setLB(data.leaderboard || []);
    } catch {}
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#061217]">
        <RefreshCw size={22} className="animate-spin text-white/40" />
      </div>
    );
  }

  const trashList = Object.values(state.trash_types || {});
  const upgradeList = Object.values(state.upgrades_info || {});
  const hasInventory = trashList.some(t => t.inventory > 0);
  const canBLZ = (state.unclaimed_blz || 0) >= 1;
  const canPrestige = (state.total_earned || 0) >= 5_000_000;

  return (
    <div data-testid="blitz-recycle-page" className="min-h-screen pb-28 relative"
      style={{ background: "radial-gradient(circle at 30% 0%, rgba(0,210,106,0.15), transparent 50%), radial-gradient(circle at 70% 100%, rgba(0,194,255,0.08), transparent 50%), #061217" }}>

      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#061217]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button data-testid="recycle-back-btn" onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}>
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <div className="flex items-center gap-2">
            <Recycle size={14} className="text-[#00D26A]" />
            <span className="text-[13px] font-bold text-white">BlitzRecycle</span>
            {state.prestige_level > 0 && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                <Crown size={9} /> P{state.prestige_level}
              </span>
            )}
          </div>
          <motion.button data-testid="recycle-lb-btn" onClick={openLB}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}>
            <Trophy size={14} className="text-amber-400" />
          </motion.button>
        </div>
      </div>

      {/* Cash */}
      <div className="px-4 pt-5">
        <div className="text-center mb-3">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.15em] mb-1">Dein Vermögen</p>
          <p className="text-[40px] font-black text-white font-outfit tabular-nums leading-none">€{fmt(state.cash)}</p>
          <p className="text-[11px] text-[#00D26A] font-semibold mt-0.5 flex items-center justify-center gap-1">
            <TrendingUp size={10} /> +{fmt(state.auto_rate)}/s auto
          </p>
        </div>

        {/* Stadt-Sauberkeit */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-white/60">🌍 Stadt-Sauberkeit</span>
            <span className="text-[10px] font-bold text-[#00D26A]">{state.city_cleanliness}/100</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${state.city_cleanliness}%`, background: "linear-gradient(90deg,#00D26A,#00C2FF)" }} />
          </div>
        </div>

        {/* Tap Zone */}
        <motion.div
          data-testid="recycle-tap-zone"
          onClick={handleTap}
          className="relative mx-auto w-full max-w-[300px] h-[130px] rounded-[28px] cursor-pointer select-none overflow-hidden"
          style={{
            background: "linear-gradient(135deg,#00D26A 0%,#00B358 100%)",
            boxShadow: "0 12px 40px rgba(0,210,106,0.35), inset 0 2px 0 rgba(255,255,255,0.3)",
          }}
          whileTap={{ scale: 0.96 }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <span className="text-[40px] leading-none">♻️</span>
            <p className="text-[13px] font-bold mt-1 uppercase tracking-wider">Müll sammeln!</p>
            <p className="text-[10px] text-white/80">+{fmt(state.tap_value)} pro Tap</p>
          </div>
          <AnimatePresence>
            {floaters.map(c => (
              <motion.div key={c.id}
                className="absolute pointer-events-none text-[13px] font-black text-yellow-200"
                style={{ left: c.x, top: c.y, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
                initial={{ opacity: 1, y: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -50, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.85 }}
              >
                {c.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <motion.button data-testid="recycle-daily-btn" onClick={claimDaily}
            className="py-2.5 rounded-xl flex flex-col items-center gap-0.5"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)" }}
            whileTap={{ scale: 0.95 }}>
            <Gift size={13} className="text-[#A855F7]" />
            <span className="text-[10px] font-semibold text-[#A855F7]">Daily 15 BLZ</span>
          </motion.button>
          <motion.button data-testid="recycle-claim-blz-btn" onClick={claimBLZ} disabled={!canBLZ}
            className="py-2.5 rounded-xl flex flex-col items-center gap-0.5 disabled:opacity-40"
            style={{ background: canBLZ ? "linear-gradient(135deg,#00D26A,#00B358)" : "rgba(0,210,106,0.1)", border: "1px solid rgba(0,210,106,0.3)" }}
            whileTap={canBLZ ? { scale: 0.95 } : {}}>
            <Sparkles size={13} className={canBLZ ? "text-white" : "text-[#00D26A]"} />
            <span className={`text-[10px] font-semibold ${canBLZ ? "text-white" : "text-[#00D26A]"}`}>+{state.unclaimed_blz || 0} BLZ</span>
          </motion.button>
          <motion.button data-testid="recycle-prestige-btn" onClick={doPrestige} disabled={!canPrestige}
            className="py-2.5 rounded-xl flex flex-col items-center gap-0.5 disabled:opacity-40"
            style={{ background: canPrestige ? "linear-gradient(135deg,#FFB800,#FF8C00)" : "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.3)" }}
            whileTap={canPrestige ? { scale: 0.95 } : {}}>
            <Crown size={13} className={canPrestige ? "text-white" : "text-[#FFB800]"} />
            <span className={`text-[10px] font-semibold ${canPrestige ? "text-white" : "text-[#FFB800]"}`}>Prestige</span>
          </motion.button>
        </div>
      </div>

      {/* Inventar / Markt */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.15em]">Markt & Inventar</h2>
          {hasInventory && (
            <motion.button
              data-testid="recycle-sell-all-btn"
              onClick={sellAll}
              className="px-3 py-1 rounded-full text-[10px] font-bold text-[#000]"
              style={{ background: "#FFB800" }}
              whileTap={{ scale: 0.95 }}
            >
              Alles verkaufen 💰
            </motion.button>
          )}
        </div>
        <div className="space-y-2">
          {trashList.map((t) => {
            const hasInv = t.inventory > 0;
            return (
              <div key={t.id}
                className="rounded-2xl p-3 flex items-center gap-3"
                style={{
                  background: t.unlocked ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
                  border: `1px solid ${t.unlocked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"}`,
                  opacity: t.unlocked ? 1 : 0.5,
                }}
                data-testid={`recycle-trash-${t.id}`}
              >
                <div className="text-[24px] w-10 text-center">{t.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-white">{t.name}</p>
                    <span className="text-[10px] font-bold"
                      style={{ color: t.market_price > t.base_price ? "#00D26A" : t.market_price < t.base_price ? "#FF4757" : "#FFB800" }}>
                      €{t.market_price.toFixed(t.market_price < 1 ? 4 : 2)}
                    </span>
                  </div>
                  {t.unlocked ? (
                    <p className="text-[10px] text-white/50">Bestand: {fmt(t.inventory)}</p>
                  ) : (
                    <p className="text-[10px] text-white/40">Bei €{fmt(t.unlock_total)} gesamt freigeschaltet</p>
                  )}
                </div>
                {hasInv && (
                  <motion.button
                    data-testid={`recycle-sell-${t.id}`}
                    onClick={() => sellOne(t.id)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg,#00D26A,#00B358)" }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Verkaufen
                  </motion.button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrades */}
      <div className="px-4 mt-6">
        <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.15em] mb-3">Upgrades</h2>
        <div className="space-y-2">
          {upgradeList.map((u) => {
            const affordable = state.cash >= u.next_cost;
            return (
              <motion.button
                key={u.id}
                data-testid={`recycle-upgrade-${u.id}`}
                onClick={() => affordable && upgrade(u.id)}
                disabled={!affordable}
                className="w-full rounded-2xl p-3 flex items-center gap-3 text-left"
                style={{
                  background: affordable ? "rgba(0,194,255,0.07)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${affordable ? "rgba(0,194,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                  opacity: affordable ? 1 : 0.65,
                }}
                whileTap={affordable ? { scale: 0.98 } : {}}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] flex-shrink-0"
                  style={{ background: "rgba(0,194,255,0.1)" }}>
                  {u.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-bold text-white">{u.name}</p>
                    {u.level > 0 && <span className="text-[10px] font-bold text-[#00C2FF]">Lvl {u.level}</span>}
                  </div>
                  <p className="text-[10px] text-white/50">{u.desc}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-[13px] font-bold ${affordable ? "text-[#00D26A]" : "text-white/50"}`}>
                    €{fmt(u.next_cost)}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <AnimatePresence>
        {showLB && (
          <motion.div
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center"
            onClick={() => setShowLB(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md max-h-[80vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-[#0A1A1F] border border-white/[0.08] p-5"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={18} className="text-amber-400" />
                <h2 className="text-[15px] font-bold text-white">Top Recycler</h2>
              </div>
              {lb.length === 0 ? (
                <p className="text-center text-white/40 py-6 text-[13px]">Noch keine Spieler</p>
              ) : lb.map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl mb-2"
                  style={{ background: i < 3 ? "rgba(0,210,106,0.06)" : "rgba(255,255,255,0.02)" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{
                      background: i === 0 ? "#FFB800" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.05)",
                      color: i < 3 ? "#000" : "#fff",
                    }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-white truncate">{e.display_name}</p>
                    <p className="text-[10px] text-white/50">Sauberkeit: {e.city_cleanliness}/100</p>
                  </div>
                  {e.prestige_level > 0 && <span className="text-[10px] font-bold text-amber-400">P{e.prestige_level}</span>}
                  <span className="text-[11px] font-bold text-[#00D26A]">€{fmt(e.total_earned)}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BlitzRecyclePage;
