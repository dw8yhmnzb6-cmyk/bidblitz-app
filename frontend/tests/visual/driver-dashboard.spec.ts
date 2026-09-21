import { test, expect, type Page } from 'playwright/test';
import { openRoute, prepareVisualPage } from './layout-checks';

async function mockDriverSession(page: Page) {
  const user = {
    id: 'visual-driver-user',
    name: 'Canonical Driver',
    email: 'driver@example.invalid',
    role: 'user',
    isAuthenticated: true,
    kyc_status: 'approved',
    kyc_verified: true,
    balance: 125.5,
  };
  await page.route('**/api/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/auth/refresh', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/api/kyc/status', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'approved', verification_status: 'approved' }) }));

  const status = {
    driver_id: 'drv-visual-1',
    name: 'Canonical Driver',
    is_online: true,
    is_busy: false,
    vehicle: {
      type: 'standard',
      model: 'Model 3',
      license_plate: '01-ABC-001',
      color: 'Schwarz',
      year: 2026,
    },
    rating: 4.9,
    current_location: { lat: 42.6629, lng: 21.1655 },
    earnings: {
      today: 12.4,
      today_rides: 2,
      week: 48.8,
      week_rides: 7,
      total_rides: 24,
    },
    active_ride: null,
    pending_requests: [
      {
        request_id: 'ride-visual-1',
        ride_id: 'ride-visual-1',
        customer_name: 'Kunde',
        pickup: { address: 'Prishtina Zentrum', lat: 42.6629, lng: 21.1655 },
        destination: { address: 'Prishtina Airport', lat: 42.5728, lng: 21.0358 },
        distance_km: 3.2,
        estimated_fare: 4.2,
        eta_minutes: 5,
        status: 'pending',
      },
    ],
    balance: 125.5,
  };
  const profile = {
    driver_id: 'drv-visual-1',
    name: 'Canonical Driver',
    email: 'driver@example.invalid',
    phone: '+38300000000',
    vehicle: status.vehicle,
    rating: 4.9,
    is_verified: true,
    status: 'approved',
    joined_at: '2026-09-01T10:00:00+00:00',
    stats: {
      total_rides: 24,
      total_earned: 188.4,
      wallet_balance: 125.5,
    },
  };

  await page.route('**/api/driver-dashboard/status', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(status) }));
  await page.route('**/api/driver-dashboard/profile', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) }));
  await page.route('**/api/driver-dashboard/history**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rides: [], total: 0, total_earned: 0 }) }));
}

test('driver dashboard stays usable at 320px with canonical driver schema', async ({ page }) => {
  await mockDriverSession(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => success({
          coords: {
            latitude: 42.6629,
            longitude: 21.1655,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        } as GeolocationPosition),
      },
    });
  });

  await prepareVisualPage(page, { name: '320x568', width: 320, height: 568 });
  await openRoute(page, '/driver-dashboard', '[data-testid="driver-dashboard"]');

  await expect(page.getByTestId('driver-online-card')).toBeVisible();
  await expect(page.getByTestId('req-ride-visual-1')).toBeVisible();
  await expect(page.getByTestId('req-accept-ride-visual-1')).toBeVisible();
  await expect(page.getByTestId('req-reject-ride-visual-1')).toBeVisible();

  for (const tab of ['home', 'history', 'docs', 'profile']) {
    await expect(page.getByTestId(`driver-tab-${tab}`)).toBeVisible();
  }

  await page.getByTestId('driver-tab-profile').click();
  await expect(page.getByTestId('profile-tab')).toBeVisible();
  await expect(page.getByText('Canonical Driver', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Model 3', { exact: true })).toBeVisible();
  await expect(page.getByText('✓ Verifiziert', { exact: true })).toBeVisible();

  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
});
