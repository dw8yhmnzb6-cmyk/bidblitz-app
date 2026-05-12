/**
 * Staff Mobile — Shifts (Premium Mobile Cards)
 * =============================================
 * Geordnet nach Heute / Morgen / Diese Woche / Später.
 * Kalenderähnliche Karten mit großen Uhrzeiten und farbigen Status.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, ChevronRight, Loader2 } from "lucide-react";
import { PremiumEmpty } from "../../components/staff/StaffPrimitives";

const API = process.env.REACT_APP_BACKEND_URL;

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function isSameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }

function groupShifts(shifts) {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + (7 - today.getDay()));
  const groups = { today: [], tomorrow: [], week: [], later: [] };
  for (const s of shifts) {
    const st = new Date(s.start_time);
    if (isSameDay(st, today)) groups.today.push(s);
    else if (isSameDay(st, tomorrow)) groups.tomorrow.push(s);
    else if (st <= weekEnd) groups.week.push(s);
    else groups.later.push(s);
  }
  return groups;
}

function statusOf(shift) {
  const now = new Date();
  const st = new Date(shift.start_time);
  const en = shift.end_time ? new Date(shift.end_time) : null;
  if (en && now > en) return { label: "Abgeschlossen", color: "#6B7280" };
  if (now >= st && (!en || now <= en)) return { label: "Läuft", color: "#10B981" };
  if (st - now < 3600 * 1000) return { label: "Bald", color: "#F59E0B" };
  return { label: "Geplant", color: "#00D4FF" };
}

export default function StaffShifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/staff/shifts/self`, { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          setShifts(d.shifts || []);
        }
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div data-testid="staff-shifts-tab" className="py-20 flex justify-center">
        <Loader2 size={22} className="animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div data-testid="staff-shifts-tab" className="px-5 pt-6 pb-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">Schichten</p>
          <h2 className="text-2xl font-bold mt-1 font-outfit">Deine Einsätze</h2>
        </div>
        <PremiumEmpty
          icon={Calendar}
          title="Keine Schichten geplant"
          sub="Sobald dein Manager Schichten zuweist, erscheinen sie hier."
        />
      </div>
    );
  }

  const g = groupShifts(shifts);

  return (
    <div data-testid="staff-shifts-tab" className="px-5 pt-6 pb-2 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">Schichten</p>
        <h2 className="text-2xl font-bold mt-1 font-outfit">Deine Einsätze</h2>
      </div>
      <Section title="Heute" items={g.today} highlight />
      <Section title="Morgen" items={g.tomorrow} />
      <Section title="Diese Woche" items={g.week} />
      <Section title="Später" items={g.later} />
    </div>
  );
}

function Section({ title, items, highlight }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] uppercase tracking-widest text-white/40">{title}</p>
        <span className="text-[10px] text-white/30">{items.length}</span>
      </div>
      <div className="space-y-2.5">
        {items.map((s, idx) => <ShiftCard key={s.id || idx} shift={s} highlight={highlight} />)}
      </div>
    </div>
  );
}

function ShiftCard({ shift, highlight }) {
  const st = new Date(shift.start_time);
  const en = shift.end_time ? new Date(shift.end_time) : null;
  const status = statusOf(shift);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="staff-shift-card"
      className={`relative overflow-hidden rounded-2xl p-4 border ${
        highlight ? "bg-gradient-to-br from-[#00D4FF]/10 to-transparent border-[#00D4FF]/30"
                  : "bg-white/[0.03] border-white/[0.08]"
      }`}
    >
      {highlight && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00D4FF] to-[#A855F7]" />}
      <div className="flex items-center gap-4">
        <div className="text-center min-w-[58px]">
          <p className="text-[10px] uppercase tracking-widest text-white/40">{st.toLocaleDateString("de-DE", { weekday: "short" })}</p>
          <p className="text-2xl font-bold leading-tight">{st.getDate()}</p>
          <p className="text-[10px] text-white/40">{st.toLocaleDateString("de-DE", { month: "short" })}</p>
        </div>
        <div className="w-px h-12 bg-white/10" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{shift.title || "Schicht"}</p>
          <p className="text-base font-bold tabular-nums mt-0.5">
            <span className="text-white">{st.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
            {en && <><span className="text-white/30 mx-1.5">–</span><span className="text-white">{en.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span></>}
          </p>
          {shift.location && (
            <p className="text-[11px] text-white/50 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {shift.location}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
            style={{ background: `${status.color}1F`, color: status.color }}
          >{status.label}</span>
          <ChevronRight size={14} className="text-white/30" />
        </div>
      </div>
    </motion.div>
  );
}

export function EmptyState({ icon: Icon, title, sub, action }) {
  return <PremiumEmpty icon={Icon} title={title} sub={sub} action={action} />;
}
