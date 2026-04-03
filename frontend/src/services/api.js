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
  const res = await fetch(url, config);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(formatApiError(data.detail));
  }
  return data;
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
};
