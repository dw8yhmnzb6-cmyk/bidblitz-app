import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('frontend/qa-output');
const raw = JSON.parse(fs.readFileSync(path.join(outputDir, 'raw-route-audit.json'), 'utf8'));
const issues = [];

for (const entry of raw.results || []) {
  const screenshotName = entry.screenshot || '';
  for (const issue of entry.issues || []) {
    if (issue.category === 'data_inconsistency') {
      issues.push({
        issue_id: `number-${issues.length}`,
        route: entry.route,
        viewport: entry.viewport,
        status: 'New',
        before_screenshot: screenshotName,
        affected_component: issue.rule,
        suggested_fix: 'Verify price, timer or formatted number rendering for German locale.',
        risk_level: 'medium',
        ...issue,
      });
    }
  }
}

fs.writeFileSync(path.join(outputDir, 'numeric-format-validation.json'), JSON.stringify({ generated_at: new Date().toISOString(), issues }, null, 2));
console.log(`Numeric validation report written with ${issues.length} issues.`);