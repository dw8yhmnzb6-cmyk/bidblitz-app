import { useState } from "react";
import { WEEKDAY_EVENT_LABELS } from "./analyticsWeekdayInsights";
import { recordedDayChanges, recordedDayChangesCsv } from "./analyticsRecordedDayChanges";

const format = (number) => new Intl.NumberFormat("de-DE").format(number);
const percent = (value) => value === null ? "—" :
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value) + " %";

export default function AnalyticsRecordedDayChanges({ daily, metric, scopeLabel }) {
  const [direction, setDirection] = useState("all");
  const [sortBy, setSortBy] = useState("absolute");
  const [exportError, setExportError] = useState("");
  // Data comes solely from the already admin-authorized and validated response.
  // No extra request; a missing day is never inferred to contain zero events.
  const summary = recordedDayChanges(daily, metric);
  const filtered = summary.rows.filter((row) =>
    direction === "up" ? row.delta > 0 :
      direction === "down" ? row.delta < 0 : true);
  const ordered = [...filtered].sort((a, b) => {
    if (sortBy === "recent") return b.day.localeCompare(a.day);
    const sizeA = Math.abs(a.delta);
    const sizeB = Math.abs(b.delta);
    return sizeA === sizeB ? b.day.localeCompare(a.day) : sizeB - sizeA;
  });
  const rows = ordered.slice(0, 10);

  function downloadCsv() {
    setExportError("");
    try {
      const csv = recordedDayChangesCsv({
        rows: ordered, comparablePairs: ordered.length,
      }, metric, scopeLabel);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "bidblitz-v1-utc-tagesaenderungen.csv";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch {
      setExportError("Der Tagesvergleich konnte in diesem Browser nicht exportiert werden.");
    }
  }

  return (
    <section aria-label="UTC-Tagesveränderungen"
      className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Veränderungen zwischen erfassten Tagen</h2>
          <p className="text-xs text-slate-400 mt-1">
            {scopeLabel} · {WEEKDAY_EVENT_LABELS[metric]} · UTC · ausgewählter Zeitraum
          </p>
        </div>
        <button type="button" onClick={downloadCsv} disabled={summary.comparablePairs === 0}
          className="rounded-lg border border-blue-600 px-3 py-2 text-sm disabled:opacity-40">
          Tagesvergleich als CSV exportieren
        </button>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        Es werden nur unmittelbar aufeinanderfolgende UTC-Tage mit tatsächlich erfassten
        V1-Ereignissen verglichen. Fehlende Tage sind unbekannt und zählen nicht als null.
        Das sind Änderungen von Ereigniszählern, keine Besucher-, Kunden-, Umsatz-,
        Konversions- oder Verfügbarkeitskennzahlen. Ein hoher Unterschied belegt keinen Fehler.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded border border-slate-700 px-3 py-2">
          Erfasste Tage: <strong>{format(summary.recordedDays)}</strong>
        </span>
        <span className="rounded border border-slate-700 px-3 py-2">
          Vergleichbare Tagespaare: <strong>{format(summary.comparablePairs)}</strong>
        </span>
        <span className="rounded border border-slate-700 px-3 py-2">
          Tage ohne erfassten direkten Vortag: <strong>{format(summary.daysWithoutPriorRecord)}</strong>
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Richtung der Ereignisänderung
          <select aria-label="Tagesänderung Richtung" value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            <option value="all">Alle Änderungen</option>
            <option value="up">Nur Zunahmen</option>
            <option value="down">Nur Abnahmen</option>
          </select>
        </label>
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Sortierung
          <select aria-label="Tagesänderung Sortierung" value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            <option value="absolute">Größte Unterschiede zuerst</option>
            <option value="recent">Neueste zuerst</option>
          </select>
        </label>
      </div>
      {exportError && <p role="alert" className="text-sm text-red-300">{exportError}</p>}
      {summary.comparablePairs === 0 ? (
        <p role="status" className="text-sm text-amber-300">
          Keine zwei direkt aufeinanderfolgenden aufgezeichneten UTC-Tage verfügbar.
          Eine Tagesänderung ist nicht belegbar.
        </p>
      ) : rows.length === 0 ? (
        <p role="status" className="text-sm text-slate-400">
          Für diese Richtung gibt es keine aufgezeichneten Änderungen.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="UTC-Tagesveränderungen Tabelle"
            className="w-full min-w-[660px] text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-700 text-slate-400">
              <tr>
                <th scope="col" className="p-2">Vortag UTC</th>
                <th scope="col" className="p-2">Tag UTC</th>
                <th scope="col" className="p-2 text-right">Vortag</th>
                <th scope="col" className="p-2 text-right">Tag</th>
                <th scope="col" className="p-2 text-right">Differenz</th>
                <th scope="col" className="p-2 text-right">Änderung in %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day} data-change-day={row.day}
                  className="border-b border-slate-800">
                  <td className="p-2 tabular-nums">{row.previousDay}</td>
                  <th scope="row" className="p-2 font-medium tabular-nums">{row.day}</th>
                  <td className="p-2 text-right tabular-nums">{format(row.previous)}</td>
                  <td className="p-2 text-right tabular-nums">{format(row.current)}</td>
                  <td className="p-2 text-right tabular-nums">{row.delta > 0 ? "+" : ""}{format(row.delta)}</td>
                  <td className="p-2 text-right tabular-nums">{percent(row.percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Es werden maximal zehn Zeilen angezeigt. Die CSV umfasst sämtliche
        belegbaren Tagespaare innerhalb des aktuellen Richtungsfilters. Prozentwerte
        fehlen bei einer Vorperiode mit null Ereignissen, statt ein Wachstum zu behaupten.
      </p>
    </section>
  );
}
