import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, User, QrCode, Mail, Users, Send, Loader2,
  ChevronRight, Search, ArrowLeft, Sparkles,
  CheckCircle2, AlertCircle, Clock, Plus
} from "lucide-react";
import { useUser } from "../store";

const spring = { type: "spring", damping: 25, stiffness: 300 };

const normalizeAmount = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const SendMoneyModal = ({ isOpen, onClose, onSuccess, currentBalance }) => {
  const user = useUser();
  const [step, setStep] = useState(1); // 1: recipient, 2: amount, 3: success
  const [activeList, setActiveList] = useState("saved");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data - Use user balance from store as primary source
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
    if (isOpen) loadData();
  }, [isOpen]);

  useEffect(() => {
    setBalance(normalizeAmount(currentBalance ?? user?.balance));
  }, [currentBalance, user?.balance]);

  // Reset state when modal closes so next open starts fresh
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setActiveList("saved");
      setSearchQuery("");
      setSearchResults([]);
      setRecipient(null);
      setAmount("");
      setMessage("");
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 2 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  useEffect(() => () => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
  }, []);

  const loadData = async () => {
    try {
      // Load wallet balance, recent contacts, and saved recipients
      const [balanceRes, recentRes, savedRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet/balance`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/recipients/recent`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : { recipients: [] })
          .catch(() => ({ recipients: [] })),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet/saved-recipients`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : { recipients: [] })
          .catch(() => ({ recipients: [] })),
      ]);
      
      // Set balance from API response or fallback to user store
      if (balanceRes?.balance !== undefined) {
        setBalance(normalizeAmount(balanceRes.balance));
      } else if (user?.balance !== undefined) {
        setBalance(normalizeAmount(user.balance));
      }
      
      setRecentContacts(recentRes?.recipients || []);
      setSavedRecipients(savedRes?.recipients || []);
      if ((savedRes?.recipients || []).length === 0 && (recentRes?.recipients || []).length > 0) {
        setActiveList("recent");
      }
    } catch (err) {
      console.error('LoadData error:', err);
      // Fallback to user store balance
      if (user?.balance !== undefined) {
        setBalance(normalizeAmount(user.balance));
      }
    }
  };

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
          if (data.recipient) {
            setSearchResults([data.recipient]);
          } else {
            setSearchResults([]);
          }
        }
      } catch {
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
    // Only allow numbers and one decimal point
    const cleaned = val.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
  };

  const addAmount = (val) => {
    const current = parseFloat(amount) || 0;
    const newAmount = Math.min(current + val, balance);
    setAmount(newAmount.toFixed(2));
  };

  const setMax = () => {
    setAmount(balance.toFixed(2));
  };

  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    
    if (!numAmount || numAmount < 0.01) {
      setError("Mindestbetrag: €0.01");
      return;
    }
    
    if (numAmount > balance) {
      setError("Nicht genügend Guthaben");
      return;
    }
    
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
      if (onSuccess) onSuccess(data);
    } catch (err) {
      setError(err.message || "Überweisung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [5, 10, 20, 50];
  const visibleSavedRecipients = savedRecipients || [];
  const visibleRecentContacts = recentContacts || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[10000]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
      {/* Backdrop */}
      <motion.div 
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      
      {/* Modal */}
      <motion.div
        className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-[420px]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={spring}
      >
        <div className="bg-[#f8fafc] rounded-t-[32px] sm:rounded-[32px] min-h-[85vh] sm:min-h-0 sm:max-h-[90vh] overflow-hidden border border-slate-200 shadow-[0_24px_64px_rgba(15,23,42,0.16)]">
          
          {/* ═══════════════════════════════════════════════════════════════
              STEP 1: SELECT RECIPIENT
          ═══════════════════════════════════════════════════════════════ */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.2 }}
              >
                {/* Header */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-[22px] font-bold text-slate-900">Geld senden</h1>
                    <motion.button
                      data-testid="send-money-close-button"
                      onClick={onClose}
                      className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center"
                      whileTap={{ scale: 0.9 }}
                    >
                      <X size={18} className="text-slate-600" />
                    </motion.button>
                  </div>
                  
                  {/* Balance Card */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-[#00C2FF]/12 to-[#8B5CF6]/10 border border-[#00C2FF]/18 mb-6 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                    <p className="text-[12px] text-[#00C2FF] font-medium mb-1">Verfügbar</p>
                    <p className="text-[36px] font-bold text-slate-900 tracking-tight">€{balance.toFixed(2)}</p>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      { icon: User, label: "Username", color: "#8B5CF6" },
                      { icon: QrCode, label: "Scannen", color: "#00C2FF" },
                      { icon: Users, label: "Kontakte", color: "#10B981" },
                      { icon: Mail, label: "E-Mail", color: "#F59E0B" },
                    ].map((item, i) => (
                      <motion.button
                        key={i}
                        className="flex flex-col items-center gap-2 py-4 rounded-2xl"
                        style={{ background: `${item.color}10` }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <item.icon size={22} style={{ color: item.color }} />
                        <span className="text-[10px] font-semibold text-slate-700">{item.label}</span>
                      </motion.button>
                    ))}
                  </div>
                  
                  {/* Search */}
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      data-testid="send-money-search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Username, E-Mail oder BidBlitz ID..."
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-[15px] placeholder-slate-400 outline-none focus:border-[#00C2FF]/40 transition-colors"
                      autoFocus
                    />
                  </div>
                </div>
                
                {/* Search Results */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-4"
                    >
                      <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-3">Gefunden</p>
                      {searchResults.map((r) => (
                        <motion.button
                          data-testid={`send-money-search-result-${r.user_id}`}
                          key={r.user_id}
                          onClick={() => selectRecipient(r)}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#00C2FF]/5 border border-[#00C2FF]/20 mb-2"
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[20px] font-bold text-white shadow-lg shadow-[#00C2FF]/20">
                            {r.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-[16px] font-semibold text-slate-900">{r.name}</p>
                            <p className="text-[12px] text-[#00C2FF]">
                              {r.username ? `@${r.username}` : r.bidblitz_id}
                            </p>
                          </div>
                          <ChevronRight size={20} className="text-slate-300" />
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Tabs: Gespeicherte | Kürzlich */}
                <div className="px-6 pb-4">
                  <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
                    <button
                      data-testid="send-money-tab-saved"
                      onClick={() => setActiveList("saved")}
                      className={`flex-1 py-3 rounded-xl font-semibold text-[13px] transition-colors ${
                        activeList === "saved"
                          ? "bg-[#00C2FF]/20 text-[#00C2FF]"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      ⭐ Gespeicherte
                    </button>
                    <button
                      data-testid="send-money-tab-recent"
                      onClick={() => setActiveList("recent")}
                      className={`flex-1 py-3 rounded-xl font-semibold text-[13px] transition-colors ${
                        activeList === "recent"
                          ? "bg-[#00C2FF]/20 text-[#00C2FF]"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      🕐 Kürzlich
                    </button>
                  </div>
                </div>

                {/* Saved Recipients */}
                {activeList === "saved" && visibleSavedRecipients.length > 0 && (
                  <div className="px-6 pb-6 overflow-y-auto max-h-[40vh]">
                    <div className="grid grid-cols-2 gap-3">
                      {visibleSavedRecipients.map((saved) => {
                        const iconMap = { family: '👨‍👩‍👧', friend: '👤', work: '💼', star: '⭐', user: '👤' };
                        const savedKey = saved.id || saved.recipient_number || saved.recipient_id || saved.nickname;
                        return (
                          <motion.button
                            data-testid={`send-money-saved-recipient-${savedKey}`}
                            key={savedKey}
                            onClick={() => selectRecipient({ 
                              user_id: saved.recipient_id, 
                              name: saved.recipient_name,
                              email: saved.recipient_id,
                              bidblitz_id: saved.recipient_number 
                            })}
                            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#00C2FF]/30 transition-all"
                            whileTap={{ scale: 0.95 }}
                          >
                            <div className="text-3xl mb-2">{iconMap[saved.icon] || '👤'}</div>
                            <p className="text-sm font-semibold text-slate-900 truncate">{saved.nickname}</p>
                            <p className="text-xs text-slate-500 truncate">{saved.recipient_number}</p>
                            {saved.transfer_count > 0 && (
                              <p className="text-[10px] text-[#00C2FF] mt-1">{saved.transfer_count}x gesendet</p>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent Contacts */}
                {activeList === "recent" && (
                <div className="px-6 pb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={14} className="text-slate-400" />
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Zuletzt gesendet</p>
                  </div>
                  
                  {visibleRecentContacts.length === 0 ? (
                    <div className="text-center py-8">
                      <Users size={32} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-[13px] text-slate-500">Noch keine Kontakte</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visibleRecentContacts.slice(0, 5).map((c, i) => (
                        <motion.button
                          data-testid={`send-money-recent-contact-${c.user_id || i}`}
                          key={c.user_id || i}
                          onClick={() => selectRecipient(c)}
                          className="w-full flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-200 hover:border-[#00C2FF]/30 transition-colors"
                          whileTap={{ scale: 0.98 }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-[14px] font-bold text-slate-600">
                            {c.name?.[0]?.toUpperCase() || "?"}
                          </div>
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
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                STEP 2: ENTER AMOUNT
            ═══════════════════════════════════════════════════════════════ */}
            {step === 2 && recipient && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col min-h-[85vh] sm:min-h-[500px]"
              >
                {/* Header */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-center gap-4 mb-6">
                    <motion.button
                      data-testid="send-money-back-button"
                      onClick={() => setStep(1)}
                      className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center"
                      whileTap={{ scale: 0.9 }}
                    >
                      <ArrowLeft size={18} className="text-slate-600" />
                    </motion.button>
                    <h1 className="text-[18px] font-bold text-slate-900">Betrag eingeben</h1>
                  </div>
                  
                  {/* Recipient */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[20px] font-bold text-white">
                      {recipient.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold text-slate-900">{recipient.name}</p>
                      <p className="text-[12px] text-[#00C2FF]">
                        {recipient.username ? `@${recipient.username}` : recipient.bidblitz_id}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Amount Input */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <span className="text-[48px] font-bold text-slate-300">€</span>
                    <input
                      data-testid="send-money-amount-input"
                      ref={inputRef}
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="0"
                      className="text-[64px] font-bold text-slate-900 bg-transparent outline-none text-center w-48 placeholder-slate-300"
                    />
                  </div>
                  <p className="text-[13px] text-slate-500">
                    Verfügbar: <span className="text-[#00C2FF] font-semibold">€{balance.toFixed(2)}</span>
                  </p>
                  
                  {/* Quick Amount Buttons */}
                  <div className="flex items-center gap-2 mt-6">
                    {quickAmounts.map((q) => (
                      <motion.button
                        data-testid={`send-money-quick-amount-${q}`}
                        key={q}
                        onClick={() => addAmount(q)}
                        className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-[14px] font-semibold text-slate-700 hover:border-[#00C2FF]/30 transition-colors"
                        whileTap={{ scale: 0.95 }}
                      >
                        <Plus size={12} className="inline mr-1" />€{q}
                      </motion.button>
                    ))}
                    <motion.button
                      data-testid="send-money-quick-amount-max"
                      onClick={setMax}
                      className="px-5 py-2.5 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20 text-[14px] font-semibold text-[#00C2FF]"
                      whileTap={{ scale: 0.95 }}
                    >
                      MAX
                    </motion.button>
                  </div>
                  
                  {/* Message */}
                  <input
                    data-testid="send-money-message-input"
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Nachricht hinzufügen..."
                    className="w-full mt-6 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-[14px] placeholder-slate-400 outline-none text-center"
                  />
                </div>
                
                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="mx-6 mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2"
                    >
                      <AlertCircle size={16} className="text-red-400" />
                      <span className="text-[13px] text-red-400">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Send Button */}
                <div className="px-6 pb-8">
                  <motion.button
                    data-testid="send-money-submit-button"
                    onClick={handleSend}
                    disabled={loading || !amount || parseFloat(amount) <= 0}
                    className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#0066FF] text-white font-bold text-[17px] flex items-center justify-center gap-3 disabled:opacity-40 shadow-lg shadow-[#00C2FF]/20"
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? (
                      <Loader2 size={22} className="animate-spin" />
                    ) : (
                      <>
                        <Send size={20} />
                        €{parseFloat(amount || 0).toFixed(2)} senden
                      </>
                    )}
                  </motion.button>
                  
                  <p className="text-center text-[11px] text-slate-500 mt-3">
                    Kostenlos & sofort • Keine Gebühren
                  </p>
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                STEP 3: SUCCESS
            ═══════════════════════════════════════════════════════════════ */}
            {step === 3 && result && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", damping: 20 }}
                className="flex flex-col items-center justify-center min-h-[85vh] sm:min-h-[500px] px-6 py-12"
              >
                {/* Success Animation */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12, delay: 0.1 }}
                  className="relative mb-8"
                >
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#00D26A] to-[#00A855] flex items-center justify-center shadow-2xl shadow-[#00D26A]/30">
                    <CheckCircle2 size={56} className="text-white" />
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#FFD700] flex items-center justify-center"
                  >
                    <Sparkles size={16} className="text-black" />
                  </motion.div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <h2 className="text-[28px] font-bold text-slate-900 mb-2">Gesendet!</h2>
                  <p className="text-[15px] text-slate-500">Geld erfolgreich überwiesen</p>
                </motion.div>
                
                {/* Amount */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="my-8"
                >
                  <p className="text-[56px] font-bold text-slate-900 tracking-tight">
                    €{parseFloat(amount).toFixed(2)}
                  </p>
                </motion.div>
                
                {/* Recipient */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-slate-200"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[16px] font-bold text-white">
                    {recipient?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">{recipient?.name}</p>
                    <p className="text-[11px] text-slate-500">Empfänger</p>
                  </div>
                </motion.div>
                
                {/* Reference */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-[12px] text-slate-500 mt-6 font-mono"
                >
                  Ref: {result.reference}
                </motion.p>
                
                {/* New Balance */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-8 text-center"
                >
                  <p className="text-[11px] text-slate-500 mb-1">Neues Guthaben</p>
                  <p className="text-[24px] font-bold text-[#00C2FF]">€{normalizeAmount(result.sender_new_balance).toFixed(2)}</p>
                </motion.div>
                
                {/* Done Button */}
                <motion.button
                  data-testid="send-money-done-button"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  onClick={onClose}
                  className="mt-8 w-full py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-semibold text-[15px]"
                  whileTap={{ scale: 0.98 }}
                >
                  Fertig
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SendMoneyModal;
