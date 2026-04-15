import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Landmark, Loader2, Shield } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function CryptoLoansPage({ onBack }) {
  const [options, setOptions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [tab, setTab] = useState("new");
  const [sel, setSel] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/crypto-loans/options`).then(r => r.json()).then(d => setOptions(d.collaterals || [])).catch(() => {});
    fetch(`${API}/api/crypto-loans/my-loans`, { credentials: "include" }).then(r => r.json()).then(d => setLoans(d.loans || [])).catch(() => {});
  }, []);

  const request = async () => {
    if (!sel || !amount) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/crypto-loans/request`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collateral_coin: sel.coin, collateral_amount: parseFloat(amount) }) });
      const d = await r.json(); setMsg(d.message || d.detail);
      if (r.ok) { setSel(null); setAmount(""); setTab("loans");
        fetch(`${API}/api/crypto-loans/my-loans`, { credentials: "include" }).then(r => r.json()).then(d => setLoans(d.loans || [])); }
    } catch { setMsg("Fehler"); }
    setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  const coinColors = { BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", BNB: "#F3BA2F", USDT: "#26A17B" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="crypto-loans-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><Landmark size={18} className="text-green-400" /> Krypto-Kredit</h1>
            <p className="text-[10px] text-green-400">Crypto als Sicherheit, EUR sofort</p></div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "new", label: "Neuer Kredit" }, { id: "loans", label: "Meine Kredite" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-green-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {tab === "new" && !sel && options.map((o, i) => (
          <motion.div key={o.coin} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSel(o)} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.06]" data-testid={`collateral-${o.coin}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: (coinColors[o.coin] || "#666") + "20", color: coinColors[o.coin] }}>{o.coin}</div>
              <div><p className="text-sm font-bold">{o.coin} hinterlegen</p>
                <p className="text-[10px] text-gray-500">LTV: {o.ltv}% · Min: {o.min_collateral} {o.coin}</p></div>
            </div>
            <div className="text-right"><p className="text-lg font-black text-green-400">{o.interest}%</p><p className="text-[9px] text-gray-500">Jahreszins</p></div>
          </motion.div>
        ))}
        {tab === "new" && sel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 rounded-2xl border border-green-500/20 bg-green-500/5 space-y-3">
            <p className="text-lg font-bold">{sel.coin} als Sicherheit</p>
            <p className="text-xs text-gray-400">LTV: {sel.ltv}% · Zins: {sel.interest}%/Jahr · Kurs: {sel.price_eur} EUR</p>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Betrag in ${sel.coin}`}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" data-testid="loan-amount" />
            {amount && <div className="p-3 rounded-xl bg-[#0A0A0F] space-y-1">
              <p className="text-[11px] text-gray-500">Sicherheitswert: <span className="text-white font-bold">{(parseFloat(amount || 0) * sel.price_eur).toFixed(2)} EUR</span></p>
              <p className="text-[11px] text-gray-500">Kreditbetrag: <span className="text-green-400 font-bold">{(parseFloat(amount || 0) * sel.price_eur * sel.ltv / 100).toFixed(2)} EUR</span></p>
              <p className="text-[11px] text-gray-500">Monatliche Zinsen: <span className="text-yellow-400">{(parseFloat(amount || 0) * sel.price_eur * sel.ltv / 100 * sel.interest / 100 / 12).toFixed(2)} EUR</span></p>
            </div>}
            <div className="flex gap-2">
              <button onClick={() => setSel(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Abbrechen</button>
              <button onClick={request} disabled={loading || !amount} className="flex-1 py-3 bg-green-500 text-black rounded-xl text-sm font-bold disabled:opacity-50" data-testid="loan-submit">
                {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Kredit aufnehmen"}</button>
            </div>
          </motion.div>
        )}
        {tab === "loans" && loans.length === 0 && <p className="text-center text-gray-600 py-12">Keine Kredite</p>}
        {tab === "loans" && loans.map((l, i) => (
          <motion.div key={l.loan_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <p className="text-sm font-bold">{l.collateral_amount} {l.collateral_coin} hinterlegt</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${l.status === "active" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>{l.status}</span>
            </div>
            <p className="text-xs text-gray-400">Kredit: {l.loan_amount_eur} EUR · Zins: {l.interest_rate}%/Jahr</p>
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
