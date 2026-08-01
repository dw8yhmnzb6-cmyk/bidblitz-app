import { lazy } from "react";

const StaffSystemCheckPage = lazy(() => import("../pages/StaffSystemCheckPage"));
const StaffMobilePage = lazy(() => import("../pages/StaffMobilePage"));
const StaffTerminalPage = lazy(() => import("../pages/StaffTerminalPage"));
const StaffInvitePage = lazy(() => import("../pages/StaffInvitePage"));
const KDSPage = lazy(() => import("../pages/KDSPage"));
const CustomerDisplayPage = lazy(() => import("../pages/CustomerDisplayPage"));
const PublicTableOrderPage = lazy(() => import("../pages/PublicTableOrderPage"));
const QrOrderPage = lazy(() => import("../pages/QrOrderPage"));
const MerchantQrTablesPage = lazy(() => import("../pages/MerchantQrTablesPage"));
const RestaurantTablesAdminPage = lazy(() => import("../pages/RestaurantTablesAdminPage"));
const RestaurantTableGuestPage = lazy(() => import("../pages/RestaurantTableGuestPage"));
const RestaurantStaffDashboardPage = lazy(() => import("../pages/RestaurantStaffDashboardPage"));
const RestaurantKitchenPage = lazy(() => import("../pages/RestaurantKitchenPage"));
const InvoicePayPage = lazy(() => import("../pages/InvoicePayPage"));
const PublicInvoicePaymentPage = lazy(() => import("../pages/PublicInvoicePaymentPage"));
const PayCheckoutPage = lazy(() => import("../pages/PayCheckoutPage"));
const PayDeveloperDocsPage = lazy(() => import("../pages/PayDeveloperDocsPage"));
const PayDirectoryPage = lazy(() => import("../pages/PayDirectoryPage"));
const PayForBusinessPage = lazy(() => import("../pages/PayForBusinessPage"));
const PayMerchantDetailPage = lazy(() => import("../pages/PayMerchantDetailPage"));
const BidBlitzPaySandboxPage = lazy(() => import("../pages/BidBlitzPaySandboxPage"));
const BidBlitzPayHostedCheckoutPage = lazy(() => import("../pages/BidBlitzPayHostedCheckoutPage"));
const BidBlitzPayResultPage = lazy(() => import("../pages/BidBlitzPayResultPage"));
const PublicMerchantBusinessPage = lazy(() => import("../pages/PublicMerchantBusinessPage"));
const EVStartChargingPage = lazy(() => import("../pages/EVStartChargingPage"));
const EVLiveSessionPage = lazy(() => import("../pages/EVLiveSessionPage"));
const EVChargingMapPage = lazy(() => import("../pages/EVChargingMapPage"));
const EVChargingHistoryPage = lazy(() => import("../pages/EVChargingHistoryPage"));
const AdminEVOverviewPage = lazy(() => import("../pages/AdminEVOverviewPage"));
const AdminEVOperatorsPage = lazy(() => import("../pages/AdminEVOperatorsPage"));
const AdminEVHardwareVendorsPage = lazy(() => import("../pages/AdminEVHardwareVendorsPage"));
const AdminEVTariffsPage = lazy(() => import("../pages/AdminEVTariffsPage"));
const AdminEVPayoutsPage = lazy(() => import("../pages/AdminEVPayoutsPage"));
const EVOperatorDashboardPage = lazy(() => import("../pages/EVOperatorDashboardPage"));
const EVOperatorStationsPage = lazy(() => import("../pages/EVOperatorStationsPage"));
const EVOperatorSessionsPage = lazy(() => import("../pages/EVOperatorSessionsPage"));
const EVOperatorRevenuePage = lazy(() => import("../pages/EVOperatorRevenuePage"));
const EVOperatorPayoutsPage = lazy(() => import("../pages/EVOperatorPayoutsPage"));

export function renderSpecialRoutes({
  currentPath,
  handleNavigate,
  requireAuth,
  isGuest,
  user,
  onLogin,
}) {
  const basePath = currentPath.split("?")[0];

  if (basePath === "/staff/system-check") {
    return <StaffSystemCheckPage onBack={() => handleNavigate("/")} />;
  }
  if (basePath === "/staff/mobile") {
    return <StaffMobilePage onBack={() => handleNavigate("/")} />;
  }
  if (basePath === "/staff/terminal") {
    return <StaffTerminalPage onBack={() => handleNavigate("/")} />;
  }
  if (basePath === "/staff/invite") {
    return <StaffInvitePage onSuccess={() => handleNavigate("/staff/mobile")} />;
  }
  if (basePath.startsWith("/kds/")) {
    return <KDSPage stationId={basePath.split("/")[2]} />;
  }
  if (basePath.startsWith("/customer-display/")) {
    return <CustomerDisplayPage registerId={basePath.split("/")[2]} />;
  }
  if (basePath.startsWith("/order/qr/")) {
    if (isGuest) {
      return <QrOrderPage onAuthRequired={requireAuth} onLogin={onLogin} />;
    }
    return <QrOrderPage onNavigate={handleNavigate} />;
  }
  if (basePath.startsWith("/table/")) {
    return <RestaurantTableGuestPage tableId={basePath.split("/")[2]} />;
  }
  if (basePath.startsWith("/order/")) {
    return <PublicTableOrderPage qrToken={basePath.split("/")[2]} />;
  }
  if (basePath === "/admin/tables") {
    return <RestaurantTablesAdminPage onBack={() => handleNavigate("/admin")} />;
  }
  if (basePath === "/staff/dashboard") {
    return <RestaurantStaffDashboardPage onBack={() => handleNavigate("/")} />;
  }
  if (basePath === "/kitchen") {
    return <RestaurantKitchenPage onBack={() => handleNavigate("/")} />;
  }
  if (basePath === "/merchant/qr-tables") {
    return <MerchantQrTablesPage onBack={() => handleNavigate("/merchant-dashboard")} user={user} />;
  }
  if (basePath.startsWith("/invoice/pay/")) {
    return <InvoicePayPage scanCode={basePath.split("/")[3]} onNavigate={handleNavigate} />;
  }
  if (basePath.startsWith("/pay/") && !basePath.startsWith("/pay/checkout/") && !basePath.startsWith("/pay/merchant/") && basePath !== "/pay/docs" && basePath !== "/pay/directory" && basePath !== "/pay/for-business") {
    return <PublicInvoicePaymentPage token={basePath.split("/")[2]} onNavigate={handleNavigate} />;
  }
  if (basePath === "/ev" || basePath === "/ev/map") {
    return <EVChargingMapPage onNavigate={handleNavigate} />;
  }
  if (basePath.startsWith("/ev/start/")) {
    const parts = basePath.split("/");
    return <EVStartChargingPage chargePointId={parts[3]} connectorId={parts[4] || "1"} onNavigate={handleNavigate} />;
  }
  if (basePath.startsWith("/ev/session/")) {
    return <EVLiveSessionPage sessionId={basePath.split("/")[3]} onNavigate={handleNavigate} />;
  }
  if (basePath === "/ev/history") {
    return <EVChargingHistoryPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/admin/ev" || basePath === "/admin/ev/overview") {
    return <AdminEVOverviewPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/admin/ev/operators") {
    return <AdminEVOperatorsPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/admin/ev/vendors") {
    return <AdminEVHardwareVendorsPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/admin/ev/tariffs") {
    return <AdminEVTariffsPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/admin/ev/payouts") {
    return <AdminEVPayoutsPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/operator/ev" || basePath === "/operator/ev/dashboard") {
    return <EVOperatorDashboardPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/operator/ev/stations") {
    return <EVOperatorStationsPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/operator/ev/sessions") {
    return <EVOperatorSessionsPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/operator/ev/revenue") {
    return <EVOperatorRevenuePage onNavigate={handleNavigate} />;
  }
  if (basePath === "/operator/ev/payouts") {
    return <EVOperatorPayoutsPage onNavigate={handleNavigate} />;
  }
  if (basePath.startsWith("/pay/checkout/")) {
    return <PayCheckoutPage sessionId={basePath.split("/")[3]} onNavigate={handleNavigate} />;
  }
  if (basePath.startsWith("/pay/merchant/")) {
    return <PayMerchantDetailPage slug={basePath.split("/")[3]} onBack={() => handleNavigate("/pay/directory")} onNavigate={handleNavigate} />;
  }
  if (basePath.startsWith("/business/")) {
    return <PublicMerchantBusinessPage slug={basePath.split("/")[2]} onBack={() => handleNavigate("/merchant-portal")} onNavigate={handleNavigate} />;
  }
  if (basePath === "/pay/directory") {
    return <PayDirectoryPage onBack={() => handleNavigate("/merchant-landing")} onNavigate={handleNavigate} />;
  }
  if (basePath === "/pay/docs") {
    return <PayDeveloperDocsPage />;
  }
  if (basePath === "/pay/for-business") {
    return <PayForBusinessPage onNavigate={handleNavigate} />;
  }
  if (basePath === "/bidblitz-pay/sandbox") {
    return <BidBlitzPaySandboxPage onNavigate={handleNavigate} />;
  }
  if (basePath.startsWith("/bidblitz-pay/checkout/")) {
    return <BidBlitzPayHostedCheckoutPage paymentId={basePath.split("/")[3]} onNavigate={handleNavigate} />;
  }
  if (basePath === "/bidblitz-pay/success") {
    const params = new URLSearchParams(currentPath.split("?")[1] || "");
    return <BidBlitzPayResultPage variant="success" paymentId={params.get("payment_id") || ""} onNavigate={handleNavigate} />;
  }
  if (basePath === "/bidblitz-pay/cancel") {
    const params = new URLSearchParams(currentPath.split("?")[1] || "");
    return <BidBlitzPayResultPage variant="cancel" paymentId={params.get("payment_id") || ""} onNavigate={handleNavigate} />;
  }

  return null;
}