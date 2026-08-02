import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldAlert, Smartphone, Languages, Store, FileCheck2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api } from "../services/api";

const phaseIcons = {
  "PHASE 1 – P0 LAUNCH BLOCKERS": ShieldAlert,
  "PHASE 2 – CORE USER FLOWS": CheckCircle2,
  "PHASE 3 – MERCHANT AND ADMIN": CheckCircle2,
  "PHASE 4 – MOBILE QUALITY": Smartphone,
  "PHASE 5 – TRANSLATION AUDIT": Languages,
  "PHASE 6 – STORE SAFE RELEASE": Store,
  "PHASE 7 – RELEASE ARTIFACTS": FileCheck2,
  "PHASE 8 – FINAL ACCEPTANCE REPORT": FileCheck2,
};

function StatusPill({ value, testId }) {
  const color = String(value || "").toLowerCase();
  const classes = color.includes("completed") || color.includes("verified")
    ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-200"
    : color.includes("blocked")
      ? "border-rose-400/30 bg-rose-400/12 text-rose-200"
      : color.includes("progress") || color.includes("testing") || color.includes("review")
        ? "border-amber-400/30 bg-amber-400/12 text-amber-100"
        : "border-white/10 bg-white/5 text-white/72";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${classes}`} data-testid={testId}>{value}</span>;
}

function StatCard({ label, value, helper, testId }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid={testId}>
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div>
      <div className="mt-3 text-2xl font-black text-white break-words">{String(value)}</div>
      {helper ? <div className="mt-2 text-xs text-white/54">{helper}</div> : null}
    </div>
  );
}

function SectionCard({ title, subtitle, children, testId }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">{title}</h2>
          {subtitle ? <p className="mt-2 text-sm text-white/62">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function AdminMasterRoadmapPage({ onBack }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingTask, setSavingTask] = useState("");
  const [savingGate, setSavingGate] = useState("");

  const load = async (withSpinner = true) => {
    if (withSpinner) setLoading(true);
    try {
      const data = await api.getMasterRoadmapDashboard();
      setDashboard(data);
    } catch (error) {
      toast.error(error.message || "Master Roadmap konnte nicht geladen werden.");
    } finally {
      if (withSpinner) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tasksByPhase = useMemo(() => {
    const map = new Map();
    for (const phase of dashboard?.phases || []) map.set(phase.title, []);
    for (const task of dashboard?.tasks || []) {
      const list = map.get(task.phase) || [];
      list.push(task);
      map.set(task.phase, list);
    }
    return map;
  }, [dashboard]);

  const p0Tasks = useMemo(() => (dashboard?.tasks || []).filter((task) => task.priority === "P0 Critical" && task.status !== "Completed"), [dashboard]);

  const updateTaskStatus = async (taskId, status) => {
    setSavingTask(taskId);
    try {
      await api.updateMasterRoadmapTask(taskId, { status });
      toast.success("Task-Status gespeichert.");
      await load(false);
    } catch (error) {
      toast.error(error.message || "Task-Status konnte nicht gespeichert werden.");
    } finally {
      setSavingTask("");
    }
  };

  const updateGateStatus = async (gateKey, status) => {
    setSavingGate(gateKey);
    try {
      await api.updateMasterRoadmapGate(gateKey, { status });
      toast.success("Gate-Status gespeichert.");
      await load(false);
    } catch (error) {
      toast.error(error.message || "Gate-Status konnte nicht gespeichert werden.");
    } finally {
      setSavingGate("");
    }
  };

  const toggleFeatureFlag = async (moduleKey, field, currentValue) => {
    try {
      await api.updateMasterRoadmapFeature(moduleKey, { [field]: !currentValue });
      toast.success("Registry aktualisiert.");
      await load(false);
    } catch (error) {
      toast.error(error.message || "Registry konnte nicht aktualisiert werden.");
    }
  };

  if (loading || !dashboard) return <div className="min-h-screen bg-[#030507]" data-testid="admin-master-roadmap-loading" />;

  const finalAcceptance = dashboard.final_acceptance || { rows: [] };
  const versionSnapshot = dashboard.version_snapshot || {};
  const envSnapshot = dashboard.environment_snapshot || {};
  const walletDiagnostics = dashboard.wallet_diagnostics || {};

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-master-roadmap-page">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-master-roadmap-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">BidBlitz Master Roadmap</h1>
              <p className="text-sm text-white/62">Controlled beta control center für Web, iOS und Android. Kein grüner Launch solange P0 offen ist.</p>
            </div>
          </div>
          <Button onClick={() => load()} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="admin-master-roadmap-refresh-button"><RefreshCw size={16} className="mr-2" />Neu laden</Button>
        </div>

        <div className={`rounded-[28px] border p-5 ${dashboard.launch_readiness?.launch_ready ? "border-emerald-400/25 bg-emerald-500/10" : "border-rose-400/25 bg-rose-500/10"}`} data-testid="admin-master-roadmap-launch-banner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">Launch Readiness</div>
              <div className="mt-2 text-3xl font-black text-white">{dashboard.launch_readiness?.launch_ready ? "Launch Ready" : "Nicht Launch Ready"}</div>
              <p className="mt-2 max-w-3xl text-sm text-white/72">{dashboard.launch_readiness?.message}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <StatCard label="Offene P0" value={dashboard.launch_readiness?.open_p0_tasks || 0} testId="admin-master-roadmap-open-p0" />
              <StatCard label="Blockierte Gates" value={dashboard.launch_readiness?.blocked_gates || 0} testId="admin-master-roadmap-blocked-gates" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Build ID" value={dashboard.ceo_view?.current_web_build_id || "unknown"} helper={dashboard.ceo_view?.current_web_commit || "-"} testId="admin-master-roadmap-build-id" />
          <StatCard label="Staging URL" value={dashboard.ceo_view?.current_staging_url || "unknown"} testId="admin-master-roadmap-staging-url" />
          <StatCard label="Wallet Source" value={walletDiagnostics.canonical_visible_source || "unknown"} helper={`Duplicate endpoints: ${walletDiagnostics.duplicate_balance_endpoints || 0}`} testId="admin-master-roadmap-wallet-source" />
          <StatCard label="Asset Delivery" value={versionSnapshot.asset_delivery || "unknown"} helper={`iOS parity: ${versionSnapshot.ios_bundle_parity ? "ok" : "offen"}`} testId="admin-master-roadmap-asset-delivery" />
        </div>

        <SectionCard title="P0 Blocker" subtitle="Diese Themen blockieren jede Beta-Freigabe." testId="admin-master-roadmap-p0-section">
          <div className="grid gap-3">
            {p0Tasks.map((task, index) => (
              <div key={task.task_id} className="rounded-[22px] border border-white/10 bg-[#071019]/92 p-4" data-testid={`admin-master-roadmap-p0-task-${index + 1}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#82E7FF]"><span>{task.task_id}</span><span>•</span><span>{task.responsible_role}</span></div>
                    <h3 className="mt-2 text-xl font-black text-white">{task.title}</h3>
                    <p className="mt-2 text-sm text-white/68">{task.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusPill value={task.status} testId={`admin-master-roadmap-p0-status-${index + 1}`} />
                    <Select value={task.status} onValueChange={(value) => updateTaskStatus(task.task_id, value)} disabled={savingTask === task.task_id}>
                      <SelectTrigger className="w-[220px] border-white/10 bg-white/5 text-white" data-testid={`admin-master-roadmap-p0-status-select-${index + 1}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{(dashboard.status_choices || []).map((choice) => <SelectItem key={choice} value={choice}>{choice}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-white/68">
                  <div><span className="font-bold text-white/88">Effort:</span> {task.estimated_effort}</div>
                  <div><span className="font-bold text-white/88">Target:</span> {task.target_date || "-"}</div>
                  <div><span className="font-bold text-white/88">Security:</span> {task.security_impact}</div>
                  <div><span className="font-bold text-white/88">Financial:</span> {task.financial_impact}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SectionCard title="Release Gates" subtitle="Kein Deploy wenn ein Pflicht-Gate offen ist." testId="admin-master-roadmap-gates-section">
            <div className="space-y-3">
              {(dashboard.release_gates || []).map((gate, index) => (
                <div key={gate.gate_key} className="rounded-[20px] border border-white/10 bg-white/5 p-4" data-testid={`admin-master-roadmap-gate-${index + 1}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">{gate.label}</div>
                      <div className="mt-2 text-xs text-white/54 break-words">{gate.notes}</div>
                      <div className="mt-2 text-xs text-[#82E7FF] break-all">{gate.recorded_value || "-"}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill value={gate.status} testId={`admin-master-roadmap-gate-status-${index + 1}`} />
                      <Select value={gate.status} onValueChange={(value) => updateGateStatus(gate.gate_key, value)} disabled={savingGate === gate.gate_key}>
                        <SelectTrigger className="w-[190px] border-white/10 bg-white/5 text-white" data-testid={`admin-master-roadmap-gate-select-${index + 1}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{["verified", "incomplete", "blocked", "manual-approval"].map((choice) => <SelectItem key={choice} value={choice}>{choice}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="CEO / Executive View" subtitle="Echte aktuelle Daten aus Tasks, Gates und Build-Infos." testId="admin-master-roadmap-ceo-view-section">
            <div className="grid gap-3 md:grid-cols-2">
              <StatCard label="P0 Blocker" value={(dashboard.ceo_view?.p0_blockers || []).length} testId="admin-master-roadmap-ceo-p0" />
              <StatCard label="Verzögerte Tasks" value={(dashboard.ceo_view?.tasks_delayed || []).length} testId="admin-master-roadmap-ceo-delayed" />
              <StatCard label="Security Risks" value={(dashboard.ceo_view?.open_security_risks || []).length} testId="admin-master-roadmap-ceo-security" />
              <StatCard label="Financial Risks" value={(dashboard.ceo_view?.open_financial_risks || []).length} testId="admin-master-roadmap-ceo-financial" />
            </div>
            <div className="mt-4 space-y-3">
              {(dashboard.ceo_view?.next_five_priorities || []).map((task, index) => (
                <div key={task.task_id} className="rounded-[18px] border border-white/10 bg-[#071019]/92 p-3" data-testid={`admin-master-roadmap-ceo-next-task-${index + 1}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold text-white">{task.task_id} · {task.title}</div><StatusPill value={task.status} testId={`admin-master-roadmap-ceo-next-status-${index + 1}`} /></div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Diagnosen" subtitle="Wallet, Umgebungen und Version-Parität für controlled beta." testId="admin-master-roadmap-diagnostics-section">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid="admin-master-roadmap-wallet-diagnostics-card">
              <h3 className="text-lg font-black text-white">Wallet</h3>
              <div className="mt-3 space-y-2 text-sm text-white/68">
                <div>Canonical Source: <span className="text-white">{walletDiagnostics.canonical_visible_source || "unknown"}</span></div>
                <div>Duplicate /balance endpoints: <span className="text-white">{walletDiagnostics.duplicate_balance_endpoints || 0}</span></div>
                <div>Legacy super-app read path: <span className="text-white">{walletDiagnostics.has_legacy_super_app_balance ? "ja" : "nein"}</span></div>
                <div>Reconciliation API: <span className="text-[#82E7FF]">{walletDiagnostics.reconciliation_endpoint || "-"}</span></div>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid="admin-master-roadmap-env-card">
              <h3 className="text-lg font-black text-white">Environment</h3>
              <div className="mt-3 space-y-2 text-sm text-white/68 break-words">
                <div>Preview disable KYC: <span className="text-white">{envSnapshot.frontend_env?.REACT_APP_DISABLE_KYC || "unset"}</span></div>
                <div>Prod disable KYC: <span className="text-white">{envSnapshot.frontend_production_env?.REACT_APP_DISABLE_KYC || "unset"}</span></div>
                <div>Prod demo mode: <span className="text-white">{envSnapshot.frontend_production_env?.REACT_APP_DEMO_MODE || "unset"}</span></div>
                <div>Prod mock payments: <span className="text-white">{envSnapshot.frontend_production_env?.REACT_APP_MOCK_PAYMENTS || "unset"}</span></div>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid="admin-master-roadmap-version-card">
              <h3 className="text-lg font-black text-white">Version Parity</h3>
              <div className="mt-3 space-y-2 text-sm text-white/68 break-words">
                <div>Web build exists: <span className="text-white">{versionSnapshot.web_build_exists ? "ja" : "nein"}</span></div>
                <div>iOS root bundle: <span className="text-white">{versionSnapshot.ios_root_bundle_exists ? "ja" : "nein"}</span></div>
                <div>iOS frontend bundle: <span className="text-white">{versionSnapshot.ios_frontend_bundle_exists ? "ja" : "nein"}</span></div>
                <div>iOS parity: <span className="text-white">{versionSnapshot.ios_bundle_parity ? "ok" : "offen"}</span></div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Feature Registry" subtitle="Store-safe, Web-Production und Mobile-Freigabe pro Modul." testId="admin-master-roadmap-registry-section">
          <div className="grid gap-3">
            {(dashboard.feature_registry || []).map((item, index) => (
              <div key={item.module_key} className="rounded-[20px] border border-white/10 bg-white/5 p-4" data-testid={`admin-master-roadmap-registry-row-${index + 1}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">{item.name}</div>
                    <div className="mt-1 text-xs text-[#82E7FF]">{item.module_key} · {item.phase}</div>
                    <div className="mt-2 text-sm text-white/62">{item.notes || "Keine Zusatznotiz"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => toggleFeatureFlag(item.module_key, "store_safe", item.store_safe)} className={`rounded-full border px-3 py-2 text-xs font-bold ${item.store_safe ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-200" : "border-white/10 bg-white/5 text-white/72"}`} data-testid={`admin-master-roadmap-registry-store-safe-${index + 1}`}>Store Safe: {item.store_safe ? "Ja" : "Nein"}</button>
                    <button onClick={() => toggleFeatureFlag(item.module_key, "enabled_in_web_production", item.enabled_in_web_production)} className={`rounded-full border px-3 py-2 text-xs font-bold ${item.enabled_in_web_production ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/5 text-white/72"}`} data-testid={`admin-master-roadmap-registry-web-${index + 1}`}>Web Prod: {item.enabled_in_web_production ? "An" : "Aus"}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Phasen und Tasks" subtitle="Die Final BidBlitz Completion Phase ist hier vollständig strukturiert." testId="admin-master-roadmap-phases-section">
          <div className="space-y-4">
            {(dashboard.phases || []).map((phase, phaseIndex) => {
              const Icon = phaseIcons[phase.title] || FileCheck2;
              const phaseTasks = tasksByPhase.get(phase.title) || [];
              return (
                <details key={phase.phase_id} className="rounded-[24px] border border-white/10 bg-white/5 p-4" open={phaseIndex < 2} data-testid={`admin-master-roadmap-phase-${phaseIndex + 1}`}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]"><Icon size={18} /></div><div><div className="text-xl font-black text-white">{phase.title}</div><div className="text-sm text-white/62">{phase.description}</div></div></div>
                    <div className="flex flex-wrap gap-2"><StatusPill value={`${phase.average_completion}%`} testId={`admin-master-roadmap-phase-progress-${phaseIndex + 1}`} /><StatusPill value={`${phase.completed}/${phase.task_count} completed`} testId={`admin-master-roadmap-phase-count-${phaseIndex + 1}`} /></div>
                  </summary>
                  <div className="mt-4 grid gap-3">
                    {phaseTasks.map((task, index) => (
                      <div key={task.task_id} className="rounded-[20px] border border-white/8 bg-[#071019]/92 p-4" data-testid={`admin-master-roadmap-task-${phaseIndex + 1}-${index + 1}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#82E7FF]"><span>{task.task_id}</span><span>•</span><span>{task.priority}</span><span>•</span><span>{task.responsible_role}</span></div>
                            <h3 className="mt-2 text-lg font-black text-white">{task.title}</h3>
                            <p className="mt-2 text-sm text-white/68">{task.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <StatusPill value={task.status} testId={`admin-master-roadmap-task-status-${phaseIndex + 1}-${index + 1}`} />
                            <Select value={task.status} onValueChange={(value) => updateTaskStatus(task.task_id, value)} disabled={savingTask === task.task_id}>
                              <SelectTrigger className="w-[210px] border-white/10 bg-white/5 text-white" data-testid={`admin-master-roadmap-task-select-${phaseIndex + 1}-${index + 1}`}><SelectValue /></SelectTrigger>
                              <SelectContent>{(dashboard.status_choices || []).map((choice) => <SelectItem key={choice} value={choice}>{choice}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-white/68">
                          <div><span className="font-bold text-white/88">Dependencies:</span> {(task.dependencies || []).join(", ") || "-"}</div>
                          <div><span className="font-bold text-white/88">Effort:</span> {task.estimated_effort}</div>
                          <div><span className="font-bold text-white/88">Target:</span> {task.target_date || "-"}</div>
                          <div><span className="font-bold text-white/88">Progress:</span> {task.completion_percentage || 0}%</div>
                        </div>
                        <div className="mt-3 grid gap-3 xl:grid-cols-3 text-xs text-white/54">
                          <div><span className="font-bold text-white/72">Frontend:</span> {(task.affected_frontend_files || []).join(" · ") || "-"}</div>
                          <div><span className="font-bold text-white/72">Backend:</span> {(task.affected_backend_files || []).join(" · ") || "-"}</div>
                          <div><span className="font-bold text-white/72">APIs:</span> {(task.affected_api_routes || []).join(" · ") || "-"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Final Acceptance Report" subtitle="Die App wird hier erst grün, wenn alle P0 geschlossen sind." testId="admin-master-roadmap-final-acceptance-section">
          <div className="overflow-x-auto rounded-[22px] border border-white/10">
            <table className="min-w-full text-left text-sm" data-testid="admin-master-roadmap-final-acceptance-table">
              <thead className="bg-white/5 text-white/72">
                <tr>
                  {[
                    "Feature", "Web", "iOS", "Android", "Backend", "Tests", "Blocker", "Beta",
                  ].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {(finalAcceptance.rows || []).map((row, index) => (
                  <tr key={row.feature} className="border-t border-white/10" data-testid={`admin-master-roadmap-final-row-${index + 1}`}>
                    <td className="px-4 py-3 font-bold text-white">{row.feature}</td>
                    <td className="px-4 py-3 text-white/72">{row.web_status}</td>
                    <td className="px-4 py-3 text-white/72">{row.ios_status}</td>
                    <td className="px-4 py-3 text-white/72">{row.android_status}</td>
                    <td className="px-4 py-3 text-white/72">{row.backend_status}</td>
                    <td className="px-4 py-3 text-white/72">{row.tests}</td>
                    <td className="px-4 py-3 text-white/72">{row.blocker}</td>
                    <td className="px-4 py-3"><StatusPill value={row.ready_for_beta ? "Yes" : "No"} testId={`admin-master-roadmap-final-beta-${index + 1}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <div className="rounded-[20px] border border-white/10 bg-white/5 p-4" data-testid="admin-master-roadmap-remaining-p0-card">
              <div className="text-lg font-black text-white">Remaining P0</div>
              <div className="mt-3 space-y-2 text-sm text-white/68">{(finalAcceptance.remaining_p0_issues || []).map((item, index) => <div key={item.task_id} data-testid={`admin-master-roadmap-remaining-p0-${index + 1}`}>{item.task_id} · {item.title} · {item.status}</div>)}</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/5 p-4" data-testid="admin-master-roadmap-release-meta-card">
              <div className="text-lg font-black text-white">Release Meta</div>
              <div className="mt-3 space-y-2 text-sm text-white/68 break-words">
                <div>Commit: {finalAcceptance.commit_hash || "unknown"}</div>
                <div>Staging: {finalAcceptance.staging_url || "unknown"}</div>
                <div>Production: {finalAcceptance.production_url || "unknown"}</div>
                <div>TestFlight: {finalAcceptance.testflight_readiness || "unknown"}</div>
                <div>Google Play: {finalAcceptance.google_play_readiness || "unknown"}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#82E7FF]">{(finalAcceptance.workflows_passed || []).map((item, index) => <span key={`${item}-${index}`} className="rounded-full border border-[#82E7FF]/20 bg-[#82E7FF]/10 px-3 py-1" data-testid={`admin-master-roadmap-passed-workflow-${index + 1}`}>{item}</span>)}</div>
            </div>
          </div>
          <div className="mt-4 text-right">
            <a href="/investors/progress" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white" data-testid="admin-master-roadmap-investor-progress-link">Investor Progress View <ExternalLink size={14} /></a>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}