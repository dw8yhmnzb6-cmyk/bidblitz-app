const fs = require('fs');
const path = require('path');
const { request } = require('@playwright/test');

const OUTPUT_DIR = path.join(__dirname, '../../qa-output');
const AUTH_DIR = path.join(__dirname, '.auth');

async function saveState(name, baseURL, endpoint, payload) {
  const context = await request.newContext({ baseURL, extraHTTPHeaders: { 'Content-Type': 'application/json' } });
  try {
    if (payload) {
      const response = await context.post(endpoint, { data: payload });
      if (!response.ok()) {
        const text = await response.text().catch(() => '');
        throw new Error(`Could not create storage state for ${name}: ${response.status()} ${text}`);
      }
    }
    await context.storageState({ path: path.join(AUTH_DIR, `${name}.json`) });
  } finally {
    await context.dispose();
  }
}

module.exports = async (config) => {
  const baseURL = config.projects?.[0]?.use?.baseURL || process.env.QA_BASE_URL || 'http://127.0.0.1:3000';
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const credentials = {
    user: process.env.QA_USER_EMAIL && process.env.QA_USER_PASSWORD ? { email: process.env.QA_USER_EMAIL, password: process.env.QA_USER_PASSWORD } : null,
    merchant: process.env.QA_MERCHANT_EMAIL && process.env.QA_MERCHANT_PASSWORD ? { email: process.env.QA_MERCHANT_EMAIL, password: process.env.QA_MERCHANT_PASSWORD } : null,
    admin: process.env.QA_ADMIN_EMAIL && process.env.QA_ADMIN_PASSWORD ? { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD } : null,
    investor: process.env.QA_INVESTOR_EMAIL && process.env.QA_INVESTOR_PASSWORD ? { email: process.env.QA_INVESTOR_EMAIL, password: process.env.QA_INVESTOR_PASSWORD } : null,
  };

  await saveState('guest', baseURL, null, null);
  if (credentials.user) await saveState('user', baseURL, '/api/auth/login', credentials.user);
  if (credentials.merchant) await saveState('merchant', baseURL, '/api/auth/login', credentials.merchant);
  if (credentials.admin) await saveState('admin', baseURL, '/api/auth/login', credentials.admin);
  if (credentials.investor) await saveState('investor', baseURL, '/api/investor-portal/auth/login', credentials.investor);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'qa-credentials-status.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    roles: Object.fromEntries(Object.entries(credentials).map(([role, value]) => [role, !!value])),
    baseURL,
  }, null, 2));
};