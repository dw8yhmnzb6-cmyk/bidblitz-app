const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');

const OUTPUT_DIR = path.join(__dirname, '../../qa-output');
const SHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const AUTH_DIR = path.join(__dirname, '.auth');
const MIN_FONT_PX = 12;
const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
];

const ROUTES = [
  { route: '/', role: 'guest' },
  { route: '/login', role: 'guest' },
  { route: '/register', role: 'guest' },
  { route: '/wallet', role: 'user' },
  { route: '/send', role: 'user' },
  { route: '/receive', role: 'user' },
  { route: '/merchant', role: 'merchant' },
  { route: '/auctions', role: 'guest' },
  { route: '/auction/:id', role: 'guest', dynamic: 'auction' },
  { route: '/taxi', role: 'guest' },
  { route: '/scooter', role: 'guest' },
  { route: '/investieren', role: 'guest' },
  { route: '/investor-login', role: 'guest' },
  { route: '/investor-portal', role: 'investor' },
  { route: '/admin', role: 'admin' },
  { route: '/investor-dashboard', role: 'investor' },
];

const GERMAN_ENGLISH_PATTERNS = [
  'FREE WORLDWIDE SHIPPING', 'Brand New', 'Factory Sealed', 'bids', 'bidders', 'undefined', 'null', 'NaN',
];

const results = [];

function authFile(role) {
  return path.join(AUTH_DIR, `${role}.json`);
}

function ensureDirs() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

async function resolveRoute(baseURL, routeDef, request) {
  if (routeDef.dynamic !== 'auction') return routeDef.route;
  try {
    const response = await request.get(`${baseURL}/api/auctions`);
    const data = await response.json();
    const auctionId = data?.auctions?.[0]?.id || data?.auctions?.[0]?.auction_id || data?.auctions?.[0]?._id;
    return auctionId ? `/auction/${auctionId}` : '/auctions';
  } catch (error) {
    return '/auctions';
  }
}

async function applyLanguage(page, lang = 'de') {
  await page.addInitScript((language) => {
    try { localStorage.setItem('bidblitz_lang', language); } catch (error) { void error; }
  }, lang);
}

async function maskSensitive(page) {
  await page.addStyleTag({ content: `
    input[type="password"],
    [data-testid*="password"],
    [data-testid*="card-number"],
    [data-sensitive="true"] { filter: blur(10px) !important; }
  ` }).catch(() => {});
}

function overlap(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

async function auditPage(page, context) {
  return page.evaluate(({ minFontPx, patterns, viewportName }) => {
    const bodyText = document.body?.innerText || '';
    const visibleElements = Array.from(document.querySelectorAll('body *')).filter((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });

    const issues = [];
    const scrollWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (scrollWidth > viewportWidth + 1) {
      issues.push({ severity: 'critical', category: 'layout', rule: 'horizontal-overflow', problem: `Horizontal overflow detected (${scrollWidth}px > ${viewportWidth}px).`, confidence: 0.99, safe_to_auto_fix: true });
    }

    const outside = visibleElements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > viewportWidth + 2 || rect.left < -2;
    }).slice(0, 10);
    outside.forEach((el) => {
      issues.push({ severity: 'high', category: 'clipping', rule: 'content-outside-viewport', problem: `Element outside viewport: ${el.tagName.toLowerCase()}`, confidence: 0.92, safe_to_auto_fix: true });
    });

    const brokenImages = Array.from(document.images).filter((img) => !img.src || img.naturalWidth === 0 || img.naturalHeight === 0);
    brokenImages.forEach((img) => {
      issues.push({ severity: 'high', category: 'wrong_image', rule: 'broken-image', problem: `Broken or empty image source: ${img.currentSrc || img.src || 'missing'}`, confidence: 0.96, safe_to_auto_fix: true });
    });

    const emptySections = visibleElements.filter((el) => el.tagName === 'SECTION').filter((el) => {
      const text = (el.innerText || '').trim();
      const mediaCount = el.querySelectorAll('img, button, input, svg').length;
      const rect = el.getBoundingClientRect();
      return rect.height > 120 && text.length === 0 && mediaCount === 0;
    }).slice(0, 8);
    emptySections.forEach(() => {
      issues.push({ severity: 'medium', category: 'layout', rule: 'unexpected-empty-section', problem: 'Unexpected empty section detected.', confidence: 0.84, safe_to_auto_fix: false });
    });

    if (/\b(NaN|undefined|null)\b/.test(bodyText)) {
      issues.push({ severity: 'critical', category: 'data_inconsistency', rule: 'nan-undefined-null', problem: 'Visible NaN/undefined/null text detected on page.', confidence: 0.99, safe_to_auto_fix: false });
    }

    const untranslated = (bodyText.match(/\b[a-z]{2,}\.[a-z0-9_.-]+\b/gi) || []).slice(0, 10);
    untranslated.forEach((match) => {
      issues.push({ severity: 'high', category: 'translation', rule: 'untranslated-key', problem: `Untranslated key visible: ${match}`, confidence: 0.9, safe_to_auto_fix: true });
    });

    patterns.forEach((pattern) => {
      if (bodyText.includes(pattern)) {
        issues.push({ severity: 'high', category: 'translation', rule: 'mixed-language-german', problem: `German page contains English phrase: ${pattern}`, confidence: 0.86, safe_to_auto_fix: true });
      }
    });

    const textEls = visibleElements.filter((el) => (el.innerText || '').trim().length > 0).slice(0, 220);
    const smallTextCount = textEls.filter((el) => parseFloat(window.getComputedStyle(el).fontSize) < minFontPx).length;
    if (smallTextCount > 0) {
      issues.push({ severity: 'medium', category: 'accessibility', rule: 'text-too-small', problem: `${smallTextCount} visible text elements are below the minimum font size.`, confidence: 0.9, safe_to_auto_fix: true });
    }

    const buttonEls = visibleElements.filter((el) => ['BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') === 'button');
    const clippedButtons = buttonEls.filter((el) => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2).slice(0, 12);
    clippedButtons.forEach((el) => {
      issues.push({ severity: 'high', category: 'clipping', rule: 'clipped-button', problem: `Button text clipped: ${(el.innerText || '').trim().slice(0, 80)}`, confidence: 0.93, safe_to_auto_fix: true });
    });

    const headerCount = visibleElements.filter((el) => el.tagName === 'HEADER').length;
    if (headerCount > 1) {
      issues.push({ severity: 'medium', category: 'navigation', rule: 'duplicate-header', problem: `Duplicate headers detected (${headerCount}).`, confidence: 0.88, safe_to_auto_fix: true });
    }

    const bottomNavs = visibleElements.filter((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (el.tagName === 'NAV' || (el.getAttribute('role') || '').toLowerCase() === 'navigation') && (style.position === 'fixed' || style.position === 'sticky') && rect.bottom >= viewportHeight - 4;
    });
    if (bottomNavs.length > 1) {
      issues.push({ severity: 'medium', category: 'navigation', rule: 'duplicate-bottom-nav', problem: `Duplicate bottom navigation detected (${bottomNavs.length}).`, confidence: 0.9, safe_to_auto_fix: true });
    }

    if (bottomNavs.length === 1) {
      const navRect = bottomNavs[0].getBoundingClientRect();
      const obstructed = visibleElements.find((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.height < 28 || rect.bottom < navRect.top || rect.top > navRect.bottom) return false;
        const style = window.getComputedStyle(el);
        return ['BUTTON', 'A'].includes(el.tagName) && style.position !== 'fixed' && style.visibility !== 'hidden';
      });
      if (obstructed) {
        issues.push({ severity: 'high', category: 'navigation', rule: 'bottom-nav-obstruction', problem: 'Bottom navigation may obstruct a primary action.', confidence: 0.84, safe_to_auto_fix: true });
      }
    }

    const overlapCandidates = textEls.slice(0, 80).map((el) => ({
      text: (el.innerText || '').trim().slice(0, 80),
      rect: el.getBoundingClientRect(),
      tag: el.tagName,
    }));
    for (let i = 0; i < overlapCandidates.length; i += 1) {
      for (let j = i + 1; j < overlapCandidates.length; j += 1) {
        const a = overlapCandidates[i];
        const b = overlapCandidates[j];
        const overlapArea = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left)) * Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));
        if (overlapArea > 120 && a.text && b.text && a.text !== b.text) {
          issues.push({ severity: 'high', category: 'overlap', rule: 'text-overlap', problem: `Potential overlapping text detected between '${a.text}' and '${b.text}'.`, confidence: 0.72, safe_to_auto_fix: true });
          i = overlapCandidates.length;
          break;
        }
      }
    }

    const backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    const rootColor = window.getComputedStyle(document.documentElement).backgroundColor;
    const buttonHeights = buttonEls.slice(0, 40).map((el) => Math.round(el.getBoundingClientRect().height)).filter(Boolean);
    const buttonMinHeight = buttonHeights.length ? Math.min(...buttonHeights) : 0;

    return {
      viewport: viewportName,
      bodyTextLength: bodyText.length,
      issues,
      design_summary: {
        backgroundColor,
        rootColor,
        buttonMinHeight,
        headerCount,
        bottomNavCount: bottomNavs.length,
        viewportWidth,
        viewportHeight,
      },
      data_summary: {
        imageCount: document.images.length,
        brokenImageCount: brokenImages.length,
        emptySectionCount: emptySections.length,
        smallTextCount,
      },
    };
  }, { minFontPx: MIN_FONT_PX, patterns: GERMAN_ENGLISH_PATTERNS, viewportName: context.viewportName });
}

test.describe('BidBlitz Visual QA', () => {
  test.afterAll(async () => {
    ensureDirs();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'raw-route-audit.json'), JSON.stringify({
      generated_at: new Date().toISOString(),
      routes: ROUTES.map((r) => r.route),
      viewports: VIEWPORTS.map((v) => v.name),
      results,
    }, null, 2));
  });

  for (const viewport of VIEWPORTS) {
    for (const routeDef of ROUTES) {
      test(`${viewport.name} ${routeDef.route}`, async ({ browser, request, baseURL }) => {
        ensureDirs();
        const resolvedRoute = await resolveRoute(baseURL, routeDef, request);
        const storageState = fs.existsSync(authFile(routeDef.role)) ? authFile(routeDef.role) : undefined;
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, storageState });
        const page = await context.newPage();
        await applyLanguage(page, 'de');
        await page.goto(`${baseURL}${resolvedRoute}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1600);
        await page.waitForLoadState('networkidle').catch(() => {});
        await maskSensitive(page);
        const audit = await auditPage(page, { viewportName: viewport.name });

        const shotName = `${viewport.name}-${resolvedRoute.replace(/[^a-zA-Z0-9_-]/g, '_') || 'home'}.png`;
        const shotPath = path.join(SHOTS_DIR, shotName);
        await page.screenshot({ path: shotPath, fullPage: true });

        results.push({
          route: resolvedRoute,
          viewport: viewport.name,
          role: routeDef.role,
          screenshot: shotPath.replace(path.join(__dirname, '../../'), 'frontend/'),
          issues: audit.issues,
          design_summary: audit.design_summary,
          data_summary: audit.data_summary,
        });

        await context.close();
      });
    }
  }
});