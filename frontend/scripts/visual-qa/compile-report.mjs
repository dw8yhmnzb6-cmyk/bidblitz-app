import { aiReportPath, designReportPath, ensureOutputDir, legacyQaReportPath, numericReportPath, productImageReportPath, rawAuditPath, readJson, repairDraftPath, rootVisualQaReportHtmlPath, rootVisualQaReportJsonPath, routeFileMap, sanitizeIssue, translationReportPath, visualQaReportHtmlPath, visualQaReportJsonPath, writeJson, writeText } from './shared.mjs';

ensureOutputDir();

const raw = readJson(rawAuditPath, { results: [] });
const validatorReports = [
  readJson(numericReportPath, { issues: [] }),
  readJson(translationReportPath, { issues: [] }),
  readJson(designReportPath, { issues: [] }),
  readJson(productImageReportPath, { issues: [] }),
  readJson(aiReportPath, { issues: [] }),
];

const issueMap = new Map();

for (const entry of raw.results || []) {
  for (const issue of entry.issues || []) {
    const normalized = sanitizeIssue(issue, {
      route: entry.route,
      viewport: entry.viewport,
      before_screenshot: issue.before_screenshot || entry.screenshot,
      changed_file: issue.changed_file || routeFileMap(entry.route, issue.category),
      root_cause: issue.root_cause || 'Detected directly by Playwright visual audit.',
      suggested_fix: issue.suggested_fix || 'Apply a safe frontend-only layout or translation fix.',
      test_result: 'failed',
    });
    issueMap.set(normalized.issue_id, normalized);
  }
}

for (const report of validatorReports) {
  for (const issue of report.issues || []) {
    const normalized = sanitizeIssue(issue, {
      changed_file: issue.changed_file || routeFileMap(issue.route, issue.category),
      test_result: 'failed',
    });
    issueMap.set(normalized.issue_id, normalized);
  }
}

const issues = Array.from(issueMap.values()).sort((a, b) => {
  const order = { Critical: 0, critical: 0, High: 1, high: 1, Medium: 2, medium: 2, Low: 3, low: 3 };
  return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
});

const routesTested = Array.from(new Set((raw.results || []).map((entry) => entry.route))).sort();
const screenSizesTested = Array.from(new Set((raw.results || []).map((entry) => entry.viewport))).sort();
const criticalProblems = issues.filter((issue) => String(issue.severity).toLowerCase() === 'critical');
const highProblems = issues.filter((issue) => String(issue.severity).toLowerCase() === 'high');
const warnings = issues.filter((issue) => ['medium', 'low'].includes(String(issue.severity).toLowerCase()));
const passedChecks = (raw.results || []).length - new Set(issues.map((issue) => `${issue.route}-${issue.viewport}`)).size;
const summary = {
  generated_at: new Date().toISOString(),
  routes_tested: routesTested,
  screen_sizes_tested: screenSizesTested,
  scan_count: (raw.results || []).length,
  passed_checks: Math.max(0, passedChecks),
  failed_checks: issues.length,
  critical_problems: criticalProblems.length,
  warnings: warnings.length,
  issues,
  current_status: criticalProblems.length || highProblems.length ? 'action-required' : 'passed',
  repair_branch: 'ai-fix/visual-qa-mvp',
  repair_draft: repairDraftPath.replace(process.cwd() + '/', ''),
};

writeJson(visualQaReportJsonPath, summary);
writeJson(legacyQaReportPath, summary);
writeJson(rootVisualQaReportJsonPath, summary);

const rows = issues.map((issue) => `
  <tr>
    <td>${issue.severity}</td>
    <td>${issue.route}</td>
    <td>${issue.viewport}</td>
    <td>${issue.problem}</td>
    <td>${issue.root_cause}</td>
    <td>${issue.changed_file}</td>
    <td>${issue.safe_to_auto_fix ? 'Automatic fix' : 'Manual review'}</td>
    <td>${issue.test_result}</td>
    <td>${issue.before_screenshot ? `<a href="${issue.before_screenshot}">Before</a>` : '-'}</td>
    <td>${issue.after_screenshot ? `<a href="${issue.after_screenshot}">After</a>` : '-'}</td>
  </tr>`).join('');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>BidBlitz Visual QA Report</title>
    <style>
      body{font-family:Inter,Arial,sans-serif;background:#02050B;color:#fff;padding:32px}
      .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:24px 0}
      .card{background:#07101D;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:20px}
      table{width:100%;border-collapse:collapse;background:#07101D;border-radius:18px;overflow:hidden}
      th,td{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top;text-align:left;font-size:14px}
      th{color:#A9B1BF;text-transform:uppercase;font-size:12px;letter-spacing:.08em}
      a{color:#00C8FF}
    </style>
  </head>
  <body>
    <h1>BidBlitz AI Visual Quality Agent — Report</h1>
    <div class="grid">
      <div class="card"><strong>Routes tested</strong><div>${routesTested.join('<br/>') || '-'}</div></div>
      <div class="card"><strong>Screen sizes</strong><div>${screenSizesTested.join('<br/>') || '-'}</div></div>
      <div class="card"><strong>Passed checks</strong><div>${summary.passed_checks}</div></div>
      <div class="card"><strong>Failed checks</strong><div>${summary.failed_checks}</div></div>
      <div class="card"><strong>Critical problems</strong><div>${summary.critical_problems}</div></div>
      <div class="card"><strong>Warnings</strong><div>${summary.warnings}</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Severity</th><th>Route</th><th>Viewport</th><th>Problem</th><th>Root cause</th><th>Changed file</th><th>Repair</th><th>Test result</th><th>Before</th><th>After</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="10">No issues detected.</td></tr>'}</tbody>
    </table>
  </body>
</html>`;

writeText(visualQaReportHtmlPath, html);
writeText(rootVisualQaReportHtmlPath, html);

console.log(`Visual QA summary generated: ${visualQaReportJsonPath}`);

if (criticalProblems.length || highProblems.length) {
  process.exit(1);
}