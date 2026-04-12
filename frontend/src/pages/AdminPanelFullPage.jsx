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
  Globe, Gavel, Bot, Percent, TrendingUp, AlertCircle, Check, DollarSign
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

          {data?.type === "info" && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800">{data.message}</p>
            </div>
          )}

          {data?.type === "stats" && data.stats && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Benutzer", value: data.stats.total_users || 0, color: "#3B82F6" },
                { label: "Aktive", value: data.stats.active_today || 0, color: "#10B981" },
                { label: "Umsatz (30T)", value: `€${(data.stats.revenue_30d || 0).toFixed(0)}`, color: "#F59E0B" },
                { label: "Transaktionen", value: data.stats.total_transactions || 0, color: "#A855F7" },
              ].map(s => (
                <div key={s.label} className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {data?.type === "finance" && data.stats && (
            <div className="space-y-3">
              {[
                { label: "Gesamtumsatz", value: `€${(data.stats.total_revenue || 0).toFixed(2)}`, color: "#10B981" },
                { label: "Wallet-Summe", value: `€${(data.stats.total_wallet_balance || 0).toFixed(2)}`, color: "#3B82F6" },
                { label: "Aktive Kredite", value: data.stats.active_credits || "N/A", color: "#F59E0B" },
              ].map(s => (
                <div key={s.label} className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                  <span className="text-xs text-gray-600">{s.label}</span>
                  <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {data?.type === "list" && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">{data.title} ({data.items.length})</h3>
              {data.items.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Keine Einträge</div>
              ) : data.items.slice(0, 20).map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <p className="text-xs font-medium text-gray-800">
                    {item.display || item.title || item.user_email || item.name || JSON.stringify(item).slice(0, 60)}
                  </p>
                  {item.status && <span className="text-[9px] text-gray-500">{item.status}</span>}
                </div>
              ))}
            </div>
          )}

          {data?.type === "coupons" && (
            <div className="space-y-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin")}
                className="w-full py-3 rounded-xl bg-[#A855F7] text-white font-bold text-xs mb-3" data-testid="goto-coupon-manager">
                Gutschein-Manager öffnen
              </motion.button>
              {data.coupons.map(c => (
                <div key={c.coupon_id} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
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
        </div>
      )}
    </div>
  );
};

export default AdminPanelFullPage;
