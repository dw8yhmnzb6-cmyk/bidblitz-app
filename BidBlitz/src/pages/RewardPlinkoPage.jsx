import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Coins, Crown, Loader2, Sparkles, Target, Ticket, Timer, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const shell = "min-h-screen pb-24 text-white";
const panel = "rounded-[28px] border border-white/10 bg-[rgba(8,12,22,0.82)] backdrop-blur-xl";
const dropSources = {
  ticket: { label: "Ticket Drop", icon: Ticket, accent: "#8FEFFF", copy: "1 Move-&-Earn Ticket einsetzen" },
  bidcoins: { label: "BidCoins Drop", icon: Coins, accent: "#FFD166", copy: "BidCoins für stärkeren Drop einsetzen" },
  free: { label: "Gratis Drop", icon: Sparkles, accent: "#8BFFB7", copy: "Tagesbonus für Premium oder Aktionen" },
};

const PlinkoBall = ({ active, slotIndex }) => {
  const xOffset = active ? (slotIndex - 5) * 22 : 0;
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          data-testid="reward-plinko-ball"
          className="absolute left-1/2 top-3 z-20 h-4 w-4 rounded-full border border-white/60 bg-[#FFD166] shadow-[0_0_20px_rgba(255,209,102,0.65)]"
          initial={{ x: "-50%", y: 0, scale: 0.9 }}
          animate={{ x: `calc(-50% + ${xOffset}px)`, y: 188, scale: [0.92, 1.06, 0.96] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.15, ease: [0.2, 0.7, 0.25, 1] }}
        />
      )}
    </AnimatePresence>
  );
};

export default function RewardPlinkoPage({ onBack }) {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [selectedSource, setSelectedSource] = useState("ticket");
  const [result, setResult] = useState(null);

  const applyData = (statusRes, historyRes) => {
    setStatus(statusRes);
    setHistory(historyRes.items || []);
    setStats(historyRes.stats || null);
    setSelectedSource((prev) => {
      if (prev === "free" && !(statusRes.free_remaining > 0)) {
        return statusRes.ticket_balance > 0 ? "ticket" : "bidcoins";
      }
      return prev;
    });
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statusRes, historyRes] = await Promise.all([
        api.getRewardPlinkoStatus(),
        api.getRewardPlinkoHistory(8),
      ]);
      applyData(statusRes, historyRes);
    } catch (error) {
      toast.error(error.message || "Plinko konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setLoading(true);
      try {
        const [statusRes, historyRes] = await Promise.all([
          api.getRewardPlinkoStatus(),
          api.getRewardPlinkoHistory(8),
        ]);
        if (cancelled) return;
        applyData(statusRes, historyRes);
      } catch (error) {
        if (!cancelled) toast.error(error.message || "Plinko konnte nicht geladen werden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = status?.payouts || [];

  const sourceDisabled = (source) => {
    if (!status) return true;
    if (source === "free") return !(status.free_remaining > 0);
    if (source === "ticket") return !(status.ticket_balance > 0);
    return false;
  };

  const handleDrop = async () => {
    if (!status || playing) return;
    setPlaying(true);
    setResult(null);
    try {
      const res = await api.dropRewardPlinko({ source: selectedSource });
      setTimeout(async () => {
        setResult(res);
        toast.success(`Plinko ${res.multiplier}x · +${res.payout_bidcoins} BidCoins`);
        await load(true);
        setPlaying(false);
      }, 1225);
    } catch (error) {
      toast.error(error.message || "Drop fehlgeschlagen");
      setPlaying(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816]" data-testid="reward-plinko-loading">
        <Loader2 className="animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div
      data-testid="reward-plinko-page"
      className={shell}
      style={{ background: "radial-gradient(circle at top left, rgba(255,122,69,0.26), transparent 24%), radial-gradient(circle at top right, rgba(98,227,255,0.18), transparent 20%), #050816" }}
    >
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[rgba(5,8,22,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),18px)]">
          <button onClick={onBack} data-testid="reward-plinko-back-button" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <ArrowLeft size={16} className="text-white/80" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black sm:text-3xl">Reward Plinko</h1>
            <p className="text-sm text-white/55" data-testid="reward-plinko-subtitle">Droppe Tickets oder Coins durch das Reward Board und sammle sichere Backend-Gewinne.</p>
          </div>
          <div className="rounded-full border border-[#FFD166]/20 bg-[#FFD166]/10 px-3 py-2 text-xs font-bold text-[#FFD166]" data-testid="reward-plinko-ticket-badge">
            {status?.ticket_balance ?? 0} Tickets
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
        <section className={`${panel} overflow-hidden p-5`} data-testid="reward-plinko-hero-card">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FF7A45]/25 bg-[#FF7A45]/10 px-3 py-1 text-xs font-bold text-[#FFB08A]" data-testid="reward-plinko-fairness-chip">
                <Target size={14} /> Reward-Hub Gewinnlogik · serverseitig validiert
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-plinko-stat-free">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45"><Sparkles size={13} className="text-[#8BFFB7]" /> Gratis</div>
                  <div className="text-[24px] font-black text-white">{status?.free_remaining ?? 0}</div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-plinko-stat-cost">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45"><Coins size={13} className="text-[#FFD166]" /> Einsatz</div>
                  <div className="text-[24px] font-black text-white">{status?.bidcoin_cost ?? 0}</div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-plinko-stat-best">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45"><Zap size={13} className="text-[#8FEFFF]" /> Best</div>
                  <div className="text-[24px] font-black text-white">{stats?.best_multiplier || 0}x</div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4" data-testid="reward-plinko-stat-premium">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45"><Crown size={13} className="text-[#FFD166]" /> Premium</div>
                  <div className="text-[24px] font-black text-white">{status?.premium_multiplier || 1}x</div>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/8 bg-black/20 p-4" data-testid="reward-plinko-reset-card">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white/85"><Timer size={16} className="text-[#8FEFFF]" /> Daily Reset</div>
              <div className="text-lg font-black text-white" data-testid="reward-plinko-next-reset">{status?.next_reset?.slice(0, 16)?.replace("T", " ")}</div>
              <p className="mt-2 text-sm text-white/55">Premium erhält bis zu {status?.free_limit ?? 0} Gratis-Drops pro Tag und einen Gewinn-Boost ab 1x.</p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className={`${panel} p-5`} data-testid="reward-plinko-board-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Plinko Board</h2>
                <p className="text-sm text-white/55">Wähle deinen Eintritt und lasse die Kugel fallen.</p>
              </div>
              <button onClick={handleDrop} disabled={playing || sourceDisabled(selectedSource)} data-testid="reward-plinko-drop-button" className="rounded-2xl bg-gradient-to-r from-[#FFB08A] to-[#FFD166] px-4 py-3 text-sm font-black text-[#0B1120] disabled:opacity-50">
                {playing ? "Dropt..." : "Jetzt droppen"}
              </button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {Object.entries(dropSources).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const disabled = sourceDisabled(key);
                const active = selectedSource === key;
                return (
                  <button
                    key={key}
                    onClick={() => !disabled && setSelectedSource(key)}
                    data-testid={`reward-plinko-source-${key}`}
                    disabled={disabled}
                    className={`rounded-[24px] border p-4 text-left transition disabled:opacity-45 ${active ? "bg-white/[0.08]" : "bg-white/[0.03]"}`}
                    style={{ borderColor: active ? `${cfg.accent}66` : "rgba(255,255,255,0.08)" }}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20"><Icon size={18} style={{ color: cfg.accent }} /></div>
                      {active && <div className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ color: cfg.accent, background: `${cfg.accent}22` }}>AKTIV</div>}
                    </div>
                    <div className="text-sm font-black text-white">{cfg.label}</div>
                    <div className="mt-1 text-xs text-white/55">{cfg.copy}</div>
                  </button>
                );
              })}
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.16))] p-4" data-testid="reward-plinko-board-wrap">
              <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-[#FFD166]/35 bg-[#FFD166]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFD166]">Drop Zone</div>
              <PlinkoBall active={playing} slotIndex={result?.slot_index ?? 5} />
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 pt-10">
                {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((cols, rowIndex) => (
                  <div key={`row-${cols}-${rowIndex}`} className="flex gap-2">
                    {Array.from({ length: cols }).map((_, idx) => (
                      <motion.div
                        key={`pin-${rowIndex}-${idx}`}
                        className="h-2 w-2 rounded-full bg-white/40"
                        animate={playing ? { scale: [1, 1.18, 1], opacity: [0.4, 0.92, 0.4] } : { scale: 1, opacity: 0.45 }}
                        transition={{ duration: 0.6, repeat: playing ? Infinity : 0, delay: idx * 0.03 + rowIndex * 0.02 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-11 gap-1" data-testid="reward-plinko-slots">
                {slots.map((slot, idx) => (
                  <div
                    key={`slot-${idx}`}
                    data-testid={`reward-plinko-slot-${idx}`}
                    className={`rounded-xl px-1 py-2 text-center text-[10px] font-black ${result?.slot_index === idx ? "ring-2 ring-white/60" : ""}`}
                    style={{ background: `${slot.color || "#56CCF2"}22`, color: slot.color || "#56CCF2" }}
                  >
                    {slot.label || `${slot.multiplier}x`}
                  </div>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {!!result && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="mt-4 rounded-[24px] border border-[#8BFFB7]/20 bg-[#8BFFB7]/10 p-4" data-testid="reward-plinko-result-card">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#8BFFB7]">Ergebnis</div>
                  <div className="mt-1 text-3xl font-black text-white">{result.multiplier}x</div>
                  <div className="mt-1 text-sm text-white/70">+{result.payout_bidcoins} BidCoins · Netto {result.net_bidcoins >= 0 ? "+" : ""}{result.net_bidcoins}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className={`${panel} p-5`} data-testid="reward-plinko-history-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Letzte Drops</h2>
                <p className="text-sm text-white/55">Serververlauf mit Quelle, Slot und Gewinn.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/75" data-testid="reward-plinko-total-drops">{stats?.total_drops || 0} Drops</div>
            </div>

            <div className="space-y-3">
              {history.map((item, idx) => (
                <div key={item.drop_id || idx} className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3" data-testid={`reward-plinko-history-${idx}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{item.multiplier}x · Slot {item.slot_index + 1}</div>
                      <div className="mt-1 text-xs text-white/45">{item.source} · {item.created_at?.slice(0, 16)?.replace("T", " ")}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-[#FFD166]">+{item.payout_bidcoins}</div>
                      <div className="text-xs text-white/45">Netto {item.net_bidcoins >= 0 ? "+" : ""}{item.net_bidcoins}</div>
                    </div>
                  </div>
                </div>
              ))}
              {!history.length && <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-5 text-sm text-white/45" data-testid="reward-plinko-history-empty">Noch keine Plinko-Drops vorhanden.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}