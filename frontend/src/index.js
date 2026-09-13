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
const AUTO_UPDATE_RETRY_INTERVAL_MS = 5 * 1000;
const AUTO_UPDATE_DELAY_MS = 1500;
const RELOAD_LOOP_GUARD_MS = 60 * 1000;
const RELOAD_ATTEMPT_KEY = 'bidblitz-update-reload-attempt';
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
let autoUpdateTimer = null;

const formSnapshots = new WeakMap();
const dirtyForms = new Set();

const isTransactionPath = () =>
  TRANSACTION_PATH_PREFIXES.some((prefix) =>
    window.location.pathname.toLowerCase().startsWith(prefix)
  );

const serializeForm = (form) => {
  try {
    return JSON.stringify(
      Array.from(form.elements || []).map((element) => ({
        name: element.name || '',
        id: element.id || '',
        type: element.type || element.tagName || '',
        value: element.value ?? '',
        checked: typeof element.checked === 'boolean' ? element.checked : null,
      }))
    );
  } catch (error) {
    return '';
  }
};

const rememberFormSnapshot = (form) => {
  if (!form || formSnapshots.has(form)) return;
  formSnapshots.set(form, serializeForm(form));
};

const updateFormDirtyState = (form) => {
  if (!form) return;
  rememberFormSnapshot(form);
  if (serializeForm(form) !== formSnapshots.get(form)) {
    dirtyForms.add(form);
  } else {
    dirtyForms.delete(form);
  }
};

const hasUnsavedFormChanges = () => {
  for (const form of Array.from(dirtyForms)) {
    if (!form.isConnected) dirtyForms.delete(form);
  }
  return dirtyForms.size > 0;
};

const isActivelyEditing = () => {
  const element = document.activeElement;
  if (!element || typeof element.matches !== 'function') return false;
  return element.matches('input, textarea, select, [contenteditable="true"]');
};

const readReloadAttempt = () => {
  try {
    return JSON.parse(sessionStorage.getItem(RELOAD_ATTEMPT_KEY) || 'null');
  } catch (error) {
    return null;
  }
};

const clearCompletedReloadAttempt = () => {
  const attempt = readReloadAttempt();
  if (attempt?.to && WEB_BUILD_ID && attempt.to === WEB_BUILD_ID) {
    try {
      sessionStorage.removeItem(RELOAD_ATTEMPT_KEY);
    } catch (error) {
      void error;
    }
  }
};

clearCompletedReloadAttempt();

const hasRecentReloadAttempt = (buildId) => {
  const attempt = readReloadAttempt();
  return Boolean(
    attempt &&
      attempt.from === WEB_BUILD_ID &&
      attempt.to === buildId &&
      Number.isFinite(Number(attempt.at)) &&
      Date.now() - Number(attempt.at) < RELOAD_LOOP_GUARD_MS
  );
};

const canAutoApplyUpdate = () =>
  !isTransactionPath() &&
  !hasUnsavedFormChanges() &&
  !isActivelyEditing();

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

  const protectedState = !canAutoApplyUpdate();
  banner.textContent = protectedState
    ? 'Eine neue BidBlitz-Version ist verfügbar. Sie wird automatisch aktualisiert, sobald der aktuelle Vorgang sicher abgeschlossen ist.'
    : 'Eine neue BidBlitz-Version ist verfügbar. BidBlitz aktualisiert sich automatisch …';
};

const applyPendingUpdate = () => {
  if (!pendingBuildId) return;

  if (!canAutoApplyUpdate()) {
    renderUpdateBanner();
    return;
  }

  if (hasRecentReloadAttempt(pendingBuildId)) {
    renderUpdateBanner();
    return;
  }

  try {
    sessionStorage.setItem(
      RELOAD_ATTEMPT_KEY,
      JSON.stringify({
        from: WEB_BUILD_ID,
        to: pendingBuildId,
        at: Date.now(),
      })
    );
  } catch (error) {
    void error;
  }

  // The service worker serves navigations network-only with cache: no-store,
  // so a normal reload is enough to fetch the new index.html without clearing
  // cookies, localStorage, login/session data or customer settings.
  window.location.reload();
};

const scheduleAutomaticUpdate = () => {
  if (!pendingBuildId || autoUpdateTimer) return;
  autoUpdateTimer = window.setTimeout(() => {
    autoUpdateTimer = null;
    applyPendingUpdate();
  }, AUTO_UPDATE_DELAY_MS);
};

const markUpdateAvailable = (buildId) => {
  const normalized = String(buildId || 'new-build').trim();
  if (normalized && WEB_BUILD_ID && normalized === WEB_BUILD_ID) return;
  pendingBuildId = normalized || 'new-build';
  renderUpdateBanner();
  scheduleAutomaticUpdate();
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

document.addEventListener(
  'focusin',
  (event) => {
    const form = event.target?.form;
    if (form) rememberFormSnapshot(form);
  },
  true
);

document.addEventListener(
  'input',
  (event) => {
    const form = event.target?.form;
    if (form) updateFormDirtyState(form);
  },
  true
);

document.addEventListener(
  'change',
  (event) => {
    const form = event.target?.form;
    if (form) updateFormDirtyState(form);
  },
  true
);

document.addEventListener(
  'reset',
  (event) => {
    const form = event.target;
    if (!form) return;
    window.setTimeout(() => {
      formSnapshots.set(form, serializeForm(form));
      dirtyForms.delete(form);
      if (pendingBuildId) scheduleAutomaticUpdate();
    }, 0);
  },
  true
);

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
    if (pendingBuildId) scheduleAutomaticUpdate();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestServiceWorkerUpdate();
      checkForNewBuild();
      if (pendingBuildId) scheduleAutomaticUpdate();
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      requestServiceWorkerUpdate();
      checkForNewBuild({ force: true });
    }
    if (pendingBuildId) scheduleAutomaticUpdate();
  });

  window.setInterval(() => checkForNewBuild(), UPDATE_CHECK_INTERVAL_MS);
  window.setInterval(() => {
    if (pendingBuildId) applyPendingUpdate();
  }, AUTO_UPDATE_RETRY_INTERVAL_MS);
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
