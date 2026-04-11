/**
 * BidBlitz V2 - Professional Admin Panel
 * Complete admin dashboard with all management features
 * Light theme with organized categories
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, LayoutGrid, BarChart3, Users, Shield, Building2, UserPlus,
  Star, Car, CreditCard, Package, Gavel, Crown, Ticket, Bot, Target,
  TrendingUp, UserCheck, Euro, DollarSign, Wallet, Send, Landmark,
  Key, Store, CreditCard as CardIcon, Zap, Eye, Mail, Trophy,
  Gift, HelpCircle, Wrench, FileText, Gamepad2, Leaf, Lock, 
  Activity, Mic, Bug, Database, X, Menu, ChevronRight, Search,
  Bell, User, LogOut, Home, Plus, Edit, Trash2, Check, AlertCircle,
  RefreshCw, Download, Upload, Filter, Calendar, Clock, MapPin,
  Phone, Globe, Image, Video, MessageSquare, Heart, Share2, Bookmark,
  Printer, QrCode, Smartphone, Tv, Headphones, Camera, Wifi, Bluetooth,
  Battery, Sun, Moon, Cloud, Umbrella, Wind, Thermometer, Droplet
} from "lucide-react";
import { useUser, useI18n } from "../store";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS - Light Theme
// ══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  bg: "linear-gradient(180deg, #E8F4F8 0%, #D4EBF2 50%, #C0E2EC 100%)",
  card: "#FFFFFF",
  cardHover: "#F8FCFD",
  cardSelected: "#E3F5FA",
  border: "rgba(0,0,0,0.06)",
  text: "#1A1A2E",
  textMuted: "#6B7280",
  purple: "#8B5CF6",
  blue: "#3B82F6",
  cyan: "#06B6D4",
  green: "#10B981",
  orange: "#F97316",
  red: "#EF4444",
  yellow: "#F59E0B",
};

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN SECTIONS CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const ADMIN_SECTIONS = [
  {
    id: "overview",
    title: "Übersicht",
    color: COLORS.purple,
    items: [
      { id: "dashboard", icon: LayoutGrid, label: "Übersicht" },
      { id: "analytics", icon: BarChart3, label: "Analytics" },
    ]
  },
  {
    id: "customers",
    title: "Kunden & Personal",
    color: COLORS.blue,
    items: [
      { id: "customers", icon: Users, label: "Kunden" },
      { id: "kyc", icon: Shield, label: "KYC-Freischaltung" },
      { id: "managers", icon: Building2, label: "Manager" },
      { id: "employees", icon: UserPlus, label: "Mitarbeiter" },
      { id: "enterprise", icon: Building2, label: "Großkunden" },
      { id: "influencers", icon: Star, label: "Influencer" },
      { id: "auto-ads", icon: Car, label: "Auto-Werbung" },
      { id: "partner-credit", icon: CreditCard, label: "Partner-Freibetrag" },
    ]
  },
  {
    id: "partners",
    title: "Partner & Händler",
    color: COLORS.green,
    items: [
      { id: "partner-portal", icon: Store, label: "Partner Portal" },
      { id: "old-applications", icon: FileText, label: "Alte Bewerbungen" },
    ]
  },
  {
    id: "auctions",
    title: "Auktionen",
    color: COLORS.purple,
    items: [
      { id: "products", icon: Package, label: "Produkte" },
      { id: "standard-auctions", icon: Gavel, label: "Standard-Auktionen" },
      { id: "vip-auctions", icon: Crown, label: "VIP-Auktionen" },
      { id: "voucher-auctions", icon: Ticket, label: "Gutschein-Auktionen" },
      { id: "bot-system", icon: Bot, label: "Bot-System" },
      { id: "winner-control", icon: Target, label: "Gewinner-Kontrolle" },
      { id: "product-analysis", icon: BarChart3, label: "Produkt-Analyse" },
      { id: "user-analysis", icon: UserCheck, label: "Benutzer-Analyse" },
      { id: "revenue-analysis", icon: Euro, label: "Umsatz-Analyse" },
    ]
  },
  {
    id: "vouchers",
    title: "Gutscheine & Codes",
    color: COLORS.cyan,
    items: [
      { id: "merchant-vouchers", icon: Ticket, label: "Händler-Gutscheine" },
      { id: "bidder-vouchers", icon: Ticket, label: "Bieter-Gutscheine" },
      { id: "partner-vouchers", icon: Ticket, label: "Partner-Gutscheine" },
      { id: "discount-coupons", icon: Ticket, label: "Rabatt-Coupons" },
    ]
  },
  {
    id: "finance",
    title: "Finanzen",
    color: COLORS.orange,
    items: [
      { id: "payments", icon: DollarSign, label: "Zahlungen" },
      { id: "wallet-topup", icon: Wallet, label: "Wallet Aufladen" },
      { id: "wise-payouts", icon: Send, label: "Wise Auszahlungen" },
      { id: "credit-management", icon: CreditCard, label: "Kredit-Verwaltung" },
      { id: "digital-api", icon: Key, label: "Digital API" },
      { id: "wholesalers", icon: Store, label: "Großhändler" },
      { id: "sepa-payouts", icon: Landmark, label: "SEPA-Auszahlungen" },
    ]
  },
  {
    id: "marketing",
    title: "Marketing",
    color: COLORS.red,
    items: [
      { id: "flash-sales", icon: Zap, label: "Flash Sales" },
      { id: "banners", icon: Eye, label: "Werbebanner" },
      { id: "email-marketing", icon: Mail, label: "E-Mail Marketing" },
      { id: "jackpot", icon: Trophy, label: "Jackpot" },
      { id: "challenges", icon: Trophy, label: "Challenges" },
      { id: "mystery-box", icon: Gift, label: "Mystery Box" },
      { id: "surveys", icon: HelpCircle, label: "Umfragen" },
    ]
  },
  {
    id: "system",
    title: "System",
    color: COLORS.textMuted,
    items: [
      { id: "maintenance", icon: Wrench, label: "Wartung" },
      { id: "cms", icon: FileText, label: "Seiten (CMS)" },
      { id: "game-settings", icon: Gamepad2, label: "Spiel-Einstellungen" },
      { id: "sustainability", icon: Leaf, label: "Nachhaltigkeit" },
      { id: "passwords", icon: Lock, label: "Passwörter" },
      { id: "system-logs", icon: Activity, label: "Systemlogs" },
      { id: "voice-commands", icon: Mic, label: "Sprachbefehle" },
      { id: "debug-reports", icon: Bug, label: "Debug Reports" },
      { id: "system-health", icon: Activity, label: "System" },
      { id: "database", icon: Database, label: "Daten-Management" },
    ]
  },
  {
    id: "taxi",
    title: "Taxi-Verwaltung",
    color: COLORS.cyan,
    items: [
      { id: "taxi-operators", icon: Car, label: "Taxi-Unternehmer" },
      { id: "private-drivers", icon: User, label: "Privat-Fahrer" },
      { id: "taxi-rides", icon: MapPin, label: "Fahrten" },
      { id: "taxi-earnings", icon: Euro, label: "Provisionen" },
    ]
  },
  {
    id: "kids",
    title: "Kids System",
    color: COLORS.green,
    items: [
      { id: "kids-accounts", icon: Users, label: "Kinderkonten" },
      { id: "parent-controls", icon: Shield, label: "Eltern-Kontrolle" },
      { id: "kids-tasks", icon: Check, label: "Aufgaben" },
      { id: "kids-limits", icon: Lock, label: "Limits" },
    ]
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// Admin Card Button
function AdminCard({ icon: Icon, label, selected, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 rounded-2xl transition-all"
      style={{
        background: selected ? COLORS.cardSelected : COLORS.card,
        border: selected ? `2px solid ${COLORS.blue}` : "1px solid rgba(0,0,0,0.04)",
        boxShadow: selected ? "0 4px 12px rgba(59,130,246,0.15)" : "0 2px 8px rgba(0,0,0,0.04)",
        minHeight: 100,
      }}
      whileHover={{ scale: 1.02, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon size={28} strokeWidth={1.5} style={{ color: selected ? COLORS.blue : COLORS.textMuted }} />
      <span 
        className="text-xs font-medium text-center mt-2 leading-tight"
        style={{ color: selected ? COLORS.blue : COLORS.text }}
      >
        {label}
      </span>
    </motion.button>
  );
}

// Section Header
function SectionHeader({ title, count, color }) {
  return (
    <div 
      className="flex items-center gap-2 px-4 py-2 rounded-xl mb-3"
      style={{ background: `${color}15` }}
    >
      <span className="font-semibold" style={{ color }}>{title}</span>
      <span className="text-sm" style={{ color: COLORS.textMuted }}>({count})</span>
    </div>
  );
}

// Stats Card for Dashboard
function StatsCard({ icon: Icon, label, value, change, color }) {
  const isPositive = change >= 0;
  return (
    <div 
      className="p-4 rounded-2xl"
      style={{ background: COLORS.card, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={20} style={{ color }} />
        </div>
        {change !== undefined && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color: COLORS.text }}>{value}</p>
      <p className="text-xs" style={{ color: COLORS.textMuted }}>{label}</p>
    </div>
  );
}

// Data Table
function DataTable({ columns, data, onRowClick }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: COLORS.card, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <table className="w-full">
        <thead>
          <tr style={{ background: "rgba(0,0,0,0.02)" }}>
            {columns.map((col, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr 
              key={i} 
              className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col, j) => (
                <td key={j} className="px-4 py-3 text-sm" style={{ color: COLORS.text }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function AdminPanelPro({ onBack, onNavigate }) {
  const { t } = useI18n();
  const user = useUser();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Dashboard stats
  const [stats, setStats] = useState({
    totalUsers: 12847,
    activeToday: 2341,
    revenue: 45678.90,
    pendingKyc: 23,
    activeAuctions: 156,
    taxiOperators: 8,
  });

  // Sample data for tables
  const [customers, setCustomers] = useState([
    { id: 1, name: "Max Mustermann", email: "max@example.com", status: "active", balance: 1234.56 },
    { id: 2, name: "Anna Schmidt", email: "anna@example.com", status: "pending", balance: 567.89 },
    { id: 3, name: "Tom Weber", email: "tom@example.com", status: "active", balance: 890.12 },
  ]);

  const [taxiOperators, setTaxiOperators] = useState([]);

  // Load data
  useEffect(() => {
    if (activeSection === 'taxi-operators') {
      loadTaxiOperators();
    }
  }, [activeSection]);

  const loadTaxiOperators = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/taxi/admin/operators`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTaxiOperators(data.operators || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveOperator = async (operatorId) => {
    try {
      const res = await fetch(`${API}/api/taxi/admin/operator/${operatorId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success("Operator freigeschaltet!");
        loadTaxiOperators();
      }
    } catch (err) {
      toast.error("Fehler beim Freischalten");
    }
  };

  // Filter sections based on search
  const filteredSections = searchQuery 
    ? ADMIN_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item => 
          item.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.items.length > 0)
    : ADMIN_SECTIONS;

  // Render content based on active section
  const renderContent = () => {
    if (!activeSection) {
      // Main grid view
      return (
        <div className="p-4 space-y-6">
          {filteredSections.map((section) => (
            <div key={section.id}>
              <SectionHeader title={section.title} count={section.items.length} color={section.color} />
              <div className="grid grid-cols-4 gap-3">
                {section.items.map((item) => (
                  <AdminCard
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    selected={false}
                    onClick={() => setActiveSection(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Specific section content
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="p-4 space-y-6">
            <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>Dashboard Übersicht</h2>
            <div className="grid grid-cols-2 gap-4">
              <StatsCard icon={Users} label="Gesamte Nutzer" value={stats.totalUsers.toLocaleString()} change={12.5} color={COLORS.blue} />
              <StatsCard icon={Activity} label="Heute aktiv" value={stats.activeToday.toLocaleString()} change={8.3} color={COLORS.green} />
              <StatsCard icon={Euro} label="Umsatz (Monat)" value={`€${stats.revenue.toLocaleString()}`} change={23.1} color={COLORS.orange} />
              <StatsCard icon={Shield} label="KYC ausstehend" value={stats.pendingKyc} change={-5.2} color={COLORS.red} />
              <StatsCard icon={Gavel} label="Aktive Auktionen" value={stats.activeAuctions} change={15.7} color={COLORS.purple} />
              <StatsCard icon={Car} label="Taxi-Unternehmer" value={stats.taxiOperators} change={100} color={COLORS.cyan} />
            </div>
          </div>
        );

      case 'customers':
        return (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>Kundenverwaltung</h2>
              <button className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.blue }}>
                <Plus size={16} className="inline mr-2" /> Neuer Kunde
              </button>
            </div>
            <DataTable
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'E-Mail' },
                { key: 'status', label: 'Status', render: (v) => (
                  <span className={`px-2 py-1 rounded-full text-xs ${v === 'active' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                    {v === 'active' ? 'Aktiv' : 'Ausstehend'}
                  </span>
                )},
                { key: 'balance', label: 'Guthaben', render: (v) => `€${v.toFixed(2)}` },
              ]}
              data={customers}
            />
          </div>
        );

      case 'taxi-operators':
        return (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>Taxi-Unternehmer</h2>
              <button onClick={loadTaxiOperators} className="p-2 rounded-xl" style={{ background: "rgba(0,0,0,0.05)" }}>
                <RefreshCw size={18} style={{ color: COLORS.textMuted }} />
              </button>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin" style={{ color: COLORS.blue }} />
              </div>
            ) : taxiOperators.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: COLORS.card }}>
                <Car size={48} className="mx-auto mb-4" style={{ color: COLORS.textMuted }} />
                <p style={{ color: COLORS.textMuted }}>Keine Taxi-Unternehmer registriert</p>
              </div>
            ) : (
              <div className="space-y-3">
                {taxiOperators.map((op) => (
                  <div key={op.operator_id} className="p-4 rounded-2xl" style={{ background: COLORS.card, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold" style={{ color: COLORS.text }}>{op.company_name}</h3>
                        <p className="text-sm" style={{ color: COLORS.textMuted }}>{op.contact_name} · {op.email}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        op.status === 'approved' ? 'bg-green-100 text-green-600' :
                        op.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {op.status === 'approved' ? 'Aktiv' : op.status === 'pending' ? 'Ausstehend' : 'Abgelehnt'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <p style={{ color: COLORS.textMuted }}>Stadt</p>
                        <p className="font-medium" style={{ color: COLORS.text }}>{op.city}</p>
                      </div>
                      <div>
                        <p style={{ color: COLORS.textMuted }}>Flotte</p>
                        <p className="font-medium" style={{ color: COLORS.text }}>{op.fleet_size} Fahrzeuge</p>
                      </div>
                      <div>
                        <p style={{ color: COLORS.textMuted }}>Provision</p>
                        <p className="font-medium" style={{ color: COLORS.text }}>{(op.commission_rate * 100).toFixed(0)}%</p>
                      </div>
                      <div>
                        <p style={{ color: COLORS.textMuted }}>Testphase</p>
                        <p className="font-medium" style={{ color: op.is_trial ? COLORS.green : COLORS.text }}>
                          {op.is_trial ? 'Aktiv' : 'Beendet'}
                        </p>
                      </div>
                    </div>
                    {op.status === 'pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => approveOperator(op.operator_id)}
                          className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                          style={{ background: COLORS.green }}
                        >
                          <Check size={16} className="inline mr-2" /> Freischalten
                        </button>
                        <button 
                          className="px-4 py-2 rounded-xl text-sm font-medium"
                          style={{ background: "rgba(239,68,68,0.1)", color: COLORS.red }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'kyc':
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>KYC-Freischaltung</h2>
            <div className="grid grid-cols-3 gap-4">
              <StatsCard icon={Clock} label="Ausstehend" value="23" color={COLORS.yellow} />
              <StatsCard icon={Check} label="Genehmigt" value="1,847" color={COLORS.green} />
              <StatsCard icon={X} label="Abgelehnt" value="12" color={COLORS.red} />
            </div>
            <div className="rounded-2xl p-6 text-center" style={{ background: COLORS.card }}>
              <Shield size={48} className="mx-auto mb-4" style={{ color: COLORS.blue }} />
              <p style={{ color: COLORS.textMuted }}>KYC-Prüfungsliste wird geladen...</p>
            </div>
          </div>
        );

      case 'bot-system':
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold" style={{ color: COLORS.text }}>Bot-System</h2>
            <div className="grid grid-cols-2 gap-4">
              <StatsCard icon={Bot} label="Aktive Bots" value="24" color={COLORS.purple} />
              <StatsCard icon={Gavel} label="Bot-Gebote heute" value="1,234" color={COLORS.cyan} />
            </div>
            <div className="rounded-2xl p-4" style={{ background: COLORS.card }}>
              <h3 className="font-semibold mb-3" style={{ color: COLORS.text }}>Bot-Einstellungen</h3>
              <div className="space-y-3">
                {['Aggressiv', 'Normal', 'Passiv'].map((strategy) => (
                  <div key={strategy} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(0,0,0,0.02)" }}>
                    <span style={{ color: COLORS.text }}>{strategy}</span>
                    <span className="px-3 py-1 rounded-full text-xs" style={{ background: COLORS.purple + '20', color: COLORS.purple }}>
                      {Math.floor(Math.random() * 10)} Bots
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4">
            <div className="rounded-2xl p-12 text-center" style={{ background: COLORS.card }}>
              <Settings size={48} className="mx-auto mb-4" style={{ color: COLORS.textMuted }} />
              <h3 className="font-semibold mb-2" style={{ color: COLORS.text }}>
                {ADMIN_SECTIONS.flatMap(s => s.items).find(i => i.id === activeSection)?.label || activeSection}
              </h3>
              <p style={{ color: COLORS.textMuted }}>Diese Funktion wird implementiert...</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg }}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          {activeSection ? (
            <button 
              onClick={() => setActiveSection(null)} 
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: COLORS.blue }}
            >
              <ChevronRight size={18} className="rotate-180" />
              Zurück
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Settings size={22} style={{ color: COLORS.purple }} />
              <span className="font-bold" style={{ color: COLORS.text }}>Admin Panel</span>
            </div>
          )}
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(0,0,0,0.05)" }}
          >
            <X size={16} style={{ color: COLORS.textMuted }} />
            <span className="text-sm" style={{ color: COLORS.textMuted }}>Menü</span>
          </button>
        </div>

        {/* Search (only on main view) */}
        {!activeSection && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.textMuted }} />
              <input
                type="text"
                placeholder="Suche..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "rgba(0,0,0,0.04)", color: COLORS.text }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection || 'main'}
            initial={{ opacity: 0, x: activeSection ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeSection ? -20 : 20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Quick Actions */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-100">
        <div className="flex justify-around py-3">
          {[
            { icon: Home, label: 'Start', action: () => onBack?.() },
            { icon: Users, label: 'Kunden', action: () => setActiveSection('customers') },
            { icon: Gavel, label: 'Auktionen', action: () => setActiveSection('products') },
            { icon: Euro, label: 'Finanzen', action: () => setActiveSection('payments') },
            { icon: Settings, label: 'System', action: () => setActiveSection('system-health') },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex flex-col items-center gap-1 py-1 px-3"
            >
              <item.icon size={22} style={{ color: COLORS.textMuted }} />
              <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
