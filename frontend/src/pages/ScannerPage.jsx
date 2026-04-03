import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  X, QrCode, Check, AlertCircle, Loader2,
  ArrowRight, ShieldCheck, Copy,
  ChevronLeft, CreditCard, Nfc, Fingerprint,
  Clock, Store, Wifi
} from "lucide-react";
import { useWallet, useMerchant } from "../store";

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

function formatTime(d) {
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(d) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

// ═══════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════

const NumPad = ({ onKey, onDelete, disabled }) => {
  const keys = ["1","2","3","4","5","6","7","8","9",".","0","del"];
  const [tapped, setTapped] = useState(null);

  const handleTap = (k) => {
    if (disabled) return;
    setTapped(k);
    setTimeout(() => setTapped(null), 120);
    if (k === "del") onDelete();
    else onKey(k);
  };

  return (
    <div className="grid grid-cols-3 gap-[6px] w-full max-w-[280px] mx-auto">
      {keys.map((k) => (
        <motion.button
          key={k}
          data-testid={`numpad-${k}`}
          className={`h-[52px] rounded-[18px] font-outfit text-[17px] font-medium flex items-center justify-center select-none relative overflow-hidden
            ${k === "del"
              ? "bg-transparent text-[#666]"
              : "text-white"}`}
          style={k !== "del" ? {
            background: tapped === k ? "rgba(0,194,255,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${tapped === k ? "rgba(0,194,255,0.3)" : "rgba(255,255,255,0.04)"}`,
            transition: "background 0.15s, border-color 0.15s",
          } : undefined}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleTap(k)}
          disabled={disabled}
        >
          {k === "del" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          ) : k}
        </motion.button>
      ))}
    </div>
  );
};

const QuickAmounts = ({ onSelect, selected, disabled }) => {
  const amounts = [5, 10, 25, 50];
  return (
    <div className="flex gap-2 justify-center mb-3">
      {amounts.map((a) => (
        <motion.button
          key={a}
          data-testid={`quick-amount-${a}`}
          className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200
            ${selected === String(a)
              ? "bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/30"
              : "bg-white/[0.03] text-[#666] border border-white/[0.04]"}`}
          whileTap={{ scale: 0.93 }}
          onClick={() => !disabled && onSelect(String(a))}
          disabled={disabled}
        >
          €{a}
        </motion.button>
      ))}
    </div>
  );
};

const TimerRing = ({ seconds, total }) => {
  const pct = (seconds / total) * 100;
  const r = 13;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="34" height="34" className="rotate-[-90deg]">
      <circle cx="17" cy="17" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" />
      <circle cx="17" cy="17" r={r} fill="none" stroke="#00C2FF" strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
};

// Processing steps sub-component
const ProcessingSteps = ({ activeStep }) => {
  const steps = [
    { label: "Authenticating", icon: Fingerprint },
    { label: "Verifying payment", icon: ShieldCheck },
    { label: "Completing transfer", icon: Wifi },
  ];
  return (
    <div className="space-y-3 w-full max-w-[240px]">
      {steps.map((s, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        const Icon = s.icon;
        return (
          <motion.div
            key={i}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: isDone || isActive ? 1 : 0.3, x: 0 }}
            transition={{ delay: i * 0.15, duration: 0.3 }}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500
              ${isDone ? "bg-[#00D26A]/15 border border-[#00D26A]/30"
                : isActive ? "bg-[#00C2FF]/10 border border-[#00C2FF]/25"
                : "bg-white/[0.03] border border-white/[0.04]"}`}>
              {isDone ? (
                <Check size={12} className="text-[#00D26A]" />
              ) : isActive ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Loader2 size={12} className="text-[#00C2FF]" />
                </motion.div>
              ) : (
                <Icon size={12} className="text-[#333]" />
              )}
            </div>
            <span className={`text-xs font-medium transition-colors duration-500
              ${isDone ? "text-[#00D26A]" : isActive ? "text-white" : "text-[#333]"}`}>
              {s.label}{isDone ? "" : isActive ? "..." : ""}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

// Floating success particles
const SuccessParticles = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 300 - 150,
      y: -(Math.random() * 350 + 80),
      r: Math.random() * 360,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 0.6,
      dur: 1.5 + Math.random() * 1.2,
      color: ["#00D26A", "#00E57A", "#00C2FF", "#FFD700", "#FFFFFF"][Math.floor(Math.random() * 5)],
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            left: "50%",
            top: "45%",
            boxShadow: `0 0 ${p.size * 2}px ${p.color}40`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: [1, 1, 0], scale: [0, 1.2, 0.6], rotate: p.r }}
          transition={{ delay: 0.2 + p.delay, duration: p.dur, ease: "easeOut" }}
        />
      ))}
    </div>
  );
};

// ═══════════════════════════════════
// MAIN SCANNER PAGE
// ═══════════════════════════════════
export const ScannerPage = ({ onNavigate }) => {
  const [step, setStep] = useState(Step.AMOUNT);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(300);
  const [copied, setCopied] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [completedAt, setCompletedAt] = useState(null);
  const scanTimer = useRef(null);
  const expiryTimer = useRef(null);

  const wallet = useWallet();
  const merchant = useMerchant();

  // Numpad handler
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
    setError(null);
  };
  const handleDelete = () => { setAmount((p) => p.slice(0, -1)); setError(null); };

  const handleContinue = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setError("Enter a valid amount"); return; }
    if (n > wallet.balance) { setError("Exceeds available balance"); return; }
    setError(null);
    setReference(generateRef());
    setExpirySeconds(300);
    setStep(Step.CONFIRM);
  };

  const handleStartScan = () => {
    merchant.createPaymentRequest(parseFloat(amount));
    setScanProgress(0);
    setStep(Step.SCAN);
  };

  // Scan progress
  useEffect(() => {
    if (step !== Step.SCAN) return;
    scanTimer.current = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) { clearInterval(scanTimer.current); return 100; }
        return p + 2.5;
      });
    }, 50);
    return () => clearInterval(scanTimer.current);
  }, [step]);

  // Scan → Processing
  useEffect(() => {
    if (step === Step.SCAN && scanProgress >= 100) processPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, scanProgress]);

  // Expiry countdown
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

  // Processing with stepped progress
  const processPayment = useCallback(async () => {
    setStep(Step.PROCESSING);
    setProcessingStep(0);

    // Step 1: Authenticating
    await new Promise((r) => setTimeout(r, 800));
    setProcessingStep(1);

    // Step 2: Verifying
    await new Promise((r) => setTimeout(r, 1000));
    setProcessingStep(2);

    // Step 3: Completing
    await new Promise((r) => setTimeout(r, 700));

    const n = parseFloat(amount);
    if (wallet.canAfford(n)) {
      wallet.pay(n, merchant.businessName, merchant.id);
      merchant.receivePayment(n);
      setCompletedAt(new Date());
      setProcessingStep(3);
      await new Promise((r) => setTimeout(r, 300));
      setStep(Step.SUCCESS);
    } else {
      setError("Insufficient balance — transaction declined by your wallet.");
      setStep(Step.ERROR);
    }
  }, [amount, wallet, merchant]);

  const handleReset = () => {
    setStep(Step.AMOUNT);
    setAmount("");
    setScanProgress(0);
    setError(null);
    setReference("");
    setExpirySeconds(300);
    setCopied(false);
    setProcessingStep(0);
    setCompletedAt(null);
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
  const isTerminal = step === Step.SUCCESS || step === Step.ERROR;
  const isLocked = step === Step.PROCESSING || step === Step.SCAN;

  // Ambient glow color
  const glowColor = step === Step.SUCCESS ? "rgba(0,210,106,0.08)"
    : step === Step.ERROR ? "rgba(255,71,87,0.08)"
    : "rgba(0,194,255,0.05)";

  return (
    <motion.div
      data-testid="scanner-page"
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ filter: "blur(140px)" }}
        animate={{ background: glowColor }}
        transition={{ duration: 0.8 }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2 relative z-10">
        <motion.button
          data-testid="scanner-back-btn"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center backdrop-blur-sm"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          onClick={step === Step.AMOUNT ? () => onNavigate("/") : isLocked ? undefined : handleReset}
          style={{ pointerEvents: isLocked ? "none" : "auto", opacity: isLocked ? 0.3 : 1 }}
        >
          {step === Step.AMOUNT
            ? <X size={16} strokeWidth={1.5} className="text-white/60" />
            : <ChevronLeft size={16} strokeWidth={1.5} className="text-white/60" />}
        </motion.button>

        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            className="text-[12px] text-[#555] font-medium font-outfit tracking-[0.08em] uppercase"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            {step === Step.AMOUNT && "New Payment"}
            {step === Step.CONFIRM && "Confirm"}
            {step === Step.SCAN && "Scanning"}
            {step === Step.PROCESSING && "Processing"}
            {step === Step.SUCCESS && "Completed"}
            {step === Step.ERROR && "Declined"}
          </motion.p>
        </AnimatePresence>

        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col relative z-10">
        <AnimatePresence mode="wait">

          {/* ════ AMOUNT ════ */}
          {step === Step.AMOUNT && (
            <motion.div
              key="amount"
              className="flex-1 flex flex-col px-5 pb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-[#444] text-[10px] font-semibold mb-4 tracking-[0.15em] uppercase">Payment Amount</p>

                <div className="flex items-baseline gap-1 mb-2 min-h-[68px]">
                  <span className="text-[28px] text-[#333] font-outfit font-light">€</span>
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={amount || "placeholder"}
                      className={`text-[56px] font-bold font-outfit tracking-tighter leading-none
                        ${amount ? "text-white" : "text-[#1A1A1A]"}`}
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                      transition={{ duration: 0.12 }}
                    >
                      {amount || "0.00"}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <p className={`text-[11px] font-medium transition-colors duration-200
                  ${numericAmount > wallet.balance ? "text-[#FF4757]" : "text-[#333]"}`}>
                  Balance: €{wallet.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </p>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      className="text-[#FF4757] text-[11px] mt-2 font-medium"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <QuickAmounts onSelect={setAmount} selected={amount} />
              <NumPad onKey={handleKey} onDelete={handleDelete} />

              <motion.button
                data-testid="continue-to-confirm-btn"
                className={`w-full mt-4 py-[14px] rounded-2xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-all duration-300
                  ${isValidAmount
                    ? "bg-[#00C2FF] text-[#030303]"
                    : "bg-white/[0.03] text-[#222] cursor-not-allowed border border-white/[0.03]"}`}
                style={isValidAmount ? { boxShadow: "0 8px 40px rgba(0,194,255,0.3), 0 2px 12px rgba(0,194,255,0.2)" } : {}}
                whileHover={isValidAmount ? { scale: 1.01 } : {}}
                whileTap={isValidAmount ? { scale: 0.97 } : {}}
                onClick={handleContinue}
                disabled={!isValidAmount}
              >
                Continue <ArrowRight size={14} strokeWidth={2.5} />
              </motion.button>
            </motion.div>
          )}

          {/* ════ CONFIRM ════ */}
          {step === Step.CONFIRM && (
            <motion.div
              key="confirm"
              className="flex-1 flex flex-col px-5 pb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="flex-1 flex flex-col items-center justify-center">
                {/* Amount */}
                <motion.div
                  className="text-center mb-8"
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.05 }}
                >
                  <p className="text-[50px] font-bold font-outfit text-white tracking-tighter leading-none mb-1">
                    €{numericAmount.toFixed(2)}
                  </p>
                  <div className="flex items-center justify-center gap-1.5">
                    <Store size={12} className="text-[#555]" />
                    <p className="text-[#555] text-[13px]">{merchant.businessName}</p>
                  </div>
                </motion.div>

                {/* Detail card */}
                <motion.div
                  className="w-full rounded-[20px] overflow-hidden mb-5"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    backdropFilter: "blur(20px)",
                  }}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {[
                    { label: "Reference", value: reference, mono: true, action: (
                      <motion.button className="text-[#00C2FF] text-[10px] font-semibold flex items-center gap-1" whileTap={{ scale: 0.9 }} onClick={handleCopyRef}>
                        <Copy size={10} /> {copied ? "Copied" : "Copy"}
                      </motion.button>
                    )},
                    { label: "Merchant", value: merchant.businessName, right: (
                      <div className="w-7 h-7 rounded-lg bg-[#00C2FF]/8 flex items-center justify-center"><Nfc size={13} className="text-[#00C2FF]" /></div>
                    )},
                    { label: "Payment Method", value: "BidBlitz Wallet", right: <CreditCard size={14} className="text-[#333]" /> },
                    { label: "Expires in", value: fmtExpiry, cyan: true, right: <TimerRing seconds={expirySeconds} total={300} /> },
                  ].map((row, i) => (
                    <motion.div
                      key={i}
                      className={`flex items-center justify-between px-4 py-3 ${i < 3 ? "border-b border-white/[0.04]" : ""}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.06 }}
                    >
                      <div>
                        <p className="text-[9px] text-[#444] uppercase tracking-[0.1em] mb-0.5 font-semibold">{row.label}</p>
                        <p className={`text-[13px] ${row.mono ? "font-mono" : ""} ${row.cyan ? "text-[#00C2FF]" : "text-white"}`}>{row.value}</p>
                      </div>
                      {row.action || row.right}
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div
                  className="flex items-center gap-1.5 text-[#333]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <ShieldCheck size={12} className="text-[#00D26A]" />
                  <span className="text-[10px] font-medium">End-to-end encrypted</span>
                </motion.div>
              </div>

              <div className="space-y-2.5">
                <motion.button
                  data-testid="confirm-pay-btn"
                  className="w-full py-[14px] rounded-2xl bg-[#00C2FF] text-[#030303] font-semibold text-[13px] flex items-center justify-center gap-2"
                  style={{ boxShadow: "0 8px 40px rgba(0,194,255,0.3), 0 2px 12px rgba(0,194,255,0.2)" }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStartScan}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <Fingerprint size={16} strokeWidth={2} /> Confirm & Pay
                </motion.button>
                <motion.button
                  data-testid="edit-amount-btn"
                  className="w-full py-3 rounded-2xl bg-transparent text-[#555] font-semibold text-[13px]"
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReset}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  Edit Amount
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ════ SCANNING ════ */}
          {step === Step.SCAN && (
            <motion.div
              key="scan"
              className="flex-1 flex flex-col items-center justify-center px-5 pb-6"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35 }}
            >
              {/* Scanner viewport */}
              <div className="relative w-[260px] h-[260px] mb-7">
                {/* Outer glow */}
                <motion.div
                  className="absolute -inset-6 rounded-[28px] pointer-events-none"
                  animate={{
                    boxShadow: [
                      "0 0 40px rgba(0,194,255,0.06), inset 0 0 40px rgba(0,194,255,0.02)",
                      "0 0 80px rgba(0,194,255,0.12), inset 0 0 60px rgba(0,194,255,0.04)",
                      "0 0 40px rgba(0,194,255,0.06), inset 0 0 40px rgba(0,194,255,0.02)",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />

                {/* Corner brackets — thicker, more defined */}
                {[
                  { pos: "top-0 left-0", border: "border-t-[2.5px] border-l-[2.5px]", radius: "rounded-tl-2xl" },
                  { pos: "top-0 right-0", border: "border-t-[2.5px] border-r-[2.5px]", radius: "rounded-tr-2xl" },
                  { pos: "bottom-0 left-0", border: "border-b-[2.5px] border-l-[2.5px]", radius: "rounded-bl-2xl" },
                  { pos: "bottom-0 right-0", border: "border-b-[2.5px] border-r-[2.5px]", radius: "rounded-br-2xl" },
                ].map((c, i) => (
                  <motion.div
                    key={i}
                    className={`absolute w-14 h-14 ${c.pos} ${c.border} ${c.radius} border-[#00C2FF]`}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}

                {/* Camera viewfinder body */}
                <div className="absolute inset-[18px] rounded-xl bg-[#060606] overflow-hidden">
                  {/* QR code pattern */}
                  <div className="absolute inset-0 grid grid-cols-9 gap-[2px] p-3 opacity-70">
                    {[...Array(81)].map((_, i) => {
                      const isCornerModule = (i < 3 || (i >= 6 && i < 9)) && (Math.floor(i / 9) < 3);
                      return (
                        <motion.div
                          key={i}
                          className="rounded-[2px]"
                          style={{
                            background: isCornerModule ? "#222" : Math.random() > 0.4 ? "#151515" : "#0C0C0C",
                            aspectRatio: "1",
                          }}
                          animate={{ opacity: [0.4, 0.85, 0.4] }}
                          transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: i * 0.015 }}
                        />
                      );
                    })}
                  </div>

                  {/* Focus ring effect in center */}
                  <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-[#00C2FF]/20"
                    animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>

                {/* Laser line — double beam */}
                <motion.div
                  className="absolute left-[18px] right-[18px] h-[3px] z-10"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(0,194,255,0.4) 15%, #00C2FF 40%, #00E5FF 50%, #00C2FF 60%, rgba(0,194,255,0.4) 85%, transparent 100%)",
                    boxShadow: "0 0 16px rgba(0,194,255,0.7), 0 0 40px rgba(0,194,255,0.3), 0 0 80px rgba(0,194,255,0.15)",
                  }}
                  initial={{ top: 24 }}
                  animate={{ top: [24, 236, 24] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Secondary subtle laser (offset) */}
                <motion.div
                  className="absolute left-[24px] right-[24px] h-[1px] z-10 opacity-30"
                  style={{
                    background: "linear-gradient(90deg, transparent, #00C2FF, transparent)",
                  }}
                  initial={{ top: 28 }}
                  animate={{ top: [232, 28, 232] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Amount + ref */}
              <motion.p
                className="text-[28px] font-bold font-outfit text-[#00C2FF] mb-0.5"
                animate={{ textShadow: ["0 0 20px rgba(0,194,255,0.2)", "0 0 40px rgba(0,194,255,0.5)", "0 0 20px rgba(0,194,255,0.2)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                €{numericAmount.toFixed(2)}
              </motion.p>
              <p className="text-[9px] text-[#333] font-mono tracking-wider mb-4">{reference}</p>

              {/* Progress */}
              <div className="w-44 h-[3px] bg-white/[0.04] rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${scanProgress}%`,
                    background: "linear-gradient(90deg, #00C2FF, #00E5FF)",
                    boxShadow: "0 0 10px rgba(0,194,255,0.6)",
                  }}
                />
              </div>

              <motion.p
                className="text-[#444] text-[11px]"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Hold device near terminal...
              </motion.p>
            </motion.div>
          )}

          {/* ════ PROCESSING ════ */}
          {step === Step.PROCESSING && (
            <motion.div
              key="processing"
              className="flex-1 flex flex-col items-center justify-center px-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Icon */}
              <div className="relative w-24 h-24 mb-7">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-[#00C2FF]/20"
                    animate={{ scale: [1, 1.5 + i * 0.15], opacity: [0.4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.35 }}
                  />
                ))}
                <div
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle, rgba(0,194,255,0.08) 0%, rgba(0,194,255,0.02) 100%)",
                    border: "1px solid rgba(0,194,255,0.15)",
                  }}
                >
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={30} strokeWidth={1.5} className="text-[#00C2FF]" />
                  </motion.div>
                </div>
              </div>

              <motion.p
                className="text-[28px] font-bold font-outfit text-white tracking-tight mb-6"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                €{numericAmount.toFixed(2)}
              </motion.p>

              <ProcessingSteps activeStep={processingStep} />

              <motion.p
                className="text-[10px] text-[#333] font-mono mt-6 tracking-wider"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {reference}
              </motion.p>
            </motion.div>
          )}

          {/* ════ SUCCESS ════ */}
          {step === Step.SUCCESS && (
            <motion.div
              key="success"
              className="flex-1 flex flex-col items-center justify-center px-5 pb-6 relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SuccessParticles />

              {/* Vibration-style shimmer overlay */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.03, 0, 0.02, 0] }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{ background: "linear-gradient(180deg, transparent 30%, rgba(0,210,106,0.15) 50%, transparent 70%)" }}
              />

              {/* Checkmark */}
              <div className="relative w-[100px] h-[100px] mb-6">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-[#00D26A]/40"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.4 + i * 0.2, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.4 + i * 0.25 }}
                  />
                ))}
                <motion.div
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 40% 35%, rgba(0,210,106,0.2) 0%, rgba(0,210,106,0.04) 100%)",
                    border: "1.5px solid rgba(0,210,106,0.25)",
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.08 }}
                >
                  {/* Animated check path */}
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 350, damping: 15 }}
                  >
                    <Check size={42} strokeWidth={2.5} className="text-[#00D26A]" />
                  </motion.div>
                </motion.div>
                <div className="absolute inset-0 rounded-full blur-3xl bg-[#00D26A]/20 pointer-events-none" />
              </div>

              {/* Amount + "vibration" wobble */}
              <motion.p
                className="text-[46px] font-bold font-outfit text-white tracking-tighter leading-none mb-1"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [0.8, 1.04, 0.98, 1], opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.5 }}
              >
                €{numericAmount.toFixed(2)}
              </motion.p>

              <motion.p
                className="text-[#00D26A] text-[13px] font-semibold mb-0.5"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Payment Successful
              </motion.p>

              <motion.p
                className="text-[#444] text-[11px] mb-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
              >
                {merchant.businessName}
              </motion.p>

              {/* Receipt card */}
              <motion.div
                className="w-full rounded-[18px] overflow-hidden mb-5"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {[
                  { label: "Reference", value: reference, mono: true },
                  { label: "Date", value: completedAt ? formatDate(completedAt) : "—" },
                  { label: "Time", value: completedAt ? formatTime(completedAt) : "—" },
                  { label: "Status", value: "Completed", green: true, icon: <Check size={10} className="text-[#00D26A]" /> },
                  { label: "New Balance", value: `€${wallet.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`, bold: true },
                ].map((row, i, arr) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                    <span className="text-[9px] text-[#444] uppercase tracking-[0.1em] font-semibold">{row.label}</span>
                    <span className={`text-[11px] flex items-center gap-1
                      ${row.mono ? "font-mono text-white/80" : ""}
                      ${row.green ? "text-[#00D26A] font-semibold" : ""}
                      ${row.bold ? "text-white font-semibold" : ""}
                      ${!row.mono && !row.green && !row.bold ? "text-white/70" : ""}`}>
                      {row.icon}{row.value}
                    </span>
                  </div>
                ))}
              </motion.div>

              {/* Done */}
              <motion.button
                data-testid="done-btn"
                className="w-full py-[14px] rounded-2xl bg-white/[0.04] text-white font-semibold text-[13px] border border-white/[0.06]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.07)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { handleReset(); onNavigate("/"); }}
              >
                Done
              </motion.button>
            </motion.div>
          )}

          {/* ════ ERROR ════ */}
          {step === Step.ERROR && (
            <motion.div
              key="error"
              className="flex-1 flex flex-col items-center justify-center px-5 pb-6 relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Red flash overlay */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.08, 0, 0.04, 0] }}
                transition={{ duration: 0.6 }}
                style={{ background: "radial-gradient(circle at 50% 40%, rgba(255,71,87,0.3) 0%, transparent 70%)" }}
              />

              {/* Error icon with shake */}
              <div className="relative w-[100px] h-[100px] mb-6">
                {/* Pulsing red glow rings */}
                {[0, 1].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-[#FF4757]/25"
                    animate={{ scale: [1, 1.35 + i * 0.15], opacity: [0.4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                  />
                ))}
                <motion.div
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 40% 35%, rgba(255,71,87,0.18) 0%, rgba(255,71,87,0.03) 100%)",
                    border: "1.5px solid rgba(255,71,87,0.25)",
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.06, 0.97, 1], x: [0, 0, -8, 10, -10, 8, -6, 4, 0] }}
                  transition={{
                    scale: { duration: 0.35, ease: "easeOut" },
                    x: { delay: 0.3, duration: 0.6, ease: "easeInOut" },
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 350 }}
                  >
                    <X size={42} strokeWidth={2.5} className="text-[#FF4757]" />
                  </motion.div>
                </motion.div>
                <div className="absolute inset-0 rounded-full blur-3xl bg-[#FF4757]/20 pointer-events-none" />
              </div>

              {/* Amount with wobble */}
              <motion.p
                className="text-[46px] font-bold font-outfit text-white tracking-tighter leading-none mb-1"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: [0.85, 1.03, 0.98, 1], opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                €{numericAmount.toFixed(2)}
              </motion.p>

              <motion.p
                className="text-[#FF4757] text-[13px] font-semibold mb-2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Payment Declined
              </motion.p>

              <motion.p
                className="text-[#444] text-[11px] text-center mb-8 max-w-[260px] leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                {error || "Insufficient balance. Please top up your wallet and try again."}
              </motion.p>

              <div className="w-full space-y-2.5">
                <motion.button
                  data-testid="try-again-btn"
                  className="w-full py-[14px] rounded-2xl font-semibold text-[13px] text-white"
                  style={{
                    background: "linear-gradient(135deg, #FF4757, #E8384F)",
                    boxShadow: "0 8px 32px rgba(255,71,87,0.25)",
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReset}
                >
                  Try Again
                </motion.button>
                <motion.button
                  data-testid="cancel-btn"
                  className="w-full py-3 rounded-2xl bg-transparent text-[#555] font-semibold text-[13px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  whileTap={{ scale: 0.97 }}
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
