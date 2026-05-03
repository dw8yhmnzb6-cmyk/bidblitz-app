/**
 * Capacitor deep-link + app-state handler.
 *
 * Responsibilities:
 *   - Subscribe to App.addListener('appUrlOpen') for universal/app-links.
 *   - Route Stripe return URLs (/pay/return?...) back into the SPA router.
 *   - Trigger a wallet/balance refresh after a successful Stripe checkout.
 *   - Re-check session on app resume (Capacitor 'resume' event).
 *
 * Safe to import in a pure web build: the Capacitor APIs no-op when not
 * running in a native container.
 */

let started = false;

export function initCapacitorBridge(handlers = {}) {
  if (started) return;
  started = true;

  const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
  if (!isNative) return;

  // Lazy-import so web bundle is unaffected
  import("@capacitor/app").then(({ App }) => {
    // Deep link handler
    App.addListener("appUrlOpen", (event) => {
      try {
        const url = new URL(event.url);
        const path = url.pathname + url.search + url.hash;

        // Route inside SPA
        if (handlers.onDeepLink) handlers.onDeepLink(path);

        // Stripe return detection
        if (url.pathname.startsWith("/pay/return")) {
          if (handlers.onPaymentReturn) handlers.onPaymentReturn(url.searchParams);
        }
      } catch { /* ignore malformed URLs */ }
    });

    // Resume → refresh session + balance
    App.addListener("resume", () => {
      if (handlers.onResume) handlers.onResume();
    });
  }).catch(() => { /* @capacitor/app missing → no-op */ });
}

export function isNativeApp() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}
