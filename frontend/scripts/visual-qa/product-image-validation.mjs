import { ensureOutputDir, productImageReportPath, rawAuditPath, readJson, routeFileMap, sanitizeIssue, writeJson } from './shared.mjs';

const raw = readJson(rawAuditPath, { results: [] });
const rules = {
  'e-bike': { allowed: ['e-bike'], forbidden: ['motorcycle'] },
  laptop: { allowed: ['laptop'], forbidden: ['motorcycle', 'robot-vacuum', 'e-bike'] },
  'robot-vacuum': { allowed: ['robot-vacuum'], forbidden: ['motorcycle', 'laptop', 'e-bike'] },
  smartphone: { allowed: ['smartphone'], forbidden: ['robot-vacuum', 'e-bike'] },
  television: { allowed: ['television'], forbidden: ['robot-vacuum', 'e-bike'] },
  'gaming-console': { allowed: ['gaming-console'], forbidden: ['robot-vacuum', 'e-bike'] },
  'household-appliance': { allowed: ['household-appliance', 'robot-vacuum'], forbidden: ['motorcycle'] },
};

const issues = [];

for (const entry of raw.results || []) {
  for (const image of entry.image_references || []) {
    const productCategory = image.productCategory || '';
    const imageCategory = image.imageCategory || '';
    const rule = rules[productCategory];
    if (!rule) continue;
    const confidence = Number(image.confidence || 0.7);
    const wrongWithHighConfidence = rule.forbidden.includes(imageCategory) && confidence >= 0.9;
    const uncertain = !wrongWithHighConfidence && imageCategory && !rule.allowed.includes(imageCategory);
    if (wrongWithHighConfidence) {
      issues.push(sanitizeIssue({
        issue_id: `${entry.route_key}-${entry.viewport}-wrong-image-${issues.length}`,
        severity: 'high',
        category: 'wrong_image',
        route: entry.route,
        viewport: entry.viewport,
        problem: `Wrong product image detected for ${image.productTitle || productCategory}: ${imageCategory}`,
        root_cause: 'Sichtbare Galerie enthält ein klar falsches Produktbild für die Kategorie.',
        affected_component: image.productTitle || 'product-image',
        suggested_fix: 'Falsches Bild aus der sichtbaren Galerie entfernen und verifiziertes Bild derselben Produktfamilie verwenden.',
        changed_file: routeFileMap(entry.route, 'wrong_image'),
        safe_to_auto_fix: true,
        confidence,
        before_screenshot: entry.screenshot,
      }));
    }
    if (uncertain || image.manualReview === 'true') {
      issues.push(sanitizeIssue({
        issue_id: `${entry.route_key}-${entry.viewport}-manual-image-${issues.length}`,
        severity: 'medium',
        category: 'wrong_image',
        route: entry.route,
        viewport: entry.viewport,
        status: 'Manual review',
        problem: `Image match for ${image.productTitle || productCategory} is uncertain and needs manual review.`,
        root_cause: 'Bildkategorie konnte nicht mit hoher Sicherheit bestätigt werden.',
        affected_component: image.productTitle || 'product-image',
        suggested_fix: 'Kein automatischer Austausch — Bild manuell bestätigen oder ersetzen.',
        changed_file: routeFileMap(entry.route, 'wrong_image'),
        safe_to_auto_fix: false,
        confidence,
        before_screenshot: entry.screenshot,
      }));
    }
  }
}

ensureOutputDir();
writeJson(productImageReportPath, { generated_at: new Date().toISOString(), issues });
console.log(`Product image validation report written with ${issues.length} issues.`);