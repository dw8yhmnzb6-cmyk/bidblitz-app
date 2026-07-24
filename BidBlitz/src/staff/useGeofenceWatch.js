/**
 * useGeofenceWatch — Background-Hook für Mobile Mitarbeiter-App.
 *
 * Sendet GPS + WLAN-SSID + Bluetooth-Beacons an Backend.
 * Wenn Backend `auto_checkin_suggested=true` returnt → triggert onSuggestCheckin.
 *
 * Multi-Signal: Stronger Signals (WiFi/BT exact match) erlauben Check-In
 * auch wenn GPS unscharf ist.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useSmartSignals } from "./useSmartSignals";

const API = process.env.REACT_APP_BACKEND_URL;
const DEFAULT_INTERVAL_MS = 30000; // 30s
const HIGH_ACCURACY_TIMEOUT = 8000;

export function useGeofenceWatch({ enabled = true, intervalMs = DEFAULT_INTERVAL_MS, onSuggestCheckin, isWorking = false } = {}) {
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [permission, setPermission] = useState("prompt");
  const lastSuggestedId = useRef(null);
  const { wifiSsid, getBeacons } = useSmartSignals({ enabled });

  const checkOnce = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("Geolocation nicht unterstützt");
      return;
    }
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: HIGH_ACCURACY_TIMEOUT,
          maximumAge: 10000,
        });
      });
      setPermission("granted");

      const body = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
        wifi_ssid: wifiSsid || undefined,
        bluetooth_beacons: getBeacons(),
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(`${API}/api/staff/geofence/check-presence`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(`Backend: ${res.status}`);
        return;
      }
      const data = await res.json();
      setLastResult(data);

      if (data.auto_checkin_suggested && data.inside_fence && !isWorking) {
        const fenceId = data.inside_fence.id;
        if (lastSuggestedId.current !== fenceId) {
          lastSuggestedId.current = fenceId;
          onSuggestCheckin?.({
            fence: data.inside_fence,
            position: { lat: body.lat, lng: body.lng, accuracy_m: body.accuracy_m },
            match_source: data.match_source,
          });
        }
      }
    } catch (e) {
      if (e?.code === 1) setPermission("denied");
      setError(e?.message || "Standortfehler");
    }
  }, [onSuggestCheckin, isWorking, wifiSsid, getBeacons]);

  useEffect(() => {
    if (!enabled) return;
    checkOnce();
    const id = setInterval(checkOnce, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, checkOnce]);

  return { lastResult, error, permission, refresh: checkOnce };
}

/** Auto-check-in confirm helper */
export async function confirmGeofenceCheckin({ geofence_id, lat, lng, accuracy_m, confirmed = true }) {
  const res = await fetch(`${API}/api/staff/geofence/auto-checkin`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geofence_id, lat, lng, accuracy_m, confirmed }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || "Check-in fehlgeschlagen");
  return data;
}
