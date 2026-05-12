/**
 * BidBlitz Staff — Offline Queue für Clock Events
 * ================================================
 * Speichert Buchungen lokal, wenn keine Verbindung besteht,
 * und synchronisiert beim nächsten Online-Status.
 */
const QUEUE_KEY = "staff_offline_queue_v1";
const API = process.env.REACT_APP_BACKEND_URL;

function _read() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function _write(arr) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
  } catch (e) {}
}

export function getDeviceInfo() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  let browser = "unknown";
  if (/Chrome/.test(ua)) browser = "Chrome";
  else if (/Safari/.test(ua)) browser = "Safari";
  else if (/Firefox/.test(ua)) browser = "Firefox";
  else if (/Edge/.test(ua)) browser = "Edge";
  const isMobile = /Mobi|Android|iPhone|iPad/.test(ua);
  return {
    device_type: isMobile ? "mobile" : "desktop",
    browser,
    platform,
    app_version: "1.0.0",
  };
}

export async function sendClockEvent(payload) {
  const enriched = { ...payload, ...getDeviceInfo() };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return queueLocally(enriched);
  }
  try {
    const res = await fetch(`${API}/api/staff/clock`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
    });
    if (!res.ok) throw new Error("Network error");
    return { ok: true, queued: false, response: await res.json() };
  } catch (e) {
    return queueLocally(enriched);
  }
}

function queueLocally(payload) {
  const queue = _read();
  queue.push({ ...payload, queued_at: new Date().toISOString() });
  _write(queue);
  return { ok: true, queued: true, queueLength: queue.length };
}

export function getQueueLength() {
  return _read().length;
}

export async function flushQueue() {
  let queue = _read();
  if (queue.length === 0) return { synced: 0 };
  const remaining = [];
  let synced = 0;
  for (const item of queue) {
    try {
      const res = await fetch(`${API}/api/staff/clock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok) synced++;
      else remaining.push(item);
    } catch (e) {
      remaining.push(item);
    }
  }
  _write(remaining);
  return { synced, remaining: remaining.length };
}

export function startOnlineSync(onChange) {
  if (typeof window === "undefined") return () => {};
  const handler = async () => {
    if (navigator.onLine) {
      const r = await flushQueue();
      if (onChange) onChange(r);
    }
  };
  window.addEventListener("online", handler);
  // Try once immediately
  handler();
  return () => window.removeEventListener("online", handler);
}
