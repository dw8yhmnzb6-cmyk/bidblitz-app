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
} from "lucide-react";

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
                <p className="text-[12px] font-semibold text-white truncate">{u.email}</p>
                <p className="text-[10px] text-white/40 truncate">
                  {u.username} · {u.role}
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
              <p className="text-[13px] font-bold text-white truncate">{selected.email}</p>
              <p className="text-[12px] text-white/70 font-medium">
                💶 {fmt(selected.balance_eur)}€ · 🪙 {fmt(selected.balance_blz, 0)} BLZ
              </p>
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
          <p className="text-[16px] font-bold flex items-center gap-2"><Wallet size={16} className="text-[#00C2FF]" /> Wallet-Tool</p>
        </div>
        <Shield size={16} className="text-[#FFD700]" />
      </div>

      <div className="px-5 mt-3 flex gap-1 mb-4">
        {[
          { id: "send", label: "Senden / Abziehen", icon: Send },
          { id: "self", label: "Self-Topup", icon: Zap },
          { id: "history", label: "Log", icon: History },
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
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AdminWalletPage;
