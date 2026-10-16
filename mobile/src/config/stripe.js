const runtimeKey =
  (typeof process !== 'undefined' && process?.env?.STRIPE_PUBLISHABLE_KEY) ||
  (typeof global !== 'undefined' && global.__BIDBLITZ_STRIPE_PUBLISHABLE_KEY__) ||
  '';

export const STRIPE_PUBLISHABLE_KEY = String(runtimeKey || '').trim();

export const STRIPE_NATIVE_ENABLED =
  /^pk_(test|live)_[A-Za-z0-9]+$/.test(STRIPE_PUBLISHABLE_KEY) &&
  !STRIPE_PUBLISHABLE_KEY.includes('...');

// Native Stripe must receive a publishable key (pk_*), never the backend secret key.
// If no valid key is injected at build/runtime, the app falls back to the WebView
// wallet top-up flow instead of initializing Stripe with an invalid placeholder.
