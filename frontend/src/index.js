import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { initCapacitorBridge, isNativeApp } from "@/services/capacitorBridge";
import { purgeLegacyAuthStorage } from "@/services/authService";

const purgeLegacyWidgetStorage = () => {
  const legacyKeys = [
    "bb_ai_chat_session",
    "bidblitz-chatbot-hidden",
  ];
  try {
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    void error;
  }
};

purgeLegacyAuthStorage();
purgeLegacyWidgetStorage();

if (
  [
    process.env.REACT_APP_TEST_MODE,
    process.env.REACT_APP_TEST_MODE_FULL_ACCESS,
    process.env.REACT_APP_DISABLE_KYC,
  ].some((value) => String(value || '').toLowerCase() === 'true')
) {
  document.documentElement.classList.add('test-mode-active');
  document.body?.classList.add('test-mode-active');
}

const WEB_BUILD_ID = String(process.env.REACT_APP_BUILD_ID || '').trim();
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_RECHECK_COOLDOWN_MS = 30 * 1000;
const TRANSACTION_PATH_PREFIXES = [
  '/checkout',
  '/payment',
  '/payments',
  '/stripe',
  '/topup',
  '/refund',
  '/pay',
  '/bidblitz-pay',
];

let pendingBuildId = null;
let lastUpdateCheckAt = 0;
let serviceWorkerRegistration = null;

const isTransactionPath = () =>
  TRANSACTION_PATH_PREFIXES.some((prefix) =>
    window.location.pathname.toLowerCase().startsWith(prefix)
  );

const renderUpdateBanner = () => {
  if (!pendingBuildId) return;

  let banner = document.getElementById('bidblitz-update-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'bidblitz-update-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    Object.assign(banner.style, {
      position: 'fixed',
      left: '16px',
      right: '16px',
      bottom: '16px',
      zIndex: '2147483647',
      maxWidth: '680px',
      margin: '0 auto',
      padding: '14px 16px',
      borderRadius: '14px',
      background: '#101827',
      color: '#ffffff',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '14px',
    });
    document.body.appendChild(banner);
  }

  const protectedRoute = isTransactionPath();
  banner.innerHTML = '';

  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  });

  const message = document.createElement('span');
  message.textContent = protectedRoute
    ? 'Eine neue BidBlitz-Version ist verfügbar. Die Aktualisierung wird während der Zahlung nicht erzwungen.'
    : 'Eine neue BidBlitz-Version ist verfügbar.';
  row.appendChild(message);

  if (!protectedRoute) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Jetzt aktualisieren';
    Object.assign(button.style, {
      border: '0',
      borderRadius: '10px',
      padding: '9px 14px',
      background: '#00C2FF',
      color: '#06121d',
      fontWeight: '700',
      cursor: 'pointer',
    });
    button.addEventListener('click', () => {
      // Re-check at click time in case the SPA moved into a payment flow after
      // the banner was rendered. Never force a reload during a transaction.
      if (isTransactionPath()) {
        renderUpdateBanner();
        return;
      }
      window.location.reload();
    });
    row.appendChild(button);
  }

  banner.appendChild(row);
};

const markUpdateAvailable = (buildId) => {
  const normalized = String(buildId || 'new-build').trim();
  if (normalized && WEB_BUILD_ID && normalized === WEB_BUILD_ID) return;
  pendingBuildId = normalized || 'new-build';
  renderUpdateBanner();
};

const checkForNewBuild = async ({ force = false } = {}) => {
  if (!WEB_BUILD_ID || isNativeApp()) return;
  if (!force && document.visibilityState === 'hidden') return;

  const now = Date.now();
  if (!force && now - lastUpdateCheckAt < UPDATE_RECHECK_COOLDOWN_MS) return;
  lastUpdateCheckAt = now;

  try {
    const response = await fetch(`/version.json?__bbv=${now}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return;
    const version = await response.json();
    const latestBuildId = String(version?.build_id || version?.frontend_version || '').trim();
    if (latestBuildId && latestBuildId !== WEB_BUILD_ID) {
      markUpdateAvailable(latestBuildId);
    }
  } catch (error) {
    // Update checks must never block app startup or payments.
    void error;
  }
};

const requestServiceWorkerUpdate = () => {
  if (!serviceWorkerRegistration) return;
  serviceWorkerRegistration.update().catch(() => {});
};

if (
  process.env.NODE_ENV === 'production' &&
  'serviceWorker' in navigator &&
  !isNativeApp()
) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      markUpdateAvailable(event.data.buildId);
    }
  });

  window.addEventListener('load', () => {
    const swVersion = encodeURIComponent(WEB_BUILD_ID || 'unversioned');
    navigator.serviceWorker
      .register(`/service-worker.js?v=${swVersion}`, { updateViaCache: 'none' })
      .then((registration) => {
        serviceWorkerRegistration = registration;
        requestServiceWorkerUpdate();
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });

    window.setTimeout(() => checkForNewBuild({ force: true }), 1200);
  });

  window.addEventListener('focus', () => {
    requestServiceWorkerUpdate();
    checkForNewBuild();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestServiceWorkerUpdate();
      checkForNewBuild();
      if (pendingBuildId) renderUpdateBanner();
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      requestServiceWorkerUpdate();
      checkForNewBuild({ force: true });
    }
  });

  window.setInterval(() => checkForNewBuild(), UPDATE_CHECK_INTERVAL_MS);
}

// Block any auto-injected testing overlays/panels from platform scripts
const killTestingOverlays = () => {
  const selectors = [
    '[class*="testing-agent"]', '[id*="testing-agent"]',
    '[class*="TestingAgent"]', '[id*="TestingAgent"]',
    '[class*="test-panel"]', '[id*="test-panel"]',
    '[class*="test-runner"]', '[id*="test-runner"]',
    '[class*="agent-panel"]', '[id*="agent-panel"]',
    '[class*="agent-overlay"]', '[id*="agent-overlay"]',
    '[data-testing]', '[data-test-panel]', '[data-agent]',
    '[class*="emergent"]', '[id*="emergent"]',
    'iframe[src*="emergent"]', 'script[src*="emergent-main.js"]',
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    });
  });
};

// Run on load and watch for dynamically injected elements
killTestingOverlays();
const observer = new MutationObserver(killTestingOverlays);
observer.observe(document.body, { childList: true, subtree: true });

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <App />
);

// ═══════════════════════════════════════════════════
// Capacitor native bridge (no-op on web)
// ═══════════════════════════════════════════════════
initCapacitorBridge({
  onDeepLink: (path) => {
    try { window.history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); } catch (error) { void error; }
  },
  onPaymentReturn: (params) => {
    // Refresh balance once the user returns from Stripe checkout
    try { window.dispatchEvent(new CustomEvent("bidblitz:refresh-wallet", { detail: Object.fromEntries(params) })); } catch (error) { void error; }
  },
  onResume: () => {
    try { window.dispatchEvent(new CustomEvent("bidblitz:app-resume")); } catch (error) { void error; }
  },
});

// Tag body for native-only CSS tweaks
if (isNativeApp()) {
  document.documentElement.classList.add("capacitor-native");
}
