import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Plus, ArrowUpRight, Store,
  ChevronRight, Check, Clock, Banknote, X, Loader2,
  BarChart3, Users, CircleDollarSign, AlertCircle, Download,
  ArrowDownToLine, Wallet, Shield
} from "lucide-react";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useMerchant } from "../store";
import { useMerchantStats } from "../hooks";
import { formatRelativeTime } from "../models";
import ExportSection from "../components/ExportSection";
import ErrorState from "../components/ErrorState";
import { api as apiService } from "../services/api";
import { useI18n } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;
const slide = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Request failed");
  return d;
}

const Skeleton = ({ className }) => (
  <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.025)" }}>
    <motion.div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)" }}
      animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub, color, delay = 0 }) => (
  <motion.div className="rounded-2xl p-4 relative overflow-hidden"
    style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, ...slide }}
    whileHover={{ borderColor: `${color}25` }}>
    <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full pointer-events-none" style={{ background: color, filter: "blur(40px)", opacity: 0.08 }} />
    <div className="flex items-center gap-2 mb-2.5 relative z-10">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}10`, border: `1px solid ${color}15` }}>
        <Icon size={13} style={{ color }} />
      </div>
      <span className="text-[9px] text-[#3A3A3A] uppercase tracking-[0.12em] font-semibold">{label}</span>
    </div>
    <p className="text-[17px] font-bold font-outfit text-white/90 relative z-10 leading-tight">{value}</p>
    {sub && <p className="text-[10px] text-[#333] font-medium mt-1 relative z-10">{sub}</p>}
  </motion.div>
);

const ActivityRow = ({ label, count, color, delay = 0 }) => (
  <motion.div className="flex items-center justify-between py-[11px]" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, ...slide }}>
    <div className="flex items-center gap-2.5">
      <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}40` }} />
      <span className="text-[12px] text-white/60 font-medium">{label}</span>
    </div>
    <span className="text-[13px] font-semibold font-outfit text-white/80">{count}</span>
  </motion.div>
);

const ChartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(15,15,15,0.95)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
        <p className="text-[#00C2FF] font-bold font-outfit text-[14px]">&euro;{payload[0].value.toLocaleString("de-DE")}</p>
      </div>
    );
  }
  return null;
};

const statusColors = { pending: "#FFB800", approved: "#00C2FF", processed: "#00D26A", failed: "#FF4757", cancelled: "#666" };

// ── Payout Modal ──
const PayoutModal = ({ isOpen, onClose, available, minPayout, flatFee, onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form"); // form | success | error

  const num = parseFloat(amount) || 0;
  const fee = flatFee;
  const net = Math.max(0, num - fee);
  const valid = num >= minPayout && num <= available;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true); setError(null);
    try {
      await api("/api/payout/request", { method: "POST", body: JSON.stringify({ amount: num, notes: "" }) });
      setStep("success");
      if (onSuccess) onSuccess();
    } catch (e) {
      setError(e.message); setStep("error");
    } finally { setLoading(false); }
  };

  const handleClose = () => { setStep("form"); setAmount(""); setError(null); onClose(); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step === "form" ? handleClose : undefined} />
        <motion.div className="relative w-full max-w-md bg-[#0A0A0A] rounded-t-3xl sm:rounded-3xl border border-white/10 overflow-hidden"
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold font-outfit text-white">
              {step === "form" ? "Request Payout" : step === "success" ? "Payout Requested" : "Failed"}
            </h2>
            <motion.button onClick={handleClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center" whileTap={{ scale: 0.9 }}>
              <X size={16} className="text-white/60" />
            </motion.button>
          </div>
          <div className="p-4">
            <AnimatePresence mode="wait">
              {step === "form" && (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-sm text-[#666] mb-1">Available: <span className="text-white font-semibold">&euro;{available.toFixed(2)}</span></p>
                  <p className="text-[10px] text-[#444] mb-4">Min. payout: &euro;{minPayout.toFixed(2)} &middot; Fee: &euro;{flatFee.toFixed(2)}</p>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-[14px] mb-4 transition-all border ${num > 0 ? "bg-white/[0.04] border-[#00C2FF]/25" : "bg-white/[0.02] border-white/[0.05]"}`}>
                    <span className="text-white/40 text-lg font-outfit">&euro;</span>
                    <input data-testid="payout-amount-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00" className="flex-1 bg-transparent text-xl text-white font-bold font-outfit outline-none placeholder:text-[#2A2A2A]" autoFocus />
                  </div>
                  {num > 0 && (
                    <motion.div className="bg-[#141414] rounded-2xl p-4 mb-4 border border-white/5 space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="flex justify-between text-sm"><span className="text-[#666]">Amount</span><span className="text-white">&euro;{num.toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-[#666]">Fee</span><span className="text-[#FF6B6B]">-&euro;{fee.toFixed(2)}</span></div>
                      <div className="border-t border-white/5 pt-2 flex justify-between">
                        <span className="text-white font-medium">You receive</span>
                        <span className="text-[#00D26A] font-bold">&euro;{net.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  )}
                  {num > available && <p className="text-[11px] text-[#FF4757] mb-3">Amount exceeds available balance</p>}
                  <motion.button data-testid="payout-submit-btn" onClick={handleSubmit} disabled={!valid || loading}
                    className="w-full py-3.5 bg-[#00D26A] text-white font-semibold rounded-full disabled:opacity-40 flex items-center justify-center gap-2"
                    whileTap={valid && !loading ? { scale: 0.98 } : {}}>
                    {loading ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={15} /></motion.div>Processing...</>
                      : <><Download size={15} />Request Payout</>}
                  </motion.button>
                </motion.div>
              )}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
                  <motion.div className="w-16 h-16 rounded-full bg-[#00D26A]/10 flex items-center justify-center mx-auto mb-4"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                    <Check size={28} className="text-[#00D26A]" />
                  </motion.div>
                  <p className="text-white font-semibold text-lg mb-1">Payout Requested</p>
                  <p className="text-2xl font-bold font-outfit text-[#00D26A] mb-1">&euro;{net.toFixed(2)}</p>
                  <p className="text-sm text-[#666] mb-6">Your payout will be processed shortly</p>
                  <motion.button onClick={handleClose} className="w-full py-3.5 bg-[#00D26A] text-white font-semibold rounded-full" whileTap={{ scale: 0.98 }}>Done</motion.button>
                </motion.div>
              )}
              {step === "error" && (
                <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
                  <motion.div className="w-16 h-16 rounded-full bg-[#FF4757]/10 flex items-center justify-center mx-auto mb-4"><AlertCircle size={28} className="text-[#FF4757]" /></motion.div>
                  <p className="text-white font-semibold text-lg mb-1">Payout Failed</p>
                  <p className="text-sm text-[#666] mb-6">{error || "Something went wrong"}</p>
                  <div className="flex gap-3">
                    <motion.button onClick={handleClose} className="flex-1 py-3.5 bg-[#141414] text-white font-semibold rounded-full border border-white/10" whileTap={{ scale: 0.98 }}>Cancel</motion.button>
                    <motion.button onClick={() => { setStep("form"); setError(null); }} className="flex-1 py-3.5 bg-[#FF4757] text-white font-semibold rounded-full" whileTap={{ scale: 0.98 }}>Retry</motion.button>
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

// ── Main MerchantPage ──
export const MerchantPage = ({ onNavigate }) => {
  const merchant = useMerchant();
  const stats = useMerchantStats();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [showPayout, setShowPayout] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState({ available: 0, pending_payout: 0, total_paid_out: 0, total_fees: 0, min_payout: 5, payout_flat_fee: 0.5 });
  const [payouts, setPayouts] = useState([]);

  const merchantExports = [
    { key: "payments", label: t("export.payments"), action: (f) => apiService.exportMerchantPayments(f) },
    { key: "fees", label: t("export.fees"), action: (f) => apiService.exportMerchantFees(f) },
    { key: "payouts", label: t("export.payouts"), action: (f) => apiService.exportMerchantPayouts(f) },
    { key: "settlements", label: t("export.settlements"), action: (f) => apiService.exportMerchantSettlements(f) },
  ];

  const fetchBalance = useCallback(async () => {
    try {
      const b = await api("/api/payout/balance");
      setBalance(b);
      setError(null);
    } catch (e) { setError(e); }
  }, []);

  const fetchPayouts = useCallback(async () => {
    try {
      const h = await api("/api/payout/history?limit=5");
      setPayouts(h.payouts || []);
    } catch (e) { if (!error) setError(e); }
  }, [error]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 500);
    fetchBalance(); fetchPayouts();
    return () => clearTimeout(t);
  }, [fetchBalance, fetchPayouts]);

  const handlePayoutSuccess = () => { fetchBalance(); fetchPayouts(); merchant.refreshDashboard && merchant.refreshDashboard(); };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    fetchBalance();
    fetchPayouts();
    setTimeout(() => setIsLoading(false), 500);
  };

  const recentPayments = merchant.payments.slice(0, 6).map((p) => ({ ...p, time: formatRelativeTime(p.date) }));

  return (
    <motion.div data-testid="merchant-page" className="min-h-screen relative overflow-hidden" style={{ background: "#030303" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="absolute top-[-18%] left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full pointer-events-none" style={{ filter: "blur(140px)", background: "rgba(0,210,106,0.035)" }} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <div className="flex items-center gap-3">
          <motion.button data-testid="merchant-back-btn" className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center" whileTap={{ scale: 0.88 }} onClick={() => onNavigate("/")}>
            <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
          </motion.button>
          <div>
            <motion.h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>Dashboard</motion.h1>
            <motion.p className="text-[10px] text-[#333] font-medium" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>{merchant.businessName}</motion.p>
          </div>
        </div>
        <motion.div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
          <Store size={15} strokeWidth={1.5} className="text-[#00D26A]/60" />
        </motion.div>
      </div>

      <div className="px-5 pb-8 relative z-10">

        {/* ── Error State ── */}
        {error && !isLoading && (
          <ErrorState error={error} onRetry={handleRetry} compact />
        )}

        {/* ── Earnings Hero ── */}
        <motion.div className="text-center pt-4 pb-5 relative" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, ...slide }}>
          <p className="text-[10px] text-[#3A3A3A] font-semibold tracking-[0.14em] uppercase mb-3">Today's Earnings</p>
          <AnimatePresence mode="wait">
            {isLoading ? <Skeleton className="h-[48px] w-40 mx-auto" /> : (
              <motion.div initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.25 }}>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-[24px] text-[#2A2A2A] font-outfit font-light">&euro;</span>
                  <motion.span className="text-[46px] font-bold font-outfit text-white tracking-[-0.03em] leading-none" key={stats.todayEarnings}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
                    {stats.todayEarnings.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!isLoading && (
            <motion.div className="flex items-center justify-center gap-1.5 mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
              <TrendingUp size={11} className="text-[#00D26A]" />
              <span className="text-[11px] font-medium text-[#00D26A]">+{stats.changeFromYesterday}% vs yesterday</span>
            </motion.div>
          )}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-36 pointer-events-none" style={{ filter: "blur(80px)", background: "radial-gradient(ellipse, rgba(0,210,106,0.06), transparent 70%)" }} />
        </motion.div>

        {/* ── Balance Buckets ── */}
        <motion.div className="rounded-2xl p-4 mb-5 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ...slide }}>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full pointer-events-none" style={{ background: "rgba(0,210,106,0.06)", filter: "blur(30px)" }} />
          <h3 className="text-[11px] font-semibold font-outfit text-[#444] uppercase tracking-[0.1em] mb-3 relative z-10">Balance Overview</h3>
          <div className="grid grid-cols-3 gap-3 relative z-10">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Wallet size={10} className="text-[#00D26A]" />
                <span className="text-[8px] text-[#444] uppercase tracking-[0.1em] font-semibold">Available</span>
              </div>
              <p className="text-[16px] font-bold font-outfit text-[#00D26A]">&euro;{balance.available.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock size={10} className="text-[#FFB800]" />
                <span className="text-[8px] text-[#444] uppercase tracking-[0.1em] font-semibold">Pending</span>
              </div>
              <p className="text-[16px] font-bold font-outfit text-[#FFB800]">&euro;{balance.pending_payout.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Check size={10} className="text-[#00C2FF]" />
                <span className="text-[8px] text-[#444] uppercase tracking-[0.1em] font-semibold">Paid Out</span>
              </div>
              <p className="text-[16px] font-bold font-outfit text-[#00C2FF]">&euro;{balance.total_paid_out.toFixed(2)}</p>
            </div>
          </div>
          {/* Fee info */}
          <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/[0.03]">
            <Shield size={9} className="text-[#333]" />
            <span className="text-[9px] text-[#333]">Platform fee: 2.5% &middot; Total fees: &euro;{balance.total_fees.toFixed(2)}</span>
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 mb-5">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px]" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <StatCard icon={CircleDollarSign} label="Gross Earnings" value={`\u20AC${(balance.gross_earnings || stats.totalEarnings).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`} sub="Before fees" color="#00C2FF" delay={0.14} />
            <StatCard icon={Users} label="Payments" value={stats.todayPaymentCount.toString()} sub="Today" color="#A855F7" delay={0.18} />
            <StatCard icon={BarChart3} label="Net Earnings" value={`\u20AC${balance.total_earnings.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`} sub="After fees" color="#00D26A" delay={0.22} />
            <StatCard icon={Banknote} label="Total Txns" value={merchant.totalTransactions.toString()} sub="All time" color="#FFB800" delay={0.26} />
          </div>
        )}

        {/* ── Weekly Chart ── */}
        <motion.div className="rounded-2xl p-4 mb-5 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, ...slide }}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-20 pointer-events-none" style={{ filter: "blur(50px)", background: "rgba(0,194,255,0.04)" }} />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-[12px] font-semibold font-outfit text-white/80">Weekly Overview</h3>
            <span className="text-[10px] text-[#333] font-medium">Last 7 days</span>
          </div>
          <div className="h-[120px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weeklyData}>
                <defs><linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00C2FF" stopOpacity={0.3} /><stop offset="100%" stopColor="#00C2FF" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#2A2A2A", fontSize: 10 }} dy={8} />
                <Tooltip content={<ChartTooltip />} cursor={false} />
                <Area type="monotone" dataKey="earnings" stroke="#00C2FF" strokeWidth={2} fill="url(#mGrad)" dot={false} activeDot={{ r: 4, fill: "#00C2FF", stroke: "#030303", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Action Buttons ── */}
        <div className="flex gap-2.5 mb-5">
          <motion.button data-testid="create-payment-btn"
            className="flex-1 py-[13px] rounded-[14px] bg-[#00C2FF] text-[#020202] font-semibold text-[13px] flex items-center justify-center gap-2"
            style={{ boxShadow: "0 4px 24px rgba(0,194,255,0.25)" }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, ...slide }}
            whileTap={{ scale: 0.96 }} onClick={() => onNavigate("/scan")}>
            <Plus size={15} strokeWidth={2.5} />Create Payment
          </motion.button>
          <motion.button data-testid="request-payout-btn"
            className="flex-1 py-[13px] rounded-[14px] font-semibold text-[13px] flex items-center justify-center gap-2"
            style={{ background: "rgba(0,210,106,0.08)", border: "1px solid rgba(0,210,106,0.15)", color: "#00D26A" }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, ...slide }}
            whileTap={{ scale: 0.96 }} onClick={() => setShowPayout(true)}>
            <ArrowDownToLine size={15} strokeWidth={2} />Payout
          </motion.button>
        </div>

        {/* ── Payout History ── */}
        {payouts.length > 0 && (
          <motion.section className="mb-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold font-outfit text-white">Payout History</h3>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
              {payouts.map((po, i) => (
                <div key={po.reference} className={`flex items-center gap-3 px-4 py-[12px] ${i < payouts.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${statusColors[po.status]}10`, border: `1px solid ${statusColors[po.status]}15` }}>
                    <Download size={14} style={{ color: statusColors[po.status] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white/90 truncate">{po.reference}</p>
                    <p className="text-[10px] text-[#333]">{new Date(po.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold font-outfit text-white/90">&euro;{po.net_amount.toFixed(2)}</p>
                    <span className="text-[8px] uppercase tracking-[0.08em] font-bold" style={{ color: statusColors[po.status] }}>{po.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Activity ── */}
        <motion.div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ...slide }}>
          <h3 className="text-[11px] font-semibold font-outfit text-[#444] uppercase tracking-[0.1em] mb-1">Activity</h3>
          <div className="divide-y divide-white/[0.03]">
            <ActivityRow label="Payments today" count={stats.todayPaymentCount} color="#00C2FF" delay={0.42} />
            <ActivityRow label="Successful" count={merchant.payments.length} color="#00D26A" delay={0.44} />
            <ActivityRow label="Failed" count={0} color="#FF4757" delay={0.46} />
          </div>
        </motion.div>

        {/* ── Recent Payments ── */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.48 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold font-outfit text-white">Recent Payments</h3>
            <motion.span className="text-[11px] text-[#00C2FF] font-medium cursor-pointer flex items-center gap-0.5" whileHover={{ x: 3 }}>
              View All <ChevronRight size={12} strokeWidth={2} />
            </motion.span>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[58px] w-full" />)}</div>
          ) : recentPayments.length === 0 ? (
            <motion.div className="py-12 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center"><Banknote size={20} className="text-[#2A2A2A]" /></div>
              <p className="text-[13px] text-[#333] font-medium mb-1">No payments yet</p>
              <p className="text-[11px] text-[#222]">Create your first payment to get started</p>
            </motion.div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
              {recentPayments.map((payment, i) => (
                <motion.div key={payment.id} data-testid={`payment-${payment.id}`}
                  className={`flex items-center gap-3.5 px-4 py-[13px] group hover:bg-white/[0.015] ${i < recentPayments.length - 1 ? "border-b border-white/[0.03]" : ""}`}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.04 }}>
                  <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center flex-shrink-0 relative"
                    style={{ background: "rgba(0,210,106,0.06)", border: "1px solid rgba(0,210,106,0.1)" }}>
                    <ArrowUpRight size={17} strokeWidth={1.6} className="text-[#00D26A]" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#00D26A", border: "2px solid #030303" }}>
                      <Check size={7} className="text-white" strokeWidth={3} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white/90 truncate">{payment.customerId}</p>
                    <p className="text-[10px] text-[#333] font-medium mt-0.5">{payment.time}</p>
                  </div>
                  <span className="text-[14px] font-bold font-outfit text-[#00D26A] tracking-tight flex-shrink-0">+&euro;{payment.amount.toFixed(2)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── Export Section ── */}
        <motion.div
          className="mt-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <ExportSection
            title={t("export.merchant_reports")}
            exports={merchantExports}
            t={t}
            testIdPrefix="merchant-export"
          />
        </motion.div>
      </div>

      {/* Payout Modal */}
      <PayoutModal isOpen={showPayout} onClose={() => setShowPayout(false)}
        available={balance.available} minPayout={balance.min_payout} flatFee={balance.payout_flat_fee}
        onSuccess={handlePayoutSuccess} />
    </motion.div>
  );
};

export default MerchantPage;
