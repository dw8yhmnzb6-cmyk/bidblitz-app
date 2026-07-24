const isEnabled = (value) => String(value || '').trim().toLowerCase() === 'true';
const isExplicitFalse = (value) => String(value || '').trim().toLowerCase() === 'false';

export const TEST_MODE = isEnabled(process.env.REACT_APP_TEST_MODE);
export const TEST_MODE_FULL_ACCESS =
  TEST_MODE ||
  isEnabled(process.env.REACT_APP_TEST_MODE_FULL_ACCESS) ||
  isEnabled(process.env.REACT_APP_DISABLE_KYC);
export const KYC_ENABLED = !TEST_MODE_FULL_ACCESS && !isExplicitFalse(process.env.REACT_APP_KYC_ENABLED);
export const KYC_REQUIRED = KYC_ENABLED && !isExplicitFalse(process.env.REACT_APP_KYC_REQUIRED);
export const SHOW_KYC_GATE = KYC_ENABLED && KYC_REQUIRED && !isExplicitFalse(process.env.REACT_APP_SHOW_KYC_GATE);
export const KYC_DISABLED = !KYC_ENABLED || !KYC_REQUIRED || TEST_MODE_FULL_ACCESS;
export const SHOW_LIVE_CHECK_BANNER = !TEST_MODE_FULL_ACCESS && isEnabled(process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER);

const TEST_MODE_USER_EMAILS = new Set([
  'reviewer@bidblitz.ae',
  'admin@bidblitz.ae',
]);

const normalizeEmail = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace('@bid-blitz.', '@bidblitz.')
  .replace('@bitblitz.', '@bidblitz.');

export const isTestModeUser = (user = {}) => {
  const emails = [
    normalizeEmail(user?.email),
    normalizeEmail(user?.login_email),
    normalizeEmail(user?.canonical_email),
    normalizeEmail(user?.display_email),
  ].filter(Boolean);
  return emails.some((email) => TEST_MODE_USER_EMAILS.has(email));
};
