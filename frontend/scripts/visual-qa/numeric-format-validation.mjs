import path from 'path';
import { outputDir, rawAuditPath, readJson, writeJson } from './shared.mjs';

const raw = readJson(rawAuditPath, { results: [] });
const issues = [];

const germanCurrencyRegex = /\b\d{1,3}(?:\.\d{3})*,\d{2}\s?€/g;
const suspiciousDecimalRegex = /\b\d+\.\d{3,}\b/g;
const malformedTimerRegex = /\b\d{1,2}:\d{1,2}(?::\d{1,2})?\b/g;

for (const entry of raw.results || []) {
  const screenshotName = entry.screenshot || '';
  const textSample = entry.text_sample || '';
  const numericCandidates = entry.numeric_candidates || [];

  if (/\b-\d+\s*(Std\.|Min\.|Sek\.|h|m|s)\b/.test(textSample)) {
    issues.push({
      issue_id: `number-negative-time-${issues.length}`,
      route: entry.route,
      viewport: entry.viewport,
      status: 'New',
      before_screenshot: screenshotName,
      affected_component: 'timer',
      suggested_fix: 'Prevent negative countdown rendering and clamp timers at zero.',
      risk_level: 'medium',
      severity: 'high',
      category: 'wrong_number',
      problem: 'Negative time value detected in visible page text.',
      confidence: 0.94,
      safe_to_auto_fix: false,
    });
  }

  const suspiciousDecimals = textSample.match(suspiciousDecimalRegex) || [];
  suspiciousDecimals.slice(0, 6).forEach((value) => {
    issues.push({
      issue_id: `number-suspicious-decimal-${issues.length}`,
      route: entry.route,
      viewport: entry.viewport,
      status: 'New',
      before_screenshot: screenshotName,
      affected_component: 'formatted-number',
      suggested_fix: 'Verify if this value should be rounded to two decimals for German locale.',
      risk_level: 'medium',
      severity: 'medium',
      category: 'wrong_number',
      problem: `Suspicious decimal precision detected: ${value}`,
      confidence: 0.82,
      safe_to_auto_fix: false,
    });
  });

  const malformedTimers = textSample.match(malformedTimerRegex) || [];
  malformedTimers.slice(0, 4).forEach((value) => {
    issues.push({
      issue_id: `number-malformed-timer-${issues.length}`,
      route: entry.route,
      viewport: entry.viewport,
      status: 'New',
      before_screenshot: screenshotName,
      affected_component: 'timer',
      suggested_fix: 'Use the localized timer format like 11 Std. 04 Min. 37 Sek. when German is active.',
      risk_level: 'low',
      severity: 'medium',
      category: 'wrong_number',
      problem: `Timer format may not follow the German UI format: ${value}`,
      confidence: 0.7,
      safe_to_auto_fix: true,
    });
  });

  if (textSample.includes('€') && !germanCurrencyRegex.test(textSample)) {
    const malformedCurrency = numericCandidates.find((candidate) => candidate.includes('€') && !germanCurrencyRegex.test(candidate));
    if (malformedCurrency) {
      issues.push({
        issue_id: `number-currency-format-${issues.length}`,
        route: entry.route,
        viewport: entry.viewport,
        status: 'New',
        before_screenshot: screenshotName,
        affected_component: 'price',
        suggested_fix: 'Render German currency values as 53,72 € with comma decimals and trailing currency sign.',
        risk_level: 'low',
        severity: 'medium',
        category: 'wrong_number',
        problem: `Visible currency value may be malformed for German locale: ${malformedCurrency}`,
        confidence: 0.78,
        safe_to_auto_fix: true,
      });
    }
  }
}

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

writeJson(path.join(outputDir, 'numeric-format-validation.json'), { generated_at: new Date().toISOString(), issues });
console.log(`Numeric validation report written with ${issues.length} issues.`);