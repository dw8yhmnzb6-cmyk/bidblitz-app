import { KYC_DISABLED } from "../config/testMode";

const KYC_RESTRICTED_PREFIXES = [
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

export function getInitialAppPath({ hasKidsReturn, hasStripeReturn, pathname, search }) {
  if (hasKidsReturn) return "/more";
  if (hasStripeReturn) return "/wallet";
  return `${pathname || "/"}${search || ""}`;
}

export function resolveBrowserPath(path) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function isKycRestrictedPath(path) {
  if (KYC_DISABLED) return false;
  const basePath = (path || "/").split("?")[0];
  return KYC_RESTRICTED_PREFIXES.some(
    (prefix) => basePath === prefix || basePath.startsWith(`${prefix}/`),
  );
}