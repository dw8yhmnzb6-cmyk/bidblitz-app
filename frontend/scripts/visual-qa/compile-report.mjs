import path from 'path';
import { outputDir, rawAuditPath, designSpecPath, repairSafetyRulesPath, readJson, writeJson } from './shared.mjs';

const translationPath = path.join(outputDir, 'translation-consistency.json');
const numberPath = path.join(outputDir, 'numeric-format-validation.json');
const designPath = path.join(outputDir, 'design-consistency.json');
const imagePath = path.join(outputDir, 'product-image-validation.json');
const aiPath = path.join(outputDir, 'ai-screenshot-review.json');

const raw = readJson(rawAuditPath, { results: [] });
const translation = readJson(translationPath, { issues: [] });
const numeric = readJson(numberPath, { issues: [] });
const design = readJson(designPath, { issues: [] });
const image = readJson(imagePath, { results: [] });
const ai = readJson(aiPath, { issues: [] });
const designSpec = readJson(designSpecPath, {});
const safetyRules = readJson(repairSafetyRulesPath, {});

const routeIssues = raw.results.flatMap((entry) => (entry.issues || []).map((issue, index) => ({
  issue_id: `${entry.viewport}-${entry.route}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
  route: entry.route,
  resolved_path: entry.resolved_path || entry.route,
  viewport: entry.viewport,
  status: 'New',
  affected_component: issue.rule || '',
  suggested_fix: issue.safe_to_auto_fix ? 'Apply the smallest safe CSS or translation-key fix only.' : 'Manual review required.',
  risk_level: issue.safe_to_auto_fix ? 'low' : 'medium',
  ...issue,
  before_screenshot: entry.screenshot || '',
  page_text_sample: entry.text_sample || '',
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
  metadata: {
    design_spec: designSpec,
    repair_safety_rules: safetyRules,
    detection_rules: [
      'horizontal-overflow',
      'content-outside-viewport',
      'content-outside-safe-area',
      'text-overlap',
      'broken-image',
      'unexpected-empty-section',
      'nan-undefined-null',
      'mixed-language-german',
      'text-too-small',
      'clipped-button',
      'duplicate-header',
      'duplicate-bottom-nav',
      'bottom-nav-obstruction',
      'missing-bottom-navigation',
      'low-contrast-primary-action',
      'numeric-format-validation',
      'product-image-validation',
      'ai-screenshot-review',
    ],
  },
};

writeJson(path.join(outputDir, 'qa-report.json'), summary);
writeJson(path.join(outputDir, 'qa-issues.json'), issues);

if (criticalFailures.length > 0) {
  console.error(`Visual QA failed with ${criticalFailures.length} critical issues.`);
  process.exit(1);
}

console.log('Visual QA summary generated:', path.join(outputDir, 'qa-report.json'));