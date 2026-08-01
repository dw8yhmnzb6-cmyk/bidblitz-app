import fs from 'fs';
import path from 'path';

const issuesPath = path.resolve('frontend/qa-output/qa-issues.json');
const outputDir = path.resolve('frontend/qa-output/repair-plans');
fs.mkdirSync(outputDir, { recursive: true });

if (!fs.existsSync(issuesPath)) {
  console.log('No issue file found, skipping repair preparation.');
  process.exit(0);
}

const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
const safeIssues = issues.filter((issue) => issue.safe_to_auto_fix);

safeIssues.forEach((issue) => {
  const slug = `${issue.route || 'route'}-${issue.affected_component || 'issue'}`.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
  const branch = `ai-fix/${slug}`;
  const plan = {
    issue_id: issue.issue_id,
    branch,
    route: issue.route,
    problem: issue.problem,
    root_cause: issue.affected_component,
    files_changed: [],
    tests_required: ['npm ci', 'npm run build', 'npm run lint', 'npx playwright test'],
    before_screenshot: issue.before_screenshot || '',
    after_screenshot: issue.after_screenshot || '',
    risk_level: issue.risk_level || 'low',
    status: 'Repair prepared',
    safety_rule: 'Never modify wallet, payment, auth, KYC, roles or live database records automatically.',
  };
  fs.writeFileSync(path.join(outputDir, `${issue.issue_id}.json`), JSON.stringify(plan, null, 2));
  fs.writeFileSync(path.join(outputDir, `${issue.issue_id}.md`), `# Repair PR Draft\n\n- Problem: ${issue.problem}\n- Root cause: ${issue.affected_component || 'TBD'}\n- Route: ${issue.route}\n- Files changed: TBD\n- Tests passed: pending\n- Before screenshot: ${issue.before_screenshot || 'n/a'}\n- After screenshot: ${issue.after_screenshot || 'n/a'}\n- Risk level: ${issue.risk_level || 'low'}\n- Branch: ${branch}\n\nNo automatic merge allowed.\n`);
});

console.log(`Prepared ${safeIssues.length} safe repair plan(s).`);