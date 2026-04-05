import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Scan, Loader2, Check, X, AlertCircle, User,
  Smartphone, CreditCard, Zap
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";

const panelBg = "rgba(8,12,20,0.7)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const MerchantTerminalPage = ({ onBack }) => {
  const { t } = useI18n();
  const [step, setStep] = useState("amount"); // amount → scan → confirm → done
  const [amount, setAmount] = useState("");
  const [barcode, setBarcode] = useState("");
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [payMethod, setPayMethod] = useState("barcode"); // barcode, nfc_wallet, nfc_card
  const inputRef = useRef(null);

  const quickAmounts = [5, 10, 15, 20, 25, 50];

  const goToScan = () => {
    if (!amount || parseFloat(amount) <= 0) { setError(t("terminal.enter_amount") || "Enter amount"); return; }
    setError("");
    setStep("scan");
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const lookupBarcode = useCallback(async (code) => {
    if (!code || code.length < 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.barcodeLookup(code);
      setCustomer(res);
      setStep("confirm");
    } catch (e) {
      setError(e.message || "Invalid barcode");
    }
    setLoading(false);
  }, []);

  const handleScanInput = (val) => {
    setBarcode(val);
    // Auto-lookup when barcode format matches (BLZ-XXXXXXXXXXXXXXXX)
    if (val.length >= 20 && val.startsWith("BLZ-")) {
      lookupBarcode(val);
    }
  };

  const confirmPayment = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.barcodePayment({
        barcode,
        amount: parseFloat(amount),
        description: `Payment ${parseFloat(amount).toFixed(2)} EUR`,
      });
      setResult(res);
      setStep("done");
    } catch (e) {
      setError(e.message || "Payment failed");
    }
    setLoading(false);
  };

  const reset = () => {
    setStep("amount");
    setAmount("");
    setBarcode("");
    setCustomer(null);
    setResult(null);
    setError("");
  };

  return (
    <motion.div data-testid="merchant-terminal-page" className="min-h-screen pb-24" style={{ background: "#040610" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(4,6,16,0.85)", borderBottom: panelBorder }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button data-testid="terminal-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/40" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-white/90 font-outfit">{t("terminal.title") || "Payment Terminal"}</h1>
            <p className="text-[9px] text-white/25">{t("terminal.subtitle") || "Accept payments"}</p>
          </div>
          <Scan size={18} className="text-[#00E0FF]/30" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {["amount", "scan", "confirm", "done"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                step === s ? "bg-[#00E0FF]/15 text-[#00E0FF] border border-[#00E0FF]/20" :
                ["amount", "scan", "confirm", "done"].indexOf(step) > i ? "bg-[#00E89D]/10 text-[#00E89D]" :
                "bg-white/[0.02] text-[#333] border border-white/[0.04]"}`}>
                {["amount", "scan", "confirm", "done"].indexOf(step) > i ? <Check size={10} /> : i + 1}
              </div>
              {i < 3 && <div className="w-6 h-[1px] bg-white/[0.05]" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1: AMOUNT ── */}
          {step === "amount" && (
            <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="rounded-2xl p-5 backdrop-blur-xl text-center" style={{ background: panelBg, border: panelBorder }}>
                <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold mb-4">{t("terminal.enter_amount") || "Enter Amount"}</p>
                <div className="flex items-center justify-center gap-1 mb-4">
                  <span className="text-[20px] text-white/20 font-mono">EUR</span>
                  <input
                    data-testid="terminal-amount-input"
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-[42px] font-black text-[#00E0FF] font-mono bg-transparent border-none outline-none text-center w-40"
                    step="0.01"
                    min="0.01"
                    autoFocus
                  />
                </div>
                {/* Quick amounts */}
                <div className="grid grid-cols-6 gap-1.5 mb-4">
                  {quickAmounts.map(q => (
                    <motion.button key={q} onClick={() => setAmount(String(q))} whileTap={{ scale: 0.95 }}
                      className="py-2 rounded-lg text-[11px] font-bold font-mono" style={{ background: amount === String(q) ? "rgba(0,224,255,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${amount === String(q) ? "rgba(0,224,255,0.15)" : "rgba(255,255,255,0.04)"}`, color: amount === String(q) ? "#00E0FF" : "#444" }}>
                      {q}
                    </motion.button>
                  ))}
                </div>
                <motion.button data-testid="terminal-next-btn" onClick={goToScan} whileTap={{ scale: 0.95 }}
                  className="w-full py-3.5 rounded-xl text-[13px] font-bold"
                  style={{ background: amount ? "rgba(0,232,157,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${amount ? "rgba(0,232,157,0.2)" : "rgba(255,255,255,0.04)"}`, color: amount ? "#00E89D" : "#333" }}>
                  {t("terminal.scan_code") || "Scan Customer Code"} →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: SCAN ── */}
          {step === "scan" && (
            <motion.div key="scan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="rounded-2xl p-5 backdrop-blur-xl text-center" style={{ background: panelBg, border: panelBorder }}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)" }}>
                  <Scan size={28} className="text-[#00E0FF]" />
                </div>
                <p className="text-[12px] font-bold text-white/70 mb-1">{t("terminal.scan_barcode") || "Scan Customer Barcode"}</p>
                <p className="text-[22px] font-black text-[#00E0FF] font-mono mb-4">{parseFloat(amount).toFixed(2)} EUR</p>
                <input
                  ref={inputRef}
                  data-testid="terminal-barcode-input"
                  value={barcode}
                  onChange={e => handleScanInput(e.target.value)}
                  placeholder="BLZ-XXXXXXXXXXXXXXXX"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[14px] text-white/80 font-mono text-center placeholder:text-white/15 outline-none mb-3"
                  autoFocus
                />
                {loading && <Loader2 size={20} className="text-[#00E0FF] animate-spin mx-auto" />}
                <motion.button onClick={() => lookupBarcode(barcode)} disabled={loading || barcode.length < 6} whileTap={{ scale: 0.95 }}
                  className="w-full py-2.5 rounded-xl text-[11px] font-bold mt-2" style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.12)", color: "#00E0FF" }}>
                  {t("terminal.lookup") || "Lookup"}
                </motion.button>
                <motion.button onClick={() => setStep("amount")} className="text-[10px] text-white/20 underline mt-3 block mx-auto">{t("common.back") || "Back"}</motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: CONFIRM ── */}
          {step === "confirm" && customer && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="rounded-2xl p-5 backdrop-blur-xl" style={{ background: panelBg, border: "1px solid rgba(0,232,157,0.1)" }}>
                <div className="text-center mb-4">
                  <div className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: "rgba(0,232,157,0.06)", border: "1px solid rgba(0,232,157,0.12)" }}>
                    <User size={22} className="text-[#00E89D]" />
                  </div>
                  <p className="text-[16px] font-bold text-white/90">{customer.customer_name}</p>
                  <p className="text-[10px] text-white/25">{customer.customer_email}</p>
                </div>
                <div className="rounded-xl p-4 mb-4 text-center" style={{ background: "rgba(0,224,255,0.03)", border: "1px solid rgba(0,224,255,0.06)" }}>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">{t("terminal.amount") || "Amount"}</p>
                  <p className="text-[36px] font-black text-[#00E0FF] font-mono">{parseFloat(amount).toFixed(2)}</p>
                  <p className="text-[10px] text-white/20">EUR · {t("terminal.wallet_payment") || "Wallet Payment"} · 0.5% {t("terminal.fee") || "Fee"}</p>
                </div>
                <motion.button data-testid="terminal-confirm-btn" onClick={confirmPayment} disabled={loading} whileTap={{ scale: 0.95 }}
                  className="w-full py-4 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
                  style={{ background: "rgba(0,232,157,0.12)", border: "1px solid rgba(0,232,157,0.25)", color: "#00E89D" }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> {t("terminal.confirm_pay") || "Confirm Payment"}</>}
                </motion.button>
                <motion.button onClick={() => { setStep("scan"); setCustomer(null); setBarcode(""); }} className="text-[10px] text-white/20 underline mt-3 block mx-auto">{t("common.cancel") || "Cancel"}</motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: DONE ── */}
          {step === "done" && result && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="rounded-2xl p-6 backdrop-blur-xl text-center" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.12)" }}>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}>
                  <Check size={48} className="text-[#00E89D] mx-auto mb-3" />
                </motion.div>
                <p className="text-[18px] font-bold text-[#00E89D] mb-1">{t("terminal.payment_success") || "Payment Successful"}</p>
                <p className="text-[28px] font-black text-white/90 font-mono mb-1">{result.amount.toFixed(2)} EUR</p>
                <p className="text-[10px] text-white/25">{result.customer_name}</p>
                <div className="flex justify-center gap-4 mt-3 text-[9px] text-white/20">
                  <span>{t("terminal.fee") || "Fee"}: {result.fee.toFixed(2)}</span>
                  <span>{t("terminal.net") || "Net"}: {result.net.toFixed(2)}</span>
                </div>
                <motion.button data-testid="terminal-new-btn" onClick={reset} whileTap={{ scale: 0.95 }}
                  className="w-full py-3 rounded-xl text-[12px] font-bold mt-5"
                  style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)", color: "#00E0FF" }}>
                  {t("terminal.new_payment") || "New Payment"}
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.1)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AlertCircle size={12} className="text-[#FF4757]" />
            <span className="text-[10px] text-[#FF4757]">{error}</span>
            <motion.button onClick={() => setError("")} className="ml-auto"><X size={10} className="text-[#FF4757]" /></motion.button>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
};

export default MerchantTerminalPage;
