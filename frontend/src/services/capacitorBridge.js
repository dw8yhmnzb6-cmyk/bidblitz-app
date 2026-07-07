let started = false;

const safeWindow = typeof window !== "undefined" ? window : undefined;

export function isNativeApp() {
  return !!safeWindow?.Capacitor?.isNativePlatform?.();
}

export function getNativePlatform() {
  if (!safeWindow?.Capacitor?.getPlatform) return "web";
  return safeWindow.Capacitor.getPlatform();
}

export async function loadNativeHealthBridge() {
  if (!isNativeApp()) {
    return null;
  }
  try {
    const module = await import("@capgo/capacitor-health");
    return module?.Health || null;
  } catch {
    return null;
  }
}

export function initCapacitorBridge(handlers = {}) {
  if (started) return;
  started = true;

  if (!isNativeApp()) return;

  import("@capacitor/app").then(({ App }) => {
    App.addListener("appUrlOpen", (event) => {
      try {
        const url = new URL(event.url);
        const path = url.pathname + url.search + url.hash;
        if (handlers.onDeepLink) handlers.onDeepLink(path);
        if (url.pathname.startsWith("/pay/return")) {
          if (handlers.onPaymentReturn) handlers.onPaymentReturn(url.searchParams);
        }
      } catch {
        return null;
      }
    });

    App.addListener("resume", () => {
      if (handlers.onResume) handlers.onResume();
    });
  }).catch(() => {});
}
