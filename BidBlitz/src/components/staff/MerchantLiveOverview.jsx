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
  Clock, Briefcase, ArrowUpRight, Activity, FilePlus, UserPlus, ChevronRight, TrendingUp, MapPin,
  MessageCircle, Tag, Radio,
} from "lucide-react";
import LiveActivityTimeline from "../../staff/LiveActivityTimeline";

const API = process.env.REACT_APP_BACKEND_URL;

function actionLabel(a) {
  return { clock_in: "Eingecheckt", clock_out: "Ausgecheckt", break_start: "Pause Start", break_end: "Pause Ende" }[a] || a;
}
function actionColor(a) {
  return { clock_in: "#10B981", clock_out: "#EF4444", break_start: "#F59E0B", break_end: "#06B6D4" }[a] || "#888";
}

export default function MerchantLiveOverview({ summary = {}, members = [], todayEvents = [], onAddMember, onCreateShift, onOpenTimesheet, onOpenGeofence, onOpenChat, onOpenPromos, onOpenLiveMap }) {
  const [monthHours, setMonthHours] = useState(null);
  const [geoEvents, setGeoEvents] = useState([]);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/staff/timesheet/team-overview?days=30`, { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          setMonthHours(d.totals);
        }
      } catch (e) {}
      try {
        const g = await fetch(`${API}/api/staff/geofence/events?limit=30`, { credentials: "include" });
        if (g.ok) {
          const d = await g.json();
          setGeoEvents(d.events || []);
        }
      } catch (e) {}
      try {
        const c = await fetch(`${API}/api/staff/chat/unread-count`, { credentials: "include" });
        if (c.ok) {
          const d = await c.json();
          setChatUnread(d.unread || 0);
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
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Live Status</p>
              <h3 className="text-base font-bold mt-0.5">Wer arbeitet gerade?</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
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
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: "linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)" }}
                        >{m.name?.[0]?.toUpperCase()}</div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
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
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Schnellaktionen</p>
          <h3 className="text-base font-bold mb-3">Effizient bleiben</h3>
          <div className="space-y-2.5">
            <QuickAction icon={UserPlus} color="#00D4FF" label="Mitarbeiter hinzufügen" onClick={onAddMember} testId="merchant-qa-add-member" />
            <QuickAction icon={Calendar} color="#A855F7" label="Schicht erstellen" onClick={onCreateShift} testId="merchant-qa-create-shift" />
            {onOpenLiveMap && (
              <QuickAction icon={Radio} color="#10D981" label="Live-Cockpit" onClick={onOpenLiveMap} testId="merchant-qa-open-live-map" />
            )}
            <QuickAction icon={FilePlus} color="#10B981" label="Timesheet ansehen" onClick={onOpenTimesheet} testId="merchant-qa-open-timesheet" />
            {onOpenGeofence && (
              <QuickAction icon={MapPin} color="#0EA5E9" label="Standorte & Ankünfte" onClick={onOpenGeofence} testId="merchant-qa-open-geofence" />
            )}
            {onOpenChat && (
              <QuickAction
                icon={MessageCircle}
                color="#F59E0B"
                label="Team-Chat"
                badge={chatUnread}
                onClick={onOpenChat}
                testId="merchant-qa-open-chat"
              />
            )}
            {onOpenPromos && (
              <QuickAction
                icon={Tag}
                color="#EF4444"
                label="Taxi-Promos"
                onClick={onOpenPromos}
                testId="merchant-qa-open-promos"
              />
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed — Premium Live Timeline */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5" data-testid="merchant-activity-feed">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Live Activity</p>
            <h3 className="text-base font-bold mt-0.5 flex items-center gap-2 text-slate-900">
              <Activity size={14} className="text-emerald-500" /> Heute · alles auf einen Blick
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Live
          </span>
        </div>

        <LiveActivityTimeline
          events={[
            ...todayEvents.map((e) => ({
              id: e.id || `${e.staff_id}-${e.timestamp}`,
              staff_id: e.staff_id,
              staff_name: members.find((m) => m.id === e.staff_id)?.name,
              action: e.action,
              ts: e.timestamp,
            })),
            ...geoEvents.map((e) => ({
              id: e.id,
              staff_id: e.staff_id,
              staff_name: members.find((m) => m.id === e.staff_id)?.name,
              event_type: e.event_type,
              ts: e.ts,
              suspected_spoof: e.suspected_spoof,
            })),
          ]}
          limit={20}
          testid="merchant-timeline"
        />
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
      className="relative overflow-hidden p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all"
    >
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-10 pointer-events-none" style={{ background: color }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${color}1A`, color }}>
            <Icon size={20} strokeWidth={2.2} />
          </div>
          <ArrowUpRight size={14} className="text-slate-300" />
        </div>
        <p className="text-3xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="text-xs font-semibold text-slate-600 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, color, label, onClick, testId, badge }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all text-left"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}1A`, color }}>
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <span className="text-sm font-semibold flex-1 text-slate-900">{label}</span>
      {badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <ChevronRight size={16} className="text-slate-300" />
    </button>
  );
}

function EmptyTile({ icon: Icon, title, sub, action }) {
  return (
    <div className="py-10 px-4 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon size={24} className="text-slate-400" strokeWidth={1.6} />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {sub && <p className="text-xs text-slate-500 mt-1 max-w-[280px]">{sub}</p>}
      {action}
    </div>
  );
}
