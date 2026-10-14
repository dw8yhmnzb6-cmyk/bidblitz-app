const API = process.env.REACT_APP_BACKEND_URL || "";

// Admin-only contract preflight. Never discovers stations or authorizes payments.
export async function previewFuelDiscovery(provider, country = "DE") {
  const name = String(provider || "").trim().toLowerCase();
  const territory = String(country || "").trim();
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(name)) {
    return { ok: false, error: "Ungültiger Provider" };
  }
  if (!/^[A-Z]{2}$/.test(territory)) {
    return { ok: false, error: "Ländercode muss zwei Großbuchstaben enthalten" };
  }
  try {
    const response = await fetch(
      API + "/api/fuel/admin-config/providers/" + encodeURIComponent(name)
        + "/discovery-preview?country=" + encodeURIComponent(territory),
      { method: "GET", credentials: "include" },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: typeof body?.detail === "string" ? body.detail : "Partnerprüfung fehlgeschlagen" };
    }
    return body?.ok === true && body?.preflight?.external_request_executed === false
      ? body
      : { ok: false, error: "Unzulässige Partnerantwort" };
  } catch {
    return { ok: false, error: "Keine Verbindung zum Fuel-Backend" };
  }
}
