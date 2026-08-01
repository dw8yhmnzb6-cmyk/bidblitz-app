const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');

const OUTPUT_DIR = path.join(__dirname, '../../qa-output');
const SHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const AUTH_DIR = path.join(__dirname, '.auth');
const MIN_FONT_PX = 12;
const PRIMARY_ACTION_SELECTORS = [
  'button',
  'a',
  '[role="button"]',
  '[data-testid*="button"]',
  '[data-testid*="submit"]',
].join(',');

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
];

const ROUTES = [
  { route: '/', path: '/', role: 'guest', expectBottomNav: false },
  { route: '/login', path: '/login', role: 'guest', expectBottomNav: false },
  { route: '/register', path: '/register', role: 'guest', expectBottomNav: false },
  { route: '/wallet', path: '/wallet', role: 'user', expectBottomNav: true },
  { route: '/send', path: '/send-money', role: 'user', expectBottomNav: true },
  { route: '/receive', path: '/receive-money', role: 'user', expectBottomNav: true },
  { route: '/merchant', path: '/merchant', role: 'merchant', expectBottomNav: true },
  { route: '/auctions', path: '/auctions', role: 'guest', expectBottomNav: true },
  { route: '/auction/:id', path: '/auction/:id', role: 'guest', dynamic: 'auction', expectBottomNav: false },
  { route: '/taxi', path: '/taxi', role: 'guest', expectBottomNav: false },
  { route: '/design-system', path: '/design-system', role: 'guest', expectBottomNav: false },
  { route: '/scooter', path: '/scooter', role: 'guest', expectBottomNav: true },
  { route: '/investieren', path: '/investieren', role: 'guest', expectBottomNav: false },
  { route: '/investor-login', path: '/investor-login', role: 'guest', expectBottomNav: false },
  { route: '/investor-portal', path: '/investor-portal', role: 'investor', expectBottomNav: false },
  { route: '/admin', path: '/admin', role: 'admin', expectBottomNav: false },
  { route: '/investor-dashboard', path: '/investor-dashboard', role: 'investor', expectBottomNav: false },
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
  if (routeDef.dynamic !== 'auction') return routeDef.path || routeDef.route;
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

async function auditPage(page, context) {
  return page.evaluate(({ minFontPx, patterns, viewportName, expectBottomNav, primaryActionSelectors }) => {
    const toRgb = (value) => {
      const match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };

    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const contrastRatio = (foreground, background) => {
      const fg = toRgb(foreground);
      const bg = toRgb(background);
      if (!fg || !bg) return null;
      const lighter = Math.max(luminance(fg), luminance(bg));
      const darker = Math.min(luminance(fg), luminance(bg));
      return (lighter + 0.05) / (darker + 0.05);
    };

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

    const topOrBottomOutside = visibleElements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top < -4 || rect.bottom > viewportHeight + 4;
    }).slice(0, 10);
    topOrBottomOutside.forEach((el) => {
      issues.push({ severity: 'medium', category: 'clipping', rule: 'content-outside-safe-area', problem: `Element may exceed the safe viewport area: ${el.tagName.toLowerCase()}`, confidence: 0.74, safe_to_auto_fix: true });
    });

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

    const textEls = visibleElements.filter((el) => (el.innerText || '').trim().length > 0).slice(0, 240);
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

    if (expectBottomNav && bottomNavs.length === 0) {
      issues.push({ severity: 'high', category: 'navigation', rule: 'missing-bottom-navigation', problem: 'Expected bottom navigation was not visible on this route.', confidence: 0.88, safe_to_auto_fix: false });
    }

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

    const contrastCandidates = Array.from(document.querySelectorAll(primaryActionSelectors)).filter((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return rect.width > 40 && rect.height > 24 && style.visibility !== 'hidden' && style.display !== 'none';
    }).slice(0, 20);
    contrastCandidates.forEach((el) => {
      const style = window.getComputedStyle(el);
      const ratio = contrastRatio(style.color, style.backgroundColor);
      if (ratio !== null && ratio < 4.5) {
        issues.push({ severity: 'high', category: 'accessibility', rule: 'low-contrast-primary-action', problem: `Primary action has insufficient contrast (${ratio.toFixed(2)}:1).`, confidence: 0.9, safe_to_auto_fix: true });
      }
    });

    const backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    const rootColor = window.getComputedStyle(document.documentElement).backgroundColor;
    const tokenSnapshot = {
      bgApp: window.getComputedStyle(document.documentElement).getPropertyValue('--bb-bg-app').trim(),
      bgCard: window.getComputedStyle(document.documentElement).getPropertyValue('--bb-bg-card').trim(),
      accentCyan: window.getComputedStyle(document.documentElement).getPropertyValue('--bb-accent-cyan').trim(),
      radiusCard: window.getComputedStyle(document.documentElement).getPropertyValue('--bb-radius-card').trim(),
      buttonHeight: window.getComputedStyle(document.documentElement).getPropertyValue('--bb-button-height').trim(),
      buttonHeightPrimary: window.getComputedStyle(document.documentElement).getPropertyValue('--bb-button-height-primary').trim(),
      bottomNavHeight: window.getComputedStyle(document.documentElement).getPropertyValue('--bb-bottom-nav-height').trim(),
      bottomNavClearance: window.getComputedStyle(document.documentElement).getPropertyValue('--bb-bottom-nav-clearance').trim(),
    };
    const galleriesWithMissingMeta = Array.from(document.querySelectorAll('[data-testid*="gallery"]')).filter((el) => {
      const category = el.getAttribute('data-product-category');
      const imageCategory = el.getAttribute('data-image-category');
      return (!category || !imageCategory) && el.querySelector('img');
    });
    if (galleriesWithMissingMeta.length > 0) {
      issues.push({ severity: 'medium', category: 'wrong_image', rule: 'missing-image-metadata', problem: 'Product gallery is missing required category metadata.', confidence: 0.91, safe_to_auto_fix: true });
    }
    const buttonHeights = buttonEls.slice(0, 40).map((el) => Math.round(el.getBoundingClientRect().height)).filter(Boolean);
    const buttonMinHeight = buttonHeights.length ? Math.min(...buttonHeights) : 0;
    const numericCandidates = [...new Set((bodyText.match(/-?\d[\d.,%\s]*(?:€|EUR|Min\.|Std\.|Sek\.|h|m|s)?/g) || []).map((item) => item.trim()).filter(Boolean))].slice(0, 250);

    return {
      viewport: viewportName,
      language: document.documentElement.lang || 'de',
      bodyTextLength: bodyText.length,
      text_sample: bodyText.replace(/\s+/g, ' ').trim().slice(0, 6000),
      numeric_candidates: numericCandidates,
      issues,
      design_summary: {
        backgroundColor,
        rootColor,
        tokenSnapshot,
        buttonMinHeight,
        headerCount,
        bottomNavCount: bottomNavs.length,
        viewportWidth,
        viewportHeight,
        galleryMetadataMissingCount: galleriesWithMissingMeta.length,
      },
      data_summary: {
        imageCount: document.images.length,
        brokenImageCount: brokenImages.length,
        emptySectionCount: emptySections.length,
        smallTextCount,
      },
    };
  }, {
    minFontPx: MIN_FONT_PX,
    patterns: GERMAN_ENGLISH_PATTERNS,
    viewportName: context.viewportName,
    expectBottomNav: context.expectBottomNav,
    primaryActionSelectors: PRIMARY_ACTION_SELECTORS,
  });
}

test.describe('BidBlitz Visual QA', () => {
  test.afterAll(async () => {
    ensureDirs();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'raw-route-audit.json'), JSON.stringify({
      generated_at: new Date().toISOString(),
      routes: ROUTES.map((entry) => entry.route),
      viewports: VIEWPORTS.map((entry) => entry.name),
      results,
    }, null, 2));
  });

  for (const viewport of VIEWPORTS) {
    for (const routeDef of ROUTES) {
      test(`${viewport.name} ${routeDef.route}`, async ({ browser, request, baseURL }) => {
        ensureDirs();
        const resolvedRoute = await resolveRoute(baseURL, routeDef, request);
        const storagePath = authFile(routeDef.role);
        const storageState = fs.existsSync(storagePath) ? storagePath : undefined;
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, storageState });
        const page = await context.newPage();
        await applyLanguage(page, 'de');
        await page.goto(`${baseURL}${resolvedRoute}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1600);
        await page.waitForLoadState('networkidle').catch(() => {});

        if (!storageState && routeDef.role !== 'guest') {
          results.push({
            route: routeDef.route,
            resolved_path: resolvedRoute,
            viewport: viewport.name,
            role: routeDef.role,
            screenshot: '',
            issues: [{ severity: 'critical', category: 'navigation', rule: 'missing-test-credentials', problem: `Missing QA credentials for role '${routeDef.role}'.`, confidence: 1, safe_to_auto_fix: false }],
            design_summary: {},
            data_summary: {},
          });
          await context.close();
          return;
        }

        await maskSensitive(page);
        const audit = await auditPage(page, { viewportName: viewport.name, expectBottomNav: routeDef.expectBottomNav });

        const shotName = `${viewport.name}-${routeDef.route.replace(/[^a-zA-Z0-9_-]/g, '_') || 'home'}.png`;
        const shotPath = path.join(SHOTS_DIR, shotName);
        await page.screenshot({ path: shotPath, fullPage: true });

        results.push({
          route: routeDef.route,
          resolved_path: resolvedRoute,
          viewport: viewport.name,
          role: routeDef.role,
          screenshot: path.relative(path.join(__dirname, '../../'), shotPath).replace(/\\/g, '/'),
          issues: audit.issues,
          design_summary: audit.design_summary,
          data_summary: audit.data_summary,
          text_sample: audit.text_sample,
          numeric_candidates: audit.numeric_candidates,
        });

        await context.close();
      });
    }
  }
});