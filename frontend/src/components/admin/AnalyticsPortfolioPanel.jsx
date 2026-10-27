import { useEffect, useState } from "react";

const API = process.env.REACT_APP_BACKEND_URL || "";
const PROJECT_LABELS = {
  bidblitz_main: "BidBlitz Hauptapp", trade: "Trade", eyes: "The Eye",
  power: "Power", verify: "Verify", iptv: "IPTV", games: "Games",
  fuel: "Fuel", identity: "BidBlitz ID", stack: "Stack",
};
const EVENTS = ["page_view", "cta_click", "signup_started", "signup_completed",
  "checkout_started", "checkout_completed", "flow_abandoned"];
const number = (value) => new Intl.NumberFormat("de-DE").format(value);

function checkedReports(data, days) {
  if (!data || data.period_days !== days || !Array.isArray(data.projects) ||
      data.data_scope !== "v1_project_events_only" || data.timezone !== "UTC" ||
      data.verified_revenue_included !== false || !Number.isFinite(Date.parse(data.as_of))) {
    throw new Error("Die API hat kein gültiges Portfolio geliefert.");
  }
  const seen = new Set();
  for (const report of data.projects) {
    if (!report || !Object.hasOwn(PROJECT_LABELS, report.project) || seen.has(report.project) ||
        report.period_days !== days || report.data_scope !== "v1_project_events_only" ||
        report.verified_revenue_included !== false || !report.totals ||
        typeof report.totals !== "object" || Array.isArray(report.totals)) {
      throw new Error("Die API hat ungültige Projektwerte geliefert.");
    }
    seen.add(report.project);
    for (const [event, count] of Object.entries(report.totals)) {
      if (!EVENTS.includes(event) || !Number.isSafeInteger(count) || count < 0) {
        throw new Error("Die API hat ungültige Ereigniszähler geliefert.");
      }
    }
  }
  return data;
}

export default function AnalyticsPortfolioPanel({ onBack }) {
  const [days, setDays] = useState(7);
  const [selected, setSelected] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: "" });

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
          throw new Error(message);
        }
        const data = checkedReports(await response.json(), days);
        if (active) setState({ loading: false, data, error: "" });
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setState({ loading: false, data: null,
            error: error instanceof SyntaxError ? "Die API-Antwort ist kein gültiges JSON." :
              error.message || "Die Analysedaten konnten nicht geladen werden." });
        }
      }
    }
    load();
    return () => { active = false; controller.abort(); };
  }, [days, attempt]);

  const reports = state.data?.projects || [];
  const visible = selected ? reports.filter((report) => report.project === selected) : reports;
  const total = (event) => visible.reduce((sum, report) => sum + (report.totals[event] || 0), 0);
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
            <select aria-label="Zeitraum" value={days} onChange={(event) => setDays(Number(event.target.value))}
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
          <button onClick={() => setAttempt((value) => value + 1)} disabled={state.loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Aktualisieren</button>
        </div>

        <p className="text-xs leading-relaxed text-slate-400">Rollierender Zeitraum in UTC. Seitenaufrufe sind keine eindeutigen Besucher. Diese Auswertung bestätigt weder einen gesunden Collector noch vollständige Datenabdeckung.</p>

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
            </article>)}
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs text-slate-400">Verifizierter Umsatz</p>
              <p className="text-lg font-semibold text-amber-300 mt-3">Nicht angebunden</p>
              <p className="text-xs text-slate-500 mt-2">Browser-Ereignisse bestätigen keine Zahlung.</p>
            </article>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <h2 className="font-semibold p-5">Projektvergleich</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Aufgezeichnete Ereignisse je Projekt im ausgewählten Zeitraum</caption>
                <thead className="text-slate-400 border-y border-slate-800"><tr>
                  {["Projekt", "Seitenaufrufe", "Klicks", "Registrierungen", "Bezahlvorgang gestartet"].map((heading) => <th key={heading} scope="col" className="p-4 font-medium whitespace-nowrap">{heading}</th>)}
                </tr></thead>
                <tbody>{visible.map((report) => <tr key={report.project} className="border-b border-slate-800 last:border-0">
                  <th scope="row" className="p-4 font-medium whitespace-nowrap">{PROJECT_LABELS[report.project]}</th>
                  {["page_view", "cta_click", "signup_completed", "checkout_started"].map((event) => <td key={event} className="p-4 tabular-nums">{number(report.totals[event] || 0)}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-400">API-Stand: {new Date(state.data.as_of).toLocaleString("de-DE", { timeZone: "UTC" })} UTC · Quelle: V1-Projektereignisse · keine Live-Garantie</p>
        </>}
      </div>
    </section>
  );
}
