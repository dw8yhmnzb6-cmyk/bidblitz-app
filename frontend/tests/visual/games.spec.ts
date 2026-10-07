import fs from 'fs';
import path from 'path';
import { test, expect, type Page } from 'playwright/test';
import { VISUAL_VIEWPORTS } from './test-data';

const GAMES_VIEWPORTS = VISUAL_VIEWPORTS.filter(({ width }) =>
  [320, 390, 768, 1440].includes(width)
);
const RUNNER_INTEGRITY_VECTORS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../backend/data/runner_integrity_vectors.json'), 'utf8')
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
  await page.route('**/api/games/catalog/community-puzzle', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'community-puzzle',
        slug: 'community-puzzle',
        title: 'Community Puzzle',
        description: 'A reviewed community puzzle game.',
        category: 'Puzzle',
        languages: ['de', 'en'],
        public_url: 'https://play.games.example.test/game/community-puzzle/index.html',
        active_version_id: 'community-v2',
        version_number: 2,
        source: 'third_party',
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
  await page.route('**/api/games/progress/bubble', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Not authenticated' }),
    });
  });
  await page.route('**/api/games/reviews/summaries**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summaries: {
          match: { count: 2, average: 4.5 },
          bubble: { count: 1, average: 5.0 },
          runner: { count: 2, average: 4.5 },
          'community-puzzle': { count: 3, average: 4.33 },
        },
      }),
    });
  });
  await page.route('**/api/games/analytics/*/launch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ recorded: true, measurement: 'approximate_launches', monetary: false }),
    });
  });
  await page.route('**/api/games/reviews/match', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        game_id: 'match',
        summary: { count: 2, average: 4.5 },
        reviews: [
          { id: 'review-a', game_id: 'match', rating: 5, text: 'Great puzzle game.' },
          { id: 'review-b', game_id: 'match', rating: 4, text: 'Nice levels.' },
        ],
      }),
    });
  });
  await page.route('**/api/games/reviews/bubble', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        game_id: 'bubble',
        summary: { count: 1, average: 5.0 },
        reviews: [{ id: 'review-bubble', game_id: 'bubble', rating: 5, text: 'Colorful and calm.' }],
      }),
    });
  });
  await page.route('**/api/games/reviews/runner', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        game_id: 'runner',
        summary: { count: 2, average: 4.5 },
        reviews: [
          { id: 'review-runner-a', game_id: 'runner', rating: 5, text: 'Fast and clean.' },
          { id: 'review-runner-b', game_id: 'runner', rating: 4, text: 'Nice track design.' },
        ],
      }),
    });
  });
}

async function mockGamesAdminApis(page: Page) {
  const reviewedTranslations = new Set<string>();
  const reviewableCodes = ['de', 'sq'];

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'admin-1',
        name: 'Games Admin',
        email: 'games-admin@example.test',
        role: 'admin',
        modes: ['personal'],
        kyc_status: 'approved',
        kyc_verified: true,
        language: 'de',
      }),
    });
  });
  await page.route('**/api/admin/game-studio/versions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ versions: [] }),
    });
  });
  await page.route('**/api/admin/game-studio/preflight', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ready: true,
        checks: {
          public_origin_safe: true,
          preview_origin_safe: true,
          origins_isolated: true,
          upload_storage_safe: true,
          preview_storage_safe: true,
          release_storage_safe: true,
          storage_roots_distinct: true,
          billing_fail_closed: true,
        },
        public_origin: { host: 'play.games.example.test' },
        preview_origin: { host: 'preview.games.example.test' },
        billing: { enabled: false, fail_closed: true },
      }),
    });
  });
  await page.route('**/api/admin/game-studio/diagnostics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        preflight_ready: true,
        billing_fail_closed: true,
        counts: {
          drafts: 8,
          versions: 14,
          submitted: 3,
          archive_approved: 2,
          preview_approved: 1,
          published: 4,
          unpublished: 2,
          publication_events: 11,
          publication_locks: 0,
          reviews_visible: 6,
          reviews_hidden: 2,
          review_moderation_events: 3,
        },
      }),
    });
  });
  await page.route('**/api/admin/game-studio/translation-reviews**', async (route) => {
    const url = new URL(route.request().url());
    const prefix = '/api/admin/game-studio/translation-reviews/';
    if (route.request().method() === 'POST' && url.pathname.startsWith(prefix)) {
      const code = decodeURIComponent(url.pathname.slice(prefix.length));
      const body = route.request().postDataJSON() as { reviewed?: boolean };
      if (body.reviewed) reviewedTranslations.add(code);
      else reviewedTranslations.delete(code);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code,
          reviewed: reviewedTranslations.has(code),
          reviewed_at: reviewedTranslations.has(code) ? '2026-10-05T08:00:00+00:00' : null,
          note: '',
        }),
      });
      return;
    }

    const reviewed = [...reviewedTranslations];
    const pending = reviewableCodes.filter((code) => !reviewedTranslations.has(code));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source_language: 'en',
        localized_count: 50,
        human_reviewed_count: reviewed.length,
        pending_count: 50 - reviewed.length,
        human_reviewed_codes: reviewed,
        pending_codes: pending,
        items: reviewableCodes.map((code) => ({
          code,
          reviewed: reviewedTranslations.has(code),
          reviewed_at: reviewedTranslations.has(code) ? '2026-10-05T08:00:00+00:00' : null,
          note: '',
        })),
      }),
    });
  });
  await page.route('**/api/admin/game-studio/finance/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sandbox_enabled: false,
        configured: true,
        currency: 'EUR',
        developer_share_bps: 2000,
        purchase_count: 5,
        refund_count: 2,
        net_gross_eur_cents: 4200,
        net_developer_eur_cents: 840,
        net_platform_eur_cents: 3360,
        monetary_execution: false,
        payout_execution: false,
      }),
    });
  });
  await page.route('**/api/admin/game-studio/release-health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        summary: { published: 1, healthy: 1, busy: 0, degraded: 0 },
        games: [{
          id: 'community-puzzle',
          title: 'Community Puzzle',
          active_version_id: 'community-v2',
          version_number: 2,
          status: 'ok',
          issues: [],
        }],
        side_effects: 'none',
      }),
    });
  });
  await page.route('**/api/admin/games/reviews**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        reviews: [{
          id: '0123456789abcdef0123456789abcdef',
          game_id: 'match',
          rating: 2,
          text: 'Needs moderator attention.',
          status: 'visible',
          moderation_note: '',
        }],
      }),
    });
  });
}

async function mockDeveloperStudioApis(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'developer-1',
        name: 'Game Developer',
        email: 'developer@example.test',
        role: 'user',
        modes: ['personal'],
        kyc_status: 'approved',
        kyc_verified: true,
        language: 'de',
      }),
    });
  });
  await page.route('**/api/game-studio/drafts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ drafts: [] }),
    });
  });
  await page.route('**/api/games/developer/plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plans: [
          { id: 'starter', max_published_games: 1, price_eur_cents: null, checkout_ready: false },
          { id: 'studio', max_published_games: 10, price_eur_cents: null, checkout_ready: false },
        ],
        billing_ready: false,
        currency: 'EUR',
      }),
    });
  });
  await page.route('**/api/games/developer/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entitlement: null,
        active: false,
        published_games: 1,
        max_published_games: 0,
        billing_ready: false,
      }),
    });
  });
  await page.route('**/api/games/finance/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sandbox_enabled: false,
        configured: true,
        currency: 'EUR',
        developer_share_bps: 2000,
        purchase_count: 3,
        refund_count: 1,
        net_gross_eur_cents: 2500,
        net_developer_eur_cents: 500,
        net_platform_eur_cents: 2000,
        monetary_execution: false,
        payout_execution: false,
      }),
    });
  });
  await page.route('**/api/games/developer/analytics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        drafts: 3,
        versions: 7,
        submitted: 2,
        archive_approved: 1,
        preview_approved: 1,
        published: 1,
        unpublished: 1,
        reviews_visible: 5,
        reviews_hidden: 1,
        approximate_launches: 42,
        launch_measurement: 'approximate_non_monetary',
        billing_ready: false,
      }),
    });
  });
  await page.route('**/api/games/developer/analytics/games', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        monetary: false,
        games: [{
          id: 'game-a',
          title: 'Island Quest',
          status: 'published',
          version_number: 2,
          reviews_visible: 2,
          reviews_hidden: 1,
          rating_average: 4.5,
          approximate_launches: 17,
          launch_measurement: 'approximate_non_monetary',
        }],
      }),
    });
  });
}

async function openGames(page: Page, width: number, height: number, language = 'de') {
  await page.setViewportSize({ width, height });
  await mockGamesApis(page);
  await page.addInitScript((lang) => {
    if (!localStorage.getItem('bidblitz_lang')) {
      localStorage.setItem('bidblitz_lang', lang);
    }
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('bb_hint_dismissed', '1');
  }, language);
  // /games is also a real static asset directory in the build. Static hosts
  // may canonicalize it to /games/, so acceptance deliberately exercises the
  // trailing-slash deep link that the SPA must normalize.
  await page.goto('/games/', { waitUntil: 'networkidle' });
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
    await expect(page.getByTestId('game-rating-match')).toContainText('4.5');
    await expect(page.getByTestId('game-rating-community-puzzle')).toContainText('4.3');

    const language = page.getByTestId('games-language-select').locator('select');
    await expect(language.locator('option')).toHaveCount(51);

    await page.getByRole('button', { name: 'Arcade' }).click();
    await expect(page.getByText('Community Puzzle', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Alle Spiele' }).click();

    const search = page.getByRole('searchbox', { name: 'Spiel suchen' });
    await search.fill('Community');
    const results = page.locator('section[aria-label="Alle Spiele"]');
    await expect(results.getByText('Community Puzzle', { exact: true })).toBeVisible();
    await expect(results.getByText('BidBlitz Match', { exact: true })).toHaveCount(0);
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
  await expect(page.getByTestId('games-language-select').getByRole('status')).toContainText('Core Games navigation is translated');
  await expect(page.getByRole('heading', { name: 'مغامرتك القادمة.' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'ابحث عن ألعاب' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bidblitz_lang'))).toBe('ar');
  await expectNoHorizontalOverflow(page);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('games-platform-page')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('games-language-select').locator('select')).toHaveValue('ar');
});

test('Games developer studio shows owner-scoped non-monetary portfolio metrics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDeveloperStudioApis(page);
  await page.addInitScript(() => {
    localStorage.setItem('bidblitz_lang', 'de');
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('bb_hint_dismissed', '1');
  });

  await page.goto('/game-studio', { waitUntil: 'networkidle' });

  await expect(page.getByTestId('game-studio-page')).toBeVisible({ timeout: 20000 });
  const analytics = page.getByTestId('games-developer-analytics');
  await expect(analytics).toBeVisible();
  await expect(analytics.getByText('Dein Games-Portfolio')).toBeVisible();
  await expect(analytics.getByText('Öffentliche Reviews', { exact: true }).first()).toBeVisible();
  await expect(analytics.getByText('Starts (ca.)', { exact: true }).first()).toBeVisible();
  await expect(analytics.getByText('42', { exact: true })).toBeVisible();
  const gameAnalytics = page.getByTestId('developer-game-analytics-game-a');
  await expect(gameAnalytics).toBeVisible();
  await expect(gameAnalytics.getByText('Island Quest')).toBeVisible();
  await expect(gameAnalytics.getByText('17', { exact: true })).toBeVisible();
  await expect(gameAnalytics.getByText('4.5', { exact: false })).toBeVisible();
  await expect(analytics.getByText('Games-Billing bleibt gesperrt.')).toBeVisible();

  const finance = page.getByTestId('games-finance-sandbox-developer');
  await expect(finance).toBeVisible();
  await expect(finance.getByText('Finanz-Sandbox')).toBeVisible();
  await expect(finance.getByText('Sandbox gesperrt')).toBeVisible();
  await expect(finance.getByText('20.00%', { exact: true })).toBeVisible();
  await expect(finance.getByText(/Keine echte Zahlung/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Games admin operations diagnostics render without private data', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGamesAdminApis(page);
  await page.addInitScript(() => {
    localStorage.setItem('bidblitz_lang', 'de');
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('bb_hint_dismissed', '1');
  });

  await page.goto('/admin/game-studio', { waitUntil: 'networkidle' });

  const diagnostics = page.getByTestId('games-diagnostics-card');
  await expect(diagnostics).toBeVisible({ timeout: 20000 });
  await expect(diagnostics.getByText('Games Betrieb')).toBeVisible();
  await expect(diagnostics.getByText('Betrieb OK')).toBeVisible();
  await expect(diagnostics.getByText('Entwürfe')).toBeVisible();
  await expect(diagnostics.getByText('8', { exact: true })).toBeVisible();
  await expect(diagnostics.getByText('Aktive Locks')).toBeVisible();
  await expect(diagnostics.getByText('0', { exact: true })).toBeVisible();
  await expect(diagnostics.getByText('Reviews sichtbar')).toBeVisible();
  await expect(diagnostics.getByText('Reviews ausgeblendet')).toBeVisible();
  await expect(diagnostics.getByText('Review-Moderationen')).toBeVisible();

  const releaseHealth = page.getByTestId('games-release-health-card');
  await expect(releaseHealth).toBeVisible();
  await expect(releaseHealth.getByText('Release Health')).toBeVisible();
  await expect(releaseHealth.getByText('Community Puzzle')).toBeVisible();
  await expect(releaseHealth.getByText('Gesund', { exact: true }).first()).toBeVisible();
  await expect(releaseHealth).not.toContainText('release_path');
  await expect(releaseHealth).not.toContainText('/private/');

  const translations = page.getByTestId('games-translation-readiness-card');
  await expect(translations).toBeVisible();
  await expect(translations.getByText('Sprach-Readiness')).toBeVisible();
  await expect(translations.getByText('Technisch vollständig')).toBeVisible();
  await expect(translations.getByText('Noch nicht launchbereit')).toBeVisible();
  await expect(translations.getByText('51', { exact: true }).first()).toBeVisible();
  await expect(translations.getByText('0/50', { exact: true })).toBeVisible();
  await expect(translations.getByText('50', { exact: true }).first()).toBeVisible();

  await translations.getByText('Offene Sprachen (50)', { exact: true }).click();
  const germanReview = translations.getByTestId('translation-review-de');
  await expect(germanReview).toBeVisible();
  await germanReview.getByRole('button', { name: 'Als geprüft markieren' }).click();
  await expect(translations.getByText('1/50', { exact: true })).toBeVisible();
  await translations.getByText('Geprüfte Sprachen (1)', { exact: true }).click();
  const reviewedGerman = translations.getByTestId('translation-review-de');
  await reviewedGerman.getByRole('button', { name: 'Freigabe zurücknehmen' }).click();
  await expect(translations.getByText('0/50', { exact: true })).toBeVisible();

  const finance = page.getByTestId('games-finance-sandbox-admin');
  await expect(finance).toBeVisible();
  await expect(finance.getByText('Finanz-Sandbox')).toBeVisible();
  await expect(finance.getByText('Sandbox gesperrt')).toBeVisible();
  await expect(finance.getByText(/keine Wallet-Abbuchung/i)).toBeVisible();

  const preflight = page.getByTestId('games-preflight-card');
  await expect(preflight).toBeVisible();
  await expect(preflight.getByText('play.games.example.test')).toBeVisible();

  const moderation = page.getByTestId('admin-games-reviews');
  await expect(moderation).toBeVisible();
  await expect(moderation.getByText('Spielerbewertungen moderieren')).toBeVisible();
  await expect(moderation.getByText('Needs moderator attention.')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Games review panel exposes public ratings without requiring login', async ({ page }) => {
  await openGames(page, 390, 844);

  await page.getByRole('button', { name: 'Bewertungen' }).first().click();
  const panel = page.getByTestId('game-reviews-match');
  await expect(panel).toBeVisible();
  await expect(panel.getByText('4.5', { exact: false })).toBeVisible();
  await expect(panel.getByText('Great puzzle game.')).toBeVisible();
  await expect(panel.getByText('Melde dich an, um selbst zu bewerten.')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Games Match detail page exposes rating, languages and safe preview navigation', async ({ page }) => {
  await openGames(page, 390, 844);

  await page.getByRole('button', { name: 'Details' }).first().click();
  await expect(page).toHaveURL(/\/games\/title\/match$/);
  const detail = page.getByTestId('game-detail-page');
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'BidBlitz Match' })).toBeVisible();
  await expect(detail.getByText('BIDBLITZ ORIGINAL')).toBeVisible();
  await expect(detail.getByText('4.5', { exact: false }).first()).toBeVisible();
  await expect(detail.getByText('Deutsch', { exact: true }).last()).toBeVisible();
  await expect(detail.getByText('v1', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await detail.getByRole('button', { name: 'Spielvorschau öffnen' }).click();
  await expect(page).toHaveURL(/\/games\/match$/);
});

test('Published community game detail deep link keeps external play isolated', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGamesApis(page);
  await page.addInitScript(() => {
    localStorage.setItem('bidblitz_lang', 'de');
    localStorage.setItem('bidblitz_onboarded', '1');
    localStorage.setItem('bb_hint_dismissed', '1');
  });

  await page.goto('/games/title/community-puzzle', { waitUntil: 'networkidle' });

  const detail = page.getByTestId('game-detail-page');
  await expect(detail).toBeVisible({ timeout: 20000 });
  await expect(detail.getByRole('heading', { name: 'Community Puzzle' })).toBeVisible();
  await expect(detail.getByText('COMMUNITY-SPIEL', { exact: true }).first()).toBeVisible();
  await expect(detail.getByText('Deutsch', { exact: true }).last()).toBeVisible();
  await expect(detail.getByText('English', { exact: true }).last()).toBeVisible();
  await expect(detail.getByText('v2', { exact: true })).toBeVisible();
  const play = detail.getByRole('link', { name: 'Spiel sicher öffnen' });
  await expect(play).toHaveAttribute('href', 'https://play.games.example.test/game/community-puzzle/index.html');
  await expect(play).toHaveAttribute('target', '_blank');
  await expect(play).toHaveAttribute('rel', /noopener/);
  await expect(detail.getByText(/cookie-freien Games-Origin/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('BidBlitz Farm detail page opens its first-party farm preview', async ({ page }) => {
  await openGames(page, 390, 844);

  const farmCard = page.locator('article').filter({ hasText: 'BidBlitz Farm' }).first();
  await expect(farmCard).toBeVisible();
  await farmCard.getByRole('button', { name: 'Details' }).click();

  await expect(page).toHaveURL(/\/games\/title\/farm$/);
  const detail = page.getByTestId('game-detail-page');
  await expect(detail.getByRole('heading', { name: 'BidBlitz Farm' })).toBeVisible();
  await expect(detail.getByText('Strategie', { exact: true }).first()).toBeVisible();
  await detail.getByRole('button', { name: 'Spielvorschau öffnen' }).click();

  await expect(page).toHaveURL(/\/games\/farm$/);
  await expect(page.getByTestId('bidblitz-farm-page')).toBeVisible();
  const frame = page.locator('iframe[title*="BidBlitz Farm"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute('src', '/game-assets/bidblitz-farm/farm.html');
  const game = page.frameLocator('iframe[title*="BidBlitz Farm"]');
  await expect(game.getByTestId('bidblitz-farm-game')).toBeVisible();
  await expect(game.getByRole('heading', { name: 'BidBlitz Farm' })).toBeVisible();
  await expect(game.getByText('7-Tage-Vorschau')).toBeVisible();
  await expect(game.getByRole('heading', { name: 'Tiere' })).toBeVisible();
  await expect(game.getByRole('heading', { name: 'Gebäude & Ausbau' })).toBeVisible();
  await expect(game.getByRole('heading', { name: 'Missionen' })).toBeVisible();

  const handle = await frame.elementHandle();
  const farmFrame = await handle?.contentFrame();
  expect(farmFrame).not.toBeNull();
  const actions = await farmFrame!.evaluate(() => {
    const api = (window as any).BidBlitzFarmPreview;
    const bought = api.buyAnimal('chicken');
    const fed = api.feedAnimals('chicken');
    api.nextDay();
    const collected = api.collectAnimalProduct('chicken');
    const snapshot = api.snapshot();
    return { bought, fed, collected, snapshot };
  });
  expect(actions.bought).toBe(true);
  expect(actions.fed).toBe(true);
  expect(actions.collected).toBe(true);
  expect(actions.snapshot.animals.chicken.count).toBe(1);
  expect(actions.snapshot.animals.chicken.ready).toBe(0);
  await expectNoHorizontalOverflow(page);
});

test('Bubble Islands detail page is first-party and opens its own preview', async ({ page }) => {
  await openGames(page, 390, 844);

  const bubbleCard = page.locator('article').filter({ hasText: 'Bubble Islands' }).first();
  await expect(bubbleCard).toBeVisible();
  await expect(bubbleCard.getByTestId('game-rating-bubble')).toContainText('5.0');
  await bubbleCard.getByRole('button', { name: 'Details' }).click();

  await expect(page).toHaveURL(/\/games\/title\/bubble$/);
  const detail = page.getByTestId('game-detail-page');
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Bubble Islands' })).toBeVisible();
  await expect(detail.getByText('BIDBLITZ ORIGINAL')).toBeVisible();
  await expect(detail.getByText(/20 schwebende Insel-Level/)).toBeVisible();

  await detail.getByRole('button', { name: 'Spielvorschau öffnen' }).click();
  await expect(page).toHaveURL(/\/games\/bubble$/);
  await expect(page.getByTestId('bubble-islands-page')).toBeVisible();

  const frame = page.locator('iframe[title*="Bubble Islands"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute('src', '/game-assets/bubble-islands/bubble.html');
  const game = page.frameLocator('iframe[title*="Bubble Islands"]');
  await expect(game.getByTestId('bubble-islands-game')).toBeVisible();
  await expect(game.getByRole('heading', { name: 'Bubble Islands' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Blitz Runner detail page opens its first-party preview', async ({ page }) => {
  await openGames(page, 390, 844);

  const runnerCard = page.locator('article').filter({ hasText: 'Blitz Runner' }).first();
  await expect(runnerCard).toBeVisible();
  await expect(runnerCard.getByTestId('game-rating-runner')).toContainText('4.5');
  await runnerCard.getByRole('button', { name: 'Details' }).click();

  await expect(page).toHaveURL(/\/games\/title\/runner$/);
  const detail = page.getByTestId('game-detail-page');
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Blitz Runner' })).toBeVisible();
  await expect(detail.getByText('BIDBLITZ ORIGINAL')).toBeVisible();
  await expect(detail.getByText(/15 Neon-Strecken/)).toBeVisible();

  await detail.getByRole('button', { name: 'Spielvorschau öffnen' }).click();
  await expect(page).toHaveURL(/\/games\/runner$/);
  await expect(page.getByTestId('blitz-runner-page')).toBeVisible();

  const frame = page.locator('iframe[title*="Blitz Runner"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute('src', '/game-assets/blitz-runner/runner.html');
  const game = page.frameLocator('iframe[title*="Blitz Runner"]');
  await expect(game.getByTestId('blitz-runner-game')).toBeVisible();
  await expect(game.getByRole('heading', { name: 'Blitz Runner' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Blitz Runner sends a server-issued replay session and verifies the exact action trace', async ({ page }) => {
  const vector = RUNNER_INTEGRITY_VECTORS[0];
  const sessionId = 'a'.repeat(32);

  await page.route('**/api/games/integrity/runner/sessions', async (route) => {
    const body = route.request().postDataJSON() as { level?: number };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        session_id: sessionId,
        game_id: 'runner',
        level: body.level,
        seed: vector.seed,
        expires_at: '2026-10-05T09:30:00+00:00',
        score_verification: 'server_replay_required',
      }),
    });
  });
  await page.route('**/api/games/integrity/runner/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'won',
        level: vector.level,
        score: vector.score,
        shards: vector.shards,
        stars: vector.stars,
        verified: true,
        integrity: 'server_replayed_not_full_anti_cheat',
        public_trusted_leaderboard_enabled: false,
      }),
    });
  });

  await openGames(page, 390, 844);
  const runnerCard = page.locator('article').filter({ hasText: 'Blitz Runner' }).first();
  await runnerCard.getByRole('button', { name: 'Details' }).click();
  const detail = page.getByTestId('game-detail-page');
  await detail.getByRole('button', { name: 'Spielvorschau öffnen' }).click();
  await expect(page).toHaveURL(/\/games\/runner$/);

  const iframe = page.locator('iframe[title*="Blitz Runner"]');
  await expect(iframe).toBeVisible();
  const handle = await iframe.elementHandle();
  const runnerFrame = await handle?.contentFrame();
  expect(runnerFrame).not.toBeNull();

  await runnerFrame!.evaluate(async () => {
    await (window as any).BidBlitzRunnerPreview.startLevel(1);
  });

  const verifyRequest = page.waitForRequest((request) =>
    request.method() === 'POST' &&
    request.url().includes('/api/games/integrity/runner/verify')
  );
  await runnerFrame!.evaluate((actions) => {
    for (const direction of actions) {
      (window as any).BidBlitzRunnerPreview.move(direction);
    }
  }, vector.actions);
  const request = await verifyRequest;
  expect(request.postDataJSON()).toEqual({
    session_id: sessionId,
    actions: vector.actions,
  });
  await expect(runnerFrame!.locator('#status')).toContainText('serverseitig reproduziert');
});

test('Games Match preview opens from catalog and remains usable on 320px', async ({ page }) => {
  await openGames(page, 320, 568);

  const launchRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/games/analytics/match/launch')
  );
  await page.getByRole('button', { name: 'Spielvorschau öffnen' }).first().click();
  await launchRequest;
  await expect(page).toHaveURL(/\/games\/match$/);
  await expect(page.locator('#match-preview-title')).toHaveText('BidBlitz Match');
  const frame = page.locator('iframe[title*="BidBlitz Match"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute('src', '/game-assets/match-preview/match.html');
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(321);
  await expectNoHorizontalOverflow(page);

  await page.goBack({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('games-platform-page')).toBeVisible();
  const recent = page.getByTestId('games-recent');
  await expect(recent).toBeVisible();
  await expect(recent.getByText('Weiterspielen')).toBeVisible();
  await expect(recent.getByText('BidBlitz Match')).toBeVisible();
  await expect(recent.getByRole('button', { name: 'Weiter' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
