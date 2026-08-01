import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('frontend/qa-output');
const raw = JSON.parse(fs.readFileSync(path.join(outputDir, 'raw-route-audit.json'), 'utf8'));
const spec = JSON.parse(fs.readFileSync(path.resolve('qa/design-spec.json'), 'utf8'));
const issues = [];

for (const entry of raw.results || []) {
  const design = entry.design_summary || {};
  const bodyBg = String(design.backgroundColor || '').toLowerCase();
  const rootBg = String(design.rootColor || '').toLowerCase();
  const looksLight = bodyBg.includes('255') || rootBg.includes('255');
  if (looksLight && !spec.intentionalLightRoutes.includes(entry.route)) {
    issues.push({
      issue_id: `design-light-${issues.length}`,
      severity: 'medium',
      category: 'inconsistent_design',
      route: entry.route,
      viewport: entry.viewport,
      status: 'New',
      problem: 'Page appears to use a light background that does not match the BidBlitz dark design language.',
      affected_component: 'page-shell',
      suggested_fix: 'Align page shell and sections with the BidBlitz dark background and cyan accent tokens.',
      confidence: 0.72,
      safe_to_auto_fix: true,
    });
  }
  if ((design.buttonMinHeight || 0) > 0 && design.buttonMinHeight < spec.minButtonHeightPx) {
    issues.push({
      issue_id: `design-button-height-${issues.length}`,
      severity: 'medium',
      category: 'accessibility',
      route: entry.route,
      viewport: entry.viewport,
      status: 'New',
      problem: `Detected button height ${design.buttonMinHeight}px below minimum ${spec.minButtonHeightPx}px.`,
      affected_component: 'button',
      suggested_fix: 'Increase button height to the minimum accessible size.',
      confidence: 0.85,
      safe_to_auto_fix: true,
    });
  }
}

fs.writeFileSync(path.join(outputDir, 'design-consistency.json'), JSON.stringify({ generated_at: new Date().toISOString(), issues }, null, 2));
console.log(`Design consistency report written with ${issues.length} issues.`);