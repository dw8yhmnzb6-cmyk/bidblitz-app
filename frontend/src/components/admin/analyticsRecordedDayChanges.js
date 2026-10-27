// Recorded V1 event differences, not visitor, customer or revenue changes.
// Called with an already validated and admin-scoped UTC daily map.
import { WEEKDAY_EVENTS } from "./analyticsWeekdayInsights";

const fail = () => { throw new Error("Ungültige UTC-Ereignistagesdaten"); };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDay = (day) => {
  if (typeof day !== "string" || !DATE.test(day)) return false;
  const value = Date.parse(day + "T00:00:00Z");
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === day;
};
const before = (day) =>
  new Date(Date.parse(day + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);

export function recordedDayChanges(daily, metric) {
  if (!daily || typeof daily !== "object" || Array.isArray(daily) ||
      !WEEKDAY_EVENTS.includes(metric)) fail();
  const dates = Object.keys(daily).sort();
  const values = new Map();
  for (const day of dates) {
    const counters = daily[day];
    if (!isValidDay(day) || !counters || typeof counters !== "object" ||
        Array.isArray(counters)) fail();
    let recorded = false;
    for (const [event, count] of Object.entries(counters)) {
      if (!WEEKDAY_EVENTS.includes(event) || !Number.isSafeInteger(count) || count < 0) fail();
      if (count > 0) recorded = true;
    }
    if (!recorded) fail(); // A V1 daily bucket only exists after recorded events.
    values.set(day, counters[metric] ?? 0);
  }
  const rows = [];
  for (const day of dates) {
    const previousDay = before(day);
    if (!values.has(previousDay)) continue;
    const previous = values.get(previousDay);
    const current = values.get(day);
    const delta = current - previous; // Both operands are safe nonnegative integers.
    rows.push({
      day, previousDay, previous, current, delta,
      // This is a change in event counts, NOT a user retention/conversion rate.
      percent: previous === 0 ? null : (delta / previous) * 100,
    });
  }
  return {
    recordedDays: dates.length,
    comparablePairs: rows.length,
    daysWithoutPriorRecord: dates.length - rows.length,
    rows,
  };
}

export function recordedDayChangesCsv(summary, metric, scope) {
  if (!WEEKDAY_EVENTS.includes(metric) || typeof scope !== "string" ||
      !/^[A-Za-zÄÖÜäöüß0-9 .-]{1,65}$/.test(scope) ||
      !summary || !Array.isArray(summary.rows) || summary.rows.length > 90 ||
      !Number.isSafeInteger(summary.comparablePairs) ||
      summary.comparablePairs !== summary.rows.length) fail();
  const lines = [
    ["Projektauswahl", "Ereignisart", "Vortag UTC", "Tag UTC",
      "Vortag Ereignisse", "Tag Ereignisse", "Differenz Ereignisse"],
  ];
  for (const row of summary.rows) {
    if (!row || !isValidDay(row.day) || !isValidDay(row.previousDay) ||
        before(row.day) !== row.previousDay ||
        !Number.isSafeInteger(row.previous) || row.previous < 0 ||
        !Number.isSafeInteger(row.current) || row.current < 0 ||
        !Number.isSafeInteger(row.delta) || row.delta !== row.current - row.previous) fail();
    lines.push([
      scope, metric, row.previousDay, row.day,
      String(row.previous), String(row.current), String(row.delta),
    ]);
  }
  return "\uFEFF" + lines.map((cols) => cols.join(";")).join("\r\n") + "\r\n";
}
