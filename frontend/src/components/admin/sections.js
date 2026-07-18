/**
 * BidBlitz Admin Panel — Section Definitions
 * Pure data; no UI imports here besides icons.
 */
import {
  Users, ShieldCheck, Briefcase, UserPlus, Building2, Star, Car,
  CreditCard, Wallet, Euro, Key, Database, FileText, Settings,
  Leaf, Lock, Activity, Mic, Bug, Server, Package, Crown, Ticket,
  BarChart, UserCheck, Gavel, Bot, Trophy, Percent, TrendingUp,
  Zap, Eye, Mail, Target, Gift, MessageCircle, Wrench, DollarSign,
  Home, GraduationCap, Film, Stethoscope, Heart, CarFront, Sparkles,
  Truck, Dog, Dumbbell, Palmtree, BatteryCharging, UtensilsCrossed, Cpu
} from "lucide-react";

export const ADMIN_SECTIONS = [
  {
    title: "Kunden & Personal", color: "#3B82F6", count: 8,
    items: [
      { key: "users", icon: Users, label: "Kunden", nav: "/admin/customers" },
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
    title: "Partner & Händler", color: "#F59E0B", count: 3,
    items: [
      { key: "partners", icon: Building2, label: "Partner Portal" },
      { key: "applications", icon: FileText, label: "Alte Bewerbungen" },
      { key: "qr-tables", icon: UtensilsCrossed, label: "QR-Tische", highlight: true, nav: "/admin/qr-management" },
    ],
  },
  {
    title: "Finanzen", color: "#10B981", count: 8,
    items: [
      { key: "pay-requests", icon: ShieldCheck, label: "Pay Anträge", highlight: true },
      { key: "payments", icon: DollarSign, label: "Zahlungen", nav: "/admin/payments" },
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
      { key: "email-marketing", icon: Mail, label: "E-Mail Marketing", nav: "/admin/email-marketing" },
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
    title: "Lifestyle & Gesundheit", color: "#EC4899", count: 6,
    items: [
      { key: "admin-streaming", icon: Film, label: "Streaming" },
      { key: "admin-telemedizin", icon: Stethoscope, label: "Telemedizin" },
      { key: "admin-dating", icon: Heart, label: "Dating" },
      { key: "admin-fitness", icon: Dumbbell, label: "Fitness" },
      { key: "admin-reiseplaner", icon: Palmtree, label: "Reiseplaner" },
      { key: "admin-pool", icon: Ticket, label: "Schwimmbad", nav: "/admin/pool" },
      { key: "admin-audi-tickets", icon: Ticket, label: "Audi Tickets", nav: "/audi-tickets" },
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
    title: "System", color: "#6B7280", count: 11,
    items: [
      { key: "maintenance", icon: Wrench, label: "Wartung" },
      { key: "cms", icon: FileText, label: "Seiten (CMS)" },
      { key: "game-settings", icon: Settings, label: "Spiel-Einstellungen" },
      { key: "sustainability", icon: Leaf, label: "Nachhaltigkeit" },
      { key: "passwords", icon: Lock, label: "Passwörter" },
      { key: "system-logs", icon: Activity, label: "Systemlogs" },
      { key: "voice-commands", icon: Mic, label: "Sprachbefehle" },
      { key: "debug", icon: Bug, label: "Debug Reports" },
      { key: "rtk-proxy", icon: Cpu, label: "RTK Proxy", nav: "/admin/rtk" },
      { key: "system-health", icon: Server, label: "System" },
      { key: "database", icon: Database, label: "Daten-Management" },
    ],
  },
];
