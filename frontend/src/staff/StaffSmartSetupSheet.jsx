/**
 * StaffSmartSetupSheet — Bottom-Sheet zum Konfigurieren der Smart-Signale.
 *
 * - WLAN-SSID manuell setzen (Web-Fallback, da Browser keine Wifi-API hat)
 * - Bluetooth Beacon einmalig scannen + registrieren (Web Bluetooth oder native)
 * - Zeigt Capabilities + aktuelle Werte
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wifi, Bluetooth, CheckCircle2, Loader2, Smartphone, Globe, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useSmartSignals } from "./useSmartSignals";

export function StaffSmartSetupSheet({ open, onClose }) {
  const { wifiSsid, bluetoothBeacons, capabilities, scanBluetoothOnce, setWifiOverride } = useSmartSignals({ enabled: open });
  const [ssidInput, setSsidInput] = useState(wifiSsid || "");
  const [scanning, setScanning] = useState(false);

  React.useEffect(() => { setSsidInput(wifiSsid || ""); }, [wifiSsid]);

  const saveSsid = () => {
    setWifiOverride(ssidInput.trim() || null);
    toast.success(ssidInput.trim() ? "WLAN-Name gespeichert" : "WLAN-Override entfernt");
  };

  const scan = async () => {
    setScanning(true);
    try {
      const beacons = await scanBluetoothOnce();
      if (beacons.length === 0) toast.info("Kein Bluetooth-Gerät in Reichweite");
      else toast.success(`${beacons.length} Bluetooth-Gerät(e) erkannt`);
    } catch (e) {
      toast.error(e.message || "Bluetooth-Scan fehlgeschlagen");
    } finally {
      setScanning(false);
    }
  };

  if (!open) return null;
  const isCapacitor = capabilities.nativeWifi || capabilities.nativeBluetooth;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center"
      >
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          data-testid="smart-setup-sheet"
          className="w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-slate-300" />
          </div>
          <div className="px-6 pt-4 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Smart Detection</p>
              <h2 className="text-lg font-bold text-slate-900">WLAN & Bluetooth einrichten</h2>
            </div>
            <button onClick={onClose} data-testid="smart-setup-close" className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
              <X size={16} className="text-slate-700" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 overflow-y-auto">
            {/* Platform indicator */}
            <div className={`flex items-center gap-2.5 p-3 rounded-2xl text-sm ${
              isCapacitor ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
            }`}>
              {isCapacitor ? <Smartphone size={16} /> : <Globe size={16} />}
              <div className="flex-1">
                <p className="font-bold text-xs">
                  {isCapacitor ? "Native App erkannt" : "Browser-Modus"}
                </p>
                <p className="text-[11px] opacity-80">
                  {isCapacitor
                    ? "Automatische WLAN- und Bluetooth-Erkennung verfügbar."
                    : "Browser kann WLAN-Namen nicht auslesen — bitte manuell eintragen."}
                </p>
              </div>
            </div>

            {/* WLAN */}
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <Wifi size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">WLAN-Name (SSID)</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Wenn dein Manager im Geofence ein WLAN hinterlegt hat, kannst du dich auch außerhalb der GPS-Reichweite einchecken — sobald du im selben WLAN bist.
              </p>
              <div className="flex gap-2">
                <input
                  value={ssidInput}
                  onChange={(e) => setSsidInput(e.target.value)}
                  placeholder="z.B. Termokos-Office"
                  data-testid="smart-setup-ssid-input"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:bg-white focus:border-blue-300"
                />
                <button
                  onClick={saveSsid}
                  data-testid="smart-setup-ssid-save"
                  className="px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition shadow-sm"
                >
                  Speichern
                </button>
              </div>
              {wifiSsid && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100">
                  <CheckCircle2 size={11} /> Aktiv: {wifiSsid}
                </div>
              )}
            </section>

            {/* Bluetooth */}
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <Bluetooth size={16} className="text-violet-600" />
                <h3 className="text-sm font-bold text-slate-900">Bluetooth Beacon</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Tippe auf "Beacon scannen" und wähle das Gerät am Arbeitsplatz. Sobald es in Reichweite ist, erkennt dich das System automatisch.
              </p>
              <button
                onClick={scan}
                disabled={scanning || (!capabilities.nativeBluetooth && !capabilities.webBluetooth)}
                data-testid="smart-setup-bt-scan"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-b from-violet-500 to-violet-600 text-white text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition disabled:opacity-50"
              >
                {scanning ? <Loader2 size={16} className="animate-spin" /> : <Bluetooth size={16} />}
                {scanning ? "Scanne…" : "Beacon scannen"}
              </button>
              {!capabilities.nativeBluetooth && !capabilities.webBluetooth && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700">
                  <AlertTriangle size={11} /> Bluetooth in diesem Browser nicht verfügbar
                </p>
              )}
              {bluetoothBeacons.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {bluetoothBeacons.slice(0, 5).map((b, i) => (
                    <li key={b.id || i} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{b.name || "Unbenanntes Gerät"}</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">{b.id}</p>
                      </div>
                      {b.rssi != null && <span className="text-[10px] text-slate-500 tabular-nums">{b.rssi} dBm</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-[11px] text-slate-400 text-center">
              Deine Daten bleiben lokal auf dem Gerät — wir senden nur SSID-Namen + Beacon-IDs an den Server.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default StaffSmartSetupSheet;
