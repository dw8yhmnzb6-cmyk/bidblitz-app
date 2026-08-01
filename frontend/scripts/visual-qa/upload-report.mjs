import fs from 'fs';
import path from 'path';

const reportPath = path.resolve('frontend/qa-output/qa-report.json');
const uploadUrl = process.env.QA_REPORT_UPLOAD_URL;
const token = process.env.VISUAL_QA_REPORT_TOKEN;

if (!fs.existsSync(reportPath) || !uploadUrl || !token) {
  console.log('Upload skipped (missing report or upload configuration).');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const response = await fetch(uploadUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-visual-qa-token': token,
  },
  body: JSON.stringify({
    run_id: `VQR-${Date.now()}`,
    source: 'github-actions',
    branch: process.env.GITHUB_REF_NAME || '',
    commit_hash: process.env.GITHUB_SHA || '',
    workflow_name: 'visual-qa',
    target_base_url: process.env.QA_BASE_URL || '',
    pages_scanned: report.pages_scanned,
    passed: report.passed,
    failed: report.failed,
    critical_issues: report.critical_issues,
    warnings: report.warnings,
    viewports: report.viewports,
    routes: report.routes,
    screenshots_artifact_url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '',
    issues: report.issues,
  }),
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Visual QA upload failed: ${response.status} ${text}`);
}

console.log('Visual QA report uploaded successfully.');