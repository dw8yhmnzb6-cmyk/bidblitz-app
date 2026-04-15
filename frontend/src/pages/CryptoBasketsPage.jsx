import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, PieChart, TrendingUp, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CryptoBasketsPage({ onBack }) {
  const [baskets, setBaskets] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [tab, setTab] = useState("browse");
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/crypto-baskets/list`).then(r => r.json()).then(d => setBaskets(d.baskets || [])).catch(() => {});
    fetch(`${API}/api/crypto-baskets/my-baskets`, { credentials: "include" }).then(r => r.json()).then(d => setPurchases(d.purchases || [])).catch(() => {});
  }, []);

  const buy = async () => {
    if (!selected || !amount) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/crypto-baskets/buy`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basket_id: selected.id, amount_eur: parseFloat(amount) }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) { setSelected(null); setAmount(""); setTab("my");
        fetch(`${API}/api/crypto-baskets/my-baskets`, { credentials: "include" }).then(r => r.json()).then(d => setPurchases(d.purchases || []));
      }
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="crypto-baskets-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="baskets-back-btn"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2"><PieChart size={18} className="text-blue-400" /> Crypto Baskets</h1>
            <p className="text-[10px] text-blue-400">Thematisch diversifizieren</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "browse", label: "Entdecken" }, { id: "my", label: "Meine Baskets" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.id ? "bg-blue-500 text-white" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {tab === "browse" && !selected && baskets.map((b, i) => (
          <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSelected(b)}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06] transition-all"
            data-testid={`basket-${b.id}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${b.color}20` }}>
                  <PieChart size={18} style={{ color: b.color }} />
                </div>
                <div>
                  <p className="text-sm font-bold">{b.name}</p>
                  <p className="text-[10px] text-gray-500">{b.desc}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-500">{b.fee}% Gebuehr</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 p-2 rounded-lg bg-white/[0.02]">
                <p className="text-[9px] text-gray-500">7 Tage</p>
                <p className={`text-sm font-bold ${b.perf_7d >= 0 ? "text-green-400" : "text-red-400"}`}>{b.perf_7d > 0 ? "+" : ""}{b.perf_7d}%</p>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-white/[0.02]">
                <p className="text-[9px] text-gray-500">30 Tage</p>
                <p className={`text-sm font-bold ${b.perf_30d >= 0 ? "text-green-400" : "text-red-400"}`}>{b.perf_30d > 0 ? "+" : ""}{b.perf_30d}%</p>
              </div>
            </div>
            {/* Coin weight bars */}
            <div className="flex gap-0.5 mt-3 h-2 rounded-full overflow-hidden">
              {b.coins.map((c, j) => (
                <div key={j} style={{ width: `${c.weight}%`, background: b.color, opacity: 1 - j * 0.15 }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {b.coins.map((c, j) => <span key={j} className="text-[8px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{c.coin} {c.weight}%</span>)}
            </div>
          </motion.div>
        ))}

        {tab === "browse" && selected && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
              <p className="text-lg font-bold mb-1">{selected.name}</p>
              <p className="text-xs text-gray-400 mb-4">{selected.desc} · {selected.fee}% Management-Gebuehr</p>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Betrag in EUR"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-blue-500/40" data-testid="basket-amount-input" />
              {amount && <p className="text-[11px] text-gray-500 mt-2">Gebuehr: <span className="text-blue-400">{(parseFloat(amount || 0) * selected.fee / 100).toFixed(2)} EUR</span></p>}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setSelected(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Abbrechen</button>
                <button onClick={buy} disabled={loading || !amount} className="flex-1 py-3 bg-blue-500 text-white rounded-xl text-sm font-bold disabled:opacity-50" data-testid="basket-buy-btn">
                  {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Kaufen"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "my" && purchases.length === 0 && <p className="text-center text-gray-600 py-12">Noch keine Baskets gekauft</p>}
        {tab === "my" && purchases.map((p, i) => (
          <motion.div key={p.purchase_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`my-basket-${i}`}>
            <div className="flex justify-between items-center">
              <p className="text-sm font-bold">{p.basket_name}</p>
              <p className="text-sm font-bold text-blue-400">{p.amount_eur} EUR</p>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Gebuehr: {p.fee} EUR · {new Date(p.created_at).toLocaleDateString("de-DE")}</p>
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
