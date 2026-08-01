import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useInvestorPortalSession } from "../components/investor/useInvestorPortalSession";
import { InvestorPortalShell } from "../components/investor/InvestorPortalShell";
import { InvestorStatusBadge } from "../components/investor/InvestorStatusBadge";

export default function InvestorPortalPage({ onNavigate }) {
  const { account, loading } = useInvestorPortalSession(onNavigate);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    if (!account) return;
    api.getInvestorPortalDashboard().then(setDashboard).catch((error) => toast.error(error.message || "Investor-Dashboard konnte nicht geladen werden."));
  }, [account]);

  const handleLogout = async () => {
    await api.investorPortalLogout();
    onNavigate("/investor-login");
  };

  if (loading || !account) return <div className="min-h-screen bg-[#030507]" data-testid="investor-portal-loading" />;

  const cards = [
    { label: "Status", value: <InvestorStatusBadge status={account.status} dataTestId="investor-dashboard-status-badge" /> },
    { label: "Dokumente", value: dashboard?.documents_total || 0 },
    { label: "Updates", value: dashboard?.updates_total || 0 },
    { label: "Meetings", value: dashboard?.meetings_total || 0 },
  ];

  return (
    <InvestorPortalShell account={account} title="Investor Übersicht" subtitle="Dein geschützter Überblick über den aktuellen Qualifizierungsstand, Unterlagen, Updates und Kommunikation." activePath="/investor-portal" onNavigate={onNavigate} onLogout={handleLogout}>
      <div className="grid gap-4 lg:grid-cols-4">
        {cards.map(({ label, value }, index) => (
          <div key={label} className="rounded-[24px] border border-white/8 bg-white/5 p-4" data-testid={`investor-dashboard-card-${index + 1}`}>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</p>
            <div className="mt-3 text-2xl font-black text-white">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {[ ["Aktuelle Dokumente", dashboard?.latest_documents || [], "title"], ["Neueste Updates", dashboard?.latest_updates || [], "title"], ["Letzte Meetings", dashboard?.latest_meetings || [], "meeting_title"] ].map(([title, items, field], colIndex) => (
          <div key={title} className="rounded-[24px] border border-white/8 bg-[#071019]/92 p-4" data-testid={`investor-dashboard-column-${colIndex + 1}`}>
            <h3 className="text-lg font-black text-white">{title}</h3>
            <div className="mt-4 space-y-3">
              {items.length ? items.map((item, index) => (
                <div key={`${title}-${index}`} className="rounded-[18px] border border-white/8 bg-white/5 p-3 text-sm text-white/78" data-testid={`investor-dashboard-column-${colIndex + 1}-item-${index + 1}`}>
                  <p className="font-bold text-white">{item[field]}</p>
                  <p className="mt-1 text-xs text-white/56">{item.summary || item.scheduled_for || item.updated_at}</p>
                </div>
              )) : <div className="rounded-[18px] border border-white/8 bg-white/5 p-3 text-sm text-white/56">Noch keine Einträge vorhanden.</div>}
            </div>
          </div>
        ))}
      </div>
    </InvestorPortalShell>
  );
}