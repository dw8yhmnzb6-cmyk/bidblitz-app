import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Zap, Loader2, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function DerivativesPage({ onBack }) {
  const [pairs, setPairs] = useState([]);
  const [positions, setPositions] = useState([]);
  const [tab, setTab] = useState("trade");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ direction: "long", leverage: 10, margin: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch(`${API}/api/derivatives/pairs`).then(r => r.json()).then(d => setPairs(d.pairs || [])).catch(() => {});
    fetch(`${API}/api/derivatives/positions`, { credentials: "include" }).then(r => r.json()).then(d => setPositions(d.positions || [])).catch(() => {});
  };
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, []);

  const openPos = async () => {
    if (!selected || !form.margin) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/derivatives/open`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair: selected.pair, direction: form.direction, leverage: form.leverage, margin_eur: parseFloat(form.margin) }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) { setSelected(null); setForm({ direction: "long", leverage: 10, margin: "" }); load(); setTab("positions"); }
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const closePos = async (id) => {
    const r = await fetch(`${API}/api/derivatives/close/${id}`, { method: "POST", credentials: "include" });
    const d = await r.json();
    setMsg(d.message || d.detail);
    load();
    setTimeout(() => setMsg(""), 4000);
  };

  const leverages = [2, 5, 10, 25, 50, 100];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="derivatives-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="deriv-back-btn"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2"><Zap size={18} className="text-orange-400" /> Derivatives</h1>
            <p className="text-[10px] text-orange-400">Hebel-Trading · Futures & Optionen</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "trade", label: "Handeln" }, { id: "positions", label: `Positionen (${positions.filter(p => p.status === "open").length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.id ? "bg-orange-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {tab === "trade" && !selected && pairs.map((p, i) => (
          <motion.div key={p.pair} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSelected(p)}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.06]"
            data-testid={`pair-${p.pair.replace("/", "-")}`}>
            <div>
              <p className="text-sm font-bold">{p.pair}</p>
              <p className={`text-[10px] ${p.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>{p.change_24h > 0 ? "+" : ""}{p.change_24h}% (24h)</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{p.price < 1 ? p.price.toFixed(4) : p.price.toLocaleString("de-DE", { maximumFractionDigits: 2 })} EUR</p>
              <p className="text-[9px] text-gray-500">Funding: {p.funding_rate}%</p>
            </div>
          </motion.div>
        ))}

        {tab === "trade" && selected && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="p-5 rounded-2xl border border-orange-500/20 bg-orange-500/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-lg font-bold">{selected.pair}</p>
                <button onClick={() => setSelected(null)}><X size={18} className="text-gray-500" /></button>
              </div>
              <p className="text-2xl font-bold mb-4">{selected.price < 1 ? selected.price.toFixed(4) : selected.price.toLocaleString("de-DE")} EUR</p>

              <div className="flex gap-2 mb-4">
                <button onClick={() => setForm({ ...form, direction: "long" })}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 ${form.direction === "long" ? "bg-green-500 text-black" : "bg-white/5 text-gray-400"}`}>
                  <TrendingUp size={14} /> Long
                </button>
                <button onClick={() => setForm({ ...form, direction: "short" })}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 ${form.direction === "short" ? "bg-red-500 text-white" : "bg-white/5 text-gray-400"}`}>
                  <TrendingDown size={14} /> Short
                </button>
              </div>

              <p className="text-[10px] text-gray-500 mb-2">Hebel</p>
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {leverages.map(l => (
                  <button key={l} onClick={() => setForm({ ...form, leverage: l })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${form.leverage === l ? "bg-orange-500 text-black" : "bg-white/5 text-gray-400"}`}>x{l}</button>
                ))}
              </div>

              <input type="number" value={form.margin} onChange={e => setForm({ ...form, margin: e.target.value })} placeholder="Margin in EUR"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-orange-500/40 mb-2" data-testid="deriv-margin-input" />
              {form.margin && <p className="text-[11px] text-gray-500">Positionsgroesse: <span className="text-orange-400 font-bold">{(parseFloat(form.margin || 0) * form.leverage).toLocaleString("de-DE")} EUR</span></p>}

              <button onClick={openPos} disabled={loading || !form.margin}
                className={`w-full py-4 mt-4 rounded-xl font-bold text-sm ${form.direction === "long" ? "bg-green-500 text-black" : "bg-red-500 text-white"} disabled:opacity-50`}
                data-testid="deriv-open-btn">
                {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : `${form.direction.toUpperCase()} x${form.leverage} oeffnen`}
              </button>
            </div>
          </motion.div>
        )}

        {tab === "positions" && positions.filter(p => p.status === "open").length === 0 && <p className="text-center text-gray-600 py-12">Keine offenen Positionen</p>}
        {tab === "positions" && positions.map((p, i) => (
          <motion.div key={p.position_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`position-${i}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.direction === "long" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                  {p.direction.toUpperCase()} x{p.leverage}
                </span>
                <p className="text-sm font-bold">{p.pair}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === "open" ? "bg-blue-500/10 text-blue-400" : "bg-gray-500/10 text-gray-400"}`}>{p.status}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Margin: {p.margin_eur} EUR</span>
              <span>Einstieg: {p.entry_price}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <p className={`text-lg font-bold ${(p.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(p.pnl || 0) >= 0 ? "+" : ""}{(p.pnl || 0).toFixed(2)} EUR
              </p>
              {p.status === "open" && (
                <button onClick={() => closePos(p.position_id)} className="px-4 py-1.5 bg-white/5 rounded-lg text-xs font-medium hover:bg-white/10">Schliessen</button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-orange-500/20 border border-orange-500/30 rounded-xl text-orange-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
