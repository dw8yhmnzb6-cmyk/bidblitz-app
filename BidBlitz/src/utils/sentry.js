/**
 * Sentry Init Wrapper — only initializes if user consented (cookie banner)
 * AND if REACT_APP_SENTRY_DSN is configured.
 */
import { getCookieConsent } from '../components/CookieBanner';

let sentryInitialized = false;

export async function initSentryIfConsented() {
  if (sentryInitialized) return;

  const consent = getCookieConsent();
  if (!consent || !consent.crash) return;

  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) {
    console.debug('[Sentry] REACT_APP_SENTRY_DSN not set, skipping init.');
    return;
  }

  try {
    const Sentry = await import(/* webpackChunkName: "sentry" */ '@sentry/react');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      release: process.env.REACT_APP_VERSION || 'bidblitz@dev',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event) {
        // Strip PII from error events
        if (event.request?.cookies) delete event.request.cookies;
        if (event.user?.email) event.user.email = '[redacted]';
        return event;
      },
    });
    sentryInitialized = true;
    console.info('[Sentry] Initialized');
  } catch (e) {
    console.warn('[Sentry] Failed to load:', e.message);
  }
}

// Re-init when consent changes
if (typeof window !== 'undefined') {
  window.addEventListener('cookie-consent-changed', () => {
    if (!sentryInitialized) initSentryIfConsented();
  });
}
