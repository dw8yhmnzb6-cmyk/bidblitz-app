import { test, expect, type Page } from 'playwright/test';
import { openRoute, prepareVisualPage } from './layout-checks';

async function mockScooterUser(page: Page) {
  const user = {
    id: 'visual-scooter-user',
    name: 'Visual Scooter User',
    email: 'visual-scooter@example.invalid',
    role: 'user',
    isAuthenticated: true,
    kyc_status: 'approved',
    kyc_verified: true,
    balance: 25,
  };
  await page.route('**/api/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/auth/refresh', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
}

async function mockScooterApi(page: Page) {
  const pricing = {
    unlock_fee: 0.2,
    per_minute: 0.18,
    daily_cap: 15,
    min_balance: 5,
    minimum_charge: 0.2,
    currency: 'EUR',
    profile_scope: 'city',
    source: 'Prishtina public taxi and scooter benchmark',
    city: 'Prishtina',
    country: 'Kosovo',
    country_code: 'XK',
    basis: 'Prishtina · ca. 0,15–0,20 €/min + mögliche Entsperrgebühr',
    available: true,
    billing_supported: true,
  };

  await page.route('**/api/scooter/**', async route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/^\/undefined(?=\/api\/)/, '');
    let body: unknown = {};
    if (pathname === '/api/scooter/pricing') {
      const selectedScooterPricing = url.searchParams.get('lat') === '42.6629'
        && url.searchParams.get('lng') === '21.1655';
      body = {
        ...pricing,
        ...(selectedScooterPricing ? { unlock_fee: 0.35, basis: 'Tarif am ausgewählten Scooter-Standort' } : {}),
        free_paused_minutes: 5,
        max_speed_kmh: 25,
        subscription_plans: [],
      };
    } else if (pathname === '/api/scooter/nearby') {
      body = {
        module_enabled: true,
        scooters: [{
          scooter_id: 'BB-SC-001',
          model: 'BidBlitz S1',
          battery: 88,
          battery_percent: 88,
          range_km: 35,
          lat: 42.6629,
          lng: 21.1655,
          distance_km: 0.2,
          walk_minutes: 2,
          status: 'available',
        }],
        total: 1,
        pricing,
      };
    } else if (pathname === '/api/scooter/active') {
      body = { has_active_rental: false, has_active: false, rental: null, ride: null };
    } else if (pathname === '/api/scooter/subscription-plans') {
      body = { plans: [] };
    } else if (pathname === '/api/scooter/my-subscription') {
      body = { subscription: null };
    } else if (pathname === '/api/scooter/history') {
      body = { rides: [], rentals: [], total: 0, stats: { total_spent: 0, total_distance_km: 0, total_rides: 0 } };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('scooter local city pricing stays usable at 320px', async ({ page }) => {
  await mockScooterUser(page);
  await mockScooterApi(page);
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 42.6629, longitude: 21.1655 });

  await prepareVisualPage(page, { name: '320x568', width: 320, height: 568 });
  await openRoute(page, '/scooter', '[data-testid="scooter-page"]');

  await expect(page.getByTestId('scooter-local-pricing')).toBeVisible();
  await expect(page.getByTestId('scooter-local-pricing')).toContainText('Prishtina');
  await expect(page.getByTestId('scooter-local-pricing')).toContainText('Stadttarif');
  await expect(page.getByText('BB-SC-001').first()).toBeVisible();

  await page.getByText('BB-SC-001').first().click();
  await expect(page.getByTestId('scooter-unlock-sheet')).toBeVisible();
  await expect(page.getByTestId('scooter-unlock-button')).toContainText('0.35');

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
