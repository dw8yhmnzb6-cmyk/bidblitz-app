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
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

async function request(path, options = {}) {
  // Block if offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ApiError("You are offline. Please check your connection.", { code: "offline", retryable: true });
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
    const res = await fetch(url, config);
    clearTimeout(timeout);

    let data;
    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      if (!res.ok) {
        if (res.status === 401) throw new ApiError("Invalid email or password", { status: 401, code: "auth" });
        if (res.status === 400) throw new ApiError("Bad request. Please check your input.", { status: 400, code: "validation" });
        if (res.status === 404) throw new ApiError("Resource not found", { status: 404, code: "not_found" });
        if (res.status === 429) throw new ApiError("Too many requests. Please try again later.", { status: 429, code: "rate_limit", retryable: true });
        if (res.status === 403) throw new ApiError("Access denied", { status: 403, code: "forbidden" });
        if (res.status >= 500) throw new ApiError("Server error. Please try again later.", { status: res.status, code: "server", retryable: true });
        throw new ApiError(`Request failed (${res.status})`, { status: res.status, code: "unknown", retryable: true });
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
      throw new ApiError("Request timed out. Please try again.", { code: "timeout", retryable: true });
    }
    if (error.name === "TypeError" && error.message === "Failed to fetch") {
      throw new ApiError("Cannot reach server. Please check your connection.", { code: "network", retryable: true });
    }
    throw new ApiError(error.message || "Request failed.", { code: "unknown", retryable: true });
  }
}

// ── CSV Export Download Helper ──
async function downloadCSV(path, filename) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Not authenticated");
    if (res.status === 403) throw new Error("Access denied");
    throw new Error("Export failed");
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
  logout: () => request("/api/auth/logout", { method: "POST" }),
  getMe: () => request("/api/auth/me"),
  refresh: () => request("/api/auth/refresh", { method: "POST" }),

  // Wallet
  getWallet: () => request("/api/wallet"),
  topUp: (body) => request("/api/wallet/topup", { method: "POST", body: JSON.stringify(body) }),

  // Saved Payment Method & 1-Click
  getSavedMethod: () => request("/api/stripe/saved-method"),
  quickTopUp: (body) => request("/api/stripe/quick-topup", { method: "POST", body: JSON.stringify(body) }),
  removeSavedMethod: () => request("/api/stripe/saved-method", { method: "DELETE" }),

  // Payment
  pay: (body) => request("/api/payment/pay", { method: "POST", body: JSON.stringify(body) }),
  send: (body) => request("/api/payment/send", { method: "POST", body: JSON.stringify(body) }),
  getMyBarcode: () => request("/api/payment/my-barcode"),
  merchantScanPayment: (body) => request("/api/payment/merchant-scan", { method: "POST", body: JSON.stringify(body) }),

  // Merchant
  getMerchantDashboard: () => request("/api/merchant/dashboard"),

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
  getKycStatus: () => request("/api/user/kyc"),
  submitKyc: (body) => request("/api/user/kyc", { method: "POST", body: JSON.stringify(body) }),

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

  // Support Tickets
  createSupportTicket: (body) => request("/api/support/tickets", { method: "POST", body: JSON.stringify(body) }),

  // Auctions
  getAuctions: () => request("/api/auctions"),
  getAuction: (auctionId) => request(`/api/auctions/${auctionId}`),
  placeBid: (body) => request("/api/auctions/bid", { method: "POST", body: JSON.stringify(body) }),
  buyBidCredits: (body) => request("/api/auctions/buy-credits", { method: "POST", body: JSON.stringify(body) }),
  getBidCredits: () => request("/api/auctions/credits/balance"),
  createAuction: (body) => request("/api/auctions/admin/create", { method: "POST", body: JSON.stringify(body) }),
  refreshAuctions: () => request("/api/auctions/admin/refresh", { method: "POST" }),
  getAuctionCatalog: () => request("/api/auctions/admin/catalog"),
  setAutoBid: (body) => request("/api/auctions/auto-bid", { method: "POST", body: JSON.stringify(body) }),
  cancelAutoBid: (auctionId) => request(`/api/auctions/auto-bid/${auctionId}`, { method: "DELETE" }),
  getAutoBid: (auctionId) => request(`/api/auctions/auto-bid/${auctionId}`),
  claimDailyReward: () => request("/api/auctions/daily-reward", { method: "POST" }),
  checkDailyReward: () => request("/api/auctions/daily-reward"),
  toggleWatchlist: (auctionId) => request(`/api/auctions/${auctionId}/watchlist`, { method: "POST" }),
  getWatchlist: () => request("/api/auctions/user/watchlist"),
  getBidStreak: () => request("/api/auctions/user/streak"),
  getAuctionNotifications: () => request("/api/auctions/user/notifications"),
  markAuctionNotificationsRead: () => request("/api/auctions/user/notifications/read", { method: "POST" }),
  getAuctionReferral: () => request("/api/auctions/user/referral"),
  applyAuctionReferral: (code) => request("/api/auctions/user/apply-referral", { method: "POST", body: JSON.stringify({ code }) }),
  getMyTickets: () => request("/api/support/tickets"),
  getAdminTickets: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.limit) q.set("limit", params.limit);
    const qs = q.toString();
    return request(`/api/support/admin/tickets${qs ? `?${qs}` : ""}`);
  },
  resolveTicket: (ticketId, body) => request(`/api/support/admin/tickets/${ticketId}/resolve`, { method: "POST", body: JSON.stringify(body) }),
};
