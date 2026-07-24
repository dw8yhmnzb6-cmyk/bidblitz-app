import { KYC_DISABLED, isTestModeUser } from "../config/testMode";

export function isAdminUser(user = {}) {
  const role = String(user?.role || '').toLowerCase();
  const email = String(user?.email || '').toLowerCase().replace('@bid-blitz.', '@bidblitz.').replace('@bitblitz.', '@bidblitz.');
  const canonical = String(user?.canonical_email || '').toLowerCase().replace('@bid-blitz.', '@bidblitz.').replace('@bitblitz.', '@bidblitz.');
  const login = String(user?.login_email || user?.display_email || '').toLowerCase().replace('@bid-blitz.', '@bidblitz.').replace('@bitblitz.', '@bidblitz.');
  return role === 'admin' || email === 'admin@bidblitz.ae' || canonical === 'admin@bidblitz.ae' || login === 'admin@bidblitz.ae';
}

export function isKycApprovedOrAdmin(user = {}) {
  if (KYC_DISABLED || isTestModeUser(user)) return true;
  return isAdminUser(user) || user?.kyc_status === 'approved' || user?.kyc_verified === true;
}