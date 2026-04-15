import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Lock, Unlock, Clock, Coins, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CryptoEarnPage({ onBack }) {
  const [products, setProducts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [tab, setTab] = useState("products");
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/crypto-earn/products`).then(r => r.json()).then(d => setProducts(d.products || [])).catch(() => {});
    fetch(`${API}/api/crypto-earn/my-deposits`, { credentials: "include" }).then(r => r.json()).then(d => setDeposits(d.deposits || [])).catch(() => {});
  }, []);

  const deposit = async () => {
    if (!selected || !amount) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/crypto-earn/deposit`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: selected.id, amount: parseFloat(amount) }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail || "Fehler");
      if (r.ok) { setSelected(null); setAmount(""); setTab("deposits");
        fetch(`${API}/api/crypto-earn/my-deposits`, { credentials: "include" }).then(r => r.json()).then(d => setDeposits(d.deposits || []));
      }
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const withdraw = async (id) => {
    const r = await fetch(`${API}/api/crypto-earn/withdraw/${id}`, { method: "POST", credentials: "include" });
    const d = await r.json();
    setMsg(d.message || d.detail);
    fetch(`${API}/api/crypto-earn/my-deposits`, { credentials: "include" }).then(r => r.json()).then(d => setDeposits(d.deposits || []));
    setTimeout(() => setMsg(""), 3000);
  };

  const coinColors = { BTC: "#F7931A", ETH: "#627EEA", USDT: "#26A17B", SOL: "#9945FF", BNB: "#F3BA2F" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="crypto-earn-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="earn-back-btn"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2"><Coins size={18} className="text-amber-400" /> Crypto Earn</h1>
            <p className="text-[10px] text-amber-400">Zinsen verdienen auf deine Coins</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "products", label: "Produkte" }, { id: "deposits", label: "Meine Einlagen" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.id ? "bg-amber-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {tab === "products" && !selected && products.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSelected(p)}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition-all"
            data-testid={`earn-product-${p.id}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: `${coinColors[p.coin] || "#666"}20`, color: coinColors[p.coin] || "#666" }}>
                {p.coin}
              </div>
              <div>
                <p className="text-sm font-bold">{p.name}</p>
                <p className="text-[10px] text-gray-500 flex items-center gap-1">{p.lock_days > 0 ? <><Lock size={10} /> {p.term}</> : <><Unlock size={10} /> {p.term}</>}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-green-400">{p.apy}%</p>
              <p className="text-[9px] text-gray-500">APY</p>
            </div>
          </motion.div>
        ))}

        {tab === "products" && selected && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-bold">{selected.name}</p>
                  <p className="text-xs text-gray-400">{selected.term} · Min: {selected.min} {selected.coin}</p>
                </div>
                <p className="text-2xl font-black text-green-400">{selected.apy}%</p>
              </div>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={`Betrag in ${selected.coin}`}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-amber-500/40"
                data-testid="earn-amount-input" />
              {amount && <p className="text-[11px] text-gray-500 mt-2">Geschaetzte Zinsen/Jahr: <span className="text-green-400 font-bold">{(parseFloat(amount || 0) * selected.apy / 100).toFixed(6)} {selected.coin}</span></p>}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setSelected(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-sm font-medium">Abbrechen</button>
                <button onClick={deposit} disabled={loading || !amount} className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-sm font-bold disabled:opacity-50" data-testid="earn-deposit-btn">
                  {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Einzahlen"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "deposits" && deposits.length === 0 && <p className="text-center text-gray-600 py-12">Noch keine Einlagen</p>}
        {tab === "deposits" && deposits.map((d, i) => (
          <motion.div key={d.deposit_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`deposit-${i}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: `${coinColors[d.coin] || "#666"}20`, color: coinColors[d.coin] }}>
                  {d.coin}
                </div>
                <div>
                  <p className="text-sm font-bold">{d.amount} {d.coin}</p>
                  <p className="text-[10px] text-gray-500">{d.apy}% APY · {d.term}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.status === "active" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                {d.status === "active" ? "Aktiv" : "Ausgezahlt"}
              </span>
            </div>
            {d.status === "active" && (
              <button onClick={() => withdraw(d.deposit_id)} className="w-full py-2 mt-2 bg-white/5 rounded-xl text-xs text-gray-400 hover:text-white transition-all">Auszahlen</button>
            )}
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
