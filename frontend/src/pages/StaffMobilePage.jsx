/**
 * BidBlitz Staff — Employee Mobile App Experience
 * ================================================
 * Route: /staff/mobile
 * Mobile-first: Check-in, Check-out, Pause, heutige Stunden,
 * Wochenstunden, nächste Schicht, Resturlaub.
 *
 * Supports magic-link token (?token=...) and existing staff_session cookie.
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogIn, LogOut, Coffee, Play, Clock, Calendar, UmbrellaIcon,
  Wifi, WifiOff, User, Settings, Loader2, AlertTriangle, Bell,
  ChevronRight, Globe, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  sendClockEvent, getQueueLength, flushQueue, startOnlineSync, getDeviceInfo,
} from "../utils/staffOfflineQueue";
import { t, getStaffLang, setStaffLang, STAFF_LANGUAGES } from "../i18n/staff";
import StaffNotificationCenter from "../components/staff/StaffNotificationCenter";
import StaffWeeklyTimesheet from "../components/staff/StaffWeeklyTimesheet";

function WalletBalanceCard() {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    fetch(`${API}/api/staff/wallet/me/balance`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {});
  }, []);
  if (!data) return null;
  return (
    <div
      data-testid="staff-wallet-balance-card"
      className="p-4 rounded-2xl bg-gradient-to-br from-[#10B981]/15 to-transparent border border-[#10B981]/30 flex items-center gap-3"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#10B981]/20 text-[#10B981]">
        <span className="text-lg">€</span>
      </div>
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-widest text-white/40">Wallet (Bonus + Trinkgeld)</p>
        <p className="text-base font-bold">€{(data.balance_eur ?? 0).toFixed(2)}</p>
        <p className="text-[10px] text-white/50">{data.events?.length || 0} Buchung(en)</p>
      </div>
    </div>
  );
}

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffMobilePage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [acting, setActing] = useState(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lang, setLang] = useState(getStaffLang());
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [attachmentDraft, setAttachmentDraft] = useState({ customer: "", project: "", equipment: "", kilometers: "", note: "" });

  const reload = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([
        fetch(`${API}/api/staff/me/profile`, { credentials: "include" }),
        fetch(`${API}/api/staff/me/dashboard`, { credentials: "include" }),
      ]);
      if (p.ok) {
        const pj = await p.json();
        setStaff(pj.profile);
      } else {
        setStaff(null);
      }
      if (d.ok) {
        const dj = await d.json();
        setDashboard(dj);
      }
      // Notifications count
      try {
        const nr = await fetch(`${API}/api/staff/notifications/list?only_unread=true&limit=1`, { credentials: "include" });
        if (nr.ok) {
          const nj = await nr.json();
          setUnreadNotif(nj.unread_count || 0);
        }
      } catch (e) {}
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Magic-link token handling
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    (async () => {
      if (token) {
        try {
          const r = await fetch(`${API}/api/staff/auth/verify-token?token=${encodeURIComponent(token)}`, {
            credentials: "include",
          });
          if (r.ok) {
            toast.success("Erfolgreich angemeldet");
            url.searchParams.delete("token");
            window.history.replaceState({}, "", url.toString());
          } else {
            toast.error("Magic Link ungültig oder abgelaufen");
          }
        } catch (e) {
          toast.error("Login fehlgeschlagen");
        }
      }
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  // Online/offline + queue sync
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const stop = startOnlineSync((r) => {
      if (r?.synced > 0) {
        toast.success(`${r.synced} Buchungen synchronisiert`);
        reload();
      }
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
    if (!staff) {
      toast.error("Bitte zuerst anmelden");
      return;
    }
    setActing(action);
    // Try to get location (best effort)
    let lat = null, lng = null;
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {}
    const payload = {
      staff_id: staff.id,
      action,
      lat,
      lng,
      source: "self_service",
    };
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
      toast.message(t("saved_offline"), { description: t("offline_notice") });
      setQueuedCount(getQueueLength());
    } else {
      toast.success(
        action === "clock_in" ? "Eingecheckt" :
        action === "clock_out" ? "Ausgecheckt" :
        action === "break_start" ? "Pause gestartet" : "Pause beendet"
      );
    }
    await reload();
    setActing(null);
  };

  const submitAttachmentCheckin = async () => {
    await doClock(primaryAction, attachmentDraft);
    setShowAttachmentSheet(false);
    setAttachmentDraft({ customer: "", project: "", equipment: "", kilometers: "", note: "" });
  };

  const handleLangChange = (code) => {
    setStaffLang(code);
    setLang(code);
    setShowSettings(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  // Not authenticated → show login screen
  if (!staff) {
    return <StaffMobileLogin onSuccess={reload} onBack={onBack} />;
  }

  const status = dashboard?.status || "off";
  const statusLabel = status === "working" ? t("status_working", lang) : status === "break" ? t("status_break", lang) : t("status_off", lang);
  const statusColor = status === "working" ? "#10B981" : status === "break" ? "#F59E0B" : "#6B7280";
  // Quick-Action: primary action based on current status
  const primaryAction = status === "off" ? "clock_in" : status === "working" ? "clock_out" : "break_end";
  const primaryLabel = status === "off" ? t("check_in", lang) : status === "working" ? t("check_out", lang) : t("end_break", lang);
  const primaryColor = status === "off" ? "#10B981" : status === "working" ? "#EF4444" : "#10B981";
  const primaryIcon = status === "off" ? LogIn : status === "working" ? LogOut : Play;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-32" data-testid="staff-mobile-page">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#A855F7] flex items-center justify-center text-sm font-bold">
              {staff.name?.slice(0, 1)?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{staff.name}</p>
              <p className="text-[10px] text-white/40">{staff.email || staff.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {online ? (
              <Wifi size={14} className="text-green-400" />
            ) : (
              <WifiOff size={14} className="text-orange-400" data-testid="staff-offline-indicator" />
            )}
            {queuedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold" data-testid="staff-queue-count">
                {queuedCount}
              </span>
            )}
            <button
              onClick={() => setShowNotifications(true)}
              data-testid="staff-mobile-notif-btn"
              className="relative p-2 rounded-lg hover:bg-white/5"
            >
              <Bell size={16} className="text-white/70" />
              {unreadNotif > 0 && (
                <span
                  data-testid="staff-mobile-notif-badge"
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center"
                >
                  {unreadNotif > 9 ? "9+" : unreadNotif}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              data-testid="staff-mobile-settings-btn"
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <Settings size={16} className="text-white/60" />
            </button>
          </div>
        </div>
      </div>

      {/* Status hero - Tap zum Schnell-Check-in */}
      <section className="px-4 pt-6 pb-4">
        <motion.button
          onClick={() => doClock(primaryAction)}
          disabled={acting !== null}
          data-testid="staff-quick-action-btn"
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-left rounded-3xl p-5 bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 disabled:opacity-70"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/50">{t("today", lang)}</p>
              <p className="text-2xl font-bold mt-1" data-testid="staff-status-label">
                {statusLabel}
              </p>
              <p className="text-[11px] text-white/50 mt-1">
                Antippen: <span style={{ color: primaryColor }} className="font-semibold">{primaryLabel}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ background: statusColor, boxShadow: `0 0 18px ${statusColor}` }}
                data-testid="staff-status-dot"
              />
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `${primaryColor}22`, color: primaryColor }}
              >
                {acting === primaryAction ? <Loader2 size={20} className="animate-spin" /> :
                  React.createElement(primaryIcon, { size: 20 })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock size={12} className="text-[#00C2FF]" />
                <p className="text-[10px] text-white/50">{t("today_hours", lang)}</p>
              </div>
              <p className="text-xl font-bold" data-testid="staff-today-hours">{dashboard?.today_hours ?? 0}h</p>
            </div>
            <div className="rounded-2xl bg-black/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={12} className="text-[#A855F7]" />
                <p className="text-[10px] text-white/50">{t("week_hours", lang)}</p>
              </div>
              <p className="text-xl font-bold" data-testid="staff-week-hours">{dashboard?.week_hours ?? 0}h</p>
            </div>
          </div>
        </motion.button>
      </section>

      {/* Big action buttons */}
      <section className="px-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          {status === "off" && (
            <BigBtn
              testId="staff-clock-in-btn"
              icon={LogIn}
              label={t("check_in", lang)}
              color="#10B981"
              loading={acting === "clock_in"}
              onClick={() => doClock("clock_in")}
            />
          )}
          {(status === "working" || status === "break") && (
            <BigBtn
              testId="staff-clock-out-btn"
              icon={LogOut}
              label={t("check_out", lang)}
              color="#EF4444"
              loading={acting === "clock_out"}
              onClick={() => doClock("clock_out")}
            />
          )}
          {status === "working" && (
            <BigBtn
              testId="staff-break-start-btn"
              icon={Coffee}
              label={t("start_break", lang)}
              color="#F59E0B"
              loading={acting === "break_start"}
              onClick={() => doClock("break_start")}
            />
          )}
          {status === "break" && (
            <BigBtn
              testId="staff-break-end-btn"
              icon={Play}
              label={t("end_break", lang)}
              color="#10B981"
              loading={acting === "break_end"}
              onClick={() => doClock("break_end")}
            />
          )}
          {status === "off" && (
            <BigBtn
              testId="staff-refresh-btn"
              icon={RefreshCw}
              label="Aktualisieren"
              color="#6B7280"
              onClick={reload}
            />
          )}
        </div>
      </section>

      {/* Info cards */}
      <section className="px-4 py-4 space-y-3">
        <InfoCard
          icon={Calendar}
          color="#A855F7"
          label={t("next_shift", lang)}
          value={dashboard?.next_shift?.title || "—"}
          sub={dashboard?.next_shift?.start_time ? new Date(dashboard.next_shift.start_time).toLocaleString() : "Keine geplant"}
          testId="staff-next-shift-card"
        />
        <InfoCard
          icon={UmbrellaIcon}
          color="#00C2FF"
          label={t("vacation_remaining", lang)}
          value={`${dashboard?.vacation_remaining ?? 0} / ${dashboard?.vacation_total ?? 0} Tage`}
          sub="Restlicher Jahresurlaub"
          testId="staff-vacation-card"
        />
        <WalletBalanceCard />
      </section>

      {/* Optional Attachments Button */}
      <section className="px-4 pb-3">
        <button
          onClick={() => setShowAttachmentSheet(true)}
          disabled={acting !== null}
          data-testid="staff-attachment-checkin-btn"
          className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/70 hover:bg-white/[0.07]"
        >
          + {primaryLabel} mit Notiz / Kunde / KM
        </button>
      </section>

      {/* Weekly Timesheet (Connecteam-Style) */}
      <section className="px-4 pb-4">
        <StaffWeeklyTimesheet />
      </section>

      {/* Settings sheet */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 space-y-3"
              data-testid="staff-settings-sheet"
            >
              <p className="text-xs uppercase tracking-widest text-white/40 mb-2 flex items-center gap-2">
                <Globe size={12} /> {t("language", lang)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {STAFF_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => handleLangChange(l.code)}
                    data-testid={`staff-lang-${l.code}`}
                    className={`px-3 py-2.5 rounded-xl border text-sm flex items-center gap-2 transition-colors ${
                      lang === l.code
                        ? "bg-[#00C2FF]/10 border-[#00C2FF]/40 text-white"
                        : "bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/5"
                    }`}
                  >
                    <span>{l.flag}</span>
                    {l.label}
                  </button>
                ))}
              </div>

              <button
                onClick={async () => {
                  await fetch(`${API}/api/staff/auth/logout`, { method: "POST", credentials: "include" });
                  setShowSettings(false);
                  setStaff(null);
                }}
                data-testid="staff-mobile-logout-btn"
                className="w-full mt-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold text-sm"
              >
                {t("logout", lang)}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <StaffNotificationCenter
        open={showNotifications}
        onClose={() => { setShowNotifications(false); reload(); }}
      />

      {/* Attachment Check-in Sheet */}
      <AnimatePresence>
        {showAttachmentSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShowAttachmentSheet(false)}
            data-testid="staff-attachment-sheet"
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Buchung mit Details</p>
                  <p className="text-lg font-bold">{primaryLabel}</p>
                </div>
                <button onClick={() => setShowAttachmentSheet(false)} className="p-2 rounded-lg hover:bg-white/5">
                  <span className="text-white/60">✕</span>
                </button>
              </div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40">Kunde</label>
              <input
                value={attachmentDraft.customer}
                onChange={(e) => setAttachmentDraft((d) => ({ ...d, customer: e.target.value }))}
                placeholder="z.B. Müller GmbH"
                data-testid="staff-attachment-customer"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm"
              />
              <label className="block text-[10px] uppercase tracking-widest text-white/40">Projekt / Auftrag</label>
              <input
                value={attachmentDraft.project}
                onChange={(e) => setAttachmentDraft((d) => ({ ...d, project: e.target.value }))}
                placeholder="z.B. Büroumzug"
                data-testid="staff-attachment-project"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm"
              />
              <label className="block text-[10px] uppercase tracking-widest text-white/40">Gerät / Equipment</label>
              <input
                value={attachmentDraft.equipment}
                onChange={(e) => setAttachmentDraft((d) => ({ ...d, equipment: e.target.value }))}
                placeholder="z.B. Sprinter L3H2"
                data-testid="staff-attachment-equipment"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm"
              />
              <label className="block text-[10px] uppercase tracking-widest text-white/40">Kilometer</label>
              <input
                type="number"
                inputMode="decimal"
                value={attachmentDraft.kilometers}
                onChange={(e) => setAttachmentDraft((d) => ({ ...d, kilometers: e.target.value }))}
                placeholder="z.B. 42.5"
                data-testid="staff-attachment-kilometers"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm"
              />
              <label className="block text-[10px] uppercase tracking-widest text-white/40">Notiz</label>
              <textarea
                rows={3}
                value={attachmentDraft.note}
                onChange={(e) => setAttachmentDraft((d) => ({ ...d, note: e.target.value }))}
                placeholder="optional"
                data-testid="staff-attachment-note"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm resize-none"
              />
              <button
                onClick={submitAttachmentCheckin}
                disabled={acting !== null}
                data-testid="staff-attachment-submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white font-semibold text-sm disabled:opacity-60"
              >
                {acting ? <Loader2 size={16} className="animate-spin mx-auto" /> : `${primaryLabel} jetzt speichern`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BigBtn({ icon: Icon, label, color, onClick, loading, testId }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      data-testid={testId}
      className="aspect-square rounded-3xl bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center gap-3 transition-all hover:bg-white/[0.07] active:scale-95 disabled:opacity-60"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: `${color}22`, color }}
      >
        {loading ? <Loader2 size={26} className="animate-spin" /> : <Icon size={26} />}
      </div>
      <p className="text-sm font-semibold">{label}</p>
    </button>
  );
}

function InfoCard({ icon: Icon, color, label, value, sub, testId }) {
  return (
    <div
      data-testid={testId}
      className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}22`, color }}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
        <p className="text-base font-bold truncate">{value}</p>
        {sub && <p className="text-[10px] text-white/50 truncate">{sub}</p>}
      </div>
      <ChevronRight size={16} className="text-white/30" />
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEmail ? { email: identifier } : { phone: identifier }),
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      setMagicSent(true);
      // Dev mode: show URL
      if (data.magic_url) setMagicUrl(data.magic_url);
      toast.success("Magic Link versandt");
    } else {
      toast.error("Fehler beim Versand");
    }
  };

  const pinLogin = async () => {
    if (!identifier || !pin) return toast.error("Bitte alle Felder ausfüllen");
    const res = await fetch(`${API}/api/staff/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: identifier, password: pin }),
    });
    if (res.ok) {
      toast.success("Erfolgreich angemeldet");
      onSuccess();
    } else {
      toast.error("Login fehlgeschlagen");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white px-4 pt-12 pb-8" data-testid="staff-mobile-login">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#00C2FF] to-[#A855F7] flex items-center justify-center mb-4">
            <User size={28} />
          </div>
          <h1 className="text-2xl font-bold mb-1">BidBlitz Staff</h1>
          <p className="text-xs text-white/50">Mitarbeiter-Login</p>
        </div>

        <input
          type="text"
          placeholder="E-Mail oder Telefon"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          data-testid="staff-mobile-identifier-input"
          className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm mb-3"
        />

        {!showPin ? (
          <>
            <button
              onClick={sendMagic}
              disabled={sending || magicSent}
              data-testid="staff-magic-link-btn"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#A855F7] font-semibold text-sm mb-3"
            >
              {sending ? <Loader2 size={16} className="animate-spin mx-auto" /> : magicSent ? "Link gesendet ✓" : "Magic Link senden"}
            </button>
            {magicUrl && (
              <a
                href={magicUrl}
                data-testid="staff-magic-url-dev"
                className="block text-[10px] text-[#00C2FF] underline truncate mb-3"
              >
                {magicUrl}
              </a>
            )}
            <button
              onClick={() => setShowPin(true)}
              data-testid="staff-mobile-pin-toggle"
              className="w-full py-2 text-xs text-white/60 hover:text-white"
            >
              Stattdessen mit PIN anmelden
            </button>
          </>
        ) : (
          <>
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              data-testid="staff-mobile-pin-input"
              className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm mb-3"
            />
            <button
              onClick={pinLogin}
              data-testid="staff-mobile-pin-login-btn"
              className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-semibold text-sm mb-3"
            >
              Anmelden
            </button>
            <button
              onClick={() => setShowPin(false)}
              className="w-full py-2 text-xs text-white/60"
            >
              Zurück zu Magic Link
            </button>
          </>
        )}

        <button
          onClick={onBack}
          className="w-full mt-6 py-2 text-[11px] text-white/40"
        >
          Zurück zur App
        </button>
      </div>
    </div>
  );
}
