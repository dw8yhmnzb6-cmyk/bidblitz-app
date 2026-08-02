import { readJson, visualQaReportJsonPath } from './shared.mjs';

const report = readJson(visualQaReportJsonPath, null);
if (!report) {
  console.log('No visual QA report found. Skipping upload.');
  process.exit(0);
}

if (!process.env.QA_REPORT_UPLOAD_URL) {
  console.log('QA_REPORT_UPLOAD_URL missing. Skipping upload.');
  process.exit(0);
}

const token = process.env.VISUAL_QA_REPORT_TOKEN || '';

const response = await fetch(process.env.QA_REPORT_UPLOAD_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(report),
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Upload failed: ${response.status} ${text}`);
}

console.log('Visual QA report uploaded successfully.');