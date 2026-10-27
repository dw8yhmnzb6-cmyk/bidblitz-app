import { useEffect, useRef, useState } from "react";

const API = process.env.REACT_APP_BACKEND_URL || "";
const PROJECT_LABELS = {
  bidblitz_main: "BidBlitz Hauptapp", trade: "Trade", eyes: "The Eye",
  power: "Power", verify: "Verify", iptv: "IPTV", games: "Games",
  fuel: "Fuel", identity: "BidBlitz ID", stack: "Stack",
};
const EVENTS = ["page_view", "cta_click", "signup_started", "signup_completed",
  "checkout_started", "checkout_completed", "flow_abandoned"];
const number = (value) => new Intl.NumberFormat("de-DE").format(value);
const MAX_CSV_BYTES = 2 * 1024 * 1024; // Maximum for a 90-day, 10-project event-only export.
const TREND_LABELS = {
  page_view: "Seitenaufrufe",
  cta_click: "Klicks",
  signup_started: "Registrierungen begonnen",
  signup_completed: "Registrierungen abgeschlossen",
  checkout_started: "Bezahlvorgänge gestartet",
  checkout_completed: "Bezahlvorgänge abgeschlossen (Ereignisse)",
  flow_abandoned: "Abbrüche",
};
const SORT_LABELS = {
  registry: "Projektkatalog",
  recorded_days: "Tage mit Ereignissen",
  recorded_last_day: "Letzter aufgezeichneter UTC-Tag",
  page_view: "Seitenaufrufe",
  cta_click: "Klicks",
  signup_started: "Registrierungen begonnen",
  signup_completed: "Registrierungen abgeschlossen",
  checkout_started: "Bezahlvorgänge gestartet",
  checkout_completed: "Bezahlvorgänge abgeschlossen",
  flow_abandoned: "Abbrüche",
};

// Only fixed, application-owned errors are displayed to admins.
class DisplayableAnalyticsError extends Error {}

// Python API emits an ISO-8601 UTC timestamp (+00:00). Reject timezone-free,
// non-UTC or normalized invalid dates before using its date for UTC buckets.
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/;
function isUtcTimestamp(value) {
  if (typeof value !== "string" || !UTC_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  // Date.parse normalizes some invalid wall-clock timestamps: validate every
  // supplied UTC component instead of checking only the calendar day.
  const actual = new Date(parsed).toISOString();
  const expected = value.replace(/(?:Z|\+00:00)$/, "");
  const [whole, fraction = ""] = expected.split(".");
  return actual.slice(0, 19) === whole &&
    actual.slice(20, 23) === (fraction + "000").slice(0, 3);
}

function checkedReports(data, days) {
  if (!data || data.period_days !== days || !Array.isArray(data.projects) ||
      data.data_scope !== "v1_project_events_only" || data.timezone !== "UTC" ||
      data.verified_revenue_included !== false || !isUtcTimestamp(data.as_of)) {
    throw new DisplayableAnalyticsError("Die API hat kein gültiges Portfolio geliefert.");
  }
  const seen = new Set();
  const expected = Object.fromEntries(EVENTS.map((event) => [event, 0]));
  const expectedDaily = {};
  let projectsWithEvents = 0;
  const earliest = new Date(Date.parse(data.as_of) - days * 86400000).toISOString().slice(0, 10);
  for (const report of data.projects) {
    if (!report || !Object.hasOwn(PROJECT_LABELS, report.project) || seen.has(report.project) ||
        report.period_days !== days || report.data_scope !== "v1_project_events_only" ||
        report.verified_revenue_included !== false || !report.totals ||
        typeof report.totals !== "object" || Array.isArray(report.totals)) {
      throw new DisplayableAnalyticsError("Die API hat ungültige Projektwerte geliefert.");
    }
    seen.add(report.project);
    for (const [event, count] of Object.entries(report.totals)) {
      if (!EVENTS.includes(event) || !Number.isSafeInteger(count) || count < 0 ||
          expected[event] > Number.MAX_SAFE_INTEGER - count) {
        throw new DisplayableAnalyticsError("Die API hat ungültige Ereigniszähler geliefert.");
      }
      expected[event] += count;
    }
    if (EVENTS.some((event) => (report.totals[event] ?? 0) > 0)) projectsWithEvents += 1;
    // The daily buckets share the same server-scoped source as the totals.
    // Reject inconsistent or malformed history rather than drawing a false trend.
    const daily = report.daily;
    if (!daily || typeof daily !== "object" || Array.isArray(daily) ||
        Object.keys(daily).length > days + 1) {
      throw new DisplayableAnalyticsError("Die API hat ungültige Tagesdaten geliefert.");
    }
    const dailyTotals = Object.fromEntries(EVENTS.map((event) => [event, 0]));
    for (const [day, counts] of Object.entries(daily)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
          Number.isNaN(Date.parse(day + "T00:00:00Z")) ||
          new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day ||
          day < earliest || day > data.as_of.slice(0, 10) ||
          !counts || typeof counts !== "object" || Array.isArray(counts)) {
        throw new DisplayableAnalyticsError("Die API hat ungültige Tagesdaten geliefert.");
      }
      if (!Object.values(counts).some((count) => Number.isSafeInteger(count) && count > 0)) {
        throw new DisplayableAnalyticsError("Die API hat leere Tagesaufzeichnungen geliefert.");
      }
      for (const [event, count] of Object.entries(counts)) {
        if (!EVENTS.includes(event) || !Number.isSafeInteger(count) || count < 0 ||
            dailyTotals[event] > Number.MAX_SAFE_INTEGER - count) {
          throw new DisplayableAnalyticsError("Die API hat ungültige Tageszähler geliefert.");
        }
        dailyTotals[event] += count;
        if (count > 0) {
          const bucket = expectedDaily[day] ?? (expectedDaily[day] = {});
          if ((bucket[event] ?? 0) > Number.MAX_SAFE_INTEGER - count) {
            throw new DisplayableAnalyticsError("Die Tageszähler überschreiten den sicheren Wertebereich.");
          }
          bucket[event] = (bucket[event] ?? 0) + count;
        }
      }
    }
    if (EVENTS.some((event) => dailyTotals[event] !== (report.totals[event] ?? 0))) {
      throw new DisplayableAnalyticsError("Die Tagesdaten stimmen nicht mit den Projektwerten überein.");
    }
  }
  // The admin portfolio API returns every registered first-party project,
  // including projects with no events. A partial response must not appear as
  // a complete cross-project total, even if its own summary is consistent.
  if (seen.size !== Object.keys(PROJECT_LABELS).length) {
    throw new DisplayableAnalyticsError("Die API hat nicht alle registrierten Projekte geliefert.");
  }
  const summary = data.summary;
  if (!summary || summary.project_count !== seen.size ||
      summary.data_scope !== "v1_project_events_only" ||
      summary.verified_revenue_included !== false || summary.unique_visitors !== null ||
      summary.net_profit_available !== false || !summary.totals ||
      typeof summary.totals !== "object" || Array.isArray(summary.totals)) {
    throw new DisplayableAnalyticsError("Die API hat keine gültige Gesamtübersicht geliefert.");
  }
  for (const [event, count] of Object.entries(summary.totals)) {
    if (!EVENTS.includes(event) || !Number.isSafeInteger(count) || count < 0) {
      throw new DisplayableAnalyticsError("Die API hat ungültige Gesamtzähler geliefert.");
    }
  }
  if (EVENTS.some((event) => (summary.totals[event] ?? 0) !== expected[event])) {
    throw new DisplayableAnalyticsError("Die Gesamtübersicht stimmt nicht mit den Projektwerten überein.");
  }
  if (!Number.isSafeInteger(summary.projects_with_events) ||
      !Number.isSafeInteger(summary.projects_without_events) ||
      summary.projects_with_events !== projectsWithEvents ||
      summary.projects_without_events !== seen.size - projectsWithEvents) {
    throw new DisplayableAnalyticsError("Die Projektabdeckung der API ist widersprüchlich.");
  }
  if (!summary.daily || typeof summary.daily !== "object" || Array.isArray(summary.daily) ||
      Object.keys(summary.daily).length !== Object.keys(expectedDaily).length) {
    throw new DisplayableAnalyticsError("Die Gesamt-Tagesdaten sind unvollständig.");
  }
  for (const [day, counts] of Object.entries(summary.daily)) {
    const expectedBucket = expectedDaily[day];
    if (!expectedBucket || !counts || typeof counts !== "object" || Array.isArray(counts) ||
        Object.keys(counts).length !== Object.keys(expectedBucket).length ||
        Object.entries(counts).some(([event, count]) =>
          !EVENTS.includes(event) || !Number.isSafeInteger(count) || count < 0 ||
          count !== expectedBucket[event])) {
      throw new DisplayableAnalyticsError("Die Gesamt-Tagesdaten stimmen nicht mit den Projekten überein.");
    }
  }
  return data;
}

export default function AnalyticsPortfolioPanel({ onBack }) {
  const [days, setDays] = useState(7);
  const [selected, setSelected] = useState("");
  const [trendEvent, setTrendEvent] = useState("page_view");
  const [sortEvent, setSortEvent] = useState("registry");
  const [sortDirection, setSortDirection] = useState("desc");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportController = useRef(null);

  // Prevent any in-flight CSV from downloading after navigating away.
  useEffect(() => () => {
    exportController.current?.abort();
    exportController.current = null;
  }, []);

  function cancelExport() {
    exportController.current?.abort();
    exportController.current = null;
    setExporting(false);
    setExportError("");
  }

  async function downloadCsv() {
    // The server owns the full authorized project scope, not the UI filter.
    if (state.loading || !state.data || state.data.period_days !== days ||
        exportController.current) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(API + "/api/analytics/v1/portfolio/export.csv?days=" + days, {
        credentials: "include", signal: controller.signal,
        headers: { Accept: "text/csv" },
      });
      if (!response.ok) {
        const message = response.status === 401 ? "Bitte erneut anmelden." :
          response.status === 403 ? "Für den CSV-Export sind Adminrechte erforderlich." :
            response.status === 404 ? "Der CSV-Export ist hier noch nicht verfügbar." :
              "Der CSV-Export ist derzeit nicht verfügbar.";
        throw new DisplayableAnalyticsError(message);
      }
      const contentType = response.headers?.get?.("content-type") ?? "";
      const rawLength = response.headers?.get?.("content-length");
      const announcedLength = rawLength == null ? null : Number(rawLength);
      if (contentType.toLowerCase().split(";")[0].trim() !== "text/csv" ||
          (announcedLength !== null &&
           (!Number.isSafeInteger(announcedLength) ||
            announcedLength < 0 || announcedLength > MAX_CSV_BYTES))) {
        throw new DisplayableAnalyticsError("Die API hat keine gültige CSV-Datei geliefert.");
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (!blob || blob.size === 0 || blob.size > MAX_CSV_BYTES) {
        throw new DisplayableAnalyticsError("Die CSV-Datei ist leer oder zu groß.");
      }
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        // Ignore untrusted Content-Disposition filenames.
        anchor.download = "bidblitz-v1-events-" + days + "d.csv";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        // Mobile browsers may require time to initiate the blob download.
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (error) {
      if (!controller.signal.aborted && exportController.current === controller) {
        setExportError(error instanceof DisplayableAnalyticsError ? error.message :
          "Der CSV-Export konnte nicht erstellt werden.");
      }
    } finally {
      if (exportController.current === controller) {
        exportController.current = null;
        setExporting(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ loading: true, data: null, error: "" });
    async function load() {
      try {
        const response = await fetch(`${API}/api/analytics/v1/portfolio?days=${days}`, {
          credentials: "include", signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          const message = response.status === 401 ? "Bitte erneut anmelden." :
            response.status === 403 ? "Für diese Übersicht sind Adminrechte erforderlich." :
              response.status === 404 ? "Die Portfolio-API ist hier noch nicht verfügbar." :
                "Die Analysedaten konnten nicht geladen werden.";
          throw new DisplayableAnalyticsError(message);
        }
        const data = checkedReports(await response.json(), days);
        if (active) setState({ loading: false, data, error: "" });
      } catch (error) {
        if (active && error?.name !== "AbortError") {
          setState({ loading: false, data: null,
            error: error instanceof SyntaxError ? "Die API-Antwort ist kein gültiges JSON." :
              error instanceof DisplayableAnalyticsError ? error.message :
                "Die Analysedaten konnten nicht geladen werden." });
        }
      }
    }
    load();
    return () => { active = false; controller.abort(); };
  }, [days, attempt]);

  const reports = state.data?.projects || [];
  const visible = selected ? reports.filter((report) => report.project === selected) : reports;
  // Rank only validated, authorized reports; avoid large-number subtraction.
  const lastRecordedDay = (report) => Object.keys(report.daily).sort().slice(-1)[0] ?? "";
  const ranked = sortEvent === "registry" ? visible : [...visible].sort((left, right) => {
    const a = sortEvent === "recorded_days" ? Object.keys(left.daily).length :
      sortEvent === "recorded_last_day" ? lastRecordedDay(left) : (left.totals[sortEvent] ?? 0);
    const b = sortEvent === "recorded_days" ? Object.keys(right.daily).length :
      sortEvent === "recorded_last_day" ? lastRecordedDay(right) : (right.totals[sortEvent] ?? 0);
    // A missing date never means "the oldest event": rank unknowns last.
    if (sortEvent === "recorded_last_day" && (!a || !b) && a !== b) return a ? -1 : 1;
    if (a !== b) return (a < b ? -1 : 1) * (sortDirection === "asc" ? 1 : -1);
    return PROJECT_LABELS[left.project].localeCompare(PROJECT_LABELS[right.project], "de");
  });
  const total = (event) => selected
    ? visible.reduce((sum, report) => sum + (report.totals[event] || 0), 0)
    : (state.data?.summary.totals[event] ?? 0);
  // Server-owned cross-project rollup; selected project uses validated buckets.
  const trendBuckets = selected ? visible[0]?.daily : state.data?.summary.daily;
  const dailyViews = Object.entries(trendBuckets ?? {})
    .filter(([, counts]) => (counts[trendEvent] ?? 0) > 0)
    .sort(([a], [b]) => b.localeCompare(a)).slice(0, 14)
    .map(([day, counts]) => [day, counts[trendEvent]]);
  const largestDailyView = Math.max(0, ...dailyViews.map(([, count]) => count));
  const metrics = [
    ["Seitenaufrufe", total("page_view")],
    ["Abgeschlossene Registrierungen", total("signup_completed")],
    ["Gestartete Bezahlvorgänge", total("checkout_started")],
  ];
  const empty = visible.every((report) => Object.values(report.totals).every((count) => count === 0));

  return (
    <section className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-8" aria-label="Analytics Projektvergleich">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-widest text-blue-400">BIDBLITZ ANALYTICS</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2">Deine Projektübersicht</h1>
            <p className="text-sm text-slate-400 mt-2">Interne Admin-Ansicht · aufgezeichnete V1-Ereignisse</p>
          </div>
          {onBack && <button onClick={onBack} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Zurück</button>}
        </header>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs text-slate-400 flex flex-col gap-2">
            Zeitraum
            <select aria-label="Zeitraum" value={days} onChange={(event) => {
              cancelExport();
              setDays(Number(event.target.value));
            }}
              className="rounded-lg bg-slate-900 text-white border border-slate-700 px-3 py-2 text-sm">
              {[1, 7, 30, 90].map((value) => <option key={value} value={value}>{value === 1 ? "Letzte 24 Stunden" : `Letzte ${value} Tage`}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400 flex flex-col gap-2">
            Projekt
            <select aria-label="Projekt" value={selected} onChange={(event) => setSelected(event.target.value)}
              className="rounded-lg bg-slate-900 text-white border border-slate-700 px-3 py-2 text-sm">
              <option value="">Alle Projekte</option>
              {reports.map((report) => <option key={report.project} value={report.project}>{PROJECT_LABELS[report.project]}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400 flex flex-col gap-2">
            Tagesmetrik
            <select aria-label="Tagesmetrik" value={trendEvent}
              onChange={(event) => setTrendEvent(event.target.value)}
              className="rounded-lg bg-slate-900 text-white border border-slate-700 px-3 py-2 text-sm">
              {Object.entries(TREND_LABELS).map(([event, label]) =>
                <option key={event} value={event}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400 flex flex-col gap-2">
            Vergleich sortieren
            <select aria-label="Vergleich sortieren" value={sortEvent}
              onChange={(event) => setSortEvent(event.target.value)}
              className="rounded-lg bg-slate-900 text-white border border-slate-700 px-3 py-2 text-sm">
              {Object.entries(SORT_LABELS).map(([event, label]) =>
                <option key={event} value={event}>{label}</option>)}
            </select>
          </label>
          {sortEvent !== "registry" && <label className="text-xs text-slate-400 flex flex-col gap-2">
            Sortierrichtung
            <select aria-label="Sortierrichtung" value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value)}
              className="rounded-lg bg-slate-900 text-white border border-slate-700 px-3 py-2 text-sm">
              <option value="desc">Höchste zuerst</option>
              <option value="asc">Niedrigste zuerst</option>
            </select>
          </label>}
          <button onClick={() => { cancelExport(); setAttempt((value) => value + 1); }}
            disabled={state.loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Aktualisieren</button>
          <button type="button" onClick={downloadCsv}
            disabled={state.loading || !state.data || state.data.period_days !== days || exporting}
            aria-busy={exporting}
            className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {exporting ? "CSV wird vorbereitet …" : "CSV exportieren"}
          </button>
        </div>

        <p className="text-xs leading-relaxed text-slate-400">Rollierender Zeitraum in UTC. Seitenaufrufe sind keine eindeutigen Besucher. Diese Auswertung bestätigt weder einen gesunden Collector noch vollständige Datenabdeckung.</p>
        <p className="text-xs leading-relaxed text-slate-400">CSV-Export: immer alle registrierten Projekte im gewählten Zeitraum, unabhängig vom sichtbaren Projektfilter. Nur aufgezeichnete Ereignisse, keine Kunden- oder Umsatzdaten.</p>
        {exportError && <p role="alert" className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm">{exportError}</p>}

        {state.loading && <div role="status" className="rounded-xl border border-blue-900 bg-slate-900 p-6">Analysedaten werden geladen …</div>}
        {state.error && <div role="alert" className="rounded-xl border border-red-900 bg-red-950 p-5">
          <p>{state.error}</p>
          <button className="mt-3 underline" onClick={() => setAttempt((value) => value + 1)}>Erneut versuchen</button>
        </div>}

        {!state.loading && state.data && <>
          {empty && <p role="status" className="rounded-xl border border-amber-800 bg-slate-900 p-4 text-sm text-amber-200">Keine aufgezeichneten V1-Ereignisse im gewählten Zeitraum. Die Datenanbindung muss gesondert geprüft werden.</p>}
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map(([label, value]) => <article key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-3xl font-bold text-blue-300 mt-3">{number(value)}</p>
              {label === "Gestartete Bezahlvorgänge" &&
                <p className="text-xs text-slate-400 mt-2">
                  Abgeschlossen (Ereignisse): {number(total("checkout_completed"))} · kein Zahlungsnachweis
                </p>}
            </article>)}
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs text-slate-400">Verifizierter Umsatz</p>
              <p className="text-lg font-semibold text-amber-300 mt-3">Nicht angebunden</p>
              <p className="text-xs text-slate-500 mt-2">Browser-Ereignisse bestätigen keine Zahlung.</p>
            </article>
          </div>

          {!selected && <section aria-label="Datenabdeckung" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Aufzeichnungsabdeckung</h2>
            <p className="text-sm mt-2">
              <strong>{state.data.summary.projects_with_events} von {state.data.summary.project_count}</strong>
              {" "}Projekten mit aufgezeichneten Ereignissen
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Keine Ereignisse bedeuten weder offline noch fehlerfrei. Der Collector-Status ist nicht geprüft.
            </p>
          </section>}
          {dailyViews.length > 0 && <section aria-label="Tagesverlauf" className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">{TREND_LABELS[trendEvent]} nach Tag</h2>
            <p className="text-xs text-slate-400 mt-1 mb-4">Bis zu 14 Tage mit aufgezeichneten Ereignissen dieser Metrik · UTC · keine eindeutigen Besucher</p>
            <div className="space-y-3">
              {dailyViews.map(([day, views]) => <div key={day} className="flex items-center gap-3 text-sm" data-day={day}>
                <time dateTime={day} className="w-24 shrink-0 text-slate-300 tabular-nums">{day}</time>
                <div className="h-3 flex-1 overflow-hidden rounded bg-slate-800" aria-hidden="true">
                  <div className="h-full rounded bg-blue-500" style={{ width: `${largestDailyView ? views / largestDailyView * 100 : 0}%` }} />
                </div>
                <strong className="w-16 text-right tabular-nums">{number(views)}</strong>
              </div>)}
            </div>
          </section>}

          {dailyViews.length === 0 && !empty && <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
            Für diese Tagesmetrik wurden keine Ereignisse aufgezeichnet. Fehlende Werte sind kein Nachweis für Nullaktivität.
          </p>}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <h2 className="font-semibold p-5">Projektvergleich</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Aufgezeichnete Ereignisse je Projekt im ausgewählten Zeitraum</caption>
                <thead className="text-slate-400 border-y border-slate-800"><tr>
                  {["Projekt", "Tage mit Ereignissen", "Letzter erfasster UTC-Tag", "Seitenaufrufe", "Klicks", "Registrierungen begonnen (Ereignisse)", "Registrierungen abgeschlossen (Ereignisse)", "Bezahlvorgang gestartet", "Bezahlvorgang abgeschlossen (Ereignisse)", "Abbrüche (Ereignisse)"].map((heading) => <th key={heading} scope="col" className="p-4 font-medium whitespace-nowrap">{heading}</th>)}
                </tr></thead>
                <tbody>{ranked.map((report) => <tr key={report.project} className="border-b border-slate-800 last:border-0">
                  <th scope="row" className="p-4 font-medium whitespace-nowrap">{PROJECT_LABELS[report.project]}</th>
                  <td className="p-4 tabular-nums">{number(Object.keys(report.daily).length)}</td>
                  <td className="p-4 tabular-nums whitespace-nowrap">{lastRecordedDay(report) || "Keine Aufzeichnung"}</td>
                  {["page_view", "cta_click", "signup_started", "signup_completed", "checkout_started", "checkout_completed", "flow_abandoned"].map((event) => <td key={event} className="p-4 tabular-nums">{number(report.totals[event] || 0)}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-400">Erfasste Tage = UTC-Tage mit mindestens einem gespeicherten V1-Ereignis. Ein fehlender Tag oder eine alte Aufzeichnung beweist weder Nullaktivität noch einen Collector-Ausfall.</p>
          <p className="text-xs text-slate-400">API-Stand: {new Date(state.data.as_of).toLocaleString("de-DE", { timeZone: "UTC" })} UTC · Quelle: V1-Projektereignisse · keine Live-Garantie</p>
        </>}
      </div>
    </section>
  );
}
