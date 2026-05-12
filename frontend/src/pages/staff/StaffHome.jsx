/**
 * Staff Mobile — Home Tab (FINAL WOW Polish)
 * ===========================================
 * Big Gradient Circle Action · Live Timer Hero · KPI Grid · Premium Cards.
 */
import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Square, Coffee, Loader2, Edit3, MapPin, Clock, TrendingUp,
  Wallet, Calendar, Sparkles, ChevronRight, CheckCircle2,
} from "lucide-react";
import { GlowDot } from "../../components/staff/StaffPrimitives";

function formatTime(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return "—"; }
}

function useElapsed(startISO, active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startISO || !active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startISO, active]);
  if (!startISO || !active) return null;
  const ms = Math.max(0, now - new Date(startISO).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

export default function StaffHome({
  staff, dashboard, status, acting, onClock, onOpenAttachments,
  openTasksCount = 0, walletBalance = 0, overtimeHours = 0,
}) {
  const elapsed = useElapsed(dashboard?.current_session_started, status !== "off");
  const [burstKey, setBurstKey] = useState(0);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current === "off" && status === "working") {
      setBurstKey((k) => k + 1);
    }
    prevStatus.current = status;
  }, [status]);

  // Primary action
  const primary = status === "off" ? "clock_in" : status === "working" ? "clock_out" : "break_end";
  const primaryLabel = status === "off" ? "Schicht starten" : status === "working" ? "Schicht beenden" : "Pause beenden";
  const primaryColor = status === "off" ? "#00D4FF" : status === "working" ? "#F31260" : "#10D981";
  const PrimaryIcon = status === "off" ? Play : status === "working" ? Square : Play;

  const statusMeta = {
    off:     { label: "Bereit", color: "#9CA3AF", soft: "#A1A1AA" },
    working: { label: "Arbeitet gerade", color: "#10D981", soft: "#34D399" },
    break:   { label: "In Pause", color: "#F5A524", soft: "#FBBF24" },
  }[status] || { label: "Bereit", color: "#9CA3AF", soft: "#A1A1AA" };

  // Estimated shift end
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
      {/* Live Status Card (Hero) */}
      <div className="px-5 pt-5 pb-3">
        <motion.div
          layout
          data-testid="staff-live-status-card"
          className="relative overflow-hidden rounded-[28px] p-5"
          style={{
            background: status === "off"
              ? "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)"
              : status === "working"
              ? "linear-gradient(135deg, rgba(16,217,129,0.18) 0%, rgba(0,212,255,0.08) 100%)"
              : "linear-gradient(135deg, rgba(245,165,36,0.18) 0%, rgba(243,18,96,0.06) 100%)",
            border: `1px solid ${statusMeta.color}33`,
            boxShadow: status !== "off" ? `0 16px 50px -20px ${statusMeta.color}66` : "0 8px 24px -8px rgba(0,0,0,0.4)",
          }}
        >
          {/* decorative glow */}
          <div
            className="absolute -top-12 -right-8 w-44 h-44 rounded-full blur-3xl opacity-50 pointer-events-none"
            style={{ background: statusMeta.soft }}
          />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GlowDot color={statusMeta.soft} size={9} />
              <p className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: statusMeta.soft }}>
                {statusMeta.label}
              </p>
            </div>
            {status !== "off" && elapsed && (
              <div data-testid="staff-live-elapsed" className="text-right tabular-nums">
                <p className="text-[9px] uppercase tracking-widest text-white/40">Laufzeit</p>
                <p className="text-base font-bold leading-none mt-0.5">
                  {String(elapsed.h).padStart(2, "0")}<span className="text-white/30 mx-0.5">:</span>
                  {String(elapsed.m).padStart(2, "0")}<span className="text-white/30 mx-0.5">:</span>
                  <span className="text-white/70">{String(elapsed.s).padStart(2, "0")}</span>
                </p>
              </div>
            )}
          </div>

          <div className="relative mt-3">
            <p className="text-[40px] font-bold tracking-tight tabular-nums leading-none" style={{ fontFeatureSettings: "'tnum'" }}>
              {(dashboard?.today_hours ?? 0).toFixed(1)}
              <span className="text-lg text-white/35 ml-2 font-medium">h heute</span>
            </p>
            {status !== "off" && shiftEndsAt && (
              <p className="text-[12px] text-white/55 mt-2 flex items-center gap-1.5">
                <Clock size={11} /> Endet ca. <span className="text-white font-semibold tabular-nums">{formatTime(shiftEndsAt)}</span>
              </p>
            )}
            {dashboard?.next_shift?.location && status !== "off" && (
              <p className="text-[12px] text-white/45 mt-1 flex items-center gap-1.5">
                <MapPin size={11} /> {dashboard.next_shift.location}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Big Circular Action Button */}
      <div className="px-5 pb-3 flex flex-col items-center pt-4">
        <div className="relative flex items-center justify-center">
          {/* Success burst on clock_in */}
          <AnimatePresence>
            {burstKey > 0 && (
              <motion.span
                key={burstKey}
                className="absolute inset-0 rounded-full"
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 2.6, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                style={{ background: "radial-gradient(circle, rgba(16,217,129,0.55) 0%, transparent 70%)" }}
              />
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => onClock(primary)}
            disabled={acting !== null}
            data-testid="staff-primary-shift-btn"
            whileTap={{ scale: 0.92 }}
            className="relative w-64 h-64 rounded-full flex items-center justify-center disabled:opacity-80 group"
            style={{
              background: `conic-gradient(from 200deg at 50% 50%, ${primaryColor} 0%, ${primaryColor}CC 50%, ${primaryColor} 100%)`,
              boxShadow: `0 30px 80px -10px ${primaryColor}66, 0 0 0 1px ${primaryColor}33 inset, 0 0 40px ${primaryColor}33`,
            }}
          >
            {/* Outer pulsing ring */}
            <span className="absolute inset-0 rounded-full animate-ping opacity-15" style={{ background: primaryColor }} />
            {/* Inner glass core */}
            <div
              className="absolute inset-[10px] rounded-full flex flex-col items-center justify-center transition-transform group-active:scale-[0.97]"
              style={{
                background: "radial-gradient(circle at 30% 25%, #1A1B22 0%, #0B0C10 75%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -10px 30px rgba(0,0,0,0.6)",
              }}
            >
              <AnimatePresence mode="wait">
                {acting ? (
                  <motion.div key="loading" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <Loader2 size={56} className="animate-spin" style={{ color: primaryColor }} />
                  </motion.div>
                ) : (
                  <motion.div
                    key={primary}
                    initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  >
                    <PrimaryIcon size={56} style={{ color: primaryColor, filter: `drop-shadow(0 0 12px ${primaryColor}88)` }} strokeWidth={2.2} fill={status !== "off" ? primaryColor : "transparent"} />
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="mt-3 text-[15px] font-bold text-white tracking-tight">{primaryLabel}</p>
              <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">Antippen</p>
            </div>
          </motion.button>
        </div>

        {/* Secondary inline actions */}
        <div className="mt-5 grid grid-cols-2 gap-3 w-full">
          {status === "working" && (
            <SecondaryBtn testId="staff-break-start-btn" icon={Coffee} color="#F5A524" loading={acting === "break_start"} onClick={() => onClock("break_start")}>
              Pause
            </SecondaryBtn>
          )}
          {status === "break" && (
            <SecondaryBtn testId="staff-clock-out-btn" icon={Square} color="#F31260" loading={acting === "clock_out"} onClick={() => onClock("clock_out")}>
              Schicht beenden
            </SecondaryBtn>
          )}
          <SecondaryBtn testId="staff-attachment-checkin-btn" icon={Edit3} color="#7E5BF6" onClick={onOpenAttachments}>
            Mit Details
          </SecondaryBtn>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="px-5 pt-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2.5 font-semibold">Übersicht</p>
        <div className="grid grid-cols-2 gap-3">
          <KPI testId="kpi-today"    icon={Clock}       color="#00D4FF" label="Heute"      value={`${(dashboard?.today_hours ?? 0).toFixed(1)}h`} />
          <KPI testId="kpi-week"     icon={Calendar}    color="#7E5BF6" label="Diese Woche" value={`${(dashboard?.week_hours ?? 0).toFixed(1)}h`} />
          <KPI testId="kpi-overtime" icon={TrendingUp}  color="#F5A524" label="Überstunden" value={`${overtimeHours.toFixed(1)}h`} />
          <KPI testId="kpi-wallet"   icon={Wallet}      color="#10D981" label="Wallet"      value={`€${walletBalance.toFixed(2)}`} />
        </div>
      </div>

      {/* Next Shift */}
      <div className="px-5 pt-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2.5 font-semibold">Nächste Schicht</p>
        <div
          data-testid="staff-home-next-shift"
          className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3 hover:bg-white/[0.05] transition-colors"
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#7E5BF6]/15 text-[#7E5BF6]" style={{ boxShadow: "inset 0 0 0 1px #7E5BF633" }}>
            <Calendar size={20} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{dashboard?.next_shift?.title || "Keine geplant"}</p>
            <p className="text-[11px] text-white/50 truncate mt-0.5">
              {dashboard?.next_shift?.start_time
                ? new Date(dashboard.next_shift.start_time).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                : "Du kannst dich jederzeit einchecken"}
            </p>
          </div>
          <ChevronRight size={16} className="text-white/25" />
        </div>
      </div>

      {/* Tasks teaser */}
      {openTasksCount > 0 && (
        <div className="px-5 pt-5">
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            data-testid="staff-home-tasks"
            className="relative overflow-hidden p-4 rounded-2xl border flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.10) 0%, rgba(126,91,246,0.06) 100%)", borderColor: "rgba(0,212,255,0.25)" }}
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-3xl opacity-50" style={{ background: "#00D4FF" }} />
            <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center bg-[#00D4FF]/15 text-[#00D4FF]" style={{ boxShadow: "inset 0 0 0 1px #00D4FF33" }}>
              <Sparkles size={20} />
            </div>
            <div className="relative flex-1">
              <p className="text-sm font-bold">{openTasksCount} {openTasksCount === 1 ? "neue Aufgabe" : "neue Aufgaben"}</p>
              <p className="text-[11px] text-white/55">Tippe auf „Aufgaben" in der Navigation</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, color, label, value, testId }) {
  return (
    <motion.div
      data-testid={testId}
      whileTap={{ scale: 0.98 }}
      className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all"
      style={{ boxShadow: "0 2px 8px -4px rgba(0,0,0,0.4)" }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color, boxShadow: `inset 0 0 0 1px ${color}25` }}>
          <Icon size={14} strokeWidth={2.4} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-semibold">{label}</p>
      </div>
      <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color }}>{value}</p>
    </motion.div>
  );
}

function SecondaryBtn({ icon: Icon, color, onClick, loading, children, testId }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={loading}
      data-testid={testId}
      whileTap={{ scale: 0.96 }}
      className="h-12 rounded-2xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors disabled:opacity-60"
      style={{
        background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
        borderColor: `${color}40`,
        color,
        boxShadow: `inset 0 1px 0 ${color}20`,
      }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} strokeWidth={2.4} />}
      {children}
    </motion.button>
  );
}
