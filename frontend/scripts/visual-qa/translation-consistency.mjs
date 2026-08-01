import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('frontend/qa-output');
const raw = JSON.parse(fs.readFileSync(path.join(outputDir, 'raw-route-audit.json'), 'utf8'));
const sourceDir = path.resolve('frontend/src');
const phraseRegex = /(FREE WORLDWIDE SHIPPING|Brand New|Factory Sealed|\bbids\b|\bbidders\b)/g;
const keyRegex = /\b[a-z]{2,}\.[a-z0-9_.-]+\b/g;
const issues = [];

for (const entry of raw.results || []) {
  for (const issue of entry.issues || []) {
    if (issue.category === 'translation') {
      issues.push({
        issue_id: `translation-${entry.viewport}-${entry.route}-${issues.length}`,
        severity: issue.severity,
        category: 'translation',
        route: entry.route,
        viewport: entry.viewport,
        status: 'New',
        problem: issue.problem,
        affected_component: issue.rule,
        suggested_fix: 'Use translation keys instead of hard-coded strings.',
        confidence: issue.confidence || 0.8,
        safe_to_auto_fix: true,
      });
    }
  }
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(full)) {
      const content = fs.readFileSync(full, 'utf8');
      const hardcoded = content.match(phraseRegex) || [];
      const missingKeys = content.match(keyRegex) || [];
      hardcoded.forEach((match) => issues.push({
        issue_id: `source-hardcoded-${issues.length}`,
        severity: 'high',
        category: 'translation',
        route: 'source-scan',
        viewport: 'static',
        status: 'New',
        problem: `Hard-coded text found: ${match}`,
        affected_component: path.relative(path.resolve('frontend'), full),
        source_file: path.relative(path.resolve('frontend'), full),
        suggested_fix: 'Replace with translation key.',
        confidence: 0.88,
        safe_to_auto_fix: true,
      }));
      missingKeys.forEach((match) => {
        if (match.startsWith('gp.')) return;
        issues.push({
          issue_id: `source-missing-key-${issues.length}`,
          severity: 'medium',
          category: 'translation',
          route: 'source-scan',
          viewport: 'static',
          status: 'New',
          problem: `Possible missing translation key: ${match}`,
          affected_component: path.relative(path.resolve('frontend'), full),
          source_file: path.relative(path.resolve('frontend'), full),
          suggested_fix: 'Verify if this key exists and is mapped in translations.',
          confidence: 0.5,
          safe_to_auto_fix: false,
        });
      });
    }
  }
}

walk(sourceDir);
fs.writeFileSync(path.join(outputDir, 'translation-consistency.json'), JSON.stringify({ generated_at: new Date().toISOString(), issues }, null, 2));
console.log(`Translation consistency report written with ${issues.length} issues.`);