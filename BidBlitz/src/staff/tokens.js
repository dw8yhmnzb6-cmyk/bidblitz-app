/**
 * BidBlitz Staff — Design Tokens (Single Source of Truth)
 * =======================================================
 * Verwende NUR diese Tokens in allen Staff-Komponenten.
 *
 * Regel: keine hardcoded Hex-Farben, keine Inline-Spacings,
 * keine eigenen Schatten in Komponenten. Wenn du eine neue
 * Variation brauchst → hier hinzufügen.
 *
 * Light-Theme First. Mobile-First. Apple/Stripe-inspiriert.
 */

// ──────────────────────────────────────────────────────────
// COLORS — neutrale Basis + sparsame Akzente
// ──────────────────────────────────────────────────────────
export const COLORS = {
  // Background layers
  bg: {
    base: "#F8FAFC",       // slate-50
    surface: "#FFFFFF",    // white cards
    elevated: "#FFFFFF",
    overlay: "rgba(15, 23, 42, 0.4)",
  },
  // Borders
  border: {
    subtle: "#E2E8F0",     // slate-200
    soft: "#F1F5F9",       // slate-100
    strong: "#CBD5E1",     // slate-300
  },
  // Text
  text: {
    primary: "#0F172A",    // slate-900
    secondary: "#475569",  // slate-600
    tertiary: "#94A3B8",   // slate-400
    inverse: "#FFFFFF",
  },
  // Brand — sparsam einsetzen
  brand: {
    primary: "#2563EB",    // blue-600
    primaryHover: "#1D4ED8",
    primarySoft: "#DBEAFE", // blue-100
  },
  // Status — semantische Farben
  status: {
    success: "#10B981",    // emerald-500
    successSoft: "#D1FAE5",
    warning: "#F59E0B",    // amber-500
    warningSoft: "#FEF3C7",
    danger: "#EF4444",     // red-500
    dangerSoft: "#FEE2E2",
    info: "#06B6D4",       // cyan-500
    infoSoft: "#CFFAFE",
    neutral: "#64748B",    // slate-500
    neutralSoft: "#F1F5F9",
  },
};

// ──────────────────────────────────────────────────────────
// SPACING — 4px grid (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
// ──────────────────────────────────────────────────────────
export const SPACING = {
  xs: "0.25rem",   // 4px
  sm: "0.5rem",    // 8px
  md: "0.75rem",   // 12px
  lg: "1rem",      // 16px
  xl: "1.25rem",   // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "2rem",   // 32px
  "4xl": "2.5rem", // 40px
  "5xl": "3rem",   // 48px
  "6xl": "4rem",   // 64px
};

// ──────────────────────────────────────────────────────────
// TYPOGRAPHY — klare Hierarchie
// ──────────────────────────────────────────────────────────
export const TYPO = {
  // Page titles
  h1: "text-3xl sm:text-4xl font-bold tracking-tight text-slate-900",
  h2: "text-xl sm:text-2xl font-bold text-slate-900",
  h3: "text-base sm:text-lg font-bold text-slate-900",
  // Body
  body: "text-sm text-slate-900",
  bodySm: "text-xs text-slate-700",
  // Subtle / meta
  meta: "text-xs text-slate-500",
  metaUpper: "text-[11px] uppercase tracking-wider text-slate-400 font-semibold",
  // Numbers / KPI
  kpi: "text-3xl sm:text-4xl font-bold tabular-nums tracking-tight",
  kpiSmall: "text-xl font-bold tabular-nums",
  // Mono
  timer: "font-mono tabular-nums",
};

// ──────────────────────────────────────────────────────────
// RADIUS — konsistent über die App
// ──────────────────────────────────────────────────────────
export const RADIUS = {
  sm: "rounded-lg",      // 8px — small UI
  md: "rounded-xl",      // 12px — buttons, inputs
  lg: "rounded-2xl",     // 16px — cards
  xl: "rounded-3xl",     // 24px — hero cards
  pill: "rounded-full",  // chips, pills
};

// ──────────────────────────────────────────────────────────
// SHADOWS — subtil. NIE bold/glow/neon.
// ──────────────────────────────────────────────────────────
export const SHADOW = {
  none: "shadow-none",
  xs: "shadow-sm",
  sm: "shadow",
  md: "shadow-md",
  lg: "shadow-lg",
  // Card hover lift
  cardHover: "hover:shadow-md transition-shadow",
};

// ──────────────────────────────────────────────────────────
// BUTTON SIZES — Mobile-First Touch Targets
// ──────────────────────────────────────────────────────────
// WHO/Apple/Material Guidelines: 44px minimum, 56px für Primary Mobile-Actions
export const BUTTON_SIZE = {
  // Compact (icon-only, desktop dense lists)
  xs: "h-9 min-w-[36px] px-3 text-xs",          // 36px
  sm: "h-10 min-w-[44px] px-4 text-sm",         // 40px - min touch
  md: "h-12 min-w-[48px] px-5 text-sm",         // 48px - default
  lg: "h-14 min-w-[56px] px-6 text-base",       // 56px - mobile primary
  xl: "h-16 min-w-[64px] px-8 text-lg",         // 64px - hero CTA
};

// ──────────────────────────────────────────────────────────
// MOBILE RULES — enforced by ResponsiveGuard hook
// ──────────────────────────────────────────────────────────
export const MOBILE_RULES = {
  minButtonHeight: 44,        // px — Apple HIG / WCAG
  primaryButtonHeight: 56,    // px — Mobile primary action
  maxTabsPrimary: 4,          // Bottom-Nav / parent tabs
  maxQuickActions: 4,         // Hero-Buttons per screen
  minTouchTarget: 44,         // px
  maxNeonColors: 0,           // KEINE Neon-Farben mehr
  bannedClassPatterns: [
    /text-\[#[0-9A-Fa-f]{3,6}\]/,   // hardcoded color in text-[]
    /bg-\[#[0-9A-Fa-f]{3,6}\]/,     // hardcoded color in bg-[]
    /border-\[#[0-9A-Fa-f]{3,6}\]/,
    /\[#00C2FF\]/,                  // legacy neon cyan
    /\[#A855F7\]/,                  // legacy neon violet on dark bg
    /\[#0A0A0A\]/,                  // legacy ERP-dark
  ],
  bannedTextSizes: ["text-[8px]", "text-[9px]", "text-[10px]"], // unleserlich auf Mobile
};

// ──────────────────────────────────────────────────────────
// STATUS HELPERS — mapping action → semantic color
// ──────────────────────────────────────────────────────────
export const STATUS_COLORS = {
  working: { color: COLORS.status.success, soft: COLORS.status.successSoft, label: "Arbeitet" },
  break:   { color: COLORS.status.warning, soft: COLORS.status.warningSoft, label: "Pause" },
  off:     { color: COLORS.status.neutral, soft: COLORS.status.neutralSoft, label: "Aus" },
  pending: { color: COLORS.status.warning, soft: COLORS.status.warningSoft, label: "Offen" },
  approved:{ color: COLORS.status.success, soft: COLORS.status.successSoft, label: "Genehmigt" },
  rejected:{ color: COLORS.status.danger, soft: COLORS.status.dangerSoft, label: "Abgelehnt" },
  active:  { color: COLORS.status.success, soft: COLORS.status.successSoft, label: "Aktiv" },
  past:    { color: COLORS.status.neutral, soft: COLORS.status.neutralSoft, label: "Vorbei" },
  planned: { color: COLORS.brand.primary,  soft: COLORS.brand.primarySoft,  label: "Geplant" },
};

// ──────────────────────────────────────────────────────────
// EXPORT BUNDLE — für einfachen Import in Components
// ──────────────────────────────────────────────────────────
const tokens = {
  COLORS,
  SPACING,
  TYPO,
  RADIUS,
  SHADOW,
  BUTTON_SIZE,
  MOBILE_RULES,
  STATUS_COLORS,
};

export default tokens;
