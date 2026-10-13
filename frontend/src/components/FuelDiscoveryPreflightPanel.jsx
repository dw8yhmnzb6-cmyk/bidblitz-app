import React, { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { previewFuelDiscovery } from "../services/fuelDiscoveryPreflightApi";

const TERRITORIES = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "FR", label: "Frankreich" },
  { code: "NL", label: "Niederlande" },
  { code: "BE", label: "Belgien" },
  { code: "PL", label: "Polen" },
  { code: "XK", label: "Kosovo" },
];

const REASONS = {
  signed_contract: "Unterschriebener Vertrag fehlt",
  contract_api_rights: "API-Rechte fehlen",
  contract_station_discovery_rights: "Recht zur Tankstellensuche fehlt",
  territories: "Keine Vertragsländer hinterlegt",
  provider_api_confirmed: "Partner-API nicht bestätigt",
  provider_station_discovery_confirmed: "Tankstellensuche nicht bestätigt",
  credentials_configured: "Zugangsdaten nicht bestätigt",
  country_not_in_signed_territories: "Gewähltes Land nicht im Vertrag",
  contract_effective_from_missing: "Vertragsbeginn fehlt",
  invalid_contract_effective_from: "Ungültiges Datum für Vertragsbeginn",
  contract_not_yet_effective: "Vertrag beginnt erst später",
  invalid_contract_effective_until: "Ungültiges Vertragsende",
  contract_expired: "Vertrag abgelaufen",
  contract_date_window_invalid: "Vertragsende vor Vertragsbeginn",
};

export default function FuelDiscoveryPreflightPanel({ providerName }) {
  const [country, setCountry] = useState("DE");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStatus(null);
    setError("");
    (async () => {
      const result = await previewFuelDiscovery(providerName, country);
      if (!active) return;
      if (result.ok) setStatus(result.preflight);
      else setError(result.error || "Prüfung fehlgeschlagen");
      setLoading(false);
    })();
    return () => { active = false; };
  }, [providerName, country]);

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Partner-Discovery Sicherheitsprüfung</h2>
          <p className="mt-1 text-xs text-slate-400">
            Vertrag, Länderrechte und Vertragslaufzeit prüfen. Keine echte Tankstellensuche.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">
          <ShieldCheck size={14} /> DEV · READ ONLY
        </span>
      </div>
      <label className="mt-5 block max-w-xs text-sm text-slate-300">
        Land prüfen
        <select
          aria-label="Land für Partnerprüfung"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0A1829] px-3 py-2.5 text-white"
        >
          {TERRITORIES.map(({ code, label }) =>
            <option key={code} value={code}>{label} ({code})</option>
          )}
        </select>
      </label>
      {loading && <p role="status" className="mt-4 text-sm text-slate-400">Prüfung läuft…</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {status && (
        <div className="mt-5">
          <div className={"inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold " +
            (status.discovery_conditions_met ? "bg-amber-400/10 text-amber-200" : "bg-red-400/10 text-red-300")}>
            <AlertTriangle size={17} />
            {status.discovery_conditions_met
              ? "Vertragsbedingungen plausibel – Live weiterhin gesperrt"
              : "Partner-Discovery gesperrt"}
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Geprüft: {status.checked_on} · Land: {status.country}
            · API-Aufrufe: {status.external_request_executed ? "nicht zulässig" : "keine"}
          </div>
          {(status.missing || []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {status.missing.map((reason) => (
                <span key={reason} className="rounded-lg bg-red-400/10 px-2.5 py-1.5 text-xs text-red-200">
                  {REASONS[reason] || reason}
                </span>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Keine Live-Freigabe: Partnervertrag und Stationsliste müssen unabhängig verifiziert,
            die API-Anbindung gesondert genehmigt und alle Zahlungsprüfungen bestanden werden.
          </p>
        </div>
      )}
    </section>
  );
}
