const API_URL = process.env.REACT_APP_BACKEND_URL;

function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const config = {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    let data;

    try {
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      if (parseError.message && parseError.message.includes("body")) {
        if (!res.ok) {
          if (res.status === 401) throw new Error("Invalid email or password");
          if (res.status === 400) throw new Error("Bad request. Please check your input.");
          if (res.status === 404) throw new Error("Resource not found");
          if (res.status === 429) throw new Error("Too many requests. Please try again later.");
          if (res.status === 403) throw new Error("Access denied");
          if (res.status >= 500) throw new Error("Server error. Please try again later.");
          throw new Error(`Request failed with status ${res.status}`);
        }
        return {};
      }
      throw parseError;
    }

    if (!res.ok) {
      throw new Error(formatApiError(data.detail));
    }
    return data;
  } catch (error) {
    if (error.name === "TypeError" && error.message === "Failed to fetch") {
      throw new Error("Network error. Please check your connection.");
    }
    if (error.message && error.message.includes("body")) {
      throw new Error("Request failed. Please try again.");
    }
    throw error;
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

  // Payment
  pay: (body) => request("/api/payment/pay", { method: "POST", body: JSON.stringify(body) }),
  send: (body) => request("/api/payment/send", { method: "POST", body: JSON.stringify(body) }),

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

  // Profile
  getProfile: () => request("/api/user/profile"),
  updateProfile: (body) => request("/api/user/profile", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body) => request("/api/user/change-password", { method: "POST", body: JSON.stringify(body) }),

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
};
