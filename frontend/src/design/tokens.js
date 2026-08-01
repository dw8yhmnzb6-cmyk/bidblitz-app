export const BIDBLITZ_BREAKPOINTS = {
  mobileXs: 320,
  mobileSm: 375,
  mobileMd: 390,
  mobileLg: 430,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
};

export const bidblitzTokens = {
  colors: {
    background: '#02050B',
    backgroundElevated: '#07101D',
    backgroundSoft: '#0B1728',
    cyan: '#00C8FF',
    blue: '#087CFF',
    success: '#18D68C',
    warning: '#FFCC33',
    danger: '#FF4D5E',
    text: '#FFFFFF',
    textSecondary: '#A9B1BF',
    textMuted: '#707888',
    border: 'rgba(169, 177, 191, 0.22)',
  },
  radii: {
    card: '24px',
    pill: '999px',
    button: '20px',
  },
  spacing: {
    pageX: 'clamp(16px, 4vw, 20px)',
    cardPadding: 'clamp(16px, 3.8vw, 24px)',
    cardGap: '12px',
    sectionGap: '24px',
  },
  sizes: {
    buttonHeight: '48px',
    buttonHeightPrimary: '56px',
    icon: '20px',
    headerHeight: '64px',
    bottomNavHeight: '88px',
    desktopContentWidth: '1440px',
  },
  shadows: {
    card: '0 24px 60px rgba(2, 7, 16, 0.46)',
    glow: '0 18px 40px rgba(0, 200, 255, 0.18)',
  },
  zIndex: {
    shell: 1,
    stickyAction: 45,
    bottomNav: 9999,
    modal: 10000,
  },
};

function resolveLocale(locale = 'de') {
  if (String(locale).toLowerCase().startsWith('en')) return 'en';
  return 'de';
}

export function formatBidBlitzCurrency(value, options = {}) {
  const {
    locale = 'de',
    currency = 'EUR',
    compact = false,
    privacy = false,
    signDisplay = 'auto',
    maximumFractionDigits,
    minimumFractionDigits,
  } = options;

  if (privacy) return '••••';
  const numericValue = Number(value || 0);
  const resolvedLocale = resolveLocale(locale);

  return new Intl.NumberFormat(resolvedLocale === 'de' ? 'de-DE' : 'en-US', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: minimumFractionDigits ?? (compact ? 0 : 2),
    maximumFractionDigits: maximumFractionDigits ?? (compact ? 1 : 2),
    signDisplay,
  }).format(numericValue);
}

export function formatBidBlitzDuration(totalSeconds, options = {}) {
  const { locale = 'de', compact = false, endedLabel } = options;
  const resolvedLocale = resolveLocale(locale);
  const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));

  if (seconds <= 0) return endedLabel || (resolvedLocale === 'de' ? 'Beendet' : 'Ended');

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (compact) {
    const totalHours = days * 24 + hours;
    return `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  if (resolvedLocale === 'de') {
    if (days > 0) {
      return `${days} Tg. ${String(hours).padStart(2, '0')} Std. ${String(minutes).padStart(2, '0')} Min. ${String(secs).padStart(2, '0')} Sek.`;
    }
    return `${String(hours).padStart(2, '0')} Std. ${String(minutes).padStart(2, '0')} Min. ${String(secs).padStart(2, '0')} Sek.`;
  }

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

export function buildBidBlitzImageMeta({
  title = '',
  productCategory = '',
  productSubcategory = '',
  imageCategory = '',
  imageSource = 'catalog',
  imageVerified = true,
} = {}) {
  const normalizedTitle = String(title || '').toLowerCase();
  const fallbackImageCategory = imageCategory
    || (normalizedTitle.includes('macbook') || normalizedTitle.includes('laptop') ? 'laptop'
      : normalizedTitle.includes('robo') || normalizedTitle.includes('vacuum') ? 'robot-vacuum'
        : normalizedTitle.includes('bike') ? 'e-bike'
          : productCategory || 'product');

  return {
    product_category: productCategory || 'general',
    product_subcategory: productSubcategory || 'general',
    image_category: fallbackImageCategory,
    image_source: imageSource,
    image_verified: imageVerified,
  };
}