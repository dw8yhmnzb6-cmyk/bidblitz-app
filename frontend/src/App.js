import { useState, useEffect, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import "@/App.css";

import { AppProvider, useUser, useI18n } from "./store";
import { ThemeProvider, useTheme } from "./store/ThemeContext";
import AIChatWidget from "./components/AIChatWidget";
import SuperAppOverlay from "./components/SuperAppOverlay";
import InAppUpdateManager from "./components/InAppUpdateManager";

import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import WalletPage from "./pages/WalletPage";
import ScannerPage from "./pages/ScannerPage";
import MerchantPage from "./pages/MerchantPage";
const AdminPage = lazy(() => import("./pages/AdminPage"));
import MorePage from "./pages/MorePage";
import AuctionsPage from "./pages/AuctionsPage";
import AuctionAdminPage from "./pages/AuctionAdminPage";
import MerchantConnectPage from "./pages/MerchantConnectPage";
import InfluencerPage from "./pages/InfluencerPage";
import InvestorPage from "./pages/InvestorPage";
import RewardsPage from "./pages/RewardsPage";
import VerificationPage from "./pages/VerificationPage";
import MerchantDashboardPage from "./pages/MerchantDashboardPage";
import PaymentPage from "./pages/PaymentPage";
import MerchantTerminalPage from "./pages/MerchantTerminalPage";
import MerchantOnboardingPage from "./pages/MerchantOnboardingPage";
import MerchantPricingPage from "./pages/MerchantPricingPage";
import MerchantLandingPage from "./pages/MerchantLandingPage";
import PayCheckoutPage from "./pages/PayCheckoutPage";
import PayDirectoryPage from "./pages/PayDirectoryPage";
import PayForBusinessPage from "./pages/PayForBusinessPage";
import MiningPage from "./pages/MiningPage";
const NFTGeneratorPage = lazy(() => import("./pages/NFTGeneratorPage"));
import AuthPage from "./pages/AuthPage";
import NotificationsPage from "./pages/NotificationsPage";
const InfluencerDashboard = lazy(() => import("./pages/InfluencerDashboard"));
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
import TaxiPage from "./pages/TaxiPage";
const TaxiOperatorPage = lazy(() => import("./pages/TaxiOperatorPage"));
const TaxiOperatorDashboard = lazy(() => import("./pages/TaxiOperatorDashboard"));
import ScooterPage from "./pages/ScooterPage";
import FoodPage from "./pages/FoodPage";
const DriverDashboardPage = lazy(() => import("./pages/DriverDashboardPage"));
const RestaurantDashboardPage = lazy(() => import("./pages/RestaurantDashboardPage"));
const ChildModePage = lazy(() => import("./pages/ChildModePage"));
import MarketplacePage from "./pages/MarketplacePage";
import ChatPage from "./pages/ChatPage";
import PartnersPage from "./pages/PartnersPage";
import ReferralSystemPage from "./pages/ReferralSystemPage";
import NfcPayPage from "./pages/NfcPayPage";
import VipPage from "./pages/VipPage";
import LoyaltyPage from "./pages/LoyaltyPage";
const KidsPaywall = lazy(() => import("./pages/KidsPaywall"));
import MobilityMapPage from "./pages/MobilityMapPage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import FriendsMapPage from "./pages/FriendsMapPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import FoodOrderTrackingPage from "./pages/FoodOrderTrackingPage";
import ChallengesPage from "./pages/ChallengesPage";
import AchievementsPage from "./pages/AchievementsPage";
import FriendsPage from "./pages/FriendsPage";
import TwoFactorSettingsPage from "./pages/TwoFactorSettingsPage";
import CreditScorePage from "./pages/CreditScorePage";
import BillsPage from "./pages/BillsPage";
import GamingPage from "./pages/GamingPage";
import SupportChatPage from "./pages/SupportChatPage";
import SplitBillPage from "./pages/SplitBillPage";
import VirtualCardsPage from "./pages/VirtualCardsPage";
import SavingsPage from "./pages/SavingsPage";
import BNPLPage from "./pages/BNPLPage";
import GiftCardsPage from "./pages/GiftCardsPage";
import AIAssistantPage from "./pages/AIAssistantPage";
const CryptoWalletPage = lazy(() => import("./pages/CryptoWalletPage"));
import BudgetPlannerPage from "./pages/BudgetPlannerPage";
const AdminCreditPage = lazy(() => import("./pages/AdminCreditPage"));
const AdminPanelFullPage = lazy(() => import("./pages/AdminPanelFullPage"));
const MonitoringDashboard = lazy(() => import("./pages/MonitoringDashboard"));
const MerchantAdminPage = lazy(() => import("./pages/MerchantAdminPage"));
const POSPage = lazy(() => import("./pages/POSPage"));
const KDSPage = lazy(() => import("./pages/KDSPage"));
const CustomerDisplayPage = lazy(() => import("./pages/CustomerDisplayPage"));
const PublicTableOrderPage = lazy(() => import("./pages/PublicTableOrderPage"));
const SelfCheckoutPage = lazy(() => import("./pages/SelfCheckoutPage"));
const BlitzTransferPage = lazy(() => import("./pages/BlitzTransferPage"));
const BlitzBoostPage = lazy(() => import("./pages/BlitzBoostPage"));
const BlitzMinePage = lazy(() => import("./pages/BlitzMinePage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AdminLegalPage = lazy(() => import("./pages/AdminLegalPage"));
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
import NotificationCenterPage from "./pages/NotificationCenterPage";
import KYCTestPage from "./pages/KYCTestPage";
import KYCFlow from "./pages/KYCFlow";
import ContactsPage from "./pages/ContactsPage";
import UserStatsPage from "./pages/UserStatsPage";
import CurrencyConverterPage from "./pages/CurrencyConverterPage";
import HotelBookingPage from "./pages/HotelBookingPage";
import EventBookingPage from "./pages/EventBookingPage";
import RestaurantReservationPage from "./pages/RestaurantReservationPage";
import InsurancePage from "./pages/InsurancePage";
import AppointmentPage from "./pages/AppointmentPage";
import SocialFeedPage from "./pages/SocialFeedPage";
import JobMarketplacePage from "./pages/JobMarketplacePage";
import FlightSearchPage from "./pages/FlightSearchPage";
import SabreFlightsPage from "./pages/SabreFlightsPage";
import ParcelPage from "./pages/ParcelPage";
import CVBuilderPage from "./pages/CVBuilderPage";
import NearbyPage from "./pages/NearbyPage";
import MerchantPortalPage from "./pages/MerchantPortalPage";
import KidsAppPage from "./pages/KidsAppPage";
import ParentControlsPage from "./pages/ParentControlsPage";
import AdminAuctionImagesPage from "./pages/AdminAuctionImagesPage";
import RealEstatePage from "./pages/RealEstatePage";
import FreelancerPage from "./pages/FreelancerPage";
import ELearningPage from "./pages/ELearningPage";
import HandwerkerPage from "./pages/HandwerkerPage";
import StreamingPage from "./pages/StreamingPage";
import TelemedizinPage from "./pages/TelemedizinPage";
import DatingPage from "./pages/DatingPage";
import GebrauchtwagenPage from "./pages/GebrauchtwagenPage";
import ReinigungPage from "./pages/ReinigungPage";
import UmzugPage from "./pages/UmzugPage";
import TierbetreuungPage from "./pages/TierbetreuungPage";
import FitnessPage from "./pages/FitnessPage";
import ReiseplanerPage from "./pages/ReiseplanerPage";
import LadesaeulenPage from "./pages/LadesaeulenPage";
import EmailMarketingAdminPage from "./pages/EmailMarketingAdminPage";
import AllServicesPage from "./pages/AllServicesPage";
import StocksPage from "./pages/StocksPage";
import ResellingPage from "./pages/ResellingPage";
import BlitzJobsPage from "./pages/BlitzJobsPage";
import CashbackPage from "./pages/CashbackPage";
import PremiumPage from "./pages/PremiumPage";
import StoriesPage from "./pages/StoriesPage";
import LiveAuctionsPage from "./pages/LiveAuctionsPage";
import SocialHubPage from "./pages/SocialHubPage";
import BlitzLearnPage from "./pages/BlitzLearnPage";
import BlitzHubPage from "./pages/BlitzHubPage";
import LeaderboardPage, { GlobalSearch, OnboardingTour } from "./pages/ExtraFeatures";
import CityServicesPage from "./pages/CityServicesPage";
import BlitzPayPage from "./pages/BlitzPayPage";
import CryptoEarnPage from "./pages/CryptoEarnPage";
import CryptoBasketsPage from "./pages/CryptoBasketsPage";
import DerivativesPage from "./pages/DerivativesPage";
import LevelUpPage from "./pages/LevelUpPage";
import PredictionsPage from "./pages/PredictionsPage";
import BlitzCardPage from "./pages/BlitzCardPage";
import SuperchargerPage from "./pages/SuperchargerPage";
import DeFiWalletPage from "./pages/DeFiWalletPage";
import CryptoLoansPage from "./pages/CryptoLoansPage";
import P2PLendingPage from "./pages/P2PLendingPage";
import TradingBotPage from "./pages/TradingBotPage";
import LiveShoppingPage from "./pages/LiveShoppingPage";
const LiveKitStreamPage = lazy(() => import("./pages/LiveKitStreamPage"));
const WalletDashboard = lazy(() => import("./components/WalletDashboard").then(m => ({ default: m.WalletDashboard })));
const SuperAppMarketplace = lazy(() => import("./components/SuperAppMarketplace").then(m => ({ default: m.SuperAppMarketplace })));
import { LandingChatbot } from "./components/LandingChatbot";
import CreatorsPage from "./pages/CreatorsPage";
import P2PPage from "./pages/P2PPage";
import CardPage from "./pages/CardPage";
import LivePage from "./pages/LivePage";
import GroupChatPage from "./pages/GroupChatPage";
import RoundupPage from "./pages/RoundupPage";
import ApartmentsPage from "./pages/ApartmentsPage";
import SkillsMarketPage from "./pages/SkillsMarketPage";
import InvoicingPage from "./pages/InvoicingPage";
import QRMenuPage from "./pages/QRMenuPage";
import BookingsPage from "./pages/BookingsPage";
import ContractsPage from "./pages/ContractsPage";
import UtilitiesHubPage from "./pages/UtilitiesHubPage";
import EngageHubPage from "./pages/EngageHubPage";
import ViralHubPage from "./pages/ViralHubPage";
import FieldAgentPortalPage from "./pages/FieldAgentPortalPage";
import DirectoryPage from "./pages/DirectoryPage";
const AdCampaignManagerPage = lazy(() => import("./pages/AdCampaignManagerPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));

// Car Rental Module
import {
  CarListPage, CarDetailPage, MyCarBookingsPage, MyBookingDetailPage,
  VendorCarRentalDashboardPage, VendorCarsPage, VendorBookingsPage,
  VendorBookingDetailPage, VendorInvoicesPage, VendorPayoutsPage,
  VendorDamagesPage, VendorSettingsPage, VendorStaffPage, VendorReportsPage,
  AdminCarRentalPage, AdminDisputesPage
} from "./modules/car-rental/pages";

import BottomNav from "./components/BottomNav";
import BarcodeModal from "./components/BarcodeModal";
import AuthGateOverlay from "./components/AuthGateOverlay";
import DemoBanner from "./components/DemoBanner";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import PushPermissionPrompt from "./components/PushPermissionPrompt";
import { tracker } from "./services/tracker";

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
    } catch {}
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
  const user = useUser();
  const { setLang } = useI18n();

  useEffect(() => {
    if (user.isAuthenticated && user.language) {
      setLang(user.language);
    }
  }, [user.isAuthenticated, user.language, setLang]);

  // Close auth gate after login
  useEffect(() => {
    if (user.isAuthenticated) {
      setShowAuthGate(false);
      setShowFullAuth("");
      setIsDemoMode(false);
    }
  }, [user.isAuthenticated]);

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
      } catch {}
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

    // For customers: scan tab opens QR modal (or gates if guest)
    if (path === "/scan") {
      if (isGuest) {
        requireAuth();
        return;
      }
      if (user.role !== "merchant" && user.role !== "admin" && user.currentMode !== "merchant") {
        setShowBarcode(true);
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

  // Full-screen auth (from header Sign In or homepage CTA)
  if (showFullAuth && !user.isAuthenticated) {
    return (
      <div className="relative">
        <AuthPage onBack={() => setShowFullAuth("")} initialMode={showFullAuth} />
      </div>
    );
  }

  const renderPage = () => {
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
    // ─── Dynamic path handlers (must run before switch since switch uses exact match)
    if (currentPath.startsWith("/kds/")) {
      return <KDSPage stationId={currentPath.split("/")[2]} />;
    }
    if (currentPath.startsWith("/customer-display/")) {
      return <CustomerDisplayPage registerId={currentPath.split("/")[2]} />;
    }
    if (currentPath.startsWith("/order/")) {
      return <PublicTableOrderPage qrToken={currentPath.split("/")[2]} />;
    }
    if (currentPath.startsWith("/pay/checkout/")) {
      return <PayCheckoutPage sessionId={currentPath.split("/")[3]} onNavigate={handleNavigate} />;
    }
    if (currentPath.startsWith("/pay/merchant/")) {
      return <PayMerchantDetailPage slug={currentPath.split("/")[3]} onBack={() => handleNavigate("/pay/directory")} onNavigate={handleNavigate} />;
    }
    if (currentPath === "/pay/directory" || currentPath === "/marketplace") {
      return <PayDirectoryPage onBack={() => handleNavigate("/merchant-landing")} onNavigate={handleNavigate} />;
    }
    if (currentPath === "/pay/for-business") {
      return <PayForBusinessPage onNavigate={handleNavigate} />;
    }
    switch (currentPath) {
      case "/":
        return <HomePage {...homeProps} />;
      case "/landing":
        return <LandingPage onGetStarted={() => handleNavigate("/")} />;
      case "/wallet":
        return <WalletPage {...pageProps} />;
      case "/scan":
        if (user.role === "merchant" || user.role === "admin") {
          return <ScannerPage onNavigate={handleNavigate} />;
        }
        return <HomePage {...homeProps} />;
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
      case "/rewards":
        return <RewardsPage onBack={() => handleNavigate("/more")} />;
      case "/verification":
        return <VerificationPage onBack={() => handleNavigate("/more")} />;
      case "/merchant-dashboard":
        return <MerchantDashboardPage onBack={() => handleNavigate("/more")} />;
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
      case "/rewards-hub":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <RetentionHubPage onBack={() => handleNavigate("/")} />;
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
        return <AuctionsPage {...pageProps} />;
      case "/auction-admin":
        return user.role === "admin"
          ? <AuctionAdminPage onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/taxi":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <TaxiPage onNavigate={handleNavigate} />;
      case "/taxi-partner":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <TaxiOperatorPage onNavigate={handleNavigate} />;
      case "/taxi-dashboard":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <TaxiOperatorDashboard onNavigate={handleNavigate} />;
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
        return <MarketplacePage onNavigate={handleNavigate} />;
      case "/chat":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <ChatPage onNavigate={handleNavigate} />;
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
      case "/notifications":
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
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LiveAuctionsPage onBack={() => handleNavigate("/more")} />;
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
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LiveShoppingPage onBack={() => handleNavigate("/more")} />;
      case "/livekit-stream":
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <LiveKitStreamPage onBack={() => handleNavigate("/more")} />;
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
        return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <AchievementsPage onBack={() => handleNavigate("/more")} />;
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
        if (currentPath.startsWith("/food/track/")) {
          const orderId = currentPath.split("/food/track/")[1];
          return (isGuest && !isDemoMode) ? <HomePage {...homeProps} /> : <FoodOrderTrackingPage orderId={orderId} onBack={() => handleNavigate("/food")} />;
        }
        return <HomePage {...homeProps} />;
    }
  };

  const isCheckout = currentPath.startsWith("/pay/checkout/");
  const showBottomNav = !isCheckout && !currentPath.startsWith("/pay/merchant/") && currentPath !== "/merchant-landing" && currentPath !== "/pay/directory" && currentPath !== "/marketplace" && (currentPath !== "/scan" || (user.role !== "merchant" && user.role !== "admin"));

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
       !["/merchant-landing", "/merchant-pricing", "/partners", "/landing", "/pay/directory", "/marketplace"].includes(currentPath) &&
       !currentPath.startsWith("/pay/checkout/") &&
       !currentPath.startsWith("/pay/merchant/") && (
        <OnboardingTour onComplete={() => { setShowOnboarding(false); localStorage.setItem("bidblitz_onboarded", "1"); }} />
      )}
      {/* AI Chatbot (powered by gpt-5.2) */}
      {user.isAuthenticated && !isCheckout && <AIChatWidget />}
      {/* Super-App Overlay: Safety, Voice, Loyalty, Subscriptions (Uber/Bolt/Lieferando-Style) */}
      {!isCheckout && (
        <SuperAppOverlay
          currentPath={currentPath}
          onNavigate={handleNavigate}
          isAuthenticated={user.isAuthenticated}
          activeRideId={navState?.activeRideId}
        />
      )}
      {/* In-App Update Manager (Native Android/iOS) */}
      <InAppUpdateManager />

      {/* Landing Chatbot — Floating widget for guest visitors (always available) */}
      {!user.isAuthenticated && !isCheckout && <LandingChatbot />}

      {/* Push Notification Prompt */}
      {/* PushNotificationPrompt (FCM) removed — use PushPermissionPrompt above */}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AppProvider>
  );
}

export default App;
