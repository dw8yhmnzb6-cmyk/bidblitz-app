/**
 * BidBlitz V2 - Tip Modal
 * Reusable component for tipping staff at merchants/restaurants
 * Shows % presets, fixed amounts, and custom input
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Send, Loader2, Check, ChevronDown } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const TipModal = ({
  isOpen,
  onClose,
  billAmount = 0,
  staffEmail = "",
  staffName = "",
  merchantId = "",
  transactionId = "",
  staffList = [],
  posCustomerId = "",  // POS mode: tip charged from customer, credited to logged-in staff
  onTipSent,
}) => {
  const isPosMode = !!posCustomerId;
  const [mode, setMode] = useState("percent"); // percent | fixed | custom
  const [selectedPercent, setSelectedPercent] = useState(null);
  const [selectedFixed, setSelectedFixed] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [chosenStaff, setChosenStaff] = useState(staffEmail);
  const [chosenStaffName, setChosenStaffName] = useState(staffName);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedPercent(null);
      setSelectedFixed(null);
      setCustomAmount("");
      setMessage("");
      setSending(false);
      setSuccess(null);
      setError("");
      setChosenStaff(staffEmail);
      setChosenStaffName(staffName);
      if (!staffEmail && staffList.length > 0) {
        setChosenStaff(staffList[0].email);
        setChosenStaffName(staffList[0].name);
      }
    }
  }, [isOpen, staffEmail, staffName, staffList]);

  const percentOptions = [
    { pct: 5, amt: Math.max(0.50, +(billAmount * 0.05).toFixed(2)) },
    { pct: 10, amt: Math.max(1.00, +(billAmount * 0.10).toFixed(2)) },
    { pct: 15, amt: Math.max(1.50, +(billAmount * 0.15).toFixed(2)) },
    { pct: 20, amt: Math.max(2.00, +(billAmount * 0.20).toFixed(2)) },
  ];
  const fixedOptions = [1, 2, 5];

  const tipAmount = (() => {
    if (mode === "percent" && selectedPercent !== null) {
      return percentOptions.find(p => p.pct === selectedPercent)?.amt || 0;
    }
    if (mode === "fixed" && selectedFixed !== null) return selectedFixed;
    if (mode === "custom" && customAmount) return parseFloat(customAmount) || 0;
    return 0;
  })();

  const cashback = +(tipAmount * 0.02).toFixed(2);

  const sendTip = async () => {
    if (!tipAmount || tipAmount <= 0) return;
    if (!isPosMode && !chosenStaff) { setError("Bitte Mitarbeiter auswählen"); return; }
    setSending(true);
    setError("");
    try {
      const endpoint = isPosMode ? `${API}/api/tips/pos` : `${API}/api/tips/send`;
      const body = isPosMode
        ? { customer_id: posCustomerId, amount: tipAmount, transaction_id: transactionId, message: message || null }
        : { staff_email: chosenStaff, amount: tipAmount, transaction_id: transactionId, merchant_id: merchantId, message: message || null };

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSuccess(data);
        onTipSent?.(data);
      } else {
        setError(data.detail || "Fehler beim Senden");
      }
    } catch {
      setError("Netzwerkfehler");
    }
    setSending(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
        data-testid="tip-modal-overlay"
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 overflow-hidden"
          data-testid="tip-modal"
        >
          {/* Success View */}
          {success ? (
            <div className="p-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-[#10B981]/10 border-2 border-[#10B981] flex items-center justify-center mx-auto mb-4"
              >
                <Check size={32} className="text-[#10B981]" />
              </motion.div>
              <h3 className="text-lg font-bold text-white mb-1">Trinkgeld gesendet!</h3>
              <p className="text-sm text-gray-400 mb-2">
                €{success.amount?.toFixed(2)} an {success.staff_name || chosenStaffName}
              </p>
              {success.cashback > 0 && (
                <p className="text-xs text-[#10B981] font-medium mb-4">
                  +€{success.cashback?.toFixed(2)} Cashback erhalten
                </p>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-white/5 text-white font-semibold text-sm"
                data-testid="tip-close-btn"
              >
                Fertig
              </motion.button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                    <Heart size={18} className="text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-white">Trinkgeld geben</h3>
                    {billAmount > 0 && (
                      <p className="text-[10px] text-gray-500">Rechnung: €{billAmount.toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2 rounded-xl bg-white/5">
                  <X size={16} className="text-gray-400" />
                </motion.button>
              </div>

              {/* Staff Picker */}
              {(staffList.length > 1 || (!staffEmail && staffList.length > 0)) && (
                <div className="px-5 mb-3">
                  <p className="text-[10px] text-gray-500 mb-1.5">Trinkgeld für:</p>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowStaffPicker(!showStaffPicker)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                    data-testid="staff-picker-toggle"
                  >
                    <span className="text-xs font-medium text-white">
                      {chosenStaffName || chosenStaff || "Mitarbeiter wählen"}
                    </span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${showStaffPicker ? "rotate-180" : ""}`} />
                  </motion.button>
                  <AnimatePresence>
                    {showStaffPicker && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-1"
                      >
                        <div className="bg-white/[0.03] rounded-xl border border-white/5 overflow-hidden">
                          {staffList.map((s) => (
                            <motion.button
                              key={s.email}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setChosenStaff(s.email);
                                setChosenStaffName(s.name);
                                setShowStaffPicker(false);
                              }}
                              className={`w-full flex items-center gap-3 p-3 text-left border-b border-white/5 last:border-0 ${
                                chosenStaff === s.email ? "bg-[#F59E0B]/5" : ""
                              }`}
                              data-testid={`staff-option-${s.email}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center text-[11px] font-bold text-[#F59E0B]">
                                {(s.name || s.email || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-white">{s.name || "Mitarbeiter"}</p>
                                <p className="text-[9px] text-gray-500">{s.email}</p>
                              </div>
                              {chosenStaff === s.email && <Check size={14} className="ml-auto text-[#F59E0B]" />}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Direct staff input if no list */}
              {staffList.length === 0 && !staffEmail && (
                <div className="px-5 mb-3">
                  <p className="text-[10px] text-gray-500 mb-1.5">E-Mail des Mitarbeiters:</p>
                  <input
                    type="email"
                    value={chosenStaff}
                    onChange={(e) => setChosenStaff(e.target.value)}
                    placeholder="mitarbeiter@email.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none text-white"
                    data-testid="staff-email-input"
                  />
                </div>
              )}

              {/* Mode Tabs */}
              <div className="px-5 mb-3">
                <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                  {[
                    { id: "percent", label: "Prozent" },
                    { id: "fixed", label: "Festbetrag" },
                    { id: "custom", label: "Eigener" },
                  ].map((tab) => (
                    <motion.button
                      key={tab.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setMode(tab.id);
                        setSelectedPercent(null);
                        setSelectedFixed(null);
                        setCustomAmount("");
                      }}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                        mode === tab.id
                          ? "bg-[#F59E0B] text-black"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                      data-testid={`tip-mode-${tab.id}`}
                    >
                      {tab.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Amount Selection */}
              <div className="px-5 mb-3">
                {mode === "percent" && (
                  <div className="grid grid-cols-4 gap-2" data-testid="tip-percent-options">
                    {percentOptions.map((opt) => (
                      <motion.button
                        key={opt.pct}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setSelectedPercent(opt.pct)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          selectedPercent === opt.pct
                            ? "bg-[#F59E0B]/10 border-[#F59E0B] shadow-lg shadow-[#F59E0B]/10"
                            : "bg-white/[0.03] border-white/10 hover:border-white/20"
                        }`}
                        data-testid={`tip-pct-${opt.pct}`}
                      >
                        <p className={`text-base font-bold ${selectedPercent === opt.pct ? "text-[#F59E0B]" : "text-white"}`}>
                          {opt.pct}%
                        </p>
                        <p className="text-[9px] text-gray-500 mt-0.5">€{opt.amt.toFixed(2)}</p>
                      </motion.button>
                    ))}
                  </div>
                )}

                {mode === "fixed" && (
                  <div className="grid grid-cols-3 gap-2" data-testid="tip-fixed-options">
                    {fixedOptions.map((amt) => (
                      <motion.button
                        key={amt}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setSelectedFixed(amt)}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          selectedFixed === amt
                            ? "bg-[#F59E0B]/10 border-[#F59E0B] shadow-lg shadow-[#F59E0B]/10"
                            : "bg-white/[0.03] border-white/10 hover:border-white/20"
                        }`}
                        data-testid={`tip-fixed-${amt}`}
                      >
                        <p className={`text-xl font-bold ${selectedFixed === amt ? "text-[#F59E0B]" : "text-white"}`}>
                          €{amt}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                )}

                {mode === "custom" && (
                  <div data-testid="tip-custom-input">
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="0.00"
                      min="0.50"
                      step="0.50"
                      className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-2xl font-bold text-center text-white outline-none focus:border-[#F59E0B]/50"
                      data-testid="tip-custom-amount"
                      autoFocus
                    />
                    <p className="text-[9px] text-gray-500 text-center mt-1.5">Mindestens €0.50</p>
                  </div>
                )}
              </div>

              {/* Optional Message */}
              <div className="px-5 mb-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Nachricht (optional) z.B. Danke für den tollen Service!"
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] outline-none text-gray-300 placeholder-gray-600"
                  data-testid="tip-message"
                />
              </div>

              {/* Summary */}
              {tipAmount > 0 && (
                <div className="px-5 mb-3">
                  <div className="p-3 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-400">Trinkgeld</span>
                      <span className="text-sm font-bold text-[#F59E0B]">€{tipAmount.toFixed(2)}</span>
                    </div>
                    {cashback > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#10B981]">Cashback (2%)</span>
                        <span className="text-[11px] font-semibold text-[#10B981]">+€{cashback.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-5 mb-3">
                  <p className="text-xs text-red-400 text-center">{error}</p>
                </div>
              )}

              {/* Send Button */}
              <div className="px-5 pb-6 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="px-5 py-3.5 rounded-xl bg-white/5 text-gray-400 font-medium text-xs"
                  data-testid="tip-skip-btn"
                >
                  Überspringen
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={sendTip}
                  disabled={!tipAmount || tipAmount < 0.5 || sending || !chosenStaff}
                  className="flex-1 py-3.5 rounded-xl bg-[#F59E0B] text-black font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
                  data-testid="tip-send-btn"
                >
                  {sending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={16} />
                      €{tipAmount.toFixed(2)} Trinkgeld senden
                    </>
                  )}
                </motion.button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TipModal;
