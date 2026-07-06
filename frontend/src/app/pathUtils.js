const KYC_RESTRICTED_PREFIXES = [
  "/wallet",
  "/auctions",
  "/live-auctions",
  "/marketplace",
  "/commerce-center",
  "/merchant-portal",
  "/merchant-dashboard",
  "/merchant/staff",
  "/pay",
  "/terminal",
  "/blitzpay",
  "/p2p",
  "/card",
  "/crypto",
  "/bnpl",
  "/budget",
  "/gift-cards",
  "/bills",
  "/instant-credit",
  "/merchant-connect",
  "/marketplace-dashboard",
];

export function getInitialAppPath({ hasKidsReturn, hasStripeReturn, pathname }) {
  if (hasKidsReturn) return "/more";
  if (hasStripeReturn) return "/wallet";
  return pathname || "/";
}

export function resolveBrowserPath(path) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function isKycRestrictedPath(path) {
  const basePath = (path || "/").split("?")[0];
  return KYC_RESTRICTED_PREFIXES.some(
    (prefix) => basePath === prefix || basePath.startsWith(`${prefix}/`),
  );
}