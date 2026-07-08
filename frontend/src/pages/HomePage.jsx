import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Bell, ChevronRight, TrendingUp, Shield, Wallet,
  Car, Zap, UtensilsCrossed, Gavel, ArrowUpRight, CreditCard,
  FlaskConical, LogIn, UserPlus, X, Sparkles,
  QrCode, Store, Lock, Globe, Users, BarChart3,
  Cpu, Star, Smartphone, Gift, ShoppingBag, Rocket, Clock, Coins, Medal,
  Eye, EyeOff, Plus, Send
} from "lucide-react";
import { useUser, useWallet, useI18n } from "../store";
import { useWalletStats } from "../hooks";
import { getGreeting } from "../models";
import { useGuestTranslations } from "../models/homeTranslations";
import { tracker } from "../services/tracker";
import LanguageSwitcher from "../components/LanguageSwitcher";
import QuickAccessBar from "../components/QuickAccessBar";
import AdBanner from "../components/AdBanner";
import HomeRecommendations from "../components/HomeRecommendations";
import SmartRecommendations from "../components/SmartRecommendations";
import ModeSwitcher from "../components/ModeSwitcher";
import PremiumLaunchBanner from "../components/PremiumLaunchBanner";
import RecommendAppCard from "../components/RecommendAppCard";
import BirthdayBonusBanner from "../components/BirthdayBonusBanner";
import QuestsWidget from "../components/QuestsWidget";
import SponsoredAdSlot from "../components/SponsoredAdSlot";
import KYCBanner from "../components/KYCBanner";
import { isAdminUser, isKycApprovedOrAdmin } from "../utils/adminAccess";

const slide = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

const iconMap = {
  wallet: Wallet,
  car: Car,
  zap: Zap,
  utensils: UtensilsCrossed,
  gavel: Gavel,
};

// ── Service Card (for authenticated users) ──
const ServiceCard = ({ feature, index, onClick }) => {
  const Icon = iconMap[feature.icon] || Wallet;
  const hasImage = feature.image;
  const isLarge = feature.large;
  const { t } = useI18n();

  return (
    <motion.div
      data-testid={`feature-${feature.id}-card`}
      className={`rounded-2xl relative overflow-hidden cursor-pointer group ${isLarge ? "col-span-2" : ""} ${hasImage ? "min-h-[130px]" : ""}`}
      style={{
        background: hasImage ? undefined : "rgba(255,255,255,0.018)",
        backgroundImage: hasImage
          ? `linear-gradient(to bottom, rgba(8,8,8,0.5), rgba(3,3,3,0.95)), url(${feature.image})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.3 + index * 0.06, ...slide }}
      whileTap={{ scale: 0.97 }}
      whileHover={{ borderColor: `${feature.color}25` }}
      onClick={onClick}
    >
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
        style={{ background: `radial-gradient(circle at 30% 30%, ${feature.color}10, transparent 70%)` }}
      />
      <div className="relative z-10 p-4 flex flex-col h-full">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 relative"
          style={{ background: `${feature.color}10`, border: `1px solid ${feature.color}12` }}
        >
          <Icon size={18} strokeWidth={1.6} style={{ color: feature.color }} />
          <div className="absolute inset-0 rounded-xl opacity-30 pointer-events-none" style={{ background: feature.color, filter: "blur(16px)" }} />
        </div>
        <h3 className="text-[14px] font-semibold font-outfit text-white mb-0.5 tracking-tight">{feature.title}</h3>
        <p className="text-[11px] text-[#444] font-medium">{feature.description}</p>
        {isLarge && (
          <motion.div className="mt-auto pt-3 flex items-center gap-1.5">
            <span className="text-[11px] text-[#00C2FF] font-medium">{feature.linkText || t("home.view_balance") || "View Balance"}</span>
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
              <ArrowUpRight size={12} className="text-[#00C2FF]" />
            </motion.div>
          </motion.div>
        )}
      </div>
      {isLarge && (
        <motion.div
          className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none"
          style={{ background: feature.color, filter: "blur(60px)", opacity: 0.06 }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};

// ── Product Card (for guests) ──
const ProductCard = ({ icon: Icon, title, desc, color, delay, cta, onClick }) => (
  <motion.div
    data-testid={`product-${title.toLowerCase().replace(/\s/g, "-")}`}
    className="rounded-2xl p-4 relative overflow-hidden cursor-pointer group"
    style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, ...slide }}
    whileTap={{ scale: 0.97 }}
    whileHover={{ borderColor: `${color}20` }}
    onClick={onClick}
  >
    <motion.div
      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
      style={{ background: `radial-gradient(circle at 20% 20%, ${color}08, transparent 70%)` }}
    />
    <div className="relative z-10">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 relative"
        style={{ background: `${color}10`, border: `1px solid ${color}15` }}
      >
        <Icon size={18} strokeWidth={1.6} style={{ color }} />
        <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: color, filter: "blur(16px)", opacity: 0.2 }} />
      </div>
      <h3 className="text-[13px] font-semibold font-outfit text-white mb-1 tracking-tight">{title}</h3>
      <p className="text-[11px] text-[#444] font-medium leading-[1.45] mb-3">{desc}</p>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color }}>
        {cta} <ArrowUpRight size={11} />
      </span>
    </div>
  </motion.div>
);

// ── Benefit Pill ──
const BenefitPill = ({ icon: Icon, title, desc, color, delay }) => (
  <motion.div
    className="flex items-center gap-2.5 py-2"
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, ...slide }}
  >
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}0A`, border: `1px solid ${color}12` }}
    >
      <Icon size={14} strokeWidth={1.8} style={{ color }} />
    </div>
    <div className="min-w-0">
      <p className="text-[12px] font-semibold text-white font-outfit">{title}</p>
      <p className="text-[10px] text-[#444] font-medium">{desc}</p>
    </div>
  </motion.div>
);

// ── Trust Badge ──
const TrustBadge = ({ icon: Icon, label, delay }) => (
  <motion.div
    className="flex flex-col items-center gap-1.5 py-2"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, ...slide }}
  >
    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <Icon size={13} strokeWidth={1.5} className="text-[#555]" />
    </div>
    <span className="text-[10px] text-[#444] font-semibold text-center">{label}</span>
  </motion.div>
);

// ── Loyalty Card (for authenticated users on home) ──
const LoyaltyCard = ({ onNavigate, t }) => {
  const [loyalty, setLoyalty] = useState(null);
  const API = process.env.REACT_APP_BACKEND_URL || "";

  useEffect(() => {
    fetch(`${API}/api/loyalty/status`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (data.coins_balance !== undefined) setLoyalty(data); })
      .catch(() => {});
  }, [API]);

  if (!loyalty) return null;

  const LEVEL_COLORS = {
    bronze: "#CD7F32",
    silver: "#C0C0C0",
    gold: "#FFD700",
    platinum: "#E5E4E2",
    vip: "#8B00FF",
  };

  const levelColor = LEVEL_COLORS[loyalty.level] || "#CD7F32";
  const progress = loyalty.progress || {};

  return (
    <motion.div
      data-testid="loyalty-home-card"
      className="rounded-[18px] p-4 mb-6 cursor-pointer group"
      style={{
        background: "linear-gradient(135deg, rgba(84,64,10,0.28) 0%, rgba(26,24,14,0.96) 52%, rgba(16,16,12,0.94) 100%)",
        border: "1px solid rgba(255,215,0,0.16)",
        boxShadow: "0 16px 32px rgba(0,0,0,0.18)",
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, ...slide }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onNavigate("/loyalty")}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.15)" }}>
            <Coins size={16} className="text-[#FFD700]" />
          </div>
          <div>
            <p className="text-[9px] text-white/50 uppercase tracking-wider font-semibold">{t("loyalty.coins") || "Coins & Cashback"}</p>
            <p className="text-[18px] font-bold text-[#FFD700] font-mono">{loyalty.coins_balance?.toLocaleString() || 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full flex items-center gap-1.5"
            style={{ background: `${levelColor}15`, border: `1px solid ${levelColor}30` }}>
            <Medal size={10} style={{ color: levelColor }} />
            <span className="text-[9px] font-bold" style={{ color: levelColor }}>{loyalty.level_name}</span>
          </div>
          <ChevronRight size={14} className="text-white/40 group-hover:text-[#FFD700] transition-colors" />
        </div>
      </div>

      {/* Progress bar */}
      {!progress.is_max_level && (
        <div className="mb-2">
          <div className="w-full h-1.5 rounded-full bg-white/12 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${levelColor}, ${LEVEL_COLORS[progress.next_level] || "#FFD700"})` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress.progress || 0}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] text-white/45">{progress.progress?.toFixed(0) || 0}%</span>
            <span className="text-[8px]" style={{ color: LEVEL_COLORS[progress.next_level] }}>{progress.next_level}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[8px] text-white/45">{t("loyalty.multiplier") || "Multiplier"}</p>
            <p className="text-[11px] font-bold text-[#FFD700]">{loyalty.coin_multiplier}x</p>
          </div>
          <div className="w-px h-6 bg-white/12" />
          <div className="text-center">
            <p className="text-[8px] text-white/45">{t("loyalty.cashback") || "Cashback"}</p>
            <p className="text-[11px] font-bold text-[#00E89D]">€{(loyalty.total_cashback_earned || 0).toFixed(2)}</p>
          </div>
        </div>
        <span className="text-[9px] text-[#FFD700]/85">{t("loyalty.view_details") || "Details ansehen"}</span>
      </div>
    </motion.div>
  );
};

// ── Main Page ──
export const HomePage = ({ onNavigate, isGuest, isDemoMode, onLogin, onRegister, onStartDemo }) => {
  const user = useUser();
  const { balance, currency, cryptoBalanceEur, totalBalanceEur, cryptoBreakdown } = useWallet();
  const { percentageChange } = useWalletStats();
  const { t, lang } = useI18n();
  const gt = useGuestTranslations(lang);
  const isAdmin = isAdminUser(user);
  const isKycVerified = isKycApprovedOrAdmin(user);
  const showKycRestrictedExperience = !isAdmin && !isGuest && !isDemoMode && !isKycVerified;
  
  // Use total balance if available, otherwise fall back to EUR balance
  const displayBalance = totalBalanceEur > 0 ? totalBalanceEur : balance;
  const hasCrypto = cryptoBalanceEur > 0;

  const [hintDismissed, setHintDismissed] = useState(() => {
    try { return localStorage.getItem("bb_hint_dismissed") === "1"; } catch { return false; }
  });

  const [previewFeature, setPreviewFeature] = useState(null);

  // Banking-app feel: allow user to hide balance (persists in localStorage)
  const [balanceHidden, setBalanceHidden] = useState(() => {
    try { return localStorage.getItem("bb_balance_hidden") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("bb_balance_hidden", balanceHidden ? "1" : "0"); } catch { /* ignore */ }
  }, [balanceHidden]);

  // Track guest visit (once per session)
  useState(() => { if (isGuest) tracker.guestVisit(); });

  // Request location permission early on first login (triggers browser dialog)
  useEffect(() => {
    if (!isGuest && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 5000 });
    }
  }, [isGuest]);

  const dismissHint = () => {
    setHintDismissed(true);
    try { localStorage.setItem("bb_hint_dismissed", "1"); } catch (_err) { return; }
  };

  const handleServiceClick = (featureId) => {
    tracker.featureClick(featureId);
    if (isGuest) { onRegister(); return; }
    const routeMap = {
      wallet: "/wallet", auctions: "/auctions", mining: "/mining",
      merchant: "/merchant-landing", nfc: "/nfc", vip: "/vip",
      referral: "/referral", marketplace: "/marketplace", rewards: "/rewards", commerce: "/commerce-center", mobilityCenter: "/mobility-center",
    };
    if (routeMap[featureId]) { onNavigate(routeMap[featureId]); }
  };

  const availableFeatures = [
    { id: "wallet", icon: Wallet, title: t("home.f_wallet") || "Wallet", desc: t("home.f_wallet_d") || "Manage your money", color: "#00C2FF", route: "/wallet", large: true },
    { id: "auctions", icon: Gavel, title: t("home.f_auctions") || "Auctions", desc: t("home.f_auctions_d") || "Bid & win deals", color: "#A855F7", route: "/auctions" },
    { id: "mining", icon: Cpu, title: t("home.f_mining") || "Mining", desc: t("home.f_mining_d") || "Mine BLZ tokens", color: "#00E89D", route: "/mining" },
    { id: "merchant", icon: Store, title: t("home.f_merchant") || "Merchant", desc: t("home.f_merchant_d") || "POS & payments", color: "#FFB800", route: "/merchant-landing" },
  ];

  // ALL ACTIVE - No more "Coming Soon"
  const extraFeatures = [
    { id: "nfc", icon: Smartphone, title: t("home.f_nfc") || "NFC Pay", desc: t("home.f_nfc_d") || "Tap to pay contactless", color: "#00C2FF", route: "/nfc" },
    { id: "vip", icon: Star, title: t("home.f_vip") || "VIP", desc: t("home.f_vip_d") || "Premium subscriptions", color: "#FFD700", route: "/vip" },
    { id: "referral", icon: Gift, title: t("home.f_referral") || "Referrals", desc: t("home.f_referral_d") || "Invite friends, earn rewards", color: "#00E89D", route: "/referral" },
    { id: "commerce", icon: Sparkles, title: t("home.commerce_center") || "Commerce Center", desc: t("home.commerce_center_desc") || "Flash Sales, Live Shopping, Marketplace", color: "#FF7A18", route: "/commerce-center" },
    { id: "mobilityCenter", icon: Car, title: t("home.mobility_center") || "Mobility Center", desc: t("home.mobility_center_desc") || "Taxi, Scooter, EV und Tracking", color: "#00C2FF", route: "/mobility-center" },
    { id: "marketplace", icon: ShoppingBag, title: t("home.f_marketplace") || "Marketplace", desc: t("home.f_marketplace_d") || "Buy & sell items", color: "#FF6B6B", route: "/marketplace" },
    { id: "rewards", icon: Sparkles, title: t("home.f_rewards_more") || "Rewards", desc: t("home.f_rewards_more_d") || "Daily rewards & streaks", color: "#A855F7", route: "/rewards" },
  ];

  return (
    <motion.div
      data-testid="home-page"
      className="min-h-screen relative"
      style={{ background: "#030303", overflowX: "hidden", maxWidth: "100vw" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[80vw] max-w-[500px] h-[80vw] max-h-[500px] rounded-full" style={{ filter: "blur(140px)", background: "rgba(0,194,255,0.04)" }} />
      </div>

      <div className="px-4 sm:px-5 lg:px-8 pb-8 lg:pb-12 relative z-10 max-w-7xl mx-auto" style={{ maxWidth: "100vw" }}>

        {/* ── Header ── */}
        <motion.header
          className="flex items-center justify-between pt-[max(env(safe-area-inset-top,0px),24px)] pb-5"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, ...slide }}
        >
          <div className="flex items-center gap-3">
            <motion.div className="relative" whileTap={{ scale: 0.95 }}>
              <img src={user.avatar} alt="Profile" data-testid="user-avatar" className="w-11 h-11 rounded-full object-cover" style={{ border: "2px solid rgba(0,194,255,0.2)", boxShadow: "0 0 16px rgba(0,194,255,0.12)" }} />
              {!isGuest && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full" style={{ background: "#00D26A", border: "2px solid #030303", boxShadow: "0 0 6px rgba(0,210,106,0.5)" }} />}
            </motion.div>
            <div>
              <p className="text-[10px] text-[#3A3A3A] font-semibold tracking-[0.1em] uppercase">{getGreeting()}</p>
              <h2 className="text-[16px] text-white font-semibold font-outfit tracking-tight">{isGuest ? "BidBlitz" : user.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeSwitcher onModeChange={(mode) => {
              if (mode === "kids") onNavigate("/kids");
              else if (mode === "merchant") onNavigate("/merchant-portal");
              else onNavigate("/");
            }} />
            <LanguageSwitcher />
            {isGuest ? (
              <div className="flex items-center gap-1.5">
                <motion.button data-testid="header-login-btn" className="px-3.5 py-[7px] rounded-full text-[11px] font-semibold font-outfit" style={{ color: "#00C2FF" }} whileTap={{ scale: 0.92 }} onClick={onLogin}>
                  {t("auth.signin") || "Login"}
                </motion.button>
                <motion.button data-testid="header-register-btn" className="px-3.5 py-[7px] rounded-full text-[11px] font-semibold font-outfit" style={{ background: "rgba(0,194,255,0.1)", border: "1px solid rgba(0,194,255,0.2)", color: "#00C2FF" }} whileTap={{ scale: 0.92 }} onClick={onRegister}>
                  {t("auth.create") || "Register"}
                </motion.button>
              </div>
            ) : (
              <motion.button data-testid="notification-btn" className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center relative" whileTap={{ scale: 0.88 }} onClick={() => onNavigate("/notifications")}>
                <Bell size={15} strokeWidth={1.5} className="text-white/50" />
                <motion.span className="absolute top-2.5 right-2.5 w-[6px] h-[6px] bg-[#00C2FF] rounded-full" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ boxShadow: "0 0 6px rgba(0,194,255,0.8)" }} />
              </motion.button>
            )}
          </div>
        </motion.header>

        {/* ── Onboarding Hint (guest, dismissible, show once) ── */}
        <AnimatePresence>
          {isGuest && !hintDismissed && !isDemoMode && (
            <motion.div
              data-testid="onboarding-hint"
              className="rounded-[16px] px-4 py-3 mb-4 flex items-start gap-3 relative overflow-hidden"
              style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.08)" }}
              initial={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto", marginBottom: 16 }}
              exit={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.12)" }}>
                <Sparkles size={14} className="text-[#00C2FF]" />
              </div>
              <p className="text-[12px] text-[#888] font-medium leading-[1.5] flex-1 pt-1">{t("onboarding.hint")}</p>
              <motion.button data-testid="onboarding-hint-dismiss" className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(255,255,255,0.03)" }} whileTap={{ scale: 0.85 }} onClick={dismissHint}>
                <X size={11} className="text-[#444]" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tagline (nur für Gäste — angemeldete User sehen sofort den Wallet) ── */}
        {isGuest && (
          <motion.div className="mb-6 lg:mb-8 lg:max-w-3xl" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ...slide }}>
            <h2 className="text-[20px] sm:text-[22px] lg:text-[40px] font-outfit font-bold text-white leading-[1.15] tracking-tight mb-1.5 break-words text-left">
              {t("home.tagline_1")}{" "}
              <span className="text-[#00C2FF]">{t("home.tagline_2")}</span>,{" "}
              <span className="text-[#00C2FF]">{t("home.tagline_3")}</span> {t("home.tagline_more")}
            </h2>
            <p className="text-[12px] lg:text-[14px] text-[#333] font-medium max-w-2xl">{t("home.subtitle")}</p>
          </motion.div>
        )}

        {/* ── BANKING-APP TOP: Wallet + Quick Actions (auth users only) ── */}
        {!isGuest && !showKycRestrictedExperience && (
          <>
            {/* Hero Balance Card */}
            <motion.div
              data-testid="hero-balance-card"
              className="rounded-[22px] p-5 mb-3 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(20,28,36,0.96) 0%, rgba(15,21,28,0.94) 52%, rgba(10,54,64,0.82) 100%)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 18px 36px rgba(0,0,0,0.24)", backdropFilter: "blur(24px)" }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, ...slide }}
            >
              <motion.div className="absolute -top-16 -right-16 w-44 h-44 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(0,194,255,0.22) 0%, transparent 72%)" }} animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.18] to-transparent pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Shield size={10} className="text-[#00C2FF]/50" />
                    <p className="text-[10px] text-white/55 font-semibold tracking-[0.12em] uppercase">{t("home.balance")}</p>
                  </div>
                  <motion.button
                    data-testid="balance-toggle-visibility"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setBalanceHidden(v => !v)}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {balanceHidden ? <EyeOff size={12} className="text-white/65" /> : <Eye size={12} className="text-white/65" />}
                  </motion.button>
                </div>
                <motion.div className="flex items-baseline gap-1.5 mb-3 min-w-0 overflow-hidden" initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.2, duration: 0.3 }}>
                  <span className="text-[18px] sm:text-[24px] text-white/55 font-outfit font-light flex-shrink-0">{currency}</span>
                  <span className="font-bold font-outfit text-[#F8FAFC] tracking-[-0.03em] leading-none truncate min-w-0 flex-1" style={{ fontSize: "clamp(28px, 9.2vw, 52px)", textShadow: "0 6px 24px rgba(0,0,0,0.24)" }}>
                    {balanceHidden ? "••••••" : displayBalance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                  </span>
                </motion.div>

                {hasCrypto && !balanceHidden && (
                  <motion.div className="flex flex-col gap-1 mb-2 pb-2 border-b border-white/[0.08]" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ delay: 0.3 }}>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-white/55">EUR Wallet</span>
                      <span className="text-white/75 font-mono">€{balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-white/55">Crypto ({cryptoBreakdown.length} Coins)</span>
                      <span className="text-[#00C2FF] font-mono">€{cryptoBalanceEur.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </motion.div>
                )}

                <motion.div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(0,210,106,0.12)", border: "1px solid rgba(0,210,106,0.18)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  <TrendingUp size={10} className="text-[#00D26A]" />
                  <span className="text-[10px] text-[#00D26A] font-semibold">+{percentageChange}% {t("home.month")}</span>
                </motion.div>
              </div>
            </motion.div>

            {/* Quick Actions Row */}
            <motion.div
              data-testid="home-quick-actions"
              className="grid grid-cols-4 gap-2 mb-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, ...slide }}
            >
              {[
                { id: "topup", icon: Plus, label: t("wallet.add") || "Aufladen", color: "#00C2FF", onClick: () => onNavigate("/wallet?action=topup") },
                { id: "send", icon: Send, label: t("wallet.send") || "Senden", color: "#00D26A", onClick: () => onNavigate("/wallet?action=send") },
                { id: "scan", icon: QrCode, label: t("nav.scan") || "Scannen", color: "#A855F7", onClick: () => onNavigate("/scan") },
                { id: "cards", icon: CreditCard, label: t("cards.title") || "Karten", color: "#FFB800", onClick: () => onNavigate("/card") },
              ].map((a, i) => (
                <motion.button
                  key={a.id}
                  data-testid={`quick-action-${a.id}`}
                  onClick={a.onClick}
                  whileTap={{ scale: 0.93 }}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.04 }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${a.color}10`, border: `1px solid ${a.color}20` }}>
                    <a.icon size={15} strokeWidth={1.8} style={{ color: a.color }} />
                  </div>
                  <span className="text-[10px] font-semibold text-white/92 font-outfit">{a.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}

        {/* ── KYC Verifizierungs-Banner (kompakt, nur für eingeloggte unverifizierte User) ── */}
        {!isGuest && <KYCBanner onNavigate={onNavigate} />}

        {/* ── Marketing-Widgets (gäste oben; auth-User kompakt nach Wallet-Block) ── */}
        {isGuest && (
          <>
            <BirthdayBonusBanner isGuest={isGuest} />
            <QuestsWidget isGuest={isGuest} onNavigate={onNavigate} />
            <SponsoredAdSlot onNavigate={onNavigate} />
            <PremiumLaunchBanner isGuest={isGuest} onNavigate={onNavigate} />
            <RecommendAppCard isGuest={isGuest} onNavigate={onNavigate} />
          </>
        )}

        {/* ── CTA Buttons (Gäste sehen Login/Register; eingeloggte User haben oben Quick-Actions) ── */}
        {isGuest ? (
          <div className="mb-7 lg:mb-8 lg:max-w-xl">
            <motion.button data-testid="cta-register-btn" className="w-full py-[13px] rounded-[14px] bg-[#00C2FF] text-[#020202] font-semibold text-[13px] flex items-center justify-center gap-2 mb-2.5 relative overflow-hidden" style={{ boxShadow: "0 6px 36px rgba(0,194,255,0.3), 0 2px 10px rgba(0,194,255,0.15)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, ...slide }} whileTap={{ scale: 0.96 }} onClick={onRegister}>
              <UserPlus size={15} strokeWidth={2} />
              {t("auth.create") || "Create Account"}
              <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}><ChevronRight size={16} strokeWidth={2.5} /></motion.div>
            </motion.button>
            <div className="flex gap-2.5 lg:grid lg:grid-cols-2">
              <motion.button data-testid="cta-login-btn" className="flex-1 py-[12px] rounded-[14px] font-semibold text-[13px] flex items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#fff" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, ...slide }} whileTap={{ scale: 0.96 }} onClick={onLogin}>
                <LogIn size={14} strokeWidth={2} />{t("auth.signin") || "Login"}
              </motion.button>
            </div>
          </div>
        ) : null}

        {/* ═══════════ GUEST SECTIONS ═══════════ */}
        {isGuest && (
          <div className="lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,400px)] xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,420px)] lg:gap-6 xl:gap-8 items-start">
            <div>
            {/* ── Key Products ── */}
            <motion.section
              data-testid="guest-products"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-7"
            >
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-[13px] font-semibold font-outfit text-white">{gt("gp.products_title")}</h3>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 lg:gap-3">
                <ProductCard icon={Wallet} title={gt("gp.wallet_title")} desc={gt("gp.wallet_desc")} color="#00C2FF" delay={0.32} cta={gt("gp.use_now")} onClick={() => { tracker.featureClick("wallet"); onRegister(); }} />
                <ProductCard icon={QrCode} title={gt("gp.qr_title")} desc={gt("gp.qr_desc")} color="#00D26A" delay={0.36} cta={gt("gp.use_now")} onClick={() => { tracker.featureClick("qr"); onRegister(); }} />
                <ProductCard icon={Store} title={gt("gp.merchant_title")} desc={gt("gp.merchant_desc")} color="#FFB800" delay={0.4} cta={gt("gp.use_now")} onClick={() => { tracker.featureClick("merchant"); onRegister(); }} />
                <ProductCard icon={TrendingUp} title={gt("gp.mining_title")} desc={gt("gp.mining_desc")} color="#A855F7" delay={0.44} cta={gt("gp.use_now")} onClick={() => { tracker.featureClick("mining"); onRegister(); }} />
              </div>
            </motion.section>
            </div>

            <div className="lg:sticky lg:top-6">

            {/* ── Benefits ── */}
            <motion.section
              data-testid="guest-benefits"
              className="mb-4 lg:mb-5 rounded-2xl p-4 lg:p-5"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.48, ...slide }}
            >
              <p className="text-[9px] text-white/65 uppercase tracking-[0.14em] font-semibold mb-1 pl-0.5">{gt("gp.benefits_title")}</p>
              <BenefitPill icon={Zap} title={gt("gp.benefit_instant")} desc={gt("gp.benefit_instant_d")} color="#00C2FF" delay={0.52} />
              <div className="h-px bg-white/[0.03]" />
              <BenefitPill icon={BarChart3} title={gt("gp.benefit_fees")} desc={gt("gp.benefit_fees_d")} color="#00D26A" delay={0.56} />
              <div className="h-px bg-white/[0.03]" />
              <BenefitPill icon={Lock} title={gt("gp.benefit_secure")} desc={gt("gp.benefit_secure_d")} color="#FFB800" delay={0.6} />
            </motion.section>

            {/* ── Trust Section ── */}
            <motion.section
              data-testid="guest-trust"
              className="mb-4 lg:mb-5 rounded-2xl p-4 lg:p-5"
              style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.64, ...slide }}
            >
              <div className="grid grid-cols-3 gap-2 lg:gap-3">
                <TrustBadge icon={Users} label={gt("gp.trust_users")} delay={0.66} />
                <TrustBadge icon={Shield} label={gt("gp.trust_encrypted")} delay={0.7} />
                <TrustBadge icon={Globe} label={gt("gp.trust_languages")} delay={0.74} />
              </div>
            </motion.section>

            {/* ── Bottom CTA ── */}
            <motion.div
              data-testid="guest-bottom-cta"
              className="rounded-2xl p-4 lg:p-5 relative overflow-hidden cursor-pointer group"
              style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.08)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.78, ...slide }}
              whileTap={{ scale: 0.98 }}
              onClick={onRegister}
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none" style={{ background: "rgba(0,194,255,0.12)", filter: "blur(30px)" }} />
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.12)", boxShadow: "0 0 16px rgba(0,194,255,0.08)" }}>
                  <CreditCard size={18} strokeWidth={1.5} className="text-[#00C2FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] lg:text-[14px] font-semibold text-white font-outfit mb-0.5">{t("home.wallet_banner") || "Everything runs through BidBlitz Wallet"}</h4>
                  <p className="text-[11px] text-white/65 font-medium">{t("home.wallet_sub") || "One wallet for all your payments"}</p>
                </div>
                <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex-shrink-0">
                  <ChevronRight size={16} className="text-[#00C2FF]/60" />
                </motion.div>
              </div>
            </motion.div>
            </div>
          </div>
        )}

        {/* ═══════════ AUTHENTICATED SECTIONS ═══════════ */}
        {!isGuest && !showKycRestrictedExperience && (
          <>
            {/* (Hero Balance Card now rendered at the very top — banking-app feel) */}

            {/* ═══ Loyalty & Coins Card ═══ */}
            <LoyaltyCard onNavigate={onNavigate} t={t} />

            {/* ═══ Quick Access Shortcuts ═══ */}
            <QuickAccessBar onNavigate={onNavigate} />

            {/* ═══ Compact Marketing-Widgets (nach den Hauptaktionen) ═══ */}
            <QuestsWidget isGuest={isGuest} onNavigate={onNavigate} />
            <BirthdayBonusBanner isGuest={isGuest} />
            <SponsoredAdSlot onNavigate={onNavigate} />
            <PremiumLaunchBanner isGuest={isGuest} onNavigate={onNavigate} />
            <RecommendAppCard isGuest={isGuest} onNavigate={onNavigate} />

            {/* ═══ Alle Services Banner ═══ */}
            <motion.button
              onClick={() => onNavigate("/all-services")}
              className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
              style={{ background: "linear-gradient(135deg, rgba(0,194,255,0.14), rgba(16,185,129,0.12))", border: "1px solid rgba(0,194,255,0.18)" }}
              whileTap={{ scale: 0.98 }}
              data-testid="all-services-btn"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(0,194,255,0.15)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-white">{t("home.all_services_discover") || "Alle Services entdecken"}</div>
                <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.72)" }}>{t("home.all_services_desc") || "60+ Features in einer App"}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.56)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </motion.button>

            {/* ═══ Sponsored Banners ═══ */}
            <AdBanner onNavigate={onNavigate} />

            {/* ═══ AI Smart Recommendations (gpt-5.2) ═══ */}
            {!isGuest && (
              <div className="overflow-hidden">
                <SmartRecommendations onNavigate={onNavigate} />
              </div>
            )}

            {/* ═══ Recommendations ═══ */}
            <div className="overflow-hidden">
              <HomeRecommendations onNavigate={onNavigate} />
            </div>

            {/* ═══ Available Now ═══ */}
            <motion.section data-testid="available-now-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.26 }}>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full bg-[#00E89D]" />
                  <h3 className="text-[13px] font-semibold font-outfit text-white">{t("home.available_now") || "Available Now"}</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {availableFeatures.map((f, i) => (
                  <motion.div key={f.id} data-testid={`feature-${f.id}-card`}
                    className={`rounded-2xl relative overflow-hidden cursor-pointer group ${f.large ? "col-span-2" : ""}`}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.06, ...slide }}
                    whileTap={{ scale: 0.97 }} whileHover={{ borderColor: `${f.color}25` }}
                    onClick={() => { if (isGuest) onRegister(); else onNavigate(f.route); }}>
                    <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                      style={{ background: `radial-gradient(circle at 30% 30%, ${f.color}10, transparent 70%)` }} />
                    <div className="relative z-10 p-4 flex flex-col h-full">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 relative"
                        style={{ background: `${f.color}10`, border: `1px solid ${f.color}12` }}>
                        <f.icon size={18} strokeWidth={1.6} style={{ color: f.color }} />
                        <div className="absolute inset-0 rounded-xl opacity-30 pointer-events-none" style={{ background: f.color, filter: "blur(16px)" }} />
                      </div>
                      <h3 className="text-[14px] font-semibold font-outfit text-white mb-0.5 tracking-tight">{f.title}</h3>
                      <p className="text-[11px] text-white/64 font-medium">{f.desc}</p>
                      {f.large && (
                        <motion.div className="mt-auto pt-3 flex items-center gap-1.5">
                          <span className="text-[11px] font-medium" style={{ color: f.color }}>{t("home.view_balance") || "View Balance"}</span>
                          <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
                            <ArrowUpRight size={12} style={{ color: f.color }} />
                          </motion.div>
                        </motion.div>
                      )}
                    </div>
                    {f.large && (
                      <motion.div className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none"
                        style={{ background: f.color, filter: "blur(60px)", opacity: 0.06 }}
                        animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.08, 0.04] }}
                        transition={{ duration: 4, repeat: Infinity }} />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.section>

            {/* ═══ Extra Features - ALL ACTIVE ═══ */}
            <motion.section data-testid="extra-features-section" className="mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full bg-[#A855F7]" />
                  <h3 className="text-[13px] font-semibold font-outfit text-white">{t("home.extra_features") || "Weitere Features"}</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(0,226,157,0.08)", color: "#00E89D", border: "1px solid rgba(0,226,157,0.2)" }}>
                  <Sparkles size={10} /> {t("common.active") || "AKTIV"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {extraFeatures.map((f, i) => (
                  <motion.div key={f.id} data-testid={`extra-${f.id}-card`}
                    className="rounded-2xl relative overflow-hidden cursor-pointer group"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 + i * 0.04, ...slide }}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ borderColor: `${f.color}25` }}
                    onClick={() => onNavigate(f.route)}>
                    <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                      style={{ background: `radial-gradient(circle at 30% 30%, ${f.color}10, transparent 70%)` }} />
                    <div className="relative z-10 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center relative"
                          style={{ background: `${f.color}12`, border: `1px solid ${f.color}15` }}>
                          <f.icon size={18} strokeWidth={1.5} style={{ color: f.color }} />
                          <div className="absolute inset-0 rounded-xl opacity-30 pointer-events-none" style={{ background: f.color, filter: "blur(12px)" }} />
                        </div>
                      </div>
                      <h3 className="text-[13px] font-semibold font-outfit text-white mb-1">{f.title}</h3>
                      <p className="text-[11px] text-[#444]">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            {/* Wallet Banner */}
            <motion.div
              data-testid="wallet-banner"
              className="mt-6 rounded-2xl p-4 relative overflow-hidden cursor-pointer group"
              style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.08)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, ...slide }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate("/wallet")}
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none" style={{ background: "rgba(0,194,255,0.12)", filter: "blur(30px)" }} />
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.12)", boxShadow: "0 0 16px rgba(0,194,255,0.08)" }}>
                  <CreditCard size={18} strokeWidth={1.5} className="text-[#00C2FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-semibold text-white font-outfit mb-0.5">{t("home.wallet_banner") || "Everything runs through BidBlitz Wallet"}</h4>
                  <p className="text-[11px] text-[#444] font-medium">{t("home.wallet_sub") || "One wallet for all your payments"}</p>
                </div>
                <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex-shrink-0">
                  <ChevronRight size={16} className="text-[#00C2FF]/60" />
                </motion.div>
              </div>
            </motion.div>

            {/* Auctions Banner */}
            <motion.div
              data-testid="auctions-banner"
              className="mt-3 rounded-2xl p-4 relative overflow-hidden cursor-pointer group"
              style={{ background: "rgba(168,85,247,0.03)", border: "1px solid rgba(168,85,247,0.08)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, ...slide }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate("/auctions")}
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none" style={{ background: "rgba(168,85,247,0.12)", filter: "blur(30px)" }} />
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.12)", boxShadow: "0 0 16px rgba(168,85,247,0.08)" }}>
                  <Gavel size={18} strokeWidth={1.5} className="text-[#A855F7]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-semibold text-white font-outfit mb-0.5">{t("auction.title")}</h4>
                  <p className="text-[11px] text-[#444] font-medium">{t("auction.subtitle")}</p>
                </div>
                <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex-shrink-0">
                  <ChevronRight size={16} className="text-[#A855F7]/60" />
                </motion.div>
              </div>
            </motion.div>
          </>
        )}

        {!isGuest && showKycRestrictedExperience && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-[26px] border border-amber-400/15 bg-[linear-gradient(145deg,rgba(30,22,10,0.96),rgba(17,24,39,0.98))] p-5"
            data-testid="pre-kyc-home-gate"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/10">
                <Shield size={18} className="text-amber-300" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200/75">Vor Verifizierung</p>
                <h3 className="mt-2 text-xl font-black text-white">Zugriff bewusst reduziert</h3>
                <p className="mt-2 max-w-xl text-sm text-slate-300">
                  Vor der Identitätsprüfung zeigen wir nur die sicheren Grundbereiche. Wallet, Auktionen, Marketplace und weitere Finanzfunktionen werden erst nach KYC freigeschaltet.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-300">
                  <span className="rounded-full bg-white/5 px-3 py-1">Profil</span>
                  <span className="rounded-full bg-white/5 px-3 py-1">KYC Starten</span>
                  <span className="rounded-full bg-white/5 px-3 py-1">Support</span>
                  <span className="rounded-full bg-white/5 px-3 py-1">Status prüfen</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => onNavigate("/kyc")}
                    className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950"
                    data-testid="pre-kyc-home-start-button"
                  >
                    Identität verifizieren
                  </button>
                  <button
                    onClick={() => onNavigate("/more")}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white"
                    data-testid="pre-kyc-home-open-more-button"
                  >
                    Erlaubte Bereiche öffnen
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

      </div>
    </motion.div>
  );
};

export default HomePage;
