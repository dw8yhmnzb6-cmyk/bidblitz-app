/**
 * iosGuards.js — iOS App Store compliance helpers
 *
 * Apple App Review Guideline 3.1.1 ("In-App Purchase"):
 * Purchases of digital content / services consumed inside the app
 * MUST use Apple's IAP. External payment (Stripe) is only allowed
 * for physical goods / real-world services.
 *
 * Until IAP products are implemented, we hide purchase flows on iOS.
 *
 * Behaviour:
 *   - On iOS native build → hide feature, show compliance notice.
 *   - On Android or web → pass through unchanged.
 *
 * To re-enable (e.g. after IAP is shipped) set `window.__BB_FORCE_IAP_OPEN = true`
 * via admin toggle or remote config.
 */

export function isIOSNative() {
  if (typeof window === "undefined") return false;
  if (window.__BB_FORCE_IAP_OPEN) return false;
  try {
    return !!(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === "ios");
  } catch { return false; }
}

/**
 * Returns true if the given feature is BLOCKED on the current build.
 * Keep this list in sync with /app/deploy/BLOCKER_FIX_REPORT.md § Apple IAP Risk.
 */
export function isIOSBlocked(featureKey) {
  if (!isIOSNative()) return false;
  const BLOCKED = new Set([
    "wallet-topup",          // stored value — ambiguous → hide on iOS launch
    "pos-subscription",      // pure SaaS → IAP required
    "pos-feature-addon",     // in-app feature unlock → IAP required
    "premium-upgrade",       // ad-free / feature unlock → IAP required
    "creator-subscribe",     // creator digital subscription → IAP required
    "creator-tip",           // digital tip → IAP required
    "gaming-buy-coins",      // in-app token purchase → IAP required
    "blitzmine-boost-buy",   // paid in-app boost → IAP required
    "live-super-chat",       // digital creator tip → IAP required
  ]);
  return BLOCKED.has(featureKey);
}
