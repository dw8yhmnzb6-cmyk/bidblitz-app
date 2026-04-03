import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, User, CreditCard, Bell, Shield, Moon, Settings,
  HelpCircle, LogOut, ChevronRight, ChevronLeft, Sparkles,
  Globe, Lock, Eye, Fingerprint, Smartphone, Mail, Calendar, Gift
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { api } from "../services/api";
import ReferralPage from "./ReferralPage";
import NotificationsPage from "./NotificationsPage";

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

// ── Menu Row ──
const MenuRow = ({ icon: Icon, label, desc, color, onClick, isLast, testId, right }) => (
  <motion.button
    data-testid={testId}
    className={`w-full flex items-center gap-3.5 px-4 py-[13px] group transition-colors duration-200 hover:bg-white/[0.015] ${!isLast ? "border-b border-white/[0.03]" : ""}`}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
  >
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}08`, border: `1px solid ${color}10` }}
    >
      <Icon size={16} strokeWidth={1.5} style={{ color }} />
    </div>
    <div className="flex-1 text-left min-w-0">
      <p className="text-[13px] font-medium text-white/90 group-hover:text-white transition-colors truncate">{label}</p>
      {desc && <p className="text-[10px] text-[#333] font-medium truncate">{desc}</p>}
    </div>
    {right || <ChevronRight size={14} className="text-[#222] group-hover:text-[#444] transition-colors flex-shrink-0" />}
  </motion.button>
);

// ── Toggle Switch ──
const Toggle = ({ on, onToggle }) => (
  <motion.button
    className="w-[38px] h-[22px] rounded-full relative flex-shrink-0"
    style={{
      background: on ? "rgba(0,194,255,0.25)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${on ? "rgba(0,194,255,0.3)" : "rgba(255,255,255,0.06)"}`,
    }}
    onClick={onToggle}
    whileTap={{ scale: 0.9 }}
  >
    <motion.div
      className="w-[16px] h-[16px] rounded-full absolute top-[2px]"
      style={{ background: on ? "#00C2FF" : "#444" }}
      animate={{ left: on ? 18 : 2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    />
  </motion.button>
);

// ── Sub-page shell ──
const SubPage = ({ title, onBack, children }) => (
  <motion.div
    className="min-h-screen relative"
    style={{ background: "#030303" }}
    initial={{ opacity: 0, x: 30 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -30 }}
    transition={slide}
  >
    <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
      <motion.button
        className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
        whileTap={{ scale: 0.88 }}
        onClick={onBack}
      >
        <ChevronLeft size={15} strokeWidth={1.5} className="text-white/50" />
      </motion.button>
      <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">{title}</h1>
    </div>
    <div className="px-5 pb-8 relative z-10">{children}</div>
  </motion.div>
);

// ── Profile Sub-page ──
const ProfileView = ({ user, onBack }) => {
  const joined = "January 2024";
  return (
    <SubPage title="Profile" onBack={onBack}>
      {/* Avatar + Name */}
      <motion.div
        className="flex flex-col items-center py-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
      >
        <div className="relative mb-4">
          <img
            src={user.avatar}
            alt="Avatar"
            className="w-[80px] h-[80px] rounded-full object-cover"
            style={{ border: "3px solid rgba(0,194,255,0.2)", boxShadow: "0 0 24px rgba(0,194,255,0.1)" }}
          />
          {user.isPremium && (
            <motion.div
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", boxShadow: "0 2px 10px rgba(255,215,0,0.4)" }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles size={12} className="text-white" />
            </motion.div>
          )}
        </div>
        <p className="text-[18px] font-bold font-outfit text-white mb-0.5">{user.name}</p>
        <p className="text-[12px] text-[#444] font-medium">{user.email}</p>
        {user.isPremium && (
          <motion.span
            className="mt-2 text-[9px] uppercase tracking-[0.14em] font-bold px-3 py-1 rounded-full"
            style={{ background: "rgba(255,215,0,0.08)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.15)" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            Premium Member
          </motion.span>
        )}
      </motion.div>

      {/* Info card */}
      <motion.div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        {[
          { icon: User, label: "Full Name", value: user.name, color: "#00C2FF" },
          { icon: Mail, label: "Email", value: user.email, color: "#A855F7" },
          { icon: Shield, label: "Account Status", value: "Verified", color: "#00D26A" },
          { icon: Calendar, label: "Member Since", value: joined, color: "#FFB800" },
          { icon: Fingerprint, label: "Account ID", value: user.id || "user_001", color: "#888" },
        ].map((row, i, arr) => (
          <div
            key={i}
            className={`flex items-center justify-between px-4 py-[12px] ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <row.icon size={13} style={{ color: row.color }} />
              <span className="text-[11px] text-[#444] font-medium">{row.label}</span>
            </div>
            <span className="text-[12px] text-white/80 font-medium">{row.value}</span>
          </div>
        ))}
      </motion.div>
    </SubPage>
  );
};

// ── Settings Sub-page ──
const SettingsView = ({ onBack }) => {
  const [notifs, setNotifs] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [darkMode] = useState(true);

  return (
    <SubPage title="Settings" onBack={onBack}>
      {/* Personal */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">Personal</p>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
          <MenuRow icon={User} label="Personal Information" color="#00C2FF" isLast={false} />
          <MenuRow icon={Globe} label="Language" desc="English" color="#A855F7" isLast={false} />
          <MenuRow icon={Moon} label="Appearance" desc="Dark mode" color="#6366F1" isLast right={<Toggle on={darkMode} onToggle={() => {}} />} />
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">Notifications</p>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
          <MenuRow icon={Bell} label="Push Notifications" color="#FFB800" isLast={false} right={<Toggle on={notifs} onToggle={() => setNotifs(!notifs)} />} />
          <MenuRow icon={Mail} label="Email Notifications" desc="Weekly summary" color="#FF6B6B" isLast />
        </div>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">Security & Privacy</p>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
          <MenuRow icon={Lock} label="Change Password" color="#00D26A" isLast={false} />
          <MenuRow icon={Fingerprint} label="Biometric Login" color="#00C2FF" isLast={false} right={<Toggle on={biometric} onToggle={() => setBiometric(!biometric)} />} />
          <MenuRow icon={Eye} label="Privacy Settings" color="#888" isLast={false} />
          <MenuRow icon={Smartphone} label="Active Sessions" desc="1 device" color="#A855F7" isLast />
        </div>
      </motion.div>
    </SubPage>
  );
};

// ── Main More Page ──
export const MorePage = ({ onNavigate }) => {
  const user = useUser();
  const { t } = useI18n();
  const [subPage, setSubPage] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.getNotifications(true).then(d => setUnreadCount(d.unread_count || 0)).catch(() => {});
  }, []);

  // Sub-page rendering
  if (subPage === "profile") {
    return <ProfileView user={user} onBack={() => setSubPage(null)} />;
  }
  if (subPage === "settings") {
    return <SettingsView onBack={() => setSubPage(null)} />;
  }
  if (subPage === "referral") {
    return <ReferralPage onBack={() => setSubPage(null)} />;
  }
  if (subPage === "notifications") {
    return <NotificationsPage onBack={() => { setSubPage(null); setUnreadCount(0); }} />;
  }

  const accountMenu = [
    { id: "profile", icon: User, label: t("more.profile"), desc: t("more.profile_desc"), color: "#00C2FF", action: () => setSubPage("profile") },
    { id: "cards", icon: CreditCard, label: t("more.payment_methods"), desc: t("more.cards_desc"), color: "#A855F7" },
    { id: "security", icon: Shield, label: t("more.security"), desc: t("more.security_desc"), color: "#00D26A" },
  ];

  const growthMenu = [
    { id: "referral", icon: Gift, label: t("referral.title"), desc: t("referral.menu_desc"), color: "#FFD700", action: () => setSubPage("referral") },
    {
      id: "notifications", icon: Bell, label: t("notif.title"), desc: unreadCount > 0 ? `${unreadCount} ${t("notif.unread")}` : t("notif.menu_desc"), color: "#FFB800",
      action: () => setSubPage("notifications"),
      badge: unreadCount > 0 ? unreadCount : null,
    },
  ];

  const appMenu = [
    { id: "settings", icon: Settings, label: t("more.settings"), desc: t("more.settings_desc"), color: "#888", action: () => setSubPage("settings") },
    { id: "appearance", icon: Moon, label: t("more.appearance"), desc: t("more.appearance_desc"), color: "#6366F1" },
  ];

  const supportMenu = [
    { id: "help", icon: HelpCircle, label: t("more.help"), desc: t("more.help_desc"), color: "#FF6B6B" },
  ];

  const renderGroup = (title, items, delay) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ...slide }}
      className="mb-5"
    >
      <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">{title}</p>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
      >
        {items.map((item, i) => (
          <MenuRow
            key={item.id}
            testId={`menu-${item.id}-btn`}
            icon={item.icon}
            label={item.label}
            desc={item.desc}
            color={item.color}
            isLast={i === items.length - 1}
            onClick={item.action}
            right={item.badge ? (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(255,184,0,0.15)", color: "#FFB800" }}>
                  {item.badge}
                </span>
                <ChevronRight size={14} className="text-[#222]" />
              </div>
            ) : undefined}
          />
        ))}
      </div>
    </motion.div>
  );

  return (
    <motion.div
      data-testid="more-page"
      className="min-h-screen relative overflow-hidden"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient */}
      <motion.div
        className="absolute top-[-18%] left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ filter: "blur(140px)", background: "rgba(0,194,255,0.03)" }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button
          data-testid="more-back-btn"
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
          whileTap={{ scale: 0.88 }}
          onClick={() => onNavigate("/")}
        >
          <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <motion.h1
          className="text-[15px] font-semibold font-outfit text-white tracking-tight"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
        >
          {t("more.title")}
        </motion.h1>
      </div>

      <div className="px-5 pb-8 relative z-10">

        {/* ── Profile Card ── */}
        <motion.div
          data-testid="profile-card"
          className="rounded-2xl p-4 mb-6 flex items-center gap-3.5 relative overflow-hidden cursor-pointer group"
          style={{
            background: "rgba(255,255,255,0.018)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, ...slide }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSubPage("profile")}
        >
          <div
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full pointer-events-none"
            style={{ background: "rgba(0,194,255,0.06)", filter: "blur(30px)" }}
          />
          <div className="relative flex-shrink-0">
            <img
              src={user.avatar}
              alt="Avatar"
              className="w-[52px] h-[52px] rounded-full object-cover"
              style={{ border: "2px solid rgba(0,194,255,0.2)", boxShadow: "0 0 16px rgba(0,194,255,0.08)" }}
            />
            {user.isPremium && (
              <motion.div
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", border: "2px solid #030303" }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles size={9} className="text-white" />
              </motion.div>
            )}
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <p className="text-[14px] font-semibold font-outfit text-white truncate">{user.name}</p>
            <p className="text-[11px] text-[#444] font-medium truncate">{user.email}</p>
          </div>
          <ChevronRight size={14} className="text-[#222] flex-shrink-0" />
        </motion.div>

        {/* ── Menu Groups ── */}
        {renderGroup(t("more.account"), accountMenu, 0.14)}
        {renderGroup(t("more.growth"), growthMenu, 0.2)}
        {renderGroup(t("more.app"), appMenu, 0.26)}
        {renderGroup(t("more.support"), supportMenu, 0.32)}

        {/* ── Logout ── */}
        <motion.button
          data-testid="logout-btn"
          className="w-full py-[13px] rounded-[14px] font-semibold text-[13px] flex items-center justify-center gap-2 mt-2"
          style={{
            background: "rgba(255,71,87,0.04)",
            border: "1px solid rgba(255,71,87,0.1)",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, ...slide }}
          whileTap={{ scale: 0.96 }}
          onClick={user.logout}
        >
          <LogOut size={15} strokeWidth={1.5} className="text-[#FF4757]" />
          <span className="text-[#FF4757]">Log Out</span>
        </motion.button>

        {/* Version */}
        <motion.p
          className="text-center text-[10px] text-[#1A1A1A] mt-6 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          BidBlitz V2 · Version 2.0.0
        </motion.p>
      </div>
    </motion.div>
  );
};

export default MorePage;
