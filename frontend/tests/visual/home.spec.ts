import fs from 'fs';
import path from 'path';
import { test, expect } from 'playwright/test';
import { VISUAL_VIEWPORTS } from './test-data';

for (const viewport of VISUAL_VIEWPORTS) {
  test(`guest home layout ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      localStorage.setItem('bidblitz_lang', 'de');
      localStorage.setItem('bidblitz_onboarded', '1');
      localStorage.setItem('bb_hint_dismissed', '1');
    });
    await page.goto('/');
    await expect(page.getByTestId('home-page')).toBeVisible({ timeout: 20000 });
    const compact = page.getByTestId('mobile-home-content');
    if (viewport.width < 768) {
      await expect(compact).toBeVisible();
      await expect(page.getByTestId('mobile-home-intro')).toBeVisible();
      await expect(page.getByTestId('mobile-home-activity')).toHaveCount(0);
      await expect(page.getByTestId('header-register-btn')).toHaveCount(0);
      const services = page.locator('[data-testid^="mobile-service-"]');
      await expect(services).toHaveCount(4);
      for (const service of await services.all()) {
        const box = await service.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    } else {
      await expect(compact).toHaveCount(0);
      await expect(page.getByTestId('header-register-btn')).toBeVisible();
    }
    const widths = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
    const screenshots = path.resolve(__dirname, '../../qa-output/screenshots');
    fs.mkdirSync(screenshots, { recursive: true });
    await page.screenshot({ path: path.join(screenshots, `home-${viewport.name}.png`), fullPage: true, animations: 'disabled' });
  });
}
