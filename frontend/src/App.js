import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "@/App.css";

import { AppProvider, useUser } from "./store";

import HomePage from "./pages/HomePage";
import WalletPage from "./pages/WalletPage";
import ScannerPage from "./pages/ScannerPage";
import MerchantPage from "./pages/MerchantPage";
import MorePage from "./pages/MorePage";
import AuthPage from "./pages/AuthPage";

import BottomNav from "./components/BottomNav";

const pageTransition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

function AppContent() {
  // Detect Stripe return — if URL has stripe_session_id, start on wallet
  const hasStripeReturn = typeof window !== "undefined" &&
    (window.location.search.includes("stripe_session_id") || window.location.search.includes("stripe_cancelled"));

  const [currentPath, setCurrentPath] = useState(hasStripeReturn ? "/wallet" : "/");
  const [stripeReturn, setStripeReturn] = useState(hasStripeReturn);
  const user = useUser();

  const handleNavigate = (path) => setCurrentPath(path);

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
        return <ScannerPage onNavigate={handleNavigate} />;
      case "/merchant":
        return <MerchantPage onNavigate={handleNavigate} />;
      case "/more":
        return <MorePage onNavigate={handleNavigate} />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const showBottomNav = currentPath !== "/scan";

  return (
    <div className="app-container" data-testid="app-container">
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
