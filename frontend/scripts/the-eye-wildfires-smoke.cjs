// Localhost-only THE EYE browser checks using FAKE NASA EONET data.
// Never use this test as evidence that emergency events are verified in real time.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const base = process.env.THE_EYE_TEST_URL;
if (!base || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) {
  throw new Error("THE_EYE_TEST_URL must be a localhost test server");
}
const html = fs.readFileSync(path.join(__dirname, "..", "build", "index.html"), "utf8");
const fixture = (status) => ({
  ok: true, status, source: "NASA EONET", scope: "reported_open_events",
  as_of: "2026-10-13T09:00:00Z", count: 2,
  events: [
    { id: "fake-fire-1", lat: 42.34, lng: -114.1, title: "Test wildfire A", observed_at: "2026-10-12T12:00:00Z", approximate: false },
    { id: "fake-fire-2", lat: 35.4, lng: -120.5, title: "Test wildfire B", observed_at: "2026-10-12T08:00:00Z", approximate: true },
  ],
});

async function check(width, state) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/the-eye", route => route.fulfill({
      status: 200, contentType: "text/html", body: html,
    }));
    await page.route("**/api/the-eye/admin/live/wildfires", route => {
      if (state === "unavailable") {
        return route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"Simulated outage"}' });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(state)) });
    });

    await page.goto(base + "/the-eye", { waitUntil: "domcontentloaded" });
    const label = state === "unavailable" ? "Waldbrände · Quelle nicht verfügbar" :
      state === "stale" ? "Waldbrandmeldungen · veraltet" : "Waldbrandmeldungen · NASA EONET";
    await page.getByText(label).waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: "Karte", exact: true }).last().click();
    const markers = page.locator(".eye-leaflet-map .leaflet-overlay-pane path.leaflet-interactive");
    await page.waitForTimeout(600);
    assert.equal(await markers.count(), state === "unavailable" ? 0 : 2);
    await page.locator(".eye-layer-row").filter({ hasText: "Feuer" }).click();
    assert.equal(await markers.count(), 0, "Disabled wildfire layer must hide events");
    assert.deepEqual(errors, []);
    console.log("PASS THE EYE wildfire layer", width + "px", state);
    await page.close();
  } finally {
    await browser.close();
  }
}
(async () => {
  await check(1440, "live");
  await check(390, "stale");
  await check(390, "unavailable");
})().catch(error => { console.error(error); process.exitCode = 1; });
