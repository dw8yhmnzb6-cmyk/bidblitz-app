/** Legacy conversion API adapter. Consent-gated and field-allowlisted.
 * This keeps compatibility with backend/routes/analytics.py's TrackEvent schema.
 * Successful payments are reported authoritatively by the backend, not this browser tracker.
 */
import { getCookieConsent } from '../components/CookieBanner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const EVENTS = new Set(['guest_visit','guest_register_click','register_complete','first_payment','feature_click','demo_start','demo_exit','cta_click','page_view']);
const SAFE_TOKEN = /^[a-zA-Z0-9_-]{1,64}$/;
const allowedMeta = {
  guest_register_click: ['source'],
  register_complete: ['role'],
  first_payment: ['type'],
  feature_click: ['feature'],
  cta_click: ['cta','page'],
  page_view: ['page'],
};
function consented() {
  try { return getCookieConsent()?.analytics === true; } catch { return false; }
}
function sanitized(event, meta = {}) {
  const output = {};
  for (const key of allowedMeta[event] || []) {
    if (typeof meta?.[key] === 'string' && SAFE_TOKEN.test(meta[key])) output[key] = meta[key];
  }
  return output;
}
function fire(event, meta) {
  if (!consented() || !EVENTS.has(event)) return false;
  try {
    if (!API_URL || !/^https?:\/\//.test(API_URL)) return false;
    const body = JSON.stringify({ event, meta: sanitized(event, meta) });
    // Fetch instead of beacon so network failures don't throw into UI flows.
    fetch(`${API_URL.replace(/\/$/, '')}/api/analytics/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body, credentials: 'include', keepalive: true,
    }).catch(() => {});
    return true;
  } catch { return false; }
}
function once(event, meta, scope) {
  if (!consented()) return false; // No analytics storage before consent.
  try {
    const storage = scope === 'ever' ? localStorage : sessionStorage;
    const key = `bb_ev_${event}`;
    if (storage.getItem(key)) return false;
    if (!fire(event, meta)) return false;
    storage.setItem(key, '1');
    return true;
  } catch {
    return fire(event, meta);
  }
}
export const tracker = {
  guestVisit: () => once('guest_visit', {}, 'session'),
  guestRegisterClick: (source) => fire('guest_register_click', { source }),
  registerComplete: (role) => once('register_complete', { role }, 'ever'),
  // Kept for existing UI hooks; not an authoritative revenue event.
  firstPayment: (amount, type) => once('first_payment', { type }, 'ever'),
  featureClick: (feature) => fire('feature_click', { feature }),
  demoStart: () => fire('demo_start'),
  demoExit: () => fire('demo_exit'),
  ctaClick: (cta, page) => fire('cta_click', { cta, page }),
  pageView: (page) => fire('page_view', { page }),
};
