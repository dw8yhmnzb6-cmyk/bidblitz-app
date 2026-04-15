import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Globe, Layers, ArrowLeftRight, Copy, ExternalLink, Loader2, Shield } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function DeFiWalletPage({ onBack }) {
  const [wallet, setWallet] = useState(null);
  const [dapps, setDapps] = useState([]);
  const [chains, setChains] = useState([]);
  const [tab, setTab] = useState("wallet");
  const [swapForm, setSwapForm] = useState({ from: "ETH", to: "USDT", amount: "", chain: "ethereum" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/defi-wallet/my-wallet`, { credentials: "include" }).then(r => r.json()).then(d => setWallet(d)).catch(() => {});
    fetch(`${API}/api/defi-wallet/dapps`).then(r => r.json()).then(d => { setDapps(d.dapps || []); setChains(d.chains || []); }).catch(() => {});
  }, []);

  const createWallet = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/defi-wallet/create`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "" }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) {
        setWallet({ has_wallet: true, wallet: { address: d.address } });
        if (d.seed_phrase) {
          alert(`WICHTIG! Speichere deine Seed Phrase sicher:\n\n${d.seed_phrase}\n\nDiese wird NICHT erneut angezeigt!`);
        }
      }
    } catch { setMsg("Fehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 5000);
  };

  const swap = async () => {
    if (!swapForm.amount) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/defi-wallet/swap`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_token: swapForm.from, to_token: swapForm.to, amount: parseFloat(swapForm.amount), chain: swapForm.chain }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) setSwapForm({ ...swapForm, amount: "" });
    } catch { setMsg("Fehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const copyAddress = () => {
    if (wallet?.wallet?.address) {
      navigator.clipboard.writeText(wallet.wallet.address);
      setMsg("Adresse kopiert!");
      setTimeout(() => setMsg(""), 2000);
    }
  };

  const catIcons = { DEX: ArrowLeftRight, Lending: Layers, Staking: Layers, NFT: Globe, Perpetuals: Zap };
  const Zap = ({ size, className }) => <span className={className} style={{ fontSize: size }}>Z</span>;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="defi-wallet-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="defi-back-btn"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2"><Globe size={18} className="text-emerald-400" /> DeFi Wallet</h1>
            <p className="text-[10px] text-emerald-400">Self-Custody & DApp Browser</p>
          </div>
        </div>
        {wallet?.has_wallet && (
          <div className="flex gap-2 mt-3">
            {[{ id: "wallet", label: "Wallet" }, { id: "swap", label: "Swap" }, { id: "dapps", label: "DApps" }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.id ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {!wallet?.has_wallet && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Shield size={36} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold mb-2">Dein DeFi Wallet</h2>
            <p className="text-sm text-gray-400 mb-1">Volle Kontrolle ueber deine Private Keys</p>
            <p className="text-[11px] text-gray-600 mb-6">Multi-Chain: Ethereum, Solana, BNB, Arbitrum, Polygon</p>
            <button onClick={createWallet} disabled={loading}
              className="px-8 py-4 bg-emerald-500 text-black font-bold rounded-xl disabled:opacity-50" data-testid="create-defi-wallet-btn">
              {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : "DeFi Wallet erstellen"}
            </button>
          </motion.div>
        )}

        {wallet?.has_wallet && tab === "wallet" && (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border border-emerald-500/20">
              <p className="text-[10px] text-emerald-400 font-bold mb-1">WALLET ADRESSE</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono text-gray-300 truncate flex-1">{wallet.wallet.address}</p>
                <button onClick={copyAddress} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center" data-testid="copy-address-btn">
                  <Copy size={14} className="text-emerald-400" />
                </button>
              </div>
            </motion.div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Unterstuetzte Chains</p>
            <div className="grid grid-cols-2 gap-2">
              {chains.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: c.color + "20", color: c.color }}>{c.symbol}</div>
                  <div>
                    <p className="text-xs font-bold">{c.name}</p>
                    <p className="text-[9px] text-gray-500">{c.symbol}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {wallet?.has_wallet && tab === "swap" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-4">
            <p className="text-sm font-bold">Token tauschen</p>
            <div className="flex gap-2">
              <input value={swapForm.from} onChange={e => setSwapForm({ ...swapForm, from: e.target.value })} placeholder="Von"
                className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
              <div className="flex items-center"><ArrowLeftRight size={16} className="text-gray-500" /></div>
              <input value={swapForm.to} onChange={e => setSwapForm({ ...swapForm, to: e.target.value })} placeholder="Nach"
                className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
            </div>
            <input type="number" value={swapForm.amount} onChange={e => setSwapForm({ ...swapForm, amount: e.target.value })} placeholder="Betrag"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-emerald-500/40" data-testid="swap-amount-input" />
            <select value={swapForm.chain} onChange={e => setSwapForm({ ...swapForm, chain: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none text-gray-300">
              {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={swap} disabled={loading || !swapForm.amount}
              className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold text-sm disabled:opacity-50" data-testid="swap-btn">
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Tauschen"}
            </button>
          </motion.div>
        )}

        {wallet?.has_wallet && tab === "dapps" && (
          <>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Beliebte DApps</p>
            {dapps.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
                data-testid={`dapp-${d.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: d.color + "20", color: d.color }}>
                    {d.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{d.name}</p>
                    <p className="text-[10px] text-gray-500">{d.desc}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[8px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">{d.category}</span>
                      <span className="text-[8px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">{d.chain}</span>
                      {d.tvl !== "N/A" && <span className="text-[8px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">TVL: ${d.tvl}</span>}
                    </div>
                  </div>
                </div>
                <ExternalLink size={16} className="text-gray-600" />
              </motion.div>
            ))}
          </>
        )}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
