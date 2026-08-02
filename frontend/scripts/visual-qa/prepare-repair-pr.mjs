import { readJson, repairDraftPath, visualQaReportJsonPath, writeText } from './shared.mjs';

const report = readJson(visualQaReportJsonPath, { issues: [] });
const manualReview = report.issues.filter((issue) => !issue.safe_to_auto_fix || issue.status === 'Manual review');
const changedFiles = Array.from(new Set(report.issues.map((issue) => issue.changed_file).filter(Boolean))).sort();

const body = `# BidBlitz Visual QA Repair Draft

- Branch: \`ai-fix/visual-qa-mvp\`
- Generated: ${new Date().toISOString()}
- Routes tested: ${(report.routes_tested || []).join(', ') || '-'}
- Viewports: ${(report.screen_sizes_tested || []).join(', ') || '-'}

## Original problems
${(report.issues || []).map((issue) => `- [${issue.severity}] ${issue.route} ${issue.viewport}: ${issue.problem}`).join('\n') || '- None'}

## Root causes
${(report.issues || []).map((issue) => `- ${issue.root_cause}`).join('\n') || '- None'}

## Files changed / suggested
${changedFiles.map((file) => `- ${file}`).join('\n') || '- None'}

## Before / After screenshots
${(report.issues || []).map((issue) => `- ${issue.route} ${issue.viewport}: before=${issue.before_screenshot || '-'} after=${issue.after_screenshot || '-'}`).join('\n') || '- None'}

## Test results
- Current status: ${report.current_status || 'unknown'}
- Passed checks: ${report.passed_checks || 0}
- Failed checks: ${report.failed_checks || 0}

## Remaining manual-review problems
${manualReview.map((issue) => `- ${issue.route} ${issue.viewport}: ${issue.problem}`).join('\n') || '- None'}

## Risk level
- ${manualReview.length ? 'medium' : 'low'}
`;

writeText(repairDraftPath, body);
console.log(`Prepared repair PR draft at ${repairDraftPath}.`);