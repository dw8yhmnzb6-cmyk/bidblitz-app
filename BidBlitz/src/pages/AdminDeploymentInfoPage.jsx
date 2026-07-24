import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw, Server } from "lucide-react";

import { api as apiService } from "../services/api";


function StatusPill({ ok, label }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold"
      style={{
        background: ok ? "rgba(0,210,106,0.12)" : "rgba(255,122,24,0.12)",
        color: ok ? "#00D26A" : "#FF7A18",
        border: `1px solid ${ok ? "rgba(0,210,106,0.24)" : "rgba(255,122,24,0.24)"}`,
      }}
      data-testid={`deployment-status-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
      {label}
    </div>
  );
}


function InfoCard({ title, rows, testId }) {
  return (
    <div
      className="rounded-[24px] border p-4"
      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
      data-testid={testId}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00C2FF]">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 text-[12px]">
            <span className="text-white/45">{row.label}</span>
            <span className="max-w-[58%] text-right font-semibold text-white break-all">{row.value || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function AdminDeploymentInfoPage({ onBack }) {
  const [previewInfo, setPreviewInfo] = useState(null);
  const [productionInfo, setProductionInfo] = useState(null);
  const [health, setHealth] = useState({ preview: null, production: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const comparison = await apiService.getSystemCompare();
      setPreviewInfo(comparison.preview || null);
      setProductionInfo(comparison.production || null);
      setHealth({ preview: comparison.preview_health, production: comparison.production_health });
    } catch (err) {
      setError(err.message || "Deployment-Informationen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const comparison = useMemo(() => {
    if (!previewInfo || !productionInfo) return { commitMatches: false, buildMatches: false };
    return {
      commitMatches: previewInfo.git_commit === productionInfo.git_commit,
      buildMatches: previewInfo.build_id === productionInfo.build_id,
    };
  }, [previewInfo, productionInfo]);

  return (
    <div className="min-h-screen bg-[#030303] pb-24" data-testid="admin-deployment-info-page">
      <div className="mx-auto max-w-5xl px-4 pt-[max(env(safe-area-inset-top,0px),20px)] sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
            data-testid="admin-deployment-info-back"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full border border-[#00C2FF]/20 bg-[#00C2FF]/10 px-4 py-2 text-xs font-bold text-[#00C2FF]"
            data-testid="admin-deployment-info-refresh"
          >
            <RefreshCw size={14} /> Neu laden
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 rounded-[28px] border border-white/6 bg-white/[0.03] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00C2FF]">Deployment Information</p>
              <h1 className="mt-2 text-2xl font-bold text-white" data-testid="deployment-info-title">Preview vs. Production</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/65" data-testid="deployment-info-subtitle">
                Commit-, Build- und Health-Vergleich zwischen dem getesteten Preview-Stand und der Live-Seite.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill ok={comparison.commitMatches} label={comparison.commitMatches ? "Commit identisch" : "Commit abweichend"} />
              <StatusPill ok={comparison.buildMatches} label={comparison.buildMatches ? "Build identisch" : "Build abweichend"} />
            </div>
          </div>

          {loading && <p className="mt-5 text-sm text-white/55" data-testid="deployment-info-loading">Lade Versionsdaten…</p>}
          {error && <p className="mt-5 text-sm font-semibold text-[#FF7A18]" data-testid="deployment-info-error">{error}</p>}

          {!loading && !error && previewInfo && productionInfo && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <InfoCard
                title="Preview"
                testId="deployment-preview-card"
                rows={[
                  { label: "Environment", value: previewInfo.environment },
                  { label: "Frontend Version", value: previewInfo.frontend_version },
                  { label: "Backend Version", value: previewInfo.backend_version },
                  { label: "Commit", value: previewInfo.git_commit },
                  { label: "Build ID", value: previewInfo.build_id },
                  { label: "Deploy-Zeit", value: previewInfo.deployed_at },
                  { label: "API Base URL", value: previewInfo.api_base_url },
                  { label: "Service Worker", value: previewInfo.service_worker_version },
                ]}
              />
              <InfoCard
                title="Production"
                testId="deployment-production-card"
                rows={[
                  { label: "Environment", value: productionInfo.environment },
                  { label: "Frontend Version", value: productionInfo.frontend_version },
                  { label: "Backend Version", value: productionInfo.backend_version },
                  { label: "Commit", value: productionInfo.git_commit },
                  { label: "Build ID", value: productionInfo.build_id },
                  { label: "Deploy-Zeit", value: productionInfo.deployed_at },
                  { label: "API Base URL", value: productionInfo.api_base_url },
                  { label: "Service Worker", value: productionInfo.service_worker_version },
                ]}
              />
            </div>
          )}

          {!loading && !error && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/6 bg-black/20 p-4" data-testid="deployment-health-card">
                <div className="flex items-center gap-2 text-white">
                  <Server size={16} className="text-[#00C2FF]" />
                  <p className="text-sm font-bold">Health-Checks</p>
                </div>
                <div className="mt-3 space-y-2 text-[12px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/50">Preview Probe</span>
                    <StatusPill ok={health.preview?.ok !== false} label={health.preview?.status || health.preview?.summary || "ok"} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/50">Production Probe</span>
                    <StatusPill ok={health.production?.ok !== false} label={health.production?.status || health.production?.summary || "ok"} />
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] border border-white/6 bg-black/20 p-4" data-testid="deployment-status-card">
                <p className="text-sm font-bold text-white">Deployment Status</p>
                <div className="mt-3 space-y-2 text-[12px] text-white/68">
                  <p data-testid="deployment-status-preview-commit">Preview Commit: <span className="font-semibold text-white">{previewInfo?.git_commit || "—"}</span></p>
                  <p data-testid="deployment-status-production-commit">Production Commit: <span className="font-semibold text-white">{productionInfo?.git_commit || "—"}</span></p>
                  <p data-testid="deployment-status-last-success">Last successful deployment: <span className="font-semibold text-white">{productionInfo?.deployed_at || "unbekannt"}</span></p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}