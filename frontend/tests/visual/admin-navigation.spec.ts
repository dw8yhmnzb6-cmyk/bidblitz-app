import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from 'playwright/test';

const ADMIN = {
  id: 'visual-admin-nav',
  name: 'Visual Admin',
  email: 'visual-admin@example.invalid',
  role: 'admin',
  balance: 1000,
  currency: 'EUR',
  kyc_status: 'approved',
  kyc_verified: true,
};

function readAdminItems() {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../src/components/admin/sections.js'),
    'utf8',
  );
  const items: Array<{ key: string; label: string; nav?: string }> = [];
  for (const line of source.split('\n')) {
    if (!line.includes('{ key:')) continue;
    const key = line.match(/key:\s*"([^"]+)"/)?.[1];
    const label = line.match(/label:\s*"([^"]+)"/)?.[1];
    const nav = line.match(/nav:\s*"([^"]+)"/)?.[1];
    if (key && label) items.push({ key, label, nav });
  }
  return items;
}

async function mockAdminApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname
      .replace(/^\/admin\/undefined(?=\/api\/)/, '')
      .replace(/^\/undefined(?=\/api\/)/, '');
    const method = route.request().method();

    let body: any = {};
    if (pathname === '/api/auth/me' || pathname === '/api/auth/refresh') {
      body = ADMIN;
    } else if (pathname === '/api/kyc/status') {
      body = { status: 'approved', verification_status: 'approved', verified: true, can_use_auctions: true };
    } else if (pathname === '/api/wallet') {
      body = { balance: 1000, transactions: [] };
    } else if (pathname === '/api/wallet/balance/total') {
      body = { total_balance_eur: 1000, crypto_balance_eur: 0, crypto_breakdown: [] };
    } else if (pathname === '/api/admin/stats') {
      body = {
        total_users: 25,
        total_merchants: 4,
        total_transactions: 120,
        payment_volume: 1000,
        total_revenue: 100,
      };
    } else if (pathname === '/api/admin/users') {
      body = { users: [] };
    } else if (pathname === '/api/kyc/admin/list') {
      body = { reviews: [], total: 0 };
    } else if (pathname === '/api/role-requests/admin/list') {
      body = { requests: [] };
    } else if (pathname === '/api/pay/admin/applications') {
      body = { applications: [], count: 0 };
    } else if (pathname === '/api/admin/payouts') {
      body = { payouts: [] };
    } else if (pathname === '/api/auctions/active') {
      body = { auctions: [] };
    } else if (pathname === '/api/auctions/admin/winners') {
      body = { winners: [] };
    } else if (pathname === '/api/admin/grants/coupons') {
      body = { coupons: [] };
    } else if (pathname === '/api/ladesaeulen/stations') {
      body = { stations: [] };
    } else if (pathname === '/api/ladesaeulen/stats') {
      body = {};
    } else if (pathname === '/api/real-estate/listings') {
      body = { listings: [] };
    } else if (pathname === '/api/freelancer/freelancers') {
      body = { freelancers: [] };
    } else if (pathname === '/api/elearning/courses') {
      body = { courses: [] };
    } else if (pathname === '/api/handwerker/list') {
      body = { handwerker: [] };
    } else if (pathname === '/api/gebrauchtwagen/listings') {
      body = { cars: [] };
    } else if (pathname === '/api/reinigung/services') {
      body = { services: [] };
    } else if (pathname === '/api/umzug/companies') {
      body = { companies: [] };
    } else if (pathname === '/api/tierbetreuung/sitters') {
      body = { sitters: [] };
    } else if (pathname === '/api/streaming/catalog') {
      body = { catalog: [] };
    } else if (pathname === '/api/telemedizin/doctors') {
      body = { doctors: [] };
    } else if (pathname === '/api/dating/discover') {
      body = { profiles: [] };
    } else if (pathname === '/api/fitness/gyms') {
      body = { gyms: [] };
    } else if (pathname === '/api/reiseplaner/trips') {
      body = { trips: [] };
    } else if (pathname === '/api/scooter/plans') {
      body = { plans: [] };
    } else if (pathname === '/api/features/public') {
      body = { features: [] };
    } else if (pathname === '/api/features/navigation') {
      body = { items: [] };
    } else if (pathname === '/api/notifications/unread-count') {
      body = { count: 0 };
    } else if (method !== 'GET') {
      body = { ok: true };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function openAdmin(page: Page) {
  await page.goto('/admin');
  await expect(page.getByTestId('admin-panel-full')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  await expect(page.getByText('Zur START zurück', { exact: true })).toHaveCount(0);
}

async function assertMobileDestinationHealthy(page: Page, pathname: string) {
  await page.waitForTimeout(120);
  await expect(page.getByRole('heading', { name: 'Etwas ist schiefgelaufen', exact: true })).toHaveCount(0);
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  }
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
}

test('all admin cards have working mobile destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('bidblitz_lang', 'de');
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('admin_layout_mode', 'full');
  });
  await mockAdminApi(page);
  await openAdmin(page);

  const items = readAdminItems();
  expect(items.length).toBeGreaterThanOrEqual(70);
  await expect(page.locator('[data-testid^="admin-item-"]')).toHaveCount(items.length);

  const usersBox = await page.getByTestId('admin-item-users').boundingBox();
  const kycBox = await page.getByTestId('admin-item-kyc').boundingBox();
  const rolesBox = await page.getByTestId('admin-item-roles').boundingBox();
  const staffBox = await page.getByTestId('admin-item-staff').boundingBox();
  expect(usersBox).not.toBeNull();
  expect(kycBox).not.toBeNull();
  expect(rolesBox).not.toBeNull();
  expect(staffBox).not.toBeNull();
  expect(Math.abs(usersBox!.y - kycBox!.y)).toBeLessThan(3);
  expect(Math.abs(usersBox!.y - rolesBox!.y)).toBeLessThan(3);
  expect(staffBox!.y).toBeGreaterThan(usersBox!.y + 20);

  for (const item of items) {
    const card = page.getByTestId(`admin-item-${item.key}`);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    await card.click();

    if (item.nav?.startsWith('/')) {
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 10000 }).toBe(item.nav);
      await assertMobileDestinationHealthy(page, item.nav);
      await openAdmin(page);
      continue;
    }

    await expect(page.getByTestId('admin-detail-back')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('admin-detail-error')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: item.label, exact: true })).toBeVisible();
    await page.getByTestId('admin-detail-back').click();
    await expect(page.getByTestId(`admin-item-${item.key}`)).toBeVisible();
  }

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});


test('admin grid mode keeps the same canonical mobile destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('bidblitz_lang', 'de');
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('admin_layout_mode', 'grid');
  });
  await mockAdminApi(page);

  await page.goto('/admin');
  await expect(page.getByTestId('admin-panel-full')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  await expect(page.getByText('Zur START zurück', { exact: true })).toHaveCount(0);

  const items = readAdminItems();
  await expect(page.locator('[data-testid^="admin-item-"]')).toHaveCount(items.length);
  await expect(page.getByTestId('admin-item-admin-audi-tickets')).toBeVisible();
  await expect(page.getByTestId('admin-item-admin-mobility-pricing')).toBeVisible();

  const first = await page.getByTestId('admin-item-users').boundingBox();
  const second = await page.getByTestId('admin-item-kyc').boundingBox();
  const third = await page.getByTestId('admin-item-roles').boundingBox();
  const fourth = await page.getByTestId('admin-item-staff').boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(third).not.toBeNull();
  expect(fourth).not.toBeNull();
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(3);
  expect(Math.abs(first!.y - third!.y)).toBeLessThan(3);
  expect(fourth!.y).toBeGreaterThan(first!.y + 20);
  expect(first!.height).toBeLessThanOrEqual(82);

  await page.getByTestId('admin-item-admin-audi-tickets').click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/admin/audi-ticket-system');
  await assertMobileDestinationHealthy(page, '/admin/audi-ticket-system');

  await page.goto('/admin');
  await expect(page.getByTestId('admin-panel-full')).toBeVisible();
  await page.getByTestId('admin-item-admin-mobility-pricing').scrollIntoViewIfNeeded();
  await page.getByTestId('admin-item-admin-mobility-pricing').click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/admin/mobility-pricing');
  await assertMobileDestinationHealthy(page, '/admin/mobility-pricing');

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});


test('admin stays usable on 320px mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    localStorage.setItem('bidblitz_lang', 'de');
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('admin_layout_mode', 'full');
  });
  await mockAdminApi(page);
  await openAdmin(page);

  const items = readAdminItems();
  await expect(page.locator('[data-testid^="admin-item-"]')).toHaveCount(items.length);
  await expect(page.getByTestId('admin-search')).toBeVisible();

  const adminWidths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(adminWidths.content).toBeLessThanOrEqual(adminWidths.viewport + 1);

  const first = await page.getByTestId('admin-item-users').boundingBox();
  const second = await page.getByTestId('admin-item-kyc').boundingBox();
  const third = await page.getByTestId('admin-item-roles').boundingBox();
  const fourth = await page.getByTestId('admin-item-staff').boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(third).not.toBeNull();
  expect(fourth).not.toBeNull();
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(3);
  expect(Math.abs(first!.y - third!.y)).toBeLessThan(3);
  expect(fourth!.y).toBeGreaterThan(first!.y + 20);

  await page.getByTestId('admin-item-admin-mobility-pricing').scrollIntoViewIfNeeded();
  await page.getByTestId('admin-item-admin-mobility-pricing').click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/admin/mobility-pricing');
  await assertMobileDestinationHealthy(page, '/admin/mobility-pricing');

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
