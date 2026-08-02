import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import "@/App.css";
import { getAdminTabFromPath } from "./app/adminRouteMap";
import { getAppShellFlags } from "./app/appShellFlags";
import { getInitialAppPath, isKycRestrictedPath as isKycRestrictedPathUtil, resolveBrowserPath } from "./app/pathUtils";
import { renderSpecialRoutes } from "./app/renderSpecialRoutes";

import { AppProvider, useUser, useI18n, useFeatureFlags } from "./store";
import { ThemeProvider } from "./store/ThemeContext";
import SuperAppOverlay from "./components/SuperAppOverlay";
import InAppUpdateManager from "./components/InAppUpdateManager";
import WebUpdateBanner from "./components/WebUpdateBanner";
import BackToHomeBar from "./components/BackToHomeBar";
import ErrorBoundary, { setupGlobalErrorHandler } from "./components/ErrorBoundary";
import KYCFlow from "./pages/KYCFlow";
import CookieBanner from "./components/CookieBanner";
import { initSentryIfConsented } from "./utils/sentry";
import { STORE_SAFE_MODE, DEMO_MODE, isStoreBlockedPath } from "./config/release";
import StoreSafeUnavailablePage from "./components/StoreSafeUnavailablePage";
import {
  CarListPage, CarDetailPage, MyCarBookingsPage, MyBookingDetailPage,
  VendorCarRentalDashboardPage, VendorCarsPage, VendorBookingsPage,
  VendorBookingDetailPage, VendorInvoicesPage, VendorPayoutsPage,
  VendorDamagesPage, VendorSettingsPage, VendorStaffPage, VendorReportsPage,
  AdminCarRentalPage, AdminDisputesPage,
} from "./modules/car-rental/pages";
import BottomNav from "./components/BottomNav";
import ActiveAccountBanner from "./components/ActiveAccountBanner";
import AuthGateOverlay from "./components/AuthGateOverlay";
import DemoBanner from "./components/DemoBanner";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import PushPermissionPrompt from "./components/PushPermissionPrompt";
import { tracker } from "./services/tracker";
import { isKycApprovedOrAdmin } from "./utils/adminAccess";
import { TEST_MODE, KYC_DISABLED, SHOW_KYC_GATE, TEST_MODE_FULL_ACCESS } from "./config/testMode";
import { useEffectiveKycAccess } from "./hooks/useEffectiveKycAccess";
import TestBuildDebugLine from "./components/TestBuildDebugLine";

// Lazy load pages for better performance (reduces initial bundle size by ~60%)
import LandingPage from "./pages/LandingPage"; // Keep landing page eager for fast first paint
const HomePage = lazy(() => import("./pages/HomePage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const ScannerPage = lazy(() => import("./pages/ScannerPage"));
const MerchantPage = lazy(() => import("./pages/MerchantPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const MorePage = lazy(() => import("./pages/MorePage"));
const AuctionsPage = lazy(() => import("./pages/AuctionsPage"));
const AuctionAdminPage = lazy(() => import("./pages/AuctionAdminPage"));
const MerchantConnectPage = lazy(() => import("./pages/MerchantConnectPage"));
const InfluencerPage = lazy(() => import("./pages/InfluencerPage"));
const InvestorPage = lazy(() => import("./pages/InvestorPage"));
const InvestierenPage = lazy(() => import("./pages/InvestierenPage"));
const InvestorLoginPage = lazy(() => import("./pages/InvestorLoginPage"));
const InvestorRegisterPage = lazy(() => import("./pages/InvestorRegisterPage"));
const InvestorDashboardPage = lazy(() => import("./pages/InvestorDashboardPage"));
const InvestorPortalPage = lazy(() => import("./pages/InvestorPortalPage"));
const InvestorPortalDocumentsPage = lazy(() => import("./pages/InvestorPortalDocumentsPage"));
const InvestorPortalUpdatesPage = lazy(() => import("./pages/InvestorPortalUpdatesPage"));
const InvestorPortalQuestionsPage = lazy(() => import("./pages/InvestorPortalQuestionsPage"));
const InvestorPortalMeetingsPage = lazy(() => import("./pages/InvestorPortalMeetingsPage"));
const InvestorPortalProfilePage = lazy(() => import("./pages/InvestorPortalProfilePage"));
const AdminInvestorLeadsPage = lazy(() => import("./pages/AdminInvestorLeadsPage"));
const AdminInvestorDashboardPage = lazy(() => import("./pages/AdminInvestorDashboardPage"));
const AdminInvestorDocumentsPage = lazy(() => import("./pages/AdminInvestorDocumentsPage"));
const AdminInvestorUpdatesPage = lazy(() => import("./pages/AdminInvestorUpdatesPage"));
const AdminInvestorMeetingsPage = lazy(() => import("./pages/AdminInvestorMeetingsPage"));
const AdminVisualQaPage = lazy(() => import("./pages/AdminVisualQaPage"));
const AdminMasterRoadmapPage = lazy(() => import("./pages/AdminMasterRoadmapPage"));
const AdminFeatureControlPage = lazy(() => import("./pages/AdminFeatureControlPage"));
const AdminMerchantOnboardingPage = lazy(() => import("./pages/AdminMerchantOnboardingPage"));
const InvestorProgressPage = lazy(() => import("./pages/InvestorProgressPage"));
const DesignSystemPage = lazy(() => import("./pages/DesignSystemPage"));
const RewardsPage = lazy(() => import("./pages/RewardsPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const MerchantDashboardPage = lazy(() => import("./pages/MerchantDashboardPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const SendMoneyPage = lazy(() => import("./pages/SendMoneyPage"));
const ReceiveMoneyPage = lazy(() => import("./pages/ReceiveMoneyPage"));
const MerchantTerminalPage = lazy(() => import("./pages/MerchantTerminalPage"));
const MerchantOnboardingPage = lazy(() => import("./pages/MerchantOnboardingPage"));
const MerchantSetupPage = lazy(() => import("./pages/MerchantSetupPage"));
const MerchantPricingPage = lazy(() => import("./pages/MerchantPricingPage"));
const MerchantLandingPage = lazy(() => import("./pages/MerchantLandingPage"));
const PayCheckoutPage = lazy(() => import("./pages/PayCheckoutPage"));
const PayMerchantDetailPage = lazy(() => import("./pages/PayMerchantDetailPage"));
const PayDeveloperDocsPage = lazy(() => import("./pages/PayDeveloperDocsPage"));
const InvoicePayPage = lazy(() => import("./pages/InvoicePayPage"));
const PublicInvoicePaymentPage = lazy(() => import("./pages/PublicInvoicePaymentPage"));
const PayDirectoryPage = lazy(() => import("./pages/PayDirectoryPage"));
const PayForBusinessPage = lazy(() => import("./pages/PayForBusinessPage"));
const MiningPage = lazy(() => import("./pages/MiningPage"));
const MiningTrustPage = lazy(() => import("./pages/MiningTrustPage"));
const MiningTrustAdminPage = lazy(() => import("./pages/MiningTrustAdminPage"));
const NFTGeneratorPage = lazy(() => import("./pages/NFTGeneratorPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const EVStartChargingPage = lazy(() => import("./pages/EVStartChargingPage"));
const EVLiveSessionPage = lazy(() => import("./pages/EVLiveSessionPage"));
const EVChargingMapPage = lazy(() => import("./pages/EVChargingMapPage"));
const EVChargingHistoryPage = lazy(() => import("./pages/EVChargingHistoryPage"));
const AdminEVOverviewPage = lazy(() => import("./pages/AdminEVOverviewPage"));
const AdminEVOperatorsPage = lazy(() => import("./pages/AdminEVOperatorsPage"));
const AdminEVHardwareVendorsPage = lazy(() => import("./pages/AdminEVHardwareVendorsPage"));
const AdminEVTariffsPage = lazy(() => import("./pages/AdminEVTariffsPage"));
const AdminEVPayoutsPage = lazy(() => import("./pages/AdminEVPayoutsPage"));
const EVOperatorDashboardPage = lazy(() => import("./pages/EVOperatorDashboardPage"));
const EVOperatorStationsPage = lazy(() => import("./pages/EVOperatorStationsPage"));
const EVOperatorSessionsPage = lazy(() => import("./pages/EVOperatorSessionsPage"));
const EVOperatorRevenuePage = lazy(() => import("./pages/EVOperatorRevenuePage"));
const EVOperatorPayoutsPage = lazy(() => import("./pages/EVOperatorPayoutsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const InfluencerDashboard = lazy(() => import("./pages/InfluencerDashboard"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const TaxiPage = lazy(() => import("./pages/TaxiPage"));
const TaxiOperatorPage = lazy(() => import("./pages/TaxiOperatorPage"));
const TaxiOperatorDashboard = lazy(() => import("./pages/TaxiOperatorDashboard"));
const ScooterPage = lazy(() => import("./pages/ScooterPage"));
const FoodPage = lazy(() => import("./pages/FoodPage"));
const DriverDashboardPage = lazy(() => import("./pages/DriverDashboardPage"));
const RestaurantDashboardPage = lazy(() => import("./pages/RestaurantDashboardPage"));
const ChildModePage = lazy(() => import("./pages/ChildModePage"));
const MarketplaceDashboardPage = lazy(() => import("./pages/MarketplaceDashboardPage"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const CommerceCenterPage = lazy(() => import("./pages/CommerceCenterPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const ReferralSystemPage = lazy(() => import("./pages/ReferralSystemPage"));
const NfcPayPage = lazy(() => import("./pages/NfcPayPage"));
const VipPage = lazy(() => import("./pages/VipPage"));
const LoyaltyPage = lazy(() => import("./pages/LoyaltyPage"));
const KidsPaywall = lazy(() => import("./pages/KidsPaywall"));
const MobilityMapPage = lazy(() => import("./pages/MobilityMapPage"));
const MobilityCenterPage = lazy(() => import("./pages/MobilityCenterPage"));
const MobilityBookingTrackingPage = lazy(() => import("./pages/MobilityBookingTrackingPage"));
const NotificationSettingsPage = lazy(() => import("./pages/NotificationSettingsPage"));
const FriendsMapPage = lazy(() => import("./pages/FriendsMapPage"));
const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));
const FoodOrderTrackingPage = lazy(() => import("./pages/FoodOrderTrackingPage"));
const ChallengesPage = lazy(() => import("./pages/ChallengesPage"));
const AchievementsPage = lazy(() => import("./pages/AchievementsPage"));
const MoveEarnPage = lazy(() => import("./pages/MoveEarnPage"));
const RewardPlinkoPage = lazy(() => import("./pages/RewardPlinkoPage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const TwoFactorSettingsPage = lazy(() => import("./pages/TwoFactorSettingsPage"));
const CreditScorePage = lazy(() => import("./pages/CreditScorePage"));
const BillsPage = lazy(() => import("./pages/BillsPage"));
const GamingPage = lazy(() => import("./pages/GamingPage"));
const SupportChatPage = lazy(() => import("./pages/SupportChatPage"));
const SplitBillPage = lazy(() => import("./pages/SplitBillPage"));
const VirtualCardsPage = lazy(() => import("./pages/VirtualCardsPage"));
const SavingsPage = lazy(() => import("./pages/SavingsPage"));
const BNPLPage = lazy(() => import("./pages/BNPLPage"));
const GiftCardsPage = lazy(() => import("./pages/GiftCardsPage"));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const CryptoWalletPage = lazy(() => import("./pages/CryptoWalletPage"));
const BudgetPlannerPage = lazy(() => import("./pages/BudgetPlannerPage"));
const AdminCreditPage = lazy(() => import("./pages/AdminCreditPage"));
const AdminPanelFullPage = lazy(() => import("./pages/AdminPanelFullPage"));
const MonitoringDashboard = lazy(() => import("./pages/MonitoringDashboard"));
const MerchantAdminPage = lazy(() => import("./pages/MerchantAdminPage"));
const AdminQrManagementPage = lazy(() => import("./pages/AdminQrManagementPage"));
const StaffManagementPage = lazy(() => import("./pages/StaffManagementPage"));
const StaffLoginPage = lazy(() => import("./pages/StaffLoginPage"));
const StaffPortalPage = lazy(() => import("./pages/StaffPortalPage"));
const StaffUpgradeScreen = lazy(() => import("./pages/StaffUpgradeScreen"));
const StaffTerminalPage = lazy(() => import("./pages/StaffTerminalPage"));
const StaffSettingsPage = lazy(() => import("./pages/StaffSettingsPage"));
const StaffMobilePage = lazy(() => import("./pages/StaffMobilePage"));
const StaffInvitePage = lazy(() => import("./pages/StaffInvitePage"));
const StaffSystemCheckPage = lazy(() => import("./pages/StaffSystemCheckPage"));
const ManagerGeofencePage = lazy(() => import("./staff/ManagerGeofencePage"));
const StaffChatPage = lazy(() => import("./staff/StaffChat"));
const TaxiPromoManagerPage = lazy(() => import("./pages/TaxiPromoManagerPage"));
const TaxiProSuitePage = lazy(() => import("./pages/TaxiProSuitePage"));
const ManagerStaffLiveMapPage = lazy(() => import("./pages/ManagerStaffLiveMapPage"));
const POSPage = lazy(() => import("./pages/POSPage"));
const MerchantPosSimplePage = lazy(() => import("./pages/MerchantPosSimplePage"));
const MerchantPosCustomerDisplayPage = lazy(() => import("./pages/MerchantPosCustomerDisplayPage"));
const KDSPage = lazy(() => import("./pages/KDSPage"));
const CustomerDisplayPage = lazy(() => import("./pages/CustomerDisplayPage"));
const PublicTableOrderPage = lazy(() => import("./pages/PublicTableOrderPage"));
const QrOrderPage = lazy(() => import("./pages/QrOrderPage"));
const MerchantQrTablesPage = lazy(() => import("./pages/MerchantQrTablesPage"));
const RestaurantTablesAdminPage = lazy(() => import("./pages/RestaurantTablesAdminPage"));
const RestaurantTableGuestPage = lazy(() => import("./pages/RestaurantTableGuestPage"));
const RestaurantStaffDashboardPage = lazy(() => import("./pages/RestaurantStaffDashboardPage"));
const RestaurantKitchenPage = lazy(() => import("./pages/RestaurantKitchenPage"));
const SelfCheckoutPage = lazy(() => import("./pages/SelfCheckoutPage"));
const BlitzTransferPage = lazy(() => import("./pages/BlitzTransferPage"));
const BlitzBoostPage = lazy(() => import("./pages/BlitzBoostPage"));
const BlitzMinePage = lazy(() => import("./pages/BlitzMinePage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AdminLegalPage = lazy(() => import("./pages/AdminLegalPage"));
const AdminMerchantFeaturesPage = lazy(() => import("./pages/AdminMerchantFeaturesPage"));
const AdminAuditLogPage = lazy(() => import("./pages/AdminAuditLogPage"));
const AdminBioPayAuditPage = lazy(() => import("./pages/AdminBioPayAuditPage"));
const AdminDiagPage = lazy(() => import("./pages/AdminDiagPage"));
const AdminRtkPage = lazy(() => import("./pages/AdminRtkPage"));
const PoolFacilityPage = lazy(() => import("./pages/PoolFacilityPage"));
const PoolAdminPage = lazy(() => import("./pages/PoolAdminPage"));
const AudiTicketSalesPage = lazy(() => import("./pages/AudiTicketSalesPage"));
const ChargeAppPage = lazy(() => import("./pages/ChargeAppPage"));
const ChargeMerchantDetailPage = lazy(() => import("./pages/ChargeMerchantDetailPage"));
const StaffUIAuditPage = lazy(() => import("./staff/StaffUIAuditPage"));
const AdminPushBroadcastPage = lazy(() => import("./pages/AdminPushBroadcastPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const ExpressCheckoutPage = lazy(() => import("./pages/ExpressCheckoutPage"));
const StaffGPSPage = lazy(() => import("./pages/StaffGPSPage"));
const HotelSabreSearchPage = lazy(() => import("./pages/HotelSabreSearchPage"));
const POSExtendedPage = lazy(() => import("./pages/POSExtendedPage"));
const AdminWalletPage = lazy(() => import("./pages/AdminWalletPage"));
const AdminSMMPage = lazy(() => import("./pages/AdminSMMPage"));
const ArcadePage = lazy(() => import("./pages/ArcadePage"));
const AdminManagementPage = lazy(() => import("./pages/AdminManagementPage"));
const AffiliatePage = lazy(() => import("./pages/AffiliatePage"));
const LotteryPage = lazy(() => import("./pages/LotteryPage"));
const AIContentGeneratorPage = lazy(() => import("./pages/AIContentGeneratorPage"));
const KidsPremiumHubPage = lazy(() => import("./pages/KidsPremiumHubPage"));
const InstantCreditPage = lazy(() => import("./pages/InstantCreditPage"));
const AdminTaxiPage = lazy(() => import("./pages/AdminTaxiPage"));
const AdminDirectoryPage = lazy(() => import("./pages/AdminDirectoryPage"));
const AdminAdManagerPage = lazy(() => import("./pages/AdminAdManagerPage"));
const AdminBookingManagerPage = lazy(() => import("./pages/AdminBookingManagerPage"));
const SpinWheelPage = lazy(() => import("./pages/SpinWheelPage"));
const ClassifiedsPage = lazy(() => import("./pages/ClassifiedsPage"));
const QuestsPage = lazy(() => import("./pages/QuestsPage"));
const RetentionHubPage = lazy(() => import("./pages/RetentionHubPage"));
const MarketingHubPage = lazy(() => import("./pages/MarketingHubPage"));
const AdminRevenueDashboardPage = lazy(() => import("./pages/AdminRevenueDashboardPage"));
const AdminDeploymentInfoPage = lazy(() => import("./pages/AdminDeploymentInfoPage"));
const NotificationCenterPage = lazy(() => import("./pages/NotificationCenterPage"));
const ExecutiveCenterPage = lazy(() => import("./pages/ExecutiveCenterPage"));
const AdminAIAssistantPage = lazy(() => import("./pages/AdminAIAssistantPage"));
const KYCTestPage = lazy(() => import("./pages/KYCTestPage"));
const ContactsPage = lazy(() => import("./pages/ContactsPage"));
const UserStatsPage = lazy(() => import("./pages/UserStatsPage"));
const CurrencyConverterPage = lazy(() => import("./pages/CurrencyConverterPage"));
const HotelBookingPage = lazy(() => import("./pages/HotelBookingPage"));
const EventBookingPage = lazy(() => import("./pages/EventBookingPage"));
const RestaurantReservationPage = lazy(() => import("./pages/RestaurantReservationPage"));
const InsurancePage = lazy(() => import("./pages/InsurancePage"));
const AppointmentPage = lazy(() => import("./pages/AppointmentPage"));
const SocialFeedPage = lazy(() => import("./pages/SocialFeedPage"));
const JobMarketplacePage = lazy(() => import("./pages/JobMarketplacePage"));
const FlightSearchPage = lazy(() => import("./pages/FlightSearchPage"));
const SabreFlightsPage = lazy(() => import("./pages/SabreFlightsPage"));
const ParcelPage = lazy(() => import("./pages/ParcelPage"));
const CVBuilderPage = lazy(() => import("./pages/CVBuilderPage"));
const NearbyPage = lazy(() => import("./pages/NearbyPage"));
const MerchantPortalPage = lazy(() => import("./pages/MerchantPortalPage"));
const PublicMerchantBusinessPage = lazy(() => import("./pages/PublicMerchantBusinessPage"));
const KidsAppPage = lazy(() => import("./pages/KidsAppPage"));
const ParentControlsPage = lazy(() => import("./pages/ParentControlsPage"));
const AdminAuctionImagesPage = lazy(() => import("./pages/AdminAuctionImagesPage"));
const RealEstatePage = lazy(() => import("./pages/RealEstatePage"));
const FreelancerPage = lazy(() => import("./pages/FreelancerPage"));
const ELearningPage = lazy(() => import("./pages/ELearningPage"));
const HandwerkerPage = lazy(() => import("./pages/HandwerkerPage"));
const StreamingPage = lazy(() => import("./pages/StreamingPage"));
const TelemedizinPage = lazy(() => import("./pages/TelemedizinPage"));
const DatingPage = lazy(() => import("./pages/DatingPage"));
const GebrauchtwagenPage = lazy(() => import("./pages/GebrauchtwagenPage"));
const ReinigungPage = lazy(() => import("./pages/ReinigungPage"));
const UmzugPage = lazy(() => import("./pages/UmzugPage"));
const TierbetreuungPage = lazy(() => import("./pages/TierbetreuungPage"));
const FitnessPage = lazy(() => import("./pages/FitnessPage"));
const ReiseplanerPage = lazy(() => import("./pages/ReiseplanerPage"));
const LadesaeulenPage = lazy(() => import("./pages/LadesaeulenPage"));
const EmailMarketingAdminPage = lazy(() => import("./pages/EmailMarketingAdminPage"));
const AdminChargeOfferRulesPage = lazy(() => import("./pages/AdminChargeOfferRulesPage"));
const AllServicesPage = lazy(() => import("./pages/AllServicesPage"));
const StocksPage = lazy(() => import("./pages/StocksPage"));
const ResellingPage = lazy(() => import("./pages/ResellingPage"));
const BlitzJobsPage = lazy(() => import("./pages/BlitzJobsPage"));
const CashbackPage = lazy(() => import("./pages/CashbackPage"));
const PremiumPage = lazy(() => import("./pages/PremiumPage"));
const StoriesPage = lazy(() => import("./pages/StoriesPage"));
const LiveAuctionsPage = lazy(() => import("./pages/LiveAuctionsPage"));
const SocialHubPage = lazy(() => import("./pages/SocialHubPage"));
const BlitzLearnPage = lazy(() => import("./pages/BlitzLearnPage"));
const BlitzHubPage = lazy(() => import("./pages/BlitzHubPage"));
const LeaderboardPage = lazy(() => import("./pages/ExtraFeatures"));
const GlobalSearch = lazy(() => import("./pages/ExtraFeatures"));
const OnboardingTour = lazy(() => import("./pages/ExtraFeatures"));
const CityServicesPage = lazy(() => import("./pages/CityServicesPage"));
const BlitzPayPage = lazy(() => import("./pages/BlitzPayPage"));
const CryptoEarnPage = lazy(() => import("./pages/CryptoEarnPage"));
const CryptoBasketsPage = lazy(() => import("./pages/CryptoBasketsPage"));
const DerivativesPage = lazy(() => import("./pages/DerivativesPage"));
const LevelUpPage = lazy(() => import("./pages/LevelUpPage"));
const PredictionsPage = lazy(() => import("./pages/PredictionsPage"));
const BlitzCardPage = lazy(() => import("./pages/BlitzCardPage"));
const SuperchargerPage = lazy(() => import("./pages/SuperchargerPage"));
const DeFiWalletPage = lazy(() => import("./pages/DeFiWalletPage"));
const CryptoLoansPage = lazy(() => import("./pages/CryptoLoansPage"));
const P2PLendingPage = lazy(() => import("./pages/P2PLendingPage"));
const TradingBotPage = lazy(() => import("./pages/TradingBotPage"));
const LiveShoppingPage = lazy(() => import("./pages/LiveShoppingPage"));
const LiveKitStreamPage = lazy(() => import("./pages/LiveKitStreamPage"));
const AdminLandingLeadsPage = lazy(() => import("./pages/AdminLandingLeadsPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const DeleteAccountPage = lazy(() => import("./pages/DeleteAccountPage"));
const StoreSupportPage = lazy(() => import("./pages/StoreSupportPage"));
const SuperAppMarketplace = lazy(() => import("./components/SuperAppMarketplace").then(m => ({ default: m.SuperAppMarketplace })));
const CreatorsPage = lazy(() => import("./pages/CreatorsPage"));
const P2PPage = lazy(() => import("./pages/P2PPage"));
const CardPage = lazy(() => import("./pages/CardPage"));
const LivePage = lazy(() => import("./pages/LivePage"));
const GroupChatPage = lazy(() => import("./pages/GroupChatPage"));
const RoundupPage = lazy(() => import("./pages/RoundupPage"));
const ApartmentsPage = lazy(() => import("./pages/ApartmentsPage"));
const SkillsMarketPage = lazy(() => import("./pages/SkillsMarketPage"));
const InvoicingPage = lazy(() => import("./pages/InvoicingPage"));
const QRMenuPage = lazy(() => import("./pages/QRMenuPage"));
const BookingsPage = lazy(() => import("./pages/BookingsPage"));
const ContractsPage = lazy(() => import("./pages/ContractsPage"));
const UtilitiesHubPage = lazy(() => import("./pages/UtilitiesHubPage"));
const EngageHubPage = lazy(() => import("./pages/EngageHubPage"));
const ViralHubPage = lazy(() => import("./pages/ViralHubPage"));
const FieldAgentPortalPage = lazy(() => import("./pages/FieldAgentPortalPage"));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage"));
const AdCampaignManagerPage = lazy(() => import("./pages/AdCampaignManagerPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));

const pageTransition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

function AppContent() {
  const hasStripeReturn = typeof window !== "undefined" &&
    (window.location.search.includes("stripe_session_id") || window.location.search.includes("stripe_cancelled"));
  const hasKidsReturn = typeof window !== "undefined" && window.location.search.includes("kids_sub=success");

  // Track affiliate referral on landing (fire once, store in localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        localStorage.setItem("bb_ref", ref);
        // Fire-and-forget click tracking
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/affiliate/track-click/${encodeURIComponent(ref)}`, {
          method: "POST",
        }).catch(() => {});
      }
    } catch (error) {
      void error;
    }
  }, []);

  // Initialize Sentry once (only fires if user opted in via CookieBanner)
  useEffect(() => {
    initSentryIfConsented();
  }, []);
  
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window === "undefined") return "/";
    return getInitialAppPath({
      hasKidsReturn,
      hasStripeReturn,
      pathname: window.location.pathname,
      search: window.location.search,
    });
  });
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateMessage, setAuthGateMessage] = useState("");
  const [showFullAuth, setShowFullAuth] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(DEMO_MODE);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("bidblitz_onboarded"));
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 1024 : false);
  const user = useUser();
  const { setLang } = useI18n();
  const isGuest = !user.isAuthenticated;
  const serverKycApproved = useEffectiveKycAccess({ isGuest, isDemoMode, user });
  const isKycVerified = KYC_DISABLED || serverKycApproved || isKycApprovedOrAdmin(user);
  const routeBase = currentPath.split("?")[0] || "/";

  const isKycRestrictedPath = useCallback((path) => isKycRestrictedPathUtil(path), []);

  const syncBrowserPath = useCallback((path, mode = "push") => {
    if (typeof window === "undefined" || !path) return;
    const next = resolveBrowserPath(path);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === next) return;
    if (mode === "replace") {
      window.history.replaceState({}, "", next);
    } else {
      window.history.pushState({}, "", next);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsDesktopViewport(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const syncMobileBrowserInset = () => {
      const browserBottomOffset = viewport
        ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
        : 0;
      root.style.setProperty("--app-browser-bottom-offset", `${browserBottomOffset}px`);
    };

    syncMobileBrowserInset();
    window.addEventListener("resize", syncMobileBrowserInset);
    window.addEventListener("orientationchange", syncMobileBrowserInset);
    viewport?.addEventListener("resize", syncMobileBrowserInset);
    viewport?.addEventListener("scroll", syncMobileBrowserInset);

    return () => {
      window.removeEventListener("resize", syncMobileBrowserInset);
      window.removeEventListener("orientationchange", syncMobileBrowserInset);
      viewport?.removeEventListener("resize", syncMobileBrowserInset);
      viewport?.removeEventListener("scroll", syncMobileBrowserInset);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const nextPath = `${window.location.pathname}${window.location.search || ""}` || "/";
      setCurrentPath(nextPath);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("test-mode-active", TEST_MODE);
    return () => document.body.classList.remove("test-mode-active");
  }, []);

  useEffect(() => {
    if (user.isAuthenticated && user.language) {
      setLang(user.language);
    }
  }, [user.isAuthenticated, user.language, setLang]);

  const resolvePostAuthPath = useCallback(() => {
    if (user.isAuthenticated && (TEST_MODE_FULL_ACCESS || KYC_DISABLED)) return "/";
    if (user.isAuthenticated && user.kyc_status === "pending") return "/";
    if (user.isAuthenticated && user.kyc_status === "rejected") return "/kyc";
    if (user.isAuthenticated && user.kyc_status === "not_started") return "/kyc";
    if (currentPath === "/login" || currentPath === "/register") return "/";
    return currentPath || "/";
  }, [currentPath, user.isAuthenticated, user.kyc_status]);

  const handleAuthSuccess = useCallback(() => {
    setShowFullAuth("");
    setShowAuthGate(false);
    setIsDemoMode(false);
    const nextPath = resolvePostAuthPath();
    const resolvedPath = nextPath === "/login" || nextPath === "/register" ? "/" : nextPath;
    syncBrowserPath(resolvedPath, "replace");
    setCurrentPath(resolvedPath);
  }, [resolvePostAuthPath, syncBrowserPath]);

  // Close auth gate after login
  useEffect(() => {
    if (user.isAuthenticated) {
      const timer = setTimeout(() => {
        setShowAuthGate(false);
        setShowFullAuth("");
        setIsDemoMode(false);
        if (currentPath === "/login" || currentPath === "/register") {
          const nextPath = KYC_DISABLED || TEST_MODE_FULL_ACCESS ? "/" : user.kyc_status === "approved" ? "/" : user.kyc_status === "pending" ? "/" : "/kyc";
          syncBrowserPath(nextPath, "replace");
          setCurrentPath(nextPath);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentPath, syncBrowserPath, user.isAuthenticated, user.kyc_status]);

  // Notification polling - show toast for new notifications
  useEffect(() => {
    if (!user.isAuthenticated) return;
    let lastCheck = Date.now();
    const checkNotifs = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/notifications/unread-count`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const newNotifs = (data.notifications || []).filter(n => new Date(n.created_at).getTime() > lastCheck - 30000);
          if (newNotifs.length > 0) {
            const { toast } = await import("sonner");
            newNotifs.slice(0, 2).forEach(n => {
              toast(n.title || "Benachrichtigung", { description: n.message || "", duration: 5000 });
            });
          }
          lastCheck = Date.now();
        }
      } catch (error) {
        void error;
      }
    };
    const interval = setInterval(checkNotifs, 30000);
    checkNotifs();
    return () => clearInterval(interval);
  }, [user.isAuthenticated]);

  const requireAuth = (message) => {
    setAuthGateMessage(message || "");
    setShowAuthGate(true);
  };

  const [navState, setNavState] = useState({});

  const handleNavigate = (path, state) => {
    // Track page view
    tracker.pageView(path);

    // Store navigation state (e.g., selected child for parent-controls)
    setNavState(state || {});

    // Auto-switch mode based on navigation target
    if (path === "/kids" || path === "/kids-app") {
      if (user.isAuthenticated && user.modes.includes("kids")) {
        user.setMode("kids");
      }
    } else if (path === "/merchant-portal" || path === "/merchant") {
      if (user.isAuthenticated && user.modes.includes("merchant")) {
        user.setMode("merchant");
      }
    } else if (path === "/" || path === "/wallet") {
      if (user.isAuthenticated && user.currentMode !== "personal") {
        user.setMode("personal");
      }
    }

    // Scan tab
    if (path === "/scan") {
      if (isGuest) {
        requireAuth();
        return;
      }
    }
    // Admin page requires admin role
    if (path === "/admin" && (!user.isAuthenticated || user.role !== "admin")) {
      requireAuth();
      return;
    }
    if (!KYC_DISABLED && !isGuest && !isDemoMode && !isKycVerified && isKycRestrictedPath(path)) {
      syncBrowserPath("/kyc");
      setCurrentPath("/kyc");
      return;
    }
    syncBrowserPath(path);
    setCurrentPath(path);
  };

  // Wait for session restore
  if (!user.sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <motion.div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #00C2FF, #0088CC)" }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <span className="text-[14px] font-bold text-white font-outfit">BB</span>
        </motion.div>
      </div>
    );
  }

  if ((currentPath === "/login" || currentPath === "/register") && !user.isAuthenticated) {
    return (
      <div className="relative">
        <AuthPage
          onBack={() => handleNavigate("/")}
          initialMode={currentPath === "/register" ? "register" : "login"}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // Full-screen auth (from header Sign In or homepage CTA)
  if (showFullAuth && !user.isAuthenticated) {
    return (
      <div className="relative">
        <AuthPage onBack={() => setShowFullAuth("")} initialMode={showFullAuth} onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  const renderPage = () => {
    // Strip query string for route matching, keep params accessible to pages
    const queryStr = currentPath.includes("?") ? currentPath.split("?")[1] : "";
    const basePath = currentPath.split("?")[0];
    const routeParams = Object.fromEntries(new URLSearchParams(queryStr));
    const homeProps = {
      onNavigate: handleNavigate, isGuest, isDemoMode,
      forceKycUnlocked: isKycVerified,
      onLogin: () => { tracker.ctaClick("login", "home"); setShowFullAuth("login"); },
      onRegister: () => { tracker.guestRegisterClick("home"); setShowFullAuth("register"); },
      onStartDemo: () => {
        if (STORE_SAFE_MODE) return;
        tracker.demoStart();
        setIsDemoMode(true);
        setCurrentPath("/");
        import("sonner").then(({ toast }) => {
          toast.success("Demo-Modus aktiviert", {
            description: "Erkunde alle Features ohne Konto. Klick unten auf Wallet, Auktionen, Mehr …",
            duration: 5500,
          });
        });
      },
    };
    const pageProps = {
      onNavigate: handleNavigate, isGuest, isDemoMode,
      forceKycUnlocked: isKycVerified,
      onAuthRequired: requireAuth,
      onLogin: () => { tracker.ctaClick("login", currentPath); setShowFullAuth("login"); },
      onRegister: () => { tracker.guestRegisterClick(currentPath); setShowFullAuth("register"); },
      routeParams,
      onStartDemo: () => {
        if (STORE_SAFE_MODE) return;
        tracker.demoStart();
        setIsDemoMode(true);
        setCurrentPath("/");
        import("sonner").then(({ toast }) => {
          toast.success("Demo-Modus aktiviert", {
            description: "Erkunde alle Features ohne Konto. Klick unten auf Wallet, Auktionen, Mehr …",
            duration: 5500,
          });
        });
      },
    };
    if (isStoreBlockedPath(currentPath)) {
      return <StoreSafeUnavailablePage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
    }
    if (!isGuest && SHOW_KYC_GATE && !isDemoMode && !isKycVerified && isKycRestrictedPath(currentPath)) {
      return <KYCFlow onBack={() => handleNavigate("/")} onComplete={() => handleNavigate("/kyc/status")} />;
    }
    const specialRoute = renderSpecialRoutes({
      currentPath,
      handleNavigate,
      requireAuth,
      isGuest,
      user,
      onLogin: () => setShowFullAuth("login"),
    });
    if (specialRoute) {
      return specialRoute;
    }
    switch (basePath) {
      case "/":
        return <HomePage {...homeProps} />;
      case "/landing":
        return <LandingPage onGetStarted={() => handleNavigate("/")} />;
      case "/wallet":
        return <WalletPage {...pageProps} />;
      case "/scan":
        return (isGuest && !isDemoMode)
          ? <HomePage {...homeProps} />
          : <ScannerPage onNavigate={handleNavigate} />;
      case "/merchant":
        return <MerchantPage {...pageProps} />;
      case "/merchant-connect":
        return <MerchantConnectPage onBack={() => handleNavigate("/merchant")} />;
      case "/influencer":
        return user.role === "influencer" || user.role === "admin"
          ? <InfluencerDashboard onBack={() => handleNavigate("/more")} />
          : <InfluencerPage onBack={() => handleNavigate("/more")} />;
      case "/manager-dashboard":
        return user.role === "manager" || user.role === "admin"
          ? <ManagerDashboard onBack={() => handleNavigate("/more")} />
          : <HomePage {...homeProps} />;
      case "/investor":
        return <InvestorPage onBack={() => handleNavigate("/more")} />;
      case "/investieren":
        return <InvestierenPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/investor-login":
        return <InvestorLoginPage onBack={() => handleNavigate("/investieren")} onNavigate={handleNavigate} />;
      case "/investor-register":
        return <InvestorRegisterPage onBack={() => handleNavigate("/investieren")} onNavigate={handleNavigate} />;
      case "/investor-dashboard":
        return <InvestorDashboardPage onNavigate={handleNavigate} />;
      case "/investor-portal":
        return <InvestorPortalPage onNavigate={handleNavigate} />;
      case "/investor-portal/documents":
        return <InvestorPortalDocumentsPage onNavigate={handleNavigate} />;
      case "/investor-portal/updates":
        return <InvestorPortalUpdatesPage onNavigate={handleNavigate} />;
      case "/investor-portal/questions":
        return <InvestorPortalQuestionsPage onNavigate={handleNavigate} />;
      case "/investor-portal/meetings":
        return <InvestorPortalMeetingsPage onNavigate={handleNavigate} />;
      case "/investor-portal/profile":
        return <InvestorPortalProfilePage onNavigate={handleNavigate} />;
      case "/executive":
        return (!user.isAuthenticated || !["admin", "investor", "merchant"].includes(user.role))
          ? <HomePage {...homeProps} />
          : <ExecutiveCenterPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/rewards":
        return <RewardsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/verification":
        return TEST_MODE_FULL_ACCESS ? <HomePage {...homeProps} /> : <VerificationPage onBack={() => handleNavigate("/more")} />;
      case "/merchant-dashboard":
        return <MerchantDashboardPage onBack={() => handleNavigate("/more")} />;
      case "/marketplace-dashboard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MarketplaceDashboardPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} routeParams={routeParams} />;
      case "/pay":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <PaymentPage onBack={() => handleNavigate("/wallet")} onNavigate={handleNavigate} />;
      case "/send":
      case "/send-money":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SendMoneyPage onBack={() => handleNavigate("/wallet")} onNavigate={handleNavigate} />;
      case "/receive":
      case "/receive-money":
      case "/my-barcode":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ReceiveMoneyPage onBack={() => handleNavigate("/wallet")} onNavigate={handleNavigate} />;
      case "/terminal":
        return <MerchantTerminalPage onBack={() => handleNavigate("/more")} />;
      case "/merchant-onboarding":
        return <MerchantOnboardingPage onBack={() => handleNavigate("/more")} />;
      case "/merchant-pricing":
        return <MerchantPricingPage onBack={() => handleNavigate("/more")} onStartTrial={() => handleNavigate("/merchant-onboarding")} />;
      case "/merchant-landing":
        return <MerchantLandingPage onNavigate={handleNavigate} />;
      case "/mining":
        return <MiningPage onNavigate={handleNavigate} onBack={() => handleNavigate("/more")} />;
      case "/mining-trust":
        return <MiningTrustPage onNavigate={handleNavigate} onBack={() => handleNavigate("/mining")} />;
      case "/mining-trust-admin":
        return <MiningTrustAdminPage onBack={() => handleNavigate("/mining-trust")} />;
      case "/nft":
        return <NFTGeneratorPage onNavigate={handleNavigate} />;
      case "/admin":
        return user.role === "admin"
          ? <AdminPanelFullPage onNavigate={handleNavigate} onBack={() => handleNavigate("/more")} />
          : <HomePage {...homeProps} />;
      case "/admin/monitoring":
        return user.role === "admin"
          ? <MonitoringDashboard onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/admin/investor-leads":
        return user.role === "admin" ? <AdminInvestorLeadsPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/investor-dashboard":
        return user.role === "admin" ? <AdminInvestorDashboardPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/investor-documents":
        return user.role === "admin" ? <AdminInvestorDocumentsPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/investor-updates":
        return user.role === "admin" ? <AdminInvestorUpdatesPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/investor-meetings":
        return user.role === "admin" ? <AdminInvestorMeetingsPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/visual-qa":
        return user.role === "admin" ? <AdminVisualQaPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/master-roadmap":
        return user.role === "admin" ? <AdminMasterRoadmapPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/investors/progress":
      case "/investor-progress":
        return <InvestorProgressPage onBack={() => handleNavigate("/")} />;
      case "/design-system":
        return process.env.NODE_ENV !== "production" || user.role === "admin"
          ? <DesignSystemPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />
          : <HomePage {...homeProps} />;
      case "/admin/ai-assistant":
        return user.role === "admin"
          ? <AdminAIAssistantPage onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/admin/merchants":
        return user.role === "admin"
          ? <MerchantAdminPage onNavigate={handleNavigate} onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/admin/qr-management":
        return user.role === "admin"
          ? <AdminQrManagementPage onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/merchant/staff":
        return user.role === "merchant" || user.role === "admin"
          ? <StaffManagementPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />
          : <HomePage {...homeProps} />;
      case "/staff/login":
        return <StaffLoginPage onBack={() => handleNavigate("/")} onLoginSuccess={() => handleNavigate("/staff/portal")} />;
      case "/staff/portal":
        return <StaffPortalPage onBack={() => handleNavigate("/")} />;
      case "/staff/mobile":
        return <StaffMobilePage onBack={() => handleNavigate("/")} />;
      case "/staff/invite":
        return <StaffInvitePage onSuccess={() => handleNavigate("/staff/mobile")} />;
      case "/merchant/staff/upgrade":
      case "/staff/upgrade":
        return <StaffUpgradeScreen onSuccess={() => handleNavigate("/merchant/staff")} onBack={() => handleNavigate("/merchant/staff")} />;
      case "/staff/settings":
        return user.role === "merchant" || user.role === "admin"
          ? <StaffSettingsPage onBack={() => handleNavigate("/merchant/staff")} />
          : <HomePage {...homeProps} />;
      case "/merchant/staff/geofence":
        return user.role === "merchant" || user.role === "admin"
          ? <ManagerGeofencePage onBack={() => handleNavigate("/merchant/staff")} />
          : <HomePage {...homeProps} />;
      case "/merchant/staff/chat":
        return user.role === "merchant" || user.role === "admin"
          ? <StaffChatPage role="manager" onBack={() => handleNavigate("/merchant/staff")} />
          : <HomePage {...homeProps} />;
      case "/merchant/taxi/promos":
        return user.role === "merchant" || user.role === "admin"
          ? <TaxiPromoManagerPage onBack={() => handleNavigate("/merchant/dashboard")} />
          : <HomePage {...homeProps} />;
      case "/taxi/pro":
        return <HomePage {...homeProps} />;
      case "/merchant/staff/live-map":
        return user.role === "merchant" || user.role === "admin"
          ? <ManagerStaffLiveMapPage onBack={() => handleNavigate("/merchant/staff")} />
          : <HomePage {...homeProps} />;
      case "/pos":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <POSPage onBack={() => handleNavigate("/more")} />;
      case "/pool":
        return <PoolFacilityPage onBack={() => handleNavigate("/all-services")} onNavigate={handleNavigate} />;
      case "/audi-tickets":
        return <AudiTicketSalesPage onBack={() => handleNavigate("/all-services")} onNavigate={handleNavigate} />;
      case "/charge-app":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ChargeAppPage onBack={() => handleNavigate("/all-services")} onNavigate={handleNavigate} />;
      case "/charge-app/merchant":
        return (isGuest && !isDemoMode)
          ? <HomePage {...homeProps} />
          : <ChargeMerchantDetailPage slug={routeParams.slug} onBack={() => handleNavigate("/charge-app")} onNavigate={handleNavigate} />;
      case "/selfcheckout":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SelfCheckoutPage onBack={() => handleNavigate("/")} navState={navState} />;
      case "/admin/old":
        return user.role === "admin"
          ? <AdminPage onNavigate={handleNavigate} />
          : <HomePage {...homeProps} />;
      case "/test/kyc":
        return TEST_MODE_FULL_ACCESS ? <HomePage {...homeProps} /> : <KYCTestPage />;
      case "/kyc":
      case "/kyc/start":
      case "/profile/kyc":
      case "/kyc/upload":
      case "/kyc/review":
      case "/kyc/status":
        return (isGuest && !isDemoMode)
          ? <HomePage {...homeProps} />
          : TEST_MODE_FULL_ACCESS
            ? <HomePage {...homeProps} />
            : <KYCFlow onBack={() => handleNavigate("/more")} onComplete={() => handleNavigate("/kyc/status")} />;
      case "/blitz-transfer":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BlitzTransferPage onNavigate={handleNavigate} onBack={() => handleNavigate("/more")} />;
      case "/blitz-boost":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BlitzBoostPage onNavigate={handleNavigate} onBack={() => handleNavigate("/more")} />;
      case "/blitz-mine":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BlitzMinePage onNavigate={handleNavigate} onBack={() => handleNavigate("/more")} />;
      case "/legal/agb":
      case "/legal/datenschutz":
      case "/legal/impressum":
      case "/legal/sicherheit": {
        const slug = currentPath.split("/legal/")[1];
        return <LegalPage slug={slug} onNavigate={handleNavigate} onBack={() => handleNavigate("/more")} />;
      }
      case "/admin/legal":
        return user.role === "admin" ? <AdminLegalPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/merchant-features":
        return user.role === "admin" ? <AdminMerchantFeaturesPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/audit-log":
        return user.role === "admin" ? <AdminAuditLogPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/biopay-audit":
        return user.role === "admin" ? <AdminBioPayAuditPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/diag":
        return user.role === "admin" ? <AdminDiagPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/rtk":
        return user.role === "admin" ? <AdminRtkPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/pool":
        return user.role === "admin" ? <PoolAdminPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/staff/ui-audit":
        return <StaffUIAuditPage onBack={() => handleNavigate("/staff")} />;
      case "/admin/push-broadcast":
        return user.role === "admin" ? <AdminPushBroadcastPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/analytics":
        return user.role === "admin" ? <AdminAnalyticsPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/deployment-info":
        return user.role === "admin" ? <AdminDeploymentInfoPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/express-checkout":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ExpressCheckoutPage onBack={() => handleNavigate("/more")} />;
      case "/staff/gps":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <StaffGPSPage onBack={() => handleNavigate("/staff")} />;
      case "/hotels/sabre":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <HotelSabreSearchPage onBack={() => handleNavigate("/hotels")} />;
      case "/pos/extended":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <POSExtendedPage onBack={() => handleNavigate("/pos")} />;
      case "/admin/wallet":
        return user.role === "admin" ? <AdminWalletPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/smm":
        return user.role === "admin" ? <AdminSMMPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/arcade":
        return <ArcadePage onBack={() => handleNavigate("/")} />;
      case "/affiliate":
        return <AffiliatePage onBack={() => handleNavigate("/")} />;
      case "/lottery":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LotteryPage onBack={() => handleNavigate("/more")} />;
      case "/ai/content":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <AIContentGeneratorPage onBack={() => handleNavigate("/more")} />;
      case "/kids-premium":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <KidsPremiumHubPage onBack={() => handleNavigate("/kids")} childId={user.kids_active_child} />;
      case "/instant-credit":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <InstantCreditPage onBack={() => handleNavigate("/more")} />;
      case "/admin/manage":
        return user.role === "admin" ? <AdminManagementPage onBack={() => handleNavigate("/admin")} initialTab="customers" /> : <HomePage {...homeProps} />;
      case "/admin/kyc":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab="verification" /> : <HomePage {...homeProps} />;
      case "/admin/pay-requests":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab="pay-requests" /> : <HomePage {...homeProps} />;
      case "/admin/payouts":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab="payouts" /> : <HomePage {...homeProps} />;
      case "/admin/credits":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab="credits" /> : <HomePage {...homeProps} />;
      case "/admin/testimonials":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab="testimonials" /> : <HomePage {...homeProps} />;
      case "/admin/pay-sdk":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab="pay_sdk" /> : <HomePage {...homeProps} />;
      case "/admin/loyalty-config":
      case "/admin/loyalty-analytics":
      case "/admin/coin-rates":
      case "/admin/cashback-rates":
        return user.role === "admin" ? <LoyaltyPage onBack={() => handleNavigate("/admin")} onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
      case "/admin/scooter-fleet":
      case "/admin/scooter-add":
        return user.role === "admin" ? <ScooterPage onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
      case "/admin/taxi-drivers":
        return user.role === "admin" ? <AdminTaxiPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/restaurants":
      case "/admin/qr-tables":
        return user.role === "admin" ? <RestaurantTablesAdminPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/audi-ticket-system":
        return user.role === "admin" ? <AudiTicketSalesPage onBack={() => handleNavigate("/admin")} onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
      case "/admin/biopay-audit-center":
        return user.role === "admin" ? <AdminBioPayAuditPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/system-health":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab="flags" /> : <HomePage {...homeProps} />;
      case "/admin/users":
      case "/admin/managers":
      case "/admin/employees":
      case "/admin/enterprise":
      case "/admin/influencer":
      case "/admin/partner-credit":
      case "/admin/partners":
      case "/admin/applications":
      case "/admin/products":
      case "/admin/auctions":
      case "/admin/vip-auctions":
      case "/admin/voucher-auctions":
      case "/admin/bot":
      case "/admin/winners":
      case "/admin/product-stats":
      case "/admin/user-stats":
      case "/admin/merchant-coupons":
      case "/admin/bidder-coupons":
      case "/admin/partner-coupons":
      case "/admin/discounts":
      case "/admin/transactions":
      case "/admin/topup":
      case "/admin/wise":
      case "/admin/maintenance":
      case "/admin/cms":
      case "/admin/game-settings":
      case "/admin/sustainability":
      case "/admin/passwords":
      case "/admin/logs":
      case "/admin/debug":
      case "/admin/health":
      case "/admin/database":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab={getAdminTabFromPath(currentPath)} /> : <HomePage {...homeProps} />;
      case "/admin/taxi":
        return user.role === "admin" ? <AdminTaxiPage onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
      case "/admin/directory":
        return user.role === "admin" ? <AdminDirectoryPage onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
      case "/admin/ads":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} defaultTab="promos" /> : <HomePage {...homeProps} />;
      case "/admin/bookings":
        return user.role === "admin" ? <AdminBookingManagerPage onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
      case "/spin-wheel":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SpinWheelPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/classifieds":
        return <ClassifiedsPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/quests":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <QuestsPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/move":
      case "/move-earn":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MoveEarnPage onBack={() => handleNavigate("/more")} />;
      case "/reward-plinko":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <RewardPlinkoPage onBack={() => handleNavigate("/rewards")} onNavigate={handleNavigate} />;
      case "/rewards-hub":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <RewardsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/marketing-hub":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MarketingHubPage onBack={() => handleNavigate("/")} />;
      case "/admin/revenue":
        return user.role === "admin" ? <AdminRevenueDashboardPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/customers":
        return user.role === "admin" ? <AdminManagementPage onBack={() => handleNavigate("/admin")} initialTab="customers" /> : <HomePage {...homeProps} />;
      case "/admin/payments":
        return user.role === "admin" ? <AdminManagementPage onBack={() => handleNavigate("/admin")} initialTab="transactions" /> : <HomePage {...homeProps} />;
      case "/admin/modules":
        return user.role === "admin" ? <AdminManagementPage onBack={() => handleNavigate("/admin")} initialTab="modules" /> : <HomePage {...homeProps} />;;
      case "/notifications":
        return isGuest
          ? <HomePage {...homeProps} />
          : <NotificationsPage onBack={() => handleNavigate("/")} />;
      case "/more":
        return <MorePage {...pageProps} />;
      case "/auctions":
        return <AuctionsPage {...pageProps} routeParams={routeParams} />;
      case "/auction-admin":
        return user.role === "admin"
          ? <AuctionAdminPage onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/taxi":
        return <TaxiPage onNavigate={handleNavigate} />;
      case "/taxi-partner":
        return <HomePage {...homeProps} />;
      case "/taxi-dashboard":
        return <HomePage {...homeProps} />;
      case "/scooter":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ScooterPage onNavigate={handleNavigate} />;
      case "/food":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FoodPage onNavigate={handleNavigate} />;
      case "/driver-dashboard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <DriverDashboardPage onNavigate={handleNavigate} />;
      case "/field-agent-portal":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FieldAgentPortalPage onNavigate={handleNavigate} />;
      case "/ads":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <AdCampaignManagerPage onNavigate={handleNavigate} />;
      case "/bookings":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BookingsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/directory":
        return <DirectoryPage onNavigate={handleNavigate} />;
      case "/restaurant-dashboard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <RestaurantDashboardPage onNavigate={handleNavigate} />;
      case "/child-mode":
        return <ChildModePage />;
      case "/marketplace":
        return <MarketplacePage onNavigate={handleNavigate} routeParams={routeParams} />;
      case "/commerce-center":
        return <CommerceCenterPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/mobility-center":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MobilityCenterPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/chat":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ChatPage onNavigate={handleNavigate} />;
      case "/reset-password":
        return <ResetPasswordPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/support-chat":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SupportChatPage onBack={() => handleNavigate("/more")} />;
      case "/admin/support":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SupportChatPage onBack={() => handleNavigate("/admin")} isAdmin={true} />;
      case "/partners":
        return <PartnersPage />;
      case "/referral":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ReferralSystemPage onNavigate={handleNavigate} />;
      case "/loyalty":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LoyaltyPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/kids":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <KidsPaywall onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/nfc":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <NfcPayPage onBack={() => handleNavigate("/more")} />;
      case "/vip":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VipPage onBack={() => handleNavigate("/more")} />;
      case "/mobility-map":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MobilityMapPage onNavigate={handleNavigate} />;
      case "/notification-settings":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <NotificationSettingsPage onNavigate={handleNavigate} />;
      case "/friends-map":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FriendsMapPage onNavigate={handleNavigate} />;
      case "/credit-score":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CreditScorePage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/bills":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BillsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/split-bill":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SplitBillPage onBack={() => handleNavigate("/more")} />;
      case "/virtual-cards":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VirtualCardsPage onBack={() => handleNavigate("/more")} />;
      case "/savings":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SavingsPage onBack={() => handleNavigate("/more")} />;
      case "/bnpl":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BNPLPage onBack={() => handleNavigate("/more")} />;
      case "/gift-cards":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <GiftCardsPage onBack={() => handleNavigate("/more")} />;
      case "/ai-assistant":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <AIAssistantPage onBack={() => handleNavigate("/more")} />;
      case "/crypto":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CryptoWalletPage onBack={() => handleNavigate("/more")} />;
      case "/budget":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BudgetPlannerPage onBack={() => handleNavigate("/more")} />;
      case "/notification-center":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <NotificationCenterPage onBack={() => handleNavigate("/more")} />;
      case "/contacts":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ContactsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/user-stats":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <UserStatsPage onBack={() => handleNavigate("/more")} />;
      case "/currency":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CurrencyConverterPage onBack={() => handleNavigate("/more")} />;
      case "/hotels":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <HotelBookingPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/events":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <EventBookingPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/restaurants":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <RestaurantReservationPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/insurance":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <InsurancePage onBack={() => handleNavigate("/more")} />;
      case "/appointments":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BookingsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/social":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SocialFeedPage onBack={() => handleNavigate("/more")} />;
      case "/jobs":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <JobMarketplacePage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/flights":
      case "/flights-live":
      case "/sabre-flights":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SabreFlightsPage onBack={() => handleNavigate("/more")} />;
      case "/flights-catalog":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FlightSearchPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/parcels":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ParcelPage onBack={() => handleNavigate("/more")} />;
      case "/cv-builder":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CVBuilderPage onBack={() => handleNavigate("/jobs")} />;
      case "/nearby":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <NearbyPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/merchant-portal":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MerchantPortalPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/kids-app":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <KidsAppPage onBack={() => handleNavigate("/kids")} />;
      case "/parent-controls":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ParentControlsPage
            onBack={() => handleNavigate("/kids")}
            childId={navState?.childId}
            childName={navState?.childName}
          />;
      case "/admin/auction-images":
        return (!user.isAuthenticated || user.role !== "admin")
          ? <HomePage {...homeProps} />
          : <AdminAuctionImagesPage onBack={() => handleNavigate("/admin")} />;
      case "/gaming":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <GamingPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/real-estate":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <RealEstatePage onBack={() => handleNavigate("/more")} />;
      case "/freelancer":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FreelancerPage onBack={() => handleNavigate("/more")} />;
      case "/elearning":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ELearningPage onBack={() => handleNavigate("/more")} />;
      case "/handwerker":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <HandwerkerPage onBack={() => handleNavigate("/more")} />;
      case "/streaming":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <StreamingPage onBack={() => handleNavigate("/more")} />;
      case "/telemedizin":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <TelemedizinPage onBack={() => handleNavigate("/more")} />;
      case "/dating":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <DatingPage onBack={() => handleNavigate("/more")} />;
      case "/gebrauchtwagen":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <GebrauchtwagenPage onBack={() => handleNavigate("/more")} />;
      case "/reinigung":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ReinigungPage onBack={() => handleNavigate("/more")} />;
      case "/umzug":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <UmzugPage onBack={() => handleNavigate("/more")} />;
      case "/tierbetreuung":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <TierbetreuungPage onBack={() => handleNavigate("/more")} />;
      case "/fitness":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FitnessPage onBack={() => handleNavigate("/more")} />;
      case "/reiseplaner":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ReiseplanerPage onBack={() => handleNavigate("/more")} />;
      case "/ladesaeulen":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LadesaeulenPage onBack={() => handleNavigate("/more")} />;
      case "/admin/email-marketing":
        return user.role === "admin"
          ? <EmailMarketingAdminPage onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/admin/charge-offer-rules":
        return user.role === "admin"
          ? <AdminChargeOfferRulesPage onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/all-services":
        return <AllServicesPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/stocks":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <StocksPage onBack={() => handleNavigate("/more")} />;
      case "/reselling":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ResellingPage onBack={() => handleNavigate("/more")} />;
      case "/blitzjobs":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BlitzJobsPage onBack={() => handleNavigate("/more")} />;
      case "/cashback":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CashbackPage onBack={() => handleNavigate("/more")} />;
      case "/premium":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <PremiumPage onBack={() => handleNavigate("/more")} />;
      case "/stories":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <StoriesPage onBack={() => handleNavigate("/more")} />;
      case "/live-auctions":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LiveAuctionsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} routeParams={routeParams} />;
      case "/social-hub":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SocialHubPage onBack={() => handleNavigate("/more")} />;
      case "/blitzlearn":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BlitzLearnPage onBack={() => handleNavigate("/more")} />;
      case "/blitzhub":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BlitzHubPage onBack={() => handleNavigate("/more")} />;
      case "/leaderboard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LeaderboardPage onBack={() => handleNavigate("/more")} />;
      case "/city":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CityServicesPage onBack={() => handleNavigate("/more")} />;
      case "/blitzpay":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BlitzPayPage onBack={() => handleNavigate("/more")} />;
      case "/crypto-earn":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CryptoEarnPage onBack={() => handleNavigate("/more")} />;
      case "/crypto-baskets":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CryptoBasketsPage onBack={() => handleNavigate("/more")} />;
      case "/derivatives":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <DerivativesPage onBack={() => handleNavigate("/more")} />;
      case "/levelup":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LevelUpPage onBack={() => handleNavigate("/more")} />;
      case "/predictions":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <PredictionsPage onBack={() => handleNavigate("/more")} />;
      case "/blitzcard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BlitzCardPage onBack={() => handleNavigate("/more")} />;
      case "/supercharger":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SuperchargerPage onBack={() => handleNavigate("/more")} />;
      case "/defi-wallet":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <DeFiWalletPage onBack={() => handleNavigate("/more")} />;
      case "/crypto-loans":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CryptoLoansPage onBack={() => handleNavigate("/more")} />;
      case "/p2p-lending":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <P2PLendingPage onBack={() => handleNavigate("/more")} />;
      case "/trading-bot":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <TradingBotPage onBack={() => handleNavigate("/more")} />;
      case "/live-shopping":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LiveKitStreamPage onBack={() => handleNavigate("/more")} />;
      case "/livekit-stream":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LiveKitStreamPage onBack={() => handleNavigate("/more")} />;
      case "/admin/landing-leads":
        return user.role === "admin"
          ? <AdminLandingLeadsPage onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/datenschutz":
      case "/privacy":
        return <PrivacyPolicyPage onBack={() => handleNavigate("/")} />;
      case "/agb":
      case "/terms":
        return <TermsPage onBack={() => handleNavigate("/")} />;
      case "/contact":
        return <ContactPage onBack={() => handleNavigate("/")} />;
      case "/delete-account":
        return <DeleteAccountPage onBack={() => handleNavigate("/")} />;
      case "/support":
        return <StoreSupportPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/wallet-dashboard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <WalletPage {...pageProps} />;
      case "/super-marketplace":
        return <SuperAppMarketplace />;
      case "/creators":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CreatorsPage onBack={() => handleNavigate("/more")} />;
      case "/p2p":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <P2PPage onNavigate={handleNavigate} />;
      case "/card":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <CardPage onNavigate={handleNavigate} />;
      case "/live":
        return <LivePage onNavigate={handleNavigate} />;
      case "/groupchat":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <GroupChatPage onNavigate={handleNavigate} />;
      case "/roundup":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <RoundupPage onNavigate={handleNavigate} />;
      case "/apartments":
        return <ApartmentsPage onNavigate={handleNavigate} />;
      case "/skills-market":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SkillsMarketPage onBack={() => handleNavigate("/more")} />;
      case "/invoicing":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <InvoicingPage onBack={() => handleNavigate("/more")} />;
      case "/qr-menu":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <QRMenuPage onBack={() => handleNavigate("/more")} />;
      case "/termin-booking":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <BookingsPage onBack={() => handleNavigate("/more")} />;
      case "/contracts":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ContractsPage onBack={() => handleNavigate("/more")} />;
      case "/utilities":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <UtilitiesHubPage onBack={() => handleNavigate("/more")} />;
      case "/engage":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <EngageHubPage onBack={() => handleNavigate("/more")} />;
      case "/viral":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ViralHubPage onBack={() => handleNavigate("/more")} />;
      
      // Car Rental Module
      case "/car-rental":
        return <CarListPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/car-rental/my-bookings":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MyCarBookingsPage onBack={() => handleNavigate("/car-rental")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorCarRentalDashboardPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/cars":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorCarsPage onBack={() => handleNavigate("/car-rental/vendor")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/cars/new":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorCarsPage onBack={() => handleNavigate("/car-rental/vendor")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/bookings":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorBookingsPage onBack={() => handleNavigate("/car-rental/vendor")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/invoices":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorInvoicesPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/payouts":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorPayoutsPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/damages":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorDamagesPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/settings":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorSettingsPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/staff":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorStaffPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/customers":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorBookingsPage onBack={() => handleNavigate("/car-rental/vendor")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/reports":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorReportsPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/admin":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <AdminCarRentalPage onBack={() => handleNavigate("/admin")} onNavigate={handleNavigate} />;
      case "/car-rental/admin/disputes":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <AdminDisputesPage onBack={() => handleNavigate("/car-rental/admin")} />;
      
      case "/challenges":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ChallengesPage onBack={() => handleNavigate("/more")} />;
      case "/achievements":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <AchievementsPage onBack={() => handleNavigate("/gaming")} />;
      case "/friends":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FriendsPage onBack={() => handleNavigate("/more")} />;
      case "/settings/2fa":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <TwoFactorSettingsPage onBack={() => handleNavigate("/settings")} />;
      
      default:
        // ── Admin sub-routes catch-all: map /admin/{slug} → AdminPage with tab
        if (currentPath.startsWith("/admin/")) {
          if (user.role !== "admin") return <HomePage {...homeProps} />;
          const tab = getAdminTabFromPath(currentPath);
          return <AdminPage onNavigate={handleNavigate} defaultTab={tab} />;
        }
        // Handle dynamic routes
        if (currentPath.startsWith("/car-rental/vendor/bookings/")) {
          const bId = currentPath.split("/car-rental/vendor/bookings/")[1];
          return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <VendorBookingDetailPage bookingId={bId} onBack={() => handleNavigate("/car-rental/vendor/bookings")} onNavigate={handleNavigate} />;
        }
        if (currentPath.startsWith("/car-rental/my-bookings/")) {
          const bId = currentPath.split("/car-rental/my-bookings/")[1];
          return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MyBookingDetailPage bookingId={bId} onBack={() => handleNavigate("/car-rental/my-bookings")} onNavigate={handleNavigate} />;
        }
        if (currentPath.startsWith("/car-rental/car/")) {
          const carId = currentPath.split("/car-rental/car/")[1];
          return <CarDetailPage carId={carId} onBack={() => handleNavigate("/car-rental")} onNavigate={handleNavigate} />;
        }
        if (currentPath.startsWith("/mobility-booking/")) {
          const bookingId = currentPath.split("/mobility-booking/")[1];
          return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MobilityBookingTrackingPage bookingId={bookingId} onBack={() => handleNavigate("/mobility-map")} onNavigate={handleNavigate} />;
        }
        if (currentPath.startsWith("/food/track/")) {
          const orderId = currentPath.split("/food/track/")[1];
          return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FoodOrderTrackingPage orderId={orderId} onBack={() => handleNavigate("/food")} />;
        }
        return <HomePage {...homeProps} />;
    }
  };

  const {
    isCheckout,
    isPublicInvoicePayment,
    isQrOrder,
    isRestaurantTableGuest,
    isInvoicePay,
    isStaffEmployeeShell,
    isFullScreenStaffMgr,
    showBottomNav,
    showBackToHome,
  } = getAppShellFlags(currentPath, isDesktopViewport);

  const showActiveAccountBanner =
    user.isAuthenticated &&
    user.role === "admin" &&
    !isDemoMode &&
    !isCheckout &&
    !isPublicInvoicePayment &&
    !isQrOrder &&
    !isRestaurantTableGuest &&
    !isInvoicePay &&
    !isStaffEmployeeShell &&
    !isFullScreenStaffMgr &&
    currentPath.split("?")[0].startsWith("/admin");

  const showTestBuildDebugLine =
    user.isAuthenticated &&
    user.role === "admin" &&
    TEST_MODE_FULL_ACCESS &&
    !isDemoMode &&
    !isCheckout &&
    !isPublicInvoicePayment &&
    !isQrOrder &&
    !isRestaurantTableGuest &&
    !isInvoicePay &&
    !isStaffEmployeeShell &&
    !isFullScreenStaffMgr;

  return (
    <div className="app-container" data-testid="app-container">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#141414", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: "13px", fontFamily: "Outfit, sans-serif" },
        }}
      />
      <WebUpdateBanner />
      {isDemoMode && <DemoBanner onExit={() => { tracker.demoExit(); setIsDemoMode(false); setCurrentPath("/"); }} />}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPath}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={pageTransition}
          className="min-h-screen"
          style={isDemoMode ? { paddingTop: 36 } : undefined}
        >
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#050505]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-[#FFD700] border-t-transparent animate-spin" />
                <p className="text-[11px] text-white/50 uppercase tracking-wider">Lädt...</p>
              </div>
            </div>
          }>
            {showBackToHome && <BackToHomeBar onHome={() => handleNavigate("/")} />}
            {showTestBuildDebugLine && <TestBuildDebugLine />}
            {showActiveAccountBanner && (
              <ActiveAccountBanner />
            )}
            {renderPage()}
          </Suspense>
        </motion.div>
      </AnimatePresence>
      {showBottomNav && (
        <BottomNav 
          currentPath={currentPath} 
          onNavigate={handleNavigate} 
        />
      )}
      <AuthGateOverlay
        isOpen={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        message={authGateMessage}
      />
      <PWAInstallPrompt />
      <PushPermissionPrompt isAuthenticated={user.isAuthenticated} />
      {/* Global Search Overlay */}
      <AnimatePresence>
        {showGlobalSearch && <GlobalSearch onNavigate={handleNavigate} onClose={() => setShowGlobalSearch(false)} />}
      </AnimatePresence>
      {/* Onboarding Tour — skip on public marketing/merchant routes */}
      {showOnboarding && !user.isAuthenticated &&
       !["/merchant-landing", "/merchant-pricing", "/partners", "/landing", "/pay/directory"].includes(currentPath) &&
       !currentPath.startsWith("/pay/checkout/") &&
       !isPublicInvoicePayment &&
       !currentPath.startsWith("/invoice/pay/") &&
       !currentPath.startsWith("/pay/merchant/") && (
        <OnboardingTour onComplete={() => { setShowOnboarding(false); localStorage.setItem("bidblitz_onboarded", "1"); }} />
      )}
      {/* Super-App Overlay: Safety, Voice, Loyalty, Subscriptions (Uber/Bolt/Lieferando-Style) */}
      {!isCheckout && !isPublicInvoicePayment && !isQrOrder && !isRestaurantTableGuest && !isInvoicePay && currentPath !== '/scan' && currentPath !== '/terminal' && currentPath !== '/nfc' && currentPath !== '/pos' && (
        <SuperAppOverlay
          currentPath={currentPath}
          onNavigate={handleNavigate}
          isAuthenticated={user.isAuthenticated}
          activeRideId={navState?.activeRideId}
        />
      )}
      {/* In-App Update Manager (Native Android/iOS) */}
      <InAppUpdateManager />

      {/* Cookie-Consent-Banner (DSGVO/UAE-konform) */}
      {!user.isAuthenticated && !isQrOrder && !isRestaurantTableGuest && !isInvoicePay && !isStaffEmployeeShell && !isFullScreenStaffMgr && <CookieBanner onNavigate={handleNavigate} />}

      {/* Push Notification Prompt */}
      {/* PushNotificationPrompt (FCM) removed — use PushPermissionPrompt above */}
    </div>
  );
}

function App() {
  useEffect(() => {
    setupGlobalErrorHandler();
  }, []);
  return (
    <ErrorBoundary>
      <AppProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
