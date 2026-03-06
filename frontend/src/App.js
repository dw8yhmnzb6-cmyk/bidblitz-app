import "@/index.css";
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { CookieConsent } from "./components/CookieConsent";
import { ScrollToTop } from "./components/ScrollToTop";
import { ScrollToTopOnNavigate } from "./components/ScrollToTopOnNavigate";
import { Toaster } from "./components/ui/sonner";
import HappyHourBanner from "./components/HappyHourBanner";
import PWAInstallBanner from "./components/PWAInstallBanner";
import TawkChat from "./components/TawkChat";
import DailyLoginPopup from "./components/DailyLoginPopup";
import SupportButton from "./components/SupportButton";

// Pages
import Home from "./pages/Home";
import Auctions from "./pages/Auctions";
import AuctionDetail from "./pages/AuctionDetail";
import MysteryBoxDetail from "./pages/MysteryBoxDetail";
import BuyBids from "./pages/BuyBids";
import PaymentSuccess from "./pages/PaymentSuccess";
import Dashboard from "./pages/Dashboard";
import UserStats from "./pages/UserStats";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
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
import VIPDashboard from "./pages/VIPDashboard";
import WonAuctionCheckout from "./pages/WonAuctionCheckout";
import WonAuctionSuccess from "./pages/WonAuctionSuccess";
import InfluencerDashboard from "./pages/InfluencerDashboard";
import InfluencerBecome from "./pages/InfluencerBecome";
import CarAdvertising from "./pages/CarAdvertising";
import DepositOffers from "./pages/DepositOffers";
import DigitalCheckout from "./pages/DigitalCheckout";
import WholesaleApply from "./pages/WholesaleApply";
import WholesaleDashboard from "./pages/WholesaleDashboard";
import GiftBids from "./pages/GiftBids";
import GiftCards from "./pages/GiftCards";
import GiftCardSuccess from "./pages/GiftCardSuccess";
import Leaderboard from "./pages/Leaderboard";
import BeginnerAuctions from "./pages/BeginnerAuctions";
import ReferralDashboard from "./pages/ReferralDashboard";
import FlashEvents from "./pages/FlashEvents";
import WinnerGallery from "./pages/WinnerGallery";
import Subscriptions from "./pages/Subscriptions";
import LoyaltyPage from "./pages/LoyaltyPage";
import FlashSalesPage from "./pages/FlashSalesPage";
import MyStatsPage from "./pages/MyStats";
import LevelsPage from "./pages/LevelsPage";
import ApiDocs from "./pages/ApiDocs";
import POSTerminal from "./pages/POSTerminal";
import POSKiosk from "./pages/POSKiosk";
import StaffPOS from "./pages/StaffPOS";
import EnterprisePortal from "./pages/EnterprisePortal";
import CashbackDashboard from "./components/CashbackDashboard";
import POSScanner from "./pages/POSScanner";
import MyPaymentQR from "./pages/MyPaymentQR";
import WalletCard from "./pages/WalletCard";
import PaymentHistory from "./pages/PaymentHistory";
import DailyRewardsPage from "./pages/DailyRewardsPage";
import BattlePassPage from "./pages/BattlePassPage";
import MysteryBoxPage from "./pages/MysteryBoxPage";
import PriceAlertsPage from "./pages/PriceAlertsPage";
import SocialSharePage from "./pages/SocialSharePage";
import BundlesPage from "./pages/BundlesPage";
import LastChancePage from "./pages/LastChancePage";
import FriendBattlePage from "./pages/FriendBattlePage";
import ReviewsPage from "./pages/ReviewsPage";
import ManagerDashboard from "./pages/ManagerDashboard";
import BidBuddyPage from "./pages/BidBuddyPage";
import BuyItNowPage from "./pages/BuyItNowPage";
import AchievementsPage from "./pages/AchievementsPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import ReferralPage from "./pages/ReferralPage";
import VideoTestimonialsPage from "./pages/VideoTestimonialsPage";
import TeamAuctionsPage from "./pages/TeamAuctionsPage";
import BirthdayBonusPage from "./pages/BirthdayBonusPage";
import WishlistPage from "./pages/WishlistPage";
import TournamentsPage from "./pages/Tournaments";
import ReferFriendsPage from "./pages/ReferFriends";
import StreakProtectionPage from "./pages/StreakProtectionPage";
import ExcitementAdminPage from "./pages/ExcitementAdminPage";
import DiscountCardsAdmin from "./pages/DiscountCardsAdmin";
import AdminBNPL from "./pages/AdminBNPL";
import InvestorPortal from "./pages/InvestorPortal";
import PhoneVerification from "./pages/PhoneVerification";
import DealRadarPage from "./pages/DealRadarPage";
import UserStatsPage from "./pages/UserStatsPage";
import KYCVerification from "./pages/KYCVerification";
import KYCAdmin from "./pages/KYCAdmin";
import VerifyEmail from "./pages/VerifyEmail";
import BidBlitzPayAnalytics from "./pages/BidBlitzPayAnalytics";
import LiveWinnerPopup from "./components/LiveWinnerPopup";
import WelcomeBonusBanner from "./components/WelcomeBonusBanner";
import LanguageHintBanner from "./components/LanguageHintBanner";
import CountdownDealBanner from "./components/CountdownDealBanner";
import HowItWorksFloatingButton from "./components/HowItWorksFloatingButton";
import AIBidRecommendationsPage from "./pages/AIBidRecommendationsPage";
import CryptoPaymentPage from "./pages/CryptoPaymentPage";
import MaintenancePage from "./pages/MaintenancePage";
import WholesaleRegister from "./pages/WholesaleRegister";
import WholesaleLogin from "./pages/WholesaleLogin";
import SocialSharingRewards from "./pages/SocialSharingRewards";
import FriendsBattle from "./pages/FriendsBattle";
import SocialBettingPage from "./pages/SocialBettingPage";
import BidAlarmPage from "./pages/BidAlarmPage";
import AIAdvisorPage from "./pages/AIAdvisorPage";
import VoucherAuctionsPage from "./pages/VoucherAuctionsPage";
import MerchantVouchersPage from "./pages/MerchantVouchersPage";
import DuelsPage from "./pages/DuelsPage";
import GiftCardsPage from "./pages/GiftCardsPage";
import FriendBattlesPage from "./pages/FriendBattlesPage";
import TeamBiddingPage from "./pages/TeamBiddingPage";
import FeaturesPage from "./pages/FeaturesPage";
import RestaurantVouchersPage from "./pages/RestaurantVouchersPage";
import RestaurantPortal from "./pages/RestaurantPortal";
import PartnerPortal from "./pages/PartnerPortal";
import DiscoverRestaurants from "./pages/DiscoverRestaurants";
import LoyaltyDashboard from "./pages/LoyaltyDashboard";
import CustomerLoyaltyDashboard from "./pages/CustomerLoyaltyDashboard";
import MyInstallments from "./pages/MyInstallments";
import RestaurantDetail from "./pages/RestaurantDetail";
import WriteReview from "./pages/WriteReview";
import BidBlitzPay from "./pages/BidBlitzPay";
import BidBlitzPayInfo from "./pages/BidBlitzPayInfo";
import PartnerLanding from "./pages/PartnerLanding";
import PartnerDirectory from "./pages/PartnerDirectory";
import PopupManager from "./components/PopupManager";

// Mining Features
import MinerDashboard from "./pages/MinerDashboard";
import MinerMarket from "./pages/MinerMarket";

// Super App Minimal + New Pages
import SuperAppMinimal from "./pages/SuperAppMinimal";
import GamesHub from "./pages/GamesHub";
import AppWallet from "./pages/AppWallet";
import Match3Game from "./pages/Match3Game";
import SpinWheel from "./pages/SpinWheel";
import Referral from "./pages/Referral";

// New Feature Components
import Watchlist from "./components/Watchlist";
import AutoBid from "./components/AutoBid";
import VIPLoyalty from "./components/VIPLoyalty";

// Protected Route Component
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
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

// Maintenance Mode Hook - checks if maintenance is active
const useMaintenanceCheck = () => {
  const [isInMaintenance, setIsInMaintenance] = useState(false);
  const { isAdmin } = useAuth();
  
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/maintenance/status`);
        const data = await res.json();
        // Only show maintenance page for non-admin users
        setIsInMaintenance(data.enabled && !isAdmin);
      } catch (error) {
        console.error('Error checking maintenance status:', error);
      }
    };
    
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [isAdmin]);
  
  return isInMaintenance;
};

import { useDeviceTracking } from './hooks/useDeviceTracking';

// Page wrapper components for new features
const WatchlistPage = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  return <Watchlist token={token} language={language} />;
};

const AutoBidPage = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  return <AutoBid token={token} language={language} />;
};

const VIPPage = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  return <VIPLoyalty token={token} language={language} />;
};

// Daily Login Popup Wrapper
const DailyLoginPopupWrapper = ({ language }) => {
  const { isAuthenticated, token, refreshUser } = useAuth();
  
  const handleRewardClaimed = async (data) => {
    // Refresh user data to update bids_balance in navbar
    console.log('Daily reward claimed:', data);
    if (refreshUser) {
      await refreshUser();
    }
  };
  
  return (
    <DailyLoginPopup 
      language={language}
      token={token}
      isAuthenticated={isAuthenticated}
      onRewardClaimed={handleRewardClaimed}
    />
  );
};

function AppContent() {
  const { language, mappedLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const isInMaintenance = useMaintenanceCheck();
  
  // Track device info for analytics
  useDeviceTracking();
  
  // Show maintenance page for non-admin users when maintenance mode is active
  if (isInMaintenance) {
    return <MaintenancePage />;
  }
  
  return (
    <div className={`App min-h-screen flex flex-col overflow-x-hidden transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-[#050509] text-white' 
        : 'bg-gradient-to-b from-cyan-50 to-cyan-100 text-gray-800'
    }`}>
      {/* Scroll to top on route change */}
      <ScrollToTopOnNavigate />
      
      {/* Navbar - Fixed at top (hidden on POS/Kiosk pages) */}
      {!window.location.pathname.includes('/pos') && 
       !window.location.pathname.includes('/kiosk') && 
       !window.location.pathname.includes('/kasse') &&
       !window.location.pathname.includes('/scanner') &&
       !window.location.pathname.includes('/mitarbeiter-kasse') &&
       !window.location.pathname.includes('/staff-pos') && (
        <Navbar />
      )}
      
      {/* Floating popups - Managed by PopupManager which uses useLocation */}
      <PopupManager language={mappedLanguage || language} />
      {/* HowItWorksFloatingButton removed per user request */}
      {/* <LiveWinnerPopup language={mappedLanguage || language} /> */}
      {/* <LanguageHintBanner /> */}
      
      {/* Main content wrapper - Offset for fixed navbar */}
      <div className="pt-16">
        {/* Welcome Bonus Banner removed per user request */}
      </div>
      
      <main className="flex-grow">
        <Routes>
          {/* Startseite = Auctions mit allen Funktionen (Filter, Badges, Grid) */}
          <Route path="/" element={<Auctions />} />
          <Route path="/auctions" element={<Auctions />} />
          <Route path="/auctions/:id" element={<AuctionDetail />} />
          <Route path="/mystery-box/:id" element={<MysteryBoxDetail />} />
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
          <Route path="/auth/callback" element={<AuthCallback />} />
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
          
          {/* Partner Landing Page - Public */}
          <Route path="/p/:partnerId" element={<PartnerLanding />} />
          <Route path="/partners" element={<PartnerDirectory />} />
          
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
          <Route path="/won-auction/:auctionId/success" element={
            <ProtectedRoute>
              <WonAuctionSuccess />
            </ProtectedRoute>
          } />
          {/* Digital Payment Checkout (External POS Integration) */}
          <Route path="/checkout/:paymentId" element={<DigitalCheckout />} />
          {/* API Documentation for Partners */}
          <Route path="/developer-docs" element={<ApiDocs />} />
          <Route path="/developers" element={<ApiDocs />} />
          {/* POS Terminal for Merchants */}
          <Route path="/pos" element={<POSTerminal />} />
          <Route path="/kasse" element={<POSKiosk />} />
          <Route path="/kiosk" element={<POSKiosk />} />
          <Route path="/scanner" element={<POSScanner />} />
          {/* Staff POS - Mitarbeiter-Kassensystem */}
          <Route path="/mitarbeiter-kasse" element={<StaffPOS />} />
          <Route path="/staff-pos" element={<StaffPOS />} />
          {/* Enterprise Portal for Large Retailers */}
          <Route path="/enterprise" element={<EnterprisePortal />} />
          <Route path="/grosshaendler" element={<EnterprisePortal />} />
          {/* Cashback Dashboard */}
          <Route path="/cashback" element={
            <ProtectedRoute>
              <CashbackDashboard />
            </ProtectedRoute>
          } />
          <Route path="/mein-cashback" element={
            <ProtectedRoute>
              <CashbackDashboard />
            </ProtectedRoute>
          } />
          {/* Customer Payment QR */}
          <Route path="/mein-qr" element={
            <ProtectedRoute>
              <MyPaymentQR />
            </ProtectedRoute>
          } />
          <Route path="/my-qr" element={
            <ProtectedRoute>
              <MyPaymentQR />
            </ProtectedRoute>
          } />
          {/* Wallet Card */}
          <Route path="/wallet-card" element={
            <ProtectedRoute>
              <WalletCard />
            </ProtectedRoute>
          } />
          <Route path="/meine-karte" element={
            <ProtectedRoute>
              <WalletCard />
            </ProtectedRoute>
          } />
          {/* Payment History */}
          <Route path="/zahlungen" element={
            <ProtectedRoute>
              <PaymentHistory />
            </ProtectedRoute>
          } />
          <Route path="/payment-history" element={
            <ProtectedRoute>
              <PaymentHistory />
            </ProtectedRoute>
          } />
          {/* New Public Pages */}
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/vip" element={<VIP />} />
          <Route path="/vip/success" element={<VIP />} />
          <Route path="/vip-dashboard" element={<VIPDashboard />} />
          {/* Features & Extras Page */}
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/extras" element={<FeaturesPage />} />
          {/* Influencer Pages */}
          <Route path="/influencer-login" element={<InfluencerDashboard />} />
          <Route path="/influencer-dashboard" element={<InfluencerDashboard />} />
          <Route path="/influencer-werden" element={<InfluencerBecome />} />
          <Route path="/auto-werbung" element={<CarAdvertising />} />
          {/* Deposit Offers & Interest */}
          <Route path="/einzahlen" element={<DepositOffers />} />
          <Route path="/deposit" element={<DepositOffers />} />
          <Route path="/bonus" element={<DepositOffers />} />
          {/* Manager Pages */}
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/manager-login" element={<ManagerDashboard />} />
          <Route path="/manager-dashboard" element={<ManagerDashboard />} />
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
          {/* Leaderboard */}
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/rangliste" element={<Leaderboard />} />
          {/* Beginner Auctions */}
          <Route path="/beginner-auctions" element={
            <ProtectedRoute>
              <BeginnerAuctions />
            </ProtectedRoute>
          } />
          <Route path="/anfaenger-auktionen" element={
            <ProtectedRoute>
              <BeginnerAuctions />
            </ProtectedRoute>
          } />
          {/* Referral System */}
          <Route path="/referral" element={<ReferralDashboard />} />
          <Route path="/empfehlen" element={<ReferralDashboard />} />
          {/* Flash Events & Gallery */}
          <Route path="/events" element={<FlashEvents />} />
          <Route path="/flash-auctions" element={<FlashEvents />} />
          <Route path="/flash" element={<FlashEvents />} />
          <Route path="/gallery" element={<WinnerGallery />} />
          <Route path="/gewinner-galerie" element={<WinnerGallery />} />
          <Route path="/winner-gallery" element={<WinnerGallery />} />
          {/* Subscriptions */}
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/abos" element={<Subscriptions />} />
          <Route path="/abo" element={<Subscriptions />} />
          {/* BidBlitz Pay - How it Works Info Page */}
          <Route path="/bidblitz-pay-info" element={<BidBlitzPayInfo />} />
          <Route path="/pay-info" element={<BidBlitzPayInfo />} />
          {/* BidBlitz Pay - Digital Wallet Payment */}
          <Route path="/bidblitz-pay" element={
            <ProtectedRoute>
              <BidBlitzPay />
            </ProtectedRoute>
          } />
          <Route path="/pay" element={
            <ProtectedRoute>
              <BidBlitzPay />
            </ProtectedRoute>
          } />
          <Route path="/wallet" element={
            <ProtectedRoute>
              <BidBlitzPay />
            </ProtectedRoute>
          } />
          
          {/* Watchlist - Beobachtete Auktionen */}
          <Route path="/watchlist" element={
            <ProtectedRoute>
              <WatchlistPage />
            </ProtectedRoute>
          } />
          <Route path="/beobachtungsliste" element={
            <ProtectedRoute>
              <WatchlistPage />
            </ProtectedRoute>
          } />
          
          {/* Auto-Bid - Automatisches Bieten */}
          <Route path="/auto-bid" element={
            <ProtectedRoute>
              <AutoBidPage />
            </ProtectedRoute>
          } />
          <Route path="/autobieten" element={
            <ProtectedRoute>
              <AutoBidPage />
            </ProtectedRoute>
          } />
          
          {/* VIP Loyalty - Treueprogramm (Punkte sammeln) */}
          <Route path="/vip-loyalty" element={
            <ProtectedRoute>
              <VIPPage />
            </ProtectedRoute>
          } />
          <Route path="/treuepunkte-vip" element={
            <ProtectedRoute>
              <VIPPage />
            </ProtectedRoute>
          } />
          
          {/* Loyalty & Stats */}
          <Route path="/loyalty" element={
            <ProtectedRoute>
              <LoyaltyPage />
            </ProtectedRoute>
          } />
          <Route path="/treuepunkte" element={
            <ProtectedRoute>
              <LoyaltyPage />
            </ProtectedRoute>
          } />
          <Route path="/flash-sales" element={<FlashSalesPage />} />
          <Route path="/angebote" element={<FlashSalesPage />} />
          <Route path="/my-stats" element={
            <ProtectedRoute>
              <MyStatsPage />
            </ProtectedRoute>
          } />
          <Route path="/meine-statistiken" element={
            <ProtectedRoute>
              <MyStatsPage />
            </ProtectedRoute>
          } />
          <Route path="/levels" element={<LevelsPage />} />
          <Route path="/level" element={<LevelsPage />} />
          <Route path="/rang" element={<LevelsPage />} />
          <Route path="/daily" element={
            <ProtectedRoute>
              <DailyRewardsPage />
            </ProtectedRoute>
          } />
          <Route path="/daily-rewards" element={
            <ProtectedRoute>
              <DailyRewardsPage />
            </ProtectedRoute>
          } />
          <Route path="/taeglich" element={
            <ProtectedRoute>
              <DailyRewardsPage />
            </ProtectedRoute>
          } />
          {/* Battle Pass */}
          <Route path="/battle-pass" element={
            <ProtectedRoute>
              <BattlePassPage />
            </ProtectedRoute>
          } />
          <Route path="/battlepass" element={
            <ProtectedRoute>
              <BattlePassPage />
            </ProtectedRoute>
          } />
          <Route path="/pass" element={
            <ProtectedRoute>
              <BattlePassPage />
            </ProtectedRoute>
          } />
          {/* Mystery Box */}
          <Route path="/mystery" element={<MysteryBoxPage />} />
          <Route path="/mystery-box" element={<MysteryBoxPage />} />
          <Route path="/mysterybox" element={<MysteryBoxPage />} />
          {/* Price Alerts */}
          <Route path="/alerts" element={
            <ProtectedRoute>
              <PriceAlertsPage />
            </ProtectedRoute>
          } />
          <Route path="/price-alerts" element={
            <ProtectedRoute>
              <PriceAlertsPage />
            </ProtectedRoute>
          } />
          <Route path="/schnaeppchen-alarm" element={
            <ProtectedRoute>
              <PriceAlertsPage />
            </ProtectedRoute>
          } />
          {/* Deal Radar - Schnäppchen Finder */}
          <Route path="/deal-radar" element={<DealRadarPage />} />
          <Route path="/radar" element={<DealRadarPage />} />
          <Route path="/schnaeppchen" element={<DealRadarPage />} />
          <Route path="/deals" element={<DealRadarPage />} />
          {/* User Stats Dashboard */}
          <Route path="/stats" element={
            <ProtectedRoute>
              <UserStatsPage />
            </ProtectedRoute>
          } />
          <Route path="/statistiken" element={
            <ProtectedRoute>
              <UserStatsPage />
            </ProtectedRoute>
          } />
          <Route path="/my-stats" element={
            <ProtectedRoute>
              <UserStatsPage />
            </ProtectedRoute>
          } />
          {/* AI Bid Recommendations */}
          <Route path="/ki-empfehlungen" element={
            <ProtectedRoute>
              <AIBidRecommendationsPage />
            </ProtectedRoute>
          } />
          <Route path="/ai-bids" element={
            <ProtectedRoute>
              <AIBidRecommendationsPage />
            </ProtectedRoute>
          } />
          {/* Crypto Payment */}
          <Route path="/crypto" element={<CryptoPaymentPage />} />
          <Route path="/krypto" element={<CryptoPaymentPage />} />
          <Route path="/bitcoin" element={<CryptoPaymentPage />} />
          
          {/* B2B / Wholesale Portal */}
          <Route path="/b2b/register" element={<WholesaleRegister />} />
          <Route path="/b2b/login" element={<WholesaleLogin />} />
          <Route path="/b2b/dashboard" element={<WholesaleDashboard />} />
          <Route path="/b2b" element={<Navigate to="/b2b/login" replace />} />
          <Route path="/grosshandel" element={<Navigate to="/b2b/login" replace />} />
          <Route path="/wholesale" element={<Navigate to="/b2b/login" replace />} />
          
          {/* Social Share */}
          <Route path="/share" element={
            <ProtectedRoute>
              <SocialSharePage />
            </ProtectedRoute>
          } />
          <Route path="/social-share" element={
            <ProtectedRoute>
              <SocialSharePage />
            </ProtectedRoute>
          } />
          <Route path="/teilen" element={
            <ProtectedRoute>
              <SocialSharePage />
            </ProtectedRoute>
          } />
          {/* Bundles */}
          <Route path="/bundles" element={<BundlesPage />} />
          <Route path="/pakete" element={<BundlesPage />} />
          {/* Last Chance */}
          <Route path="/last-chance" element={<LastChancePage />} />
          <Route path="/letzte-chance" element={<LastChancePage />} />
          {/* Friend Battle */}
          <Route path="/friend-battle" element={
            <ProtectedRoute>
              <FriendBattlePage />
            </ProtectedRoute>
          } />
          <Route path="/freunde-battle" element={
            <ProtectedRoute>
              <FriendBattlePage />
            </ProtectedRoute>
          } />
          {/* Reviews */}
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/bewertungen" element={<ReviewsPage />} />
          {/* Bid Buddy */}
          <Route path="/bid-buddy" element={
            <ProtectedRoute>
              <BidBuddyPage />
            </ProtectedRoute>
          } />
          <Route path="/auto-bieter" element={
            <ProtectedRoute>
              <BidBuddyPage />
            </ProtectedRoute>
          } />
          {/* Buy It Now */}
          <Route path="/buy-it-now" element={
            <ProtectedRoute>
              <BuyItNowPage />
            </ProtectedRoute>
          } />
          <Route path="/sofort-kaufen" element={
            <ProtectedRoute>
              <BuyItNowPage />
            </ProtectedRoute>
          } />
          {/* Subscription/Abo */}
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/abo-modell" element={<SubscriptionPage />} />
          <Route path="/gebot-abo" element={<SubscriptionPage />} />
          {/* Referral / Freunde-Bonus */}
          <Route path="/freunde-bonus" element={
            <ProtectedRoute>
              <ReferralPage />
            </ProtectedRoute>
          } />
          {/* Achievements / Badges */}
          <Route path="/badges" element={
            <ProtectedRoute>
              <AchievementsPage />
            </ProtectedRoute>
          } />
          <Route path="/abzeichen" element={
            <ProtectedRoute>
              <AchievementsPage />
            </ProtectedRoute>
          } />
          {/* Video Testimonials */}
          <Route path="/testimonials" element={<VideoTestimonialsPage />} />
          <Route path="/gewinner-videos" element={<VideoTestimonialsPage />} />
          {/* Team Auctions */}
          <Route path="/team-auktionen" element={
            <ProtectedRoute>
              <TeamAuctionsPage />
            </ProtectedRoute>
          } />
          <Route path="/teams" element={
            <ProtectedRoute>
              <TeamAuctionsPage />
            </ProtectedRoute>
          } />
          {/* Birthday Bonus */}
          <Route path="/geburtstag" element={
            <ProtectedRoute>
              <BirthdayBonusPage />
            </ProtectedRoute>
          } />
          <Route path="/birthday" element={
            <ProtectedRoute>
              <BirthdayBonusPage />
            </ProtectedRoute>
          } />
          {/* Product Wishlist */}
          <Route path="/produkt-wuensche" element={<WishlistPage />} />
          <Route path="/product-wishlist" element={<WishlistPage />} />
          {/* Streak Protection */}
          <Route path="/streak" element={
            <ProtectedRoute>
              <StreakProtectionPage />
            </ProtectedRoute>
          } />
          <Route path="/login-streak" element={
            <ProtectedRoute>
              <StreakProtectionPage />
            </ProtectedRoute>
          } />
          {/* Tournaments */}
          <Route path="/turniere" element={<TournamentsPage />} />
          <Route path="/tournaments" element={<TournamentsPage />} />
          {/* Refer Friends - Freunde werben */}
          <Route path="/freunde-werben" element={<ReferFriendsPage />} />
          <Route path="/refer" element={<ReferFriendsPage />} />
          {/* Excitement Admin */}
          <Route path="/admin/excitement" element={
            <ProtectedRoute requireAdmin={true}>
              <ExcitementAdminPage />
            </ProtectedRoute>
          } />
          <Route path="/spannung" element={
            <ProtectedRoute requireAdmin={true}>
              <ExcitementAdminPage />
            </ProtectedRoute>
          } />
          
          {/* Discount Cards Admin */}
          <Route path="/admin/discount-cards" element={
            <ProtectedRoute requireAdmin={true}>
              <DiscountCardsAdmin />
            </ProtectedRoute>
          } />
          <Route path="/admin/rabattkarten" element={
            <ProtectedRoute requireAdmin={true}>
              <DiscountCardsAdmin />
            </ProtectedRoute>
          } />
          
          {/* Investor Portal - Public */}
          <Route path="/investor" element={<InvestorPortal />} />
          <Route path="/investoren" element={<InvestorPortal />} />
          
          {/* Phone Verification */}
          <Route path="/phone-verify" element={<PhoneVerification />} />
          <Route path="/telefon" element={<PhoneVerification />} />
          
          {/* KYC Verification */}
          <Route path="/kyc-verification" element={<KYCVerification />} />
          <Route path="/kyc" element={<KYCVerification />} />
          <Route path="/verifizierung" element={<KYCVerification />} />
          
          {/* KYC Admin */}
          <Route path="/admin/kyc" element={
            <ProtectedRoute requireAdmin>
              <KYCAdmin />
            </ProtectedRoute>
          } />
          <Route path="/admin/kyc-management" element={
            <ProtectedRoute requireAdmin>
              <KYCAdmin />
            </ProtectedRoute>
          } />
          
          {/* Email Verification */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/email-bestaetigen" element={<VerifyEmail />} />
          
          {/* Social Sharing Rewards */}
          <Route path="/social-rewards" element={<SocialSharingRewards />} />
          <Route path="/teilen-belohnungen" element={<SocialSharingRewards />} />
          
          {/* BidBlitz Pay Analytics */}
          <Route path="/admin/bidblitz-pay-analytics" element={
            <ProtectedRoute requireAdmin>
              <BidBlitzPayAnalytics />
            </ProtectedRoute>
          } />
          <Route path="/admin/pay-analyse" element={
            <ProtectedRoute requireAdmin>
              <BidBlitzPayAnalytics />
            </ProtectedRoute>
          } />
          
          {/* Admin BNPL Dashboard */}
          <Route path="/admin/bnpl" element={
            <ProtectedRoute requireAdmin>
              <AdminBNPL />
            </ProtectedRoute>
          } />
          <Route path="/admin/ratenzahlung" element={
            <ProtectedRoute requireAdmin>
              <AdminBNPL />
            </ProtectedRoute>
          } />
          
          {/* Friends Battle */}
          <Route path="/friends-battle" element={<FriendsBattle />} />
          <Route path="/freunde-battle" element={<FriendsBattle />} />
          
          {/* Duels / 1v1 */}
          <Route path="/duels" element={
            <ProtectedRoute>
              <DuelsPage />
            </ProtectedRoute>
          } />
          <Route path="/duelle" element={
            <ProtectedRoute>
              <DuelsPage />
            </ProtectedRoute>
          } />
          <Route path="/1v1" element={
            <ProtectedRoute>
              <DuelsPage />
            </ProtectedRoute>
          } />
          
          {/* Social Betting */}
          <Route path="/betting" element={
            <ProtectedRoute>
              <SocialBettingPage />
            </ProtectedRoute>
          } />
          <Route path="/wetten" element={
            <ProtectedRoute>
              <SocialBettingPage />
            </ProtectedRoute>
          } />
          <Route path="/social-betting" element={
            <ProtectedRoute>
              <SocialBettingPage />
            </ProtectedRoute>
          } />
          
          {/* Bid Alarm */}
          <Route path="/bid-alarm" element={
            <ProtectedRoute>
              <BidAlarmPage />
            </ProtectedRoute>
          } />
          <Route path="/gebot-alarm" element={
            <ProtectedRoute>
              <BidAlarmPage />
            </ProtectedRoute>
          } />
          <Route path="/alarm" element={
            <ProtectedRoute>
              <BidAlarmPage />
            </ProtectedRoute>
          } />
          
          {/* AI Advisor */}
          <Route path="/ai-advisor" element={<AIAdvisorPage />} />
          <Route path="/ki-berater" element={<AIAdvisorPage />} />
          <Route path="/advisor" element={<AIAdvisorPage />} />
          
          {/* Voucher Auctions */}
          <Route path="/voucher-auctions" element={<VoucherAuctionsPage />} />
          <Route path="/gutschein-auktionen" element={<VoucherAuctionsPage />} />
          <Route path="/vouchers" element={<VoucherAuctionsPage />} />
          <Route path="/gutscheine" element={<VoucherAuctionsPage />} />
          
          {/* Merchant Vouchers - Händler-Gutscheine */}
          <Route path="/haendler-gutscheine" element={<MerchantVouchersPage />} />
          <Route path="/haendler-gutscheine/:merchantId" element={<MerchantVouchersPage />} />
          <Route path="/merchant-vouchers" element={<MerchantVouchersPage />} />
          <Route path="/merchant-vouchers/:merchantId" element={<MerchantVouchersPage />} />
          
          {/* Gift Cards */}
          <Route path="/gift-cards" element={
            <ProtectedRoute>
              <GiftCardsPage />
            </ProtectedRoute>
          } />
          <Route path="/geschenkkarten" element={
            <ProtectedRoute>
              <GiftCardsPage />
            </ProtectedRoute>
          } />
          
          {/* Friend Battles (new page) */}
          <Route path="/friend-battles" element={
            <ProtectedRoute>
              <FriendBattlesPage />
            </ProtectedRoute>
          } />
          <Route path="/freunde-battles" element={
            <ProtectedRoute>
              <FriendBattlesPage />
            </ProtectedRoute>
          } />
          
          {/* Team Bidding */}
          <Route path="/team-bidding" element={
            <ProtectedRoute>
              <TeamBiddingPage />
            </ProtectedRoute>
          } />
          <Route path="/team-bieten" element={
            <ProtectedRoute>
              <TeamBiddingPage />
            </ProtectedRoute>
          } />
          <Route path="/teams" element={
            <ProtectedRoute>
              <TeamBiddingPage />
            </ProtectedRoute>
          } />
          
          {/* Restaurant Vouchers - Public */}
          <Route path="/restaurant-gutscheine" element={<RestaurantVouchersPage />} />
          <Route path="/restaurant-vouchers" element={<RestaurantVouchersPage />} />
          <Route path="/restaurants" element={<RestaurantVouchersPage />} />
          <Route path="/restaurant-portal" element={<RestaurantPortal />} />
          <Route path="/discover-restaurants" element={<DiscoverRestaurants />} />
          <Route path="/restaurants/discover" element={<DiscoverRestaurants />} />
          <Route path="/restaurant/:id" element={<RestaurantDetail />} />
            <Route path="/write-review/:id" element={
              <ProtectedRoute>
                <WriteReview />
              </ProtectedRoute>
            } />
          <Route path="/restaurant-loyalty" element={<LoyaltyDashboard />} />
          <Route path="/stempelkarte" element={<LoyaltyDashboard />} />
          
          {/* Customer Loyalty Dashboard - VIP Tiers, Cashback, Referrals */}
          <Route path="/mein-treue-programm" element={
            <ProtectedRoute>
              <CustomerLoyaltyDashboard />
            </ProtectedRoute>
          } />
          <Route path="/my-loyalty" element={
            <ProtectedRoute>
              <CustomerLoyaltyDashboard />
            </ProtectedRoute>
          } />
          
          {/* Ratenzahlung - Meine Pläne */}
          <Route path="/meine-ratenzahlungen" element={
            <ProtectedRoute>
              <MyInstallments />
            </ProtectedRoute>
          } />
          <Route path="/my-installments" element={
            <ProtectedRoute>
              <MyInstallments />
            </ProtectedRoute>
          } />
          
          {/* Mining Dashboard & Market */}
          <Route path="/miner" element={<MinerDashboard />} />
          <Route path="/mining" element={<MinerDashboard />} />
          <Route path="/mining-dashboard" element={<MinerDashboard />} />
          <Route path="/miner-market" element={<MinerMarket />} />
          <Route path="/miner-markt" element={<MinerMarket />} />
          
          {/* Super App Minimal & New Pages */}
          <Route path="/super-app" element={<SuperAppMinimal />} />
          <Route path="/app-home" element={<SuperAppMinimal />} />
          <Route path="/games" element={<GamesHub />} />
          <Route path="/spiele" element={<GamesHub />} />
          <Route path="/app-wallet" element={<AppWallet />} />
          <Route path="/coins" element={<AppWallet />} />
          <Route path="/match3" element={<Match3Game />} />
          <Route path="/spin-wheel" element={<SpinWheel />} />
          <Route path="/gluecksrad" element={<SpinWheel />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      <Footer />
      
      <CookieConsent />
      
      <ScrollToTop />
      
      {/* SupportButton removed - Support accessible via menu */}
      
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.1)',
            color: '#1F2937',
            fontSize: '12px',
            padding: '8px 12px',
            maxWidth: '280px',
          },
          duration: 3000,
        }}
        visibleToasts={3}
        gap={4}
      />
      
      {/* PWA Install Banner */}
      <PWAInstallBanner />
      
      {/* Tawk.to Live Chat Widget */}
      <TawkChat />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              {/* Partner Portal - Completely separate from main app (NEW - supports all business types) */}
              <Route path="/partner-portal/*" element={<PartnerPortalStandalone />} />
              <Route path="/partner/*" element={<PartnerPortalStandalone />} />
              
              {/* Legacy Restaurant Portal - redirect to Partner Portal */}
              <Route path="/restaurant-portal/*" element={<RestaurantPortalStandalone />} />
              
              {/* Main App with Navbar/Footer */}
              <Route path="/*" element={<AppContent />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

// Standalone Restaurant Portal without Navbar/Footer
function RestaurantPortalStandalone() {
  return (
    <>
      <RestaurantPortal />
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.1)',
            color: '#1F2937',
            fontSize: '14px',
            padding: '12px 16px',
          },
          duration: 4000,
        }}
      />
    </>
  );
}

// Standalone Partner Portal without Navbar/Footer (NEW - Multi-Business Types)
function PartnerPortalStandalone() {
  return (
    <>
      <PartnerPortal />
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.1)',
            color: '#1F2937',
            fontSize: '14px',
            padding: '12px 16px',
          },
          duration: 4000,
        }}
      />
    </>
  );
}

export default App;
