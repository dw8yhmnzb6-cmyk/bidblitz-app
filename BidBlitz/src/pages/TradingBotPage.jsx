import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Play, Square, Loader2 } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function TradingBotPage({ onBack }) {
  const [strategies, setStrategies] = useState([]);
  const [bots, setBots] = useState([]);
  const [tab, setTab] = useState("strategies");
  const [sel, setSel] = useState(null);
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch(`${API}/api/trading-bot/strategies`).then(r => r.json()).then(d => setStrategies(d.strategies || [])).catch(() => {});
    fetch(`${API}/api/trading-bot/my-bots`, { credentials: "include" }).then(r => r.json()).then(d => setBots(d.bots || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const start = async () => {
    if (!sel || !budget) return; setLoading(true);
    try {
      const r = await fetch(`${API}/api/trading-bot/start`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_id: sel.id, budget_eur: parseFloat(budget) }) });
      const d = await r.json(); setMsg(d.message || d.detail);
      if (r.ok) { setSel(null); setBudget(""); load(); setTab("bots"); }
    } catch { setMsg("Fehler"); } setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  const stop = async (id) => {
    const r = await fetch(`${API}/api/trading-bot/stop/${id}`, { method: "POST", credentials: "include" });
    const d = await r.json(); setMsg(d.message || d.detail); load(); setTimeout(() => setMsg(""), 4000);
  };

  const riskColors = { "Sehr Niedrig": "text-green-400", "Niedrig": "text-green-400", "Mittel": "text-yellow-400", "Hoch": "text-red-400" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="trading-bot-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><Bot size={18} className="text-indigo-400" /> AI Trading Bot</h1>
            <p className="text-[10px] text-indigo-400">Automatisierter Handel</p></div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "strategies", label: "Strategien" }, { id: "bots", label: `Meine Bots (${bots.filter(b=>b.status==="running").length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-indigo-500 text-white" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {tab === "strategies" && !sel && strategies.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSel(s)} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06]" data-testid={`strategy-${s.id}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.color + "20" }}><Bot size={18} style={{ color: s.color }} /></div>
                <div><p className="text-sm font-bold">{s.name}</p><p className="text-[10px] text-gray-500">{s.desc}</p></div>
              </div>
              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-gray-400">{s.type}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Min: {s.min_budget} EUR</span><span>Est: {s.est_return}</span>
              <span className={riskColors[s.risk] || "text-gray-400"}>Risiko: {s.risk}</span>
            </div>
          </motion.div>
        ))}
        {tab === "strategies" && sel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 space-y-3">
            <p className="text-lg font-bold">{sel.name}</p>
            <p className="text-xs text-gray-400">{sel.desc} · {sel.type} · {sel.coin} · Min: {sel.min_budget} EUR</p>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Budget in EUR"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" data-testid="bot-budget" />
            <div className="flex gap-2">
              <button onClick={() => setSel(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Abbrechen</button>
              <button onClick={start} disabled={loading || !budget} className="flex-1 py-3 bg-indigo-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1" data-testid="bot-start">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><Play size={14} /> Starten</>}</button>
            </div>
          </motion.div>
        )}
        {tab === "bots" && bots.length === 0 && <p className="text-center text-gray-600 py-12">Keine Bots aktiv</p>}
        {tab === "bots" && bots.map((b, i) => (
          <motion.div key={b.bot_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`bot-${i}`}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-bold">{b.strategy_name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${b.status === "running" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>{b.status}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Budget: {b.budget_eur} EUR</span><span>Trades: {b.trades_executed}</span>
            </div>
            <div className="flex justify-between items-center">
              <p className={`text-lg font-bold ${(b.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{(b.pnl||0) >= 0 ? "+" : ""}{(b.pnl||0).toFixed(2)} EUR ({(b.pnl_pct||0).toFixed(1)}%)</p>
              {b.status === "running" && <button onClick={() => stop(b.bot_id)} className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-1"><Square size={10} /> Stop</button>}
            </div>
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
