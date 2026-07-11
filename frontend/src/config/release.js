const PREVIEW_HOST_MATCHERS = ["preview.emergentagent.com", "localhost", "127.0.0.1"];
const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "";
const isPreviewRuntime = PREVIEW_HOST_MATCHERS.some((matcher) => runtimeHost.includes(matcher));

export const STORE_SAFE_MODE = process.env.REACT_APP_STORE_SAFE_MODE === "true" && !isPreviewRuntime;
export const DEMO_MODE = process.env.REACT_APP_DEMO_MODE === "true";
export const MOCK_PAYMENTS = process.env.REACT_APP_MOCK_PAYMENTS === "true";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const STORE_BLOCKED_PATHS = new Set([
  "/auctions",
  "/live-auctions",
  "/arcade",
  "/gaming",
  "/spin-wheel",
  "/reward-plinko",
  "/lottery",
  "/predictions",
  "/engage",
  "/viral",
  "/blitzhub",
]);

export function isStoreBlockedPath(path) {
  const basePath = (path || "/").split("?")[0];
  return STORE_SAFE_MODE && STORE_BLOCKED_PATHS.has(basePath);
}

export function filterStoreSafeItems(items = []) {
  if (!STORE_SAFE_MODE) return items;
  return items.filter((item) => {
    const haystack = [item?.id, item?.label, item?.desc, item?.route].filter(Boolean).join(" ").toLowerCase();
    return ![
      "auction",
      "auktion",
      "penny",
      "plinko",
      "spin",
      "lottery",
      "mystery",
      "lootbox",
      "boxen",
      "gaming",
      "arcade",
      "prediction",
      "blitzhub",
      "viral",
      "casino",
      "glücksrad",
      "gluecksrad",
      "fun & verdienen",
    ].some((token) => haystack.includes(token));
  });
}
