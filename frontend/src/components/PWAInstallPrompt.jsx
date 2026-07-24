import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";
import { isNativeApp } from "../services/capacitorBridge";

/**
 * PWA Install Prompt
 * Listens for `beforeinstallprompt` (Android/Chrome) and shows a custom install CTA.
 * For iOS Safari (no native event), shows a hint bubble with manual instructions.
 */
export const PWAInstallPrompt = () => {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isNativeApp()) return;

    const dismissed = localStorage.getItem("bidblitz_pwa_dismissed");
    if (dismissed) return;

    const ua = navigator.userAgent || "";
    const ios = /iPhone|iPad|iPod/.test(ua) && !window.MSStream;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone) return; // already installed

    if (ios) {
      setIsIOS(true);
      // Show iOS hint after 20s delay
      const t = setTimeout(() => setShow(true), 20000);
      return () => clearTimeout(t);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("bidblitz_pwa_dismissed", "1");
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferred(null);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          data-testid="pwa-install-prompt"
          className="fixed bottom-[88px] left-3 right-3 z-[60] rounded-2xl p-3.5 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(0,194,255,0.12) 0%, rgba(0,136,204,0.08) 100%)",
            border: "1px solid rgba(0,194,255,0.25)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 10px 40px rgba(0,194,255,0.15)",
          }}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 220 }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#00C2FF,#0088CC)" }}>
            <Smartphone size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white leading-tight">BidBlitz installieren</p>
            <p className="text-[11px] text-white/60 leading-tight mt-0.5">
              {isIOS
                ? "Tippe ⬆️ dann „Zum Home-Bildschirm"
                : "Schneller Zugriff vom Homescreen"}
            </p>
          </div>
          {!isIOS && (
            <motion.button
              data-testid="pwa-install-btn"
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold text-[#020202]"
              style={{ background: "#00C2FF" }}
              whileTap={{ scale: 0.94 }}
            >
              <Download size={13} strokeWidth={2.5} /> Install
            </motion.button>
          )}
          <motion.button
            data-testid="pwa-install-dismiss"
            onClick={dismiss}
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0"
            whileTap={{ scale: 0.9 }}
          >
            <X size={13} className="text-white/60" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
