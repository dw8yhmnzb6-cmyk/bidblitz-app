// THE EYE isolated UI smoke check. Run against an already-built frontend.
// Usage: THE_EYE_TEST_URL=http://127.0.0.1:18739 node frontend/scripts/the-eye-smoke.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const base = process.env.THE_EYE_TEST_URL;
if (!base) throw new Error("THE_EYE_TEST_URL is required; never test Production by default");
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) {
  throw new Error("Only localhost development servers are permitted");
}
const index = fs.readFileSync(path.join(__dirname, "..", "build", "index.html"), "utf8");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/the-eye", route => route.fulfill({
        status: 200, contentType: "text/html", body: index,
      }));
      await page.goto(base + "/the-eye", { waitUntil: "domcontentloaded" });
      const hint = page.getByRole("button", { name: "3D Erde nicht verfügbar – Mapbox-Zugang fehlt" });
      if (!process.env.REACT_APP_MAPBOX_ACCESS_TOKEN) {
        assert.equal(await hint.count(), 1);
        assert.equal(await hint.isDisabled(), true);
      }
      await page.getByRole("button", { name: "Karte", exact: true }).last().click();
      await page.getByRole("button", { name: "Weltkarte vergrößern" }).click();
      await page.getByRole("button", { name: "Weltkarte verkleinern" }).click();
      const layer = page.getByRole("button", { name: "BidBlitz Geräte auf Karte ein- oder ausblenden" });
      await layer.click();
      assert.equal(await layer.getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator(".eye-leaflet-map").count(), 1);
      assert.deepEqual(errors, []);
      console.log("PASS THE EYE", width + "px");
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
