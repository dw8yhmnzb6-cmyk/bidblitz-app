import { useEffect, useId, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
];

export function ChargeProductScanner({ open, onClose, onDetected }) {
  const reactId = useId();
  const elementId = `charge-product-scanner-${reactId.replace(/:/g, "")}`;
  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    let disposed = false;
    handledRef.current = false;
    setStatus("starting");
    setError("");

    const scanner = new Html5Qrcode(elementId, {
      formatsToSupport: FORMATS,
      verbose: false,
    });
    scannerRef.current = scanner;

    const start = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (disposed) return;
        if (!cameras?.length) {
          throw new Error("Keine Kamera gefunden");
        }

        const rear =
          cameras.find((camera) => /back|rear|environment|rück/i.test(camera.label || "")) ||
          cameras[cameras.length - 1];

        await scanner.start(
          rear.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 180 },
            aspectRatio: 1.333,
            disableFlip: false,
          },
          async (decodedText) => {
            if (handledRef.current || !decodedText) return;
            handledRef.current = true;
            setStatus("detected");
            try {
              if (scanner.isScanning) await scanner.stop();
            } catch (stopError) {
              void stopError;
            }
            onDetected?.(decodedText.trim());
          },
          () => {}
        );
        if (!disposed) setStatus("scanning");
      } catch (scanError) {
        if (!disposed) {
          setStatus("error");
          setError(scanError?.message || "Kamera konnte nicht gestartet werden");
        }
      }
    };

    start();

    return () => {
      disposed = true;
      const active = scannerRef.current;
      scannerRef.current = null;
      if (!active) return;
      Promise.resolve()
        .then(async () => {
          try {
            if (active.isScanning) await active.stop();
          } catch (stopError) {
            void stopError;
          }
          try {
            await active.clear();
          } catch (clearError) {
            void clearError;
          }
        });
    };
  }, [open, elementId, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" data-testid="charge-product-scanner-modal">
      <div className="w-full max-w-lg overflow-hidden rounded-t-[30px] bg-[#08131D] p-4 text-white shadow-2xl sm:rounded-[30px]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6EE7F9]/10 text-[#6EE7F9]">
            <Camera size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6EE7F9]">BidBlitz Charge</p>
            <h2 className="text-lg font-black">Produktcode scannen</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="charge-product-scanner-close">
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-black">
          <div id={elementId} className="min-h-[300px] w-full" />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">
          {status === "starting" ? (
            <span className="inline-flex items-center gap-2"><Loader2 size={13} className="animate-spin" />Kamera wird gestartet…</span>
          ) : status === "scanning" ? (
            "Halte QR-Code oder Barcode vollständig in den Rahmen."
          ) : status === "detected" ? (
            "Code erkannt. Produkt wird geprüft…"
          ) : status === "error" ? (
            <span className="text-amber-200">{error}. Du kannst den Code weiterhin manuell eingeben.</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
