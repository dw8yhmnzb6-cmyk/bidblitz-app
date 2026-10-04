import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from 'playwright/test';
import { VISUAL_VIEWPORTS } from './test-data';

const GAMES_VIEWPORTS = VISUAL_VIEWPORTS.filter(({ width }) =>
  [320, 390, 768, 1440].includes(width)
);

async function mockGamesApis(page: Page) {
  // The static SPA server falls back to index.html for unknown /api paths.
  // Explicit auth failures keep the browser acceptance run in a real guest
  // state instead of accidentally mapping the HTML fallback to a fake user.
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not authenticated' }),
    });
  });
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'No refresh session' }),
    });
  });
  await page.route('**/api/games/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        games: [{
          id: 'community-puzzle',
          title: 'Community Puzzle',
          description: 'A reviewed community puzzle game.',
          category: 'Puzzle',
          languages: ['de', 'en'],
          public_url: 'https://play.games.example.test/game/community-puzzle/index.html',
          version_number: 2,
        }],
        count: 1,
      }),
    });
  });
  await page.route('**/api/games/profile**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ favorites: [] }),
    });
  });
}

async function openGames(page: Page, width: number, height: number, language = 'de') {
  await page.setViewportSize({ width, height });
  await mockGamesApis(page);
  await page.addInitScript((lang) => {
    localStorage.setItem('bidblitz_lang', lang);
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('bb_hint_dismissed', '1');
  }, language);
  await page.goto('/games', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('games-platform-page')).toBeVisible({ timeout: 20000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
}

for (const viewport of GAMES_VIEWPORTS) {
  test(`Games catalog responsive ${viewport.name}`, async ({ page }) => {
    await openGames(page, viewport.width, viewport.height);

    const shell = page.getByTestId('games-platform-page');
    await expect(shell).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'Dein nächstes Abenteuer.' })).toBeVisible();
    await expect(page.getByText('BidBlitz Match', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Community Puzzle', { exact: true })).toBeVisible();

    const language = page.getByTestId('games-language-select').locator('select');
    await expect(language.locator('option')).toHaveCount(51);

    await page.getByRole('button', { name: 'Arcade' }).click();
    await expect(page.getByText('Community Puzzle', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Alle Spiele' }).click();

    const search = page.getByRole('searchbox', { name: 'Spiel suchen' });
    await search.fill('Community');
    await expect(page.getByText('Community Puzzle', { exact: true })).toBeVisible();
    await expect(page.getByText('BidBlitz Match', { exact: true })).toHaveCount(0);
    await search.fill('');

    const communityLink = page.getByRole('link', { name: 'Spiel öffnen' });
    await expect(communityLink).toHaveAttribute('target', '_blank');
    await expect(communityLink).toHaveAttribute('rel', /noopener/);

    await expectNoHorizontalOverflow(page);

    if (viewport.width <= 390) {
      const languageTouchTarget = page.getByTestId('games-language-select').locator('label');
      const searchTouchTarget = page.locator('label').filter({ has: search });
      const touchTargets = [
        page.getByRole('button', { name: 'Alle Spiele' }),
        page.getByRole('button', { name: 'Puzzle' }),
        languageTouchTarget,
        searchTouchTarget,
      ];
      for (const locator of touchTargets) {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box!.height).toBeGreaterThanOrEqual(40);
      }
    }

    const screenshots = path.resolve(__dirname, '../../qa-output/screenshots');
    fs.mkdirSync(screenshots, { recursive: true });
    await page.screenshot({
      path: path.join(screenshots, `games-${viewport.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('Games RTL language switch persists and keeps fallback readable', async ({ page }) => {
  await openGames(page, 390, 844);

  const shell = page.getByTestId('games-platform-page');
  const language = page.getByTestId('games-language-select').locator('select');
  await language.selectOption('ar');

  await expect(shell).toHaveAttribute('dir', 'rtl');
  await expect(language).toHaveValue('ar');
  await expect(language).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('games-language-select').getByRole('status')).toContainText('currently shown in English');
  expect(await page.evaluate(() => localStorage.getItem('bidblitz_lang'))).toBe('ar');
  await expectNoHorizontalOverflow(page);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('games-platform-page')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('games-language-select').locator('select')).toHaveValue('ar');
});

test('Games Match preview opens from catalog and remains usable on 320px', async ({ page }) => {
  await openGames(page, 320, 568);

  await page.getByRole('button', { name: 'Spielvorschau öffnen' }).first().click();
  await expect(page).toHaveURL(/\/games\/match$/);
  await expect(page.getByRole('heading', { name: 'BidBlitz Match' })).toBeVisible();
  const frame = page.locator('iframe[title*="BidBlitz Match"]');
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(321);
  await expectNoHorizontalOverflow(page);
});
