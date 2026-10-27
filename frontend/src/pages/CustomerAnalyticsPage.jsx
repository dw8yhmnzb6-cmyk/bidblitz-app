import { useEffect, useState } from "react";

const API = process.env.REACT_APP_BACKEND_URL || "";
const SITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EVENTS = ["page_view", "cta_click", "signup_started", "signup_completed", "checkout_started", "flow_abandoned"];
const format = (value) => new Intl.NumberFormat("de-DE").format(value);

function checkedSites(data) {
  if (!data || !Array.isArray(data.sites) || data.sites.length > 100 || typeof data.has_more !== "boolean") {
    throw new Error("Die Website-Liste ist ungültig.");
  }
  const seen = new Set();
  for (const site of data.sites) {
    if (!site || !SITE_ID.test(site.site_id) || seen.has(site.site_id) ||
        typeof site.display_name !== "string" || !site.display_name.trim() || site.display_name.length > 100) {
      throw new Error("Die Website-Liste ist ungültig.");
    }
    seen.add(site.site_id);
  }
  return data;
}

function checkedCounts(counts) {
  return counts && typeof counts === "object" && !Array.isArray(counts) &&
    Object.entries(counts).every(([event, count]) => EVENTS.includes(event) && Number.isSafeInteger(count) && count >= 0);
}

function checkedReport(data, site, days) {
  if (!data || data.site_id !== site || data.period_days !== days || data.timezone !== "UTC" ||
      data.data_scope !== "tenant_site_v1_events_only" || data.verified_revenue_included !== false ||
      typeof data.has_recorded_events !== "boolean" || typeof data.as_of !== "string" ||
      !Number.isFinite(Date.parse(data.as_of)) || !checkedCounts(data.totals) ||
      !data.daily || typeof data.daily !== "object" || Array.isArray(data.daily) ||
      !Object.entries(data.daily).every(([day, counts]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && checkedCounts(counts))) {
    throw new Error("Die Statistikantwort passt nicht zur gewählten Website.");
  }
  return data;
}

async function read(path, signal) {
  const response = await fetch(`${API}${path}`, { credentials: "include", signal, headers: { Accept: "application/json" } });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Bitte erneut anmelden.");
    if ([403, 404].includes(response.status)) throw new Error("Diese Website ist für dein Konto nicht verfügbar.");
    throw new Error("Die Daten konnten nicht geladen werden. Bitte versuche es erneut.");
  }
  try { return await response.json(); }
  catch { throw new Error("Die Antwort konnte nicht gelesen werden."); }
}

export default function CustomerAnalyticsPage({ accountId, onBack, onLogin }) {
  const [listRetry, setListRetry] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState({ owner: null, site: "" });
  const [days, setDays] = useState(7);
  const [list, setList] = useState({ owner: null, loading: true, sites: [], error: "", has_more: false });
  const [report, setReport] = useState({ key: "", loading: true, data: null, error: "" });
  const sites = list.owner === accountId ? list.sites : [];
  const siteId = selection.owner === accountId && sites.some((site) => site.site_id === selection.site)
    ? selection.site : sites[0]?.site_id || "";
  const reportKey = JSON.stringify([accountId, siteId, days]);
  const current = report.key === reportKey ? report : { loading: true, data: null, error: "" };
  const listReady = list.owner === accountId && !list.loading;

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const controller = new AbortController();
    setList({ owner: accountId, loading: true, sites: [], error: "", has_more: false });
    read("/api/analytics/v1/my/sites", controller.signal).then(checkedSites).then((data) => {
      if (active) setList({ ...data, owner: accountId, loading: false, error: "" });
    }).catch((error) => {
      if (active && error.name !== "AbortError") setList({ owner: accountId, loading: false, sites: [], error: error.message, has_more: false });
    });
    return () => { active = false; controller.abort(); };
  }, [accountId, listRetry]);

  useEffect(() => {
    if (!accountId || !siteId) return;
    let active = true;
    const controller = new AbortController();
    setReport({ key: reportKey, loading: true, data: null, error: "" });
    read(`/api/analytics/v1/my/sites/${siteId}/overview?days=${days}`, controller.signal)
      .then((data) => checkedReport(data, siteId, days)).then((data) => {
        if (active) setReport({ key: reportKey, loading: false, data, error: "" });
      }).catch((error) => {
        if (active && error.name !== "AbortError") setReport({ key: reportKey, loading: false, data: null, error: error.message });
      });
    return () => { active = false; controller.abort(); };
  }, [accountId, siteId, days, refresh, reportKey]);

  const actionClass = "rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm disabled:opacity-50";
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="flex flex-wrap justify-between gap-4 border-b border-slate-800 pb-5">
          <div><p className="text-xs font-semibold tracking-widest text-blue-400">BIDBLITZ ANALYTICS</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2">Deine Website-Statistik</h1>
            <p className="text-sm text-slate-400 mt-2">Die zu deinem Konto gehörenden Websites im Blick.</p></div>
          {onBack && <button className={actionClass} onClick={onBack}>Zurück</button>}
        </header>

        {!accountId ? <section className="rounded-xl border border-blue-900 bg-slate-900 p-6">
          <h2 className="font-semibold">Melde dich an, um deine Websites zu sehen.</h2>
          {onLogin && <button className={`${actionClass} mt-4`} onClick={onLogin}>Anmelden</button>}
        </section> : <>
          {!listReady && <p role="status">Deine Websites werden geladen …</p>}
          {listReady && list.error && <section role="alert" className="rounded-xl border border-red-900 bg-red-950 p-5">
            <p>{list.error}</p><button className="mt-3 underline" onClick={() => setListRetry((value) => value + 1)}>Website-Liste erneut laden</button>
          </section>}
          {listReady && !list.error && sites.length === 0 && <section role="status" className="rounded-xl border border-blue-900 bg-slate-900 p-6">
            <h2 className="font-semibold">Noch keine bestätigte Website zugeordnet</h2>
            <p className="text-sm text-slate-400 mt-2">Nach der Website-Einrichtung und dem Eigentumsnachweis erscheint deine Website hier.</p>
            <button className={`${actionClass} mt-4`} onClick={() => setListRetry((value) => value + 1)}>Website-Liste aktualisieren</button>
          </section>}

          {listReady && !list.error && sites.length > 0 && <>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="flex flex-col gap-2 text-xs text-slate-400">Website
                <select aria-label="Website" className={actionClass} value={siteId} onChange={(event) => setSelection({ owner: accountId, site: event.target.value })}>
                  {sites.map((site) => <option key={site.site_id} value={site.site_id}>{site.display_name}</option>)}
                </select></label>
              <label className="flex flex-col gap-2 text-xs text-slate-400">Zeitraum
                <select aria-label="Zeitraum" className={actionClass} value={days} onChange={(event) => setDays(Number(event.target.value))}>
                  {[1, 7, 30, 90].map((value) => <option key={value} value={value}>{value === 1 ? "Letzte 24 Stunden" : `Letzte ${value} Tage`}</option>)}
                </select></label>
              <button className={actionClass} onClick={() => setRefresh((value) => value + 1)} disabled={current.loading}>Statistik aktualisieren</button>
            </div>
            {list.has_more && <p className="text-sm text-amber-300">Weitere Websites vorhanden. Angezeigt werden die ersten 100 zugeordneten Websites.</p>}
            <p className="text-xs text-slate-400">Rollierender Zeitraum in UTC. Seitenaufrufe zählen Aufrufe, keine eindeutigen Besucher.</p>
            {current.loading && <p role="status">Deine Statistik wird geladen …</p>}
            {current.error && <section role="alert" className="rounded-xl border border-red-900 bg-red-950 p-5">
              <p>{current.error}</p><button className="mt-3 underline" onClick={() => setRefresh((value) => value + 1)}>Statistik erneut laden</button>
            </section>}
            {current.data && <>
              {!current.data.has_recorded_events && <p role="status" className="rounded-xl border border-amber-800 bg-slate-900 p-4 text-sm text-amber-200">Noch keine Ereignisse in diesem Zeitraum aufgezeichnet. Daraus lässt sich nicht ableiten, ob die Erfassung bereits funktioniert.</p>}
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3">
                {[["Seitenaufrufe", "page_view"], ["Klicks", "cta_click"], ["Registrierungen abgeschlossen", "signup_completed"]].map(([label, event]) => <article key={event} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <p className="text-xs text-slate-400">{label}</p><p className="text-3xl font-bold text-blue-300 mt-3">{format(current.data.totals[event] || 0)}</p>
                </article>)}
                <article className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs text-slate-400">Verifizierter Umsatz</p><p className="text-lg text-amber-300 mt-3">Nicht angebunden</p></article>
              </div>
              <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <h2 className="font-semibold p-5">Verlauf deiner Website</h2>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                  <caption className="sr-only">Aufgezeichnete tägliche Ereignisse in UTC</caption>
                  <thead><tr className="border-y border-slate-800 text-slate-400">{["Datum (UTC)", "Seitenaufrufe", "Klicks", "Registrierungen"].map((label) => <th scope="col" className="p-4 whitespace-nowrap" key={label}>{label}</th>)}</tr></thead>
                  <tbody>{Object.entries(current.data.daily).sort(([left], [right]) => right.localeCompare(left)).map(([day, counts]) => <tr key={day} className="border-b border-slate-800">
                    <th scope="row" className="p-4 font-normal whitespace-nowrap">{day}</th>
                    {["page_view", "cta_click", "signup_completed"].map((event) => <td key={event} className="p-4 tabular-nums">{format(counts[event] || 0)}</td>)}
                  </tr>)}</tbody>
                </table></div>
              </section>
              <p className="text-xs text-slate-400">Stand: {new Date(current.data.as_of).toLocaleString("de-DE", { timeZone: "UTC" })} UTC · aufgezeichnete Website-Ereignisse · keine Live-Garantie</p>
            </>}
          </>}
        </>}
      </div>
    </main>
  );
}
