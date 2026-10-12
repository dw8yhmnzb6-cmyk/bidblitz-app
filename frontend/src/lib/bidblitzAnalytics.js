/**
 * Shared BidBlitz analytics contract (opt-in, browser only).
 * Does NOT install a tracker or send anything until consent is explicitly true.
 * No PII, URLs with query strings, payment details or free-text payloads.
 */
export const ANALYTICS_EVENTS = Object.freeze([
  'page_view', 'cta_click', 'signup_started', 'signup_completed',
  'checkout_started', 'checkout_completed', 'flow_abandoned',
]);
const EVENT_SET = new Set(ANALYTICS_EVENTS);
const PROJECT_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;
const LABEL_PATTERN = /^[a-zA-Z0-9_-]{1,60}$/;
export function createBidBlitzAnalytics({ project, endpoint, hasConsent, fetchImpl } = {}) {
  if (!PROJECT_PATTERN.test(project || '')) throw new Error('Invalid analytics project');
  if (typeof hasConsent !== 'function') throw new Error('Consent callback required');
  const send = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!send) throw new Error('Fetch implementation required');
  // Relative first-party URL only: no data exfiltration to arbitrary origins.
  if (typeof endpoint !== 'string' || !/^\/[a-zA-Z0-9/_-]+$/.test(endpoint) || endpoint.startsWith('//')) {
    throw new Error('First-party analytics endpoint required');
  }
  return {
    async track(event, { path = '/', label } = {}) {
      if (!hasConsent() || !EVENT_SET.has(event)) return false;
      const safePath = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
        ? path.split(/[?#]/, 1)[0].slice(0, 160).replace(/[^a-zA-Z0-9/_-]/g, '_')
        : '/';
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
