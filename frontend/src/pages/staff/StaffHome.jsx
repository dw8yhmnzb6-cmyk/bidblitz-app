/**
 * Staff Mobile — Home Tab (Premium Polish)
 * =========================================
 * Live Status Card · Großer Gradient Action-Button · KPI Grid · Quick Cards.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Square, Coffee, Loader2, Edit3, MapPin, Clock, TrendingUp,
  Wallet, Calendar, Sparkles, ChevronRight,
} from "lucide-react";

function formatTime(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return "—"; }
}

function useElapsed(startISO) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!startISO) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [startISO]);
  if (!startISO) return null;
  const ms = Date.now() - new Date(startISO).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  return { h: Math.floor(m / 60), m: m % 60, totalMin: m, _tick: tick };
}

export default function StaffHome({
  staff, dashboard, status, acting, onClock, onOpenAttachments,
  openTasksCount = 0, walletBalance = 0, overtimeHours = 0,
}) {
  const elapsed = useElapsed(status !== "off" ? dashboard?.current_session_started : null);

  // Primary action
  const primary = status === "off" ? "clock_in" : status === "working" ? "clock_out" : "break_end";
  const primaryLabel = status === "off" ? "Schicht starten" : status === "working" ? "Schicht beenden" : "Pause beenden";
  const primaryColor = status === "off" ? "#00D4FF" : status === "working" ? "#EF4444" : "#10B981";
  const PrimaryIcon = status === "off" ? Play : status === "working" ? Square : Play;

  const statusMeta = {
    off:     { label: "Nicht eingecheckt", color: "#9CA3AF", soft: "#9CA3AF", grad: ["#1F2937", "#111827"] },
    working: { label: "Arbeitet gerade",   color: "#10B981", soft: "#34D399", grad: ["#065F46", "#064E3B"] },
    break:   { label: "In Pause",          color: "#F59E0B", soft: "#FBBF24", grad: ["#92400E", "#7C2D12"] },
  }[status] || { label: "Nicht eingecheckt", color: "#9CA3AF", soft: "#9CA3AF", grad: ["#1F2937", "#111827"] };

  // Estimated shift end (from next_shift or 8h default after current_session_started)
  let shiftEndsAt = null;
  if (status !== "off" && dashboard?.current_session_started) {
    const ns = dashboard?.next_shift;
    if (ns?.end_time) shiftEndsAt = ns.end_time;
    else {
      const d = new Date(dashboard.current_session_started);
      d.setHours(d.getHours() + 8);
      shiftEndsAt = d.toISOString();
    }
  }

  return (
    <div className="pb-2">
      {/* Greeting */}
      <div className="px-5 pt-6 pb-3">
        <p className="text-[11px] uppercase tracking-widest text-white/40">
          {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
        <h1 className="text-[26px] font-bold mt-1 leading-tight font-outfit">Hi, {staff?.name?.split(" ")[0] || "Team"}</h1>
      </div>

      {/* Live Status Card */}
      <div className="px-5 pb-5">
        <motion.div
          data-testid="staff-live-status-card"
          layout
          className="relative overflow-hidden rounded-3xl p-5 border"
          style={{
            background: `linear-gradient(140deg, ${statusMeta.grad[0]}55 0%, ${statusMeta.grad[1]}33 100%)`,
            borderColor: `${statusMeta.color}33`,
          }}
        >
          {/* Decorative glow */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-30 blur-3xl pointer-events-none" style={{ background: statusMeta.soft }} />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex w-2.5 h-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: statusMeta.soft }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: statusMeta.soft }} />
              </span>
              <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: statusMeta.soft }}>
                {statusMeta.label}
              </p>
            </div>
            {status !== "off" && elapsed && (
              <div data-testid="staff-live-elapsed" className="text-right">
                <p className="text-[9px] uppercase tracking-widest text-white/40">Laufzeit</p>
                <p className="text-sm font-bold tabular-nums">
                  {String(elapsed.h).padStart(2, "0")}:{String(elapsed.m).padStart(2, "0")}
                </p>
              </div>
            )}
          </div>

          <div className="relative mt-3">
            <p className="text-3xl font-bold tracking-tight tabular-nums">
              {(dashboard?.today_hours ?? 0).toFixed(1)}
              <span className="text-base text-white/40 ml-1">h heute</span>
            </p>
            {status !== "off" && shiftEndsAt && (
              <p className="text-[12px] text-white/60 mt-1.5 flex items-center gap-1.5">
                <Clock size={11} /> Schicht endet ca. <span className="text-white font-semibold">{formatTime(shiftEndsAt)}</span>
              </p>
            )}
            {dashboard?.next_shift?.location && (
              <p className="text-[12px] text-white/50 mt-1 flex items-center gap-1.5">
                <MapPin size={11} /> {dashboard.next_shift.location}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Big Circular Action Button */}
      <div className="px-5 pb-4 flex flex-col items-center">
        <motion.button
          onClick={() => onClock(primary)}
          disabled={acting !== null}
          data-testid="staff-primary-shift-btn"
          whileTap={{ scale: 0.93 }}
          animate={acting ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.2 }}
          className="relative w-56 h-56 rounded-full flex items-center justify-center disabled:opacity-80 group"
          style={{
            background: `conic-gradient(from 180deg at 50% 50%, ${primaryColor}, ${primaryColor}AA, ${primaryColor})`,
            boxShadow: `0 24px 70px -10px ${primaryColor}66, 0 0 0 1px ${primaryColor}33 inset`,
          }}
        >
          {/* Pulsing rings */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: primaryColor }} />
          <div
            className="absolute inset-2 rounded-full flex flex-col items-center justify-center transition-transform group-active:scale-95"
            style={{ background: "radial-gradient(circle at 30% 25%, #1a1a1a 0%, #0A0A0A 70%)" }}
          >
            <AnimatePresence mode="wait">
              {acting ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Loader2 size={48} className="animate-spin" style={{ color: primaryColor }} />
                </motion.div>
              ) : (
                <motion.div key={primary} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <PrimaryIcon size={50} style={{ color: primaryColor }} strokeWidth={2.2} fill={status !== "off" ? primaryColor : "transparent"} />
                </motion.div>
              )}
            </AnimatePresence>
            <p className="mt-3 text-sm font-bold text-white tracking-wide">{primaryLabel}</p>
            <p className="text-[10px] text-white/40 mt-0.5">Antippen</p>
          </div>
        </motion.button>

        {/* Secondary inline actions */}
        <div className="mt-5 grid grid-cols-2 gap-3 w-full">
          {status === "working" && (
            <SecondaryBtn
              testId="staff-break-start-btn"
              icon={Coffee}
              color="#F59E0B"
              loading={acting === "break_start"}
              onClick={() => onClock("break_start")}
            >Pause</SecondaryBtn>
          )}
          {status === "break" && (
            <SecondaryBtn
              testId="staff-clock-out-btn"
              icon={Square}
              color="#EF4444"
              loading={acting === "clock_out"}
              onClick={() => onClock("clock_out")}
            >Schicht beenden</SecondaryBtn>
          )}
          <SecondaryBtn
            testId="staff-attachment-checkin-btn"
            icon={Edit3}
            color="#A855F7"
            onClick={onOpenAttachments}
          >Mit Details</SecondaryBtn>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="px-5 pt-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Übersicht</p>
        <div className="grid grid-cols-2 gap-3">
          <KPI testId="kpi-today" icon={Clock} color="#00D4FF" label="Heute" value={`${(dashboard?.today_hours ?? 0).toFixed(1)}h`} />
          <KPI testId="kpi-week" icon={Calendar} color="#A855F7" label="Diese Woche" value={`${(dashboard?.week_hours ?? 0).toFixed(1)}h`} />
          <KPI testId="kpi-overtime" icon={TrendingUp} color="#F59E0B" label="Überstunden" value={`${overtimeHours.toFixed(1)}h`} />
          <KPI testId="kpi-wallet" icon={Wallet} color="#10B981" label="Wallet" value={`€${walletBalance.toFixed(2)}`} />
        </div>
      </div>

      {/* Next Shift Card */}
      <div className="px-5 pt-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Nächste Schicht</p>
        <div
          data-testid="staff-home-next-shift"
          className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3"
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#A855F7]/15 text-[#A855F7]">
            <Calendar size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{dashboard?.next_shift?.title || "Keine geplant"}</p>
            <p className="text-[11px] text-white/50 truncate mt-0.5">
              {dashboard?.next_shift?.start_time
                ? new Date(dashboard.next_shift.start_time).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                : "Du kannst dich jederzeit einchecken"}
            </p>
            {dashboard?.next_shift?.location && (
              <p className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {dashboard.next_shift.location}</p>
            )}
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </div>
      </div>

      {/* Tasks Inline */}
      {openTasksCount > 0 && (
        <div className="px-5 pt-5">
          <div
            data-testid="staff-home-tasks"
            className="p-4 rounded-2xl border flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.07) 0%, rgba(168,85,247,0.05) 100%)", borderColor: "rgba(0,212,255,0.25)" }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#00D4FF]/15 text-[#00D4FF]">
              <Sparkles size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">{openTasksCount} {openTasksCount === 1 ? "neue Aufgabe" : "neue Aufgaben"}</p>
              <p className="text-[11px] text-white/50">Tippe auf „Aufgaben“ in der Navigation</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, color, label, value, testId }) {
  return (
    <div
      data-testid={testId}
      className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${color}1F`, color }}>
          <Icon size={14} strokeWidth={2.2} />
        </div>
        <p className="text-[10px] uppercase tracking-widest text-white/40">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function SecondaryBtn({ icon: Icon, color, onClick, loading, children, testId }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={loading}
      data-testid={testId}
      whileTap={{ scale: 0.96 }}
      className="py-3.5 rounded-2xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors disabled:opacity-60"
      style={{ background: `${color}10`, borderColor: `${color}40`, color }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      {children}
    </motion.button>
  );
}
