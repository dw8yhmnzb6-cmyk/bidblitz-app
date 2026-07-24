import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";

/**
 * Push Notification Permission Prompt
 * Shows a friendly in-app banner before requesting the native permission dialog.
 * Delayed so users understand the value first.
 */
export const PushPermissionPrompt = ({ isAuthenticated }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return; // already decided
    const dismissed = localStorage.getItem("bidblitz_push_dismissed");
    if (dismissed) return;

    // Delay: give user time to see value first (30s)
    const t = setTimeout(() => setShow(true), 30000);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("bidblitz_push_dismissed", "1");
  };

  const enable = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification("BidBlitz", {
          body: "Push-Benachrichtigungen aktiviert! 🚀",
          icon: "/icons/icon-192x192.png",
        });
      }
    } catch {}
    dismiss();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          data-testid="push-permission-prompt"
          className="fixed top-[72px] left-3 right-3 z-[60] rounded-2xl p-3.5 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(255,184,0,0.10) 0%, rgba(255,140,0,0.06) 100%)",
            border: "1px solid rgba(255,184,0,0.22)",
            backdropFilter: "blur(20px)",
          }}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 220 }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#FFB800,#FF8C00)" }}>
            <Bell size={17} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white leading-tight">Push aktivieren</p>
            <p className="text-[11px] text-white/60 leading-tight mt-0.5">
              Gewinne, Auktionen & Deals sofort erhalten
            </p>
          </div>
          <motion.button
            data-testid="push-enable-btn"
            onClick={enable}
            className="px-3 py-2 rounded-full text-[12px] font-semibold text-[#1a0f00]"
            style={{ background: "#FFB800" }}
            whileTap={{ scale: 0.94 }}
          >
            Aktivieren
          </motion.button>
          <motion.button
            data-testid="push-dismiss-btn"
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

export default PushPermissionPrompt;
