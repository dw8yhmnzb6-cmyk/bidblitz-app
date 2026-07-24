/**
 * useStaffReminders — pollt /api/staff/reminders/check und triggert
 * In-App Toasts via sonner. Optional: dispatcht Push wenn aktiv.
 *
 * Verhindert doppelte Toasts pro Reminder-ID via localStorage (per Tag).
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60000;

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function shownStore() {
  try {
    const raw = localStorage.getItem("bidblitz_reminders_shown");
    if (!raw) return {};
    const j = JSON.parse(raw);
    if (j._day !== dayKey()) return { _day: dayKey() };
    return j;
  } catch {
    return { _day: dayKey() };
  }
}

function persistShown(map) {
  try {
    map._day = dayKey();
    localStorage.setItem("bidblitz_reminders_shown", JSON.stringify(map));
  } catch {}
}

export function useStaffReminders({ enabled = true, onArrival } = {}) {
  const lastShown = useRef(shownStore());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const r = await fetch(`${API}/api/staff/reminders/check`, { credentials: "include" });
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        const reminders = d.reminders || [];
        const seen = lastShown.current;
        for (const rem of reminders) {
          if (seen[rem.id]) continue;
          seen[rem.id] = Date.now();
          // arrival reminders can trigger callback (open arrival modal)
          if (rem.id.startsWith("arrival_no_checkin") && onArrival) {
            try { onArrival(rem); } catch {}
            continue;
          }
          const fn = rem.severity === "warning" ? toast.warning : toast.info;
          fn(rem.title, {
            description: rem.body,
            duration: 8000,
          });
          // Best-effort: dispatch push if enabled (idempotent server-side)
          fetch(`${API}/api/staff/reminders/dispatch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ reminder_ids: [rem.id] }),
          }).catch(() => {});
        }
        persistShown(seen);
      } catch {}
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [enabled, onArrival]);
}

export default useStaffReminders;
