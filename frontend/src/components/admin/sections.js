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
      { key: "roles", icon: Briefcase, label: "Manager", nav: "/admin/managers" },
      { key: "staff", icon: UserPlus, label: "Mitarbeiter", nav: "/admin/employees" },
      { key: "enterprise", icon: Building2, label: "Großkunden", nav: "/admin/enterprise" },
      { key: "influencer", icon: Star, label: "Influencer", nav: "/admin/influencer" },
      { key: "car-ads", icon: Car, label: "Auto-Werbung", nav: "/admin/ads" },
      { key: "partner-credit", icon: CreditCard, label: "Partner-Freibetrag", nav: "/admin/partner-credit" },
    ],
  },
  {
    title: "Partner & Händler", color: "#F59E0B", count: 10,
    items: [
      { key: "partners", icon: Building2, label: "Partner Portal", nav: "/admin/partners" },
      { key: "investor-leads", icon: Users, label: "Investor Leads", highlight: true, nav: "/admin/investor-leads" },
      { key: "investor-dashboard", icon: BarChart, label: "Investor Dashboard", highlight: true, nav: "/admin/investor-dashboard" },
      { key: "investor-documents", icon: FileText, label: "Investor Dokumente", highlight: true, nav: "/admin/investor-documents" },
      { key: "investor-updates", icon: Mail, label: "Investor Updates", highlight: true, nav: "/admin/investor-updates" },
      { key: "investor-meetings", icon: Ticket, label: "Investor Meetings", highlight: true, nav: "/admin/investor-meetings" },
      { key: "visual-qa", icon: Eye, label: "Visual QA", highlight: true, nav: "/admin/visual-qa" },
      { key: "master-roadmap", icon: Activity, label: "Master Roadmap", highlight: true, nav: "/admin/master-roadmap" },
      { key: "applications", icon: FileText, label: "Alte Bewerbungen", nav: "/admin/applications" },
      { key: "qr-tables", icon: UtensilsCrossed, label: "QR-Tische", highlight: true, nav: "/admin/qr-management" },
    ],
  },
  {
    title: "Finanzen", color: "#10B981", count: 8,
    items: [
      { key: "pay-requests", icon: ShieldCheck, label: "Pay Anträge", highlight: true, nav: "/admin/pay-requests" },
      { key: "payments", icon: DollarSign, label: "Zahlungen", nav: "/admin/payments" },
      { key: "wallet-topup", icon: Wallet, label: "Wallet Aufladen", nav: "/admin/topup" },
      { key: "payouts", icon: Euro, label: "Wise Auszahlungen", nav: "/admin/payouts" },
      { key: "credits", icon: CreditCard, label: "Kredit-Verwaltung", nav: "/admin/credits" },
      { key: "api-keys", icon: Key, label: "Digital API", nav: "/admin/pay-sdk" },
      { key: "wholesale", icon: Package, label: "Großhändler" },
      { key: "sepa", icon: Euro, label: "SEPA-Auszahlungen" },
    ],
  },
  {
    title: "Marketing", color: "#F59E0B", count: 8,
    items: [
      { key: "flash-sales", icon: Zap, label: "Flash Sales" },
      { key: "banners", icon: Eye, label: "Werbebanner", nav: "/admin/ads" },
      { key: "charge-offer-rules", icon: Sparkles, label: "Charge Angebotsregeln", nav: "/admin/charge-offer-rules" },
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
      { key: "products", icon: Package, label: "Produkte", nav: "/admin/products" },
      { key: "standard-auctions", icon: Gavel, label: "Standard-Auktionen", nav: "/admin/auctions" },
      { key: "vip-auctions", icon: Crown, label: "VIP-Auktionen", nav: "/admin/vip-auctions" },
      { key: "voucher-auctions", icon: Ticket, label: "Gutschein-Auktionen", nav: "/admin/voucher-auctions" },
      { key: "bot-system", icon: Bot, label: "Bot-System", nav: "/admin/bot" },
      { key: "winner-control", icon: Trophy, label: "Gewinner-Kontrolle", nav: "/admin/winners" },
      { key: "product-analytics", icon: BarChart, label: "Produkt-Analyse", nav: "/admin/product-stats" },
      { key: "user-analytics", icon: UserCheck, label: "Benutzer-Analyse", nav: "/admin/user-stats" },
      { key: "revenue-analytics", icon: TrendingUp, label: "Umsatz-Analyse", nav: "/admin/revenue" },
    ],
  },
  {
    title: "Gutscheine & Codes", color: "#F97316", count: 5,
    items: [
      { key: "merchant-vouchers", icon: Ticket, label: "Händler-Gutscheine", nav: "/admin/merchant-coupons" },
      { key: "bidder-vouchers", icon: Ticket, label: "Bieter-Gutscheine", nav: "/admin/bidder-coupons" },
      { key: "partner-vouchers", icon: Ticket, label: "Partner-Gutscheine", nav: "/admin/partner-coupons" },
      { key: "discount-coupons", icon: Percent, label: "Rabatt-Coupons", nav: "/admin/discounts" },
      { key: "coupon-manager", icon: Gift, label: "Gutschein-Manager", nav: "/admin/discounts" },
    ],
  },
  {
    title: "Marktplätze & Services", color: "#059669", count: 8,
    items: [
      { key: "admin-immobilien", icon: Home, label: "Immobilien" },
      { key: "admin-freelancer", icon: Users, label: "Freelancer" },
      { key: "admin-elearning", icon: GraduationCap, label: "E-Learning" },
      { key: "admin-handwerker", icon: Wrench, label: "Handwerker" },
      { key: "admin-gebrauchtwagen", icon: CarFront, label: "Gebrauchtwagen" },
      { key: "admin-reinigung", icon: Sparkles, label: "Reinigung" },
      { key: "admin-umzug", icon: Truck, label: "Umzugsservice" },
      { key: "admin-tierbetreuung", icon: Dog, label: "Tierbetreuung" },
    ],
  },
  {
    title: "Lifestyle & Gesundheit", color: "#EC4899", count: 7,
    items: [
      { key: "admin-streaming", icon: Film, label: "Streaming" },
      { key: "admin-telemedizin", icon: Stethoscope, label: "Telemedizin" },
      { key: "admin-dating", icon: Heart, label: "Dating" },
      { key: "admin-fitness", icon: Dumbbell, label: "Fitness" },
      { key: "admin-reiseplaner", icon: Palmtree, label: "Reiseplaner" },
      { key: "admin-pool", icon: Ticket, label: "Schwimmbad", nav: "/admin/pool" },
      { key: "admin-audi-tickets", icon: Ticket, label: "Audi Tickets", nav: "/admin/audi-ticket-system" },
    ],
  },
  {
    title: "Mobilität & Energie", color: "#10B981", count: 6,
    items: [
      { key: "admin-ladesaeulen", icon: BatteryCharging, label: "Ladesäulen" },
      { key: "admin-scooter-abos", icon: Zap, label: "Scooter-Abos" },
      { key: "admin-car-rental", icon: Car, label: "Mietwagen", nav: "/car-rental/admin" },
      { key: "admin-taxi", icon: Car, label: "Taxi-Fleet", nav: "/admin/taxi" },
      { key: "admin-mobility-pricing", icon: Euro, label: "Mobility Tarife", nav: "/admin/mobility-pricing" },
      { key: "admin-parcels", icon: Package, label: "Pakete" },
    ],
  },
  {
    title: "System", color: "#6B7280", count: 11,
    items: [
      { key: "maintenance", icon: Wrench, label: "Wartung", nav: "/admin/maintenance" },
      { key: "cms", icon: FileText, label: "Seiten (CMS)", nav: "/admin/cms" },
      { key: "game-settings", icon: Settings, label: "Spiel-Einstellungen", nav: "/admin/game-settings" },
      { key: "sustainability", icon: Leaf, label: "Nachhaltigkeit", nav: "/admin/sustainability" },
      { key: "passwords", icon: Lock, label: "Passwörter", nav: "/admin/passwords" },
      { key: "system-logs", icon: Activity, label: "Systemlogs", nav: "/admin/logs" },
      { key: "voice-commands", icon: Mic, label: "Sprachbefehle" },
      { key: "debug", icon: Bug, label: "Debug Reports", nav: "/admin/debug" },
      { key: "rtk-proxy", icon: Cpu, label: "RTK Proxy", nav: "/admin/rtk" },
      { key: "system-health", icon: Server, label: "System", nav: "/admin/system-health" },
      { key: "database", icon: Database, label: "Daten-Management", nav: "/admin/database" },
    ],
  },
];
