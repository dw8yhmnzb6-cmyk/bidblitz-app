// Weekday intelligence derived exclusively from a validated admin V1 UTC daily map.
// Missing UTC dates have no buckets: never interpret them as zero visitor days.
export const WEEKDAY_NAMES = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag",
];
export const WEEKDAY_EVENTS = [
  "page_view", "cta_click", "signup_started", "signup_completed",
  "checkout_started", "checkout_completed", "flow_abandoned",
];
export const WEEKDAY_EVENT_LABELS = {
  page_view: "Seitenaufrufe",
  cta_click: "Klicks",
  signup_started: "Registrierungen begonnen",
  signup_completed: "Registrierungen abgeschlossen",
  checkout_started: "Bezahlvorgänge gestartet",
  checkout_completed: "Abgeschlossene Checkout-Ereignisse",
  flow_abandoned: "Abbrüche",
};

const emptyCounters = () => Object.fromEntries(WEEKDAY_EVENTS.map((key) => [key, 0]));
const invalid = () => { throw new Error("Ungültige aufgezeichnete UTC-Tagesdaten"); };

export function weekdaySummary(daily) {
  if (!daily || typeof daily !== "object" || Array.isArray(daily)) invalid();
  const rows = WEEKDAY_NAMES.map((weekday) => ({
    weekday, recordedDays: 0, totals: emptyCounters(), activeDays: emptyCounters(),
  }));
  for (const [day, counters] of Object.entries(daily)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !counters || typeof counters !== "object" || Array.isArray(counters)) invalid();
    const utc = new Date(day + "T00:00:00Z");
    if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== day) invalid();
    const values = Object.entries(counters);
    if (!values.length || !values.some(([, count]) => Number.isSafeInteger(count) && count > 0)) invalid();
    const row = rows[(utc.getUTCDay() + 6) % 7];
    row.recordedDays += 1;
    for (const [event, count] of values) {
      if (!WEEKDAY_EVENTS.includes(event) || !Number.isSafeInteger(count) || count < 0 ||
          row.totals[event] > Number.MAX_SAFE_INTEGER - count) invalid();
      row.totals[event] += count;
      if (count > 0) row.activeDays[event] += 1;
    }
  }
  return rows;
}

// Locally-generated and fixed-schema export. No client names, emails, money,
// CSV-formula capable user input, or extra API requests are included.
export function weekdayCsv(rows) {
  if (!Array.isArray(rows) || rows.length !== WEEKDAY_NAMES.length ||
      rows.some((row, index) => row.weekday !== WEEKDAY_NAMES[index] ||
        !Number.isSafeInteger(row.recordedDays) || row.recordedDays < 0)) invalid();
  const header = ["UTC-Wochentag", "UTC-Tage mit V1-Ereignissen",
    ...WEEKDAY_EVENTS.flatMap((event) => [
      WEEKDAY_EVENT_LABELS[event] + " (Ereignisse)",
      WEEKDAY_EVENT_LABELS[event] + " (UTC-Tage mit Ereignis)",
    ]),
  ];
  const body = rows.map((row) => [
    row.weekday, String(row.recordedDays),
    ...WEEKDAY_EVENTS.flatMap((event) => {
      const count = row.totals[event];
      const active = row.activeDays[event];
      if (!Number.isSafeInteger(count) || count < 0 ||
          !Number.isSafeInteger(active) || active < 0 || active > row.recordedDays) invalid();
      return row.recordedDays ? [String(count), String(active)] : ["", ""];
    }),
  ]);
  return "\uFEFF" + [header, ...body].map((row) => row.join(";")).join("\r\n") + "\r\n";
}
