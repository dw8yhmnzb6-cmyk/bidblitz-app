/**
 * BidBlitz V2 - Contacts & Quick-Send Page
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Plus, Star, Trash2, Send, Loader2, Search, X, UserPlus } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ContactsPage = ({ onBack, onNavigate }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addNick, setAddNick] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [sendModal, setSendModal] = useState(null);
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/contacts`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setContacts(d.contacts || []); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addContact = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API}/api/contacts/add`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, nickname: addNick }),
      });
      if (res.ok) { setShowAdd(false); setAddEmail(""); setAddNick(""); load(); }
      else { const d = await res.json(); alert(d.detail || "Fehler"); }
    } catch { alert("Fehler"); }
    setAdding(false);
  };

  const toggleFav = async (id) => {
    await fetch(`${API}/api/contacts/favorite/${id}`, { method: "POST", credentials: "include" });
    setContacts(p => p.map(c => c.contact_id === id ? { ...c, favorite: !c.favorite } : c));
  };

  const remove = async (id) => {
    if (!confirm("Kontakt entfernen?")) return;
    await fetch(`${API}/api/contacts/${id}`, { method: "DELETE", credentials: "include" });
    setContacts(p => p.filter(c => c.contact_id !== id));
  };

  const quickSend = async () => {
    if (!sendModal || !sendAmount) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/api/payment/send`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_email: sendModal.contact_email, amount: parseFloat(sendAmount), description: "Quick-Send" }),
      });
      if (res.ok) { setSendModal(null); setSendAmount(""); alert("Gesendet!"); }
      else { const d = await res.json(); alert(d.detail || "Fehler"); }
    } catch { alert("Fehler"); }
    setSending(false);
  };

  const filtered = contacts.filter(c => !search || c.nickname?.toLowerCase().includes(search.toLowerCase()) || c.contact_email?.toLowerCase().includes(search.toLowerCase()));
  const favorites = filtered.filter(c => c.favorite);
  const others = filtered.filter(c => !c.favorite);

  if (loading) return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#00C2FF]" /></div>;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="contacts-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <h1 className="text-[15px] font-bold">Kontakte</h1>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#00C2FF] text-black text-xs font-bold" data-testid="add-contact-btn">
            <UserPlus size={14} /> Hinzufügen
          </motion.button>
        </div>
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Kontakt suchen..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Add Contact Modal */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="p-4 rounded-2xl bg-[#111118] border border-white/5 space-y-3">
                <h3 className="text-sm font-bold">Neuer Kontakt</h3>
                <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="E-Mail des Kontakts *" autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="contact-email" />
                <input type="text" value={addNick} onChange={e => setAddNick(e.target.value)} placeholder="Spitzname (optional)"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={addContact} disabled={adding || !addEmail}
                    className="flex-1 py-3 rounded-xl bg-[#00C2FF] text-black font-bold text-xs disabled:opacity-30" data-testid="save-contact">
                    {adding ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Hinzufügen"}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAdd(false)}
                    className="px-4 py-3 rounded-xl bg-white/5 text-xs text-[#888]">Abbrechen</motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div>
            <p className="text-[10px] text-[#F59E0B] font-semibold uppercase mb-2 px-1">Favoriten</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {favorites.map(c => (
                <motion.button key={c.contact_id} whileTap={{ scale: 0.95 }} onClick={() => setSendModal(c)}
                  className="flex-shrink-0 w-16 flex flex-col items-center gap-1.5" data-testid={`fav-${c.contact_id}`}>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C2FF]/20 to-[#A855F7]/20 border-2 border-[#F59E0B]/30 flex items-center justify-center text-sm font-bold text-white">
                    {(c.nickname || c.name || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-[9px] text-white/70 text-center truncate w-full">{c.nickname || c.name}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* All Contacts */}
        {contacts.length === 0 ? (
          <div className="text-center py-16"><Users size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Kontakte</p><p className="text-[10px] text-gray-600 mt-1">Füge Freunde hinzu um schnell Geld zu senden.</p></div>
        ) : others.concat(favorites.length === 0 ? favorites : []).length === 0 && favorites.length > 0 ? (
          <p className="text-[10px] text-gray-600 text-center">Alle Kontakte sind Favoriten</p>
        ) : (others.length > 0 || favorites.length === 0) && (
          <div className="space-y-2">
            {(favorites.length > 0 ? others : filtered).map((c, i) => (
              <motion.div key={c.contact_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="p-3 rounded-2xl bg-[#111118] border border-white/5 flex items-center justify-between" data-testid={`contact-${c.contact_id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C2FF]/20 to-[#A855F7]/20 flex items-center justify-center text-sm font-bold">
                    {(c.nickname || c.name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{c.nickname || c.name}</p>
                    <p className="text-[10px] text-gray-500">{c.contact_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleFav(c.contact_id)}
                    className="p-2 rounded-lg bg-white/5"><Star size={14} className={c.favorite ? "text-[#F59E0B] fill-[#F59E0B]" : "text-[#444]"} /></motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSendModal(c)}
                    className="p-2 rounded-lg bg-[#00C2FF]/10"><Send size={14} className="text-[#00C2FF]" /></motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => remove(c.contact_id)}
                    className="p-2 rounded-lg bg-white/5"><Trash2 size={14} className="text-[#444]" /></motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Send Modal */}
      <AnimatePresence>
        {sendModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={() => setSendModal(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 p-6">
              <h3 className="text-base font-bold mb-1">Geld senden</h3>
              <p className="text-xs text-gray-500 mb-4">An: {sendModal.nickname || sendModal.name} ({sendModal.contact_email})</p>
              <input type="number" value={sendAmount} onChange={e => setSendAmount(e.target.value)} placeholder="Betrag in €" autoFocus
                className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-2xl font-bold text-center outline-none mb-4" data-testid="send-amount" />
              <motion.button whileTap={{ scale: 0.97 }} onClick={quickSend} disabled={!sendAmount || sending}
                className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2" data-testid="confirm-send">
                {sending ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> €{sendAmount || "0"} senden</>}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContactsPage;
