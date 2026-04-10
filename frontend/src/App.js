import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import "@/App.css";

import { AppProvider, useUser, useI18n } from "./store";

import HomePage from "./pages/HomePage";
import WalletPage from "./pages/WalletPage";
import ScannerPage from "./pages/ScannerPage";
import MerchantPage from "./pages/MerchantPage";
import AdminPage from "./pages/AdminPage";
import MorePage from "./pages/MorePage";
import AuctionsPage from "./pages/AuctionsPage";
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
import AuthPage from "./pages/AuthPage";
import NotificationsPage from "./pages/NotificationsPage";
import InfluencerDashboard from "./pages/InfluencerDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import TaxiPage from "./pages/TaxiPageReal";
import ScooterPage from "./pages/ScooterPage";
import FoodPage from "./pages/FoodPage";
import DriverDashboardPage from "./pages/DriverDashboardPage";
import ChildModePage from "./pages/ChildModePage";

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

  const requireAuth = (message) => {
    setAuthGateMessage(message || "");
    setShowAuthGate(true);
  };

  const handleNavigate = (path) => {
    // Track page view
    tracker.pageView(path);

    // For customers: scan tab opens QR modal (or gates if guest)
    if (path === "/scan") {
      if (isGuest) {
        requireAuth();
        return;
      }
      if (user.role !== "merchant" && user.role !== "admin") {
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
      case "/admin":
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
      case "/taxi":
        return isGuest ? <HomePage {...homeProps} /> : <TaxiPage />;
      case "/scooter":
        return isGuest ? <HomePage {...homeProps} /> : <ScooterPage />;
      case "/food":
        return isGuest ? <HomePage {...homeProps} /> : <FoodPage />;
      case "/driver-dashboard":
        return isGuest ? <HomePage {...homeProps} /> : <DriverDashboardPage />;
      case "/child-mode":
        return <ChildModePage />;
      default:
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
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
