const API = process.env.REACT_APP_BACKEND_URL || "";

// Read-only authenticated admin preview: never starts a fueling or payment.
export async function previewFuelCommercialOffer(payload) {
  try {
    const response = await fetch(API + "/api/fuel/admin-config/commercial-preview", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: typeof data?.detail === "string" ? data.detail : "Vorschau derzeit nicht verfügbar" };
    }
    return data;
  } catch {
    return { ok: false, error: "Keine Verbindung zum Fuel-Backend" };
  }
}
