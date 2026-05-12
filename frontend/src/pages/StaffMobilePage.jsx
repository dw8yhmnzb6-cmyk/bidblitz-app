/**
 * BidBlitz Staff — Mobile Shell (Tabs + Bottom Nav)
 * ==================================================
 * Route: /staff/mobile
 * 5 Tabs: Home / Shifts / Tasks / Wallet / Profile.
 * Premium Mobile-First Design (Connecteam/Revolut-Style).
 * Auth: staff_session cookie oder magic-link token (?token=...).
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, User, Wifi, WifiOff, Bell, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  sendClockEvent, getQueueLength, startOnlineSync,
} from "../utils/staffOfflineQueue";
import StaffBottomNav from "../components/staff/StaffBottomNav";
import StaffNotificationCenter from "../components/staff/StaffNotificationCenter";
import StaffHome from "./staff/StaffHome";
import StaffShifts from "./staff/StaffShifts";
import StaffTasks from "./staff/StaffTasks";
import StaffWalletTab from "./staff/StaffWalletTab";
import StaffProfile from "./staff/StaffProfile";
import "../styles/staff-tokens.css";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffMobilePage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [acting, setActing] = useState(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [tab, setTab] = useState("home");
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [attachmentDraft, setAttachmentDraft] = useState({ customer: "", project: "", equipment: "", kilometers: "", note: "" });

  const reload = useCallback(async () => {
    try {
      const [p, d, n, t, w, wk] = await Promise.all([
        fetch(`${API}/api/staff/me/profile`, { credentials: "include" }),
        fetch(`${API}/api/staff/me/dashboard`, { credentials: "include" }),
        fetch(`${API}/api/staff/notifications/list?only_unread=true&limit=1`, { credentials: "include" }).catch(() => null),
        fetch(`${API}/api/staff/tasks/me?status=open`, { credentials: "include" }).catch(() => null),
        fetch(`${API}/api/staff/wallet/me/balance`, { credentials: "include" }).catch(() => null),
        fetch(`${API}/api/staff/timesheet/me/weekly`, { credentials: "include" }).catch(() => null),
      ]);
      if (p && p.ok) setStaff((await p.json()).profile); else setStaff(null);
      if (d && d.ok) setDashboard(await d.json());
      if (n && n.ok) { setUnreadNotif((await n.json()).unread_count || 0); }
      if (t && t.ok) { setOpenTasksCount((await t.json()).count || 0); }
      if (w && w.ok) { setWalletBalance((await w.json()).balance_eur || 0); }
      if (wk && wk.ok) { setOvertimeHours((await wk.json()).totals?.overtime_hours || 0); }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    (async () => {
      if (token) {
        try {
          const r = await fetch(`${API}/api/staff/auth/verify-token?token=${encodeURIComponent(token)}`, { credentials: "include" });
          if (r.ok) {
            toast.success("Erfolgreich angemeldet");
            url.searchParams.delete("token");
            window.history.replaceState({}, "", url.toString());
          } else toast.error("Magic Link ungültig oder abgelaufen");
        } catch (e) { toast.error("Login fehlgeschlagen"); }
      }
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const stop = startOnlineSync((r) => {
      if (r?.synced > 0) { toast.success(`${r.synced} Buchungen synchronisiert`); reload(); }
      setQueuedCount(getQueueLength());
    });
    setQueuedCount(getQueueLength());
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stop();
    };
  }, [reload]);

  const doClock = async (action, attachments = null) => {
    if (!staff) return toast.error("Bitte zuerst anmelden");
    setActing(action);
    // Optimistic status update for instant UI feedback
    const optimisticStatus =
      action === "clock_in" ? "working" :
      action === "clock_out" ? "off" :
      action === "break_start" ? "break" :
      action === "break_end" ? "working" : dashboard?.status;
    setDashboard((d) => d ? { ...d, status: optimisticStatus, current_session_started: action === "clock_in" ? new Date().toISOString() : d.current_session_started } : d);

    // Try geolocation (best effort)
    let lat = null, lng = null;
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 }));
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch (e) {}

    const payload = { staff_id: staff.id, action, lat, lng, source: "self_service" };
    if (attachments) {
      if (attachments.customer) payload.customer = attachments.customer;
      if (attachments.project) payload.project = attachments.project;
      if (attachments.equipment) payload.equipment = attachments.equipment;
      if (attachments.kilometers !== "" && attachments.kilometers != null) {
        const km = parseFloat(attachments.kilometers);
        if (!Number.isNaN(km)) payload.kilometers = km;
      }
      if (attachments.note) payload.note = attachments.note;
    }
    const res = await sendClockEvent(payload);
    if (res.queued) {
      toast.message("Offline gespeichert", { description: "Wird synchronisiert sobald online." });
      setQueuedCount(getQueueLength());
    } else {
      const labels = {
        clock_in: "Schicht gestartet ✓", clock_out: "Schicht beendet ✓",
        break_start: "Pause gestartet ✓", break_end: "Pause beendet ✓",
      };
      toast.success(labels[action] || "Buchung gespeichert");
    }
    await reload();
    setActing(null);
  };

  const submitAttachmentCheckin = async () => {
    const st = dashboard?.status || "off";
    const action = st === "off" ? "clock_in" : st === "working" ? "clock_out" : "break_end";
    setShowAttachmentSheet(false);
    await doClock(action, attachmentDraft);
    setAttachmentDraft({ customer: "", project: "", equipment: "", kilometers: "", note: "" });
  };

  const openAttachmentSheet = () => setShowAttachmentSheet(true);

  if (loading) {
    return (
      <div className="staff-app min-h-screen flex items-center justify-center" data-testid="staff-mobile-loading">
        <Loader2 size={28} className="animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  if (!staff) {
    return <StaffMobileLogin onSuccess={reload} onBack={onBack} />;
  }

  const status = dashboard?.status || "off";
  const primaryLabel = status === "off" ? "Schicht starten" : status === "working" ? "Schicht beenden" : "Pause beenden";
  const hour = new Date().getHours();
  const greeting = hour < 6 ? "Gute Nacht" : hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";

  return (
    <div className="staff-app min-h-screen text-white pb-28" data-testid="staff-mobile-page">
      {/* Premium Top Bar */}
      <div className="sticky top-0 z-30 bb-safe-top backdrop-blur-2xl bg-[var(--bb-bg-1)]/80 border-b border-[var(--bb-border)]">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold"
                style={{ background: "var(--bb-brand-grad)", boxShadow: "var(--bb-shadow-glow)" }}
              >
                {staff.name?.slice(0, 1)?.toUpperCase()}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bb-bg-1)]"
                style={{ background: status === "working" ? "var(--bb-success)" : status === "break" ? "var(--bb-warning)" : "var(--bb-neutral)" }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-white/40">{greeting}</p>
              <p className="text-sm font-semibold leading-tight truncate">{staff.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {online ? <Wifi size={14} className="text-[var(--bb-success)]" /> : <WifiOff size={14} className="text-[var(--bb-warning)]" data-testid="staff-offline-indicator" />}
            {queuedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--bb-warning)]/20 text-[var(--bb-warning)] text-[10px] font-bold" data-testid="staff-queue-count">
                {queuedCount}
              </span>
            )}
            <button
              onClick={() => setShowNotifications(true)}
              data-testid="staff-mobile-notif-btn"
              className="relative p-2 rounded-xl hover:bg-white/[0.06] transition-colors active:scale-90"
            >
              <Bell size={16} className="text-white/70" />
              {unreadNotif > 0 && (
                <span data-testid="staff-mobile-notif-badge" className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--bb-danger)] text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadNotif > 9 ? "9+" : unreadNotif}
                </span>
              )}
            </button>
            {onBack && (
              <button onClick={onBack} data-testid="staff-mobile-exit" className="p-2 rounded-xl hover:bg-white/[0.06] active:scale-90 transition-all">
                <ArrowLeft size={16} className="text-white/50" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "home" && (
              <StaffHome
                staff={staff}
                dashboard={dashboard}
                status={status}
                acting={acting}
                onClock={doClock}
                onOpenAttachments={openAttachmentSheet}
                openTasksCount={openTasksCount}
                walletBalance={walletBalance}
                overtimeHours={overtimeHours}
              />
            )}
            {tab === "shifts" && <StaffShifts />}
            {tab === "tasks" && <StaffTasks />}
            {tab === "wallet" && <StaffWalletTab />}
            {tab === "profile" && <StaffProfile staff={staff} onLoggedOut={() => setStaff(null)} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Nav */}
      <StaffBottomNav tab={tab} onTab={setTab} taskBadge={openTasksCount} />

      {/* Notification Center */}
      <StaffNotificationCenter
        open={showNotifications}
        onClose={() => { setShowNotifications(false); reload(); }}
      />

      {/* Attachment Sheet */}
      <AnimatePresence>
        {showAttachmentSheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShowAttachmentSheet(false)}
            data-testid="staff-attachment-sheet"
          >
            <motion.div
              initial={{ y: 240 }} animate={{ y: 0 }} exit={{ y: 240 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-white/15 rounded-full mx-auto" />
              <div className="text-center pb-2">
                <p className="text-[10px] uppercase tracking-widest text-white/40">Buchung mit Details</p>
                <p className="text-lg font-bold">{primaryLabel}</p>
              </div>
              <Field label="Kunde" value={attachmentDraft.customer} setValue={(v) => setAttachmentDraft((d) => ({ ...d, customer: v }))} placeholder="z.B. Müller GmbH" testId="staff-attachment-customer" />
              <Field label="Projekt / Auftrag" value={attachmentDraft.project} setValue={(v) => setAttachmentDraft((d) => ({ ...d, project: v }))} placeholder="z.B. Büroumzug" testId="staff-attachment-project" />
              <Field label="Gerät / Equipment" value={attachmentDraft.equipment} setValue={(v) => setAttachmentDraft((d) => ({ ...d, equipment: v }))} placeholder="z.B. Sprinter L3H2" testId="staff-attachment-equipment" />
              <Field label="Kilometer" value={attachmentDraft.kilometers} setValue={(v) => setAttachmentDraft((d) => ({ ...d, kilometers: v }))} placeholder="42.5" type="number" testId="staff-attachment-kilometers" />
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">Notiz</label>
                <textarea
                  rows={3} value={attachmentDraft.note}
                  onChange={(e) => setAttachmentDraft((d) => ({ ...d, note: e.target.value }))}
                  placeholder="optional"
                  data-testid="staff-attachment-note"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm resize-none focus:border-[#00D4FF]/40 outline-none"
                />
              </div>
              <button
                onClick={submitAttachmentCheckin}
                disabled={acting !== null}
                data-testid="staff-attachment-submit"
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)" }}
              >
                {acting ? <Loader2 size={16} className="animate-spin mx-auto" /> : `${primaryLabel} speichern`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value, setValue, placeholder, type = "text", testId }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">{label}</label>
      <input
        type={type} inputMode={type === "number" ? "decimal" : undefined}
        value={value} onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder} data-testid={testId}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm focus:border-[#00D4FF]/40 outline-none transition-colors"
      />
    </div>
  );
}

function StaffMobileLogin({ onSuccess, onBack }) {
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [sending, setSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicUrl, setMagicUrl] = useState("");

  const sendMagic = async () => {
    if (!identifier) return toast.error("E-Mail oder Telefon eingeben");
    setSending(true);
    const isEmail = identifier.includes("@");
    const res = await fetch(`${API}/api/staff/auth/magic-link`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEmail ? { email: identifier } : { phone: identifier }),
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      setMagicSent(true);
      if (data.magic_url) setMagicUrl(data.magic_url);
      toast.success("Magic Link versandt");
    } else toast.error("Fehler beim Versand");
  };

  const pinLogin = async () => {
    if (!identifier || !pin) return toast.error("Bitte alle Felder ausfüllen");
    const res = await fetch(`${API}/api/staff/auth/login`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: identifier, password: pin }),
    });
    if (res.ok) { toast.success("Erfolgreich angemeldet"); onSuccess(); }
    else toast.error("Login fehlgeschlagen");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white px-5 pt-12 pb-8" data-testid="staff-mobile-login">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)" }}
          >
            <User size={28} />
          </div>
          <h1 className="text-2xl font-bold mb-1 font-outfit">BidBlitz Staff</h1>
          <p className="text-xs text-white/50">Mitarbeiter-Login</p>
        </div>

        <input
          type="text" placeholder="E-Mail oder Telefon"
          value={identifier} onChange={(e) => setIdentifier(e.target.value)}
          data-testid="staff-mobile-identifier-input"
          className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.05] border border-white/10 text-sm mb-3 focus:border-[#00D4FF]/40 outline-none"
        />

        {!showPin ? (
          <>
            <button
              onClick={sendMagic} disabled={sending || magicSent}
              data-testid="staff-magic-link-btn"
              className="w-full py-3.5 rounded-2xl font-semibold text-sm mb-3"
              style={{ background: "linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)" }}
            >
              {sending ? <Loader2 size={16} className="animate-spin mx-auto" /> : magicSent ? "Link gesendet ✓" : "Magic Link senden"}
            </button>
            {magicUrl && (
              <a href={magicUrl} data-testid="staff-magic-url-dev" className="block text-[10px] text-[#00D4FF] underline truncate mb-3">{magicUrl}</a>
            )}
            <button onClick={() => setShowPin(true)} data-testid="staff-mobile-pin-toggle" className="w-full py-2 text-xs text-white/60 hover:text-white">
              Stattdessen mit PIN anmelden
            </button>
          </>
        ) : (
          <>
            <input
              type="password" inputMode="numeric" placeholder="PIN"
              value={pin} onChange={(e) => setPin(e.target.value)}
              data-testid="staff-mobile-pin-input"
              className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.05] border border-white/10 text-sm mb-3 focus:border-[#00D4FF]/40 outline-none"
            />
            <button onClick={pinLogin} data-testid="staff-mobile-pin-login-btn" className="w-full py-3.5 rounded-2xl bg-[#00D4FF] text-black font-semibold text-sm mb-3">
              Anmelden
            </button>
            <button onClick={() => setShowPin(false)} className="w-full py-2 text-xs text-white/60">Zurück zu Magic Link</button>
          </>
        )}

        {onBack && (
          <button onClick={onBack} className="w-full mt-6 py-2 text-[11px] text-white/40">Zurück zur App</button>
        )}
      </div>
    </div>
  );
}
