const API_URL = process.env.REACT_APP_BACKEND_URL;
const REQUEST_TIMEOUT = 15000; // 15 seconds

// ── Structured Error ──
class ApiError extends Error {
  constructor(message, { status = 0, code = "unknown", retryable = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function formatApiError(detail) {
  if (detail == null) return "Etwas ist schiefgelaufen. Bitte erneut versuchen.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : (e && typeof e.message === "string" ? e.message : JSON.stringify(e)))).filter(Boolean).join(" ");
  if (detail && typeof detail.message === "string") return detail.message;
  if (detail && typeof detail.msg === "string") return detail.msg;
  if (detail && typeof detail.detail === "string") return detail.detail;
  if (detail && typeof detail.error === "string") return detail.error;
  return String(detail);
}

async function request(path, options = {}) {
  // Block if offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ApiError("Du bist offline. Bitte Verbindung prüfen.", { code: "offline", retryable: true });
  }

  const url = `${API_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const config = {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    signal: controller.signal,
    ...options,
  };

  try {
    let res = await fetch(url, config);
    clearTimeout(timeout);

    // Auto-refresh on 401: try refresh token, then retry original request
    if (res.status === 401 && !options._isRetry && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
      try {
        const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (refreshRes.ok) {
          // Retry the original request with new cookie
          const retryController = new AbortController();
          const retryTimeout = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT);
          res = await fetch(url, { ...config, signal: retryController.signal, _isRetry: true });
          clearTimeout(retryTimeout);
        }
      } catch (refreshError) {
        void refreshError;
      }
    }

    let data;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      if (!res.ok) {
        if (res.status === 401) throw new ApiError("Session abgelaufen. Bitte erneut anmelden.", { status: 401, code: "auth" });
        if (res.status === 400) throw new ApiError("Ungültige Anfrage. Bitte Eingaben prüfen.", { status: 400, code: "validation" });
        if (res.status === 404) throw new ApiError("Nicht gefunden.", { status: 404, code: "not_found" });
        if (res.status === 429) throw new ApiError("Zu viele Anfragen. Bitte später erneut versuchen.", { status: 429, code: "rate_limit", retryable: true });
        if (res.status === 403) throw new ApiError("Zugriff verweigert. Bitte anmelden oder Berechtigung prüfen.", { status: 403, code: "forbidden" });
        if (res.status >= 500) throw new ApiError("Serverfehler. Bitte später erneut versuchen.", { status: res.status, code: "server", retryable: true });
        throw new ApiError(`Anfrage fehlgeschlagen (${res.status})`, { status: res.status, code: "unknown", retryable: true });
      }
      return {};
    }

    if (!res.ok) {
      const msg = formatApiError(data.detail || data.message);
      if (res.status === 429) throw new ApiError(data.message || msg, { status: 429, code: "rate_limit", retryable: true });
      if (res.status >= 500) throw new ApiError(msg, { status: res.status, code: "server", retryable: true });
      throw new ApiError(msg, { status: res.status, code: res.status === 401 ? "auth" : "api" });
    }
    return data;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") {
      throw new ApiError("Zeitüberschreitung. Bitte erneut versuchen.", { code: "timeout", retryable: true });
    }
    if (error.name === "TypeError" && error.message === "Failed to fetch") {
      throw new ApiError("Server nicht erreichbar. Bitte Verbindung prüfen.", { code: "network", retryable: true });
    }
    throw new ApiError(error.message || "Anfrage fehlgeschlagen.", { code: "unknown", retryable: true });
  }
}

// ── CSV Export Download Helper ──
async function downloadCSV(path, filename) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Nicht angemeldet");
    if (res.status === 403) throw new Error("Zugriff verweigert");
    throw new Error("Export fehlgeschlagen");
  }
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename || "export.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function buildExportQuery(params = {}) {
  const q = new URLSearchParams();
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.type) q.set("type", params.type);
  if (params.status) q.set("status", params.status);
  if (params.direction) q.set("direction", params.direction);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  // Auth
  register: (body) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  verify2FA: (body) => request("/api/auth/verify-2fa", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  getMe: () => request("/api/auth/me"),
  refresh: () => request("/api/auth/refresh", { method: "POST" }),

  // Wallet
  getWallet: async () => {
    // Fetch regular wallet data (required)
    const wallet = await request("/api/wallet");
    // Fetch optional total balance (EUR + Crypto). If this endpoint is missing
    // or transiently fails, we MUST NOT zero the user's visible wallet —
    // return base wallet only.
    let totalBalance = {};
    try {
      totalBalance = await request("/api/wallet/balance/total");
    } catch (_) {
      totalBalance = {};
    }
    return { ...wallet, ...totalBalance };
  },
  getWalletBalance: () => request("/api/wallet/balance"),
  topUp: (body) => request("/api/wallet/topup", { method: "POST", body: JSON.stringify(body) }),

  // Saved Payment Method & 1-Click
  getSavedMethod: () => request("/api/stripe/saved-method"),
  quickTopUp: (body) => request("/api/stripe/quick-topup", { method: "POST", body: JSON.stringify(body) }),
  removeSavedMethod: () => request("/api/stripe/saved-method", { method: "DELETE" }),
  saveCard: () => request("/api/stripe/save-card", { method: "POST" }),
  saveCardConfirm: () => request("/api/stripe/save-card-confirm", { method: "POST" }),

  // Payment
  pay: (body) => request("/api/payment/pay", { method: "POST", body: JSON.stringify(body) }),
  send: (body) => request("/api/payment/send", { method: "POST", body: JSON.stringify(body) }),
  getMyBarcode: () => request("/api/payment/my-barcode"),
  merchantScanPayment: (body) => request("/api/payment/merchant-scan", { method: "POST", body: JSON.stringify(body) }),
  resolveScanCode: (body) => request("/api/scan/resolve", { method: "POST", body: JSON.stringify(body) }),

  // Merchant
  getMerchantDashboard: () => request("/api/merchant/dashboard"),
  getMerchantV5Dashboard: () => request("/api/merchant-portal/v5/dashboard"),
  getMerchantExecutiveAiLatest: () => request("/api/merchant-portal/v5/executive-ai/latest"),
  getMerchantBusinessAutomation: () => request("/api/merchant-portal/v5/business-automation"),
  updateMerchantBusinessAutomationSettings: (body) => request("/api/merchant-portal/v5/business-automation/settings", { method: "POST", body: JSON.stringify(body) }),
  runMerchantBusinessAutomationFull: () => request("/api/merchant-portal/v5/business-automation/run/full", { method: "POST" }),
  runMerchantBusinessAutomationProcurement: (body = {}) => request("/api/merchant-portal/v5/business-automation/run/procurement", { method: "POST", body: JSON.stringify(body) }),
  runMerchantBusinessAutomationOperations: (body = {}) => request("/api/merchant-portal/v5/business-automation/run/operations", { method: "POST", body: JSON.stringify(body) }),
  runMerchantBusinessAutomationRevenue: (body = {}) => request("/api/merchant-portal/v5/business-automation/run/revenue", { method: "POST", body: JSON.stringify(body) }),

  // Smart Invoice Payment Links
  getPublicInvoicePaymentLink: (token) => request(`/api/pay/${token}`),
  checkoutInvoicePaymentLink: (token, body) => request(`/api/pay/${token}/checkout`, { method: "POST", body: JSON.stringify(body) }),
  getInvoicePaymentCheckoutStatus: (token, sessionId) => request(`/api/pay/${token}/checkout-status/${sessionId}`),
  createInvoicePaymentLink: (invoiceId) => request(`/api/invoicing/${invoiceId}/payment-link`, { method: "POST" }),

  // Commerce Center
  getCommerceCenterOverview: () => request("/api/commerce-center/overview"),
  getCommerceMerchantDashboard: () => request("/api/commerce-center/merchant-dashboard"),
  createCommerceFlashSale: (body) => request("/api/commerce-center/flash-sales", { method: "POST", body: JSON.stringify(body) }),
  cancelCommerceFlashSale: (saleId) => request(`/api/commerce-center/flash-sales/${saleId}`, { method: "DELETE" }),
  buyCommerceFlashSale: (saleId, body = {}) => request(`/api/commerce-center/flash-sales/${saleId}/buy`, { method: "POST", body: JSON.stringify(body) }),

  // POS Security V2
  posResolveCustomer: (body) => request("/api/pos/customer/resolve", { method: "POST", body: JSON.stringify(body) }),
  posWalletTopUpSecure: (body) => request("/api/pos/wallet/top-up", { method: "POST", body: JSON.stringify(body) }),
  posPreparePaymentSecure: (body) => request("/api/pos/payment/prepare", { method: "POST", body: JSON.stringify(body) }),
  posConfirmPaymentPin: (body) => request("/api/pos/payment/confirm-pin", { method: "POST", body: JSON.stringify(body) }),
  posApproveHighValuePayment: (paymentId) => request(`/api/pos/payment/customer-approve/${paymentId}`, { method: "POST" }),
  setCustomerPaymentPin: (body) => request("/api/customer/payment-pin/set", { method: "POST", body: JSON.stringify(body) }),
  resetCustomerPaymentPin: (body) => request("/api/customer/payment-pin/reset", { method: "POST", body: JSON.stringify(body) }),
  verifyCustomerPaymentPin: (body) => request("/api/customer/payment-pin/verify", { method: "POST", body: JSON.stringify(body) }),
  getPosSecurityDashboard: (storeId) => request(`/api/pos/security/dashboard?store_id=${encodeURIComponent(storeId)}`),
  getPosSecurityReports: (storeId, period = "daily") => request(`/api/pos/security/reports?store_id=${encodeURIComponent(storeId)}&period=${encodeURIComponent(period)}`),
  getPosSecurityRoles: (storeId) => request(`/api/pos/security/roles?store_id=${encodeURIComponent(storeId)}`),
  updatePosSecurityRole: (roleKey, storeId, body) => request(`/api/pos/security/roles/${roleKey}?store_id=${encodeURIComponent(storeId)}`, { method: "POST", body: JSON.stringify(body) }),
  getPosSecurityLimits: (scopeType, scopeId) => request(`/api/pos/security/limits?scope_type=${encodeURIComponent(scopeType)}&scope_id=${encodeURIComponent(scopeId)}`),
  updatePosSecurityLimits: (body) => request("/api/pos/security/limits", { method: "POST", body: JSON.stringify(body) }),
  getPosSecurityApprovals: (storeId) => request(`/api/pos/security/approvals?store_id=${encodeURIComponent(storeId)}`),
  decidePosSecurityApproval: (approvalId, body) => request(`/api/pos/security/approvals/${approvalId}/decision`, { method: "POST", body: JSON.stringify(body) }),
  getAdminCustomerIntelligence: (days = 365) => request(`/api/admin/customer-intelligence/overview?days=${encodeURIComponent(days)}`),
  getAdminCustomerIntelligenceCustomer: (userId, days = 365) => request(`/api/admin/customer-intelligence/customer/${encodeURIComponent(userId)}?days=${encodeURIComponent(days)}`),

  // Transactions
  getTransactions: (params = {}) => {
    const query = new URLSearchParams();
    if (params.type) query.set("type", params.type);
    if (params.status) query.set("status", params.status);
    if (params.limit) query.set("limit", params.limit);
    if (params.skip) query.set("skip", params.skip);
    const qs = query.toString();
    return request(`/api/transactions${qs ? `?${qs}` : ""}`);
  },

  // Admin
  getAdminOverview: () => request("/api/admin/overview"),
  getAdminUsers: () => request("/api/admin/users"),
  getAdminMerchants: () => request("/api/admin/merchants"),
  getAdminPayouts: () => request("/api/admin/payouts"),
  getAdminAuditLogs: (params = {}) => {
    const q = new URLSearchParams();
    if (params.event) q.set("event", params.event);
    if (params.user_id) q.set("user_id", params.user_id);
    if (params.limit) q.set("limit", params.limit);
    if (params.skip) q.set("skip", params.skip);
    const qs = q.toString();
    return request(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },
  getAdminComplianceFlags: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.limit) q.set("limit", params.limit);
    if (params.skip) q.set("skip", params.skip);
    const qs = q.toString();
    return request(`/api/admin/compliance-flags${qs ? `?${qs}` : ""}`);
  },
  resolveComplianceFlag: (index, body) => request(`/api/admin/compliance-flags/${index}/resolve`, { method: "POST", body: JSON.stringify(body) }),
  getAdminComplianceChecks: (params = {}) => {
    const q = new URLSearchParams();
    if (params.outcome) q.set("outcome", params.outcome);
    if (params.limit) q.set("limit", params.limit);
    const qs = q.toString();
    return request(`/api/admin/compliance-checks${qs ? `?${qs}` : ""}`);
  },

  // Profile
  getProfile: () => request("/api/user/profile"),
  updateProfile: (body) => request("/api/user/profile", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body) => request("/api/user/change-password", { method: "POST", body: JSON.stringify(body) }),

  // KYC
  getKycStatus: () => request("/api/kyc/status"),
  submitKyc: (body) => request("/api/kyc/submit", { method: "POST", body }),
  submitKycFormData: (formData) => {
    return fetch(`${API_URL}/api/kyc/submit`, {
      method: "POST",
      body: formData,
      credentials: "include",
    }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.message || "KYC Upload fehlgeschlagen");
      return d;
    });
  },

  // Sessions
  getSessions: () => request("/api/sessions"),
  revokeSession: (sessionId) => request(`/api/sessions/revoke/${sessionId}`, { method: "POST" }),
  revokeAllSessions: () => request("/api/sessions/revoke-all", { method: "POST" }),

  // Report Summaries
  getUserReportSummary: (params = {}) => request(`/api/export/report/user/summary${buildExportQuery(params)}`),
  getMerchantReportSummary: (params = {}) => request(`/api/export/report/merchant/summary${buildExportQuery(params)}`),
  getAdminReportSummary: (params = {}) => request(`/api/export/report/admin/summary${buildExportQuery(params)}`),

  // CSV Exports
  exportUserTransactions: (params = {}) => downloadCSV(`/api/export/user/transactions${buildExportQuery(params)}`, "transactions.csv"),
  exportUserTopups: (params = {}) => downloadCSV(`/api/export/user/topups${buildExportQuery(params)}`, "topups.csv"),
  exportUserPayments: (params = {}) => downloadCSV(`/api/export/user/payments${buildExportQuery(params)}`, "payments.csv"),
  exportMerchantPayments: (params = {}) => downloadCSV(`/api/export/merchant/payments${buildExportQuery(params)}`, "merchant_payments.csv"),
  exportMerchantFees: (params = {}) => downloadCSV(`/api/export/merchant/fees${buildExportQuery(params)}`, "merchant_fees.csv"),
  exportMerchantPayouts: (params = {}) => downloadCSV(`/api/export/merchant/payouts${buildExportQuery(params)}`, "merchant_payouts.csv"),
  exportMerchantSettlements: (params = {}) => downloadCSV(`/api/export/merchant/settlements${buildExportQuery(params)}`, "settlements.csv"),
  exportAdminTransactions: (params = {}) => downloadCSV(`/api/export/admin/transactions${buildExportQuery(params)}`, "admin_transactions.csv"),
  exportAdminPayouts: (params = {}) => downloadCSV(`/api/export/admin/payouts${buildExportQuery(params)}`, "admin_payouts.csv"),
  exportAdminMerchants: () => downloadCSV("/api/export/admin/merchants", "admin_merchants.csv"),
  exportAdminRevenue: (params = {}) => downloadCSV(`/api/export/admin/revenue${buildExportQuery(params)}`, "platform_revenue.csv"),
  exportAdminUsers: () => downloadCSV("/api/export/admin/users", "admin_users.csv"),

  // Referral
  getMyReferral: () => request("/api/referral/my-code"),
  applyReferral: (code) => request("/api/referral/apply", { method: "POST", body: JSON.stringify({ code }) }),
  checkReferralRewards: () => request("/api/referral/check-rewards"),
  getReferralLeaderboard: () => request("/api/referral/leaderboard"),

  // Notifications
  getNotifications: (unreadOnly = false) => request(`/api/notifications?unread_only=${unreadOnly}`),
  markAllNotificationsRead: () => request("/api/notifications/read-all", { method: "POST" }),
  sendAdminNotification: (body) => request("/api/notifications/admin/send", { method: "POST", body: JSON.stringify(body) }),

  // Promotions
  getActivePromotions: () => request("/api/promotions/active"),
  getAllPromotions: () => request("/api/promotions/admin/all"),
  createPromotion: (body) => request("/api/promotions/admin/create", { method: "POST", body: JSON.stringify(body) }),
  togglePromotion: (name) => request(`/api/promotions/admin/toggle/${name}`, { method: "PUT" }),

  // Growth Analytics
  getGrowthOverview: () => request("/api/analytics/growth/overview"),
  getConversionFunnel: () => request("/api/analytics/growth/funnel"),
  getRetentionMetrics: () => request("/api/analytics/growth/retention"),
  getCampaignPerformance: () => request("/api/analytics/growth/campaigns"),

  // Feature Flags
  getFeatureFlags: () => request("/api/feature-flags"),
  getAdminFeatureFlags: () => request("/api/admin/feature-flags"),
  updateFeatureFlag: (name, body) => request(`/api/admin/feature-flags/${name}`, { method: "PUT", body: JSON.stringify(body) }),

  // Kids Subscription
  getKidsSubscription: () => request("/api/kids/subscription"),
  createKidsCheckout: (body) => request("/api/kids/create-checkout", { method: "POST", body: JSON.stringify(body) }),
  startKidsTrial: () => request("/api/kids/start-trial", { method: "POST" }),
  verifyKidsCheckout: (sessionId) => request(`/api/kids/verify-checkout/${sessionId}`),
  listChildren: () => request("/api/kids/children"),
  createChild: (body) => request("/api/kids/children", { method: "POST", body: JSON.stringify(body) }),
  updateChild: (childId, body) => request(`/api/kids/children/${childId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteChild: (childId) => request(`/api/kids/children/${childId}`, { method: "DELETE" }),
  
  // Kids Wallet System
  transferToChild: (childId, body) => request(`/api/kids/children/${childId}/transfer`, { method: "POST", body: JSON.stringify(body) }),
  getChildWallet: (childId) => request(`/api/kids/children/${childId}/wallet`),
  setChildLimits: (childId, body) => request(`/api/kids/children/${childId}/limits`, { method: "POST", body: JSON.stringify(body) }),
  freezeChild: (childId) => request(`/api/kids/children/${childId}/freeze`, { method: "POST" }),
  childPayment: (body) => request("/api/kids/children/pay", { method: "POST", body: JSON.stringify(body) }),
  getChildActivity: (childId, days = 30) => request(`/api/kids/children/${childId}/activity?days=${days}`),
  getChildBarcode: (childId) => request(`/api/kids/children/${childId}/barcode`),

  // Support Tickets
  createSupportTicket: (body) => request("/api/support/tickets", { method: "POST", body: JSON.stringify(body) }),

  // Auctions
  getAuctions: () => request(`/api/auctions?_t=${Date.now()}`),
  getAuction: (auctionId) => request(`/api/auctions/${auctionId}?_t=${Date.now()}`),
  placeBid: (body) => request("/api/auctions/bid", { method: "POST", body: JSON.stringify(body) }),
  buyBidCredits: (body) => request("/api/auctions/buy-credits", { method: "POST", body: JSON.stringify(body) }),
  buyBidCreditsDirect: (body) => request("/api/auctions/buy-credits-direct", { method: "POST", body: JSON.stringify(body) }),
  buyBidCreditsStripe: (body) => request("/api/auctions/buy-credits-stripe", { method: "POST", body: JSON.stringify(body) }),
  confirmCreditPurchase: (pendingId) => request(`/api/auctions/buy-credits-confirm/${pendingId}`, { method: "POST" }),
  getAuctionSavedMethod: () => request("/api/auctions/saved-method"),
  getBidCredits: () => request("/api/auctions/credits/balance"),
  createAuction: (body) => request("/api/auctions/admin/create", { method: "POST", body: JSON.stringify(body) }),
  refreshAuctions: () => request("/api/auctions/admin/refresh", { method: "POST" }),
  getAuctionCatalog: () => request("/api/auctions/admin/catalog"),
  setAutoBid: (body) => request("/api/auctions/auto-bid", { method: "POST", body: JSON.stringify(body) }),
  cancelAutoBid: (auctionId) => request(`/api/auctions/auto-bid/${auctionId}`, { method: "DELETE" }),
  getAutoBid: (auctionId) => request(`/api/auctions/auto-bid/${auctionId}`),
  claimDailyReward: () => request("/api/auctions/daily-reward", { method: "POST" }),
  checkDailyReward: () => request("/api/auctions/daily-reward"),
  toggleWatchlist: async (auctionId) => {
    const r = await request(`/api/watchlist/toggle/${auctionId}`, { method: "POST" });
    return { ...r, watched: r.watching };
  },
  getWatchlist: async () => {
    const r = await request("/api/watchlist/ids");
    return { watchlist: r.ids || [] };
  },
  getWatchlistFull: () => request("/api/watchlist"),
  getBidStreak: () => request("/api/auctions/user/streak"),
  getAuctionNotifications: () => request("/api/auctions/user/notifications"),
  markAuctionNotificationsRead: () => request("/api/auctions/user/notifications/read", { method: "POST" }),
  getAuctionReferral: () => request("/api/auctions/user/referral"),
  applyAuctionReferral: (code) => request("/api/auctions/user/apply-referral", { method: "POST", body: JSON.stringify({ code }) }),
  checkFirstPurchase: () => request("/api/auctions/first-purchase-check"),
  getAuctionReferralLeaderboard: () => request("/api/auctions/referral-leaderboard"),
  // Stripe Connect
  createConnectAccount: (body) => request("/api/merchant-connect/create-account", { method: "POST", body: JSON.stringify(body) }),
  getConnectStatus: () => request("/api/merchant-connect/status"),
  getMerchantEarnings: () => request("/api/merchant-connect/earnings"),
  // Influencer
  getInfluencerProfile: () => request("/api/influencer/me"),
  getInfluencerReferrals: () => request("/api/influencer/me/referrals"),
  adminGetInfluencerConfig: () => request("/api/influencer/admin/config"),
  adminUpdateInfluencerConfig: (body) => request("/api/influencer/admin/config", { method: "POST", body: JSON.stringify(body) }),
  adminCreateInfluencer: (body) => request("/api/influencer/admin/create", { method: "POST", body: JSON.stringify(body) }),
  adminUpdateInfluencer: (body) => request("/api/influencer/admin/update", { method: "POST", body: JSON.stringify(body) }),
  adminListInfluencers: () => request("/api/influencer/admin/list"),
  adminAssignManager: (body) => request("/api/influencer/admin/assign-manager", { method: "POST", body: JSON.stringify(body) }),
  adminCreateCampaign: (body) => request("/api/influencer/admin/campaign", { method: "POST", body: JSON.stringify(body) }),
  // Investor
  submitInvestorContact: (body) => request("/api/investor/contact", { method: "POST", body: JSON.stringify(body) }),
  // Rewards
  getRewardStatus: () => request("/api/rewards/status"),
  claimRewardsDailyReward: () => request("/api/rewards/daily-claim", { method: "POST" }),
  getRewardsDashboardV3: () => request("/api/rewards/dashboard-v3"),
  getRewardHub: () => request("/api/rewards/hub"),
  getRewardsHistoryV3: (rewardType = "") => request(`/api/rewards/history${rewardType ? `?reward_type=${encodeURIComponent(rewardType)}` : ""}`),
  exportRewardsHistoryCSV: (rewardType = "") => downloadCSV(`/api/rewards/history/export.csv${rewardType ? `?reward_type=${encodeURIComponent(rewardType)}` : ""}`, "rewards_history.csv"),
  exportRewardsHistoryPDF: async (rewardType = "") => {
    const url = `${API_URL}/api/rewards/history/export.pdf${rewardType ? `?reward_type=${encodeURIComponent(rewardType)}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("PDF Export fehlgeschlagen");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "rewards_history.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  claimMilestone: (id) => request(`/api/rewards/milestone/${id}`, { method: "POST" }),
  getRewardNotifications: () => request("/api/rewards/notifications"),
  markRewardNotificationsRead: () => request("/api/rewards/notifications/read", { method: "POST" }),
  getMerchantRewardsV3: () => request("/api/rewards/merchant-rewards"),
  createMerchantRewardV3: (body) => request("/api/rewards/merchant-rewards", { method: "POST", body: JSON.stringify(body) }),
  getMysteryBoxes: () => request("/api/rewards/mystery-boxes"),
  openMysteryBox: (body) => request("/api/rewards/mystery-boxes/open", { method: "POST", body: JSON.stringify(body) }),
  getRewardSpinStatus: () => request("/api/rewards/spin-wheel/status"),
  spinRewardWheel: () => request("/api/rewards/spin-wheel/spin", { method: "POST" }),
  getRewardSpinHistory: (limit = 20) => request(`/api/rewards/spin-wheel/history?limit=${limit}`),
  getRewardSpinLeaderboard: (limit = 20) => request(`/api/rewards/spin-wheel/leaderboard?limit=${limit}`),
  getRewardPlinkoStatus: () => request("/api/rewards/plinko/status"),
  getRewardPlinkoHistory: (limit = 20) => request(`/api/rewards/plinko/history?limit=${limit}`),
  dropRewardPlinko: (body) => request("/api/rewards/plinko/drop", { method: "POST", body: JSON.stringify(body) }),
  getRewardCoupons: () => request("/api/rewards/coupons"),
  getRewardsAdminConfig: () => request("/api/rewards/admin/config"),
  updateRewardsAdminConfig: (body) => request("/api/rewards/admin/config", { method: "POST", body: JSON.stringify(body) }),
  updateRewardHubAdminConfig: (body) => request("/api/rewards/admin/reward-hub-config", { method: "POST", body: JSON.stringify(body) }),

  // Move & Earn
  getMoveStatus: () => request("/api/move/status"),
  syncMoveSteps: (body) => request("/api/move/sync-steps", { method: "POST", body: JSON.stringify(body) }),
  claimMoveReward: (body) => request("/api/move/claim-reward", { method: "POST", body: JSON.stringify(body) }),
  getMoveHistory: (limit = 50) => request(`/api/move/history?limit=${limit}`),
  getMoveLeaderboard: (limit = 20) => request(`/api/move/leaderboard?limit=${limit}`),
  getAdminMoveSettings: () => request("/api/admin/move/settings"),
  updateAdminMoveSettings: (body) => request("/api/admin/move/settings", { method: "PUT", body: JSON.stringify(body) }),
  getAdminMoveStats: () => request("/api/admin/move/stats"),
  setAdminMoveUserBlock: (userId, body) => request(`/api/admin/move/users/${userId}/block`, { method: "POST", body: JSON.stringify(body) }),
  // Role Requests
  requestRole: (body) => request("/api/role-requests/request", { method: "POST", body: JSON.stringify(body) }),
  getMyRoleStatus: () => request("/api/role-requests/my-status"),
  adminListRoleRequests: (status = "pending") => request(`/api/role-requests/admin/list?status=${status}`),
  adminDecideRole: (body) => request("/api/role-requests/admin/decide", { method: "POST", body: JSON.stringify(body) }),
  adminChangeRole: (body) => request("/api/role-requests/admin/change-role", { method: "POST", body: JSON.stringify(body) }),
  // Verification
  uploadVerification: (formData) => {
    const token = document.cookie.split(";").find(c => c.trim().startsWith("access_token="));
    return fetch(`${API_URL}/api/verification/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
      headers: token ? {} : {},
    }).then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.detail || "Upload failed"); }));
  },
  getVerificationStatus: () => request("/api/verification/my-status"),
  getVerificationFileUrl: (filename) => `${API_URL}/api/verification/file/${filename}`,
  adminListVerifications: (status = "pending") => request(`/api/verification/admin/list?status=${status}`),
  adminDecideVerification: (body) => request("/api/verification/admin/decide", { method: "POST", body: JSON.stringify(body) }),
  // Merchant Hierarchy
  adminCreateMerchant: (body) => request("/api/merchant-hierarchy/admin/create-merchant", { method: "POST", body: JSON.stringify(body) }),
  adminListMerchants: () => request("/api/merchant-hierarchy/admin/merchants"),
  adminSetCommission: (body) => request("/api/merchant-hierarchy/admin/set-commission", { method: "POST", body: JSON.stringify(body) }),
  getMerchantBranches: () => request("/api/merchant-hierarchy/branches"),
  createBranch: (body) => request("/api/merchant-hierarchy/branches", { method: "POST", body: JSON.stringify(body) }),
  getBranch: (id) => request(`/api/merchant-hierarchy/branches/${id}`),
  getMerchantRegisters: (branchId = "") => request(`/api/merchant-hierarchy/registers${branchId ? `?branch_id=${branchId}` : ""}`),
  createRegister: (body) => request("/api/merchant-hierarchy/registers", { method: "POST", body: JSON.stringify(body) }),
  toggleRegister: (deviceId) => request(`/api/merchant-hierarchy/registers/${deviceId}/toggle`, { method: "POST" }),
  regenerateApiKey: (deviceId) => request(`/api/merchant-hierarchy/registers/${deviceId}/regenerate-key`, { method: "POST" }),
  getMerchantStaff: (branchId = "") => request(`/api/merchant-hierarchy/staff${branchId ? `?branch_id=${branchId}` : ""}`),
  addStaff: (body) => request("/api/merchant-hierarchy/staff", { method: "POST", body: JSON.stringify(body) }),
  removeStaff: (userId) => request(`/api/merchant-hierarchy/staff/${userId}/remove`, { method: "POST" }),
  getMerchantRevenue: (branchId = "", deviceId = "") => {
    let q = [];
    if (branchId) q.push(`branch_id=${branchId}`);
    if (deviceId) q.push(`device_id=${deviceId}`);
    return request(`/api/merchant-hierarchy/revenue${q.length ? "?" + q.join("&") : ""}`);
  },
  getRegisterTransactions: (deviceId = "", branchId = "", period = "today") => {
    let q = [`period=${period}`];
    if (deviceId) q.push(`device_id=${deviceId}`);
    if (branchId) q.push(`branch_id=${branchId}`);
    return request(`/api/merchant-hierarchy/register-transactions?${q.join("&")}`);
  },
  getBranchSummary: () => request("/api/merchant-hierarchy/branch-summary"),
  getCommissionSummary: () => request("/api/merchant-hierarchy/commission-summary"),
  getApiKeys: (branchId = "") => request(`/api/merchant-hierarchy/api-keys${branchId ? `?branch_id=${branchId}` : ""}`),
  getMerchantHierarchyWalletBalance: () => request("/api/merchant-hierarchy/wallet-balance"),
  // POS Payments
  getPaymentsBarcode: () => request("/api/payments/my-barcode"),
  refreshBarcode: () => request("/api/payments/refresh-barcode", { method: "POST" }),
  barcodeLookup: (barcode) => request("/api/payments/barcode-lookup", { method: "POST", body: JSON.stringify({ barcode }) }),
  barcodePayment: (body) => request("/api/payments/barcode-pay", { method: "POST", body: JSON.stringify(body) }),
  nfcPayment: (body) => request("/api/payments/nfc-pay", { method: "POST", body: JSON.stringify(body) }),
  getFeeInfo: () => request("/api/payments/fee-info"),
  getTerminalSummary: () => request("/api/payments/terminal-summary"),
  getReceipt: (txnId) => request(`/api/payments/receipt/${txnId}`),
  getAdminFees: () => request("/api/payments/admin/fees"),
  setAdminFees: (fees) => request("/api/payments/admin/fees", { method: "POST", body: JSON.stringify({ fees }) }),
  requestMerchantTrial: (body) => request("/api/payments/onboarding/request-trial", { method: "POST", body: JSON.stringify(body) }),
  getPricing: () => request("/api/payments/pricing"),

  // Shifts & Reports
  openShift: (body) => request("/api/merchant-hierarchy/shifts", { method: "POST", body: JSON.stringify({ ...body, action: "open" }) }),
  closeShift: (body) => request("/api/merchant-hierarchy/shifts", { method: "POST", body: JSON.stringify({ ...body, action: "close" }) }),
  getShifts: () => request("/api/merchant-hierarchy/shifts"),
  getActiveShift: () => request("/api/merchant-hierarchy/shifts/active"),
  getDailyReport: (date) => request(`/api/merchant-hierarchy/reports/daily${date ? `?date=${date}` : ""}`),
  getMonthlyReport: (year, month) => request(`/api/merchant-hierarchy/reports/monthly?year=${year}&month=${month}`),
  processRefund: (body) => request("/api/merchant-hierarchy/refund", { method: "POST", body: JSON.stringify(body) }),
  getRefunds: () => request("/api/merchant-hierarchy/refunds"),
  getMyTickets: () => request("/api/support/tickets"),
  getAdminTickets: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.limit) q.set("limit", params.limit);
    const qs = q.toString();
    return request(`/api/support/admin/tickets${qs ? `?${qs}` : ""}`);
  },
  resolveTicket: (ticketId, body) => request(`/api/support/admin/tickets/${ticketId}/resolve`, { method: "POST", body: JSON.stringify(body) }),
  
  // Kids Notifications
  getKidsNotifications: (limit = 50, unreadOnly = false) => 
    request(`/api/kids/notifications?limit=${limit}&unread_only=${unreadOnly}`),
  markKidsNotificationRead: (notificationId) => 
    request(`/api/kids/notifications/${notificationId}/read`, { method: "POST" }),
  markAllKidsNotificationsRead: () => 
    request("/api/kids/notifications/read-all", { method: "POST" }),
  setChildPin: (childId, pin) => 
    request(`/api/kids/children/${childId}/set-pin`, { method: "POST", body: JSON.stringify({ pin }) }),
  
  // Kids Tasks
  getChildTasks: (childId) => request(`/api/kids/children/${childId}/tasks`),
  createChildTask: (childId, name, reward) => 
    request(`/api/kids/children/${childId}/tasks`, { method: "POST", body: JSON.stringify({ name, reward }) }),
  completeChildTask: (childId, taskId) => 
    request(`/api/kids/children/${childId}/tasks/${taskId}/complete`, { method: "POST" }),
  
  // BidBlitz Pay SDK (Merchant Keys Self-Service)
  getMyInvoices: () => request("/api/invoicing/my-invoices"),
  getMyPayKeys: () => request("/api/pay/my-keys"),
  createPayKey: (label) => request("/api/pay/my-keys/create", { method: "POST", body: JSON.stringify({ label }) }),
  revokePayKey: (keyId) => request(`/api/pay/my-keys/${keyId}/revoke`, { method: "POST" }),
  getMySessions: (limit = 50) => request(`/api/pay/my-sessions?limit=${limit}`),
  getCustomerPaymentPinStatus: () => request("/api/customer/payment-pin/status"),
  getBioPayMe: () => request("/api/biopay/me"),
  enrollBioPay: (body) => request("/api/biopay/enroll", { method: "POST", body: JSON.stringify(body) }),
  verifyBioPaySelf: (body) => request("/api/biopay/verify-self", { method: "POST", body: JSON.stringify(body) }),
  revokeBioPayProfile: (profileId) => request(`/api/biopay/profile/${profileId}`, { method: "DELETE" }),
  createBioPayTerminal: (body) => request("/api/biopay/terminals", { method: "POST", body: JSON.stringify(body) }),
  updateBioPayTerminal: (terminalId, body) => request(`/api/biopay/terminals/${terminalId}`, { method: "POST", body: JSON.stringify(body) }),
  getBioPayTerminals: (storeId, registerId = "") => request(`/api/biopay/terminals?store_id=${encodeURIComponent(storeId)}${registerId ? `&register_id=${encodeURIComponent(registerId)}` : ""}`),
  getBioPayDashboard: (storeId) => request(`/api/biopay/dashboard?store_id=${encodeURIComponent(storeId)}`),
  getBioPaySessions: (storeId, limit = 20) => request(`/api/biopay/sessions?store_id=${encodeURIComponent(storeId)}&limit=${limit}`),
  biopayPay: (body) => request("/api/biopay/pay", { method: "POST", body: JSON.stringify(body) }),
  biotimeClock: (body) => request("/api/biopay/staff/clock", { method: "POST", body: JSON.stringify(body) }),
  getStaffBioTimeStatus: () => request("/api/biopay/staff/biotime/status"),
  enrollStaffBioTime: (body) => request("/api/biopay/staff/biotime/enroll", { method: "POST", body: JSON.stringify(body) }),
  clockStaffBioTime: (body) => request("/api/biopay/staff/biotime/clock", { method: "POST", body: JSON.stringify(body) }),
  getBioPayDiagnostics: (storeId) => request(`/api/biopay/diagnostics?store_id=${encodeURIComponent(storeId)}`),
  writeBioPayDiagnostic: (body) => request("/api/biopay/diagnostics", { method: "POST", body: JSON.stringify(body) }),
  getBioPayFraudSummary: (storeId) => request(`/api/biopay/fraud-summary?store_id=${encodeURIComponent(storeId)}`),
  getFacePayReadiness: (storeId, terminalId = "") => request(`/api/biopay/facepay-readiness?store_id=${encodeURIComponent(storeId)}${terminalId ? `&terminal_id=${encodeURIComponent(terminalId)}` : ""}`),
  getAdminBioPayOverview: () => request("/api/admin/biopay/overview"),
  getAdminBioPayAuditCenter: (limit = 100) => request(`/api/admin/biopay/audit-center?limit=${limit}`),
  getAdminBioPayTerminalDiagnostics: () => request("/api/admin/biopay/terminal-diagnostics"),
  requestGiftCardApproval: (body) => request("/api/pos/security/gift-cards/request", { method: "POST", body: JSON.stringify(body) }),
  requestManualWalletAdjustment: (body) => request("/api/pos/security/manual-wallet-adjustment/request", { method: "POST", body: JSON.stringify(body) }),
  requestCustomerAccountChange: (body) => request("/api/pos/security/customer-account-change/request", { method: "POST", body: JSON.stringify(body) }),
  
  // BidBlitz Pay - Merchant Applications (Public)
  applyForPay: (data) => request("/api/pay/merchant/apply", { method: "POST", body: JSON.stringify(data) }),
  
  // BidBlitz Pay - Admin (Approve/Reject Requests)
  getPayApplications: (status = "pending") => request(`/api/pay/admin/applications?status=${status}`),
  decidePayApplication: (application_id, decision, reason = "") => 
    request("/api/pay/admin/applications/decide", { 
      method: "POST", 
      body: JSON.stringify({ application_id, decision, reason }) 
    }),
};
