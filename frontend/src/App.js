import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { CookieConsent } from "./components/CookieConsent";
import { ScrollToTop } from "./components/ScrollToTop";
import { ScrollToTopOnNavigate } from "./components/ScrollToTopOnNavigate";
import { Toaster } from "./components/ui/sonner";
import HappyHourBanner from "./components/HappyHourBanner";

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
import Leaderboard from "./pages/Leaderboard";
import BeginnerAuctions from "./pages/BeginnerAuctions";
import ReferralDashboard from "./pages/ReferralDashboard";
import FlashEvents from "./pages/FlashEvents";
import WinnerGallery from "./pages/WinnerGallery";
import Subscriptions from "./pages/Subscriptions";
import LoyaltyPage from "./pages/LoyaltyPage";
import FlashSalesPage from "./pages/FlashSalesPage";
import MyStatsPage from "./pages/MyStatsPage";
import LevelsPage from "./pages/LevelsPage";
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
import StreakProtectionPage from "./pages/StreakProtectionPage";
import ExcitementAdminPage from "./pages/ExcitementAdminPage";
import InvestorPortal from "./pages/InvestorPortal";
import PhoneVerification from "./pages/PhoneVerification";
import DealRadarPage from "./pages/DealRadarPage";
import UserStatsPage from "./pages/UserStatsPage";
import LiveWinnerPopup from "./components/LiveWinnerPopup";
import AIBidRecommendationsPage from "./pages/AIBidRecommendationsPage";
import CryptoPaymentPage from "./pages/CryptoPaymentPage";

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
  const { language, mappedLanguage } = useLanguage();
  
  return (
    <div className="App bg-[#050509] min-h-screen flex flex-col">
      {/* Scroll to top on route change */}
      <ScrollToTopOnNavigate />
      
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      {/* Happy Hour Banner */}
      <HappyHourBanner />
      
      {/* Live Winner Popup - Shows real-time win notifications */}
      <LiveWinnerPopup language={mappedLanguage || language} />
      
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
          <Route path="/freunde-werben" element={<ReferralDashboard />} />
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
          
          {/* Investor Portal - Public */}
          <Route path="/investor" element={<InvestorPortal />} />
          <Route path="/investoren" element={<InvestorPortal />} />
          
          {/* Phone Verification */}
          <Route path="/phone-verify" element={<PhoneVerification />} />
          <Route path="/telefon" element={<PhoneVerification />} />
          
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
