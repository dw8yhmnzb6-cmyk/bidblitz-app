import { useState } from "react";

const CHECK_STATES = {
  passed: { label: "Lokal erfüllt", color: "text-emerald-700" },
  blocked: { label: "Gesperrt", color: "text-red-700" },
  pending: { label: "Noch prüfen", color: "text-amber-800" },
};
const UNKNOWN = { state: "unknown", can_attempt: false,
  checks: [{ id: "diagnostics", label: "Anbindungsdiagnose", state: "pending", detail: "Keine aktuelle Diagnose vom Backend erhalten. Bitte aktualisieren." }],
  issuer_settings: [], summary: "Anbindungsdiagnose noch nicht verfügbar. Bitte aktualisieren." };

export default function AdminProjectConnections({ projects, onOpen, onEdit, opening, editing }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const term = query.trim().toLowerCase();
  const visible = projects.filter((project) => {
    const integration = project.integration || UNKNOWN;
    const checks = integration.checks || [];
    const matchesFilter = filter === "all" || (filter === "blocked" ? checks.some((check) => check.state === "blocked")
      : filter === "pending" ? checks.some((check) => check.state === "pending") : integration.state === filter);
    return matchesFilter && `${project.name} ${(project.aliases || []).join(" ")} ${project.access_profile?.required_role || ""} ${integration.summary} ${(integration.issuer_settings || []).join(" ")} ${checks.map((check) => `${check.label} ${check.detail}`).join(" ")}`.toLowerCase().includes(term);
  });

  return <section data-testid="admin-project-connections" aria-labelledby="project-connections-title">
    <h2 id="project-connections-title" className="font-bold text-xl">Anbindungen & offene Schritte</h2>
    <p className="text-sm text-gray-600 mt-2">Diese Diagnose prüft nur die lokale Konfiguration. Sie kontaktiert keine Zielprojekte, erstellt keine Zugangscodes und verändert keine Konten oder Rechte.</p>
    <p className="text-sm bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-3 mt-3">Ein konfigurierter SSO-Aussteller bestätigt weder ein aktives Zielkonto noch dessen Rechte. Schlüsselwerte und konkrete Kontenzuordnungen bleiben verborgen.</p>
    <div className="flex flex-col sm:flex-row gap-3 my-4">
      <label className="flex-1"><span className="sr-only">Anbindung oder Prüfschritt suchen</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Projekt, Rolle oder Prüfschritt suchen…" className="w-full p-3 bg-white border rounded-xl text-sm" /></label>
      <label><span className="sr-only">Anbindungen filtern</span><select value={filter} onChange={(event) => setFilter(event.target.value)} className="w-full p-3 bg-white border rounded-xl text-sm">
        <option value="all">Alle Anbindungen</option>
        <option value="blocked">Mit gesperrten Schritten</option>
        <option value="pending">Mit offenen Prüfungen</option>
        <option value="native_ready">Interne Einstiege</option>
        <option value="issuer_ready">SSO-Aussteller konfiguriert</option>
        <option value="not_integrated">Ohne SSO-Empfänger</option>
      </select></label>
    </div>
    <p className="text-xs text-gray-500 mb-3">{visible.length} von {projects.length} Einträgen · „Lokal erfüllt“ ist keine Live-Prüfung.</p>
    {!visible.length && <p className="p-8 bg-white border rounded-xl text-center">Keine Anbindungen für diesen Filter gefunden.</p>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {visible.map((project) => {
        const integration = project.integration || UNKNOWN;
        const checks = integration.checks || [];
        const blocked = checks.filter((check) => check.state === "blocked").length;
        const pending = checks.filter((check) => check.state === "pending").length;
        const setup = integration.receiver_setup;
        return <article key={project.id} className="p-4 bg-white border rounded-2xl min-w-0">
          <h3 className="font-bold break-words">{project.name}</h3>
          <p className="text-sm mt-2">{integration.summary}</p>
          <p className="text-xs text-gray-600 mt-2">{blocked} gesperrte Schritte · {pending} offene Prüfungen</p>
          {project.access_profile?.required_role && <p className="text-xs text-gray-600 mt-2">Erforderliche lokale Rolle: {project.access_profile.required_role}</p>}
          {setup?.sandbox_only && <p className="text-sm text-amber-900 bg-amber-50 rounded-lg p-2 mt-3">Verify bleibt ausschließlich Sandbox – keine echte Identitätsprüfung.</p>}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold">Prüfschritte & Einrichtung</summary>
            <ul className="mt-3 space-y-3">
              {checks.map((check) => {
                const state = CHECK_STATES[check.state] || CHECK_STATES.pending;
                return <li key={check.id}><p className="font-semibold">{check.label} <span className={`text-xs ${state.color}`}>– {state.label}</span></p><p className="text-xs text-gray-600 mt-1">{check.detail}</p></li>;
              })}
            </ul>
            {integration.issuer_settings?.length > 0 && <div className="mt-4"><p className="font-semibold">Konfigurationsnamen beim Aussteller</p><ul className="text-xs mt-1 space-y-1">{integration.issuer_settings.map((setting) => <li key={setting}><code className="break-all">{setting}</code></li>)}</ul></div>}
            {setup && <div className="mt-4 text-xs text-gray-600"><p className="font-semibold text-gray-900 mb-1">Im Zielprojekt noch zu prüfen</p><p>Kontozuordnung: <code className="break-all">{setup.identity_setting}</code></p><p>Owner-Subject: <code className="break-all">{setup.owner_setting}</code></p><p>Passender Schlüssel: <code className="break-all">{setup.secret_setting}</code></p><p className="mt-1">Nonce-Speicher: {setup.migration}</p></div>}
          </details>
          <div className="flex flex-wrap gap-2 mt-4">
            <button disabled={!integration.can_attempt || project.open_mode === "unavailable" || Boolean(opening)} onClick={() => onOpen(project)} className="bg-gray-900 text-white rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500">{opening === project.id ? "Wird angemeldet…" : project.open_mode === "internal" ? "Admin öffnen" : "Mit BidBlitz anmelden"}</button>
            <button disabled={editing} onClick={() => onEdit(project)} className="border rounded-lg px-3 py-2 text-sm disabled:opacity-50">Katalog bearbeiten</button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
