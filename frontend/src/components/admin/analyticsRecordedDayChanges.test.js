import { recordedDayChanges, recordedDayChangesCsv } from "./analyticsRecordedDayChanges";

const metric = "page_view";
const sample = {
  "2026-10-24": { page_view: 4, signup_completed: 2 },
  "2026-10-25": { signup_started: 3 },
  "2026-10-27": { page_view: 10 },
  "2026-10-28": { page_view: 2 },
};
test("uses only adjacent recorded UTC days, not missing dates as zero", () => {
  const result = recordedDayChanges(sample, metric);
  expect(result.recordedDays).toBe(4);
  expect(result.comparablePairs).toBe(2);
  expect(result.daysWithoutPriorRecord).toBe(2);
  expect(result.rows).toEqual([
    {
      previousDay: "2026-10-24", day: "2026-10-25",
      previous: 4, current: 0, delta: -4, percent: -100,
    },
    {
      previousDay: "2026-10-27", day: "2026-10-28",
      previous: 10, current: 2, delta: -8, percent: -80,
    },
  ]);
});
test("does not infer a percentage from a recorded zero-metric previous day", () => {
  const result = recordedDayChanges(sample, "signup_completed");
  expect(result.rows[0]).toMatchObject({previous: 2, current: 0, percent: -100});
  expect(result.rows[1]).toMatchObject({previous: 0, current: 0, percent: null});
});
test("retains safe large differences without summing into overflow", () => {
  const result = recordedDayChanges({
    "2026-10-26": { page_view: Number.MAX_SAFE_INTEGER },
    "2026-10-27": { page_view: 1 },
  }, metric);
  expect(result.rows[0].delta).toBe(1 - Number.MAX_SAFE_INTEGER);
  expect(result.rows[0].percent).toBeLessThan(0);
});
test("compares adjacent days across UTC year boundary", () => {
  const result = recordedDayChanges({
    "2025-12-31": { page_view: 2 },
    "2026-01-01": { page_view: 5 },
  }, metric);
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({delta: 3, percent: 150});
});
test("single recorded day is not misreported as a zero-change pair", () => {
  const result = recordedDayChanges({"2026-10-27": {page_view: 1}}, metric);
  expect(result).toMatchObject({
    recordedDays: 1, comparablePairs: 0, daysWithoutPriorRecord: 1, rows: [],
  });
});
test.each([
  [null, metric],
  [[], metric],
  [{ "2026-02-30": { page_view: 1 } }, metric],
  [{ "2026-10-27": null }, metric],
  [{ "2026-10-27": [] }, metric],
  [{ "2026-10-27": {} }, metric],
  [{ "2026-10-27": { page_view: 0 } }, metric],
  [{ "2026-10-27": { page_view: -1 } }, metric],
  [{ "2026-10-27": { page_view: 0.5 } }, metric],
  [{ "2026-10-27": { page_view: Number.MAX_SAFE_INTEGER + 1 } }, metric],
  [{ "2026-10-27": { private_email: 1 } }, metric],
  [sample, "unknown_event"],
])("rejects invalid daily V1 input %#", (daily, event) => {
  expect(() => recordedDayChanges(daily, event)).toThrow("Ungültige");
});
test("CSV includes only fixed scope, event name, UTC days and verified counters", () => {
  const summary = recordedDayChanges(sample, metric);
  const csv = recordedDayChangesCsv(summary, metric, "Alle Projekte");
  expect(csv).toMatch(/^\uFEFFProjektauswahl;Ereignisart/);
  expect(csv.split("\r\n")).toHaveLength(4);
  expect(csv).toContain("Alle Projekte;page_view;2026-10-24;2026-10-25;4;0;-4");
  expect(csv).not.toContain("2026-10-26;");
  expect(csv).not.toContain("signup_completed;");
});
test.each([
  "={HYPERLINK}", "+SUM(A1:A2)", "Projekt;Geheim", "Projekt\nName",
])("rejects untrusted CSV scope labels (%s)", (scope) => {
  expect(() => recordedDayChangesCsv(recordedDayChanges(sample, metric), metric, scope))
    .toThrow("Ungültige");
});
test("rejects tampering with delta or adjacency before CSV output", () => {
  const result = recordedDayChanges(sample, metric);
  result.rows[0].delta = 1;
  expect(() => recordedDayChangesCsv(result, metric, "Trade")).toThrow("Ungültige");
  result.rows[0].delta = -4;
  result.rows[0].previousDay = "2026-10-23";
  expect(() => recordedDayChangesCsv(result, metric, "Trade")).toThrow("Ungültige");
});
