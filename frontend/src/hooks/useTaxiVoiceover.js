/**
 * useTaxiVoiceover — Speak driver/ride events out loud.
 * ------------------------------------------------------
 * Strategy:
 *   1. PRIMARY: browser Web Speech API (SpeechSynthesis) — works offline, no key.
 *   2. OPTIONAL: backend ElevenLabs proxy via /api/taxi/voiceover/announce
 *      (only used if the user explicitly enabled "premium voice" — needs ELEVENLABS_API_KEY in backend env).
 *
 * Auto-triggers on transitions:
 *   pending     → "Dein Taxi wird gesucht."
 *   accepted    → "Dein Taxi ist unterwegs, …"
 *   arriving    → "Dein Taxi kommt in 1 Minute."
 *   arrived     → "Dein Taxi ist eingetroffen!"
 *   in_progress → "Fahrt gestartet, gute Reise."
 *   completed   → "Fahrt beendet, Endpreis € X. Vielen Dank!"
 *
 * Preference persists in localStorage under "bidblitz_taxi_voice_enabled".
 */
import { useEffect, useRef, useState, useCallback } from "react";

const STORAGE_KEY = "bidblitz_taxi_voice_enabled";

function getDefaultEnabled() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {}
  return true; // default ON (user can disable in tracking sheet)
}

function pickGermanVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  // Prefer DE-DE female-sounding voices commonly available on macOS/Win/Android
  const preferred = ["Anna", "Petra", "Steffi", "Marlene", "Helena", "Google Deutsch", "Microsoft Katja", "Microsoft Hedda"];
  for (const name of preferred) {
    const v = voices.find((vv) => vv.name?.includes(name));
    if (v) return v;
  }
  return voices.find((v) => (v.lang || "").toLowerCase().startsWith("de")) || null;
}

export default function useTaxiVoiceover(activeRide) {
  const [enabled, setEnabledState] = useState(getDefaultEnabled);
  const lastStatusRef = useRef(null);
  const voiceRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    // Voices load async on some browsers
    const handler = () => { voiceRef.current = pickGermanVoice(); };
    handler();
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => { window.speechSynthesis.removeEventListener?.("voiceschanged", handler); };
  }, []);

  const setEnabled = useCallback((v) => {
    setEnabledState(!!v);
    try { localStorage.setItem(STORAGE_KEY, v ? "1" : "0"); } catch {}
    if (!v && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback((text) => {
    if (!enabled || !text) return;
    if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try {
      window.speechSynthesis.cancel(); // stop any prior utterance
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = "de-DE";
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = 1.0;
      if (voiceRef.current) u.voice = voiceRef.current;
      window.speechSynthesis.speak(u);
    } catch (e) {
      // best-effort; never throw
      console.warn("Voiceover failed", e);
    }
  }, [enabled]);

  // Auto-announce on status transitions
  useEffect(() => {
    if (!activeRide || !activeRide.status) {
      lastStatusRef.current = null;
      return;
    }
    const prev = lastStatusRef.current;
    const cur = activeRide.status;
    if (prev === cur) return;
    lastStatusRef.current = cur;
    if (!enabled) return;

    const drv = activeRide.driver_name || "dein Fahrer";
    const plate = activeRide.driver_vehicle_plate || activeRide.driver_plate || "";
    const eta = activeRide.eta_minutes || activeRide.eta || "";
    const price = activeRide.final_fare || activeRide.fare_total || activeRide.fare_estimate || 0;

    const lines = {
      pending: "Wir suchen ein Taxi für dich.",
      accepted: `Dein Taxi ist unterwegs. Fahrer ${drv}${plate ? `, Kennzeichen ${spellPlate(plate)}` : ""}${eta ? `. Ankunft in etwa ${eta} Minuten` : ""}.`,
      arriving: `Dein Taxi ist gleich da, in etwa einer Minute.`,
      arrived: "Dein Taxi ist eingetroffen. Bitte komm zum Treffpunkt.",
      in_progress: "Fahrt gestartet. Gute Reise!",
      completed: `Fahrt beendet. Endpreis ${formatPrice(price)} Euro. Vielen Dank für deine Fahrt!`,
      cancelled: "Die Fahrt wurde abgebrochen.",
    };
    const text = lines[cur];
    if (text) speak(text);
  }, [activeRide?.status, activeRide?.driver_name, activeRide?.driver_vehicle_plate, activeRide?.eta_minutes, activeRide?.final_fare, enabled, speak]);

  return { enabled, setEnabled, speak };
}

function formatPrice(n) {
  if (!n) return "0";
  return Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Spell plate "K-AB-1234" letter by letter for clarity
function spellPlate(p) {
  return String(p).split("").map((c) => /[A-Z]/i.test(c) ? c.toUpperCase() : c).join(" ");
}
