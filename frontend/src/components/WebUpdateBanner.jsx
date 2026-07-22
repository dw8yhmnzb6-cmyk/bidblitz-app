import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";


const VERSION_URL = "/version.json";


async function getCurrentBuildId() {
  try {
    const response = await fetch(`${VERSION_URL}?self=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    return data?.build_id || data?.frontend_version || "";
  } catch (_error) {
    return "";
  }
}


async function clearOutdatedCachesSafely() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const keepPrefixes = ["bidblitz-static-v16", "bidblitz-api-v16", "push-sw"];
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => !keepPrefixes.some((prefix) => key.startsWith(prefix)))
        .map((key) => caches.delete(key)),
    );
  } catch (_error) {
    void _error;
  }
}


export default function WebUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [nextVersion, setNextVersion] = useState("");
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [expandedMobile, setExpandedMobile] = useState(false);

  const currentVersion = useMemo(() => {
    if (typeof document === "undefined") return "";
    return document.querySelector('meta[name="bidblitz-build-version"]')?.getAttribute("content") || "";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;

    const showUpdate = (version, worker = null) => {
      if (cancelled) return;
      setNextVersion(version || "neu");
      setWaitingWorker(worker);
      setExpandedMobile(false);
      setVisible(true);
    };

    const checkRemoteVersion = async () => {
      try {
        const selfVersion = await getCurrentBuildId();
        const response = await fetch(`${VERSION_URL}?ts=${Date.now()}`, { cache: "no-store" });
        const data = await response.json();
        const activeVersion = selfVersion || currentVersion;
        if (!cancelled && data?.build_id && activeVersion && data.build_id !== activeVersion) {
          showUpdate(data.build_id);
        }
      } catch (_error) {
        void _error;
      }
    };

    const onSwMessage = (event) => {
      if (event?.data?.type === "SW_UPDATED") {
        showUpdate(event?.data?.version || "neu");
      }
    };

    const registerUpdateListener = async () => {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;

      if (registration.waiting) {
        showUpdate("neu", registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showUpdate("neu", registration.waiting || installing);
          }
        });
      });
    };

    window.addEventListener("focus", checkRemoteVersion);
    navigator.serviceWorker?.addEventListener?.("message", onSwMessage);

    checkRemoteVersion();
    registerUpdateListener();

    return () => {
      cancelled = true;
      window.removeEventListener("focus", checkRemoteVersion);
      navigator.serviceWorker?.removeEventListener?.("message", onSwMessage);
    };
  }, [currentVersion]);

  const applyUpdate = async () => {
    try {
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      }
      await clearOutdatedCachesSafely();
    } catch (_error) {
      void _error;
    }
    window.location.reload();
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -18, opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed top-3 left-3 right-3 z-[140] mx-auto max-w-lg sm:top-4 sm:left-4 sm:right-4"
        data-testid="web-update-banner"
      >
        <div className="rounded-[18px] border border-[#00C2FF]/20 bg-[#061118]/95 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:rounded-[22px] sm:p-4">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00C2FF]/14 text-[#00C2FF] sm:h-10 sm:w-10">
              <RefreshCw size={16} className="sm:hidden" />
              <RefreshCw size={18} className="hidden sm:block" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold leading-tight text-white sm:text-sm" data-testid="web-update-banner-title">
                  Eine neue Version ist verfügbar.
                </p>
                <button
                  type="button"
                  onClick={() => setExpandedMobile((value) => !value)}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-semibold text-white/65 sm:hidden"
                  data-testid="web-update-mobile-toggle"
                >
                  {expandedMobile ? "Weniger" : "Mehr"}
                </button>
              </div>
              <p className="mt-1 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-semibold text-white/50 sm:hidden" data-testid="web-update-banner-version-chip">
                v{nextVersion || "neu"}
              </p>
              <p className="hidden text-[10px] leading-snug text-white/70 sm:block sm:text-xs" data-testid="web-update-banner-subtitle">
                Eine neue Version ist verfügbar.
              </p>
              <p className={`${expandedMobile ? "mt-1 block" : "hidden"} text-[10px] leading-snug text-white/70 sm:mt-1 sm:block sm:text-xs`} data-testid="web-update-banner-subtitle-long">
                Version {nextVersion || "neu"} ist bereit. Deine Anmeldung und wichtigen Einstellungen bleiben erhalten.
              </p>
              <div className="mt-2 flex gap-1.5 sm:mt-3 sm:gap-2">
                <button
                  type="button"
                  onClick={applyUpdate}
                  className="rounded-full bg-[#00C2FF] px-3 py-1.5 text-[10px] font-bold text-black sm:px-4 sm:py-2 sm:text-xs"
                  data-testid="web-update-now-btn"
                >
                  <span className="sm:hidden">Jetzt</span>
                  <span className="hidden sm:inline">Jetzt aktualisieren</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisible(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-white/70 sm:px-4 sm:py-2 sm:text-xs"
                  data-testid="web-update-later-btn"
                >
                  Später
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}