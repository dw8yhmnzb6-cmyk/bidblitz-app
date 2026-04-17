import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import "@/App.css";

import { AppProvider, useUser, useI18n } from "./store";
import { ThemeProvider, useTheme } from "./store/ThemeContext";

import HomePage from "./pages/HomePage";
import WalletPage from "./pages/WalletPage";
import ScannerPage from "./pages/ScannerPage";
import MerchantPage from "./pages/MerchantPage";
import AdminPage from "./pages/AdminPage";
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
import MiningPage from "./pages/MiningPage";
import NFTGeneratorPage from "./pages/NFTGeneratorPage";
import AuthPage from "./pages/AuthPage";
import NotificationsPage from "./pages/NotificationsPage";
import InfluencerDashboard from "./pages/InfluencerDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import TaxiPage from "./pages/TaxiPage";
import TaxiOperatorPage from "./pages/TaxiOperatorPage";
import TaxiOperatorDashboard from "./pages/TaxiOperatorDashboard";
import ScooterPage from "./pages/ScooterPage";
import FoodPage from "./pages/FoodPage";
import DriverDashboardPage from "./pages/DriverDashboardPage";
import RestaurantDashboardPage from "./pages/RestaurantDashboardPage";
import ChildModePage from "./pages/ChildModePage";
import MarketplacePage from "./pages/MarketplacePage";
import ChatPage from "./pages/ChatPage";
import PartnersPage from "./pages/PartnersPage";
import ReferralSystemPage from "./pages/ReferralSystemPage";
import NfcPayPage from "./pages/NfcPayPage";
import VipPage from "./pages/VipPage";
import LoyaltyPage from "./pages/LoyaltyPage";
import KidsPaywall from "./pages/KidsPaywall";
import MobilityMapPage from "./pages/MobilityMapPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
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
import CryptoWalletPage from "./pages/CryptoWalletPage";
import BudgetPlannerPage from "./pages/BudgetPlannerPage";
import AdminCreditPage from "./pages/AdminCreditPage";
import AdminPanelFullPage from "./pages/AdminPanelFullPage";
import MonitoringDashboard from "./pages/MonitoringDashboard";
import MerchantAdminPage from "./pages/MerchantAdminPage";
import NotificationCenterPage from "./pages/NotificationCenterPage";
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
import ParcelPage from "./pages/ParcelPage";
import CVBuilderPage from "./pages/CVBuilderPage";
import NearbyPage from "./pages/NearbyPage";
import MerchantPortalPage from "./pages/MerchantPortalPage";
import KidsAppPage from "./pages/KidsAppPage";
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
import CreatorsPage from "./pages/CreatorsPage";
import SkillsMarketPage from "./pages/SkillsMarketPage";
import InvoicingPage from "./pages/InvoicingPage";
import QRMenuPage from "./pages/QRMenuPage";
import BookingsPage from "./pages/BookingsPage";
import ContractsPage from "./pages/ContractsPage";
import UtilitiesHubPage from "./pages/UtilitiesHubPage";
import EngageHubPage from "./pages/EngageHubPage";
import ViralHubPage from "./pages/ViralHubPage";

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
import { tracker } from "./services/tracker";

const pageTransition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

function AppContent() {
  const hasStripeReturn = typeof window !== "undefined" &&
    (window.location.search.includes("stripe_session_id") || window.location.search.includes("stripe_cancelled"));
  const hasKidsReturn = typeof window !== "undefined" && window.location.search.includes("kids_sub=success");
  
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
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/notifications/unread`, { credentials: "include" });
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

  const handleNavigate = (path) => {
    // Track page view
    tracker.pageView(path);

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
      onStartDemo: () => { tracker.demoStart(); setIsDemoMode(true); setCurrentPath("/wallet"); },
    };
    const pageProps = {
      onNavigate: handleNavigate, isGuest, isDemoMode,
      onAuthRequired: requireAuth,
      onLogin: () => { tracker.ctaClick("login", currentPath); setShowFullAuth("login"); },
      onRegister: () => { tracker.guestRegisterClick(currentPath); setShowFullAuth("register"); },
      onStartDemo: () => { tracker.demoStart(); setIsDemoMode(true); setCurrentPath("/wallet"); },
    };
    switch (currentPath) {
      case "/":
        return <HomePage {...homeProps} />;
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
        return <MiningPage onBack={() => handleNavigate("/more")} />;
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
      case "/admin/old":
        return user.role === "admin"
          ? <AdminPage onNavigate={handleNavigate} />
          : <HomePage {...homeProps} />;
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
        return isGuest ? <HomePage {...homeProps} /> : <TaxiPage onNavigate={handleNavigate} />;
      case "/taxi-partner":
        return isGuest ? <HomePage {...homeProps} /> : <TaxiOperatorPage onNavigate={handleNavigate} />;
      case "/taxi-dashboard":
        return isGuest ? <HomePage {...homeProps} /> : <TaxiOperatorDashboard onNavigate={handleNavigate} />;
      case "/scooter":
        return isGuest ? <HomePage {...homeProps} /> : <ScooterPage onNavigate={handleNavigate} />;
      case "/food":
        return isGuest ? <HomePage {...homeProps} /> : <FoodPage onNavigate={handleNavigate} />;
      case "/driver-dashboard":
        return isGuest ? <HomePage {...homeProps} /> : <DriverDashboardPage onNavigate={handleNavigate} />;
      case "/restaurant-dashboard":
        return isGuest ? <HomePage {...homeProps} /> : <RestaurantDashboardPage onNavigate={handleNavigate} />;
      case "/child-mode":
        return <ChildModePage />;
      case "/marketplace":
        return <MarketplacePage onNavigate={handleNavigate} />;
      case "/chat":
        return isGuest ? <HomePage {...homeProps} /> : <ChatPage onNavigate={handleNavigate} />;
      case "/support-chat":
        return isGuest ? <HomePage {...homeProps} /> : <SupportChatPage onBack={() => handleNavigate("/more")} />;
      case "/admin/support":
        return isGuest ? <HomePage {...homeProps} /> : <SupportChatPage onBack={() => handleNavigate("/admin")} isAdmin={true} />;
      case "/partners":
        return <PartnersPage />;
      case "/referral":
        return isGuest ? <HomePage {...homeProps} /> : <ReferralSystemPage onNavigate={handleNavigate} />;
      case "/loyalty":
        return isGuest ? <HomePage {...homeProps} /> : <LoyaltyPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/kids":
        return isGuest ? <HomePage {...homeProps} /> : <KidsPaywall onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/nfc":
        return isGuest ? <HomePage {...homeProps} /> : <NfcPayPage onBack={() => handleNavigate("/more")} />;
      case "/vip":
        return isGuest ? <HomePage {...homeProps} /> : <VipPage onBack={() => handleNavigate("/more")} />;
      case "/mobility-map":
        return isGuest ? <HomePage {...homeProps} /> : <MobilityMapPage onNavigate={handleNavigate} />;
      case "/credit-score":
        return isGuest ? <HomePage {...homeProps} /> : <CreditScorePage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/bills":
        return isGuest ? <HomePage {...homeProps} /> : <BillsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/split-bill":
        return isGuest ? <HomePage {...homeProps} /> : <SplitBillPage onBack={() => handleNavigate("/more")} />;
      case "/virtual-cards":
        return isGuest ? <HomePage {...homeProps} /> : <VirtualCardsPage onBack={() => handleNavigate("/more")} />;
      case "/savings":
        return isGuest ? <HomePage {...homeProps} /> : <SavingsPage onBack={() => handleNavigate("/more")} />;
      case "/bnpl":
        return isGuest ? <HomePage {...homeProps} /> : <BNPLPage onBack={() => handleNavigate("/more")} />;
      case "/gift-cards":
        return isGuest ? <HomePage {...homeProps} /> : <GiftCardsPage onBack={() => handleNavigate("/more")} />;
      case "/ai-assistant":
        return isGuest ? <HomePage {...homeProps} /> : <AIAssistantPage onBack={() => handleNavigate("/more")} />;
      case "/crypto":
        return isGuest ? <HomePage {...homeProps} /> : <CryptoWalletPage onBack={() => handleNavigate("/more")} />;
      case "/budget":
        return isGuest ? <HomePage {...homeProps} /> : <BudgetPlannerPage onBack={() => handleNavigate("/more")} />;
      case "/admin/credits":
        return isGuest ? <HomePage {...homeProps} /> : <AdminCreditPage onBack={() => handleNavigate("/admin")} />;
      case "/notification-center":
        return isGuest ? <HomePage {...homeProps} /> : <NotificationCenterPage onBack={() => handleNavigate("/more")} />;
      case "/contacts":
        return isGuest ? <HomePage {...homeProps} /> : <ContactsPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/user-stats":
        return isGuest ? <HomePage {...homeProps} /> : <UserStatsPage onBack={() => handleNavigate("/more")} />;
      case "/currency":
        return isGuest ? <HomePage {...homeProps} /> : <CurrencyConverterPage onBack={() => handleNavigate("/more")} />;
      case "/hotels":
        return isGuest ? <HomePage {...homeProps} /> : <HotelBookingPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/events":
        return isGuest ? <HomePage {...homeProps} /> : <EventBookingPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/restaurants":
        return isGuest ? <HomePage {...homeProps} /> : <RestaurantReservationPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/insurance":
        return isGuest ? <HomePage {...homeProps} /> : <InsurancePage onBack={() => handleNavigate("/more")} />;
      case "/appointments":
        return isGuest ? <HomePage {...homeProps} /> : <AppointmentPage onBack={() => handleNavigate("/more")} />;
      case "/social":
        return isGuest ? <HomePage {...homeProps} /> : <SocialFeedPage onBack={() => handleNavigate("/more")} />;
      case "/jobs":
        return isGuest ? <HomePage {...homeProps} /> : <JobMarketplacePage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/flights":
        return isGuest ? <HomePage {...homeProps} /> : <FlightSearchPage onBack={() => handleNavigate("/more")} />;
      case "/parcels":
        return isGuest ? <HomePage {...homeProps} /> : <ParcelPage onBack={() => handleNavigate("/more")} />;
      case "/cv-builder":
        return isGuest ? <HomePage {...homeProps} /> : <CVBuilderPage onBack={() => handleNavigate("/jobs")} />;
      case "/nearby":
        return isGuest ? <HomePage {...homeProps} /> : <NearbyPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/merchant-portal":
        return isGuest ? <HomePage {...homeProps} /> : <MerchantPortalPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/kids-app":
        return isGuest ? <HomePage {...homeProps} /> : <KidsAppPage onBack={() => handleNavigate("/kids")} />;
      case "/gaming":
        return isGuest ? <HomePage {...homeProps} /> : <GamingPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/real-estate":
        return isGuest ? <HomePage {...homeProps} /> : <RealEstatePage onBack={() => handleNavigate("/more")} />;
      case "/freelancer":
        return isGuest ? <HomePage {...homeProps} /> : <FreelancerPage onBack={() => handleNavigate("/more")} />;
      case "/elearning":
        return isGuest ? <HomePage {...homeProps} /> : <ELearningPage onBack={() => handleNavigate("/more")} />;
      case "/handwerker":
        return isGuest ? <HomePage {...homeProps} /> : <HandwerkerPage onBack={() => handleNavigate("/more")} />;
      case "/streaming":
        return isGuest ? <HomePage {...homeProps} /> : <StreamingPage onBack={() => handleNavigate("/more")} />;
      case "/telemedizin":
        return isGuest ? <HomePage {...homeProps} /> : <TelemedizinPage onBack={() => handleNavigate("/more")} />;
      case "/dating":
        return isGuest ? <HomePage {...homeProps} /> : <DatingPage onBack={() => handleNavigate("/more")} />;
      case "/gebrauchtwagen":
        return isGuest ? <HomePage {...homeProps} /> : <GebrauchtwagenPage onBack={() => handleNavigate("/more")} />;
      case "/reinigung":
        return isGuest ? <HomePage {...homeProps} /> : <ReinigungPage onBack={() => handleNavigate("/more")} />;
      case "/umzug":
        return isGuest ? <HomePage {...homeProps} /> : <UmzugPage onBack={() => handleNavigate("/more")} />;
      case "/tierbetreuung":
        return isGuest ? <HomePage {...homeProps} /> : <TierbetreuungPage onBack={() => handleNavigate("/more")} />;
      case "/fitness":
        return isGuest ? <HomePage {...homeProps} /> : <FitnessPage onBack={() => handleNavigate("/more")} />;
      case "/reiseplaner":
        return isGuest ? <HomePage {...homeProps} /> : <ReiseplanerPage onBack={() => handleNavigate("/more")} />;
      case "/ladesaeulen":
        return isGuest ? <HomePage {...homeProps} /> : <LadesaeulenPage onBack={() => handleNavigate("/more")} />;
      case "/admin/email-marketing":
        return user.role === "admin"
          ? <EmailMarketingAdminPage onBack={() => handleNavigate("/admin")} />
          : <HomePage {...homeProps} />;
      case "/all-services":
        return <AllServicesPage onBack={() => handleNavigate("/")} onNavigate={handleNavigate} />;
      case "/stocks":
        return isGuest ? <HomePage {...homeProps} /> : <StocksPage onBack={() => handleNavigate("/more")} />;
      case "/reselling":
        return isGuest ? <HomePage {...homeProps} /> : <ResellingPage onBack={() => handleNavigate("/more")} />;
      case "/blitzjobs":
        return isGuest ? <HomePage {...homeProps} /> : <BlitzJobsPage onBack={() => handleNavigate("/more")} />;
      case "/cashback":
        return isGuest ? <HomePage {...homeProps} /> : <CashbackPage onBack={() => handleNavigate("/more")} />;
      case "/premium":
        return isGuest ? <HomePage {...homeProps} /> : <PremiumPage onBack={() => handleNavigate("/more")} />;
      case "/stories":
        return isGuest ? <HomePage {...homeProps} /> : <StoriesPage onBack={() => handleNavigate("/more")} />;
      case "/live-auctions":
        return isGuest ? <HomePage {...homeProps} /> : <LiveAuctionsPage onBack={() => handleNavigate("/more")} />;
      case "/social-hub":
        return isGuest ? <HomePage {...homeProps} /> : <SocialHubPage onBack={() => handleNavigate("/more")} />;
      case "/blitzlearn":
        return isGuest ? <HomePage {...homeProps} /> : <BlitzLearnPage onBack={() => handleNavigate("/more")} />;
      case "/blitzhub":
        return isGuest ? <HomePage {...homeProps} /> : <BlitzHubPage onBack={() => handleNavigate("/more")} />;
      case "/leaderboard":
        return isGuest ? <HomePage {...homeProps} /> : <LeaderboardPage onBack={() => handleNavigate("/more")} />;
      case "/city":
        return isGuest ? <HomePage {...homeProps} /> : <CityServicesPage onBack={() => handleNavigate("/more")} />;
      case "/blitzpay":
        return isGuest ? <HomePage {...homeProps} /> : <BlitzPayPage onBack={() => handleNavigate("/more")} />;
      case "/crypto-earn":
        return isGuest ? <HomePage {...homeProps} /> : <CryptoEarnPage onBack={() => handleNavigate("/more")} />;
      case "/crypto-baskets":
        return isGuest ? <HomePage {...homeProps} /> : <CryptoBasketsPage onBack={() => handleNavigate("/more")} />;
      case "/derivatives":
        return isGuest ? <HomePage {...homeProps} /> : <DerivativesPage onBack={() => handleNavigate("/more")} />;
      case "/levelup":
        return isGuest ? <HomePage {...homeProps} /> : <LevelUpPage onBack={() => handleNavigate("/more")} />;
      case "/predictions":
        return isGuest ? <HomePage {...homeProps} /> : <PredictionsPage onBack={() => handleNavigate("/more")} />;
      case "/blitzcard":
        return isGuest ? <HomePage {...homeProps} /> : <BlitzCardPage onBack={() => handleNavigate("/more")} />;
      case "/supercharger":
        return isGuest ? <HomePage {...homeProps} /> : <SuperchargerPage onBack={() => handleNavigate("/more")} />;
      case "/defi-wallet":
        return isGuest ? <HomePage {...homeProps} /> : <DeFiWalletPage onBack={() => handleNavigate("/more")} />;
      case "/crypto-loans":
        return isGuest ? <HomePage {...homeProps} /> : <CryptoLoansPage onBack={() => handleNavigate("/more")} />;
      case "/p2p-lending":
        return isGuest ? <HomePage {...homeProps} /> : <P2PLendingPage onBack={() => handleNavigate("/more")} />;
      case "/trading-bot":
        return isGuest ? <HomePage {...homeProps} /> : <TradingBotPage onBack={() => handleNavigate("/more")} />;
      case "/live-shopping":
        return isGuest ? <HomePage {...homeProps} /> : <LiveShoppingPage onBack={() => handleNavigate("/more")} />;
      case "/creators":
        return isGuest ? <HomePage {...homeProps} /> : <CreatorsPage onBack={() => handleNavigate("/more")} />;
      case "/skills-market":
        return isGuest ? <HomePage {...homeProps} /> : <SkillsMarketPage onBack={() => handleNavigate("/more")} />;
      case "/invoicing":
        return isGuest ? <HomePage {...homeProps} /> : <InvoicingPage onBack={() => handleNavigate("/more")} />;
      case "/qr-menu":
        return isGuest ? <HomePage {...homeProps} /> : <QRMenuPage onBack={() => handleNavigate("/more")} />;
      case "/termin-booking":
        return isGuest ? <HomePage {...homeProps} /> : <BookingsPage onBack={() => handleNavigate("/more")} />;
      case "/contracts":
        return isGuest ? <HomePage {...homeProps} /> : <ContractsPage onBack={() => handleNavigate("/more")} />;
      case "/utilities":
        return isGuest ? <HomePage {...homeProps} /> : <UtilitiesHubPage onBack={() => handleNavigate("/more")} />;
      case "/engage":
        return isGuest ? <HomePage {...homeProps} /> : <EngageHubPage onBack={() => handleNavigate("/more")} />;
      case "/viral":
        return isGuest ? <HomePage {...homeProps} /> : <ViralHubPage onBack={() => handleNavigate("/more")} />;
      
      // Car Rental Module
      case "/car-rental":
        return <CarListPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/car-rental/my-bookings":
        return isGuest ? <HomePage {...homeProps} /> : <MyCarBookingsPage onBack={() => handleNavigate("/car-rental")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor":
        return isGuest ? <HomePage {...homeProps} /> : <VendorCarRentalDashboardPage onBack={() => handleNavigate("/more")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/cars":
        return isGuest ? <HomePage {...homeProps} /> : <VendorCarsPage onBack={() => handleNavigate("/car-rental/vendor")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/cars/new":
        return isGuest ? <HomePage {...homeProps} /> : <VendorCarsPage onBack={() => handleNavigate("/car-rental/vendor")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/bookings":
        return isGuest ? <HomePage {...homeProps} /> : <VendorBookingsPage onBack={() => handleNavigate("/car-rental/vendor")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/invoices":
        return isGuest ? <HomePage {...homeProps} /> : <VendorInvoicesPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/payouts":
        return isGuest ? <HomePage {...homeProps} /> : <VendorPayoutsPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/damages":
        return isGuest ? <HomePage {...homeProps} /> : <VendorDamagesPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/settings":
        return isGuest ? <HomePage {...homeProps} /> : <VendorSettingsPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/staff":
        return isGuest ? <HomePage {...homeProps} /> : <VendorStaffPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/vendor/customers":
        return isGuest ? <HomePage {...homeProps} /> : <VendorBookingsPage onBack={() => handleNavigate("/car-rental/vendor")} onNavigate={handleNavigate} />;
      case "/car-rental/vendor/reports":
        return isGuest ? <HomePage {...homeProps} /> : <VendorReportsPage onBack={() => handleNavigate("/car-rental/vendor")} />;
      case "/car-rental/admin":
        return isGuest ? <HomePage {...homeProps} /> : <AdminCarRentalPage onBack={() => handleNavigate("/admin")} onNavigate={handleNavigate} />;
      case "/car-rental/admin/disputes":
        return isGuest ? <HomePage {...homeProps} /> : <AdminDisputesPage onBack={() => handleNavigate("/car-rental/admin")} />;
      
      default:
        // Handle dynamic routes
        if (currentPath.startsWith("/car-rental/vendor/bookings/")) {
          const bId = currentPath.split("/car-rental/vendor/bookings/")[1];
          return isGuest ? <HomePage {...homeProps} /> : <VendorBookingDetailPage bookingId={bId} onBack={() => handleNavigate("/car-rental/vendor/bookings")} onNavigate={handleNavigate} />;
        }
        if (currentPath.startsWith("/car-rental/my-bookings/")) {
          const bId = currentPath.split("/car-rental/my-bookings/")[1];
          return isGuest ? <HomePage {...homeProps} /> : <MyBookingDetailPage bookingId={bId} onBack={() => handleNavigate("/car-rental/my-bookings")} onNavigate={handleNavigate} />;
        }
        if (currentPath.startsWith("/car-rental/car/")) {
          const carId = currentPath.split("/car-rental/car/")[1];
          return <CarDetailPage carId={carId} onBack={() => handleNavigate("/car-rental")} onNavigate={handleNavigate} />;
        }
        return <HomePage {...homeProps} />;
    }
  };

  const showBottomNav = currentPath !== "/merchant-landing" && (currentPath !== "/scan" || (user.role !== "merchant" && user.role !== "admin"));

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
          {renderPage()}
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
      {/* Global Search Overlay */}
      <AnimatePresence>
        {showGlobalSearch && <GlobalSearch onNavigate={handleNavigate} onClose={() => setShowGlobalSearch(false)} />}
      </AnimatePresence>
      {/* Onboarding Tour */}
      {showOnboarding && !user.isAuthenticated && (
        <OnboardingTour onComplete={() => { setShowOnboarding(false); localStorage.setItem("bidblitz_onboarded", "1"); }} />
      )}
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
