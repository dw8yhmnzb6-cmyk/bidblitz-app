/**
 * BidBlitz V2 - Send Money Modal
 * P2P transfer within the BidBlitz wallet ecosystem
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, CheckCircle, AlertCircle, AtSign } from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.REACT_APP_BACKEND_URL;

async function apiCall(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

const SendMoneyModal = ({ isOpen, onClose, currentBalance, onSuccess }) => {
  const [step, setStep] = useState("form"); // form | sending | success | error
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [sentData, setSentData] = useState(null);

  const parsedAmount = parseFloat(amount) || 0;
  const insufficientBalance = parsedAmount > currentBalance;
  const isValidAmount = parsedAmount >= 0.01 && parsedAmount <= 10000;
  const isValidRecipient = recipient.includes("@") && recipient.length >= 5;

  const handleSend = async () => {
    if (!isValidRecipient || !isValidAmount || insufficientBalance) return;

    setStep("sending");
    setError(null);

    try {
      const data = await apiCall("/api/wallet/send", {
        method: "POST",
        body: JSON.stringify({
          recipient_email: recipient.trim().toLowerCase(),
          amount: parsedAmount,
          note: note.trim() || undefined,
        }),
      });

      setSentData({
        recipient: data.recipient_name || recipient,
        amount: parsedAmount,
        transaction_id: data.transaction_id,
      });
      setStep("success");
      
      if (onSuccess) {
        onSuccess({ amount: parsedAmount, recipient });
      }
    } catch (err) {
      setError(err.message || "Transfer fehlgeschlagen");
      setStep("error");
    }
  };

  const handleClose = () => {
    setStep("form");
    setRecipient("");
    setAmount("");
    setNote("");
    setError(null);
    setSentData(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={step === "sending" ? undefined : handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          className="relative w-full max-w-md bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 24px), 32px)" }}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white">
              {step === "form" && "Geld senden"}
              {step === "sending" && "Wird gesendet..."}
              {step === "success" && "Gesendet!"}
              {step === "error" && "Fehlgeschlagen"}
            </h2>
            {step !== "sending" && (
              <motion.button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <X size={16} className="text-white/60" />
              </motion.button>
            )}
          </div>

          <div className="p-5">
            <AnimatePresence mode="wait">
              {/* Form Step */}
              {step === "form" && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Balance Info */}
                  <div className={`p-4 rounded-xl border ${
                    insufficientBalance ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'
                  }`}>
                    <p className="text-xs text-gray-400">Verfügbares Guthaben</p>
                    <p className={`text-2xl font-bold ${insufficientBalance ? 'text-red-400' : 'text-green-400'}`}>
                      €{currentBalance.toFixed(2)}
                    </p>
                  </div>

                  {/* Recipient Email */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">
                      Empfänger E-Mail
                    </label>
                    <div className="relative">
                      <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="email"
                        placeholder="empfaenger@email.com"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-[#141414] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#A855F7]/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">
                      Betrag
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold text-lg">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="10000"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-4 bg-[#141414] border border-white/10 rounded-xl text-white text-lg font-bold placeholder-gray-500 focus:border-[#A855F7]/50 focus:outline-none"
                      />
                    </div>
                    {insufficientBalance && parsedAmount > 0 && (
                      <p className="text-xs text-red-400 mt-2">
                        Nicht genug Guthaben
                      </p>
                    )}
                  </div>

                  {/* Note (optional) */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">
                      Nachricht (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Wofür ist das Geld?"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={100}
                      className="w-full px-4 py-4 bg-[#141414] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#A855F7]/50 focus:outline-none"
                    />
                  </div>

                  {/* Send Button */}
                  <motion.button
                    onClick={handleSend}
                    disabled={!isValidRecipient || !isValidAmount || insufficientBalance}
                    className="w-full py-4 bg-[#A855F7] text-white font-bold text-base rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                    whileTap={{ scale: 0.98 }}
                  >
                    <Send size={18} />
                    Senden {parsedAmount > 0 && `€${parsedAmount.toFixed(2)}`}
                  </motion.button>

                  <p className="text-xs text-center text-gray-500">
                    Geld wird sofort vom Wallet abgezogen
                  </p>
                </motion.div>
              )}

              {/* Sending Step */}
              {step === "sending" && (
                <motion.div
                  key="sending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 text-center"
                >
                  <Loader2 size={48} className="mx-auto text-[#A855F7] animate-spin mb-4" />
                  <p className="text-white font-medium">Transfer wird durchgeführt...</p>
                  <p className="text-sm text-gray-500 mt-2">€{parsedAmount.toFixed(2)} an {recipient}</p>
                </motion.div>
              )}

              {/* Success Step */}
              {step === "success" && sentData && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-8 text-center"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <CheckCircle size={40} className="text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    €{sentData.amount.toFixed(2)} gesendet!
                  </h3>
                  <p className="text-gray-400 mb-6">
                    An {sentData.recipient}
                  </p>
                  <motion.button
                    onClick={handleClose}
                    className="w-full py-4 bg-white/10 text-white font-semibold rounded-xl"
                    whileTap={{ scale: 0.98 }}
                  >
                    Fertig
                  </motion.button>
                </motion.div>
              )}

              {/* Error Step */}
              {step === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-8 text-center"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <AlertCircle size={40} className="text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Transfer fehlgeschlagen
                  </h3>
                  <p className="text-red-400 mb-6">{error}</p>
                  <div className="space-y-3">
                    <motion.button
                      onClick={() => setStep("form")}
                      className="w-full py-4 bg-[#A855F7] text-white font-semibold rounded-xl"
                      whileTap={{ scale: 0.98 }}
                    >
                      Erneut versuchen
                    </motion.button>
                    <motion.button
                      onClick={handleClose}
                      className="w-full py-3 text-gray-400 font-medium"
                      whileTap={{ scale: 0.98 }}
                    >
                      Abbrechen
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SendMoneyModal;
