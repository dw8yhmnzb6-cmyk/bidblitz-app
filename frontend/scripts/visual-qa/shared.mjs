import fs from 'fs';
import path from 'path';

export const outputDir = path.resolve('frontend/qa-output');
export const designSpecPath = path.resolve('qa/design-spec.json');
export const repairSafetyRulesPath = path.resolve('qa/repair-safety-rules.json');
export const rawAuditPath = path.join(outputDir, 'raw-route-audit.json');
export const supportedLanguages = ['de', 'en', 'en-US', 'sq', 'sq-XK', 'tr', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ar', 'ar-AE'];

let cachedQaHeaders = null;

export function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

export function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

export function writeJson(file, value) {
  ensureOutputDir();
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export function getQaBaseUrl() {
  return (process.env.QA_BASE_URL || '').trim();
}

function getCookieHeader(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).filter(Boolean);
    return cookies.length ? cookies.join('; ') : '';
  }
  const single = response.headers.get('set-cookie');
  return single ? single.split(',').map((chunk) => chunk.split(';')[0]).join('; ') : '';
}

async function getAdminCookieHeader() {
  const baseUrl = getQaBaseUrl();
  const email = (process.env.QA_ADMIN_EMAIL || '').trim();
  const password = (process.env.QA_ADMIN_PASSWORD || '').trim();
  if (!baseUrl || !email || !password) return null;
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Admin QA login failed: ${response.status} ${text}`);
  }
  const cookie = getCookieHeader(response);
  return cookie ? { Cookie: cookie } : null;
}

export async function getQaAuthHeaders(extraHeaders = {}) {
  if (!cachedQaHeaders) {
    const token = (process.env.VISUAL_QA_REPORT_TOKEN || '').trim();
    cachedQaHeaders = token
      ? { 'x-visual-qa-token': token }
      : ((await getAdminCookieHeader()) || {});
  }
  return { ...cachedQaHeaders, ...extraHeaders };
}

export async function postJson(url, body, extraHeaders = {}) {
  const headers = await getQaAuthHeaders({ 'Content-Type': 'application/json', ...extraHeaders });
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export function deriveVisualQaUrl(explicitUrl, suffix) {
  if (explicitUrl) return explicitUrl;
  const baseUrl = getQaBaseUrl();
  return baseUrl ? `${baseUrl}${suffix}` : '';
}
