import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AnalyticsPeriodCompare from "./AnalyticsPeriodCompare";
import { PERIOD_EVENTS, PERIOD_PROJECT_LABELS } from "./analyticsPeriodComparison";
const zero = () => Object.fromEntries(PERIOD_EVENTS.map(event => [event, 0]));
function period(days = 7) {
  const now = Date.parse("2026-10-27T01:30:00Z");
  const date = n => new Date(now - n * days * 86400000).toISOString().replace("Z", "+00:00");
  const projects = Object.keys(PERIOD_PROJECT_LABELS).map(project => ({
    project, current_events: zero(), previous_events: zero(), recorded_event_change: zero(),
    current_recorded_utc_days: 0, previous_recorded_utc_days: 0,
  }));
  const trade = projects.find(row => row.project === "trade");
  trade.current_events.page_view = 7; trade.previous_events.page_view = 3;
  trade.recorded_event_change.page_view = 4;
  trade.current_recorded_utc_days = 1; trade.previous_recorded_utc_days = 1;
  const eyes = projects.find(row => row.project === "eyes");
  eyes.current_events.checkout_started = 2; eyes.recorded_event_change.checkout_started = 2;
  eyes.current_recorded_utc_days = 1;
  return {
    period_days: days, as_of: date(0), timezone: "UTC",
    windows: {
      current: { start_inclusive: date(1), end_inclusive: date(0) },
      previous: { start_inclusive: date(2), end_exclusive: date(1) },
    }, projects,
    summary: {
      current_events: { ...zero(), page_view: 7, checkout_started: 2 },
      previous_events: { ...zero(), page_view: 3 },
      recorded_event_change: { ...zero(), page_view: 4, checkout_started: 2 },
      current_projects_with_events: 2, previous_projects_with_events: 1,
    },
    data_scope: "v1_project_events_only", verified_revenue_included: false,
    unique_visitors: null, net_profit_available: false, collection_health_verified: false,
  };
}
const ok = data => ({ ok: true, status: 200, json: async () => data });
let container, root, originalFetch;
beforeEach(() => {
  originalFetch = global.fetch;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); global.fetch = originalFetch;
});
const mount = async (days = 7, selected = "") => {
  // Direct ReactDOM root updates must be wrapped in act; no Testing Library render helper.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => root.render(<AnalyticsPeriodCompare days={days} selected={selected} />));
};
const click = async label => {
  const button = [...container.querySelectorAll("button")].find(node => node.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button.click());
};
const metric = async event => {
  const select = container.querySelector('[aria-label="Zeitvergleich-Metrik"]');
  await act(async () => {
    select.value = event; select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const rows = () => [...container.querySelectorAll('[aria-label="Aufgezeichnete Ereignisse nach Zeiträumen"] tbody tr')];

test("loads on demand with admin session and server-bound window", async () => {
  global.fetch = jest.fn().mockResolvedValue(ok(period()));
  await mount();
  expect(global.fetch).not.toHaveBeenCalled();
  await click("Vorperioden vergleichen");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toMatch(/\/api\/analytics\/v1\/portfolio\/period-compare\?days=7$/);
  expect(global.fetch.mock.calls[0][1].credentials).toBe("include");
  expect(rows()).toHaveLength(10);
  expect(container.querySelector("tfoot").textContent).toContain("+4");
});

test("metric and project filter require no additional API request", async () => {
  global.fetch = jest.fn().mockResolvedValue(ok(period()));
  await mount(7, "eyes"); await click("Vorperioden vergleichen");
  expect(rows()).toHaveLength(1);
  await metric("checkout_started");
  expect([...rows()[0].querySelectorAll("td")].map(cell => cell.textContent))
    .toEqual(["2", "0", "+2", "—", "1 / 0"]);
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => root.render(<AnalyticsPeriodCompare days={7} selected="trade" />));
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain("Trade");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([
  [401, "Bitte erneut anmelden."], [403, "Adminrechte"],
  [404, "noch nicht verfügbar"], [503, "nicht sicher geladen"],
])("HTTP %d hides counts and shows fixed error", async (status, message) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
  await mount(); await click("Vorperioden vergleichen");
  expect(container.querySelector('[role="alert"]').textContent).toContain(message);
  expect(container.querySelector("table")).toBeNull();
});
test("invalid rollups are never rendered or echoed back into the UI", async () => {
  const data = period();
  data.summary.current_events.page_view = 99;
  data.projects[0].email = "private@example.invalid";
  global.fetch = jest.fn().mockResolvedValue(ok(data));
  await mount(); await click("Vorperioden vergleichen");
  expect(container.querySelector("table")).toBeNull();
  expect(container.querySelector('[role="alert"]').textContent).toContain("nicht sicher geladen");
  expect(container.textContent).not.toContain("private@example.invalid");
});
test("retry clears former values on revoked permission", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(ok(period()))
    .mockResolvedValueOnce({ ok: false, status: 403 });
  await mount(); await click("Vorperioden vergleichen");
  expect(rows()).toHaveLength(10);
  await click("Zeitvergleich aktualisieren");
  expect(container.querySelector("table")).toBeNull();
  expect(container.querySelector('[role="alert"]').textContent).toContain("Adminrechte");
});
test("window changes abort pending requests and cannot show old period data", async () => {
  let resolveOld;
  global.fetch = jest.fn()
    .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(ok(period(30)));
  await mount(); await click("Vorperioden vergleichen");
  const signal = global.fetch.mock.calls[0][1].signal;
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => root.render(<AnalyticsPeriodCompare key="new" days={30} selected="" />));
  expect(signal.aborted).toBe(true);
  expect(container.querySelector("table")).toBeNull();
  await click("Vorperioden vergleichen");
  expect(rows()).toHaveLength(10);
  expect(global.fetch.mock.calls[1][0]).toMatch(/days=30$/);
  await act(async () => resolveOld(ok(period())));
  expect(rows()).toHaveLength(10);
  expect(container.textContent).toContain("Je 30 Tage");
});
test("unmount aborts pending comparison without navigation side effects", async () => {
  global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
  await mount(); await click("Vorperioden vergleichen");
  const signal = global.fetch.mock.calls[0][1].signal;
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => root.render(<></>));
  expect(signal.aborted).toBe(true);
  expect(container.querySelector("table")).toBeNull();
});

const csvResponse = (body = "project,event,current,previous\\ntrade,page_view,7,3\\n",
  type = "text/csv; charset=utf-8", length = null) => ({
  ok: true, status: 200,
  headers: { get: name => name === "content-type" ? type :
    name === "content-length" ? length : null },
  blob: async () => new Blob([body], { type: "text/csv" }),
});

test("comparison CSV is on-demand, admin-scoped, full-catalog and uses a fixed safe filename", async () => {
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click");
  const timeoutSpy = jest.spyOn(window, "setTimeout");
  let downloaded = null;
  URL.createObjectURL = jest.fn(() => "blob:analytics-comparison-test");
  URL.revokeObjectURL = jest.fn();
  clickSpy.mockImplementation(function () {
    downloaded = { filename: this.download, href: this.href };
  });
  timeoutSpy.mockImplementation(callback => { callback(); return 1; });
  try {
    global.fetch = jest.fn().mockResolvedValueOnce(ok(period()))
      .mockResolvedValueOnce(csvResponse());
    await mount(7, "eyes");
    expect(container.textContent).not.toContain("Zeitvergleich als CSV exportieren");
    await click("Vorperioden vergleichen");
    expect(rows()).toHaveLength(1);
    await click("Zeitvergleich als CSV exportieren");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toMatch(/\/api\/analytics\/v1\/portfolio\/period-compare\/export\.csv\?days=7$/);
    expect(url).not.toContain("eyes");
    expect(options.credentials).toBe("include");
    expect(options.headers.Accept).toBe("text/csv");
    expect(downloaded).toEqual({
      href: "blob:analytics-comparison-test",
      filename: "bidblitz-v1-period-compare-7d.csv",
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:analytics-comparison-test");
    expect(container.textContent).toContain("alle 10 registrierten Projekte");
  } finally {
    clickSpy.mockRestore(); timeoutSpy.mockRestore();
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
  }
});

test.each([
  [401, "Bitte erneut anmelden"],
  [403, "Adminrechte"],
  [404, "noch nicht verfügbar"],
  [503, "nicht erstellt"],
])("CSV HTTP %d fails closed without triggering any download", async (status, message) => {
  const oldCreate = URL.createObjectURL;
  URL.createObjectURL = jest.fn();
  try {
    global.fetch = jest.fn().mockResolvedValueOnce(ok(period()))
      .mockResolvedValueOnce({ ok: false, status });
    await mount(); await click("Vorperioden vergleichen");
    await click("Zeitvergleich als CSV exportieren");
    expect(container.querySelector('[role="alert"]').textContent).toContain(message);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(10);
  } finally {
    URL.createObjectURL = oldCreate;
  }
});

test.each([
  ["wrong content type", csvResponse("{}", "application/json")],
  ["invalid content length", csvResponse("x", "text/csv", "-2")],
  ["oversized announced length", csvResponse("x", "text/csv", String(2 * 1024 * 1024 + 1))],
  ["empty CSV", csvResponse("")],
  ["oversized CSV body", csvResponse("x".repeat(2 * 1024 * 1024 + 1))],
])("CSV rejects %s before creating a download", async (_case, response) => {
  const oldCreate = URL.createObjectURL;
  URL.createObjectURL = jest.fn();
  try {
    global.fetch = jest.fn().mockResolvedValueOnce(ok(period()))
      .mockResolvedValueOnce(response);
    await mount(); await click("Vorperioden vergleichen");
    await click("Zeitvergleich als CSV exportieren");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  } finally {
    URL.createObjectURL = oldCreate;
  }
});

test("CSV transport errors hide internal details and permit a retry", async () => {
  const oldCreate = URL.createObjectURL;
  URL.createObjectURL = jest.fn();
  try {
    global.fetch = jest.fn().mockResolvedValueOnce(ok(period()))
      .mockRejectedValueOnce(new Error("private database connection info"))
      .mockResolvedValueOnce({ ok: false, status: 503 });
    await mount(); await click("Vorperioden vergleichen");
    await click("Zeitvergleich als CSV exportieren");
    expect(container.textContent).not.toContain("private database connection info");
    expect(container.querySelector('[role="alert"]').textContent).toContain("nicht erstellt");
    await click("Zeitvergleich als CSV exportieren");
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  } finally {
    URL.createObjectURL = oldCreate;
  }
});

test("comparison refresh aborts an in-flight CSV and discards its stale response", async () => {
  let resolveExport;
  const oldCreate = URL.createObjectURL;
  URL.createObjectURL = jest.fn();
  try {
    global.fetch = jest.fn().mockResolvedValueOnce(ok(period()))
      .mockImplementationOnce(() => new Promise(resolve => { resolveExport = resolve; }))
      .mockResolvedValueOnce(ok(period()));
    await mount(); await click("Vorperioden vergleichen");
    await click("Zeitvergleich als CSV exportieren");
    const signal = global.fetch.mock.calls[1][1].signal;
    expect(signal.aborted).toBe(false);
    await click("Zeitvergleich aktualisieren");
    expect(signal.aborted).toBe(true);
    await act(async () => resolveExport(csvResponse()));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(10);
  } finally {
    URL.createObjectURL = oldCreate;
  }
});

test("unmount aborts in-flight CSV after navigating away", async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(ok(period()))
    .mockImplementationOnce(() => new Promise(() => {}));
  await mount(); await click("Vorperioden vergleichen");
  await click("Zeitvergleich als CSV exportieren");
  const signal = global.fetch.mock.calls[1][1].signal;
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => root.render(<></>));
  expect(signal.aborted).toBe(true);
});


const chooseSort = async mode => {
  const selector = container.querySelector('[aria-label="Zeitvergleich-Sortierung"]');
  await act(async () => {
    selector.value = mode;
    selector.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

test("comparison renders one export control and explains recorded-event percentages", async () => {
  global.fetch = jest.fn().mockResolvedValue(ok(period()));
  await mount();
  await click("Vorperioden vergleichen");
  const buttons = [...container.querySelectorAll("button")]
    .filter(button => button.textContent === "Zeitvergleich als CSV exportieren");
  expect(buttons).toHaveLength(1);
  expect(container.textContent).toContain("Prozentänderungen vergleichen nur aufgezeichnete Ereignisse");
  const trade = rows().find(row => row.textContent.includes("Trade"));
  expect([...trade.querySelectorAll("td")].map(cell => cell.textContent))
    .toEqual(["7", "3", "+4", "133,3 %", "1 / 1"]);
  await metric("checkout_started");
  const eyes = rows().find(row => row.textContent.includes("The Eye"));
  expect([...eyes.querySelectorAll("td")].map(cell => cell.textContent))
    .toEqual(["2", "0", "+2", "—", "1 / 0"]);
  expect(container.querySelector("tfoot").textContent).toContain("—");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("negative percentage and signed change compare recorded events, never revenue", async () => {
  const data = period();
  const eyes = data.projects.find(row => row.project === "eyes");
  eyes.current_events.page_view = 2;
  eyes.previous_events.page_view = 6;
  eyes.recorded_event_change.page_view = -4;
  eyes.previous_recorded_utc_days = 1;
  data.summary.current_events.page_view = 9;
  data.summary.previous_events.page_view = 9;
  data.summary.recorded_event_change.page_view = 0;
  data.summary.previous_projects_with_events = 2;
  global.fetch = jest.fn().mockResolvedValue(ok(data));
  await mount();
  await click("Vorperioden vergleichen");
  await chooseSort("change_asc");
  expect(rows()[0].textContent).toContain("The Eye");
  expect(rows()[0].textContent).toContain("-4");
  expect(rows()[0].textContent).toContain("-66,7 %");
  await chooseSort("change_desc");
  expect(rows()[0].textContent).toContain("Trade");
  expect(container.textContent).toContain("keine verifizierte Zahlung");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("sort current counts and recording coverage by selected metric without refetch", async () => {
  const data = period();
  const trade = data.projects.find(row => row.project === "trade");
  trade.current_recorded_utc_days = 3;
  global.fetch = jest.fn().mockResolvedValue(ok(data));
  await mount();
  await click("Vorperioden vergleichen");
  await metric("checkout_started");
  await chooseSort("current");
  expect(rows()[0].textContent).toContain("The Eye");
  await chooseSort("coverage");
  expect(rows()[0].textContent).toContain("Trade");
  await chooseSort("project");
  expect(rows()[0].textContent).toContain("BidBlitz Hauptapp");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("project scope remains fixed when sorting and changing event metric", async () => {
  global.fetch = jest.fn().mockResolvedValue(ok(period()));
  await mount(7, "trade");
  await click("Vorperioden vergleichen");
  await chooseSort("current");
  await metric("checkout_started");
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain("Trade");
  expect(rows()[0].textContent).not.toContain("The Eye");
  expect(container.querySelector("tfoot")).toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
