import { weekdayCsv, weekdaySummary, WEEKDAY_NAMES } from "./analyticsWeekdayInsights";

test("groups validated UTC events by weekday without changing calendar day for timezone", () => {
  const rows = weekdaySummary({
    "2026-10-19": { page_view: 3, cta_click: 1 },
    "2026-10-26": { page_view: 4, signup_started: 2 },
    "2026-10-27": { page_view: 8, signup_completed: 2 },
    "2026-10-25": { checkout_started: 5 },
  });
  expect(rows.map((row) => row.weekday)).toEqual(WEEKDAY_NAMES);
  expect(rows[0].recordedDays).toBe(2);
  expect(rows[0].totals.page_view).toBe(7);
  expect(rows[0].activeDays.page_view).toBe(2);
  expect(rows[1].totals.signup_completed).toBe(2);
  expect(rows[1].activeDays.page_view).toBe(1);
  expect(rows[6].totals.checkout_started).toBe(5);
  expect(rows[6].recordedDays).toBe(1);
});

test("a recorded day with a different event has zero for the selected event, unlike missing dates", () => {
  const rows = weekdaySummary({ "2026-10-26": { signup_completed: 2 } });
  expect(rows[0].recordedDays).toBe(1);
  expect(rows[0].totals.page_view).toBe(0);
  expect(rows[0].activeDays.page_view).toBe(0);
  expect(rows[1].recordedDays).toBe(0);
  expect(weekdaySummary({}).every((row) => row.recordedDays === 0)).toBe(true);
});

test("CSV is fixed-schema UTF-8 without invented zeroes on missing weekdays or PII", () => {
  const rows = weekdaySummary({
    "2026-10-26": { page_view: 3 },
  });
  const csv = weekdayCsv(rows);
  expect(csv.startsWith("\uFEFFUTC-Wochentag;UTC-Tage mit V1-Ereignissen;")).toBe(true);
  const lines = csv.slice(1).trim().split("\r\n");
  expect(lines).toHaveLength(8);
  expect(lines[1]).toContain("Montag;1;3;1;");
  expect(lines[2]).toMatch(/^Dienstag;0;{2,}/);
  expect(lines[2].split(";")).toHaveLength(16);
  expect(csv).not.toMatch(/email|kunde|eur|umsatz|@/i);
});

test.each([
  [null], [[]], ["bad"], [{ "2026-02-30": { page_view: 1 } }],
  [{ "2026-10-26": {} }],
  [{ "2026-10-26": { page_view: 0 } }],
  [{ "2026-10-26": { page_view: -1 } }],
  [{ "2026-10-26": { page_view: 1.3 } }],
  [{ "2026-10-26": { email: 1 } }],
])("rejects malformed or potentially misleading weekday source %#", (daily) => {
  expect(() => weekdaySummary(daily)).toThrow("Ungültige");
});

test("rejects integer overflow instead of drawing an inaccurate weekday bar", () => {
  expect(() => weekdaySummary({
    "2026-10-19": { page_view: Number.MAX_SAFE_INTEGER },
    "2026-10-26": { page_view: 1 },
  })).toThrow("Ungültige");
});

test("rejects malformed CSV rows instead of exporting unverified cells", () => {
  const rows = weekdaySummary({ "2026-10-26": { page_view: 4 } });
  rows[0].activeDays.page_view = 999;
  expect(() => weekdayCsv(rows)).toThrow("Ungültige");
});
