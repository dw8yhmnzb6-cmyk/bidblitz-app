import { test, expect, type Page } from 'playwright/test';
import { AUCTION_DETAIL_CONFIG, AUCTIONS_OVERVIEW_CONFIG, VISUAL_VIEWPORTS } from './test-data';
import { openFirstAuctionDetail, openRoute, prepareVisualPage, runRouteAudit } from './layout-checks';

const VISUAL_AUCTION = {
  auction_id: 'visual-qa-auction-1',
  title: 'Laptop Pro 14',
  description: 'Deterministic visual-QA auction fixture for responsive layout checks.',
  status: 'active',
  category: 'laptop',
  product_type: 'laptop',
  image_category: 'laptop',
  image_verified: true,
  image_source: 'visual-qa-fixture',
  current_price: 12.5,
  retail_price: 1499,
  bid_cost: 0.5,
  bid_value_eur: 0.5,
  price_increment: 0.01,
  revenue_target_eur: 50,
  featured: true,
  total_bids: 24,
  unique_bidders: 8,
  ends_at: '2099-12-31T23:59:59.000Z',
  image_url:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"%3E%3Crect width="1200" height="800" fill="%23e5e7eb"/%3E%3Crect x="270" y="150" width="660" height="420" rx="24" fill="%23111827"/%3E%3Crect x="305" y="185" width="590" height="350" rx="12" fill="%23f8fafc"/%3E%3Cpath d="M180 610h840l-70 55H250z" fill="%236b7280"/%3E%3C/svg%3E',
};

const VISUAL_BIDS = Array.from({ length: 12 }, (_, index) => ({
  bid_id: `visual-bid-${index + 1}`,
  user_name: index === 0 ? 'Moritz_L' : `Bidder_${index + 1}`,
  bid_price: Number((53.41 - index * 0.01).toFixed(2)),
  created_at: new Date(Date.UTC(2026, 8, 20, 15, 3 - index, 20)).toISOString(),
  is_auto: index % 3 === 0,
}));

async function mockVerifiedAuctionUser(page: Page) {
  const approvedUser = {
    id: 'visual-auction-user',
    name: 'Visual Auction User',
    email: 'visual-auction@example.invalid',
    role: 'user',
    isAuthenticated: true,
    kyc_status: 'approved',
    kyc_verified: true,
    balance: 1000,
  };
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(approvedUser) });
  });
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(approvedUser) });
  });
  await page.route('**/api/kyc/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'approved', verification_status: 'approved', can_use_auctions: true }),
    });
  });
  await page.route('**/api/wallet', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balance: 1000, transactions: [] }) });
  });
}

async function mockAuctionApi(page: Page) {
  await page.route('**/api/auctions**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.abort('blockedbyclient');
      return;
    }

    const pathname = new URL(route.request().url()).pathname.replace(/^\/undefined(?=\/api\/)/, '');
    const body = pathname === '/api/auctions'
      ? { auctions: [VISUAL_AUCTION] }
      : pathname === `/api/auctions/${VISUAL_AUCTION.auction_id}`
        ? { auction: VISUAL_AUCTION, bids: VISUAL_BIDS, unique_bidders: VISUAL_AUCTION.unique_bidders }
        : null;
    if (!body) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

for (const viewport of VISUAL_VIEWPORTS) {
  test(`visual auctions overview ${viewport.name}`, async ({ page }) => {
    await mockVerifiedAuctionUser(page);
    await mockAuctionApi(page);
    await runRouteAudit(page, AUCTIONS_OVERVIEW_CONFIG, viewport);
    await expect(page.getByTestId('auction-premium-hero')).toBeVisible();
    await expect(page.getByTestId(`auction-premium-quick-bid-${VISUAL_AUCTION.auction_id}`)).toBeVisible();
  });

  test(`visual auction detail ${viewport.name}`, async ({ page }) => {
    await mockVerifiedAuctionUser(page);
    await mockAuctionApi(page);
    await prepareVisualPage(page, viewport);
    await openRoute(page, '/auctions', AUCTIONS_OVERVIEW_CONFIG.waitFor);
    await openFirstAuctionDetail(page);
    await runRouteAudit(page, AUCTION_DETAIL_CONFIG, viewport, new URL(page.url()).pathname, { navigate: false });
    if (viewport.width < 768) {
      await expect(page.getByTestId('auction-bid-history')).toBeVisible();
      await expect(page.getByTestId('auction-bid-row-price')).toHaveCount(5);
      await expect(page.getByTestId('auction-bid-history-toggle')).toContainText('Weitere 7 Gebote');
      await page.getByTestId('auction-bid-history-toggle').click();
      await expect(page.getByTestId('auction-bid-row-price')).toHaveCount(12);
      await expect(page.getByTestId('auction-bid-history-toggle')).toContainText('Weniger anzeigen');
    }
  });
}
