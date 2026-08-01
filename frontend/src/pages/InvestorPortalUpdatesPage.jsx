import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useInvestorPortalSession } from "../components/investor/useInvestorPortalSession";
import { InvestorPortalShell } from "../components/investor/InvestorPortalShell";

export default function InvestorPortalUpdatesPage({ onNavigate }) {
  const { account, loading } = useInvestorPortalSession(onNavigate);
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    if (!account) return;
    api.getInvestorPortalUpdates().then((data) => setUpdates(data.updates || [])).catch((error) => toast.error(error.message || "Updates konnten nicht geladen werden."));
  }, [account]);
  const handleLogout = async () => { await api.investorPortalLogout(); onNavigate("/investor-login"); };
  if (loading || !account) return <div className="min-h-screen bg-[#030507]" />;

  return (
    <InvestorPortalShell account={account} title="Investor Updates" subtitle="Regelmäßige Informationen zur Entwicklung, Roadmap und Kommunikation der geplanten Finanzierungsrunde." activePath="/investor-portal/updates" onNavigate={onNavigate} onLogout={handleLogout}>
      <div className="space-y-4">
        {updates.map((item, index) => (
          <article key={item.update_id} className="rounded-[24px] border border-white/8 bg-white/5 p-5" data-testid={`investor-update-card-${index + 1}`}>
            <div className="text-xs text-[#82E7FF]">{item.published_at?.slice(0, 10)}</div>
            <h3 className="mt-2 text-xl font-black text-white">{item.title}</h3>
            <p className="mt-2 text-sm font-semibold text-white/78">{item.summary}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/68">{item.body}</p>
          </article>
        ))}
      </div>
    </InvestorPortalShell>
  );
}