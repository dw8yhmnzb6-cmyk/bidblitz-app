import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('frontend/qa-output');
const rawPath = path.join(outputDir, 'raw-route-audit.json');
const reviewUrl = process.env.QA_VISUAL_REVIEW_URL;
const reviewToken = process.env.VISUAL_QA_REPORT_TOKEN;

if (!fs.existsSync(rawPath) || !reviewUrl || !reviewToken) {
  fs.writeFileSync(path.join(outputDir, 'ai-screenshot-review.json'), JSON.stringify({ generated_at: new Date().toISOString(), mode: 'skipped', issues: [] }, null, 2));
  console.log('AI screenshot review skipped (missing raw report or review endpoint/token).');
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const targetEntries = (raw.results || []).filter((entry) => (entry.issues || []).length > 0).slice(0, 20);
const aiIssues = [];

for (const entry of targetEntries) {
  const screenshotFile = entry.screenshot ? path.resolve(entry.screenshot.replace(/^frontend\//, 'frontend/')) : null;
  if (!screenshotFile || !fs.existsSync(screenshotFile)) continue;
  const screenshotBase64 = fs.readFileSync(screenshotFile).toString('base64');
  const response = await fetch(reviewUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-visual-qa-token': reviewToken,
    },
    body: JSON.stringify({
      screenshot_base64: `data:image/png;base64,${screenshotBase64}`,
      route: entry.route,
      viewport: entry.viewport,
      language: 'de',
      role: entry.role,
      page_data: entry.data_summary,
      design_tokens: JSON.parse(fs.readFileSync(path.resolve('qa/design-spec.json'), 'utf8')),
    }),
  });
  const data = await response.json();
  aiIssues.push(...(data.issues || []));
}

fs.writeFileSync(path.join(outputDir, 'ai-screenshot-review.json'), JSON.stringify({ generated_at: new Date().toISOString(), mode: 'remote-review', issues: aiIssues }, null, 2));
console.log(`AI screenshot review finished with ${aiIssues.length} issues.`);