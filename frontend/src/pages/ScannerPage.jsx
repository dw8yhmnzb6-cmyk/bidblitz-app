import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, QrCode, Check, AlertCircle, Loader2,
  ArrowRight, ShieldCheck, Clock, Copy,
  ChevronLeft, CreditCard, Smartphone, Nfc
} from "lucide-react";
import { useWallet, useMerchant } from "../store";

// ─── Flow states ───
const Step = {
  AMOUNT: "amount",
  CONFIRM: "confirm",
  SCAN: "scan",
  PROCESSING: "processing",
  SUCCESS: "success",
  ERROR: "error",
};

function generateRef() {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r = "BLZ-";
  for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

// ─── Number Pad ───
const NumPad = ({ onKey, onDelete, onClear }) => {
  const keys = ["1","2","3","4","5","6","7","8","9",".","0","del"];
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] mx-auto">
      {keys.map((k) => (
        <motion.button
          key={k}
          data-testid={`numpad-${k}`}
          className={`h-14 rounded-2xl font-outfit text-lg font-semibold flex items-center justify-center select-none
            ${k === "del"
              ? "bg-white/5 text-[#888]"
              : "bg-[#111] text-white border border-white/5 active:bg-white/10"}`}
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            if (k === "del") onDelete();
            else onKey(k);
          }}
        >
          {k === "del" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          ) : k}
        </motion.button>
      ))}
    </div>
  );
};

// ─── Quick Amount Chips ───
const QuickAmounts = ({ onSelect, selected }) => {
  const amounts = [5, 10, 25, 50];
  return (
    <div className="flex gap-2 justify-center mb-4">
      {amounts.map((a) => (
        <motion.button
          key={a}
          data-testid={`quick-amount-${a}`}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors
            ${selected === String(a)
              ? "bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/40"
              : "bg-white/5 text-[#888] border border-white/5"}`}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(String(a))}
        >
          €{a}
        </motion.button>
      ))}
    </div>
  );
};

// ─── Animated Timer Ring ───
const TimerRing = ({ seconds, total }) => {
  const pct = (seconds / total) * 100;
  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="36" height="36" className="rotate-[-90deg]">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#1A1A1A" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="#00C2FF" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-1000 ease-linear" />
    </svg>
  );
};

// ═══════════════════════════════════════════
// Main Scanner Page
// ═══════════════════════════════════════════
export const ScannerPage = ({ onNavigate }) => {
  const [step, setStep] = useState(Step.AMOUNT);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(300);
  const [copied, setCopied] = useState(false);
  const scanTimer = useRef(null);
  const expiryTimer = useRef(null);

  const wallet = useWallet();
  const merchant = useMerchant();

  // ── Numpad handler ──
  const handleKey = (k) => {
    setAmount((prev) => {
      if (k === "." && prev.includes(".")) return prev;
      if (k === "." && prev === "") return "0.";
      const next = prev + k;
      const [int, dec] = next.split(".");
      if (dec && dec.length > 2) return prev;
      if (int.length > 5) return prev;
      return next;
    });
  };

  const handleDelete = () => setAmount((p) => p.slice(0, -1));

  // ── Step: AMOUNT → CONFIRM ──
  const handleContinue = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setError("Enter a valid amount"); return; }
    if (n > wallet.balance) { setError("Insufficient balance"); return; }
    setError(null);
    setReference(generateRef());
    setExpirySeconds(300);
    setStep(Step.CONFIRM);
  };

  // ── Step: CONFIRM → SCAN ──
  const handleStartScan = () => {
    merchant.createPaymentRequest(parseFloat(amount));
    setScanProgress(0);
    setStep(Step.SCAN);
  };

  // ── Scan progress ticker ──
  useEffect(() => {
    if (step !== Step.SCAN) return;
    scanTimer.current = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) { clearInterval(scanTimer.current); return 100; }
        return p + 1.25;
      });
    }, 50);
    return () => clearInterval(scanTimer.current);
  }, [step]);

  // ── Scan done → PROCESSING ──
  useEffect(() => {
    if (step === Step.SCAN && scanProgress >= 100) processPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, scanProgress]);

  // ── Expiry countdown on CONFIRM ──
  useEffect(() => {
    if (step !== Step.CONFIRM) return;
    expiryTimer.current = setInterval(() => {
      setExpirySeconds((s) => {
        if (s <= 1) { clearInterval(expiryTimer.current); handleReset(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(expiryTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Process payment (mock) ──
  const processPayment = useCallback(async () => {
    setStep(Step.PROCESSING);
    // Simulate bank verification delay
    await new Promise((r) => setTimeout(r, 1800));
    const n = parseFloat(amount);
    if (wallet.canAfford(n)) {
      wallet.pay(n, merchant.businessName, merchant.id);
      merchant.receivePayment(n);
      setStep(Step.SUCCESS);
    } else {
      setError("Transaction declined — insufficient funds");
      setStep(Step.ERROR);
    }
  }, [amount, wallet, merchant]);

  // ── Reset all ──
  const handleReset = () => {
    setStep(Step.AMOUNT);
    setAmount("");
    setScanProgress(0);
    setError(null);
    setReference("");
    setExpirySeconds(300);
    setCopied(false);
    merchant.cancelPaymentRequest();
    clearInterval(scanTimer.current);
    clearInterval(expiryTimer.current);
  };

  const handleCopyRef = () => {
    navigator.clipboard.writeText(reference).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtExpiry = `${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, "0")}`;
  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= wallet.balance;

  // ═════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════
  return (
    <motion.div
      data-testid="scanner-page"
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "#050505" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* ── Ambient glow ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ background: step === Step.SUCCESS ? "rgba(0,210,106,0.06)" : step === Step.ERROR ? "rgba(255,71,87,0.06)" : "rgba(0,194,255,0.05)" }} />
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2 relative z-10">
        <motion.button
          data-testid="scanner-back-btn"
          className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={step === Step.AMOUNT ? () => onNavigate("/") : handleReset}
        >
          {step === Step.AMOUNT
            ? <X size={18} strokeWidth={1.5} className="text-white/70" />
            : <ChevronLeft size={18} strokeWidth={1.5} className="text-white/70" />}
        </motion.button>

        <p className="text-[13px] text-[#666] font-medium font-outfit tracking-wide">
          {step === Step.AMOUNT && "New Payment"}
          {step === Step.CONFIRM && "Confirm Payment"}
          {step === Step.SCAN && "Scanning"}
          {step === Step.PROCESSING && "Verifying"}
          {step === Step.SUCCESS && "Completed"}
          {step === Step.ERROR && "Failed"}
        </p>

        <div className="w-10" />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col relative z-10">
        <AnimatePresence mode="wait">

          {/* ═══════ STEP 1: AMOUNT INPUT ═══════ */}
          {step === Step.AMOUNT && (
            <motion.div
              key="amount"
              className="flex-1 flex flex-col px-5 pb-6"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Amount display */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-[#555] text-xs font-medium mb-3 tracking-wide">PAYMENT AMOUNT</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl text-[#444] font-outfit font-light">€</span>
                  <motion.span
                    key={amount || "0"}
                    className={`text-[56px] font-bold font-outfit tracking-tight leading-none
                      ${amount ? "text-white" : "text-[#222]"}`}
                    initial={{ opacity: 0.5, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {amount || "0"}
                  </motion.span>
                  {amount && !amount.includes(".") && (
                    <span className="text-3xl text-[#333] font-outfit font-light">.00</span>
                  )}
                </div>

                {/* Balance indicator */}
                <p className={`text-xs font-medium ${numericAmount > wallet.balance ? "text-[#FF4757]" : "text-[#444]"}`}>
                  Balance: €{wallet.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </p>

                {error && (
                  <motion.p className="text-[#FF4757] text-xs mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {error}
                  </motion.p>
                )}
              </div>

              {/* Quick amounts */}
              <QuickAmounts onSelect={(v) => setAmount(v)} selected={amount} />

              {/* Numpad */}
              <NumPad onKey={handleKey} onDelete={handleDelete} />

              {/* Continue button */}
              <motion.button
                data-testid="continue-to-confirm-btn"
                className={`w-full mt-5 py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300
                  ${isValidAmount
                    ? "bg-[#00C2FF] text-[#050505]"
                    : "bg-white/5 text-[#333] cursor-not-allowed"}`}
                style={isValidAmount ? { boxShadow: "0 8px 32px rgba(0,194,255,0.35)" } : {}}
                whileHover={isValidAmount ? { scale: 1.01 } : {}}
                whileTap={isValidAmount ? { scale: 0.98 } : {}}
                onClick={handleContinue}
                disabled={!isValidAmount}
              >
                Continue <ArrowRight size={16} />
              </motion.button>
            </motion.div>
          )}

          {/* ═══════ STEP 2: CONFIRMATION ═══════ */}
          {step === Step.CONFIRM && (
            <motion.div
              key="confirm"
              className="flex-1 flex flex-col px-5 pb-6"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex-1 flex flex-col items-center justify-center">
                {/* Big amount */}
                <motion.p
                  className="text-[52px] font-bold font-outfit text-white tracking-tight leading-none mb-1"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                >
                  €{numericAmount.toFixed(2)}
                </motion.p>
                <p className="text-[#555] text-sm mb-8">to {merchant.businessName}</p>

                {/* Detail card */}
                <motion.div
                  className="w-full rounded-2xl border border-white/5 overflow-hidden mb-6"
                  style={{ background: "linear-gradient(160deg, #0E0E0E 0%, #0A0A0A 100%)" }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {/* Reference row */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-widest mb-0.5">Reference</p>
                      <p className="text-sm text-white font-mono">{reference}</p>
                    </div>
                    <motion.button
                      className="text-[#00C2FF] text-[10px] font-semibold flex items-center gap-1"
                      whileTap={{ scale: 0.9 }}
                      onClick={handleCopyRef}
                    >
                      <Copy size={12} /> {copied ? "Copied" : "Copy"}
                    </motion.button>
                  </div>

                  {/* Merchant row */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-widest mb-0.5">Merchant</p>
                      <p className="text-sm text-white">{merchant.businessName}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-[#00C2FF]/10 flex items-center justify-center">
                      <Nfc size={14} className="text-[#00C2FF]" />
                    </div>
                  </div>

                  {/* Method row */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-widest mb-0.5">Payment Method</p>
                      <p className="text-sm text-white">BidBlitz Wallet</p>
                    </div>
                    <CreditCard size={16} className="text-[#555]" />
                  </div>

                  {/* Expiry row */}
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-widest mb-0.5">Expires in</p>
                      <p className="text-sm text-[#00C2FF] font-mono">{fmtExpiry}</p>
                    </div>
                    <TimerRing seconds={expirySeconds} total={300} />
                  </div>
                </motion.div>

                {/* Security badge */}
                <motion.div
                  className="flex items-center gap-2 text-[#444] mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <ShieldCheck size={14} className="text-[#00D26A]" />
                  <span className="text-[11px]">Protected by BidBlitz Secure Pay</span>
                </motion.div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <motion.button
                  data-testid="confirm-pay-btn"
                  className="w-full py-4 rounded-2xl bg-[#00C2FF] text-[#050505] font-semibold text-sm flex items-center justify-center gap-2"
                  style={{ boxShadow: "0 8px 32px rgba(0,194,255,0.35)" }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartScan}
                >
                  <QrCode size={18} /> Show QR & Pay
                </motion.button>
                <motion.button
                  data-testid="edit-amount-btn"
                  className="w-full py-3.5 rounded-2xl bg-white/5 text-[#888] font-semibold text-sm border border-white/5"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                >
                  Edit Amount
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ═══════ STEP 3: SCANNING ═══════ */}
          {step === Step.SCAN && (
            <motion.div
              key="scan"
              className="flex-1 flex flex-col items-center justify-center px-5 pb-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              {/* Scanner frame */}
              <div className="relative w-64 h-64 mb-8">
                {/* Outer glow ring */}
                <motion.div
                  className="absolute -inset-4 rounded-3xl"
                  style={{ boxShadow: "0 0 60px rgba(0,194,255,0.12)" }}
                  animate={{ boxShadow: ["0 0 40px rgba(0,194,255,0.08)", "0 0 80px rgba(0,194,255,0.18)", "0 0 40px rgba(0,194,255,0.08)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Corner brackets */}
                {[
                  "top-0 left-0 border-t-2 border-l-2 rounded-tl-xl",
                  "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl",
                  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl",
                  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
                ].map((cls, i) => (
                  <motion.div
                    key={i}
                    className={`absolute w-12 h-12 border-[#00C2FF] ${cls}`}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}

                {/* QR grid */}
                <div className="absolute inset-5 rounded-xl bg-[#080808] overflow-hidden flex items-center justify-center">
                  <div className="grid grid-cols-8 gap-[3px] p-3">
                    {[...Array(64)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-[18px] h-[18px] rounded-[3px]"
                        style={{ background: Math.random() > 0.45 ? "#1A1A1A" : "#111" }}
                        animate={{ opacity: [0.3, 0.9, 0.3] }}
                        transition={{ duration: 1.2 + Math.random() * 0.8, repeat: Infinity, delay: (i % 8) * 0.04 }}
                      />
                    ))}
                  </div>
                </div>

                {/* Laser line */}
                <motion.div
                  className="absolute left-4 right-4 h-[2px]"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, #00C2FF 30%, #00E5FF 50%, #00C2FF 70%, transparent 100%)",
                    boxShadow: "0 0 12px #00C2FF, 0 0 30px rgba(0,194,255,0.5)"
                  }}
                  initial={{ top: 24 }}
                  animate={{ top: [24, 240, 24] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Amount */}
              <motion.p
                className="text-3xl font-bold font-outfit text-[#00C2FF] mb-1"
                animate={{ textShadow: ["0 0 15px rgba(0,194,255,0.2)", "0 0 35px rgba(0,194,255,0.5)", "0 0 15px rgba(0,194,255,0.2)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                €{numericAmount.toFixed(2)}
              </motion.p>
              <p className="text-[10px] text-[#555] font-mono mb-5">{reference}</p>

              {/* Progress bar */}
              <div className="w-48 h-1 bg-[#111] rounded-full overflow-hidden mb-3">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${scanProgress}%`,
                    background: "linear-gradient(90deg, #00C2FF, #00E5FF)",
                    boxShadow: "0 0 8px rgba(0,194,255,0.6)"
                  }}
                />
              </div>

              <motion.p
                className="text-[#555] text-xs"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Scanning QR code...
              </motion.p>
            </motion.div>
          )}

          {/* ═══════ STEP 4: PROCESSING ═══════ */}
          {step === Step.PROCESSING && (
            <motion.div
              key="processing"
              className="flex-1 flex flex-col items-center justify-center px-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Pulsing ring */}
              <div className="relative w-32 h-32 mb-8">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-[#00C2FF]/30"
                    animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                  />
                ))}
                <div className="absolute inset-0 rounded-full bg-[#00C2FF]/5 flex items-center justify-center border border-[#00C2FF]/20">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={36} className="text-[#00C2FF]" />
                  </motion.div>
                </div>
              </div>

              <h2 className="text-xl font-bold font-outfit text-white mb-1">Verifying Payment</h2>
              <p className="text-[#555] text-sm mb-2">Contacting payment network...</p>
              <p className="text-[10px] text-[#333] font-mono">{reference}</p>
            </motion.div>
          )}

          {/* ═══════ STEP 5: SUCCESS ═══════ */}
          {step === Step.SUCCESS && (
            <motion.div
              key="success"
              className="flex-1 flex flex-col items-center justify-center px-5 pb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Checkmark with rings */}
              <div className="relative w-28 h-28 mb-8">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-[#00D26A]"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5 + i * 0.25, opacity: 0 }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 + i * 0.3 }}
                  />
                ))}
                <motion.div
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,210,106,0.15) 0%, rgba(0,210,106,0.05) 100%)",
                    border: "1.5px solid rgba(0,210,106,0.3)",
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 250, damping: 18, delay: 0.1 }}
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.35, type: "spring", stiffness: 300 }}
                  >
                    <Check size={40} strokeWidth={2.5} className="text-[#00D26A]" />
                  </motion.div>
                </motion.div>
                <div className="absolute inset-0 rounded-full blur-2xl bg-[#00D26A]/25 pointer-events-none" />
              </div>

              {/* Amount */}
              <motion.p
                className="text-[48px] font-bold font-outfit text-white tracking-tight leading-none mb-1"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
              >
                €{numericAmount.toFixed(2)}
              </motion.p>

              <motion.p
                className="text-[#00D26A] text-sm font-semibold mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Payment Successful
              </motion.p>

              <motion.p
                className="text-[#555] text-xs mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
              >
                {merchant.businessName}
              </motion.p>

              {/* Receipt card */}
              <motion.div
                className="w-full rounded-2xl border border-white/5 overflow-hidden mb-6"
                style={{ background: "linear-gradient(160deg, #0E0E0E 0%, #0A0A0A 100%)" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <span className="text-[10px] text-[#555] uppercase tracking-widest">Reference</span>
                  <span className="text-xs text-white font-mono">{reference}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <span className="text-[10px] text-[#555] uppercase tracking-widest">Status</span>
                  <span className="text-xs text-[#00D26A] font-semibold flex items-center gap-1">
                    <Check size={10} /> Completed
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[10px] text-[#555] uppercase tracking-widest">New Balance</span>
                  <span className="text-xs text-white font-semibold">€{wallet.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                </div>
              </motion.div>

              {/* Done button */}
              <motion.button
                data-testid="done-btn"
                className="w-full py-4 rounded-2xl bg-white/5 text-white font-semibold text-sm border border-white/5"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.08)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { handleReset(); onNavigate("/"); }}
              >
                Done
              </motion.button>
            </motion.div>
          )}

          {/* ═══════ STEP 6: ERROR ═══════ */}
          {step === Step.ERROR && (
            <motion.div
              key="error"
              className="flex-1 flex flex-col items-center justify-center px-5 pb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Error icon */}
              <div className="relative w-28 h-28 mb-8">
                <motion.div
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,71,87,0.15) 0%, rgba(255,71,87,0.05) 100%)",
                    border: "1.5px solid rgba(255,71,87,0.3)",
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, x: [0, -8, 8, -8, 8, 0] }}
                  transition={{
                    scale: { type: "spring", stiffness: 250, damping: 18 },
                    x: { delay: 0.3, duration: 0.5 }
                  }}
                >
                  <AlertCircle size={40} strokeWidth={2} className="text-[#FF4757]" />
                </motion.div>
                <div className="absolute inset-0 rounded-full blur-2xl bg-[#FF4757]/25 pointer-events-none" />
              </div>

              {/* Amount */}
              <motion.p
                className="text-[48px] font-bold font-outfit text-white tracking-tight leading-none mb-1"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                €{numericAmount.toFixed(2)}
              </motion.p>

              <motion.p
                className="text-[#FF4757] text-sm font-semibold mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Payment Declined
              </motion.p>

              <motion.p
                className="text-[#555] text-xs text-center mb-8 max-w-[250px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                {error || "Insufficient funds. Please top up your wallet and try again."}
              </motion.p>

              {/* Actions */}
              <div className="w-full space-y-3">
                <motion.button
                  data-testid="try-again-btn"
                  className="w-full py-4 rounded-2xl font-semibold text-sm text-white"
                  style={{
                    background: "linear-gradient(135deg, #FF4757, #FF2D3B)",
                    boxShadow: "0 8px 32px rgba(255,71,87,0.3)"
                  }}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                >
                  Try Again
                </motion.button>
                <motion.button
                  data-testid="cancel-btn"
                  className="w-full py-3.5 rounded-2xl bg-white/5 text-[#888] font-semibold text-sm border border-white/5"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { handleReset(); onNavigate("/"); }}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ScannerPage;
