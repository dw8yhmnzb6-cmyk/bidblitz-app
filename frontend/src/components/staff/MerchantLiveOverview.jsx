/**
 * Merchant — Live Staff Overview (Premium Polish)
 * ================================================
 * Mehr Cards, weniger Tabellen. Live Mitarbeiter-Status, Schnellaktionen,
 * Mini-Activity-Feed, professionelle Empty-States.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, CheckCircle2, Coffee, AlertCircle, Calendar, Sparkles,
  Clock, Briefcase, ArrowUpRight, Activity, FilePlus, UserPlus, ChevronRight, TrendingUp,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

function actionLabel(a) {
  return { clock_in: "Eingecheckt", clock_out: "Ausgecheckt", break_start: "Pause Start", break_end: "Pause Ende" }[a] || a;
}
function actionColor(a) {
  return { clock_in: "#10B981", clock_out: "#EF4444", break_start: "#F59E0B", break_end: "#06B6D4" }[a] || "#888";
}

export default function MerchantLiveOverview({ summary = {}, members = [], todayEvents = [], onAddMember, onCreateShift, onOpenTimesheet }) {
  const [monthHours, setMonthHours] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/staff/timesheet/team-overview?days=30`, { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          setMonthHours(d.totals);
        }
      } catch (e) {}
    })();
  }, []);

  // Determine live status per member based on today events
  const liveByMember = useMemo(() => {
    const map = {};
    for (const ev of todayEvents) {
      map[ev.staff_id] = ev.action;
    }
    return map;
  }, [todayEvents]);

  const stats = useMemo(() => {
    let working = 0, paused = 0, off = 0;
    for (const m of members) {
      if (!m.active) continue;
      const a = liveByMember[m.id];
      if (a === "clock_in" || a === "break_end") working++;
      else if (a === "break_start") paused++;
      else off++;
    }
    return { working, paused, off };
  }, [members, liveByMember]);

  return (
    <div className="space-y-5">
      {/* Hero KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiHero
          icon={CheckCircle2}
          color="#10B981"
          label="Aktiv"
          value={stats.working}
          sub={`${members.filter((m) => m.active).length} aktive MA`}
          testId="merchant-kpi-active"
        />
        <KpiHero
          icon={Coffee}
          color="#F59E0B"
          label="In Pause"
          value={stats.paused}
          sub="Pausierend"
          testId="merchant-kpi-break"
        />
        <KpiHero
          icon={AlertCircle}
          color="#EF4444"
          label="Offene Anträge"
          value={summary.pending_leave || 0}
          sub="Urlaub & Krank"
          testId="merchant-kpi-leave"
        />
        <KpiHero
          icon={TrendingUp}
          color="#A855F7"
          label="Monatsstunden"
          value={`${(monthHours?.regular_hours || 0).toFixed(0)}h`}
          sub={`+${(monthHours?.overtime_hours || 0).toFixed(0)}h ÜS`}
          testId="merchant-kpi-month"
        />
      </div>

      {/* Live Status Grid + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Status */}
        <div className="lg:col-span-2 rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5" data-testid="merchant-live-status">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40">Live Status</p>
              <h3 className="text-base font-bold mt-0.5">Wer arbeitet gerade?</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-white/40">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-70 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]" />
              </span>
              Live
            </span>
          </div>

          {members.filter((m) => m.active).length === 0 ? (
            <EmptyTile icon={Users} title="Noch keine Mitarbeiter" sub="Lege oder lade Mitarbeiter ein, um Live-Status zu sehen." action={onAddMember ? <button onClick={onAddMember} className="mt-3 px-4 py-2 rounded-xl bg-[#00D4FF] text-black text-xs font-bold">Mitarbeiter hinzufügen</button> : null} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {members.filter((m) => m.active).slice(0, 12).map((m) => {
                const a = liveByMember[m.id];
                const isWorking = a === "clock_in" || a === "break_end";
                const isBreak = a === "break_start";
                const color = isWorking ? "#10B981" : isBreak ? "#F59E0B" : "#6B7280";
                const label = isWorking ? "Arbeitet" : isBreak ? "Pause" : "Aus";
                return (
                  <div
                    key={m.id}
                    data-testid={`merchant-live-member-${m.id}`}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: "linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)" }}
                        >{m.name?.[0]?.toUpperCase()}</div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0A0A0A]"
                          style={{ background: color }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{m.name}</p>
                        <p className="text-[10px] font-medium" style={{ color }}>{label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5" data-testid="merchant-quick-actions">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Schnellaktionen</p>
          <h3 className="text-base font-bold mb-3">Effizient bleiben</h3>
          <div className="space-y-2.5">
            <QuickAction icon={UserPlus} color="#00D4FF" label="Mitarbeiter hinzufügen" onClick={onAddMember} testId="merchant-qa-add-member" />
            <QuickAction icon={Calendar} color="#A855F7" label="Schicht erstellen" onClick={onCreateShift} testId="merchant-qa-create-shift" />
            <QuickAction icon={FilePlus} color="#10B981" label="Timesheet ansehen" onClick={onOpenTimesheet} testId="merchant-qa-open-timesheet" />
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5" data-testid="merchant-activity-feed">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Aktivitäts-Feed</p>
            <h3 className="text-base font-bold mt-0.5 flex items-center gap-2">
              <Activity size={14} className="text-[#00D4FF]" /> Heute
            </h3>
          </div>
        </div>

        {todayEvents.length === 0 ? (
          <EmptyTile icon={Clock} title="Noch keine Buchungen heute" sub="Sobald Mitarbeiter ein- oder auschecken erscheinen die Bewegungen hier." />
        ) : (
          <div className="space-y-1.5">
            {todayEvents.slice(0, 12).map((event, i) => {
              const member = members.find((m) => m.id === event.staff_id);
              const color = actionColor(event.action);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D4FF]/15 to-[#A855F7]/15 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {member?.name?.[0] || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{member?.name || "Unbekannt"}</p>
                      <p className="text-[10px]" style={{ color }}>{actionLabel(event.action)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/40 tabular-nums flex-shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiHero({ icon: Icon, color, label, value, sub, testId }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={testId}
      className="relative overflow-hidden p-4 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-all"
    >
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-25 pointer-events-none" style={{ background: color }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${color}1F`, color }}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
          <ArrowUpRight size={14} className="text-white/20" />
        </div>
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
        <p className="text-[11px] font-semibold text-white/70 mt-1">{label}</p>
        {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, color, label, onClick, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="w-full p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3 hover:bg-white/[0.06] transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}1F`, color }}>
        <Icon size={15} strokeWidth={2.2} />
      </div>
      <span className="text-sm font-semibold flex-1">{label}</span>
      <ChevronRight size={15} className="text-white/30" />
    </button>
  );
}

function EmptyTile({ icon: Icon, title, sub, action }) {
  return (
    <div className="py-8 px-4 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-2">
        <Icon size={22} className="text-white/30" strokeWidth={1.6} />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {sub && <p className="text-[11px] text-white/40 mt-1 max-w-[260px]">{sub}</p>}
      {action}
    </div>
  );
}
