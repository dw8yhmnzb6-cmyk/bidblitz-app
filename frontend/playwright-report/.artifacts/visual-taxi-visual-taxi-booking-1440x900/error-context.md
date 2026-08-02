# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual/taxi.spec.ts >> visual taxi booking 1440x900
- Location: frontend/tests/visual/taxi.spec.ts:6:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 20000ms exceeded.
Call log:
  - waiting for locator('[data-testid="taxi-simple-page"]') to be visible

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "Bad gateway Error code 502" [level=1] [ref=e5]:
      - generic [ref=e6]: Bad gateway
      - text: Error code 502
    - generic [ref=e7]:
      - text: Visit
      - link "cloudflare.com" [ref=e8] [cursor=pointer]:
        - /url: https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_502&utm_campaign=super-app-staging-2.cluster-12.preview.emergentcf.cloud
      - text: for more information.
    - generic [ref=e9]: 2026-08-02 10:34:14 UTC
  - generic [ref=e12]:
    - generic [ref=e13]:
      - text: You
      - heading "Browser" [level=3] [ref=e17]
      - text: Working
    - generic [ref=e18]:
      - link [ref=e20] [cursor=pointer]:
        - /url: https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_502&utm_campaign=super-app-staging-2.cluster-12.preview.emergentcf.cloud
      - text: Chicago
      - heading "Cloudflare" [level=3] [ref=e23]:
        - link "Cloudflare" [ref=e24] [cursor=pointer]:
          - /url: https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_502&utm_campaign=super-app-staging-2.cluster-12.preview.emergentcf.cloud
      - text: Working
    - generic [ref=e25]:
      - text: super-app-staging-2.cluster-12.preview.emergentcf.cloud
      - heading "Host" [level=3] [ref=e29]
      - text: Error
  - generic [ref=e31]:
    - generic [ref=e32]:
      - heading "What happened?" [level=2] [ref=e33]
      - paragraph [ref=e34]: The web server reported a bad gateway error.
    - generic [ref=e35]:
      - heading "What can I do?" [level=2] [ref=e36]
      - paragraph [ref=e37]: Please try again in a few minutes.
  - paragraph [ref=e39]:
    - generic [ref=e40]:
      - text: "Cloudflare Ray ID:"
      - strong [ref=e41]: a24c6dce5bcbe825
    - text: •
    - generic [ref=e42]:
      - text: "Your IP:"
      - button "Click to reveal" [ref=e43] [cursor=pointer]
      - text: •
    - generic [ref=e44]:
      - text: Performance & security by
      - link "Cloudflare" [ref=e45] [cursor=pointer]:
        - /url: https://www.cloudflare.com/5xx-error-landing?utm_source=errorcode_502&utm_campaign=super-app-staging-2.cluster-12.preview.emergentcf.cloud
```

# Test source

```ts
  1   | import fs from 'fs';
  2   | import path from 'path';
  3   | import { expect, type Locator, type Page } from 'playwright/test';
  4   | import { FLOATING_AI_SELECTORS, FORBIDDEN_VISIBLE_TOKENS, GERMAN_CURRENCY_PATTERN, GERMAN_ETA_PATTERN } from './test-data';
  5   | 
  6   | type ViewportSpec = { name: string; width: number; height: number };
  7   | type OverlapPair = { element1: string; element2: string; severity: 'critical' | 'high' | 'medium' | 'low'; rule: string };
  8   | type RouteConfig = {
  9   |   route?: string;
  10  |   routeKey: string;
  11  |   waitFor: string;
  12  |   fullPageTestId: string;
  13  |   primaryActionSelector: string;
  14  |   priceSelectors: string[];
  15  |   timerSelectors: string[];
  16  |   imageSelectors: string[];
  17  |   componentSelectors: string[];
  18  |   overlapPairs: OverlapPair[];
  19  |   expectBottomNav: boolean;
  20  | };
  21  | 
  22  | const OUTPUT_DIR = path.resolve(process.cwd(), 'frontend/qa-output');
  23  | const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
  24  | const RAW_AUDIT_PATH = path.join(OUTPUT_DIR, 'raw-route-audit.json');
  25  | 
  26  | function ensureQaOutput() {
  27  |   fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  28  |   if (!fs.existsSync(RAW_AUDIT_PATH)) {
  29  |     fs.writeFileSync(RAW_AUDIT_PATH, JSON.stringify({ generated_at: new Date().toISOString(), results: [], routes: [], viewports: [] }, null, 2));
  30  |   }
  31  | }
  32  | 
  33  | function slugify(value: string) {
  34  |   return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  35  | }
  36  | 
  37  | function screenshotPath(routeKey: string, viewportName: string, suffix: string) {
  38  |   ensureQaOutput();
  39  |   const relative = path.join('frontend/qa-output/screenshots', `${slugify(routeKey)}-${viewportName}-${suffix}.png`);
  40  |   return { absolute: path.resolve(process.cwd(), relative), relative };
  41  | }
  42  | 
  43  | function issueId(routeKey: string, viewportName: string, rule: string, index: number) {
  44  |   return `${slugify(routeKey)}-${viewportName}-${rule}-${index}`;
  45  | }
  46  | 
  47  | async function firstVisibleLocator(page: Page, selectors: string[]): Promise<Locator | null> {
  48  |   for (const selector of selectors) {
  49  |     const locator = page.locator(selector).first();
  50  |     if (await locator.count()) {
  51  |       try {
  52  |         if (await locator.isVisible()) return locator;
  53  |       } catch {
  54  |         // ignore hidden locator
  55  |       }
  56  |     }
  57  |   }
  58  |   return null;
  59  | }
  60  | 
  61  | async function boxFor(page: Page, selector: string) {
  62  |   const locator = page.locator(selector).first();
  63  |   if (!await locator.count()) return null;
  64  |   try {
  65  |     if (!await locator.isVisible()) return null;
  66  |     return await locator.boundingBox();
  67  |   } catch {
  68  |     return null;
  69  |   }
  70  | }
  71  | 
  72  | function overlapArea(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  73  |   const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  74  |   const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  75  |   return Math.round(xOverlap * yOverlap);
  76  | }
  77  | 
  78  | export async function prepareVisualPage(page: Page, viewport: ViewportSpec) {
  79  |   ensureQaOutput();
  80  |   await page.setViewportSize({ width: viewport.width, height: viewport.height });
  81  |   await page.addInitScript(() => {
  82  |     document.documentElement.classList.add('test-mode-active');
  83  |     document.body?.classList.add('test-mode-active');
  84  |   });
  85  | }
  86  | 
  87  | export async function openRoute(page: Page, route: string, waitForSelector: string) {
  88  |   await page.goto(route, { waitUntil: 'networkidle' });
  89  |   await page.waitForTimeout(600);
  90  |   await page.evaluate(() => {
  91  |     document.documentElement.classList.add('test-mode-active');
  92  |     document.body.classList.add('test-mode-active');
  93  |   });
  94  |   await page.addStyleTag({ content: `
  95  |     *, *::before, *::after { animation: none !important; transition: none !important; }
  96  |     html, body { scroll-behavior: auto !important; }
  97  |     ${FLOATING_AI_SELECTORS.join(', ')} { display: none !important; visibility: hidden !important; pointer-events: none !important; }
  98  |   ` });
> 99  |   await page.waitForSelector(waitForSelector, { timeout: 20000 });
      |              ^ TimeoutError: page.waitForSelector: Timeout 20000ms exceeded.
  100 |   await page.waitForTimeout(400);
  101 | }
  102 | 
  103 | async function captureComponents(page: Page, routeKey: string, viewportName: string, selectors: string[]) {
  104 |   const outputs: string[] = [];
  105 |   for (const [index, selector] of selectors.entries()) {
  106 |     const locator = page.locator(selector).first();
  107 |     if (!await locator.count()) continue;
  108 |     try {
  109 |       if (!await locator.isVisible()) continue;
  110 |       const file = screenshotPath(routeKey, viewportName, `component-${index}`);
  111 |       await locator.screenshot({ path: file.absolute, animations: 'disabled' });
  112 |       outputs.push(file.relative);
  113 |     } catch {
  114 |       // ignore per-component screenshot failures
  115 |     }
  116 |   }
  117 |   return outputs;
  118 | }
  119 | 
  120 | async function buildIssueScreenshot(page: Page, routeKey: string, viewportName: string, rule: string) {
  121 |   const file = screenshotPath(routeKey, viewportName, `issue-${rule}`);
  122 |   await page.screenshot({ path: file.absolute, fullPage: true, animations: 'disabled' });
  123 |   return file.relative;
  124 | }
  125 | 
  126 | async function maybeCaptureAfterPreview(page: Page, config: RouteConfig, viewport: ViewportSpec, issues: any[]) {
  127 |   const safeIssues = issues.filter((issue) => issue.safe_to_auto_fix);
  128 |   if (!safeIssues.length) return null;
  129 |   const css: string[] = [];
  130 |   if (config.routeKey.includes('auction')) {
  131 |     css.push(`
  132 |       @media (max-width: 389px) {
  133 |         [data-testid^="auction-card-"] .grid { grid-template-columns: 1fr !important; }
  134 |         [data-testid="auction-detail-current-price"], [data-testid="auction-countdown"] { display: block !important; }
  135 |       }
  136 |       [data-testid="auction-bid-history"] { margin-bottom: 120px !important; }
  137 |     `);
  138 |   }
  139 |   if (config.routeKey.includes('taxi')) {
  140 |     css.push(`
  141 |       [data-testid="vehicle-selector-list"], [data-testid="quick-destinations-scroll"] { overflow-x: auto !important; }
  142 |       [data-testid="book-ride-button"] { position: relative !important; bottom: auto !important; }
  143 |       [data-testid="pricing-overview-card"] { width: 100% !important; }
  144 |     `);
  145 |   }
  146 |   if (!css.length) return null;
  147 |   await page.addStyleTag({ content: css.join('\n') });
  148 |   await page.waitForTimeout(200);
  149 |   const after = screenshotPath(config.routeKey, viewport.name, 'after-preview');
  150 |   await page.screenshot({ path: after.absolute, fullPage: true, animations: 'disabled' });
  151 |   return after.relative;
  152 | }
  153 | 
  154 | function appendAuditEntry(entry: any) {
  155 |   ensureQaOutput();
  156 |   const raw = JSON.parse(fs.readFileSync(RAW_AUDIT_PATH, 'utf8'));
  157 |   raw.results = Array.isArray(raw.results) ? raw.results.filter((item: any) => !(item.route_key === entry.route_key && item.viewport === entry.viewport)) : [];
  158 |   raw.results.push(entry);
  159 |   raw.routes = Array.from(new Set([...(raw.routes || []), entry.route]));
  160 |   raw.viewports = Array.from(new Set([...(raw.viewports || []), entry.viewport]));
  161 |   fs.writeFileSync(RAW_AUDIT_PATH, JSON.stringify(raw, null, 2));
  162 | }
  163 | 
  164 | export async function runRouteAudit(page: Page, config: RouteConfig, viewport: ViewportSpec, routeOverride?: string) {
  165 |   const route = routeOverride || config.route || '/';
  166 |   await prepareVisualPage(page, viewport);
  167 |   await openRoute(page, route, config.waitFor);
  168 |   const full = screenshotPath(config.routeKey, viewport.name, 'before');
  169 |   await page.screenshot({ path: full.absolute, fullPage: true, animations: 'disabled' });
  170 |   const componentScreenshots = await captureComponents(page, config.routeKey, viewport.name, config.componentSelectors);
  171 | 
  172 |   const issues: any[] = [];
  173 |   const routePath = new URL(page.url()).pathname;
  174 |   const bodyText = await page.locator('body').innerText();
  175 |   const textSample = bodyText.slice(0, 3500);
  176 | 
  177 |   const metrics = await page.evaluate(() => {
  178 |     const doc = document.documentElement;
  179 |     const body = document.body;
  180 |     const images = Array.from(document.querySelectorAll('img')).map((img) => {
  181 |       const root = img.closest('[data-product-category]') || img.parentElement;
  182 |       return {
  183 |         src: img.getAttribute('src') || '',
  184 |         alt: img.getAttribute('alt') || '',
  185 |         naturalWidth: (img as HTMLImageElement).naturalWidth,
  186 |         naturalHeight: (img as HTMLImageElement).naturalHeight,
  187 |         productId: root?.getAttribute('data-product-id') || '',
  188 |         productTitle: root?.getAttribute('data-product-title') || '',
  189 |         productCategory: root?.getAttribute('data-product-category') || '',
  190 |         imageCategory: root?.getAttribute('data-image-category') || '',
  191 |         imageUrl: root?.getAttribute('data-image-url') || img.getAttribute('src') || '',
  192 |         verified: root?.getAttribute('data-image-verified') || '',
  193 |         confidence: root?.getAttribute('data-image-confidence') || '',
  194 |         manualReview: root?.getAttribute('data-image-manual-review') || '',
  195 |       };
  196 |     });
  197 |     return {
  198 |       scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
  199 |       clientWidth: doc.clientWidth,
```