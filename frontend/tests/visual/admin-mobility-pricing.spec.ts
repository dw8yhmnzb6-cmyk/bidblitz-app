import { test, expect, type Page } from 'playwright/test';

const ADMIN = {
  id: 'visual-admin',
  name: 'Visual Admin',
  email: 'visual-admin@example.invalid',
  role: 'admin',
  balance: 1000,
  currency: 'EUR',
  kyc_status: 'approved',
  kyc_verified: true,
};

async function mockAdminPricingApi(page: Page, state: { saved?: any }) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/^\/undefined(?=\/api\/)/, '');
    const method = route.request().method();

    let body: any = {};

    if (pathname === '/api/auth/me' || pathname === '/api/auth/refresh') {
      body = ADMIN;
    } else if (pathname === '/api/wallet') {
      body = { balance: 1000, transactions: [] };
    } else if (pathname === '/api/wallet/balance/total') {
      body = { total_balance_eur: 1000, crypto_balance_eur: 0, crypto_breakdown: [] };
    } else if (pathname === '/api/mobility-platform/admin/pricing/profiles' && method === 'GET') {
      body = {
        profiles: [
          {
            country_code: 'XK',
            city_key: 'prishtina',
            scope: 'city',
            city: 'Prishtina',
            region: 'Kosovo',
            currency: 'EUR',
            source: 'Prishtina benchmark',
            enabled: true,
            modes: {
              taxi: { base: 2, per_km: 0.65, minimum: 2, surge: false, basis: 'Prishtina taxi' },
              scooter: { base: 0.2, per_min: 0.18, minimum: 0.2, surge: false, basis: 'Prishtina scooter' },
            },
          },
          {
            country_code: 'DE',
            city_key: 'hamburg',
            scope: 'city',
            city: 'Hamburg',
            region: 'Deutschland',
            currency: 'EUR',
            source: 'Hamburg official tariff',
            enabled: true,
            modes: {
              taxi: { base: 4.5, minimum: 4.5, surge: false, basis: 'Hamburg taxi' },
            },
          },
        ],
      };
    } else if (pathname === '/api/mobility-platform/admin/pricing/profile' && method === 'PUT') {
      state.saved = JSON.parse(route.request().postData() || '{}');
      body = { ok: true, profile: state.saved };
    } else if (pathname.startsWith('/api/mobility-platform/admin/pricing/profile/') && method === 'DELETE') {
      body = { ok: true };
    } else if (pathname === '/api/features/public') {
      body = { features: [] };
    } else if (pathname === '/api/features/navigation') {
      body = { items: [] };
    } else if (pathname === '/api/notifications/unread-count') {
      body = { count: 0 };
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

test('admin can manage city mobility tariffs on mobile', async ({ page }) => {
  const state: { saved?: any } = {};
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('bidblitz_lang', 'de');
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('admin_layout_mode', 'full');
  });
  await mockAdminPricingApi(page, state);

  await page.goto('/admin/mobility-pricing');
  await expect(page.getByTestId('admin-mobility-pricing-page')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('mobility-pricing-profile-list')).toContainText('Prishtina');
  await expect(page.getByTestId('mobility-pricing-profile-list')).toContainText('Hamburg');

  await page.getByTestId('pricing-country-input').fill('DE');
  await page.getByTestId('pricing-city-input').fill('Berlin');
  await page.getByTestId('pricing-source-input').fill('Berlin local tariff source');
  await page.getByTestId('pricing-save-btn').click();

  await expect.poll(() => state.saved?.country_code).toBe('DE');
  expect(state.saved?.city).toBe('Berlin');
  expect(state.saved?.modes?.taxi).toBeTruthy();

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
