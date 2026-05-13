/**
 * BidBlitz Staff — Team Timesheet (Connecteam-Style)
 * ===================================================
 * Manager-Ansicht: alle Mitarbeiter mit
 * Regular / Überstunden / Pause / Abwesenheit / Total / Kosten.
 * Filter: Zeitraum (7/14/30 Tage). Klick auf Zeile → Day-Picker → Details.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Loader2, Users, Download, Filter, TrendingUp, Clock, Coffee, AlertCircle, X, Euro } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

function ManagerDayDetail({ row, date, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/staff/timesheet/manager/day-detail?staff_id=${row.staff_id}&date=${date}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, [row, date]);

  return (
    <div
      data-testid="manager-day-detail"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-2xl max-h-[85vh] bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">{row.name}</p>
            <p className="text-lg font-bold">{new Date(date).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5"><X size={18} /></button>
        </div>
        {loading && <Loader2 size={20} className="animate-spin text-[#00C2FF] mx-auto my-8" />}
        {!loading && data && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <Pill label="Regular" value={`${data.summary.regular_hours}h`} c="#10B981" />
              <Pill label="Über" value={`${data.summary.overtime_hours}h`} c="#F59E0B" />
              <Pill label="Pause" value={`${data.summary.break_hours}h`} c="#06B6D4" />
              <Pill label="Total" value={`${data.summary.total_hours}h`} c="#00C2FF" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Buchungen ({data.events.length})</p>
            {data.events.length === 0 ? (
              <p className="text-sm text-white/40 py-4 text-center">Keine Buchungen</p>
            ) : (
              <div className="space-y-2">
                {data.events.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{ev.action.replace("_", " ")}</p>
                      <p className="text-xs text-white/60 font-mono">
                        {new Date(ev.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {(ev.customer || ev.project || ev.equipment || ev.kilometers || ev.note) && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        {ev.customer && <KV k="Kunde" v={ev.customer} />}
                        {ev.project && <KV k="Projekt" v={ev.project} />}
                        {ev.equipment && <KV k="Gerät" v={ev.equipment} />}
                        {ev.kilometers != null && <KV k="KM" v={`${ev.kilometers} km`} />}
                        {ev.note && <div className="col-span-2"><KV k="Notiz" v={ev.note} /></div>}
                      </div>
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

function KV({ k, v }) {
  return <div className="flex flex-col"><span className="text-[9px] uppercase tracking-widest text-white/40">{k}</span><span className="text-white/85 truncate">{v}</span></div>;
}
function Pill({ label, value, c }) {
  return <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-center"><p className="text-[9px] uppercase tracking-widest text-white/40">{label}</p><p className="text-sm font-bold" style={{ color: c }}>{value}</p></div>;
}

export default function ManagerTeamTimesheet() {
  const [days, setDays] = useState(7);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rangeMode, setRangeMode] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // {row, date}
  const [dayPickerRow, setDayPickerRow] = useState(null);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = rangeMode && startDate && endDate
        ? `${API}/api/staff/timesheet/team-overview?start_date=${startDate}&end_date=${endDate}`
        : `${API}/api/staff/timesheet/team-overview?days=${days}`;
      const [r, pc] = await Promise.all([
        fetch(url, { credentials: "include" }),
        fetch(`${API}/api/staff/leave/counts`, { credentials: "include" }).catch(() => null),
      ]);
      if (r.ok) setData(await r.json());
      if (pc && pc.ok) setPending((await pc.json()).pending || 0);
    } catch (e) {}
    setLoading(false);
  }, [days, startDate, endDate, rangeMode]);

  useEffect(() => { load(); }, [load]);

  const downloadCSV = () => {
    const qs = rangeMode && startDate && endDate
      ? `start_date=${startDate}&end_date=${endDate}`
      : `days=${days}`;
    window.open(`${API}/api/staff/timesheet/team-overview.csv?${qs}`, "_blank");
  };

  return (
    <div className="rounded-3xl bg-white/[0.02] border border-white/10 p-4 sm:p-5" data-testid="manager-team-timesheet">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#A855F7]/15 text-[#A855F7] flex items-center justify-center"><Users size={18} /></div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Team Timesheet</p>
            <p className="text-base font-bold">Stundenübersicht (Connecteam-Style)</p>
          </div>
          {pending > 0 && (
            <button
              data-testid="manager-pending-requests-badge"
              className="ml-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F31260]/15 border border-[#F31260]/40 text-[#F31260] text-xs font-bold hover:bg-[#F31260]/20 transition-colors"
              title="Offene Anträge bearbeiten"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#F31260] opacity-70 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F31260]" />
              </span>
              <span className="tabular-nums">{pending}</span>
              <span className="hidden sm:inline">Pending Requests</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white/[0.04] border border-white/10 rounded-xl p-0.5">
            {[7, 14, 30].map((n) => (
              <button
                key={n}
                onClick={() => { setDays(n); setRangeMode(false); }}
                data-testid={`manager-period-${n}`}
                className={`px-3 py-1.5 text-xs rounded-lg ${days === n && !rangeMode ? "bg-[#00C2FF] text-black font-semibold" : "text-white/60"}`}
              >{n}T</button>
            ))}
            <button
              onClick={() => setRangeMode((v) => !v)}
              data-testid="manager-period-range"
              className={`px-3 py-1.5 text-xs rounded-lg ${rangeMode ? "bg-[#A855F7] text-white font-semibold" : "text-white/60"}`}
            >Zeitraum</button>
          </div>
          {rangeMode && (
            <>
              <input
                type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="manager-period-start-date"
                className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white"
              />
              <span className="text-white/40 text-xs">bis</span>
              <input
                type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="manager-period-end-date"
                className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white"
              />
            </>
          )}
          <button
            onClick={downloadCSV}
            data-testid="manager-csv-export"
            className="px-3 py-2 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs flex items-center gap-1.5 hover:bg-[#10B981]/15"
          >
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {loading && <div className="py-12 flex justify-center"><Loader2 size={22} className="animate-spin text-[#00C2FF]" /></div>}

      {!loading && data && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-5">
            <Stat icon={Clock} label="Regular" value={`${data.totals.regular_hours}h`} c="#10B981" />
            <Stat icon={TrendingUp} label="Überstunden" value={`${data.totals.overtime_hours}h`} c="#F59E0B" />
            <Stat icon={TrendingUp} label="Doppelt" value={`${data.totals.double_hours || 0}h`} c="#A855F7" />
            <Stat icon={Coffee} label="Pause" value={`${data.totals.break_hours}h`} c="#06B6D4" />
            <Stat icon={AlertCircle} label="Abwesend" value={`${data.totals.absence_days}T`} c="#EF4444" />
            <Stat icon={Users} label="Aktive MA" value={data.totals.active_staff} c="#00C2FF" />
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-white/40 border-b border-white/10">
                  <th className="py-2 pr-3">Mitarbeiter</th>
                  <th className="py-2 px-2 text-right hidden sm:table-cell">€/h</th>
                  <th className="py-2 px-2 text-right">Regular</th>
                  <th className="py-2 px-2 text-right">Über</th>
                  <th className="py-2 px-2 text-right hidden lg:table-cell">Doppelt</th>
                  <th className="py-2 px-2 text-right hidden sm:table-cell">Pause</th>
                  <th className="py-2 px-2 text-right hidden md:table-cell">Abw.</th>
                  <th className="py-2 px-2 text-right">Gesamt</th>
                  <th className="py-2 pl-2 text-right">Kosten</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-white/40">Keine Daten im gewählten Zeitraum</td></tr>
                )}
                {data.rows.map((r) => (
                  <tr
                    key={r.staff_id}
                    onClick={() => setDayPickerRow(r)}
                    data-testid={`manager-team-row-${r.staff_id}`}
                    className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#A855F7] flex items-center justify-center text-xs font-bold">
                          {r.name?.slice(0, 1)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{r.name}</p>
                          <p className="text-[10px] text-white/40">{r.staff_role || "Mitarbeiter"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-white/60 hidden sm:table-cell">€{r.hourly_rate.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right text-[#10B981] font-semibold">{r.regular_hours}h</td>
                    <td className="py-3 px-2 text-right text-[#F59E0B] font-semibold">{r.overtime_hours}h</td>
                    <td className="py-3 px-2 text-right text-[#A855F7] hidden lg:table-cell">{r.double_hours || 0}h</td>
                    <td className="py-3 px-2 text-right text-[#06B6D4] hidden sm:table-cell">{r.break_hours}h</td>
                    <td className="py-3 px-2 text-right text-[#EF4444] hidden md:table-cell">{r.absence_days}T</td>
                    <td className="py-3 px-2 text-right font-bold text-white">{r.total_hours}h</td>
                    <td className="py-3 pl-2 text-right text-white/80"><span className="inline-flex items-center gap-1"><Euro size={11} className="text-white/40" />{r.cost_eur.toFixed(2)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-[10px] text-white/40 text-center">
            Zeitraum: {data.period_start} – {data.period_end} · Überstunden ab 8h/Tag (1,25× Zuschlag) · Sonntag/Feiertag = 2× Lohn
          </p>
        </>
      )}

      {dayPickerRow && (
        <DayPicker
          row={dayPickerRow}
          onPick={(d) => { setDetail({ row: dayPickerRow, date: d }); setDayPickerRow(null); }}
          onClose={() => setDayPickerRow(null)}
          days={days}
        />
      )}
      {detail && <ManagerDayDetail {...detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DayPicker({ row, onPick, onClose, days }) {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md max-h-[85vh] bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 overflow-y-auto" data-testid="manager-day-picker">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">{row.name} – Tag wählen</p>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5"><X size={16} /></button>
        </div>
        <div className="space-y-1.5">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => onPick(d)}
              data-testid={`manager-pick-day-${d}`}
              className="w-full p-2.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-sm text-left"
            >
              {new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, c }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={11} style={{ color: c }} />
        <p className="text-[9px] uppercase tracking-widest text-white/40">{label}</p>
      </div>
      <p className="text-lg font-bold" style={{ color: c }}>{value}</p>
    </div>
  );
}
