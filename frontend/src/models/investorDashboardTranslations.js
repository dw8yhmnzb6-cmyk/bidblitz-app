const dashboardDe = {
  title: "BidBlitz Investor Dashboard",
  subtitle: "Aktueller Entwicklungsstand und Unternehmensübersicht.",
  badge: "Investor Dashboard",
  developmentStatus: "Entwicklungsstatus",
  roadmapProgress: "Roadmap-Fortschritt",
  businessKpis: "Geschäfts-KPIs",
  productModules: "Produktmodule",
  investmentOverview: "Investment-Überblick",
  useOfCapital: "Kapitalverwendung",
  latestUpdates: "Neueste Updates",
  documents: "Dokumente",
  contact: "Kontakt",
  noData: "Daten werden nach dem offiziellen Start veröffentlicht.",
  currentStatus: "Aktueller Status",
  developmentPhase: "Entwicklungsphase",
  plannedNextMilestone: "Geplanter nächster Meilenstein",
  fundingRoundStatus: "Status der Finanzierungsrunde",
  targetAmount: "Zielbetrag",
  amountReserved: "Bereits reserviert",
  remainingAllocation: "Verbleibende Zuteilung",
  minimumInvestment: "Mindestinvestment",
  maximumEquity: "Maximal verfügbarer Eigenkapitalanteil",
  latestGenerated: "Letztes Update",
  meetingRequest: "Meeting anfragen",
  investorRelations: "Investor Relations",
  download: "Herunterladen",
  email: "E-Mail",
  version: "Version",
  date: "Date",
  category: "Kategorie",
  description: "Beschreibung",
  status: "Status",
  sourceVerified: "Verifiziert",
  sourceUnavailable: "Noch nicht veröffentlicht",
};

const dashboardEn = {
  title: "BidBlitz Investor Dashboard",
  subtitle: "Current development status and company overview.",
  badge: "Investor Dashboard",
  developmentStatus: "Development Status",
  roadmapProgress: "Roadmap Progress",
  businessKpis: "Business KPIs",
  productModules: "Product Modules",
  investmentOverview: "Investment Overview",
  useOfCapital: "Use of Capital",
  latestUpdates: "Latest Updates",
  documents: "Documents",
  contact: "Contact",
  noData: "Data will be published after the official launch.",
  currentStatus: "Current status",
  developmentPhase: "Development phase",
  plannedNextMilestone: "Planned next milestone",
  fundingRoundStatus: "Funding round status",
  targetAmount: "Target amount",
  amountReserved: "Amount reserved",
  remainingAllocation: "Remaining allocation",
  minimumInvestment: "Minimum investment",
  maximumEquity: "Maximum total equity available",
  latestGenerated: "Last update",
  meetingRequest: "Meeting request",
  investorRelations: "Investor Relations",
  download: "Download",
  email: "Email",
  version: "Version",
  date: "Date",
  category: "Category",
  description: "Description",
  status: "Status",
  sourceVerified: "Verified",
  sourceUnavailable: "Not published yet",
};

const supported = ["de", "en", "en-US", "sq", "sq-XK", "tr", "fr", "es", "it", "pt", "nl", "pl", "ru", "ar", "ar-AE"];

const translations = supported.reduce((acc, code) => {
  acc[code] = code === "de" ? dashboardDe : dashboardEn;
  return acc;
}, {});

export function useInvestorDashboardTranslations(language) {
  const dict = translations[language] || translations.en;
  return (key) => dict[key] || translations.en[key] || key;
}