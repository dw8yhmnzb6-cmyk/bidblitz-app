import { useState, useEffect, useCallback } from "react";
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
  UserCheck, Briefcase, UserPlus, Building, Star, Car, BadgePercent, Handshake, Wrench, FileCode,
  Cog, Leaf, Lock, ScrollText, Mic, Bug, Database, Package
} from "lucide-react";
import { useUser, useI18n } from "../store";
import ExportSection from "../components/ExportSection";
import ErrorState from "../components/ErrorState";
import { api as apiService } from "../services/api";

const API = process.env.REACT_APP_BACKEND_URL;
const slide = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const d = await r.json().catch(() => ({}));
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

const PROMO_TYPES = ["bonus_topup", "reduced_fee", "cashback", "signup_bonus"];
const CreatePromoForm = ({ t, onCreated, onCancel }) => {
  const [form, setForm] = useState({ name: "", type: "cashback", value: 5, min_amount: 1, max_uses: 100, target: "all", starts_at: new Date().toISOString().slice(0, 10), expires_at: "2027-12-31" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, value: Number(form.value), min_amount: Number(form.min_amount), max_uses: Number(form.max_uses), starts_at: `${form.starts_at}T00:00:00Z`, expires_at: `${form.expires_at}T23:59:59Z`, active: true };
      await fetch(`${API}/api/promotions/admin/create`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onCreated({ ...body, current_uses: 0 });
    } catch {} finally { setSaving(false); }
  };
  const inputCls = "w-full px-3 py-2 rounded-xl text-[12px] text-white/90 placeholder-[#333] font-medium outline-none bg-white/[0.03] border border-white/[0.05]";
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden rounded-2xl p-4 space-y-2.5" style={{ background: "rgba(0,194,255,0.02)", border: "1px solid rgba(0,194,255,0.08)" }}>
      <input data-testid="promo-name" value={form.name} onChange={e => set("name", e.target.value)} placeholder={t("admin.promo_name_ph")} className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <select data-testid="promo-type" value={form.type} onChange={e => set("type", e.target.value)} className={inputCls + " cursor-pointer"}>
          {PROMO_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
        </select>
        <select data-testid="promo-target" value={form.target} onChange={e => set("target", e.target.value)} className={inputCls + " cursor-pointer"}>
          {["all", "new_users", "merchants"].map(tg => <option key={tg} value={tg}>{tg}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[9px] text-[#444] font-medium block mb-0.5">{t("admin.promo_value")}</label>
          <input data-testid="promo-value" type="number" value={form.value} onChange={e => set("value", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[9px] text-[#444] font-medium block mb-0.5">{t("admin.promo_min")}</label>
          <input type="number" value={form.min_amount} onChange={e => set("min_amount", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[9px] text-[#444] font-medium block mb-0.5">{t("admin.promo_max_uses")}</label>
          <input type="number" value={form.max_uses} onChange={e => set("max_uses", e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={form.starts_at} onChange={e => set("starts_at", e.target.value)} className={inputCls} />
        <input type="date" value={form.expires_at} onChange={e => set("expires_at", e.target.value)} className={inputCls} />
      </div>
      <div className="flex gap-2 pt-1">
        <motion.button data-testid="promo-submit" onClick={submit} disabled={saving}
          className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/15 disabled:opacity-50"
          whileTap={{ scale: 0.97 }}>{saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : t("admin.create_promo")}</motion.button>
        <motion.button onClick={onCancel} className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#444] bg-white/[0.02] border border-white/[0.04]"
          whileTap={{ scale: 0.97 }}>{t("admin.cancel")}</motion.button>
      </div>
    </motion.div>
  );
};

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
      { id: "applications", icon: FileText, label: "Alte Bewerbungen", tab: "merchants" },
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
      { id: "debug", icon: Bug, label: "Debug Reports", tab: "audit" },
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

// Grid Section Component (Light Theme)
const AdminGridSection = ({ section, onItemClick, startIndex }) => {
  if (!section.label) {
    return (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {section.items.map((item, idx) => (
          <AdminGridMenuItem 
            key={item.id} 
            item={item} 
            onClick={() => onItemClick(item.tab)}
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
            onClick={() => onItemClick(item.tab)}
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
  { id: "compliance", key: "admin.compliance", icon: Shield },
  { id: "analytics", key: "admin.analytics", icon: TrendingUp },
  { id: "promos", key: "admin.promos", icon: Gift },
  { id: "settings", key: "admin.config", icon: Settings },
  { id: "merchant-fees", key: "admin.merchant_fees", icon: CircleDollarSign },
  { id: "auctions", key: "admin.auctions_tab", icon: Gavel },
  { id: "loyalty", key: "admin.loyalty", icon: Trophy },
  { id: "scooters", key: "Scooter-Flotte", icon: Zap },
];

export const AdminPage = ({ onNavigate }) => {
  const user = useUser();
  const { t } = useI18n();
  const [tab, setTab] = useState("overview");
  const [showGridMenu, setShowGridMenu] = useState(false);
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
    } catch (e) { setError(e); }
    setLoading(false);
  }, [search, payoutFilter, roleFilter, verFilter]);

  useEffect(() => { load(tab); }, [tab, load]);

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
      <div className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 relative z-10">
        <motion.button data-testid="admin-back-btn" className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center" whileTap={{ scale: 0.88 }} onClick={() => onNavigate("/")}>
          <ArrowLeft size={15} strokeWidth={1.5} className="text-white/50" />
        </motion.button>
        <div>
          <h1 className="text-[15px] font-semibold font-outfit text-white tracking-tight">{t("admin.title")}</h1>
          <p className="text-[10px] text-[#333] font-medium">{t("admin.subtitle")}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.12)" }}>
          <Shield size={10} className="text-[#FF4757]" />
          <span className="text-[9px] text-[#FF4757] font-bold uppercase tracking-[0.1em]">Admin</span>
        </div>
      </div>

      {/* Tab Bar - Grid Layout for better overview */}
      <div className="px-5 mb-4 relative z-10">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
          {tabs.map((tb) => (
            <motion.button key={tb.id} onClick={() => setTab(tb.id)} whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[10px] font-medium transition-all ${
                tab === tb.id ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "bg-white/[0.02] text-[#555] border border-white/[0.04] hover:bg-white/[0.04]"
              }`}>
              <tb.icon size={16} />
              <span className="truncate w-full text-center">{t(tb.key)?.split(" ")[0] || tb.key.split(" ")[0]}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-8 relative z-10">
        {/* ── Error State ── */}
        {error && !loading && (
          <div className="mb-4">
            <ErrorState error={error} onRetry={() => load(tab)} compact />
          </div>
        )}
        <AnimatePresence mode="wait">

          {/* ── Overview Tab ── */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading || !overview ? (
                <div className="grid grid-cols-2 gap-2.5">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-[80px]" />)}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    <StatCard icon={Users} label={t("admin.total_users")} value={overview.total_users} sub={`+${overview.today_new_users} ${t("common.today").toLowerCase()}`} color="#00C2FF" delay={0.06} />
                    <StatCard icon={Store} label={t("admin.total_merchants")} value={overview.total_merchants} color="#A855F7" delay={0.08} />
                    <StatCard icon={CreditCard} label={t("admin.payment_volume")} value={`\u20AC${overview.payment_volume.toLocaleString("de-DE",{minimumFractionDigits:2})}`} sub={`${overview.total_transactions} txns`} color="#00D26A" delay={0.10} />
                    <StatCard icon={CircleDollarSign} label={t("admin.fee_revenue")} value={`\u20AC${overview.platform_fee_revenue.toLocaleString("de-DE",{minimumFractionDigits:2})}`} color="#FFB800" delay={0.12} />
                    <StatCard icon={Clock} label={t("admin.pending_payouts")} value={overview.pending_payouts_count} sub={`\u20AC${overview.pending_payouts_amount.toFixed(2)}`} color="#FF6B6B" delay={0.14} />
                    <StatCard icon={Check} label={t("admin.processed_payouts")} value={overview.processed_payouts_count} sub={`\u20AC${overview.processed_payouts_amount.toFixed(2)}`} color="#00D26A" delay={0.16} />
                  </div>
                  <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.012)", border: "1px solid rgba(255,255,255,0.03)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h3 className="text-[11px] font-semibold text-[#444] uppercase tracking-[0.1em] mb-2">{t("admin.today_label")}</h3>
                    <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                      <span className="text-[12px] text-white/60">{t("admin.txns")}</span>
                      <span className="text-[13px] font-semibold font-outfit text-white/80">{overview.today_transactions}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-[12px] text-white/60">{t("admin.new_users")}</span>
                      <span className="text-[13px] font-semibold font-outfit text-white/80">{overview.today_new_users}</span>
                    </div>
                  </motion.div>
                  {/* ── Admin Exports ── */}
                  <motion.div className="mt-5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                    <ExportSection
                      title={t("export.admin_reports")}
                      exports={adminExports}
                      t={t}
                      testIdPrefix="admin-export"
                    />
                  </motion.div>
                </>
              )}
            </motion.div>
          )}

          {/* ── Users Tab ── */}
          {tab === "users" && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <Search size={14} className="text-[#333]" />
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load("users")}
                    placeholder={t("admin.search") + "..."} className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-[#2A2A2A]" />
                </div>
                <motion.button onClick={() => load("users")} className="px-3 py-2.5 bg-[#00C2FF]/10 text-[#00C2FF] rounded-xl text-[11px] font-semibold" whileTap={{ scale: 0.95 }}>{t("admin.search")}</motion.button>
              </div>
              {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-[60px]" />)}</div> : (
                <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                  {users.map((u, i) => (
                    <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${i < users.length-1 ? "border-b border-white/[0.03]" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-[#00C2FF]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-[#00C2FF]">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-medium text-white/90 truncate">{u.name}</p>
                          {u.role === "admin" && <span className="text-[7px] px-1.5 py-0.5 bg-[#FF4757]/10 text-[#FF4757] rounded-full font-bold uppercase">Admin</span>}
                        </div>
                        <p className="text-[10px] text-[#333] truncate">{u.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[12px] font-bold font-outfit text-white/80">&euro;{u.balance.toFixed(2)}</p>
                        <p className="text-[9px] text-[#333]">{u.transaction_count} txns</p>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_results")}</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Merchants Tab ── */}
          {tab === "merchants" && (
            <motion.div key="merchants" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-[70px]" />)}</div> : (
                <div className="space-y-2.5">
                  {merchants.map(m => (
                    <div key={m.id} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <Store size={14} className="text-[#00D26A]" />
                        <span className="text-[12px] font-medium text-white/90 truncate flex-1">{m.business_name}</span>
                        <span className="text-[9px] text-[#333]">{m.total_transactions} txns</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div><p className="text-[8px] text-[#444] uppercase">Gross</p><p className="text-[11px] font-bold font-outfit text-white/80">&euro;{m.gross_earnings.toFixed(0)}</p></div>
                        <div><p className="text-[8px] text-[#444] uppercase">Net</p><p className="text-[11px] font-bold font-outfit text-[#00D26A]">&euro;{m.total_earnings.toFixed(0)}</p></div>
                        <div><p className="text-[8px] text-[#444] uppercase">Available</p><p className="text-[11px] font-bold font-outfit text-[#00C2FF]">&euro;{m.available_payout.toFixed(0)}</p></div>
                        <div><p className="text-[8px] text-[#444] uppercase">Pending</p><p className="text-[11px] font-bold font-outfit text-[#FFB800]">&euro;{m.pending_payout.toFixed(0)}</p></div>
                      </div>
                    </div>
                  ))}
                  {merchants.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_results")}</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Payouts Tab ── */}
          {tab === "payouts" && (
            <motion.div key="payouts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
                {["", "pending", "approved", "processed", "failed", "cancelled"].map(s => (
                  <motion.button key={s} onClick={() => setPayoutFilter(s)} whileTap={{ scale: 0.95 }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap ${payoutFilter === s ? "bg-[#00C2FF]/10 text-[#00C2FF]" : "bg-white/[0.02] text-[#444]"}`}>
                    {s || t("common.all")}
                  </motion.button>
                ))}
              </div>
              {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-[70px]" />)}</div> : (
                <div className="space-y-2.5">
                  {payouts.map(po => (
                    <div key={po.reference} className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Download size={13} style={{ color: statusColors[po.status] }} />
                          <span className="text-[11px] font-medium text-white/90">{po.reference}</span>
                        </div>
                        <span className="text-[8px] uppercase font-bold tracking-[0.06em] px-2 py-0.5 rounded-full"
                          style={{ color: statusColors[po.status], background: `${statusColors[po.status]}10`, border: `1px solid ${statusColors[po.status]}15` }}>
                          {po.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-[#444]">{po.merchant_name}</span>
                        <span className="text-[14px] font-bold font-outfit text-white/90">&euro;{po.net_amount.toFixed(2)}</span>
                      </div>
                      {(po.status === "pending" || po.status === "approved") && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-white/[0.03]">
                          {po.status === "pending" && (
                            <motion.button onClick={() => handlePayoutAction(po.reference, "approve")} disabled={actionLoading === po.reference}
                              className="flex-1 py-2 bg-[#00C2FF]/10 text-[#00C2FF] rounded-lg text-[10px] font-semibold" whileTap={{ scale: 0.95 }}>
                              {actionLoading === po.reference ? <Loader2 size={12} className="animate-spin mx-auto" /> : t("admin.approve")}
                            </motion.button>
                          )}
                          {po.status === "approved" && (
                            <motion.button onClick={() => handlePayoutAction(po.reference, "process")} disabled={actionLoading === po.reference}
                              className="flex-1 py-2 bg-[#00D26A]/10 text-[#00D26A] rounded-lg text-[10px] font-semibold" whileTap={{ scale: 0.95 }}>
                              {actionLoading === po.reference ? <Loader2 size={12} className="animate-spin mx-auto" /> : t("admin.process")}
                            </motion.button>
                          )}
                          <motion.button onClick={() => handlePayoutAction(po.reference, po.status === "pending" ? "cancel" : "fail")} disabled={actionLoading === po.reference}
                            className="flex-1 py-2 bg-[#FF4757]/10 text-[#FF4757] rounded-lg text-[10px] font-semibold" whileTap={{ scale: 0.95 }}>
                            {po.status === "pending" ? t("scan.cancel") : t("admin.fail")}
                          </motion.button>
                        </div>
                      )}
                    </div>
                  ))}
                  {payouts.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_results")}</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Transactions Tab ── */}
          {tab === "transactions" && (
            <motion.div key="txns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <Search size={14} className="text-[#333]" />
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load("transactions")}
                    placeholder={t("admin.search") + "..."} className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-[#2A2A2A]" />
                </div>
                <motion.button onClick={() => load("transactions")} className="px-3 py-2.5 bg-[#00C2FF]/10 text-[#00C2FF] rounded-xl text-[11px] font-semibold" whileTap={{ scale: 0.95 }}>{t("admin.search")}</motion.button>
              </div>
              {loading ? <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-[50px]" />)}</div> : (
                <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                  {txns.map((t, i) => (
                    <div key={`${t.id}-${i}`} className={`flex items-center gap-3 px-3.5 py-2.5 ${i < txns.length-1 ? "border-b border-white/[0.03]" : ""}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${t.amount > 0 ? "#00D26A" : "#FF4757"}08` }}>
                        <CreditCard size={11} style={{ color: t.amount > 0 ? "#00D26A" : "#FF4757" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-white/80 truncate">{t.reference || "-"}</span>
                          <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                            style={{ color: statusColors[t.status] || "#666", background: `${statusColors[t.status] || "#666"}10` }}>{t.status}</span>
                        </div>
                        <p className="text-[9px] text-[#333] truncate">{t.type} · {t.merchant_name || t.description || "-"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[11px] font-bold font-outfit ${t.amount > 0 ? "text-[#00D26A]" : "text-white/80"}`}>
                          {t.amount > 0 ? "+" : ""}&euro;{Math.abs(t.amount).toFixed(2)}
                        </p>
                        {t.fee_amount > 0 && <p className="text-[8px] text-[#FFB800]">fee &euro;{t.fee_amount.toFixed(2)}</p>}
                      </div>
                    </div>
                  ))}
                  {txns.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_results")}</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Settings Tab (Editable Config) ── */}
          {tab === "settings" && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading || !settings ? <Skeleton className="h-[200px]" /> : (
                <div className="space-y-4">
                  <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[11px] font-semibold text-[#444] uppercase tracking-[0.1em]">{t("admin.fee_config")}</h3>
                      <motion.button data-testid="edit-fees-btn" whileTap={{ scale: 0.93 }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: editingFees ? "rgba(0,210,106,0.1)" : "rgba(255,255,255,0.04)", color: editingFees ? "#00D26A" : "#555", border: `1px solid ${editingFees ? "rgba(0,210,106,0.15)" : "rgba(255,255,255,0.05)"}` }}
                        onClick={() => {
                          if (editingFees) {
                            setSavingFees(true);
                            api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ fees: feeValues }) })
                              .then(d => { setSettings({ ...settings, fees: d.fees || feeValues }); setEditingFees(false); })
                              .catch(() => {})
                              .finally(() => setSavingFees(false));
                          } else {
                            setFeeValues({ ...settings.fees });
                            setEditingFees(true);
                          }
                        }}>
                        {savingFees ? <Loader2 size={10} className="animate-spin" /> : editingFees ? <><Save size={10} /> {t("admin.save_fees")}</> : <><Pencil size={10} /> {t("admin.edit_fees")}</>}
                      </motion.button>
                    </div>
                    {[
                      { key: "payment", label: t("admin.fee_payment"), pct: true, color: "#00C2FF" },
                      { key: "send", label: t("admin.fee_send"), pct: true, color: "#A855F7" },
                      { key: "topup", label: t("admin.fee_topup"), pct: true, color: "#00D26A" },
                      { key: "payout_flat", label: t("admin.fee_payout_flat"), pct: false, color: "#FFB800" },
                      { key: "min_payout", label: t("admin.fee_min_payout"), pct: false, color: "#FF6B6B" },
                      { key: "settlement_delay_hours", label: t("admin.fee_settlement"), pct: false, color: "#888" },
                    ].map((row, i, arr) => (
                      <div key={row.key} className={`flex items-center justify-between py-2.5 ${i < arr.length-1 ? "border-b border-white/[0.03]" : ""}`}>
                        <span className="text-[12px] text-white/60">{row.label}</span>
                        {editingFees ? (
                          <input data-testid={`fee-input-${row.key}`} type="number" step={row.pct ? 0.001 : 0.01}
                            value={feeValues[row.key]} onChange={e => setFeeValues({ ...feeValues, [row.key]: parseFloat(e.target.value) || 0 })}
                            className="w-20 text-right text-[13px] font-bold font-outfit bg-transparent outline-none border-b border-white/10 text-white"
                          />
                        ) : (
                          <span className="text-[13px] font-bold font-outfit" style={{ color: row.color }}>
                            {row.pct ? `${(settings.fees[row.key] * 100).toFixed(1)}%` : row.key === "settlement_delay_hours" ? `${settings.fees[row.key]}h` : `€${settings.fees[row.key].toFixed(2)}`}
                          </span>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Merchant Fee Editor Tab ── */}
          {tab === "merchant-fees" && (
            <motion.div key="merchant-fees" data-testid="admin-merchant-fees-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading || !merchantFees ? <Skeleton className="h-[300px]" /> : (
                <div className="space-y-4">
                  <motion.div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-[11px] font-semibold text-[#444] uppercase tracking-[0.1em]">{t("admin.pos_fee_config") || "POS Payment Fees"}</h3>
                        <p className="text-[8px] text-white/15 mt-0.5">{t("admin.pos_fee_desc") || "Configure merchant transaction fees by payment method"}</p>
                      </div>
                      <motion.button
                        data-testid="edit-merchant-fees-btn"
                        whileTap={{ scale: 0.93 }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium"
                        style={{
                          background: editingMerchantFees ? "rgba(0,210,106,0.1)" : "rgba(255,255,255,0.04)",
                          color: editingMerchantFees ? "#00D26A" : "#555",
                          border: `1px solid ${editingMerchantFees ? "rgba(0,210,106,0.15)" : "rgba(255,255,255,0.05)"}`,
                        }}
                        onClick={() => {
                          if (editingMerchantFees) {
                            setSavingMerchantFees(true);
                            api("/api/payments/admin/fees", { method: "POST", body: JSON.stringify({ fees: merchantFeeValues }) })
                              .then(d => { setMerchantFees(d.fees || merchantFeeValues); setEditingMerchantFees(false); })
                              .catch(() => {})
                              .finally(() => setSavingMerchantFees(false));
                          } else {
                            setMerchantFeeValues({ ...merchantFees });
                            setEditingMerchantFees(true);
                          }
                        }}
                      >
                        {savingMerchantFees ? <Loader2 size={10} className="animate-spin" /> : editingMerchantFees ? <><Save size={10} /> {t("admin.save_fees") || "Save"}</> : <><Pencil size={10} /> {t("admin.edit_fees") || "Edit"}</>}
                      </motion.button>
                    </div>

                    {[
                      { key: "nfc_wallet", label: "NFC Wallet (BidBlitz)", color: "#00E89D", desc: t("admin.fee_nfc_wallet_desc") || "Lowest fee — incentivizes app wallet usage" },
                      { key: "wallet", label: "BidBlitz Wallet", color: "#00C2FF", desc: t("admin.fee_wallet_desc") || "Standard wallet payment" },
                      { key: "barcode", label: "Barcode / QR", color: "#A855F7", desc: t("admin.fee_barcode_desc") || "Customer scans barcode or QR code" },
                      { key: "nfc_card", label: "Contactless Card", color: "#FFB800", desc: t("admin.fee_nfc_card_desc") || "Card tap / contactless" },
                      { key: "apple_pay", label: "Apple Pay", color: "#FF6B6B", desc: t("admin.fee_apple_desc") || "Apple Pay contactless" },
                      { key: "google_pay", label: "Google Pay", color: "#4285F4", desc: t("admin.fee_google_desc") || "Google Pay contactless" },
                      { key: "card", label: "Card Payment", color: "#888", desc: t("admin.fee_card_desc") || "Standard card payment" },
                    ].map((row, i, arr) => (
                      <div key={row.key} className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.color }} />
                          <div>
                            <span className="text-[12px] text-white/60 font-medium">{row.label}</span>
                            <p className="text-[8px] text-white/15">{row.desc}</p>
                          </div>
                        </div>
                        {editingMerchantFees ? (
                          <div className="flex items-center gap-1">
                            <input
                              data-testid={`merchant-fee-input-${row.key}`}
                              type="number"
                              step="0.01"
                              min="0"
                              max="50"
                              value={merchantFeeValues[row.key] ?? ""}
                              onChange={e => setMerchantFeeValues(prev => ({ ...prev, [row.key]: parseFloat(e.target.value) || 0 }))}
                              className="w-16 text-right text-[14px] font-bold font-mono bg-transparent outline-none border-b border-white/10 text-white px-1"
                            />
                            <span className="text-[11px] text-white/30">%</span>
                          </div>
                        ) : (
                          <span className="text-[14px] font-bold font-mono" style={{ color: row.color }}>
                            {typeof merchantFees[row.key] === "number" ? merchantFees[row.key].toFixed(2) : "—"}%
                          </span>
                        )}
                      </div>
                    ))}
                  </motion.div>

                  {/* Info note */}
                  <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.06)" }}>
                    <AlertCircle size={12} className="text-[#00C2FF]/40 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-white/25">{t("admin.fee_note") || "Changes apply immediately to all new transactions. Existing transactions are not affected. Values are in percentage (e.g., 0.30 = 0.30%)."}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Promotions Admin Tab ── */}
          {tab === "promos" && (
            <motion.div key="promos" data-testid="admin-promos-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-[60px]" />)}</div> : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold pl-1">{t("admin.promos")} ({promos.length})</p>
                    <motion.button data-testid="create-promo-btn" whileTap={{ scale: 0.93 }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/15"
                      onClick={() => setShowCreatePromo(!showCreatePromo)}>
                      <Plus size={10} /> {t("admin.create_promo")}
                    </motion.button>
                  </div>

                  {/* Create Promo Form */}
                  <AnimatePresence>
                    {showCreatePromo && (
                      <CreatePromoForm t={t} onCreated={(p) => { setPromos([p, ...promos]); setShowCreatePromo(false); }} onCancel={() => setShowCreatePromo(false)} />
                    )}
                  </AnimatePresence>

                  {/* Promos List */}
                  {promos.map((p) => (
                    <motion.div key={p.name} data-testid={`promo-row-${p.name}`}
                      className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Gift size={11} className={p.active ? "text-[#00D26A]" : "text-[#444]"} />
                            <span className="text-[12px] font-semibold text-white/90">{p.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: p.active ? "rgba(0,210,106,0.1)" : "rgba(255,255,255,0.03)", color: p.active ? "#00D26A" : "#555" }}>
                              {p.active ? t("admin.promo_active") : t("admin.promo_inactive")}
                            </span>
                          </div>
                          <p className="text-[9px] text-[#333] mt-0.5 pl-[19px]">
                            {p.type} · {t("admin.promo_value")}: {p.value}{p.type === "bonus_topup" || p.type === "cashback" || p.type === "reduced_fee" ? "%" : ""} · {t("admin.promo_uses")}: {p.current_uses}/{p.max_uses || "∞"} · {t("admin.promo_target")}: {p.target}
                          </p>
                        </div>
                        <motion.button data-testid={`promo-toggle-${p.name}`} whileTap={{ scale: 0.9 }}
                          onClick={async () => {
                            try {
                              await api(`/api/promotions/admin/toggle/${p.name}`, { method: "PUT" });
                              setPromos(promos.map(x => x.name === p.name ? { ...x, active: !x.active } : x));
                            } catch {}
                          }}>
                          {p.active ? <ToggleRight size={28} className="text-[#00D26A]" /> : <ToggleLeft size={28} className="text-[#333]" />}
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                  {promos.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_promos")}</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Feature Flags Tab ── */}
          {tab === "flags" && (
            <motion.div key="flags" data-testid="admin-flags-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-[56px]" />)}</div> : (
                <div className="space-y-2">
                  <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{t("admin.flags")} ({featureFlags.length})</p>
                  {featureFlags.map((flag) => (
                    <motion.div key={flag.name} data-testid={`flag-row-${flag.name}`}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Flag size={11} className={flag.enabled ? "text-[#00D26A]" : "text-[#444]"} />
                          <span className="text-[12px] font-semibold text-white/90">{flag.label || flag.name.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-[9px] text-[#333] mt-0.5 pl-[19px]">{t("admin.flag_access")}: {flag.access || "all"}</p>
                      </div>
                      <motion.button data-testid={`flag-toggle-${flag.name}`}
                        onClick={async () => {
                          try {
                            await api(`/api/admin/feature-flags/${flag.name}`, {
                              method: "PUT", body: JSON.stringify({ enabled: !flag.enabled })
                            });
                            setFeatureFlags(featureFlags.map(f => f.name === flag.name ? { ...f, enabled: !f.enabled } : f));
                          } catch {}
                        }}
                        className="flex items-center"
                        whileTap={{ scale: 0.9 }}>
                        {flag.enabled ? (
                          <ToggleRight size={28} className="text-[#00D26A]" />
                        ) : (
                          <ToggleLeft size={28} className="text-[#333]" />
                        )}
                      </motion.button>
                    </motion.div>
                  ))}
                  {featureFlags.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_flags")}</p>}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Audit Logs Tab ── */}
          {tab === "audit" && (
            <motion.div key="audit" data-testid="admin-audit-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[50px]" />)}</div> : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold pl-1">{t("admin.audit")} ({auditTotal})</p>
                    <span className="text-[9px] text-[#333] font-medium">{t("admin.showing")} {auditLogs.length}</span>
                  </div>
                  <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                    {auditLogs.map((log, i) => {
                      const evColor = log.severity === "warn" ? "#FFB800" : log.severity === "error" ? "#FF4757" : "#00D26A";
                      return (
                        <div key={i} data-testid={`audit-log-${i}`}
                          className={`flex items-start gap-3 px-4 py-3 ${i < auditLogs.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: evColor }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-white/80">{log.event}</span>
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                                style={{ color: evColor, background: `${evColor}10` }}>{log.severity || "info"}</span>
                            </div>
                            <p className="text-[9px] text-[#444] truncate mt-0.5">{log.email || log.user_id || "-"}</p>
                            <p className="text-[8px] text-[#222] mt-0.5">{log.ip} · {new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                    {auditLogs.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_audit")}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Compliance Tab ── */}
          {tab === "compliance" && (
            <motion.div key="compliance" data-testid="admin-compliance-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? <Skeleton className="h-[200px]" /> : (
                <div className="space-y-4">
                  {/* Sub-tab toggle */}
                  <div className="flex gap-2">
                    {[
                      { id: "flags", label: `${t("admin.comp_flags")} (${complianceFlags.length})`, color: "#FF4757" },
                      { id: "checks", label: `${t("admin.comp_checks")} (${complianceChecks.length})`, color: "#00C2FF" },
                    ].map(st => (
                      <motion.button key={st.id} onClick={() => setComplianceTab(st.id)} whileTap={{ scale: 0.95 }}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                          complianceTab === st.id ? `border` : "bg-white/[0.02] text-[#444] border border-white/[0.04]"
                        }`}
                        style={complianceTab === st.id ? { background: `${st.color}10`, borderColor: `${st.color}30`, color: st.color } : {}}>
                        {st.label}
                      </motion.button>
                    ))}
                  </div>

                  {complianceTab === "flags" && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      {complianceFlags.map((flag, i) => (
                        <div key={i} data-testid={`compliance-flag-${i}`}
                          className={`px-4 py-3 ${i < complianceFlags.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertCircle size={12} className={flag.status === "open" ? "text-[#FF4757]" : "text-[#00D26A]"} />
                              <span className="text-[11px] font-semibold text-white/80">{flag.reason || "Flagged"}</span>
                            </div>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                              style={{ color: flag.status === "open" ? "#FF4757" : "#00D26A", background: flag.status === "open" ? "rgba(255,71,87,0.1)" : "rgba(0,210,106,0.1)" }}>
                              {flag.status}
                            </span>
                          </div>
                          <p className="text-[9px] text-[#333] mt-1">{t("admin.comp_user")}: {flag.user_id || "-"} · {flag.txn_type || "-"} · €{flag.amount?.toFixed(2) || "0.00"}</p>
                          <p className="text-[8px] text-[#222] mt-0.5">{new Date(flag.created_at).toLocaleString()}</p>
                          {flag.status === "open" && (
                            <motion.button data-testid={`resolve-flag-${i}`}
                              onClick={async () => {
                                try {
                                  await api(`/api/admin/compliance-flags/${i}/resolve`, { method: "POST", body: JSON.stringify({ resolution: "Reviewed and resolved" }) });
                                  setComplianceFlags(complianceFlags.map((f, idx) => idx === i ? { ...f, status: "resolved" } : f));
                                } catch {}
                              }}
                              className="mt-2 px-3 py-1 rounded-lg text-[10px] font-medium bg-[#00D26A]/10 text-[#00D26A] border border-[#00D26A]/15"
                              whileTap={{ scale: 0.95 }}>
                              {t("admin.comp_resolve")}
                            </motion.button>
                          )}
                        </div>
                      ))}
                      {complianceFlags.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_comp_flags")}</p>}
                    </div>
                  )}

                  {complianceTab === "checks" && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      {complianceChecks.map((chk, i) => {
                        const oc = chk.outcome === "passed" ? "#00D26A" : chk.outcome === "blocked" ? "#FF4757" : "#FFB800";
                        return (
                          <div key={i} data-testid={`compliance-check-${i}`}
                            className={`px-4 py-3 ${i < complianceChecks.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-white/80">{chk.txn_type}</span>
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ color: oc, background: `${oc}10` }}>{chk.outcome}</span>
                            </div>
                            <p className="text-[9px] text-[#333] mt-0.5">€{chk.amount?.toFixed(2) || "0"} · KYC: {chk.kyc_level || "-"}</p>
                            {chk.rules_triggered?.length > 0 && (
                              <p className="text-[8px] text-[#FFB800] mt-0.5">{t("admin.comp_rules")}: {chk.rules_triggered.join(", ")}</p>
                            )}
                            <p className="text-[8px] text-[#222] mt-0.5">{new Date(chk.timestamp).toLocaleString()}</p>
                          </div>
                        );
                      })}
                      {complianceChecks.length === 0 && <p className="text-center py-8 text-[12px] text-[#333]">{t("admin.no_comp_checks")}</p>}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Analytics Tab ── */}
          {tab === "analytics" && (
            <motion.div key="analytics" data-testid="admin-analytics-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading || !analyticsData ? <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-[80px]" />)}</div> : (
                <div className="space-y-4">
                  {/* Overview metrics */}
                  <div>
                    <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{t("admin.ga_overview")}</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <StatCard icon={Users} label={t("admin.ga_total_users")} value={analyticsData.overview.total_users} color="#00C2FF" delay={0.06} />
                      <StatCard icon={Activity} label={t("admin.ga_active_30d")} value={analyticsData.overview.active_30d} color="#00D26A" delay={0.08} />
                      <StatCard icon={TrendingUp} label={t("admin.ga_growth")} value={`${(analyticsData.overview.growth_rate * 100).toFixed(1)}%`} color="#A855F7" delay={0.10} />
                      <StatCard icon={CircleDollarSign} label={t("admin.ga_arpu")} value={`€${analyticsData.overview.arpu?.toFixed(2) || "0.00"}`} color="#FFB800" delay={0.12} />
                    </div>
                  </div>

                  {/* Funnel */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                    <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{t("admin.ga_funnel")}</p>
                    <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      {analyticsData.funnel.steps?.map((step, i) => {
                        const pct = analyticsData.funnel.steps[0].count > 0 ? (step.count / analyticsData.funnel.steps[0].count) * 100 : 0;
                        const barColors = ["#00C2FF", "#A855F7", "#00D26A", "#FFB800", "#FF6B6B"];
                        const bc = barColors[i % barColors.length];
                        return (
                          <div key={step.name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-medium text-white/70">{step.name}</span>
                              <span className="text-[11px] font-bold text-white/90">{step.count} <span className="text-[9px] text-[#444]">({pct.toFixed(0)}%)</span></span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <motion.div className="h-full rounded-full" style={{ background: bc }}
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.1 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* Retention */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">{t("admin.ga_retention")}</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { label: t("admin.ga_day1"), value: `${((analyticsData.retention.day_1 || 0) * 100).toFixed(0)}%`, color: "#00C2FF" },
                        { label: t("admin.ga_day7"), value: `${((analyticsData.retention.day_7 || 0) * 100).toFixed(0)}%`, color: "#A855F7" },
                        { label: t("admin.ga_day30"), value: `${((analyticsData.retention.day_30 || 0) * 100).toFixed(0)}%`, color: "#FFB800" },
                      ].map(r => (
                        <div key={r.label} className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                          <p className="text-[15px] font-bold font-outfit" style={{ color: r.color }}>{r.value}</p>
                          <p className="text-[9px] text-[#444] font-medium mt-0.5">{r.label}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Campaigns */}
                  {analyticsData.campaigns?.campaigns?.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
                      <p className="text-[9px] text-[#333] uppercase tracking-[0.14em] font-semibold mb-2 pl-1">Campaigns</p>
                      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                        {analyticsData.campaigns.campaigns.map((camp, i) => (
                          <div key={camp.name} className={`px-4 py-3 ${i < analyticsData.campaigns.campaigns.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-white/80">{camp.name}</span>
                              <span className="text-[10px] text-[#00D26A] font-bold">{camp.total_uses || camp.signups || 0} {t("admin.ga_uses")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>

          {/* Role Requests Tab */}
          {tab === "roles" && (
            <motion.div key="roles" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={slide}>
              <div className="flex gap-2 mb-4">
                {["pending", "approved", "rejected", "all"].map(f => (
                  <motion.button key={f} onClick={() => { setRoleFilter(f); }} whileTap={{ scale: 0.95 }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold ${roleFilter === f ? "bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20" : "bg-white/[0.02] text-[#444] border border-white/[0.04]"}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </motion.button>
                ))}
              </div>
              {roleRequests.length === 0 ? (
                <div className="text-center py-8"><p className="text-[12px] text-[#333]">{t("admin.no_role_requests") || "No role requests"}</p></div>
              ) : (
                <div className="space-y-2">
                  {roleRequests.map((rr, i) => (
                    <div key={i} data-testid={`role-request-${rr.user_id}`} className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <p className="text-[12px] font-semibold text-white/80">{rr.user_name}</p>
                          <p className="text-[10px] text-[#444]">{rr.user_email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${rr.status === "approved" ? "bg-[#00D26A]/10 text-[#00D26A]" : rr.status === "rejected" ? "bg-[#FF4757]/10 text-[#FF4757]" : "bg-[#FFB800]/10 text-[#FFB800]"}`}>
                          {rr.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-[#555]">{rr.current_role}</span>
                          <ChevronRight size={10} className="text-[#333]" />
                          <span className="text-[10px] text-[#00E0FF] font-bold">{rr.requested_role}</span>
                        </div>
                        {rr.status === "pending" && (
                          <div className="flex gap-1.5">
                            <motion.button data-testid={`approve-role-${rr.user_id}`} onClick={() => handleRoleDecision(rr.user_id, "approve")} disabled={actionLoading === rr.user_id} whileTap={{ scale: 0.9 }}
                              className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-[#00D26A]/10 text-[#00D26A] border border-[#00D26A]/15">
                              {actionLoading === rr.user_id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                            </motion.button>
                            <motion.button data-testid={`reject-role-${rr.user_id}`} onClick={() => handleRoleDecision(rr.user_id, "reject")} disabled={actionLoading === rr.user_id} whileTap={{ scale: 0.9 }}
                              className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-[#FF4757]/10 text-[#FF4757] border border-[#FF4757]/15">
                              <X size={10} />
                            </motion.button>
                          </div>
                        )}
                      </div>
                      <p className="text-[8px] text-[#222] mt-1">{rr.created_at?.slice(0, 16)}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Verification Review Tab */}
          {tab === "verification" && (
            <motion.div key="verification" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={slide}>
              <div className="flex gap-2 mb-4">
                {["pending", "approved", "rejected", "all"].map(f => (
                  <motion.button key={f} onClick={() => { setVerFilter(f); }} whileTap={{ scale: 0.95 }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold ${verFilter === f ? "bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20" : "bg-white/[0.02] text-[#444] border border-white/[0.04]"}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </motion.button>
                ))}
              </div>
              {verifications.length === 0 ? (
                <div className="text-center py-8"><p className="text-[12px] text-[#333]">{t("admin.no_verifications") || "No verifications"}</p></div>
              ) : (
                <div className="space-y-3">
                  {verifications.map((v, i) => (
                    <div key={i} data-testid={`verification-${v.user_id}`} className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.035)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-[12px] font-semibold text-white/80">{v.user_name}</p>
                          <p className="text-[10px] text-[#444]">{v.user_email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#00E0FF] font-bold">{v.requested_role}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${v.status === "approved" ? "bg-[#00D26A]/10 text-[#00D26A]" : v.status === "rejected" ? "bg-[#FF4757]/10 text-[#FF4757]" : "bg-[#FFB800]/10 text-[#FFB800]"}`}>
                            {v.status}
                          </span>
                        </div>
                      </div>
                      {/* Document Images */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {[
                          { key: "id_front", label: t("verify.id_front") || "ID Front" },
                          { key: "id_back", label: t("verify.id_back") || "ID Back" },
                          { key: "selfie", label: t("verify.selfie") || "Selfie" },
                        ].map(doc => (
                          <div key={doc.key} className="text-center">
                            <a href={apiService.getVerificationFileUrl(v[doc.key])} target="_blank" rel="noreferrer"
                              className="block rounded-lg overflow-hidden border border-white/[0.05] hover:border-[#00E0FF]/20 transition-colors">
                              <img src={apiService.getVerificationFileUrl(v[doc.key])} alt={doc.label}
                                className="w-full h-20 object-cover bg-white/[0.02]"
                                onError={(e) => { e.target.style.display = "none"; }} />
                            </a>
                            <p className="text-[8px] text-white/20 mt-0.5">{doc.label}</p>
                          </div>
                        ))}
                      </div>
                      {v.status === "pending" && (
                        <div className="flex gap-1.5 mt-2">
                          <motion.button data-testid={`approve-ver-${v.user_id}`} onClick={() => handleVerDecision(v.user_id, "approve")} disabled={actionLoading === v.user_id} whileTap={{ scale: 0.9 }}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-[#00D26A]/10 text-[#00D26A] border border-[#00D26A]/15 flex items-center justify-center gap-1">
                            {actionLoading === v.user_id ? <Loader2 size={10} className="animate-spin" /> : <><Check size={10} /> {t("admin.approve") || "Approve"}</>}
                          </motion.button>
                          <motion.button data-testid={`reject-ver-${v.user_id}`} onClick={() => handleVerDecision(v.user_id, "reject")} disabled={actionLoading === v.user_id} whileTap={{ scale: 0.9 }}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-[#FF4757]/10 text-[#FF4757] border border-[#FF4757]/15 flex items-center justify-center gap-1">
                            <X size={10} /> {t("admin.reject") || "Reject"}
                          </motion.button>
                        </div>
                      )}
                      <p className="text-[8px] text-[#222] mt-1">{v.created_at?.slice(0, 16)}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Auctions Bot Admin Tab ── */}
          {tab === "auctions" && (
            <motion.div key="auctions-admin" data-testid="admin-auctions-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-[120px]" />)}</div> : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Bot size={14} className="text-[#00E89D]" />
                      <p className="text-[10px] text-[#444] uppercase tracking-[0.12em] font-semibold">{t("admin.auctions_title") || "Auction Bot Control"} ({adminAuctions.filter(a => a.status === "active").length} {t("admin.auctions_active") || "active"})</p>
                    </div>
                    <motion.button onClick={() => load("auctions")} whileTap={{ scale: 0.95 }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.03] text-[#555] border border-white/[0.05]">
                      {t("admin.auctions_refresh") || "Refresh"}
                    </motion.button>
                  </div>

                  {adminAuctions.filter(a => a.status === "active").length === 0 && (
                    <p className="text-center py-10 text-[12px] text-[#333]">{t("admin.auctions_none") || "No active auctions"}</p>
                  )}

                  {adminAuctions.filter(a => a.status === "active").map((auc) => {
                    const targetPrice = auc._bot_target_price || 0;
                    const bidsNeeded = targetPrice > 0 ? Math.round(targetPrice / 0.01) : 0;
                    const estimatedRevenue = bidsNeeded * 0.50;
                    const progress = targetPrice > 0 ? Math.min(100, ((auc.current_price || 0) / targetPrice) * 100) : 0;

                    return (
                      <motion.div key={auc.auction_id} data-testid={`auction-bot-${auc.auction_id}`}
                        className="rounded-2xl overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.015)", border: `1px solid ${auc._bot_enabled ? "rgba(0,232,157,0.12)" : "rgba(255,255,255,0.035)"}` }}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

                        {/* Header */}
                        <div className="px-4 py-3 flex items-center gap-3">
                          {auc.image_url && (
                            <img src={auc.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-white/[0.02]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-white/90 truncate">{auc.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[#00E89D] font-bold font-mono">{"\u20AC"}{(auc.current_price || 0).toFixed(2)}</span>
                              <span className="text-[8px] text-[#333]">{auc.total_bids || 0} {t("admin.auctions_bids") || "bids"}</span>
                              {auc.bot_bids_placed > 0 && (
                                <span className="text-[8px] text-[#A855F7] font-medium">{auc.bot_bids_placed} bot</span>
                              )}
                              <span className="text-[8px] text-[#444]">{Math.floor((auc.remaining_seconds || 0) / 60)}m {Math.floor((auc.remaining_seconds || 0) % 60)}s</span>
                            </div>
                          </div>
                          {/* Bot Toggle */}
                          <motion.button
                            data-testid={`bot-toggle-${auc.auction_id}`}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              setAdminAuctions(prev => prev.map(a =>
                                a.auction_id === auc.auction_id ? { ...a, _bot_enabled: !a._bot_enabled } : a
                              ));
                            }}>
                            {auc._bot_enabled ? <ToggleRight size={28} className="text-[#00E89D]" /> : <ToggleLeft size={28} className="text-[#333]" />}
                          </motion.button>
                        </div>

                        {/* Bot Config Panel */}
                        <AnimatePresence>
                          {auc._bot_enabled && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden">
                              <div className="px-4 pb-3 space-y-2.5 border-t border-white/[0.03] pt-3">

                                {/* Target Price Input */}
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <label className="text-[9px] text-[#444] font-medium block mb-1">
                                      <Target size={9} className="inline mr-1 text-[#FFB800]" />{t("admin.auctions_target") || "Target Price"} ({"\u20AC"})
                                    </label>
                                    <input
                                      data-testid={`bot-target-${auc.auction_id}`}
                                      type="number" step="0.5" min="0" max="10000"
                                      value={auc._bot_target_price}
                                      onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setAdminAuctions(prev => prev.map(a =>
                                          a.auction_id === auc.auction_id ? { ...a, _bot_target_price: val } : a
                                        ));
                                      }}
                                      className="w-full px-3 py-2 rounded-xl text-[13px] text-white/90 font-bold font-mono outline-none bg-white/[0.03] border border-white/[0.06]"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[9px] text-[#444] font-medium block mb-1">
                                      <Clock size={9} className="inline mr-1 text-[#00C2FF]" />{t("admin.auctions_window") || "Start (Sek. vor Ende)"}
                                    </label>
                                    <input
                                      data-testid={`bot-window-${auc.auction_id}`}
                                      type="number" step="60" min="0" max="86400"
                                      value={auc._bot_min_seconds}
                                      onChange={e => {
                                        const val = parseInt(e.target.value) || 0;
                                        setAdminAuctions(prev => prev.map(a =>
                                          a.auction_id === auc.auction_id ? { ...a, _bot_min_seconds: val } : a
                                        ));
                                      }}
                                      className="w-full px-3 py-2 rounded-xl text-[13px] text-white/90 font-bold font-mono outline-none bg-white/[0.03] border border-white/[0.06]"
                                    />
                                  </div>
                                </div>

                                {/* Revenue Calculation */}
                                {targetPrice > 0 && (
                                  <div className="rounded-xl p-2.5 flex items-center justify-between" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.08)" }}>
                                    <div className="flex items-center gap-2">
                                      <DollarSign size={12} className="text-[#00E89D]" />
                                      <div>
                                        <p className="text-[9px] text-[#444]">{t("admin.auctions_math") || "Revenue Calculation"}</p>
                                        <p className="text-[8px] text-white/20 font-mono">{targetPrice.toFixed(2)} / 0.01 × 0.50</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[15px] font-bold font-outfit text-[#00E89D]">{"\u20AC"}{estimatedRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</p>
                                      <p className="text-[8px] text-[#444]">{bidsNeeded.toLocaleString()} {t("admin.auctions_bids_needed") || "bids needed"}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Progress bar */}
                                {targetPrice > 0 && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[9px] text-[#444]">{t("admin.auctions_progress") || "Progress"}</span>
                                      <span className="text-[9px] text-white/40 font-mono">{(auc.current_price || 0).toFixed(2)} / {targetPrice.toFixed(2)} ({progress.toFixed(1)}%)</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                                      <motion.div className="h-full rounded-full" style={{ background: progress >= 100 ? "#00D26A" : "#00E89D" }}
                                        initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
                                    </div>
                                  </div>
                                )}

                                {/* Bot Strategy Selector */}
                                <div className="pt-2 border-t border-white/[0.03]">
                                  <label className="text-[9px] text-[#444] font-medium block mb-1.5">
                                    <Cpu size={9} className="inline mr-1 text-[#A855F7]" />Bot-Strategie
                                  </label>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {[
                                      { id: "standard", name: "Standard", color: "#00E89D" },
                                      { id: "sniper", name: "Sniper", color: "#FF6B6B" },
                                      { id: "pressure", name: "Pressure", color: "#FFB800" },
                                      { id: "marathon", name: "Marathon", color: "#00C2FF" },
                                      { id: "whale", name: "Whale", color: "#A855F7" },
                                    ].map(strat => (
                                      <motion.button
                                        key={strat.id}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => {
                                          setAdminAuctions(prev => prev.map(a =>
                                            a.auction_id === auc.auction_id ? { ...a, _bot_strategy: strat.id } : a
                                          ));
                                        }}
                                        className="px-2 py-1.5 rounded-lg text-[9px] font-medium"
                                        style={{
                                          background: auc._bot_strategy === strat.id ? `${strat.color}15` : "rgba(255,255,255,0.02)",
                                          border: `1px solid ${auc._bot_strategy === strat.id ? `${strat.color}40` : "rgba(255,255,255,0.04)"}`,
                                          color: auc._bot_strategy === strat.id ? strat.color : "#555",
                                        }}
                                      >
                                        {strat.name}
                                      </motion.button>
                                    ))}
                                  </div>
                                </div>

                                {/* Aggression Level */}
                                <div>
                                  <label className="text-[9px] text-[#444] font-medium block mb-1.5">
                                    <Zap size={9} className="inline mr-1 text-[#FFB800]" />Aggressivität
                                  </label>
                                  <div className="grid grid-cols-4 gap-1">
                                    {[
                                      { id: "low", name: "Niedrig", color: "#00E89D" },
                                      { id: "medium", name: "Mittel", color: "#FFB800" },
                                      { id: "high", name: "Hoch", color: "#FF6B6B" },
                                      { id: "extreme", name: "Extrem", color: "#A855F7" },
                                    ].map(agg => (
                                      <motion.button
                                        key={agg.id}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => {
                                          setAdminAuctions(prev => prev.map(a =>
                                            a.auction_id === auc.auction_id ? { ...a, _bot_aggression: agg.id } : a
                                          ));
                                        }}
                                        className="px-1.5 py-1 rounded-lg text-[8px] font-medium"
                                        style={{
                                          background: auc._bot_aggression === agg.id ? `${agg.color}15` : "rgba(255,255,255,0.02)",
                                          border: `1px solid ${auc._bot_aggression === agg.id ? `${agg.color}40` : "rgba(255,255,255,0.04)"}`,
                                          color: auc._bot_aggression === agg.id ? agg.color : "#555",
                                        }}
                                      >
                                        {agg.name}
                                      </motion.button>
                                    ))}
                                  </div>
                                </div>

                                {/* Final Battle Mode */}
                                <div>
                                  <label className="text-[9px] text-[#444] font-medium block mb-1.5">
                                    <Target size={9} className="inline mr-1 text-[#FF6B6B]" />Final Battle Modus
                                  </label>
                                  <div className="grid grid-cols-4 gap-1">
                                    {[
                                      { id: "passive", name: "Passiv" },
                                      { id: "normal", name: "Normal" },
                                      { id: "aggressive", name: "Aggro" },
                                      { id: "berserker", name: "Berserker" },
                                    ].map(fb => (
                                      <motion.button
                                        key={fb.id}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => {
                                          setAdminAuctions(prev => prev.map(a =>
                                            a.auction_id === auc.auction_id ? { ...a, _bot_final_battle: fb.id } : a
                                          ));
                                        }}
                                        className="px-1.5 py-1 rounded-lg text-[8px] font-medium"
                                        style={{
                                          background: auc._bot_final_battle === fb.id ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.02)",
                                          border: `1px solid ${auc._bot_final_battle === fb.id ? "rgba(255,107,107,0.4)" : "rgba(255,255,255,0.04)"}`,
                                          color: auc._bot_final_battle === fb.id ? "#FF6B6B" : "#555",
                                        }}
                                      >
                                        {fb.name}
                                      </motion.button>
                                    ))}
                                  </div>
                                </div>

                                {/* Save Button */}
                                <motion.button
                                  data-testid={`bot-save-${auc.auction_id}`}
                                  whileTap={{ scale: 0.96 }}
                                  disabled={botSaving === auc.auction_id}
                                  onClick={async () => {
                                    setBotSaving(auc.auction_id);
                                    try {
                                      await api("/api/auctions/admin/bot-config", {
                                        method: "POST",
                                        body: JSON.stringify({
                                          auction_id: auc.auction_id,
                                          bot_enabled: auc._bot_enabled,
                                          bot_target_price: auc._bot_target_price,
                                          bot_min_seconds: auc._bot_min_seconds,
                                          bot_aggression: auc._bot_aggression || "medium",
                                          bot_final_battle_mode: auc._bot_final_battle || "normal",
                                          bot_react_to_users: true,
                                          bot_max_bids_per_minute: auc._bot_aggression === "extreme" ? 20 : auc._bot_aggression === "high" ? 12 : auc._bot_aggression === "low" ? 3 : 6,
                                          bot_min_delay_seconds: auc._bot_aggression === "extreme" ? 1 : auc._bot_aggression === "high" ? 2 : auc._bot_aggression === "low" ? 10 : 5,
                                          bot_max_delay_seconds: auc._bot_aggression === "extreme" ? 4 : auc._bot_aggression === "high" ? 8 : auc._bot_aggression === "low" ? 30 : 15,
                                        }),
                                      });
                                    } catch {}
                                    setBotSaving(null);
                                  }}
                                  className="w-full py-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5"
                                  style={{ background: "rgba(0,232,157,0.1)", color: "#00E89D", border: "1px solid rgba(0,232,157,0.15)" }}>
                                  {botSaving === auc.auction_id ? <Loader2 size={12} className="animate-spin" /> : <><Zap size={11} /> {t("admin.auctions_save_bot") || "Bot speichern"}</>}
                                </motion.button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}

                  {/* Ended auctions (collapsed) */}
                  {adminAuctions.filter(a => a.status === "ended").length > 0 && (
                    <div className="mt-4">
                      <p className="text-[9px] text-[#333] uppercase tracking-[0.12em] font-semibold mb-2">{t("admin.auctions_ended") || "Ended"} ({adminAuctions.filter(a => a.status === "ended").length})</p>
                      <div className="space-y-1.5">
                        {adminAuctions.filter(a => a.status === "ended").slice(0, 10).map(auc => (
                          <div key={auc.auction_id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.025)" }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-white/40 truncate">{auc.title}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-[11px] font-mono text-white/30">{"\u20AC"}{(auc.current_price || 0).toFixed(2)}</span>
                              <span className="text-[9px] text-[#333]">{auc.total_bids || 0} bids</span>
                              {auc.bot_bids_placed > 0 && <span className="text-[8px] text-[#A855F7]/50">{auc.bot_bids_placed} bot</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* SCOOTER FLEET MANAGEMENT TAB */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {tab === "scooters" && (
            <motion.div key="scooters" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-2">
                <StatCard icon={Zap} label="Gesamt" value={scooterStats?.total || 0} color="#00C2FF" delay={0} />
                <StatCard icon={Check} label="Verfügbar" value={scooterStats?.available || 0} color="#00D26A" delay={0.05} />
                <StatCard icon={Activity} label="In Benutzung" value={scooterStats?.in_use || 0} color="#FFB800" delay={0.1} />
                <StatCard icon={AlertCircle} label="Wartung" value={scooterStats?.maintenance || 0} color="#FF4757" delay={0.15} />
              </div>

              {/* Add Scooter Button */}
              <motion.button
                data-testid="add-scooter-btn"
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAddScooter(!showAddScooter)}
                className="w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
                style={{ background: "rgba(0,194,255,0.08)", color: "#00C2FF", border: "1px solid rgba(0,194,255,0.15)" }}
              >
                <Plus size={16} /> Neuen Scooter hinzufügen
              </motion.button>

              {/* Add Scooter Form */}
              <AnimatePresence>
                {showAddScooter && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden rounded-2xl p-4 space-y-3"
                    style={{ background: "rgba(0,194,255,0.02)", border: "1px solid rgba(0,194,255,0.08)" }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-[#444] font-medium block mb-1">Geräte-ID *</label>
                        <input
                          data-testid="scooter-device-id"
                          value={newScooter.device_id}
                          onChange={e => setNewScooter({ ...newScooter, device_id: e.target.value })}
                          placeholder="z.B. DEV-12345"
                          className="w-full px-3 py-2 rounded-xl text-[12px] text-white/90 placeholder-[#333] font-medium outline-none bg-white/[0.03] border border-white/[0.05]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#444] font-medium block mb-1">QR-Code</label>
                        <input
                          data-testid="scooter-qr-code"
                          value={newScooter.qr_code}
                          onChange={e => setNewScooter({ ...newScooter, qr_code: e.target.value })}
                          placeholder="QR-Code ID"
                          className="w-full px-3 py-2 rounded-xl text-[12px] text-white/90 placeholder-[#333] font-medium outline-none bg-white/[0.03] border border-white/[0.05]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-[#444] font-medium block mb-1">Modell</label>
                        <select
                          data-testid="scooter-model"
                          value={newScooter.model}
                          onChange={e => setNewScooter({ ...newScooter, model: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl text-[12px] text-white/90 font-medium outline-none bg-white/[0.03] border border-white/[0.05] cursor-pointer"
                        >
                          <option value="Ninebot Max G30">Ninebot Max G30</option>
                          <option value="Xiaomi Pro 2">Xiaomi Pro 2</option>
                          <option value="Segway E45">Segway E45</option>
                          <option value="Bird One">Bird One</option>
                          <option value="Lime S">Lime S</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#444] font-medium block mb-1">Batterie %</label>
                        <input
                          data-testid="scooter-battery"
                          type="number"
                          min="0"
                          max="100"
                          value={newScooter.battery}
                          onChange={e => setNewScooter({ ...newScooter, battery: parseInt(e.target.value) || 100 })}
                          className="w-full px-3 py-2 rounded-xl text-[12px] text-white/90 font-medium outline-none bg-white/[0.03] border border-white/[0.05]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-[#444] font-medium block mb-1">Breitengrad (Lat)</label>
                        <input
                          data-testid="scooter-lat"
                          type="number"
                          step="0.0001"
                          value={newScooter.lat}
                          onChange={e => setNewScooter({ ...newScooter, lat: parseFloat(e.target.value) || 52.52 })}
                          className="w-full px-3 py-2 rounded-xl text-[12px] text-white/90 font-mono font-medium outline-none bg-white/[0.03] border border-white/[0.05]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#444] font-medium block mb-1">Längengrad (Lng)</label>
                        <input
                          data-testid="scooter-lng"
                          type="number"
                          step="0.0001"
                          value={newScooter.lng}
                          onChange={e => setNewScooter({ ...newScooter, lng: parseFloat(e.target.value) || 13.405 })}
                          className="w-full px-3 py-2 rounded-xl text-[12px] text-white/90 font-mono font-medium outline-none bg-white/[0.03] border border-white/[0.05]"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <motion.button
                        data-testid="scooter-submit"
                        whileTap={{ scale: 0.97 }}
                        disabled={savingScooter || !newScooter.device_id}
                        onClick={async () => {
                          setSavingScooter(true);
                          try {
                            await api("/api/scooter/admin/add", {
                              method: "POST",
                              body: JSON.stringify(newScooter),
                            });
                            setNewScooter({ device_id: "", qr_code: "", model: "Ninebot Max G30", lat: 52.52, lng: 13.405, battery: 100 });
                            setShowAddScooter(false);
                            load("scooters");
                          } catch (e) {
                            setError(e);
                          }
                          setSavingScooter(false);
                        }}
                        className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[#00D26A]/10 text-[#00D26A] border border-[#00D26A]/15 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {savingScooter ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Scooter hinzufügen</>}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowAddScooter(false)}
                        className="px-4 py-2.5 rounded-xl text-[12px] font-medium text-[#444] bg-white/[0.02] border border-white/[0.04]"
                      >
                        Abbrechen
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fleet List */}
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : scooterFleet.length === 0 ? (
                <div className="text-center py-10">
                  <Zap size={40} className="mx-auto text-[#333] mb-3" />
                  <p className="text-[#444] text-[13px]">Keine Scooter in der Flotte</p>
                  <p className="text-[#333] text-[11px] mt-1">Füge deinen ersten Scooter hinzu</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scooterFleet.map((scooter, idx) => {
                    const statusColor = scooter.status === "available" ? "#00D26A" : scooter.status === "in_use" ? "#FFB800" : scooter.status === "offline" ? "#FF4757" : "#666";
                    const batteryColor = scooter.battery >= 50 ? "#00D26A" : scooter.battery >= 20 ? "#FFB800" : "#FF4757";
                    
                    return (
                      <motion.div
                        key={scooter.scooter_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="rounded-2xl p-4 relative overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Zap size={14} className="text-[#00C2FF]" />
                              <span className="text-[13px] font-bold text-white/90">{scooter.scooter_id}</span>
                              <span
                                className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase"
                                style={{ background: `${statusColor}15`, color: statusColor }}
                              >
                                {scooter.status === "available" ? "Verfügbar" : scooter.status === "in_use" ? "In Benutzung" : scooter.status === "offline" ? "Offline" : scooter.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#444]">{scooter.model || scooter.name || "E-Scooter"}</p>
                            <div className="flex items-center gap-4 mt-2 text-[10px] text-[#555]">
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{ background: batteryColor }} />
                                {scooter.battery}% Batterie
                              </span>
                              {scooter.total_rides > 0 && (
                                <span>{scooter.total_rides} Fahrten</span>
                              )}
                              {scooter.total_revenue > 0 && (
                                <span className="text-[#00D26A]">€{scooter.total_revenue.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <motion.button
                              data-testid={`scooter-edit-${scooter.scooter_id}`}
                              whileTap={{ scale: 0.9 }}
                              onClick={async () => {
                                const newStatus = scooter.status === "available" ? "maintenance" : "available";
                                try {
                                  await api(`/api/scooter/admin/${scooter.scooter_id}`, {
                                    method: "PUT",
                                    body: JSON.stringify({ status: newStatus }),
                                  });
                                  load("scooters");
                                } catch {}
                              }}
                              className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[#666] hover:text-[#00C2FF]"
                            >
                              <Settings size={14} />
                            </motion.button>
                            <motion.button
                              data-testid={`scooter-delete-${scooter.scooter_id}`}
                              whileTap={{ scale: 0.9 }}
                              onClick={async () => {
                                if (window.confirm(`Scooter ${scooter.scooter_id} wirklich löschen?`)) {
                                  try {
                                    await api(`/api/scooter/admin/${scooter.scooter_id}`, { method: "DELETE" });
                                    load("scooters");
                                  } catch {}
                                }
                              }}
                              className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[#666] hover:text-[#FF4757]"
                            >
                              <X size={14} />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Revenue Summary */}
              {scooterStats && scooterStats.total_revenue > 0 && (
                <div className="rounded-2xl p-4" style={{ background: "rgba(0,210,106,0.02)", border: "1px solid rgba(0,210,106,0.08)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Euro size={16} className="text-[#00D26A]" />
                      <span className="text-[12px] text-[#444]">Gesamtumsatz Scooter</span>
                    </div>
                    <span className="text-[18px] font-bold font-outfit text-[#00D26A]">€{scooterStats.total_revenue.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-[#555] mt-1">{scooterStats.total_rides || 0} Fahrten insgesamt</p>
                </div>
              )}
            </motion.div>
          )}

      </div>
    </motion.div>
  );
};

export default AdminPage;
