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

export function getAppShellFlags(currentPath, isDesktopViewport) {
  const isCheckout = isCheckoutPath(currentPath);
  const isPublicInvoicePayment = isPublicInvoicePaymentPath(currentPath);
  const isQrOrder = isQrOrderPath(currentPath);
  const isRestaurantTableGuest = isRestaurantTableGuestPath(currentPath);
  const isInvoicePay = isInvoicePayPath(currentPath);
  const isMobilityShell = isMobilityShellPath(currentPath);
  const isStaffEmployeeShell = isStaffEmployeeShellPath(currentPath);
  const isFullScreenStaffMgr = isFullScreenStaffManagerPath(currentPath);
  const isFullscreenCommerce = isFullscreenCommercePath(currentPath);
  const isDating = isDatingPath(currentPath);
  const isHomePath = currentPath === "/" || currentPath === "/home" || currentPath === "/landing";

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
    showBottomNav: !isDesktopViewport
      && !isCheckout
      && !isPublicInvoicePayment
      && !isQrOrder
      && !isRestaurantTableGuest
      && !isInvoicePay
      && !isStaffEmployeeShell
      && !isFullScreenStaffMgr
      && !isDating
      && !isFullscreenCommerce
      && !currentPath.startsWith("/pay/merchant/")
      && currentPath !== "/merchant-landing"
      && currentPath !== "/pay/directory"
      && currentPath !== "/scan",
    showBackToHome: !isHomePath
      && !isCheckout
      && !isPublicInvoicePayment
      && !isQrOrder
      && !isRestaurantTableGuest
      && !isInvoicePay
      && !isMobilityShell
      && !isStaffEmployeeShell
      && !isDating
      && !isFullscreenCommerce
      && !currentPath.startsWith("/pay/merchant/")
      && currentPath !== "/merchant-landing",
    isDating,
  };
}