import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from 'playwright/test';

const MOBILE_VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const user = {
  id: 'visual-home-user',
  name: 'BidBlitz Admin',
  email: 'visual-home@example.invalid',
  role: 'admin',
  modes: ['personal'],
  balance: 63363256.91,
  currency: 'EUR',
  kyc_status: 'approved',
  kyc_verified: true,
  language: 'de',
};

async function mockHomeApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/^\/undefined(?=\/api\/)/, '');
    const method = route.request().method();

    let body: any = {};
    if (pathname === '/api/auth/me' || pathname === '/api/auth/refresh') {
      body = user;
    } else if (pathname === '/api/wallet') {
      body = {
        id: 'visual-wallet',
        balance: 63363256.91,
        currency: 'EUR',
        transactions: [
          { id: 'm1', type: 'mining_purchase', amount: -199, description: 'Mining: Pro Miner', created_at: '2026-09-20T10:03:00Z' },
          { id: 'a1', type: 'auction_bid', amount: -0.5, description: 'Auktion Gebot: Laptop Pro', created_at: '2026-09-20T10:02:00Z' },
          { id: 's1', type: 'scooter_payment', amount: -4.5, description: 'E-Scooter Ride', created_at: '2026-09-20T10:01:00Z' },
        ],
      };
    } else if (pathname === '/api/wallet/balance/total') {
      body = { total_balance_eur: 63363256.91, crypto_balance_eur: 0, crypto_breakdown: [] };
    } else if (pathname === '/api/features/public') {
      body = { features: [] };
    } else if (pathname === '/api/features/navigation') {
      body = { items: [] };
    } else if (pathname === '/api/loyalty/status') {
      body = {};
    } else if (pathname === '/api/notifications/unread-count') {
      body = { count: 0 };
    } else if (pathname === '/api/merchant/dashboard') {
      body = {};
    } else if (pathname === '/api/kyc/status') {
      body = { status: 'approved', verified: true };
    } else if (method === 'GET') {
      body = {};
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`authenticated mobile home stays clear of bottom nav ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      localStorage.setItem('bidblitz_lang', 'de');
      localStorage.setItem('bidblitz_onboarded', '1');
      localStorage.setItem('bb_hint_dismissed', '1');
    });
    await mockHomeApi(page);

    await page.goto('/');
    await expect(page.getByTestId('home-page')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('mobile-home-content')).toBeVisible();
    await expect(page.getByTestId('mobile-home-intro')).toHaveCount(0);
    await expect(page.getByTestId('mobile-home-activity')).toBeVisible();

    const services = page.locator('[data-testid^="mobile-service-"]');
    await expect(services).toHaveCount(6);
    await expect(page.getByTestId('mobile-service-auctions')).toBeVisible();
    await expect(page.getByTestId('mobile-service-mining')).toBeVisible();

    const rows = page.getByTestId('mobile-recent-transaction');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('Mining: Pro Miner');

    const bottomNav = page.getByTestId('bottom-nav');
    await expect(bottomNav).toBeVisible();
    const support = page.getByRole('button', { name: 'more.support' });
    await support.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    const supportBox = await support.boundingBox();
    const navBox = await bottomNav.boundingBox();
    expect(supportBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(supportBox!.y + supportBox!.height).toBeLessThanOrEqual(navBox!.y - 2);

    const screenshots = path.resolve(__dirname, '../../qa-output/screenshots');
    fs.mkdirSync(screenshots, { recursive: true });
    await page.screenshot({
      path: path.join(screenshots, `home-authenticated-${viewport.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}
