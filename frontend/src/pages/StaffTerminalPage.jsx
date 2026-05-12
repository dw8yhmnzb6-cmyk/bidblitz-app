/**
 * BidBlitz Staff — Terminal / Kiosk Mode
 * =======================================
 * Route: /staff/terminal
 * Geteiltes Tablet am Empfang — Mitarbeiter wählen Namen / PIN / scannen QR.
 * Großes Touch-UI, ultraschnelle Bedienung, Fullscreen "Kiosk-Feeling".
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Play, Square, Coffee, Wifi, ArrowLeft, X, Delete, ScanLine, Smartphone, CheckCircle2, LogIn, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import "../styles/staff-tokens.css";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffTerminalPage({ onBack }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinPad, setPinPad] = useState(null); // member object or null
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusByMember, setStatusByMember] = useState({});
  const [search, setSearch] = useState("");
  const [success, setSuccess] = useState(null); // {name, action}

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      // Terminal uses merchant session (browser logged in as merchant on shared tablet)
      const r = await fetch(`${API}/api/staff/members?limit=200`, { credentials: "include" });
      let list = [];
      if (r.ok) list = (await r.json()).members || [];
      setMembers(list.filter((m) => m.active !== false));
      // Today events to derive status
      const r3 = await fetch(`${API}/api/staff/clock/today`, { credentials: "include" });
      if (r3.ok) {
        const ev = (await r3.json()).events || [];
        const map = {};
        for (const e of ev) map[e.staff_id] = e.action;
        setStatusByMember(map);
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => {
    // Auto-refresh every 30s
    const id = setInterval(loadMembers, 30000);
    return () => clearInterval(id);
  }, [loadMembers]);

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter((m) => (m.name || "").toLowerCase().includes(q));
  }, [members, search]);

  const memberStatus = (m) => {
    const a = statusByMember[m.id];
    if (a === "clock_in" || a === "break_end") return "working";
    if (a === "break_start") return "break";
    return "off";
  };

  const doAction = async (member, action) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/staff/clock`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: member.id, action, source: "terminal" }),
      });
      if (!r.ok) throw new Error("fail");
      setSuccess({ name: member.name, action });
      setTimeout(() => setSuccess(null), 1800);
      setPinPad(null); setPin("");
      loadMembers();
    } catch (e) {
      toast.error("Buchung fehlgeschlagen");
    }
    setBusy(false);
  };

  const tryPinLogin = async (member) => {
    if (pin.length < 4) return toast.error("PIN min. 4 Ziffern");
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/staff/auth/login`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email, password: pin }),
      });
      if (!r.ok) throw new Error("fail");
      // Now do self-checkin (auto-toggle status)
      const status = memberStatus(member);
      const action = status === "off" ? "clock_in" : status === "working" ? "clock_out" : "break_end";
      const r2 = await fetch(`${API}/api/staff/clock/self`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, source: "terminal" }),
      });
      // Logout staff session after action so next person can use terminal
      try { await fetch(`${API}/api/staff/auth/logout`, { method: "POST", credentials: "include" }); } catch (e) {}
      if (!r2.ok) throw new Error("fail2");
      setSuccess({ name: member.name, action });
      setTimeout(() => setSuccess(null), 1800);
      setPinPad(null); setPin("");
      loadMembers();
    } catch (e) {
      toast.error("PIN falsch oder Fehler");
    }
    setBusy(false);
  };

  return (
    <div className="staff-app fixed inset-0 text-white overflow-hidden flex flex-col" data-testid="staff-terminal-page">
      {/* TOP BAR */}
      <header className="px-8 py-5 flex items-center justify-between border-b border-white/[0.06] bg-[var(--bb-bg-1)]/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold"
            style={{ background: "var(--bb-brand-grad)", boxShadow: "var(--bb-shadow-glow)" }}>
            BB
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-semibold">BidBlitz Staff Terminal</p>
            <p className="text-lg font-bold">Tippe deinen Namen, um ein- oder auszuchecken</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs flex items-center gap-2">
            <Wifi size={12} className="text-[var(--bb-success)]" />
            <span className="text-white/60">Live</span>
            <span className="tabular-nums text-white font-semibold">{new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {onBack && (
            <button onClick={onBack} data-testid="terminal-exit" className="p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
              <X size={18} className="text-white/60" />
            </button>
          )}
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] overflow-hidden">
        {/* Member grid */}
        <main className="overflow-y-auto p-8">
          <div className="mb-5 flex items-center gap-3">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mitarbeiter suchen…"
              data-testid="terminal-search"
              className="flex-1 h-14 px-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-base focus:border-[#00D4FF]/40 outline-none"
            />
            <span className="text-sm text-white/40 tabular-nums">{filtered.length}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#00D4FF]" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center text-center py-20" data-testid="terminal-empty">
              <div className="w-24 h-24 rounded-3xl bb-glass flex items-center justify-center mb-4">
                <ScanLine size={36} className="text-white/30" strokeWidth={1.6} />
              </div>
              <p className="text-base font-bold text-white/80">Keine Treffer</p>
              <p className="text-sm text-white/40 mt-1">Versuche einen anderen Namen oder QR-Scan rechts.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((m) => <MemberTile key={m.id} member={m} status={memberStatus(m)} onTap={() => setPinPad(m)} />)}
            </div>
          )}
        </main>

        {/* Right rail: QR + NFC */}
        <aside className="hidden lg:flex flex-col gap-4 p-8 border-l border-white/[0.06] bg-[var(--bb-bg-0)]/40">
          <div className="rounded-3xl p-6 bb-glass" data-testid="terminal-qr-zone">
            <div className="flex items-center gap-2 mb-3">
              <ScanLine size={16} className="text-[#00D4FF]" />
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-semibold">QR Code</p>
            </div>
            <p className="text-sm font-bold mb-2">Mit dem Handy einchecken</p>
            <p className="text-[12px] text-white/50 leading-relaxed mb-4">Scanne den QR-Code mit deinem BidBlitz Staff Account um sofort einzuchecken.</p>
            <div className="aspect-square rounded-2xl bg-white p-3 grid place-items-center">
              <div className="w-full h-full bg-[repeating-linear-gradient(45deg,_#000_0_8px,_#fff_8px_16px)] rounded-xl opacity-90" />
            </div>
          </div>
          <div className="rounded-3xl p-6 bb-glass" data-testid="terminal-nfc-zone">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone size={16} className="text-[#7E5BF6]" />
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-semibold">NFC Tag</p>
            </div>
            <p className="text-sm font-bold mb-1">Karte oder Handy auflegen</p>
            <p className="text-[12px] text-white/50 leading-relaxed">NFC-Stempelkarten werden hier erkannt (verfügbar in der nativen App).</p>
            <div className="mt-4 h-24 rounded-2xl flex items-center justify-center border border-dashed border-white/15">
              <Smartphone size={32} className="text-white/30" />
            </div>
          </div>
        </aside>
      </div>

      {/* PIN MODAL */}
      <AnimatePresence>
        {pinPad && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl grid place-items-center"
            data-testid="terminal-pin-modal"
            onClick={() => { setPinPad(null); setPin(""); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[440px] max-w-[92vw] rounded-[32px] p-8 bb-glass border-[var(--bb-border-strong)]"
            >
              <button onClick={() => { setPinPad(null); setPin(""); }} className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10">
                <X size={18} className="text-white/60" />
              </button>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-2xl font-bold mb-4"
                  style={{ background: "var(--bb-brand-grad)", boxShadow: "var(--bb-shadow-glow)" }}>
                  {pinPad.name?.[0]?.toUpperCase()}
                </div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-semibold">PIN eingeben</p>
                <p className="text-lg font-bold mt-1">{pinPad.name}</p>
                {/* PIN dots */}
                <div className="flex items-center justify-center gap-3 mt-5 h-8" data-testid="terminal-pin-dots">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span key={i}
                      className={`w-3 h-3 rounded-full transition-all ${i < pin.length ? "bg-[#00D4FF]" : "bg-white/15"}`}
                      style={i < pin.length ? { boxShadow: "0 0 12px rgba(0,212,255,0.6)" } : null}
                    />
                  ))}
                </div>
              </div>
              {/* Number pad */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPin((p) => (p.length < 6 ? p + n : p))}
                    data-testid={`terminal-pin-${n}`}
                    className="h-16 rounded-2xl bg-white/[0.05] hover:bg-white/[0.10] active:scale-95 text-2xl font-bold transition-all border border-white/[0.08]"
                  >{n}</button>
                ))}
                <button onClick={() => setPin("")} className="h-16 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] text-sm text-white/60 active:scale-95">Reset</button>
                <button
                  onClick={() => setPin((p) => (p.length < 6 ? p + "0" : p))}
                  data-testid="terminal-pin-0"
                  className="h-16 rounded-2xl bg-white/[0.05] hover:bg-white/[0.10] active:scale-95 text-2xl font-bold transition-all border border-white/[0.08]"
                >0</button>
                <button onClick={() => setPin((p) => p.slice(0, -1))} className="h-16 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] active:scale-95 flex items-center justify-center">
                  <Delete size={20} className="text-white/60" />
                </button>
              </div>
              <button
                onClick={() => tryPinLogin(pinPad)}
                disabled={busy || pin.length < 4}
                data-testid="terminal-pin-submit"
                className="mt-5 w-full h-14 rounded-2xl font-bold text-base disabled:opacity-50"
                style={{ background: "var(--bb-brand-grad)", boxShadow: "var(--bb-shadow-glow)" }}
              >
                {busy ? <Loader2 size={18} className="animate-spin mx-auto" /> : (() => {
                  const s = memberStatus(pinPad);
                  return s === "off" ? "Einchecken" : s === "working" ? "Auschecken" : "Pause beenden";
                })()}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUCCESS FLASH */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] grid place-items-center pointer-events-none"
            data-testid="terminal-success"
          >
            <div
              className="px-10 py-8 rounded-[32px] bb-glass flex flex-col items-center gap-3"
              style={{ boxShadow: "0 40px 100px -20px rgba(16,217,129,0.5)" }}
            >
              <div className="w-20 h-20 rounded-full grid place-items-center"
                style={{ background: "radial-gradient(circle, rgba(16,217,129,0.4), transparent 70%)" }}>
                <CheckCircle2 size={56} className="text-[var(--bb-success)]" />
              </div>
              <p className="text-2xl font-bold">{success.name}</p>
              <p className="text-sm text-white/60">
                {success.action === "clock_in" ? "Eingecheckt" :
                 success.action === "clock_out" ? "Ausgecheckt" :
                 success.action === "break_start" ? "Pause gestartet" : "Pause beendet"}
                {" "}· {new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberTile({ member, status, onTap }) {
  const colors = {
    working: { c: "var(--bb-success)", label: "Arbeitet", icon: LogOut },
    break:   { c: "var(--bb-warning)", label: "Pause",    icon: Coffee },
    off:     { c: "#71717A",           label: "Bereit",   icon: LogIn },
  }[status];
  const Icon = colors.icon;
  return (
    <motion.button
      onClick={onTap}
      data-testid={`terminal-member-${member.id}`}
      whileTap={{ scale: 0.96 }}
      className="relative aspect-square rounded-3xl p-4 flex flex-col items-center justify-center text-center group overflow-hidden"
      style={{
        background: status === "working"
          ? "linear-gradient(135deg, rgba(16,217,129,0.14) 0%, rgba(16,217,129,0.04) 100%)"
          : status === "break"
          ? "linear-gradient(135deg, rgba(245,165,36,0.14) 0%, rgba(245,165,36,0.04) 100%)"
          : "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
        border: `1px solid ${status === "working" ? "rgba(16,217,129,0.30)" : status === "break" ? "rgba(245,165,36,0.30)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: status === "working" ? "0 12px 30px -8px rgba(16,217,129,0.25)" : "0 4px 16px -4px rgba(0,0,0,0.4)",
      }}
    >
      <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
        style={{ background: `${colors.c}22`, color: colors.c }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.c }} /> {colors.label}
      </div>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-bold mb-2"
        style={{ background: "var(--bb-brand-grad)" }}>
        {member.name?.[0]?.toUpperCase()}
      </div>
      <p className="text-sm font-bold truncate w-full">{member.name}</p>
      <p className="text-[10px] text-white/40 truncate w-full">{member.staff_role || member.role || "Mitarbeiter"}</p>
      <div className="mt-2 w-8 h-8 rounded-xl grid place-items-center group-hover:scale-110 transition-transform"
        style={{ background: `${colors.c}22`, color: colors.c }}>
        <Icon size={14} strokeWidth={2.4} />
      </div>
    </motion.button>
  );
}
