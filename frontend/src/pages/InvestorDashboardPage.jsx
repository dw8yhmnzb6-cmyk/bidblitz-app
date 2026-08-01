import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Building2, CalendarDays, Download, FileText, Globe2, LifeBuoy, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useI18n } from "../store";
import { api } from "../services/api";
import { useInvestorDashboardTranslations } from "../models/investorDashboardTranslations";

const capitalColors = ["#06B6D4", "#3B82F6", "#7DD3FC", "#38BDF8", "#60A5FA", "#93C5FD"];
const stageColors = { Completed: "bg-emerald-500/12 text-emerald-200", Current: "bg-[#06B6D4]/12 text-[#9BE8FF]", Next: "bg-amber-500/12 text-amber-200", Planned: "bg-white/10 text-white/80" };

function formatCurrency(value, locale = "de") {
  if (typeof value !== "number") return null;
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR" }).format(value);
}

export default function InvestorDashboardPage({ onNavigate }) {
  const { language } = useI18n();
  const t = useInvestorDashboardTranslations(language);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInvestorDashboard()
      .then(setData)
      .catch((error) => {
        toast.error(error.message || "Investor Dashboard konnte nicht geladen werden.");
        if (error.status === 401) onNavigate("/investor-login");
      })
      .finally(() => setLoading(false));
  }, [onNavigate]);

  const capitalData = useMemo(() => (data?.use_of_capital || []).map((item, index) => ({ ...item, fill: capitalColors[index % capitalColors.length] })), [data]);

  if (loading || !data) return <div className="min-h-screen bg-[#030507]" data-testid="investor-dashboard-loading" />;

  const funding = data.funding_round || {};

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="investor-dashboard-page">
      <div className="mx-auto max-w-7xl space-y-5">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_28%),linear-gradient(145deg,rgba(4,8,14,0.99),rgba(6,13,20,0.98)_45%,rgba(4,7,11,1))] p-6 shadow-[0_20px_44px_rgba(0,0,0,0.24)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/20 bg-[#06B6D4]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#9BE8FF]" data-testid="investor-dashboard-badge">
            <Building2 size={12} />
            {t("badge")}
          </div>
          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl" data-testid="investor-dashboard-title">{data.header?.title || t("title")}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72 sm:text-base" data-testid="investor-dashboard-subtitle">{data.header?.subtitle || t("subtitle")}</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/72" data-testid="investor-dashboard-generated-at">
              {t("latestGenerated")}: {data.header?.generated_at?.replace("T", " ").slice(0, 16) || "-"}
            </div>
          </div>
        </motion.section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <SectionCard title={t("developmentStatus")} icon={Activity} testId="investor-dashboard-development-status">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(data.development_status || []).map((item, index) => (
                <div key={item.key || item.label} className="rounded-[24px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-dev-card-${index + 1}`}>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{item.label}</div>
                  <div className="mt-3 inline-flex rounded-full border border-white/10 bg-[#06B6D4]/10 px-3 py-1 text-xs font-bold text-[#9BE8FF]">{item.status}</div>
                  <div className="mt-3 text-xs text-white/56">{t("latestGenerated")}: {item.last_update?.replace("T", " ").slice(0, 16) || "-"}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t("roadmapProgress")} icon={CalendarDays} testId="investor-dashboard-roadmap-progress">
            <div className="space-y-3">
              {(data.roadmap_progress || []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-[22px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-roadmap-item-${index + 1}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-black text-white">{item.title}</div>
                    <div className={`rounded-full border border-white/10 px-3 py-1 text-xs font-bold ${stageColors[item.stage] || stageColors.Planned}`}>{item.stage}</div>
                  </div>
                  {item.note ? <p className="mt-2 text-sm leading-6 text-white/68">{item.note}</p> : null}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title={t("businessKpis")} icon={Globe2} testId="investor-dashboard-business-kpis">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(data.business_kpis || []).map((item, index) => (
              <div key={item.key} className="rounded-[24px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-kpi-${index + 1}`}>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{item.label}</p>
                <div className="mt-3 text-2xl font-black text-white break-words">{item.display}</div>
                <div className="mt-3 text-xs text-white/56">{item.verified ? t("sourceVerified") : t("sourceUnavailable")}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={t("productModules")} icon={PieChartIcon} testId="investor-dashboard-product-modules">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(data.product_modules || []).map((item, index) => (
              <div key={item.key} className="rounded-[24px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-module-${index + 1}`}>
                <h3 className="text-xl font-black text-white">{item.title}</h3>
                <div className="mt-3 space-y-2 text-sm text-white/72">
                  <p><span className="font-bold text-white/88">{t("currentStatus")}: </span>{item.current_status || t("noData")}</p>
                  <p><span className="font-bold text-white/88">{t("developmentPhase")}: </span>{item.development_phase || t("noData")}</p>
                  <p><span className="font-bold text-white/88">{t("plannedNextMilestone")}: </span>{item.next_milestone || t("noData")}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <SectionCard title={t("investmentOverview")} icon={Building2} testId="investor-dashboard-investment-overview">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [t("fundingRoundStatus"), funding.status_label || t("noData")],
                [t("targetAmount"), formatCurrency(funding.target_amount, language) || t("noData")],
                [t("amountReserved"), formatCurrency(funding.amount_reserved, language) || t("noData")],
                [t("remainingAllocation"), formatCurrency(funding.remaining_allocation, language) || t("noData")],
                [t("minimumInvestment"), formatCurrency(funding.minimum_investment, language) || t("noData")],
                [t("maximumEquity"), typeof funding.maximum_total_equity_available === "number" ? `${funding.maximum_total_equity_available} %` : t("noData")],
              ].map(([label, value], index) => (
                <div key={label} className="rounded-[20px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-funding-card-${index + 1}`}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</p>
                  <div className="mt-3 text-lg font-black text-white break-words">{value}</div>
                </div>
              ))}
            </div>
            {funding.notes ? <p className="mt-4 text-sm leading-6 text-white/68">{funding.notes}</p> : null}
          </SectionCard>

          <SectionCard title={t("useOfCapital")} icon={PieChartIcon} testId="investor-dashboard-use-of-capital">
            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="h-[240px] rounded-[24px] border border-white/8 bg-[#071019]/92 p-2" data-testid="investor-dashboard-capital-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={capitalData} dataKey="percentage" nameKey="label" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2}>
                      {capitalData.map((entry, index) => <Cell key={entry.key || index} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {capitalData.map((item, index) => (
                  <div key={item.key} className="rounded-[20px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-capital-card-${index + 1}`}>
                    <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: item.fill }} /><span className="text-sm font-bold text-white/88">{item.label}</span></div>
                    <div className="mt-3 text-2xl font-black text-white">{item.percentage}%</div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <SectionCard title={t("latestUpdates")} icon={LifeBuoy} testId="investor-dashboard-latest-updates">
            <div className="space-y-3">
              {(data.latest_updates || []).map((item, index) => (
                <article key={`${item.title}-${index}`} className="rounded-[22px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-update-${index + 1}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-black text-white">{item.title}</h3><span className="text-xs text-[#82E7FF]">{item.date}</span></div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-white/48">{item.category}</p>
                  <p className="mt-3 text-sm leading-6 text-white/68">{item.description}</p>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t("documents")} icon={FileText} testId="investor-dashboard-documents">
            <div className="space-y-3">
              {(data.documents || []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-[22px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-document-${index + 1}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-white">{item.title}</h3>
                      <p className="mt-2 text-xs text-white/56">{t("version")}: {item.version || "-"} · {t("date")}: {item.date || "-"}</p>
                    </div>
                    {item.download_url ? <button onClick={() => window.open(item.download_url, "_blank")} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white" data-testid={`investor-dashboard-document-download-${index + 1}`}><Download size={14} /> {t("download")}</button> : null}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title={t("contact")} icon={Building2} testId="investor-dashboard-contact">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{t("investorRelations")}</div>
              <div className="mt-3 text-lg font-black text-white">{data.contact?.investor_relations_name || t("investorRelations")}</div>
              <p className="mt-2 text-sm text-white/68">Email: {data.contact?.email || t("noData")}</p>
              <p className="mt-1 text-sm text-white/68">Telefon: {data.contact?.telephone || t("noData")}</p>
            </div>
            <div className="rounded-[24px] border border-[#06B6D4]/16 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),linear-gradient(145deg,rgba(3,10,15,0.98),rgba(5,11,18,0.98))] p-4">
              <p className="text-sm leading-6 text-white/72">{t("contact")} · {t("meetingRequest")}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => onNavigate(data.contact?.meeting_request_url || "/investor-portal/meetings")} className="inline-flex h-12 items-center justify-center rounded-full bg-[#06B6D4] px-5 text-sm font-black text-[#041018] hover:bg-[#33c7e0]" data-testid="investor-dashboard-meeting-request-button">{t("meetingRequest")}</button>
                {data.contact?.email ? <button onClick={() => window.location.href = `mailto:${data.contact.email}`} className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-sm font-bold text-white" data-testid="investor-dashboard-email-button">{t("email")}</button> : null}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, testId }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]"><Icon size={18} /></div>
        <h2 className="text-[28px] font-black leading-tight text-white">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}