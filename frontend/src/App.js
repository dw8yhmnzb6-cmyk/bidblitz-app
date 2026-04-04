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
import AuthPage from "./pages/AuthPage";
import NotificationsPage from "./pages/NotificationsPage";

import BottomNav from "./components/BottomNav";
import BarcodeModal from "./components/BarcodeModal";

const pageTransition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

function AppContent() {
  // Detect Stripe return — if URL has stripe_session_id, start on wallet; kids_sub → more
  const hasStripeReturn = typeof window !== "undefined" &&
    (window.location.search.includes("stripe_session_id") || window.location.search.includes("stripe_cancelled"));
  const hasKidsReturn = typeof window !== "undefined" && window.location.search.includes("kids_sub=success");

  const [currentPath, setCurrentPath] = useState(hasKidsReturn ? "/more" : hasStripeReturn ? "/wallet" : "/");
  const [stripeReturn, setStripeReturn] = useState(hasStripeReturn);
  const [kidsReturn, setKidsReturn] = useState(hasKidsReturn);
  const [showBarcode, setShowBarcode] = useState(false);
  const user = useUser();
  const { setLang } = useI18n();

  // Sync language from backend after login/session restore
  useEffect(() => {
    if (user.isAuthenticated && user.language) {
      setLang(user.language);
    }
  }, [user.isAuthenticated, user.language, setLang]);

  const handleNavigate = (path) => {
    // For customers: scan tab opens QR modal instead of scanner page
    if (path === "/scan" && user.role !== "merchant" && user.role !== "admin") {
      setShowBarcode(true);
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

  // Not authenticated → show auth page
  if (!user.isAuthenticated) {
    return <AuthPage />;
  }

  // Protected routes
  const protectedPaths = ["/wallet", "/scan", "/merchant"];
  const isProtected = protectedPaths.includes(currentPath);
  if (isProtected && !user.isAuthenticated) {
    setCurrentPath("/");
    return null;
  }

  const renderPage = () => {
    switch (currentPath) {
      case "/":
        return <HomePage onNavigate={handleNavigate} />;
      case "/wallet":
        return <WalletPage onNavigate={handleNavigate} />;
      case "/scan":
        // Merchants get the scanner, customers see their own QR code
        if (user.role === "merchant" || user.role === "admin") {
          return <ScannerPage onNavigate={handleNavigate} />;
        }
        // For customers, show QR modal over current page
        return <HomePage onNavigate={handleNavigate} />;
      case "/merchant":
        return <MerchantPage onNavigate={handleNavigate} />;
      case "/admin":
        return user.role === "admin" ? <AdminPage onNavigate={handleNavigate} /> : <HomePage onNavigate={handleNavigate} />;
      case "/notifications":
        return <NotificationsPage onBack={() => handleNavigate("/")} />;
      case "/more":
        return <MorePage onNavigate={handleNavigate} kidsReturn={kidsReturn} onKidsHandled={() => setKidsReturn(false)} />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const showBottomNav = currentPath !== "/scan" || (user.role !== "merchant" && user.role !== "admin");

  return (
    <div className="app-container" data-testid="app-container">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#141414", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", fontSize: "13px", fontFamily: "Outfit, sans-serif" },
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPath}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={pageTransition}
          className="min-h-screen"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
      {showBottomNav && <BottomNav currentPath={currentPath} onNavigate={handleNavigate} />}
      <BarcodeModal isOpen={showBarcode} onClose={() => setShowBarcode(false)} />
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
