const API = process.env.REACT_APP_BACKEND_URL || "";

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

export async function getFuelStatus() {
  const res = await fetch(`${API}/api/fuel/status`, { credentials: "include" });
  if (!res.ok) return { status: "unavailable", payments_enabled: false };
  return await readJson(res);
}

export async function getFuelStations(country = "DE") {
  const qs = new URLSearchParams({ country });
  const res = await fetch(`${API}/api/fuel/stations?${qs.toString()}`, { credentials: "include" });
  const data = await readJson(res);
  if (!res.ok) return { mode: "unavailable", payments_enabled: false, stations: [], error: data?.detail || "Fuel stations unavailable" };
  return data;
}

export async function getFuelStation(stationId) {
  const res = await fetch(`${API}/api/fuel/stations/${encodeURIComponent(stationId)}`, { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Station unavailable" };
}

export async function getFuelOperatorOverview() {
  const res = await fetch(`${API}/api/fuel/operator/overview`, { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Operator overview unavailable" };
}

export async function prepareFuelPump(stationId, pumpId) {
  const res = await fetch(
    `${API}/api/fuel/stations/${encodeURIComponent(stationId)}/pumps/${encodeURIComponent(pumpId)}/prepare`,
    { method: "POST", credentials: "include" }
  );
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, status: res.status, error: data?.detail || "Pump unavailable" };
}
