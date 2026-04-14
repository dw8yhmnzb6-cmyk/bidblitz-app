/**
 * BidBlitz V2 - Full Admin Panel (Grid Layout)
 * Matches BidBlitz.ae admin structure with all categories
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, BarChart3, Users, ShieldCheck, Briefcase, UserPlus,
  Building2, Star, Car, CreditCard, Wallet, Euro, Key, Database,
  ArrowLeft, X, Menu, ChevronRight, Loader2, Search,
  Zap, Eye, Mail, Trophy, Target, Gift, MessageCircle,
  Wrench, FileText, Settings, Leaf, Lock, Activity, Mic,
  Bug, Server, Package, Crown, Ticket, BarChart, UserCheck,
  Globe, Gavel, Bot, Percent, TrendingUp, AlertCircle, Check, DollarSign,
  Home, GraduationCap, Film, Stethoscope, Heart, CarFront, Sparkles,
  Truck, Dog, Dumbbell, Palmtree, BatteryCharging, CalendarDays
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ADMIN_SECTIONS = [
  {
    title: "Kunden & Personal", color: "#3B82F6", count: 8,
    items: [
      { key: "users", icon: Users, label: "Kunden" },
      { key: "kyc", icon: ShieldCheck, label: "KYC-Freischaltung" },
      { key: "roles", icon: Briefcase, label: "Manager" },
      { key: "staff", icon: UserPlus, label: "Mitarbeiter" },
      { key: "enterprise", icon: Building2, label: "Großkunden" },
      { key: "influencer", icon: Star, label: "Influencer" },
      { key: "car-ads", icon: Car, label: "Auto-Werbung" },
      { key: "partner-credit", icon: CreditCard, label: "Partner-Freibetrag" },
    ],
  },
  {
    title: "Partner & Händler", color: "#F59E0B", count: 2,
    items: [
      { key: "partners", icon: Building2, label: "Partner Portal" },
      { key: "applications", icon: FileText, label: "Alte Bewerbungen" },
    ],
  },
  {
    title: "Finanzen", color: "#10B981", count: 7,
    items: [
      { key: "payments", icon: DollarSign, label: "Zahlungen" },
      { key: "wallet-topup", icon: Wallet, label: "Wallet Aufladen" },
      { key: "payouts", icon: Euro, label: "Wise Auszahlungen" },
      { key: "credits", icon: CreditCard, label: "Kredit-Verwaltung", nav: "/admin/credits" },
      { key: "api-keys", icon: Key, label: "Digital API" },
      { key: "wholesale", icon: Package, label: "Großhändler" },
      { key: "sepa", icon: Euro, label: "SEPA-Auszahlungen" },
    ],
  },
  {
    title: "Marketing", color: "#F59E0B", count: 7,
    items: [
      { key: "flash-sales", icon: Zap, label: "Flash Sales" },
      { key: "banners", icon: Eye, label: "Werbebanner" },
      { key: "email-marketing", icon: Mail, label: "E-Mail Marketing" },
      { key: "jackpot", icon: Trophy, label: "Jackpot" },
      { key: "challenges", icon: Target, label: "Challenges" },
      { key: "mystery-box", icon: Gift, label: "Mystery Box" },
      { key: "surveys", icon: MessageCircle, label: "Umfragen" },
    ],
  },
  {
    title: "Auktionen", color: "#A855F7", count: 9,
    items: [
      { key: "products", icon: Package, label: "Produkte" },
      { key: "standard-auctions", icon: Gavel, label: "Standard-Auktionen" },
      { key: "vip-auctions", icon: Crown, label: "VIP-Auktionen" },
      { key: "voucher-auctions", icon: Ticket, label: "Gutschein-Auktionen" },
      { key: "bot-system", icon: Bot, label: "Bot-System" },
      { key: "winner-control", icon: Trophy, label: "Gewinner-Kontrolle" },
      { key: "product-analytics", icon: BarChart, label: "Produkt-Analyse" },
      { key: "user-analytics", icon: UserCheck, label: "Benutzer-Analyse" },
      { key: "revenue-analytics", icon: TrendingUp, label: "Umsatz-Analyse" },
    ],
  },
  {
    title: "Gutscheine & Codes", color: "#F97316", count: 5,
    items: [
      { key: "merchant-vouchers", icon: Ticket, label: "Händler-Gutscheine" },
      { key: "bidder-vouchers", icon: Ticket, label: "Bieter-Gutscheine" },
      { key: "partner-vouchers", icon: Ticket, label: "Partner-Gutscheine" },
      { key: "discount-coupons", icon: Percent, label: "Rabatt-Coupons" },
      { key: "coupon-manager", icon: Gift, label: "Gutschein-Manager", nav: "gutscheine" },
    ],
  },
  {
    title: "Marktplätze & Services", color: "#059669", count: 8,
    items: [
      { key: "admin-immobilien", icon: Home, label: "Immobilien", nav: "/real-estate" },
      { key: "admin-freelancer", icon: Users, label: "Freelancer", nav: "/freelancer" },
      { key: "admin-elearning", icon: GraduationCap, label: "E-Learning", nav: "/elearning" },
      { key: "admin-handwerker", icon: Wrench, label: "Handwerker" },
      { key: "admin-gebrauchtwagen", icon: CarFront, label: "Gebrauchtwagen" },
      { key: "admin-reinigung", icon: Sparkles, label: "Reinigung" },
      { key: "admin-umzug", icon: Truck, label: "Umzugsservice" },
      { key: "admin-tierbetreuung", icon: Dog, label: "Tierbetreuung" },
    ],
  },
  {
    title: "Lifestyle & Gesundheit", color: "#EC4899", count: 5,
    items: [
      { key: "admin-streaming", icon: Film, label: "Streaming" },
      { key: "admin-telemedizin", icon: Stethoscope, label: "Telemedizin" },
      { key: "admin-dating", icon: Heart, label: "Dating" },
      { key: "admin-fitness", icon: Dumbbell, label: "Fitness" },
      { key: "admin-reiseplaner", icon: Palmtree, label: "Reiseplaner" },
    ],
  },
  {
    title: "Mobilität & Energie", color: "#10B981", count: 5,
    items: [
      { key: "admin-ladesaeulen", icon: BatteryCharging, label: "Ladesäulen" },
      { key: "admin-scooter-abos", icon: Zap, label: "Scooter-Abos" },
      { key: "admin-car-rental", icon: Car, label: "Mietwagen", nav: "/car-rental/admin" },
      { key: "admin-taxi", icon: Car, label: "Taxi-Fleet" },
      { key: "admin-parcels", icon: Package, label: "Pakete" },
    ],
  },
  {
    title: "System", color: "#6B7280", count: 10,
    items: [
      { key: "maintenance", icon: Wrench, label: "Wartung" },
      { key: "cms", icon: FileText, label: "Seiten (CMS)" },
      { key: "game-settings", icon: Settings, label: "Spiel-Einstellungen" },
      { key: "sustainability", icon: Leaf, label: "Nachhaltigkeit" },
      { key: "passwords", icon: Lock, label: "Passwörter" },
      { key: "system-logs", icon: Activity, label: "Systemlogs" },
      { key: "voice-commands", icon: Mic, label: "Sprachbefehle" },
      { key: "debug", icon: Bug, label: "Debug Reports" },
      { key: "system-health", icon: Server, label: "System" },
      { key: "database", icon: Database, label: "Daten-Management" },
    ],
  },
];

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Fehler");
  return d;
}

const AdminPanelFullPage = ({ onNavigate, onBack }) => {
  const [menuOpen, setMenuOpen] = useState(true);
  const [activeItem, setActiveItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  // Load overview stats
  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/stats");
        setStats(d);
      } catch {}
    })();
  }, []);

  const handleItemClick = async (item) => {
    if (item.nav?.startsWith("/")) { onNavigate(item.nav); return; }

    setMenuOpen(false);
    setActiveItem(item);
    setLoading(true);
    setData(null);
    setError(null);

    try {
      switch (item.key) {
        // ── Kunden & Personal ──
        case "users": {
          const d = await api("/api/admin/stats");
          const users = await api("/api/admin/users?limit=30").catch(() => ({ users: [] }));
          setData({ type: "users", stats: d, users: users.users || [] });
          break;
        }
        case "kyc": {
          const d = await api("/api/role-requests/admin/list?status=pending");
          setData({ type: "kyc", requests: d.requests || [] });
          break;
        }
        case "roles": {
          const d = await api("/api/role-requests/admin/list?status=pending");
          setData({ type: "roles", requests: d.requests || [] });
          break;
        }
        case "staff": case "enterprise": case "influencer": {
          const d = await api("/api/admin/stats");
          setData({ type: "user_filter", role: item.key, total_users: d.total_users || 0 });
          break;
        }
        case "car-ads": case "partner-credit": {
          setData({ type: "form", formType: item.key });
          break;
        }
        // ── Partner & Händler ──
        case "partners": {
          const d = await api("/api/admin/stats");
          setData({ type: "partners", stats: d });
          break;
        }
        case "applications": {
          const d = await api("/api/role-requests/admin/list?status=all").catch(() => ({ requests: [] }));
          setData({ type: "applications", requests: d.requests || [] });
          break;
        }
        // ── Finanzen ──
        case "payments": case "wallet-topup": case "payouts": case "sepa": case "wholesale": {
          const d = await api("/api/admin/stats");
          setData({ type: "finance_detail", subtype: item.key, stats: d });
          break;
        }
        case "credits": { onNavigate("/admin/credits"); break; }
        case "api-keys": {
          setData({ type: "api_keys" });
          break;
        }
        // ── Marketing ──
        case "flash-sales": case "banners": case "email-marketing": case "jackpot":
        case "challenges": case "mystery-box": case "surveys": {
          setData({ type: "marketing", subtype: item.key });
          break;
        }
        // ── Auktionen ──
        case "products": case "standard-auctions": case "vip-auctions": case "voucher-auctions": {
          const d = await api("/api/auctions/active");
          setData({ type: "auctions", subtype: item.key, auctions: d.auctions || [] });
          break;
        }
        case "bot-system": {
          const d = await api("/api/auctions/admin/config").catch(() => ({}));
          setData({ type: "bot_config", config: d });
          break;
        }
        case "winner-control": {
          const d = await api("/api/auctions/admin/winners").catch(() => ({ winners: [] }));
          setData({ type: "winners", winners: d.winners || [] });
          break;
        }
        case "product-analytics": case "user-analytics": case "revenue-analytics": {
          const d = await api("/api/admin/stats");
          setData({ type: "analytics", subtype: item.key, stats: d });
          break;
        }
        // ── Gutscheine ──
        case "merchant-vouchers": case "bidder-vouchers": case "partner-vouchers": case "discount-coupons": {
          const d = await api("/api/admin/grants/coupons");
          setData({ type: "coupons", subtype: item.key, coupons: d.coupons || [] });
          break;
        }
        case "coupon-manager": {
          onNavigate("/admin/old");
          break;
        }
        // ── System ──
        case "system-logs": {
          const d = await api("/api/admin/stats");
          setData({ type: "system_logs", stats: d });
          break;
        }
        // ── Marktplätze & Services (Admin Stats) ──
        case "admin-handwerker": {
          const d = await api("/api/handwerker/list");
          setData({ type: "module_list", module: "Handwerker", items: d.handwerker || [], countLabel: "Handwerker", fields: ["name","category","city","rating","completed_jobs"] });
          break;
        }
        case "admin-gebrauchtwagen": {
          const d = await api("/api/gebrauchtwagen/listings");
          setData({ type: "module_list", module: "Gebrauchtwagen", items: d.cars || [], countLabel: "Autos", fields: ["title","brand","price","city","views"] });
          break;
        }
        case "admin-reinigung": {
          const d = await api("/api/reinigung/services");
          setData({ type: "module_list", module: "Reinigungsservices", items: d.services || [], countLabel: "Services", fields: ["name","price_per_hour","min_hours"] });
          break;
        }
        case "admin-umzug": {
          const d = await api("/api/umzug/companies");
          setData({ type: "module_list", module: "Umzugsfirmen", items: d.companies || [], countLabel: "Firmen", fields: ["name","city","base_price","rating","reviews"] });
          break;
        }
        case "admin-tierbetreuung": {
          const d = await api("/api/tierbetreuung/sitters");
          setData({ type: "module_list", module: "Tierbetreuung", items: d.sitters || [], countLabel: "Betreuer", fields: ["name","service","city","price_per_day","rating"] });
          break;
        }
        case "admin-streaming": {
          const d = await api("/api/streaming/catalog");
          setData({ type: "module_list", module: "Streaming-Katalog", items: d.catalog || [], countLabel: "Inhalte", fields: ["title","type","genre","rating","views"] });
          break;
        }
        case "admin-telemedizin": {
          const d = await api("/api/telemedizin/doctors");
          setData({ type: "module_list", module: "Telemedizin Ärzte", items: d.doctors || [], countLabel: "Ärzte", fields: ["name","specialty","city","price_consultation","rating"] });
          break;
        }
        case "admin-dating": {
          const d = await api("/api/dating/discover");
          setData({ type: "module_list", module: "Dating-Profile", items: d.profiles || [], countLabel: "Profile", fields: ["name","city","likes_count","verified"] });
          break;
        }
        case "admin-fitness": {
          const d = await api("/api/fitness/gyms");
          setData({ type: "module_list", module: "Fitness-Studios", items: d.gyms || [], countLabel: "Gyms", fields: ["name","type","city","monthly_price","rating"] });
          break;
        }
        case "admin-reiseplaner": {
          const d = await api("/api/reiseplaner/trips");
          setData({ type: "module_list", module: "Reiseangebote", items: d.trips || [], countLabel: "Reisen", fields: ["title","destination","duration_days","price_per_person","rating"] });
          break;
        }
        case "admin-ladesaeulen": {
          const d = await api("/api/ladesaeulen/stations");
          const stats_ev = await api("/api/ladesaeulen/stats");
          setData({ type: "module_list", module: "Ladesäulen", items: d.stations || [], countLabel: "Stationen", fields: ["name","operator","city","power_kw","price_per_kwh","slots_available"], extra_stats: stats_ev });
          break;
        }
        case "admin-scooter-abos": {
          const d = await api("/api/scooter/plans");
          setData({ type: "module_list", module: "Scooter-Abos", items: d.plans || [], countLabel: "Pläne", fields: ["name","price","duration_days","free_minutes_per_day","per_minute_rate"] });
          break;
        }
        case "admin-taxi": {
          const d = await api("/api/admin/stats");
          setData({ type: "module_stats", module: "Taxi-Fleet", stats: d });
          break;
        }
        case "admin-parcels": {
          const d = await api("/api/admin/stats");
          setData({ type: "module_stats", module: "Paket-Verwaltung", stats: d });
          break;
        }
        case "maintenance": case "cms": case "game-settings": case "sustainability":
        case "passwords": case "voice-commands": case "debug": case "system-health": case "database": {
          setData({ type: "system_detail", subtype: item.key });
          break;
        }
        default: {
          setData({ type: "generic" });
        }
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // Filter sections by search
  const filteredSections = ADMIN_SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(i => !search || i.label.toLowerCase().includes(search.toLowerCase())),
  })).filter(s => s.items.length > 0);

  return (
    <div className="min-h-screen bg-[#F0F4FA] text-[#111]" data-testid="admin-panel-full">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack || (() => onNavigate("/more"))}
              className="p-2 rounded-xl bg-gray-100" data-testid="admin-back">
              <ArrowLeft size={18} className="text-gray-600" />
            </motion.button>
            <div className="flex items-center gap-2">
              <Settings size={20} className="text-[#A855F7]" />
              <h1 className="text-[16px] font-bold">Admin Panel</h1>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => { setMenuOpen(!menuOpen); setActiveItem(null); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-medium"
            data-testid="admin-menu-toggle">
            {menuOpen ? <X size={14} /> : <Menu size={14} />} Menü
          </motion.button>
        </div>

        {/* Search */}
        {menuOpen && (
          <div className="mt-3 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Admin-Funktionen suchen..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-xs outline-none"
              data-testid="admin-search" />
          </div>
        )}
      </div>

      {/* Overview Stats */}
      {menuOpen && !activeItem && stats && (
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-2">
              <LayoutDashboard size={16} className="text-[#A855F7]" />
              <span className="text-[11px] font-semibold text-gray-700">Übersicht</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-2">
              <BarChart3 size={16} className="text-[#3B82F6]" />
              <span className="text-[11px] font-semibold text-gray-700">Analytics</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid Menu */}
      {menuOpen && !activeItem && (
        <div className="px-4 pb-24 space-y-4">
          {filteredSections.map((section, si) => (
            <motion.div key={section.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.05 }}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-[3px] flex-1 rounded-full" style={{ background: `${section.color}20` }} />
                <span className="text-[12px] font-bold" style={{ color: section.color }}>
                  {section.title}
                </span>
                <span className="text-[10px] text-gray-400">({section.items.length})</span>
                <div className="h-[3px] flex-1 rounded-full" style={{ background: `${section.color}20` }} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {section.items.map((item, ii) => {
                  const Icon = item.icon;
                  return (
                    <motion.button key={item.key} whileTap={{ scale: 0.93 }}
                      onClick={() => handleItemClick(item)}
                      className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col items-center gap-1.5 hover:border-gray-300 hover:shadow-md transition-all min-h-[80px] justify-center"
                      data-testid={`admin-item-${item.key}`}>
                      <Icon size={20} className="text-gray-500" />
                      <span className="text-[9px] font-medium text-gray-700 text-center leading-tight">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail View */}
      {!menuOpen && activeItem && (
        <div className="p-4">
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => { setMenuOpen(true); setActiveItem(null); }}
            className="flex items-center gap-2 text-xs text-[#A855F7] font-medium mb-4">
            <ArrowLeft size={14} /> Zurück zum Menü
          </motion.button>

          <h2 className="text-lg font-bold mb-4">{activeItem.label}</h2>

          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-[#A855F7]" />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* ══ USERS ══ */}
          {data?.type === "users" && (
            <div className="space-y-3" data-testid="admin-detail-users">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Gesamt", value: data.stats?.total_users || 0, color: "#3B82F6" },
                  { label: "Aktive Heute", value: data.stats?.active_today || 0, color: "#10B981" },
                  { label: "Umsatz (30T)", value: `€${(data.stats?.revenue_30d || 0).toFixed(0)}`, color: "#F59E0B" },
                  { label: "Transaktionen", value: data.stats?.total_transactions || 0, color: "#A855F7" },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <h3 className="text-xs font-semibold text-gray-500 mt-2">Letzte Kunden ({data.users?.length || 0})</h3>
              {(data.users || []).slice(0, 20).map((u, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#3B82F6]/10 flex items-center justify-center text-[11px] font-bold text-[#3B82F6]">
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-800">{u.name || "–"}</p>
                      <p className="text-[9px] text-gray-400">{u.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-[#10B981]">€{(u.balance || 0).toFixed(2)}</p>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{u.role || "user"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ KYC ══ */}
          {data?.type === "kyc" && (
            <div className="space-y-2" data-testid="admin-detail-kyc">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-3">
                <p className="text-xs text-amber-800 font-medium">{(data.requests || []).length} offene KYC-Anträge</p>
              </div>
              {(data.requests || []).length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Keine offenen KYC-Anträge</div>
              ) : (data.requests || []).map((r, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800">{r.user_email || r.email || "–"}</p>
                    <p className="text-[9px] text-gray-400">Typ: {r.requested_role || r.type || "KYC"}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${r.status === "pending" ? "bg-amber-100 text-amber-700" : r.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {r.status || "pending"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ══ ROLES ══ */}
          {data?.type === "roles" && (
            <div className="space-y-2" data-testid="admin-detail-roles">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-3">
                <p className="text-xs text-blue-800 font-medium">Rollen-Anfragen verwalten</p>
              </div>
              {(data.requests || []).length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Keine offenen Rollen-Anfragen</div>
              ) : (data.requests || []).map((r, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-gray-800">{r.user_email || "–"}</p>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">{r.requested_role}</span>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">Status: {r.status}</p>
                </div>
              ))}
            </div>
          )}

          {/* ══ USER_FILTER (Staff, Enterprise, Influencer) ══ */}
          {data?.type === "user_filter" && (
            <div className="space-y-3" data-testid="admin-detail-user-filter">
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
                <p className="text-3xl font-bold text-[#3B82F6]">{data.total_users}</p>
                <p className="text-xs text-gray-500 mt-1">Registrierte Benutzer</p>
              </div>
              <div className="p-4 rounded-xl bg-[#3B82F6]/5 border border-[#3B82F6]/20">
                <p className="text-sm font-semibold text-[#3B82F6] capitalize">{data.role}</p>
                <p className="text-[10px] text-gray-500 mt-1">Verwaltung für {data.role === "staff" ? "Mitarbeiter" : data.role === "enterprise" ? "Großkunden" : "Influencer"}</p>
              </div>
              <p className="text-[10px] text-gray-400 text-center">Detaillierte Verwaltung in Kürze verfügbar</p>
            </div>
          )}

          {/* ══ FORM (Car-Ads, Partner-Credit) ══ */}
          {data?.type === "form" && (
            <div className="space-y-3" data-testid="admin-detail-form">
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <p className="text-sm font-semibold text-gray-800">
                  {data.formType === "car-ads" ? "Auto-Werbung verwalten" : "Partner-Freibetrag vergeben"}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {data.formType === "car-ads" ? "Werbebanner für Fahrzeuge konfigurieren" : "Freibeträge für Partner zuweisen"}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 text-center">Formular wird in nächstem Update bereitgestellt</p>
            </div>
          )}

          {/* ══ PARTNERS ══ */}
          {data?.type === "partners" && (
            <div className="space-y-3" data-testid="admin-detail-partners">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Gesamt Benutzer", value: data.stats?.total_users || 0, color: "#F59E0B" },
                  { label: "Umsatz", value: `€${(data.stats?.total_revenue || 0).toFixed(0)}`, color: "#10B981" },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 text-center">Partner-Portal Verwaltung</p>
            </div>
          )}

          {/* ══ APPLICATIONS ══ */}
          {data?.type === "applications" && (
            <div className="space-y-2" data-testid="admin-detail-applications">
              <p className="text-xs font-semibold text-gray-500 mb-2">Alle Bewerbungen ({(data.requests || []).length})</p>
              {(data.requests || []).length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Keine Bewerbungen</div>
              ) : (data.requests || []).map((r, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800">{r.user_email || "–"}</p>
                    <p className="text-[9px] text-gray-400">{r.requested_role} — {r.message?.slice(0, 40) || "Keine Nachricht"}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${r.status === "pending" ? "bg-amber-100 text-amber-700" : r.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ══ FINANCE_DETAIL ══ */}
          {data?.type === "finance_detail" && (
            <div className="space-y-3" data-testid="admin-detail-finance">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Gesamtumsatz", value: `€${(data.stats?.total_revenue || 0).toFixed(2)}`, color: "#10B981" },
                  { label: "Wallet-Summe", value: `€${(data.stats?.total_wallet_balance || 0).toFixed(2)}`, color: "#3B82F6" },
                  { label: "Transaktionen", value: data.stats?.total_transactions || 0, color: "#A855F7" },
                  { label: "Benutzer", value: data.stats?.total_users || 0, color: "#F59E0B" },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-[#10B981]/5 border border-[#10B981]/20">
                <p className="text-xs font-semibold text-[#10B981] capitalize">
                  {({payments:"Zahlungsübersicht","wallet-topup":"Wallet-Aufladungen",payouts:"Wise-Auszahlungen",sepa:"SEPA-Auszahlungen",wholesale:"Großhändler-Finanzen"})[data.subtype] || data.subtype}
                </p>
              </div>
              {data.subtype === "payments" && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin/old")}
                  className="w-full py-3 rounded-xl bg-[#10B981] text-white font-bold text-xs" data-testid="goto-payments-manager">
                  Zahlungs-Manager öffnen
                </motion.button>
              )}
            </div>
          )}

          {/* ══ API_KEYS ══ */}
          {data?.type === "api_keys" && (
            <div className="space-y-3" data-testid="admin-detail-api-keys">
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Key size={16} className="text-[#A855F7]" />
                  <p className="text-sm font-semibold text-gray-800">Digital API Keys</p>
                </div>
                <p className="text-[10px] text-gray-500">API-Schlüssel für externe Integrationen verwalten</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-[10px] text-gray-600 font-mono">sk_live_••••••••••••••••</p>
                <p className="text-[9px] text-gray-400 mt-1">Stripe Live Key</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-[10px] text-gray-600 font-mono">pk_live_••••••••••••••••</p>
                <p className="text-[9px] text-gray-400 mt-1">Stripe Publishable Key</p>
              </div>
            </div>
          )}

          {/* ══ MARKETING ══ */}
          {data?.type === "marketing" && (
            <div className="space-y-3" data-testid="admin-detail-marketing">
              {[
                { key: "flash-sales", title: "Flash Sales", desc: "Zeitlich begrenzte Angebote erstellen und verwalten", color: "#EF4444" },
                { key: "banners", title: "Werbebanner", desc: "Banner-Kampagnen für die App konfigurieren", color: "#3B82F6" },
                { key: "email-marketing", title: "E-Mail Marketing", desc: "Newsletter und Kampagnen versenden", color: "#10B981" },
                { key: "jackpot", title: "Jackpot", desc: "Jackpot-Gewinnspiele erstellen und auswerten", color: "#F59E0B" },
                { key: "challenges", title: "Challenges", desc: "User-Challenges mit Belohnungen konfigurieren", color: "#A855F7" },
                { key: "mystery-box", title: "Mystery Box", desc: "Mystery-Box Inhalte und Preise festlegen", color: "#EC4899" },
                { key: "surveys", title: "Umfragen", desc: "Benutzer-Umfragen erstellen und auswerten", color: "#06B6D4" },
              ].filter(m => m.key === data.subtype).map(m => (
                <div key={m.key}>
                  <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${m.color}15` }}>
                        <Zap size={16} style={{ color: m.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{m.title}</p>
                        <p className="text-[10px] text-gray-500">{m.desc}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
                      <p className="text-lg font-bold" style={{ color: m.color }}>0</p>
                      <p className="text-[9px] text-gray-500">Aktiv</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
                      <p className="text-lg font-bold text-gray-400">0</p>
                      <p className="text-[9px] text-gray-500">Abgeschlossen</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-3">Verwaltung in nächstem Update</p>
                </div>
              ))}
            </div>
          )}

          {/* ══ AUCTIONS ══ */}
          {data?.type === "auctions" && (
            <div className="space-y-2" data-testid="admin-detail-auctions">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500">
                  {({products:"Produkte","standard-auctions":"Standard","vip-auctions":"VIP","voucher-auctions":"Gutschein"})[data.subtype]} Auktionen ({(data.auctions || []).length})
                </p>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/auction-admin")}
                  className="px-3 py-1.5 rounded-lg bg-[#A855F7] text-white text-[10px] font-bold" data-testid="goto-auction-admin">
                  Verwalten
                </motion.button>
              </div>
              {(data.auctions || []).length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Keine aktiven Auktionen</div>
              ) : (data.auctions || []).slice(0, 15).map((a, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {a.image_url && <img src={a.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                    <div>
                      <p className="text-[11px] font-semibold text-gray-800">{a.title || a.product_name || "Auktion"}</p>
                      <p className="text-[9px] text-gray-400">Gebote: {a.total_bids || 0}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-[#A855F7]">€{(a.current_price || a.start_price || 0).toFixed(2)}</p>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">{a.status || "aktiv"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ BOT_CONFIG ══ */}
          {data?.type === "bot_config" && (
            <div className="space-y-3" data-testid="admin-detail-bot">
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={18} className="text-[#A855F7]" />
                  <p className="text-sm font-bold text-gray-800">Bot-System</p>
                </div>
                <p className="text-[10px] text-gray-500">Automatische Bieter-Bots konfigurieren</p>
              </div>
              {data.config && Object.keys(data.config).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(data.config).filter(([k]) => k !== "detail").slice(0, 10).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                      <span className="text-[10px] text-gray-600 capitalize">{k.replace(/_/g, " ")}</span>
                      <span className="text-[10px] font-bold text-gray-800">{typeof v === "boolean" ? (v ? "An" : "Aus") : String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-gray-400 text-center">Keine Bot-Konfiguration vorhanden</p>
              )}
            </div>
          )}

          {/* ══ WINNERS ══ */}
          {data?.type === "winners" && (
            <div className="space-y-2" data-testid="admin-detail-winners">
              <p className="text-xs font-semibold text-gray-500 mb-2">Gewinner ({(data.winners || []).length})</p>
              {(data.winners || []).length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Keine Gewinner</div>
              ) : (data.winners || []).slice(0, 20).map((w, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800">{w.user_email || w.winner_email || "–"}</p>
                    <p className="text-[9px] text-gray-400">{w.auction_title || w.product || "Auktion"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-[#10B981]">€{(w.winning_price || w.amount || 0).toFixed(2)}</p>
                    <p className="text-[9px] text-gray-400">{w.won_at ? new Date(w.won_at).toLocaleDateString("de-DE") : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {data?.type === "analytics" && (
            <div className="space-y-3" data-testid="admin-detail-analytics">
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <p className="text-sm font-bold text-gray-800">
                  {({"product-analytics":"Produkt-Analyse","user-analytics":"Benutzer-Analyse","revenue-analytics":"Umsatz-Analyse"})[data.subtype]}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Benutzer", value: data.stats?.total_users || 0, color: "#3B82F6" },
                  { label: "Umsatz", value: `€${(data.stats?.total_revenue || 0).toFixed(0)}`, color: "#10B981" },
                  { label: "Transaktionen", value: data.stats?.total_transactions || 0, color: "#A855F7" },
                  { label: "Aktive Heute", value: data.stats?.active_today || 0, color: "#F59E0B" },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[9px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/auction-admin")}
                className="w-full py-3 rounded-xl bg-[#A855F7] text-white font-bold text-xs" data-testid="goto-analytics-full">
                Detaillierte Analyse öffnen
              </motion.button>
            </div>
          )}

          {/* ══ COUPONS ══ */}
          {data?.type === "coupons" && (
            <div className="space-y-2" data-testid="admin-detail-coupons">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin/old")}
                className="w-full py-3 rounded-xl bg-[#A855F7] text-white font-bold text-xs mb-3" data-testid="goto-coupon-manager">
                Gutschein-Manager öffnen
              </motion.button>
              <p className="text-xs font-semibold text-gray-500">
                {({"merchant-vouchers":"Händler","bidder-vouchers":"Bieter","partner-vouchers":"Partner","discount-coupons":"Rabatt"})[data.subtype]} Gutscheine ({(data.coupons || []).length})
              </p>
              {(data.coupons || []).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Keine Gutscheine vorhanden</div>
              ) : (data.coupons || []).map((c, i) => (
                <div key={c.coupon_id || i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-[#A855F7]/10 text-[#A855F7] text-[10px] font-mono font-bold">{c.code}</span>
                    <p className="text-[10px] text-gray-500 mt-1">{c.description || c.coupon_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{c.value} {c.coupon_type}</p>
                    <p className="text-[9px] text-gray-400">{c.used_count}/{c.max_uses} eingelöst</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ SYSTEM_LOGS ══ */}
          {data?.type === "system_logs" && (
            <div className="space-y-3" data-testid="admin-detail-logs">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Benutzer", value: data.stats?.total_users || 0, color: "#3B82F6" },
                  { label: "Transaktionen", value: data.stats?.total_transactions || 0, color: "#A855F7" },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
                <Check size={14} className="text-green-600" />
                <p className="text-[11px] text-green-700 font-medium">System läuft normal</p>
              </div>
            </div>
          )}

          {/* ══ SYSTEM_DETAIL ══ */}
          {data?.type === "system_detail" && (
            <div className="space-y-3" data-testid="admin-detail-system">
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <p className="text-sm font-bold text-gray-800 capitalize">
                  {({maintenance:"Wartungsmodus",cms:"Seiten (CMS)","game-settings":"Spiel-Einstellungen",sustainability:"Nachhaltigkeit",passwords:"Passwort-Verwaltung","voice-commands":"Sprachbefehle",debug:"Debug Reports","system-health":"System-Gesundheit",database:"Daten-Management"})[data.subtype] || data.subtype}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Systemverwaltung</p>
              </div>
              {data.subtype === "system-health" && (
                <div className="space-y-2">
                  {["API Server", "Datenbank", "Auth Service", "Payment Gateway"].map(s => (
                    <div key={s} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                      <span className="text-[11px] text-gray-700">{s}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[10px] text-green-600 font-medium">Online</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {data.subtype === "database" && (
                <div className="space-y-2">
                  {["users", "transactions", "auctions", "kids_children", "crypto_holdings", "coupons"].map(c => (
                    <div key={c} className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-gray-600">{c}</span>
                      <span className="text-[9px] text-gray-400">Collection</span>
                    </div>
                  ))}
                </div>
              )}
              {!["system-health", "database"].includes(data.subtype) && (
                <p className="text-[10px] text-gray-400 text-center">Konfiguration in nächstem Update</p>
              )}
            </div>
          )}

          {/* ══ MODULE LIST (Marktplätze, Services, etc.) ══ */}
          {data?.type === "module_list" && (
            <div className="space-y-3" data-testid={`admin-module-${data.module}`}>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <p className="text-xl font-bold text-[#059669]">{data.items?.length || 0}</p>
                  <p className="text-[10px] text-gray-500">{data.countLabel}</p>
                </div>
                {data.extra_stats && Object.entries(data.extra_stats).slice(0, 3).map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-xl font-bold text-[#3B82F6]">{typeof v === "number" ? v.toLocaleString("de-DE") : v}</p>
                    <p className="text-[10px] text-gray-500">{k.replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
              <h3 className="text-xs font-semibold text-gray-500">{data.module} ({data.items?.length || 0})</h3>
              {(data.items || []).map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-semibold text-gray-800 line-clamp-1">
                      {item[data.fields?.[0]] || item.name || item.title || `#${i + 1}`}
                    </p>
                    {item.rating && (
                      <span className="text-[10px] font-bold text-yellow-600 flex items-center gap-0.5">
                        <Star size={10} className="fill-yellow-400 text-yellow-400" /> {item.rating}
                      </span>
                    )}
                    {item.featured && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-bold">TOP</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {(data.fields || []).slice(1).map((field, fi) => {
                      const val = item[field];
                      if (val === undefined || val === null) return null;
                      const displayVal = typeof val === "boolean" ? (val ? "Ja" : "Nein") :
                        typeof val === "number" ? (field.includes("price") || field.includes("rate") || field.includes("per_") ? `${val}€` : val.toLocaleString("de-DE")) : String(val);
                      return (
                        <span key={fi} className="text-[10px] text-gray-500">
                          <span className="text-gray-400">{field.replace(/_/g, " ")}:</span> <span className="text-gray-700 font-medium">{displayVal}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              {(data.items || []).length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Keine Einträge vorhanden</div>
              )}
            </div>
          )}

          {/* ══ MODULE STATS (Generic stats view) ══ */}
          {data?.type === "module_stats" && (
            <div className="space-y-3" data-testid={`admin-module-stats-${data.module}`}>
              <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
                <p className="text-sm font-semibold text-gray-600">{data.module}</p>
                <p className="text-xs text-gray-400 mt-1">Verwaltung über die Hauptseite verfügbar</p>
              </div>
              {data.stats && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Nutzer", value: data.stats.total_users || 0, color: "#3B82F6" },
                    { label: "Transaktionen", value: data.stats.total_transactions || 0, color: "#10B981" },
                    { label: "Umsatz 30T", value: `€${(data.stats.revenue_30d || 0).toFixed(0)}`, color: "#F59E0B" },
                    { label: "Aktive Heute", value: data.stats.active_today || 0, color: "#A855F7" },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ GENERIC FALLBACK ══ */}
          {data?.type === "generic" && (
            <div className="text-center py-10" data-testid="admin-detail-generic">
              <p className="text-sm text-gray-400">Funktion wird vorbereitet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanelFullPage;
