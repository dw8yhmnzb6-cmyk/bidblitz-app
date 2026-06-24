/**
 * BidBlitz V2 - Alle Services Übersicht
 * Zeigt ALLES was die Super App kann — kategorisiert, durchsuchbar
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Wallet, CreditCard, QrCode, PiggyBank, TrendingUp,
  Car, Zap, Bike, UtensilsCrossed, Plane, Package, MapPin, BatteryCharging,
  Hotel, Ticket, Calendar, Shield, Briefcase, FileText, Users,
  Building2, GraduationCap, Wrench, Film, Stethoscope, Heart,
  CarFront, Sparkles, Truck, Dog, Dumbbell, Palmtree,
  Gamepad2, Bot, Bitcoin, Baby, ShoppingBag, Star, MessageCircle,
  Phone, Globe, Crown, Gift, Gavel, Send, Eye, ChevronRight,
  Layers, LayoutGrid, Tag, Percent
} from "lucide-react";

const CATEGORIES = [
  {
    id: "zahlung", title: "Zahlung & Finanzen", color: "#00C2FF", icon: Wallet,
    desc: "Wallet, Überweisungen, Krypto, Kredite",
    items: [
      { icon: Wallet, label: "Wallet", desc: "Aufladen, Senden, Empfangen", route: "/wallet", color: "#00C2FF" },
      { icon: QrCode, label: "QR-Zahlung", desc: "Scannen & bezahlen bei Händlern", route: "/scan", color: "#10B981" },
      { icon: Send, label: "Geld senden", desc: "P2P Überweisungen in Sekunden", route: "/wallet", color: "#3B82F6" },
      { icon: CreditCard, label: "Virtuelle Karten", desc: "Einmal- & Abo-Karten erstellen", route: "/virtual-cards", color: "#A855F7" },
      { icon: Bitcoin, label: "Krypto Wallet", desc: "Bitcoin, Ethereum, Trading", route: "/crypto", color: "#F59E0B" },
      { icon: PiggyBank, label: "Budget Planer", desc: "Ausgaben tracken, Sparziele", route: "/budget", color: "#10B981" },
      { icon: TrendingUp, label: "Kredit-Score", desc: "Score prüfen, Kredit beantragen", route: "/credit-score", color: "#EF4444" },
      { icon: CreditCard, label: "BNPL", desc: "Jetzt kaufen, später zahlen", route: "/bnpl", color: "#EC4899" },
      { icon: Globe, label: "Währungsrechner", desc: "150+ Währungen umrechnen", route: "/currency", color: "#06B6D4" },
      { icon: Gift, label: "Geschenkkarten", desc: "Amazon, Netflix, Spotify & mehr", route: "/gift-cards", color: "#F97316" },
    ],
  },
  {
    id: "mobilitaet", title: "Mobilität & Transport", color: "#10B981", icon: Car,
    desc: "Taxi, Scooter, Mietwagen, Flüge, Pakete",
    items: [
      { icon: Car, label: "Taxi", desc: "Fahrt buchen in deiner Stadt", route: "/taxi", color: "#F59E0B" },
      { icon: Zap, label: "E-Scooter", desc: "Entsperren, fahren, Abos", route: "/scooter", color: "#10B981" },
      { icon: Car, label: "Mietwagen", desc: "Autos mieten, Versicherung inkl.", route: "/car-rental", color: "#14B8A6" },
      { icon: Plane, label: "Flüge", desc: "Live-Suche via Sabre GDS", route: "/flights", color: "#00D26A", badge: "LIVE" },
      { icon: Package, label: "Paketversand", desc: "5 Carrier vergleichen, Tracking", route: "/parcels", color: "#F97316" },
      { icon: BatteryCharging, label: "Ladesäulen", desc: "E-Auto laden, Wallet-Bezahlung", route: "/ladesaeulen", color: "#10B981" },
      { icon: MapPin, label: "Karte & Nearby", desc: "Alles in der Nähe finden", route: "/nearby", color: "#3B82F6" },
      { icon: CarFront, label: "Gebrauchtwagen", desc: "Autos kaufen & verkaufen", route: "/gebrauchtwagen", color: "#0891B2" },
      { icon: Truck, label: "Umzugsservice", desc: "Umzugsfirmen, Angebote", route: "/umzug", color: "#EA580C" },
    ],
  },
  {
    id: "buchung", title: "Buchen & Reservieren", color: "#A855F7", icon: Hotel,
    desc: "Hotels, Events, Restaurants, Termine, Reisen",
    items: [
      { icon: Hotel, label: "Hotels", desc: "Weltweit buchen, Cashback", route: "/hotels", color: "#3B82F6" },
      { icon: Ticket, label: "Events", desc: "Konzerte, Sport, Theater", route: "/events", color: "#A855F7" },
      { icon: UtensilsCrossed, label: "Restaurants", desc: "Tisch reservieren", route: "/restaurants", color: "#EF4444" },
      { icon: Calendar, label: "Termine", desc: "Arzt, Friseur, Behörde", route: "/appointments", color: "#3B82F6" },
      { icon: Palmtree, label: "Reiseplaner", desc: "Komplett-Pakete buchen", route: "/reiseplaner", color: "#0D9488" },
      { icon: Shield, label: "Versicherungen", desc: "Vergleichen & abschließen", route: "/insurance", color: "#EF4444" },
    ],
  },
  {
    id: "marktplatz", title: "Marktplätze & Services", color: "#F59E0B", icon: ShoppingBag,
    desc: "Immobilien, Freelancer, Handwerker, Reinigung",
    items: [
      { icon: Building2, label: "Immobilien", desc: "Mieten, Kaufen, WG", route: "/real-estate", color: "#059669" },
      { icon: Users, label: "Freelancer", desc: "Designer, Entwickler, Texter", route: "/freelancer", color: "#7C3AED" },
      { icon: Briefcase, label: "Jobs", desc: "Stellenangebote, CV-Builder", route: "/jobs", color: "#6366F1" },
      { icon: Wrench, label: "Handwerker", desc: "Elektriker, Klempner, Maler", route: "/handwerker", color: "#D97706" },
      { icon: Sparkles, label: "Reinigung", desc: "Wohnung & Büro reinigen", route: "/reinigung", color: "#8B5CF6" },
      { icon: ShoppingBag, label: "Marktplatz", desc: "Kaufen & Verkaufen", route: "/marketplace", color: "#8B5CF6" },
      { icon: Sparkles, label: "Commerce Center", desc: "Flash Sales, Live Shopping, Auktionen", route: "/commerce-center", color: "#F97316" },
      { icon: Gavel, label: "Auktionen", desc: "Bieten & gewinnen", route: "/auctions", color: "#A855F7" },
      { icon: Tag, label: "Reselling", desc: "Sneakers, Streetwear, Gaming", route: "/reselling", color: "#F43F5E" },
      { icon: Briefcase, label: "BlitzJobs", desc: "Micro-Jobs, Geld verdienen", route: "/blitzjobs", color: "#22C55E" },
      { icon: Percent, label: "Cashback", desc: "2-8% bei Partner-Shops", route: "/cashback", color: "#F59E0B" },
    ],
  },
  {
    id: "lifestyle", title: "Lifestyle & Gesundheit", color: "#EC4899", icon: Heart,
    desc: "Streaming, Dating, Fitness, Telemedizin, Tiere",
    items: [
      { icon: Film, label: "Streaming", desc: "Filme, Serien, Dokus", route: "/streaming", color: "#DC2626" },
      { icon: Heart, label: "Dating", desc: "Swipen, Matchen, Chatten", route: "/dating", color: "#EC4899" },
      { icon: Dumbbell, label: "Fitness", desc: "Gyms finden, Mitgliedschaft", route: "/fitness", color: "#EF4444" },
      { icon: Stethoscope, label: "Telemedizin", desc: "Videosprechstunde buchen", route: "/telemedizin", color: "#059669" },
      { icon: Dog, label: "Tierbetreuung", desc: "Hundesitter, Gassi, Tierarzt", route: "/tierbetreuung", color: "#F59E0B" },
      { icon: UtensilsCrossed, label: "Essen bestellen", desc: "Lieferung aus Restaurants", route: "/food", color: "#F97316" },
    ],
  },
  {
    id: "lernen", title: "Lernen & Verdienen", color: "#3B82F6", icon: GraduationCap,
    desc: "E-Learning, Mining, Gaming, Loyalty",
    items: [
      { icon: GraduationCap, label: "E-Learning", desc: "Online-Kurse, Zertifikate", route: "/elearning", color: "#2563EB" },
      { icon: Gamepad2, label: "Gaming", desc: "11 Spiele, Coins gewinnen", route: "/gaming", color: "#EC4899" },
      { icon: Star, label: "BlitzPoints", desc: "Punkte sammeln, Prämien", route: "/loyalty", color: "#FBBF24" },
      { icon: TrendingUp, label: "Mining", desc: "BLZ Tokens verdienen", route: "/mining", color: "#10B981" },
      { icon: Users, label: "Freunde einladen", desc: "€10 pro Einladung", route: "/referral", color: "#22D3EE" },
      { icon: FileText, label: "CV-Builder", desc: "Lebenslauf erstellen, PDF", route: "/cv-builder", color: "#6366F1" },
    ],
  },
  {
    id: "familie", title: "Familie & Sicherheit", color: "#F472B6", icon: Baby,
    desc: "Kids App, SOS, GPS-Tracking, Lernspiele",
    items: [
      { icon: Baby, label: "Kids App", desc: "Kinderfreundliches Interface", route: "/kids-app", color: "#F472B6" },
      { icon: Shield, label: "Kids Kontrolle", desc: "GPS, Screen Time, Aufgaben", route: "/kids", color: "#A855F7" },
      { icon: MessageCircle, label: "Social Feed", desc: "Community, Posts, Stories", route: "/social", color: "#EC4899" },
      { icon: Phone, label: "Kontakte", desc: "BidBlitz-Nutzer finden", route: "/contacts", color: "#22D3EE" },
      { icon: Bot, label: "KI-Assistent", desc: "BlitzBot hilft bei allem", route: "/ai-assistant", color: "#6366F1" },
      { icon: Eye, label: "Support Chat", desc: "24/7 Kundensupport", route: "/support-chat", color: "#10B981" },
    ],
  },
  {
    id: "business", title: "Business & Händler", color: "#F97316", icon: Crown,
    desc: "Händler-Portal, POS-Terminal, Merchant Tools",
    items: [
      { icon: Crown, label: "Händler-Portal", desc: "Dashboard, Finanzen, Kunden", route: "/merchant-portal", color: "#F97316" },
      { icon: QrCode, label: "POS-Terminal", desc: "Zahlungen akzeptieren", route: "/terminal", color: "#10B981" },
      { icon: Star, label: "VIP-Programm", desc: "Exklusive Vorteile", route: "/vip", color: "#FBBF24" },
      { icon: CreditCard, label: "Split Bill", desc: "Rechnung teilen", route: "/split-bill", color: "#3B82F6" },
      { icon: TrendingUp, label: "BlitzBoost", desc: "Social Media Booster – Follower, Likes, Views", route: "/blitz-boost", color: "#E1306C" },
      { icon: Package, label: "BlitzTransfer", desc: "Große Dateien sicher versenden (bis 10GB)", route: "/blitz-transfer", color: "#00B2FF" },
      { icon: Zap, label: "BlitzMine", desc: "Tippe täglich & mine BLZ (Pi-Style)", route: "/blitz-mine", color: "#FFD700" },
    ],
  },
];

export default function AllServicesPage({ onBack, onNavigate }) {
  const [search, setSearch] = useState("");
  const [expandedCat, setExpandedCat] = useState(null);

  const allItems = CATEGORIES.flatMap(c => c.items.map(i => ({ ...i, category: c.title })));
  const filteredItems = search ? allItems.filter(i =>
    i.label.toLowerCase().includes(search.toLowerCase()) ||
    i.desc.toLowerCase().includes(search.toLowerCase())
  ) : [];

  const totalServices = allItems.length;

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary, #030303)" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "var(--bg-primary, #030303)" }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card, #111)" }} data-testid="services-back">
            <ArrowLeft size={20} style={{ color: "var(--text-primary, #fff)" }} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary, #fff)" }}>Alle Services</h1>
            <p className="text-[10px]" style={{ color: "var(--text-secondary, #888)" }}>{totalServices} Features in einer App</p>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ background: "rgba(0,194,255,0.1)" }}>
            <LayoutGrid size={14} style={{ color: "#00C2FF" }} />
            <span className="text-xs font-bold" style={{ color: "#00C2FF" }}>{totalServices}</span>
          </div>
        </div>

        {/* Suche */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary, #666)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Service suchen..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
            style={{ background: "var(--bg-card, #111)", color: "var(--text-primary, #fff)", border: "1px solid rgba(255,255,255,0.06)" }}
            data-testid="services-search"
          />
        </div>
      </div>

      <div className="px-4">
        {/* Suchergebnisse */}
        {search ? (
          <div className="space-y-2">
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary, #888)" }}>{filteredItems.length} Ergebnis{filteredItems.length !== 1 ? "se" : ""}</p>
            {filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <Search size={40} className="mx-auto mb-3" style={{ color: "var(--text-secondary, #444)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary, #888)" }}>Kein Service gefunden</p>
              </div>
            ) : filteredItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => onNavigate?.(item.route)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                  style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.05)" }}
                  data-testid={`service-${item.label}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}15` }}>
                    <Icon size={20} style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary, #fff)" }}>{item.label}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-secondary, #888)" }}>{item.desc}</div>
                  </div>
                  <div className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary, #666)" }}>
                    {item.category}
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--text-secondary, #444)" }} />
                </motion.button>
              );
            })}
          </div>
        ) : (
          /* Kategorien */
          <div className="space-y-3">
            {/* Stats Banner */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg, rgba(0,194,255,0.08), rgba(16,185,129,0.08))", border: "1px solid rgba(0,194,255,0.1)" }}>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { value: totalServices, label: "Services", color: "#00C2FF" },
                  { value: CATEGORIES.length, label: "Kategorien", color: "#10B981" },
                  { value: "15+", label: "Sprachen", color: "#A855F7" },
                  { value: "3%", label: "Cashback", color: "#F59E0B" },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[9px]" style={{ color: "var(--text-secondary, #888)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {CATEGORIES.map((cat, ci) => {
              const CatIcon = cat.icon;
              const isExpanded = expandedCat === cat.id;
              return (
                <motion.div key={cat.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.05 }}>
                  {/* Kategorie Header */}
                  <button
                    onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all"
                    style={{ background: isExpanded ? `${cat.color}10` : "var(--bg-card, #111)", border: `1px solid ${isExpanded ? `${cat.color}30` : "rgba(255,255,255,0.05)"}` }}
                    data-testid={`cat-${cat.id}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cat.color}15` }}>
                      <CatIcon size={20} style={{ color: cat.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary, #fff)" }}>{cat.title}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-secondary, #888)" }}>{cat.desc}</div>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${cat.color}15`, color: cat.color }}>
                      {cat.items.length}
                    </span>
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronRight size={16} style={{ color: "var(--text-secondary, #666)" }} />
                    </motion.div>
                  </button>

                  {/* Items */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-3 gap-2 pb-2 pt-1">
                          {cat.items.map((item, ii) => {
                            const Icon = item.icon;
                            return (
                              <motion.button
                                key={ii}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: ii * 0.04 }}
                                onClick={() => onNavigate?.(item.route)}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95"
                                style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.04)" }}
                                data-testid={`svc-${item.label}`}
                              >
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${item.color}12` }}>
                                  <Icon size={18} style={{ color: item.color }} />
                                </div>
                                <span className="text-[10px] font-medium text-center leading-tight" style={{ color: "var(--text-primary, #fff)" }}>{item.label}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Footer */}
            <div className="text-center py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "rgba(0,194,255,0.06)", border: "1px solid rgba(0,194,255,0.1)" }}>
                <Layers size={14} style={{ color: "#00C2FF" }} />
                <span className="text-xs" style={{ color: "#00C2FF" }}>BidBlitz Super App — {totalServices} Services in einer App</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
