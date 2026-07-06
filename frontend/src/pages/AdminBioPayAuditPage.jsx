import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Fingerprint, ShieldAlert, Building2, Siren, Wrench } from "lucide-react";
import { motion } from "framer-motion";

import { api } from "../services/api";

export default function AdminBioPayAuditPage({ onBack }) {
  const [overview, setOverview] = useState({ terminals: [], sessions: [], diagnostics: [], fraud_by_merchant: [] });
  const [audit, setAudit] = useState({ audit_logs: [], alerts: [] });
  const [diagnostics, setDiagnostics] = useState({ diagnostics: [] });
  const [vendorDiagnostics, setVendorDiagnostics] = useState({ vendors: [], warning_workflows: [], terminals: [] });

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [overviewRes, auditRes, diagRes, vendorRes] = await Promise.all([
        api.getAdminBioPayOverview().catch(() => ({ terminals: [], sessions: [], diagnostics: [], fraud_by_merchant: [] })),
        api.getAdminBioPayAuditCenter().catch(() => ({ audit_logs: [], alerts: [] })),
        api.getAdminBioPayTerminalDiagnostics().catch(() => ({ diagnostics: [] })),
        api.getAdminBioPayVendorDiagnostics().catch(() => ({ vendors: [], warning_workflows: [], terminals: [] })),
      ]);
      if (!active) return;
      setOverview(overviewRes);
      setAudit(auditRes);
      setDiagnostics(diagRes);
      setVendorDiagnostics(vendorRes);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#06070A] text-white px-4 py-6" data-testid="admin-biopay-audit-page">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Admin Audit Center</p>
            <h1 className="text-3xl font-black mt-2">BioPay Audit & Diagnostics</h1>
          </div>
          <button type="button" onClick={onBack} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70" data-testid="admin-biopay-audit-back-button">Zurück</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AuditStatCard label="Terminals" value={overview.terminals?.length || 0} icon={Fingerprint} testId="admin-biopay-terminals-count" />
          <AuditStatCard label="Sessions" value={overview.sessions?.length || 0} icon={Activity} testId="admin-biopay-sessions-count" />
          <AuditStatCard label="Diagnostics" value={diagnostics.diagnostics?.length || 0} icon={ShieldAlert} testId="admin-biopay-diagnostics-count" />
          <AuditStatCard label="Alerts" value={audit.alerts?.length || 0} icon={AlertTriangle} testId="admin-biopay-alerts-count" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Vendor Diagnostics" testId="admin-biopay-vendor-diagnostics-list">
            {(vendorDiagnostics.vendors || []).slice(0, 10).map((item, index) => (
              <div key={`${item.vendor_name}-${index}`} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0" data-testid={`admin-biopay-vendor-item-${index}`}>
                <div>
                  <p className="text-sm font-semibold text-white/85 flex items-center gap-2"><Building2 size={14} className="text-white/45" />{item.vendor_name}</p>
                  <p className="text-[11px] text-white/45">{item.terminals_total} Terminals · {item.warning_terminals} Warning · {item.critical_terminals} Critical</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-[#7dd3fc]">{Number(item.avg_score || 0).toFixed(1)}</p>
                  <p className="text-[11px] text-white/45">Ø Score</p>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Warning Workflows" testId="admin-biopay-warning-workflows-list">
            {(vendorDiagnostics.warning_workflows || []).slice(0, 12).map((item, index) => (
              <div key={item.workflow_id} className="py-2 border-b border-white/5 last:border-0" data-testid={`admin-biopay-warning-workflow-${index}`}>
                <p className="text-sm font-semibold text-white/85 flex items-center gap-2"><Siren size={14} className={item.severity === "critical" ? "text-red-400" : "text-amber-300"} />{item.title}</p>
                <p className="text-[11px] text-white/45 mt-1">{item.terminal_id} · {item.vendor_name} · {item.recommended_action}</p>
              </div>
            ))}
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Merchant Fraud Summary" testId="admin-biopay-fraud-summary-list">
            {(overview.fraud_by_merchant || []).map((item) => (
              <div key={item.merchant_id} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-white/85">{item.merchant_id}</p>
                  <p className="text-[11px] text-white/45">Pending approvals: {item.pending_approvals || 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-[#ffb36f]">{Number(item.network_risk_score || 0).toFixed(1)}</p>
                  <p className="text-[11px] text-white/45">Risk score</p>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Terminal Diagnostics" testId="admin-biopay-terminal-diagnostics-list">
            {(diagnostics.diagnostics || []).slice(0, 20).map((item) => (
              <div key={item.diagnostic_id} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-white/85">{item.terminal_id}</p>
                  <p className="text-[11px] text-white/45">{item.check_type} · {(item.flags || []).join(", ") || "no flags"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white/85">{Number(item.score || 0).toFixed(1)}</p>
                  <p className="text-[10px] text-white/40">{String(item.created_at || "").slice(0, 16).replace("T", " ")}</p>
                </div>
              </div>
            ))}
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="BioPay Audit Logs" testId="admin-biopay-audit-logs-list">
            {(audit.audit_logs || []).slice(0, 20).map((item, index) => (
              <div key={`${item.event}-${index}`} className="py-2 border-b border-white/5 last:border-0">
                <p className="text-sm font-semibold text-white/85">{item.event}</p>
                <p className="text-[11px] text-white/45">{item.email || item.user_id || "—"} · {String(item.timestamp || "").slice(0, 16).replace("T", " ")}</p>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Security Alerts" testId="admin-biopay-security-alerts-list">
            {(audit.alerts || []).slice(0, 20).map((item) => (
              <div key={item.alert_id} className="py-2 border-b border-white/5 last:border-0">
                <p className="text-sm font-semibold text-white/85">{item.title}</p>
                <p className="text-[11px] text-white/45">{item.type} · {item.severity} · {String(item.created_at || "").slice(0, 16).replace("T", " ")}</p>
              </div>
            ))}
          </SectionCard>
        </div>

        <SectionCard title="Terminal Readiness" testId="admin-biopay-terminal-readiness-list">
          <div className="grid gap-3 lg:grid-cols-3">
            {(vendorDiagnostics.terminals || []).slice(0, 12).map((item, index) => (
              <div key={item.terminal_id} className="rounded-2xl border border-white/8 bg-black/20 p-3" data-testid={`admin-biopay-terminal-readiness-${index}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/85">{item.terminal_id}</p>
                  <Wrench size={14} className="text-white/45" />
                </div>
                <p className="mt-1 text-[11px] text-white/45">{item.store_id || "no store"} · {item.register_id || "no register"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-white/5 px-2 py-1 text-white/75">{item.health_status}</span>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-white/75">Score {Number(item.diagnostic_score || 0).toFixed(1)}</span>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-white/75">Palm {item.palm_enabled ? "on" : "off"}</span>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-white/75">Face {item.face_enabled ? "on" : "off"}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function AuditStatCard({ label, value, icon: Icon, testId }) {
  return (
    <motion.div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">{label}</p>
        <Icon size={15} className="text-white/45" />
      </div>
      <p className="text-2xl font-black text-white/90">{value}</p>
    </motion.div>
  );
}

function SectionCard({ title, children, testId }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4" data-testid={testId}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-3">{title}</p>
      <div>{children}</div>
    </div>
  );
}
