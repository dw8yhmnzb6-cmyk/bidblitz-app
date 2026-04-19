/**
 * RetentionHubPage — 4 Tabs: Streak, Leaderboard, Exchange, Gift-Codes
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, Flame, Trophy, ArrowLeftRight, Gift, Crown,
  TrendingUp, Clock, Check, Copy, Share2, Plus, Sparkles, Medal
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options, credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.detail || "Fehler");
  return d;
}

// ═══════════ STREAK TAB ═══════════

const StreakTab = () => {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api("/api/streak/status")); }
    catch (e) { toast.error(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const claim = async (days) => {
    setClaiming(days);
    try {
      const j = await api(`/api/streak/claim/${days}`, { method: "POST" });
      const r = j.reward;
      toast.success(`🔥 ${r.blz ? `+${r.blz} BLZ` : ""}${r.eur ? ` +€${r.eur}` : ""}`, { duration: 4000 });
      await load();
    } catch (e) { toast.error(e.message); }
    setClaiming(null);
  };

  if (!data) return <Loader2 className="animate-spin text-white/40 mx-auto my-8"/>;

  return (
    <div className="space-y-4" data-testid="streak-tab">
      {/* Hero */}
      <motion.div
        className="rounded-2xl p-6 text-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#FF6B35 0%,#FFB800 100%)" }}
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.8, repeat: Infinity }}>
          <Flame size={48} className="mx-auto text-white mb-1" fill="#FFD700" strokeWidth={2.5}/>
        </motion.div>
        <p className="text-[64px] font-black text-white leading-none font-outfit tabular-nums">
          {data.current_streak}
        </p>
        <p className="text-[12px] font-bold text-white/90 uppercase tracking-wider">
          {data.current_streak === 1 ? "Tag Streak" : "Tage Streak"}
        </p>
        <p className="text-[11px] text-white/70 mt-1">Längster: {data.longest_streak} Tage</p>
      </motion.div>

      {/* 14-day heatmap */}
      <div>
        <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Letzte 14 Tage</p>
        <div className="grid grid-cols-7 gap-1.5">
          {data.heatmap.map((d, i) => (
            <div key={i}
              className="aspect-square rounded-md flex items-center justify-center text-[8px] font-bold"
              style={{
                background: d.active ? "#FF6B35" : "rgba(255,255,255,0.04)",
                color: d.active ? "white" : "rgba(255,255,255,0.25)",
                border: d.active ? "1px solid rgba(255,107,53,0.5)" : "1px solid rgba(255,255,255,0.06)",
              }}>
              {new Date(d.date).getDate()}
            </div>
          ))}
        </div>
      </div>

      {/* Unlockable banner */}
      {data.unlockable_milestone && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg,rgba(255,215,0,0.25),rgba(255,107,53,0.1))", border: "1px solid rgba(255,215,0,0.4)" }}
          data-testid="streak-unlockable"
        >
          <div className="flex items-center gap-3">
            <Trophy size={22} className="text-[#FFD700]"/>
            <div className="flex-1">
              <p className="text-[13px] font-black text-white">{data.unlockable_milestone.label} erreicht!</p>
              <p className="text-[11px] text-white/70">
                {data.unlockable_milestone.blz ? `+${data.unlockable_milestone.blz} BLZ` : ""}
                {data.unlockable_milestone.eur ? ` + €${data.unlockable_milestone.eur}` : ""}
              </p>
            </div>
            <motion.button
              onClick={() => claim(data.unlockable_milestone.days)}
              disabled={claiming === data.unlockable_milestone.days}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-[#FFD700] text-black rounded-xl text-[12px] font-black disabled:opacity-50"
              data-testid={`streak-claim-${data.unlockable_milestone.days}`}
            >
              {claiming === data.unlockable_milestone.days ? <Loader2 size={13} className="animate-spin"/> : "Abholen"}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Milestones */}
      <div>
        <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Meilensteine</p>
        <div className="space-y-1.5">
          {data.milestones.map(m => (
            <div key={m.days}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{
                background: m.claimed ? "rgba(0,210,106,0.08)" : m.reached ? "rgba(255,184,0,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${m.claimed ? "rgba(0,210,106,0.25)" : m.reached ? "rgba(255,184,0,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
              data-testid={`milestone-${m.days}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: m.claimed ? "rgba(0,210,106,0.2)" : m.reached ? "rgba(255,184,0,0.2)" : "rgba(255,255,255,0.05)" }}>
                {m.claimed ? <Check size={14} className="text-[#00D26A]"/> : <Flame size={13} className={m.reached ? "text-[#FFB800]" : "text-white/30"}/>}
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold text-white">{m.label}</p>
                <p className="text-[10px] text-white/50">
                  {m.blz > 0 && `+${m.blz} BLZ`}{m.eur > 0 && ` + €${m.eur}`}
                </p>
              </div>
              {m.claimed ? (
                <span className="text-[10px] text-[#00D26A] font-bold">Erhalten</span>
              ) : m.reached ? (
                <button onClick={() => claim(m.days)} className="px-3 py-1.5 bg-[#FFB800] text-black rounded-lg text-[10px] font-black">Abholen</button>
              ) : (
                <span className="text-[10px] text-white/30">in {m.days - data.current_streak}d</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════ LEADERBOARD TAB ═══════════

const LEADERBOARD_TYPES = [
  { id: "earnings_week",  label: "Verdient",    icon: TrendingUp, color: "#00D26A", emoji: "💰" },
  { id: "mining_week",    label: "Mining",      icon: Sparkles,   color: "#00C2FF", emoji: "⚡" },
  { id: "referrals_week", label: "Empfehlungen",icon: Share2,     color: "#A855F7", emoji: "👥" },
  { id: "streak",         label: "Streak",      icon: Flame,      color: "#FF6B35", emoji: "🔥" },
];

const LeaderboardTab = () => {
  const [type, setType] = useState("earnings_week");
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api(`/api/leaderboard/${type}`),
      api("/api/leaderboard/me/rank"),
    ])
      .then(([lb, myRank]) => { setData(lb); setMe(myRank); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type]);

  const myValue = me ? me[type === "earnings_week" ? "earnings_week" : type === "mining_week" ? "mining_week" : "streak"] : 0;

  return (
    <div className="space-y-3" data-testid="leaderboard-tab">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {LEADERBOARD_TYPES.map(t => (
          <button key={t.id} onClick={() => setType(t.id)} data-testid={`lb-type-${t.id}`}
            className="px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1"
            style={{
              background: type === t.id ? `${t.color}20` : "rgba(255,255,255,0.03)",
              color: type === t.id ? t.color : "rgba(255,255,255,0.6)",
              border: `1px solid ${type === t.id ? `${t.color}40` : "rgba(255,255,255,0.06)"}`,
            }}>
            <t.icon size={12}/> {t.label}
          </button>
        ))}
      </div>

      {me && (
        <div className="rounded-xl p-3 flex items-center gap-3"
          style={{ background: "rgba(0,194,255,0.1)", border: "1px solid rgba(0,194,255,0.25)" }}
          data-testid="my-rank">
          <div className="w-8 h-8 rounded-lg bg-[#00C2FF]/20 flex items-center justify-center text-[11px] font-black text-[#00C2FF]">Du</div>
          <p className="flex-1 text-[12px] text-white/80">Dein Wert diese Woche</p>
          <p className="text-[14px] font-black text-white tabular-nums">
            {type === "earnings_week" ? `€${myValue}` : myValue}
          </p>
        </div>
      )}

      {loading ? <Loader2 className="animate-spin text-white/40 mx-auto my-8"/> :
       (data?.entries || []).length === 0 ? <p className="text-center text-[12px] text-white/40 py-8">Diese Woche noch keine Einträge</p> :
       <div className="space-y-1.5">
         {data.entries.map(e => (
          <div key={e.rank}
            className="rounded-xl p-3 flex items-center gap-3"
            style={{
              background: e.rank <= 3 ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${e.rank === 1 ? "rgba(255,215,0,0.4)" : e.rank <= 3 ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.06)"}`,
            }}
            data-testid={`lb-entry-${e.rank}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black"
              style={{
                background: e.rank === 1 ? "linear-gradient(135deg,#FFD700,#FFA500)" :
                            e.rank === 2 ? "linear-gradient(135deg,#C0C0C0,#808080)" :
                            e.rank === 3 ? "linear-gradient(135deg,#CD7F32,#8B4513)" : "rgba(255,255,255,0.05)",
                color: e.rank <= 3 ? "black" : "white",
              }}>
              {e.rank <= 3 ? ["🥇","🥈","🥉"][e.rank-1] : e.rank}
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-white">{e.name}</p>
            </div>
            <p className="text-[13px] font-black text-white tabular-nums">
              {type === "earnings_week" ? `€${e.value}` : e.value}
              <span className="text-[9px] text-white/40 ml-1 uppercase font-normal">{e.unit}</span>
            </p>
          </div>
         ))}
       </div>
      }
      <p className="text-[10px] text-white/30 text-center mt-4">
        Reset jeden Montag · Top 3 = €10/€5/€3 zusätzlich
      </p>
    </div>
  );
};

// ═══════════ EXCHANGE TAB ═══════════

const ExchangeTab = () => {
  const [rates, setRates] = useState(null);
  const [dir, setDir] = useState("buy_blz"); // buy_blz = EUR→BLZ
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRates(await api("/api/exchange/rates")); }
    catch (e) { toast.error(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!rates) return <Loader2 className="animate-spin text-white/40 mx-auto my-8"/>;

  const eur = parseFloat(amount) || 0;
  const receiveBlz = Math.floor(eur * rates.buy_rate);
  const needBlz = Math.floor(eur * rates.sell_rate);

  const execute = async () => {
    setBusy(true);
    try {
      const j = await api("/api/exchange/execute", {
        method: "POST", body: JSON.stringify({ direction: dir, amount: eur }),
      });
      toast.success(dir === "buy_blz" ? `+${j.blz} BLZ erhalten!` : `+€${j.eur} erhalten!`, { duration: 4000 });
      setAmount("5");
      await load();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4" data-testid="exchange-tab">
      {/* Balances */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl p-3" style={{ background: "rgba(0,194,255,0.1)", border: "1px solid rgba(0,194,255,0.25)" }}>
          <p className="text-[9px] text-white/50 uppercase tracking-wider">EUR-Guthaben</p>
          <p className="text-[18px] font-black text-[#00C2FF] tabular-nums">€{rates.balance_eur}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.25)" }}>
          <p className="text-[9px] text-white/50 uppercase tracking-wider">BLZ</p>
          <p className="text-[18px] font-black text-[#FFB800] tabular-nums">{rates.balance_blz}</p>
        </div>
      </div>

      {/* Direction toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setDir("buy_blz")} data-testid="dir-buy"
          className="py-3 rounded-xl text-[12px] font-bold"
          style={{
            background: dir === "buy_blz" ? "rgba(0,210,106,0.15)" : "rgba(255,255,255,0.03)",
            color: dir === "buy_blz" ? "#00D26A" : "rgba(255,255,255,0.6)",
            border: `1px solid ${dir === "buy_blz" ? "rgba(0,210,106,0.3)" : "rgba(255,255,255,0.06)"}`,
          }}>
          EUR → BLZ
        </button>
        <button onClick={() => setDir("sell_blz")} data-testid="dir-sell"
          className="py-3 rounded-xl text-[12px] font-bold"
          style={{
            background: dir === "sell_blz" ? "rgba(255,107,157,0.15)" : "rgba(255,255,255,0.03)",
            color: dir === "sell_blz" ? "#FF6B9D" : "rgba(255,255,255,0.6)",
            border: `1px solid ${dir === "sell_blz" ? "rgba(255,107,157,0.3)" : "rgba(255,255,255,0.06)"}`,
          }}>
          BLZ → EUR
        </button>
      </div>

      {/* Form */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Betrag in EUR</p>
        <input type="number" step="0.50" min={rates.min_eur} max={rates.remaining_today}
          value={amount} onChange={e => setAmount(e.target.value)}
          data-testid="exchange-amount"
          className="w-full px-3 py-3 bg-black/30 border border-white/10 rounded-xl text-[20px] font-black text-white tabular-nums focus:outline-none focus:border-[#00C2FF]"/>
        <div className="flex gap-1.5 mt-2">
          {[1, 5, 10, 25].map(a => (
            <button key={a} onClick={() => setAmount(String(a))}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-white/70 border border-white/10">
              €{a}
            </button>
          ))}
        </div>
      </div>

      {/* Rate display */}
      <div className="rounded-2xl p-4 text-center" style={{ background: "linear-gradient(135deg,rgba(0,194,255,0.1),rgba(168,85,247,0.08))", border: "1px solid rgba(0,194,255,0.2)" }}>
        <p className="text-[10px] text-white/50 uppercase tracking-wider">Du erhältst</p>
        <p className="text-[32px] font-black font-outfit tabular-nums" style={{ color: dir === "buy_blz" ? "#FFB800" : "#00D26A" }}>
          {dir === "buy_blz" ? `${receiveBlz} BLZ` : `€${eur.toFixed(2)}`}
        </p>
        <p className="text-[11px] text-white/60 mt-1">
          {dir === "buy_blz" ? `Kurs: 1 € = ${rates.buy_rate} BLZ` : `Du zahlst ${needBlz} BLZ · Kurs: ${rates.sell_rate} BLZ = 1 €`}
        </p>
      </div>

      <motion.button
        onClick={execute}
        disabled={busy || eur < rates.min_eur}
        whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-2xl font-black text-[14px] text-black disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg,#FFD700,#FFB800)" }}
        data-testid="exchange-execute"
      >
        {busy ? <Loader2 size={15} className="animate-spin"/> : <><ArrowLeftRight size={14}/>Tauschen</>}
      </motion.button>

      <p className="text-[10px] text-white/40 text-center">
        Tageslimit: €{rates.remaining_today} von €{rates.max_per_day} übrig
      </p>
    </div>
  );
};

// ═══════════ GIFT CODES TAB ═══════════

const GiftTab = () => {
  const [amount, setAmount] = useState("10");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [codes, setCodes] = useState([]);
  const [lastCreated, setLastCreated] = useState(null);

  const loadMyCodes = async () => {
    try { const d = await api("/api/gift/my-codes"); setCodes(d.codes || []); } catch {}
  };
  useEffect(() => { loadMyCodes(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const j = await api("/api/gift/create", {
        method: "POST",
        body: JSON.stringify({ amount_eur: parseFloat(amount), message: msg }),
      });
      setLastCreated(j);
      toast.success(`Code erstellt: ${j.code}`);
      setMsg(""); setAmount("10");
      await loadMyCodes();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const redeem = async () => {
    if (redeemCode.length < 6) return;
    setBusy(true);
    try {
      const j = await api("/api/gift/redeem", { method: "POST", body: JSON.stringify({ code: redeemCode }) });
      toast.success(`🎁 €${j.amount_eur} erhalten von ${j.from_name || "Freund"}!`, { duration: 5000 });
      setRedeemCode("");
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const copyShare = async (j) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "BidBlitz Geschenk", text: j.share_text, url: j.share_url });
      } else {
        await navigator.clipboard.writeText(j.share_text);
        toast.success("In Zwischenablage kopiert!");
      }
    } catch {}
  };

  return (
    <div className="space-y-4" data-testid="gift-tab">
      {/* Redeem */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(0,210,106,0.08)", border: "1px solid rgba(0,210,106,0.25)" }}>
        <p className="text-[12px] font-bold text-white mb-2 flex items-center gap-1.5">
          <Gift size={14} className="text-[#00D26A]"/> Geschenk-Code einlösen
        </p>
        <div className="flex gap-2">
          <input value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())}
            placeholder="GIFT-XXXX-XXXX" data-testid="redeem-input"
            className="flex-1 px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-[13px] font-mono focus:outline-none focus:border-[#00D26A]"/>
          <button onClick={redeem} disabled={busy || redeemCode.length < 6}
            className="px-4 py-2.5 bg-[#00D26A] text-black rounded-xl font-bold text-[12px] disabled:opacity-50"
            data-testid="redeem-btn">
            {busy ? <Loader2 size={13} className="animate-spin"/> : "Einlösen"}
          </button>
        </div>
      </div>

      {/* Create */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)" }}>
        <p className="text-[12px] font-bold text-white mb-2 flex items-center gap-1.5">
          <Plus size={14} className="text-[#A855F7]"/> Geschenk erstellen
        </p>
        <input type="number" min={1} max={100} step={1} value={amount} onChange={e => setAmount(e.target.value)}
          data-testid="gift-amount"
          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-[14px] tabular-nums focus:outline-none focus:border-[#A855F7] mb-2"/>
        <div className="flex gap-1.5 mb-2">
          {[5, 10, 25, 50].map(a => (
            <button key={a} onClick={() => setAmount(String(a))}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 text-white/70 border border-white/10">
              €{a}
            </button>
          ))}
        </div>
        <input value={msg} onChange={e => setMsg(e.target.value)} maxLength={200}
          placeholder="Persönliche Nachricht (optional)" data-testid="gift-msg"
          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-[12px] focus:outline-none focus:border-[#A855F7] mb-2"/>
        <button onClick={create} disabled={busy || !amount || parseFloat(amount) < 1}
          className="w-full py-3 rounded-xl bg-[#A855F7] text-white font-black text-[12px] disabled:opacity-50"
          data-testid="gift-create">
          {busy ? <Loader2 size={13} className="animate-spin inline"/> : "Geschenk erstellen"}
        </button>
      </div>

      {/* Last created */}
      {lastCreated && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg,#FFD700,#FFB800)" }}
          data-testid="gift-last">
          <p className="text-[10px] font-black text-black uppercase tracking-wider">Dein Code</p>
          <p className="text-[22px] font-black text-black font-mono mt-1">{lastCreated.code}</p>
          <p className="text-[11px] text-black/70">€{lastCreated.amount_eur}</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => copyShare(lastCreated)}
              className="py-2 rounded-lg bg-black text-white text-[11px] font-bold flex items-center justify-center gap-1">
              <Share2 size={11}/> Teilen
            </button>
            <button onClick={() => { navigator.clipboard.writeText(lastCreated.code); toast.success("Code kopiert"); }}
              className="py-2 rounded-lg bg-black/20 text-black text-[11px] font-bold flex items-center justify-center gap-1">
              <Copy size={11}/> Code kopieren
            </button>
          </div>
        </motion.div>
      )}

      {/* My codes */}
      {codes.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Meine Codes ({codes.length})</p>
          <div className="space-y-1.5">
            {codes.slice(0, 10).map(c => (
              <div key={c.code} className="rounded-xl p-3 bg-white/5 border border-white/10 flex items-center gap-3"
                data-testid={`gift-code-${c.code}`}>
                <Gift size={16} className={c.redeemed ? "text-[#00D26A]" : "text-[#A855F7]"}/>
                <div className="flex-1">
                  <p className="text-[12px] font-mono text-white">{c.code}</p>
                  <p className="text-[10px] text-white/50">
                    €{c.amount_eur} · {c.redeemed ? `✓ von ${c.redeemed_by_name || "jemand"}` : "Unbenutzt"}
                  </p>
                </div>
                {!c.redeemed && (
                  <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Kopiert"); }}
                    className="p-1.5 rounded-lg bg-white/5">
                    <Copy size={11} className="text-white/60"/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════ MAIN ═══════════

export default function RetentionHubPage({ onBack }) {
  const [tab, setTab] = useState("streak");

  return (
    <div className="min-h-screen bg-[#060810] pb-24" data-testid="retention-hub">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="retention-back">
            <ArrowLeft size={16} className="text-white/70"/>
          </button>
          <h1 className="text-[14px] font-bold text-white">Belohnungen & Community</h1>
        </div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
          {[
            { id: "streak", label: "Streak", icon: Flame },
            { id: "leaderboard", label: "Top", icon: Trophy },
            { id: "exchange", label: "Tauschen", icon: ArrowLeftRight },
            { id: "gift", label: "Geschenk", icon: Gift },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`retention-tab-${t.id}`}
              className="flex-1 min-w-[75px] py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1"
              style={{
                background: tab === t.id ? "rgba(255,107,53,0.15)" : "transparent",
                color: tab === t.id ? "#FF6B35" : "rgba(255,255,255,0.5)",
                border: tab === t.id ? "1px solid rgba(255,107,53,0.3)" : "1px solid transparent",
              }}>
              <t.icon size={12}/>{t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {tab === "streak" && <StreakTab/>}
            {tab === "leaderboard" && <LeaderboardTab/>}
            {tab === "exchange" && <ExchangeTab/>}
            {tab === "gift" && <GiftTab/>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
