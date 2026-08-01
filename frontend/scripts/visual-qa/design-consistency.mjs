import path from 'path';
import { outputDir, rawAuditPath, designSpecPath, readJson, writeJson } from './shared.mjs';

const raw = readJson(rawAuditPath, { results: [] });
const spec = readJson(designSpecPath, { intentionalLightRoutes: [], minButtonHeightPx: 48, requiredTokens: {} });
const issues = [];

if ((raw.results || []).length === 0) {
  writeJson(path.join(outputDir, 'design-consistency.json'), { generated_at: new Date().toISOString(), mode: 'skipped', issues: [] });
  console.log('Design consistency skipped because the raw route audit is missing.');
  process.exit(0);
}

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
  const snapshot = design.tokenSnapshot || {};
  Object.entries(spec.requiredTokens || {}).forEach(([tokenKey, expected]) => {
    const actual = snapshot[tokenKey];
    if (actual && String(actual).toLowerCase() !== String(expected).toLowerCase()) {
      issues.push({
        issue_id: `design-token-${tokenKey}-${issues.length}`,
        severity: 'medium',
        category: 'inconsistent_design',
        route: entry.route,
        viewport: entry.viewport,
        status: 'New',
        problem: `Token ${tokenKey} differs from expected design system value (${actual} vs ${expected}).`,
        affected_component: 'design-token',
        suggested_fix: 'Align the page with the central BidBlitz design tokens.',
        confidence: 0.78,
        safe_to_auto_fix: true,
      });
    }
  });
  if ((design.galleryMetadataMissingCount || 0) > 0) {
    issues.push({
      issue_id: `design-gallery-meta-${issues.length}`,
      severity: 'medium',
      category: 'wrong_image',
      route: entry.route,
      viewport: entry.viewport,
      status: 'New',
      problem: 'Product image gallery is missing required category metadata.',
      affected_component: 'product-image-gallery',
      suggested_fix: 'Attach product/image category metadata to the shared gallery component.',
      confidence: 0.88,
      safe_to_auto_fix: true,
    });
  }
}

writeJson(path.join(outputDir, 'design-consistency.json'), { generated_at: new Date().toISOString(), issues });
console.log(`Design consistency report written with ${issues.length} issues.`);