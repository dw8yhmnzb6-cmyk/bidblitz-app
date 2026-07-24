/**
 * BidBlitz Conversion Tracker
 * Lightweight event tracking — fires and forgets.
 */
const API_URL = process.env.REACT_APP_BACKEND_URL;

function getSessionId() {
  let sid = sessionStorage.getItem("bb_sid");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("bb_sid", sid);
  }
  return sid;
}

function fire(event, meta) {
  try {
    const body = JSON.stringify({
      event,
      session_id: getSessionId(),
      meta: meta || {},
    });
    // Use sendBeacon for reliability, fallback to fetch
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${API_URL}/api/analytics/track`, blob);
    } else {
      fetch(`${API_URL}/api/analytics/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "include",
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silent fail — tracking should never break UX
  }
}

/** Track once per session for a given key */
function fireOnce(event, meta) {
  const key = `bb_ev_${event}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  fire(event, meta);
}

/** Track once ever (localStorage) for a given key */
function fireOnceEver(event, meta) {
  const key = `bb_ev_${event}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    // Fallback to session
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  }
  fire(event, meta);
}

export const tracker = {
  /** Guest landed on homepage (once per session) */
  guestVisit: () => fireOnce("guest_visit"),

  /** Guest clicked register (every time) */
  guestRegisterClick: (source) => fire("guest_register_click", { source }),

  /** Registration completed (once ever) */
  registerComplete: (role) => fireOnceEver("register_complete", { role }),

  /** First payment made (once ever) */
  firstPayment: (amount, type) => fireOnceEver("first_payment", { amount, type }),

  /** Feature/product card clicked */
  featureClick: (feature) => fire("feature_click", { feature }),

  /** Demo mode started */
  demoStart: () => fire("demo_start"),

  /** Demo mode exited */
  demoExit: () => fire("demo_exit"),

  /** CTA button clicked */
  ctaClick: (cta, page) => fire("cta_click", { cta, page }),

  /** Page viewed */
  pageView: (page) => fire("page_view", { page }),
};
