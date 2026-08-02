import fs from 'fs';
import path from 'path';

export const repoRoot = path.resolve(process.cwd());
export const outputDir = path.join(repoRoot, 'frontend', 'qa-output');
export const screenshotDir = path.join(outputDir, 'screenshots');
export const rawAuditPath = path.join(outputDir, 'raw-route-audit.json');
export const numericReportPath = path.join(outputDir, 'numeric-report.json');
export const translationReportPath = path.join(outputDir, 'translation-report.json');
export const designReportPath = path.join(outputDir, 'design-report.json');
export const productImageReportPath = path.join(outputDir, 'product-image-report.json');
export const aiReportPath = path.join(outputDir, 'ai-report.json');
export const visualQaReportJsonPath = path.join(outputDir, 'visual-qa-report.json');
export const visualQaReportHtmlPath = path.join(outputDir, 'visual-qa-report.html');
export const legacyQaReportPath = path.join(outputDir, 'qa-report.json');
export const repairDraftPath = path.join(outputDir, 'repair-pr-draft.md');
export const rootVisualQaReportJsonPath = path.join(repoRoot, 'visual-qa-report.json');
export const rootVisualQaReportHtmlPath = path.join(repoRoot, 'visual-qa-report.html');
export const designSpecPath = path.join(repoRoot, 'qa', 'design-spec.json');

export function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });
}

export function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(filePath, payload) {
  ensureOutputDir();
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

export function writeText(filePath, payload) {
  ensureOutputDir();
  fs.writeFileSync(filePath, payload, 'utf8');
}

export function toPublicPath(filePath) {
  return filePath.replace(`${repoRoot}${path.sep}`, '').split(path.sep).join('/');
}

export function sanitizeIssue(issue = {}, defaults = {}) {
  return {
    severity: issue.severity || defaults.severity || 'medium',
    category: issue.category || defaults.category || 'layout',
    route: issue.route || defaults.route || 'unknown',
    viewport: issue.viewport || defaults.viewport || 'unknown',
    status: issue.status || defaults.status || 'New',
    problem: issue.problem || defaults.problem || 'Unknown issue',
    root_cause: issue.root_cause || defaults.root_cause || 'Not yet classified',
    affected_component: issue.affected_component || defaults.affected_component || 'unknown',
    suggested_fix: issue.suggested_fix || defaults.suggested_fix || '',
    changed_file: issue.changed_file || defaults.changed_file || '',
    confidence: Number(issue.confidence ?? defaults.confidence ?? 0.8),
    safe_to_auto_fix: Boolean(issue.safe_to_auto_fix ?? defaults.safe_to_auto_fix ?? false),
    automatic_fix: issue.automatic_fix || defaults.automatic_fix || (issue.safe_to_auto_fix ? 'safe' : 'manual-review'),
    before_screenshot: issue.before_screenshot || defaults.before_screenshot || '',
    after_screenshot: issue.after_screenshot || defaults.after_screenshot || '',
    screenshot: issue.screenshot || defaults.screenshot || issue.before_screenshot || '',
    issue_id: issue.issue_id || defaults.issue_id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    element_1: issue.element_1 || '',
    element_2: issue.element_2 || '',
    overlap_area: issue.overlap_area || 0,
    test_result: issue.test_result || defaults.test_result || 'failed',
  };
}

export function relativeScreenshotPath(issue) {
  return issue.before_screenshot || issue.screenshot || '';
}

export function routeFileMap(route = '', category = '') {
  if (route.startsWith('/taxi')) return 'frontend/src/pages/TaxiPage.jsx';
  if (route.startsWith('/auction/')) return 'frontend/src/components/auctions/AuctionDetail.jsx';
  if (route.startsWith('/auctions')) return 'frontend/src/components/auctions/AuctionGridCard.jsx';
  if (category === 'translation') return 'frontend/src/store/I18nContext.jsx';
  if (category === 'wrong_image') return 'backend/routes/auctions.py';
  return 'frontend/src/design/tokens.css';
}

export function deriveVisualQaUrl(baseUrl = '', suffix = '') {
  if (!baseUrl) return '';
  return `${baseUrl.replace(/\/$/, '')}${suffix}`;
}

export async function postJson(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}