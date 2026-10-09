import { SHOW_KYC_GATE } from "../config/testMode";

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

function normalizeTrailingSlash(pathname) {
  const raw = String(pathname || "/");
  if (raw === "/") return "/";
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || "/";
}

export function getInitialAppPath({ hasKidsReturn, hasStripeReturn, pathname, search }) {
  if (hasKidsReturn) return "/more";
  if (hasStripeReturn) return "/wallet";
  return `${normalizeTrailingSlash(pathname)}${search || ""}`;
}

export function resolveBrowserPath(path) {
  if (!path) return "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const queryIndex = withLeadingSlash.indexOf("?");
  if (queryIndex === -1) return normalizeTrailingSlash(withLeadingSlash);
  const pathname = withLeadingSlash.slice(0, queryIndex);
  const search = withLeadingSlash.slice(queryIndex);
  return `${normalizeTrailingSlash(pathname)}${search}`;
}

export function isKycRestrictedPath(path) {
  if (!SHOW_KYC_GATE) return false;
  const basePath = (path || "/").split("?")[0];
  return KYC_RESTRICTED_PREFIXES.some(
    (prefix) => basePath === prefix || basePath.startsWith(`${prefix}/`),
  );
}