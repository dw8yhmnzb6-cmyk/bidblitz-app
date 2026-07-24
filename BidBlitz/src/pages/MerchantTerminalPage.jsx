import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Scan, Loader2, Check, X, AlertCircle, User,
  Smartphone, CreditCard, Zap, Wifi, WifiOff, Maximize,
  Minimize, QrCode, NfcIcon, Receipt, BarChart3, Clock,
  ShieldCheck, ChevronDown, Delete, Heart
} from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { api } from "../services/api";
import TipModal from "../components/TipModal";

const MerchantTerminalPage = ({ onBack }) => {
  const { t } = useI18n();
  const [step, setStep] = useState("amount");
  const [amount, setAmount] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [payMethod, setPayMethod] = useState("barcode");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dailySummary, setDailySummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [nfcReady, setNfcReady] = useState(false);
  const inputRef = useRef(null);

  // Online/offline detection
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Load daily summary
  useEffect(() => {
    api.getTerminalSummary?.().then(d => setDailySummary(d)).catch(() => {});
  }, [result]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Numeric keypad input
  const handleKeypad = (key) => {
    setError("");
    if (key === "C") { setAmount("0"); return; }
    if (key === "DEL") { setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : "0"); return; }
    if (key === ".") {
      if (amount.includes(".")) return;
      setAmount(prev => prev + ".");
      return;
    }
    setAmount(prev => {
      if (prev === "0" && key !== ".") return key;
      // Max 2 decimal places
      const parts = prev.split(".");
      if (parts[1] && parts[1].length >= 2) return prev;
      // Max amount 99999
      if (parseFloat(prev + key) > 99999) return prev;
      return prev + key;
    });
  };

  const parsedAmount = parseFloat(amount) || 0;

  const goToScan = () => {
    if (parsedAmount <= 0) { setError(t("terminal.enter_amount") || "Enter amount"); return; }
    setError("");
    setStep("scan");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const goToNfc = () => {
    if (parsedAmount <= 0) { setError(t("terminal.enter_amount") || "Enter amount"); return; }
    setError("");
    setPayMethod("nfc_wallet");
    setNfcReady(true);
    setStep("nfc");
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
        amount: parsedAmount,
        description: `POS ${parsedAmount.toFixed(2)} EUR`,
        payment_method: payMethod,
      });
      setResult(res);
      setStep("done");
      // Reload summary
      api.getTerminalSummary?.().then(d => setDailySummary(d)).catch(() => {});
    } catch (e) {
      setError(e.message || "Payment failed");
    }
    setLoading(false);
  };

  const processNfcPayment = async (method) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.nfcPayment({
        amount: parsedAmount,
        payment_method: method,
        description: `NFC ${parsedAmount.toFixed(2)} EUR`,
        device_id: "terminal",
      });
      setResult(res);
      setStep("done");
      api.getTerminalSummary?.().then(d => setDailySummary(d)).catch(() => {});
    } catch (e) {
      setError(e.message || "NFC Payment failed");
    }
    setLoading(false);
  };

  const reset = () => {
    setStep("amount");
    setAmount("0");
    setBarcode("");
    setCustomer(null);
    setResult(null);
    setError("");
    setNfcReady(false);
    setPayMethod("barcode");
  };

  const keypadKeys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "DEL"],
  ];

  return (
    <motion.div data-testid="merchant-terminal-page" data-cookie-banner-suppress="true" className="min-h-screen flex flex-col" style={{ background: "#020408" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "rgba(2,4,8,0.95)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="flex items-center gap-2">
          {!isFullscreen && (
            <motion.button data-testid="terminal-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
              <ArrowLeft size={14} className="text-white/30" />
            </motion.button>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-[#00E0FF] to-[#00E89D] flex items-center justify-center">
                <Zap size={10} className="text-[#020408]" />
              </div>
              <span className="text-[12px] font-black text-white/80 tracking-wide">BIDBLITZ</span>
              <span className="text-[8px] text-[#00E0FF]/40 font-bold tracking-widest ml-0.5">POS</span>
            </div>
            <p className="text-[7px] text-white/10 ml-6.5 tracking-widest">SECURE PAYMENT TERMINAL</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Online/Offline */}
          <div data-testid="online-indicator" className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: isOnline ? "rgba(0,232,157,0.06)" : "rgba(255,71,87,0.06)", border: `1px solid ${isOnline ? "rgba(0,232,157,0.12)" : "rgba(255,71,87,0.12)"}` }}>
            {isOnline ? <Wifi size={9} className="text-[#00E89D]" /> : <WifiOff size={9} className="text-[#FF4757]" />}
            <span className="text-[7px] font-bold" style={{ color: isOnline ? "#00E89D" : "#FF4757" }}>{isOnline ? "ONLINE" : "OFFLINE"}</span>
          </div>
          {/* Daily summary toggle */}
          <motion.button data-testid="toggle-summary" onClick={() => setShowSummary(!showSummary)} whileTap={{ scale: 0.9 }}
            className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
            <BarChart3 size={12} className="text-white/20" />
          </motion.button>
          {/* Fullscreen */}
          <motion.button data-testid="toggle-fullscreen" onClick={toggleFullscreen} whileTap={{ scale: 0.9 }}
            className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
            {isFullscreen ? <Minimize size={12} className="text-white/20" /> : <Maximize size={12} className="text-white/20" />}
          </motion.button>
        </div>
      </div>

      {/* ── Daily Summary Dropdown ── */}
      <AnimatePresence>
        {showSummary && dailySummary && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
            style={{ background: "rgba(0,224,255,0.02)", borderBottom: "1px solid rgba(0,224,255,0.06)" }}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[8px] text-white/20 uppercase tracking-widest font-bold">{t("terminal.today") || "Today"} · {dailySummary.date}</p>
                <p className="text-[8px] text-white/15">{dailySummary.total_transactions} {t("terminal.payments") || "Payments"}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-[16px] font-black font-mono text-[#00E89D]">{dailySummary.total_amount.toFixed(2)}</p>
                  <p className="text-[7px] text-white/15">{t("terminal.revenue") || "Revenue"}</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-black font-mono text-[#FFB800]">{dailySummary.total_fees.toFixed(2)}</p>
                  <p className="text-[7px] text-white/15">{t("terminal.fees") || "Fees"}</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-black font-mono text-[#00E0FF]">{dailySummary.total_net.toFixed(2)}</p>
                  <p className="text-[7px] text-white/15">{t("terminal.net") || "Net"}</p>
                </div>
              </div>
              {/* Method breakdown */}
              {Object.keys(dailySummary.method_breakdown || {}).length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {Object.entries(dailySummary.method_breakdown).map(([m, d]) => (
                    <div key={m} className="px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <span className="text-[7px] text-white/30 font-bold">{m.replace("_", " ").toUpperCase()}</span>
                      <span className="text-[8px] text-[#00E0FF] font-bold ml-1">{d.count}x {d.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">

          {/* ══════ STEP: AMOUNT (Numeric Keypad) ══════ */}
          {step === "amount" && (
            <motion.div key="amount" className="flex-1 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Amount Display */}
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
                <p className="text-[8px] text-white/15 uppercase tracking-[0.3em] font-bold mb-2">{t("terminal.amount_to_charge") || "AMOUNT TO CHARGE"}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[20px] text-white/15 font-mono font-bold">EUR</span>
                  <motion.span
                    data-testid="terminal-amount-display"
                    className="text-[56px] sm:text-[72px] font-black font-mono leading-none"
                    style={{ color: parsedAmount > 0 ? "#00E0FF" : "rgba(255,255,255,0.08)" }}
                    key={amount}
                    initial={{ scale: 1.02 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.1 }}
                  >
                    {parsedAmount > 0 ? parsedAmount.toFixed(amount.includes(".") ? Math.min(amount.split(".")[1]?.length || 0, 2) : 0) : "0.00"}
                  </motion.span>
                </div>
                {parsedAmount > 0 && parsedAmount <= 25 && (
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full" style={{ background: "rgba(0,232,157,0.06)", border: "1px solid rgba(0,232,157,0.1)" }}>
                    <Zap size={8} className="text-[#00E89D]" />
                    <span className="text-[7px] text-[#00E89D] font-bold tracking-wide">ULTRA-FAST</span>
                  </div>
                )}
                {parsedAmount > 50 && (
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.1)" }}>
                    <ShieldCheck size={8} className="text-[#A855F7]" />
                    <span className="text-[7px] text-[#A855F7] font-bold tracking-wide">PIN REQUIRED</span>
                  </div>
                )}
              </div>

              {/* Numeric Keypad */}
              <div className="px-4 pb-2">
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {keypadKeys.flat().map((key) => (
                    <motion.button
                      key={key}
                      data-testid={`keypad-${key === "." ? "dot" : key === "DEL" ? "del" : key}`}
                      onClick={() => handleKeypad(key)}
                      whileTap={{ scale: 0.92, backgroundColor: "rgba(255,255,255,0.06)" }}
                      className="h-14 sm:h-16 rounded-xl flex items-center justify-center text-[20px] font-bold font-mono transition-colors"
                      style={{
                        background: key === "DEL" ? "rgba(255,71,87,0.04)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${key === "DEL" ? "rgba(255,71,87,0.08)" : "rgba(255,255,255,0.04)"}`,
                        color: key === "DEL" ? "#FF4757" : "rgba(255,255,255,0.6)",
                      }}
                    >
                      {key === "DEL" ? <Delete size={18} /> : key}
                    </motion.button>
                  ))}
                </div>

                {/* Clear button */}
                <motion.button data-testid="keypad-clear" onClick={() => handleKeypad("C")} whileTap={{ scale: 0.95 }}
                  className="w-full py-2 rounded-xl text-[10px] font-bold text-white/15 mb-3" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}>
                  {t("terminal.clear") || "CLEAR"}
                </motion.button>

                {/* Payment Method Buttons */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {/* Scan Barcode */}
                  <motion.button
                    data-testid="terminal-scan-btn"
                    onClick={goToScan}
                    disabled={parsedAmount <= 0}
                    whileTap={{ scale: 0.95 }}
                    className="py-3.5 rounded-xl flex flex-col items-center gap-1"
                    style={{
                      background: parsedAmount > 0 ? "rgba(0,224,255,0.06)" : "rgba(255,255,255,0.01)",
                      border: `1px solid ${parsedAmount > 0 ? "rgba(0,224,255,0.15)" : "rgba(255,255,255,0.03)"}`,
                    }}
                  >
                    <Scan size={18} style={{ color: parsedAmount > 0 ? "#00E0FF" : "#222" }} />
                    <span className="text-[8px] font-bold" style={{ color: parsedAmount > 0 ? "#00E0FF" : "#222" }}>{t("terminal.scan") || "SCAN"}</span>
                  </motion.button>

                  {/* QR Code */}
                  <motion.button
                    data-testid="terminal-qr-btn"
                    onClick={goToScan}
                    disabled={parsedAmount <= 0}
                    whileTap={{ scale: 0.95 }}
                    className="py-3.5 rounded-xl flex flex-col items-center gap-1"
                    style={{
                      background: parsedAmount > 0 ? "rgba(0,232,157,0.06)" : "rgba(255,255,255,0.01)",
                      border: `1px solid ${parsedAmount > 0 ? "rgba(0,232,157,0.15)" : "rgba(255,255,255,0.03)"}`,
                    }}
                  >
                    <QrCode size={18} style={{ color: parsedAmount > 0 ? "#00E89D" : "#222" }} />
                    <span className="text-[8px] font-bold" style={{ color: parsedAmount > 0 ? "#00E89D" : "#222" }}>{t("terminal.qr") || "QR CODE"}</span>
                  </motion.button>

                  {/* NFC */}
                  <motion.button
                    data-testid="terminal-nfc-btn"
                    onClick={goToNfc}
                    disabled={parsedAmount <= 0}
                    whileTap={{ scale: 0.95 }}
                    className="py-3.5 rounded-xl flex flex-col items-center gap-1"
                    style={{
                      background: parsedAmount > 0 ? "rgba(168,85,247,0.06)" : "rgba(255,255,255,0.01)",
                      border: `1px solid ${parsedAmount > 0 ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)"}`,
                    }}
                  >
                    <Smartphone size={18} style={{ color: parsedAmount > 0 ? "#A855F7" : "#222" }} />
                    <span className="text-[8px] font-bold" style={{ color: parsedAmount > 0 ? "#A855F7" : "#222" }}>{t("terminal.nfc") || "NFC"}</span>
                  </motion.button>
                </div>

                {/* Big Start Payment Button */}
                <motion.button
                  data-testid="terminal-start-payment"
                  onClick={goToScan}
                  disabled={parsedAmount <= 0}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 rounded-2xl text-[15px] font-black tracking-wide flex items-center justify-center gap-2"
                  style={{
                    background: parsedAmount > 0
                      ? "linear-gradient(135deg, rgba(0,232,157,0.15), rgba(0,224,255,0.1))"
                      : "rgba(255,255,255,0.01)",
                    border: `1px solid ${parsedAmount > 0 ? "rgba(0,232,157,0.25)" : "rgba(255,255,255,0.03)"}`,
                    color: parsedAmount > 0 ? "#00E89D" : "#1a1a1a",
                    boxShadow: parsedAmount > 0 ? "0 0 30px rgba(0,232,157,0.05)" : "none",
                  }}
                >
                  <Zap size={16} />
                  {t("terminal.start_payment") || "START PAYMENT"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ══════ STEP: SCAN BARCODE ══════ */}
          {step === "scan" && (
            <motion.div key="scan" className="flex-1 flex flex-col items-center justify-center px-6" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="w-full max-w-sm text-center">
                <motion.div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(0,224,255,0.06)", border: "1px solid rgba(0,224,255,0.12)" }}
                  animate={{ boxShadow: ["0 0 0px rgba(0,224,255,0)", "0 0 30px rgba(0,224,255,0.1)", "0 0 0px rgba(0,224,255,0)"] }}
                  transition={{ duration: 2, repeat: Infinity }}>
                  <Scan size={36} className="text-[#00E0FF]" />
                </motion.div>
                <p className="text-[14px] font-bold text-white/70 mb-1">{t("terminal.scan_barcode") || "Scan Customer Barcode"}</p>
                <p className="text-[28px] font-black text-[#00E0FF] font-mono mb-5">{parsedAmount.toFixed(2)} EUR</p>
                <input
                  ref={inputRef}
                  data-testid="terminal-barcode-input"
                  value={barcode}
                  onChange={e => handleScanInput(e.target.value)}
                  placeholder="BLZ-XXXXXXXXXXXXXXXX"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[15px] text-white/80 font-mono text-center placeholder:text-white/10 outline-none focus:border-[#00E0FF]/20 transition-colors"
                  autoFocus
                />
                {loading && <Loader2 size={24} className="text-[#00E0FF] animate-spin mx-auto mt-4" />}
                <div className="flex gap-2 mt-4">
                  <motion.button onClick={() => { setStep("amount"); setBarcode(""); }} whileTap={{ scale: 0.95 }}
                    className="flex-1 py-3 rounded-xl text-[11px] font-bold text-white/20" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    {t("common.back") || "Back"}
                  </motion.button>
                  <motion.button onClick={() => lookupBarcode(barcode)} disabled={loading || barcode.length < 6} whileTap={{ scale: 0.95 }}
                    className="flex-1 py-3 rounded-xl text-[11px] font-bold" style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)", color: "#00E0FF" }}>
                    {t("terminal.lookup") || "LOOKUP"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════ STEP: NFC READY ══════ */}
          {step === "nfc" && (
            <motion.div key="nfc" className="flex-1 flex flex-col items-center justify-center px-6" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="w-full max-w-sm text-center">
                <motion.div className="w-24 h-24 rounded-full mx-auto mb-5 flex items-center justify-center"
                  style={{ background: "rgba(168,85,247,0.06)", border: "2px solid rgba(168,85,247,0.15)" }}
                  animate={{ boxShadow: ["0 0 0px rgba(168,85,247,0)", "0 0 40px rgba(168,85,247,0.15)", "0 0 0px rgba(168,85,247,0)"] }}
                  transition={{ duration: 1.5, repeat: Infinity }}>
                  <Smartphone size={40} className="text-[#A855F7]" />
                </motion.div>
                <p className="text-[14px] font-bold text-white/70 mb-1">{t("terminal.nfc_ready") || "Ready for Contactless Payment"}</p>
                <p className="text-[32px] font-black text-[#00E0FF] font-mono mb-3">{parsedAmount.toFixed(2)} EUR</p>
                <p className="text-[10px] text-white/20 mb-6">{t("terminal.nfc_instruction") || "Ask customer to tap phone or card"}</p>

                {/* Simulate NFC payment types */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <motion.button data-testid="nfc-wallet-btn" onClick={() => processNfcPayment("nfc_wallet")} whileTap={{ scale: 0.95 }} disabled={loading}
                    className="py-3 rounded-xl flex flex-col items-center gap-1" style={{ background: "rgba(0,232,157,0.06)", border: "1px solid rgba(0,232,157,0.12)" }}>
                    <Zap size={16} className="text-[#00E89D]" />
                    <span className="text-[9px] font-bold text-[#00E89D]">BidBlitz Wallet</span>
                    <span className="text-[7px] text-[#00E89D]/50">0.3% fee</span>
                  </motion.button>
                  <motion.button data-testid="nfc-card-btn" onClick={() => processNfcPayment("nfc_card")} whileTap={{ scale: 0.95 }} disabled={loading}
                    className="py-3 rounded-xl flex flex-col items-center gap-1" style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.12)" }}>
                    <CreditCard size={16} className="text-[#FFB800]" />
                    <span className="text-[9px] font-bold text-[#FFB800]">Card / Contactless</span>
                    <span className="text-[7px] text-[#FFB800]/50">2.5% fee</span>
                  </motion.button>
                </div>

                {loading && <Loader2 size={24} className="text-[#A855F7] animate-spin mx-auto mb-3" />}

                {/* Daily Revenue + Recent Txns */}
                {dailySummary && (
                  <div className="rounded-xl p-2.5 mb-3 text-left" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[7px] text-white/15 uppercase tracking-widest font-bold">{t("terminal.today") || "Today"}</span>
                      <span className="text-[9px] text-[#00E89D] font-mono font-bold">{dailySummary.total_amount?.toFixed(2)} EUR</span>
                    </div>
                    {(dailySummary.recent_transactions || []).slice(0, 3).map((tx, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <span className="text-[7px] text-white/15">{tx.payment_type_label || tx.payment_method || "?"}</span>
                        <span className="text-[8px] text-white/25 font-mono">{tx.amount?.toFixed(2)}</span>
                      </div>
                    ))}
                    {dailySummary.total_transactions === 0 && <p className="text-[7px] text-white/10">{t("terminal.no_txns") || "No transactions yet"}</p>}
                  </div>
                )}

                <motion.button onClick={() => { setStep("amount"); setNfcReady(false); }} whileTap={{ scale: 0.95 }}
                  className="w-full py-3 rounded-xl text-[11px] font-bold text-white/20" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  {t("common.cancel") || "Cancel"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ══════ STEP: CONFIRM ══════ */}
          {step === "confirm" && customer && (
            <motion.div key="confirm" className="flex-1 flex flex-col items-center justify-center px-6" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="w-full max-w-sm">
                <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(0,232,157,0.1)" }}>
                  <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(0,232,157,0.06)", border: "1px solid rgba(0,232,157,0.12)" }}>
                    <User size={26} className="text-[#00E89D]" />
                  </div>
                  <p className="text-[18px] font-bold text-white/90">{customer.customer_name}</p>
                  <p className="text-[10px] text-white/25 mb-4">{customer.customer_email}</p>

                  <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(0,224,255,0.03)", border: "1px solid rgba(0,224,255,0.06)" }}>
                    <p className="text-[8px] text-white/15 uppercase tracking-widest mb-1">{t("terminal.charge") || "CHARGE AMOUNT"}</p>
                    <p className="text-[40px] font-black text-[#00E0FF] font-mono leading-none">{parsedAmount.toFixed(2)}</p>
                    <p className="text-[10px] text-white/20 mt-1">EUR · Wallet · 0.5% Fee</p>
                  </div>

                  <motion.button data-testid="terminal-confirm-btn" onClick={confirmPayment} disabled={loading} whileTap={{ scale: 0.95 }}
                    className="w-full py-4 rounded-xl text-[15px] font-black flex items-center justify-center gap-2"
                    style={{ background: "rgba(0,232,157,0.12)", border: "1px solid rgba(0,232,157,0.25)", color: "#00E89D" }}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <><Check size={18} /> {t("terminal.confirm_pay") || "CONFIRM PAYMENT"}</>}
                  </motion.button>
                  <motion.button onClick={() => { setStep("scan"); setCustomer(null); setBarcode(""); }} className="text-[10px] text-white/15 mt-3 block mx-auto">
                    {t("common.cancel") || "Cancel"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════ STEP: SUCCESS + RECEIPT ══════ */}
          {step === "done" && result && (
            <motion.div key="done" className="flex-1 flex flex-col items-center justify-center px-6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="w-full max-w-sm">
                <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(0,232,157,0.02)", border: "1px solid rgba(0,232,157,0.1)" }}>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(0,232,157,0.1)", border: "1px solid rgba(0,232,157,0.2)" }}>
                      <Check size={32} className="text-[#00E89D]" />
                    </div>
                  </motion.div>
                  <p className="text-[16px] font-bold text-[#00E89D] mb-1">{t("terminal.payment_success") || "Payment Successful"}</p>
                  <p className="text-[36px] font-black text-white/90 font-mono mb-1">{result.amount.toFixed(2)} EUR</p>
                  {result.customer_name && <p className="text-[10px] text-white/25 mb-3">{result.customer_name}</p>}

                  {/* Receipt */}
                  {result.receipt && (
                    <div className="rounded-xl p-3 mb-4 text-left" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="flex items-center gap-1 mb-2">
                        <Receipt size={10} className="text-white/20" />
                        <span className="text-[8px] text-white/20 uppercase tracking-widest font-bold">{t("terminal.receipt") || "RECEIPT"}</span>
                      </div>
                      <div className="space-y-1 text-[9px]">
                        <div className="flex justify-between"><span className="text-white/25">ID</span><span className="text-white/40 font-mono">{result.receipt.receipt_id}</span></div>
                        <div className="flex justify-between"><span className="text-white/25">{t("terminal.time") || "Time"}</span><span className="text-white/40 font-mono">{result.receipt.time}</span></div>
                        <div className="flex justify-between"><span className="text-white/25">{t("terminal.method") || "Method"}</span><span className="text-white/40">{result.receipt.payment_method || result.payment_type_label}</span></div>
                        <div className="flex justify-between"><span className="text-white/25">{t("terminal.fee") || "Fee"}</span><span className="text-white/40 font-mono">{result.fee.toFixed(2)} ({result.receipt.fee_rate}%)</span></div>
                        <div className="flex justify-between border-t border-white/[0.03] pt-1 mt-1"><span className="text-white/30 font-bold">{t("terminal.net") || "Net"}</span><span className="text-[#00E0FF] font-bold font-mono">{result.net.toFixed(2)} EUR</span></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <motion.button data-testid="terminal-tip-btn" onClick={() => setShowTip(true)} whileTap={{ scale: 0.95 }}
                      className="py-4 px-5 rounded-xl text-[13px] font-bold flex items-center gap-2"
                      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#F59E0B" }}>
                      <Heart size={14} /> Trinkgeld
                    </motion.button>
                    <motion.button data-testid="terminal-new-btn" onClick={reset} whileTap={{ scale: 0.95 }}
                      className="flex-1 py-4 rounded-xl text-[14px] font-black tracking-wide flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, rgba(0,224,255,0.1), rgba(168,85,247,0.06))", border: "1px solid rgba(0,224,255,0.15)", color: "#00E0FF" }}>
                      <Zap size={14} /> {t("terminal.new_payment") || "NEW PAYMENT"}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.1)" }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <AlertCircle size={13} className="text-[#FF4757]" />
              <span className="text-[10px] text-[#FF4757] flex-1">{error}</span>
              <motion.button onClick={() => setError("")}><X size={10} className="text-[#FF4757]" /></motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* POS Tip Modal */}
      {result && (
        <TipModal
          isOpen={showTip}
          onClose={() => setShowTip(false)}
          billAmount={result.amount || 0}
          posCustomerId={result.customer_id || ""}
          transactionId={result.transaction_id || ""}
          onTipSent={() => setShowTip(false)}
        />
      )}
    </motion.div>
  );
};

export default MerchantTerminalPage;
