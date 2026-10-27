import { checkedPeriodComparison, PERIOD_EVENTS, PERIOD_PROJECT_LABELS } from "./analyticsPeriodComparison";
const zero = () => Object.fromEntries(PERIOD_EVENTS.map(event => [event, 0]));
function fixture(days = 7) {
  const asOf = Date.parse("2026-10-27T01:30:00Z");
  const date = n => new Date(asOf - n * days * 86400000).toISOString().replace("Z", "+00:00");
  const projects = Object.keys(PERIOD_PROJECT_LABELS).map(project => ({
    project, current_events: zero(), previous_events: zero(), recorded_event_change: zero(),
    current_recorded_utc_days: 0, previous_recorded_utc_days: 0,
  }));
  const trade = projects.find(p => p.project === "trade");
  trade.current_events.page_view = 7;
  trade.previous_events.page_view = 3;
  trade.recorded_event_change.page_view = 4;
  trade.current_recorded_utc_days = 1;
  trade.previous_recorded_utc_days = 1;
  return {
    period_days: days, as_of: date(0), timezone: "UTC",
    windows: {
      current: { start_inclusive: date(1), end_inclusive: date(0) },
      previous: { start_inclusive: date(2), end_exclusive: date(1) },
    },
    projects,
    summary: {
      current_events: { ...zero(), page_view: 7 },
      previous_events: { ...zero(), page_view: 3 },
      recorded_event_change: { ...zero(), page_view: 4 },
      current_projects_with_events: 1, previous_projects_with_events: 1,
    },
    data_scope: "v1_project_events_only", verified_revenue_included: false,
    unique_visitors: null, net_profit_available: false, collection_health_verified: false,
  };
}
test.each([1, 7, 30, 90])("accepts complete disjoint %d-day UTC periods", days => {
  const data = fixture(days);
  expect(checkedPeriodComparison(data, days)).toBe(data);
});
test.each([
  "missing catalog", "duplicate", "foreign project", "wrong current total",
  "wrong previous total", "wrong signed delta", "wrong project delta",
  "negative count", "fractional count", "unsafe count", "PII event", "missing event",
  "missing windows", "shared boundary", "bad previous start", "bad as_of",
  "non-UTC", "invalid clock", "wrong recorded days", "wrong active projects",
  "verified revenue", "unique visitors", "health claim", "wrong scope",
])("rejects %s", kind => {
  const p = fixture(), trade = p.projects.find(row => row.project === "trade");
  if (kind === "missing catalog") p.projects.pop();
  if (kind === "duplicate") p.projects[0].project = "trade";
  if (kind === "foreign project") p.projects[0].project = "outsider";
  if (kind === "wrong current total") p.summary.current_events.page_view = 8;
  if (kind === "wrong previous total") p.summary.previous_events.page_view = 4;
  if (kind === "wrong signed delta") p.summary.recorded_event_change.page_view = 6;
  if (kind === "wrong project delta") trade.recorded_event_change.page_view = 8;
  if (kind === "negative count") trade.current_events.page_view = -1;
  if (kind === "fractional count") trade.previous_events.page_view = 0.5;
  if (kind === "unsafe count") trade.current_events.page_view = Number.MAX_SAFE_INTEGER + 1;
  if (kind === "PII event") trade.current_events.customer_email = 1;
  if (kind === "missing event") delete trade.current_events.flow_abandoned;
  if (kind === "missing windows") delete p.windows;
  if (kind === "shared boundary") p.windows.previous.end_exclusive = p.as_of;
  if (kind === "bad previous start") p.windows.previous.start_inclusive = p.as_of;
  if (kind === "bad as_of") p.windows.current.end_inclusive = "2026-10-26T01:30:00Z";
  if (kind === "non-UTC") p.windows.current.start_inclusive = "2026-10-20T01:30:00+01:00";
  if (kind === "invalid clock") p.as_of = "2026-10-27T25:30:00Z";
  if (kind === "wrong recorded days") trade.current_recorded_utc_days = 0;
  if (kind === "wrong active projects") p.summary.previous_projects_with_events = 3;
  if (kind === "verified revenue") p.verified_revenue_included = true;
  if (kind === "unique visitors") p.unique_visitors = 5;
  if (kind === "health claim") p.collection_health_verified = true;
  if (kind === "wrong scope") p.data_scope = "customers";
  expect(() => checkedPeriodComparison(p, 7)).toThrow("Ungültiger Analytics-Zeitvergleich");
});
test("cross-project sum overflow fails closed", () => {
  const p = fixture(), trade = p.projects.find(r => r.project === "trade");
  const eyes = p.projects.find(r => r.project === "eyes");
  trade.current_events.page_view = Number.MAX_SAFE_INTEGER;
  trade.recorded_event_change.page_view = Number.MAX_SAFE_INTEGER - 3;
  eyes.current_events.page_view = 1;
  eyes.recorded_event_change.page_view = 1;
  eyes.current_recorded_utc_days = 1;
  expect(() => checkedPeriodComparison(p, 7)).toThrow("Ungültiger Analytics-Zeitvergleich");
});
