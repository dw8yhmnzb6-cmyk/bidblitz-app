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
  return res.ok;
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