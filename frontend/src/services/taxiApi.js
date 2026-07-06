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

async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    return null;
  }
}

// ── Driver availability (taxi.eu live count) ─────────────────────────────
export async function fetchNearbyDriversCount({
  lat, lng, radius = 10, carType, withPet, luggage, assistance,
}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { count: 0, drivers: [] };
  const qs = new URLSearchParams({
    lat: String(lat), lng: String(lng), radius: String(radius),
  });
  if (carType) qs.set("car_type", carType);
  if (withPet) qs.set("with_pet", "true");
  if (luggage && luggage !== "none") qs.set("luggage", luggage);
  if (assistance) qs.set("assistance", "true");
  const res = await safeFetch(`${API}/api/taxi/drivers/nearby?${qs.toString()}`);
  if (!res) return { count: 0, drivers: [] };
  if (!res.ok) return { count: 0, drivers: [] };
  const data = await readJson(res);
  return { count: data?.total || 0, drivers: data?.drivers || [] };
}

// ── User / Module ──────────────────────────────────────────────────────────
export async function fetchMe() {
  const res = await safeFetch(`${API}/api/auth/me`, cred);
  if (!res) return null;
  return res.ok ? readJson(res) : null;
}

export async function fetchTaxiStatus() {
  const res = await safeFetch(`${API}/api/taxi/status`, cred);
  if (!res) return null;
  return res.ok ? readJson(res) : null;
}

export async function fetchModeSettings() {
  const res = await safeFetch(`${API}/api/admin/taxi/public/mode-settings`);
  if (!res) return null;
  return res.ok ? readJson(res) : null;
}

// ── Favorites ──────────────────────────────────────────────────────────────
export async function fetchFavorites() {
  const res = await safeFetch(`${API}/api/taxi/user/favorite-locations`, cred);
  if (!res) return [];
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.favorites || [];
}

export async function saveFavoriteApi({ name, address, latitude, longitude, icon }) {
  const res = await fetch(`${API}/api/taxi/user/favorite-locations`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify({ name, address, latitude, longitude, icon }),
  });
  if (res.ok) return { ok: true };
  const data = await readJson(res);
  return { ok: false, error: data?.detail || "Fehler beim Speichern" };
}

export async function deleteFavoriteApi(favoriteId) {
  const res = await fetch(`${API}/api/taxi/user/favorite-locations/${favoriteId}`, {
    ...cred,
    method: "DELETE",
  });
  return res.ok;
}

export async function markFavoriteUsed(favoriteId) {
  try {
    await fetch(`${API}/api/taxi/user/favorite-locations/${favoriteId}/use`, {
      ...cred,
      method: "POST",
    });
  } catch (error) {
    void error;
  }
}

// ── Saved Places ───────────────────────────────────────────────────────────
export async function fetchSavedPlaces() {
  const res = await safeFetch(`${API}/api/taxi/saved-places`, cred);
  if (!res) return [];
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.places || [];
}

// ── Recent Addresses (auto-tracked on booking) ─────────────────────────────
export async function fetchRecentAddresses(limit = 10) {
  const res = await safeFetch(`${API}/api/taxi/recent-addresses?limit=${limit}`, cred);
  if (!res) return [];
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.addresses || [];
}

export async function clearRecentAddresses() {
  const res = await fetch(`${API}/api/taxi/recent-addresses`, { ...cred, method: "DELETE" });
  return res.ok;
}

// ── Favorite Routes (top-N pickup→dropoff pairs from ride history) ─────────
export async function fetchFavoriteRoutes(limit = 5) {
  const res = await safeFetch(`${API}/api/taxi/favorite-routes?limit=${limit}`, cred);
  if (!res) return [];
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.routes || [];
}

// ── City Defaults ──────────────────────────────────────────────────────────
export async function fetchCityDefault(city) {
  if (!city) return null;
  const res = await safeFetch(`${API}/api/taxi/city-defaults/${encodeURIComponent(city)}`, cred);
  if (!res) return null;
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

export async function saveFavoriteFromSearch({ name, address, lat, lng, icon = "star" }) {
  return await saveFavoriteApi({
    name,
    address,
    latitude: lat,
    longitude: lng,
    icon,
  });
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
  const res = await safeFetch(`${API}/api/taxi/rides/active`, cred);
  if (!res) return null;
  return res.ok ? readJson(res) : null;
}

export async function fetchRide(rideId) {
  const res = await safeFetch(`${API}/api/taxi/ride/${rideId}`, cred);
  if (!res) return null;
  return res.ok ? readJson(res) : null;
}

export async function fetchRideMessages(rideId) {
  const res = await safeFetch(`${API}/api/taxi/rides/${rideId}/messages`, cred);
  if (!res) return { ok: false, messages: [], error: 'Chat momentan nicht erreichbar' };
  const data = await readJson(res);
  return res.ok
    ? { ok: true, messages: data?.messages || [], role: data?.role || 'customer' }
    : { ok: false, messages: [], error: data?.detail || 'Chat konnte nicht geladen werden' };
}

export async function sendRideMessage(rideId, text) {
  const res = await safeFetch(`${API}/api/taxi/rides/${rideId}/messages`, {
    ...credJson,
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (!res) return { ok: false, error: 'Nachricht konnte nicht gesendet werden' };
  const data = await readJson(res);
  return res.ok
    ? { ok: true, message: data?.message }
    : { ok: false, error: data?.detail || 'Nachricht konnte nicht gesendet werden' };
}

export async function fetchRideHistory() {
  const res = await safeFetch(`${API}/api/taxi/rides/history`, cred);
  if (!res) return [];
  if (!res.ok) return [];
  const data = await readJson(res);
  return data?.rides || [];
}

export async function estimateRide({ pickup, dropoff, promoCode }) {
  const body = {
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    dropoff_lat: dropoff.lat,
    dropoff_lng: dropoff.lng,
  };
  if (promoCode) body.promo_code = promoCode;
  const res = await safeFetch(`${API}/api/taxi/estimate`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res) return { ok: false, error: "Taxi-Server momentan nicht erreichbar" };
  const data = await readJson(res);
  return res.ok
    ? { ok: true, estimates: data?.estimates || [], surge: data?.surge || { active: false, multiplier: 1.0 }, promo: data?.promo || null, tariff_zone: data?.tariff_zone || null, time_tariff: data?.time_tariff || null, region: data?.region || '', region_label: data?.region_label || '' }
    : { ok: false, error: data?.detail || "Fehler beim Laden der Preise" };
}

export async function validatePromoCode(code) {
  const res = await safeFetch(`${API}/api/taxi/promo/validate?code=${encodeURIComponent(code)}`, credJson);
  if (!res) return null;
  return await readJson(res);
}

export async function bookRideApi({
  pickup, dropoff, vehicleType, paymentMethod = "wallet", options = {}, stops = [], promoCode = null,
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
    recipient_name: options.recipientName || null,
    recipient_phone: options.recipientPhone || null,
    booking_mode: options.bookingMode || "now",
    promo_code: promoCode || null,
  };
  const res = await safeFetch(`${API}/api/taxi/book`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res) return { ok: false, error: "Buchung momentan nicht möglich" };
  const data = await readJson(res);
  return res.ok ? { ok: true, ride: data?.ride } : { ok: false, error: data?.detail || "Buchung fehlgeschlagen" };
}

export async function cancelRideApi(rideId, reason = null) {
  const res = await safeFetch(`${API}/api/taxi/cancel`, {
    ...credJson,
    method: "POST",
    body: JSON.stringify({ ride_id: rideId, ...(reason ? { reason } : {}) }),
  });
  if (!res) return { ok: false, error: "Stornierung momentan nicht möglich" };
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
  } catch (error) {
    void error;
  }
}

// ── Geocoding (Mapbox) ─────────────────────────────────────────────────────
export async function forwardGeocode(query) {
  if (!MAPBOX_TOKEN) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query,
  )}.json?access_token=${MAPBOX_TOKEN}&country=de,at,ch&language=de&limit=1`;
  const res = await safeFetch(url);
  if (!res) return null;
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
    const res = await safeFetch(url, { signal });
    if (!res) return null;
    if (!res.ok) return null;
    const data = await readJson(res);
    const f = data?.features?.[0];
    return f?.place_name || null;
  } catch {
    return null;
  }
}

export async function fetchRegionalPlaceHints(query, { lat, lng, limit = 2 } = {}) {
  if (!query || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const qs = new URLSearchParams({ q: query, limit: String(limit), lat: String(lat), lng: String(lng) });
  const res = await safeFetch(`${API}/api/taxi/geocode?${qs.toString()}`, cred);
  if (!res || !res.ok) return [];
  const data = await readJson(res);
  return (data?.features || [])
    .map((feature) => {
      const center = feature?.center || [];
      const context = feature?.context || [];
      const city = (context.find((item) => (item.id || '').startsWith('place')) || context.find((item) => (item.id || '').startsWith('locality')) || {}).text || '';
      return {
        id: feature.id || `${query}-${feature.place_name}`,
        name: feature.text || feature.place_name?.split(',')?.[0] || query,
        subtitle: city || feature.place_name || '',
        address: feature.place_name || query,
        lat: center[1],
        lng: center[0],
      };
    })
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}
