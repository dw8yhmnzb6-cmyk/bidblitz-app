import { useState } from "react";
import { WEEKDAY_EVENT_LABELS, weekdayCsv, weekdaySummary } from "./analyticsWeekdayInsights";

const format = (value) => new Intl.NumberFormat("de-DE").format(value);
const decimal = (value) => new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
}).format(value);

// This component receives only the already validated admin V1 daily report.
// No second request or client-supplied project scope is used.
export default function AnalyticsWeekdayInsights({ daily, metric, scopeLabel }) {
  const [exportError, setExportError] = useState("");
  const rows = weekdaySummary(daily);
  const peak = Math.max(0, ...rows.map((row) => row.totals[metric] ?? 0));
  const hasRecordedDays = rows.some((row) => row.recordedDays > 0);
  const metricLabel = WEEKDAY_EVENT_LABELS[metric] ?? "Ereignisse";

  function downloadWeekdays() {
    if (!hasRecordedDays) return;
    setExportError("");
    try {
      // The only interpolated values in the CSV are verified event counters.
      const csv = weekdayCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "bidblitz-v1-utc-wochentage.csv";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        // Give mobile browsers an opportunity to start the local download.
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch {
      // Never expose browser/implementation errors or any server data.
      setExportError("Der Wochentags-CSV-Export ist in diesem Browser nicht verfügbar.");
    }
  }

  return (
    <section aria-label="UTC-Wochentagsanalyse"
      className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Ereignisaktivität nach Wochentag</h2>
          <p className="text-xs text-slate-400 mt-1">
            {scopeLabel} · {metricLabel} · UTC · ausgewählter Zeitraum
          </p>
        </div>
        <button type="button" onClick={downloadWeekdays} disabled={!hasRecordedDays}
          className="rounded-lg border border-blue-600 px-3 py-2 text-sm disabled:opacity-40">
          Wochentage als CSV exportieren
        </button>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Nur UTC-Tage mit mindestens einem aufgezeichneten V1-Ereignis fließen in die
        Durchschnittswerte ein. Fehlende Tage sind unbekannt, nicht null.
        Es handelt sich nicht um eindeutige Besucher, Kundenzahlen, Conversion-Raten,
        bestätigte Zahlungen oder einen Nachweis vollständiger Datenerfassung.
      </p>
      {exportError && <p role="alert" className="text-sm text-red-300">{exportError}</p>}
      {!hasRecordedDays ? (
        <p role="status" className="text-sm text-amber-300">
          Keine aufgezeichneten UTC-Tage vorhanden. Ein Wert von null ist nicht nachgewiesen.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="UTC-Wochentagsanalyse Tabelle"
            className="w-full min-w-[660px] text-left text-xs sm:text-sm">
            <caption className="sr-only">
              {metricLabel} und beobachtete Aktivitätstage nach UTC-Wochentag
            </caption>
            <thead className="border-b border-slate-700 text-slate-400">
              <tr>
                <th scope="col" className="p-2">Wochentag (UTC)</th>
                <th scope="col" className="p-2 text-right">Erfasste Tage</th>
                <th scope="col" className="p-2 text-right">Tage mit Metrik</th>
                <th scope="col" className="p-2 text-right">Ereignisse</th>
                <th scope="col" className="p-2 text-right">Ø pro erfasstem Tag</th>
                <th scope="col" className="p-2">Aufgezeichnete Verteilung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const count = row.totals[metric] ?? 0;
                const recorded = row.recordedDays > 0;
                return <tr key={row.weekday} data-weekday={row.weekday}
                  className="border-b border-slate-800">
                  <th scope="row" className="p-2 font-medium">{row.weekday}</th>
                  <td className="p-2 text-right tabular-nums">{format(row.recordedDays)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {recorded ? format(row.activeDays[metric] ?? 0) : "—"}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {recorded ? format(count) : "—"}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {recorded ? decimal(count / row.recordedDays) : "—"}
                  </td>
                  <td className="p-2 min-w-28">
                    {recorded ? <div aria-hidden="true" className="h-2 rounded bg-slate-800 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded"
                        style={{ width: `${peak ? (count / peak) * 100 : 0}%` }} />
                    </div> : "—"}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Die CSV enthält nur aggregierte V1-Ereigniszähler und Kennzahlen zu erfassten
        Tagen der aktuellen Projekt- und Zeitraumauswahl. Nicht erfasste Metrikwerte
        bleiben leer. Kein zusätzlicher API-Aufruf.
      </p>
    </section>
  );
}
