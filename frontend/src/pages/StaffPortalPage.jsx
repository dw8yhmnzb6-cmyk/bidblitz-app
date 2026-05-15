/**
 * Staff Self-Service Portal — NEW DESIGN (iter111)
 * ================================================
 * Mobile-optimiertes Mitarbeiter-Portal nach Referenz-Design des Users.
 * Light Theme, große Action-Cards, Live-Timer, Bottom-Tab-Navigation.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Bell, Play, Square, Coffee, Pause, MapPin, Clock, Calendar,
  CheckCircle2, Loader2, LogOut, User, ChevronRight, ListTodo, Settings,
  AlertCircle, Plus, FileText, Briefcase, BellRing,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

// ═══════════════════════════════════════════════════════════════════════════
// Live Timer Hook
// ═══════════════════════════════════════════════════════════════════════════

function useLiveTimer(startedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return { h: 0, m: 0, s: 0, total_seconds: 0, hms: "00:00:00" };
  const start = new Date(startedAt).getTime();
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return { h, m, s, total_seconds: elapsed, hms };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

export default function StaffPortalPage({ onBack }) {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [weekReport, setWeekReport] = useState(null);
  const [myShifts, setMyShifts] = useState([]);
  const [myLeave, setMyLeave] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/staff/auth/me`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setStaff(data.staff);
        } else {
          toast.error("Bitte einloggen");
          onBack();
          return;
        }
      } catch {
        toast.error("Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    })();
  }, [onBack]);

  const loadData = async () => {
    try {
      const [rRes, lRes, sRes] = await Promise.all([
        fetch(`${API}/api/staff/reports/hours/self`, { credentials: "include" }),
        fetch(`${API}/api/staff/leave/self`, { credentials: "include" }),
        fetch(`${API}/api/staff/shifts/self`, { credentials: "include" }),
      ]);
      if (rRes.ok) {
        const d = await rRes.json();
        setWeekReport(d);
        const events = d.events || [];
        setLastEvent(events.length ? events[events.length - 1] : null);
      }
      if (lRes.ok) setMyLeave((await lRes.json()).requests || []);
      if (sRes.ok) setMyShifts((await sRes.json()).shifts || []);
    } catch {}
  };

  useEffect(() => { if (staff) loadData(); }, [staff]);

  const status = useMemo(() => {
    if (!lastEvent) return "off";
    if (lastEvent.action === "clock_in" || lastEvent.action === "break_end") return "working";
    if (lastEvent.action === "break_start") return "break";
    return "off";
  }, [lastEvent]);

  const shiftStartedAt = useMemo(() => {
    // find most recent clock_in or break_end timestamp
    const events = weekReport?.events || [];
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.action === "clock_in" || e.action === "break_end") return e.timestamp;
      if (e.action === "clock_out") return null;
    }
    return null;
  }, [weekReport]);

  const handleClockAction = async (action) => {
    setActionLoading(true);
    try {
      let lat = null, lng = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          lat = pos.coords.latitude; lng = pos.coords.longitude;
        } catch {}
      }
      const res = await fetch(
        `${API}/api/staff/clock/self?action=${action}&lat=${lat}&lng=${lng}`,
        { method: "POST", credentials: "include" }
      );
      if (res.ok) {
        const labels = { clock_in: "Eingecheckt", clock_out: "Ausgecheckt", break_start: "Pause gestartet", break_end: "Pause beendet" };
        toast.success(labels[action] || "OK");
        await loadData();
      } else {
        toast.error("Fehler bei Zeitbuchung");
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await fetch(`${API}/api/staff/auth/logout`, { method: "POST", credentials: "include" }); } catch {}
    toast.success("Abgemeldet");
    onBack();
  };

  if (loading || !staff) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-lg px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            data-testid="staff-back-btn"
            className="p-2 -ml-2 rounded-xl hover:bg-slate-200/60 transition"
          >
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <button
            data-testid="staff-notifications-btn"
            className="relative w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center"
          >
            <Bell size={18} className="text-slate-700" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
          </button>
        </div>
        {tab === "home" && (
          <div className="mt-3">
            <p className="text-xs text-slate-500">{greeting()},</p>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              {staff?.name?.split(" ")[0] || "Mitarbeiter"} <span className="text-2xl">👋</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="px-5">
        {tab === "home" && (
          <HomeTab
            staff={staff}
            status={status}
            shiftStartedAt={shiftStartedAt}
            weekReport={weekReport}
            nextShift={myShifts.find((s) => new Date(s.start_time) > new Date()) || null}
            actionLoading={actionLoading}
            onClockAction={handleClockAction}
          />
        )}
        {tab === "shifts" && <ShiftsTab shifts={myShifts} />}
        {tab === "leave" && <LeaveTab myLeave={myLeave} onReload={loadData} />}
        {tab === "more" && <MoreTab staff={staff} onLogout={handleLogout} weekReport={weekReport} />}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-2 py-2">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
          {[
            { id: "home", icon: Briefcase, label: "Home" },
            { id: "shifts", icon: Calendar, label: "Schichten" },
            { id: "leave", icon: FileText, label: "Anträge" },
            { id: "more", icon: User, label: "Mehr" },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`staff-tab-${t.id}`}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl transition ${active ? "text-blue-600" : "text-slate-400"}`}
              >
                <Icon size={20} />
                <span className={`text-[10px] font-medium ${active ? "font-bold" : ""}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Home Tab — Active Shift Hero
// ═══════════════════════════════════════════════════════════════════════════

function HomeTab({ staff, status, shiftStartedAt, weekReport, nextShift, actionLoading, onClockAction }) {
  const isWorking = status === "working";
  const isBreak = status === "break";
  const isOff = status === "off";
  const timer = useLiveTimer(isWorking || isBreak ? shiftStartedAt : null);

  return (
    <div className="space-y-4">
      {/* Active Shift Hero Card */}
      {(isWorking || isBreak) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="active-shift-card"
          className="relative overflow-hidden rounded-3xl bg-white shadow-sm border border-emerald-100"
        >
          {/* Status Banner */}
          <div className={`${isBreak ? "bg-orange-50" : "bg-emerald-50"} px-5 py-4 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full ${isBreak ? "bg-orange-500" : "bg-emerald-500"} flex items-center justify-center shadow-sm`}>
                {isBreak ? <Coffee size={16} className="text-white" /> : <CheckCircle2 size={16} className="text-white" />}
              </div>
              <div>
                <p className={`text-sm font-bold ${isBreak ? "text-orange-700" : "text-emerald-700"}`}>
                  {isBreak ? "Du bist in Pause" : "Du arbeitest gerade"}
                </p>
                <p className="text-[11px] text-slate-500">
                  Seit {new Date(shiftStartedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200">
              <span className={`w-1.5 h-1.5 rounded-full ${isBreak ? "bg-orange-500" : "bg-emerald-500"} animate-pulse`} />
              <span className="text-[10px] font-bold tracking-wider text-slate-600">LIVE</span>
            </div>
          </div>

          {/* Big Timer */}
          <div className="px-5 py-7 text-center">
            <p className="text-5xl font-bold font-mono tracking-tight text-slate-900 tabular-nums" data-testid="active-timer">
              {timer.hms}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-widest">Arbeitszeit</p>
          </div>

          {/* Buttons */}
          <div className="px-5 pb-5 grid grid-cols-2 gap-3">
            {isWorking && (
              <button
                onClick={() => onClockAction("break_start")}
                disabled={actionLoading}
                data-testid="pause-start-btn"
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/35 active:scale-[0.98] transition disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Coffee size={16} />}
                PAUSE STARTEN
              </button>
            )}
            {isBreak && (
              <button
                onClick={() => onClockAction("break_end")}
                disabled={actionLoading}
                data-testid="pause-end-btn"
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-600 text-white text-sm font-bold shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 active:scale-[0.98] transition disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                PAUSE BEENDEN
              </button>
            )}
            <button
              onClick={() => onClockAction("clock_out")}
              disabled={actionLoading}
              data-testid="shift-end-btn"
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 text-white text-sm font-bold shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/35 active:scale-[0.98] transition disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
              SCHICHT BEENDEN
            </button>
          </div>
        </motion.div>
      )}

      {/* Off-Shift: Start Shift Hero */}
      {isOff && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="start-shift-card"
          className="rounded-3xl bg-white shadow-sm border border-slate-200 p-6 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center">
            <Play size={32} className="text-blue-600 ml-1" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Bereit für die Schicht?</h2>
          <p className="text-sm text-slate-500 mt-1">Tippe unten zum Einchecken</p>
          <button
            onClick={() => onClockAction("clock_in")}
            disabled={actionLoading}
            data-testid="shift-start-btn"
            className="mt-5 w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-white text-base font-bold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98] transition disabled:opacity-50"
          >
            {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            SHIFT STARTEN
          </button>
        </motion.div>
      )}

      {/* Today Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Gearbeitet" value={`${weekReport?.net_hours || 0} h`} accent="text-emerald-600" />
        <StatCard label="Pause" value={`${weekReport?.break_hours || 0} h`} accent="text-orange-500" />
        <StatCard label="Überstunden" value={`${weekReport?.overtime_hours || 0} h`} accent="text-blue-600" />
        <StatCard label="Buchungen" value={`${weekReport?.events_count || 0}`} accent="text-slate-700" />
      </div>

      {/* Next Shift Card */}
      {nextShift && (
        <div data-testid="next-shift-card" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Calendar size={20} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Nächste Schicht</p>
            <p className="text-sm font-bold text-slate-900 truncate">
              {new Date(nextShift.start_time).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}, {new Date(nextShift.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–{new Date(nextShift.end_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {nextShift.location && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin size={10} /> {nextShift.location}
              </p>
            )}
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </div>
      )}

      {/* Notifications/Tasks (placeholder for future) */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
          <BellRing size={18} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Alles klar!</p>
          <p className="text-xs text-slate-600 mt-0.5">Keine offenen Aufgaben oder Benachrichtigungen.</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
      <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shifts Tab — Liste/Kalender Toggle
// ═══════════════════════════════════════════════════════════════════════════

function ShiftsTab({ shifts }) {
  const [view, setView] = useState("liste");

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [shifts]);

  const now = new Date();

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-2xl font-bold text-slate-900">Meine Schichten</h2>

      {/* Toggle */}
      <div className="inline-flex w-full rounded-2xl bg-slate-200/60 p-1">
        {[
          { id: "liste", label: "Liste" },
          { id: "kalender", label: "Kalender" },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            data-testid={`shifts-view-${v.id}`}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
              view === v.id ? "bg-blue-500 text-white shadow-md" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {sortedShifts.length === 0 && (
        <div className="text-center py-16">
          <Calendar size={48} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-slate-500">Keine Schichten geplant</p>
        </div>
      )}

      {view === "liste" && sortedShifts.length > 0 && (
        <div className="space-y-2">
          {sortedShifts.map((shift) => {
            const start = new Date(shift.start_time);
            const end = new Date(shift.end_time);
            const isActive = start <= now && end >= now;
            const isPast = end < now;
            const dur = Math.round((end - start) / 36e5);
            return (
              <div
                key={shift.id}
                data-testid="shift-card"
                className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 flex items-center gap-4"
              >
                <div className="text-center w-12 shrink-0">
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    {start.toLocaleDateString("de-DE", { weekday: "short" })}
                  </p>
                  <p className="text-xl font-bold text-slate-900">{start.getDate()}</p>
                  <p className="text-[10px] text-slate-400">
                    {start.toLocaleDateString("de-DE", { month: "short" })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – {end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    {shift.location && <><MapPin size={10} /> {shift.location}</>}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : isPast
                        ? "bg-slate-100 text-slate-500"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {isActive ? "Aktiv" : isPast ? "Vorbei" : "Geplant"}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">{dur}h</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "kalender" && (
        <CalendarView shifts={sortedShifts} />
      )}
    </div>
  );
}

function CalendarView({ shifts }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDayWeek = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7; // Monday=0
  const today = new Date();

  const shiftsByDay = useMemo(() => {
    const map = {};
    shifts.forEach((s) => {
      const d = new Date(s.start_time);
      if (d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()) {
        map[d.getDate()] = (map[d.getDate()] || 0) + 1;
      }
    });
    return map;
  }, [shifts, month]);

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          ←
        </button>
        <h3 className="text-base font-bold text-slate-900">
          {month.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </h3>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 font-bold uppercase mb-2">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (<div key={d}>{d}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayWeek }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const hasShift = !!shiftsByDay[day];
          const isToday = today.getDate() === day && today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear();
          return (
            <div
              key={day}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition ${
                isToday
                  ? "bg-blue-500 text-white font-bold shadow-md"
                  : hasShift
                  ? "bg-emerald-50 text-emerald-700 font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {day}
              {hasShift && !isToday && <span className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Leave Tab — Urlaubsanträge
// ═══════════════════════════════════════════════════════════════════════════

function LeaveTab({ myLeave, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "vacation", start_date: "", end_date: "", reason: "" });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const params = new URLSearchParams({ type: form.type, start_date: form.start_date, end_date: form.end_date, reason: form.reason });
      const res = await fetch(`${API}/api/staff/leave/self?${params}`, { method: "POST", credentials: "include" });
      if (res.ok) {
        toast.success("Antrag eingereicht");
        setShowForm(false);
        setForm({ type: "vacation", start_date: "", end_date: "", reason: "" });
        onReload();
      } else toast.error("Fehler beim Einreichen");
    } catch { toast.error("Netzwerkfehler"); }
  };

  const labels = { vacation: "Urlaub", sick: "Krank", other: "Sonstiges" };
  const statusColors = {
    pending: "bg-orange-100 text-orange-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  const statusLabels = { pending: "Offen", approved: "Genehmigt", rejected: "Abgelehnt" };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Anträge</h2>
        <button
          onClick={() => setShowForm(true)}
          data-testid="leave-new-btn"
          className="flex items-center gap-1 px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/25 hover:bg-blue-600 transition"
        >
          <Plus size={14} /> Neu
        </button>
      </div>

      {myLeave.length === 0 && (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-slate-500">Keine Anträge bisher</p>
        </div>
      )}

      <div className="space-y-2">
        {myLeave.map((req) => (
          <div key={req.id} data-testid="leave-card" className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-slate-900">{labels[req.type] || req.type}</p>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColors[req.status] || "bg-slate-100 text-slate-600"}`}>
                {statusLabels[req.status] || req.status}
              </span>
            </div>
            <p className="text-xs text-slate-600">{req.start_date} bis {req.end_date}</p>
            {req.reason && <p className="text-[11px] text-slate-400 mt-1 italic">"{req.reason}"</p>}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">Antrag stellen</h3>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Art</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white"
                >
                  <option value="vacation">Urlaub</option>
                  <option value="sick">Krank</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Von</label>
                  <input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Bis</label>
                  <input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Grund (optional)</label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition">Abbrechen</button>
                <button type="submit" data-testid="leave-submit-btn" className="py-3 rounded-xl bg-blue-500 text-white text-sm font-bold shadow-md hover:bg-blue-600 transition">Einreichen</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// More/Profile Tab
// ═══════════════════════════════════════════════════════════════════════════

function MoreTab({ staff, onLogout, weekReport }) {
  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-2xl font-bold text-slate-900">Profil</h2>

      {/* Profile Card */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white text-center shadow-lg shadow-blue-500/20">
        <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-bold">
          {staff?.name?.charAt(0) || "M"}
        </div>
        <p className="text-lg font-bold">{staff?.name || "Mitarbeiter"}</p>
        <p className="text-xs text-white/80 capitalize">{staff?.role || "Employee"}</p>
        {weekReport && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold">{weekReport.net_hours || 0}h</p>
              <p className="text-[10px] text-white/70 uppercase">Diese Woche</p>
            </div>
            <div>
              <p className="text-lg font-bold">{weekReport.overtime_hours || 0}h</p>
              <p className="text-[10px] text-white/70 uppercase">Überstunden</p>
            </div>
            <div>
              <p className="text-lg font-bold">{weekReport.events_count || 0}</p>
              <p className="text-[10px] text-white/70 uppercase">Buchungen</p>
            </div>
          </div>
        )}
      </div>

      {/* Menu Items */}
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        {[
          { icon: User, label: "Persönliche Daten", color: "text-slate-700" },
          { icon: Settings, label: "Einstellungen", color: "text-slate-700" },
          { icon: BellRing, label: "Benachrichtigungen", color: "text-slate-700" },
          { icon: AlertCircle, label: "Hilfe & Support", color: "text-slate-700" },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <Icon size={16} className={item.color} />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-slate-700">{item.label}</span>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          );
        })}
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        data-testid="staff-logout-btn"
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition"
      >
        <LogOut size={16} /> Abmelden
      </button>
    </div>
  );
}
