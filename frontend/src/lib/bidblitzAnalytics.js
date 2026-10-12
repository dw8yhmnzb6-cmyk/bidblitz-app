/**
 * Shared BidBlitz analytics contract (opt-in, browser only).
 * Does NOT install a tracker or send anything until consent is explicitly true.
 * No PII, URLs with query strings, payment details or free-text payloads.
 */
export const ANALYTICS_EVENTS = Object.freeze([
  'page_view', 'cta_click', 'signup_started', 'signup_completed',
  'checkout_started', 'flow_abandoned',
]);
const EVENT_SET = new Set(ANALYTICS_EVENTS);
const PROJECT_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;
const LABEL_PATTERN = /^[a-z][a-z0-9_-]{0,59}$/;
const SAFE_ROUTE = /^\/(?:[a-z][a-z0-9_-]*\/?)*$/;
export function createBidBlitzAnalytics({ project, endpoint, hasConsent, allowedPaths, fetchImpl } = {}) {
  if (!PROJECT_PATTERN.test(project || '')) throw new Error('Invalid analytics project');
  if (typeof hasConsent !== 'function') throw new Error('Consent callback required');
  if (!Array.isArray(allowedPaths) || !allowedPaths.length ||
      !allowedPaths.every(p => typeof p === 'string' && SAFE_ROUTE.test(p))) {
    throw new Error('Trusted route allowlist required');
  }
  const routes = new Set(allowedPaths);
  const send = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!send) throw new Error('Fetch implementation required');
  // Relative first-party URL only: no data exfiltration to arbitrary origins.
  if (typeof endpoint !== 'string' || !/^\/[a-zA-Z0-9/_-]+$/.test(endpoint) || endpoint.startsWith('//')) {
    throw new Error('First-party analytics endpoint required');
  }
  return {
    async track(event, { path = '/', label } = {}) {
      if (!hasConsent() || !EVENT_SET.has(event)) return false;
      const cleanPath = typeof path === 'string' ? path.split(/[?#]/, 1)[0] : '/';
      // Fail closed: do not turn customer IDs, emails or unknown routes into analytics data.
      if (cleanPath.length > 160 || !SAFE_ROUTE.test(cleanPath) || !routes.has(cleanPath)) return false;
      const safePath = cleanPath;
      const payload = { project, event, path: safePath, timestamp: new Date().toISOString() };
      if (typeof label === 'string' && LABEL_PATTERN.test(label)) payload.label = label;
      try {
        const response = await send(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        return Boolean(response && response.ok);
      } catch {
        // Analytics must never break checkout, signup or navigation.
        return false;
      }
    },
  };
}
