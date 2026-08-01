import path from 'path';
import { deriveVisualQaUrl, getQaBaseUrl, postJson, readJson } from './shared.mjs';

const reportPath = path.resolve('frontend/qa-output/qa-report.json');
const uploadUrl = deriveVisualQaUrl(process.env.QA_REPORT_UPLOAD_URL, '/api/visual-qa/report');

if (!uploadUrl) {
  console.log('Upload skipped (missing report or upload configuration).');
  process.exit(0);
}

const report = readJson(reportPath, null);
if (!report) {
  console.log('Upload skipped because qa-report.json is missing.');
  process.exit(0);
}

const response = await postJson(uploadUrl, {
  run_id: `VQR-${Date.now()}`,
  source: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local-run',
  branch: process.env.GITHUB_REF_NAME || '',
  commit_hash: process.env.GITHUB_SHA || '',
  workflow_name: 'visual-qa',
  target_base_url: getQaBaseUrl(),
  pages_scanned: report.pages_scanned,
  passed: report.passed,
  failed: report.failed,
  critical_issues: report.critical_issues,
  warnings: report.warnings,
  viewports: report.viewports,
  routes: report.routes,
  screenshots_artifact_url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '',
  issues: report.issues,
  metadata: report.metadata || {},
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Visual QA upload failed: ${response.status} ${text}`);
}

console.log('Visual QA report uploaded successfully.');