import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "@/App.css";

// Store providers
import { AppProvider } from "./store";

// Pages
import HomePage from "./pages/HomePage";
import WalletPage from "./pages/WalletPage";
import ScannerPage from "./pages/ScannerPage";
import MerchantPage from "./pages/MerchantPage";
import MorePage from "./pages/MorePage";

// Components
import BottomNav from "./components/BottomNav";

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const pageTransition = {
  duration: 0.3,
  ease: "easeInOut"
};

function AppContent() {
  const [currentPath, setCurrentPath] = useState("/");

  const handleNavigate = (path) => {
    setCurrentPath(path);
  };

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

  // Hide bottom nav on scanner page for full-screen experience
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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
