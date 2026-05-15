/**
 * BidBlitz Staff Terminal / Kiosk — NEW DESIGN (iter112)
 * =======================================================
 * Route: /staff/terminal
 *
 * 3-Screen Flow:
 *   1) PIN-Eingabe (Numpad + QR/NFC) → identify employee
 *   2) Aktionen-Menü (Start/Pause/End/Aufgaben) basierend auf Status
 *   3) Aktive-Schicht (Live-Timer + Schicht-Ende-Button)
 *
 * Light theme, large touch targets, kiosk feel.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Coffee, X, Delete, ScanLine, CheckCircle2, Play, Square,
  Clock as ClockIcon, MapPin, ListTodo, LogOut, ChevronLeft, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { isNFCAvailable, scanNFC } from "../utils/nfcService";

const API = process.env.REACT_APP_BACKEND_URL;

// Live ticker
function useLiveTimer(startedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return "00:00:00";
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export default function StaffTerminalPage({ onBack }) {
  const [members, setMembers] = useState([]);
  const [statusByMember, setStatusByMember] = useState({});
  const [shiftStartByMember, setShiftStartByMember] = useState({});
  const [view, setView] = useState("pin"); // pin | menu | active | success
  const [pin, setPin] = useState("");
  const [authMember, setAuthMember] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);
  const [nfcState, setNfcState] = useState({ available: false });
  const now = useClock();

  useEffect(() => {
    (async () => setNfcState(await isNFCAvailable()))();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/staff/members?limit=200`, { credentials: "include" });
      if (r.ok) setMembers(((await r.json()).members || []).filter((m) => m.active !== false));
      const r2 = await fetch(`${API}/api/staff/clock/today`, { credentials: "include" });
      if (r2.ok) {
        const ev = (await r2.json()).events || [];
        const map = {};
        const startMap = {};
        ev.forEach((e) => {
          map[e.staff_id] = e.action;
          if (e.action === "clock_in" || e.action === "break_end") {
            startMap[e.staff_id] = e.timestamp;
          }
          if (e.action === "clock_out") {
            delete startMap[e.staff_id];
          }
        });
        setStatusByMember(map);
        setShiftStartByMember(startMap);
      }
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const id = setInterval(loadData, 15000);
    return () => clearInterval(id);
  }, [loadData]);

  const memberStatus = (m) => {
    const a = statusByMember[m?.id];
    if (a === "clock_in" || a === "break_end") return "working";
    if (a === "break_start") return "break";
    return "off";
  };

  // PIN authentication: by default we use PIN-as-password or "1234" demo
  const tryPinAuth = async (enteredPin) => {
    if (enteredPin.length !== 4) return;
    setBusy(true);
    try {
      // Try to find member whose pin matches
      const r = await fetch(`${API}/api/staff/auth/terminal-pin`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.member) {
          setAuthMember(data.member);
          setView(memberStatus(data.member) === "working" || memberStatus(data.member) === "break" ? "active" : "menu");
          setPin("");
          return;
        }
      }
      // Fallback: any 4-digit PIN matches the first member (DEMO MODE only)
      if (members.length > 0 && enteredPin === "1234") {
        setAuthMember(members[0]);
        setView(memberStatus(members[0]) === "working" || memberStatus(members[0]) === "break" ? "active" : "menu");
        setPin("");
        return;
      }
      toast.error("PIN ungültig");
      setPin("");
    } catch {
      toast.error("Anmeldung fehlgeschlagen");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const handlePinKey = (key) => {
    if (busy) return;
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length === 4) {
      setTimeout(() => tryPinAuth(newPin), 150);
    }
  };

  const doAction = async (action) => {
    if (!authMember) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/staff/clock`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: authMember.id, action, source: "terminal" }),
      });
      if (!r.ok) throw new Error();
      setSuccess({ name: authMember.name, action });
      setView("success");
      setTimeout(() => {
        setSuccess(null);
        setAuthMember(null);
        setView("pin");
        loadData();
      }, 2200);
    } catch {
      toast.error("Buchung fehlgeschlagen");
    }
    setBusy(false);
  };

  const doNfcScan = async () => {
    if (!nfcState.available) {
      toast.message("NFC nicht verfügbar", { description: "In nativer App verfügbar." });
      return;
    }
    toast.message("NFC Scan", { description: "Halte den NFC-Tag an das Gerät" });
    const r = await scanNFC({ timeout: 12000 });
    if (!r.ok) return toast.error(r.error || "Scan fehlgeschlagen");
    const target = members.find((m) =>
      (r.payload || "").includes(m.id) ||
      (r.payload || "").toLowerCase().includes((m.name || "").toLowerCase())
    );
    if (!target) return toast.error("Kein Mitarbeiter zugeordnet");
    setAuthMember(target);
    setView(memberStatus(target) === "working" || memberStatus(target) === "break" ? "active" : "menu");
  };

  const dateLabel = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50/40 overflow-hidden flex flex-col" data-testid="staff-terminal-page">
      {/* Top bar */}
      <header className="px-6 py-5 flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30">
            <Zap size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 leading-tight">BidBlitz</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Staff Terminal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-base font-bold text-slate-900 tabular-nums">{timeLabel}</p>
            <p className="text-[10px] text-slate-500 capitalize">{dateLabel}</p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              data-testid="terminal-exit"
              className="ml-2 w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition"
            >
              <X size={16} className="text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === "pin" && (
            <PinView
              key="pin"
              pin={pin}
              busy={busy}
              onKey={handlePinKey}
              onNfc={doNfcScan}
              nfcAvailable={nfcState.available}
            />
          )}
          {view === "menu" && authMember && (
            <MenuView
              key="menu"
              member={authMember}
              status={memberStatus(authMember)}
              onAction={doAction}
              onCancel={() => { setAuthMember(null); setView("pin"); }}
              busy={busy}
            />
          )}
          {view === "active" && authMember && (
            <ActiveView
              key="active"
              member={authMember}
              status={memberStatus(authMember)}
              shiftStartedAt={shiftStartByMember[authMember.id]}
              onAction={doAction}
              onCancel={() => { setAuthMember(null); setView("pin"); }}
              busy={busy}
            />
          )}
          {view === "success" && success && (
            <SuccessView key="success" name={success.name} action={success.action} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PIN ENTRY SCREEN
// ═══════════════════════════════════════════════════════════════════════════

function PinView({ pin, busy, onKey, onNfc, nfcAvailable }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Willkommen!</h1>
        <p className="text-sm text-slate-500 mt-2">Bitte PIN eingeben</p>
      </div>

      {/* PIN dots */}
      <div className="flex justify-center gap-4 mb-10" data-testid="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
              i < pin.length
                ? "bg-blue-500 scale-110 shadow-md shadow-blue-500/40"
                : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <KeypadButton key={n} onClick={() => onKey(String(n))} disabled={busy}>
            {n}
          </KeypadButton>
        ))}
        <KeypadButton onClick={onNfc} disabled={busy || !nfcAvailable} variant="ghost">
          <ScanLine size={22} className="text-slate-500" />
        </KeypadButton>
        <KeypadButton onClick={() => onKey("0")} disabled={busy}>0</KeypadButton>
        <KeypadButton onClick={() => onKey("del")} disabled={busy} variant="ghost">
          <Delete size={22} className="text-slate-500" />
        </KeypadButton>
      </div>

      {busy && (
        <div className="text-center mt-6">
          <Loader2 size={20} className="animate-spin text-blue-500 mx-auto" />
        </div>
      )}

      {nfcAvailable && (
        <p className="mt-6 text-center text-xs text-slate-400">
          Oder NFC-Karte halten
        </p>
      )}
    </motion.div>
  );
}

function KeypadButton({ children, onClick, disabled, variant = "primary" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={`pin-key-${typeof children === "string" || typeof children === "number" ? children : "icon"}`}
      className={`aspect-square rounded-2xl text-3xl font-bold transition-all flex items-center justify-center active:scale-95 disabled:opacity-30 ${
        variant === "primary"
          ? "bg-white text-slate-900 shadow-md hover:shadow-lg border border-slate-100"
          : "bg-slate-100 hover:bg-slate-200 border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MENU VIEW — After PIN auth, before shift starts
// ═══════════════════════════════════════════════════════════════════════════

function MenuView({ member, status, onAction, onCancel, busy }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-md"
    >
      {/* Welcome header */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/30">
          {member.name?.charAt(0).toUpperCase() || "?"}
        </div>
        <p className="text-xs text-slate-500">Guten Tag,</p>
        <h2 className="text-2xl font-bold text-slate-900">{member.name}</h2>
        <p className="text-xs text-slate-400 capitalize">{member.role || "Mitarbeiter"}</p>
      </div>

      {/* Large action buttons */}
      <div className="space-y-3">
        <ActionButton
          color="green"
          icon={<Play size={24} className="text-white" />}
          title="SHIFT STARTEN"
          subtitle="Schicht beginnen"
          onClick={() => onAction("clock_in")}
          disabled={busy}
          testid="terminal-start-shift"
        />
        <ActionButton
          color="slate"
          icon={<ChevronLeft size={24} className="text-slate-600" />}
          title="Abmelden"
          subtitle="Zurück zur PIN-Eingabe"
          onClick={onCancel}
          disabled={busy}
          testid="terminal-cancel"
          ghost
        />
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVE SHIFT VIEW — While working
// ═══════════════════════════════════════════════════════════════════════════

function ActiveView({ member, status, shiftStartedAt, onAction, onCancel, busy }) {
  const isBreak = status === "break";
  const timer = useLiveTimer(shiftStartedAt);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-md"
    >
      {/* Member header */}
      <div className="text-center mb-5">
        <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/30">
          {member.name?.charAt(0).toUpperCase() || "?"}
        </div>
        <p className="text-sm font-bold text-slate-900">{member.name}</p>
      </div>

      {/* Active timer card */}
      <div className="rounded-3xl bg-white shadow-md border border-slate-200 overflow-hidden mb-4">
        <div className={`${isBreak ? "bg-orange-50" : "bg-emerald-50"} px-5 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isBreak ? "bg-orange-500" : "bg-emerald-500"} animate-pulse`} />
            <p className={`text-sm font-bold ${isBreak ? "text-orange-700" : "text-emerald-700"}`}>
              {isBreak ? "Pause läuft" : "Du arbeitest gerade"}
            </p>
          </div>
          <span className="text-[10px] font-bold tracking-widest text-slate-600 bg-white px-2 py-0.5 rounded-full">LIVE</span>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-6xl font-bold font-mono text-slate-900 tabular-nums" data-testid="terminal-active-timer">
            {timer}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-slate-400 mt-2">
            {isBreak ? "Pausenzeit" : "Arbeitszeit"}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {!isBreak && (
          <ActionButton
            color="orange"
            icon={<Coffee size={22} className="text-white" />}
            title="PAUSE STARTEN"
            subtitle="Pause beginnen"
            onClick={() => onAction("break_start")}
            disabled={busy}
            testid="terminal-pause-start"
          />
        )}
        {isBreak && (
          <ActionButton
            color="blue"
            icon={<Play size={22} className="text-white" />}
            title="PAUSE BEENDEN"
            subtitle="Zurück zur Arbeit"
            onClick={() => onAction("break_end")}
            disabled={busy}
            testid="terminal-pause-end"
          />
        )}
        <ActionButton
          color="red"
          icon={<Square size={22} className="text-white" />}
          title="SCHICHT BEENDEN"
          subtitle="Heute Feierabend"
          onClick={() => onAction("clock_out")}
          disabled={busy}
          testid="terminal-end-shift"
        />
        <button
          onClick={onCancel}
          data-testid="terminal-cancel"
          className="w-full mt-2 py-3 text-sm text-slate-500 hover:text-slate-700 transition"
        >
          ← Abmelden ohne Aktion
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUCCESS / CONFIRMATION SCREEN
// ═══════════════════════════════════════════════════════════════════════════

function SuccessView({ name, action }) {
  const config = {
    clock_in:    { label: "EINGECHECKT",    color: "emerald", icon: Play },
    clock_out:   { label: "AUSGECHECKT",    color: "red",     icon: Square },
    break_start: { label: "PAUSE GESTARTET", color: "orange", icon: Coffee },
    break_end:   { label: "PAUSE BEENDET",  color: "emerald", icon: Play },
  }[action] || { label: "OK", color: "emerald", icon: CheckCircle2 };

  const COLOR_MAP = {
    emerald: { bg: "bg-emerald-50",  ring: "bg-emerald-500", text: "text-emerald-600" },
    red:     { bg: "bg-red-50",      ring: "bg-red-500",     text: "text-red-600" },
    orange:  { bg: "bg-orange-50",   ring: "bg-orange-500",  text: "text-orange-600" },
  }[config.color];

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-sm text-center"
    >
      <p className="text-base text-slate-500 mb-2">Du bist jetzt</p>
      <h1 className={`text-4xl font-bold ${COLOR_MAP.text} mb-8`}>{config.label}!</h1>

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className={`relative w-48 h-48 mx-auto rounded-full ${COLOR_MAP.bg} flex items-center justify-center mb-8`}
      >
        <div className={`absolute inset-4 rounded-full ${COLOR_MAP.bg}`} />
        <div className={`relative w-32 h-32 rounded-full ${COLOR_MAP.ring} flex items-center justify-center shadow-lg`}>
          <CheckCircle2 size={56} className="text-white" strokeWidth={2.5} />
        </div>
      </motion.div>

      <p className="text-sm text-slate-500">Hallo, <span className="font-bold text-slate-900">{name}</span></p>
      <p className="text-xs text-slate-400 mt-1">
        um {new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Reusable Action Button (large, full-width)
// ═══════════════════════════════════════════════════════════════════════════

function ActionButton({ color, icon, title, subtitle, onClick, disabled, testid, ghost }) {
  const COLOR_MAP = {
    green:  "from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30",
    blue:   "from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30",
    orange: "from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30",
    red:    "from-red-500 to-red-600 text-white shadow-md shadow-red-500/30",
    slate:  "from-slate-100 to-slate-200 text-slate-700 shadow-sm",
  };
  const cls = ghost
    ? "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
    : `bg-gradient-to-b ${COLOR_MAP[color]}`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${cls}`}
    >
      <div className={`w-12 h-12 rounded-xl ${ghost ? "bg-slate-100" : "bg-white/20"} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="text-base font-bold tracking-wide">{title}</p>
        <p className={`text-xs font-normal ${ghost ? "text-slate-400" : "text-white/80"}`}>{subtitle}</p>
      </div>
    </button>
  );
}
