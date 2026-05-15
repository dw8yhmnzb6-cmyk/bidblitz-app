/**
 * useSmartSignals — erkennt WLAN-SSID und Bluetooth-Beacons.
 *
 * Capacitor (Native App):
 *   - WiFi via `window.Capacitor.Plugins.Wifi.getSSID()` (wenn @capacitor-community/wifi installiert)
 *   - Bluetooth via `window.Capacitor.Plugins.BluetoothLe` (wenn installiert)
 * Web (Browser):
 *   - WLAN SSID nicht abrufbar (Sicherheits-Restriktion)
 *   - Web Bluetooth: nur auf User-Geste (Button) — siehe scanBluetoothOnce()
 *
 * Optional: User-Manual-Override via localStorage ("staff_wifi_ssid_override").
 */
import { useCallback, useEffect, useRef, useState } from "react";

const SSID_OVERRIDE_KEY = "staff_wifi_ssid_override";

function readOverride() {
  try {
    return localStorage.getItem(SSID_OVERRIDE_KEY) || null;
  } catch {
    return null;
  }
}

export function writeWifiOverride(ssid) {
  try {
    if (ssid) localStorage.setItem(SSID_OVERRIDE_KEY, ssid);
    else localStorage.removeItem(SSID_OVERRIDE_KEY);
  } catch {}
}

export function useSmartSignals({ enabled = true, intervalMs = 60000 } = {}) {
  const [wifiSsid, setWifiSsid] = useState(readOverride());
  const [bluetoothBeacons, setBluetoothBeacons] = useState([]);
  const [capabilities, setCapabilities] = useState({
    nativeWifi: false,
    nativeBluetooth: false,
    webBluetooth: typeof navigator !== "undefined" && !!navigator.bluetooth,
  });
  const cacheRef = useRef({ beacons: [], ts: 0 });

  // detect once
  useEffect(() => {
    const cap = (typeof window !== "undefined" && window.Capacitor) || null;
    const plugins = cap?.Plugins || {};
    setCapabilities({
      nativeWifi: !!(plugins.Wifi || plugins.WifiInfo),
      nativeBluetooth: !!(plugins.BluetoothLe || plugins.BluetoothScanner),
      webBluetooth: !!navigator.bluetooth,
    });
  }, []);

  // poll wifi (native only)
  const refreshWifi = useCallback(async () => {
    const override = readOverride();
    if (override) {
      setWifiSsid(override);
      return override;
    }
    try {
      const plugins = window?.Capacitor?.Plugins;
      if (plugins?.Wifi?.getSSID) {
        const res = await plugins.Wifi.getSSID();
        const ssid = res?.ssid || res?.SSID || null;
        setWifiSsid(ssid);
        return ssid;
      }
      if (plugins?.WifiInfo?.getCurrentSSID) {
        const res = await plugins.WifiInfo.getCurrentSSID();
        const ssid = res?.ssid || null;
        setWifiSsid(ssid);
        return ssid;
      }
    } catch {}
    return null;
  }, []);

  // beacons cache valid for ~5min
  const getBeacons = useCallback(() => {
    if (Date.now() - cacheRef.current.ts < 5 * 60 * 1000) {
      return cacheRef.current.beacons;
    }
    return [];
  }, []);

  // one-time browser/native scan (must be triggered by user gesture)
  const scanBluetoothOnce = useCallback(async () => {
    try {
      const plugins = window?.Capacitor?.Plugins;
      if (plugins?.BluetoothLe?.requestLEScan) {
        await plugins.BluetoothLe.initialize();
        const found = [];
        await plugins.BluetoothLe.requestLEScan({ allowDuplicates: false }, (result) => {
          if (result?.device) {
            found.push({ id: result.device.deviceId, name: result.device.name, rssi: result.rssi });
          }
        });
        // stop after 6s
        await new Promise((r) => setTimeout(r, 6000));
        await plugins.BluetoothLe.stopLEScan();
        cacheRef.current = { beacons: found, ts: Date.now() };
        setBluetoothBeacons(found);
        return found;
      }
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
    } catch (e) {
      throw new Error(e?.message || "Bluetooth-Scan fehlgeschlagen");
    }
    return [];
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
