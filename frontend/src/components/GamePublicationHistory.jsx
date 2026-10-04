import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/game-studio/drafts`;

const COPY = {
  de: {
    title: "Veröffentlichungshistorie", empty: "Noch keine Veröffentlichungsvorgänge.",
    loadError: "Historie konnte nicht geladen werden.", refresh: "Neu laden",
    publish: "Veröffentlicht", rollback: "Zurückgerollt", unpublish: "Veröffentlichung gestoppt",
    version: "Version", previous: "vorher",
  },
  en: {
    title: "Publication history", empty: "No publication activity yet.",
    loadError: "Could not load publication history.", refresh: "Reload",
    publish: "Published", rollback: "Rolled back", unpublish: "Unpublished",
    version: "Version", previous: "previous",
  },
  sq: {
    title: "Historia e publikimit", empty: "Ende nuk ka veprime publikimi.",
    loadError: "Historia nuk u ngarkua.", refresh: "Ringarko",
    publish: "Publikuar", rollback: "Rikthyer", unpublish: "Publikimi u ndal",
    version: "Versioni", previous: "i mëparshmi",
  },
};

function label(action, c) {
  return c[action] || action || "—";
}

function when(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export default function GamePublicationHistory({ draftId, locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API}/${encodeURIComponent(draftId)}/publication-history`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(c.loadError);
      setEvents(Array.isArray(body.events) ? body.events : []);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [draftId, c.loadError]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-xs font-bold text-white/75"><History size={15} className="text-cyan-300" />{c.title}</h4>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg p-2 text-white/45 hover:bg-white/5 disabled:opacity-40" aria-label={c.refresh}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
      </div>
      {loading ? <div className="mt-3 flex items-center gap-2 text-xs text-white/40"><Loader2 size={14} className="animate-spin" />{c.title}…</div>
        : error ? <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>
          : events.length === 0 ? <p className="mt-3 text-xs text-white/40">{c.empty}</p>
            : <ol className="mt-3 space-y-2">{events.map((event, index) => <li key={`${event.action}-${event.created_at}-${index}`} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
              <div className="flex items-center justify-between gap-3"><b className="text-xs text-white/80">{label(event.action, c)}</b><time className="text-[10px] text-white/35">{when(event.created_at)}</time></div>
              <p className="mt-1 text-[11px] text-white/45">{c.version}: {event.version_id || "—"}{event.previous_version_id ? ` · ${c.previous}: ${event.previous_version_id}` : ""}</p>
            </li>)}</ol>}
    </section>
  );
}
