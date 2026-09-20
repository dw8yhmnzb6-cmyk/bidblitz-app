import { test, expect, type Page } from 'playwright/test';
import { openRoute, prepareVisualPage } from './layout-checks';

async function mockMiningUser(page: Page) {
  const user = {
    id: 'visual-mining-user',
    name: 'Visual Mining User',
    email: 'visual-mining@example.invalid',
    role: 'user',
    isAuthenticated: true,
    kyc_status: 'approved',
    kyc_verified: true,
    balance: 100,
  };
  await page.route('**/api/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/auth/refresh', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/kyc/status', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'approved', verification_status: 'approved' }) }));
  await page.route('**/api/wallet', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balance: 100, transactions: [] }) }));
}

async function mockMiningApi(page: Page) {
  await page.route('**/api/mining/**', async route => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\/undefined(?=\/api\/)/, '');
    const payloads: Record<string, unknown> = {
      '/api/mining/dashboard': {
        capabilities: {
          live_mining_provider_connected: false,
          value_actions_enabled: false,
          production_message: 'Mining Preview · Live-Provider noch nicht verbunden.',
        },
        wallet: { blz_balance: 0, eur_value: 0 },
        mining: { total_hashrate: 0, daily_earnings: 0, active_miners: 0 },
        vip: { name: 'Bronze' },
        daily_reward: { claimed: false, amount: 0 },
        referral: { code: 'VISUAL' },
        miners: [],
        recent_transactions: [],
        streak: 0,
      },
      '/api/mining/packages': { packages: [] },
      '/api/mining/upgrade-costs': { costs: {} },
      '/api/mining/marketplace': { listings: [] },
      '/api/mining/card': {},
      '/api/mining/launchpad': { projects: [] },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payloads[pathname] ?? {}),
    });
  });
}

test('mining preview stays usable at 320px and keeps value actions disabled', async ({ page }) => {
  await mockMiningUser(page);
  await mockMiningApi(page);
  await prepareVisualPage(page, { name: '320x568', width: 320, height: 568 });
  await openRoute(page, '/mining', '[data-testid="mining-page"]');

  await expect(page.getByTestId('mining-provider-unavailable')).toBeVisible();
  await expect(page.getByTestId('mining-blitzmine-banner')).toBeVisible();
  await expect(page.getByTestId('mining-trust-banner')).toBeVisible();
  await expect(page.getByTestId('mining-withdraw-btn')).toBeDisabled();
  await expect(page.getByTestId('mining-send-btn')).toBeDisabled();

  for (const tab of ['dashboard', 'miners', 'wallet', 'shop', 'marketplace', 'card', 'launchpad', 'vip']) {
    await expect(page.getByTestId(`mining-tab-${tab}`)).toHaveCount(1);
  }

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
