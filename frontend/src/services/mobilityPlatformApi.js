const API = process.env.REACT_APP_BACKEND_URL;

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

export async function mobilitySearch(query, { lat, lng, lang = "de" } = {}) {
  if (!query || query.trim().length < 2) return [];
  const qs = new URLSearchParams({ q: query.trim(), limit: "8", lang });
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    qs.set("lat", String(lat));
    qs.set("lng", String(lng));
  }
  const res = await fetch(`${API}/api/mobility-platform/search?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.results || [];
}

export async function mobilityReverse(lat, lng, lang = "de") {
  const qs = new URLSearchParams({ lat: String(lat), lng: String(lng), lang });
  const res = await fetch(`${API}/api/mobility-platform/reverse?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) return null;
  return await readJson(res);
}

export async function mobilityRoute(payload) {
  const res = await fetch(`${API}/api/mobility-platform/route`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Routing fehlgeschlagen" };
}

export async function getMobilityAiRecommendation(payload) {
  const res = await fetch(`${API}/api/mobility-platform/ai-recommendation`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { available: false, headline: "AI nicht erreichbar", summary: "Regelwerk bleibt aktiv." };
  return await readJson(res);
}

export async function createMobilityBooking(payload) {
  const res = await fetch(`${API}/api/mobility-platform/book`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Buchung fehlgeschlagen" };
}

export async function getMyMobilityBookings() {
  const res = await fetch(`${API}/api/mobility-platform/my-bookings`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.bookings || [];
}

export async function getMobilityPreferences() {
  const res = await fetch(`${API}/api/mobility-platform/preferences`, { credentials: "include" });
  if (!res.ok) return { priority: "balance", luggage: false, childSeat: false };
  const data = await readJson(res);
  return data?.preferences || { priority: "balance", luggage: false, childSeat: false };
}

export async function saveMobilityPreferences(payload) {
  const res = await fetch(`${API}/api/mobility-platform/preferences`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await readJson(res);
}

export async function createMobilityCheckoutSession(payload) {
  const res = await fetch(`${API}/api/mobility-platform/checkout/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Checkout fehlgeschlagen" };
}

export async function getMobilityCheckoutStatus(sessionId) {
  const res = await fetch(`${API}/api/mobility-platform/checkout/status/${sessionId}`, { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Checkout-Status fehlgeschlagen" };
}

export async function getMobilityBookingDetail(bookingId) {
  const res = await fetch(`${API}/api/mobility-platform/booking/${bookingId}`, { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Buchung nicht gefunden" };
}

export async function cancelMobilityBooking(bookingId) {
  const res = await fetch(`${API}/api/mobility-platform/booking/${bookingId}/cancel`, {
    method: "POST",
    credentials: "include",
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Storno fehlgeschlagen" };
}

export async function getMobilityNearby({ lat, lng, radius = 5 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { center: null, counts: {}, markers: [], available_modes: [] };
  }
  const qs = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) });
  const res = await fetch(`${API}/api/mobility-platform/nearby?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) return { center: null, counts: {}, markers: [], available_modes: [] };
  return await readJson(res);
}

export async function getSavedMobilityLocations() {
  const res = await fetch(`${API}/api/mobility-platform/saved-locations`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.locations || [];
}

export async function saveMobilityLocation(payload) {
  const res = await fetch(`${API}/api/mobility-platform/saved-locations`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Favorit konnte nicht gespeichert werden" };
}

export async function deleteSavedMobilityLocation(favoriteId) {
  const res = await fetch(`${API}/api/mobility-platform/saved-locations/${favoriteId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Favorit konnte nicht gelöscht werden" };
}

export async function getRecentMobilityLocations() {
  const res = await fetch(`${API}/api/mobility-platform/recent-locations`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.locations || [];
}

export async function addRecentMobilityLocation(payload) {
  await fetch(`${API}/api/mobility-platform/recent-locations`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getMobilityPaymentOptions() {
  const res = await fetch(`${API}/api/mobility-platform/payment-options`, { credentials: "include" });
  if (!res.ok) return { wallet_balance: 0, methods: [] };
  return await readJson(res);
}