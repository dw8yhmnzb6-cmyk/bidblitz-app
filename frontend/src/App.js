import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { CookieConsent } from "./components/CookieConsent";
import { ScrollToTop } from "./components/ScrollToTop";
import { ScrollToTopOnNavigate } from "./components/ScrollToTopOnNavigate";
import { Toaster } from "./components/ui/sonner";

// Pages
import Home from "./pages/Home";
import Auctions from "./pages/Auctions";
import AuctionDetail from "./pages/AuctionDetail";
import BuyBids from "./pages/BuyBids";
import PaymentSuccess from "./pages/PaymentSuccess";
import Dashboard from "./pages/Dashboard";
import UserStats from "./pages/UserStats";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Admin from "./pages/Admin";
import ForgotPassword from "./pages/ForgotPassword";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import AGB from "./pages/AGB";
import Profile from "./pages/Profile";
import BidHistory from "./pages/BidHistory";
import Purchases from "./pages/Purchases";
import Affiliate from "./pages/Affiliate";
import InviteFriends from "./pages/InviteFriends";
import Winners from "./pages/Winners";
import Achievements from "./pages/Achievements";
import Wishlist from "./pages/Wishlist";
import Invoices from "./pages/Invoices";
import Notifications from "./pages/Notifications";
import HowItWorks from "./pages/HowItWorks";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import VIP from "./pages/VIP";
import VIPAuctions from "./pages/VIPAuctions";
import WonAuctionCheckout from "./pages/WonAuctionCheckout";
import InfluencerDashboard from "./pages/InfluencerDashboard";
import InfluencerBecome from "./pages/InfluencerBecome";
import WholesaleApply from "./pages/WholesaleApply";
import WholesaleDashboard from "./pages/WholesaleDashboard";
import GiftBids from "./pages/GiftBids";
import GiftCards from "./pages/GiftCards";
import GiftCardSuccess from "./pages/GiftCardSuccess";

// Protected Route Component
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050509]">
        <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppContent() {
  return (
    <div className="App bg-[#050509] min-h-screen flex flex-col">
      {/* Scroll to top on route change */}
      <ScrollToTopOnNavigate />
      
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      <Navbar />
      
      <main className="flex-grow">
        <Routes>
          {/* Startseite = Auctions mit allen Funktionen (Filter, Badges, Grid) */}
          <Route path="/" element={<Auctions />} />
          <Route path="/auctions" element={<Auctions />} />
          <Route path="/auctions/:id" element={<AuctionDetail />} />
          <Route path="/vip-auctions" element={<VIPAuctions />} />
          <Route path="/buy-bids" element={<BuyBids />} />
          <Route path="/payment/success" element={
            <ProtectedRoute>
              <PaymentSuccess />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/stats" element={
            <ProtectedRoute>
              <UserStats />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin>
              <Admin />
            </ProtectedRoute>
          } />
          {/* Public Legal Pages */}
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/agb" element={<AGB />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Protected User Pages */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/bid-history" element={
            <ProtectedRoute>
              <BidHistory />
            </ProtectedRoute>
          } />
          <Route path="/purchases" element={
            <ProtectedRoute>
              <Purchases />
            </ProtectedRoute>
          } />
          <Route path="/affiliate" element={<Affiliate />} />
          <Route path="/invite" element={<InviteFriends />} />
          <Route path="/gift-bids" element={
            <ProtectedRoute>
              <GiftBids />
            </ProtectedRoute>
          } />
          <Route path="/winners" element={<Winners />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/wishlist" element={
            <ProtectedRoute>
              <Wishlist />
            </ProtectedRoute>
          } />
          <Route path="/invoices" element={
            <ProtectedRoute>
              <Invoices />
            </ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          } />
          <Route path="/checkout/won/:auctionId" element={
            <ProtectedRoute>
              <WonAuctionCheckout />
            </ProtectedRoute>
          } />
          {/* New Public Pages */}
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/vip" element={<VIP />} />
          <Route path="/vip/success" element={<VIP />} />
          {/* Influencer Pages */}
          <Route path="/influencer-login" element={<InfluencerDashboard />} />
          <Route path="/influencer-dashboard" element={<InfluencerDashboard />} />
          <Route path="/influencer-werden" element={<InfluencerBecome />} />
          {/* Wholesale/B2B Pages */}
          <Route path="/wholesale/apply" element={<WholesaleApply />} />
          <Route path="/wholesale" element={<WholesaleDashboard />} />
          <Route path="/grosshandel" element={<WholesaleDashboard />} />
          {/* Gift Cards */}
          <Route path="/giftcards" element={<GiftCards />} />
          <Route path="/giftcards/redeem" element={<GiftCards />} />
          <Route path="/giftcards/success" element={
            <ProtectedRoute>
              <GiftCardSuccess />
            </ProtectedRoute>
          } />
          <Route path="/geschenkkarten" element={<GiftCards />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      <Footer />
      
      <CookieConsent />
      
      <ScrollToTop />
      
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#181824',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#F8FAFC',
            fontSize: '12px',
            padding: '8px 12px',
            maxWidth: '280px',
          },
          duration: 3000,
        }}
        visibleToasts={3}
        gap={4}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
