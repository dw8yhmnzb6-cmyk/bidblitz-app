export const TEST_MODE = String(process.env.TEST_MODE).toLowerCase() === 'true';

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
