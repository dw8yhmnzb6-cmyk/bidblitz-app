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

export async function getFuelAdminOverview() {
  const res = await fetch(`${API}/api/fuel/admin/overview`, { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Fuel admin overview unavailable" };
}

export async function getFuelProviderStatus() {
  const res = await fetch(`${API}/api/fuel/providers/status`, { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, providers: [], error: data?.detail || "Provider status unavailable" };
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

export async function createFuelSimulatorSession({ stationId, pumpId, fuelCode }) {
  const qs = new URLSearchParams({ station_id: stationId, pump_id: pumpId, fuel_code: fuelCode });
  const res = await fetch(API + "/api/fuel/simulator/sessions?" + qs.toString(), { method: "POST", credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, status: res.status, error: data?.detail || "Simulator session could not be created" };
}

export async function getFuelSimulatorSession(sessionId) {
  const res = await fetch(API + "/api/fuel/simulator/sessions/" + encodeURIComponent(sessionId), { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, status: res.status, error: data?.detail || "Simulator session unavailable" };
}

export async function advanceFuelSimulatorSession(sessionId, action, options = {}) {
  const allowed = new Set(["authorize", "start", "complete"]);
  if (!allowed.has(action)) return { ok: false, error: "Unsupported simulator action" };
  const qs = new URLSearchParams();
  if (action === "complete" && options.demoLiters) qs.set("demo_liters", String(options.demoLiters));
  const suffix = qs.toString() ? "?" + qs.toString() : "";
  const res = await fetch(API + "/api/fuel/simulator/sessions/" + encodeURIComponent(sessionId) + "/" + action + suffix, { method: "POST", credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, status: res.status, error: data?.detail || "Simulator action failed" };
}

export async function getFuelSimulatorReceipt(sessionId) {
  const res = await fetch(API + "/api/fuel/simulator/sessions/" + encodeURIComponent(sessionId) + "/receipt", { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, status: res.status, error: data?.detail || "Receipt unavailable" };
}

export async function getFuelProviderOnboarding() {
  const res = await fetch(API + "/api/fuel/providers/onboarding", { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, providers: [], error: data?.detail || "Provider onboarding unavailable" };
}

export async function getFuelPaymentReleaseGates() {
  const res = await fetch(API + "/api/fuel/payments/release-gates", { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, live_ready: false, missing: [], error: data?.detail || "Payment release gates unavailable" };
}

export async function getFuelProviderOnboardingDetail(providerName) {
  const res = await fetch(API + "/api/fuel/providers/onboarding/" + encodeURIComponent(providerName), { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Provider detail unavailable" };
}

export async function getFuelPersistenceStatus() {
  const res = await fetch(API + "/api/fuel/persistence/status", { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, enabled: false, error: data?.detail || "Fuel persistence status unavailable" };
}

export async function getFuelProviderContractTemplate(providerName) {
  const res = await fetch(API + "/api/fuel/providers/onboarding/" + encodeURIComponent(providerName) + "/contract-template", { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Provider contract template unavailable" };
}

export async function getFuelAdminContracts() {
  const res = await fetch(API + "/api/fuel/admin-config/contracts", { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, contracts: [], error: data?.detail || "Fuel contracts unavailable" };
}

export async function getFuelAdminContract(providerName) {
  const res = await fetch(API + "/api/fuel/admin-config/contracts/" + encodeURIComponent(providerName), { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Fuel contract unavailable" };
}

export async function saveFuelAdminContract(providerName, payload) {
  const res = await fetch(API + "/api/fuel/admin-config/contracts/" + encodeURIComponent(providerName), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "Fuel contract save failed" };
}

export async function getFuelAdminSessions({ stationId = "", limit = 100 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (stationId) qs.set("station_id", stationId);
  const res = await fetch(API + "/api/fuel/admin-config/sessions?" + qs.toString(), { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, sessions: [], error: data?.detail || "Fuel session history unavailable" };
}

export async function previewDkvRequestPlan(payload) {
  const res = await fetch(API + "/api/fuel/admin-config/dkv/request-plan", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, error: data?.detail || "DKV request preview failed" };
}

export async function getFuelOperatorSessions() {
  const res = await fetch(API + "/api/fuel/operator/sessions", { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, sessions: [], error: data?.detail || "Operator Fuel sessions unavailable" };
}

export async function getFuelReconciliationCases(limit = 100) {
  const qs = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(API + "/api/fuel/admin-config/reconciliation?" + qs.toString(), { credentials: "include" });
  const data = await readJson(res);
  return res.ok ? { ok: true, ...data } : { ok: false, cases: [], error: data?.detail || "Fuel reconciliation unavailable" };
}
