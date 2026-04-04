import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, User, CreditCard, Bell, Shield, Moon, Settings,
  HelpCircle, LogOut, ChevronRight, ChevronLeft, Sparkles,
  Globe, Lock, Eye, Fingerprint, Smartphone, Mail, Calendar, Gift, LayoutDashboard, Activity, Users,
  Pencil, Loader2, Check, X
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { api } from "../services/api";
import ReferralPage from "./ReferralPage";
import NotificationsPage from "./NotificationsPage";
import SupportPage from "./SupportPage";
import ActivityPage from "./ActivityPage";
import KidsPaywall from "./KidsPaywall";
import FeatureGate from "../components/FeatureGate";

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
const ProfileView = ({ user, onBack, t, initialOpenPw }) => {
  const { refreshUser } = useUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || "");
  const [originalName] = useState(user.name || "");
  const [saving, setSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(initialOpenPw || false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [nameMsg, setNameMsg] = useState(null);
  const [nameValidation, setNameValidation] = useState(null);

  // Inline validation for name
  const validateName = (val) => {
    if (!val.trim()) return t("profile.name_empty");
    if (val.trim().length < 2) return t("profile.name_too_short");
    return null;
  };

  const handleNameChange = (val) => {
    setName(val);
    if (nameValidation) setNameValidation(validateName(val));
  };

  const handleSaveName = async () => {
    const err = validateName(name);
    if (err) { setNameValidation(err); return; }
    if (name.trim() === user.name) { handleCancelEdit(); return; }
    setSaving(true); setNameMsg(null); setNameValidation(null);
    try {
      await api.updateProfile({ name: name.trim() });
      await refreshUser();
      setNameMsg({ ok: true, text: t("profile.name_saved") });
      setEditing(false);
      setTimeout(() => setNameMsg(null), 3000);
    } catch (e) {
      setNameMsg({ ok: false, text: e.message || t("common.error") });
    }
    setSaving(false);
  };

  const handleCancelEdit = () => {
    setName(user.name || originalName);
    setEditing(false);
    setNameValidation(null);
    setNameMsg(null);
  };

  // Password validation
  const pwValidation = () => {
    if (!currentPw || !newPw || !confirmPw) return t("profile.pw_required");
    if (newPw.length < 6) return t("profile.pw_too_short");
    if (newPw !== confirmPw) return t("profile.pw_mismatch");
    return null;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const err = pwValidation();
    if (err) { setPwMsg({ ok: false, text: err }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      await api.changePassword({ current_password: currentPw, new_password: newPw });
      setPwMsg({ ok: true, text: t("profile.password_changed") });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setShowPasswordForm(false); setPwMsg(null); }, 2000);
    } catch (e) {
      const msg = e.message || "";
      const userMsg = msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("incorrect") || msg.toLowerCase().includes("wrong")
        ? t("profile.pw_wrong") : msg || t("common.error");
      setPwMsg({ ok: false, text: userMsg });
    }
    setPwSaving(false);
  };

  // Format member since date
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" })
    : "—";

  return (
    <SubPage title={t("profile.title")} onBack={onBack}>
      {/* Avatar + Name */}
      <motion.div className="flex flex-col items-center py-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <div className="relative mb-4">
          <img src={user.avatar} alt="Avatar" className="w-[80px] h-[80px] rounded-full object-cover"
            style={{ border: "3px solid rgba(0,194,255,0.2)", boxShadow: "0 0 24px rgba(0,194,255,0.1)" }} />
          {user.isPremium && (
            <motion.div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", boxShadow: "0 2px 10px rgba(255,215,0,0.4)" }}
              animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Sparkles size={12} className="text-white" />
            </motion.div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {editing ? (
            <motion.div key="editing" className="w-full max-w-[280px] space-y-2"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <input data-testid="profile-name-input" value={name} onChange={e => handleNameChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[14px] text-white font-outfit font-bold text-center outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${nameValidation ? "rgba(255,71,87,0.3)" : "rgba(0,194,255,0.25)"}`,
                  boxShadow: nameValidation ? "0 0 12px rgba(255,71,87,0.06)" : "0 0 12px rgba(0,194,255,0.06)"
                }}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") handleCancelEdit(); }} />
              {nameValidation && (
                <motion.p className="text-[10px] text-[#FF4757] font-medium text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {nameValidation}
                </motion.p>
              )}
              <div className="flex gap-2">
                <motion.button data-testid="profile-cancel-edit-btn" onClick={handleCancelEdit}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-[#666] bg-white/[0.03] border border-white/[0.06]"
                  whileTap={{ scale: 0.95 }}>
                  {t("profile.cancel_edit")}
                </motion.button>
                <motion.button data-testid="profile-save-name-btn" onClick={handleSaveName} disabled={saving}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20 flex items-center justify-center gap-1.5"
                  whileTap={{ scale: 0.95 }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {saving ? t("profile.saving") : t("profile.save_name")}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="display" className="text-center" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <motion.button data-testid="profile-edit-name-btn" onClick={() => { setEditing(true); setNameMsg(null); }} className="group inline-flex items-center gap-1.5">
                <p className="text-[18px] font-bold font-outfit text-white group-hover:text-[#00C2FF] transition-colors">
                  {user.name}
                </p>
                <Pencil size={12} className="text-[#333] group-hover:text-[#00C2FF] transition-colors" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[12px] text-[#444] font-medium mt-1">{user.email}</p>

        {/* Inline feedback message */}
        <AnimatePresence>
          {nameMsg && (
            <motion.div initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.95 }}
              className={`mt-2 px-3 py-1.5 rounded-full flex items-center gap-1.5 ${nameMsg.ok ? "bg-[#00D26A]/8 border border-[#00D26A]/15" : "bg-[#FF4757]/8 border border-[#FF4757]/15"}`}>
              {nameMsg.ok ? <Check size={11} className="text-[#00D26A]" /> : <X size={11} className="text-[#FF4757]" />}
              <span className={`text-[11px] font-medium ${nameMsg.ok ? "text-[#00D26A]" : "text-[#FF4757]"}`}>{nameMsg.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {user.isPremium && (
          <motion.span className="mt-2 text-[9px] uppercase tracking-[0.14em] font-bold px-3 py-1 rounded-full"
            style={{ background: "rgba(255,215,0,0.08)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.15)" }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
            {t("profile.premium_member")}
          </motion.span>
        )}
      </motion.div>

      {/* Info card */}
      <motion.div className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        {[
          { icon: User, label: t("profile.full_name"), value: user.name, color: "#00C2FF" },
          { icon: Mail, label: t("profile.email"), value: user.email, color: "#A855F7" },
          { icon: Shield, label: t("profile.account_status"), value: t("profile.verified"), color: "#00D26A" },
          { icon: Calendar, label: t("profile.member_since"), value: memberSince, color: "#FFB800" },
          { icon: Fingerprint, label: t("profile.account_id"), value: user.id ? `...${user.id.slice(-8)}` : "—", color: "#888" },
        ].map((row, i, arr) => (
          <div key={i} className={`flex items-center justify-between px-4 py-[12px] ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
            <div className="flex items-center gap-2.5">
              <row.icon size={13} style={{ color: row.color }} />
              <span className="text-[11px] text-[#444] font-medium">{row.label}</span>
            </div>
            <span className="text-[12px] text-white/80 font-medium">{row.value}</span>
          </div>
        ))}
      </motion.div>

      {/* Change Password Section */}
      <motion.div className="mt-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <motion.button data-testid="profile-change-pw-btn"
          onClick={() => { setShowPasswordForm(!showPasswordForm); setPwMsg(null); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors"
          style={{ background: showPasswordForm ? "rgba(0,210,106,0.03)" : "rgba(255,255,255,0.015)", border: `1px solid ${showPasswordForm ? "rgba(0,210,106,0.08)" : "rgba(255,255,255,0.035)"}` }}
          whileTap={{ scale: 0.98 }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,210,106,0.08)", border: "1px solid rgba(0,210,106,0.12)" }}>
            <Lock size={14} className="text-[#00D26A]" />
          </div>
          <span className="text-[13px] font-medium text-white/90 flex-1 text-left">{t("settings.change_password")}</span>
          <ChevronRight size={14} className={`text-[#333] transition-transform duration-200 ${showPasswordForm ? "rotate-90" : ""}`} />
        </motion.button>

        <AnimatePresence>
          {showPasswordForm && (
            <motion.form data-testid="change-password-form" onSubmit={handleChangePassword}
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
              className="overflow-hidden mt-2 rounded-2xl p-4 space-y-3"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[9px] text-[#444] font-semibold uppercase tracking-wider mb-1 block pl-0.5">{t("profile.current_password")}</label>
                  <input data-testid="pw-current" type="password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwMsg(null); }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#222] font-medium outline-none transition-all focus:border-[#00C2FF]/20"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }} />
                </div>
                <div>
                  <label className="text-[9px] text-[#444] font-semibold uppercase tracking-wider mb-1 block pl-0.5">{t("profile.new_password")}</label>
                  <input data-testid="pw-new" type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setPwMsg(null); }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#222] font-medium outline-none transition-all focus:border-[#00C2FF]/20"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }} />
                  {newPw && newPw.length < 6 && (
                    <p className="text-[9px] text-[#FFB800] font-medium mt-1 pl-0.5">{t("profile.pw_too_short")}</p>
                  )}
                </div>
                <div>
                  <label className="text-[9px] text-[#444] font-semibold uppercase tracking-wider mb-1 block pl-0.5">{t("profile.confirm_password")}</label>
                  <input data-testid="pw-confirm" type="password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwMsg(null); }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-[#222] font-medium outline-none transition-all focus:border-[#00C2FF]/20"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${confirmPw && confirmPw !== newPw ? "rgba(255,71,87,0.2)" : "rgba(255,255,255,0.05)"}`
                    }} />
                  {confirmPw && confirmPw !== newPw && (
                    <p className="text-[9px] text-[#FF4757] font-medium mt-1 pl-0.5">{t("profile.pw_mismatch")}</p>
                  )}
                </div>
              </div>

              {/* Success/Error feedback */}
              <AnimatePresence>
                {pwMsg && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl ${pwMsg.ok ? "bg-[#00D26A]/6 border border-[#00D26A]/12" : "bg-[#FF4757]/6 border border-[#FF4757]/12"}`}>
                    {pwMsg.ok ? <Check size={12} className="text-[#00D26A]" /> : <X size={12} className="text-[#FF4757]" />}
                    <span className={`text-[11px] font-medium ${pwMsg.ok ? "text-[#00D26A]" : "text-[#FF4757]"}`}>{pwMsg.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button data-testid="pw-submit-btn" type="submit"
                disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: pwSaving ? "rgba(0,210,106,0.05)" : "rgba(0,210,106,0.1)",
                  border: "1px solid rgba(0,210,106,0.15)",
                  color: "#00D26A",
                  opacity: (!currentPw || !newPw || !confirmPw) ? 0.4 : 1,
                }}
                whileTap={{ scale: 0.97 }}>
                {pwSaving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                {pwSaving ? t("profile.password_updating") : t("profile.update_password")}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </SubPage>
  );
};

// ── Language Names Map ──
const LANG_NAMES = {
  en: "English", de: "Deutsch", sq: "Shqip", tr: "Türkçe", fr: "Français",
  es: "Español", it: "Italiano", pt: "Português", nl: "Nederlands", pl: "Polski", ru: "Русский", ar: "العربية",
};

// ── Settings Sub-page ──
const SettingsView = ({ onBack, t, locale, setLocale, onOpenPasswordChange }) => {
  const userCtx = useUser();
  const [notifs, setNotifs] = useState(userCtx?.notifications_enabled !== false);
  const [emailNotifs, setEmailNotifs] = useState(userCtx?.email_notifications !== false);
  const [biometric, setBiometric] = useState(userCtx?.biometric_enabled === true);
  const [darkMode, setDarkMode] = useState(userCtx?.dark_mode !== false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const persistSetting = async (field, value) => {
    setSaving(true);
    try { await api.updateProfile({ [field]: value }); } catch {}
    setSaving(false);
  };

  const handleLangChange = (code) => {
    setLocale(code);
    setShowLangPicker(false);
    persistSetting("language", code);
  };

  const toggleNotifs = () => { const v = !notifs; setNotifs(v); persistSetting("notifications_enabled", v); };
  const toggleEmail = () => { const v = !emailNotifs; setEmailNotifs(v); persistSetting("email_notifications", v); };
  const toggleBio = () => { const v = !biometric; setBiometric(v); persistSetting("biometric_enabled", v); };
  const toggleDark = () => { const v = !darkMode; setDarkMode(v); persistSetting("dark_mode", v); };

  return (
    <SubPage title={t("settings.title")} onBack={onBack}>
      {/* Personal */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">{t("settings.personal")}</p>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
          <MenuRow icon={User} label={t("settings.personal_info")} color="#00C2FF" isLast={false} />
          <MenuRow icon={Globe} label={t("settings.language")} desc={LANG_NAMES[locale] || locale} color="#A855F7" isLast={false} onClick={() => setShowLangPicker(!showLangPicker)} />
          <AnimatePresence>
            {showLangPicker && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden border-b border-white/[0.03]"
              >
                <div className="grid grid-cols-3 gap-1.5 p-3" data-testid="language-picker">
                  {Object.entries(LANG_NAMES).map(([code, name]) => (
                    <motion.button
                      key={code}
                      data-testid={`lang-${code}`}
                      onClick={() => handleLangChange(code)}
                      whileTap={{ scale: 0.95 }}
                      className={`px-2 py-2 rounded-xl text-[11px] font-medium transition-all ${
                        locale === code
                          ? "bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30"
                          : "bg-white/[0.02] text-white/50 border border-white/[0.04] hover:bg-white/[0.04]"
                      }`}
                    >
                      {name}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <MenuRow icon={Moon} label={t("settings.appearance")} desc={darkMode ? t("settings.dark_mode") : "Light"} color="#6366F1" isLast right={<Toggle on={darkMode} onToggle={toggleDark} />} />
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">{t("settings.notifications")}</p>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
          <MenuRow icon={Bell} label={t("settings.push")} color="#FFB800" isLast={false} right={<Toggle on={notifs} onToggle={toggleNotifs} />} />
          <MenuRow icon={Mail} label={t("settings.email_notif")} desc={t("settings.weekly_summary")} color="#FF6B6B" isLast right={<Toggle on={emailNotifs} onToggle={toggleEmail} />} />
        </div>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2.5 pl-1">{t("settings.security_privacy")}</p>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
          <MenuRow icon={Lock} label={t("settings.change_password")} color="#00D26A" isLast={false} onClick={onOpenPasswordChange} />
          <MenuRow icon={Fingerprint} label={t("settings.biometric")} color="#00C2FF" isLast={false} right={<Toggle on={biometric} onToggle={toggleBio} />} />
          <MenuRow icon={Eye} label={t("settings.privacy")} color="#888" isLast={false} />
          <MenuRow icon={Smartphone} label={t("settings.active_sessions")} desc={t("settings.devices")} color="#A855F7" isLast />
        </div>
      </motion.div>
      {saving && <p className="text-center text-[10px] text-[#00C2FF]/50 animate-pulse mt-1">Saving...</p>}
    </SubPage>
  );
};

// ── Main More Page ──
export const MorePage = ({ onNavigate, kidsReturn, onKidsHandled }) => {
  const user = useUser();
  const { t, lang: locale, setLang: setLocale } = useI18n();
  const [subPage, setSubPage] = useState(kidsReturn ? "kids" : null);
  const [profileOpenPw, setProfileOpenPw] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (kidsReturn && onKidsHandled) onKidsHandled();
  }, [kidsReturn, onKidsHandled]);

  useEffect(() => {
    api.getNotifications(true).then(d => setUnreadCount(d.unread_count || 0)).catch(() => {});
  }, []);

  // Sub-page rendering
  if (subPage === "profile") {
    return <ProfileView user={user} onBack={() => { setSubPage(null); setProfileOpenPw(false); }} t={t} initialOpenPw={profileOpenPw} />;
  }
  if (subPage === "settings") {
    return <SettingsView onBack={() => setSubPage(null)} t={t} locale={locale} setLocale={setLocale} onOpenPasswordChange={() => { setProfileOpenPw(true); setSubPage("profile"); }} />;
  }
  if (subPage === "referral") {
    return <FeatureGate flag="referral" onBack={() => setSubPage(null)}><ReferralPage onBack={() => setSubPage(null)} /></FeatureGate>;
  }
  if (subPage === "notifications") {
    return <NotificationsPage onBack={() => { setSubPage(null); setUnreadCount(0); }} />;
  }
  if (subPage === "support") {
    return <FeatureGate flag="support_center" onBack={() => setSubPage(null)}><SupportPage onBack={() => setSubPage(null)} /></FeatureGate>;
  }
  if (subPage === "activity") {
    return <FeatureGate flag="activity_feed" onBack={() => setSubPage(null)}><ActivityPage onBack={() => setSubPage(null)} /></FeatureGate>;
  }
  if (subPage === "kids") {
    return <FeatureGate flag="kids" onBack={() => setSubPage(null)}><KidsPaywall onBack={() => setSubPage(null)} onSubscribed={() => setSubPage(null)} /></FeatureGate>;
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
    { id: "activity", icon: Activity, label: t("activity.title"), desc: t("activity.menu_desc"), color: "#00C2FF", action: () => setSubPage("activity") },
    { id: "kids", icon: Users, label: t("kids.title"), desc: t("kids.menu_desc"), color: "#A855F7", action: () => setSubPage("kids") },
  ];

  const appMenu = [
    { id: "settings", icon: Settings, label: t("more.settings"), desc: t("more.settings_desc"), color: "#888", action: () => setSubPage("settings") },
    { id: "appearance", icon: Moon, label: t("more.appearance"), desc: t("more.appearance_desc"), color: "#6366F1" },
  ];

  const supportMenu = [
    { id: "help", icon: HelpCircle, label: t("more.help"), desc: t("more.help_desc"), color: "#FF6B6B", action: () => setSubPage("support") },
  ];

  const adminMenu = user.role === "admin" ? [
    { id: "admin-dashboard", icon: LayoutDashboard, label: "Admin Dashboard", desc: "Platform Management", color: "#FF6B6B", action: () => onNavigate("/admin") },
  ] : [];

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
        {adminMenu.length > 0 && renderGroup("Admin", adminMenu, 0.38)}

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
