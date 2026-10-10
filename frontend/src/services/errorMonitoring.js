import * as Sentry from "@sentry/react";

/**
 * Opt-in frontend error reporting. No events are transmitted without a DSN.
 * Privacy-first defaults: no replay, traces, user identities or breadcrumbs.
 * Do not add payment/session data to Sentry events.
 */
export const initializeErrorMonitoring = () => {
  const dsn = (process.env.REACT_APP_SENTRY_DSN || "").trim();
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.REACT_APP_BUILD_ID || undefined,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Never forward request metadata, user identification, or browser context.
      delete event.user;
      delete event.request;
      delete event.breadcrumbs;
      if (event.contexts) {
        delete event.contexts;
      }
      return event;
    },
  });
  return true;
};
