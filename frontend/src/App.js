import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "@/App.css";

// Store providers
import { AppProvider } from "./store";
import { AuthProvider, useAuth } from "./store/AuthContext";

// Pages
import HomePage from "./pages/HomePage";
import WalletPage from "./pages/WalletPage";
import ScannerPage from "./pages/ScannerPage";
import MerchantPage from "./pages/MerchantPage";
import MorePage from "./pages/MorePage";
import AuthPage from "./pages/AuthPage";

// Components
import BottomNav from "./components/BottomNav";

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const pageTransition = {
  duration: 0.3,
  ease: "easeInOut",
};

function AppContent() {
  const [currentPath, setCurrentPath] = useState("/");
  const { user, loading, logout } = useAuth();

  const handleNavigate = (path) => {
    setCurrentPath(path);
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0A0A0A" }}
      >
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h1 className="text-2xl font-bold font-outfit text-white mb-2">
            Bid<span className="text-[#00C2FF]">Blitz</span>
          </h1>
          <div className="w-8 h-8 border-2 border-[#00C2FF] border-t-transparent rounded-full animate-spin mx-auto" />
        </motion.div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <AuthPage />;
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
        return <MorePage onNavigate={handleNavigate} onLogout={logout} />;
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
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
          className="min-h-screen"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>

      {showBottomNav && (
        <BottomNav currentPath={currentPath} onNavigate={handleNavigate} />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
