/**
 * BidBlitz V2 - Admin Panel (Grid Layout)
 * Comprehensive admin dashboard with categorized quick-access buttons
 * Design based on BidBlitz.ae reference
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, X, LayoutGrid, BarChart3,
  // Finanzen
  DollarSign, Wallet, CreditCard, Building2, Key, Store, Banknote,
  // Marketing
  Zap, Eye, Mail, Trophy, Target, Gift, MessageSquare,
  // Auktionen
  Package, Gavel, Crown, Ticket, Bot, CheckCircle2, TrendingUp, Users, Euro,
  // Gutscheine & Codes
  Tag, Percent,
  // Kunden & Personal
  UserCheck, Shield, Briefcase, UserPlus, Building, Star, Car, BadgePercent,
  // Partner & Händler
  Handshake, FileText,
  // System
  Wrench, FileCode, Cog, Leaf, Lock, ScrollText, Mic, Bug, Activity, Database
} from "lucide-react";
import { useI18n } from "../store";

const API = process.env.REACT_APP_BACKEND_URL;

// ═══════════════════════════════════════════════════
// ADMIN MENU CATEGORIES & ITEMS
// ═══════════════════════════════════════════════════

const ADMIN_SECTIONS = [
  {
    id: "overview",
    label: "",
    color: "#666",
    items: [
      { id: "dashboard", icon: LayoutGrid, label: "Übersicht", path: "/admin" },
      { id: "analytics", icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
    ]
  },
  {
    id: "customers",
    label: "Kunden & Personal",
    color: "#00C2FF",
    items: [
      { id: "customers", icon: Users, label: "Kunden", path: "/admin/users" },
      { id: "kyc", icon: Shield, label: "KYC-Freischaltung", path: "/admin/kyc" },
      { id: "managers", icon: Briefcase, label: "Manager", path: "/admin/managers" },
      { id: "employees", icon: UserPlus, label: "Mitarbeiter", path: "/admin/employees" },
      { id: "enterprise", icon: Building, label: "Großkunden", path: "/admin/enterprise" },
      { id: "influencer", icon: Star, label: "Influencer", path: "/admin/influencer" },
      { id: "auto-ads", icon: Car, label: "Auto-Werbung", path: "/admin/auto-ads" },
      { id: "partner-credit", icon: BadgePercent, label: "Partner-Freibetrag", path: "/admin/partner-credit", highlight: true },
    ]
  },
  {
    id: "partners",
    label: "Partner & Händler",
    color: "#A855F7",
    items: [
      { id: "partner-portal", icon: Handshake, label: "Partner Portal", path: "/admin/partners" },
      { id: "applications", icon: FileText, label: "Alte Bewerbungen", path: "/admin/applications" },
    ]
  },
  {
    id: "auctions",
    label: "Auktionen",
    color: "#00C2FF",
    items: [
      { id: "products", icon: Package, label: "Produkte", path: "/admin/products" },
      { id: "auction-images-ai", icon: Image, label: "Bilder (AI Regen)", path: "/admin/auction-images" },
      { id: "standard-auctions", icon: Gavel, label: "Standard-Auktionen", path: "/admin/auctions" },
      { id: "vip-auctions", icon: Crown, label: "VIP-Auktionen", path: "/admin/vip-auctions" },
      { id: "voucher-auctions", icon: Ticket, label: "Gutschein-Auktionen", path: "/admin/voucher-auctions" },
      { id: "bot-system", icon: Bot, label: "Bot-System", path: "/admin/bot" },
      { id: "winner-control", icon: CheckCircle2, label: "Gewinner-Kontrolle", path: "/admin/winners" },
      { id: "product-analysis", icon: TrendingUp, label: "Produkt-Analyse", path: "/admin/product-stats" },
      { id: "user-analysis", icon: Users, label: "Benutzer-Analyse", path: "/admin/user-stats" },
      { id: "revenue-analysis", icon: Euro, label: "Umsatz-Analyse", path: "/admin/revenue" },
    ]
  },
  {
    id: "coupons",
    label: "Gutscheine & Codes",
    color: "#FFB800",
    items: [
      { id: "merchant-coupons", icon: Tag, label: "Händler-Gutscheine", path: "/admin/merchant-coupons" },
      { id: "bidder-coupons", icon: Tag, label: "Bieter-Gutscheine", path: "/admin/bidder-coupons" },
      { id: "partner-coupons", icon: Tag, label: "Partner-Gutscheine", path: "/admin/partner-coupons" },
      { id: "discount-codes", icon: Percent, label: "Rabatt-Coupons", path: "/admin/discounts" },
      { id: "referral-codes", icon: Users, label: "Empfehlungs-Codes", path: "/admin/referrals" },
    ]
  },
  {
    id: "finance",
    label: "Finanzen",
    color: "#00D26A",
    items: [
      { id: "payments", icon: DollarSign, label: "Zahlungen", path: "/admin/transactions" },
      { id: "topup", icon: Wallet, label: "Wallet Aufladen", path: "/admin/topup" },
      { id: "wise-payouts", icon: CreditCard, label: "Wise Auszahlungen", path: "/admin/wise" },
      { id: "credit-mgmt", icon: Building2, label: "Kredit-Verwaltung", path: "/admin/credits" },
      { id: "digital-api", icon: Key, label: "Digital API", path: "/admin/api-keys" },
      { id: "wholesalers", icon: Store, label: "Großhändler", path: "/admin/wholesalers" },
      { id: "sepa-payouts", icon: Banknote, label: "SEPA-Auszahlungen", path: "/admin/payouts" },
    ]
  },
  {
    id: "marketing",
    label: "Marketing",
    color: "#00D26A",
    items: [
      { id: "flash-sales", icon: Zap, label: "Flash Sales", path: "/admin/flash-sales" },
      { id: "banners", icon: Eye, label: "Werbebanner", path: "/admin/banners" },
      { id: "email-marketing", icon: Mail, label: "E-Mail Marketing", path: "/admin/email" },
      { id: "jackpot", icon: Trophy, label: "Jackpot", path: "/admin/jackpot" },
      { id: "challenges", icon: Target, label: "Challenges", path: "/admin/challenges" },
      { id: "mystery-box", icon: Gift, label: "Mystery Box", path: "/admin/mystery" },
      { id: "surveys", icon: MessageSquare, label: "Umfragen", path: "/admin/surveys" },
    ]
  },
  {
    id: "system",
    label: "System",
    color: "#666",
    items: [
      { id: "maintenance", icon: Wrench, label: "Wartung", path: "/admin/maintenance" },
      { id: "cms", icon: FileCode, label: "Seiten (CMS)", path: "/admin/cms" },
      { id: "game-settings", icon: Cog, label: "Spiel-Einstellungen", path: "/admin/game-settings" },
      { id: "sustainability", icon: Leaf, label: "Nachhaltigkeit", path: "/admin/sustainability" },
      { id: "passwords", icon: Lock, label: "Passwörter", path: "/admin/passwords" },
      { id: "logs", icon: ScrollText, label: "Systemlogs", path: "/admin/logs" },
      { id: "voice", icon: Mic, label: "Sprachbefehle", path: "/admin/voice" },
      { id: "debug", icon: Bug, label: "Debug Reports", path: "/admin/debug" },
      { id: "system-health", icon: Activity, label: "System", path: "/admin/health" },
      { id: "database", icon: Database, label: "Daten-Manager", path: "/admin/database" },
    ]
  },
];

// ═══════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════

const AdminMenuItem = ({ item, onNavigate, delay }) => {
  const Icon = item.icon;
  return (
    <motion.button
      data-testid={`admin-menu-${item.id}`}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
        item.highlight 
          ? "bg-[#00C2FF]/10 border-2 border-[#00C2FF]/30" 
          : "bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12]"
      }`}
      onClick={() => onNavigate(item.path)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay * 0.03, duration: 0.2 }}
      whileTap={{ scale: 0.95 }}
    >
      <Icon 
        size={22} 
        strokeWidth={1.5} 
        className={item.highlight ? "text-[#00C2FF]" : "text-[#666]"} 
      />
      <span className={`text-[10px] mt-2 text-center font-medium leading-tight ${
        item.highlight ? "text-[#00C2FF]" : "text-[#888]"
      }`}>
        {item.label}
      </span>
    </motion.button>
  );
};

const AdminSection = ({ section, onNavigate, startIndex }) => {
  if (!section.label) {
    // Overview section without header
    return (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {section.items.map((item, idx) => (
          <AdminMenuItem 
            key={item.id} 
            item={item} 
            onNavigate={onNavigate}
            delay={startIndex + idx}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div 
      className="mb-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Section Header */}
      <div 
        className="px-3 py-2 rounded-xl mb-2"
        style={{ background: `${section.color}15` }}
      >
        <span 
          className="text-xs font-semibold"
          style={{ color: section.color }}
        >
          {section.label}
        </span>
        <span className="text-[10px] text-[#666] ml-2">
          ({section.items.length})
        </span>
      </div>

      {/* Section Grid */}
      <div className="grid grid-cols-4 gap-2">
        {section.items.map((item, idx) => (
          <AdminMenuItem 
            key={item.id} 
            item={item} 
            onNavigate={onNavigate}
            delay={startIndex + idx}
          />
        ))}
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function AdminPanelPage({ onBack, onNavigate }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(true);

  // Calculate start indices for staggered animations
  let itemIndex = 0;

  return (
    <div 
      className="min-h-screen pb-28"
      style={{ 
        background: "linear-gradient(180deg, #E8F4F8 0%, #F0F8FF 50%, #E8F4F8 100%)"
      }}
    >
      {/* Header */}
      <motion.div 
        className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
        style={{ background: "rgba(232, 244, 248, 0.95)", backdropFilter: "blur(12px)" }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-[#7C3AED]" />
          <h1 className="text-lg font-bold text-[#1a1a1a] font-outfit">Admin Panel</h1>
        </div>
        
        <motion.button
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a1a] text-white text-sm font-medium"
          onClick={() => setMenuOpen(!menuOpen)}
          whileTap={{ scale: 0.95 }}
        >
          <X size={14} />
          Menü
        </motion.button>
      </motion.div>

      {/* Content */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div 
            className="px-4 pt-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {ADMIN_SECTIONS.map((section) => {
              const startIdx = itemIndex;
              itemIndex += section.items.length;
              return (
                <AdminSection 
                  key={section.id}
                  section={section}
                  onNavigate={onNavigate}
                  startIndex={startIdx}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { AdminPanelPage };
