import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

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

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
