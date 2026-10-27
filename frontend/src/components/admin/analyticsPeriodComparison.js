// Contract guard for the admin-only V1 adjacent-window event-count endpoint.
// These are recorded event occurrences, never visitors, customers or verified revenue.
export const PERIOD_EVENTS = [
  "page_view", "cta_click", "signup_started", "signup_completed",
  "checkout_started", "checkout_completed", "flow_abandoned",
];
export const PERIOD_EVENT_LABELS = {
  page_view: "Seitenaufrufe",
  cta_click: "Klicks",
  signup_started: "Registrierungen begonnen",
  signup_completed: "Registrierungen abgeschlossen",
  checkout_started: "Bezahlvorgänge gestartet",
  checkout_completed: "Abgeschlossene Checkout-Ereignisse",
  flow_abandoned: "Abbrüche",
};
export const PERIOD_PROJECT_LABELS = {
  bidblitz_main: "BidBlitz Hauptapp", trade: "Trade", eyes: "The Eye",
  power: "Power", verify: "Verify", iptv: "IPTV", games: "Games",
  fuel: "Fuel", identity: "BidBlitz ID", stack: "Stack",
};
const PROJECTS = Object.keys(PERIOD_PROJECT_LABELS);
const DAY_MS = 86400000;
const UTC_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/;

function fail() {
  throw new Error("Ungültiger Analytics-Zeitvergleich");
}

function utcMs(value) {
  if (typeof value !== "string") fail();
  const match = UTC_PATTERN.exec(value);
  if (!match) fail();
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail();
  const normalized = new Date(ms).toISOString();
  if (normalized.slice(0, 19) !== match[1] ||
      normalized.slice(20, 23) !== ((match[2] || "") + "000").slice(0, 3)) fail();
  return ms;
}

function eventMap(value, signed = false) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== PERIOD_EVENTS.length ||
      PERIOD_EVENTS.some((event) => !Object.hasOwn(value, event))) fail();
  for (const event of PERIOD_EVENTS) {
    if (!Number.isSafeInteger(value[event]) || (!signed && value[event] < 0)) fail();
  }
}

function safeAdd(a, b) {
  if (a > Number.MAX_SAFE_INTEGER - b) fail();
  return a + b;
}

// Reject incomplete catalogs and contradictory rollups before displaying any counters.
export function checkedPeriodComparison(payload, days) {
  if (!Number.isInteger(days) || days < 1 || days > 90 ||
      !payload || payload.period_days !== days || payload.timezone !== "UTC" ||
      payload.data_scope !== "v1_project_events_only" ||
      payload.verified_revenue_included !== false ||
      payload.unique_visitors !== null || payload.net_profit_available !== false ||
      payload.collection_health_verified !== false ||
      !Array.isArray(payload.projects) || payload.projects.length !== PROJECTS.length) fail();

  const asOf = utcMs(payload.as_of);
  const current = payload.windows?.current;
  const previous = payload.windows?.previous;
  if (!current || !previous ||
      utcMs(current.end_inclusive) !== asOf ||
      utcMs(current.start_inclusive) !== asOf - days * DAY_MS ||
      utcMs(previous.end_exclusive) !== asOf - days * DAY_MS ||
      utcMs(previous.start_inclusive) !== asOf - 2 * days * DAY_MS) fail();

  const seen = new Set();
  const sums = {
    current_events: Object.fromEntries(PERIOD_EVENTS.map((event) => [event, 0])),
    previous_events: Object.fromEntries(PERIOD_EVENTS.map((event) => [event, 0])),
  };
  let currentProjectsWithEvents = 0;
  let previousProjectsWithEvents = 0;

  for (const row of payload.projects) {
    if (!row || !Object.hasOwn(PERIOD_PROJECT_LABELS, row.project) ||
        seen.has(row.project)) fail();
    seen.add(row.project);
    for (const side of ["current", "previous"]) {
      const events = row[side + "_events"];
      const recordedDays = row[side + "_recorded_utc_days"];
      eventMap(events);
      if (!Number.isSafeInteger(recordedDays) || recordedDays < 0 || recordedDays > days + 1) fail();
      if (recordedDays === 0 && PERIOD_EVENTS.some((event) => events[event] > 0)) fail();
      if (recordedDays > 0 && PERIOD_EVENTS.every((event) => events[event] === 0)) fail();
      if (PERIOD_EVENTS.some((event) => events[event] > 0)) {
        if (side === "current") currentProjectsWithEvents += 1;
        else previousProjectsWithEvents += 1;
      }
      for (const event of PERIOD_EVENTS) {
        sums[side + "_events"][event] = safeAdd(sums[side + "_events"][event], events[event]);
      }
    }
    eventMap(row.recorded_event_change, true);
    for (const event of PERIOD_EVENTS) {
      if (row.recorded_event_change[event] !==
          row.current_events[event] - row.previous_events[event]) fail();
    }
  }
  if (seen.size !== PROJECTS.length) fail();
  const summary = payload.summary;
  if (!summary) fail();
  for (const side of ["current", "previous"]) {
    eventMap(summary[side + "_events"]);
    for (const event of PERIOD_EVENTS) {
      if (summary[side + "_events"][event] !== sums[side + "_events"][event]) fail();
    }
  }
  eventMap(summary.recorded_event_change, true);
  for (const event of PERIOD_EVENTS) {
    if (summary.recorded_event_change[event] !==
        sums.current_events[event] - sums.previous_events[event]) fail();
  }
  if (summary.current_projects_with_events !== currentProjectsWithEvents ||
      summary.previous_projects_with_events !== previousProjectsWithEvents) fail();

  return payload;
}
