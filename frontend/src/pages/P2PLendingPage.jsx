import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Loader2, HandCoins } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function P2PLendingPage({ onBack }) {
  const [offers, setOffers] = useState([]);
  const [activity, setActivity] = useState({ borrowed: [], funded: [] });
  const [tab, setTab] = useState("browse");
  const [form, setForm] = useState({ amount: "", interest: "8", term: "6", desc: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch(`${API}/api/p2p-lending/offers`).then(r => r.json()).then(d => setOffers(d.offers || [])).catch(() => {});
    fetch(`${API}/api/p2p-lending/my-activity`, { credentials: "include" }).then(r => r.json()).then(d => setActivity(d)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const createOffer = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/p2p-lending/create`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_eur: parseFloat(form.amount), interest_rate: parseFloat(form.interest), term_months: parseInt(form.term), description: form.desc }) });
      const d = await r.json(); setMsg(d.message || d.detail);
      if (r.ok) { setForm({ amount: "", interest: "8", term: "6", desc: "" }); load(); setTab("browse"); }
    } catch { setMsg("Fehler"); } setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  const fund = async (id) => {
    const r = await fetch(`${API}/api/p2p-lending/fund`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer_id: id }) });
    const d = await r.json(); setMsg(d.message || d.detail); load(); setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="p2p-lending-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><HandCoins size={18} className="text-teal-400" /> P2P Lending</h1>
            <p className="text-[10px] text-teal-400">Privatkredite vergeben & aufnehmen</p></div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "browse", label: "Angebote" }, { id: "create", label: "Kredit anfragen" }, { id: "my", label: "Meine" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${tab === t.id ? "bg-teal-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {tab === "browse" && offers.map((o, i) => (
          <motion.div key={o.offer_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`offer-${i}`}>
            <div className="flex justify-between mb-2"><p className="text-sm font-bold">{o.amount_eur} EUR</p><span className="text-green-400 text-sm font-bold">{o.interest_rate}% Zins</span></div>
            <p className="text-[10px] text-gray-500 mb-2">{o.borrower_name} · {o.term_months} Monate · {o.monthly_payment} EUR/Mo</p>
            {o.description && <p className="text-[11px] text-gray-400 mb-2">{o.description}</p>}
            <button onClick={() => fund(o.offer_id)} className="w-full py-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400 text-xs font-bold">Finanzieren</button>
          </motion.div>
        ))}
        {tab === "browse" && offers.length === 0 && <p className="text-center text-gray-600 py-12">Keine offenen Angebote</p>}
        {tab === "create" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-3">
            <p className="text-sm font-bold mb-2">Kredit anfragen</p>
            <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="Betrag in EUR"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" data-testid="p2p-amount" />
            <div className="flex gap-2">
              <input type="number" value={form.interest} onChange={e => setForm({...form, interest: e.target.value})} placeholder="Zinssatz %"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
              <input type="number" value={form.term} onChange={e => setForm({...form, term: e.target.value})} placeholder="Monate"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
            </div>
            <input value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Beschreibung (optional)"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
            <button onClick={createOffer} disabled={loading || !form.amount} className="w-full py-3 bg-teal-500 text-black rounded-xl text-sm font-bold disabled:opacity-50" data-testid="p2p-create">
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Kreditanfrage erstellen"}</button>
          </motion.div>
        )}
        {tab === "my" && (
          <div className="space-y-3">
            {activity.borrowed?.length > 0 && <p className="text-xs text-gray-500 font-bold">Aufgenommen</p>}
            {activity.borrowed?.map((b, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between">
                <div><p className="text-sm font-bold">{b.amount_eur} EUR</p><p className="text-[10px] text-gray-500">{b.interest_rate}% · {b.term_months} Mo</p></div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full h-fit ${b.status === "funded" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>{b.status}</span>
              </div>
            ))}
            {activity.funded?.length > 0 && <p className="text-xs text-gray-500 font-bold mt-3">Finanziert</p>}
            {activity.funded?.map((f, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between">
                <div><p className="text-sm font-bold">{f.amount_eur} EUR vergeben</p><p className="text-[10px] text-gray-500">{f.interest_rate}% Rendite</p></div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">funded</span>
              </div>
            ))}
            {!activity.borrowed?.length && !activity.funded?.length && <p className="text-center text-gray-600 py-12">Keine Aktivitaet</p>}
          </div>
        )}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-teal-500/20 border border-teal-500/30 rounded-xl text-teal-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
