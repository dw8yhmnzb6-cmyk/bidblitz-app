/**
 * taxiApi.js — Centralized fetch helpers for Taxi page.
 * All functions throw on network errors. HTTP errors return { ok: false, error }.
 * Caller controls UI state (loading, error toasts, etc).
 */
const API = process.env.REACT_APP_BACKEND_URL;
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const credJson = { credentials: "include", headers: { "Content-Type": "application/json" } };
const cred = { credentials: "include" };

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

// ── User / Module ──────────────────────────────────────────────────────────
export async function fetchMe() {
  const res = await fetch(`${API}/api/auth/me`, cred);
  return res.ok ? readJson(res) : null;
}

export async function fetchTaxiStatus() {
  const res = await fetch(`${API}/api/taxi/status`, cred);
  return res.ok ? readJson(res) : null;
}

export async function fetchModeSettings() {
  const res = await fetch(`${API}/api/admin/taxi/public/mode-settings`);
  return res.ok ? readJson(res) : null;
}

// ── Favorites ──────────────────────────────────────────────────────────────
export async function fetchFavorites() {
  const res = await fetch(`${API}/api/user/favorite-locations`, cred);
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.favorites || [];
}

export async function saveFavoriteApi({ name, address, latitude, longitude, icon }) {
  const res = await fetch(`${API}/api/user/favorite-locations`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify({ name, address, latitude, longitude, icon }),
  });
  if (res.ok) return { ok: true };
  const data = await readJson(res);
  return { ok: false, error: data?.detail || "Fehler beim Speichern" };
}

export async function deleteFavoriteApi(favoriteId) {
  const res = await fetch(`${API}/api/user/favorite-locations/${favoriteId}`, {
    ...cred,
    method: "DELETE",
  });
  return res.ok;
}

export async function markFavoriteUsed(favoriteId) {
  try {
    await fetch(`${API}/api/user/favorite-locations/${favoriteId}/use`, {
      ...cred,
      method: "POST",
    });
  } catch {}
}

// ── Saved Places ───────────────────────────────────────────────────────────
export async function fetchSavedPlaces() {
  const res = await fetch(`${API}/api/taxi/saved-places`, cred);
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.places || [];
}

// ── Recent Addresses (auto-tracked on booking) ─────────────────────────────
export async function fetchRecentAddresses(limit = 10) {
  const res = await fetch(`${API}/api/taxi/recent-addresses?limit=${limit}`, cred);
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.addresses || [];
}

export async function clearRecentAddresses() {
  const res = await fetch(`${API}/api/taxi/recent-addresses`, { ...cred, method: "DELETE" });
  return res.ok;
}

// ── City Defaults ──────────────────────────────────────────────────────────
export async function fetchCityDefault(city) {
  if (!city) return null;
  const res = await fetch(`${API}/api/taxi/city-defaults/${encodeURIComponent(city)}`, cred);
  if (!res.ok) return null;
  const data = await readJson(res);
  return data?.default || null;
}

export async function saveCityDefault(city, options) {
  const res = await fetch(`${API}/api/taxi/city-defaults`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify({ city, options }),
  });
  return res.ok;
}

export async function savePlaceApi({ name, icon, address, lat, lng }) {
  const res = await fetch(`${API}/api/taxi/saved-places`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify({ name, icon, address, lat, lng }),
  });
  return res.ok;
}

export async function deletePlaceApi(placeId) {
  const res = await fetch(`${API}/api/taxi/saved-places/${placeId}`, {
    ...cred,
    method: "DELETE",
  });
  return res.ok;
}

// ── Rides ──────────────────────────────────────────────────────────────────
export async function fetchActiveRide() {
  const res = await fetch(`${API}/api/taxi/rides/active`, cred);
  return res.ok ? readJson(res) : null;
}

export async function fetchRide(rideId) {
  const res = await fetch(`${API}/api/taxi/ride/${rideId}`, cred);
  return res.ok ? readJson(res) : null;
}

export async function fetchRideHistory() {
  const res = await fetch(`${API}/api/taxi/rides/history`, cred);
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.rides || [];
}

export async function estimateRide({ pickup, dropoff }) {
  const res = await fetch(`${API}/api/taxi/estimate`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify({ pickup, dropoff }),
  });
  const data = await readJson(res);
  return res.ok
    ? { ok: true, estimates: data?.estimates || [], surge: data?.surge || { active: false, multiplier: 1.0 } }
    : { ok: false, error: data?.detail || "Fehler beim Laden der Preise" };
}

export async function bookRideApi({
  pickup, dropoff, vehicleType, paymentMethod = "wallet", options = {}, stops = [],
}) {
  const body = {
    pickup_address: pickup.address || "",
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    pickup_notes: pickup.notes || "",
    dropoff_address: dropoff.address || "",
    dropoff_lat: dropoff.lat,
    dropoff_lng: dropoff.lng,
    dropoff_notes: dropoff.notes || "",
    vehicle_type: vehicleType,
    payment_method: paymentMethod,
    stops: stops.filter((s) => s.address && s.lat).map((s) => ({
      address: s.address, lat: s.lat, lng: s.lng, notes: s.notes || "",
    })),
    language: options.language || "de",
    with_pet: !!options.withPet,
    luggage: options.luggage || "none",
    assistance: !!options.assistance,
    notes: options.notes || "",
    scheduled_at: options.scheduledAt || null,
  };
  const res = await fetch(`${API}/api/taxi/book`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ride: data?.ride } : { ok: false, error: data?.detail || "Buchung fehlgeschlagen" };
}

export async function cancelRideApi(rideId) {
  const res = await fetch(`${API}/api/taxi/cancel`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify({ ride_id: rideId }),
  });
  const data = await readJson(res);
  return res.ok ? { ok: true } : { ok: false, error: data?.detail || "Stornierung fehlgeschlagen" };
}

export async function setDriverStatus(rideId, status) {
  try {
    await fetch(`${API}/api/taxi/driver/status`, {
      ...credJson,
      method: "POST",
      body: JSON.stringify({ ride_id: rideId, status }),
    });
  } catch {}
}

// ── Geocoding (Mapbox) ─────────────────────────────────────────────────────
export async function forwardGeocode(query) {
  if (!MAPBOX_TOKEN) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query,
  )}.json?access_token=${MAPBOX_TOKEN}&country=de,at,ch&language=de&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await readJson(res);
  const f = data?.features?.[0];
  if (!f?.center) return null;
  return { lat: f.center[1], lng: f.center[0], address: f.place_name || query };
}

export async function reverseGeocode(lat, lng, signal) {
  if (!MAPBOX_TOKEN) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=de&limit=1`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await readJson(res);
    const f = data?.features?.[0];
    return f?.place_name || null;
  } catch {
    return null;
  }
}
