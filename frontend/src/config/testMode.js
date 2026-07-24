const isEnabled = (value) => String(value || '').trim().toLowerCase() === 'true';

export const TEST_MODE = isEnabled(process.env.REACT_APP_TEST_MODE);
export const KYC_DISABLED = TEST_MODE || isEnabled(process.env.REACT_APP_DISABLE_KYC);
export const SHOW_LIVE_CHECK_BANNER = isEnabled(process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER);

const TEST_MODE_USER_EMAILS = new Set([
  'reviewer@bidblitz.ae',
  'admin@bidblitz.ae',
]);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export const isTestModeUser = (user = {}) => {
  const emails = [
    normalizeEmail(user?.email),
    normalizeEmail(user?.login_email),
    normalizeEmail(user?.canonical_email),
    normalizeEmail(user?.display_email),
  ].filter(Boolean);
  return emails.some((email) => TEST_MODE_USER_EMAILS.has(email));
};
