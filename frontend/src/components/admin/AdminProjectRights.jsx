import { useState } from "react";
import { ADMIN_ACCESS_AREAS } from "./projectAccessAreas";

const OPERATION_LABELS = { read: "Ansehen", create: "Erstellen", update: "Bearbeiten", delete: "Löschen", moderate: "Moderieren", disable: "Deaktivieren" };

export default function AdminProjectRights({ owner, projects, onNavigate }) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLocaleLowerCase("de");
  const matches = (value) => value.toLocaleLowerCase("de").includes(term);
  const areas = ADMIN_ACCESS_AREAS.filter((area) => area.roles.includes(owner.database_role) && matches(`${area.name} ${area.group} ${area.path}`));
  const modules = (owner.service_modules || []).filter((module) => matches(`${module.name} ${module.note} ${module.operations.map((operation) => OPERATION_LABELS[operation] || operation).join(" ")}`));
  const external = projects.filter((project) => project.access_profile?.scope === "separate_project" && matches(`${project.name} ${project.access_profile.required_role || ""}`));
  const groups = [...new Set(areas.map((area) => area.group))];
  return (
    <section aria-labelledby="rights-heading" data-testid="admin-project-rights">
      <h2 id="rights-heading" className="text-xl font-bold">Rechte & Admin-Bereiche</h2>
      <p className="text-sm text-gray-600 mt-2">Aktuelle BidBlitz-Rolle: <strong>{owner.database_role || "Nicht übermittelt"}</strong>. {owner.notice || "Jede Aktion wird erneut im jeweiligen Backend geprüft."}</p>
      <div className="grid sm:grid-cols-3 gap-3 my-4">
        <div className="bg-white rounded-xl border p-3"><h3 className="font-semibold">Projektkatalog</h3><p className="text-sm">Verwalten und SSO-Anmeldung anfordern</p></div>
        <div className="bg-white rounded-xl border p-3"><h3 className="font-semibold">Privilegierte Rollen</h3><p className="text-sm">{owner.can_manage_privileged_roles ? "Verwalten laut bestehender Kontoregel" : "Nicht freigegeben"}</p></div>
        <div className="bg-white rounded-xl border p-3"><h3 className="font-semibold">Demo-Bereinigung</h3><p className="text-sm">{owner.can_cleanup_demo_data ? "Nur Testmodus, Super-Admin und ausdrückliche Bestätigung" : "Gesperrt"}</p></div>
      </div>
      <label className="block text-sm mb-5">Recht oder Adminbereich suchen<input value={query} onChange={(event) => setQuery(event.target.value)} className="block w-full bg-white border rounded-xl px-3 py-2 mt-1" placeholder="z. B. Wallet, Taxi, Moderieren…" /></label>
      <p className="text-sm text-gray-600 mb-4">{areas.length} Admin-Einstiege · {modules.length} Service-Rechtepakete · {external.length} separate Projekte. Ein Einstieg ist keine pauschale Freigabe für alle Aktionen.</p>
      {!areas.length && !modules.length && !external.length && <p className="bg-white border rounded-xl p-5">Keine passenden Rechte oder Bereiche gefunden.</p>}
      {groups.map((group) => <section key={group} className="mb-4 bg-white border rounded-2xl p-4" aria-label={group}>
        <h3 className="font-semibold mb-3">{group}</h3>
        <div className="flex flex-wrap gap-2">{areas.filter((area) => area.group === group).map((area) => <button key={area.path} onClick={() => onNavigate(area.path)} className="text-sm border rounded-lg px-3 py-2 hover:bg-violet-50">{area.name}</button>)}</div>
      </section>)}
      {modules.length > 0 && <section className="mb-5" aria-labelledby="service-rights-heading">
        <h3 id="service-rights-heading" className="font-bold mb-3">Vorhandene Service-Rechte</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{modules.map((module) => <article key={module.id} className="bg-white border rounded-xl p-4">
          <h4 className="font-semibold">{module.name}</h4>
          <p className="text-sm mt-2">{module.operations.map((operation) => OPERATION_LABELS[operation] || operation).join(" · ") || "Keine Freigabe"}</p>
          <p className="text-xs text-gray-500 mt-2">{module.note}</p>
          <button disabled={!module.operations.length} onClick={() => onNavigate("/admin/modules", { module: module.id })} className="text-violet-700 text-sm underline mt-3 disabled:text-gray-400">{module.name} verwalten</button>
        </article>)}</div>
      </section>}
      {external.length > 0 && <section className="bg-white border rounded-2xl p-4" aria-labelledby="external-rights-heading">
        <h3 id="external-rights-heading" className="font-bold">Rechte in separaten Projekten</h3>
        <p className="text-sm text-gray-600 mt-2">Die erforderliche Rolle ist im Code geprüft, wo angegeben. Deine tatsächlichen Live-Rechte sind damit noch nicht bestätigt. Lokale Kontensperren, 2FA und Freigaben bleiben aktiv.</p>
        <ul className="mt-3 space-y-2">{external.map((project) => <li key={project.id} className="text-sm border-t pt-2"><span className="font-semibold">{project.name}</span> — {project.access_profile.required_role ? `Erforderliche lokale Rolle: ${project.access_profile.required_role}` : "Rechtepaket noch nicht geprüft"}<span className="block text-xs text-gray-500">{project.sso_message}</span></li>)}</ul>
      </section>}
    </section>
  );
}
