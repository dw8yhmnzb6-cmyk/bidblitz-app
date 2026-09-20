import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from 'playwright/test';

const MOBILE_VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const user = {
  id: 'visual-mobility-user',
  name: 'Visual Mobility User',
  email: 'visual-mobility@example.invalid',
  role: 'user',
  modes: ['personal'],
  balance: 1234.56,
  currency: 'EUR',
  kyc_status: 'approved',
  kyc_verified: true,
  language: 'de',
};

async function mockMobilityApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/^\/undefined(?=\/api\/)/, '');
    const method = route.request().method();

    let body: any = {};

    if (pathname === '/api/auth/me' || pathname === '/api/auth/refresh') {
      body = user;
    } else if (pathname === '/api/wallet') {
      body = { id: 'visual-wallet', balance: 1234.56, currency: 'EUR', transactions: [] };
    } else if (pathname === '/api/wallet/balance/total') {
      body = { total_balance_eur: 1234.56, crypto_balance_eur: 0, crypto_breakdown: [] };
    } else if (pathname === '/api/mobility-platform/saved-locations') {
      body = method === 'GET' ? { locations: [] } : { ok: true };
    } else if (pathname === '/api/mobility-platform/recent-locations') {
      body = method === 'GET' ? { locations: [] } : { ok: true };
    } else if (pathname === '/api/mobility-platform/payment-options') {
      body = { wallet_balance: 1234.56, methods: [{ id: 'wallet', label: 'Wallet' }] };
    } else if (pathname === '/api/mobility-platform/my-bookings') {
      body = { bookings: [] };
    } else if (pathname === '/api/mobility-platform/preferences') {
      body = method === 'GET'
        ? { preferences: { priority: 'balance', luggage: false, childSeat: false } }
        : { ok: true };
    } else if (pathname === '/api/mobility-platform/reverse') {
      body = { address: 'Prishtina, Kosovo', city: 'Prishtina', country: 'Kosovo', country_code: 'XK' };
    } else if (pathname === '/api/mobility-platform/search') {
      body = {
        results: [
          { id: '1', name: 'Sheshi Nënë Tereza', address: 'Sheshi Nënë Tereza, Prishtina, Kosovo', lat: 42.6616, lng: 21.1636, city: 'Prishtina', country: 'Kosovo', country_code: 'XK' },
          { id: '2', name: 'Prishtina Mall', address: 'Prishtina Mall, Lipjan, Kosovo', lat: 42.579, lng: 21.148, city: 'Lipjan', country: 'Kosovo', country_code: 'XK' },
        ],
      };
    } else if (pathname === '/api/mobility-platform/route') {
      body = {
        distance_km: 3.4,
        duration_min: 8,
        geometry: [[21.1655, 42.6629], [21.1636, 42.6616]],
        pickup: { address: 'Prishtina, Kosovo', lat: 42.6629, lng: 21.1655, city: 'Prishtina', country: 'Kosovo', country_code: 'XK' },
        dropoff: { address: 'Sheshi Nënë Tereza, Prishtina, Kosovo', lat: 42.6616, lng: 21.1636 },
        pricing_context: { profile_key: 'XK:prishtina', region: 'Kosovo', city: 'Prishtina', country: 'Kosovo', country_code: 'XK', source: 'Prishtina public taxi and scooter benchmark', currency: 'EUR', profile_scope: 'city', city_key: 'prishtina' },
        options: [
          { type: 'taxi', label: 'Taxi', icon: 'car-front', price_eur: 4.21, duration_min: 8, distance_km: 3.4, eco_score: 55, payment_methods: ['wallet'], pricing_region: 'Kosovo', pricing_basis: 'Prishtina · 2,00 € Start + ca. 0,53–0,75 €/km', estimated: true, price_range_eur: { low: 3.80, high: 4.55 } },
          { type: 'scooter', label: 'E-Scooter', icon: 'zap', price_eur: 2.00, duration_min: 10, distance_km: 3.4, eco_score: 86, payment_methods: ['wallet'], pricing_region: 'Kosovo', pricing_basis: 'Prishtina · ca. 0,15–0,20 €/min + mögliche Entsperrgebühr', estimated: true, price_range_eur: { low: 1.70, high: 2.20 } },
          { type: 'bike', label: 'E-Bike', icon: 'bike', price_eur: 1.84, duration_min: 11, distance_km: 3.4, eco_score: 94, payment_methods: ['wallet'], pricing_region: 'Kosovo', pricing_basis: 'regionaler E-Bike-Schätzwert', estimated: true },
          { type: 'ev', label: 'EV Drive', icon: 'zap', price_eur: 3.89, duration_min: 9, distance_km: 3.4, eco_score: 92, payment_methods: ['wallet'], pricing_region: 'Kosovo', pricing_basis: 'regionaler EV-Schätzwert', estimated: true },
          { type: 'car_sharing', label: 'Carsharing', icon: 'car', price_eur: 3.25, duration_min: 9, distance_km: 3.4, eco_score: 64, payment_methods: ['wallet'], pricing_region: 'Kosovo', pricing_basis: 'regionaler Carsharing-Schätzwert', estimated: true },
          { type: 'car_rental', label: 'Mietwagen', icon: 'car', price_eur: 10.2, duration_min: 9, distance_km: 3.4, eco_score: 48, payment_methods: ['wallet'], pricing_region: 'Kosovo', pricing_basis: 'regionaler Mietwagen-Schätzwert', estimated: true },
        ],
        recommendations: {
          cheapest: { type: 'bike', label: 'E-Bike', reason: 'Günstigste Option' },
          fastest: { type: 'taxi', label: 'Taxi', reason: 'Schnellste Ankunft' },
          balance: { type: 'scooter', label: 'E-Scooter', reason: 'Beste Balance aus Preis und Zeit' },
          eco: { type: 'bike', label: 'E-Bike', reason: 'Niedrigste Emissionen' },
        },
      };
    } else if (pathname === '/api/mobility-platform/nearby') {
      body = {
        center: { lat: 42.6629, lng: 21.1655 },
        counts: { taxi: 2, scooter: 1, bike: 0, ev: 0, car_sharing: 0, car_rental: 0 },
        available_modes: [
          { type: 'taxi', label: 'Taxi', count: 2, live: true },
          { type: 'scooter', label: 'E-Scooter', count: 1, live: true },
        ],
        markers: [
          { type: 'scooter', lat: 42.6632, lng: 21.166, label: 'Scooter 21', subtitle: '85%', distance_km: 0.2 },
          { type: 'taxi', lat: 42.664, lng: 21.167, label: 'Taxi 7', subtitle: '3 Min', distance_km: 0.4 },
        ],
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

for (const viewport of MOBILE_VIEWPORTS) {
  test(`mobility map stays visible on mobile ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      localStorage.setItem('bidblitz_lang', 'de');
      localStorage.setItem('bidblitz_onboarded', '1');
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (success: any) => success({
            coords: { latitude: 42.6629, longitude: 21.1655, accuracy: 10 },
          }),
          watchPosition: () => 1,
          clearWatch: () => {},
        },
      });
    });
    await mockMobilityApi(page);

    await page.goto('/mobility-map?mode=scooter');
    await expect(page.getByTestId('bidblitz-mobility-platform-page')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('mobility-platform-map')).toBeVisible();
    await expect(page.getByTestId('mobility-map-controls')).toBeVisible();
    await expect(page.getByTestId('mobility-mode-focus-banner')).toContainText('E-Scooter');
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
    await expect(page.getByText('Zur START zurück', { exact: true })).toHaveCount(0);

    const mapBox = await page.getByTestId('mobility-platform-map').boundingBox();
    const controlsBox = await page.getByTestId('mobility-map-controls').boundingBox();
    expect(mapBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(mapBox!.height).toBeGreaterThanOrEqual(360);
    expect(controlsBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height - 2);
    expect(controlsBox!.x).toBeGreaterThanOrEqual(0);
    expect(controlsBox!.x + controlsBox!.width).toBeLessThanOrEqual(viewport.width);

    const widths = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);

    const screenshots = path.resolve(__dirname, '../../qa-output/screenshots');
    fs.mkdirSync(screenshots, { recursive: true });
    await page.screenshot({
      path: path.join(screenshots, `mobility-map-${viewport.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}


test('Kosovo route shows local scooter tariff clearly on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('bidblitz_lang', 'de');
    localStorage.setItem('bidblitz_onboarded', '1');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: any) => success({
          coords: { latitude: 42.6629, longitude: 21.1655, accuracy: 10 },
        }),
        watchPosition: () => 1,
        clearWatch: () => {},
      },
    });
  });
  await mockMobilityApi(page);

  await page.goto('/mobility-map?mode=scooter');
  await expect(page.getByTestId('mobility-dropoff-input')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('mobility-dropoff-input').fill('Nene Tereza');
  await expect(page.getByTestId('mobility-search-results-panel')).toBeVisible();
  await expect(page.locator('[data-testid^="mobility-search-result-"]')).toHaveCount(2);
  await expect(page.getByTestId('mobility-search-result-0')).toContainText('Prishtina');
  await expect(page.getByTestId('mobility-search-result-1')).toContainText('Kosovo');
  await page.getByTestId('mobility-search-result-0').click();

  await expect(page.getByTestId('mobility-pricing-context')).toContainText('Prishtina');
  await expect(page.getByTestId('mobility-pricing-scope')).toHaveText('Stadttarif');
  await expect(page.getByTestId('mobility-option-scooter')).toBeVisible();
  await expect(page.getByTestId('mobility-option-scooter')).toContainText('2,00');
  await expect(page.getByTestId('mobility-pricing-basis-scooter')).toContainText('0,15–0,20 €/min');
  await expect(page.getByTestId('mobility-price-range-scooter')).toContainText('1,70');
  await expect(page.getByTestId('mobility-price-range-scooter')).toContainText('2,20');
  await expect(page.getByTestId('mobility-option-car_rental')).toHaveCount(0);
  await expect(page.getByTestId('mobility-show-more-options')).toBeVisible();
  await page.getByTestId('mobility-show-more-options').click();
  await expect(page.getByTestId('mobility-option-car_rental')).toBeVisible();
  await expect(page.getByTestId('mobility-show-fewer-options')).toBeVisible();

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
