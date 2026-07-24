/**
 * InstantCreditPage — Sofort-Kredit bis 100€ in 3 Minuten, 0% Zinsen
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Loader2, CheckCircle2, AlertTriangle, Clock,
  Wallet, Shield, TrendingUp, Euro, Info,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function InstantCreditPage({ onBack }) {
  const [eligibility, setEligibility] = useState(null);
  const [activeLoan, setActiveLoan] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(50);
  const [requesting, setRequesting] = useState(false);
  const [tab, setTab] = useState("request"); // request | active | history
  const [countdown, setCountdown] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [el, ac, hi] = await Promise.all([
        fetch(`${API}/api/instant-credit/eligibility`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/instant-credit/active`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/api/instant-credit/history`, { credentials: "include" }).then(r => r.json()),
      ]);
      setEligibility(el);
      setActiveLoan(ac?.loan || null);
      setHistory(hi?.loans || []);
      if (ac?.loan && ac.loan.status === "pending") setTab("active");
      else if (ac?.loan && ac.loan.status === "active") setTab("active");
    } catch {
      toast.error("Fehler beim Laden");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Countdown for pending loan payout
  useEffect(() => {
    if (!activeLoan || activeLoan.status !== "pending") { setCountdown(null); return; }
    const iv = setInterval(() => {
      const left = activeLoan.seconds_until_payout || 0;
      if (left <= 0) { load(); clearInterval(iv); return; }
      setCountdown(left);
      activeLoan.seconds_until_payout = Math.max(0, left - 1);
    }, 1000);
    setCountdown(activeLoan.seconds_until_payout);
    return () => clearInterval(iv);
  }, [activeLoan, load]);

  const requestLoan = async () => {
    if (!eligibility?.eligible) return;
    if (amount < 10 || amount > eligibility.max_amount_eur) {
      toast.error(`Betrag zwischen 10€ und ${eligibility.max_amount_eur}€`);
      return;
    }
    setRequesting(true);
    try {
      const r = await fetch(`${API}/api/instant-credit/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount_eur: Number(amount) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail);
      toast.success("Kredit beantragt! Auszahlung in 3 Minuten");
      await load();
      setTab("active");
    } catch (e) {
      toast.error(e.message || "Fehler");
    }
    setRequesting(false);
  };

  const repay = async (loanId, full = true) => {
    try {
      const r = await fetch(`${API}/api/instant-credit/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ loan_id: loanId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail);
      toast.success(j.fully_repaid ? "Komplett zurückgezahlt!" : `${j.repaid_eur.toFixed(2)}€ zurückgezahlt`);
      await load();
    } catch (e) {
      toast.error(e.message || "Fehler");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 size={20} className="animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div data-testid="instant-credit-page" className="min-h-screen pb-24"
         style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,184,0,0.18), transparent 50%), #050505" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#050505]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button onClick={onBack} data-testid="credit-back"
            whileTap={{ scale: 0.92 }}
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <h1 className="text-[14px] font-bold text-white">Sofort-Kredit</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Hero Card */}
        <motion.div
          className="rounded-3xl p-5 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #FFB800 0%, #FF6B00 100%)" }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        >
          <Zap size={32} className="mx-auto text-white" fill="white" />
          <p className="text-[10px] font-black text-white/85 uppercase tracking-[0.2em] mt-2">Sofort verfügbar</p>
          <p className="text-[42px] font-black text-white leading-none mt-1 font-outfit">
            bis 100€
          </p>
          <p className="text-[12px] font-bold text-white/90 mt-1">in nur 3 Minuten · 0% Zinsen</p>
          <div className="flex justify-center gap-3 mt-4">
            <Stat icon={Clock} label="3 Min" />
            <Stat icon={TrendingUp} label="0% Zins" />
            <Stat icon={Shield} label="Sicher" />
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
          {[
            { id: "request", label: "Beantragen" },
            { id: "active", label: "Aktiv", badge: activeLoan ? 1 : 0 },
            { id: "history", label: "Verlauf" },
          ].map(t => (
            <button key={t.id} data-testid={`credit-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all relative ${
                tab === t.id ? "bg-amber-500 text-black" : "text-white/60"
              }`}>
              {t.label}
              {t.badge > 0 && tab !== t.id && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "request" && (
            <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!eligibility?.eligible ? (
                <NotEligible eligibility={eligibility} />
              ) : (
                <RequestForm
                  eligibility={eligibility}
                  amount={amount}
                  setAmount={setAmount}
                  onRequest={requestLoan}
                  busy={requesting}
                />
              )}
            </motion.div>
          )}

          {tab === "active" && (
            <motion.div key="a" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!activeLoan ? (
                <p className="text-center text-[12px] text-white/50 py-12">Kein aktiver Kredit</p>
              ) : (
                <ActiveLoan loan={activeLoan} countdown={countdown} onRepay={() => repay(activeLoan.loan_id)} />
              )}
            </motion.div>
          )}

          {tab === "history" && (
            <motion.div key="h" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              {history.length === 0 ? (
                <p className="text-center text-[12px] text-white/50 py-12">Noch keine Kredite</p>
              ) : history.map(loan => (
                <div key={loan.loan_id} data-testid={`history-loan-${loan.loan_id}`}
                     className="rounded-xl p-3 bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-black text-white">{loan.amount_eur.toFixed(2)}€</p>
                      <p className="text-[10px] text-white/50">
                        {new Date(loan.requested_at).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${
                      loan.status === "repaid" ? "bg-emerald-500/20 text-emerald-300" :
                      loan.status === "active" ? "bg-amber-500/20 text-amber-300" :
                      loan.status === "pending" ? "bg-blue-500/20 text-blue-300" :
                      "bg-white/10 text-white/60"
                    }`}>
                      {loan.status === "repaid" ? "Zurückgezahlt" :
                       loan.status === "active" ? "Aktiv" :
                       loan.status === "pending" ? "Wartet" : loan.status}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const Stat = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-1 bg-black/25 rounded-full px-3 py-1.5">
    <Icon size={12} className="text-white" />
    <span className="text-[10px] font-bold text-white">{label}</span>
  </div>
);

function NotEligible({ eligibility }) {
  if (!eligibility) return null;
  const reason = eligibility.reason;
  return (
    <div className="rounded-2xl p-5 bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
      <AlertTriangle size={28} className="mx-auto text-amber-400" />
      <p className="text-[14px] font-bold text-white">Noch nicht verfügbar</p>
      <p className="text-[12px] text-white/70">{eligibility.message}</p>
      {reason === "score_too_low" && eligibility.score && (
        <div className="rounded-xl p-3 bg-black/20 text-left space-y-1.5 text-[11px]">
          <div className="flex justify-between"><span className="text-white/60">Score</span><span className="text-white font-bold">{eligibility.score.score}/100</span></div>
          <div className="flex justify-between"><span className="text-white/60">KYC verifiziert</span><span>{eligibility.score.kyc_verified ? "✅" : "❌"}</span></div>
          <div className="flex justify-between"><span className="text-white/60">Kontoalter</span><span className="text-white">{eligibility.score.account_age_days} Tage</span></div>
          <div className="flex justify-between"><span className="text-white/60">Transaktionen</span><span className="text-white">{eligibility.score.transactions_count}</span></div>
        </div>
      )}
    </div>
  );
}

function RequestForm({ eligibility, amount, setAmount, onRequest, busy }) {
  const max = eligibility.max_amount_eur;
  const fee = eligibility.fee_eur;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-white/[0.04] border border-white/[0.06]">
        <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-3">
          Wie viel brauchst du?
        </p>
        <div className="text-center mb-4">
          <p className="text-[48px] font-black text-white leading-none font-outfit tabular-nums">
            {Number(amount).toFixed(0)}<span className="text-[22px] text-white/50">€</span>
          </p>
        </div>
        <input
          data-testid="credit-amount-slider"
          type="range" min="10" max={max} step="5"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-[10px] text-white/40 mt-1">
          <span>10€</span><span>{max}€ max</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {[25, 50, 75, 100].filter(v => v <= max).map(v => (
            <button key={v} data-testid={`credit-quick-${v}`}
              onClick={() => setAmount(v)}
              className={`py-2 rounded-lg text-[11px] font-bold ${
                amount === v ? "bg-amber-500 text-black" : "bg-white/[0.05] text-white/70 border border-white/[0.06]"
              }`}>
              {v}€
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl p-4 bg-white/[0.04] border border-white/[0.06] space-y-2 text-[12px]">
        <Row label="Auszahlung" value={`${(amount - fee).toFixed(2)}€`} />
        <Row label={fee === 0 ? "Bearbeitungsgebühr (Premium)" : "Bearbeitungsgebühr"} value={`-${fee.toFixed(2)}€`} muted />
        <Row label="Zinsen" value="0,00€" highlight />
        <div className="border-t border-white/10 pt-2 mt-2">
          <Row label="Rückzahlung in 30 Tagen" value={`${Number(amount).toFixed(2)}€`} bold />
        </div>
      </div>

      <motion.button
        data-testid="credit-request-btn"
        onClick={onRequest}
        disabled={busy}
        whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#FFB800,#FF6B00)", color: "#000" }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} fill="black" />}
        {busy ? "Wird angefordert..." : `${Number(amount).toFixed(0)}€ jetzt anfordern`}
      </motion.button>

      <div className="flex gap-2 text-[10px] text-white/40">
        <Info size={12} className="flex-shrink-0 mt-0.5" />
        <p>Auszahlung in 3 Minuten · Rückzahlung 30 Tage · 0% Zinsen · KYC-verifiziert</p>
      </div>
    </div>
  );
}

const Row = ({ label, value, muted, highlight, bold }) => (
  <div className="flex justify-between">
    <span className={muted ? "text-white/40" : "text-white/70"}>{label}</span>
    <span className={`tabular-nums ${highlight ? "text-emerald-400 font-bold" : bold ? "text-white font-black" : "text-white"}`}>{value}</span>
  </div>
);

function ActiveLoan({ loan, countdown, onRepay }) {
  const isPending = loan.status === "pending";
  const minutes = Math.floor((countdown || 0) / 60);
  const seconds = (countdown || 0) % 60;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-5 text-center"
           style={{ background: isPending ? "linear-gradient(135deg,#3B82F6,#2563EB)" : "linear-gradient(135deg,#FFB800,#FF6B00)" }}>
        {isPending ? (
          <>
            <Clock size={32} className="mx-auto text-white" />
            <p className="text-[10px] font-black text-white/85 uppercase tracking-[0.2em] mt-2">Auszahlung in</p>
            <p className="text-[48px] font-black text-white leading-none mt-1 font-outfit tabular-nums">
              {minutes}:{String(seconds).padStart(2, "0")}
            </p>
            <p className="text-[12px] text-white/90 mt-2">{loan.amount_eur.toFixed(2)}€ werden überwiesen</p>
          </>
        ) : (
          <>
            <Wallet size={32} className="mx-auto text-black" />
            <p className="text-[10px] font-black text-black/70 uppercase tracking-[0.2em] mt-2">Offen</p>
            <p className="text-[48px] font-black text-black leading-none mt-1 font-outfit tabular-nums">
              {loan.outstanding_eur.toFixed(2)}<span className="text-[22px]">€</span>
            </p>
            <p className="text-[12px] text-black/70 mt-1">
              Fällig in {loan.days_until_due ?? "?"} Tagen
            </p>
          </>
        )}
      </div>

      {!isPending && (
        <>
          <motion.button
            data-testid="credit-repay-btn"
            onClick={onRepay}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 rounded-2xl font-black text-[14px] bg-emerald-500 text-black flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            Komplett zurückzahlen ({loan.outstanding_eur.toFixed(2)}€)
          </motion.button>

          <div className="rounded-xl p-3 bg-white/[0.04] border border-white/[0.06] space-y-1 text-[11px]">
            <Row label="Geliehen" value={`${loan.amount_eur.toFixed(2)}€`} />
            <Row label="Zinsen" value="0,00€" highlight />
            <Row label="Bearbeitungsgebühr" value={`${loan.fee_eur.toFixed(2)}€`} muted />
            <Row label="Fällig am" value={new Date(loan.due_at).toLocaleDateString("de-DE")} />
          </div>
        </>
      )}
    </div>
  );
}
