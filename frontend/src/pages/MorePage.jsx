import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../store/ThemeContext";
import {
  ArrowLeft, User, CreditCard, Bell, Shield, Moon, Settings,
  HelpCircle, LogOut, ChevronRight, ChevronLeft, Sparkles,
  Globe, Lock, Eye, Fingerprint, Smartphone, Mail, Calendar, Gift, LayoutDashboard, Activity, Users,
  Pencil, Loader2, Check, X, ShieldCheck, Clock, AlertCircle, MapPin,
  Trophy, TrendingUp, Star, Store, Monitor, Scan, Wallet, Cpu, Car, Zap, ShoppingBag, Coins,
  Split, CreditCardIcon, PiggyBank, BadgePercent, Banknote, Bitcoin, GiftIcon, Gamepad2,
  MessageCircle, BarChart3, Crown, Wifi, Search, Package, FileText, Share2, Building2, Phone, AtSign, Radio, Heart, MessageSquare, Home, Target
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { api } from "../services/api";
import { DEMO_USER } from "../models/demoData";
import GuestCTABar from "../components/GuestCTABar";
import ReferralPage from "./ReferralPage";
import NotificationsPage from "./NotificationsPage";
import SupportPage from "./SupportPage";
import ActivityPage from "./ActivityPage";
import KidsPaywall from "./KidsPaywall";
import FeatureGate from "../components/FeatureGate";
import { PushNotificationToggle } from "../components/PushNotifications";
import { isAdminUser, isKycApprovedOrAdmin } from "../utils/adminAccess";
import { filterStoreSafeItems } from "../config/release";
import { TEST_MODE } from "../config/testMode";

const KYC_DISABLED = TEST_MODE;

const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };
const isRtlLanguage = (lang) => lang === "ar" || lang === "ar-AE";
const normalizeLocale = (lang) => (lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang);
const literalTranslations = {
  "Benachrichtigungen": { en: "Notifications", sq: "Njoftime", ar: "الإشعارات" },
  "Push-Benachrichtigungen verwalten": { en: "Manage push notifications", sq: "Menaxho njoftimet push", ar: "إدارة الإشعارات" },
  "Tägliche Quests": { en: "Daily Quests", sq: "Detyrat ditore", ar: "المهام اليومية" },
  "3 Aufgaben täglich · Bis zu 70+ BLZ gewinnen": { en: "3 tasks daily · Earn up to 70+ BLZ", sq: "3 detyra çdo ditë · Fito deri në 70+ BLZ", ar: "3 مهام يوميًا · اربح حتى 70+ BLZ" },
  "Lokales Verzeichnis": { en: "Local Directory", sq: "Direktori lokale", ar: "الدليل المحلي" },
  "Ärzte, Handwerker, Dienstleister in der Nähe": { en: "Doctors, tradespeople and services nearby", sq: "Mjekë, zejtarë dhe shërbime afër", ar: "أطباء وحرفيون وخدمات قريبة" },
  "Sofort-Kredit": { en: "Instant Credit", sq: "Kredi e menjëhershme", ar: "ائتمان فوري" },
  "Bis 100€ in 3 Minuten · 0% Zinsen · 30 Tage Rückzahlung": { en: "Up to €100 in 3 minutes · 0% interest · 30-day repayment", sq: "Deri në 100€ në 3 minuta · 0% interes · kthim për 30 ditë", ar: "حتى 100€ خلال 3 دقائق · فائدة 0% · سداد خلال 30 يومًا" },
  "Buchen & Reservieren": { en: "Bookings & Reservations", sq: "Rezervime", ar: "الحجوزات" },
  "Hotels, Restaurants, Ärzte, Handwerker buchen": { en: "Book hotels, restaurants, doctors and tradespeople", sq: "Rezervo hotele, restorante, mjekë dhe zejtarë", ar: "احجز فنادق ومطاعم وأطباء وحرفيين" },
  "Freunde": { en: "Friends", sq: "Miqtë", ar: "الأصدقاء" },
  "Freunde hinzufügen & verwalten": { en: "Add and manage friends", sq: "Shto dhe menaxho miqtë", ar: "إضافة الأصدقاء وإدارتهم" },
  "Fahrer-Modus": { en: "Driver Mode", sq: "Modaliteti i shoferit", ar: "وضع السائق" },
  "Online gehen, Fahrten annehmen & verdienen": { en: "Go online, accept rides and earn", sq: "Dil online, prano udhëtime dhe fito", ar: "اتصل بالإنترنت واقبل الرحلات واربح" },
  "Rechtliches": { en: "Legal", sq: "Ligjore", ar: "قانوني" },
  "AGB": { en: "Terms", sq: "Kushtet", ar: "الشروط" },
  "Allgemeine Geschäftsbedingungen": { en: "General terms and conditions", sq: "Kushtet e përgjithshme", ar: "الشروط والأحكام العامة" },
  "Datenschutz": { en: "Privacy", sq: "Privatësia", ar: "الخصوصية" },
  "DSGVO, Cookies, Ihre Rechte": { en: "GDPR, cookies and your rights", sq: "GDPR, cookies dhe të drejtat tuaja", ar: "اللائحة العامة والكوكيز وحقوقك" },
  "Impressum": { en: "Imprint", sq: "Imprint", ar: "بيانات الناشر" },
  "Angaben zum Anbieter": { en: "Provider information", sq: "Informacioni i ofruesit", ar: "معلومات المزوّد" },
  "Sicherheit": { en: "Security", sq: "Siguria", ar: "الأمان" },
  "2FA, Verschlüsselung, Schutz": { en: "2FA, encryption and protection", sq: "2FA, enkriptim dhe mbrojtje", ar: "المصادقة الثنائية والتشفير والحماية" },
  "Wallet Reconciliation Center": { en: "Wallet Reconciliation Center", sq: "Qendra e pajtimit të wallet-it", ar: "مركز مطابقة المحفظة" },
  "Analyse, Duplikate, Queue, Read-only History": { en: "Analysis, duplicates, queue and read-only history", sq: "Analizë, dublikate, radhë dhe histori vetëm për lexim", ar: "تحليل ونسخ مكررة وقائمة انتظار وسجل للقراءة فقط" },
  "Taxi-Administration": { en: "Taxi Administration", sq: "Administrimi i taksive", ar: "إدارة التاكسي" },
  "Fahrer, Fahrten, Preis-Einstellungen": { en: "Drivers, rides and pricing settings", sq: "Shoferë, udhëtime dhe rregullime çmimesh", ar: "السائقون والرحلات وإعدادات الأسعار" },
  "Umsatz-Dashboard": { en: "Revenue Dashboard", sq: "Dashboard i të ardhurave", ar: "لوحة الإيرادات" },
  "Live-Einnahmen · MRR · Händler-Akquise": { en: "Live revenue · MRR · merchant acquisition", sq: "Të ardhura live · MRR · përvetësim merchantësh", ar: "إيرادات مباشرة · MRR · اكتساب التجار" },
  "Express Checkout": { en: "Express Checkout", sq: "Checkout i shpejtë", ar: "الدفع السريع" },
  "1-Klick Zahlung mit gespeicherten Daten": { en: "1-click payment with saved data", sq: "Pagesë me 1 klik me të dhëna të ruajtura", ar: "دفع بنقرة واحدة بالبيانات المحفوظة" },
  "Sabre Hotels": { en: "Sabre Hotels", sq: "Hotele Sabre", ar: "فنادق Sabre" },
  "Kettenhotels weltweit buchen": { en: "Book chain hotels worldwide", sq: "Rezervo hotele zinxhir në mbarë botën", ar: "احجز فنادق السلاسل عالميًا" },
  "POS Extended": { en: "POS Extended", sq: "POS i zgjeruar", ar: "نقطة البيع الموسعة" },
  "Kassensturz, Offline-Mode, Bondrucker": { en: "Cash-up, offline mode and receipt printer", sq: "Mbyllje arke, modalitet offline dhe printer fature", ar: "إغلاق الصندوق ووضع عدم الاتصال وطابعة الإيصالات" },
  "Mobilität": { en: "Mobility", sq: "Mobiliteti", ar: "التنقل" },
  "Premium Finance": { en: "Premium Finance", sq: "Financa Premium", ar: "التمويل المميز" },
};

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

const GridTile = ({ item, color }) => (
  <motion.button
    data-testid={`grid-${item.id}`}
    whileTap={{ scale: 0.95 }}
    onClick={item.action}
    className="relative rounded-xl p-3 text-left overflow-hidden"
    style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.04)",
      minHeight: 92,
    }}
  >
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
      style={{ background: `${item.color || color}15`, border: `1px solid ${item.color || color}25` }}
    >
      <item.icon size={15} strokeWidth={1.6} style={{ color: item.color || color }} />
    </div>
    <p className="text-[12px] font-semibold text-white leading-tight truncate">{item.label}</p>
    <p className="text-[9px] text-white/60 leading-tight truncate mt-0.5">{item.desc}</p>
    {item.badge && (
      <span
        className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[8px] font-bold"
        style={{ background: "rgba(255,184,0,0.2)", color: "#FFB800" }}
      >
        {item.badge}
      </span>
    )}
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
const SubPage = ({ title, onBack, children }) => {
  const { lang } = useI18n();

  return (
  <motion.div
    className="min-h-screen relative"
    dir={isRtlLanguage(lang) ? "rtl" : "ltr"}
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
};

// ── Profile Sub-page ──
const ProfileView = ({ userId, userName, userEmail, userRole, userBalance, userCurrency, userAvatar, userIsPremium, userCreatedAt, onBack, t, initialOpenPw }) => {
  // Reconstruct user object for internal use
  const user = { id: userId, name: userName, email: userEmail, role: userRole, balance: userBalance, currency: userCurrency, avatar: userAvatar, isPremium: userIsPremium, created_at: userCreatedAt };
  
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

      <motion.div
        className="mt-4 rounded-2xl p-4 flex items-start gap-3"
        style={{ background: "rgba(255,90,95,0.05)", border: "1px solid rgba(255,90,95,0.16)" }}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
        data-testid="profile-taxi-shield-card"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,90,95,0.12)", border: "1px solid rgba(255,90,95,0.2)" }}>
          <Shield size={16} className="text-[#FF5A5F]" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white">Taxi Preis-Schutz</p>
          <p className="text-[11px] text-white/55 mt-1 leading-relaxed">
            Festpreis, lizenzierte Fahrer und Live-Tracking bleiben aktiv — der rote Shield-Hinweis liegt jetzt intern hier im Profil.
          </p>
        </div>
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
  en: "English", "en-US": "English (US)", de: "Deutsch", sq: "Shqip", "sq-XK": "Kosovë", tr: "Türkçe", fr: "Français",
  es: "Español", it: "Italiano", pt: "Português", nl: "Nederlands", pl: "Polski", ru: "Русский", ar: "العربية", "ar-AE": "الإمارات",
};

// ── Settings Sub-page ──
const PrivacyToggleRow = ({ label, desc, defaultOn }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1 mr-3">
        <p className="text-[12px] text-white/80 font-medium">{label}</p>
        <p className="text-[10px] text-[#444]">{desc}</p>
      </div>
      <Toggle on={on} onToggle={() => setOn(!on)} />
    </div>
  );
};

const PrivacyView = ({ onBack, t, onNavigate }) => (
  <SubPage title={t("settings.privacy")} onBack={onBack}>
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
        <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-3">{t("settings.privacy_data")}</p>
        <div className="space-y-3">
          <PrivacyToggleRow label={t("settings.privacy_profile_visible")} desc={t("settings.privacy_profile_visible_desc")} defaultOn={true} />
          <PrivacyToggleRow label={t("settings.privacy_txn_history")} desc={t("settings.privacy_txn_history_desc")} defaultOn={false} />
          <PrivacyToggleRow label={t("settings.privacy_analytics")} desc={t("settings.privacy_analytics_desc")} defaultOn={true} />
        </div>
      </div>
      <div className="rounded-2xl p-4" style={{ background: "rgba(255,71,87,0.02)", border: "1px solid rgba(255,71,87,0.08)" }}>
        <p className="text-[11px] text-[#FF6B6B] font-semibold mb-1">{t("settings.privacy_delete_title")}</p>
        <p className="text-[10px] text-[#444] mb-3">{t("settings.privacy_delete_desc")}</p>
        <motion.button className="px-4 py-2 rounded-xl text-[11px] font-medium text-[#FF6B6B] border border-[#FF6B6B]/15 bg-[#FF6B6B]/5" whileTap={{ scale: 0.97 }} data-testid="delete-account-btn" onClick={() => onNavigate?.('/delete-account')}>
          {t("settings.privacy_delete_btn")}
        </motion.button>
      </div>
    </motion.div>
  </SubPage>
);

const ActiveSessionsView = ({ onBack, t }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getSessions().then(d => setSessions(d.sessions || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const revokeAll = async () => {
    try { await api.revokeAllSessions(); setSessions([]); } catch (error) { void error; }
  };
  return (
    <SubPage title={t("settings.active_sessions")} onBack={onBack}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        {loading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.02)" }} />)}</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
            <Smartphone size={24} className="text-[#333] mx-auto mb-2" />
            <p className="text-[12px] text-[#444]">{t("settings.sessions_current_only")}</p>
          </div>
        ) : (
          <>
            {sessions.map((s, i) => (
              <div key={s.session_id || i} data-testid={`session-${i}`} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                <div className="flex items-center gap-3">
                  <Smartphone size={16} className="text-[#A855F7]" />
                  <div>
                    <p className="text-[12px] text-white/80 font-medium">{s.device || s.ip || t("settings.sessions_unknown")}</p>
                    <p className="text-[9px] text-[#444]">{s.created_at ? new Date(s.created_at).toLocaleDateString() : ""}</p>
                  </div>
                </div>
              </div>
            ))}
            <motion.button data-testid="revoke-all-sessions" onClick={revokeAll}
              className="w-full py-2.5 rounded-xl text-[11px] font-medium text-[#FF6B6B] border border-[#FF6B6B]/15 bg-[#FF6B6B]/5 mt-2"
              whileTap={{ scale: 0.97 }}>
              {t("settings.sessions_revoke_all")}
            </motion.button>
          </>
        )}
      </motion.div>
    </SubPage>
  );
};

const SettingsView = ({ onBack, onNavigate, t, locale, setLocale, onOpenPasswordChange }) => {
  const userCtx = useUser();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [notifs, setNotifs] = useState(userCtx?.notifications_enabled !== false);
  const [emailNotifs, setEmailNotifs] = useState(userCtx?.email_notifications !== false);
  const [biometric, setBiometric] = useState(userCtx?.biometric_enabled === true);
  const [darkMode, setDarkMode] = useState(isDark);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsSub, setSettingsSub] = useState(null);

  const persistSetting = async (field, value) => {
    setSaving(true);
    try { await api.updateProfile({ [field]: value }); } catch (error) { void error; }
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
  const toggleDark = () => { const v = !darkMode; setDarkMode(v); toggleTheme(); persistSetting("dark_mode", v); };

  if (settingsSub === "privacy") return <PrivacyView onBack={() => setSettingsSub(null)} t={t} onNavigate={onNavigate} />;
  if (settingsSub === "sessions") return <ActiveSessionsView onBack={() => setSettingsSub(null)} t={t} />;

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
          <MenuRow icon={Moon} label={t("settings.appearance") || t("settings.appearance_label")} desc={darkMode ? t("settings.dark_mode") : (t("common.light") || "Light")} color="#6366F1" isLast right={<Toggle on={darkMode} onToggle={toggleDark} />} />
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
          <MenuRow icon={Eye} label={t("settings.privacy")} color="#888" isLast={false} onClick={() => setSettingsSub("privacy")} />
          <MenuRow icon={Smartphone} label={t("settings.active_sessions")} desc={t("settings.devices")} color="#A855F7" isLast onClick={() => setSettingsSub("sessions")} />
        </div>
      </motion.div>
      {saving && <p className="text-center text-[10px] text-[#00C2FF]/50 animate-pulse mt-1">{t("common.saving") || "Saving..."}</p>}
    </SubPage>
  );
};

// ── Main More Page ──
export const MorePage = ({ onNavigate, kidsReturn, onKidsHandled, isGuest, isDemoMode, onAuthRequired, onLogin, onRegister, onStartDemo }) => {
  const user = useUser();
  const { refreshUser } = user;
  const { t, lang: locale, setLang: setLocale } = useI18n();
  const effectiveLocale = normalizeLocale(locale);
  const localizeText = (value) => {
    if (!value) return value;
    if (typeof value === "object") return value[effectiveLocale] ?? value.de ?? value.en ?? Object.values(value)[0];
    const mapped = literalTranslations[value];
    return mapped ? (mapped[effectiveLocale] ?? mapped.de ?? mapped.en ?? value) : value;
  };
  const isAdmin = isAdminUser(user);
  const isKycVerified = KYC_DISABLED ? true : isKycApprovedOrAdmin(user);
  const showKycRestrictedExperience = !isAdmin && !isGuest && !isDemoMode && !isKycVerified;
  const [subPage, setSubPage] = useState(kidsReturn ? "kids" : null);
  const [profileOpenPw, setProfileOpenPw] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [driverAccess, setDriverAccess] = useState(null);
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("more_open_groups") || "null");
      if (saved) return saved;
    } catch (error) {
      void error;
    }
    // Default: open Mobility, Finance, and Admin sections
    return { mobility: true, finance: true, admin: true };
  });

  // Demo mode: overlay mock user data
  const displayName = isDemoMode ? DEMO_USER.name : (isGuest ? "BidBlitz" : user.name);
  const displayEmail = isDemoMode ? DEMO_USER.email : (isGuest ? (t("auth.signin") || "Sign in to view profile") : (user.display_email || user.login_email || user.email));
  const displayAvatar = isDemoMode ? DEMO_USER.avatar : user.avatar;

  useEffect(() => {
    if (kidsReturn && onKidsHandled) onKidsHandled();
  }, [kidsReturn, onKidsHandled]);

  useEffect(() => {
    if (!isGuest) {
      api.getNotifications(true).then(d => setUnreadCount(d.unread_count || 0)).catch(() => {});
    }
  }, [isGuest]);

  // Driver eligibility — determines if Driver-Modus entry is visible
  useEffect(() => {
    if (isGuest || isDemoMode) { setDriverAccess(null); return; }
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/driver-dashboard/eligibility`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setDriverAccess(d))
      .catch(() => setDriverAccess(null));
  }, [isGuest, isDemoMode]);

  const gatedAction = (fn) => async () => {
    if (isDemoMode) { return; }
    if (isGuest) {
      try {
        await refreshUser();
        await api.getMe();
      } catch {
        onAuthRequired();
        return;
      }
    }
    fn();
  };

  // Sub-page rendering — only for authenticated users
  if (!isGuest) {
    if (subPage === "profile") {
      // Fix: Pass primitive values directly instead of creating new object
      return <ProfileView 
        userId={user.id}
        userName={user.name}
        userEmail={user.display_email || user.login_email || user.email}
        userRole={user.role}
        userBalance={user.balance}
        userCurrency={user.currency}
        userAvatar={user.avatar}
        userIsPremium={user.isPremium}
        userCreatedAt={user.created_at}
        onBack={() => { setSubPage(null); setProfileOpenPw(false); }} 
        t={t} 
        initialOpenPw={profileOpenPw} 
      />;
    }
    if (subPage === "settings") {
      return <SettingsView onBack={() => setSubPage(null)} onNavigate={onNavigate} t={t} locale={locale} setLocale={setLocale} onOpenPasswordChange={() => { setProfileOpenPw(true); setSubPage("profile"); }} />;
    }
    if (subPage === "kyc") {
      onNavigate("/kyc");
      return null;
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
    if (subPage === "push-settings") {
      return (
        <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
          <div className="px-4 pt-4 pb-3 flex items-center gap-3">
            <button onClick={() => setSubPage(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}}>
              <ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/>
            </button>
            <h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Push-Benachrichtigungen</h1>
          </div>
          <div className="px-4 py-5">
            <PushNotificationToggle />
          </div>
        </div>
      );
    }
  }

  const accountMenu = [
    { id: "profile", icon: User, label: t("more.profile"), desc: t("more.profile_desc"), color: "#00C2FF", action: gatedAction(() => setSubPage("profile")) },
    { id: "notifications-settings", icon: Bell, label: t("more.push_notifications") || "Push-Benachrichtigungen", desc: t("more.push_notifications_desc") || "Echtzeit-Updates für SOS & mehr", color: "#FFB800", action: gatedAction(() => setSubPage("push-settings")) },
    { id: "cards", icon: CreditCard, label: t("more.payment_methods"), desc: t("more.cards_desc"), color: "#A855F7", action: gatedAction(() => {}) },
    { id: "security", icon: Shield, label: t("more.security"), desc: t("more.security_desc"), color: "#00D26A", action: gatedAction(() => setSubPage("kyc")) },
  ];

  // Premium Finance Features
  const financeMenu = [
    { id: "split-bill", icon: Users, label: t("split.title") || "Rechnung teilen", desc: t("split.menu_desc") || "Split bills with friends", color: "#FF8C42", action: gatedAction(() => onNavigate("/split-bill")) },
    { id: "p2p-handle", icon: AtSign, label: t("more.send_receive") || "Senden & Empfangen", desc: t("more.send_receive_desc") || "Per @handle wie Venmo/Revolut", color: "#00E0FF", action: gatedAction(() => onNavigate("/p2p")) },
    { id: "card", icon: CreditCard, label: t("more.bidblitz_card") || "BidBlitz Card", desc: t("more.bidblitz_card_desc") || "Virtuelle & physische Debit-Card", color: "#FFD166", action: gatedAction(() => onNavigate("/card")) },
    { id: "commerce-center", icon: Sparkles, label: t("more.commerce_center") || "Commerce Center", desc: t("more.commerce_center_desc") || "Marketplace, Flash Sales, Penny Auctions, Live Shopping", color: "#FF7A18", action: gatedAction(() => onNavigate("/commerce-center")) },
    { id: "mobility-center", icon: Car, label: t("more.mobility_center") || "Mobility Center", desc: t("more.mobility_center_desc") || "Taxi, Scooter, EV Charging und Tracking zentral", color: "#00C2FF", action: gatedAction(() => onNavigate("/mobility-center")) },
    { id: "live", icon: Radio, label: t("more.live_shopping") || "Live Shopping", desc: t("more.live_shopping_desc") || "Streams & Deals live", color: "#FF4060", action: () => onNavigate("/live") },
    { id: "groupchat", icon: MessageSquare, label: t("more.groupchat") || "Gruppenchat", desc: t("more.groupchat_desc") || "WeChat-style mit @handle-Invites", color: "#00E89D", action: gatedAction(() => onNavigate("/groupchat")) },
    { id: "roundup", icon: PiggyBank, label: t("more.roundup") || "Round-up Sparen", desc: t("more.roundup_desc") || "Auto-runden & beiseite legen", color: "#FF6B9D", action: gatedAction(() => onNavigate("/roundup")) },
    { id: "apartments", icon: Home, label: t("more.apartments") || "Apartments", desc: t("more.apartments_desc") || "Airbnb-Style Übernachtungen", color: "#F4A261", action: () => onNavigate("/apartments") },
    { id: "virtual-cards", icon: CreditCard, label: t("cards.title") || "Virtuelle Karten", desc: t("cards.menu_desc") || "Einmal-Karten für Online-Shopping", color: "#B068FF", action: gatedAction(() => onNavigate("/virtual-cards")) },
    { id: "savings", icon: PiggyBank, label: t("savings.title") || "Sparziele", desc: t("savings.menu_desc") || "Automatisch sparen", color: "#00E89D", action: gatedAction(() => onNavigate("/savings")) },
    { id: "bnpl", icon: BadgePercent, label: t("bnpl.title") || "Später zahlen", desc: t("bnpl.menu_desc") || "Buy now, pay later", color: "#00D4FF", action: gatedAction(() => onNavigate("/bnpl")) },
    { id: "gift-cards", icon: Gift, label: t("giftcards.title") || "Geschenkkarten", desc: t("giftcards.menu_desc") || "Gift cards kaufen & verschenken", color: "#FFD166", action: gatedAction(() => onNavigate("/gift-cards")) },
    { id: "bills", icon: Banknote, label: t("bills.title") || "Rechnungen & eSIM", desc: t("bills.menu_desc") || "Strom, Gas, eSIM bezahlen", color: "#00C2FF", action: gatedAction(() => onNavigate("/bills")) },
    { id: "credit-score", icon: Shield, label: t("more.credit_score"), desc: t("more.credit_score_desc"), color: "#10B981", action: gatedAction(() => onNavigate("/credit-score")) },
    { id: "ai-assistant", icon: Sparkles, label: t("more.ai_assistant") || "BlitzBot", desc: t("more.ai_assistant_desc") || "KI-Finanzassistent", color: "#A855F7", action: gatedAction(() => onNavigate("/ai-assistant")) },
    { id: "crypto", icon: TrendingUp, label: t("more.crypto_wallet") || "Krypto Wallet", desc: t("more.crypto_wallet_desc") || "BTC, ETH, SOL kaufen & verkaufen", color: "#F7931A", action: gatedAction(() => onNavigate("/crypto")) },
    { id: "pos", icon: Store, label: t("more.pos") || "POS / Kasse", desc: t("more.pos_desc") || "Warenwirtschaft, Kasse & Zahlungen", color: "#00E89D", action: gatedAction(() => onNavigate("/pos")) },
    { id: "qr-tables", icon: Store, label: t("more.qr_tables") || "QR-Tisch-Bestellung", desc: t("more.qr_tables_desc") || "Tisch-QR-Codes · Auto-Bestellung · Wallet-Zahlung", color: "#00C2FF", action: gatedAction(() => onNavigate("/merchant/qr-tables")) },
    { id: "staff", icon: Users, label: t("more.staff_time") || "Mitarbeiter & Zeiterfassung", desc: t("more.staff_time_desc") || "Check-in/out · Schichten · Urlaub · Reports", color: "#A855F7", action: gatedAction(() => onNavigate("/merchant/staff")) },
    { id: "budget", icon: BarChart3, label: t("more.budget") || "Budgetplaner", desc: t("more.budget_desc") || "Ausgaben & Limits", color: "#3B82F6", action: gatedAction(() => onNavigate("/budget")) },
  ];

  const growthMenu = filterStoreSafeItems([
    { id: "gaming", icon: Gamepad2, label: t("more.gaming"), desc: t("more.gaming_desc"), color: "#F59E0B", action: gatedAction(() => onNavigate("/gaming")), roles: ["all"] },
    { id: "loyalty", icon: Coins, label: t("loyalty.title") || "Coins & Cashback", desc: t("loyalty.menu_desc") || "Verdiene mit jeder Transaktion", color: "#FFD700", action: gatedAction(() => onNavigate("/loyalty")), roles: ["all"] },
    { id: "rewards", icon: Trophy, label: t("rewards.title") || "Rewards", desc: t("rewards.menu_desc") || "Daily rewards & milestones", color: "#00E89D", action: gatedAction(() => onNavigate("/rewards")), roles: ["all"] },
    { id: "mining", icon: Cpu, label: t("mining.title") || "Mining", desc: t("mining.menu_desc") || "Mine BLZ tokens", color: "#00E89D", action: gatedAction(() => onNavigate("/mining")), roles: ["all"] },
    { id: "mining-trust", icon: Shield, label: t("mining.trust_title") || "Mining Server", desc: t("mining.trust_menu_desc") || "Dubai & Abu Dhabi Server transparent zeigen", color: "#F59E0B", action: gatedAction(() => onNavigate("/mining-trust")), roles: ["all"] },
    { id: "referral", icon: Gift, label: t("referral.title"), desc: t("referral.menu_desc"), color: "#FFD700", action: gatedAction(() => setSubPage("referral")), roles: ["all"] },
    {
      id: "notifications", icon: Bell, label: t("notif.title"), desc: unreadCount > 0 ? `${unreadCount} ${t("notif.unread")}` : t("notif.menu_desc"), color: "#FFB800",
      action: gatedAction(() => setSubPage("notifications")),
      badge: unreadCount > 0 ? unreadCount : null, roles: ["all"],
    },
    { id: "influencer", icon: TrendingUp, label: t("influencer.title") || "Influencer", desc: t("influencer.menu_desc") || "Earn reward credits", color: "#00E0FF", action: gatedAction(() => onNavigate("/influencer")), roles: ["all"] },
    { id: "investor", icon: Star, label: t("investor.title") || "Investor", desc: t("investor.menu_desc") || "Invest in BidBlitz", color: "#FFD166", action: () => onNavigate("/investor"), roles: ["all"] },
    { id: "verification", icon: ShieldCheck, label: t("verify.title") || "Identitätsverifizierung", desc: t("verify.menu_desc") || "Rolle verifizieren", color: "#A855F7", action: gatedAction(() => onNavigate("/verification")), roles: ["all"] },
    { id: "activity", icon: Activity, label: t("activity.title"), desc: t("activity.menu_desc"), color: "#00C2FF", action: gatedAction(() => setSubPage("activity")), roles: ["all"] },
    // Reselling, BlitzJobs, Cashback — for customers
    { id: "reselling", icon: Star, label: "Reselling", desc: "Sneakers, Streetwear verkaufen", color: "#F43F5E", action: gatedAction(() => onNavigate("/reselling")), roles: ["user", "admin"] },
    { id: "blitzjobs", icon: Cpu, label: "BlitzJobs", desc: "Micro-Jobs, Geld verdienen", color: "#22C55E", action: gatedAction(() => onNavigate("/blitzjobs")), roles: ["user", "admin"] },
    { id: "cashback", icon: Coins, label: "Cashback Shopping", desc: "2-8% bei Partner-Shops", color: "#F59E0B", action: gatedAction(() => onNavigate("/cashback")), roles: ["user", "admin"] },
    { id: "quests", icon: Sparkles, label: "Tägliche Quests", desc: "3 Aufgaben täglich · Bis zu 70+ BLZ gewinnen", color: "#00C2FF", action: gatedAction(() => onNavigate("/quests")), roles: ["all"] },
    { id: "directory", icon: Building2, label: "Lokales Verzeichnis", desc: "Ärzte, Handwerker, Dienstleister in der Nähe", color: "#10B981", action: () => onNavigate("/directory"), roles: ["all"] },
    { id: "ads", icon: TrendingUp, label: "Werbung schalten", desc: "Werbekampagnen erstellen · Banner, Push-Notifications", color: "#F59E0B", action: gatedAction(() => onNavigate("/ads")), roles: ["all"] },
    { id: "ai-content", icon: Sparkles, label: "AI Content Generator", desc: "KI schreibt Werbetexte, Beschreibungen & Push-Nachrichten in Sekunden", color: "#A855F7", action: gatedAction(() => onNavigate("/ai/content")), roles: ["all"] },
    { id: "instant-credit", icon: Zap, label: "Sofort-Kredit", desc: "Bis 100€ in 3 Minuten · 0% Zinsen · 30 Tage Rückzahlung", color: "#FFB800", action: gatedAction(() => onNavigate("/instant-credit")), roles: ["all"] },
    { id: "kids-premium", icon: Heart, label: "Kids Premium Features", desc: "Aufgaben · AI Buddy · Geschenke · Badges · Kurse · Spiele · 11 neue Features", color: "#FF4060", action: gatedAction(() => onNavigate("/kids-premium")), roles: ["all"] },
    { id: "bookings", icon: Calendar, label: "Buchen & Reservieren", desc: "Hotels, Restaurants, Ärzte, Handwerker buchen", color: "#8B5CF6", action: gatedAction(() => onNavigate("/bookings")), roles: ["all"] },
    { id: "rewards-hub", icon: Sparkles, label: "Belohnungen & Top-Liste", desc: "Streak · Leaderboard · BLZ-Tausch · Geschenk-Codes", color: "#FF6B35", action: gatedAction(() => onNavigate("/rewards-hub")), roles: ["all"] },
    { id: "marketing-hub", icon: Sparkles, label: "Marketing & Boost", desc: "Anzeigen pushen · Werbung · KYC Express · Sofort-Auszahlung", color: "#FFB800", action: gatedAction(() => onNavigate("/marketing-hub")), roles: ["all"] },
    { id: "reward-hub", icon: Gift, label: "Reward Hub", desc: "Mystery Boxen, Glücksrad, Cashback & Coupons", color: "#8FEFFF", action: gatedAction(() => onNavigate("/rewards")), roles: ["all"] },
    { id: "move-earn", icon: Activity, label: "Move & Earn", desc: "Schritte, Rides, Eco Rewards und Missionen", color: "#37FF8B", action: gatedAction(() => onNavigate("/move")), roles: ["all"] },
    { id: "spin-wheel", icon: Sparkles, label: "Glücksrad", desc: "Direkt ins Daily Spin Wheel", color: "#FFD700", action: gatedAction(() => onNavigate("/spin-wheel")), roles: ["all"] },
    { id: "reward-plinko", icon: Target, label: "Reward Plinko", desc: "Tickets droppen, BidCoins gewinnen, Premium-Boost sichern", color: "#FF7A45", action: gatedAction(() => onNavigate("/reward-plinko")), roles: ["all"] },
    { id: "classifieds", icon: Sparkles, label: "Kleinanzeigen", desc: "Lokal kaufen & verkaufen · Gratis inserieren", color: "#00C2FF", action: () => onNavigate("/classifieds"), roles: ["all"] },
    { id: "premium", icon: Crown, label: "BidBlitz Premium", desc: "2× Mining · 0€ Gebühren · 50 BLZ/Monat · 5% Cashback", color: "#FFD700", action: gatedAction(() => onNavigate("/premium")), roles: ["all"] },
    { id: "lottery", icon: Sparkles, label: "BLZ Lotterie", desc: "Tägliche Ziehung · Jackpot 5000 BLZ · Nur 10 BLZ/Los", color: "#A855F7", action: gatedAction(() => onNavigate("/lottery")), roles: ["all"] },
    { id: "stories", icon: MessageCircle, label: "Social Feed", desc: "Stories, Deals, Erfolge teilen", color: "#6366F1", action: gatedAction(() => onNavigate("/stories")), roles: ["all"] },
    { id: "live-auctions", icon: Zap, label: "Live Auktionen", desc: "Echtzeit-Bieten mit Countdown", color: "#EF4444", action: gatedAction(() => onNavigate("/live-auctions")), roles: ["all"] },
    { id: "social-hub", icon: Users, label: "Social Hub", desc: "Group Buy, Score, Visitenkarte", color: "#8B5CF6", action: gatedAction(() => onNavigate("/social-hub")), roles: ["all"] },
    { id: "chat", icon: MessageCircle, label: "Nachrichten", desc: "Chats mit Käufern & Verkäufern", color: "#00C2FF", action: gatedAction(() => onNavigate("/chat")), roles: ["all"] },
    { id: "user-stats", icon: BarChart3, label: "Meine Statistiken", desc: "Verdienst, Aktivitäten, Trends", color: "#22C55E", action: gatedAction(() => onNavigate("/user-stats")), roles: ["all"] },
    { id: "blitzlearn", icon: Star, label: "BlitzLearn", desc: "Skills lernen & unterrichten", color: "#3B82F6", action: gatedAction(() => onNavigate("/blitzlearn")), roles: ["all"] },
    { id: "blitzhub", icon: Zap, label: "BlitzHub", desc: "Karten, Battles, Boxen, KYC", color: "#F97316", action: gatedAction(() => onNavigate("/blitzhub")), roles: ["all"] },
    { id: "leaderboard", icon: Trophy, label: "Rangliste", desc: "Top Sparer, Gamer & Verdiener", color: "#FFD700", action: gatedAction(() => onNavigate("/leaderboard")), roles: ["all"] },
    { id: "city", icon: MapPin, label: "City Services", desc: "Parken, Tickets, Deals, BNPL", color: "#EF4444", action: gatedAction(() => onNavigate("/city")), roles: ["all"] },
    { id: "blitzpay", icon: Wifi, label: "BlitzPay NFC", desc: "Kontaktlos bezahlen mit Wallet", color: "#06B6D4", action: gatedAction(() => onNavigate("/blitzpay")), roles: ["all"] },
    { id: "crypto-earn", icon: Coins, label: "Crypto Earn", desc: "Zinsen verdienen auf Coins", color: "#F59E0B", action: gatedAction(() => onNavigate("/crypto-earn")), roles: ["all"] },
    { id: "crypto-baskets", icon: PiggyBank, label: "Crypto Baskets", desc: "Thematische Portfolios", color: "#3B82F6", action: gatedAction(() => onNavigate("/crypto-baskets")), roles: ["all"] },
    { id: "derivatives", icon: Zap, label: "Derivatives", desc: "Hebel-Trading & Futures", color: "#F97316", action: gatedAction(() => onNavigate("/derivatives")), roles: ["all"] },
    { id: "levelup", icon: Crown, label: "Level Up", desc: "Premium Rewards & Vorteile", color: "#EAB308", action: gatedAction(() => onNavigate("/levelup")), roles: ["all"] },
    { id: "predictions", icon: Activity, label: "Prediction Markets", desc: "Wette auf die Zukunft", color: "#8B5CF6", action: gatedAction(() => onNavigate("/predictions")), roles: ["all"] },
    { id: "blitzcard", icon: CreditCard, label: "BlitzCard Visa", desc: "Debit-Karte mit Cashback", color: "#0EA5E9", action: gatedAction(() => onNavigate("/blitzcard")), roles: ["all"] },
    { id: "supercharger", icon: Zap, label: "Supercharger", desc: "BLZ staken, Rewards verdienen", color: "#06B6D4", action: gatedAction(() => onNavigate("/supercharger")), roles: ["all"] },
    { id: "defi-wallet", icon: Globe, label: "DeFi Wallet", desc: "Self-Custody & DApp Browser", color: "#10B981", action: gatedAction(() => onNavigate("/defi-wallet")), roles: ["all"] },
    { id: "crypto-loans", icon: Banknote, label: "Krypto-Kredit", desc: "Crypto hinterlegen, EUR erhalten", color: "#22C55E", action: gatedAction(() => onNavigate("/crypto-loans")), roles: ["all"] },
    { id: "p2p-lending", icon: Users, label: "P2P Lending", desc: "Privatkredite vergeben & aufnehmen", color: "#14B8A6", action: gatedAction(() => onNavigate("/p2p-lending")), roles: ["all"] },
    { id: "trading-bot", icon: Cpu, label: "AI Trading Bot", desc: "Automatisierter Handel", color: "#6366F1", action: gatedAction(() => onNavigate("/trading-bot")), roles: ["all"] },
    { id: "live-shopping", icon: Monitor, label: "Live Shopping", desc: "Livestream + sofort kaufen", color: "#F43F5E", action: gatedAction(() => onNavigate("/live-shopping")), roles: ["all"] },
    { id: "creators", icon: Star, label: "Creators", desc: "Abos, Trinkgeld, Exklusiv-Content", color: "#EC4899", action: gatedAction(() => onNavigate("/creators")), roles: ["all"] },
    { id: "skills-market", icon: Sparkles, label: "Skills Marktplatz", desc: "1-zu-1 Video-Sessions buchen", color: "#7C3AED", action: gatedAction(() => onNavigate("/skills-market")), roles: ["all"] },
    { id: "invoicing", icon: Pencil, label: "Rechnungen", desc: "Erstellen & verwalten", color: "#D97706", action: gatedAction(() => onNavigate("/invoicing")), roles: ["all"] },
    { id: "qr-menu", icon: Scan, label: "QR Menuekarte", desc: "Restaurants & Bestellungen", color: "#EA580C", action: gatedAction(() => onNavigate("/qr-menu")), roles: ["all"] },
    { id: "termin-booking", icon: Calendar, label: "Termine buchen", desc: "Friseur, Arzt, Wellness & mehr", color: "#0EA5E9", action: gatedAction(() => onNavigate("/termin-booking")), roles: ["all"] },
    { id: "contracts", icon: ShieldCheck, label: "Digitale Vertraege", desc: "E-Signatur & Vorlagen", color: "#059669", action: gatedAction(() => onNavigate("/contracts")), roles: ["all"] },
    { id: "utilities", icon: Sparkles, label: "Extras & Tools", desc: "Abo-Boxen, Musik, VPN, Cloud & mehr", color: "#06B6D4", action: gatedAction(() => onNavigate("/utilities")), roles: ["all"] },
    { id: "engage", icon: Gamepad2, label: "Fun & Verdienen", desc: "Gluecksrad, Quiz, Coupons, Airdrops", color: "#F59E0B", action: gatedAction(() => onNavigate("/engage")), roles: ["all"] },
    { id: "viral", icon: Zap, label: "Viral & Social", desc: "BlitzClips, Challenges, Share & Earn", color: "#EC4899", action: gatedAction(() => onNavigate("/viral")), roles: ["all"] },
    { id: "blitz-boost", icon: TrendingUp, label: "BlitzBoost", desc: "Social Media Booster – Follower, Likes, Views", color: "#E1306C", action: gatedAction(() => onNavigate("/blitz-boost")), roles: ["all"] },
    { id: "blitz-transfer", icon: Wifi, label: "BlitzTransfer", desc: "Große Dateien sicher versenden (bis 10GB)", color: "#00B2FF", action: gatedAction(() => onNavigate("/blitz-transfer")), roles: ["all"] },
    { id: "blitz-mine", icon: Zap, label: "BlitzMine", desc: "Tippe täglich & mine BLZ – Pi Network-Style", color: "#FFD700", action: gatedAction(() => onNavigate("/blitz-mine")), roles: ["all"] },
    { id: "challenges", icon: Zap, label: "Tägliche Challenges", desc: "Verdiene BLZ mit täglichen Aufgaben", color: "#00E0FF", action: gatedAction(() => onNavigate("/challenges")), roles: ["all"] },
    { id: "achievements", icon: Sparkles, label: "Achievements", desc: "Schalte Badges frei & sammle Belohnungen", color: "#FFD166", action: gatedAction(() => onNavigate("/achievements")), roles: ["all"] },
    { id: "friends", icon: Users, label: t("more.friends") || "Freunde", desc: t("more.friends_desc") || "Freunde hinzufügen & verwalten", color: "#10B981", action: gatedAction(() => onNavigate("/friends")), roles: ["all"] },
    { id: "arcade", icon: Gamepad2, label: "Arcade", desc: "100+ Games · Casino · Snake — zahl mit BLZ", color: "#A855F7", action: gatedAction(() => onNavigate("/arcade")), roles: ["all"] },
    { id: "affiliate", icon: Share2, label: "Partner-Programm", desc: "5€ pro Anmeldung + 10% Provision — werde reich mit Empfehlungen 🚀", color: "#FF6B9D", action: gatedAction(() => onNavigate("/affiliate")), roles: ["all"] },
    // Merchant-only items
    { id: "pay", icon: Wallet, label: t("pay.title") || "Bezahlen", desc: t("pay.menu_desc") || "Barcode & NFC Zahlungen", color: "#00E89D", action: gatedAction(() => onNavigate("/pay")), roles: ["merchant", "admin"] },
    { id: "terminal", icon: Scan, label: t("terminal.title") || "Zahlungsterminal", desc: t("terminal.menu_desc") || "Zahlungen annehmen", color: "#FFB800", action: gatedAction(() => onNavigate("/terminal")), roles: ["merchant", "admin"] },
    { id: "merchant-dashboard", icon: Store, label: t("merch.title") || "Händler Dashboard", desc: t("merch.menu_desc") || "Filialen & Kassen", color: "#FF8C42", action: gatedAction(() => onNavigate("/merchant-dashboard")), roles: ["merchant", "admin"] },
    { id: "merchant-onboarding", icon: TrendingUp, label: t("onboarding.title") || "Händler werden", desc: t("onboarding.menu_desc") || "Kostenlose Testphase", color: "#00C2FF", action: () => onNavigate("/merchant-landing"), roles: ["merchant", "admin"] },
    { id: "merchant-pricing", icon: CreditCard, label: t("pricing.title") || "Händler-Tarife & Preise", desc: t("pricing.menu_desc") || "Tarife, Gebühren & Terminals", color: "#FFD166", action: () => onNavigate("/merchant-pricing"), roles: ["merchant", "admin"] },
  ]).filter(item => {
    if (!item.roles) return true;
    if (item.roles.includes("all")) return true;
    const userRole = user.role || "user";
    return item.roles.includes(userRole);
  });

  const mobilityMenu = [
    { id: "mobility-map", icon: MapPin, label: t("more.live_map") || "Live Map", desc: t("more.car_rental_desc"), color: "#3B82F6", action: gatedAction(() => onNavigate("/mobility-map")) },
    { id: "friends-map", icon: Users, label: t("more.friends_map") || "Freunde Karte", desc: t("more.friends_map_desc") || "Sieh Freunde in deiner Nähe", color: "#A855F7", action: gatedAction(() => onNavigate("/friends-map")) },
    { id: "car-rental", icon: Car, label: t("more.car_rental"), desc: t("more.car_rental_desc"), color: "#00C2FF", action: () => onNavigate("/car-rental") },
    { id: "car-rental-bookings", icon: Calendar, label: t("more.my_car_bookings"), desc: t("more.my_car_bookings_desc"), color: "#00C2FF", action: gatedAction(() => onNavigate("/car-rental/my-bookings")) },
    ...(driverAccess?.is_verified ? [
      { id: "driver-mode", icon: Car, label: "Fahrer-Modus", desc: "Online gehen, Fahrten annehmen & verdienen", color: "#A855F7", action: gatedAction(() => onNavigate("/driver-dashboard")) },
    ] : []),
    ...(user.role === "merchant" || isAdmin ? [
      { id: "car-rental-vendor", icon: Car, label: t("more.vendor_dashboard"), desc: t("more.vendor_dashboard_desc"), color: "#00D26A", action: gatedAction(() => onNavigate("/car-rental/vendor")) },
    ] : []),
  ];

  const appMenu = [
    { id: "notifications", icon: Bell, label: "Benachrichtigungen", desc: "Push-Benachrichtigungen verwalten", color: "#00C2FF", action: gatedAction(() => onNavigate("/notifications")) },
    { id: "settings", icon: Settings, label: t("more.settings"), desc: t("more.settings_desc"), color: "#888", action: gatedAction(() => setSubPage("settings")) },
    { id: "appearance", icon: Moon, label: t("more.appearance"), desc: t("more.appearance_desc"), color: "#6366F1" },
  ];

  const supportMenu = [
    { id: "help", icon: HelpCircle, label: t("more.help"), desc: t("more.help_desc"), color: "#FF6B6B", action: gatedAction(() => setSubPage("support")) },
    { id: "support-chat", icon: MessageCircle, label: t("more.support_chat"), desc: t("more.support_chat_desc"), color: "#00C2FF", action: gatedAction(() => onNavigate("/support-chat")) },
  ];

  const legalMenu = [
    { id: "legal-agb", icon: ShieldCheck, label: "AGB", desc: "Allgemeine Geschäftsbedingungen", color: "#00C2FF", action: () => onNavigate("/legal/agb") },
    { id: "legal-datenschutz", icon: Lock, label: "Datenschutz", desc: "DSGVO, Cookies, Ihre Rechte", color: "#00E89D", action: () => onNavigate("/legal/datenschutz") },
    { id: "legal-impressum", icon: Mail, label: "Impressum", desc: "Angaben zum Anbieter", color: "#A855F7", action: () => onNavigate("/legal/impressum") },
    { id: "legal-sicherheit", icon: Shield, label: "Sicherheit", desc: "2FA, Verschlüsselung, Schutz", color: "#FFD700", action: () => onNavigate("/legal/sicherheit") },
  ];

  const adminMenu = isAdmin ? [
    { id: "admin-dashboard", icon: LayoutDashboard, label: t("more.admin_dashboard"), desc: t("more.admin_desc"), color: "#FF6B6B", action: () => onNavigate("/admin") },
    { id: "admin-wallet", icon: Wallet, label: "Wallet Reconciliation Center", desc: "Analyse, Duplikate, Queue, Read-only History", color: "#00E89D", action: () => onNavigate("/admin/wallet") },
    { id: "admin-taxi", icon: Car, label: "Taxi-Administration", desc: "Fahrer, Fahrten, Preis-Einstellungen", color: "#A855F7", action: () => onNavigate("/admin/taxi") },
    { id: "admin-revenue", icon: TrendingUp, label: "Umsatz-Dashboard", desc: "Live-Einnahmen · MRR · Händler-Akquise", color: "#00D26A", action: () => onNavigate("/admin/revenue") },
    { id: "admin-legal", icon: ShieldCheck, label: "Legal-Pages Editor", desc: "AGB, Datenschutz, Impressum bearbeiten", color: "#00C2FF", action: () => onNavigate("/admin/legal") },
    { id: "admin-merchant-features", icon: ShieldCheck, label: "Händler-Module freischalten", desc: "Warenwirtschaft, Zeiterfassung & Co. pro Händler an/aus", color: "#FFD700", action: () => onNavigate("/admin/merchant-features") },
    { id: "admin-audit-log", icon: FileText, label: "Admin Audit Log", desc: "History aller Feature-Freischaltungen & Preisänderungen", color: "#8B5CF6", action: () => onNavigate("/admin/audit-log") },
    { id: "admin-diag", icon: Activity, label: "Routing Diagnostics", desc: "Live-Übersicht aller API-Routen, gemounteten Module & Silent-Failures", color: "#06B6D4", action: () => onNavigate("/admin/diag") },
    { id: "admin-push-broadcast", icon: Bell, label: "Push Notifications", desc: "Broadcast an alle User oder Gruppen", color: "#EC4899", action: () => onNavigate("/admin/push-broadcast") },
    { id: "admin-analytics", icon: TrendingUp, label: "Analytics Dashboard", desc: "User-Aktivität, Revenue, Feature-Usage", color: "#06B6D4", action: () => onNavigate("/admin/analytics") },
    { id: "staff-gps", icon: MapPin, label: "Staff GPS Tracking", desc: "Live-Standorte aller Mitarbeiter", color: "#10B981", action: () => onNavigate("/staff/gps") },
    { id: "admin-car-rental", icon: Car, label: t("more.admin_car_rental"), desc: t("more.admin_car_rental_desc"), color: "#00C2FF", action: () => onNavigate("/car-rental/admin") },
    { id: "admin-support", icon: MessageCircle, label: t("more.admin_support"), desc: t("more.admin_support_desc"), color: "#A855F7", action: () => onNavigate("/admin/support") },
  ] : [];

  const quickAccessMenu = [
    { id: "express-checkout", icon: Zap, label: "Express Checkout", desc: "1-Klick Zahlung mit gespeicherten Daten", color: "#F59E0B", action: () => onNavigate("/express-checkout") },
    { id: "hotels-sabre", icon: Building2, label: "Sabre Hotels", desc: "Kettenhotels weltweit buchen", color: "#3B82F6", action: () => onNavigate("/hotels/sabre") },
    { id: "pos-extended", icon: Package, label: "POS Extended", desc: "Kassensturz, Offline-Mode, Bondrucker", color: "#8B5CF6", action: () => onNavigate("/pos/extended") },
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

  // ── NEW: Compact search + accordion + 2-col grid renderer ──
  const GRID_GROUPS = [
    { id: "quick", title: `🚀 ${t("more.quick_access") || "Quick Access"}`, color: "#F59E0B", items: quickAccessMenu },
    { id: "mobility", title: t("more.mobility") || "Mobilität", color: "#00C2FF", items: mobilityMenu },
    { id: "finance",  title: t("more.finance") || "Premium Finance", color: "#10B981", items: financeMenu },
    { id: "account",  title: t("more.account"), color: "#A855F7", items: accountMenu },
    { id: "growth",   title: t("more.growth"), color: "#FFD700", items: growthMenu },
    { id: "app",      title: t("more.app"), color: "#EC4899", items: appMenu },
    { id: "support",  title: t("more.support"), color: "#FF6B6B", items: supportMenu },
    { id: "legal",    title: "Rechtliches", color: "#00E89D", items: legalMenu },
    ...(adminMenu.length ? [{ id: "admin", title: "Admin", color: "#F97316", items: adminMenu }] : []),
  ].filter((g) => g.items && g.items.length > 0);

  const PRE_KYC_ALLOWED_IDS = new Set([
    "profile",
    "notifications-settings",
    "security",
    "notifications",
    "settings",
    "help",
    "support-chat",
    "pos",
    "pay",
    "terminal",
    "merchant-dashboard",
    "merchant-onboarding",
    "merchant-pricing",
    "staff",
    "qr-tables",
    "legal-agb",
    "legal-datenschutz",
    "legal-impressum",
    "legal-sicherheit",
  ]);

  const visibleGroups = showKycRestrictedExperience
    ? GRID_GROUPS.map((group) => ({
        ...group,
        items: (group.items || []).filter((item) => PRE_KYC_ALLOWED_IDS.has(item.id)),
      })).filter((group) => group.items.length > 0)
    : GRID_GROUPS;

  const toggleGroup = (id) => {
    setOpenGroups((p) => {
      const nxt = { ...p, [id]: !p[id] };
      try { localStorage.setItem("more_open_groups", JSON.stringify(nxt)); } catch (error) { void error; }
      return nxt;
    });
  };

  const searchNorm = search.trim().toLowerCase();
  const filteredGroups = searchNorm
    ? visibleGroups.map((g) => ({
        ...g,
        items: g.items.filter((it) =>
          (localizeText(it.label) || "").toLowerCase().includes(searchNorm) ||
          (localizeText(it.desc) || "").toLowerCase().includes(searchNorm)
        ),
      })).filter((g) => g.items.length > 0)
    : visibleGroups;

  const renderGridGroups = () => (
    <div className="space-y-3">
      {filteredGroups.map((g, idx) => {
        const isOpen = !!openGroups[g.id] || !!searchNorm; // force open when searching
        return (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * idx }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}
          >
            <button
              data-testid={`group-toggle-${g.id}`}
              onClick={() => toggleGroup(g.id)}
              className="w-full flex items-center gap-2.5 px-4 py-3"
            >
              <span
                className="w-1.5 h-5 rounded-full"
                style={{ background: g.color }}
              />
              <p className="text-[12px] font-bold uppercase tracking-wide text-white/80 flex-1 text-left">
                {localizeText(g.title)}
              </p>
              <span className="text-[10px] text-white/65">{g.items.length}</span>
              <motion.div animate={{ rotate: isOpen ? 90 : 0 }}>
                <ChevronRight size={14} className="text-white/65" />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    {g.items.map((item) => (
                      <GridTile key={item.id} item={{ ...item, label: localizeText(item.label), desc: localizeText(item.desc) }} color={g.color} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      {filteredGroups.length === 0 && (
        <div className="text-center py-10 text-[12px] text-white/65">
          {(t("common.no_results_for") || "Keine Treffer für")} „{search}“
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      data-testid="more-page"
      className="min-h-screen relative overflow-hidden"
      dir={isRtlLanguage(locale) ? "rtl" : "ltr"}
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient */}
      <motion.div
        className="absolute top-[-18%] left-1/2 -translate-x-1/2 w-[80vw] max-w-[480px] h-[80vw] max-h-[480px] rounded-full pointer-events-none"
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

      {/* Guest CTA Bar */}
      {isGuest && !isDemoMode && (
        <GuestCTABar onLogin={onLogin} onRegister={onRegister} onStartDemo={onStartDemo} isDemoMode={isDemoMode} />
      )}

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
          onClick={gatedAction(() => setSubPage("profile"))}
        >
          <div
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full pointer-events-none"
            style={{ background: "rgba(0,194,255,0.06)", filter: "blur(30px)" }}
          />
          <div className="relative flex-shrink-0">
            <img
              src={displayAvatar}
              alt="Avatar"
              className="w-[52px] h-[52px] rounded-full object-cover"
              style={{ border: "2px solid rgba(0,194,255,0.2)", boxShadow: "0 0 16px rgba(0,194,255,0.08)" }}
            />
            {((!isGuest && user.isPremium) || isDemoMode) && (
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
            <p className="text-[14px] font-semibold font-outfit text-white truncate">{displayName}</p>
            <p className="text-[11px] text-white/60 font-medium truncate">{displayEmail}</p>
          </div>
          <ChevronRight size={14} className="text-white/55 flex-shrink-0" />
        </motion.div>

        {/* ── Alle Services ── */}
        {!showKycRestrictedExperience && <motion.button
          onClick={() => onNavigate("/all-services")}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl mb-3"
          style={{ background: "linear-gradient(135deg, rgba(0,194,255,0.08), rgba(16,185,129,0.06))", border: "1px solid rgba(0,194,255,0.12)" }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          data-testid="more-all-services"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,194,255,0.12)" }}>
            <LayoutDashboard size={18} style={{ color: "#00C2FF" }} />
          </div>
          <div className="flex-1 text-left">
            <span className="text-[13px] font-semibold text-white">{t("home.all_services") || "Alle Services"}</span>
            <p className="text-[10px] text-white/60">{t("home.all_services_desc") || "60+ Features entdecken"}</p>
          </div>
          <ChevronRight size={14} className="text-white/60" />
        </motion.button>}

        {showKycRestrictedExperience && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4"
            data-testid="pre-kyc-more-gate"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/10">
                <ShieldCheck size={16} className="text-amber-300" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold text-white">{t("kyc.pre_gate_title") || "Vor KYC nur Basisbereiche sichtbar"}</p>
                <p className="mt-1 text-[11px] text-slate-300">{t("kyc.pre_gate_desc") || "Erst nach Identitätsprüfung werden Wallet, Marketplace und weitere Commerce-/Finance-Module freigeschaltet."}</p>
                <button
                  onClick={() => onNavigate("/kyc")}
                  className="mt-3 rounded-xl bg-amber-300 px-3.5 py-2 text-[11px] font-black text-slate-950"
                  data-testid="pre-kyc-more-start-button"
                >
                  {t("kyc.start_now") || "KYC jetzt starten"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Search Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}
          className="relative mb-3"
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            data-testid="more-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("more.search_placeholder") || "Suche nach Service, z.B. Wallet, Scooter, AGB..."}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-[12px] text-white placeholder-white/45 outline-none focus:border-[#00C2FF]/50"
          />
          {search && (
            <button
              data-testid="more-search-clear"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </motion.div>

        {/* ── Menu Groups (Accordion + Grid) ── */}
        {renderGridGroups()}

        {/* ── Logout / Sign In ── */}
        {isGuest ? (
          <motion.button
            data-testid="more-signin-btn"
            className="w-full py-[13px] rounded-[14px] bg-[#00C2FF] text-[#020202] font-semibold text-[13px] flex items-center justify-center gap-2 mt-2"
            style={{ boxShadow: "0 4px 20px rgba(0,194,255,0.2)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, ...slide }}
            whileTap={{ scale: 0.96 }}
            onClick={onAuthRequired}
          >
            <LogOut size={15} strokeWidth={1.5} className="text-[#020202]" />
            <span>{t("auth.signin") || "Sign In"}</span>
          </motion.button>
        ) : (
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
            <span className="text-[#FF4757]">{t("more.logout")}</span>
          </motion.button>
        )}

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