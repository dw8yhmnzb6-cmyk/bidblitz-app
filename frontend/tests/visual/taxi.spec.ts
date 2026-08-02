import { test } from 'playwright/test';
import { TAXI_CONFIG, VISUAL_VIEWPORTS } from './test-data';
import { runRouteAudit } from './layout-checks';

for (const viewport of VISUAL_VIEWPORTS) {
  test(`visual taxi booking ${viewport.name}`, async ({ page }) => {
    await runRouteAudit(page, TAXI_CONFIG, viewport);
  });
}