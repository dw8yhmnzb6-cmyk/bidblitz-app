import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bell, ChevronRight, TrendingUp, Shield, Wallet,
  Car, Zap, UtensilsCrossed, Gavel, ArrowUpRight, CreditCard, FlaskConical, LogIn, UserPlus
} from "lucide-react";
import { useUser, useWallet, useI18n } from "../store";
import { useWalletStats } from "../hooks";
import { getGreeting } from "../models";
import { features } from "../models/initialData";
import LanguageSwitcher from "../components/LanguageSwitcher";

const slide = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

const iconMap = {
  wallet: Wallet,
  car: Car,
  zap: Zap,
  utensils: UtensilsCrossed,
  gavel: Gavel,
};

// ── Service Card ──
const ServiceCard = ({ feature, index, onClick }) => {
  const Icon = iconMap[feature.icon] || Wallet;
  const hasImage = feature.image;
  const isLarge = feature.large;

  return (
    <motion.div
      data-testid={`feature-${feature.id}-card`}
      className={`rounded-2xl relative overflow-hidden cursor-pointer group ${isLarge ? "col-span-2" : ""} ${hasImage ? "min-h-[130px]" : ""}`}
      style={{
        background: hasImage
          ? undefined
          : "rgba(255,255,255,0.018)",
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
      {/* Hover glow */}
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
          <div
            className="absolute inset-0 rounded-xl opacity-30 pointer-events-none"
            style={{ background: feature.color, filter: "blur(16px)" }}
          />
        </div>
        <h3 className="text-[14px] font-semibold font-outfit text-white mb-0.5 tracking-tight">
          {feature.title}
        </h3>
        <p className="text-[11px] text-[#444] font-medium">{feature.description}</p>

        {isLarge && (
          <motion.div className="mt-auto pt-3 flex items-center gap-1.5">
            <span className="text-[11px] text-[#00C2FF] font-medium">{feature.linkText || "View Balance"}</span>
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <ArrowUpRight size={12} className="text-[#00C2FF]" />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Large card accent */}
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

// ── Main Page ──
export const HomePage = ({ onNavigate, isGuest, isDemoMode, onLogin, onRegister, onStartDemo }) => {
  const user = useUser();
  const { balance, currency } = useWallet();
  const { percentageChange } = useWalletStats();
  const { t } = useI18n();

  const handleServiceClick = (featureId) => {
    if (isGuest) {
      onRegister();
      return;
    }
    if (featureId === "wallet") {
      onNavigate("/wallet");
    } else {
      toast(t("home.coming_soon") || "Coming Soon", {
        description: t("home.coming_soon_hint") || "This feature is coming soon!",
        duration: 2000,
      });
    }
  };

  return (
    <motion.div
      data-testid="home-page"
      className="min-h-screen relative overflow-hidden"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ filter: "blur(140px)", background: "rgba(0,194,255,0.04)" }}
      />

      <div className="px-5 pb-8 relative z-10">

        {/* ── Header / Greeting ── */}
        <motion.header
          className="flex items-center justify-between pt-[max(env(safe-area-inset-top,0px),24px)] pb-5"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, ...slide }}
        >
          <div className="flex items-center gap-3">
            <motion.div className="relative" whileTap={{ scale: 0.95 }}>
              <img
                src={user.avatar}
                alt="Profile"
                data-testid="user-avatar"
                className="w-11 h-11 rounded-full object-cover"
                style={{
                  border: "2px solid rgba(0,194,255,0.2)",
                  boxShadow: "0 0 16px rgba(0,194,255,0.12)",
                }}
              />
              {!isGuest && (
                <div
                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full"
                  style={{
                    background: "#00D26A",
                    border: "2px solid #030303",
                    boxShadow: "0 0 6px rgba(0,210,106,0.5)",
                  }}
                />
              )}
            </motion.div>
            <div>
              <p className="text-[10px] text-[#3A3A3A] font-semibold tracking-[0.1em] uppercase">{getGreeting()}</p>
              <h2 className="text-[16px] text-white font-semibold font-outfit tracking-tight">
                {isGuest ? "BidBlitz" : user.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {isGuest ? (
              <div className="flex items-center gap-1.5">
                <motion.button
                  data-testid="header-login-btn"
                  className="px-3.5 py-[7px] rounded-full text-[11px] font-semibold font-outfit"
                  style={{ color: "#00C2FF" }}
                  whileTap={{ scale: 0.92 }}
                  onClick={onLogin}
                >
                  {t("auth.signin") || "Login"}
                </motion.button>
                <motion.button
                  data-testid="header-register-btn"
                  className="px-3.5 py-[7px] rounded-full text-[11px] font-semibold font-outfit"
                  style={{ background: "rgba(0,194,255,0.1)", border: "1px solid rgba(0,194,255,0.2)", color: "#00C2FF" }}
                  whileTap={{ scale: 0.92 }}
                  onClick={onRegister}
                >
                  {t("auth.create") || "Register"}
                </motion.button>
              </div>
            ) : (
              <motion.button
                data-testid="notification-btn"
                className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center relative"
                whileTap={{ scale: 0.88 }}
                onClick={() => onNavigate("/notifications")}
              >
                <Bell size={15} strokeWidth={1.5} className="text-white/50" />
                <motion.span
                  className="absolute top-2.5 right-2.5 w-[6px] h-[6px] bg-[#00C2FF] rounded-full"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ boxShadow: "0 0 6px rgba(0,194,255,0.8)" }}
                />
              </motion.button>
            )}
          </div>
        </motion.header>

        {/* ── Hero Balance Card ── */}
        <motion.div
          data-testid="hero-balance-card"
          className="rounded-[22px] p-5 mb-6 relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(24px)",
          }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, ...slide }}
        >
          {/* Animated corner glow */}
          <motion.div
            className="absolute -top-16 -right-16 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,194,255,0.15) 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full pointer-events-none"
            style={{ background: "rgba(255,255,255,0.02)", filter: "blur(30px)" }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          />
          {/* Top shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Shield size={10} className="text-[#00C2FF]/50" />
              <p className="text-[10px] text-[#3A3A3A] font-semibold tracking-[0.12em] uppercase">{t("home.balance")}</p>
            </div>

            {isGuest ? (
              <>
                <motion.div
                  className="flex items-baseline gap-1 mb-3"
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <span className="text-[22px] text-[#2A2A2A] font-outfit font-light">EUR</span>
                  <span className="text-[42px] font-bold font-outfit text-white/20 tracking-[-0.03em] leading-none">
                    &#8226;&#8226;&#8226;,&#8226;&#8226;
                  </span>
                </motion.div>
                <motion.button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
                  style={{ background: "rgba(0,194,255,0.08)", border: "1px solid rgba(0,194,255,0.15)", color: "#00C2FF" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onLogin}
                >
                  {t("auth.signin") || "Sign in to see your balance"}
                </motion.button>
              </>
            ) : (
              <>
                <motion.div
                  className="flex items-baseline gap-1 mb-3"
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <span className="text-[22px] text-[#2A2A2A] font-outfit font-light">{currency}</span>
                  <span className="text-[42px] font-bold font-outfit text-white tracking-[-0.03em] leading-none">
                    {balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                  </span>
                </motion.div>

                <motion.div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(0,210,106,0.06)", border: "1px solid rgba(0,210,106,0.12)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  <TrendingUp size={10} className="text-[#00D26A]" />
                  <span className="text-[10px] text-[#00D26A] font-semibold">
                    +{percentageChange}% {t("home.month")}
                  </span>
                </motion.div>
              </>
            )}
          </div>
        </motion.div>

        {/* ── Tagline ── */}
        <motion.div
          className="mb-5"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, ...slide }}
        >
          <h2 className="text-[22px] font-outfit font-bold text-white leading-[1.2] tracking-tight mb-1.5">
            {t("home.tagline_1")}{" "}
            <span className="text-[#00C2FF]">{t("home.tagline_2")}</span>,{" "}
            <span className="text-[#00C2FF]">{t("home.tagline_3")}</span> {t("home.tagline_more")}
          </h2>
          <p className="text-[12px] text-[#333] font-medium">{t("home.subtitle")}</p>
        </motion.div>

        {/* ── CTA Buttons ── */}
        {isGuest ? (
          <div className="mb-7">
            {/* Register - Primary */}
            <motion.button
              data-testid="cta-register-btn"
              className="w-full py-[13px] rounded-[14px] bg-[#00C2FF] text-[#020202] font-semibold text-[13px] flex items-center justify-center gap-2 mb-2.5 relative overflow-hidden"
              style={{ boxShadow: "0 6px 36px rgba(0,194,255,0.3), 0 2px 10px rgba(0,194,255,0.15)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...slide }}
              whileTap={{ scale: 0.96 }}
              onClick={onRegister}
            >
              <UserPlus size={15} strokeWidth={2} />
              {t("auth.create") || "Create Account"}
              <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <ChevronRight size={16} strokeWidth={2.5} />
              </motion.div>
            </motion.button>

            {/* Login + Try Demo - Secondary row */}
            <div className="flex gap-2.5">
              <motion.button
                data-testid="cta-login-btn"
                className="flex-1 py-[12px] rounded-[14px] font-semibold text-[13px] flex items-center justify-center gap-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#fff" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, ...slide }}
                whileTap={{ scale: 0.96 }}
                onClick={onLogin}
              >
                <LogIn size={14} strokeWidth={2} />
                {t("auth.signin") || "Login"}
              </motion.button>

              {!isDemoMode && (
                <motion.button
                  data-testid="try-demo-btn"
                  className="flex-1 py-[12px] rounded-[14px] font-semibold text-[13px] flex items-center justify-center gap-2"
                  style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.12)", color: "#FFB800" }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, ...slide }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onStartDemo}
                >
                  <FlaskConical size={14} strokeWidth={1.8} />
                  Try Demo
                </motion.button>
              )}
            </div>
          </div>
        ) : (
          <motion.button
            data-testid="get-started-btn"
            className="w-full py-[13px] rounded-[14px] bg-[#00C2FF] text-[#020202] font-semibold text-[13px] flex items-center justify-center gap-2 mb-7 relative overflow-hidden"
            style={{ boxShadow: "0 6px 36px rgba(0,194,255,0.3), 0 2px 10px rgba(0,194,255,0.15)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...slide }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onNavigate("/wallet")}
          >
            {t("home.get_started")}
            <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <ChevronRight size={16} strokeWidth={2.5} />
            </motion.div>
          </motion.button>
        )}

        {/* ── Services Grid ── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.26 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold font-outfit text-white">{t("home.services")}</h3>
            <motion.span
              className="text-[11px] text-[#00C2FF] font-medium cursor-pointer flex items-center gap-0.5"
              whileHover={{ x: 3 }}
            >
              {t("home.view_all")} <ChevronRight size={12} strokeWidth={2} />
            </motion.span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {features.map((feature, index) => (
              <ServiceCard
                key={feature.id}
                feature={feature}
                index={index}
                onClick={() => handleServiceClick(feature.id)}
              />
            ))}
          </div>
        </motion.section>

        {/* ── Highlight / Wallet Banner ── */}
        <motion.div
          data-testid="wallet-banner"
          className="mt-6 rounded-2xl p-4 relative overflow-hidden cursor-pointer group"
          style={{
            background: "rgba(0,194,255,0.03)",
            border: "1px solid rgba(0,194,255,0.08)",
          }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, ...slide }}
          whileTap={{ scale: 0.98 }}
          onClick={() => isGuest ? onRegister() : onNavigate("/wallet")}
        >
          {/* Corner glow */}
          <div
            className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
            style={{ background: "rgba(0,194,255,0.12)", filter: "blur(30px)" }}
          />

          <div className="flex items-center gap-3.5 relative z-10">
            <div
              className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(0,194,255,0.08)",
                border: "1px solid rgba(0,194,255,0.12)",
                boxShadow: "0 0 16px rgba(0,194,255,0.08)",
              }}
            >
              <CreditCard size={18} strokeWidth={1.5} className="text-[#00C2FF]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-semibold text-white font-outfit mb-0.5">
                Everything runs through BidBlitz Wallet
              </h4>
              <p className="text-[11px] text-[#444] font-medium">One wallet for all your payments</p>
            </div>
            <motion.div
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex-shrink-0"
            >
              <ChevronRight size={16} className="text-[#00C2FF]/60" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default HomePage;
