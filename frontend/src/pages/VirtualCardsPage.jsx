import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, Plus, Loader2, Eye, EyeOff, Copy, Check, Lock, Trash2 } from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

const VirtualCardsPage = ({ onBack }) => {
  const { t } = useI18n();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNumber, setShowNumber] = useState({});
  const [copied, setCopied] = useState(null);
  const [form, setForm] = useState({ limit: "50", label: "" });
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadCards(); }, []);

  const loadCards = async () => {
    try {
      const res = await fetch(`${API}/api/virtual-cards`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setCards(d.cards || []); }
    } catch {}
    setLoading(false);
  };

  const createCard = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/virtual-cards`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: parseFloat(form.limit), label: form.label }),
      });
      if (res.ok) { loadCards(); setShowCreate(false); setForm({ limit: "50", label: "" }); }
    } catch {}
    setCreating(false);
  };

  const copyNumber = (num) => { navigator.clipboard.writeText(num); setCopied(num); setTimeout(() => setCopied(null), 2000); };

  const maskCard = (num) => num ? `•••• •••• •••• ${num.slice(-4)}` : "•••• •••• •••• ••••";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vcards-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Virtuelle Karten</h1>
            <p className="text-xs text-[#666]">Einmal-Karten für Online-Shopping</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B068FF] text-white text-sm font-medium" data-testid="create-vcard-btn">
          <Plus size={16} /> Neue Karte
        </motion.button>
      </div>

      {showCreate && (
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-[#666] mb-1 block">Bezeichnung</label>
            <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="z.B. Amazon, Netflix..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1 block">Limit (€)</label>
            <div className="flex gap-2">
              {["25", "50", "100", "200"].map(l => (
                <motion.button key={l} whileTap={{ scale: 0.95 }} onClick={() => setForm(f => ({ ...f, limit: l }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold ${form.limit === l ? "bg-[#B068FF] text-white" : "bg-white/5 text-white/50"}`}>
                  €{l}
                </motion.button>
              ))}
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={createCard} disabled={creating}
            className="w-full py-4 rounded-xl bg-[#B068FF] text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {creating ? <Loader2 size={20} className="animate-spin" /> : <><CreditCard size={20} /> Karte erstellen</>}
          </motion.button>
        </div>
      )}

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#B068FF]" /></div>
        ) : cards.length === 0 && !showCreate ? (
          <div className="text-center py-20">
            <CreditCard size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70 font-semibold">Keine virtuellen Karten</p>
            <p className="text-sm text-[#666] mt-2">Erstelle sichere Einmal-Karten für Online-Einkäufe.</p>
          </div>
        ) : cards.map((c, i) => (
          <motion.div key={c.card_id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl p-4 border" style={{ background: "linear-gradient(135deg, rgba(176,104,255,0.08), rgba(0,194,255,0.04))", borderColor: "rgba(176,104,255,0.15)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold">{c.label || "Virtuelle Karte"}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === "active" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {c.status === "active" ? "Aktiv" : "Gesperrt"}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-base font-mono text-white/70">{showNumber[c.card_id] ? c.number : maskCard(c.number)}</p>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowNumber(s => ({ ...s, [c.card_id]: !s[c.card_id] }))}>
                {showNumber[c.card_id] ? <EyeOff size={14} className="text-white/40" /> : <Eye size={14} className="text-white/40" />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => copyNumber(c.number)}>
                {copied === c.number ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/40" />}
              </motion.button>
            </div>
            <div className="flex justify-between text-xs text-[#888]">
              <span>Limit: €{c.limit?.toFixed(2)}</span>
              <span>Verbraucht: €{c.spent?.toFixed(2) || "0.00"}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default VirtualCardsPage;
