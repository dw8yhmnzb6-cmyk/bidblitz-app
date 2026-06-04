/**
 * BidBlitz Staff — NFC Service
 * =============================
 * Wrapper für native NFC-Bridge (Android) mit Web-Fallback.
 *
 * Native Android: lokale Capacitor Bridge `BidblitzNfc`
 * iOS: graceful fallback bis Entitlement vorhanden ist
 * Web: Web NFC API (Android Chrome only) als Fallback
 * Andere: nicht verfügbar → returns { available: false }
 */

const isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
const nativePlatform = typeof window !== "undefined" && window.Capacitor?.getPlatform?.();
const hasWebNFC = typeof window !== "undefined" && "NDEFReader" in window;

let _nfcPlugin = null;

async function getNfcPlugin() {
  if (_nfcPlugin !== null) return _nfcPlugin;
  if (!isNative) return null;
  try {
    const mod = await import("../plugins/bidblitzNfc");
    _nfcPlugin = mod?.BidblitzNfc || null;
  } catch (e) {
    _nfcPlugin = null;
  }
  return _nfcPlugin;
}

/** Check availability. */
export async function isNFCAvailable() {
  if (isNative) {
    if (nativePlatform === "ios") {
      return { available: false, mode: "native-ios", reason: "NFC auf iPhone folgt, Entitlement fehlt noch" };
    }
    const plugin = await getNfcPlugin();
    if (!plugin) return { available: false, mode: "none", reason: "Plugin nicht installiert" };
    try {
      const r = await plugin.isAvailable?.();
      return { available: !!r?.available, mode: "native", supported: !!r?.supported };
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
      let tagListener = null;
      let errorListener = null;
      const cleanup = async () => {
        try { await tagListener?.remove?.(); } catch {}
        try { await errorListener?.remove?.(); } catch {}
        try { await plugin.stopScanning?.(); } catch {}
      };
      const timer = setTimeout(async () => {
        if (!done) {
          done = true;
          await cleanup();
          resolve({ ok: false, error: "Timeout" });
        }
      }, timeout);
      const onTag = (tag) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        const records = tag?.records || [];
        const payload = records.map((r) => r.payloadText || r.payloadHex || r.type).filter(Boolean).join(" | ");
        resolve({ ok: true, payload, tag, uid: tag?.uid || tag?.id || "" });
      };
      const onError = (event) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        resolve({ ok: false, error: event?.message || "NFC Fehler" });
      };
      Promise.all([
        plugin.addListener?.("nfcTagScanned", onTag),
        plugin.addListener?.("nfcError", onError),
      ]).then(async ([tagSub, errSub]) => {
        tagListener = tagSub;
        errorListener = errSub;
        await plugin.startScanning?.();
      }).catch(async (e) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        await cleanup();
        resolve({ ok: false, error: e?.message || "NFC Start fehlgeschlagen" });
      });
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

export async function writeNFC(records = []) {
  const info = await isNFCAvailable();
  if (!info.available) return { ok: false, error: info.reason || "NFC nicht verfügbar" };

  if (info.mode === "native") {
    const plugin = await getNfcPlugin();
    return new Promise((resolve) => {
      let done = false;
      let tagListener = null;
      let errorListener = null;
      const cleanup = async () => {
        try { await tagListener?.remove?.(); } catch {}
        try { await errorListener?.remove?.(); } catch {}
        try { await plugin.stopScanning?.(); } catch {}
      };
      const timer = setTimeout(async () => {
        if (done) return;
        done = true;
        await cleanup();
        resolve({ ok: false, error: "Timeout beim NFC-Schreiben" });
      }, 15000);

      Promise.all([
        plugin.addListener?.("nfcTagScanned", async (tag) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          await cleanup();
          resolve({ ok: true, tag, pending: false, written: !!tag?.writeSuccess });
        }),
        plugin.addListener?.("nfcError", async (event) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          await cleanup();
          resolve({ ok: false, error: event?.message || "NFC Schreibvorgang fehlgeschlagen" });
        }),
      ]).then(async ([tagSub, errSub]) => {
        tagListener = tagSub;
        errorListener = errSub;
        await plugin.writeNdef?.({ records });
      }).catch(async (e) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        await cleanup();
        resolve({ ok: false, error: e?.message || "NFC Schreibvorgang fehlgeschlagen" });
      });
    });
  }

  if (hasWebNFC) {
    try {
      const ndef = new window.NDEFReader();
      await ndef.write({ records });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || "Web NFC Schreiben fehlgeschlagen" };
    }
  }

  return { ok: false, error: "NFC nicht unterstützt" };
}

export async function readMifareClassic({ sector = 0, block = 0, keyAHex = "", keyBHex = "" } = {}) {
  const plugin = await getNfcPlugin();
  if (!plugin) return { ok: false, error: "Native NFC-Bridge nicht verfügbar" };
  try {
    const result = await plugin.readMifareClassic?.({ sector, block, keyAHex, keyBHex });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e?.message || "Mifare Classic Lesen fehlgeschlagen" };
  }
}

export async function writeMifareClassic({ sector = 0, block = 0, dataHex = "", keyAHex = "", keyBHex = "" } = {}) {
  const plugin = await getNfcPlugin();
  if (!plugin) return { ok: false, error: "Native NFC-Bridge nicht verfügbar" };
  try {
    const result = await plugin.writeMifareClassic?.({ sector, block, dataHex, keyAHex, keyBHex });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e?.message || "Mifare Classic Schreiben fehlgeschlagen" };
  }
}

export async function readMifareUltralight({ page = 4 } = {}) {
  const plugin = await getNfcPlugin();
  if (!plugin) return { ok: false, error: "Native NFC-Bridge nicht verfügbar" };
  try {
    const result = await plugin.readMifareUltralight?.({ page });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e?.message || "Mifare Ultralight Lesen fehlgeschlagen" };
  }
}

export async function writeMifareUltralight({ page = 4, dataHex = "" } = {}) {
  const plugin = await getNfcPlugin();
  if (!plugin) return { ok: false, error: "Native NFC-Bridge nicht verfügbar" };
  try {
    const result = await plugin.writeMifareUltralight?.({ page, dataHex });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e?.message || "Mifare Ultralight Schreiben fehlgeschlagen" };
  }
}

export async function transceiveNFC({ commandHex = "" } = {}) {
  const plugin = await getNfcPlugin();
  if (!plugin) return { ok: false, error: "Native NFC-Bridge nicht verfügbar" };
  try {
    const result = await plugin.transceive?.({ commandHex });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: e?.message || "NFC transceive fehlgeschlagen" };
  }
}
