/**
 * Staff Self-Service Portal
 * ==========================
 * Login, Check-in/out, Stunden, Urlaub für Mitarbeiter
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, Calendar, UmbrellaIcon, FileText,
  Play, Square, Pause, CheckCircle, Loader2, MapPin,
  TrendingUp, Award, AlertCircle, LogOut, User
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffPortalPage({ onBack }) {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");

  // Data
  const [todayHours, setTodayHours] = useState(null);
  const [weekReport, setWeekReport] = useState(null);
  const [myLeave, setMyLeave] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    loadStaffData();
  }, []);

  useEffect(() => {
    if (staff) {
      loadDashboardData();
    }
  }, [staff, tab]);

  const loadStaffData = async () => {
    try {
      const res = await fetch(`${API}/api/staff/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff);
      } else {
        toast.error("Nicht eingeloggt");
        onBack();
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      // Load week report
      const reportRes = await fetch(`${API}/api/staff/reports/hours/self`, { credentials: "include" });
      if (reportRes.ok) {
        const data = await reportRes.json();
        setWeekReport(data);
        
        // Find last event
        const events = data.events || [];
        if (events.length > 0) {
          setLastEvent(events[events.length - 1]);
        }
      }

      // Load leave requests
      const leaveRes = await fetch(`${API}/api/staff/leave/self`, { credentials: "include" });
      if (leaveRes.ok) {
        const data = await leaveRes.json();
        setMyLeave(data.requests || []);
      }

      // Load shifts
      const shiftsRes = await fetch(`${API}/api/staff/shifts/self`, { credentials: "include" });
      if (shiftsRes.ok) {
        const data = await shiftsRes.json();
        setMyShifts(data.shifts || []);
      }
    } catch (err) {
      console.error("Error loading dashboard:", err);
    }
  };

  const handleClockAction = async (action) => {
    setLoading(true);
    try {
      // Get GPS if available
      let lat = null;
      let lng = null;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch (err) {
          console.log("GPS not available, continuing without location");
        }
      }

      const res = await fetch(`${API}/api/staff/clock/self?action=${action}&lat=${lat}&lng=${lng}`, {
        method: "POST",
        credentials: "include"
      });

      if (res.ok) {
        toast.success(getActionLabel(action));
        loadDashboardData();
      } else {
        toast.error("Fehler bei Zeitbuchung");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API}/api/staff/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      toast.success("Abgemeldet");
      onBack();
    } catch (err) {
      toast.error("Fehler beim Abmelden");
    }
  };

  if (loading && !staff) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: TrendingUp },
    { id: "hours", label: "Meine Stunden", icon: Clock },
    { id: "leave", label: "Urlaub", icon: UmbrellaIcon },
    { id: "shifts", label: "Schichten", icon: Calendar }
  ];

  const isCurrentlyWorking = lastEvent?.action === "clock_in" || lastEvent?.action === "break_end";
  const isOnBreak = lastEvent?.action === "break_start";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-base font-bold font-outfit">{staff?.name || "Mitarbeiter"}</h1>
              <p className="text-[10px] text-white/40">{staff?.role || "Employee"}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                  tab === t.id
                    ? "text-[#00C2FF] border-[#00C2FF]"
                    : "text-white/40 border-transparent hover:text-white/60"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === "dashboard" && (
          <DashboardTab
            staff={staff}
            weekReport={weekReport}
            lastEvent={lastEvent}
            isCurrentlyWorking={isCurrentlyWorking}
            isOnBreak={isOnBreak}
            onClockAction={handleClockAction}
            myShifts={myShifts}
            myLeave={myLeave}
          />
        )}
        {tab === "hours" && <HoursTab weekReport={weekReport} />}
        {tab === "leave" && <LeaveTab myLeave={myLeave} onReload={loadDashboardData} />}
        {tab === "shifts" && <ShiftsTab myShifts={myShifts} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Tab
// ═══════════════════════════════════════════════════════════════════════════

function DashboardTab({ staff, weekReport, lastEvent, isCurrentlyWorking, isOnBreak, onClockAction, myShifts, myLeave }) {
  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#00C2FF]/10 to-[#A855F7]/10 border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-white/60 mb-1">Status</p>
            <p className="text-lg font-bold">
              {isCurrentlyWorking ? (isOnBreak ? "Pause" : "Im Dienst") : "Nicht eingecheckt"}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isCurrentlyWorking ? (isOnBreak ? "bg-yellow-500/20" : "bg-green-500/20") : "bg-white/5"
          }`}>
            <Clock size={24} className={isCurrentlyWorking ? (isOnBreak ? "text-yellow-400" : "text-green-400") : "text-white/40"} />
          </div>
        </div>

        {lastEvent && (
          <p className="text-[10px] text-white/40">
            Letzte Aktion: {getActionLabel(lastEvent.action)} um {new Date(lastEvent.timestamp).toLocaleTimeString("de-DE")}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {!isCurrentlyWorking && (
          <button
            onClick={() => onClockAction("clock_in")}
            className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all text-left"
          >
            <Play size={20} className="text-green-400 mb-2" />
            <p className="text-sm font-semibold text-green-400">Einchecken</p>
            <p className="text-[10px] text-white/40 mt-0.5">Arbeit beginnen</p>
          </button>
        )}

        {isCurrentlyWorking && !isOnBreak && (
          <>
            <button
              onClick={() => onClockAction("break_start")}
              className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all text-left"
            >
              <Pause size={20} className="text-yellow-400 mb-2" />
              <p className="text-sm font-semibold text-yellow-400">Pause</p>
              <p className="text-[10px] text-white/40 mt-0.5">Pause starten</p>
            </button>

            <button
              onClick={() => onClockAction("clock_out")}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-left"
            >
              <Square size={20} className="text-red-400 mb-2" />
              <p className="text-sm font-semibold text-red-400">Auschecken</p>
              <p className="text-[10px] text-white/40 mt-0.5">Arbeit beenden</p>
            </button>
          </>
        )}

        {isOnBreak && (
          <button
            onClick={() => onClockAction("break_end")}
            className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all text-left col-span-2"
          >
            <Play size={20} className="text-green-400 mb-2" />
            <p className="text-sm font-semibold text-green-400">Pause beenden</p>
            <p className="text-[10px] text-white/40 mt-0.5">Zurück zur Arbeit</p>
          </button>
        )}
      </div>

      {/* Week Stats */}
      {weekReport && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="text-sm font-semibold mb-3">Diese Woche</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-[10px] text-white/40 mb-1">Gesamtstunden</p>
              <p className="text-2xl font-bold">{weekReport.net_hours}h</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-[10px] text-white/40 mb-1">Überstunden</p>
              <p className="text-2xl font-bold text-[#00C2FF]">{weekReport.overtime_hours}h</p>
            </div>
          </div>
        </div>
      )}

      {/* Next Shift */}
      {myShifts.length > 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-[#A855F7]" />
            Nächste Schicht
          </h3>
          <div className="p-3 rounded-xl bg-white/5">
            <p className="text-xs font-semibold">{myShifts[0].title}</p>
            <p className="text-[10px] text-white/60 mt-1">
              {new Date(myShifts[0].start_time).toLocaleString("de-DE")}
            </p>
            {myShifts[0].location && (
              <p className="text-[10px] text-white/40 mt-1 flex items-center gap-1">
                <MapPin size={10} />
                {myShifts[0].location}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pending Leave */}
      {myLeave.filter((l) => l.status === "pending").length > 0 && (
        <div className="rounded-2xl bg-yellow-500/5 border border-yellow-500/20 p-4">
          <p className="text-xs font-semibold text-yellow-400 mb-1">Offene Urlaubsanträge</p>
          <p className="text-[10px] text-white/60">
            {myLeave.filter((l) => l.status === "pending").length} Antrag(e) warten auf Genehmigung
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Hours Tab
// ═══════════════════════════════════════════════════════════════════════════

function HoursTab({ weekReport }) {
  if (!weekReport) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[10px] text-white/40 mb-1">Gesamtstunden</p>
          <p className="text-3xl font-bold">{weekReport.net_hours}h</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[10px] text-white/40 mb-1">Überstunden</p>
          <p className="text-3xl font-bold text-[#00C2FF]">{weekReport.overtime_hours}h</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[10px] text-white/40 mb-1">Pausen</p>
          <p className="text-3xl font-bold text-yellow-400">{weekReport.break_hours}h</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-[10px] text-white/40 mb-1">Buchungen</p>
          <p className="text-3xl font-bold">{weekReport.events_count}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3">Letzte Buchungen</h3>
        {weekReport.events.length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center">Keine Buchungen diese Woche</p>
        ) : (
          <div className="space-y-2">
            {weekReport.events.slice().reverse().slice(0, 10).map((event, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getEventColor(event.action)}`} />
                  <div>
                    <p className="text-xs font-medium">{getActionLabel(event.action)}</p>
                    <p className="text-[10px] text-white/40">
                      {new Date(event.timestamp).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-medium">{new Date(event.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Leave Tab
// ═══════════════════════════════════════════════════════════════════════════

function LeaveTab({ myLeave, onReload }) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [form, setForm] = useState({
    type: "vacation",
    start_date: "",
    end_date: "",
    reason: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/staff/leave/self?type=${form.type}&start_date=${form.start_date}&end_date=${form.end_date}&reason=${encodeURIComponent(form.reason)}`, {
        method: "POST",
        credentials: "include"
      });

      if (res.ok) {
        toast.success("Antrag eingereicht");
        setShowRequestForm(false);
        setForm({ type: "vacation", start_date: "", end_date: "", reason: "" });
        onReload();
      } else {
        toast.error("Fehler beim Einreichen");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    }
  };

  const pending = myLeave.filter((l) => l.status === "pending");
  const approved = myLeave.filter((l) => l.status === "approved");
  const rejected = myLeave.filter((l) => l.status === "rejected");

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowRequestForm(true)}
        className="w-full px-4 py-3 rounded-xl bg-[#00C2FF] text-black text-sm font-semibold hover:bg-[#00A8E0] transition-colors"
      >
        + Urlaub beantragen
      </button>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="text-sm font-semibold mb-3 text-yellow-400">Offen ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((req) => (
              <div key={req.id} className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                <p className="text-xs font-semibold">{getLeaveTypeLabel(req.type)}</p>
                <p className="text-[10px] text-white/60 mt-1">
                  {req.start_date} bis {req.end_date}
                </p>
                {req.reason && <p className="text-[10px] text-white/40 mt-1 italic">"{req.reason}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="text-sm font-semibold mb-3 text-green-400">Genehmigt ({approved.length})</h3>
          <div className="space-y-2">
            {approved.map((req) => (
              <div key={req.id} className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-xs font-semibold">{getLeaveTypeLabel(req.type)}</p>
                <p className="text-[10px] text-white/60 mt-1">
                  {req.start_date} bis {req.end_date}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-[#111] border border-white/10 p-6"
          >
            <h2 className="text-lg font-bold mb-4">Urlaub beantragen</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Art</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
                >
                  <option value="vacation">Urlaub</option>
                  <option value="sick">Krank</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Von</label>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Bis</label>
                <input
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Grund (optional)</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#00C2FF] text-black text-sm font-semibold hover:bg-[#00A8E0] transition-colors"
                >
                  Beantragen
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shifts Tab
// ═══════════════════════════════════════════════════════════════════════════

function ShiftsTab({ myShifts }) {
  if (myShifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Calendar size={48} className="text-white/10 mb-3" />
        <p className="text-sm text-white/40">Keine Schichten geplant</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {myShifts.map((shift) => (
        <div key={shift.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-sm font-semibold mb-2">{shift.title}</p>
          <p className="text-xs text-white/60 mb-1">
            {new Date(shift.start_time).toLocaleString("de-DE")}
          </p>
          <p className="text-xs text-white/60">
            bis {new Date(shift.end_time).toLocaleTimeString("de-DE")}
          </p>
          {shift.location && (
            <p className="text-[10px] text-white/40 mt-2 flex items-center gap-1">
              <MapPin size={10} />
              {shift.location}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function getActionLabel(action) {
  const labels = {
    clock_in: "Eingecheckt",
    clock_out: "Ausgecheckt",
    break_start: "Pause Start",
    break_end: "Pause Ende"
  };
  return labels[action] || action;
}

function getEventColor(action) {
  const colors = {
    clock_in: "bg-green-400",
    clock_out: "bg-red-400",
    break_start: "bg-yellow-400",
    break_end: "bg-green-400"
  };
  return colors[action] || "bg-white/40";
}

function getLeaveTypeLabel(type) {
  const labels = {
    vacation: "Urlaub",
    sick: "Krank",
    other: "Sonstiges"
  };
  return labels[type] || type;
}
