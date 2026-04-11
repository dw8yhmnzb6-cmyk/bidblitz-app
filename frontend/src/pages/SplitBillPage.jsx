import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Plus, Loader2, Check, Euro, UserPlus, Trash2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const SplitBillPage = ({ onBack }) => {
  const [bills, setBills] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", total: "", participants: [""] });
  const [creating, setCreating] = useState(false);

  const addParticipant = () => setForm(f => ({ ...f, participants: [...f.participants, ""] }));
  const updateParticipant = (i, v) => setForm(f => ({ ...f, participants: f.participants.map((p, idx) => idx === i ? v : p) }));
  const removeParticipant = (i) => setForm(f => ({ ...f, participants: f.participants.filter((_, idx) => idx !== i) }));

  const perPerson = form.total && form.participants.length > 0 
    ? (parseFloat(form.total) / (form.participants.filter(p => p).length || 1)).toFixed(2)
    : "0.00";

  const handleCreate = async () => {
    if (!form.title || !form.total) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/split-bill/create`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, total: parseFloat(form.total), participants: form.participants.filter(p => p) }),
      });
      if (res.ok) {
        const data = await res.json();
        setBills(prev => [data.bill, ...prev]);
        setShowCreate(false);
        setForm({ title: "", total: "", participants: [""] });
      }
    } catch (err) { console.error(err); }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="split-bill-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Rechnung teilen</h1>
            <p className="text-xs text-[#666]">Mit Freunden aufteilen</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF8C42] text-black text-sm font-medium" data-testid="create-split-btn">
          <Plus size={16} /> Neue Rechnung
        </motion.button>
      </div>

      {showCreate ? (
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-[#666] mb-1 block">Titel</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="z.B. Abendessen, Urlaub..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" data-testid="split-title" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1 block">Gesamtbetrag (€)</label>
            <input type="number" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
              placeholder="0.00" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" data-testid="split-total" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[#666]">Teilnehmer</label>
              <motion.button whileTap={{ scale: 0.9 }} onClick={addParticipant} className="text-xs text-[#FF8C42] flex items-center gap-1"><UserPlus size={12} /> Hinzufügen</motion.button>
            </div>
            {form.participants.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="email" value={p} onChange={e => updateParticipant(i, e.target.value)}
                  placeholder="E-Mail" className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" />
                {form.participants.length > 1 && (
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => removeParticipant(i)} className="p-2 rounded-xl bg-red-500/10 text-red-400"><Trash2 size={14} /></motion.button>
                )}
              </div>
            ))}
          </div>
          {form.total && (
            <div className="p-4 rounded-2xl bg-[#FF8C42]/10 border border-[#FF8C42]/20 text-center">
              <p className="text-xs text-[#888]">Pro Person</p>
              <p className="text-2xl font-black text-[#FF8C42]">€{perPerson}</p>
            </div>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate} disabled={!form.title || !form.total || creating}
            className="w-full py-4 rounded-xl bg-[#FF8C42] text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2" data-testid="confirm-split-btn">
            {creating ? <Loader2 size={20} className="animate-spin" /> : <><Check size={20} /> Rechnung erstellen</>}
          </motion.button>
        </div>
      ) : (
        <div className="p-4">
          {bills.length === 0 ? (
            <div className="text-center py-20">
              <Users size={48} className="mx-auto text-[#333] mb-4" />
              <p className="text-white/70 font-semibold">Keine Rechnungen</p>
              <p className="text-sm text-[#666] mt-2">Teile Rechnungen mit Freunden — fair und einfach.</p>
            </div>
          ) : bills.map((b, i) => (
            <div key={i} className="bg-[#111118] rounded-2xl p-4 border border-white/5 mb-3">
              <p className="font-semibold">{b.title}</p>
              <p className="text-sm text-[#00C2FF] font-bold">€{b.total?.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SplitBillPage;
