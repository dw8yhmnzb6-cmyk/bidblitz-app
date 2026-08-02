import { ensureOutputDir, rawAuditPath, readJson, routeFileMap, sanitizeIssue, translationReportPath, writeJson } from './shared.mjs';

const raw = readJson(rawAuditPath, { results: [] });
const englishOnGerman = [
  'FREE WORLDWIDE SHIPPING',
  'Brand New',
  'Factory Sealed',
  ' bids',
  ' bidders',
];

const issues = [];

for (const entry of raw.results || []) {
  const text = String(entry.text_sample || '');
  for (const token of englishOnGerman) {
    if (!text.includes(token)) continue;
    issues.push(sanitizeIssue({
      issue_id: `${entry.route_key}-${entry.viewport}-translation-${issues.length}`,
      severity: 'high',
      category: 'translation',
      route: entry.route,
      viewport: entry.viewport,
      problem: `Visible English token on German page: ${token}`,
      root_cause: 'Sichtbarer Text wurde nicht über das zentrale I18n-System ausgeliefert.',
      affected_component: 'Visible text label',
      suggested_fix: 'Den Text über bestehende BidBlitz-Translation-Keys rendern.',
      changed_file: routeFileMap(entry.route, 'translation'),
      confidence: 0.97,
      safe_to_auto_fix: true,
      before_screenshot: entry.screenshot,
    }));
  }
  if (/\b[a-z0-9_-]+\.[a-z0-9_.-]+\b/.test(text)) {
    issues.push(sanitizeIssue({
      issue_id: `${entry.route_key}-${entry.viewport}-translation-key-${issues.length}`,
      severity: 'high',
      category: 'translation',
      route: entry.route,
      viewport: entry.viewport,
      problem: 'An untranslated translation key appears to be visible.',
      root_cause: 'Ein I18n-Key wurde nicht in eine lesbare Übersetzung aufgelöst.',
      affected_component: 'Visible translation key',
      suggested_fix: 'Fehlenden Übersetzungseintrag ergänzen oder richtigen Key binden.',
      changed_file: routeFileMap(entry.route, 'translation'),
      confidence: 0.85,
      safe_to_auto_fix: true,
      before_screenshot: entry.screenshot,
    }));
  }
}

ensureOutputDir();
writeJson(translationReportPath, { generated_at: new Date().toISOString(), issues });
console.log(`Translation consistency report written with ${issues.length} issues.`);