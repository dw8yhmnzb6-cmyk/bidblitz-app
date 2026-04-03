import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, QrCode, ShieldCheck, Loader2 } from "lucide-react";
import { api } from "../services/api";
import { useI18n } from "../store";

const BarcodeModal = ({ isOpen, onClose }) => {
  const [barcode, setBarcode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const { t } = useI18n();

  useEffect(() => {
    if (isOpen && !barcode) {
      setLoading(true);
      setError(null);
      api.getMyBarcode()
        .then((data) => { setBarcode(data); })
        .catch((e) => { setError(e.message || "Failed to load barcode"); })
        .finally(() => setLoading(false));
    }
  }, [isOpen, barcode]);

  const handleCopy = async () => {
    if (!barcode) return;
    try {
      await navigator.clipboard.writeText(barcode.barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = barcode.barcode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-[430px] bg-[#0E0E0E] border-t border-white/[0.06] rounded-t-3xl p-6 pb-10"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          {/* Close */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold font-outfit text-white">
              {t("barcode.title") || "My Payment Barcode"}
            </h2>
            <motion.button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} className="text-white/60" />
            </motion.button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-12">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Loader2 size={28} className="text-[#00C2FF]" />
              </motion.div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
              <motion.button
                onClick={() => { setBarcode(null); setError(null); }}
                className="mt-4 px-4 py-2 bg-white/[0.04] rounded-lg text-sm text-white"
                whileTap={{ scale: 0.97 }}
              >
                {t("error.retry") || "Retry"}
              </motion.button>
            </div>
          ) : barcode ? (
            <div className="flex flex-col items-center">
              {/* Barcode visual */}
              <div className="w-full bg-white rounded-2xl p-6 mb-5 relative overflow-hidden">
                <div className="flex flex-col items-center">
                  {/* Barcode lines simulation */}
                  <div className="flex items-end justify-center gap-[2px] mb-3 h-24">
                    {barcode.barcode.split("").map((char, i) => {
                      const h = 40 + ((char.charCodeAt(0) * 7 + i * 13) % 56);
                      const w = (i % 3 === 0) ? 3 : (i % 2 === 0 ? 2 : 1);
                      return (
                        <div
                          key={i}
                          className="bg-black rounded-sm"
                          style={{ width: `${w}px`, height: `${h}px` }}
                        />
                      );
                    })}
                  </div>
                  <p className="text-black font-mono text-sm font-bold tracking-[0.15em]">
                    {barcode.barcode}
                  </p>
                  <p className="text-black/40 text-[10px] mt-1">{barcode.name}</p>
                </div>
              </div>

              {/* Copy button */}
              <motion.button
                data-testid="copy-barcode-btn"
                onClick={handleCopy}
                className={`w-full py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  copied
                    ? "bg-[#00D26A]/15 text-[#00D26A] border border-[#00D26A]/20"
                    : "bg-white/[0.04] border border-white/[0.06] text-white hover:bg-white/[0.06]"
                }`}
                whileTap={{ scale: 0.98 }}
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    {t("barcode.copied") || "Copied!"}
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    {t("barcode.copy") || "Copy Barcode"}
                  </>
                )}
              </motion.button>

              {/* Hint */}
              <div className="flex items-center gap-2 mt-5">
                <ShieldCheck size={12} className="text-[#00C2FF]/40" />
                <p className="text-[10px] text-[#444]">
                  {t("barcode.hint") || "Show this barcode to the merchant for payment"}
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
