// Isolated THE EYE earthquake-map browser tests.
// Run only against localhost after the frontend build. All earthquake data below is FAKE test data.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const base = process.env.THE_EYE_TEST_URL;
if (!base || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) {
  throw new Error("THE_EYE_TEST_URL must point to a localhost-only test server");
}
const html = fs.readFileSync(path.join(__dirname, "..", "build", "index.html"), "utf8");
const fixture = (status) => ({
  ok: true, status, source: "USGS", window: "24h", min_magnitude: 2.5,
  as_of: "2026-10-13T09:00:00Z", count: 2,
  events: [
    { id: "fake-1", lat: 42.6, lng: 21.1, magnitude: 3.8, place: "Test location A", occurred_at: "2026-10-13T08:00:00Z" },
    { id: "fake-2", lat: 37.3, lng: -122.0, magnitude: 2.9, place: "Test location B", occurred_at: "2026-10-13T07:00:00Z" },
  ],
});

async function test(width, status) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/the-eye", route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
    await page.route("**/api/the-eye/admin/live/earthquakes", route => {
      if (status === "unavailable") return route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"Test outage"}' });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(status)) });
    });
    await page.goto(base + "/the-eye", { waitUntil: "domcontentloaded" });
    const expectedLabel = status === "unavailable" ? "Erdbeben · Quelle nicht verfügbar" :
      status === "stale" ? "Erdbeben M2,5+ · veraltet" : "Erdbeben M2,5+ · USGS 24 h";
    await page.getByText(expectedLabel).waitFor({ state: "visible", timeout: 12000 });
    await page.getByRole("button", { name: "Karte", exact: true }).last().click();
    const markers = page.locator(".eye-leaflet-map .leaflet-overlay-pane path.leaflet-interactive");
    await page.waitForTimeout(600);
    assert.equal(await markers.count(), status === "unavailable" ? 0 : 2, "Only fixture earthquakes should appear");
    const quakeLayer = page.locator(".eye-layer-row").filter({ hasText: "Erdbeben" });
    await quakeLayer.click();
    assert.equal(await markers.count(), 0, "Earthquakes must disappear when layer disabled");
    assert.deepEqual(errors, [], "No JavaScript page errors allowed");
    console.log("PASS THE EYE earthquakes", width + "px", status);
    await page.close();
  } finally {
    await browser.close();
  }
}

(async () => {
  await test(1440, "live");
  await test(390, "stale");
  await test(390, "unavailable");
})().catch(error => { console.error(error); process.exitCode = 1; });
