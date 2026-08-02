import { ensureOutputDir, numericReportPath, rawAuditPath, readJson, writeJson, routeFileMap, sanitizeIssue } from './shared.mjs';

const raw = readJson(rawAuditPath, { results: [] });
const currencyPattern = /^\d{1,3}(?:\.\d{3})*,\d{2}\s€$/;
const etaPattern = /^\d+\sMin\.$/;
const issues = [];

for (const entry of raw.results || []) {
  const numbers = entry.numeric_candidates || [];
  for (const candidate of numbers) {
    const value = String(candidate || '').trim();
    if (!value) continue;
    if (/€/.test(value) && /\d/.test(value) && !currencyPattern.test(value)) {
      issues.push(sanitizeIssue({
        issue_id: `${entry.route_key}-${entry.viewport}-numeric-${issues.length}`,
        severity: 'high',
        category: 'wrong_number',
        route: entry.route,
        viewport: entry.viewport,
        problem: `Incorrect German currency format detected: ${value}`,
        root_cause: 'Preistext wurde nicht mit dem zentralen MoneyAmount-Format gerendert.',
        affected_component: 'MoneyAmount / price label',
        suggested_fix: 'Preis mit dem gemeinsamen MoneyAmount-Formatter rendern und exakt zwei Dezimalstellen ausgeben.',
        changed_file: routeFileMap(entry.route),
        safe_to_auto_fix: true,
        confidence: 0.96,
        before_screenshot: entry.screenshot,
      }));
    }
    if (entry.route === '/taxi' && /Min/.test(value) && !etaPattern.test(value)) {
      issues.push(sanitizeIssue({
        issue_id: `${entry.route_key}-${entry.viewport}-eta-${issues.length}`,
        severity: 'medium',
        category: 'wrong_number',
        route: entry.route,
        viewport: entry.viewport,
        problem: `Incorrect taxi ETA format detected: ${value}`,
        root_cause: 'Ankunftszeit wurde nicht im deutschen Kurzformat formatiert.',
        affected_component: 'Taxi ETA label',
        suggested_fix: 'ETA mit deutschem Kurzformat wie „3 Min.“ rendern.',
        changed_file: 'frontend/src/pages/TaxiPage.jsx',
        safe_to_auto_fix: true,
        confidence: 0.9,
        before_screenshot: entry.screenshot,
      }));
    }
  }
}

ensureOutputDir();
writeJson(numericReportPath, { generated_at: new Date().toISOString(), issues });
console.log(`Numeric validation report written with ${issues.length} issues.`);