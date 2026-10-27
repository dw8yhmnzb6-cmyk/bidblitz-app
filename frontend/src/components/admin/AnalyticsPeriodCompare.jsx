import { useEffect, useRef, useState } from "react";
import {
  checkedPeriodComparison, PERIOD_EVENT_LABELS,
  PERIOD_PROJECT_LABELS,
} from "./analyticsPeriodComparison";

const API = process.env.REACT_APP_BACKEND_URL || "";
const MAX_COMPARE_CSV_BYTES = 2 * 1024 * 1024;
const format = (value) => new Intl.NumberFormat("de-DE").format(value);
const signed = (value) => value > 0 ? "+" + format(value) : format(value);
// This percentage describes recorded events only, never visitor or revenue growth.
// A zero baseline is not a mathematically meaningful percentage.
const percentChange = (current, previous) => previous === 0 ? "—" :
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(
    ((current - previous) / previous) * 100,
  ) + " %";

// Loaded only by explicit admin interaction, using the existing session.
// Parent unmounts on missing/expired portfolio authorization and period changes.
export default function AnalyticsPeriodCompare({ days, selected }) {
  const [opened, setOpened] = useState(false);
  const [retry, setRetry] = useState(0);
  const [metric, setMetric] = useState("page_view");
  const [sortMode, setSortMode] = useState("project");
  const [result, setResult] = useState({ loading: false, data: null, error: "" });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportController = useRef(null);

  useEffect(() => () => {
    exportController.current?.abort();
    exportController.current = null;
  }, []);

  function refreshComparison() {
    exportController.current?.abort();
    exportController.current = null;
    setExporting(false);
    setExportError("");
    setRetry((value) => value + 1);
  }

  async function downloadComparisonCsv() {
    // The API export always contains the full server-authorized catalog,
    // regardless of which project is selected in the dashboard.
    if (result.loading || !result.data || result.data.period_days !== days ||
        exportController.current) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(
        API + "/api/analytics/v1/portfolio/period-compare/export.csv?days=" + days,
        { credentials: "include", signal: controller.signal,
          headers: { Accept: "text/csv" } },
      );
      if (!response.ok) {
        const message = response.status === 401 ? "Bitte erneut anmelden." :
          response.status === 403 ? "Für den Vergleichs-CSV-Export sind Adminrechte erforderlich." :
            response.status === 404 ? "Der Vergleichs-CSV-Export ist noch nicht verfügbar." :
              "Der Vergleichs-CSV-Export ist derzeit nicht verfügbar.";
        throw new Error(message);
      }
      const contentType = response.headers?.get?.("content-type") ?? "";
      const rawLength = response.headers?.get?.("content-length");
      const announced = rawLength == null ? null : Number(rawLength);
      if (contentType.toLowerCase().split(";")[0].trim() !== "text/csv" ||
          (announced !== null &&
           (!Number.isSafeInteger(announced) || announced < 0 ||
            announced > MAX_COMPARE_CSV_BYTES))) {
        throw new Error("Die API hat keine gültige CSV-Datei geliefert.");
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (!blob || !Number.isSafeInteger(blob.size) || blob.size < 1 ||
          blob.size > MAX_COMPARE_CSV_BYTES) {
        throw new Error("Die CSV-Datei ist leer oder zu groß.");
      }
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        // Never use server-controlled filenames or the project selection.
        anchor.download = "bidblitz-v1-period-compare-" + days + "d.csv";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        // Allow mobile browsers to begin the download before revocation.
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (error) {
      if (!controller.signal.aborted && exportController.current === controller) {
        const allowed = [
          "Bitte erneut anmelden.",
          "Für den Vergleichs-CSV-Export sind Adminrechte erforderlich.",
          "Der Vergleichs-CSV-Export ist noch nicht verfügbar.",
          "Die API hat keine gültige CSV-Datei geliefert.",
          "Die CSV-Datei ist leer oder zu groß.",
        ];
        setExportError(allowed.includes(error?.message) ? error.message :
          "Der Vergleichs-CSV-Export konnte nicht erstellt werden.");
      }
    } finally {
      if (exportController.current === controller) {
        exportController.current = null;
        setExporting(false);
      }
    }
  }

  useEffect(() => {
    if (!opened) return undefined;
    const controller = new AbortController();
    let active = true;
    setResult({ loading: true, data: null, error: "" });

    async function load() {
      try {
        const response = await fetch(
          `${API}/api/analytics/v1/portfolio/period-compare?days=${days}`,
          {
            credentials: "include", signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok) {
          const message = response.status === 401 ? "Bitte erneut anmelden." :
            response.status === 403 ? "Für den Zeitvergleich sind Adminrechte erforderlich." :
              response.status === 404 ? "Die Zeitvergleich-API ist hier noch nicht verfügbar." :
                "Der Zeitvergleich ist derzeit nicht verfügbar.";
          throw new Error(message);
        }
        const data = checkedPeriodComparison(await response.json(), days);
        if (active) setResult({ loading: false, data, error: "" });
      } catch (error) {
        if (active && !controller.signal.aborted) {
          // API, parsing or validation errors never disclose server internals.
          const allowed = [
            "Bitte erneut anmelden.",
            "Für den Zeitvergleich sind Adminrechte erforderlich.",
            "Die Zeitvergleich-API ist hier noch nicht verfügbar.",
          ];
          setResult({
            loading: false, data: null,
            error: allowed.includes(error?.message) ? error.message :
              "Der Zeitvergleich konnte nicht sicher geladen werden.",
          });
        }
      }
    }

    load();
    return () => { active = false; controller.abort(); };
  }, [opened, days, retry]);

  const data = result.data;
  const rows = data?.projects.filter((row) => !selected || row.project === selected) ?? [];
  const orderedRows = [...rows].sort((a, b) => {
    const currentDiff = b.current_events[metric] - a.current_events[metric];
    const changeDiff = b.recorded_event_change[metric] - a.recorded_event_change[metric];
    const comparison = sortMode === "current" ? currentDiff :
      sortMode === "change_desc" ? changeDiff :
        sortMode === "change_asc" ? -changeDiff :
          sortMode === "coverage" ?
            b.current_recorded_utc_days - a.current_recorded_utc_days : 0;
    return comparison || PERIOD_PROJECT_LABELS[a.project].localeCompare(
      PERIOD_PROJECT_LABELS[b.project], "de",
    );
  });
  const eventLabel = PERIOD_EVENT_LABELS[metric];
  return (
    <section aria-label="Zeitraumvergleich" className="rounded-xl border border-blue-900 bg-slate-900 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-blue-200">Aktueller Zeitraum gegen Vorperiode</h2>
          <p className="text-xs text-slate-400 mt-1">
            Je {days} Tage in UTC. Nur aufgezeichnete Ereignisse – keine eindeutigen Besucher,
            Kundenverluste oder bestätigten Umsätze.
          </p>
        </div>
        {!opened ? (
          <button type="button" onClick={() => setOpened(true)}
            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold">
            Vorperioden vergleichen
          </button>
        ) : (
          <button type="button" onClick={refreshComparison}
            disabled={result.loading}
            className="rounded-lg border border-blue-600 px-3 py-2 text-sm disabled:opacity-50">
            Zeitvergleich aktualisieren
          </button>
        )}
      </div>

      {result.loading && <p role="status" className="text-sm text-blue-200">Zeitvergleich wird geladen …</p>}
      {result.error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm">{result.error}</p>}
      {!result.loading && data && <>
        <p className="text-xs text-slate-400">
          Aktuell: {data.windows.current.start_inclusive} bis {data.windows.current.end_inclusive} (einschließlich).
          Vorperiode: {data.windows.previous.start_inclusive} bis {data.windows.previous.end_exclusive} (Ende ausschließlich).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={downloadComparisonCsv}
            disabled={exporting || result.loading}
            aria-busy={exporting}
            className="rounded-lg border border-blue-500 px-3 py-2 text-sm font-semibold disabled:opacity-50">
            {exporting ? "Vergleichs-CSV wird vorbereitet …" : "Zeitvergleich als CSV exportieren"}
          </button>
          <span className="text-xs text-slate-400">
            Export umfasst alle 10 registrierten Projekte, unabhängig vom Projektfilter.
            Keine bestätigten Zahlungen oder eindeutigen Besucher.
          </span>
        </div>
        {exportError && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm">{exportError}</p>}
        <label className="flex flex-col gap-2 text-xs text-slate-400 max-w-sm">
          Zeitvergleich-Metrik
          <select aria-label="Zeitvergleich-Metrik" value={metric}
            onChange={(event) => setMetric(event.target.value)}
            className="rounded-lg bg-slate-950 text-white border border-slate-700 px-3 py-2 text-sm">
            {Object.entries(PERIOD_EVENT_LABELS).map(([event, label]) =>
              <option key={event} value={event}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs text-slate-400 max-w-sm">
          Projekt-Reihenfolge
          <select aria-label="Zeitvergleich-Sortierung" value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="rounded-lg bg-slate-950 text-white border border-slate-700 px-3 py-2 text-sm">
            <option value="project">Projektname</option>
            <option value="current">Aktuelle Ereignisse (meiste zuerst)</option>
            <option value="change_desc">Ereignisänderung (größte zuerst)</option>
            <option value="change_asc">Ereignisänderung (kleinste zuerst)</option>
            <option value="coverage">Aufzeichnungstage (meiste zuerst)</option>
          </select>
        </label>
        <div className="overflow-x-auto">
          <table aria-label="Aufgezeichnete Ereignisse nach Zeiträumen"
            className="w-full min-w-[680px] text-left text-xs sm:text-sm">
            <caption className="sr-only">{eventLabel} in zwei angrenzenden Zeiträumen</caption>
            <thead><tr className="border-b border-slate-700 text-slate-300">
              <th scope="col" className="p-2">Projekt</th>
              <th scope="col" className="p-2 text-right">Aktuell</th>
              <th scope="col" className="p-2 text-right">Vorperiode</th>
              <th scope="col" className="p-2 text-right">Differenz</th>
              <th scope="col" className="p-2 text-right">Änderung (%)</th>
              <th scope="col" className="p-2 text-right">Erfasste UTC-Tage aktuell / zuvor</th>
            </tr></thead>
            <tbody>
              {orderedRows.map((row) => <tr key={row.project} className="border-b border-slate-800">
                <th scope="row" className="p-2 font-medium">{PERIOD_PROJECT_LABELS[row.project]}</th>
                <td className="p-2 text-right tabular-nums">{format(row.current_events[metric])}</td>
                <td className="p-2 text-right tabular-nums">{format(row.previous_events[metric])}</td>
                <td className="p-2 text-right tabular-nums">{signed(row.recorded_event_change[metric])}</td>
                <td className="p-2 text-right tabular-nums">{percentChange(row.current_events[metric], row.previous_events[metric])}</td>
                <td className="p-2 text-right tabular-nums">{row.current_recorded_utc_days} / {row.previous_recorded_utc_days}</td>
              </tr>)}
            </tbody>
            {!selected && <tfoot><tr className="font-semibold border-t border-slate-600">
              <th scope="row" className="p-2">Gesamt (aufgezeichnet)</th>
              <td className="p-2 text-right tabular-nums">{format(data.summary.current_events[metric])}</td>
              <td className="p-2 text-right tabular-nums">{format(data.summary.previous_events[metric])}</td>
              <td className="p-2 text-right tabular-nums">{signed(data.summary.recorded_event_change[metric])}</td>
              <td className="p-2 text-right tabular-nums">{percentChange(data.summary.current_events[metric], data.summary.previous_events[metric])}</td>
              <td className="p-2 text-right tabular-nums">—</td>
            </tr></tfoot>}
          </table>
        </div>
        <p className="text-xs text-amber-200">
          Erfasste Projekte: {data.summary.current_projects_with_events} aktuell,
          {data.summary.previous_projects_with_events} zuvor.
          Fehlende Aufzeichnungen sind kein Nachweis für null Besucher.
          Ein abgeschlossenes Checkout-Ereignis ist keine verifizierte Zahlung.
          Prozentänderungen vergleichen nur aufgezeichnete Ereignisse; bei null
          Ereignissen in der Vorperiode ist die Rate nicht berechenbar (—).
        </p>
      </>}
    </section>
  );
}
