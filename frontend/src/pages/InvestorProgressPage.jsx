import { useEffect, useState } from "react";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

export default function InvestorProgressPage({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInvestorProgress()
      .then(setData)
      .catch((error) => toast.error(error.message || "Investor Progress konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="min-h-screen bg-[#030507]" data-testid="investor-progress-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="investor-progress-page">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="investor-progress-back-button"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-3xl font-black text-white">BidBlitz Progress</h1>
            <p className="text-sm text-white/62">Restriktive Fortschrittsansicht ohne Kundendaten, Credentials, Sicherheitsdetails oder offene Schwachstellen.</p>
          </div>
        </div>

        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_28%),linear-gradient(145deg,rgba(4,8,14,0.99),rgba(6,13,20,0.98)_45%,rgba(4,7,11,1))] p-6 shadow-[0_20px_44px_rgba(0,0,0,0.24)]" data-testid="investor-progress-hero">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/20 bg-[#06B6D4]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#9BE8FF]"><Building2 size={12} />Investor Progress</div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <MetricCard label="Aktuelle Phase" value={data.current_development_phase?.title || "-"} testId="investor-progress-current-phase" />
            <MetricCard label="Phase Progress" value={`${data.current_development_phase?.average_completion || 0}%`} testId="investor-progress-current-progress" />
            <MetricCard label="Web Build" value={data.released_app_versions?.web || "unknown"} testId="investor-progress-web-build" />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard title="Completed Milestones" icon={CheckCircle2} testId="investor-progress-completed-card">
            <div className="space-y-3">{(data.completed_milestones || []).map((item, index) => <RowCard key={item.task_id} title={`${item.task_id} · ${item.title}`} subtitle={item.phase} testId={`investor-progress-completed-${index + 1}`} />)}</div>
          </SectionCard>
          <SectionCard title="Next Planned Milestones" icon={Rocket} testId="investor-progress-next-card">
            <div className="space-y-3">{(data.next_planned_milestones || []).map((item, index) => <RowCard key={item.task_id} title={`${item.task_id} · ${item.title}`} subtitle={`${item.phase} · ${item.target_date || "ohne Datum"}`} testId={`investor-progress-next-${index + 1}`} />)}</div>
          </SectionCard>
        </div>

        <SectionCard title="Product Status" icon={CalendarDays} testId="investor-progress-product-card">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data.product_status || []).map((item, index) => (
              <div key={item.module_key} className="rounded-[22px] border border-white/10 bg-white/5 p-4" data-testid={`investor-progress-module-${index + 1}`}>
                <div className="text-lg font-black text-white">{item.name}</div>
                <div className="mt-2 text-xs text-[#82E7FF]">{item.module_key}</div>
                <div className="mt-3 space-y-1 text-sm text-white/68">
                  <div>Development: {item.enabled_in_development ? "An" : "Aus"}</div>
                  <div>Test: {item.enabled_in_test ? "An" : "Aus"}</div>
                  <div>Staging: {item.enabled_in_staging ? "An" : "Aus"}</div>
                  <div>Web Production: {item.enabled_in_web_production ? "An" : "Aus"}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Approved Company Updates" icon={Building2} testId="investor-progress-updates-card">
          <div className="space-y-3">{(data.approved_company_updates || []).map((item, index) => <RowCard key={`${item.title}-${index}`} title={item.title} subtitle={`${item.published_at || ""} · ${item.summary || ""}`} testId={`investor-progress-update-${index + 1}`} />)}</div>
          <p className="mt-4 text-xs text-white/46" data-testid="investor-progress-disclosure-policy">{data.disclosure_policy}</p>
        </SectionCard>
      </div>
    </div>
  );
}

function MetricCard({ label, value, testId }) {
  return <div className="rounded-[22px] border border-white/8 bg-white/5 p-4" data-testid={testId}><div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div><div className="mt-3 text-xl font-black text-white break-words">{value}</div></div>;
}

function SectionCard({ title, icon: Icon, children, testId }) {
  return <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]" data-testid={testId}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]"><Icon size={18} /></div><h2 className="text-[28px] font-black leading-tight text-white">{title}</h2></div><div className="mt-5">{children}</div></section>;
}

function RowCard({ title, subtitle, testId }) {
  return <div className="rounded-[22px] border border-white/10 bg-white/5 p-4" data-testid={testId}><div className="font-black text-white">{title}</div><div className="mt-2 text-sm text-white/62">{subtitle}</div></div>;
}