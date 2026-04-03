import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, QrCode, Check, Loader2, ArrowRight, ShieldCheck, Copy,
  ChevronLeft, CreditCard, Nfc, Fingerprint, Wifi, AlertTriangle
} from "lucide-react";
import { useWallet, useMerchant } from "../store";

// ── Constants ──
const Step = { AMOUNT: 0, CONFIRM: 1, SCAN: 2, PROCESSING: 3, SUCCESS: 4, ERROR: 5 };
const STEP_LABELS = ["New Payment", "Confirm", "Scanning", "Processing", "Completed", "Declined"];

function ref() {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r = "BLZ-";
  for (let i = 0; i < 6; i++) r += c[(Math.random() * c.length) | 0];
  return r;
}
const fmtDate = (d) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// Shared transition presets
const slide = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

// ═══════════════════════════════════════════
// NumPad
// ═══════════════════════════════════════════
const NumPad = ({ onKey, onDel, locked }) => {
  const keys = ["1","2","3","4","5","6","7","8","9",".","0","del"];
  const [flash, setFlash] = useState(null);
  const tap = (k) => {
    if (locked) return;
    setFlash(k); setTimeout(() => setFlash(null), 100);
    k === "del" ? onDel() : onKey(k);
  };
  return (
    <div className="grid grid-cols-3 gap-[5px] w-full max-w-[272px] mx-auto">
      {keys.map((k) => (
        <motion.button key={k} data-testid={`numpad-${k}`}
          className={`h-[50px] rounded-[16px] font-outfit text-[17px] font-medium flex items-center justify-center select-none
            ${k === "del" ? "bg-transparent text-[#555]" : "text-white"}`}
          style={k !== "del" ? {
            background: flash === k ? "rgba(0,194,255,0.12)" : "rgba(255,255,255,0.025)",
            border: `1px solid ${flash === k ? "rgba(0,194,255,0.25)" : "rgba(255,255,255,0.035)"}`,
          } : undefined}
          whileTap={{ scale: 0.88 }} onClick={() => tap(k)} disabled={locked}
        >
          {k === "del" ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          ) : k}
        </motion.button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════
// Quick chips
// ═══════════════════════════════════════════
const Chips = ({ onPick, active }) => [5, 10, 25, 50].map((v) => (
  <motion.button key={v} data-testid={`quick-amount-${v}`}
    className={`px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all
      ${active === String(v) ? "bg-[#00C2FF]/12 text-[#00C2FF] border border-[#00C2FF]/25" : "bg-white/[0.025] text-[#555] border border-white/[0.035]"}`}
    whileTap={{ scale: 0.92 }} onClick={() => onPick(String(v))}
  >€{v}</motion.button>
));

// ═══════════════════════════════════════════
// Timer ring (confirmation countdown)
// ═══════════════════════════════════════════
const Ring = ({ sec, total }) => {
  const r = 13, c = 2 * Math.PI * r, off = c - (sec / total) * c;
  return (
    <svg width="32" height="32" className="-rotate-90">
      <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" />
      <circle cx="16" cy="16" r={r} fill="none" stroke="#00C2FF" strokeWidth="2.5"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
};

// ═══════════════════════════════════════════
// Processing steps indicator
// ═══════════════════════════════════════════
const Steps = ({ at }) => {
  const list = [
    { l: "Authenticating", I: Fingerprint },
    { l: "Verifying payment", I: ShieldCheck },
    { l: "Completing transfer", I: Wifi },
  ];
  return (
    <div className="space-y-3 w-full max-w-[220px]">
      {list.map(({ l, I }, i) => {
        const done = i < at, active = i === at;
        return (
          <motion.div key={i} className="flex items-center gap-3"
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: done || active ? 1 : 0.25, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.3 }}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-500
              ${done ? "bg-[#00D26A]/12 border border-[#00D26A]/25"
              : active ? "bg-[#00C2FF]/8 border border-[#00C2FF]/20"
              : "bg-white/[0.02] border border-white/[0.04]"}`}>
              {done ? <Check size={11} className="text-[#00D26A]" />
              : active ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={11} className="text-[#00C2FF]" /></motion.div>
              : <I size={11} className="text-[#2A2A2A]" />}
            </div>
            <span className={`text-[12px] font-medium transition-colors duration-500
              ${done ? "text-[#00D26A]" : active ? "text-white" : "text-[#2A2A2A]"}`}>
              {l}{active ? "..." : ""}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════
// Confetti particles on success
// ═══════════════════════════════════════════
const Confetti = () => {
  const dots = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    i, x: Math.random() * 320 - 160, y: -(Math.random() * 380 + 60),
    s: Math.random() * 4 + 2, d: Math.random() * 0.5, dur: 1.4 + Math.random(),
    c: ["#00D26A","#00E57A","#00C2FF","#FFD700","#fff"][Math.floor(Math.random() * 5)],
  })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {dots.map((p) => (
        <motion.div key={p.i} className="absolute rounded-full"
          style={{ width: p.s, height: p.s, background: p.c, left: "50%", top: "42%", boxShadow: `0 0 ${p.s * 3}px ${p.c}30` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.x, y: p.y, opacity: [1, 1, 0], scale: [0, 1.3, 0.5] }}
          transition={{ delay: 0.15 + p.d, duration: p.dur, ease: "easeOut" }}
        />
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
export const ScannerPage = ({ onNavigate }) => {
  const [step, setStep] = useState(Step.AMOUNT);
  const [amt, setAmt] = useState("");
  const [txRef, setTxRef] = useState("");
  const [err, setErr] = useState(null);
  const [prog, setProg] = useState(0);
  const [expiry, setExpiry] = useState(300);
  const [copied, setCopied] = useState(false);
  const [pStep, setPStep] = useState(0);
  const [doneAt, setDoneAt] = useState(null);
  const scanT = useRef(null);
  const expT = useRef(null);

  const w = useWallet();
  const m = useMerchant();
  const num = parseFloat(amt) || 0;
  const valid = num > 0 && num <= w.balance;
  const locked = step === Step.SCAN || step === Step.PROCESSING;

  // Ambient glow
  const glow = step === Step.SUCCESS ? "rgba(0,210,106,0.07)"
    : step === Step.ERROR ? "rgba(255,71,87,0.07)" : "rgba(0,194,255,0.04)";

  // ── Input ──
  const key = (k) => {
    setAmt((p) => {
      if (k === "." && p.includes(".")) return p;
      if (k === "." && !p) return "0.";
      const n = p + k, [i, d] = n.split(".");
      if (d && d.length > 2) return p;
      if (i.length > 5) return p;
      return n;
    });
    setErr(null);
  };
  const del = () => { setAmt((p) => p.slice(0, -1)); setErr(null); };

  // ── Flow control ──
  const goConfirm = () => {
    if (!num || num <= 0) { setErr("Enter a valid amount"); return; }
    if (num > w.balance) { setErr("Exceeds available balance"); return; }
    setErr(null); setTxRef(ref()); setExpiry(300); setStep(Step.CONFIRM);
  };
  const goScan = () => { m.createPaymentRequest(num); setProg(0); setStep(Step.SCAN); };

  const reset = useCallback(() => {
    setStep(Step.AMOUNT); setAmt(""); setProg(0); setErr(null); setTxRef("");
    setExpiry(300); setCopied(false); setPStep(0); setDoneAt(null);
    m.cancelPaymentRequest();
    clearInterval(scanT.current); clearInterval(expT.current);
  }, [m]);

  // ── Scan progress ──
  useEffect(() => {
    if (step !== Step.SCAN) return;
    scanT.current = setInterval(() => {
      setProg((p) => { if (p >= 100) { clearInterval(scanT.current); return 100; } return p + 2; });
    }, 40);
    return () => clearInterval(scanT.current);
  }, [step]);

  // ── Scan done → process ──
  useEffect(() => {
    if (step === Step.SCAN && prog >= 100) processPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, prog]);

  // ── Expiry countdown ──
  useEffect(() => {
    if (step !== Step.CONFIRM) return;
    expT.current = setInterval(() => {
      setExpiry((s) => { if (s <= 1) { clearInterval(expT.current); reset(); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(expT.current);
  }, [step, reset]);

  // ── Process payment ──
  const processPayment = useCallback(async () => {
    setStep(Step.PROCESSING); setPStep(0);
    await new Promise((r) => setTimeout(r, 700)); setPStep(1);
    await new Promise((r) => setTimeout(r, 900)); setPStep(2);
    await new Promise((r) => setTimeout(r, 600));
    if (w.canAfford(num)) {
      w.pay(num, m.businessName, m.id); m.receivePayment(num);
      setDoneAt(new Date()); setPStep(3);
      await new Promise((r) => setTimeout(r, 250));
      setStep(Step.SUCCESS);
    } else {
      setErr("Insufficient balance"); setStep(Step.ERROR);
    }
  }, [num, w, m]);

  const copyRef = () => { navigator.clipboard.writeText(txRef).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const expStr = `${Math.floor(expiry / 60)}:${String(expiry % 60).padStart(2, "0")}`;

  // ═══════════════════════════════════════════
  return (
    <motion.div data-testid="scanner-page"
      className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "#030303" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* Ambient */}
      <motion.div className="absolute top-[-25%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ filter: "blur(150px)" }} animate={{ background: glow }} transition={{ duration: 0.6 }} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-2 relative z-10">
        <motion.button data-testid="scanner-back-btn"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }}
          style={{ pointerEvents: locked ? "none" : "auto", opacity: locked ? 0.25 : 1 }}
          onClick={step === Step.AMOUNT ? () => onNavigate("/") : reset}>
          {step === Step.AMOUNT
            ? <X size={15} strokeWidth={1.5} className="text-white/50" />
            : <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />}
        </motion.button>
        <AnimatePresence mode="wait">
          <motion.p key={step} className="text-[11px] text-[#444] font-medium font-outfit tracking-[0.1em] uppercase"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }}>
            {STEP_LABELS[step]}
          </motion.p>
        </AnimatePresence>
        <div className="w-10" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col relative z-10">
        <AnimatePresence mode="wait">

          {/* ──────── STEP 1: AMOUNT ──────── */}
          {step === Step.AMOUNT && (
            <motion.div key="s1" className="flex-1 flex flex-col px-5 pb-5"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={slide}>
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-[#3A3A3A] text-[10px] font-semibold tracking-[0.16em] uppercase mb-4">Payment Amount</p>
                <div className="flex items-baseline gap-1 mb-2 min-h-[66px]">
                  <span className="text-[26px] text-[#2A2A2A] font-outfit font-light select-none">€</span>
                  <AnimatePresence mode="popLayout">
                    <motion.span key={amt || "ph"} className={`text-[54px] font-bold font-outfit tracking-[-0.03em] leading-none ${amt ? "text-white" : "text-[#161616]"}`}
                      initial={{ opacity: 0, y: 6, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -6, filter: "blur(3px)" }} transition={{ duration: 0.1 }}>
                      {amt || "0.00"}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <p className={`text-[11px] font-medium ${num > w.balance ? "text-[#FF4757]" : "text-[#2A2A2A]"}`}>
                  Balance: €{w.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </p>
                <AnimatePresence>
                  {err && <motion.p className="text-[#FF4757] text-[11px] mt-2 font-medium"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>{err}</motion.p>}
                </AnimatePresence>
              </div>
              <div className="flex gap-2 justify-center mb-3"><Chips onPick={setAmt} active={amt} /></div>
              <NumPad onKey={key} onDel={del} locked={false} />
              <motion.button data-testid="continue-to-confirm-btn"
                className={`w-full mt-4 py-[13px] rounded-[14px] font-semibold text-[13px] flex items-center justify-center gap-2 transition-all duration-300
                  ${valid ? "bg-[#00C2FF] text-[#020202]" : "bg-white/[0.025] text-[#1A1A1A] cursor-not-allowed border border-white/[0.025]"}`}
                style={valid ? { boxShadow: "0 6px 36px rgba(0,194,255,0.3), 0 2px 10px rgba(0,194,255,0.15)" } : {}}
                whileTap={valid ? { scale: 0.96 } : {}} onClick={goConfirm} disabled={!valid}>
                Continue <ArrowRight size={14} strokeWidth={2.5} />
              </motion.button>
            </motion.div>
          )}

          {/* ──────── STEP 2: CONFIRM ──────── */}
          {step === Step.CONFIRM && (
            <motion.div key="s2" className="flex-1 flex flex-col px-5 pb-5"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={slide}>
              <div className="flex-1 flex flex-col items-center justify-center">
                {/* Amount hero */}
                <motion.div className="text-center mb-7"
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.04 }}>
                  <p className="text-[48px] font-bold font-outfit text-white tracking-[-0.03em] leading-none mb-1">€{num.toFixed(2)}</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-[#00C2FF]/10 flex items-center justify-center"><Nfc size={10} className="text-[#00C2FF]" /></div>
                    <p className="text-[#555] text-[13px]">{m.businessName}</p>
                  </div>
                </motion.div>

                {/* Glass card */}
                <motion.div className="w-full rounded-[18px] overflow-hidden mb-5"
                  style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.045)", backdropFilter: "blur(24px)" }}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, ...slide }}>
                  {[
                    { lbl: "Reference", val: txRef, mono: true,
                      right: <motion.button className="text-[#00C2FF] text-[10px] font-semibold flex items-center gap-1" whileTap={{ scale: 0.88 }} onClick={copyRef}><Copy size={10} />{copied ? "Copied" : "Copy"}</motion.button> },
                    { lbl: "Merchant", val: m.businessName,
                      right: <div className="w-7 h-7 rounded-lg bg-[#00C2FF]/6 flex items-center justify-center"><Nfc size={12} className="text-[#00C2FF]" /></div> },
                    { lbl: "Method", val: "BidBlitz Wallet", right: <CreditCard size={13} className="text-[#333]" /> },
                    { lbl: "Expires in", val: expStr, cyan: true, right: <Ring sec={expiry} total={300} /> },
                  ].map((r, i) => (
                    <motion.div key={i} className={`flex items-center justify-between px-4 py-[11px] ${i < 3 ? "border-b border-white/[0.035]" : ""}`}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.05 }}>
                      <div>
                        <p className="text-[9px] text-[#3A3A3A] uppercase tracking-[0.1em] mb-[2px] font-semibold">{r.lbl}</p>
                        <p className={`text-[13px] ${r.mono ? "font-mono" : ""} ${r.cyan ? "text-[#00C2FF]" : "text-white/90"}`}>{r.val}</p>
                      </div>
                      {r.right}
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div className="flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  <ShieldCheck size={11} className="text-[#00D26A]/70" />
                  <span className="text-[10px] text-[#333] font-medium">End-to-end encrypted</span>
                </motion.div>
              </div>

              <div className="space-y-2">
                <motion.button data-testid="confirm-pay-btn"
                  className="w-full py-[13px] rounded-[14px] bg-[#00C2FF] text-[#020202] font-semibold text-[13px] flex items-center justify-center gap-2"
                  style={{ boxShadow: "0 6px 36px rgba(0,194,255,0.3), 0 2px 10px rgba(0,194,255,0.15)" }}
                  whileTap={{ scale: 0.96 }} onClick={goScan}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Fingerprint size={15} strokeWidth={2} /> Start Payment
                </motion.button>
                <motion.button data-testid="cancel-confirm-btn"
                  className="w-full py-3 rounded-[14px] text-[#444] font-semibold text-[13px]"
                  whileTap={{ scale: 0.96 }} onClick={() => { reset(); onNavigate("/"); }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ──────── STEP 3: SCANNING ──────── */}
          {step === Step.SCAN && (
            <motion.div key="s3" className="flex-1 flex flex-col items-center justify-center px-5 pb-5"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.3 }}>

              {/* Viewfinder */}
              <div className="relative w-[250px] h-[250px] mb-6">
                {/* Breathing glow */}
                <motion.div className="absolute -inset-5 rounded-[26px] pointer-events-none"
                  animate={{ boxShadow: ["0 0 30px rgba(0,194,255,0.04)","0 0 70px rgba(0,194,255,0.1)","0 0 30px rgba(0,194,255,0.04)"] }}
                  transition={{ duration: 2.8, repeat: Infinity }} />

                {/* Corner brackets */}
                {["top-0 left-0 border-t-[2px] border-l-[2px] rounded-tl-xl",
                  "top-0 right-0 border-t-[2px] border-r-[2px] rounded-tr-xl",
                  "bottom-0 left-0 border-b-[2px] border-l-[2px] rounded-bl-xl",
                  "bottom-0 right-0 border-b-[2px] border-r-[2px] rounded-br-xl"
                ].map((cls, i) => (
                  <motion.div key={i} className={`absolute w-12 h-12 border-[#00C2FF] ${cls}`}
                    animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.1 }} />
                ))}

                {/* Inner dark surface */}
                <div className="absolute inset-[16px] rounded-xl bg-[#050505] overflow-hidden">
                  {/* QR pattern */}
                  <div className="absolute inset-0 grid grid-cols-9 gap-[2px] p-[10px]">
                    {Array.from({ length: 81 }, (_, i) => (
                      <motion.div key={i} className="rounded-[2px]"
                        style={{ background: Math.random() > 0.42 ? "#141414" : "#0A0A0A", aspectRatio: "1" }}
                        animate={{ opacity: [0.35, 0.8, 0.35] }}
                        transition={{ duration: 0.9 + Math.random() * 0.8, repeat: Infinity, delay: i * 0.012 }} />
                    ))}
                  </div>
                  {/* Focus ring */}
                  <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border border-[#00C2FF]/15"
                    animate={{ scale: [0.85, 1.12, 0.85], opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 2.2, repeat: Infinity }} />
                </div>

                {/* Primary laser */}
                <motion.div className="absolute left-[16px] right-[16px] h-[2.5px] z-10"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(0,194,255,0.35) 12%, #00C2FF 38%, #00E5FF 50%, #00C2FF 62%, rgba(0,194,255,0.35) 88%, transparent 100%)",
                    boxShadow: "0 0 14px rgba(0,194,255,0.6), 0 0 36px rgba(0,194,255,0.25), 0 0 70px rgba(0,194,255,0.1)",
                  }}
                  initial={{ top: 20 }} animate={{ top: [20, 228, 20] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
                {/* Ghost laser */}
                <motion.div className="absolute left-[22px] right-[22px] h-px z-10 opacity-25"
                  style={{ background: "linear-gradient(90deg, transparent, #00C2FF, transparent)" }}
                  initial={{ top: 225 }} animate={{ top: [225, 22, 225] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
              </div>

              {/* Amount */}
              <motion.p className="text-[26px] font-bold font-outfit text-[#00C2FF] mb-0.5"
                animate={{ textShadow: ["0 0 16px rgba(0,194,255,0.15)","0 0 36px rgba(0,194,255,0.4)","0 0 16px rgba(0,194,255,0.15)"] }}
                transition={{ duration: 2, repeat: Infinity }}>
                €{num.toFixed(2)}
              </motion.p>
              <p className="text-[9px] text-[#2A2A2A] font-mono tracking-wider mb-4">{txRef}</p>

              {/* Progress bar */}
              <div className="w-40 h-[2.5px] bg-white/[0.035] rounded-full overflow-hidden mb-3">
                <motion.div className="h-full rounded-full"
                  style={{ width: `${prog}%`, background: "linear-gradient(90deg,#00C2FF,#00E5FF)", boxShadow: "0 0 8px rgba(0,194,255,0.5)" }} />
              </div>

              {/* Instruction badge */}
              <motion.div className="flex items-center gap-2 px-3.5 py-[6px] rounded-full"
                style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.08)" }}
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
                <QrCode size={12} className="text-[#00C2FF]" />
                <span className="text-[10px] text-[#00C2FF]/80 font-medium">Scan customer code</span>
              </motion.div>
            </motion.div>
          )}

          {/* ──────── STEP 4: PROCESSING ──────── */}
          {step === Step.PROCESSING && (
            <motion.div key="s4" className="flex-1 flex flex-col items-center justify-center px-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <div className="relative w-[88px] h-[88px] mb-6">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="absolute inset-0 rounded-full border border-[#00C2FF]/15"
                    animate={{ scale: [1, 1.45 + i * 0.12], opacity: [0.35, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }} />
                ))}
                <div className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{ background: "radial-gradient(circle,rgba(0,194,255,0.06) 0%,rgba(0,194,255,0.015) 100%)", border: "1px solid rgba(0,194,255,0.12)" }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={28} strokeWidth={1.5} className="text-[#00C2FF]" />
                  </motion.div>
                </div>
              </div>
              <motion.p className="text-[26px] font-bold font-outfit text-white tracking-tight mb-1.5"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                €{num.toFixed(2)}
              </motion.p>
              <motion.p className="text-[12px] text-[#444] font-medium mb-5"
                animate={{ opacity: [0.35, 0.85, 0.35] }} transition={{ duration: 2, repeat: Infinity }}>
                Securely processing payment...
              </motion.p>
              <Steps at={pStep} />
              <p className="text-[9px] text-[#1A1A1A] font-mono mt-5 tracking-wider">{txRef}</p>
            </motion.div>
          )}

          {/* ──────── STEP 5: SUCCESS ──────── */}
          {step === Step.SUCCESS && (
            <motion.div key="s5" className="flex-1 flex flex-col items-center justify-center px-5 pb-5 relative"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Confetti />

              {/* Flash overlay */}
              <motion.div className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }} animate={{ opacity: [0, 0.04, 0, 0.02, 0] }} transition={{ duration: 0.5 }}
                style={{ background: "linear-gradient(180deg,transparent 25%,rgba(0,210,106,0.18) 50%,transparent 75%)" }} />

              {/* Checkmark */}
              <div className="relative w-[118px] h-[118px] mb-6">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div key={i} className="absolute inset-0 rounded-full border border-[#00D26A]/25"
                    initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.35 + i * 0.22, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.25 + i * 0.18 }} />
                ))}
                <motion.div className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 45% 38%,rgba(0,210,106,0.22) 0%,rgba(0,210,106,0.04) 100%)",
                    border: "2px solid rgba(0,210,106,0.28)",
                    boxShadow: "0 0 50px rgba(0,210,106,0.12), inset 0 0 24px rgba(0,210,106,0.04)",
                  }}
                  initial={{ scale: 0 }} animate={{ scale: [0, 1.1, 0.96, 1] }}
                  transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1], delay: 0.04 }}>
                  <motion.div initial={{ scale: 0, rotate: -50 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 12 }}>
                    <Check size={50} strokeWidth={2.5} className="text-[#00D26A]" />
                  </motion.div>
                </motion.div>
                {/* Glow bloom */}
                <motion.div className="absolute inset-[-24px] rounded-full pointer-events-none" style={{ filter: "blur(44px)" }}
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 0.3, 0.18] }} transition={{ duration: 0.8, delay: 0.08 }}>
                  <div className="w-full h-full rounded-full bg-[#00D26A]" />
                </motion.div>
              </div>

              {/* Amount — scale + blur reveal */}
              <motion.p className="text-[46px] font-bold font-outfit text-white tracking-[-0.03em] leading-none mb-1"
                initial={{ scale: 0.7, opacity: 0, filter: "blur(6px)" }}
                animate={{ scale: [0.7, 1.05, 0.97, 1], opacity: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.28, duration: 0.55 }}>
                €{num.toFixed(2)}
              </motion.p>
              <motion.p className="text-[#00D26A] text-[13px] font-semibold mb-0.5"
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                Payment Successful
              </motion.p>
              <motion.p className="text-[#444] text-[11px] mb-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                {m.businessName}
              </motion.p>

              {/* Receipt */}
              <motion.div className="w-full rounded-[16px] overflow-hidden mb-5"
                style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.035)" }}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                {[
                  { l: "Reference", v: txRef, mono: true },
                  { l: "Date", v: doneAt ? fmtDate(doneAt) : "—" },
                  { l: "Time", v: doneAt ? fmtTime(doneAt) : "—" },
                  { l: "Status", v: "Completed", green: true, icon: <Check size={9} className="text-[#00D26A]" /> },
                  { l: "New Balance", v: `€${w.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`, bold: true },
                ].map((r, i, a) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-[9px] ${i < a.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                    <span className="text-[9px] text-[#3A3A3A] uppercase tracking-[0.1em] font-semibold">{r.l}</span>
                    <span className={`text-[11px] flex items-center gap-1
                      ${r.mono ? "font-mono text-white/75" : ""} ${r.green ? "text-[#00D26A] font-semibold" : ""}
                      ${r.bold ? "text-white font-semibold" : ""} ${!r.mono && !r.green && !r.bold ? "text-white/60" : ""}`}>
                      {r.icon}{r.v}
                    </span>
                  </div>
                ))}
              </motion.div>

              <motion.button data-testid="done-btn"
                className="w-full py-[13px] rounded-[14px] bg-white/[0.035] text-white font-semibold text-[13px] border border-white/[0.05]"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }} whileTap={{ scale: 0.96 }}
                onClick={() => { reset(); onNavigate("/"); }}>
                Done
              </motion.button>
            </motion.div>
          )}

          {/* ──────── STEP 6: ERROR ──────── */}
          {step === Step.ERROR && (
            <motion.div key="s6" className="flex-1 flex flex-col items-center justify-center px-5 pb-5 relative"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Red flash */}
              <motion.div className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }} animate={{ opacity: [0, 0.1, 0, 0.05, 0] }} transition={{ duration: 0.55 }}
                style={{ background: "radial-gradient(circle at 50% 38%,rgba(255,71,87,0.35) 0%,transparent 65%)" }} />

              {/* Error icon with shake */}
              <div className="relative w-[110px] h-[110px] mb-6">
                {[0, 1].map((i) => (
                  <motion.div key={i} className="absolute inset-0 rounded-full border border-[#FF4757]/20"
                    animate={{ scale: [1, 1.3 + i * 0.12], opacity: [0.3, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }} />
                ))}
                <motion.div className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 42% 38%,rgba(255,71,87,0.18) 0%,rgba(255,71,87,0.03) 100%)",
                    border: "2px solid rgba(255,71,87,0.22)",
                    boxShadow: "0 0 50px rgba(255,71,87,0.1)",
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.08, 0.96, 1], x: [0, 0, -10, 12, -12, 10, -6, 4, 0] }}
                  transition={{
                    scale: { duration: 0.4, ease: "easeOut" },
                    x: { delay: 0.35, duration: 0.55, ease: "easeInOut" },
                  }}>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 0.18, type: "spring", stiffness: 380 }}>
                    <AlertTriangle size={44} strokeWidth={2} className="text-[#FF4757]" />
                  </motion.div>
                </motion.div>
                <motion.div className="absolute inset-[-18px] rounded-full pointer-events-none" style={{ filter: "blur(40px)" }}
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 0.25, 0.15] }} transition={{ duration: 0.7, delay: 0.1 }}>
                  <div className="w-full h-full rounded-full bg-[#FF4757]" />
                </motion.div>
              </div>

              <motion.p className="text-[44px] font-bold font-outfit text-white tracking-[-0.03em] leading-none mb-1"
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [0.8, 1.04, 0.97, 1], opacity: 1 }}
                transition={{ delay: 0.22, duration: 0.5 }}>
                €{num.toFixed(2)}
              </motion.p>
              <motion.p className="text-[#FF4757] text-[13px] font-semibold mb-1.5"
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                Payment Declined
              </motion.p>
              <motion.p className="text-[#444] text-[11px] text-center max-w-[250px] leading-relaxed mb-7"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}>
                {err || "Insufficient balance. Please top up your wallet and try again."}
              </motion.p>

              <div className="w-full space-y-2">
                <motion.button data-testid="try-again-btn"
                  className="w-full py-[13px] rounded-[14px] font-semibold text-[13px] text-white"
                  style={{ background: "linear-gradient(135deg,#FF4757,#E8384F)", boxShadow: "0 6px 28px rgba(255,71,87,0.22)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}
                  whileTap={{ scale: 0.96 }} onClick={reset}>
                  Try Again
                </motion.button>
                <motion.button data-testid="cancel-btn"
                  className="w-full py-3 rounded-[14px] text-[#444] font-semibold text-[13px]"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.53 }}
                  whileTap={{ scale: 0.96 }} onClick={() => { reset(); onNavigate("/"); }}>
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
