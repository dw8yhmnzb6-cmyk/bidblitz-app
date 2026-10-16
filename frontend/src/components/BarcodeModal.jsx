import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, ShieldCheck, Loader2, RefreshCw, Clock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../services/api";
import { useI18n } from "../store";

const BarcodeModal = ({ isOpen, onClose }) => {
  const [barcode, setBarcode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const expiresAtRef = useRef(0);
  const openRef = useRef(false);
  const requestRef = useRef(0);
  const pendingRef = useRef(false);
  const { t } = useI18n();

  const fetchBarcode = useCallback(async (rotate = false) => {
    if (!openRef.current || pendingRef.current) return;
    pendingRef.current = true;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    // Rotation invalidates the old code on the server. Never keep showing it.
    setBarcode(null);
    setCountdown(0);
    setCopied(false);
    try {
      const data = rotate ? await api.refreshBarcode() : await api.getMyBarcode();
      if (!openRef.current || requestId !== requestRef.current) return;
      const seconds = data?.seconds_remaining ?? data?.expires_in;
      const ttl = seconds == null
        ? (Date.parse(data?.expires_at) - Date.now()) / 1000
        : Number(seconds);
      if (typeof data?.barcode !== "string" || !data.barcode.trim()
          || !Number.isFinite(ttl) || ttl <= 0) {
        throw new Error("Payment code is unavailable or expired. Please refresh.");
      }
      expiresAtRef.current = Date.now() + ttl * 1000;
      setBarcode(data);
      setCountdown(Math.ceil(ttl));
    } catch (e) {
      if (openRef.current && requestId === requestRef.current) {
        setError(e?.message || "Failed to load QR code");
      }
    } finally {
      if (openRef.current && requestId === requestRef.current) {
        pendingRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    openRef.current = isOpen;
    if (isOpen) {
      fetchBarcode();
    } else {
      setBarcode(null);
      setCountdown(0);
      setLoading(false);
      setError(null);
    }
    return () => {
      openRef.current = false;
      requestRef.current += 1;
      pendingRef.current = false;
    };
  }, [isOpen, fetchBarcode]);

  // Wall-clock expiry also catches up after the browser suspends timers.
  useEffect(() => {
    if (!isOpen || !barcode) return;
    let expired = false;
    const tick = () => {
      if (expired) return;
      const remaining = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        expired = true;
        fetchBarcode(true);
      }
    };
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isOpen, barcode, fetchBarcode]);

  const handleCopy = async () => {
    if (!barcode) return;
    if (Date.now() >= expiresAtRef.current) {
      fetchBarcode(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(barcode.barcode);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = barcode.barcode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCountdown = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const rotationSeconds = Number(barcode?.rotation_seconds) || countdown;
  const pct = rotationSeconds > 0 ? Math.min(100, Math.max(0, countdown / rotationSeconds * 100)) : 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10000] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          data-testid="barcode-modal"
          className="relative w-full max-w-[430px] bg-[#0E0E0E] border-t border-white/[0.06] rounded-t-3xl p-6 pb-10"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold font-outfit text-white">
              {t("barcode.title") || "Payment QR Code"}
            </h2>
            <motion.button
              data-testid="barcode-modal-close"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} className="text-white/60" />
            </motion.button>
          </div>

          {loading && !barcode ? (
            <div className="flex flex-col items-center py-12">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Loader2 size={28} className="text-[#00C2FF]" />
              </motion.div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
              <motion.button
                onClick={() => fetchBarcode(true)}
                disabled={loading}
                className="mt-4 px-4 py-2 bg-white/[0.04] rounded-lg text-sm text-white"
                whileTap={{ scale: 0.97 }}
              >
                {t("error.retry") || "Retry"}
              </motion.button>
            </div>
          ) : barcode ? (
            <div className="flex flex-col items-center">
              {/* QR Code */}
              <div className="w-full bg-white rounded-2xl p-5 mb-4 relative overflow-hidden">
                <div className="flex flex-col items-center">
                  <QRCodeSVG
                    value={barcode.barcode}
                    size={180}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#000000"
                    includeMargin={false}
                  />
                  <p className="text-black/40 text-[10px] mt-3 font-medium">{barcode.name}</p>
                </div>
              </div>

              {/* Countdown timer bar */}
              <div className="w-full mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} className="text-[#00C2FF]/60" />
                    <span className="text-[10px] text-[#555] font-medium">
                      {t("barcode.refreshes_in") || "Refreshes in"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-semibold font-outfit text-[#00C2FF]">
                      {formatCountdown(countdown)}
                    </span>
                    <motion.button
                      data-testid="barcode-refresh-btn"
                      onClick={() => fetchBarcode(true)}
                      disabled={loading}
                      className="w-6 h-6 rounded-full bg-white/[0.04] flex items-center justify-center"
                      whileTap={{ scale: 0.85 }}
                    >
                      <RefreshCw size={10} className="text-white/40" />
                    </motion.button>
                  </div>
                </div>
                <div className="w-full h-1 rounded-full bg-white/[0.04] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: pct > 30 ? "#00C2FF" : pct > 10 ? "#FFB800" : "#FF6B6B",
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Copy button */}
              <motion.button
                data-testid="copy-barcode-btn"
                onClick={handleCopy}
                className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  copied
                    ? "bg-[#00D26A]/15 text-[#00D26A] border border-[#00D26A]/20"
                    : "bg-white/[0.04] border border-white/[0.06] text-white hover:bg-white/[0.06]"
                }`}
                whileTap={{ scale: 0.98 }}
              >
                {copied ? (
                  <><Check size={16} /> {t("barcode.copied") || "Copied!"}</>
                ) : (
                  <><Copy size={16} /> {t("barcode.copy") || "Copy Code"}</>
                )}
              </motion.button>

              {/* Security hint */}
              <div className="flex items-center gap-2 mt-4">
                <ShieldCheck size={12} className="text-[#00C2FF]/40" />
                <p className="text-[10px] text-[#444]">
                  {t("barcode.refreshes_in") || "Refreshes in"}: {formatCountdown(countdown)}
                </p>
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BarcodeModal;
