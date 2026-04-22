import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";
import { useI18n } from "./I18nContext";

const NetworkContext = createContext({ online: true });

export function NetworkProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const { t } = useI18n();

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={React.useMemo(() => ({ online }), [online])}>
      {children}
      <AnimatePresence>
        {!online && (
          <motion.div
            data-testid="offline-banner"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-3"
            style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)", borderBottom: "1px solid rgba(255,71,87,0.3)" }}
          >
            <WifiOff size={14} className="text-[#FF4757]" />
            <span className="text-[12px] font-medium text-[#FF4757]">{t("error.offline")}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}

export default NetworkContext;
