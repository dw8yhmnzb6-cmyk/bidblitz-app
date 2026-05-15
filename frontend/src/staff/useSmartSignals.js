/**
 * useSmartSignals — erkennt WLAN-SSID und Bluetooth-Beacons.
 *
 * Native (Capacitor 7):
 *   - WiFi via @capgo/capacitor-wifi → CapacitorWifi.getCurrentNetwork()
 *   - Bluetooth LE via @capacitor-community/bluetooth-le → BleClient.requestLEScan()
 * Web:
 *   - WLAN SSID nicht abrufbar (Browser-Sicherheit) → manueller Override via localStorage
 *   - Bluetooth: navigator.bluetooth.requestDevice() (User-Geste erforderlich)
 *
 * Capacitor-Detection: Plugins werden lazy importiert und nur auf "native" Platform
 * ausgeführt, sonst graceful Fallback.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

const SSID_OVERRIDE_KEY = "staff_wifi_ssid_override";
const isNative = () => {
  try { return Capacitor.isNativePlatform?.() === true; } catch { return false; }
};

function readOverride() {
  try { return localStorage.getItem(SSID_OVERRIDE_KEY) || null; } catch { return null; }
}

export function writeWifiOverride(ssid) {
  try {
    if (ssid) localStorage.setItem(SSID_OVERRIDE_KEY, ssid);
    else localStorage.removeItem(SSID_OVERRIDE_KEY);
  } catch {}
}

// Lazy plugin loaders — only resolve on native, return null on web
async function loadWifiPlugin() {
  if (!isNative()) return null;
  try {
    const mod = await import("@capgo/capacitor-wifi");
    return mod.CapacitorWifi || null;
  } catch {
    return null;
  }
}

async function loadBlePlugin() {
  if (!isNative()) return null;
  try {
    const mod = await import("@capacitor-community/bluetooth-le");
    return mod.BleClient || null;
  } catch {
    return null;
  }
}

export function useSmartSignals({ enabled = true, intervalMs = 60000 } = {}) {
  const [wifiSsid, setWifiSsid] = useState(readOverride());
  const [bluetoothBeacons, setBluetoothBeacons] = useState([]);
  const [capabilities, setCapabilities] = useState({
    nativeWifi: false,
    nativeBluetooth: false,
    webBluetooth: typeof navigator !== "undefined" && !!navigator.bluetooth,
    platform: isNative() ? "native" : "web",
  });
  const cacheRef = useRef({ beacons: [], ts: 0 });
  const bleInitRef = useRef(false);

  // Detect capabilities once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wifi = await loadWifiPlugin();
      const ble = await loadBlePlugin();
      if (!cancelled) {
        setCapabilities((c) => ({
          ...c,
          nativeWifi: !!wifi,
          nativeBluetooth: !!ble,
        }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Poll Wifi — native only; web uses localStorage override
  const refreshWifi = useCallback(async () => {
    const override = readOverride();
    if (override) {
      setWifiSsid(override);
      return override;
    }
    if (!isNative()) return null;
    try {
      const Wifi = await loadWifiPlugin();
      if (!Wifi) return null;
      // @capgo/capacitor-wifi 7.x — getCurrentNetwork()
      if (Wifi.getCurrentNetwork) {
        const res = await Wifi.getCurrentNetwork();
        const ssid = res?.ssid || res?.SSID || null;
        setWifiSsid(ssid);
        return ssid;
      }
      if (Wifi.getSSID) {
        const res = await Wifi.getSSID();
        const ssid = res?.ssid || null;
        setWifiSsid(ssid);
        return ssid;
      }
    } catch {}
    return null;
  }, []);

  // Beacons cache valid for ~5min
  const getBeacons = useCallback(() => {
    if (Date.now() - cacheRef.current.ts < 5 * 60 * 1000) {
      return cacheRef.current.beacons;
    }
    return [];
  }, []);

  // Bluetooth scan — must be triggered by user gesture
  const scanBluetoothOnce = useCallback(async () => {
    try {
      if (isNative()) {
        const BleClient = await loadBlePlugin();
        if (!BleClient) throw new Error("Bluetooth-Plugin nicht verfügbar");
        if (!bleInitRef.current) {
          await BleClient.initialize({ androidNeverForLocation: true });
          bleInitRef.current = true;
        }
        const found = [];
        await BleClient.requestLEScan(
          { allowDuplicates: false },
          (result) => {
            if (result?.device) {
              found.push({
                id: result.device.deviceId,
                name: result.device.name || result.localName,
                rssi: result.rssi,
              });
            }
          },
        );
        await new Promise((r) => setTimeout(r, 6000));
        await BleClient.stopLEScan();
        // dedupe by id
        const uniq = Object.values(found.reduce((acc, b) => { acc[b.id] = b; return acc; }, {}));
        cacheRef.current = { beacons: uniq, ts: Date.now() };
        setBluetoothBeacons(uniq);
        return uniq;
      }
      // Web fallback
      if (navigator.bluetooth?.requestDevice) {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [],
        });
        const beacon = { id: device.id, name: device.name, rssi: null };
        cacheRef.current = { beacons: [beacon], ts: Date.now() };
        setBluetoothBeacons([beacon]);
        return [beacon];
      }
      throw new Error("Bluetooth nicht verfügbar");
    } catch (e) {
      throw new Error(e?.message || "Bluetooth-Scan fehlgeschlagen");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refreshWifi();
    const id = setInterval(refreshWifi, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, refreshWifi]);

  return {
    wifiSsid,
    bluetoothBeacons,
    capabilities,
    refreshWifi,
    scanBluetoothOnce,
    getBeacons,
    setWifiOverride: (s) => { writeWifiOverride(s); setWifiSsid(s); },
  };
}

export default useSmartSignals;
