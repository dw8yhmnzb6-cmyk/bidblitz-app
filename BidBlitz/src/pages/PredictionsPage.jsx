import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Target, TrendingUp, Clock, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const catColors = { Crypto: "#F7931A", Politik: "#EF4444", Sport: "#22C55E", Technologie: "#8B5CF6", Aktien: "#3B82F6" };

export default function PredictionsPage({ onBack }) {
  const [markets, setMarkets] = useState([]);
  const [bets, setBets] = useState([]);
  const [tab, setTab] = useState("markets");
  const [selected, setSelected] = useState(null);
  const [side, setSide] = useState("yes");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/predictions/markets`).then(r => r.json()).then(d => setMarkets(d.markets || [])).catch(() => {});
    fetch(`${API}/api/predictions/my-bets`, { credentials: "include" }).then(r => r.json()).then(d => setBets(d.bets || [])).catch(() => {});
  }, []);

  const placeBet = async () => {
    if (!selected || !amount) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/predictions/bet`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: selected.id, side, amount_eur: parseFloat(amount) }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) { setSelected(null); setAmount(""); setTab("bets");
        fetch(`${API}/api/predictions/my-bets`, { credentials: "include" }).then(r => r.json()).then(d => setBets(d.bets || []));
      }
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="predictions-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="pred-back-btn"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2"><Target size={18} className="text-purple-400" /> Prediction Markets</h1>
            <p className="text-[10px] text-purple-400">Wette auf die Zukunft</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "markets", label: "Maerkte" }, { id: "bets", label: "Meine Wetten" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.id ? "bg-purple-500 text-white" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {tab === "markets" && !selected && markets.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSelected(m)}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06]"
            data-testid={`market-${m.id}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: (catColors[m.category] || "#666") + "20", color: catColors[m.category] }}>{m.category}</span>
              <span className="text-[9px] text-gray-500 flex items-center gap-1"><Clock size={9} /> bis {m.ends}</span>
            </div>
            <p className="text-sm font-bold mb-3">{m.title}</p>
            <div className="flex gap-2">
              <div className="flex-1 p-2.5 rounded-xl bg-green-500/10 text-center">
                <p className="text-[9px] text-gray-400">JA</p>
                <p className="text-lg font-black text-green-400">{m.yes_odds}x</p>
              </div>
              <div className="flex-1 p-2.5 rounded-xl bg-red-500/10 text-center">
                <p className="text-[9px] text-gray-400">NEIN</p>
                <p className="text-lg font-black text-red-400">{m.no_odds}x</p>
              </div>
            </div>
            <p className="text-[9px] text-gray-600 mt-2 text-right">Volumen: {m.volume.toLocaleString("de-DE")} EUR</p>
          </motion.div>
        ))}

        {tab === "markets" && selected && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5">
              <p className="text-sm font-bold mb-1">{selected.title}</p>
              <p className="text-[10px] text-gray-400 mb-4">{selected.category} · Endet {selected.ends}</p>

              <div className="flex gap-2 mb-4">
                <button onClick={() => setSide("yes")}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm ${side === "yes" ? "bg-green-500 text-black" : "bg-white/5 text-gray-400"}`}>
                  JA ({selected.yes_odds}x)
                </button>
                <button onClick={() => setSide("no")}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm ${side === "no" ? "bg-red-500 text-white" : "bg-white/5 text-gray-400"}`}>
                  NEIN ({selected.no_odds}x)
                </button>
              </div>

              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Einsatz in EUR"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-purple-500/40" data-testid="pred-amount-input" />
              {amount && (
                <p className="text-[11px] text-gray-500 mt-2">
                  Moeglicher Gewinn: <span className="text-purple-400 font-bold">{(parseFloat(amount || 0) * (side === "yes" ? selected.yes_odds : selected.no_odds)).toFixed(2)} EUR</span>
                </p>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setSelected(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Abbrechen</button>
                <button onClick={placeBet} disabled={loading || !amount}
                  className="flex-1 py-3 bg-purple-500 text-white rounded-xl text-sm font-bold disabled:opacity-50" data-testid="pred-bet-btn">
                  {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Wette platzieren"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "bets" && bets.length === 0 && <p className="text-center text-gray-600 py-12">Noch keine Wetten</p>}
        {tab === "bets" && bets.map((b, i) => (
          <motion.div key={b.bet_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`bet-${i}`}>
            <p className="text-sm font-bold mb-1">{b.market_title}</p>
            <div className="flex justify-between text-xs text-gray-400">
              <span className={`font-bold ${b.side === "yes" ? "text-green-400" : "text-red-400"}`}>{b.side === "yes" ? "JA" : "NEIN"} ({b.odds}x)</span>
              <span>{b.amount_eur} EUR</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Moeglicher Gewinn: {b.potential_win} EUR</p>
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
