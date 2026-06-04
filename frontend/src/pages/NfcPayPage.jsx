import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Smartphone, ScanLine, PencilLine, ShieldAlert, Radio, Layers, Cpu } from "lucide-react";
import { toast } from "sonner";
import {
  isNFCAvailable,
  scanNFC,
  writeNFC,
  readMifareClassic,
  writeMifareClassic,
  readMifareUltralight,
  writeMifareUltralight,
  transceiveNFC,
} from "../utils/nfcService";

export default function NfcPayPage({ onBack }) {
  const [busy, setBusy] = useState(false);
  const [nfcInfo, setNfcInfo] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [ndefUrl, setNdefUrl] = useState("https://bidblitz.ae");
  const [classicSector, setClassicSector] = useState("1");
  const [classicBlock, setClassicBlock] = useState("0");
  const [classicDataHex, setClassicDataHex] = useState("424944424C49545A3030303030303030");
  const [ultralightPage, setUltralightPage] = useState("4");
  const [ultralightDataHex, setUltralightDataHex] = useState("424C5A31");
  const [transceiveHex, setTransceiveHex] = useState("30 04");
  const [nativeResult, setNativeResult] = useState(null);

  const platformBadge = useMemo(() => {
    if (!nfcInfo) return { label: "Ungeprüft", color: "#6B7280" };
    if (nfcInfo.mode === "native-ios") return { label: "iPhone folgt", color: "#F59E0B" };
    if (nfcInfo.mode === "native") return { label: "Android Native", color: "#22C55E" };
    if (nfcInfo.mode === "web") return { label: "Web NFC", color: "#06B6D4" };
    return { label: "Nicht verfügbar", color: "#EF4444" };
  }, [nfcInfo]);

  const refreshAvailability = async () => {
    setBusy(true);
    const info = await isNFCAvailable();
    setNfcInfo(info);
    setBusy(false);
    if (!info.available) {
      toast.message(info.reason || "NFC nicht verfügbar");
    } else {
      toast.success(`NFC bereit: ${info.mode}`);
    }
  };

  const handleScan = async () => {
    setBusy(true);
    const result = await scanNFC({ timeout: 15000 });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error || "Scan fehlgeschlagen");
      return;
    }
    setLastScan(result);
    setNativeResult(null);
    toast.success(`Tag erkannt: ${result.uid || result.tag?.uid || "NFC"}`);
  };

  const handleWriteUrl = async () => {
    setBusy(true);
    const result = await writeNFC([{ recordType: "url", data: ndefUrl }]);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error || "Schreiben fehlgeschlagen");
      return;
    }
    setNativeResult(result);
    toast.success("NDEF-URL erfolgreich geschrieben");
  };

  const runNativeAction = async (runner, successText) => {
    setBusy(true);
    const result = await runner();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error || "NFC Aktion fehlgeschlagen");
      return;
    }
    setNativeResult(result);
    toast.success(successText);
  };

  return (
    <motion.div
      data-testid="nfc-pay-page"
      className="min-h-screen bg-[#040507] text-white pb-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="sticky top-0 z-20 border-b border-white/8 bg-[#040507]/90 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button data-testid="nfc-back-btn" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black">Native NFC Bridge</h1>
            <p className="text-sm text-white/45">Android: lesen + schreiben + Mifare Classic/Ultralight. iPhone: sauberer Fallback bis Entitlement da ist.</p>
          </div>
          <button data-testid="nfc-refresh-availability-button" onClick={refreshAvailability} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-100">
            Status prüfen
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <section data-testid="nfc-status-card" className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-bold">Bridge Status</p>
                <h2 className="mt-2 text-lg font-black">{platformBadge.label}</h2>
                <p className="mt-1 text-sm text-white/55">{nfcInfo?.reason || "Prüfe die NFC-Verfügbarkeit auf dem aktuellen Gerät."}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${platformBadge.color}22`, color: platformBadge.color }}>
                <Smartphone size={22} />
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                { id: "available", label: "Verfügbar", value: nfcInfo?.available ? "Ja" : "Nein" },
                { id: "mode", label: "Modus", value: nfcInfo?.mode || "—" },
                { id: "supported", label: "Support", value: nfcInfo?.supported === false ? "Nein" : "Ja / offen" },
              ].map((item) => (
                <div key={item.id} data-testid={`nfc-status-${item.id}`} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">{item.label}</p>
                  <p className="mt-2 text-sm font-bold text-white break-words">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5" data-testid="nfc-basic-tools-card">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-cyan-300" />
              <h2 className="text-base font-black">Basis: Lesen & NDEF schreiben</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button data-testid="nfc-scan-button" onClick={handleScan} disabled={busy} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 text-left disabled:opacity-50">
                <p className="text-sm font-bold text-emerald-100">NFC lesen</p>
                <p className="mt-1 text-xs text-emerald-50/70">Tag halten und UID / Records / Techs lesen</p>
              </button>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                <p className="text-sm font-bold text-cyan-100">NDEF URL schreiben</p>
                <input data-testid="nfc-ndef-url-input" value={ndefUrl} onChange={(e) => setNdefUrl(e.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" />
                <button data-testid="nfc-write-ndef-button" onClick={handleWriteUrl} disabled={busy} className="mt-3 w-full rounded-2xl border border-cyan-300/20 bg-black/20 px-4 py-3 text-sm font-bold text-cyan-100 disabled:opacity-50">
                  URL auf Tag schreiben
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5" data-testid="nfc-mifare-classic-card">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-amber-300" />
              <h2 className="text-base font-black">Mifare Classic</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input data-testid="nfc-classic-sector-input" value={classicSector} onChange={(e) => setClassicSector(e.target.value)} placeholder="Sector" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" />
              <input data-testid="nfc-classic-block-input" value={classicBlock} onChange={(e) => setClassicBlock(e.target.value)} placeholder="Block" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" />
              <input data-testid="nfc-classic-data-input" value={classicDataHex} onChange={(e) => setClassicDataHex(e.target.value)} placeholder="32 Hex-Zeichen" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none md:col-span-3" />
              <button data-testid="nfc-classic-read-button" onClick={() => runNativeAction(() => readMifareClassic({ sector: Number(classicSector || 0), block: Number(classicBlock || 0) }), "Mifare Classic gelesen")} disabled={busy} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100 disabled:opacity-50">
                Classic lesen
              </button>
              <button data-testid="nfc-classic-write-button" onClick={() => runNativeAction(() => writeMifareClassic({ sector: Number(classicSector || 0), block: Number(classicBlock || 0), dataHex: classicDataHex }), "Mifare Classic geschrieben")} disabled={busy} className="rounded-2xl border border-amber-300/20 bg-black/20 px-4 py-3 text-sm font-bold text-amber-100 disabled:opacity-50">
                Classic schreiben
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5" data-testid="nfc-mifare-ultralight-card">
            <div className="flex items-center gap-2">
              <PencilLine size={16} className="text-violet-300" />
              <h2 className="text-base font-black">Mifare Ultralight + Raw</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input data-testid="nfc-ultralight-page-input" value={ultralightPage} onChange={(e) => setUltralightPage(e.target.value)} placeholder="Page" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" />
              <input data-testid="nfc-ultralight-data-input" value={ultralightDataHex} onChange={(e) => setUltralightDataHex(e.target.value)} placeholder="8 Hex-Zeichen" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none md:col-span-2" />
              <button data-testid="nfc-ultralight-read-button" onClick={() => runNativeAction(() => readMifareUltralight({ page: Number(ultralightPage || 4) }), "Ultralight gelesen")} disabled={busy} className="rounded-2xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 text-sm font-bold text-violet-100 disabled:opacity-50">
                Ultralight lesen
              </button>
              <button data-testid="nfc-ultralight-write-button" onClick={() => runNativeAction(() => writeMifareUltralight({ page: Number(ultralightPage || 4), dataHex: ultralightDataHex }), "Ultralight geschrieben")} disabled={busy} className="rounded-2xl border border-violet-300/20 bg-black/20 px-4 py-3 text-sm font-bold text-violet-100 disabled:opacity-50">
                Ultralight schreiben
              </button>
              <input data-testid="nfc-transceive-input" value={transceiveHex} onChange={(e) => setTransceiveHex(e.target.value)} placeholder="z. B. 30 04" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none md:col-span-2" />
              <button data-testid="nfc-transceive-button" onClick={() => runNativeAction(() => transceiveNFC({ commandHex: transceiveHex }), "Raw transceive ausgeführt")} disabled={busy} className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-bold text-rose-100 disabled:opacity-50 md:col-span-3">
                Raw transceive senden
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5" data-testid="nfc-last-scan-card">
            <div className="flex items-center gap-2">
              <ScanLine size={16} className="text-emerald-300" />
              <h2 className="text-base font-black">Letzter Scan</h2>
            </div>
            {!lastScan ? (
              <p className="mt-4 text-sm text-white/45">Noch kein Tag gelesen.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <div data-testid="nfc-last-scan-uid" className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">UID</p>
                  <p className="mt-1 font-mono break-all text-cyan-100">{lastScan.uid || lastScan.tag?.uid || lastScan.tag?.id}</p>
                </div>
                <div data-testid="nfc-last-scan-techs" className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">Techs</p>
                  <p className="mt-1 break-words text-white/80">{(lastScan.tag?.techList || []).join(" · ") || "—"}</p>
                </div>
                <div data-testid="nfc-last-scan-records" className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">Records</p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-white/75">{JSON.stringify(lastScan.tag?.records || [], null, 2)}</pre>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5" data-testid="nfc-native-result-card">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-cyan-300" />
              <h2 className="text-base font-black">Native Ergebnis</h2>
            </div>
            {!nativeResult ? (
              <p className="mt-4 text-sm text-white/45">Noch keine Native-Operation ausgeführt.</p>
            ) : (
              <pre data-testid="nfc-native-result-json" className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-white/75">{JSON.stringify(nativeResult, null, 2)}</pre>
            )}
          </section>

          <section className="rounded-[28px] border border-amber-400/15 bg-amber-400/10 p-5" data-testid="nfc-ios-fallback-card">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-200" />
              <h2 className="text-base font-black text-amber-100">iPhone Status</h2>
            </div>
            <p className="mt-3 text-sm text-amber-50/80">Android ist jetzt nativ vorbereitet. Auf iPhone bleibt NFC bewusst sauber deaktiviert, bis das Apple NFC-Entitlement vorhanden ist.</p>
          </section>
        </div>
      </div>
    </motion.div>
  );
}