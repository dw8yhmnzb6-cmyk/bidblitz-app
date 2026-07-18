import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { initCapacitorBridge, isNativeApp } from "@/services/capacitorBridge";
import { purgeLegacyAuthStorage } from "@/services/authService";

// ═══════════════════════════════════════════════════
// PWA SERVICE WORKER — DISABLED GLOBALLY
// (Was causing stale-cache issues on mobile. Also required
// off for Capacitor native builds per Capacitor guidance.)
// ═══════════════════════════════════════════════════
purgeLegacyAuthStorage();

if ('serviceWorker' in navigator) {
  // FORCE UNREGISTER ALL SERVICE WORKERS TO FIX CACHE ISSUE
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('SW unregistered:', registration.scope);
    }
  });
  
  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) {
        caches.delete(name);
        console.log('Cache deleted:', name);
      }
    });
  }
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

// Emergency: Unregister service worker and clear ALL caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

if ('caches' in window) {
  caches.keys().then(keys => {
    keys.forEach(key => caches.delete(key));
  });
}

// Clear IndexedDB
if ('indexedDB' in window) {
  indexedDB.databases().then(dbs => {
    dbs.forEach(db => {
      if (db.name && (db.name.includes('bidblitz') || db.name.includes('auction'))) {
        indexedDB.deleteDatabase(db.name);
      }
    });
  }).catch(() => {});
}

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
