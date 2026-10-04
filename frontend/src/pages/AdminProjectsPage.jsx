import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Grid3X3, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import AdminProjectRights from "../components/admin/AdminProjectRights";
import AdminProjectConnections from "../components/admin/AdminProjectConnections";
import { NATIVE_ADMIN_PATHS } from "../components/admin/projectAccessAreas";

const API = process.env.REACT_APP_BACKEND_URL || "";
const STATUS = { active: "Aktiv", dev: "Entwicklung", coming_soon: "Demnächst", hidden: "Ausgeblendet" };
const EMPTY = { id: "", name: "", description: "", category: "Weitere", icon: "BB", color: "#7c3aed", url: "", admin_url: "", status: "coming_soon", position: 100 };
const FIELDS = Object.keys(EMPTY);

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, { credentials: "include", ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fallback = response.status === 401 ? "Deine Sitzung ist abgelaufen. Bitte erneut anmelden." : response.status === 403 ? "Keine Berechtigung für diese Aktion." : response.status === 422 ? "Bitte prüfe die Angaben im Formular." : "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.";
      throw new Error(typeof data.detail === "string" ? data.detail : fallback);
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Die Anfrage dauert zu lange. Bitte erneut versuchen.");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function ProjectEditor({ project, saving, error, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...project }));
  const nameInput = useRef(null);
  useEffect(() => { nameInput.current?.focus(); }, []);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(FIELDS.map((key) => [key, form[key]]));
    data.url = data.url || null;
    data.admin_url = data.admin_url || null;
    data.position = Number(data.position);
    if (project) { delete data.id; data.revision = project.revision; }
    onSave(data);
  };
  return (
    <section className="bg-white border border-violet-200 rounded-2xl p-5 mb-5" aria-labelledby="project-editor-title">
      <h2 id="project-editor-title" className="font-bold text-lg mb-4">{project ? "Projekt bearbeiten" : "Neues Projekt hinzufügen"}</h2>
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm">Name<input ref={nameInput} required maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
          <label className="text-sm">Projekt-ID<input required disabled={Boolean(project)} pattern="[a-z][a-z0-9-]+" minLength={2} maxLength={60} value={form.id} onChange={(e) => set("id", e.target.value)} placeholder="z. B. mein-projekt" className="block w-full border rounded-lg p-2 mt-1" /></label>
          <label className="text-sm sm:col-span-2">Beschreibung<textarea maxLength={500} value={form.description} onChange={(e) => set("description", e.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
          <label className="text-sm">Webseite<input maxLength={500} value={form.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="https://…" className="block w-full border rounded-lg p-2 mt-1" /></label>
          <label className="text-sm">Admin-Adresse<input maxLength={500} value={form.admin_url || ""} onChange={(e) => set("admin_url", e.target.value)} placeholder="https://…/admin" className="block w-full border rounded-lg p-2 mt-1" /></label>
          <label className="text-sm">Kategorie<input required maxLength={60} value={form.category} onChange={(e) => set("category", e.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
          <label className="text-sm">Icon oder Kürzel<input required maxLength={32} value={form.icon} onChange={(e) => set("icon", e.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
          <label className="text-sm">Status<select value={form.status} onChange={(e) => set("status", e.target.value)} className="block w-full border rounded-lg p-2 mt-1">{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm">Position<input type="number" required min={0} max={10000} value={form.position} onChange={(e) => set("position", e.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
          <label className="text-sm">Farbe<input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="block mt-1 h-10 w-20" /></label>
        </fieldset>
        <p className="text-xs text-gray-500 mt-4">Die Adresse wird als Projektlink gespeichert. Eine gemeinsame Anmeldung benötigt zusätzlich die Anbindung des Zielprojekts. Ausgeblendete Projekte bleiben hier verwaltbar.</p>
        {error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg mt-3">{error}</p>}
        <div className="flex gap-3 mt-4">
          <button disabled={saving} type="submit" className="bg-violet-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">{saving ? "Wird gespeichert…" : "Speichern"}</button>
          <button disabled={saving} type="button" onClick={onCancel} className="border px-4 py-2 rounded-lg">Abbrechen</button>
        </div>
      </form>
    </section>
  );
}

export default function AdminProjectsPage({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [view, setView] = useState("projects");
  const [opening, setOpening] = useState("");
  const [editor, setEditor] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const openLock = useRef(false);
  const saveLock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await request(`${API}/api/admin/projects`);
      setProjects(data.projects || []);
      setOwner(data.owner || null);
    } catch (err) {
      setProjects([]);
      setOwner(null);
      setLoadError(err.message);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (data) => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const path = editor.project ? `/${encodeURIComponent(editor.project.id)}` : "";
      const result = await request(`${API}/api/admin/projects${path}`, {
        method: editor.project ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-BidBlitz-Admin": "1" },
        body: JSON.stringify(data),
      });
      setProjects((old) => [...old.filter((p) => p.id !== result.project.id), result.project]
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)));
      setEditor(null);
      setNotice("Projekt gespeichert.");
    } catch (err) { setSaveError(err.message); }
    finally { setSaving(false); saveLock.current = false; }
  };

  const openProject = async (project) => {
    if (openLock.current || project.open_mode === "unavailable") return;
    if (project.open_mode === "internal") {
      const path = project.native_path || (project.id === "bidblitz" ? "/admin" : null);
      if (!NATIVE_ADMIN_PATHS.has(path)) { setActionError("Dieser Admin-Einstieg ist nicht freigegeben."); return; }
      onNavigate(path); return;
    }
    openLock.current = true;
    setOpening(project.id);
    setActionError("");
    try {
      const data = await request(`${API}/api/admin/sso/${encodeURIComponent(project.id)}`, {
        method: "POST", headers: { "X-BidBlitz-Admin": "1" },
      });
      if (data.mode === "redirect") {
        window.location.assign(`${data.browser_url}#code=${encodeURIComponent(data.code)}`);
      } else if (data.mode === "exchange") {
        await request(data.handoff_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: data.code }) });
        window.location.assign(data.browser_url);
      } else { throw new Error("Dieses Anmeldeverfahren wird noch nicht unterstützt."); }
    } catch (err) { setActionError(`${project.name}: ${err.message}`); }
    finally { setOpening(""); openLock.current = false; }
  };

  const visible = projects.filter((p) => (statusFilter === "all" || p.status === statusFilter)
    && (kindFilter === "all" || p.kind === kindFilter)
    && `${p.name} ${p.description} ${p.category} ${(p.aliases || []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const internal = projects.filter((p) => p.open_mode === "internal").length;
  const configured = projects.filter((p) => p.open_mode === "sso").length;
  const prepared = projects.filter((p) => p.sso && !p.native_path && p.open_mode !== "internal" && !p.sso_ready).length;
  const pending = projects.filter((p) => !p.sso).length;
  const edit = (project) => { setSaveError(""); setNotice(""); setEditor({ project }); };

  return (
    <div className="min-h-screen bg-[#F0F4FA] text-[#111] pb-24" data-testid="admin-projects-page">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button onClick={() => onNavigate("/admin")} className="p-2 rounded-xl bg-gray-100" aria-label="Zurück zum Admin"><ArrowLeft size={18} /></button>
          <Grid3X3 size={22} className="text-violet-600" />
          <div><h1 className="text-lg font-bold">Alle Projekte</h1><p className="text-xs text-gray-500">Deine zentrale BidBlitz-Verwaltung</p></div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-5">
        {owner && <section className="mb-4 rounded-2xl bg-white border p-4"><div className="text-xs text-gray-500">Haupt-Admin</div><p className="font-bold break-all">{owner.email}</p><p className="text-xs text-gray-500 mt-1">Projekte verwalten und öffnen. Zugriffsrechte werden im jeweiligen Projekt geprüft.</p></section>}
        {owner && <p className="text-sm mb-4" role="status">{internal} interne Einstiege · {configured} SSO-Aussteller konfiguriert · {prepared} vorbereitet · {pending} ohne SSO-Empfänger</p>}
        {owner && <nav className="flex flex-wrap gap-2 mb-4" aria-label="Projektverwaltung Ansichten">
          <button aria-pressed={view === "projects"} onClick={() => setView("projects")} className="bg-white border rounded-xl px-4 py-2">Projekte ({projects.length})</button>
          <button aria-pressed={view === "rights"} onClick={() => setView("rights")} className="bg-white border rounded-xl px-4 py-2">Alle Rechte & Admin-Bereiche</button>
          <button aria-pressed={view === "connections"} onClick={() => setView("connections")} className="bg-white border rounded-xl px-4 py-2">Anbindungen & offene Schritte</button>
        </nav>}
        {owner && <div className="flex flex-wrap gap-2 mb-4">
          <button disabled={Boolean(editor)} onClick={() => edit(null)} className="bg-violet-700 text-white rounded-xl px-4 py-2 flex items-center gap-2 disabled:opacity-50"><Plus size={16} />Neues Projekt hinzufügen</button>
          <button disabled={loading || Boolean(editor)} onClick={load} className="border bg-white rounded-xl px-4 py-2 flex items-center gap-2 disabled:opacity-50"><RefreshCw size={16} />Aktualisieren</button>
        </div>}
        {editor && <ProjectEditor key={editor.project?.id || "new"} project={editor.project} saving={saving} error={saveError} onSave={save} onCancel={() => setEditor(null)} />}
        {notice && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3 mb-4">{notice}</p>}
        {actionError && <div role="alert" className="p-4 rounded-xl bg-red-50 text-red-700 mb-4">{actionError}<button onClick={() => setActionError("")} className="ml-3 underline">Schließen</button></div>}
        {loadError && <div role="alert" className="p-4 rounded-xl bg-red-50 text-red-700">{loadError}<button onClick={load} className="ml-3 underline">Erneut versuchen</button></div>}
        {!loadError && owner && view === "projects" && <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <label className="relative flex-1"><span className="sr-only">Projekt suchen</span><Search size={17} className="absolute left-3 top-3.5 text-gray-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Projekt suchen…" className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border text-sm" /></label>
          <label><span className="sr-only">Nach Status filtern</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-3 rounded-xl bg-white border text-sm"><option value="all">Alle Status</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="sr-only">Nach Projektart filtern</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} className="w-full p-3 rounded-xl bg-white border text-sm"><option value="all">Projekte und Module</option><option value="project">Eigenständige Projekte</option><option value="module">BidBlitz-Module</option></select></label>
        </div>}
        {loading && <div role="status" className="py-10 flex justify-center gap-2"><Loader2 className="animate-spin" />Projekte werden geladen…</div>}
        {!loading && !loadError && owner && view === "rights" && <AdminProjectRights owner={owner} projects={projects} onNavigate={onNavigate} />}
        {!loading && !loadError && owner && view === "connections" && <AdminProjectConnections projects={projects} onOpen={openProject} onEdit={edit} opening={opening} editing={Boolean(editor)} />}
        {!loading && !loadError && owner && view === "projects" && <>
          <p className="text-xs text-gray-500 mb-3">{visible.length} von {projects.length} Projekten · „Aktiv“ ist der eingestellte Projektstatus, keine Erreichbarkeitsprüfung.</p>
          {!visible.length && <p className="p-8 bg-white border rounded-xl text-center">Keine Projekte für diesen Filter gefunden.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((project) => <article key={project.id} className="bg-white rounded-2xl border shadow-sm p-4 flex flex-col min-h-[240px]">
              <div className="flex items-start gap-3">
                <span className="rounded-xl px-2 py-2 text-white text-xs max-w-[5rem] break-words" style={{ backgroundColor: project.color }}>{project.icon}</span>
                <div className="flex-1 min-w-0"><h2 className="font-bold break-words">{project.name}</h2><p className="text-xs text-gray-500">{project.category}</p></div>
                <button disabled={Boolean(editor)} aria-label={`${project.name} bearbeiten`} onClick={() => edit(project)} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"><Pencil size={16} /></button>
              </div>
              <p className="text-sm text-gray-600 mt-3 break-words">{project.description}</p>
              <p className="text-xs text-violet-700 mt-2">{project.kind === "module" ? "Modul der BidBlitz-App" : "Eigenständiges Projekt"}</p>
              {project.access_profile && <details className="text-xs mt-3"><summary className="cursor-pointer font-semibold">Rechte & Zuordnung</summary><p className="mt-2 text-gray-600">{project.access_profile.role ? `BidBlitz-Rolle: ${project.access_profile.role}` : project.access_profile.required_role ? `Erforderliche lokale Rolle: ${project.access_profile.required_role}` : "Lokales Rechtepaket noch nicht geprüft"}</p><p className="text-gray-500 mt-1">{project.access_profile.note}</p>{project.aliases?.length > 0 && <p className="text-gray-500 mt-1">Auch bekannt als: {project.aliases.join(", ")}</p>}</details>}
              <span className="text-xs mt-3 font-semibold">{STATUS[project.status] || "Unbekannt"}</span>
              <div className="mt-auto pt-4">
                <p className="text-xs text-gray-500 mb-3">{project.sso_message}</p>
                <button disabled={project.open_mode === "unavailable" || Boolean(opening)} onClick={() => openProject(project)} className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-gray-900 text-white disabled:bg-gray-100 disabled:text-gray-400">
                  {opening === project.id ? <><Loader2 size={14} className="animate-spin" />Wird angemeldet…</> : project.open_mode === "unavailable" ? "Noch nicht verfügbar" : <>{project.open_mode === "sso" ? "Mit BidBlitz anmelden" : project.open_mode === "internal" ? "Admin öffnen" : "Projekt öffnen"}<ExternalLink size={14} /></>}
                </button>
              </div>
            </article>)}
          </div>
        </>}
      </main>
    </div>
  );
}
