import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Store, CreditCard, Shield, BarChart3,
  Download, Search, ChevronRight, Loader2, Check, X,
  Clock, AlertCircle, CircleDollarSign, Activity, Settings,
  Flag, FileText, TrendingUp, Eye, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Gift, Plus, Pencil, Save, Gavel, Bot, Target, DollarSign, Zap, Cpu,
  LayoutGrid, Menu,
  // Grid Menu Icons
  Wallet, Building2, Key, Banknote, Mail, Trophy, Crown, Ticket, CheckCircle2, Euro, Tag, Percent,
  UserCheck, Briefcase, UserPlus, Building, Star, Car, BadgePercent, Handshake, Wrench, FileCode, Sparkles,
  Cog, Leaf, Lock, ScrollText, Mic, Bug, Database, Package, Code, UtensilsCrossed, MapPin, Calendar
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { toast } from "sonner";
import ExportSection from "../components/ExportSection";
import ErrorState from "../components/ErrorState";
import LazyErrorBoundary from "../components/LazyErrorBoundary";
import AdminTabRouter from "../components/AdminTabRouter";
import { api as apiService } from "../services/api";
import AdminQrManagementPage from "./AdminQrManagementPage";

const AdminAuctionsTab = lazy(() => import("../components/admin/AdminAuctionsTab"));
const AdminScootersTab = lazy(() => import("../components/admin/AdminScootersTab"));
const AdminGutscheineTab = lazy(() => import("../components/admin/AdminGutscheineTab"));
const AdminTestimonialsTab = lazy(() => import("../components/admin/AdminTestimonialsTab"));
const AdminPaySdkTab = lazy(() => import("../components/admin/AdminPaySdkTab"));
const AdminCustomerIntelligenceTab = lazy(() => import("../components/admin/AdminCustomerIntelligenceTab").then((m) => ({ default: m.AdminCustomerIntelligenceTab })));

const LazyFallback = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 size={20} className="animate-spin text-[#00C2FF]" />
  </div>
);

const API = process.env.REACT_APP_BACKEND_URL;
const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");
  if (!r.ok) throw new Error(d.detail || "Request failed");
  return d;
}

const Skeleton = ({ className }) => (
  <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.025)" }}>
    <motion.div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)" }}
      animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub, color, delay = 0 }) => (
  <motion.div className="rounded-2xl p-3.5 relative overflow-hidden"
    style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, ...slide }}>
    <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full pointer-events-none" style={{ background: color, filter: "blur(30px)", opacity: 0.08 }} />
    <div className="flex items-center gap-1.5 mb-2 relative z-10">
      <Icon size={12} style={{ color }} />
      <span className="text-[8px] text-[#3A3A3A] uppercase tracking-[0.1em] font-semibold">{label}</span>
    </div>
    <p className="text-[15px] font-bold font-outfit text-white/90 relative z-10">{value}</p>
    {sub && <p className="text-[9px] text-[#333] font-medium mt-0.5 relative z-10">{sub}</p>}
  </motion.div>
);

const statusColors = { pending: "#FFB800", approved: "#00C2FF", processed: "#00D26A", failed: "#FF4757", cancelled: "#666", completed: "#00D26A" };

// ═══════════════════════════════════════════════════
// ADMIN GRID MENU CONFIGURATION (Light Theme)
// ═══════════════════════════════════════════════════
const ADMIN_SECTIONS = [
  {
    id: "overview",
    label: "",
    color: "#666",
    items: [
      { id: "dashboard", icon: LayoutGrid, label: "Übersicht", tab: "overview" },
      { id: "analytics", icon: BarChart3, label: "Analytics", tab: "analytics" },
    ]
  },
  {
    id: "customers",
    label: "Kunden & Personal",
    color: "#00C2FF",
    items: [
      { id: "customers", icon: Users, label: "Kunden", tab: "users" },
      { id: "kyc", icon: Shield, label: "KYC-Freischaltung", tab: "verification" },
      { id: "managers", icon: Briefcase, label: "Manager", tab: "roles" },
      { id: "employees", icon: UserPlus, label: "Mitarbeiter", tab: "roles" },
      { id: "enterprise", icon: Building, label: "Großkunden", tab: "users" },
      { id: "influencer", icon: Star, label: "Influencer", tab: "roles" },
      { id: "auto-ads", icon: Car, label: "Auto-Werbung", tab: "promos" },
      { id: "partner-credit", icon: BadgePercent, label: "Partner-Freibetrag", tab: "merchant-fees", highlight: true },
    ]
  },
  {
    id: "partners",
    label: "Partner & Händler",
    color: "#A855F7",
    items: [
      { id: "partner-portal", icon: Handshake, label: "Partner Portal", tab: "merchants" },
      { id: "investor-leads", icon: Users, label: "Investor Leads", nav: "/admin/investor-leads", highlight: true },
      { id: "investor-dashboard", icon: BarChart3, label: "Investor Dashboard", nav: "/admin/investor-dashboard", highlight: true },
      { id: "investor-documents", icon: FileText, label: "Investor Dokumente", nav: "/admin/investor-documents", highlight: true },
      { id: "investor-updates", icon: Mail, label: "Investor Updates", nav: "/admin/investor-updates", highlight: true },
      { id: "investor-meetings", icon: Calendar, label: "Investor Meetings", nav: "/admin/investor-meetings", highlight: true },
      { id: "visual-qa", icon: Eye, label: "Visual QA", nav: "/admin/visual-qa", highlight: true },
      { id: "master-roadmap", icon: Activity, label: "Master Roadmap", nav: "/admin/master-roadmap", highlight: true },
      { id: "applications", icon: FileText, label: "Alte Bewerbungen", tab: "merchants" },
      { id: "qr-tables", icon: UtensilsCrossed, label: "QR-Tische", tab: "qr-management", highlight: true },
      { id: "pool-system", icon: Ticket, label: "Schwimmbad", tab: "pool", highlight: true },
      { id: "audi-ticket-system", icon: Ticket, label: "Audi Tickets", nav: "/audi-tickets", highlight: true },
    ]
  },
  {
    id: "auctions",
    label: "Auktionen",
    color: "#00C2FF",
    items: [
      { id: "products", icon: Package, label: "Produkte", tab: "auctions" },
      { id: "standard-auctions", icon: Gavel, label: "Standard-Auktionen", tab: "auctions" },
      { id: "vip-auctions", icon: Crown, label: "VIP-Auktionen", tab: "auctions" },
      { id: "voucher-auctions", icon: Ticket, label: "Gutschein-Auktionen", tab: "auctions" },
      { id: "bot-system", icon: Bot, label: "Bot-System", tab: "auctions" },
      { id: "winner-control", icon: CheckCircle2, label: "Gewinner-Kontrolle", tab: "auctions" },
      { id: "product-analysis", icon: TrendingUp, label: "Produkt-Analyse", tab: "analytics" },
      { id: "user-analysis", icon: Users, label: "Benutzer-Analyse", tab: "analytics" },
      { id: "customer-intelligence", icon: MapPin, label: "Kunden Live-Map", tab: "customer-intelligence", highlight: true },
      { id: "revenue-analysis", icon: Euro, label: "Umsatz-Analyse", tab: "analytics" },
    ]
  },
  {
    id: "coupons",
    label: "Gutscheine & Codes",
    color: "#FFB800",
    items: [
      { id: "merchant-coupons", icon: Tag, label: "Händler-Gutscheine", tab: "promos" },
      { id: "bidder-coupons", icon: Tag, label: "Bieter-Gutscheine", tab: "promos" },
      { id: "partner-coupons", icon: Tag, label: "Partner-Gutscheine", tab: "promos" },
      { id: "discount-codes", icon: Percent, label: "Rabatt-Coupons", tab: "promos" },
      { id: "referral-codes", icon: Users, label: "Empfehlungs-Codes", tab: "promos" },
    ]
  },
  {
    id: "finance",
    label: "Finanzen",
    color: "#00D26A",
    items: [
      { id: "pay-requests", icon: Shield, label: "Pay Anträge", tab: "pay-requests", highlight: true },
      { id: "payments", icon: DollarSign, label: "Zahlungen", tab: "transactions" },
      { id: "topup", icon: Wallet, label: "Wallet Aufladen", tab: "transactions" },
      { id: "wise-payouts", icon: CreditCard, label: "Wise Auszahlungen", tab: "payouts" },
      { id: "credit-mgmt", icon: Building2, label: "Kredit-Verwaltung", tab: "transactions" },
      { id: "digital-api", icon: Key, label: "Digital API", tab: "settings" },
      { id: "wholesalers", icon: Store, label: "Großhändler", tab: "merchants" },
      { id: "sepa-payouts", icon: Banknote, label: "SEPA-Auszahlungen", tab: "payouts" },
    ]
  },
  {
    id: "marketing",
    label: "Marketing",
    color: "#00D26A",
    items: [
      { id: "flash-sales", icon: Zap, label: "Flash Sales", tab: "promos" },
      { id: "banners", icon: Eye, label: "Werbebanner", tab: "promos" },
      { id: "charge-offer-rules", icon: Sparkles, label: "Charge Angebotsregeln", nav: "/admin/charge-offer-rules", highlight: true },
      { id: "email-marketing", icon: Mail, label: "E-Mail Marketing", tab: "promos" },
      { id: "jackpot", icon: Trophy, label: "Jackpot", tab: "auctions" },
      { id: "challenges", icon: Target, label: "Challenges", tab: "promos" },
      { id: "mystery-box", icon: Gift, label: "Mystery Box", tab: "promos" },
    ]
  },
  {
    id: "loyalty",
    label: "Loyalty & Cashback",
    color: "#FFD700",
    items: [
      { id: "loyalty-config", icon: Settings, label: "Loyalty Einstellungen", tab: "loyalty" },
      { id: "loyalty-analytics", icon: BarChart3, label: "Loyalty Analytics", tab: "loyalty" },
      { id: "coin-rates", icon: CircleDollarSign, label: "Coin-Raten", tab: "loyalty" },
      { id: "cashback-rates", icon: Percent, label: "Cashback-Raten", tab: "loyalty" },
    ]
  },
  {
    id: "mobility",
    label: "Mobilität & Scooter",
    color: "#00D26A",
    items: [
      { id: "scooter-fleet", icon: Zap, label: "Scooter-Flotte", tab: "scooters", highlight: true },
      { id: "scooter-add", icon: Plus, label: "Scooter hinzufügen", tab: "scooters" },
      { id: "taxi-drivers", icon: Car, label: "Taxi-Fahrer", tab: "drivers" },
      { id: "restaurants", icon: Store, label: "Restaurants", tab: "restaurants" },
    ]
  },
  {
    id: "system",
    label: "System",
    color: "#666",
    items: [
      { id: "maintenance", icon: Wrench, label: "Wartung", tab: "settings" },
      { id: "cms", icon: FileCode, label: "Seiten (CMS)", tab: "settings" },
      { id: "game-settings", icon: Cog, label: "Spiel-Einstellungen", tab: "settings" },
      { id: "sustainability", icon: Leaf, label: "Nachhaltigkeit", tab: "flags" },
      { id: "passwords", icon: Lock, label: "Passwörter", tab: "settings" },
      { id: "logs", icon: ScrollText, label: "Systemlogs", tab: "audit" },
      { id: "biopay-audit-center", icon: Shield, label: "BioPay Audit", tab: "biopay-audit", highlight: true },
      { id: "debug", icon: Bug, label: "Debug Reports", tab: "audit" },
      { id: "rtk-proxy", icon: Cpu, label: "RTK Proxy", tab: "rtk", highlight: true },
      { id: "system-health", icon: Activity, label: "System", tab: "flags" },
      { id: "database", icon: Database, label: "Daten-Manager", tab: "settings" },
    ]
  },
];

// Grid Menu Item Component (Light Theme)
const AdminGridMenuItem = ({ item, onClick, delay }) => {
  const Icon = item.icon;
  return (
    <motion.button
      data-testid={`admin-grid-${item.id}`}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
        item.highlight 
          ? "bg-[#00C2FF]/10 border-2 border-[#00C2FF]/30" 
          : "bg-white border border-gray-200 hover:border-gray-300 shadow-sm"
      }`}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay * 0.02, duration: 0.15 }}
      whileTap={{ scale: 0.95 }}
    >
      <Icon 
        size={22} 
        strokeWidth={1.5} 
        className={item.highlight ? "text-[#00C2FF]" : "text-gray-500"} 
      />
      <span className={`text-[10px] mt-2 text-center font-medium leading-tight ${
        item.highlight ? "text-[#00C2FF]" : "text-gray-600"
      }`}>
        {item.label}
      </span>
    </motion.button>
  );
};

const AdminQuickCustomerIntelButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid="admin-grid-customer-intelligence"
    className="w-full mt-3 rounded-2xl border border-[#00C2FF]/25 bg-[#00C2FF]/10 px-4 py-3 text-left flex items-center justify-between gap-3"
  >
    <span>
      <span className="block text-sm font-bold text-[#00C2FF]">Kunden Live-Map</span>
      <span className="block text-[10px] text-[#6aaec0] mt-0.5">Radar, Templates, Erfolgsmessung, Timeline</span>
    </span>
    <MapPin size={18} className="text-[#00C2FF]" />
  </button>
);

// Grid Section Component (Light Theme)
const AdminGridSection = ({ section, onItemClick, startIndex }) => {
  if (!section.label) {
    return (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {section.items.map((item, idx) => (
          <AdminGridMenuItem 
            key={item.id} 
            item={item} 
            onClick={() => onItemClick(item.nav || item.tab)}
            delay={startIndex + idx}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div className="mb-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div 
        className="px-3 py-2 rounded-xl mb-2"
        style={{ background: `${section.color}15` }}
      >
        <span className="text-xs font-semibold" style={{ color: section.color }}>
          {section.label}
        </span>
        <span className="text-[10px] text-gray-400 ml-2">({section.items.length})</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {section.items.map((item, idx) => (
          <AdminGridMenuItem 
            key={item.id} 
            item={item} 
            onClick={() => onItemClick(item.nav || item.tab)}
            delay={startIndex + idx}
          />
        ))}
      </div>
    </motion.div>
  );
};

const tabs = [
  { id: "overview", key: "admin.overview", icon: BarChart3 },
  { id: "users", key: "admin.users", icon: Users },
  { id: "roles", key: "admin.roles", icon: Shield },
  { id: "verification", key: "admin.verification", icon: Shield },
  { id: "merchants", key: "admin.merchants", icon: Store },
  { id: "payouts", key: "admin.payouts", icon: Download },
  { id: "transactions", key: "admin.txns", icon: CreditCard },
  { id: "flags", key: "admin.flags", icon: Flag },
  { id: "audit", key: "admin.audit", icon: FileText },
  { id: "biopay-audit", key: "BioPay Audit", icon: Shield },
  { id: "compliance", key: "admin.compliance", icon: Shield },
  { id: "analytics", key: "admin.analytics", icon: TrendingUp },
  { id: "customer-intelligence", key: "Customer Intel", icon: MapPin },
  { id: "promos", key: "admin.promos", icon: Gift },
  { id: "settings", key: "admin.config", icon: Settings },
  { id: "merchant-fees", key: "admin.merchant_fees", icon: CircleDollarSign },
  { id: "pay-requests", key: "Pay Anträge", icon: Shield },
  { id: "auctions", key: "admin.auctions_tab", icon: Gavel },
  { id: "loyalty", key: "admin.loyalty", icon: Trophy },
  { id: "scooters", key: "Scooter-Flotte", icon: Zap },
  { id: "credits", key: "Kreditanträge", icon: CreditCard },
  { id: "gutscheine", key: "Gutscheine", icon: Ticket },
  { id: "testimonials", key: "Testimonials", icon: Star },
  { id: "pay_sdk", key: "Pay-SDK", icon: Code },
];

export const AdminPage = ({ onNavigate, defaultTab, layoutMode, onToggleLayout }) => {
  const user = useUser();
  const { t } = useI18n();
  const [tab, setTab] = useState(defaultTab || "overview");
  useEffect(() => { if (defaultTab) setTab(defaultTab); }, [defaultTab]);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [showQrManagement, setShowQrManagement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [txns, setTxns] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [payoutFilter, setPayoutFilter] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [featureFlags, setFeatureFlags] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [complianceFlags, setComplianceFlags] = useState([]);
  const [complianceChecks, setComplianceChecks] = useState([]);
  const [payRequests, setPayRequests] = useState([]);
  const [complianceTab, setComplianceTab] = useState("flags");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [promos, setPromos] = useState([]);
  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const [editingFees, setEditingFees] = useState(false);
  const [feeValues, setFeeValues] = useState(null);
  const [savingFees, setSavingFees] = useState(false);
  const [roleRequests, setRoleRequests] = useState([]);
  const [roleFilter, setRoleFilter] = useState("pending");
  const [verifications, setVerifications] = useState([]);
  const [verFilter, setVerFilter] = useState("pending");
  const [merchantFees, setMerchantFees] = useState(null);
  const [editingMerchantFees, setEditingMerchantFees] = useState(false);
  const [merchantFeeValues, setMerchantFeeValues] = useState({});
  const [savingMerchantFees, setSavingMerchantFees] = useState(false);
  const [adminAuctions, setAdminAuctions] = useState([]);
  const [botSaving, setBotSaving] = useState(null);
  const [loyaltyConfig, setLoyaltyConfig] = useState(null);
  const [loyaltyAnalytics, setLoyaltyAnalytics] = useState(null);
  const [savingLoyalty, setSavingLoyalty] = useState(false);
  // Scooter Fleet Management
  const [scooterFleet, setScooterFleet] = useState([]);
  const [scooterStats, setScooterStats] = useState(null);
  const [showAddScooter, setShowAddScooter] = useState(false);
  const [savingScooter, setSavingScooter] = useState(false);
  const [newScooter, setNewScooter] = useState({ device_id: "", qr_code: "", model: "Ninebot Max G30", lat: 52.52, lng: 13.405, battery: 100 });
  // Gutscheine & Grants
  const [coupons, setCoupons] = useState([]);
  const [showGrant, setShowGrant] = useState(false);
  const [grantForm, setGrantForm] = useState({ user_email: "", grant_type: "eur", amount: "", reason: "" });
  const [grantLoading, setGrantLoading] = useState(false);
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [couponForm, setCouponForm] = useState({ coupon_type: "eur", value: "", max_uses: "1", code: "", description: "", expires_days: "30" });
  const [couponLoading, setCouponLoading] = useState(false);

  const adminExports = [
    { key: "transactions", label: t("export.transactions"), action: (f) => apiService.exportAdminTransactions(f) },
    { key: "payouts", label: t("export.payouts"), action: (f) => apiService.exportAdminPayouts(f) },
    { key: "merchants", label: t("export.merchants"), action: () => apiService.exportAdminMerchants() },
    { key: "revenue", label: t("export.revenue"), action: (f) => apiService.exportAdminRevenue(f) },
    { key: "users", label: t("export.users"), action: () => apiService.exportAdminUsers() },
  ];

  const load = useCallback(async (t) => {
    setLoading(true);
    setError(null);
    try {
      if (t === "biopay-audit") { setLoading(false); return; }
      if (t === "overview") { const d = await api("/api/admin/overview"); setOverview(d); }
      if (t === "users") { const d = await api(`/api/admin/users?search=${encodeURIComponent(search)}`); setUsers(d.users); }
      if (t === "merchants") { const d = await api(`/api/admin/merchants?search=${encodeURIComponent(search)}`); setMerchants(d.merchants); }
      if (t === "payouts") { const d = await api(`/api/admin/payouts?status=${payoutFilter}`); setPayouts(d.payouts); }
      if (t === "transactions") { const d = await api(`/api/admin/transactions?search=${encodeURIComponent(search)}&limit=30`); setTxns(d.transactions); }
      if (t === "settings") { const d = await api("/api/admin/settings"); setSettings(d); }
      if (t === "flags") {
        const d = await api("/api/admin/feature-flags");
        const flagsObj = d.flags || {};
        const flagsArr = Array.isArray(flagsObj) ? flagsObj : Object.entries(flagsObj).map(([name, val]) => ({ name, ...val }));
        setFeatureFlags(flagsArr);
      }
      if (t === "audit") { const d = await api("/api/admin/audit-logs?limit=50"); setAuditLogs(d.logs || []); setAuditTotal(d.total || 0); }
      if (t === "compliance") {
        const [flagsRes, checksRes] = await Promise.all([
          api("/api/admin/compliance-flags?limit=50"),
          api("/api/admin/compliance-checks?limit=50"),
        ]);
        setComplianceFlags(flagsRes.flags || []);
        setComplianceChecks(checksRes.checks || []);
      }
      if (t === "analytics") {
        const [overviewRes, funnelRes, retentionRes, campaignsRes] = await Promise.all([
          api("/api/analytics/growth/overview"),
          api("/api/analytics/growth/funnel"),
          api("/api/analytics/growth/retention"),
          api("/api/analytics/growth/campaigns"),
        ]);
        setAnalyticsData({
          overview: {
            total_users: overviewRes.users?.total || 0,
            active_30d: retentionRes.active_30d || 0,
            growth_rate: overviewRes.users?.total > 0 ? (overviewRes.users?.new_this_week || 0) / overviewRes.users.total : 0,
            arpu: 0,
          },
          funnel: {
            steps: (funnelRes.funnel || []).map(s => ({ name: s.stage, count: s.count })),
          },
          retention: {
            day_1: (retentionRes.retention_7d || 0) / 100,
            day_7: (retentionRes.retention_7d || 0) / 100,
            day_30: (retentionRes.retention_30d || 0) / 100,
          },
          campaigns: campaignsRes,
        });
      }
      if (t === "customer-intelligence") { setLoading(false); return; }
      if (t === "promos") {
        const d = await api("/api/promotions/admin/all");
        setPromos(d.promotions || []);
      }
      if (t === "roles") {
        const d = await apiService.adminListRoleRequests(roleFilter);
        setRoleRequests(d.requests || []);
      }
      if (t === "verification") {
        const d = await apiService.adminListVerifications(verFilter);
        setVerifications(d.verifications || []);
      }
      if (t === "pay-requests") {
        const d = await api("/api/pay/admin/applications?status=pending");
        setPayRequests(d.applications || []);
      }
      if (t === "merchant-fees") {
        const d = await api("/api/payments/admin/fees");
        setMerchantFees(d.fees || {});
        setMerchantFeeValues(d.fees || {});
      }
      if (t === "auctions") {
        const d = await api("/api/auctions/admin/list");
        setAdminAuctions((d.auctions || []).map(a => ({
          ...a,
          _bot_enabled: a.bot_enabled || false,
          _bot_target_price: a.bot_target_price || 0,
          _bot_min_seconds: a.bot_min_seconds || 300,
          _bot_strategy: a.bot_strategy || "standard",
          _bot_aggression: a.bot_aggression || "medium",
          _bot_final_battle: a.bot_final_battle_mode || "normal",
        })));
      }
      if (t === "scooters") {
        const d = await api("/api/scooter/admin/fleet");
        setScooterFleet(d.scooters || []);
        setScooterStats(d.stats || {});
      }
      if (t === "credits") {
        onNavigate("/admin/credits");
        return;
      }
      if (t === "gutscheine") {
        const d = await api("/api/admin/grants/coupons");
        setCoupons(d.coupons || []);
      }
      if (t === "qr-management") {
        setShowQrManagement(true);
        return;
      }
    } catch (e) { setError(e); }
    setLoading(false);
  }, [search, payoutFilter, roleFilter, verFilter]);

  useEffect(() => { setError(null); load(tab); }, [load, tab]);

  const handlePayoutAction = async (ref, action) => {
    setActionLoading(ref);
    try {
      await api(`/api/admin/payouts/${ref}/action`, { method: "POST", body: JSON.stringify({ action }) });
      load("payouts");
    } catch (e) { setError(e); }
    setActionLoading(null);
  };

  const handleRoleDecision = async (userId, decision) => {
    setActionLoading(userId);
    try {
      await apiService.adminDecideRole({ user_id: userId, decision });
      load("roles");
    } catch (e) { setError(e); }
    setActionLoading(null);
  };

  const handleVerDecision = async (userId, decision, reason = "") => {
    setActionLoading(userId);
    try {
      await apiService.adminDecideVerification({ user_id: userId, decision, reason });
      load("verification");
    } catch (e) { setError(e); }
    setActionLoading(null);
  };

  const handleCreateCoupon = async () => {
    setCouponLoading(true);
    try {
      await api("/api/admin/grants/coupon/create", {
        method: "POST",
        body: JSON.stringify({
          coupon_type: couponForm.coupon_type,
          value: parseFloat(couponForm.value),
          max_uses: parseInt(couponForm.max_uses) || 1,
          code: couponForm.code || undefined,
          description: couponForm.description,
          expires_days: parseInt(couponForm.expires_days) || 30,
        }),
      });
      setShowCreateCoupon(false);
      setCouponForm({ coupon_type: "eur", value: "", max_uses: "1", code: "", description: "", expires_days: "30" });
      load("gutscheine");
    } catch (e) { setError(e); }
    setCouponLoading(false);
  };

  const handleDeleteCoupon = async (couponId) => {
    try {
      await api(`/api/admin/grants/coupon/${couponId}`, { method: "DELETE" });
      load("gutscheine");
    } catch (e) { setError(e); }
  };

  const handleGrantBalance = async () => {
    setGrantLoading(true);
    try {
      const r = await api("/api/admin/grants/balance", {
        method: "POST",
        body: JSON.stringify({
          user_email: grantForm.user_email,
          grant_type: grantForm.grant_type,
          amount: parseFloat(grantForm.amount),
          reason: grantForm.reason,
        }),
      });
      setShowGrant(false);
      setGrantForm({ user_email: "", grant_type: "eur", amount: "", reason: "" });
      toast?.success?.(`${r.granted} ${r.type.toUpperCase()} an ${r.user_email} vergeben`);
    } catch (e) { setError(e); }
    setGrantLoading(false);
  };


  // Render QR Management if active
  if (showQrManagement) {
    return <AdminQrManagementPage onBack={() => { setShowQrManagement(false); setTab("overview"); }} />;
  }

  if (user.role !== "admin") {
    return (
      <motion.div className="min-h-screen flex items-center justify-center" style={{ background: "#030303" }}>
        <div className="text-center">
          <Shield size={40} className="text-[#FF4757] mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">{t("admin.access_denied")}</p>
          <p className="text-sm text-[#666]">{t("admin.admin_required")}</p>
          <motion.button onClick={() => onNavigate("/")} className="mt-4 px-6 py-2 bg-white/5 text-white rounded-xl text-sm" whileTap={{ scale: 0.95 }}>{t("admin.go_home")}</motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div data-testid="admin-page" className="min-h-screen relative" style={{ background: "#030303" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-[max(env(safe-area-inset-top,0px),20px)] pb-2.5 relative z-10 sm:gap-3 sm:px-5 sm:pt-[max(env(safe-area-inset-top,0px),24px)] sm:pb-3">
        <motion.button data-testid="admin-back-btn" className="h-9 w-9 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center sm:h-10 sm:w-10" whileTap={{ scale: 0.88 }} onClick={() => onNavigate("/")}>
          <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <div>
          <h1 className="text-[14px] font-semibold font-outfit text-white tracking-tight sm:text-[15px]">{t("admin.title")}</h1>
          <p className="text-[9px] text-[#333] font-medium sm:text-[10px]">{t("admin.subtitle")}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onToggleLayout && (
            <motion.button
              data-testid="layout-toggle"
              onClick={onToggleLayout}
              whileTap={{ scale: 0.9 }}
              title={layoutMode === "grid" ? "Zu Listen-Layout wechseln" : "Zu Grid-Layout wechseln"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-medium text-white/70"
            >
              <LayoutGrid size={11} className="text-[#10B981]" />
              <span>Liste</span>
            </motion.button>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}>
            <Shield size={10} className="text-[#FF4757]" />
            <span className="text-[9px] text-[#FF4757] font-bold uppercase tracking-[0.1em]">Admin</span>
          </div>
        </div>
      </div>

      {/* Grid Menu Toggle */}
      {tab === "overview" && (
        <div className="px-4 mb-3.5 relative z-10 sm:px-5 sm:mb-4">
          <motion.button 
            onClick={() => setShowGridMenu(!showGridMenu)}
            whileTap={{ scale: 0.95 }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 shadow-sm"
          >
            <div className="flex items-center gap-2">
              {showGridMenu ? <ChevronUp size={18} className="text-gray-500" /> : <Menu size={18} className="text-gray-500" />}
              <span className="text-sm font-semibold text-gray-700">
                {showGridMenu ? "Menü schließen" : "Admin-Bereiche"}
              </span>
            </div>
            <span className="text-xs text-gray-400">{ADMIN_SECTIONS.reduce((sum, s) => sum + s.items.length, 0)} Funktionen</span>
          </motion.button>
        </div>
      )}

      {/* Grid Menu */}
      <AnimatePresence>
        {showGridMenu && tab === "overview" && (
          <motion.div
            className="px-5 mb-5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {ADMIN_SECTIONS.map((section, sectionIndex) => {
              const startIndex = ADMIN_SECTIONS.slice(0, sectionIndex).reduce((sum, s) => sum + s.items.length, 0);
              return (
                <AdminGridSection
                  key={section.id}
                  section={section}
                  onItemClick={(targetTab) => {
                    if (typeof targetTab === "string" && targetTab.startsWith("/")) {
                      onNavigate(targetTab);
                      return;
                    }
                    if (targetTab === "biopay-audit") {
                      onNavigate("/admin/biopay-audit");
                      return;
                    }
                    if (targetTab === "rtk") {
                      onNavigate("/admin/rtk");
                      return;
                    }
                    if (targetTab === "pool") {
                      onNavigate("/admin/pool");
                      return;
                    }
                    setTab(targetTab);
                    setShowGridMenu(false);
                  }}
                  startIndex={startIndex}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Bar - Compact Tabs for non-overview */}
      {tab !== "overview" && (
        <div className="px-4 mb-3.5 relative z-10 sm:px-5 sm:mb-4">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {tabs.filter(tb => tb.id !== "overview").slice(0, 8).map((tb) => (
              <motion.button key={tb.id} onClick={() => tb.id === "biopay-audit" ? onNavigate("/admin/biopay-audit") : setTab(tb.id)} whileTap={{ scale: 0.95 }}
                data-testid={`admin-tab-${tb.id}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-medium whitespace-nowrap ${
                  tab === tb.id ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "bg-white/[0.02] text-[#555] border border-white/[0.04]"
                }`}>
                <tb.icon size={14} />
                <span>{t(tb.key)?.split(" ")[0] || tb.key.split(" ")[0]}</span>
              </motion.button>
            ))}
            <motion.button onClick={() => setTab("overview")} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-medium bg-white/[0.04] text-[#444] border border-white/[0.05]">
              <Menu size={14} />
              <span>Alle</span>
            </motion.button>
          </div>
        </div>
      )}

      <div className="px-4 pb-8 relative z-10 sm:px-5">
        {tab === "overview" && <AdminQuickCustomerIntelButton onClick={() => { setTab("customer-intelligence"); setShowGridMenu(false); }} />}
        {/* ── Error State ── */}
        {error && !loading && (
          <div className="mb-4">
            <ErrorState error={error} onRetry={() => load(tab)} compact />
          </div>
        )}
        <AdminTabRouter ctx={{
          tab, t, loading,
          overview, users, merchants, payouts, txns, settings,
          featureFlags, auditLogs, auditTotal,
          complianceFlags, complianceChecks, analyticsData, promos, merchantFees,
          roleRequests, verifications, payRequests,
          search, setSearch,
          payoutFilter, setPayoutFilter,
          complianceTab, setComplianceTab,
          showCreatePromo, setShowCreatePromo,
          editingFees, setEditingFees, feeValues, setFeeValues, savingFees, setSavingFees,
          editingMerchantFees, setEditingMerchantFees, merchantFeeValues, setMerchantFeeValues,
          savingMerchantFees, setSavingMerchantFees,
          roleFilter, setRoleFilter, verFilter, setVerFilter,
          actionLoading,
          setSettings, setComplianceFlags, setPromos, setFeatureFlags, setMerchantFees,
          load, handlePayoutAction, handleRoleDecision, handleVerDecision,
          adminExports, api,
        }} />

          {/* ── Auctions Bot Admin Tab ── */}
          {tab === "auctions" && (
            <LazyErrorBoundary>
              <Suspense fallback={<LazyFallback />}>
                <AdminAuctionsTab
                  t={t}
                  loading={loading}
                  auctions={adminAuctions}
                  setAuctions={setAdminAuctions}
                  botSaving={botSaving}
                  setBotSaving={setBotSaving}
                  reload={() => load("auctions")}
                />
              </Suspense>
            </LazyErrorBoundary>
          )}

          {/* Scooter Fleet Management */}
          {tab === "scooters" && (
            <LazyErrorBoundary>
              <Suspense fallback={<LazyFallback />}>
                <AdminScootersTab
                  loading={loading}
                  scooterFleet={scooterFleet}
                  scooterStats={scooterStats}
                  showAdd={showAddScooter}
                  setShowAdd={setShowAddScooter}
                  newScooter={newScooter}
                  setNewScooter={setNewScooter}
                  saving={savingScooter}
                  setSaving={setSavingScooter}
                  reload={() => load("scooters")}
                  setError={setError}
                />
              </Suspense>
            </LazyErrorBoundary>
          )}

          {/* Gutscheine */}
          {tab === "gutscheine" && (
            <LazyErrorBoundary>
              <Suspense fallback={<LazyFallback />}>
                <AdminGutscheineTab
                  coupons={coupons}
                  showCreateCoupon={showCreateCoupon}
                  setShowCreateCoupon={setShowCreateCoupon}
                  couponForm={couponForm}
                  setCouponForm={setCouponForm}
                  couponLoading={couponLoading}
                  handleCreateCoupon={handleCreateCoupon}
                  handleDeleteCoupon={handleDeleteCoupon}
                  showGrant={showGrant}
                  setShowGrant={setShowGrant}
                  grantForm={grantForm}
                  setGrantForm={setGrantForm}
                  grantLoading={grantLoading}
                  handleGrantBalance={handleGrantBalance}
                />
              </Suspense>
            </LazyErrorBoundary>
          )}

          {/* Testimonials */}
          {tab === "testimonials" && (
            <LazyErrorBoundary>
              <Suspense fallback={<LazyFallback />}>
                <AdminTestimonialsTab />
              </Suspense>
            </LazyErrorBoundary>
          )}

          {/* BidBlitz Pay SDK — Merchant API Keys */}
          {tab === "pay_sdk" && (
            <LazyErrorBoundary>
              <Suspense fallback={<LazyFallback />}>
                <AdminPaySdkTab />
              </Suspense>
            </LazyErrorBoundary>
          )}

          {tab === "customer-intelligence" && (
            <LazyErrorBoundary>
              <Suspense fallback={<LazyFallback />}>
                <AdminCustomerIntelligenceTab />
              </Suspense>
            </LazyErrorBoundary>
          )}

      </div>
    </motion.div>
  );
};

export default AdminPage;
