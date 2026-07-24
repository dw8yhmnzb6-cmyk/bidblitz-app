/**
 * Staff Dashboard Cards (Anwesenheit, Pause, Verspätet, Fehlt, Kosten, Warnungen)
 */
import React, { useEffect, useState } from "react";
import { Users, Coffee, AlertTriangle, UserX, Calendar, Euro, ShieldAlert } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffDashboardCards() {
  const [data, setData] = useState({
    present: 0, on_break: 0, late: 0, absent: 0,
    today_shifts: 0, monthly_cost: 0, open_warnings: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [eventsRes, membersRes, shiftsRes, warningsRes, monthlyRes] = await Promise.all([
          fetch(`${API}/api/staff/clock/today`, { credentials: "include" }),
          fetch(`${API}/api/staff/members`, { credentials: "include" }),
          fetch(`${API}/api/staff/shifts`, { credentials: "include" }),
          fetch(`${API}/api/staff/warnings/list?resolved=false`, { credentials: "include" }),
          fetch(`${API}/api/staff/reports/monthly`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        const events = (eventsRes.ok ? (await eventsRes.json()).events : []) || [];
        const members = (membersRes.ok ? (await membersRes.json()).members : []) || [];
        const shifts = (shiftsRes.ok ? (await shiftsRes.json()).shifts : []) || [];
        const warnings = (warningsRes.ok ? (await warningsRes.json()).warnings : []) || [];
        const monthly = monthlyRes.ok ? await monthlyRes.json() : { total_cost_eur: 0 };

        const states = {};
        events.forEach((e) => {
          const s = states[e.staff_id] || { in: false, brk: false };
          if (e.action === "clock_in") { s.in = true; s.brk = false; }
          else if (e.action === "clock_out") { s.in = false; s.brk = false; }
          else if (e.action === "break_start") { s.brk = true; }
          else if (e.action === "break_end") { s.brk = false; }
          states[e.staff_id] = s;
        });
        const present = Object.values(states).filter((s) => s.in && !s.brk).length;
        const onBreak = Object.values(states).filter((s) => s.brk).length;
        const absent = Math.max(0, members.filter((m) => m.active).length - Object.keys(states).length);

        // Late = scheduled shift today started, but no clock_in
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayShifts = shifts.filter((sh) => (sh.start_time || "").startsWith(todayStr));
        const late = todayShifts.filter((sh) => sh.staff_id && !states[sh.staff_id]?.in && new Date(sh.start_time) < new Date()).length;

        setData({
          present, on_break: onBreak, late, absent,
          today_shifts: todayShifts.length,
          monthly_cost: monthly.total_cost_eur || 0,
          open_warnings: warnings.length || 0,
        });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { id: "present", label: "Anwesend", value: data.present, icon: Users, color: "#10B981" },
    { id: "break", label: "In Pause", value: data.on_break, icon: Coffee, color: "#F59E0B" },
    { id: "late", label: "Verspätet", value: data.late, icon: AlertTriangle, color: "#EF4444" },
    { id: "absent", label: "Fehlt", value: data.absent, icon: UserX, color: "#6B7280" },
    { id: "shifts", label: "Heutige Schichten", value: data.today_shifts, icon: Calendar, color: "#A855F7" },
    { id: "warnings", label: "Offene Warnungen", value: data.open_warnings, icon: ShieldAlert, color: "#EF4444" },
    { id: "cost", label: "Monatskosten (geschätzt)", value: `€${Number(data.monthly_cost).toFixed(0)}`, icon: Euro, color: "#00C2FF" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="staff-dashboard-cards">
      {cards.map((c) => {
        const I = c.icon;
        return (
          <div
            key={c.id}
            data-testid={`staff-card-${c.id}`}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${c.color}22`, color: c.color }}>
                <I size={16} />
              </div>
            </div>
            <p className="text-2xl font-bold leading-tight">{c.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}
