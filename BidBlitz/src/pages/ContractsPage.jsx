import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileSignature, Shield, Loader2, Check } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function ContractsPage({ onBack }) {
  const [templates, setTemplates] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [tab, setTab] = useState("templates");
  const [sel, setSel] = useState(null);
  const [fields, setFields] = useState({});
  const [counterparty, setCounterparty] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/contracts/templates`).then(r => r.json()).then(d => setTemplates(d.templates || [])).catch(() => {});
    fetch(`${API}/api/contracts/my-contracts`, { credentials: "include" }).then(r => r.json()).then(d => setContracts(d.contracts || [])).catch(() => {});
  }, []);

  const create = async () => {
    if (!sel) return; setLoading(true);
    try {
      const r = await fetch(`${API}/api/contracts/create`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: sel.id, fields, counterparty_email: counterparty }) });
      const d = await r.json(); setMsg(d.message || d.detail);
      if (r.ok) { setSel(null); setFields({}); setCounterparty(""); setTab("contracts");
        fetch(`${API}/api/contracts/my-contracts`, { credentials: "include" }).then(r => r.json()).then(d => setContracts(d.contracts || [])); }
    } catch { setMsg("Fehler"); } setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  const catColors = { Immobilien: "#3B82F6", Allgemein: "#6B7280", Arbeit: "#10B981", Business: "#8B5CF6", Finanzen: "#F59E0B" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="contracts-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={sel ? () => setSel(null) : onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><FileSignature size={18} className="text-emerald-400" /> Digitale Vertraege</h1>
            <p className="text-[10px] text-emerald-400">E-Signatur & Vorlagen</p></div>
        </div>
        {!sel && <div className="flex gap-2 mt-3">
          {[{ id: "templates", label: "Vorlagen" }, { id: "contracts", label: "Meine Vertraege" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>}
      </div>
      <div className="px-4 pt-4 space-y-3">
        {!sel && tab === "templates" && templates.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => { setSel(t); setFields({}); }} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06]" data-testid={`template-${t.id}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: (catColors[t.category]||"#666") + "20" }}>
                  <FileSignature size={16} style={{ color: catColors[t.category] }} /></div>
                <div><p className="text-sm font-bold">{t.name}</p><p className="text-[10px] text-gray-500">{t.category} · {t.fields.length} Felder</p></div>
              </div>
              <p className="text-sm font-bold text-emerald-400">{t.price} EUR</p>
            </div>
          </motion.div>
        ))}
        {sel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
              <p className="text-lg font-bold mb-1">{sel.name}</p>
              <p className="text-xs text-gray-400 mb-4">{sel.category} · {sel.price} EUR</p>
              {sel.fields.map((f, i) => (
                <input key={i} value={fields[f] || ""} onChange={e => setFields({...fields, [f]: e.target.value})} placeholder={f}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none mb-2" />
              ))}
              <input value={counterparty} onChange={e => setCounterparty(e.target.value)} placeholder="Gegenpartei Email (optional)"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none mb-2" />
              <button onClick={create} disabled={loading} className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold text-sm disabled:opacity-50 mt-2" data-testid="contract-create">
                {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Vertrag erstellen (${sel.price} EUR)`}</button>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
              <Shield size={16} className="text-green-400 shrink-0" />
              <p className="text-[10px] text-gray-400">SHA-256 Hash · Rechtssicher · E-Signatur</p>
            </div>
          </motion.div>
        )}
        {!sel && tab === "contracts" && contracts.length === 0 && <p className="text-center text-gray-600 py-12">Keine Vertraege</p>}
        {!sel && tab === "contracts" && contracts.map((c, i) => (
          <motion.div key={c.contract_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <p className="text-sm font-bold">{c.template_name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.status === "signed" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                {c.status === "signed" ? <span className="flex items-center gap-0.5"><Check size={10} /> Signiert</span> : "Warten"}
              </span>
            </div>
            <p className="text-[10px] text-gray-500">Hash: {c.doc_hash} · {c.signatures?.length || 0} Signatur(en)</p>
          </motion.div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
