import { motion } from "framer-motion";
import { WifiOff, AlertTriangle, RefreshCw, ServerOff } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import { useNetwork } from "../store/NetworkContext";

const ICONS = {
  offline: WifiOff,
  network: WifiOff,
  server: ServerOff,
  timeout: AlertTriangle,
  default: AlertTriangle,
};

export default function ErrorState({ error, onRetry, compact = false }) {
  const { t } = useI18n();
  const { online } = useNetwork();

  const isOffline = !online || (error && (error.code === "offline" || error.code === "network"));
  const isTimeout = error && error.code === "timeout";
  const isServer = error && error.code === "server";

  const iconKey = isOffline ? "offline" : isTimeout ? "timeout" : isServer ? "server" : "default";
  const Icon = ICONS[iconKey];

  const title = isOffline
    ? t("error.offline")
    : isTimeout
    ? t("error.timeout")
    : isServer
    ? t("error.server")
    : t("error.generic");

  const subtitle = isOffline
    ? t("error.offline_hint")
    : isTimeout
    ? t("error.timeout_hint")
    : isServer
    ? t("error.server_hint")
    : typeof error === "string"
    ? error
    : error?.message || t("error.generic_hint");

  if (compact) {
    return (
      <motion.div
        data-testid="error-state-compact"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}
      >
        <Icon size={16} className="text-[#FF4757] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#FF4757] font-medium truncate">{subtitle}</p>
        </div>
        {onRetry && (
          <motion.button
            data-testid="error-retry-btn"
            onClick={onRetry}
            whileTap={{ scale: 0.9 }}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-[#FF4757]/10"
          >
            <RefreshCw size={12} className="text-[#FF4757]" />
          </motion.button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      data-testid="error-state"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <motion.div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "rgba(255,71,87,0.08)", border: "1px solid rgba(255,71,87,0.15)" }}
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Icon size={22} className="text-[#FF4757]" />
      </motion.div>
      <p className="text-[13px] font-semibold text-white/80 mb-1.5">{title}</p>
      <p className="text-[11px] text-[#444] leading-relaxed max-w-[240px] mb-5">{subtitle}</p>
      {onRetry && (
        <motion.button
          data-testid="error-retry-btn"
          onClick={onRetry}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold text-[#00C2FF] transition-colors"
          style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.15)" }}
        >
          <RefreshCw size={12} /> {t("error.retry")}
        </motion.button>
      )}
    </motion.div>
  );
}
