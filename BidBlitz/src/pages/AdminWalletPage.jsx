/**
 * AdminWalletPage — Admin-Werkzeug zum Geld senden an Kunden + Self-Topup.
 * Features:
 *  - User-Suche (Email/Username)
 *  - Credit: EUR + BLZ an ausgewählten User
 *  - Debit (mit Warnung)
 *  - Self-Topup: Admin lädt eigenes Wallet auf
 *  - Transaktions-Log (letzte Admin-Aktionen)
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Search, Plus, Minus, Wallet, User as UserIcon,
  Loader2, Check, History, X, Shield, Send, Zap,
  AlertTriangle, ClipboardList, Eye, Lock, FileWarning,
} from "lucide-react";
import { LegacyRestoreCenterTab } from "../components/admin/LegacyRestoreCenterTab";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  let d = {};
  try { d = await r.clone().json(); } catch (parseError) { d = {}; }
  if (!r.ok) throw new Error(d.detail || d.message || `Error ${r.status}`);
  return d;
}

const fmt = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtDateTime = (value) => value ? new Date(value).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—";

// ── Tab: Send to User ──
const SendTab = ({ onDone }) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [amountEur, setAmountEur] = useState("");
  const [amountBlz, setAmountBlz] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState("credit"); // credit|debit
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loginHistory, setLoginHistory] = useState([]);

  const handleSelectUser = async (user) => {
    setSelected(user);
    setLoginHistory([]);
    setHistoryLoading(true);
    try {
      const res = await api(`/api/admin/wallet/users/${user.user_id}/login-history?limit=12`);
      setLoginHistory(res.history || []);
      setSelected((prev) => prev ? {
        ...prev,
        canonical_email: res.user?.canonical_email || prev.canonical_email,
        email_aliases: res.user?.email_aliases || prev.email_aliases,
        balance_eur: res.user?.balance_eur ?? prev.balance_eur,
        balance_blz: res.user?.balance_blz ?? prev.balance_blz,
        kyc_status: res.user?.kyc_status || prev.kyc_status,
        registered_at: res.user?.registered_at || prev.registered_at,
        last_login_at: res.user?.last_login_at || prev.last_login_at,
        login_count: res.user?.login_count ?? prev.login_count,
      } : prev);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const search = useCallback(async (q) => {
    setSearching(true);
    try {
      const r = await api(`/api/admin/wallet/users?q=${encodeURIComponent(q)}`);
      setUsers(r.users || []);
    } catch (e) { toast.error(e.message); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 350);
    return () => clearTimeout(t);
  }, [query, search]);

  const submit = async () => {
    if (!selected) return toast.error("Bitte User auswählen");
    const eur = parseFloat(amountEur) || 0;
    const blz = parseFloat(amountBlz) || 0;
    if (eur <= 0 && blz <= 0) return toast.error("Bitte Betrag eingeben");
    if (mode === "debit" && !window.confirm(`Wirklich ${eur} EUR + ${blz} BLZ vom User ABZIEHEN?`)) return;
    setBusy(true);
    try {
      const endpoint = mode === "credit" ? "/api/admin/wallet/credit" : "/api/admin/wallet/debit";
      const res = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({
          user_id: selected.user_id,
          amount_eur: eur,
          amount_blz: blz,
          reason: reason || `Admin ${mode}`,
        }),
      });
      toast.success(
        mode === "credit"
          ? `✓ ${eur > 0 ? `${eur}€` : ""}${eur && blz ? " + " : ""}${blz > 0 ? `${blz} BLZ` : ""} an ${selected.email} gesendet`
          : `✓ Von ${selected.email} abgezogen`
      );
      setAmountEur(""); setAmountBlz(""); setReason("");
      search(query); // refresh balance
      onDone?.();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5">
        {[
          { id: "credit", label: "Senden", icon: Plus, color: "#00E89D" },
          { id: "debit", label: "Abziehen", icon: Minus, color: "#EF4444" },
        ].map((m) => (
          <button
            key={m.id}
            data-testid={`mode-${m.id}`}
            onClick={() => setMode(m.id)}
            className="flex-1 py-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5"
            style={{
              background: mode === m.id ? m.color : "transparent",
              color: mode === m.id ? "#000" : "#fff",
            }}
          >
            <m.icon size={13} /> {m.label}
          </button>
        ))}
      </div>

      {/* User search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          data-testid="user-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="User suchen (Email, Name)..."
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-[12px] text-white outline-none focus:border-[#00C2FF]"
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/40" />}
      </div>

      {/* User list */}
      {!selected && (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {users.length === 0 && !searching && (
            <p className="text-center text-white/40 text-[11px] py-4">Keine User gefunden</p>
          )}
          {users.map((u) => (
            <motion.button
              key={u.user_id}
              data-testid={`user-row-${u.user_id}`}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectUser(u)}
              className="w-full rounded-xl p-3 flex items-center gap-3 text-left"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5">
                <UserIcon size={14} className="text-white/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{u.name || u.username || u.email}</p>
                <p className="text-[10px] text-white/40 truncate">
                  {u.email} · {u.role}
                </p>
                <p className="text-[9px] text-white/28 truncate" data-testid={`user-row-register-${u.user_id}`}>
                  Registriert: {fmtDateTime(u.registered_at || u.created_at)}
                </p>
                <p className="text-[9px] text-white/28 truncate" data-testid={`user-row-last-login-${u.user_id}`}>
                  Letzte Anmeldung: {fmtDateTime(u.last_login_at)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[15px] font-bold text-[#00E89D] leading-tight">{fmt(u.balance_eur)}€</p>
                <p className="text-[12px] font-semibold text-[#FFD700] leading-tight">{fmt(u.balance_blz, 0)} BLZ</p>
                <p className="text-[9px] text-white/28">{Number(u.login_count || 0)} Logins</p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Selected user + form */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.25)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00C2FF]/20">
              <UserIcon size={14} className="text-[#00C2FF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white truncate">{selected.name || selected.username || selected.email}</p>
              <p className="text-[11px] text-white/70 truncate">{selected.email}</p>
              <p className="text-[12px] text-white/70 font-medium">
                💶 {fmt(selected.balance_eur)}€ · 🪙 {fmt(selected.balance_blz, 0)} BLZ
              </p>
              <p className="text-[10px] text-white/55 mt-1" data-testid="selected-user-canonical-email">
                Kanonisch: {selected.canonical_email || selected.email}
              </p>
              {!!selected.email_aliases?.length && (
                <p className="text-[10px] text-white/45 mt-1 break-all" data-testid="selected-user-email-aliases">
                  Aliase: {selected.email_aliases.join(" • ")}
                </p>
              )}
              <p className="text-[10px] text-white/60 mt-1" data-testid="selected-user-register-at">
                Registriert: {fmtDateTime(selected.registered_at || selected.created_at)}
              </p>
              <p className="text-[10px] text-white/60" data-testid="selected-user-last-login-at">
                Letzte Anmeldung: {fmtDateTime(selected.last_login_at)} · {Number(selected.login_count || 0)} Logins
              </p>
            </div>
            <button
              data-testid="clear-user"
              onClick={() => { setSelected(null); setLoginHistory([]); }}
              className="text-white/40 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] uppercase text-white/40 font-bold">EUR</label>
              <input
                data-testid="amount-eur"
                type="number"
                value={amountEur}
                onChange={(e) => setAmountEur(e.target.value)}
                placeholder="0.00"
                className="w-full mt-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] font-mono text-white outline-none focus:border-[#00E89D]"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase text-white/40 font-bold">BLZ</label>
              <input
                data-testid="amount-blz"
                type="number"
                value={amountBlz}
                onChange={(e) => setAmountBlz(e.target.value)}
                placeholder="0"
                className="w-full mt-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] font-mono text-white outline-none focus:border-[#FFD700]"
              />
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-1.5 flex-wrap">
            {[10, 50, 100, 500].map((v) => (
              <button
                key={v}
                data-testid={`qa-${v}`}
                onClick={() => setAmountEur(String(v))}
                className="px-3 py-1 rounded-full text-[10px] bg-white/5 border border-white/10 text-white/70"
              >
                +{v}€
              </button>
            ))}
            {[100, 500, 1000].map((v) => (
              <button
                key={`blz-${v}`}
                data-testid={`qablz-${v}`}
                onClick={() => setAmountBlz(String(v))}
                className="px-3 py-1 rounded-full text-[10px] bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700]"
              >
                +{v} BLZ
              </button>
            ))}
          </div>

          <input
            data-testid="reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Grund (z.B. Cashback, Kulanz, Bug-Kompensation)"
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#00C2FF]"
          />

          <motion.button
            data-testid="submit-btn"
            whileTap={{ scale: 0.98 }}
            onClick={submit}
            disabled={busy}
            className="w-full py-3.5 rounded-xl font-bold text-[13px] disabled:opacity-40 flex items-center justify-center gap-2"
            style={{
              background: mode === "credit"
                ? "linear-gradient(90deg, #00E89D, #00C2FF)"
                : "linear-gradient(90deg, #EF4444, #F97316)",
              color: "#000",
            }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {mode === "credit" ? "Geld senden" : "Geld abziehen"}
          </motion.button>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" data-testid="selected-user-login-history-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Login-Historie</p>
              {historyLoading && <Loader2 size={12} className="animate-spin text-white/40" />}
            </div>
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {loginHistory.map((entry, idx) => (
                <div key={`${entry.event}-${entry.timestamp}-${idx}`} className="rounded-lg border border-white/6 bg-black/20 px-3 py-2" data-testid={`selected-user-login-history-${idx}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-white">{entry.event === "register" ? "Registrierung" : "Login"}</p>
                    <p className="text-[10px] text-white/45">{fmtDateTime(entry.timestamp)}</p>
                  </div>
                  <p className="mt-1 text-[10px] text-white/45 truncate">IP: {entry.ip || "—"}</p>
                </div>
              ))}
              {!historyLoading && !loginHistory.length && <p className="text-[10px] text-white/35">Noch keine Login-Daten gefunden.</p>}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ── Tab: Self Topup ──
const SelfTopupTab = () => {
  const [amountEur, setAmountEur] = useState("");
  const [amountBlz, setAmountBlz] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState({ eur: 0, blz: 0 });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const r = await api("/api/wallet/balance");
        if (!mounted) return;
        setBalance({
          eur: Number(r.balance || r.balance_eur || 0),
          blz: Number(r.balance_blz || 0),
        });
      } catch (error) {
        void error;
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async () => {
    const eur = parseFloat(amountEur) || 0;
    const blz = parseFloat(amountBlz) || 0;
    if (eur <= 0 && blz <= 0) return toast.error("Bitte Betrag eingeben");
    setBusy(true);
    try {
      const res = await api("/api/admin/wallet/self-topup", {
        method: "POST",
        body: JSON.stringify({ amount_eur: eur, amount_blz: blz, reason: "Admin Self-Topup" }),
      });
      toast.success(`✓ Wallet aufgeladen!`);
      setBalance({ eur: Number(res.balance_eur), blz: Number(res.balance_blz) });
      setAmountEur(""); setAmountBlz("");
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Current balance */}
      <div className="rounded-2xl p-5 text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(0,194,255,0.1), rgba(16,185,129,0.08))",
          border: "1px solid rgba(0,194,255,0.25)",
        }}>
        <p className="text-[10px] uppercase text-white/50 tracking-widest font-bold">Dein Wallet</p>
        <p className="text-[32px] font-bold text-white mt-1 font-mono">{fmt(balance.eur)}€</p>
        <p className="text-[13px] text-[#FFD700]">{fmt(balance.blz, 0)} BLZ</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase text-white/40 font-bold">+EUR</label>
          <input
            data-testid="self-eur"
            type="number"
            value={amountEur}
            onChange={(e) => setAmountEur(e.target.value)}
            placeholder="0.00"
            className="w-full mt-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-3 text-[15px] font-mono text-white outline-none focus:border-[#00E89D]"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase text-white/40 font-bold">+BLZ</label>
          <input
            data-testid="self-blz"
            type="number"
            value={amountBlz}
            onChange={(e) => setAmountBlz(e.target.value)}
            placeholder="0"
            className="w-full mt-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-3 text-[15px] font-mono text-white outline-none focus:border-[#FFD700]"
          />
        </div>
      </div>

      {/* Quick amounts */}
      <div className="flex gap-2 flex-wrap">
        {[100, 500, 1000, 5000].map((v) => (
          <button
            key={v}
            data-testid={`self-qa-${v}`}
            onClick={() => setAmountEur(String(v))}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-white/5 border border-white/10 text-white"
          >
            +{v}€
          </button>
        ))}
      </div>

      <motion.button
        data-testid="self-submit"
        whileTap={{ scale: 0.98 }}
        onClick={submit}
        disabled={busy}
        className="w-full py-3.5 rounded-xl font-bold text-[13px] disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(90deg, #FFD700, #FF6B00)", color: "#000" }}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        Wallet aufladen
      </motion.button>

      <div className="rounded-xl p-3 bg-yellow-500/5 border border-yellow-500/20">
        <p className="text-[10px] text-yellow-300 leading-relaxed">
          ⚠️ Das ist dein Admin-Override. Diese Transaktionen werden im Log gespeichert und sind nachvollziehbar.
        </p>
      </div>
    </div>
  );
};

// ── Tab: History ──
const HistoryTab = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/admin/wallet/transactions?limit=50")
      .then((r) => setItems(r.transactions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-white/40" /></div>;
  if (!items.length) return <p className="text-center text-white/40 text-[11px] py-10">Noch keine Admin-Transaktionen</p>;

  return (
    <div className="space-y-2">
      {items.map((t, i) => {
        const isCredit = (t.amount_eur || 0) > 0 || (t.amount_blz || 0) > 0;
        return (
          <div
            key={i}
            data-testid={`history-item-${i}`}
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: isCredit ? "rgba(0,232,157,0.15)" : "rgba(239,68,68,0.15)" }}
            >
              {isCredit ? <Plus size={14} className="text-[#00E89D]" /> : <Minus size={14} className="text-red-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white truncate">{t.user_email || t.user_id}</p>
              <p className="text-[10px] text-white/40 truncate">{t.description || t.type}</p>
              <p className="text-[9px] text-white/30">{t.created_at?.slice(0, 16).replace("T", " ")}</p>
            </div>
            <div className="text-right">
              {(t.amount_eur || 0) !== 0 && (
                <p className="text-[11px] font-bold" style={{ color: isCredit ? "#00E89D" : "#EF4444" }}>
                  {isCredit ? "+" : ""}{fmt(t.amount_eur)}€
                </p>
              )}
              {(t.amount_blz || 0) !== 0 && (
                <p className="text-[10px] text-[#FFD700]">
                  {(t.amount_blz > 0 ? "+" : "")}{fmt(t.amount_blz, 0)} BLZ
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ReconciliationTab = () => {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_wallets: 0, healthy_wallets: 0, mismatched_wallets: 0, duplicate_wallets: 0, pending_reconciliation: 0, last_reconciliation_run: null });
  const [dashboard, setDashboard] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewResult, setReviewResult] = useState("Manual review");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [repairPreview, setRepairPreview] = useState(null);
  const [repairAction, setRepairAction] = useState("mark_reviewed");
  const [repairReason, setRepairReason] = useState("");
  const [repairAmount, setRepairAmount] = useState("");
  const [repairTargetWalletId, setRepairTargetWalletId] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalOtp, setApprovalOtp] = useState("");
  const [repairHistory, setRepairHistory] = useState([]);
  const [repairBusy, setRepairBusy] = useState(false);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const [res, dash] = await Promise.all([
        api(`/api/admin/wallet/reconciliation?q=${encodeURIComponent(q)}&limit=80`),
        api(`/api/admin/wallet/reconciliation/dashboard`),
      ]);
      setRows(res.rows || []);
      setSummary(res.summary || {});
      setDashboard(dash || null);
      const history = await api(`/api/admin/wallet/reconciliation/repair-history?limit=40`);
      setRepairHistory(history.repairs || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const openHistory = async (userId) => {
    try {
      const res = await api(`/api/admin/wallet/reconciliation/history/${userId}`);
      setSelectedHistory(res);
      setReviewReason("");
      setReviewResult("Manual review");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const saveReview = async () => {
    if (!selectedHistory?.user?.user_id) return toast.error("Kein Wallet ausgewählt");
    if (!reviewReason.trim()) return toast.error("Bitte Grund angeben");
    setReviewBusy(true);
    try {
      await api(`/api/admin/wallet/reconciliation/review`, {
        method: "POST",
        body: JSON.stringify({ user_id: selectedHistory.user.user_id, reason: reviewReason, result: reviewResult }),
      });
      toast.success("Review in Queue gespeichert. Keine automatische Korrektur ausgeführt.");
      await load(query);
      const refreshed = await api(`/api/admin/wallet/reconciliation/history/${selectedHistory.user.user_id}`);
      setSelectedHistory(refreshed);
      setReviewReason("");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setReviewBusy(false);
    }
  };

  const createRepairPreview = async () => {
    if (!selectedHistory?.user?.user_id) return toast.error("Kein Wallet ausgewählt");
    if (!repairReason.trim()) return toast.error("Bitte Grund eingeben");
    setRepairBusy(true);
    try {
      const payload = {
        user_id: selectedHistory.user.user_id,
        action_type: repairAction,
        reason: repairReason,
        adjustment_amount: Number(repairAmount || 0),
        target_wallet_id: repairTargetWalletId || null,
      };
      const res = await api(`/api/admin/wallet/reconciliation/repair/preview`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setRepairPreview(res.repair);
      toast.success("Repair-Vorschau erstellt. Bestätigung erforderlich.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRepairBusy(false);
    }
  };

  const requestRepairOtp = async () => {
    try {
      const res = await api(`/api/admin/wallet/reconciliation/repair/request-2fa`, { method: "POST" });
      if (res.two_factor_required) {
        toast.success(res.email_sent ? "2FA-Code gesendet." : `2FA-Testcode: ${res._test_otp}`);
      } else {
        toast.success("Für diesen Admin ist kein 2FA-Schritt erforderlich.");
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const approveRepair = async () => {
    if (!repairPreview?.repair_id) return toast.error("Keine Repair-Vorschau vorhanden");
    if (!approvalPassword.trim()) return toast.error("Admin-Passwort erforderlich");
    setRepairBusy(true);
    try {
      const res = await api(`/api/admin/wallet/reconciliation/repair/approve`, {
        method: "POST",
        body: JSON.stringify({
          repair_id: repairPreview.repair_id,
          reason: repairReason,
          admin_password: approvalPassword,
          otp_code: approvalOtp || null,
        }),
      });
      toast.success(res.automatic_changes_performed === "NO" ? "Repair auditierbar freigegeben." : "Manueller Repair ausgeführt und protokolliert.");
      setRepairPreview(null);
      setApprovalPassword("");
      setApprovalOtp("");
      setRepairReason("");
      setRepairAmount("");
      setRepairTargetWalletId("");
      await load(query);
      const refreshed = await api(`/api/admin/wallet/reconciliation/history/${selectedHistory.user.user_id}`);
      setSelectedHistory(refreshed);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRepairBusy(false);
    }
  };

  const riskStyle = (band) => {
    if (band === "red") return { bg: "rgba(239,68,68,0.18)", fg: "#f87171", label: "Critical" };
    if (band === "orange") return { bg: "rgba(249,115,22,0.18)", fg: "#fb923c", label: "Large mismatch" };
    if (band === "yellow") return { bg: "rgba(245,158,11,0.18)", fg: "#fbbf24", label: "Small mismatch" };
    return { bg: "rgba(16,185,129,0.18)", fg: "#34d399", label: "No mismatch" };
  };

  return (
    <div className="space-y-4" data-testid="wallet-reconciliation-tab">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4" data-testid="wallet-reconciliation-center-header">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80 font-bold">Wallet Reconciliation Center</p>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-white/8 bg-black/20 p-3" data-testid="reconciliation-total-wallets"><p className="text-[10px] text-white/35">Total wallets</p><p className="mt-1 text-lg font-bold text-white">{Number(summary.total_wallets || 0)}</p></div>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3" data-testid="reconciliation-healthy-wallets"><p className="text-[10px] text-emerald-200/60">Healthy wallets</p><p className="mt-1 text-lg font-bold text-emerald-300">{Number(summary.healthy_wallets || 0)}</p></div>
          <div className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-3" data-testid="reconciliation-mismatched-wallets"><p className="text-[10px] text-amber-200/60">Mismatched wallets</p><p className="mt-1 text-lg font-bold text-amber-300">{Number(summary.mismatched_wallets || 0)}</p></div>
          <div className="rounded-xl border border-red-400/10 bg-red-400/5 p-3" data-testid="reconciliation-critical-cases"><p className="text-[10px] text-red-200/60">Critical</p><p className="mt-1 text-lg font-bold text-red-300">{Number(summary.critical_cases || 0)}</p></div>
          <div className="rounded-xl border border-fuchsia-400/10 bg-fuchsia-400/5 p-3" data-testid="reconciliation-duplicate-wallets"><p className="text-[10px] text-fuchsia-200/60">Duplicate wallets</p><p className="mt-1 text-lg font-bold text-fuchsia-300">{Number(summary.duplicate_wallets || 0)}</p></div>
          <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-3" data-testid="reconciliation-pending-queue"><p className="text-[10px] text-cyan-200/60">Pending reconciliation</p><p className="mt-1 text-lg font-bold text-cyan-300">{Number(summary.pending_reconciliation || 0)}</p></div>
        </div>
        <p className="mt-3 text-[10px] text-white/45" data-testid="reconciliation-last-run">Last reconciliation run: {summary.last_reconciliation_run ? fmtDateTime(summary.last_reconciliation_run) : "—"}</p>
      </div>

      {dashboard ? (
        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" data-testid="reconciliation-dashboard-card">
            <div className="flex items-center gap-2"><ClipboardList size={14} className="text-cyan-300" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Dashboard</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-5">
              <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">Healthy Wallets</p><p className="mt-1 font-bold text-white">{dashboard.dashboard?.healthy_wallets || 0}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">Needs Review</p><p className="mt-1 font-bold text-white">{dashboard.dashboard?.needs_review || 0}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">Critical</p><p className="mt-1 font-bold text-white">{dashboard.dashboard?.critical || 0}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">Duplicate Users</p><p className="mt-1 font-bold text-white">{dashboard.dashboard?.duplicate_users || 0}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">Legacy Wallets</p><p className="mt-1 font-bold text-white">{dashboard.dashboard?.legacy_wallets || 0}</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" data-testid="reconciliation-duplicate-card">
            <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-fuchsia-300" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Duplicate Detection</p></div>
            <div className="mt-3 space-y-2 text-[11px] text-white/80">
              <p data-testid="duplicate-email-count">Duplicate email: {dashboard.duplicate_groups?.duplicate_email?.length || 0}</p>
              <p data-testid="duplicate-wallet-count">Duplicate wallet: {dashboard.duplicate_groups?.duplicate_wallet?.length || 0}</p>
              <p data-testid="duplicate-canonical-count">Duplicate canonical user: {dashboard.duplicate_groups?.duplicate_canonical_user?.length || 0}</p>
              <p data-testid="duplicate-admin-alias-count">Duplicate admin aliases: {dashboard.duplicate_groups?.duplicate_admin_alias?.length || 0}</p>
            </div>
          </div>
        </div>
      ) : null}

      <input
        data-testid="reconciliation-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="E-Mail, Nummer oder Name suchen"
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#00C2FF]"
      />

      {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-white/40" /></div> : null}
      {!loading && !rows.length ? <p className="text-center text-white/40 text-[11px] py-10">Keine Reconciliation-Daten gefunden</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.user_id}-${index}`} data-testid={`reconciliation-row-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-white truncate">{row.email}</p>
                <p className="text-[10px] text-white/45 break-all">{row.user_id}</p>
                <p className="text-[10px] text-white/35">{row.role} {row.user_number ? `· ${row.user_number}` : ""}</p>
              </div>
              <span
                data-testid={`reconciliation-risk-${index}`}
                className="rounded-full px-2 py-1 text-[10px] font-bold uppercase"
                style={{
                  background: riskStyle(row.risk_band).bg,
                  color: riskStyle(row.risk_band).fg,
                }}
              >
                {riskStyle(row.risk_band).label}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4 xl:grid-cols-8">
              <div className="rounded-xl border border-white/6 bg-black/20 p-2" data-testid={`reconciliation-users-balance-${index}`}><p className="text-white/35">users.balance</p><p className="mt-1 font-bold text-white">€{Number(row.users_balance || 0).toFixed(2)}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-2" data-testid={`reconciliation-wallets-balance-${index}`}><p className="text-white/35">wallets.balance</p><p className="mt-1 font-bold text-white">€{Number(row.wallets_balance || 0).toFixed(2)}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-2" data-testid={`reconciliation-transactions-sum-${index}`}><p className="text-white/35">transactions Σ</p><p className="mt-1 font-bold text-white">€{Number(row.transactions_sum || 0).toFixed(2)}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-2" data-testid={`reconciliation-wallet-transactions-sum-${index}`}><p className="text-white/35">wallet_tx Σ</p><p className="mt-1 font-bold text-white">€{Number(row.wallet_transactions_sum || 0).toFixed(2)}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-2" data-testid={`reconciliation-expected-balance-${index}`}><p className="text-white/35">expected balance</p><p className="mt-1 font-bold text-white">€{Number(row.expected_balance || 0).toFixed(2)}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-2" data-testid={`reconciliation-displayed-balance-${index}`}><p className="text-white/35">displayed balance</p><p className="mt-1 font-bold text-white">€{Number(row.displayed_balance || 0).toFixed(2)}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-2" data-testid={`reconciliation-delta-${index}`}><p className="text-white/35">Delta</p><p className="mt-1 font-bold text-white">€{Number(row.delta || 0).toFixed(2)}</p></div>
              <div className="rounded-xl border border-white/6 bg-black/20 p-2" data-testid={`reconciliation-confidence-${index}`}><p className="text-white/35">confidence score</p><p className="mt-1 font-bold text-white">{Number(row.confidence_score || 0)}%</p></div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-3" data-testid={`reconciliation-recommendation-${index}`}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-bold">Recommended Action</p>
                <p className="mt-1 text-[11px] font-semibold text-white">{row.recommended_action}</p>
                <p className="mt-1 text-[11px] text-white/70">{row.recommended_repair}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button data-testid={`reconciliation-open-history-${index}`} onClick={() => openHistory(row.user_id)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/[0.08] flex items-center gap-2"><Eye size={13} /> History Viewer</button>
                <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[10px] text-white/65" data-testid={`reconciliation-duplicates-${index}`}>
                  Duplicate flags: {row.duplicate_flags?.length ? row.duplicate_flags.join(", ") : "none"}
                </div>
                {row.latest_repair_action ? (
                  <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 px-3 py-2 text-[10px] text-white/70" data-testid={`reconciliation-latest-repair-${index}`}>
                    Last decision: {row.latest_repair_action} · {row.latest_repair_status || 'pending'}
                    {row.latest_repair_at ? ` · ${fmtDateTime(row.latest_repair_at)}` : ""}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" data-testid="reconciliation-repair-queue-card">
          <div className="flex items-center gap-2"><ClipboardList size={14} className="text-white/70" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Repair Queue</p></div>
          <p className="mt-2 text-[11px] text-white/55">Jede spätere Reparatur braucht manuelle Freigabe. In dieser Phase werden nur Reviews protokolliert.</p>
          <div className="mt-3 space-y-2">
            {(dashboard?.queue || []).slice(0, 8).map((item, idx) => (
              <div key={`${item.user_id}-${idx}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2" data-testid={`repair-queue-item-${idx}`}>
                <p className="text-[11px] font-semibold text-white truncate">{item.email}</p>
                <p className="text-[10px] text-white/45">{item.recommended_action} · {item.risk_band} · Δ €{Number(item.delta || 0).toFixed(2)}</p>
                {item.latest_repair_action ? <p className="text-[10px] text-cyan-300/70">Last: {item.latest_repair_action} · {item.latest_repair_status}</p> : null}
              </div>
            ))}
            {!dashboard?.queue?.length ? <p className="text-[11px] text-white/35">Keine Queue-Einträge.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" data-testid="reconciliation-history-viewer-card">
          <div className="flex items-center gap-2"><History size={14} className="text-white/70" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">History Viewer</p></div>
          {!selectedHistory ? <p className="mt-3 text-[11px] text-white/40">Wähle links ein Wallet, um komplettes Ledger, Payment-, Refund-, Cashback- und Adjustment-Historie read-only zu prüfen.</p> : (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                <p className="text-[12px] font-bold text-white">{selectedHistory.user?.email}</p>
                <p className="text-[10px] text-white/45 break-all">{selectedHistory.user?.user_id}</p>
                <p className="mt-1 text-[10px] text-white/65">users.balance: €{Number(selectedHistory.user?.users_balance || 0).toFixed(2)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">Complete ledger</p><p className="mt-1 font-bold text-white">{selectedHistory.complete_ledger?.length || 0}</p></div>
                <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">wallet tx</p><p className="mt-1 font-bold text-white">{selectedHistory.wallet_transaction_history?.length || 0}</p></div>
                <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">payment history</p><p className="mt-1 font-bold text-white">{selectedHistory.payment_history?.length || 0}</p></div>
                <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">refund history</p><p className="mt-1 font-bold text-white">{selectedHistory.refund_history?.length || 0}</p></div>
                <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">cashback history</p><p className="mt-1 font-bold text-white">{selectedHistory.cashback_history?.length || 0}</p></div>
                <div className="rounded-xl border border-white/6 bg-black/20 p-3"><p className="text-white/35">adjustment history</p><p className="mt-1 font-bold text-white">{selectedHistory.adjustment_history?.length || 0}</p></div>
              </div>

              <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/70 font-bold">Audit Review</p>
                <input data-testid="reconciliation-review-reason" value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Grund für Review / Queue-Eintrag" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                <select data-testid="reconciliation-review-result" value={reviewResult} onChange={(e) => setReviewResult(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none">
                  <option>Manual review</option>
                  <option>Investigate</option>
                  <option>Merge</option>
                  <option>Rebuild from ledger</option>
                  <option>Ignore legacy wallet</option>
                  <option>No action</option>
                </select>
                <button data-testid="reconciliation-save-review" onClick={saveReview} disabled={reviewBusy} className="mt-2 w-full rounded-lg bg-cyan-400 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">{reviewBusy ? "Speichert…" : "Review in Queue speichern"}</button>
                <p className="mt-2 text-[10px] text-white/50">Reviewer, Timestamp, Reason und Result werden auditierbar gespeichert. Keine automatische Finanzkorrektur.</p>
              </div>

              <div className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-3" data-testid="manual-repair-panel">
                <div className="flex items-center gap-2"><FileWarning size={14} className="text-amber-300" /><p className="text-[10px] uppercase tracking-[0.16em] text-amber-300/70 font-bold">Controlled Manual Repair</p></div>
                <select data-testid="repair-action-select" value={repairAction} onChange={(e) => setRepairAction(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none">
                  <option value="mark_reviewed">Mark as reviewed</option>
                  <option value="ignore_legacy_wallet">Ignore legacy wallet</option>
                  <option value="sync_displayed_balance_to_canonical_users_balance">Sync displayed balance to canonical users.balance</option>
                  <option value="create_adjustment_entry">Create adjustment entry</option>
                  <option value="merge_duplicate_wallet">Merge duplicate wallet</option>
                  <option value="send_to_investigation">Send to investigation</option>
                </select>
                <input data-testid="repair-reason-input" value={repairReason} onChange={(e) => setRepairReason(e.target.value)} placeholder="Pflichtgrund für Repair" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                {repairAction === "create_adjustment_entry" ? <input data-testid="repair-adjustment-amount" value={repairAmount} onChange={(e) => setRepairAmount(e.target.value)} placeholder="Adjustment Betrag (z.B. 10.50 oder -5.25)" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" /> : null}
                {repairAction === "merge_duplicate_wallet" ? <input data-testid="repair-target-wallet-id" value={repairTargetWalletId} onChange={(e) => setRepairTargetWalletId(e.target.value)} placeholder="Ziel Wallet ID (nur gleiche canonical user_id)" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" /> : null}
                <button data-testid="repair-preview-button" onClick={createRepairPreview} disabled={repairBusy} className="mt-2 w-full rounded-lg bg-amber-300 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">{repairBusy ? "Erstellt…" : "Repair Preview erstellen"}</button>

                {repairPreview ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3" data-testid="repair-approval-modal">
                    <p className="text-[11px] font-bold text-white">Confirmation Required</p>
                    <p className="mt-1 text-[10px] text-white/60">Action: {repairPreview.action_type}</p>
                    <p className="text-[10px] text-white/60">Before users.balance: €{Number(repairPreview.before_users_balance || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-white/60">Before wallets.balance: €{Number(repairPreview.before_wallets_balance || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-white/60">After users.balance: €{Number(repairPreview.after_users_balance || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-white/60">After wallets.balance: €{Number(repairPreview.after_wallets_balance || 0).toFixed(2)}</p>
                    <div className="mt-2 flex items-center gap-2"><Lock size={12} className="text-white/50" /><p className="text-[10px] text-white/50">Passwort/2FA erforderlich. Keine blinden Reparaturen.</p></div>
                    <input data-testid="repair-approval-password" type="password" value={approvalPassword} onChange={(e) => setApprovalPassword(e.target.value)} placeholder="Admin Passwort" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                    <div className="mt-2 flex gap-2">
                      <input data-testid="repair-approval-otp" value={approvalOtp} onChange={(e) => setApprovalOtp(e.target.value)} placeholder="2FA Code falls aktiv" className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white outline-none" />
                      <button data-testid="repair-request-otp" onClick={requestRepairOtp} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white">2FA senden</button>
                    </div>
                    <button data-testid="repair-approve-button" onClick={approveRepair} disabled={repairBusy} className="mt-2 w-full rounded-lg bg-cyan-400 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">{repairBusy ? "Bestätigt…" : "Repair bestätigen"}</button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" data-testid="repair-history-page-card">
          <div className="flex items-center gap-2"><History size={14} className="text-white/70" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Repair History</p></div>
          <div className="mt-3 space-y-2 max-h-[240px] overflow-y-auto">
            {repairHistory.slice(0, 10).map((item, idx) => (
              <div key={`${item.repair_id}-${idx}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2" data-testid={`repair-history-item-${idx}`}>
                <p className="text-[11px] font-semibold text-white">{item.action_type}</p>
                <p className="text-[10px] text-white/45">{item.user_id} · {item.status}</p>
                <p className="text-[10px] text-white/35">approved_by: {item.approved_by || '—'} · {item.approved_at ? fmtDateTime(item.approved_at) : 'pending'}</p>
              </div>
            ))}
            {!repairHistory.length ? <p className="text-[11px] text-white/35">Noch keine Repair-Aktionen protokolliert.</p> : null}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

// ── Main ──
const AdminWalletPage = ({ onBack }) => {
  const [tab, setTab] = useState("send");
  const [refresh, setRefresh] = useState(0);

  return (
    <motion.div
      data-testid="admin-wallet-page"
      className="min-h-screen pb-24"
      style={{ background: "#050505", color: "white" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <div
        className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 sticky top-0 z-20 backdrop-blur-xl"
        style={{ background: "rgba(5,5,5,0.85)" }}
      >
        <motion.button
          data-testid="admin-wallet-back"
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <ChevronLeft size={18} />
        </motion.button>
        <div className="flex-1">
          <p className="text-[11px] text-white/50 uppercase tracking-[0.2em] font-bold">Admin</p>
          <p className="text-[16px] font-bold flex items-center gap-2"><Wallet size={16} className="text-[#00C2FF]" /> Wallet Reconciliation Center</p>
        </div>
        <Shield size={16} className="text-[#FFD700]" />
      </div>

      <div className="px-5 mt-3 flex gap-1 mb-4">
        {[
          { id: "send", label: "Senden / Abziehen", icon: Send },
          { id: "self", label: "Self-Topup", icon: Zap },
          { id: "history", label: "Log", icon: History },
          { id: "reconciliation", label: "Reconciliation", icon: Shield },
          { id: "legacy-restore", label: "Legacy Restore", icon: AlertTriangle },
        ].map((t) => (
          <motion.button
            key={t.id}
            data-testid={`tab-${t.id}`}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTab(t.id)}
            className="flex-1 rounded-xl py-2 text-[11px] font-bold flex items-center justify-center gap-1.5"
            style={{
              background: tab === t.id ? "rgba(0,194,255,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${tab === t.id ? "#00C2FF" : "rgba(255,255,255,0.05)"}`,
              color: tab === t.id ? "#00C2FF" : "rgba(255,255,255,0.6)",
            }}
          >
            <t.icon size={12} /> {t.label}
          </motion.button>
        ))}
      </div>

      <div className="px-5">
        <AnimatePresence mode="wait">
          {tab === "send" && (
            <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SendTab onDone={() => setRefresh((r) => r + 1)} />
            </motion.div>
          )}
          {tab === "self" && (
            <motion.div key="self" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SelfTopupTab />
            </motion.div>
          )}
          {tab === "history" && (
            <motion.div key={`h-${refresh}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HistoryTab />
            </motion.div>
          )}
          {tab === "reconciliation" && (
            <motion.div key="reconciliation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ReconciliationTab />
            </motion.div>
          )}
          {tab === "legacy-restore" && (
            <motion.div key="legacy-restore" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LegacyRestoreCenterTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AdminWalletPage;
