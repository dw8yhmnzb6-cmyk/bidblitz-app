import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, User, QrCode, Mail, Users, Send, Loader2, ChevronRight, Search, Sparkles, CheckCircle2, AlertCircle, Clock, Plus } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { CameraPreview } from "@capgo/camera-preview";
import { NativeSettings, AndroidSettings, IOSSettings } from "capacitor-native-settings";
import { useI18n, useUser } from "../store";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { api } from "../services/api";

const spring = { type: "spring", damping: 25, stiffness: 300 };
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
const BARCODE_RE = /^(BLZ-[A-F0-9]{12}(-[A-F0-9]{8})?|BLZ-[A-F0-9]{4}-[A-F0-9]{4})$/;
const SUPPORTED_SCAN_FORMATS = ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "code_93", "codabar"];
const SCAN_REARM_DELAY_MS = 1500;

const swallowMaybePromise = (result) => {
  if (result && typeof result.catch === "function") {
    result.catch(() => {});
  }
};

const normalizeScannerErrorMessage = (error, fallback) => {
  const message = typeof error === "string" ? error : error?.message || "";
  if (!message) return fallback;
  if (
    message.includes("No MultiFormat Readers were able to detect the code") ||
    message.includes("No barcode or QR code detected") ||
    message.includes("QR code parse error")
  ) {
    return fallback;
  }
  return message;
};

const normalizeAmount = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function SendMoneyPage({ onBack, onNavigate, currentBalance = 0 }) {
  const { lang, t } = useI18n();
  const user = useUser();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  const L = {
    de: { badge: "Privat bezahlen", title: "Geld senden", available: "Verfügbar", privateOnly: "Nur für private Transfers: Kontakt, Username, E-Mail, BidBlitz ID oder privater QR.", privateSend: "Privat senden", privateSendDesc: "An Kunden, Freunde, Familie oder Kontakte.", privateSendCta: "Tippen, um Empfänger zu suchen", merchantQuestion: "Für Händler-Kasse?", merchantHint: 'Dann "Bezahlen" statt "Geld senden"', username: "Username", scan: "Scannen", contacts: "Kontakte", email: "E-Mail", searchPlaceholder: "Username, E-Mail oder BidBlitz ID...", found: "Gefunden", amountTitle: "Betrag eingeben", availableShort: "Verfügbar", messagePlaceholder: "Nachricht hinzufügen...", sendNow: "senden", freeInstant: "Kostenlos & sofort • Keine Gebühren", sentTitle: "Gesendet!", sentSubtitle: "Geld erfolgreich überwiesen", recipientLabel: "Empfänger", newBalance: "Neues Guthaben", done: "Fertig", scanningBadge: "Scannen", scanTitle: "Empfänger-Code scannen", scanAlignHint: "Richte QR- oder BLZ-Code mittig aus", privateScanHint: "Für private Sendungen nur passende Empfänger-Codes verwenden. Händler-Kassencodes gehören in den Bezahlen-Flow.", startCamera: "Scanner erneut starten", choosePhoto: "Foto wählen", manualCodePlaceholder: "BLZ- Code manuell eingeben", verifyCode: "Code prüfen", merchantCodeError: "Dieser Barcode gehört zur Händler-Kasse. Für private Sendungen bitte einen privaten Empfänger-Code scannen.", codeReadFailed: "Code konnte nicht gelesen werden.", imageReadFailed: "Code konnte aus Foto nicht erkannt werden.", cameraUnavailable: "Kamera nicht verfügbar.", cameraStartFailed: "Kamera konnte nicht gestartet werden.", cameraPermissionDenied: "Kamerazugriff verweigert. Bitte erlaube den Zugriff in den iPhone-Einstellungen.", openSettings: "Einstellungen öffnen", cameraAutoStarting: "Kamera wird automatisch gestartet …", cameraEmbeddedHint: "Halte den Empfänger-Code direkt in die Scan-Fläche. Der Scan startet sofort.", sentTimesSuffix: "x gesendet" },
    en: { badge: "Private payment", title: "Send money", available: "Available", privateOnly: "For private transfers only: contact, username, email, BidBlitz ID or private QR.", privateSend: "Send privately", privateSendDesc: "To customers, friends, family or contacts.", privateSendCta: "Tap to search for a recipient", merchantQuestion: "For merchant checkout?", merchantHint: 'Then open "Pay" instead of "Send money"', username: "Username", scan: "Scan", contacts: "Contacts", email: "Email", searchPlaceholder: "Username, email or BidBlitz ID...", found: "Found", amountTitle: "Enter amount", availableShort: "Available", messagePlaceholder: "Add a message...", sendNow: "send", freeInstant: "Free & instant • No fees", sentTitle: "Sent!", sentSubtitle: "Money transferred successfully", recipientLabel: "Recipient", newBalance: "New balance", done: "Done", scanningBadge: "Scan", scanTitle: "Scan recipient code", scanAlignHint: "Align QR or BLZ code in the center", privateScanHint: "Only use matching recipient codes for private transfers. Merchant cashier codes belong in the Pay flow.", startCamera: "Restart scanner", choosePhoto: "Choose photo", manualCodePlaceholder: "Enter BLZ code manually", verifyCode: "Check code", merchantCodeError: "This barcode belongs to merchant checkout. For private transfers, scan a private recipient code.", codeReadFailed: "Code could not be read.", imageReadFailed: "Could not detect a code from the image.", cameraUnavailable: "Camera unavailable.", cameraStartFailed: "Could not start camera.", cameraPermissionDenied: "Camera access was denied. Please allow it in iPhone Settings.", openSettings: "Open settings", cameraAutoStarting: "Starting camera automatically…", cameraEmbeddedHint: "Hold the recipient code inside the scan area. Scanning starts immediately.", sentTimesSuffix: "x sent" },
    sq: { badge: "Pagesë private", title: "Dërgo para", available: "Në dispozicion", privateOnly: "Vetëm për transfere private: kontakt, username, email, BidBlitz ID ose QR privat.", privateSend: "Dërgo privatisht", privateSendDesc: "Te klientët, miqtë, familja ose kontaktet.", privateSendCta: "Prek për të kërkuar marrësin", merchantQuestion: "Për arkën e tregtarit?", merchantHint: 'Atëherë hap "Paguaj" në vend të "Dërgo para"', username: "Username", scan: "Skano", contacts: "Kontaktet", email: "Email", searchPlaceholder: "Username, email ose BidBlitz ID...", found: "U gjet", amountTitle: "Shkruaj shumën", availableShort: "Në dispozicion", messagePlaceholder: "Shto mesazh...", sendNow: "dërgo", freeInstant: "Pa pagesë & menjëherë • Pa tarifa", sentTitle: "U dërgua!", sentSubtitle: "Paratë u transferuan me sukses", recipientLabel: "Marrësi", newBalance: "Bilanci i ri", done: "Përfundo", scanningBadge: "Skanim", scanTitle: "Skano kodin e marrësit", scanAlignHint: "Vendose kodin QR ose BLZ në qendër", privateScanHint: "Për transfere private përdor vetëm kode të sakta të marrësit. Kodet e arkës së tregtarit i përkasin flow-it Paguaj.", startCamera: "Rinis skanerin", choosePhoto: "Zgjidh foto", manualCodePlaceholder: "Shkruaj manualisht kodin BLZ", verifyCode: "Verifiko kodin", merchantCodeError: "Ky barcode i përket arkës së tregtarit. Për dërgesa private skano kod privat të marrësit.", codeReadFailed: "Kodi nuk u lexua dot.", imageReadFailed: "Kodi nuk u dallua nga fotoja.", cameraUnavailable: "Kamera nuk është e disponueshme.", cameraStartFailed: "Kamera nuk u nis dot.", cameraPermissionDenied: "Qasja në kamerë u refuzua. Lejoje te cilësimet e iPhone.", openSettings: "Hap cilësimet", cameraAutoStarting: "Kamera po niset automatikisht…", cameraEmbeddedHint: "Mbaje kodin e marrësit brenda zonës së skanimit. Skanimi nis menjëherë.", sentTimesSuffix: "herë dërguar" },
    ar: { badge: "دفع خاص", title: "إرسال المال", available: "المتاح", privateOnly: "للتحويلات الخاصة فقط: جهة اتصال أو اسم مستخدم أو بريد إلكتروني أو BidBlitz ID أو QR خاص.", privateSend: "إرسال خاص", privateSendDesc: "إلى العملاء أو الأصدقاء أو العائلة أو جهات الاتصال.", privateSendCta: "اضغط للبحث عن المستلم", merchantQuestion: "لصندوق التاجر؟", merchantHint: 'افتح "الدفع" بدلًا من "إرسال المال"', username: "اسم المستخدم", scan: "مسح", contacts: "جهات الاتصال", email: "البريد الإلكتروني", searchPlaceholder: "اسم المستخدم أو البريد الإلكتروني أو BidBlitz ID...", found: "تم العثور", amountTitle: "أدخل المبلغ", availableShort: "المتاح", messagePlaceholder: "أضف رسالة...", sendNow: "إرسال", freeInstant: "فوري ومجاني • بدون رسوم", sentTitle: "تم الإرسال!", sentSubtitle: "تم تحويل المال بنجاح", recipientLabel: "المستلم", newBalance: "الرصيد الجديد", done: "تم", scanningBadge: "مسح", scanTitle: "امسح رمز المستلم", scanAlignHint: "ضع رمز QR أو BLZ في المنتصف", privateScanHint: "استخدم فقط رموز المستلم المناسبة للتحويلات الخاصة. أكواد صندوق التاجر تخص مسار الدفع.", startCamera: "إعادة تشغيل الماسح", choosePhoto: "اختر صورة", manualCodePlaceholder: "أدخل رمز BLZ يدويًا", verifyCode: "تحقق من الرمز", merchantCodeError: "هذا الباركود يخص صندوق التاجر. للتحويلات الخاصة امسح رمز مستلم خاص.", codeReadFailed: "تعذر قراءة الرمز.", imageReadFailed: "تعذر اكتشاف الرمز من الصورة.", cameraUnavailable: "الكاميرا غير متاحة.", cameraStartFailed: "تعذر تشغيل الكاميرا.", cameraPermissionDenied: "تم رفض الوصول إلى الكاميرا. يرجى السماح به في إعدادات iPhone.", openSettings: "فتح الإعدادات", cameraAutoStarting: "يتم تشغيل الكاميرا تلقائيًا…", cameraEmbeddedHint: "ضع رمز المستلم داخل مساحة المسح. يبدأ المسح فورًا.", sentTimesSuffix: "مرة إرسال" },
  }[locale];
  const [step, setStep] = useState(1);
  const [activeList, setActiveList] = useState("saved");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(normalizeAmount(currentBalance ?? user?.balance));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [savedRecipients, setSavedRecipients] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanCodeInput, setScanCodeInput] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraPreparing, setCameraPreparing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraEngine, setCameraEngine] = useState(null);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [quickActionMode, setQuickActionMode] = useState("all");
  const searchTimeout = useRef(null);
  const inputRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const html5ScannerRef = useRef(null);
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const scanLockRef = useRef(false);
  const nativeScannerListenerRef = useRef(null);
  const nativeScannerErrorListenerRef = useRef(null);
  const appStateListenerRef = useRef(null);

  const prefersImageCapture = typeof navigator !== "undefined" && /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const isNativeCapacitor = typeof Capacitor?.isNativePlatform === "function" ? Capacitor.isNativePlatform() : false;
  const capacitorPlatform = typeof Capacitor?.getPlatform === "function" ? Capacitor.getPlatform() : "web";
  const useEmbeddedNativeScanner = isNativeCapacitor && (capacitorPlatform === "ios" || capacitorPlatform === "android");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [balanceRes, recentRes, savedRes] = await Promise.all([
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet/balance`, { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/recipients/recent`, { credentials: "include" }).then(r => r.ok ? r.json() : { recipients: [] }).catch(() => ({ recipients: [] })),
          fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet/saved-recipients`, { credentials: "include" }).then(r => r.ok ? r.json() : { recipients: [] }).catch(() => ({ recipients: [] })),
        ]);

        if (balanceRes?.balance !== undefined) setBalance(normalizeAmount(balanceRes.balance));
        else if (user?.balance !== undefined) setBalance(normalizeAmount(user.balance));

        setRecentContacts(recentRes?.recipients || []);
        setSavedRecipients(savedRes?.recipients || []);
        if ((savedRes?.recipients || []).length === 0 && (recentRes?.recipients || []).length > 0) {
          setActiveList("recent");
        }
      } catch (loadError) {
        void loadError;
      }
    };

    loadData();
  }, [user?.balance]);

  useEffect(() => {
    if (step === 2 && inputRef.current) inputRef.current.focus();
  }, [step]);

  const focusPrivateSearch = useCallback(() => {
    setQuickActionMode("all");
    requestAnimationFrame(() => {
      searchInputRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      searchInputRef.current?.focus?.();
    });
  }, []);

  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (nativeScannerListenerRef.current) {
      swallowMaybePromise(nativeScannerListenerRef.current.remove?.());
      nativeScannerListenerRef.current = null;
    }
    if (nativeScannerErrorListenerRef.current) {
      swallowMaybePromise(nativeScannerErrorListenerRef.current.remove?.());
      nativeScannerErrorListenerRef.current = null;
    }
    if (useEmbeddedNativeScanner) {
      swallowMaybePromise(CameraPreview.stopBarcodeScanner());
      swallowMaybePromise(CameraPreview.stop({ force: true }));
    }
    if (html5ScannerRef.current) {
      const scanner = html5ScannerRef.current;
      try {
        const state = typeof scanner.getState === "function" ? scanner.getState() : null;
        const canStop = state === 2 || state === 3 || state === "SCANNING" || state === "PAUSED";
        if (canStop && typeof scanner.stop === "function") {
          const stopResult = scanner.stop();
          if (stopResult && typeof stopResult.catch === "function") {
            stopResult.catch(() => {}).finally(() => {
              if (scanner.clear && typeof scanner.clear === "function") {
                const clearResult = scanner.clear();
                if (clearResult && typeof clearResult.catch === "function") {
                  clearResult.catch(() => {});
                }
              }
            });
          } else if (scanner.clear && typeof scanner.clear === "function") {
            const clearResult = scanner.clear();
            if (clearResult && typeof clearResult.catch === "function") {
              clearResult.catch(() => {});
            }
          }
        } else if (scanner.clear && typeof scanner.clear === "function") {
          const clearResult = scanner.clear();
          if (clearResult && typeof clearResult.catch === "function") {
            clearResult.catch(() => {});
          }
        }
      } catch (scannerStopError) {
        void scannerStopError;
      }
      html5ScannerRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    scanLockRef.current = false;
    setCameraPreparing(false);
    setCameraActive(false);
    setCameraEngine(null);
  }, [useEmbeddedNativeScanner]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!useEmbeddedNativeScanner || !showScanner) return undefined;

    const className = "native-send-money-scanner-active";
    const rootEl = document.getElementById("root");
    document.documentElement.classList.add(className);
    document.body.classList.add(className);
    rootEl?.classList.add(className);

    return () => {
      document.documentElement.classList.remove(className);
      document.body.classList.remove(className);
      rootEl?.classList.remove(className);
    };
  }, [showScanner, useEmbeddedNativeScanner]);

  const resolvePrivateRecipientByCode = useCallback(async (rawCode) => {
    const normalizedCode = (rawCode || "").trim().toUpperCase();
    if (!normalizedCode) return null;

    const lookupTypes = normalizedCode.startsWith("BLZ-")
      ? ["bidblitz_id", "auto"]
      : ["auto"];

    for (const type of lookupTypes) {
      try {
        const lookupRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ query: normalizedCode, type }),
        });

        if (!lookupRes.ok) continue;
        const lookupData = await lookupRes.json();
        if (lookupData?.recipient) return lookupData.recipient;
      } catch (lookupError) {
        void lookupError;
      }
    }

    return null;
  }, []);

  const handleScanResolvedCode = useCallback(async (value) => {
    const code = (value || "").trim();
    const normalizedCode = code.toUpperCase();
    if (!code) return;
    setScanBusy(true);
    setCameraError("");

    try {
      if (code.startsWith("{") || code.startsWith("http") || code.length > 30) {
        const qrRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/qr/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ qr_data: code }),
        });
        if (!qrRes.ok) {
          const qrErr = await qrRes.json().catch(() => ({}));
          setCameraError(qrErr.detail || "QR-Code konnte nicht gelesen werden.");
          return;
        }
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          if (qrData?.recipient) {
            selectRecipient({ ...qrData.recipient, transfer_method: "qr", preset_amount: qrData.preset_amount || null });
            if (qrData.preset_amount) setAmount(String(qrData.preset_amount));
            stopCamera();
            setShowScanner(false);
            return;
          }
        }
      }

      if (BARCODE_RE.test(normalizedCode)) {
        const privateRecipient = await resolvePrivateRecipientByCode(normalizedCode);
        if (privateRecipient) {
          selectRecipient({ ...privateRecipient, transfer_method: "bidblitz_id" });
          stopCamera();
          setShowScanner(false);
          return;
        }
      }

      const res = await api.resolveScanCode({ code: normalizedCode });
      if (res.type === "wallet_barcode") {
        const privateRecipient = await resolvePrivateRecipientByCode(normalizedCode);
        if (privateRecipient) {
          selectRecipient({ ...privateRecipient, transfer_method: "bidblitz_id" });
          stopCamera();
          setShowScanner(false);
          return;
        }
        setCameraError(res.message || L.merchantCodeError);
        return;
      }
      setCameraError(res.message || "Dieser Code ist nicht für privates Senden gedacht.");
    } catch (scanError) {
      if (BARCODE_RE.test(normalizedCode)) {
        const privateRecipient = await resolvePrivateRecipientByCode(normalizedCode);
        if (privateRecipient) {
          selectRecipient({ ...privateRecipient, transfer_method: "bidblitz_id" });
          stopCamera();
          setShowScanner(false);
          return;
        }
      }
      setCameraError(scanError?.message || L.codeReadFailed);
    } finally {
      setScanBusy(false);
    }
  }, [L.codeReadFailed, L.merchantCodeError, resolvePrivateRecipientByCode, stopCamera]);

  const openNativeImageCapture = useCallback(() => {
    setCameraError("");
    fileInputRef.current?.click();
  }, []);

  const openCameraSettings = useCallback(async () => {
    try {
      if (capacitorPlatform === "ios") {
        await NativeSettings.openIOS({ option: IOSSettings.App });
      } else {
        await NativeSettings.open({
          optionAndroid: AndroidSettings.ApplicationDetails,
          optionIOS: IOSSettings.App,
        });
      }
    } catch (settingsError) {
      console.error("[SendMoneyPage] open settings failed", settingsError);
    }
  }, [capacitorPlatform]);

  const handleImageFileSelected = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCameraPreparing(true);
    try {
      stopCamera();
      setCameraEngine("html5");
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      await new Promise((resolve) => setTimeout(resolve, 60));
      const scanner = new Html5Qrcode("send-money-scan-reader", {
        experimentalFeatures: { useBarCodeDetectorIfSupported: false },
        useBarCodeDetectorIfSupported: false,
        verbose: false,
      });
      html5ScannerRef.current = scanner;
      const decodedText = await scanner.scanFile(file, true);
      setScanCodeInput(decodedText);
      await handleScanResolvedCode(decodedText);
    } catch (scanFileError) {
      try {
        if ("BarcodeDetector" in window && typeof window.createImageBitmap === "function") {
          const supported = typeof window.BarcodeDetector.getSupportedFormats === "function"
            ? await window.BarcodeDetector.getSupportedFormats()
            : SUPPORTED_SCAN_FORMATS;
          const formats = SUPPORTED_SCAN_FORMATS.filter((format) => supported.includes(format));
          const detector = new window.BarcodeDetector({ formats: formats.length ? formats : ["qr_code"] });
          const bitmap = await window.createImageBitmap(file);
          try {
            const detections = await detector.detect(bitmap);
            const fallbackValue = detections?.[0]?.rawValue?.trim();
            if (fallbackValue) {
              setScanCodeInput(fallbackValue);
              await handleScanResolvedCode(fallbackValue);
              return;
            }
          } finally {
            bitmap.close?.();
          }
        }
      } catch (fallbackDetectionError) {
        void fallbackDetectionError;
      }

      setCameraError(normalizeScannerErrorMessage(scanFileError, L.imageReadFailed));
    } finally {
      setCameraPreparing(false);
      stopCamera();
    }
  }, [L.imageReadFailed, handleScanResolvedCode, stopCamera]);

  const startScanner = useCallback(async () => {
    setCameraError("");
    setCameraPermissionDenied(false);

    if (useEmbeddedNativeScanner) {
      const previewHost = document.getElementById("send-money-scan-reader");
      if (!previewHost) {
        setCameraError(L.cameraUnavailable);
        return;
      }

      try {
        setCameraPreparing(true);
        stopCamera();

        const permissionState = await CameraPreview.checkPermissions({ disableAudio: true });
        let granted = permissionState?.camera === "granted";

        if (!granted) {
          const requested = await CameraPreview.requestPermissions({
            disableAudio: true,
            showSettingsAlert: false,
            title: L.scanTitle,
            message: L.cameraPermissionDenied,
            openSettingsButtonTitle: L.openSettings,
            cancelButtonTitle: t("common.cancel") || "Abbrechen",
          });
          granted = requested?.camera === "granted";
        }

        if (!granted) {
          setCameraPermissionDenied(true);
          setCameraError(L.cameraPermissionDenied);
          setCameraPreparing(false);
          return;
        }

        await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
        await new Promise((resolve) => setTimeout(resolve, 180));

        const rect = previewHost.getBoundingClientRect();

        nativeScannerListenerRef.current = await CameraPreview.addListener("barcodeScanned", async ({ barcodes = [] }) => {
          const firstMatch = barcodes.find((entry) => entry?.value || entry?.rawValue || entry?.displayValue);
          const decodedText = firstMatch?.value || firstMatch?.rawValue || firstMatch?.displayValue || "";
          if (!decodedText || scanLockRef.current) return;
          scanLockRef.current = true;
          setScanCodeInput(decodedText);
          await handleScanResolvedCode(decodedText);
          setTimeout(() => { scanLockRef.current = false; }, SCAN_REARM_DELAY_MS);
        });

        nativeScannerErrorListenerRef.current = await CameraPreview.addListener("barcodeScanError", ({ message }) => {
          if (message) console.warn("[SendMoneyPage] native barcode scan warning", message);
        });

        await CameraPreview.start({
          parent: "send-money-scan-reader",
          className: "send-money-native-preview",
          position: "rear",
          toBack: true,
          disableAudio: true,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          aspectMode: "cover",
          rotateWhenOrientationChanged: true,
          barcodeScanner: {
            formats: SUPPORTED_SCAN_FORMATS,
            detectionInterval: 350,
          },
        });

        setCameraEngine("capacitor-native");
        setCameraActive(true);
        setCameraPreparing(false);
        return;
      } catch (scannerError) {
        console.error("[SendMoneyPage] native scanner start failed", scannerError);
        stopCamera();
        const message = scannerError?.message || L.cameraStartFailed;
        const denied = /denied|permission|not authorized|not allowed/i.test(message);
        setCameraPermissionDenied(denied);
        setCameraError(denied ? L.cameraPermissionDenied : message);
        setCameraPreparing(false);
        return;
      }
    }

    if (prefersImageCapture) {
      openNativeImageCapture();
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(L.cameraUnavailable);
      return;
    }

    try {
      setCameraPreparing(true);
      const preferHtml5Fallback = /iPad|iPhone|iPod/i.test(navigator.userAgent) || typeof window === "undefined" || !("BarcodeDetector" in window);
      if (preferHtml5Fallback) {
        setCameraEngine("html5");
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
        await new Promise((resolve) => setTimeout(resolve, 60));
        const scanner = new Html5Qrcode("send-money-scan-reader", {
          experimentalFeatures: { useBarCodeDetectorIfSupported: false },
          useBarCodeDetectorIfSupported: false,
          verbose: false,
        });
        html5ScannerRef.current = scanner;

        const onScanSuccess = async (decodedText) => {
          if (scanLockRef.current) return;
          scanLockRef.current = true;
          setScanCodeInput(decodedText);
          await handleScanResolvedCode(decodedText);
          setTimeout(() => { scanLockRef.current = false; }, 1500);
        };

        const config = {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          rememberLastUsedCamera: true,
          formatsToSupport: HTML5_SUPPORTED_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: false },
          videoConstraints: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        };

        try {
          await scanner.start({ facingMode: { exact: "environment" } }, config, onScanSuccess, () => {});
        } catch {
          await scanner.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
        }

        setCameraEngine("html5");
        setCameraActive(true);
        setCameraPreparing(false);
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setCameraEngine("native");
      setCameraPreparing(false);
    } catch (scannerError) {
      stopCamera();
      setCameraError(scannerError?.message || L.cameraStartFailed);
    }
  }, [L.cameraPermissionDenied, L.cameraStartFailed, L.cameraUnavailable, L.openSettings, L.scanTitle, handleScanResolvedCode, openNativeImageCapture, prefersImageCapture, stopCamera, t, useEmbeddedNativeScanner]);

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
            await handleScanResolvedCode(rawValue);
            setTimeout(() => { scanLockRef.current = false; }, 1500);
          }
        }
      } catch (nativeScanError) {
        void nativeScanError;
      }

      if (!cancelled) setTimeout(scanLoop, 700);
    };

    scanLoop();
    return () => { cancelled = true; };
  }, [cameraActive, cameraEngine, handleScanResolvedCode]);

  useEffect(() => {
    if (!showScanner) {
      stopCamera();
      return undefined;
    }

    if (prefersImageCapture && !useEmbeddedNativeScanner) {
      return undefined;
    }

    setScanCodeInput("");
    setCameraError("");
    setCameraPermissionDenied(false);

    const timeout = setTimeout(() => {
      startScanner();
    }, 220);

    return () => {
      clearTimeout(timeout);
      stopCamera();
    };
  }, [prefersImageCapture, showScanner, startScanner, stopCamera, useEmbeddedNativeScanner]);

  useEffect(() => {
    if (!useEmbeddedNativeScanner) return undefined;

    let cancelled = false;
    const registerListener = async () => {
      try {
        appStateListenerRef.current = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
          if (!cancelled && isActive && showScanner && cameraPermissionDenied) {
            startScanner();
          }
        });
      } catch (listenerError) {
        console.error("[SendMoneyPage] appState listener failed", listenerError);
      }
    };

    registerListener();

    return () => {
      cancelled = true;
      swallowMaybePromise(appStateListenerRef.current?.remove?.());
      appStateListenerRef.current = null;
    };
  }, [cameraPermissionDenied, showScanner, startScanner, useEmbeddedNativeScanner]);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setError(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ query, type: quickActionMode === "username" ? "username" : quickActionMode === "email" ? "email" : quickActionMode === "contacts" ? (query.includes("@") ? "email" : "username") : "auto" }),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.recipient ? [data.recipient] : []);
        }
      } catch (lookupError) {
        void lookupError;
        setSearchResults([]);
      }
    }, 300);
  };

  const selectRecipient = (r) => {
    setRecipient(r);
    setStep(2);
    setError(null);
  };

  const handleQuickAction = useCallback((mode) => {
    setQuickActionMode(mode);
    setError(null);
    if (mode === "scan") {
      setShowScanner(true);
      return;
    }
    setShowScanner(false);
    stopCamera();
    if (mode === "contacts") {
      setActiveList("recent");
    }
  }, [stopCamera]);

  const quickActionPlaceholder = {
    all: L.searchPlaceholder,
    username: `${L.username}...`,
    contacts: `${L.contacts}...`,
    email: `${L.email}...`,
    scan: L.searchPlaceholder,
  };

  const handleAmountChange = (val) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
  };

  const addAmount = (val) => {
    const current = parseFloat(amount) || 0;
    const newAmount = Math.min(current + val, balance);
    setAmount(newAmount.toFixed(2));
  };

  const setMax = () => setAmount(balance.toFixed(2));

  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 0.01) return setError("Mindestbetrag: €0.01");
    if (numAmount > balance) return setError("Nicht genügend Guthaben");

    setLoading(true);
    setError(null);
    try {
      if (recipient.transfer_method === "merchant_barcode_preview") {
        throw new Error("Dieser Barcode gehört zum Händler-Kassieren. Bitte nutze 'Bezahlen' im Wallet für Händler-Zahlungen.");
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipient_id: recipient.user_id,
          amount: numAmount,
          message: message || null,
          transfer_method: "direct",
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Überweisung fehlgeschlagen");
      }
      const data = await res.json();
      setResult(data);
      setStep(3);
    } catch (sendError) {
      setError(sendError.message || "Überweisung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [5, 10, 20, 50];
  const visibleSavedRecipients = savedRecipients || [];
  const visibleRecentContacts = recentContacts || [];
  const hasSavedRecipients = visibleSavedRecipients.length > 0;
  const hasRecentContacts = visibleRecentContacts.length > 0;

  return (
    <motion.div data-testid="send-money-page" data-cookie-banner-suppress="true" className="min-h-screen bg-[#f8fafc] pb-[calc(var(--app-mobile-content-offset,6rem)+1rem)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="sticky top-0 z-30 bg-[#f8fafc]/95 backdrop-blur-xl border-b border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button data-testid="send-money-page-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
            <ArrowLeft size={18} className="text-slate-600" />
          </motion.button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00A6E6]">{L.badge}</p>
            <h1 className="text-[20px] font-bold text-slate-950">{L.title}</h1>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="list" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22 }}>
            <div className="px-4 pt-4 pb-6">
              <div className="p-5 rounded-[28px] bg-gradient-to-br from-[#00C2FF]/12 to-[#8B5CF6]/10 border border-[#00C2FF]/18 mb-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                <p className="text-[12px] text-[#00A6E6] font-medium mb-1">{L.available}</p>
                <p className="text-[36px] font-bold text-slate-900 tracking-tight">€{balance.toFixed(2)}</p>
                <p className="text-[11px] text-slate-600 mt-1">{L.privateOnly}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <motion.button
                  type="button"
                  data-testid="send-money-private-send-card"
                  onClick={focusPrivateSearch}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-left transition-all hover:border-[#8B5CF6]/35 hover:bg-white"
                >
                  <p className="text-[12px] font-semibold text-[#8B5CF6]">{L.privateSend}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{L.privateSendDesc}</p>
                  <p className="mt-2 text-[10px] font-semibold text-slate-500">{L.privateSendCta}</p>
                </motion.button>
                <motion.button data-testid="send-money-go-pay" onClick={() => onNavigate?.('/pay')} whileTap={{ scale: 0.98 }} className="rounded-2xl border border-[#00C2FF]/18 bg-[#00C2FF]/8 px-4 py-3 text-left">
                  <span className="block text-[12px] font-semibold text-[#00A6E6]">{L.merchantQuestion}</span>
                  <span className="mt-1 block text-[11px] text-slate-600">{L.merchantHint}</span>
                </motion.button>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { icon: User, label: L.username, color: "#8B5CF6", mode: "username", testId: "send-money-open-username" },
                  { icon: QrCode, label: L.scan, color: "#00C2FF", mode: "scan", testId: "send-money-open-scan" },
                  { icon: Users, label: L.contacts, color: "#10B981", mode: "contacts", testId: "send-money-open-contacts" },
                  { icon: Mail, label: L.email, color: "#F59E0B", mode: "email", testId: "send-money-open-email" },
                ].map((item, i) => (
                  <motion.button key={i} type="button" data-testid={item.testId} aria-pressed={quickActionMode === item.mode} onClick={() => handleQuickAction(item.mode)} className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all ${quickActionMode === item.mode ? "border-slate-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]" : "border-transparent"}`} style={{ background: `${item.color}10` }} whileTap={{ scale: 0.95 }}>
                    <item.icon size={22} style={{ color: item.color }} />
                    <span className="text-[10px] font-semibold text-slate-700">{item.label}</span>
                  </motion.button>
                ))}
              </div>

              <AnimatePresence>
                {showScanner && (
                  <motion.div data-testid="send-money-inline-scan-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mb-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00A6E6]">{L.scanningBadge}</p>
                        <h3 className="text-[20px] font-bold text-slate-950">{L.scanTitle}</h3>
                      </div>
                      <motion.button data-testid="send-money-scan-close" onClick={() => { setShowScanner(false); stopCamera(); }} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                        <ArrowLeft size={18} className="text-slate-600" />
                      </motion.button>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-4 mb-4">
                      <div id="send-money-scan-reader" data-testid="send-money-scanner-surface" className={`relative overflow-hidden rounded-2xl min-h-[260px] flex items-center justify-center ${cameraEngine === "capacitor-native" ? "bg-transparent border border-white/20" : "bg-slate-100"}`}>
                        {cameraEngine === "native" ? (
                          <video ref={videoRef} className="w-full h-[260px] object-cover rounded-2xl" playsInline muted autoPlay />
                        ) : (
                          <div className="text-center px-4 relative z-[1]">
                            {cameraPreparing ? <Loader2 size={28} className="animate-spin text-[#00C2FF] mx-auto" /> : <QrCode size={32} className="text-slate-300 mx-auto" />}
                            <p className={`mt-3 text-[12px] ${cameraEngine === "capacitor-native" ? "text-white" : "text-slate-500"}`}>{cameraPreparing ? L.cameraAutoStarting : L.scanAlignHint}</p>
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-8">
                          <div className="w-full max-w-[240px] h-[240px] rounded-[30px] border-2 border-white/80 shadow-[0_0_0_999px_rgba(15,23,42,0.18)]" />
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] text-slate-500">{useEmbeddedNativeScanner ? L.cameraEmbeddedHint : L.privateScanHint}</p>
                    </div>

                    {(cameraPermissionDenied || cameraError || !cameraActive) ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {cameraPermissionDenied ? (
                          <motion.button data-testid="send-money-open-camera-settings" onClick={openCameraSettings} whileTap={{ scale: 0.98 }} className="min-h-[48px] rounded-2xl bg-[#00C2FF] text-slate-950 font-bold">{L.openSettings}</motion.button>
                        ) : (
                          <motion.button data-testid="send-money-start-camera" onClick={startScanner} whileTap={{ scale: 0.98 }} className="min-h-[48px] rounded-2xl bg-[#00C2FF] text-slate-950 font-bold">{L.startCamera}</motion.button>
                        )}
                        <motion.button data-testid="send-money-open-photo-scan" onClick={openNativeImageCapture} whileTap={{ scale: 0.98 }} className="min-h-[48px] rounded-2xl border border-slate-200 bg-white text-slate-800 font-semibold">{L.choosePhoto}</motion.button>
                      </div>
                    ) : null}

                    <div className="relative mb-3">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input data-testid="send-money-scan-code-input" value={scanCodeInput} onChange={(e) => setScanCodeInput(e.target.value)} placeholder={L.manualCodePlaceholder} className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-[15px] placeholder-slate-400 outline-none focus:border-[#00C2FF]/40" />
                    </div>
                    <motion.button data-testid="send-money-scan-submit" onClick={() => handleScanResolvedCode(scanCodeInput)} whileTap={{ scale: 0.98 }} disabled={scanBusy || !scanCodeInput.trim()} className="w-full min-h-[48px] rounded-2xl border border-slate-200 bg-slate-100 text-slate-900 font-semibold disabled:opacity-50">
                      {scanBusy ? <Loader2 size={18} className="animate-spin mx-auto" /> : L.verifyCode}
                    </motion.button>

                    {cameraError ? <div data-testid="send-money-camera-error" className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-500">{cameraError}</div> : null}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageFileSelected} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative mb-5">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  data-testid="send-money-search-input"
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={quickActionPlaceholder[quickActionMode] || L.searchPlaceholder}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-[15px] placeholder-slate-400 outline-none focus:border-[#00C2FF]/40"
                  autoFocus
                />
              </div>

              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-5">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-3">{L.found}</p>
                    {searchResults.map((r) => (
                      <motion.button data-testid={`send-money-search-result-${r.user_id}`} key={r.user_id} onClick={() => selectRecipient(r)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#00C2FF]/5 border border-[#00C2FF]/20 mb-2" whileTap={{ scale: 0.98 }}>
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[20px] font-bold text-white">{r.name?.[0]?.toUpperCase() || "?"}</div>
                        <div className="flex-1 text-left">
                          <p className="text-[16px] font-semibold text-slate-900">{r.name}</p>
                          <p className="text-[12px] text-[#00C2FF]">{r.username ? `@${r.username}` : r.bidblitz_id}</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-300" />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mb-4">
                <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                  <button type="button" aria-pressed={activeList === "saved"} data-testid="send-money-tab-saved" onClick={() => setActiveList("saved")} className={`flex-1 min-h-[48px] py-3 rounded-xl font-semibold text-[13px] transition-colors touch-manipulation ${activeList === "saved" ? "bg-[#00C2FF] text-slate-950 shadow-[0_6px_16px_rgba(0,194,255,0.22)]" : "text-slate-600 bg-transparent"}`}>⭐ {t("wallet.saved")}</button>
                  <button type="button" aria-pressed={activeList === "recent"} data-testid="send-money-tab-recent" onClick={() => setActiveList("recent")} className={`flex-1 min-h-[48px] py-3 rounded-xl font-semibold text-[13px] transition-colors touch-manipulation ${activeList === "recent" ? "bg-[#00C2FF] text-slate-950 shadow-[0_6px_16px_rgba(0,194,255,0.22)]" : "text-slate-600 bg-transparent"}`}>🕐 {t("wallet.recent")}</button>
                </div>
              </div>

              {activeList === "saved" && hasSavedRecipients && (
                <div className="grid grid-cols-2 gap-3">
                  {visibleSavedRecipients.map((saved) => {
                    const iconMap = { family: "👨‍👩‍👧", friend: "👤", work: "💼", star: "⭐", user: "👤" };
                    const savedKey = saved.id || saved.recipient_number || saved.recipient_id || saved.nickname;
                    return (
                      <motion.button data-testid={`send-money-saved-recipient-${savedKey}`} key={savedKey} onClick={() => selectRecipient({ user_id: saved.recipient_id, name: saved.recipient_name, email: saved.recipient_id, bidblitz_id: saved.recipient_number })} className="p-4 rounded-2xl bg-white border border-slate-200 transition-all" whileTap={{ scale: 0.95 }}>
                        <div className="text-3xl mb-2">{iconMap[saved.icon] || "👤"}</div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{saved.nickname}</p>
                        <p className="text-xs text-slate-500 truncate">{saved.recipient_number}</p>
                        {saved.transfer_count > 0 && <p className="mt-1 text-[10px] text-[#00C2FF]">{saved.transfer_count} {L.sentTimesSuffix}</p>}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {activeList === "saved" && !hasSavedRecipients && (
                <div className="text-center py-8" data-testid="send-money-empty-saved-state"><Users size={32} className="text-slate-200 mx-auto mb-2" /><p className="text-[13px] text-slate-500">{t("wallet.no_saved_recipients")}</p></div>
              )}

              {activeList === "recent" && (
                <div>
                  <div className="flex items-center gap-2 mb-4"><Clock size={14} className="text-slate-400" /><p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{t("wallet.recently_sent")}</p></div>
                  {!hasRecentContacts ? (
                    <div className="text-center py-8" data-testid="send-money-empty-recent-state"><Users size={32} className="text-slate-200 mx-auto mb-2" /><p className="text-[13px] text-slate-500">{t("wallet.no_recent_contacts")}</p></div>
                  ) : (
                    <div className="space-y-2">
                      {visibleRecentContacts.slice(0, 8).map((c, i) => (
                        <motion.button data-testid={`send-money-recent-contact-${c.user_id || i}`} key={c.user_id || i} onClick={() => selectRecipient(c)} className="w-full flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-200 transition-colors" whileTap={{ scale: 0.98 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-[14px] font-bold text-slate-600">{c.name?.[0]?.toUpperCase() || "?"}</div>
                          <div className="flex-1 text-left">
                            <p className="text-[14px] font-medium text-slate-900">{c.name}</p>
                            <p className="text-[11px] text-slate-500">€{normalizeAmount(c.last_amount).toFixed(2)}</p>
                          </div>
                          <Send size={16} className="text-slate-300" />
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 2 && recipient && (
          <motion.div key="amount" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22 }} className="px-4 pt-4 pb-6">
            <div className="flex items-center gap-4 mb-5">
              <motion.button data-testid="send-money-back-button" onClick={() => setStep(1)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center" whileTap={{ scale: 0.9 }}><ArrowLeft size={18} className="text-slate-600" /></motion.button>
              <h2 className="text-[18px] font-bold text-slate-900">{L.amountTitle}</h2>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[20px] font-bold text-white">{recipient.name?.[0]?.toUpperCase() || "?"}</div>
              <div>
                <p className="text-[16px] font-semibold text-slate-900">{recipient.name}</p>
                <p className="text-[12px] text-[#00C2FF]">{recipient.username ? `@${recipient.username}` : recipient.bidblitz_id}</p>
              </div>
            </div>

            <div className="rounded-[28px] bg-white border border-slate-200 p-5 text-center shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-[48px] font-bold text-slate-300">€</span>
                <input data-testid="send-money-amount-input" ref={inputRef} type="text" inputMode="decimal" value={amount} onChange={(e) => handleAmountChange(e.target.value)} placeholder="0" className="text-[64px] font-bold text-slate-900 bg-transparent outline-none text-center w-48 placeholder-slate-300" />
              </div>
              <p className="text-[13px] text-slate-500">{L.availableShort}: <span className="text-[#00C2FF] font-semibold">€{balance.toFixed(2)}</span></p>

              <div className="grid grid-cols-2 sm:flex items-center gap-2 mt-6 justify-center">
                {quickAmounts.map((q) => (
                  <motion.button data-testid={`send-money-quick-amount-${q}`} key={q} onClick={() => addAmount(q)} className="px-5 py-3 rounded-full bg-slate-50 border border-slate-200 text-[14px] font-semibold text-slate-700" whileTap={{ scale: 0.95 }}><Plus size={12} className="inline mr-1" />€{q}</motion.button>
                ))}
                <motion.button data-testid="send-money-quick-amount-max" onClick={setMax} className="px-5 py-3 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20 text-[14px] font-semibold text-[#00C2FF]" whileTap={{ scale: 0.95 }}>MAX</motion.button>
              </div>

              <input data-testid="send-money-message-input" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={L.messagePlaceholder} className="w-full mt-6 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-[14px] placeholder-slate-400 outline-none text-center" />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400" />
                  <span className="text-[13px] text-red-500">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-5">
              <motion.button data-testid="send-money-submit-button" onClick={handleSend} disabled={loading || !amount || parseFloat(amount) <= 0} className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#0066FF] text-white font-bold text-[17px] flex items-center justify-center gap-3 disabled:opacity-40 shadow-lg shadow-[#00C2FF]/20" whileTap={{ scale: 0.98 }}>
                {loading ? <Loader2 size={22} className="animate-spin" /> : <><Send size={20} />€{parseFloat(amount || 0).toFixed(2)} {L.sendNow}</>}
              </motion.button>
              <p className="mt-3 text-center text-[11px] text-slate-500">{L.freeInstant}</p>
            </div>
          </motion.div>
        )}

        {step === 3 && result && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", damping: 20 }} className="px-4 pt-10 pb-6 flex flex-col items-center justify-center text-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#00D26A] to-[#00A855] flex items-center justify-center shadow-2xl shadow-[#00D26A]/30 mb-8"><CheckCircle2 size={56} className="text-white" /></div>
            <h2 className="mb-2 text-[28px] font-bold text-slate-900">{L.sentTitle}</h2>
            <p className="text-[15px] text-slate-500">{L.sentSubtitle}</p>
            <p className="text-[56px] font-bold text-slate-900 tracking-tight my-8">€{parseFloat(amount).toFixed(2)}</p>
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#0066FF] flex items-center justify-center text-[16px] font-bold text-white">{recipient?.name?.[0]?.toUpperCase() || "?"}</div>
              <div className="text-left">
                <p className="text-[14px] font-semibold text-slate-900">{recipient?.name}</p>
                <p className="text-[11px] text-slate-500">{L.recipientLabel}</p>
              </div>
            </div>
            <p className="text-[12px] text-slate-500 mt-6 font-mono">Ref: {result.reference}</p>
            <div className="mt-8 text-center">
              <p className="mb-1 text-[11px] text-slate-500">{L.newBalance}</p>
              <p className="text-[24px] font-bold text-[#00C2FF]">€{normalizeAmount(result.sender_new_balance).toFixed(2)}</p>
            </div>
            <motion.button data-testid="send-money-done-button" onClick={() => onNavigate?.('/wallet')} className="mt-8 w-full py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 font-semibold text-[15px]" whileTap={{ scale: 0.98 }}>{L.done}</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}