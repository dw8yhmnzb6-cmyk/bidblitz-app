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

if ('serviceWorker' in navigator && !isNativeApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
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
