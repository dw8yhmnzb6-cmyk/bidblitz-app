import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, Clock, Coins, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function SuperchargerPage({ onBack }) {
  const [pools, setPools] = useState([]);
  const [stakes, setStakes] = useState([]);
  const [tab, setTab] = useState("pools");
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/supercharger/pools`).then(r => r.json()).then(d => setPools(d.pools || [])).catch(() => {});
    fetch(`${API}/api/supercharger/my-stakes`, { credentials: "include" }).then(r => r.json()).then(d => setStakes(d.stakes || [])).catch(() => {});
  }, []);

  const stake = async () => {
    if (!selected || !amount) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/supercharger/deposit`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pool_id: selected.id, amount: parseFloat(amount) }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) { setSelected(null); setAmount(""); setTab("stakes");
        fetch(`${API}/api/supercharger/my-stakes`, { credentials: "include" }).then(r => r.json()).then(d => setStakes(d.stakes || []));
      }
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const coinColors = { BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", USDT: "#26A17B" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="supercharger-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="sc-back-btn"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2"><Zap size={18} className="text-cyan-400" /> Supercharger</h1>
            <p className="text-[10px] text-cyan-400">BLZ staken, Rewards verdienen</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "pools", label: "Pools" }, { id: "stakes", label: "Meine Stakes" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.id ? "bg-cyan-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {tab === "pools" && !selected && pools.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSelected(p)}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06]"
            data-testid={`pool-${p.id}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
                  style={{ background: (coinColors[p.reward_coin] || "#666") + "20", color: coinColors[p.reward_coin] }}>
                  {p.reward_coin}
                </div>
                <div>
                  <p className="text-sm font-bold">Verdiene {p.reward_coin}</p>
                  <p className="text-[10px] text-gray-500">Stake {p.accept_coin} · {p.participants.toLocaleString()} Teilnehmer</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-cyan-400">~{p.apy_est}%</p>
                <p className="text-[9px] text-gray-500">est. APY</p>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Pool: {p.total_pool} {p.reward_coin}</span>
              <span className="flex items-center gap-1"><Clock size={10} /> {p.ends_in_days} Tage uebrig</span>
            </div>
          </motion.div>
        ))}

        {tab === "pools" && selected && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
              <p className="text-lg font-bold mb-1">Verdiene {selected.reward_coin}</p>
              <p className="text-xs text-gray-400 mb-4">Stake BLZ-Tokens · ~{selected.apy_est}% APY · Pool: {selected.total_pool} {selected.reward_coin}</p>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="BLZ Betrag"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-cyan-500/40" data-testid="sc-amount-input" />
              {amount && <p className="text-[11px] text-gray-500 mt-2">Geschaetzte Rewards: <span className="text-cyan-400 font-bold">{(parseFloat(amount || 0) * selected.apy_est / 100 / 12).toFixed(4)} {selected.reward_coin}/Monat</span></p>}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setSelected(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Abbrechen</button>
                <button onClick={stake} disabled={loading || !amount}
                  className="flex-1 py-3 bg-cyan-500 text-black rounded-xl text-sm font-bold disabled:opacity-50" data-testid="sc-stake-btn">
                  {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Staken"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "stakes" && stakes.length === 0 && <p className="text-center text-gray-600 py-12">Noch nichts gestaked</p>}
        {tab === "stakes" && stakes.map((s, i) => (
          <motion.div key={s.deposit_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`stake-${i}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold">{s.amount_blz} BLZ gestaked</p>
                <p className="text-[10px] text-gray-500">Reward: ~{s.estimated_reward} {s.reward_coin}/Monat</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">{s.status}</span>
            </div>
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
