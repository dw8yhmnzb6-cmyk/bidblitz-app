import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Plus, Loader2, Check } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function InvoicingPage({ onBack }) {
  const [invoices, setInvoices] = useState([]);
  const [tab, setTab] = useState("list");
  const [form, setForm] = useState({ client: "", email: "", items: [{ desc: "", qty: 1, price: "" }], notes: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch(`${API}/api/invoicing/my-invoices`, { credentials: "include" }).then(r => r.json()).then(d => setInvoices(d.invoices || [])).catch(() => {}); }, []);

  const addItem = () => setForm({ ...form, items: [...form.items, { desc: "", qty: 1, price: "" }] });
  const updateItem = (idx, field, val) => { const items = [...form.items]; items[idx][field] = val; setForm({ ...form, items }); };

  const create = async () => {
    setLoading(true);
    try {
      const items = form.items.filter(i => i.desc && i.price).map(i => ({ description: i.desc, quantity: parseInt(i.qty) || 1, unit_price: parseFloat(i.price) }));
      if (!items.length || !form.client) { setMsg("Kunde und mind. 1 Position erforderlich"); setLoading(false); return; }
      const r = await fetch(`${API}/api/invoicing/create`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: form.client, client_email: form.email, items, notes: form.notes }) });
      const d = await r.json(); setMsg(d.message || d.detail);
      if (r.ok) { setForm({ client: "", email: "", items: [{ desc: "", qty: 1, price: "" }], notes: "" }); setTab("list");
        fetch(`${API}/api/invoicing/my-invoices`, { credentials: "include" }).then(r => r.json()).then(d => setInvoices(d.invoices || [])); }
    } catch { setMsg("Fehler"); } setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="invoicing-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><FileText size={18} className="text-amber-400" /> Rechnungen</h1>
            <p className="text-[10px] text-amber-400">Erstellen & Verwalten</p></div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "list", label: "Meine Rechnungen" }, { id: "new", label: "Neue Rechnung" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-amber-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {tab === "list" && invoices.length === 0 && <p className="text-center text-gray-600 py-12">Keine Rechnungen</p>}
        {tab === "list" && invoices.map((inv, i) => (
          <motion.div key={inv.invoice_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <p className="text-sm font-bold font-mono">{inv.invoice_number}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>{inv.status === "paid" ? "Bezahlt" : "Offen"}</span>
            </div>
            <p className="text-xs text-gray-400">{inv.client_name}</p>
            <div className="flex justify-between mt-2">
              <p className="text-[10px] text-gray-500">{inv.items?.length} Positionen · MwSt: {inv.tax} EUR</p>
              <p className="text-sm font-bold text-amber-400">{inv.total} EUR</p>
            </div>
          </motion.div>
        ))}
        {tab === "new" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="Kundenname *"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" data-testid="inv-client" />
            <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Kunden-Email (optional)"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
            <p className="text-xs font-bold text-gray-400">Positionen</p>
            {form.items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input value={item.desc} onChange={e => updateItem(idx, "desc", e.target.value)} placeholder="Beschreibung"
                  className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
                <input value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="Menge" type="number"
                  className="w-16 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none text-center" />
                <input value={item.price} onChange={e => updateItem(idx, "price", e.target.value)} placeholder="Preis" type="number"
                  className="w-24 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
              </div>
            ))}
            <button onClick={addItem} className="w-full py-2 bg-white/5 rounded-xl text-xs text-gray-400 flex items-center justify-center gap-1"><Plus size={12} /> Position hinzufuegen</button>
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notizen (optional)"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
            <button onClick={create} disabled={loading} className="w-full py-4 bg-amber-500 text-black rounded-xl font-bold text-sm disabled:opacity-50" data-testid="inv-create">
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Rechnung erstellen"}</button>
          </motion.div>
        )}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
