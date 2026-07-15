import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, Loader2, Cpu, ShieldCheck, AlertTriangle,
  PlugZap, TerminalSquare, BarChart3, Sparkles, CheckCircle2, XCircle,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path) {
  const res = await fetch(`${API}${path}`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `Error ${res.status}`);
  return data;
}

const numberFmt = (value) => Number(value || 0).toLocaleString("de-DE");

function StatusPill({ ok, label, testId }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
    >
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color, testId }) {
  return (
    <div data-testid={testId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-xl p-2" style={{ background: `${color}12` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-gray-500">{sub}</div> : null}
    </div>
  );
}

export default function AdminRtkPage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [lastAction, setLastAction] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const next = await api("/api/diag/rtk");
      setData(next);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = data?.gain?.summary || {};
  const hooks = data?.hooks?.agents || [];
  const notes = data?.notes || [];
  const includeCommands = data?.config?.include_commands || [];
  const excludeCommands = data?.config?.exclude_commands || [];
  const projectFilters = data?.project_filters || {};

  const runAction = async (actionId, path, successMessage) => {
    setActionLoading(actionId);
    try {
      const res = await fetch(`${API}${path}`, { method: "POST", credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.ok === false) {
        throw new Error(payload.message || payload.detail || `Action failed (${res.status})`);
      }
      setLastAction({
        id: actionId,
        message: payload.message || successMessage,
        stdout: payload.result?.stdout || payload.result?.stderr || JSON.stringify(payload.result || {}, null, 2),
      });
      setData(payload.status || null);
      toast.success(payload.message || successMessage);
    } catch (error) {
      toast.error(error.message);
      setLastAction({ id: actionId, message: error.message, stdout: "" });
    } finally {
      setActionLoading("");
    }
  };

  const rewriteStats = useMemo(() => {
    const samples = data?.rewrite_samples || [];
    return {
      rewritten: samples.filter((item) => item.rewritten).length,
      passthrough: samples.filter((item) => item.status === "passthrough").length,
    };
  }, [data]);

  return (
    <div data-testid="admin-rtk-page" className="min-h-screen bg-[#F7F8FA] pb-24">
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onBack}
            data-testid="admin-rtk-back-button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100"
          >
            <ArrowLeft size={16} />
          </motion.button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-violet-600" />
              <h1 className="truncate text-[15px] font-bold text-gray-900">RTK Proxy Dashboard</h1>
            </div>
            <p data-testid="admin-rtk-checked-at" className="text-[11px] text-gray-500">
              Letzter Check: {data?.checked_at ? new Date(data.checked_at).toLocaleString("de-DE") : "–"}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={load}
            disabled={loading}
            data-testid="admin-rtk-refresh-button"
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] font-semibold text-violet-700 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </motion.button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        {loading && !data ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-violet-600" /></div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                testId="admin-rtk-binary-card"
                icon={TerminalSquare}
                label="Binary"
                value={data.binary?.available ? (data.binary?.version || "Verfügbar") : "Fehlt"}
                sub={data.binary?.install_source || "unbekannt"}
                color="#7C3AED"
              />
              <MetricCard
                testId="admin-rtk-hooks-card"
                icon={PlugZap}
                label="Hooks"
                value={`${data.hooks?.configured_count || 0}/${data.hooks?.total_agents || 0}`}
                sub="Agent-Setups aktiv"
                color="#0EA5E9"
              />
              <MetricCard
                testId="admin-rtk-savings-card"
                icon={BarChart3}
                label="Savings"
                value={`${Number(summary.avg_savings_pct || 0).toFixed(1)}%`}
                sub={`${numberFmt(summary.total_saved || 0)} Tokens gespart`}
                color="#10B981"
              />
              <MetricCard
                testId="admin-rtk-commands-card"
                icon={Sparkles}
                label="Commands"
                value={numberFmt(summary.total_commands || 0)}
                sub={`${rewriteStats.rewritten} rewritebar / ${rewriteStats.passthrough} passthrough`}
                color="#F59E0B"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="admin-rtk-overview-section">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900">Installations- und Sicherheitsstatus</h2>
                    <p className="text-[12px] text-gray-500">Binary, Telemetry, Config-Pfade und aktive Agenten auf einen Blick.</p>
                  </div>
                  <StatusPill
                    testId="admin-rtk-binary-pill"
                    ok={Boolean(data.binary?.available)}
                    label={data.binary?.available ? "RTK aktiv" : "RTK fehlt"}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-binary-details">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Binary</p>
                    <p className="mt-2 break-all text-[13px] font-semibold text-gray-900">{data.binary?.path || "Nicht gefunden"}</p>
                    <p className="mt-1 text-[12px] text-gray-500">Quelle: {data.binary?.install_source || "–"}</p>
                    {data.binary?.error ? <p className="mt-2 text-[11px] text-red-600">{data.binary.error}</p> : null}
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-config-details">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Config</p>
                    <p className="mt-2 break-all text-[13px] font-semibold text-gray-900">{data.config?.path}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill testId="admin-rtk-telemetry-pill" ok={!data.config?.telemetry_enabled} label={data.config?.telemetry_enabled ? "Telemetry an" : "Telemetry aus"} />
                      <StatusPill testId="admin-rtk-filters-pill" ok={Boolean(data.config?.filters_template_exists)} label={data.config?.filters_template_exists ? "filters.toml vorhanden" : "kein filters.toml"} />
                    </div>
                  </div>
                </div>

                {notes.length ? (
                  <div data-testid="admin-rtk-notes-box" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-amber-700">
                      <AlertTriangle size={15} />
                      <p className="text-[12px] font-bold">Hinweise</p>
                    </div>
                    <div className="space-y-1 text-[12px] text-amber-800">
                      {notes.map((note, index) => <div key={index} data-testid={`admin-rtk-note-${index}`}>• {note}</div>)}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="admin-rtk-agents-section">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900">Agent-Rollouts</h2>
                    <p className="text-[12px] text-gray-500">Claude, Cursor, Codex, Gemini und Hermes.</p>
                  </div>
                  <StatusPill testId="admin-rtk-agents-pill" ok={(data.hooks?.configured_count || 0) > 0} label={`${data.hooks?.configured_count || 0} aktiv`} />
                </div>
                <div className="space-y-3">
                  {hooks.map((agent) => (
                    <div key={agent.id} data-testid={`admin-rtk-agent-${agent.id}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-bold text-gray-900">{agent.label}</p>
                          <p className="text-[11px] text-gray-500">{agent.details}</p>
                        </div>
                        <StatusPill testId={`admin-rtk-agent-pill-${agent.id}`} ok={agent.configured} label={agent.configured ? "aktiv" : "inaktiv"} />
                      </div>
                      <p className="mt-2 break-all text-[11px] text-gray-600">{agent.path}</p>
                      {agent.meta_files?.length ? (
                        <div className="mt-2 text-[10px] text-gray-500">
                          Dateien: {agent.meta_files.join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="admin-rtk-rules-section">
                <h2 className="text-[15px] font-bold text-gray-900">Rewrite-Regeln</h2>
                <p className="mb-4 text-[12px] text-gray-500">Welche Kommandos aktiv bevorzugt oder bewusst ausgespart werden.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600">Include</p>
                    <div className="flex flex-wrap gap-2" data-testid="admin-rtk-include-list">
                      {includeCommands.map((cmd) => (
                        <span key={cmd} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">{cmd}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-600">Exclude</p>
                    <div className="flex flex-wrap gap-2" data-testid="admin-rtk-exclude-list">
                      {excludeCommands.map((cmd) => (
                        <span key={cmd} className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">{cmd}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="admin-rtk-rewrite-section">
                <h2 className="text-[15px] font-bold text-gray-900">Rewrite-Beispiele</h2>
                <p className="mb-4 text-[12px] text-gray-500">Direkte Sicht auf Rewrite vs. Passthrough mit der aktuellen Config.</p>
                <div className="space-y-3">
                  {(data.rewrite_samples || []).map((sample, index) => (
                    <div key={sample.input} data-testid={`admin-rtk-rewrite-row-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="text-[12px] font-semibold text-gray-900">{sample.input}</code>
                        <StatusPill testId={`admin-rtk-rewrite-pill-${index}`} ok={sample.rewritten} label={sample.rewritten ? "rewritten" : "passthrough"} />
                      </div>
                      <p className="mt-2 break-all text-[11px] text-gray-500">Output: {sample.rewritten_output || "keine Umschreibung"}</p>
                      <p className="mt-1 text-[10px] text-gray-400">Exit-Code: {sample.exit_code ?? "–"}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="admin-rtk-project-filters-section">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Projekt-Filter für dieses Repo</h2>
                  <p className="text-[12px] text-gray-500">Lokale RTK-Filter liegen unter <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px]">/app/.rtk/filters.toml</code>.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill testId="admin-rtk-project-filters-pill" ok={Boolean(projectFilters.exists)} label={projectFilters.exists ? "Datei angelegt" : "Datei fehlt"} />
                  <StatusPill testId="admin-rtk-project-filters-trust-pill" ok={Boolean(projectFilters.trusted)} label={projectFilters.trusted ? "trusted" : "nicht trusted"} />
                </div>
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-project-filters-count">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Filter</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">{numberFmt(projectFilters.filter_count || 0)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-project-filters-schema">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Schema</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">{projectFilters.schema_version || "–"}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-project-filters-path">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Trust Store</p>
                  <p className="mt-2 break-all text-[11px] font-semibold text-gray-700">{projectFilters.trust_store_path || "–"}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["vitest / vite", "Entfernt typische Dev-Server-Hinweise und Leerzeilen"],
                  ["pytest", "Reduziert Header-/Plugin-Noise, behält Findings"],
                  ["grep / rg", "Begrenzt Trefferlisten in diesem großen Repo"],
                  ["git status", "Fokussiert Status-Ausgabe"],
                  ["Supervisor logs", "Zeigt nur die letzten relevanten Logzeilen"],
                  ["curl diag", "Kürzt große JSON-Diag-Antworten leicht ein"],
                ].map(([title, desc], index) => (
                  <div key={title} data-testid={`admin-rtk-project-filter-card-${index}`} className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-[13px] font-semibold text-gray-900">{title}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{desc}</p>
                  </div>
                ))}
              </div>
              {projectFilters.filter_names?.length ? (
                <div className="mt-4 flex flex-wrap gap-2" data-testid="admin-rtk-project-filter-names">
                  {projectFilters.filter_names.map((name) => (
                    <span key={name} className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">{name}</span>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="admin-rtk-trust-notice">
                <div className="mb-2 flex items-center gap-2 text-amber-700">
                  <ShieldCheck size={15} />
                  <p className="text-[12px] font-bold">Trust-Hinweis</p>
                </div>
                <p className="text-[12px] leading-5 text-amber-800">
                  Projekt-Filter werden von RTK erst nach explizitem Vertrauen genutzt. Nach Änderungen an <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">.rtk/filters.toml</code> bitte bewusst <code className="rounded bg-white/70 px-1 py-0.5 text-[11px]">rtk trust</code> im Projektverzeichnis ausführen.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="admin-rtk-actions-section">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Admin-Aktionen</h2>
                  <p className="text-[12px] text-gray-500">Kontrollierte RTK-Aktionen direkt aus dem Admin.</p>
                </div>
                <StatusPill testId="admin-rtk-actions-status" ok={!actionLoading} label={actionLoading ? `läuft: ${actionLoading}` : "bereit"} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={Boolean(actionLoading) || projectFilters.trusted}
                  onClick={() => runAction("trust", "/api/diag/rtk/trust-project-filters", "Projektfilter wurden vertraut")}
                  data-testid="admin-rtk-action-trust"
                  className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left disabled:opacity-60"
                >
                  <p className="text-[13px] font-bold text-violet-900">Projektfilter trusten</p>
                  <p className="mt-1 text-[11px] text-violet-700">Führt `rtk trust --yes` im Repo aus.</p>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={Boolean(actionLoading)}
                  onClick={() => runAction("telemetry", "/api/diag/rtk/telemetry/forget", "Telemetry wurde deaktiviert")}
                  data-testid="admin-rtk-action-telemetry"
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left disabled:opacity-60"
                >
                  <p className="text-[13px] font-bold text-emerald-900">Telemetry deaktivieren</p>
                  <p className="mt-1 text-[11px] text-emerald-700">Führt `rtk telemetry forget` erneut aus.</p>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={Boolean(actionLoading)}
                  onClick={() => runAction("agents", "/api/diag/rtk/reapply-agents", "Agent-Dateien wurden neu erzeugt")}
                  data-testid="admin-rtk-action-reapply"
                  className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left disabled:opacity-60"
                >
                  <p className="text-[13px] font-bold text-sky-900">Agent-Dateien neu generieren</p>
                  <p className="mt-1 text-[11px] text-sky-700">Erneuert Claude, Codex, Gemini, Hermes und Cursor.</p>
                </motion.button>
              </div>
              {lastAction ? (
                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4" data-testid="admin-rtk-last-action-box">
                  <p className="text-[12px] font-bold text-gray-900">Letzte Aktion: {lastAction.id}</p>
                  <p className="mt-1 text-[11px] text-gray-600">{lastAction.message}</p>
                  {lastAction.stdout ? <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-[10px] text-gray-700">{lastAction.stdout}</pre> : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="admin-rtk-savings-section">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Savings-Übersicht</h2>
                  <p className="text-[12px] text-gray-500">Direkt aus `rtk gain --all --format json` gelesen.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill testId="admin-rtk-commands-pill" ok={(summary.total_commands || 0) > 0} label={`${numberFmt(summary.total_commands || 0)} Commands`} />
                  <StatusPill testId="admin-rtk-saved-pill" ok={(summary.total_saved || 0) > 0} label={`${numberFmt(summary.total_saved || 0)} saved`} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-summary-total-input">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Input Tokens</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">{numberFmt(summary.total_input || 0)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-summary-total-output">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Output Tokens</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">{numberFmt(summary.total_output || 0)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-summary-total-saved">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Saved Tokens</p>
                  <p className="mt-2 text-xl font-bold text-emerald-700">{numberFmt(summary.total_saved || 0)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4" data-testid="admin-rtk-summary-avg-pct">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Ø Savings</p>
                  <p className="mt-2 text-xl font-bold text-violet-700">{Number(summary.avg_savings_pct || 0).toFixed(1)}%</p>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}