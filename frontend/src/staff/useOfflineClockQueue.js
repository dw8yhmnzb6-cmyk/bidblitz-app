/**
 * useOfflineClockQueue — Manages offline clock events with localStorage persistence.
 *
 * Flow:
 *   1. UI calls `enqueueClockEvent({action, lat, lng, ...})` instead of direct POST when offline.
 *   2. Events are buffered in localStorage under STORAGE_KEY.
 *   3. Hook auto-syncs when navigator.onLine becomes true (and on mount).
 *   4. Returns queue length + status for badge display.
 *
 * Idempotency: each event gets a UUID `client_event_id` so retries are safe.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = "staff_offline_clock_queue";
const SYNC_DEBOUNCE_MS = 1500;

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

export function enqueueClockEvent(payload) {
  const queue = readQueue();
  const enriched = {
    client_event_id: payload.client_event_id || uuid(),
    captured_at: payload.captured_at || new Date().toISOString(),
    action: payload.action,
    lat: payload.lat,
    lng: payload.lng,
    accuracy_m: payload.accuracy_m,
    note: payload.note || null,
    customer: payload.customer || null,
    equipment: payload.equipment || null,
    kilometers: payload.kilometers || null,
    project: payload.project || null,
    photo_url: payload.photo_url || null,
    geofence_id: payload.geofence_id || null,
    source: "offline_sync",
    device_type: navigator?.userAgent || null,
    platform: navigator?.platform || null,
    app_version: window?.__BIDBLITZ_VERSION__ || null,
  };
  queue.push(enriched);
  writeQueue(queue);
  return enriched;
}

async function flushQueue() {
  const queue = readQueue();
  if (queue.length === 0) return { synced: 0, total: 0 };
  try {
    const r = await fetch(`${API}/api/staff/clock/sync`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: queue }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.success) {
      const syncedIds = new Set((data.results || []).filter((x) => x.status === "synced" || x.status === "duplicate").map((x) => x.client_event_id));
      const remaining = queue.filter((e) => !syncedIds.has(e.client_event_id));
      writeQueue(remaining);
      return { synced: data.synced, duplicates: data.duplicates, total: data.total };
    }
    throw new Error("Sync fehlgeschlagen");
  } catch (e) {
    return { error: e?.message || "Sync fehlgeschlagen" };
  }
}

export function useOfflineClockQueue({ enabled = true } = {}) {
  const [queueLength, setQueueLength] = useState(() => readQueue().length);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const syncTimerRef = useRef(null);

  const refreshLen = useCallback(() => setQueueLength(readQueue().length), []);

  const sync = useCallback(async (opts = { silent: false }) => {
    if (syncing) return;
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const r = await flushQueue();
      refreshLen();
      if (r?.synced > 0 && !opts.silent) {
        toast.success(`${r.synced} Buchung${r.synced === 1 ? "" : "en"} synchronisiert`);
      }
      if (r?.error && !opts.silent) {
        toast.error(r.error);
      }
      setLastSyncAt(new Date().toISOString());
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshLen]);

  // Debounced sync wrapper for autotriggers
  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => sync({ silent: true }), SYNC_DEBOUNCE_MS);
  }, [sync]);

  useEffect(() => {
    if (!enabled) return;
    refreshLen();

    const handleOnline = () => { setOnline(true); scheduleSync(); };
    const handleOffline = () => setOnline(false);
    const handleStorage = (e) => { if (e.key === STORAGE_KEY) refreshLen(); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);

    // Periodic background sync every 60s when online
    const interval = setInterval(() => {
      if (navigator.onLine && readQueue().length > 0) sync({ silent: true });
    }, 60_000);

    // Initial sync on mount if there's anything pending
    if (navigator.onLine && readQueue().length > 0) scheduleSync();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [enabled, refreshLen, scheduleSync, sync]);

  return {
    queueLength,
    online,
    syncing,
    lastSyncAt,
    enqueue: (p) => { const ev = enqueueClockEvent(p); refreshLen(); scheduleSync(); return ev; },
    sync: () => sync({ silent: false }),
    peekQueue: () => readQueue(),
  };
}

export default useOfflineClockQueue;
