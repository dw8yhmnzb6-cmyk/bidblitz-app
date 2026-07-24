/**
 * BidBlitz Staff — Wochen-Timesheet (Connecteam-Style)
 * =====================================================
 * Mitarbeiter sehen ihre eigene Woche Tag-für-Tag:
 * Regular / Überstunden / Pause / Total + Abwesenheits-Marker.
 * Tap auf einen Tag → Day-Detail mit allen Events.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, Calendar, Coffee, Clock, TrendingUp, X, MapPin } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ACTION_LABEL = {
  clock_in: "Eingecheckt",
  clock_out: "Ausgecheckt",
  break_start: "Pause Start",
  break_end: "Pause Ende",
};
const ACTION_COLOR = {
  clock_in: "#10B981",
  clock_out: "#EF4444",
  break_start: "#F59E0B",
  break_end: "#06B6D4",
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ""; }
}

function DayDetailSheet({ date, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetch(`${API}/api/staff/timesheet/me/day?date=${date}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  return (
    <div
      data-testid="staff-day-detail-sheet"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[85vh] bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Tagesdetail</p>
            <p className="text-lg font-bold">{date && new Date(date).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}</p>
          </div>
          <button onClick={onClose} data-testid="staff-day-detail-close" className="p-2 rounded-lg hover:bg-white/5">
            <X size={18} className="text-white/60" />
          </button>
        </div>

        {loading && <div className="py-10 flex justify-center"><Loader2 size={20} className="animate-spin text-[#00C2FF]" /></div>}

        {!loading && data && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-5">
              <SummaryPill label="Regular" value={`${data.summary.regular_hours}h`} color="#10B981" />
              <SummaryPill label="Über" value={`${data.summary.overtime_hours}h`} color="#F59E0B" />
              <SummaryPill label="Pause" value={`${data.summary.break_hours}h`} color="#06B6D4" />
              <SummaryPill label="Gesamt" value={`${data.summary.total_hours}h`} color="#00C2FF" />
            </div>

            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Buchungen ({data.events.length})</p>
            {data.events.length === 0 ? (
              <p className="text-sm text-white/40 py-6 text-center">Keine Buchungen an diesem Tag</p>
            ) : (
              <div className="space-y-2">
                {data.events.map((ev) => (
                  <div key={ev.id} data-testid="staff-day-event-row" className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: ACTION_COLOR[ev.action] || "#888" }} />
                        <p className="text-sm font-semibold">{ACTION_LABEL[ev.action] || ev.action}</p>
                      </div>
                      <p className="text-xs text-white/60 font-mono">{formatTime(ev.timestamp)}</p>
                    </div>
                    {(ev.customer || ev.project || ev.equipment || ev.kilometers || ev.note) && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        {ev.customer && <DetailKV k="Kunde" v={ev.customer} />}
                        {ev.project && <DetailKV k="Projekt" v={ev.project} />}
                        {ev.equipment && <DetailKV k="Gerät" v={ev.equipment} />}
                        {ev.kilometers != null && <DetailKV k="KM" v={`${ev.kilometers} km`} />}
                        {ev.note && <div className="col-span-2"><DetailKV k="Notiz" v={ev.note} /></div>}
                      </div>
                    )}
                    {(ev.lat != null && ev.lng != null) && (
                      <p className="mt-2 text-[10px] text-white/40 flex items-center gap-1">
                        <MapPin size={10} /> {ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DetailKV({ k, v }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-widest text-white/40">{k}</span>
      <span className="text-white/85 truncate">{v}</span>
    </div>
  );
}

function SummaryPill({ label, value, color }) {
  return (
    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-center">
      <p className="text-[9px] uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

export default function StaffWeeklyTimesheet() {
  const [weeksBack, setWeeksBack] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailDate, setDetailDate] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/staff/timesheet/me/weekly?weeks_back=${weeksBack}`, { credentials: "include" });
      if (r.ok) setData(await r.json());
    } catch (e) {}
    setLoading(false);
  }, [weeksBack]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/10" data-testid="staff-weekly-timesheet">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#00C2FF]/15 text-[#00C2FF] flex items-center justify-center">
            <Calendar size={16} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Mein Timesheet</p>
            <p className="text-sm font-semibold">
              {data ? `${new Date(data.week_start).toLocaleDateString("de-DE")} – ${new Date(data.week_end).toLocaleDateString("de-DE")}` : "..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="staff-week-prev"
            onClick={() => setWeeksBack((w) => w + 1)}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/10"
          ><ChevronLeft size={16} /></button>
          <button
            data-testid="staff-week-next"
            onClick={() => setWeeksBack((w) => Math.max(0, w - 1))}
            disabled={weeksBack === 0}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/10 disabled:opacity-40"
          ><ChevronRight size={16} /></button>
        </div>
      </div>

      {loading && <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-[#00C2FF]" /></div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <KPI icon={Clock} label="Regular" value={`${data.totals.regular_hours}h`} color="#10B981" />
            <KPI icon={TrendingUp} label="Über" value={`${data.totals.overtime_hours}h`} color="#F59E0B" />
            <KPI icon={Coffee} label="Pause" value={`${data.totals.break_hours}h`} color="#06B6D4" />
            <KPI icon={Calendar} label="Gesamt" value={`${data.totals.total_hours}h`} color="#00C2FF" />
          </div>

          <div className="space-y-1.5">
            {data.days.map((d) => {
              const isToday = d.date === new Date().toISOString().slice(0, 10);
              const hasWork = d.total_hours > 0;
              return (
                <button
                  key={d.date}
                  onClick={() => setDetailDate(d.date)}
                  data-testid={`staff-week-day-${d.date}`}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                    isToday ? "bg-[#00C2FF]/10 border border-[#00C2FF]/30" : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="w-10 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-white/40">{d.weekday}</p>
                    <p className="text-sm font-bold">{new Date(d.date).getDate()}</p>
                  </div>
                  <div className="flex-1 text-left">
                    {d.absence ? (
                      <p className="text-xs text-[#F59E0B] font-semibold">Abwesend (Urlaub/Krank)</p>
                    ) : hasWork ? (
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-[#10B981]">Reg: <b>{d.regular_hours}h</b></span>
                        {d.overtime_hours > 0 && <span className="text-[#F59E0B]">ÜS: <b>{d.overtime_hours}h</b></span>}
                        {d.break_hours > 0 && <span className="text-[#06B6D4]">Pause: <b>{d.break_hours}h</b></span>}
                      </div>
                    ) : (
                      <p className="text-xs text-white/40">Kein Eintrag</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{d.total_hours}h</p>
                    <p className="text-[9px] text-white/40">Total</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {detailDate && <DayDetailSheet date={detailDate} onClose={() => setDetailDate(null)} />}
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }) {
  return (
    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon size={10} style={{ color }} />
        <p className="text-[9px] uppercase tracking-widest text-white/40">{label}</p>
      </div>
      <p className="text-base font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
