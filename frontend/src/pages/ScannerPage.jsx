import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  ArrowLeft, ScanBarcode, CheckCircle2, XCircle, Loader2,
  Euro, Smartphone, QrCode, Zap, ShieldCheck, Receipt, Heart,
  Camera, UtensilsCrossed, FileText, WalletCards, ScanLine, CameraOff,
} from "lucide-react";
import { useUser, useI18n, useWallet } from "../store";
import { useNetwork } from "../store/NetworkContext";
import { api } from "../services/api";
import TipModal from "../components/TipModal";

const Step = { AMOUNT: 0, SCANNING: 1, PROCESSING: 2, SUCCESS: 3, ERROR: 4 };
const Tool = { RESOLVE: "resolve", CASHIER: "cashier" };

const QUICK_AMOUNTS = [5, 10, 15, 25, 50, 100];
const BARCODE_RE = /^BLZ-[A-F0-9]{12}(-[A-F0-9]{8})?$/;
const SUPPORTED_SCAN_FORMATS = ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "code_93", "codabar"];
const HTML5_SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
];

const generateIdempotencyKey = () => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const swallowMaybePromise = (result) => {
  if (result && typeof result.catch === "function") {
    result.catch(() => {});
  }
};

const ScannerPage = ({ onNavigate, onShowBarcode }) => {
  const user = useUser();
  const wallet = useWallet();
  const { t } = useI18n();
  const { online } = useNetwork();
  const canCashier = user.role === "merchant" || user.role === "admin" || user.currentMode === "merchant";

  const [tool, setTool] = useState(Tool.RESOLVE);

  const [step, setStep] = useState(Step.AMOUNT);
  const [amount, setAmount] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(null);
  const barcodeRef = useRef(null);
  const [showTip, setShowTip] = useState(false);

  const [scanCodeInput, setScanCodeInput] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanHint, setScanHint] = useState("Scanne Tisch-, Rechnungs- oder Checkout-Codes.");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraEngine, setCameraEngine] = useState(null);
  const [cameraPreparing, setCameraPreparing] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const html5ScannerRef = useRef(null);
  const scanLockRef = useRef(false);

  const numAmount = parseFloat(amount) || 0;
  const isValidAmount = numAmount >= 0.5 && numAmount <= 2500;

  useEffect(() => {
    if (tool === Tool.CASHIER && step === Step.SCANNING && barcodeRef.current) {
      setTimeout(() => barcodeRef.current?.focus(), 300);
    }
  }, [step, tool]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (html5ScannerRef.current) {
      const scanner = html5ScannerRef.current;
      try {
        const state = typeof scanner.getState === "function" ? scanner.getState() : null;
        const canStop = state === 2 || state === 3 || state === "SCANNING" || state === "PAUSED";
        if (canStop && typeof scanner.stop === "function") {
          scanner.stop().catch(() => {}).finally(() => {
            swallowMaybePromise(scanner.clear?.());
          });
        } else {
          swallowMaybePromise(scanner.clear?.());
        }
      } catch (scannerStopError) {
        void scannerStopError;
        swallowMaybePromise(scanner.clear?.());
      }
      html5ScannerRef.current = null;
    }
    scanLockRef.current = false;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraPreparing(false);
    setCameraActive(false);
    setCameraEngine(null);
  }, []);

  const switchTool = useCallback((nextTool) => {
    if (nextTool !== Tool.RESOLVE) {
      stopCamera();
    }
    setTool(nextTool);
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleResolveCode = useCallback(async (value) => {
    const code = (value || "").trim();
    if (!code) return;
    if (!online) {
      setScanError(t("error.offline") || "Offline");
      return;
    }

    setScanBusy(true);
    setScanError("");

    try {
      const res = await api.resolveScanCode({ code });

      if (res.type === "wallet_barcode") {
        if (!canCashier) {
          setScanError(res.message || "Dieser Code gehört in den Kassieren-Modus.");
          return;
        }
        setTool(Tool.CASHIER);
        setBarcodeInput(code.toUpperCase());
        setStep(Step.AMOUNT);
        setScanHint("Kunden-Code erkannt. Betrag eingeben und kassieren.");
        return;
      }

      stopCamera();
      onNavigate?.(res.route);
    } catch (e) {
      setScanError(e?.message || "Code konnte nicht aufgelöst werden.");
    } finally {
      setScanBusy(false);
    }
  }, [canCashier, onNavigate, online, stopCamera, t]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setScanError("");

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError("Kamera nicht verfügbar.");
      return;
    }
    try {
      const preferHtml5Fallback = /iPad|iPhone|iPod/i.test(navigator.userAgent) || typeof window === "undefined" || !("BarcodeDetector" in window);

      if (preferHtml5Fallback) {
        setCameraPreparing(true);
        setCameraEngine("html5");
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
        await new Promise((resolve) => setTimeout(resolve, 60));

        const scanner = new Html5Qrcode("scan-hub-reader", {
          experimentalFeatures: { useBarCodeDetectorIfSupported: false },
          useBarCodeDetectorIfSupported: false,
          verbose: false,
        });
        html5ScannerRef.current = scanner;

        const onScanSuccess = async (decodedText) => {
          if (scanLockRef.current) return;
          scanLockRef.current = true;
          setScanCodeInput(decodedText);
          await handleResolveCode(decodedText);
          setTimeout(() => { scanLockRef.current = false; }, 1500);
        };

        const config = {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          rememberLastUsedCamera: true,
          formatsToSupport: HTML5_SUPPORTED_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: false },
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        try {
          await scanner.start({ facingMode: { exact: "environment" } }, config, onScanSuccess, () => {});
        } catch {
          await scanner.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
        }

        setCameraActive(true);
        setCameraPreparing(false);
        setScanHint("Safari/iPhone-Kamera aktiv. Richte den Code mittig aus.");
        setTimeout(() => {
          try {
            swallowMaybePromise(scanner.applyVideoConstraints?.({ advanced: [{ focusMode: "continuous" }, { zoom: 2 }] }));
          } catch (focusError) {
            void focusError;
          }
        }, 1200);
        return;
      }

      const supported = typeof window.BarcodeDetector.getSupportedFormats === "function"
        ? await window.BarcodeDetector.getSupportedFormats()
        : SUPPORTED_SCAN_FORMATS;
      const formats = SUPPORTED_SCAN_FORMATS.filter((format) => supported.includes(format));
      detectorRef.current = new window.BarcodeDetector({ formats: formats.length ? formats : ["qr_code"] });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraActive(true);
      setCameraEngine("native");
      setScanHint("Kamera scannt QR- und Barcodes live.");
    } catch (e) {
      stopCamera();
      setCameraError(e?.message || "Kamera konnte nicht gestartet werden.");
    }
  }, [handleResolveCode, stopCamera]);

  useEffect(() => {
    if (!cameraActive || cameraEngine !== "native" || !detectorRef.current || !videoRef.current) return undefined;

    let cancelled = false;

    const scanLoop = async () => {
      if (cancelled) return;
      try {
        if (videoRef.current?.readyState >= 2 && !scanLockRef.current) {
          const codes = await detectorRef.current.detect(videoRef.current);
          const rawValue = codes?.[0]?.rawValue || codes?.[0]?.raw_value;
          if (rawValue) {
            scanLockRef.current = true;
            setScanCodeInput(rawValue);
            await handleResolveCode(rawValue);
            setTimeout(() => { scanLockRef.current = false; }, 1500);
          }
        }
      } catch (scanLoopError) {
        void scanLoopError;
      }

      if (!cancelled) {
        setTimeout(scanLoop, 700);
      }
    };

    scanLoop();
    return () => { cancelled = true; };
  }, [cameraActive, cameraEngine, handleResolveCode]);

  const handleStartScan = () => {
    if (!isValidAmount) return;
    if (!online) { setError(t("error.offline")); setStep(Step.ERROR); return; }
    setBarcodeInput("");
    setIdempotencyKey(generateIdempotencyKey());
    setStep(Step.SCANNING);
  };

  const handleBarcodeSubmit = useCallback(async () => {
    if (processing) return;
    const code = barcodeInput.trim().toUpperCase();
    if (!code || code.length < 6) return;
    if (!online) { setError(t("error.offline")); setStep(Step.ERROR); return; }

    if (!BARCODE_RE.test(code)) {
      setError(t("scan.invalid_barcode_format") || "Invalid barcode format. Expected: BLZ-XXXXXXXXXXXX");
      setStep(Step.ERROR);
      return;
    }

    setStep(Step.PROCESSING);
    setProcessing(true);

    try {
      const res = await api.merchantScanPayment({
        customer_barcode: code,
        amount: numAmount,
        description: `Barcode payment EUR ${numAmount.toFixed(2)}`,
        idempotency_key: idempotencyKey,
      });

      if (res.success) {
        setResult(res);
        setStep(Step.SUCCESS);
        wallet.refreshWallet();
      } else {
        setError(res.detail || t("scan.error"));
        setStep(Step.ERROR);
      }
    } catch (e) {
      const msg = e?.message || "";
      if (msg.startsWith("compliance.")) {
        setError(t(msg.split("|")[0]) || t("scan.error"));
      } else if (msg.includes("insufficient") || msg === "scan.insufficient") {
        setError(t("scan.insufficient") || "Insufficient balance");
      } else if (msg.includes("not found") || msg === "scan.barcode_not_found") {
        setError(t("scan.barcode_not_found") || "Barcode not found");
      } else if (msg === "scan.invalid_barcode_format") {
        setError(t("scan.invalid_barcode_format") || "Invalid barcode format");
      } else {
        setError(msg || t("scan.error"));
      }
      setStep(Step.ERROR);
    } finally {
      setProcessing(false);
    }
  }, [barcodeInput, numAmount, online, t, wallet, processing, idempotencyKey]);

  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter" && barcodeInput.trim().length >= 6) {
      handleBarcodeSubmit();
    }
  };

  const handleReset = () => {
    setStep(Step.AMOUNT);
    setAmount("");
    setBarcodeInput("");
    setResult(null);
    setError("");
    setIdempotencyKey(null);
  };

  const handleNewPayment = () => {
    setStep(Step.AMOUNT);
    setBarcodeInput("");
    setResult(null);
    setError("");
    setIdempotencyKey(null);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-outfit relative overflow-hidden" data-testid="scanner-page">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-[500px] h-[60vw] max-h-[400px] bg-gradient-radial from-[#00C2FF]/[0.04] to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3">
        <motion.button
          data-testid="scanner-back-btn"
          onClick={() => onNavigate("/more")}
          className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft size={16} className="text-white/70" />
        </motion.button>
        <h1 className="text-base font-semibold">
          {tool === Tool.CASHIER ? (t("scan.title") || "Barcode-Zahlung") : "Scan Hub"}
        </h1>
        <div className="w-9" />
      </div>

      <div className="px-5 pb-8 relative z-10 space-y-5">
        <div className="grid grid-cols-3 gap-2" data-testid="scanner-tool-switcher">
          <button
            onClick={() => switchTool(Tool.RESOLVE)}
            className={`py-2.5 rounded-xl text-xs font-semibold border ${tool === Tool.RESOLVE ? "bg-[#00C2FF]/15 text-[#00C2FF] border-[#00C2FF]/30" : "bg-white/[0.03] text-[#888] border-white/[0.05]"}`}
            data-testid="scanner-tool-resolve"
          >
            Scannen
          </button>
          <button
            onClick={() => canCashier ? switchTool(Tool.CASHIER) : onShowBarcode?.()}
            className={`py-2.5 rounded-xl text-xs font-semibold border ${tool === Tool.CASHIER ? "bg-[#00D26A]/15 text-[#00D26A] border-[#00D26A]/30" : "bg-white/[0.03] text-[#888] border-white/[0.05]"}`}
            data-testid="scanner-tool-cashier"
          >
            {canCashier ? "Kassieren" : "Mein Code"}
          </button>
          <button
            onClick={() => onShowBarcode?.()}
            className="py-2.5 rounded-xl text-xs font-semibold border bg-white/[0.03] text-white border-white/[0.05]"
            data-testid="scanner-show-my-code"
          >
            Mein QR
          </button>
        </div>

        {tool === Tool.RESOLVE ? (
          <div className="space-y-4" data-testid="scan-hub-panel">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4" data-testid="scan-hub-table-card">
                <div className="w-10 h-10 rounded-2xl bg-[#00C2FF]/12 text-[#00C2FF] flex items-center justify-center mb-3">
                  <UtensilsCrossed size={18} />
                </div>
                <p className="text-sm font-semibold">Tisch scannen</p>
                <p className="text-[11px] text-[#666] mt-1 leading-relaxed">QR oder Barcode öffnen direkt die Karte und Bestellung.</p>
              </div>
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4" data-testid="scan-hub-invoice-card">
                <div className="w-10 h-10 rounded-2xl bg-[#FF6B6B]/12 text-[#FF6B6B] flex items-center justify-center mb-3">
                  <FileText size={18} />
                </div>
                <p className="text-sm font-semibold">Rechnung scannen</p>
                <p className="text-[11px] text-[#666] mt-1 leading-relaxed">Invoice-Code führt direkt auf die Zahlungsseite.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.05] bg-white/[0.03] overflow-hidden" data-testid="scan-hub-camera-card">
              <div className="aspect-[4/5] bg-[#050505] flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity ${cameraActive && cameraEngine === "native" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  data-testid="scan-camera-preview"
                />
                <div
                  id="scan-hub-reader"
                  className={`absolute inset-0 overflow-hidden transition-opacity [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&>div]:w-full [&>div]:h-full ${cameraEngine === "html5" || cameraPreparing ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  data-testid="scan-camera-html5-preview"
                />

                {!cameraActive && !cameraPreparing && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6"
                    data-testid="scan-camera-placeholder-action"
                  >
                    <div className="w-20 h-20 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(0,194,255,0.08)]">
                      <ScanLine size={30} className="text-[#00C2FF]" />
                    </div>
                    <p className="text-sm font-semibold">Zum Scannen tippen</p>
                    <p className="text-[11px] text-[#666] mt-1">QR + klassische Barcodes. Unterstützt Tisch-Codes, Rechnungen und Checkout-Links.</p>
                  </button>
                )}
                {cameraPreparing && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 bg-[#050505]/80" data-testid="scan-camera-preparing">
                    <div className="w-16 h-16 rounded-full border border-[#00C2FF]/25 bg-[#00C2FF]/10 flex items-center justify-center mb-4">
                      <Loader2 size={26} className="text-[#00C2FF] animate-spin" />
                    </div>
                    <p className="text-sm font-semibold">Kamera wird gestartet</p>
                    <p className="text-[11px] text-[#666] mt-1">Bitte kurz warten und die Berechtigung erlauben.</p>
                  </div>
                )}
                <div className="absolute inset-x-5 top-5 h-12 border border-[#00C2FF]/35 rounded-2xl pointer-events-none" />
              </div>

              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={cameraActive ? stopCamera : startCamera}
                    className={`flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 ${cameraActive ? "bg-red-500/12 text-red-300 border border-red-500/25" : "bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/25"}`}
                    data-testid="scan-camera-toggle"
                  >
                    {cameraActive ? <CameraOff size={16} /> : <Camera size={16} />}
                    {cameraActive ? "Kamera stoppen" : "Kamera starten"}
                  </button>
                  <button
                    onClick={() => onShowBarcode?.()}
                    className="px-4 py-3 rounded-2xl text-sm font-semibold bg-white/[0.04] border border-white/[0.06] text-white flex items-center justify-center gap-2"
                    data-testid="scan-hub-my-code-button"
                  >
                    <WalletCards size={16} /> Mein Code
                  </button>
                </div>

                <div className="relative">
                  <ScanBarcode size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input
                    type="text"
                    value={scanCodeInput}
                    onChange={(e) => setScanCodeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleResolveCode(scanCodeInput); }}
                    placeholder="TBL-..., BBINV-..., cs_... oder URL"
                    className="w-full py-3.5 pl-11 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm font-mono placeholder:text-[#333] outline-none focus:border-[#00C2FF]/30"
                    data-testid="scan-code-input"
                  />
                </div>

                <button
                  onClick={() => handleResolveCode(scanCodeInput)}
                  disabled={!scanCodeInput.trim() || scanBusy}
                  className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 ${scanCodeInput.trim() && !scanBusy ? "bg-[#00D26A] text-white" : "bg-white/[0.04] text-[#444] cursor-not-allowed"}`}
                  data-testid="scan-code-submit"
                >
                  {scanBusy ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  Code öffnen
                </button>

                {scanError ? (
                  <p className="text-[11px] text-red-400 text-center" data-testid="scan-hub-error">{scanError}</p>
                ) : (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]" data-testid="scan-hub-hint">
                    <Smartphone size={16} className="text-[#00C2FF]/60 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-[#555] leading-relaxed">{cameraError || scanHint}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {step === Step.AMOUNT && (
              <motion.div
                key="amount"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-5"
              >
                <div className="text-center pt-2 pb-2">
                  <p className="text-xs text-[#555] uppercase tracking-widest mb-3">{t("scan.enter_amount") || "Payment Amount"}</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-3xl text-[#555] font-light">&euro;</span>
                    <input
                      data-testid="scan-amount-input"
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-transparent text-5xl font-bold text-white text-center outline-none w-48 placeholder:text-[#222] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoFocus
                    />
                  </div>
                  {amount && !isValidAmount && (
                    <p className="text-[11px] text-red-400 mt-2">{t("scan.amount_range") || "EUR 0.50 – 2,500.00"}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((qa) => (
                    <motion.button
                      key={qa}
                      data-testid={`quick-amount-${qa}`}
                      onClick={() => setAmount(String(qa))}
                      className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                        parseFloat(amount) === qa
                          ? "bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/30"
                          : "bg-white/[0.03] border border-white/[0.05] text-[#888] hover:text-white"
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      &euro;{qa}
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  data-testid="start-scan-btn"
                  onClick={handleStartScan}
                  disabled={!isValidAmount}
                  className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2.5 transition-all ${
                    isValidAmount
                      ? "bg-gradient-to-r from-[#00C2FF] to-[#0090FF] text-white shadow-lg shadow-[#00C2FF]/20"
                      : "bg-white/[0.04] text-[#444] cursor-not-allowed"
                  }`}
                  whileTap={isValidAmount ? { scale: 0.98 } : {}}
                >
                  <ScanBarcode size={18} />
                  {t("scan.activate_scanner") || "Activate Scanner"}
                </motion.button>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <Smartphone size={16} className="text-[#00C2FF]/60 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-[#555] leading-relaxed">
                    {t("scan.hint") || "Enter the amount and scan the customer's barcode from their BidBlitz Wallet to process payment instantly."}
                  </p>
                </div>
              </motion.div>
            )}

            {step === Step.SCANNING && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-5"
              >
                <div className="text-center pt-4">
                  <div className="inline-flex items-center gap-1.5 bg-[#00C2FF]/10 border border-[#00C2FF]/20 rounded-full px-4 py-1.5">
                    <Euro size={14} className="text-[#00C2FF]" />
                    <span className="text-[#00C2FF] font-bold text-lg">{numAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="relative mx-auto w-64 h-64 rounded-2xl border-2 border-dashed border-[#00C2FF]/30 flex flex-col items-center justify-center overflow-hidden">
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00C2FF] to-transparent"
                    animate={{ y: [-120, 120] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <QrCode size={48} className="text-[#00C2FF]/30 mb-4" />
                  <p className="text-xs text-[#555] text-center px-4">
                    {t("scan.waiting") || "Scan customer barcode or enter manually"}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <ScanBarcode size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                    <input
                      ref={barcodeRef}
                      data-testid="barcode-input"
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
                      onKeyDown={handleBarcodeKeyDown}
                      placeholder={t("scan.barcode_placeholder") || "BLZ-XXXXXXXXXXXX"}
                      className="w-full py-3.5 pl-11 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm font-mono placeholder:text-[#333] outline-none focus:border-[#00C2FF]/30 transition-colors"
                      autoComplete="off"
                    />
                  </div>

                  <motion.button
                    data-testid="confirm-barcode-btn"
                    onClick={handleBarcodeSubmit}
                    disabled={barcodeInput.trim().length < 6 || processing}
                    className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                      barcodeInput.trim().length >= 6 && !processing
                        ? "bg-[#00D26A] text-white"
                        : "bg-white/[0.04] text-[#444] cursor-not-allowed"
                    }`}
                    whileTap={barcodeInput.trim().length >= 6 && !processing ? { scale: 0.98 } : {}}
                  >
                    <Zap size={16} />
                    {t("scan.charge") || "Charge Customer"}
                  </motion.button>

                  <motion.button
                    onClick={() => setStep(Step.AMOUNT)}
                    className="w-full py-2.5 text-sm text-[#555] hover:text-white transition-colors"
                    whileTap={{ scale: 0.98 }}
                    data-testid="scan-change-amount"
                  >
                    {t("scan.change_amount") || "Change Amount"}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {step === Step.PROCESSING && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center pt-24 pb-12"
              >
                <motion.div
                  className="w-20 h-20 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex items-center justify-center mb-6"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 size={32} className="text-[#00C2FF]" />
                </motion.div>
                <p className="text-white font-semibold text-base mb-1">{t("scan.processing") || "Processing Payment..."}</p>
                <p className="text-[11px] text-[#555]">{t("scan.verifying_balance") || "Verifying balance and charging wallet"}</p>
              </motion.div>
            )}

            {step === Step.SUCCESS && result && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center pt-12 pb-8"
              >
                <motion.div
                  className="w-20 h-20 rounded-full bg-[#00D26A]/15 border border-[#00D26A]/30 flex items-center justify-center mb-5"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 250, damping: 18, delay: 0.1 }}
                >
                  <CheckCircle2 size={36} className="text-[#00D26A]" />
                </motion.div>

                <motion.p className="text-lg font-semibold text-white mb-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  {t("scan.payment_success") || "Payment Successful"}
                </motion.p>

                <motion.p className="text-4xl font-bold text-[#00D26A] mb-1.5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  &euro;{result.amount.toFixed(2)}
                </motion.p>

                <motion.p className="text-xs text-[#555] mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  {t("scan.charged_from") || "Charged from"} {result.customer_name}
                </motion.p>

                <motion.div
                  className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 space-y-2.5 mb-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  data-testid="scan-success-receipt"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt size={14} className="text-[#00C2FF]/60" />
                    <span className="text-xs text-[#555] uppercase tracking-wider">{t("scan.receipt") || "Receipt"}</span>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">{t("scan.amount_label") || "Amount"}</span><span className="text-white font-medium">&euro;{result.amount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">{t("scan.fee_label") || "Fee"}</span><span className="text-[#FFB800]">&euro;{result.fee.toFixed(2)}</span></div>
                  <div className="border-t border-white/[0.05] pt-2 flex justify-between text-sm"><span className="text-[#555]">{t("scan.net_received") || "Net Received"}</span><span className="text-[#00D26A] font-semibold">&euro;{result.net_to_merchant.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#555]">{t("scan.reference") || "Reference"}</span><span className="text-white/50 font-mono text-xs">{result.reference}</span></div>
                  {result.promotion && (
                    <div data-testid="scan-promo-badge" className="flex justify-between text-sm pt-1.5 border-t border-white/[0.05]">
                      <span className="text-[#FFB800]">{t("promo.cashback")}</span>
                      <span className="text-[#FFB800] font-semibold">+&euro;{result.promotion.cashback?.toFixed(2)} ({result.promotion.name})</span>
                    </div>
                  )}
                </motion.div>

                <div className="w-full flex gap-3">
                  <motion.button data-testid="scan-done-btn" onClick={() => onNavigate("/more")} className="flex-1 py-3.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white font-medium text-sm" whileTap={{ scale: 0.97 }}>
                    {t("scan.done") || "Done"}
                  </motion.button>
                  <motion.button data-testid="scan-tip-btn" onClick={() => setShowTip(true)} className="py-3.5 px-4 bg-[#F59E0B]/15 border border-[#F59E0B]/25 rounded-xl text-[#F59E0B] font-medium text-sm flex items-center gap-1.5" whileTap={{ scale: 0.97 }}>
                    <Heart size={14} /> Trinkgeld
                  </motion.button>
                  <motion.button data-testid="scan-new-payment-btn" onClick={handleNewPayment} className="flex-1 py-3.5 bg-[#00C2FF]/15 border border-[#00C2FF]/25 rounded-xl text-[#00C2FF] font-medium text-sm" whileTap={{ scale: 0.97 }}>
                    {t("scan.new_payment") || "New Payment"}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {step === Step.ERROR && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center pt-16 pb-8"
              >
                <motion.div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                  <XCircle size={36} className="text-red-400" />
                </motion.div>

                <p className="text-lg font-semibold text-white mb-2">{t("scan.payment_failed") || "Payment Failed"}</p>
                <p className="text-sm text-[#555] text-center max-w-[280px] mb-8">{error}</p>

                <div className="w-full flex gap-3">
                  <motion.button data-testid="scan-cancel-btn" onClick={handleReset} className="flex-1 py-3.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white font-medium text-sm" whileTap={{ scale: 0.97 }}>
                    {t("scan.cancel") || "Cancel"}
                  </motion.button>
                  <motion.button data-testid="scan-retry-btn" onClick={() => setStep(Step.SCANNING)} className="flex-1 py-3.5 bg-red-500/15 border border-red-500/25 rounded-xl text-red-400 font-medium text-sm" whileTap={{ scale: 0.97 }}>
                    {t("scan.try_again") || "Try Again"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {tool === Tool.CASHIER && step === Step.AMOUNT && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-1.5 text-[#333]">
            <ShieldCheck size={12} />
            <span className="text-[10px]">{t("scan.secured") || "End-to-end encrypted"}</span>
          </div>
        </div>
      )}

      {result && tool === Tool.CASHIER && (
        <TipModal
          isOpen={showTip}
          onClose={() => setShowTip(false)}
          billAmount={result.amount || 0}
          posCustomerId={result.customer_id || ""}
          transactionId={result.transaction_id || ""}
          onTipSent={() => wallet.refreshWallet()}
        />
      )}
    </div>
  );
};

export default ScannerPage;