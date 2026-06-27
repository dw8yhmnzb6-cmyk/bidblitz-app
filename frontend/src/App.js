import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import "@/App.css";

import { AppProvider, useUser, useI18n } from "./store";
import { ThemeProvider } from "./store/ThemeContext";
import AIChatWidget from "./components/AIChatWidget";
import SuperAppOverlay from "./components/SuperAppOverlay";
import InAppUpdateManager from "./components/InAppUpdateManager";
import BackToHomeBar from "./components/BackToHomeBar";
import ErrorBoundary, { setupGlobalErrorHandler } from "./components/ErrorBoundary";
import KYCFlow from "./pages/KYCFlow";
import { LandingChatbot } from "./components/LandingChatbot";
import CookieBanner from "./components/CookieBanner";
import { initSentryIfConsented } from "./utils/sentry";
import {
  CarListPage, CarDetailPage, MyCarBookingsPage, MyBookingDetailPage,
  VendorCarRentalDashboardPage, VendorCarsPage, VendorBookingsPage,
  VendorBookingDetailPage, VendorInvoicesPage, VendorPayoutsPage,
  VendorDamagesPage, VendorSettingsPage, VendorStaffPage, VendorReportsPage,
  AdminCarRentalPage, AdminDisputesPage,
} from "./modules/car-rental/pages";
import BottomNav from "./components/BottomNav";
import BarcodeModal from "./components/BarcodeModal";
import AuthGateOverlay from "./components/AuthGateOverlay";
import DemoBanner from "./components/DemoBanner";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import PushPermissionPrompt from "./components/PushPermissionPrompt";
import { tracker } from "./services/tracker";

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
const RewardsPage = lazy(() => import("./pages/RewardsPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const MerchantDashboardPage = lazy(() => import("./pages/MerchantDashboardPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const MerchantTerminalPage = lazy(() => import("./pages/MerchantTerminalPage"));
const MerchantOnboardingPage = lazy(() => import("./pages/MerchantOnboardingPage"));
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
const AdminDiagPage = lazy(() => import("./pages/AdminDiagPage"));
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
const NotificationCenterPage = lazy(() => import("./pages/NotificationCenterPage"));
const ExecutiveCenterPage = lazy(() => import("./pages/ExecutiveCenterPage"));
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
const WalletDashboard = lazy(() => import("./components/WalletDashboard").then(m => ({ default: m.WalletDashboard })));
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
  
  // Get initial path from URL
  const getInitialPath = () => {
    if (typeof window === "undefined") return "/";
    if (hasKidsReturn) return "/more";
    if (hasStripeReturn) return "/wallet";
    const path = window.location.pathname;
    return path || "/";
  };

  const [currentPath, setCurrentPath] = useState(getInitialPath);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateMessage, setAuthGateMessage] = useState("");
  const [showFullAuth, setShowFullAuth] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("bidblitz_onboarded"));
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 1024 : false);
  const user = useUser();
  const { setLang } = useI18n();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsDesktopViewport(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (user.isAuthenticated && user.language) {
      setLang(user.language);
    }
  }, [user.isAuthenticated, user.language, setLang]);

  const resolvePostAuthPath = useCallback(() => {
    if (currentPath === "/login" || currentPath === "/register") return "/";
    return currentPath || "/";
  }, [currentPath]);

  const handleAuthSuccess = useCallback(() => {
    setShowFullAuth("");
    setShowAuthGate(false);
    setIsDemoMode(false);
    const nextPath = resolvePostAuthPath();
    setCurrentPath(nextPath === "/login" || nextPath === "/register" ? "/" : nextPath);
  }, [resolvePostAuthPath]);

  // Close auth gate after login
  useEffect(() => {
    if (user.isAuthenticated) {
      const timer = setTimeout(() => {
        setShowAuthGate(false);
        setShowFullAuth("");
        setIsDemoMode(false);
        if (currentPath === "/login" || currentPath === "/register") {
          setCurrentPath("/");
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentPath, user.isAuthenticated]);

  const isGuest = !user.isAuthenticated;

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
      onLogin: () => { tracker.ctaClick("login", "home"); setShowFullAuth("login"); },
      onRegister: () => { tracker.guestRegisterClick("home"); setShowFullAuth("register"); },
      onStartDemo: () => {
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
      onAuthRequired: requireAuth,
      onLogin: () => { tracker.ctaClick("login", currentPath); setShowFullAuth("login"); },
      onRegister: () => { tracker.guestRegisterClick(currentPath); setShowFullAuth("register"); },
      routeParams,
      onStartDemo: () => {
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
    if (currentPath === "/staff/system-check") {
      return <StaffSystemCheckPage onBack={() => handleNavigate("/")} />;
    }
    if (currentPath === "/staff/mobile") {
      return <StaffMobilePage onBack={() => handleNavigate("/")} />;
    }
    if (currentPath === "/staff/terminal") {
      return <StaffTerminalPage onBack={() => handleNavigate("/")} />;
    }
    if (currentPath === "/staff/invite") {
      return <StaffInvitePage onSuccess={() => handleNavigate("/staff/mobile")} />;
    }
    // ─── Dynamic path handlers (must run before switch since switch uses exact match)
    if (currentPath.startsWith("/kds/")) {
      return <KDSPage stationId={currentPath.split("/")[2]} />;
    }
    if (currentPath.startsWith("/customer-display/")) {
      return <CustomerDisplayPage registerId={currentPath.split("/")[2]} />;
    }
    if (currentPath.startsWith("/order/qr/")) {
      if (isGuest) {
        return <QrOrderPage onAuthRequired={requireAuth} onLogin={() => setShowFullAuth("login")} />;
      }
      return <QrOrderPage onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith("/table/")) {
      return <RestaurantTableGuestPage tableId={currentPath.split("/")[2]} />;
    }
    if (currentPath.startsWith("/order/")) {
      return <PublicTableOrderPage qrToken={currentPath.split("/")[2]} />;
    }
    if (currentPath === "/admin/tables") {
      return <RestaurantTablesAdminPage onBack={() => handleNavigate("/admin")} />;
    }
    if (currentPath === "/staff/dashboard") {
      return <RestaurantStaffDashboardPage onBack={() => handleNavigate("/")} />;
    }
    if (currentPath === "/kitchen") {
      return <RestaurantKitchenPage onBack={() => handleNavigate("/")} />;
    }
    if (currentPath === "/merchant/qr-tables") {
      return <MerchantQrTablesPage onBack={() => handleNavigate("/merchant-dashboard")} user={user} />;
    }
    if (currentPath.startsWith("/invoice/pay/")) {
      return <InvoicePayPage scanCode={currentPath.split("/")[3]} onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith("/pay/") && !currentPath.startsWith("/pay/checkout/") && !currentPath.startsWith("/pay/merchant/")) {
      return <PublicInvoicePaymentPage token={currentPath.split("/")[2]} onNavigate={handleNavigate} />;
    }
    if (currentPath === "/ev" || currentPath === "/ev/map") {
      return <EVChargingMapPage onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith("/ev/start/")) {
      const parts = currentPath.split("/");
      return <EVStartChargingPage chargePointId={parts[3]} connectorId={parts[4] || "1"} onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith("/ev/session/")) {
      return <EVLiveSessionPage sessionId={currentPath.split("/")[3]} onNavigate={handleNavigate} />;
    }
    if (currentPath === "/ev/history") {
      return <EVChargingHistoryPage onNavigate={handleNavigate} />;
    }
    if (currentPath === "/admin/ev" || currentPath === "/admin/ev/overview") return <AdminEVOverviewPage onNavigate={handleNavigate} />;
    if (currentPath === "/admin/ev/operators") return <AdminEVOperatorsPage onNavigate={handleNavigate} />;
    if (currentPath === "/admin/ev/vendors") return <AdminEVHardwareVendorsPage onNavigate={handleNavigate} />;
    if (currentPath === "/admin/ev/tariffs") return <AdminEVTariffsPage onNavigate={handleNavigate} />;
    if (currentPath === "/admin/ev/payouts") return <AdminEVPayoutsPage onNavigate={handleNavigate} />;
    if (currentPath === "/operator/ev" || currentPath === "/operator/ev/dashboard") return <EVOperatorDashboardPage onNavigate={handleNavigate} />;
    if (currentPath === "/operator/ev/stations") return <EVOperatorStationsPage onNavigate={handleNavigate} />;
    if (currentPath === "/operator/ev/sessions") return <EVOperatorSessionsPage onNavigate={handleNavigate} />;
    if (currentPath === "/operator/ev/revenue") return <EVOperatorRevenuePage onNavigate={handleNavigate} />;
    if (currentPath === "/operator/ev/payouts") return <EVOperatorPayoutsPage onNavigate={handleNavigate} />;
    if (currentPath.startsWith("/pay/checkout/")) {
      return <PayCheckoutPage sessionId={currentPath.split("/")[3]} onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith("/pay/merchant/")) {
      return <PayMerchantDetailPage slug={currentPath.split("/")[3]} onBack={() => handleNavigate("/pay/directory")} onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith("/business/")) {
      return <PublicMerchantBusinessPage slug={currentPath.split("/")[2]} onBack={() => handleNavigate("/merchant-portal")} onNavigate={handleNavigate} />;
    }
    if (currentPath === "/pay/directory") {
      return <PayDirectoryPage onBack={() => handleNavigate("/merchant-landing")} onNavigate={handleNavigate} />;
    }
    if (currentPath === "/pay/docs") {
      return <PayDeveloperDocsPage />;
    }
    if (currentPath === "/pay/for-business") {
      return <PayForBusinessPage onNavigate={handleNavigate} />;
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
          : <ScannerPage onNavigate={handleNavigate} onShowBarcode={() => setShowBarcode(true)} />;
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
      case "/executive":
        return (!user.isAuthenticated || !["admin", "investor", "merchant"].includes(user.role))
          ? <HomePage {...homeProps} />
          : <ExecutiveCenterPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/rewards":
        return <RewardsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/verification":
        return <VerificationPage onBack={() => handleNavigate("/more")} />;
      case "/merchant-dashboard":
        return <MerchantDashboardPage onBack={() => handleNavigate("/more")} />;
      case "/marketplace-dashboard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <MarketplaceDashboardPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} routeParams={routeParams} />;
      case "/pay":
        return <PaymentPage onBack={() => handleNavigate("/more")} />;
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
      case "/selfcheckout":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <SelfCheckoutPage onBack={() => handleNavigate("/")} navState={navState} />;
      case "/admin/old":
        return user.role === "admin"
          ? <AdminPage onNavigate={handleNavigate} />
          : <HomePage {...homeProps} />;
      case "/test/kyc":
        return <KYCTestPage />;
      case "/kyc":
      case "/kyc/start":
      case "/profile/kyc":
      case "/kyc/upload":
      case "/kyc/review":
      case "/kyc/status":
        return (isGuest && !isDemoMode)
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
      case "/admin/diag":
        return user.role === "admin" ? <AdminDiagPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/staff/ui-audit":
        return <StaffUIAuditPage onBack={() => handleNavigate("/staff")} />;
      case "/admin/push-broadcast":
        return user.role === "admin" ? <AdminPushBroadcastPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
      case "/admin/analytics":
        return user.role === "admin" ? <AdminAnalyticsPage onBack={() => handleNavigate("/admin")} /> : <HomePage {...homeProps} />;
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
      case "/admin/taxi":
        return user.role === "admin" ? <AdminTaxiPage onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
      case "/admin/directory":
        return user.role === "admin" ? <AdminDirectoryPage onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
      case "/admin/ads":
        return user.role === "admin" ? <AdminAdManagerPage onNavigate={handleNavigate} /> : <HomePage {...homeProps} />;
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
      case "/admin/credits":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <AdminCreditPage onBack={() => handleNavigate("/admin")} />;
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
      case "/wallet-dashboard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <WalletDashboard />;
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
          const slug = currentPath.replace("/admin/", "");
          // Map AdminPanelPage paths → AdminPage tab IDs
          const ADMIN_TAB_MAP = {
            // Customers & Roles
            "users": "users", "customers": "users", "enterprise": "users",
            "kyc": "verification",
            "managers": "roles", "employees": "roles", "influencer": "roles",
            "auto-ads": "promos", "partner-credit": "merchant-fees",
            // Partners
            "merchants": "merchants", "partner-portal": "merchants", "applications": "merchants",
            // Auctions
            "products": "auctions", "standard-auctions": "auctions", "vip-auctions": "auctions",
            "voucher-auctions": "auctions", "bot-system": "auctions", "winner-control": "auctions",
            // Analytics
            "analytics": "analytics", "product-analysis": "analytics",
            "user-analysis": "analytics", "revenue-analysis": "analytics",
            // Promos
            "merchant-coupons": "promos", "bidder-coupons": "promos",
            "partner-coupons": "promos", "discount-codes": "promos",
            "marketing": "promos", "email-marketing": "promos",
            // Finance
            "finance": "transactions", "transactions": "transactions",
            "deposits": "transactions", "withdrawals": "transactions",
            "fees": "merchant-fees",
            // Other
            "compliance": "verification", "moderation": "verification",
            "logs": "logs", "system": "settings", "settings": "settings",
          };
          const tab = ADMIN_TAB_MAP[slug] || "overview";
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

  const isCheckout = currentPath.startsWith("/pay/checkout/");
  const isPublicInvoicePayment = currentPath.startsWith("/pay/") && !currentPath.startsWith("/pay/checkout/") && !currentPath.startsWith("/pay/merchant/");
  const isQrOrder = currentPath.startsWith("/order/qr/");
  const isRestaurantTableGuest = currentPath.startsWith("/table/");
  const isInvoicePay = currentPath.startsWith("/invoice/pay/");
  const isMobilityShell = currentPath === "/scooter" || currentPath === "/ev" || currentPath === "/ev/map" || currentPath === "/ev/history" || currentPath.startsWith("/ev/start/") || currentPath.startsWith("/ev/session/");
  const isStaffEmployeeShell = currentPath === "/staff/mobile" || currentPath === "/staff/invite" || currentPath === "/staff/terminal" || currentPath === "/staff/portal" || currentPath === "/staff/login";
  const isFullScreenStaffMgr = currentPath === "/merchant/staff/chat" || currentPath === "/merchant/taxi/promos" || currentPath === "/merchant/staff/live-map" || currentPath === "/taxi/pro";
  const showBottomNav = !isDesktopViewport && !isCheckout && !isPublicInvoicePayment && !isQrOrder && !isRestaurantTableGuest && !isInvoicePay && !isStaffEmployeeShell && !isFullScreenStaffMgr && !currentPath.startsWith("/pay/merchant/") && currentPath !== "/merchant-landing" && currentPath !== "/pay/directory" && currentPath !== "/scan";

  const isHomePath = currentPath === "/" || currentPath === "/home" || currentPath === "/landing";
  const showBackToHome = !isHomePath && !isCheckout && !isPublicInvoicePayment && !isQrOrder && !isRestaurantTableGuest && !isInvoicePay && !isMobilityShell && !isStaffEmployeeShell && !currentPath.startsWith("/pay/merchant/") && currentPath !== "/merchant-landing";

  return (
    <div className="app-container" data-testid="app-container">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#141414", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: "13px", fontFamily: "Outfit, sans-serif" },
        }}
      />
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
            {renderPage()}
          </Suspense>
        </motion.div>
      </AnimatePresence>
      {showBottomNav && (
        <BottomNav 
          currentPath={currentPath} 
          onNavigate={handleNavigate} 
          onShowBarcode={() => setShowBarcode(true)}
        />
      )}
      <BarcodeModal isOpen={showBarcode} onClose={() => setShowBarcode(false)} />
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
      {/* AI Chatbot (powered by gpt-5.2) */}
      {user.isAuthenticated && !isCheckout && !isPublicInvoicePayment && !isQrOrder && !isRestaurantTableGuest && !isInvoicePay && <AIChatWidget />}
      {/* Super-App Overlay: Safety, Voice, Loyalty, Subscriptions (Uber/Bolt/Lieferando-Style) */}
      {!isCheckout && !isPublicInvoicePayment && !isQrOrder && !isRestaurantTableGuest && !isInvoicePay && (
        <SuperAppOverlay
          currentPath={currentPath}
          onNavigate={handleNavigate}
          isAuthenticated={user.isAuthenticated}
          activeRideId={navState?.activeRideId}
        />
      )}
      {/* In-App Update Manager (Native Android/iOS) */}
      <InAppUpdateManager />

      {/* Landing Chatbot — Floating widget for guest visitors (hidden on staff mobile) */}
      {!user.isAuthenticated && !isCheckout && !isQrOrder && !isRestaurantTableGuest && !isInvoicePay && !isStaffEmployeeShell && <LandingChatbot />}

      {/* Cookie-Consent-Banner (DSGVO/UAE-konform) */}
      {!isQrOrder && !isRestaurantTableGuest && !isInvoicePay && !isStaffEmployeeShell && !isFullScreenStaffMgr && <CookieBanner onNavigate={handleNavigate} />}

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
