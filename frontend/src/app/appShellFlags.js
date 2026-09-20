function isCheckoutPath(path) {
  return path.startsWith("/pay/checkout/");
}

function isPublicInvoicePaymentPath(path) {
  return path.startsWith("/pay/") && !path.startsWith("/pay/checkout/") && !path.startsWith("/pay/merchant/");
}

function isQrOrderPath(path) {
  return path.startsWith("/order/qr/");
}

function isRestaurantTableGuestPath(path) {
  return path.startsWith("/table/");
}

function isInvoicePayPath(path) {
  return path.startsWith("/invoice/pay/");
}

function isMobilityShellPath(path) {
  return path === "/scooter"
    || path === "/ev"
    || path === "/ev/map"
    || path === "/ev/history"
    || path.startsWith("/ev/start/")
    || path.startsWith("/ev/session/");
}

function isImmersiveMobilityMapPath(path) {
  return path === "/mobility-map";
}

function isStaffEmployeeShellPath(path) {
  return path === "/staff/mobile"
    || path === "/staff/invite"
    || path === "/staff/terminal"
    || path === "/staff/portal"
    || path === "/staff/login";
}

function isFullScreenStaffManagerPath(path) {
  return path === "/merchant/staff/chat"
    || path === "/merchant/taxi/promos"
    || path === "/merchant/staff/live-map"
    || path === "/taxi/pro";
}

function isFullscreenCommercePath(path) {
  return path === "/terminal"
    || path === "/pos"
    || path === "/nfc";
}

function isDatingPath(path) {
  return path === "/dating";
}

function isMerchantPosPath(path) {
  return path.startsWith("/merchant/pos");
}

function isAdminShellPath(path) {
  return path === "/admin" || path.startsWith("/admin/");
}

export function getAppShellFlags(currentPath, isDesktopViewport) {
  const path = (currentPath || "/").split("?")[0];
  const isCheckout = isCheckoutPath(path);
  const isPublicInvoicePayment = isPublicInvoicePaymentPath(path);
  const isQrOrder = isQrOrderPath(path);
  const isRestaurantTableGuest = isRestaurantTableGuestPath(path);
  const isInvoicePay = isInvoicePayPath(path);
  const isMobilityShell = isMobilityShellPath(path);
  const isImmersiveMobilityMap = isImmersiveMobilityMapPath(path);
  const isStaffEmployeeShell = isStaffEmployeeShellPath(path);
  const isFullScreenStaffMgr = isFullScreenStaffManagerPath(path);
  const isFullscreenCommerce = isFullscreenCommercePath(path);
  const isDating = isDatingPath(path);
  const isMerchantPos = isMerchantPosPath(path);
  const isAdminShell = isAdminShellPath(path);
  const isHomePath = path === "/" || path === "/home" || path === "/landing";

  return {
    isCheckout,
    isPublicInvoicePayment,
    isQrOrder,
    isRestaurantTableGuest,
    isInvoicePay,
    isMobilityShell,
    isStaffEmployeeShell,
    isFullScreenStaffMgr,
    isFullscreenCommerce,
    isAdminShell,
    showBottomNav: !isDesktopViewport
      && !isCheckout
      && !isPublicInvoicePayment
      && !isQrOrder
      && !isRestaurantTableGuest
      && !isInvoicePay
      && !isImmersiveMobilityMap
      && !isStaffEmployeeShell
      && !isFullScreenStaffMgr
      && !isDating
      && !isMerchantPos
      && !isAdminShell
      && !isFullscreenCommerce
      && !path.startsWith("/pay/merchant/")
      && path !== "/merchant-landing"
      && path !== "/pay/directory"
      && path !== "/design-system"
      && path !== "/scan",
    showBackToHome: !isHomePath
      && !isCheckout
      && !isPublicInvoicePayment
      && !isQrOrder
      && !isRestaurantTableGuest
      && !isInvoicePay
      && !isMobilityShell
      && !isImmersiveMobilityMap
      && !isStaffEmployeeShell
      && !isDating
      && !isMerchantPos
      && !isAdminShell
      && !isFullscreenCommerce
      && !path.startsWith("/pay/merchant/")
      && path !== "/merchant-landing",
    isDating,
  };
}