import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, Plus, Loader2, Eye, EyeOff, Copy, Check, Lock, Trash2, Snowflake, Sun, Receipt, AlertCircle } from "lucide-react";
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
  const [busyCard, setBusyCard] = useState(null);
  const [txDrawer, setTxDrawer] = useState(null); // { card_id, transactions }
  const [error, setError] = useState(null);

  useEffect(() => { loadCards(); }, []);

  const loadCards = async () => {
    try {
      const res = await fetch(`${API}/api/virtual-cards`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setCards(d.cards || []); }
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  const createCard = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/virtual-cards`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: parseFloat(form.limit), label: form.label }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { loadCards(); setShowCreate(false); setForm({ limit: "50", label: "" }); }
      else if (res.status === 403 && d.detail?.error === "kyc_level_2_required") {
        setError("KYC Level 2 erforderlich. Bitte schließe die KYC-Verifizierung ab.");
      } else {
        setError(typeof d.detail === "string" ? d.detail : "Fehler beim Erstellen der Karte");
      }
    } catch { setError("Netzwerkfehler"); }
    setCreating(false);
  };

  const toggleFreeze = async (card) => {
    setBusyCard(card.card_id);
    const action = card.status === "active" ? "freeze" : "unfreeze";
    try {
      const r = await fetch(`${API}/api/cards/${card.card_id}/${action}`, {
        method: "POST", credentials: "include",
      });
      if (r.ok) loadCards();
    } catch { /* ignore */ }
    setBusyCard(null);
  };

  const openTransactions = async (card) => {
    setTxDrawer({ card_id: card.card_id, label: card.label, transactions: null });
    try {
      const r = await fetch(`${API}/api/cards/${card.card_id}/transactions`, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      setTxDrawer({ card_id: card.card_id, label: card.label, transactions: d.transactions || [] });
    } catch { setTxDrawer({ card_id: card.card_id, label: card.label, transactions: [] }); }
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
          {error && (
            <div data-testid="vcard-create-error" className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{c.label || "Virtuelle Karte"}</span>
                {c.is_stripe && (
                  <span className="px-1.5 py-0.5 rounded bg-[#635BFF]/15 text-[#635BFF] text-[9px] font-bold uppercase tracking-wider">Stripe</span>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === "active" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {c.status === "active" ? "Aktiv" : "Gesperrt"}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-base font-mono text-white/70">
                {c.is_stripe
                  ? `•••• •••• •••• ${c.last4 || "••••"}`
                  : (showNumber[c.card_id] ? c.number : maskCard(c.number))}
              </p>
              {!c.is_stripe && (
                <>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowNumber(s => ({ ...s, [c.card_id]: !s[c.card_id] }))}>
                    {showNumber[c.card_id] ? <EyeOff size={14} className="text-white/40" /> : <Eye size={14} className="text-white/40" />}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => copyNumber(c.number)}>
                    {copied === c.number ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/40" />}
                  </motion.button>
                </>
              )}
              {c.is_stripe && (
                <span className="text-[9px] text-white/40 italic ml-auto">Vollständige Daten in Stripe Wallet</span>
              )}
            </div>
            <div className="flex justify-between text-xs text-[#888] mb-3">
              <span>Limit: €{(c.limit || 0).toFixed(2)}{c.is_stripe ? "/Tag" : ""}</span>
              <span>Verbraucht: €{(c.spent || 0).toFixed(2) || "0.00"}</span>
            </div>
            {/* Card Actions: Freeze/Unfreeze + Transactions */}
            <div className="flex gap-2 pt-3 border-t border-white/5">
              <motion.button
                whileTap={{ scale: 0.96 }}
                disabled={busyCard === c.card_id || !["active", "inactive", "frozen"].includes(c.status)}
                onClick={() => toggleFreeze(c)}
                data-testid={`vcard-freeze-toggle-${c.card_id}`}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${
                  c.status === "active"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>
                {busyCard === c.card_id ? <Loader2 size={12} className="animate-spin" />
                  : c.status === "active" ? <><Snowflake size={12} /> Sperren</>
                  : <><Sun size={12} /> Entsperren</>}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => openTransactions(c)}
                data-testid={`vcard-transactions-btn-${c.card_id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-white/[0.04] text-white/70 border border-white/[0.08]">
                <Receipt size={12} /> Transaktionen
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Transaction Drawer */}
      {txDrawer && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end"
          onClick={() => setTxDrawer(null)}>
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25 }}
            className="w-full bg-[#0F0F18] rounded-t-3xl border-t border-white/5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            data-testid="vcard-transactions-drawer">
            <div className="sticky top-0 bg-[#0F0F18] border-b border-white/5 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold">Transaktionen</h3>
                <p className="text-xs text-[#666]">{txDrawer.label}</p>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setTxDrawer(null)}
                className="p-2 rounded-xl bg-white/5">✕</motion.button>
            </div>
            <div className="p-4 space-y-2">
              {txDrawer.transactions === null ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#B068FF]" /></div>
              ) : txDrawer.transactions.length === 0 ? (
                <div className="text-center py-10">
                  <Receipt size={32} className="mx-auto text-[#333] mb-2" />
                  <p className="text-sm text-[#666]">Keine Transaktionen vorhanden</p>
                </div>
              ) : txDrawer.transactions.map((t, i) => (
                <div key={t.transaction_id || i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{t.merchant_name || "Merchant"}</p>
                    <p className="text-[10px] text-[#666]">{t.created_at ? new Date(t.created_at).toLocaleString("de-DE") : "-"}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className={`text-sm font-bold ${t.amount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {t.amount < 0 ? "" : "+"}{(t.amount || 0).toFixed(2)} €
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-[#666]">{t.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default VirtualCardsPage;
