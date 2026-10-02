import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Grid3X3, Loader2, Search, ShieldCheck } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL || "";

const STATUS = {
  connected: { label: "Zentral verbunden", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  online: { label: "Online", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  dev: { label: "DEV", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pending: { label: "Noch nicht verbunden", cls: "bg-gray-50 text-gray-500 border-gray-200" },
};

export default function AdminProjectsPage({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [opening, setOpening] = useState("");

  useEffect(() => {
    fetch(`${API}/api/admin/projects`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Keine Admin-Berechtigung." : "Projekte konnten nicht geladen werden.");
        return res.json();
      })
      .then((data) => {
        setProjects(data.projects || []);
        setOwner(data.owner || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q));
  }, [projects, query]);

  const openProject = async (project) => {
    if (!project.admin_url) return;
    if (project.admin_url.startsWith("/")) {
      onNavigate(project.admin_url);
      return;
    }
    if (!["eyes", "trade"].includes(project.id)) {
      window.location.assign(project.admin_url);
      return;
    }
    if (!project.sso_ready) {
      setError(`${project.name} SSO ist vorbereitet, aber auf Production noch nicht aktiviert.`);
      return;
    }

    setOpening(project.id);
    setError("");
    try {
      const res = await fetch(`${API}/api/admin/sso/${project.id}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "SSO konnte nicht gestartet werden.");

      if (project.id === "trade") {
        window.location.assign(`${project.admin_url}/auth/bidblitz-sso#code=${encodeURIComponent(data.code)}`);
        return;
      }

      const handoff = await fetch(data.handoff_url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: data.code }),
      });
      const handoffData = await handoff.json().catch(() => ({}));
      if (!handoff.ok) throw new Error(handoffData.detail || "Eyes-Anmeldung konnte nicht übernommen werden.");
      window.location.assign(project.admin_url);
    } catch (err) {
      setError(err.message || "Projekt konnte nicht geöffnet werden.");
    } finally {
      setOpening("");
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4FA] text-[#111] pb-24" data-testid="admin-projects-page">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button onClick={() => onNavigate("/admin")} className="p-2 rounded-xl bg-gray-100" aria-label="Zurück">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Grid3X3 size={20} className="text-violet-600" />
              <h1 className="text-lg font-bold">Alle Projekte</h1>
            </div>
            <p className="text-xs text-gray-500">Zentrale BidBlitz-Admin-Zentrale</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Admin</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        {owner && (
          <section className="mb-4 rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="text-xs text-gray-500">Angemeldeter Haupt-Admin</div>
            <div className="font-bold mt-1">{owner.email}</div>
            <div className="text-xs text-gray-500 mt-1">Zentrale Anmeldung · projektbezogene Rechte werden serverseitig geprüft</div>
          </section>
        )}

        <div className="relative mb-5">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Projekt suchen..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none text-sm"
          />
        </div>

        {loading && <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-violet-600" /></div>}
        {error && <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((project) => {
              const status = STATUS[project.status] || STATUS.pending;
              const enabled = Boolean(project.admin_url);
              return (
                <article key={project.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col min-h-[180px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-base">{project.name}</h2>
                      <p className="text-xs text-gray-500 mt-1">{project.description}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${status.cls}`}>{status.label}</span>
                  </div>
                  <div className="mt-auto pt-5">
                    <div className="text-[11px] text-gray-500 mb-2">
                      {project.sso_ready ? "BidBlitz ID verbunden" : enabled ? "SSO wird eingerichtet" : "Admin-Anbindung folgt"}
                    </div>
                    <button
                      disabled={!enabled || opening === project.id}
                      onClick={() => openProject(project)}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${
                        enabled ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {opening === project.id ? "Wird angemeldet…" : enabled ? "Admin öffnen" : "Noch nicht verbunden"}
                      {opening === project.id ? <Loader2 size={14} className="animate-spin" /> : enabled && <ExternalLink size={14} />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
