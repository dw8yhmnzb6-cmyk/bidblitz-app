import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, User, QrCode, Mail, Users, Send, Loader2, ChevronRight, Search, Sparkles, CheckCircle2, AlertCircle, Clock, Plus } from "lucide-react";
import { useUser } from "../store";

const spring = { type: "spring", damping: 25, stiffness: 300 };

const normalizeAmount = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function SendMoneyPage({ onBack, onNavigate, currentBalance = 0 }) {
  const user = useUser();
  const [step, setStep] = useState(1);
  const [activeList, setActiveList] = useState("saved");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(normalizeAmount(currentBalance ?? user?.balance));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [savedRecipients, setSavedRecipients] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const searchTimeout = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [balanceRes, recentRes, savedRes] = await Promise.all([
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet/balance`, { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/recipients/recent`, { credentials: "include" }).then(r => r.ok ? r.json() : { recipients: [] }).catch(() => ({ recipients: [] })),
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet/saved-recipients`, { credentials: "include" }).then(r => r.ok ? r.json() : { recipients: [] }).catch(() => ({ recipients: [] })),
        ]);

        if (balanceRes?.balance !== undefined) setBalance(normalizeAmount(balanceRes.balance));
        else if (user?.balance !== undefined) setBalance(normalizeAmount(user.balance));

        setRecentContacts(recentRes?.recipients || []);
        setSavedRecipients(savedRes?.recipients || []);
        if ((savedRes?.recipients || []).length === 0 && (recentRes?.recipients || []).length > 0) {
          setActiveList("recent");
        }
      } catch (loadError) {
        void loadError;
      }
    };

    loadData();
  }, [user?.balance]);

  useEffect(() => {
    if (step === 2 && inputRef.current) inputRef.current.focus();
  }, [step]);

  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  }, []);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setError(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ query, type: "auto" }),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.recipient ? [data.recipient] : []);
        }
      } catch (lookupError) {
        void lookupError;
        setSearchResults([]);
      }
    }, 300);
  };

  const selectRecipient = (r) => {
    setRecipient(r);
    setStep(2);
    setError(null);
  };

  const handleAmountChange = (val) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
  };

  const addAmount = (val) => {
    const current = parseFloat(amount) || 0;
    const newAmount = Math.min(current + val, balance);
    setAmount(newAmount.toFixed(2));
  };

  const setMax = () => setAmount(balance.toFixed(2));

  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 0.01) return setError("Mindestbetrag: €0.01");
    if (numAmount > balance) return setError("Nicht genügend Guthaben");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipient_id: recipient.user_id,
          amount: numAmount,
          message: message || null,
          transfer_method: "direct",
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Überweisung fehlgeschlagen");
      }
      const data = await res.json();
      setResult(data);
      setStep(3);
    } catch (sendError) {
      setError(sendError.message || "Überweisung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [5, 10, 20, 50];
  const visibleSavedRecipients = savedRecipients || [];
  const visibleRecentContacts = recentContacts || [];

  return (
    <motion.div data-testid="send-money-page" className="min-h-screen bg-[#f8fafc] pb-[calc(var(--app-mobile-content-offset,6rem)+1rem)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="sticky top-0 z-30 bg-[#f8fafc]/95 backdrop-blur-xl border-b border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button data-testid="send-money-page-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
            <ArrowLeft size={18} className="text-slate-600" />
          </motion.button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00A6E6]">Privat bezahlen</p>
            <h1 className="text-[20px] font-bold text-slate-950">Geld senden</h1>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="list" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22 }}>
            <div className="px-4 pt-4 pb-6">
              <div className="p-5 rounded-[28px] bg-gradient-to-br from-[#00C2FF]/12 to-[#8B5CF6]/10 border border-[#00C2FF]/18 mb-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                <p className="text-[12px] text-[#00A6E6] font-medium mb-1">Verfügbar</p>
                <p className="text-[36px] font-bold text-slate-900 tracking-tight">€{balance.toFixed(2)}</p>
                <p className="text-[11px] text-slate-600 mt-1">Wähle einfach Kontakt, Username, E-Mail oder BidBlitz ID.</p>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { icon: User, label: "Username", color: "#8B5CF6" },
                  { icon: QrCode, label: "Scannen", color: "#00C2FF" },
                  { icon: Users, label: "Kontakte", color: "#10B981" },
                  { icon: Mail, label: "E-Mail", color: "#F59E0B" },
                ].map((item, i) => (
                  <motion.button key={i} type="button" className="flex flex-col items-center gap-2 py-4 rounded-2xl" style={{ background: `${item.color}10` }} whileTap={{ scale: 0.95 }}>
                    <item.icon size={22} style={{ color: item.color }} />
                    <span className="text-[10px] font-semibold text-slate-700">{item.label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="relative mb-5">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  data-testid="send-money-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Username, E-Mail oder BidBlitz ID..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-[15px] placeholder-slate-400 outline-none focus:border-[#00C2FF]/40"
                  autoFocus
                />
              </div>

              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-5">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-3">Gefunden</p>
                    {searchResults.map((r) => (
                      <motion.button data-testid={`send-money-search-result-${r.user_id}`} key={r.user_id} onClick={() => selectRecipient(r)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#00C2FF]/5 border border-[#00C2FF]/20 mb-2" whileTap={{ scale: 0.98 }}>
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[20px] font-bold text-white">{r.name?.[0]?.toUpperCase() || "?"}</div>
                        <div className="flex-1 text-left">
                          <p className="text-[16px] font-semibold text-slate-900">{r.name}</p>
                          <p className="text-[12px] text-[#00C2FF]">{r.username ? `@${r.username}` : r.bidblitz_id}</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-300" />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mb-4">
                <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                  <button type="button" data-testid="send-money-tab-saved" onClick={() => setActiveList("saved")} className={`flex-1 min-h-[48px] py-3 rounded-xl font-semibold text-[13px] transition-colors ${activeList === "saved" ? "bg-[#00C2FF] text-slate-950 shadow-[0_6px_16px_rgba(0,194,255,0.22)]" : "text-slate-600 bg-transparent"}`}>⭐ Gespeicherte</button>
                  <button type="button" data-testid="send-money-tab-recent" onClick={() => setActiveList("recent")} className={`flex-1 min-h-[48px] py-3 rounded-xl font-semibold text-[13px] transition-colors ${activeList === "recent" ? "bg-[#00C2FF] text-slate-950 shadow-[0_6px_16px_rgba(0,194,255,0.22)]" : "text-slate-600 bg-transparent"}`}>🕐 Kürzlich</button>
                </div>
              </div>

              {activeList === "saved" && visibleSavedRecipients.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {visibleSavedRecipients.map((saved) => {
                    const iconMap = { family: "👨‍👩‍👧", friend: "👤", work: "💼", star: "⭐", user: "👤" };
                    const savedKey = saved.id || saved.recipient_number || saved.recipient_id || saved.nickname;
                    return (
                      <motion.button data-testid={`send-money-saved-recipient-${savedKey}`} key={savedKey} onClick={() => selectRecipient({ user_id: saved.recipient_id, name: saved.recipient_name, email: saved.recipient_id, bidblitz_id: saved.recipient_number })} className="p-4 rounded-2xl bg-white border border-slate-200 transition-all" whileTap={{ scale: 0.95 }}>
                        <div className="text-3xl mb-2">{iconMap[saved.icon] || "👤"}</div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{saved.nickname}</p>
                        <p className="text-xs text-slate-500 truncate">{saved.recipient_number}</p>
                        {saved.transfer_count > 0 && <p className="text-[10px] text-[#00C2FF] mt-1">{saved.transfer_count}x gesendet</p>}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {activeList === "recent" && (
                <div>
                  <div className="flex items-center gap-2 mb-4"><Clock size={14} className="text-slate-400" /><p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Zuletzt gesendet</p></div>
                  {visibleRecentContacts.length === 0 ? (
                    <div className="text-center py-8"><Users size={32} className="text-slate-200 mx-auto mb-2" /><p className="text-[13px] text-slate-500">Noch keine Kontakte</p></div>
                  ) : (
                    <div className="space-y-2">
                      {visibleRecentContacts.slice(0, 8).map((c, i) => (
                        <motion.button data-testid={`send-money-recent-contact-${c.user_id || i}`} key={c.user_id || i} onClick={() => selectRecipient(c)} className="w-full flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-200 transition-colors" whileTap={{ scale: 0.98 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-[14px] font-bold text-slate-600">{c.name?.[0]?.toUpperCase() || "?"}</div>
                          <div className="flex-1 text-left">
                            <p className="text-[14px] font-medium text-slate-900">{c.name}</p>
                            <p className="text-[11px] text-slate-500">€{normalizeAmount(c.last_amount).toFixed(2)}</p>
                          </div>
                          <Send size={16} className="text-slate-300" />
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 2 && recipient && (
          <motion.div key="amount" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22 }} className="px-4 pt-4 pb-6">
            <div className="flex items-center gap-4 mb-5">
              <motion.button data-testid="send-money-back-button" onClick={() => setStep(1)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center" whileTap={{ scale: 0.9 }}><ArrowLeft size={18} className="text-slate-600" /></motion.button>
              <h2 className="text-[18px] font-bold text-slate-900">Betrag eingeben</h2>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[20px] font-bold text-white">{recipient.name?.[0]?.toUpperCase() || "?"}</div>
              <div>
                <p className="text-[16px] font-semibold text-slate-900">{recipient.name}</p>
                <p className="text-[12px] text-[#00C2FF]">{recipient.username ? `@${recipient.username}` : recipient.bidblitz_id}</p>
              </div>
            </div>

            <div className="rounded-[28px] bg-white border border-slate-200 p-5 text-center shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-[48px] font-bold text-slate-300">€</span>
                <input data-testid="send-money-amount-input" ref={inputRef} type="text" inputMode="decimal" value={amount} onChange={(e) => handleAmountChange(e.target.value)} placeholder="0" className="text-[64px] font-bold text-slate-900 bg-transparent outline-none text-center w-48 placeholder-slate-300" />
              </div>
              <p className="text-[13px] text-slate-500">Verfügbar: <span className="text-[#00C2FF] font-semibold">€{balance.toFixed(2)}</span></p>

              <div className="grid grid-cols-2 sm:flex items-center gap-2 mt-6 justify-center">
                {quickAmounts.map((q) => (
                  <motion.button data-testid={`send-money-quick-amount-${q}`} key={q} onClick={() => addAmount(q)} className="px-5 py-3 rounded-full bg-slate-50 border border-slate-200 text-[14px] font-semibold text-slate-700" whileTap={{ scale: 0.95 }}><Plus size={12} className="inline mr-1" />€{q}</motion.button>
                ))}
                <motion.button data-testid="send-money-quick-amount-max" onClick={setMax} className="px-5 py-3 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20 text-[14px] font-semibold text-[#00C2FF]" whileTap={{ scale: 0.95 }}>MAX</motion.button>
              </div>

              <input data-testid="send-money-message-input" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Nachricht hinzufügen..." className="w-full mt-6 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-[14px] placeholder-slate-400 outline-none text-center" />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400" />
                  <span className="text-[13px] text-red-500">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-5">
              <motion.button data-testid="send-money-submit-button" onClick={handleSend} disabled={loading || !amount || parseFloat(amount) <= 0} className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#0066FF] text-white font-bold text-[17px] flex items-center justify-center gap-3 disabled:opacity-40 shadow-lg shadow-[#00C2FF]/20" whileTap={{ scale: 0.98 }}>
                {loading ? <Loader2 size={22} className="animate-spin" /> : <><Send size={20} />€{parseFloat(amount || 0).toFixed(2)} senden</>}
              </motion.button>
              <p className="text-center text-[11px] text-slate-500 mt-3">Kostenlos & sofort • Keine Gebühren</p>
            </div>
          </motion.div>
        )}

        {step === 3 && result && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", damping: 20 }} className="px-4 pt-10 pb-6 flex flex-col items-center justify-center text-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#00D26A] to-[#00A855] flex items-center justify-center shadow-2xl shadow-[#00D26A]/30 mb-8"><CheckCircle2 size={56} className="text-white" /></div>
            <h2 className="text-[28px] font-bold text-slate-900 mb-2">Gesendet!</h2>
            <p className="text-[15px] text-slate-500">Geld erfolgreich überwiesen</p>
            <p className="text-[56px] font-bold text-slate-900 tracking-tight my-8">€{parseFloat(amount).toFixed(2)}</p>
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[16px] font-bold text-white">{recipient?.name?.[0]?.toUpperCase() || "?"}</div>
              <div className="text-left">
                <p className="text-[14px] font-semibold text-slate-900">{recipient?.name}</p>
                <p className="text-[11px] text-slate-500">Empfänger</p>
              </div>
            </div>
            <p className="text-[12px] text-slate-500 mt-6 font-mono">Ref: {result.reference}</p>
            <div className="mt-8 text-center">
              <p className="text-[11px] text-slate-500 mb-1">Neues Guthaben</p>
              <p className="text-[24px] font-bold text-[#00C2FF]">€{normalizeAmount(result.sender_new_balance).toFixed(2)}</p>
            </div>
            <motion.button data-testid="send-money-done-button" onClick={() => onNavigate?.('/wallet')} className="mt-8 w-full py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-semibold text-[15px]" whileTap={{ scale: 0.98 }}>Fertig</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}