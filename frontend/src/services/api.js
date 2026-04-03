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
      // Try to get response as text first, then parse
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      // If parsing fails, check if it's a body-already-read error
      if (parseError.message && parseError.message.includes("body")) {
        // The response was consumed by something else (e.g., emergent script)
        // Fall back to status-based error handling
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("Invalid email or password");
          } else if (res.status === 400) {
            throw new Error("Bad request. Please check your input.");
          } else if (res.status === 404) {
            throw new Error("Resource not found");
          } else if (res.status === 429) {
            throw new Error("Too many requests. Please try again later.");
          } else {
            throw new Error(`Request failed with status ${res.status}`);
          }
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
    // Handle network errors and body-already-read errors
    if (error.message && error.message.includes("body")) {
      throw new Error("Request failed. Please try again.");
    }
    throw error;
  }
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
