/**
 * AdminDiagPage — Routing-Diagnostik UI
 *
 * Route: /admin/diag
 *
 * Zeigt:
 *   - Counter: Registered / Failed / Live API Paths
 *   - Failed Module mit error_type + traceback (ausklappbar)
 *   - Search/Filter über alle 1500+ live API Paths
 *   - Search/Filter über alle 150+ Module + Prefixes
 *
 * Backend:
 *   GET /api/diag/routes?include_traceback=true
 *   GET /api/diag/routes/failed
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Activity, AlertTriangle, CheckCircle2, Search,
  Layers, RefreshCw, Loader2, ChevronDown, Code2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path) {
  const r = await fetch(`${API}${path}`, { credentials: "include" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || d.message || `Error ${r.status}`);
  return d;
}

const METHOD_COLOR = {
  GET: "#10B981", POST: "#00C2FF", PUT: "#F59E0B",
  DELETE: "#EF4444", PATCH: "#8B5CF6",
};

export default function AdminDiagPage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview"); // overview | modules | paths | failed
  const [search, setSearch] = useState("");
  const [openFailed, setOpenFailed] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const d = await api("/api/diag/routes?include_traceback=true");
      setData(d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredPaths = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.live_paths;
    return data.live_paths.filter(p =>
      p.path.toLowerCase().includes(q) ||
      (p.methods || []).some(m => m.toLowerCase().includes(q))
    );
  }, [data, search]);

  const filteredModules = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.registered;
    return data.registered.filter(m =>
      m.module.toLowerCase().includes(q) ||
      (m.prefix || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            data-testid="diag-back-btn"
            className="p-2 hover:bg-slate-700 rounded-lg transition"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              Routing Diagnostics
            </h1>
            <p className="text-xs text-slate-400">FastAPI router registry + live API inventory</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            data-testid="diag-refresh-btn"
            className="p-2 hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-slate-700 overflow-x-auto">
          {[
            { id: "overview", label: "Übersicht" },
            { id: "modules", label: `Module (${data?.total_registered || 0})` },
            { id: "paths", label: `API-Pfade (${data?.live_paths_count || 0})` },
            { id: "failed", label: `Failed (${data?.total_failed || 0})`, danger: data?.total_failed > 0 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`diag-tab-${t.id}`}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                tab === t.id
                  ? t.danger
                    ? "border-red-500 text-red-400"
                    : "border-cyan-500 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-5xl mx-auto">
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-cyan-400" />
          </div>
        )}

        {data && tab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div data-testid="diag-stat-registered" className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <CheckCircle2 size={20} />
                <span className="text-sm font-medium">Registered</span>
              </div>
              <div className="text-4xl font-bold">{data.total_registered}</div>
              <div className="text-xs text-slate-400 mt-1">Module erfolgreich gemountet</div>
            </div>

            <div data-testid="diag-stat-failed" className={`rounded-xl p-5 border ${data.total_failed > 0 ? "bg-red-500/10 border-red-500/30" : "bg-slate-700/30 border-slate-600"}`}>
              <div className={`flex items-center gap-2 mb-2 ${data.total_failed > 0 ? "text-red-400" : "text-slate-400"}`}>
                <AlertTriangle size={20} />
                <span className="text-sm font-medium">Failed</span>
              </div>
              <div className="text-4xl font-bold">{data.total_failed}</div>
              <div className="text-xs text-slate-400 mt-1">
                {data.total_failed > 0 ? "Silent-Failures — Details prüfen" : "Alle Module gemountet"}
              </div>
            </div>

            <div data-testid="diag-stat-paths" className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-5">
              <div className="flex items-center gap-2 text-cyan-400 mb-2">
                <Layers size={20} />
                <span className="text-sm font-medium">Live API-Pfade</span>
              </div>
              <div className="text-4xl font-bold">{data.live_paths_count}</div>
              <div className="text-xs text-slate-400 mt-1">/api/* Routes aktuell aktiv</div>
            </div>

            {/* Top failed preview */}
            {data.total_failed > 0 && (
              <div className="md:col-span-3 bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                <div className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Fehlgeschlagene Module
                </div>
                <div className="space-y-1 text-sm">
                  {data.failed.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-300 font-mono text-xs">
                      <span className="text-red-400">{f.error_type}</span>
                      <span>{f.module}</span>
                      <span className="text-slate-500 truncate">— {f.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {data && (tab === "modules" || tab === "paths") && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tab === "modules" ? "Modul oder Prefix suchen..." : "Pfad oder Methode suchen..."}
                data-testid="diag-search-input"
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            {tab === "modules" && (
              <div className="space-y-1 text-sm">
                {filteredModules.map((m, i) => (
                  <div
                    key={i}
                    data-testid={`diag-module-${i}`}
                    className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 hover:bg-slate-800/80 rounded transition"
                  >
                    <span className="text-cyan-400 font-mono text-xs w-12 text-right">{m.route_count}</span>
                    <span className="text-slate-200 font-mono">{m.module}</span>
                    <span className="text-slate-500 font-mono text-xs flex-1">{m.prefix || "(no prefix)"}</span>
                  </div>
                ))}
                {filteredModules.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">Keine Module gefunden</div>
                )}
              </div>
            )}

            {tab === "paths" && (
              <div className="space-y-1 text-sm font-mono">
                {filteredPaths.slice(0, 500).map((p, i) => (
                  <div
                    key={i}
                    data-testid={`diag-path-${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 hover:bg-slate-800/80 rounded transition"
                  >
                    <div className="flex gap-1">
                      {(p.methods || []).map(method => (
                        <span
                          key={method}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${METHOD_COLOR[method] || "#6B7280"}20`, color: METHOD_COLOR[method] || "#9CA3AF" }}
                        >
                          {method}
                        </span>
                      ))}
                    </div>
                    <span className="text-slate-200 text-xs truncate">{p.path}</span>
                  </div>
                ))}
                {filteredPaths.length > 500 && (
                  <div className="text-center py-3 text-slate-500 text-xs">
                    + {filteredPaths.length - 500} weitere — bitte Filter verfeinern
                  </div>
                )}
                {filteredPaths.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">Keine Pfade gefunden</div>
                )}
              </div>
            )}
          </div>
        )}

        {data && tab === "failed" && (
          <div className="space-y-3">
            {data.failed.length === 0 && (
              <div className="text-center py-20">
                <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3" />
                <div className="text-lg font-medium">Alle Module sauber gemountet</div>
                <div className="text-sm text-slate-400 mt-1">Keine Silent-Failures</div>
              </div>
            )}

            {data.failed.map((f, i) => (
              <div
                key={i}
                data-testid={`diag-failed-${i}`}
                className="bg-red-500/5 border border-red-500/30 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFailed({ ...openFailed, [i]: !openFailed[i] })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition text-left"
                >
                  <AlertTriangle size={18} className="text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-slate-200 truncate">{f.module}</div>
                    <div className="text-xs text-red-400 truncate">{f.error_type}: {f.error}</div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform ${openFailed[i] ? "rotate-180" : ""}`}
                  />
                </button>
                {openFailed[i] && f.traceback && (
                  <div className="bg-slate-950 border-t border-slate-700 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                      <Code2 size={12} />
                      Traceback
                    </div>
                    <pre className="text-xs text-red-300 font-mono overflow-x-auto whitespace-pre">{f.traceback}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
