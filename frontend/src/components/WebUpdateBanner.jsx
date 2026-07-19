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
        className="fixed top-4 left-4 right-4 z-[140] mx-auto max-w-lg"
        data-testid="web-update-banner"
      >
        <div className="rounded-[22px] border border-[#00C2FF]/20 bg-[#061118]/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00C2FF]/14 text-[#00C2FF]">
              <RefreshCw size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white" data-testid="web-update-banner-title">
                Eine neue Version ist verfügbar.
              </p>
              <p className="mt-1 text-xs text-white/70" data-testid="web-update-banner-subtitle">
                Version {nextVersion || "neu"} ist bereit. Deine Anmeldung und wichtigen Einstellungen bleiben erhalten.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={applyUpdate}
                  className="rounded-full bg-[#00C2FF] px-4 py-2 text-xs font-bold text-black"
                  data-testid="web-update-now-btn"
                >
                  Jetzt aktualisieren
                </button>
                <button
                  type="button"
                  onClick={() => setVisible(false)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70"
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