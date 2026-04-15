import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, Star, Users, Loader2, Send } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function CreatorsPage({ onBack }) {
  const [creators, setCreators] = useState([]);
  const [subs, setSubs] = useState([]);
  const [tab, setTab] = useState("discover");
  const [tipCreator, setTipCreator] = useState(null);
  const [tipAmount, setTipAmount] = useState("");
  const [tipMsg, setTipMsg] = useState("");
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/creators/featured`).then(r => r.json()).then(d => setCreators(d.creators || [])).catch(() => {});
    fetch(`${API}/api/creators/my-subs`, { credentials: "include" }).then(r => r.json()).then(d => setSubs(d.subscriptions || [])).catch(() => {});
  }, []);

  const subscribe = async (id) => {
    setLoading(id);
    const r = await fetch(`${API}/api/creators/subscribe`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creator_id: id }) });
    const d = await r.json(); setMsg(d.message || d.detail); setLoading("");
    if (r.ok) fetch(`${API}/api/creators/my-subs`, { credentials: "include" }).then(r => r.json()).then(d => setSubs(d.subscriptions || []));
    setTimeout(() => setMsg(""), 4000);
  };

  const sendTip = async () => {
    if (!tipCreator || !tipAmount) return; setLoading("tip");
    const r = await fetch(`${API}/api/creators/tip`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_id: tipCreator.id, amount_eur: parseFloat(tipAmount), message: tipMsg }) });
    const d = await r.json(); setMsg(d.message || d.detail); setLoading(""); setTipCreator(null); setTipAmount(""); setTipMsg("");
    setTimeout(() => setMsg(""), 4000);
  };

  const catColors = { Tech: "#3B82F6", Fitness: "#EF4444", Crypto: "#F7931A", Kochen: "#22C55E", Design: "#EC4899", Musik: "#8B5CF6" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="creators-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><Heart size={18} className="text-pink-400" /> Creators</h1>
            <p className="text-[10px] text-pink-400">Abonnieren, Trinkgeld, Exklusiv-Content</p></div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "discover", label: "Entdecken" }, { id: "subs", label: "Abos" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-pink-500 text-white" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {tab === "discover" && !tipCreator && creators.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`creator-${c.id}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black" style={{ background: (catColors[c.category] || "#666") + "20", color: catColors[c.category] }}>{c.name.charAt(0)}</div>
              <div className="flex-1">
                <p className="text-sm font-bold">{c.name}</p>
                <p className="text-[10px] text-gray-500">{c.bio}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[9px] text-gray-400 flex items-center gap-0.5"><Users size={9} /> {c.subscribers.toLocaleString()}</span>
                  <span className="text-[9px] text-gray-400 flex items-center gap-0.5"><Star size={9} className="text-yellow-400" /> {c.rating}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: (catColors[c.category]||"#666") + "20", color: catColors[c.category] }}>{c.category}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => subscribe(c.id)} disabled={loading === c.id}
                className="flex-1 py-2.5 bg-pink-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">
                {loading === c.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : `${c.monthly_price} EUR/Mo`}</button>
              <button onClick={() => setTipCreator(c)} className="px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs font-bold">Tip</button>
            </div>
          </motion.div>
        ))}
        {tab === "discover" && tipCreator && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 space-y-3">
            <p className="text-sm font-bold">Trinkgeld an {tipCreator.name}</p>
            <div className="flex gap-2">
              {[2, 5, 10, 25, 50].map(a => (
                <button key={a} onClick={() => setTipAmount(String(a))} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tipAmount === String(a) ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400"}`}>{a} EUR</button>
              ))}
            </div>
            <input value={tipMsg} onChange={e => setTipMsg(e.target.value)} placeholder="Nachricht (optional)"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setTipCreator(null)} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Abbrechen</button>
              <button onClick={sendTip} disabled={loading === "tip" || !tipAmount} className="flex-1 py-3 bg-yellow-500 text-black rounded-xl text-sm font-bold flex items-center justify-center gap-1">
                {loading === "tip" ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> Senden</>}</button>
            </div>
          </motion.div>
        )}
        {tab === "subs" && subs.length === 0 && <p className="text-center text-gray-600 py-12">Keine Abos</p>}
        {tab === "subs" && subs.map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
            <div><p className="text-sm font-bold">{s.creator_name}</p><p className="text-[10px] text-gray-500">{s.monthly_price} EUR/Mo</p></div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400">Aktiv</span>
          </div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-pink-500/20 border border-pink-500/30 rounded-xl text-pink-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
