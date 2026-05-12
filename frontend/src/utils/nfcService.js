/**
 * BidBlitz Staff — NFC Service
 * =============================
 * Wrapper für native NFC (Capacitor Community Plugin) mit Web-Fallback.
 *
 * Native: @capacitor-community/nfc (Android/iOS NDEF read/write)
 * Web: Web NFC API (Android Chrome only) als Fallback
 * Andere: nicht verfügbar → returns { available: false }
 */

const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
const hasWebNFC = typeof window !== "undefined" && "NDEFReader" in window;

let _nfcPlugin = null;

async function getNfcPlugin() {
  if (_nfcPlugin !== null) return _nfcPlugin;
  if (!isNative) return null;
  try {
    // Dynamic import to avoid bundling on web
    const mod = await import(/* webpackIgnore: true */ "@capacitor-community/nfc");
    _nfcPlugin = mod?.Nfc || null;
  } catch (e) {
    _nfcPlugin = null;
  }
  return _nfcPlugin;
}

/** Check availability. */
export async function isNFCAvailable() {
  if (isNative) {
    const plugin = await getNfcPlugin();
    if (!plugin) return { available: false, mode: "none", reason: "Plugin nicht installiert" };
    try {
      const r = await plugin.isAvailable?.();
      return { available: !!r?.available, mode: "native" };
    } catch (e) {
      return { available: false, mode: "native", reason: e?.message };
    }
  }
  if (hasWebNFC) return { available: true, mode: "web" };
  return { available: false, mode: "none", reason: "NFC nicht unterstützt" };
}

/** Start one-shot scan. Resolves with { ok: true, payload }. */
export async function scanNFC({ timeout = 15000 } = {}) {
  const info = await isNFCAvailable();
  if (!info.available) return { ok: false, error: info.reason || "NFC nicht verfügbar" };

  if (info.mode === "native") {
    const plugin = await getNfcPlugin();
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; plugin.stopScanning?.(); resolve({ ok: false, error: "Timeout" }); } }, timeout);
      const onTag = (tag) => {
        if (done) return;
        done = true; clearTimeout(timer); plugin.stopScanning?.();
        const records = tag?.message?.records || [];
        const payload = records.map((r) => r.payload && new TextDecoder().decode(r.payload)).filter(Boolean).join(" | ");
        resolve({ ok: true, payload, tag });
      };
      plugin.addListener?.("nfcTagScanned", onTag);
      plugin.startScanning?.();
    });
  }

  // Web NFC fallback
  try {
    const ndef = new window.NDEFReader();
    await ndef.scan();
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: "Timeout" }), timeout);
      ndef.onreading = (event) => {
        clearTimeout(timer);
        const records = event?.message?.records || [];
        const payload = Array.from(records).map((r) => new TextDecoder().decode(r.data)).join(" | ");
        resolve({ ok: true, payload });
      };
      ndef.onreadingerror = () => { clearTimeout(timer); resolve({ ok: false, error: "Lesefehler" }); };
    });
  } catch (e) {
    return { ok: false, error: e?.message || "NFC Fehler (Permission?)" };
  }
}
