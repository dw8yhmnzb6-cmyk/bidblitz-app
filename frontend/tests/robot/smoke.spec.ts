import { test, expect } from 'playwright/test';

const routes = ['/', '/auctions', '/taxi'];
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

// Read-only smoke checks. No logins, payments, bids or API mutations.
for (const viewport of viewports) {
  test.describe(`robot smoke: ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of routes) {
      test(`loads ${route} without a blank screen`, async ({ page }, testInfo) => {
        const uncaught: string[] = [];
        page.on('pageerror', error => uncaught.push(error.message));
        const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        expect(response, 'missing HTTP response').not.toBeNull();
        expect(response!.status(), `HTTP status for ${route}`).toBeLessThan(400);
        await expect(page.locator('#root')).toBeVisible({ timeout: 15000 });
        await expect.poll(async () => (await page.locator('#root').innerText()).trim().length, {
          message: `React root remained blank at ${route}`, timeout: 15000,
        }).toBeGreaterThan(0);
        await testInfo.attach('runtime-errors', {
          body: Buffer.from(JSON.stringify({ route, viewport: viewport.name, uncaught }, null, 2)),
          contentType: 'application/json',
        });
        expect(uncaught, `Uncaught errors on ${route}`).toEqual([]);
      });
    }
  });
}
