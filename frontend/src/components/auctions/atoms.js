/* Shared atoms & constants for the Auctions module */

export const POLL_MS = 2500;         // AuctionDetail — real-time bid polling (fast)
export const LIST_POLL_MS = 5000;    // Auctions grid + notifs polling (relaxed)

export const glass = "backdrop-blur-xl";
export const panelBg = "rgba(8,12,20,0.65)";
export const panelBorder = "1px solid rgba(255,255,255,0.04)";

export const accentCyan = "#00E0FF";
export const accentGold = "#FFD166";
export const accentGreen = "#00E89D";
export const accentRed = "#FF4060";
export const accentPurple = "#B068FF";

/* Bid-credit packages (server mirrors `/api/auctions/credits/plans`) */
export const PKGS = [
  { id: "10", credits: 10, price: 5, ppc: 0.50 },
  { id: "25", credits: 25, price: 10, ppc: 0.40, discount: 20 },
  { id: "50", credits: 50, price: 17.50, ppc: 0.35, discount: 30, deal: true },
  { id: "100", credits: 100, price: 29, ppc: 0.29, discount: 42, deal: true },
  { id: "250", credits: 250, price: 62.50, ppc: 0.25, discount: 50, deal: true, best: true },
];

/* Extract locale-aware auction title/description/features */
export const localized = (auction, lang) => {
  const t = auction?.translations?.[lang];
  return {
    title: t?.title || auction?.title || "",
    description: t?.description || auction?.description || "",
    features: (t?.features || auction?.features || []),
  };
};
