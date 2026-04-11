/**
 * BidBlitz V2 - Car Rental API
 * API client for car rental module
 */

const API_URL = process.env.REACT_APP_BACKEND_URL;

async function api(path, options = {}) {
  const url = `${API_URL}${path}`;
  const config = {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  };

  const res = await fetch(url, config);
  const data = await res.json();
  
  if (!res.ok) {
    const error = new Error(data.detail || "Request failed");
    error.status = res.status;
    throw error;
  }
  
  return data;
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

export const searchCars = async (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, value);
    }
  });
  return api(`/api/car-rental/cars/search?${queryParams}`);
};

export const getCarDetail = async (carId) => {
  return api(`/api/car-rental/cars/${carId}`);
};

export const calculateCarPrice = async (carId, startDate, endDate, extras = []) => {
  const extrasParam = extras.length > 0 ? `&extras=${extras.join(",")}` : "";
  return api(`/api/car-rental/cars/${carId}/price?start_date=${startDate}&end_date=${endDate}${extrasParam}`);
};

export const checkCarAvailability = async (carId, startDate, endDate) => {
  return api(`/api/car-rental/cars/${carId}/availability?start_date=${startDate}&end_date=${endDate}`);
};

// ══════════════════════════════════════════════════════════════════════════════
// CUSTOMER ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

export const createBooking = async (data) => {
  return api("/api/car-rental/bookings", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const payBooking = async (bookingId) => {
  return api(`/api/car-rental/bookings/${bookingId}/pay`, {
    method: "POST",
  });
};

export const getMyBookings = async (limit = 50) => {
  return api(`/api/car-rental/my-bookings?limit=${limit}`);
};

export const getMyBookingDetail = async (bookingId) => {
  return api(`/api/car-rental/my-bookings/${bookingId}`);
};

export const cancelMyBooking = async (bookingId) => {
  return api(`/api/car-rental/my-bookings/${bookingId}/cancel`, {
    method: "POST",
  });
};

export const signMyContract = async (bookingId, signature) => {
  return api(`/api/car-rental/my-bookings/${bookingId}/sign-contract`, {
    method: "POST",
    body: JSON.stringify({ signature }),
  });
};

export const getMyInvoices = async (limit = 50) => {
  return api(`/api/car-rental/my-invoices?limit=${limit}`);
};

export const uploadMyDocument = async (docType, fileUrl, expiresAt = null) => {
  return api("/api/car-rental/my-documents", {
    method: "POST",
    body: JSON.stringify({ doc_type: docType, file_url: fileUrl, expires_at: expiresAt }),
  });
};

export const getMyDocuments = async () => {
  return api("/api/car-rental/my-documents");
};

// ══════════════════════════════════════════════════════════════════════════════
// VENDOR ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

export const registerVendor = async (data) => {
  return api("/api/car-rental/vendor/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getVendorProfile = async () => {
  return api("/api/car-rental/vendor/profile");
};

export const updateVendorProfile = async (data) => {
  return api("/api/car-rental/vendor/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const updateVendorSettings = async (data) => {
  return api("/api/car-rental/vendor/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const getVendorDashboard = async () => {
  return api("/api/car-rental/vendor/dashboard");
};

// Cars
export const createCar = async (data) => {
  return api("/api/car-rental/vendor/cars", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getVendorCars = async (status = null, limit = 100) => {
  const params = new URLSearchParams({ limit });
  if (status) params.append("status", status);
  return api(`/api/car-rental/vendor/cars?${params}`);
};

export const getVendorCar = async (carId) => {
  return api(`/api/car-rental/vendor/cars/${carId}`);
};

export const updateCar = async (carId, data) => {
  return api(`/api/car-rental/vendor/cars/${carId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const archiveCar = async (carId) => {
  return api(`/api/car-rental/vendor/cars/${carId}`, {
    method: "DELETE",
  });
};

export const addCarImage = async (carId, imageUrl, isMain = false) => {
  return api(`/api/car-rental/vendor/cars/${carId}/images`, {
    method: "POST",
    body: JSON.stringify({ image_url: imageUrl, is_main: isMain }),
  });
};

export const addCarExtra = async (carId, data) => {
  return api(`/api/car-rental/vendor/cars/${carId}/extras`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const removeCarExtra = async (carId, extraId) => {
  return api(`/api/car-rental/vendor/cars/${carId}/extras/${extraId}`, {
    method: "DELETE",
  });
};

// Bookings
export const getVendorBookings = async (status = null, limit = 50, skip = 0) => {
  const params = new URLSearchParams({ limit, skip });
  if (status) params.append("status", status);
  return api(`/api/car-rental/vendor/bookings?${params}`);
};

export const getVendorBooking = async (bookingId) => {
  return api(`/api/car-rental/vendor/bookings/${bookingId}`);
};

export const approveBooking = async (bookingId) => {
  return api(`/api/car-rental/vendor/bookings/${bookingId}/approve`, {
    method: "POST",
  });
};

export const rejectBooking = async (bookingId, reason = null) => {
  return api(`/api/car-rental/vendor/bookings/${bookingId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

export const markReadyForHandover = async (bookingId) => {
  return api(`/api/car-rental/vendor/bookings/${bookingId}/ready`, {
    method: "POST",
  });
};

export const completeHandover = async (bookingId, data) => {
  return api(`/api/car-rental/vendor/bookings/${bookingId}/handover`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const completeReturn = async (bookingId, data) => {
  return api(`/api/car-rental/vendor/bookings/${bookingId}/return`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const vendorCancelBooking = async (bookingId) => {
  return api(`/api/car-rental/vendor/bookings/${bookingId}/cancel`, {
    method: "POST",
  });
};

export const addExtraCharge = async (bookingId, data) => {
  return api(`/api/car-rental/vendor/bookings/${bookingId}/charge`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// Invoices
export const getVendorInvoices = async (status = null, limit = 50) => {
  const params = new URLSearchParams({ limit });
  if (status) params.append("status", status);
  return api(`/api/car-rental/vendor/invoices?${params}`);
};

export const generateInvoice = async (data) => {
  return api("/api/car-rental/vendor/invoices/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getVendorInvoice = async (invoiceId) => {
  return api(`/api/car-rental/vendor/invoices/${invoiceId}`);
};

export const markInvoicePaid = async (invoiceId, paidAmount = null) => {
  return api(`/api/car-rental/vendor/invoices/${invoiceId}/paid`, {
    method: "POST",
    body: JSON.stringify({ paid_amount: paidAmount }),
  });
};

// Contracts
export const getVendorContracts = async (limit = 50) => {
  return api(`/api/car-rental/vendor/contracts?limit=${limit}`);
};

export const generateContract = async (bookingId, templateId = null) => {
  return api("/api/car-rental/vendor/contracts/generate", {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId, template_id: templateId }),
  });
};

export const getVendorContract = async (contractId) => {
  return api(`/api/car-rental/vendor/contracts/${contractId}`);
};

export const signContractVendor = async (contractId, signature) => {
  return api(`/api/car-rental/vendor/contracts/${contractId}/sign`, {
    method: "POST",
    body: JSON.stringify({ signature }),
  });
};

export const getContractTemplates = async () => {
  return api("/api/car-rental/vendor/contract-templates");
};

export const createContractTemplate = async (data) => {
  return api("/api/car-rental/vendor/contract-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// Damages
export const getVendorDamages = async (resolved = null) => {
  const params = resolved !== null ? `?resolved=${resolved}` : "";
  return api(`/api/car-rental/vendor/damages${params}`);
};

export const createDamageReport = async (data) => {
  return api("/api/car-rental/vendor/damages", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateDamageReport = async (damageId, data) => {
  return api(`/api/car-rental/vendor/damages/${damageId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

// Staff
export const getVendorStaff = async () => {
  return api("/api/car-rental/vendor/staff");
};

export const addVendorStaff = async (data) => {
  return api("/api/car-rental/vendor/staff", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateVendorStaff = async (userId, data) => {
  return api(`/api/car-rental/vendor/staff/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const removeVendorStaff = async (userId) => {
  return api(`/api/car-rental/vendor/staff/${userId}`, {
    method: "DELETE",
  });
};

// Payouts
export const getVendorPayouts = async (status = null) => {
  const params = status ? `?status=${status}` : "";
  return api(`/api/car-rental/vendor/payouts${params}`);
};

export const requestPayout = async (amount) => {
  return api("/api/car-rental/vendor/payouts/request", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
};

// Customers
export const getVendorCustomers = async (limit = 50) => {
  return api(`/api/car-rental/vendor/customers?limit=${limit}`);
};

export const getVendorCustomer = async (customerId) => {
  return api(`/api/car-rental/vendor/customers/${customerId}`);
};

// Reports
export const getVendorReportSummary = async (days = 30) => {
  return api(`/api/car-rental/vendor/reports/summary?days=${days}`);
};

export const getVendorActivityLog = async (limit = 100) => {
  return api(`/api/car-rental/vendor/activity-log?limit=${limit}`);
};

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

export const getAdminOverview = async () => {
  return api("/api/car-rental/admin/overview");
};

export const getAdminVendors = async (status = null, limit = 50, skip = 0) => {
  const params = new URLSearchParams({ limit, skip });
  if (status) params.append("status", status);
  return api(`/api/car-rental/admin/vendors?${params}`);
};

export const adminVendorAction = async (vendorId, action, reason = null) => {
  return api(`/api/car-rental/admin/vendors/${vendorId}/action`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
};

export const adminSetVendorCommission = async (vendorId, commissionPercent) => {
  return api(`/api/car-rental/admin/vendors/${vendorId}/commission`, {
    method: "PUT",
    body: JSON.stringify({ commission_percent: commissionPercent }),
  });
};

export const getAdminBookings = async (status = null, vendorId = null, limit = 50) => {
  const params = new URLSearchParams({ limit });
  if (status) params.append("status", status);
  if (vendorId) params.append("vendor_id", vendorId);
  return api(`/api/car-rental/admin/bookings?${params}`);
};

export const getAdminPayouts = async (status = null, limit = 50) => {
  const params = new URLSearchParams({ limit });
  if (status) params.append("status", status);
  return api(`/api/car-rental/admin/payouts?${params}`);
};

export const adminProcessPayout = async (payoutId, status, transactionRef = null) => {
  return api(`/api/car-rental/admin/payouts/${payoutId}/process`, {
    method: "POST",
    body: JSON.stringify({ status, transaction_ref: transactionRef }),
  });
};

export const getAdminSettings = async () => {
  return api("/api/car-rental/admin/settings");
};

export const updateAdminSettings = async (data) => {
  return api("/api/car-rental/admin/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
};
