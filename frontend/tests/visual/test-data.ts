export const VISUAL_VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;

export const FLOATING_AI_SELECTORS = [
  '[data-testid="ai-chat-fab"]',
  '[data-testid="floating-chatbot-bubble"]',
  '[aria-label="AI-Assistent öffnen"]',
  '.chatbot-toggle-btn',
];

export const FORBIDDEN_VISIBLE_TOKENS = [
  'FREE WORLDWIDE SHIPPING',
  'Brand New',
  'Factory Sealed',
  ' bids',
  ' bidders',
  'undefined',
  'null',
  'NaN',
];

export const GERMAN_CURRENCY_PATTERN = /^\d{1,3}(?:\.\d{3})*,\d{2}\s€$/;
export const GERMAN_ETA_PATTERN = /^\d+\sMin\.$/;

export const PRODUCT_RULES = {
  'e-bike': { expected: ['bike', 'bicycle', 'ebike', 'e-bike', 'vanmoof', 'cowboy', 'stromer'], forbidden: ['motorcycle', 'motorbike', 'harley', 'yamaha', 'honda'] },
  laptop: { expected: ['laptop', 'macbook', 'notebook', 'surface'], forbidden: ['motorcycle', 'vacuum', 'bike'] },
  'robot-vacuum': { expected: ['robot', 'roomba', 'roborock', 'vacuum'], forbidden: ['motorcycle', 'laptop', 'bike'] },
  smartphone: { expected: ['smartphone', 'phone', 'iphone', 'galaxy', 'pixel', 'xiaomi'], forbidden: ['vacuum', 'bike'] },
  television: { expected: ['tv', 'television', 'oled', 'monitor'], forbidden: ['bike', 'vacuum'] },
  'gaming-console': { expected: ['console', 'playstation', 'xbox', 'switch'], forbidden: ['bike', 'vacuum'] },
  'household-appliance': { expected: ['appliance', 'coffee', 'vacuum', 'washer'], forbidden: ['motorcycle', 'laptop'] },
} as const;

export const AUCTIONS_OVERVIEW_CONFIG = {
  route: '/auctions',
  routeKey: 'auctions-overview',
  waitFor: '[data-testid="auctions-page"]',
  fullPageTestId: '[data-testid="auctions-page"]',
  primaryActionSelector: '[data-testid^="auction-card-"]',
  priceSelectors: ['[data-testid^="auction-price-"]'],
  timerSelectors: ['[data-testid="auction-countdown"]'],
  imageSelectors: ['[data-testid^="auction-card-"] img'],
  componentSelectors: ['[data-testid="auctions-page-shell"]', '[data-testid^="auction-card-"]'],
  overlapPairs: [
    { element1: '[data-testid^="auction-price-"]', element2: '[data-testid="auction-countdown"]', severity: 'high', rule: 'price-timer-overlap' },
    { element1: '[data-testid^="auction-logistics-badge-"]', element2: '[data-testid^="auction-watch-"]', severity: 'medium', rule: 'floating-action-overlap' },
  ],
  expectBottomNav: true,
};

export const AUCTION_DETAIL_CONFIG = {
  routeKey: 'auction-detail',
  waitFor: '[data-testid="auction-detail"]',
  fullPageTestId: '[data-testid="auction-detail"]',
  primaryActionSelector: '[data-testid="place-bid-btn"]',
  priceSelectors: ['[data-testid="auction-detail-current-price"]'],
  timerSelectors: ['[data-testid="auction-countdown"]'],
  imageSelectors: ['[data-testid="auction-detail-gallery"] img'],
  componentSelectors: ['[data-testid="auction-detail-gallery"]', '[data-testid="place-bid-btn"]', '[data-testid="auction-bid-history"]'],
  overlapPairs: [
    { element1: '[data-testid="auction-detail-current-price"]', element2: '[data-testid="auction-countdown"]', severity: 'high', rule: 'price-timer-overlap' },
    { element1: '[data-testid="place-bid-btn"]', element2: '[data-testid="auction-bid-history"]', severity: 'medium', rule: 'sticky-action-overlap' },
  ],
  expectBottomNav: false,
};

export const TAXI_CONFIG = {
  route: '/taxi',
  routeKey: 'taxi-booking',
  waitFor: '[data-testid="taxi-simple-page"]',
  fullPageTestId: '[data-testid="taxi-simple-page"]',
  primaryActionSelector: '[data-testid="book-ride-button"]',
  priceSelectors: ['[data-testid="taxi-selected-price"]', '[data-testid="taxi-fixed-fare"]', '[data-testid="taxi-base-fare"]'],
  timerSelectors: ['[data-testid="vehicle-selection-summary"]'],
  imageSelectors: [],
  componentSelectors: ['[data-testid="bottom-sheet-container"]', '[data-testid="vehicle-selection-summary"]', '[data-testid="pricing-overview-card"]', '[data-testid="taxi-booking-cta-wrap"]'],
  overlapPairs: [
    { element1: '[data-testid="book-ride-button"]', element2: '[data-testid="pricing-overview-card"]', severity: 'high', rule: 'sticky-button-overlap' },
    { element1: '[data-testid="book-ride-button"]', element2: '[data-testid="bottom-nav"]', severity: 'high', rule: 'bottom-nav-obstruction' },
  ],
  expectBottomNav: false,
};