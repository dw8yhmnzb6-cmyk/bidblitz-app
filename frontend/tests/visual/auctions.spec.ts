import { test } from 'playwright/test';
import { AUCTION_DETAIL_CONFIG, AUCTIONS_OVERVIEW_CONFIG, VISUAL_VIEWPORTS } from './test-data';
import { openFirstAuctionDetail, runRouteAudit } from './layout-checks';

for (const viewport of VISUAL_VIEWPORTS) {
  test(`visual auctions overview ${viewport.name}`, async ({ page }) => {
    await runRouteAudit(page, AUCTIONS_OVERVIEW_CONFIG, viewport);
  });

  test(`visual auction detail ${viewport.name}`, async ({ page }) => {
    await runRouteAudit(page, AUCTIONS_OVERVIEW_CONFIG, viewport);
    await openFirstAuctionDetail(page);
    await runRouteAudit(page, AUCTION_DETAIL_CONFIG, viewport, new URL(page.url()).pathname);
  });
}