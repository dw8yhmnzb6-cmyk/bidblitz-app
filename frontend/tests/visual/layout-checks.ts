import fs from 'fs';
import path from 'path';
import { expect, type Locator, type Page } from 'playwright/test';
import { FLOATING_AI_SELECTORS, FORBIDDEN_VISIBLE_TOKENS, GERMAN_CURRENCY_PATTERN, GERMAN_ETA_PATTERN } from './test-data';

type ViewportSpec = { name: string; width: number; height: number };
type OverlapPair = { element1: string; element2: string; severity: 'critical' | 'high' | 'medium' | 'low'; rule: string };
type RouteConfig = {
  route?: string;
  routeKey: string;
  waitFor: string;
  fullPageTestId: string;
  primaryActionSelector: string;
  priceSelectors: string[];
  timerSelectors: string[];
  imageSelectors: string[];
  componentSelectors: string[];
  overlapPairs: OverlapPair[];
  expectBottomNav: boolean;
};

const OUTPUT_DIR = path.resolve(process.cwd(), 'frontend/qa-output');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
const RAW_AUDIT_PATH = path.join(OUTPUT_DIR, 'raw-route-audit.json');

function ensureQaOutput() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  if (!fs.existsSync(RAW_AUDIT_PATH)) {
    fs.writeFileSync(RAW_AUDIT_PATH, JSON.stringify({ generated_at: new Date().toISOString(), results: [], routes: [], viewports: [] }, null, 2));
  }
}

function slugify(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function screenshotPath(routeKey: string, viewportName: string, suffix: string) {
  ensureQaOutput();
  const relative = path.join('frontend/qa-output/screenshots', `${slugify(routeKey)}-${viewportName}-${suffix}.png`);
  return { absolute: path.resolve(process.cwd(), relative), relative };
}

function issueId(routeKey: string, viewportName: string, rule: string, index: number) {
  return `${slugify(routeKey)}-${viewportName}-${rule}-${index}`;
}

async function firstVisibleLocator(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      try {
        if (await locator.isVisible()) return locator;
      } catch {
        // ignore hidden locator
      }
    }
  }
  return null;
}

async function boxFor(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  if (!await locator.count()) return null;
  try {
    if (!await locator.isVisible()) return null;
    return await locator.boundingBox();
  } catch {
    return null;
  }
}

function overlapArea(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return Math.round(xOverlap * yOverlap);
}

export async function prepareVisualPage(page: Page, viewport: ViewportSpec) {
  ensureQaOutput();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.addInitScript(() => {
    document.documentElement.classList.add('test-mode-active');
    document.body?.classList.add('test-mode-active');
  });
}

export async function openRoute(page: Page, route: string, waitForSelector: string) {
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.documentElement.classList.add('test-mode-active');
    document.body.classList.add('test-mode-active');
  });
  await page.addStyleTag({ content: `
    *, *::before, *::after { animation: none !important; transition: none !important; }
    html, body { scroll-behavior: auto !important; }
    ${FLOATING_AI_SELECTORS.join(', ')} { display: none !important; visibility: hidden !important; pointer-events: none !important; }
  ` });
  await page.waitForSelector(waitForSelector, { timeout: 20000 });
  await page.waitForTimeout(400);
}

async function captureComponents(page: Page, routeKey: string, viewportName: string, selectors: string[]) {
  const outputs: string[] = [];
  for (const [index, selector] of selectors.entries()) {
    const locator = page.locator(selector).first();
    if (!await locator.count()) continue;
    try {
      if (!await locator.isVisible()) continue;
      const file = screenshotPath(routeKey, viewportName, `component-${index}`);
      await locator.screenshot({ path: file.absolute, animations: 'disabled' });
      outputs.push(file.relative);
    } catch {
      // ignore per-component screenshot failures
    }
  }
  return outputs;
}

async function buildIssueScreenshot(page: Page, routeKey: string, viewportName: string, rule: string) {
  const file = screenshotPath(routeKey, viewportName, `issue-${rule}`);
  await page.screenshot({ path: file.absolute, fullPage: true, animations: 'disabled' });
  return file.relative;
}

async function maybeCaptureAfterPreview(page: Page, config: RouteConfig, viewport: ViewportSpec, issues: any[]) {
  const safeIssues = issues.filter((issue) => issue.safe_to_auto_fix);
  if (!safeIssues.length) return null;
  const css: string[] = [];
  if (config.routeKey.includes('auction')) {
    css.push(`
      @media (max-width: 389px) {
        [data-testid^="auction-card-"] .grid { grid-template-columns: 1fr !important; }
        [data-testid="auction-detail-current-price"], [data-testid="auction-countdown"] { display: block !important; }
      }
      [data-testid="auction-bid-history"] { margin-bottom: 120px !important; }
    `);
  }
  if (config.routeKey.includes('taxi')) {
    css.push(`
      [data-testid="vehicle-selector-list"], [data-testid="quick-destinations-scroll"] { overflow-x: auto !important; }
      [data-testid="book-ride-button"] { position: relative !important; bottom: auto !important; }
      [data-testid="pricing-overview-card"] { width: 100% !important; }
    `);
  }
  if (!css.length) return null;
  await page.addStyleTag({ content: css.join('\n') });
  await page.waitForTimeout(200);
  const after = screenshotPath(config.routeKey, viewport.name, 'after-preview');
  await page.screenshot({ path: after.absolute, fullPage: true, animations: 'disabled' });
  return after.relative;
}

function appendAuditEntry(entry: any) {
  ensureQaOutput();
  const raw = JSON.parse(fs.readFileSync(RAW_AUDIT_PATH, 'utf8'));
  raw.results = Array.isArray(raw.results) ? raw.results.filter((item: any) => !(item.route_key === entry.route_key && item.viewport === entry.viewport)) : [];
  raw.results.push(entry);
  raw.routes = Array.from(new Set([...(raw.routes || []), entry.route]));
  raw.viewports = Array.from(new Set([...(raw.viewports || []), entry.viewport]));
  fs.writeFileSync(RAW_AUDIT_PATH, JSON.stringify(raw, null, 2));
}

export async function runRouteAudit(page: Page, config: RouteConfig, viewport: ViewportSpec, routeOverride?: string) {
  const route = routeOverride || config.route || '/';
  await prepareVisualPage(page, viewport);
  await openRoute(page, route, config.waitFor);
  const full = screenshotPath(config.routeKey, viewport.name, 'before');
  await page.screenshot({ path: full.absolute, fullPage: true, animations: 'disabled' });
  const componentScreenshots = await captureComponents(page, config.routeKey, viewport.name, config.componentSelectors);

  const issues: any[] = [];
  const routePath = new URL(page.url()).pathname;
  const bodyText = await page.locator('body').innerText();
  const textSample = bodyText.slice(0, 3500);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const images = Array.from(document.querySelectorAll('img')).map((img) => {
      const root = img.closest('[data-product-category]') || img.parentElement;
      return {
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || '',
        naturalWidth: (img as HTMLImageElement).naturalWidth,
        naturalHeight: (img as HTMLImageElement).naturalHeight,
        productId: root?.getAttribute('data-product-id') || '',
        productTitle: root?.getAttribute('data-product-title') || '',
        productCategory: root?.getAttribute('data-product-category') || '',
        imageCategory: root?.getAttribute('data-image-category') || '',
        imageUrl: root?.getAttribute('data-image-url') || img.getAttribute('src') || '',
        verified: root?.getAttribute('data-image-verified') || '',
        confidence: root?.getAttribute('data-image-confidence') || '',
        manualReview: root?.getAttribute('data-image-manual-review') || '',
      };
    });
    return {
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
      text: body.innerText || '',
      images,
      bottomNavVisible: !!document.querySelector('[data-testid="bottom-nav"]'),
    };
  });

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    issues.push({
      issue_id: issueId(config.routeKey, viewport.name, 'horizontal-overflow', issues.length),
      severity: 'high',
      category: 'layout',
      route: routePath,
      viewport: viewport.name,
      status: 'New',
      rule: 'horizontal-overflow',
      problem: `Horizontal overflow detected (${metrics.scrollWidth}px > ${metrics.clientWidth}px).`,
      affected_component: config.fullPageTestId,
      confidence: 0.99,
      safe_to_auto_fix: true,
      before_screenshot: full.relative,
    });
  }

  const forbiddenMatch = FORBIDDEN_VISIBLE_TOKENS.find((token) => bodyText.includes(token));
  if (forbiddenMatch) {
    issues.push({
      issue_id: issueId(config.routeKey, viewport.name, 'translation-visible', issues.length),
      severity: forbiddenMatch === 'undefined' || forbiddenMatch === 'null' || forbiddenMatch === 'NaN' ? 'critical' : 'high',
      category: forbiddenMatch === 'undefined' || forbiddenMatch === 'null' || forbiddenMatch === 'NaN' ? 'broken_content' : 'translation',
      route: routePath,
      viewport: viewport.name,
      status: 'New',
      rule: forbiddenMatch === 'undefined' || forbiddenMatch === 'null' || forbiddenMatch === 'NaN' ? 'nan-undefined-null' : 'mixed-language-german',
      problem: `Visible forbidden token detected: ${forbiddenMatch}`,
      affected_component: config.fullPageTestId,
      confidence: 0.98,
      safe_to_auto_fix: forbiddenMatch !== 'undefined' && forbiddenMatch !== 'null' && forbiddenMatch !== 'NaN',
      before_screenshot: full.relative,
    });
  }

  if (/\b[a-z0-9_-]+\.[a-z0-9_.-]+\b/.test(bodyText)) {
    issues.push({
      issue_id: issueId(config.routeKey, viewport.name, 'translation-key-visible', issues.length),
      severity: 'high',
      category: 'translation',
      route: routePath,
      viewport: viewport.name,
      status: 'New',
      rule: 'translation-key-visible',
      problem: 'An untranslated translation key appears to be visible in the UI.',
      affected_component: config.fullPageTestId,
      confidence: 0.8,
      safe_to_auto_fix: true,
      before_screenshot: full.relative,
    });
  }

  for (const selector of config.priceSelectors) {
    const locator = page.locator(selector).first();
    if (!await locator.count()) continue;
    const value = (await locator.textContent())?.trim() || '';
    if (value && !GERMAN_CURRENCY_PATTERN.test(value)) {
      issues.push({
        issue_id: issueId(config.routeKey, viewport.name, 'price-format', issues.length),
        severity: 'high',
        category: 'wrong_number',
        route: routePath,
        viewport: viewport.name,
        status: 'New',
        rule: 'incorrect-price-format',
        problem: `Price format is invalid for German locale: ${value}`,
        affected_component: selector,
        confidence: 0.95,
        safe_to_auto_fix: true,
        before_screenshot: full.relative,
      });
    }
  }

  if (routePath === '/taxi') {
    const ctaText = (await page.locator('[data-testid="book-ride-button"]').textContent())?.trim() || '';
    if (ctaText.includes('€')) {
      const priceMatch = ctaText.match(/\d[^·]+€|\d[^€]+€/);
      if (priceMatch && !GERMAN_CURRENCY_PATTERN.test(priceMatch[0].trim())) {
        issues.push({
          issue_id: issueId(config.routeKey, viewport.name, 'taxi-price-format', issues.length),
          severity: 'high',
          category: 'wrong_number',
          route: routePath,
          viewport: viewport.name,
          status: 'New',
          rule: 'incorrect-price-format',
          problem: `Taxi CTA price format is invalid: ${priceMatch[0].trim()}`,
          affected_component: '[data-testid="book-ride-button"]',
          confidence: 0.94,
          safe_to_auto_fix: true,
          before_screenshot: full.relative,
        });
      }
    }
  }

  const vehicleCards = page.locator('[data-testid^="taxi-vehicle-card-"]');
  if (await vehicleCards.count()) {
    const etaText = (await vehicleCards.first().innerText()).trim();
    const etaMatch = etaText.match(/\d+\sMin\.?/);
    if (etaMatch && !GERMAN_ETA_PATTERN.test(etaMatch[0].replace(/\s+/, ' ').trim())) {
      issues.push({
        issue_id: issueId(config.routeKey, viewport.name, 'eta-format', issues.length),
        severity: 'medium',
        category: 'wrong_number',
        route: routePath,
        viewport: viewport.name,
        status: 'New',
        rule: 'incorrect-eta-format',
        problem: `Taxi ETA format is invalid: ${etaMatch[0]}`,
        affected_component: '[data-testid^="taxi-vehicle-card-"]',
        confidence: 0.88,
        safe_to_auto_fix: true,
        before_screenshot: full.relative,
      });
    }
  }

  const primaryAction = await boxFor(page, config.primaryActionSelector);
  if (!primaryAction) {
    issues.push({
      issue_id: issueId(config.routeKey, viewport.name, 'missing-primary-action', issues.length),
      severity: 'critical',
      category: 'navigation',
      route: routePath,
      viewport: viewport.name,
      status: 'New',
      rule: 'missing-primary-action',
      problem: 'Primary action is missing from the viewport.',
      affected_component: config.primaryActionSelector,
      confidence: 0.99,
      safe_to_auto_fix: false,
      before_screenshot: full.relative,
    });
  } else if (primaryAction.x < 0 || primaryAction.y < 0 || primaryAction.x + primaryAction.width > viewport.width || primaryAction.y + primaryAction.height > viewport.height) {
    issues.push({
      issue_id: issueId(config.routeKey, viewport.name, 'primary-action-outside', issues.length),
      severity: 'critical',
      category: 'layout',
      route: routePath,
      viewport: viewport.name,
      status: 'New',
      rule: 'primary-action-outside-viewport',
      problem: 'Primary action is outside the viewport bounds.',
      affected_component: config.primaryActionSelector,
      confidence: 0.97,
      safe_to_auto_fix: true,
      before_screenshot: full.relative,
    });
  }

  for (const pair of config.overlapPairs) {
    const a = await boxFor(page, pair.element1);
    const b = await boxFor(page, pair.element2);
    if (!a || !b) continue;
    const area = overlapArea(a, b);
    if (area > 0) {
      const screenshot = await buildIssueScreenshot(page, config.routeKey, viewport.name, pair.rule);
      issues.push({
        issue_id: issueId(config.routeKey, viewport.name, pair.rule, issues.length),
        severity: pair.severity,
        category: 'overlap',
        route: routePath,
        viewport: viewport.name,
        status: 'New',
        rule: pair.rule,
        problem: `${pair.element1} overlaps ${pair.element2}.`,
        element_1: pair.element1,
        element_2: pair.element2,
        overlap_area: area,
        affected_component: pair.element1,
        confidence: 0.96,
        safe_to_auto_fix: true,
        before_screenshot: screenshot,
      });
    }
  }

  const bottomNav = await boxFor(page, '[data-testid="bottom-nav"]');
  if (config.expectBottomNav && !bottomNav) {
    issues.push({
      issue_id: issueId(config.routeKey, viewport.name, 'missing-bottom-nav', issues.length),
      severity: 'medium',
      category: 'navigation',
      route: routePath,
      viewport: viewport.name,
      status: 'New',
      rule: 'missing-bottom-navigation',
      problem: 'Bottom navigation is expected on this route but not visible.',
      affected_component: '[data-testid="bottom-nav"]',
      confidence: 0.8,
      safe_to_auto_fix: false,
      before_screenshot: full.relative,
    });
  }

  for (const image of metrics.images || []) {
    if (!image.src || !image.naturalWidth || !image.naturalHeight) {
      issues.push({
        issue_id: issueId(config.routeKey, viewport.name, 'broken-image', issues.length),
        severity: 'critical',
        category: 'broken_content',
        route: routePath,
        viewport: viewport.name,
        status: 'New',
        rule: 'broken-image',
        problem: `Broken or missing image detected for ${image.alt || image.productTitle || 'image'}.`,
        affected_component: image.productTitle || image.alt || 'image',
        confidence: 0.97,
        safe_to_auto_fix: true,
        before_screenshot: full.relative,
      });
    }
    if (image.manualReview === 'true') {
      issues.push({
        issue_id: issueId(config.routeKey, viewport.name, 'manual-image-review', issues.length),
        severity: 'medium',
        category: 'wrong_image',
        route: routePath,
        viewport: viewport.name,
        status: 'Manual review',
        rule: 'uncertain-image-match',
        problem: `Image for ${image.productTitle || image.alt || 'product'} needs manual review.`,
        affected_component: image.productTitle || image.alt || 'product-image',
        confidence: Number(image.confidence || 0.7),
        safe_to_auto_fix: false,
        before_screenshot: full.relative,
      });
    }
  }

  const afterPreview = await maybeCaptureAfterPreview(page, config, viewport, issues);
  if (afterPreview) {
    issues.forEach((issue) => {
      if (issue.safe_to_auto_fix) {
        issue.after_screenshot = afterPreview;
        issue.automatic_fix = 'preview-only-safe-css';
      }
    });
  }

  const entry = {
    route: routePath,
    route_key: config.routeKey,
    resolved_path: routePath,
    viewport: viewport.name,
    screenshot: full.relative,
    component_screenshots: componentScreenshots,
    issues,
    text_sample: textSample,
    numeric_candidates: (bodyText.match(/-?\d[\d.,%\s]*(?:€|EUR|Min\.|Std\.|Sek\.)?/g) || []).slice(0, 100),
    image_references: metrics.images || [],
    checked_at: new Date().toISOString(),
  };
  appendAuditEntry(entry);
  expect(issues, `${config.routeKey} ${viewport.name} issues: ${issues.map((issue) => issue.problem).join(' | ')}`).toHaveLength(0);
}

export async function openFirstAuctionDetail(page: Page) {
  const cards = page.locator('[data-testid^="auction-card-"]');
  await expect(cards.first()).toBeVisible();
  await cards.first().click();
  await page.waitForSelector('[data-testid="auction-detail"]', { timeout: 20000 });
  await page.waitForTimeout(500);
}