import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('frontend/qa-output');
const rawPath = path.join(outputDir, 'raw-route-audit.json');
const translationPath = path.join(outputDir, 'translation-consistency.json');
const numberPath = path.join(outputDir, 'numeric-format-validation.json');
const designPath = path.join(outputDir, 'design-consistency.json');
const imagePath = path.join(outputDir, 'product-image-validation.json');
const aiPath = path.join(outputDir, 'ai-screenshot-review.json');

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

const raw = readJson(rawPath, { results: [] });
const translation = readJson(translationPath, { issues: [] });
const numeric = readJson(numberPath, { issues: [] });
const design = readJson(designPath, { issues: [] });
const image = readJson(imagePath, { results: [] });
const ai = readJson(aiPath, { issues: [] });

const routeIssues = raw.results.flatMap((entry) => (entry.issues || []).map((issue, index) => ({
  issue_id: `${entry.viewport}-${entry.route}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
  route: entry.route,
  viewport: entry.viewport,
  status: 'New',
  affected_component: issue.rule || '',
  suggested_fix: issue.safe_to_auto_fix ? 'Apply the smallest safe CSS or translation-key fix only.' : 'Manual review required.',
  risk_level: issue.safe_to_auto_fix ? 'low' : 'medium',
  ...issue,
  before_screenshot: entry.screenshot || '',
}))); 

const issues = [
  ...routeIssues,
  ...(translation.issues || []),
  ...(numeric.issues || []),
  ...(design.issues || []),
  ...(ai.issues || []),
  ...((image.results || []).filter((item) => item.match_status === 'mismatch').map((item, index) => ({
    issue_id: `product-image-${index}`,
    severity: item.confidence >= 0.9 ? 'high' : 'medium',
    category: 'wrong_image',
    route: '/auctions',
    viewport: 'data-scan',
    status: 'New',
    problem: `${item.title} has a potentially incorrect image (${item.incorrect_image_url}).`,
    affected_component: 'auction-image',
    suggested_fix: item.suggested_replacement || 'Review image and replace only if high confidence.',
    confidence: item.confidence || 0,
    safe_to_auto_fix: (item.confidence || 0) >= 0.95,
    risk_level: (item.confidence || 0) >= 0.95 ? 'low' : 'medium',
  }))),
];

const criticalFailures = issues.filter((issue) =>
  issue.severity === 'critical'
  || issue.rule === 'horizontal-overflow'
  || issue.rule === 'broken-image'
  || issue.rule === 'nan-undefined-null'
  || issue.rule === 'mixed-language-german'
  || issue.category === 'wrong_image' && (issue.confidence || 0) >= 0.95
);

const summary = {
  generated_at: new Date().toISOString(),
  pages_scanned: raw.results.length,
  passed: raw.results.filter((entry) => (entry.issues || []).length === 0).length,
  failed: raw.results.filter((entry) => (entry.issues || []).length > 0).length,
  critical_issues: criticalFailures.length,
  warnings: issues.filter((issue) => issue.severity === 'medium' || issue.severity === 'low').length,
  viewports: raw.viewports || [],
  routes: raw.routes || [],
  issues,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'qa-report.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outputDir, 'qa-issues.json'), JSON.stringify(issues, null, 2));

if (criticalFailures.length > 0) {
  console.error(`Visual QA failed with ${criticalFailures.length} critical issues.`);
  process.exit(1);
}

console.log('Visual QA summary generated:', path.join(outputDir, 'qa-report.json'));