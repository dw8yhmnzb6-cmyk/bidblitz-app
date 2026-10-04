/** Existing App.js admin entry points, not grants. Contract-tested for completeness. */
const GROUPS = {
  "Konten & Personal": [
    ["manage", "Kontenverwaltung"], ["users", "Benutzer"], ["customers", "Kunden"], ["managers", "Manager"],
    ["employees", "Mitarbeiter"], ["enterprise", "Enterprise"], ["influencer", "Influencer"],
    ["kyc", "KYC"], ["passwords", "Kontosicherheit"], ["support", "Support"],
  ],
  "Partner & Händler": [
    ["merchants", "Händler / POS"], ["partners", "Partner"], ["partner-credit", "Partner-Freibetrag"],
    ["applications", "Bewerbungen"], ["merchant-onboarding", "Händler-Onboarding"],
    ["merchant-settlements", "Händler-Abrechnungen"], ["merchant-features", "Händler-Funktionen"],
    ["qr-management", "QR-Verwaltung"], ["qr-tables", "QR-Tische"], ["directory", "Verzeichnis"],
  ],
  "Finanzen": [
    ["wallet", "Wallet"], ["payments", "Zahlungen"], ["transactions", "Transaktionen"],
    ["topup", "Aufladungen"], ["pay-requests", "Pay-Anträge"], ["payouts", "Auszahlungen"],
    ["wise", "Wise"], ["credits", "Kredite"], ["pay-sdk", "Pay SDK / API"], ["revenue", "Umsatz"],
    ["coin-rates", "Coin-Kurse"], ["cashback-rates", "Cashback-Sätze"],
  ],
  "Auktionen & Gutscheine": [
    ["products", "Produkte"], ["auctions", "Auktionen"], ["vip-auctions", "VIP-Auktionen"],
    ["voucher-auctions", "Gutschein-Auktionen"], ["bot", "Bot-System"], ["winners", "Gewinner"],
    ["auction-images", "Auktionsbilder"], ["product-stats", "Produkt-Statistik"], ["user-stats", "Benutzer-Statistik"],
    ["merchant-coupons", "Händler-Gutscheine"], ["bidder-coupons", "Bieter-Gutscheine"],
    ["partner-coupons", "Partner-Gutscheine"], ["coupons", "Gutschein-Manager"], ["discounts", "Rabatte"],
  ],
  "Mobilität & Services": [
    ["taxi", "Taxi"], ["taxi-drivers", "Taxi-Fahrer"], ["mobility-pricing", "Mobility-Tarife"],
    ["scooter-fleet", "Scooter-Fleet"], ["scooter-add", "Scooter hinzufügen"], ["restaurants", "Restaurants"],
    ["pool", "Schwimmbad"], ["audi-ticket-system", "Audi Tickets"], ["bookings", "Buchungen"],
    ["modules", "Service-Module"],
  ],
  "Marketing & Kundenbindung": [
    ["ads", "Werbung"], ["smm", "Social Media"], ["email-marketing", "E-Mail Marketing"],
    ["push-broadcast", "Push-Nachrichten"], ["testimonials", "Testimonials"], ["landing-leads", "Landing Leads"],
    ["charge-offer-rules", "Charge-Angebotsregeln"], ["loyalty-config", "Loyalty-Konfiguration"],
    ["loyalty-analytics", "Loyalty-Analyse"],
  ],
  "Investoren": [
    ["investor-leads", "Investor Leads"], ["investor-dashboard", "Investor Dashboard"],
    ["investor-documents", "Investor Dokumente"], ["investor-updates", "Investor Updates"],
    ["investor-meetings", "Investor Meetings"],
  ],
  "System & Sicherheit": [
    ["monitoring", "Monitoring"], ["system-health", "Systemstatus"], ["health", "Health"],
    ["feature-control", "Feature-Steuerung"], ["audit-log", "Audit-Log"], ["logs", "Systemlogs"],
    ["biopay-audit", "BioPay-Audit"], ["biopay-audit-center", "BioPay-Audit-Center"],
    ["diag", "Diagnose"], ["rtk", "RTK"], ["analytics", "Analytics"], ["deployment-info", "Deployment-Info"],
    ["maintenance", "Wartung"], ["cms", "CMS"], ["game-settings", "Vorhandene Spiel-Einstellungen"],
    ["sustainability", "Nachhaltigkeit"], ["debug", "Debug"], ["database", "Datenverwaltung"],
    ["visual-qa", "Visual QA"], ["master-roadmap", "Master Roadmap"], ["legal", "Rechtliches"],
    ["ai-assistant", "Admin-AI-Assistent", ["admin"]], ["old", "Vorhandener Admin"],
  ],
};

export const ADMIN_ACCESS_AREAS = [
  ...Object.entries(GROUPS).flatMap(([group, rows]) => rows.map(([slug, name, roles]) => ({
    path: `/admin/${slug}`, name, group, roles: roles || ["admin", "super_admin"],
  }))),
  { path: "/car-rental/admin", name: "Mietwagen", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
  { path: "/car-rental/admin/disputes", name: "Mietwagen-Streitfälle", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
  { path: "/mining-trust-admin", name: "Mining Trust", group: "Finanzen", roles: ["admin", "super_admin"] },
  { path: "/admin/tables", name: "Restaurant-Tische", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
  { path: "/admin/ev", name: "EV-Verwaltung", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
  { path: "/admin/ev/overview", name: "EV-Übersicht", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
  { path: "/admin/ev/operators", name: "EV-Betreiber", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
  { path: "/admin/ev/vendors", name: "EV-Hardware", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
  { path: "/admin/ev/tariffs", name: "EV-Tarife", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
  { path: "/admin/ev/payouts", name: "EV-Auszahlungen", group: "Mobilität & Services", roles: ["admin", "super_admin"] },
];

// Prevent an editable catalogue or a malformed API response from inventing native routes.
export const NATIVE_ADMIN_PATHS = new Set(["/admin", ...ADMIN_ACCESS_AREAS.map((area) => area.path)]);
