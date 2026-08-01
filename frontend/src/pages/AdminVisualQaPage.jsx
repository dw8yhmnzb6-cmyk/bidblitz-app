import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { api } from "../services/api";

export default function AdminVisualQaPage({ onBack }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api.getVisualQaDashboard();
      setDashboard(data);
    } catch (error) {
      toast.error(error.message || "Visual QA Dashboard konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const issues = dashboard?.issues || [];

  if (loading || !dashboard) return <div className="min-h-screen bg-[#030507]" data-testid="admin-visual-qa-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-visual-qa-page">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-visual-qa-back-button"><ArrowLeft size={18} /></button><div><h1 className="text-3xl font-black text-white">Visual QA Dashboard</h1><p className="text-sm text-white/62">Scans, Issues, Screenshots, Repair-Status und Pull-Request-Vorbereitung.</p></div></div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[["Last scan", dashboard.last_scan?.generated_at || "-"], ["Pages scanned", dashboard.pages_scanned], ["Passed", dashboard.passed], ["Failed", dashboard.failed], ["Critical issues", dashboard.critical_issues]].map(([label, value], index) => (
            <div key={label} className="rounded-[24px] border border-white/8 bg-white/5 p-4" data-testid={`admin-visual-qa-card-${index + 1}`}><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</p><div className="mt-3 text-xl font-black text-white break-words">{String(value)}</div></div>
          ))}
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black text-white">Issue History</h2><div className="text-sm text-white/62">Statuses: {(dashboard.status_choices || []).join(" · ")}</div></div>
          <div className="mt-5 space-y-4">
            {issues.map((issue, index) => (
              <div key={issue.issue_id} className="rounded-[24px] border border-white/8 bg-[#071019]/92 p-5" data-testid={`admin-visual-qa-issue-${index + 1}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#82E7FF]"><span>{issue.route}</span><span>•</span><span>{issue.viewport}</span><span>•</span><span>{issue.severity}</span></div>
                    <h3 className="mt-2 text-xl font-black text-white">{issue.problem}</h3>
                    <p className="mt-2 text-sm text-white/68">Komponente: {issue.affected_component || "-"} · Kategorie: {issue.category || "-"}</p>
                  </div>
                  <Select value={issue.status || "New"} onValueChange={async (value) => { await api.updateVisualQaIssueStatus(issue.issue_id, value); toast.success("Status gespeichert."); load(); }}>
                    <SelectTrigger className="w-[220px] border-white/10 bg-white/5 text-white" data-testid={`admin-visual-qa-status-select-${index + 1}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{(dashboard.status_choices || []).map((choice) => <SelectItem key={choice} value={choice}>{choice}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-[20px] border border-white/8 bg-white/5 p-4 text-sm text-white/72">
                    <p className="font-bold text-white/88">Suggested fix</p>
                    <p className="mt-2 whitespace-pre-wrap">{issue.suggested_fix || "-"}</p>
                    <p className="mt-3 text-xs text-white/48">Confidence: {issue.confidence ?? 0} · Safe to auto fix: {issue.safe_to_auto_fix ? "Yes" : "No"}</p>
                    <p className="mt-1 text-xs text-white/48">Source file: {issue.source_file || "-"}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LinkCard label="Before screenshot" href={issue.before_screenshot} testId={`admin-visual-qa-before-${index + 1}`} />
                    <LinkCard label="After screenshot" href={issue.after_screenshot} testId={`admin-visual-qa-after-${index + 1}`} />
                    <LinkCard label="Repair pull request" href={issue.repair_pr_link} testId={`admin-visual-qa-pr-${index + 1}`} />
                    <div className="rounded-[20px] border border-white/8 bg-white/5 p-4 text-sm text-white/68">Risk: {issue.risk_level || "low"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkCard({ label, href, testId }) {
  return href ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between rounded-[20px] border border-white/8 bg-white/5 p-4 text-sm font-bold text-white" data-testid={testId}>{label}<ExternalLink size={14} /></a> : <div className="rounded-[20px] border border-white/8 bg-white/5 p-4 text-sm text-white/52" data-testid={testId}>{label}: -</div>;
}