import fs from 'fs';
import path from 'path';
import { outputDir, rawAuditPath, designSpecPath, deriveVisualQaUrl, postJson, readJson, writeJson } from './shared.mjs';

const reviewUrl = deriveVisualQaUrl(process.env.QA_VISUAL_REVIEW_URL, '/api/visual-qa/ai-review');

if (!fs.existsSync(rawAuditPath) || !reviewUrl) {
  writeJson(path.join(outputDir, 'ai-screenshot-review.json'), { generated_at: new Date().toISOString(), mode: 'skipped', issues: [] });
  console.log('AI screenshot review skipped (missing raw report or review endpoint).');
  process.exit(0);
}

const raw = readJson(rawAuditPath, { results: [] });
const targetEntries = (raw.results || []).filter((entry) => (entry.issues || []).length > 0).slice(0, 20);
const aiIssues = [];
const designTokens = readJson(designSpecPath, {});

for (const entry of targetEntries) {
  const screenshotFile = entry.screenshot ? path.resolve('frontend', entry.screenshot.replace(/^frontend\//, '')) : null;
  if (!screenshotFile || !fs.existsSync(screenshotFile)) continue;
  const screenshotBase64 = fs.readFileSync(screenshotFile).toString('base64');
  try {
    const response = await postJson(reviewUrl, {
      screenshot_base64: `data:image/png;base64,${screenshotBase64}`,
      route: entry.route,
      viewport: entry.viewport,
      language: 'de',
      role: entry.role,
      page_data: {
        ...entry.data_summary,
        text_sample: entry.text_sample,
        numeric_candidates: entry.numeric_candidates,
      },
      design_tokens: designTokens,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      aiIssues.push({
        severity: 'low',
        category: 'ai_review_unavailable',
        route: entry.route,
        viewport: entry.viewport,
        visual_coordinates: {},
        problem: `AI screenshot review unavailable: ${response.status} ${text}`,
        affected_component: 'ai-review-service',
        suggested_fix: 'Review the AI screenshot endpoint configuration and continue with deterministic QA checks.',
        confidence: 1,
        safe_to_auto_fix: false,
      });
      continue;
    }
    const data = await response.json();
    aiIssues.push(...(data.issues || []));
  } catch (error) {
    aiIssues.push({
      severity: 'low',
      category: 'ai_review_unavailable',
      route: entry.route,
      viewport: entry.viewport,
      visual_coordinates: {},
      problem: `AI screenshot review failed safely: ${error.message}`,
      affected_component: 'ai-review-service',
      suggested_fix: 'Inspect AI screenshot review service health and credentials.',
      confidence: 1,
      safe_to_auto_fix: false,
    });
  }
}

writeJson(path.join(outputDir, 'ai-screenshot-review.json'), { generated_at: new Date().toISOString(), mode: 'remote-review', issues: aiIssues });
console.log(`AI screenshot review finished with ${aiIssues.length} issues.`);