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
    const pathname = new URL(route.request().url()).pathname;
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

test('mining guest route opens authentication instead of silently returning home', async ({ page }) => {
  await page.route('**/api/auth/me', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Not authenticated' }) }),
  );
  await page.route('**/api/auth/refresh', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Not authenticated' }) }),
  );
  await prepareVisualPage(page, { name: '320x568-mining-guest-auth', width: 320, height: 568 });
  await openRoute(page, '/mining', '[data-testid="auth-page"]');

  await expect(page.getByTestId('auth-page')).toBeVisible();
  await expect(page.getByTestId('login-email-input')).toBeVisible();
  await expect(page.getByTestId('login-submit-btn')).toBeVisible();
});


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
  await expect(page.getByTestId('mining-claim-daily-btn')).toHaveCount(0);

  for (const tab of ['dashboard', 'miners', 'wallet', 'shop', 'marketplace', 'card', 'launchpad', 'vip']) {
    await expect(page.getByTestId(`mining-tab-${tab}`)).toHaveCount(1);
  }

  await page.getByTestId('mining-tab-shop').click();
  await expect(page.getByTestId('mining-shop-empty')).toBeVisible();
  await expect(page.getByTestId('mining-shop-retry')).toBeVisible();

  await page.getByTestId('mining-tab-card').click();
  await expect(page.getByTestId('mining-card-preview-unavailable')).toBeVisible();

  await page.getByTestId('mining-tab-marketplace').click();
  await expect(page.getByTestId('mining-marketplace-empty')).toBeVisible();
  await expect(page.getByText('Marketplace Preview', { exact: false })).toBeVisible();

  await page.getByTestId('mining-tab-launchpad').click();
  await expect(page.getByTestId('mining-launchpad-empty')).toBeVisible();
  await expect(page.getByText('Launchpad Preview', { exact: false })).toBeVisible();

  await page.getByTestId('mining-tab-dashboard').click();
  await expect(page.getByTestId('mining-earnings-preview-note')).toBeVisible();
  await expect(page.getByText('Mining Reward Preview', { exact: true })).toBeVisible();
  await expect(page.getByTestId('mining-blitzmine-banner')).toContainText('keine BLZ-Erzeugung in Production');

  await page.getByTestId('mining-tab-shop').click();
  await expect(page.getByText('Miner-Pakete Preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Ertrags-/ROI-Projektionen bleiben', { exact: false })).toBeVisible();
  await expect(page.getByTestId('mining-provider-unavailable')).toBeVisible();

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});


test('mining dashboard failure shows a retry state instead of a blank screen', async ({ page }) => {
  await mockMiningUser(page);
  await page.route('**/api/mining/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/mining/dashboard') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Mining dashboard temporarily unavailable' }),
      });
      return;
    }
    const payloads: Record<string, unknown> = {
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

  await prepareVisualPage(page, { name: '320x568-mining-error', width: 320, height: 568 });
  await openRoute(page, '/mining', '[data-testid="mining-load-error"]');

  await expect(page.getByText('Mining konnte nicht geladen werden')).toBeVisible();
  await expect(page.getByTestId('mining-retry-load')).toBeVisible();

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});


test('mining tolerates legacy numeric strings without crashing', async ({ page }) => {
  await mockMiningUser(page);
  await page.route('**/api/mining/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const payloads: Record<string, unknown> = {
      '/api/mining/dashboard': {
        capabilities: {
          live_mining_provider_connected: false,
          value_actions_enabled: false,
          production_message: 'Mining Preview · Live-Provider noch nicht verbunden.',
        },
        wallet: {
          blz_balance: '12.5',
          eur_value: '1.25',
          total_mined: '18.75',
          total_withdrawn: '2.5',
          main_balance_eur: '100.00',
        },
        mining: {
          total_hashrate: '250',
          daily_earnings_blz: '1.25',
          daily_earnings_eur: '0.125',
          monthly_earnings_blz: '37.5',
          monthly_earnings_eur: '3.75',
          yearly_earnings_blz: '456.25',
          yearly_earnings_eur: '45.625',
          active_miners: 1,
        },
        vip: { name: 'Bronze', bonus: '0.05', progress: '25' },
        daily_reward: { claimed: true, amount: '1.25', next_reward_at: '2099-01-01T00:00:00+00:00' },
        referral: { code: 'LEGACY', bonus_rate: '0.05', boost_bonus_blz: '0.0625' },
        miners: [{
          miner_id: 'legacy-miner',
          name: 'Legacy Miner',
          package_id: 'starter',
          icon: 'cpu',
          hashrate: '250',
          efficiency: '0.9',
          power_level: '0',
          efficiency_level: '0',
          daily_blz: '1.25',
          daily_eur: '0.125',
          status: 'active',
        }],
        recent_transactions: [{
          txn_id: 'legacy-tx',
          amount_blz: '1.25',
          amount_eur: '0',
          description: 'Legacy reward',
          created_at: '2026-09-21T10:00:00+00:00',
        }],
        streak: 2,
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

  await prepareVisualPage(page, { name: '320x568-mining-legacy-numbers', width: 320, height: 568 });
  await openRoute(page, '/mining', '[data-testid="mining-page"]');

  await expect(page.getByTestId('mining-page')).toBeVisible();
  await expect(page.getByText('12.5000')).toBeVisible();
  await expect(page.getByText('Legacy reward')).toBeVisible();
  await expect(page.getByText('+1.2500 BLZ')).toBeVisible();
  await expect(page.getByTestId('mining-load-error')).toHaveCount(0);
});


test('mining trust fails closed when live proof is unverified', async ({ page }) => {
  await page.route('**/api/mining/trust/public', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        proof_metrics: {},
        proof_verified_live: false,
        capabilities: {
          live_mining_provider_connected: false,
          value_actions_enabled: false,
        },
        network: {
          active_miners: 0,
          wallets: 0,
          registered_hashrate_ths: 0,
          registered_hashrate_phs: 0,
        },
        videos: [],
      }),
    }),
  );

  await prepareVisualPage(page, { name: '320x568-mining-trust-unverified', width: 320, height: 568 });
  await openRoute(page, '/mining-trust', '[data-testid="mining-trust-page"]');

  await expect(page.getByTestId('mining-trust-unverified-banner')).toBeVisible();
  await expect(page.getByTestId('mining-trust-title')).toHaveText('Mining Infrastruktur Preview');
  await expect(page.getByText('Keine verifizierte Live-Hardware-', { exact: false })).toBeVisible();
  await expect(page.getByTestId('mining-trust-stat-0')).toContainText('nicht verifiziert');

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});


test('blitzmine preview hides value actions when provider is unavailable', async ({ page }) => {
  await mockMiningUser(page);
  await page.route('**/api/blitz-mine/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const payloads: Record<string, unknown> = {
      '/api/blitz-mine/status': {
        capabilities: {
          value_actions_enabled: false,
          production_message: 'BlitzMine Preview · Live-Provider noch nicht verbunden.',
        },
        balance_blz: 0,
        profile: { role: 'pioneer', streak_days: 0, total_mined: 0, total_sessions: 0 },
        rate: { total_multiplier: 1, estimated_session_earnings: 0 },
        session: null,
        quick_bonus: null,
        competition: null,
        constants: { durations: [], early_release_penalty: 0.25 },
      },
      '/api/blitz-mine/circle': { members: [], max: 5, bonus_per_member: 0.2 },
      '/api/blitz-mine/lockup': { lockups: [] },
      '/api/blitz-mine/referrals': { total: 0, active_last_7d: 0, current_bonus: 0, bonus_per_active: 0.05, referrals: [] },
      '/api/blitz-mine/leaderboard': { leaderboard: [] },
      '/api/blitz-mine/streak': { current_streak: 0, milestones: [] },
      '/api/blitz-mine/reminders': null,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payloads[pathname] ?? {}),
    });
  });
  await page.route('**/api/referral/my-code', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'VISUAL' }) }),
  );
  await page.route('**/api/quests/today', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quests: [] }) }),
  );

  await prepareVisualPage(page, { name: '320x568-blitzmine-preview', width: 320, height: 568 });
  await openRoute(page, '/blitz-mine', '[data-testid="blitz-mine-page"]');

  await expect(page.getByTestId('blitzmine-provider-unavailable')).toBeVisible();
  await expect(page.getByTestId('lockup-preview-disabled')).toBeVisible();
  await expect(page.getByTestId('blitz-mine-tap-btn')).toHaveCount(0);
  await expect(page.getByTestId('blitz-turbo-tap-btn')).toHaveCount(0);
  await expect(page.getByTestId('blitz-quick-bonus-claim-btn')).toHaveCount(0);
  await expect(page.getByTestId('lockup-new-btn')).toHaveCount(0);

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
