import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, Building2, ShieldCheck, Briefcase, Download, Loader2, TrendingUp, Wallet, Car, Zap } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path) {
  const res = await fetch(`${API}${path}`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Fehler");
  return data;
}

export default function ExecutiveCenterPage({ onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [franchise, setFranchise] = useState(null);
  const [partner, setPartner] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [launch, setLaunch] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [d, f, p, c, l] = await Promise.all([
          api("/api/executive/dashboard"),
          api("/api/executive/franchise-dashboard"),
          api("/api/executive/partner-portal"),
          api("/api/executive/compliance-center"),
          api("/api/executive/launch-certification"),
        ]);
        if (!mounted) return;
        setDashboard(d);
        setFranchise(f);
        setPartner(p);
        setCompliance(c);
        setLaunch(l);
      } catch (error) {
        void error;
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="min-h-screen bg-[#060810] text-white flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#060810] text-white pb-24" data-testid="executive-center-page">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/95 border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center" data-testid="executive-back-btn"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h1 className="text-base font-bold">Executive & Enterprise Center</h1>
          <p className="text-[10px] text-white/40">Investor · Franchise · Compliance · Revenue</p>
        </div>
        <button onClick={() => window.open(`${API}/api/executive/enterprise-report.csv`, "_blank")} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center" data-testid="executive-export-csv"><Download size={16} /></button>
      </div>

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Users" value={dashboard?.executive?.total_users ?? 0} icon={BarChart3} color="#00C2FF" testid="executive-total-users" />
          <StatCard label="Active Users" value={dashboard?.executive?.active_users ?? 0} icon={TrendingUp} color="#10B981" testid="executive-active-users" />
          <StatCard label="Merchants" value={dashboard?.executive?.merchants ?? 0} icon={Building2} color="#A855F7" testid="executive-merchants" />
          <StatCard label="Transactions" value={dashboard?.executive?.transactions ?? 0} icon={Wallet} color="#F59E0B" testid="executive-transactions" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Wallet Volume" value={`€${(dashboard?.executive?.wallet_volume || 0).toFixed(0)}`} icon={Wallet} color="#00E89D" testid="executive-wallet-volume" />
          <StatCard label="Taxi Volume" value={`€${(dashboard?.executive?.taxi_volume || 0).toFixed(0)}`} icon={Car} color="#3B82F6" testid="executive-taxi-volume" />
          <StatCard label="EV Volume" value={`€${(dashboard?.executive?.ev_volume || 0).toFixed(0)}`} icon={Zap} color="#22C55E" testid="executive-ev-volume" />
          <StatCard label="MRR" value={`€${(dashboard?.investor?.monthly_recurring_revenue || 0).toFixed(0)}`} icon={TrendingUp} color="#FFD700" testid="executive-mrr" />
        </div>

        <SectionCard title="Investor Dashboard" icon={TrendingUp} testid="executive-investor-card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <MetricChip label="Merchant Growth" value={dashboard?.investor?.merchant_growth ?? 0} />
            <MetricChip label="User Growth" value={dashboard?.investor?.user_growth ?? 0} />
            <MetricChip label="Transaction Growth" value={dashboard?.investor?.transaction_growth ?? 0} />
            <MetricChip label="Revenue Forecast" value={`€${(dashboard?.investor?.revenue_forecast || 0).toFixed(2)}`} />
          </div>
        </SectionCard>

        <SectionCard title="Revenue Center" icon={Wallet} testid="executive-revenue-center-card">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <MetricChip label="POS" value={`€${(dashboard?.revenue_center?.pos_revenue || 0).toFixed(0)}`} />
            <MetricChip label="Wallet" value={`€${(dashboard?.revenue_center?.wallet_revenue || 0).toFixed(0)}`} />
            <MetricChip label="Taxi" value={`€${(dashboard?.revenue_center?.taxi_revenue || 0).toFixed(0)}`} />
            <MetricChip label="EV" value={`€${(dashboard?.revenue_center?.ev_revenue || 0).toFixed(0)}`} />
            <MetricChip label="Marketplace" value={`€${(dashboard?.revenue_center?.marketplace_revenue || 0).toFixed(0)}`} />
          </div>
        </SectionCard>

        <SectionCard title="Franchise Dashboard" icon={Building2} testid="executive-franchise-card">
          <div className="space-y-2">
            {(franchise?.branches || []).slice(0, 8).map((branch) => (
              <div key={branch.store_id} className="rounded-xl bg-white/5 border border-white/5 p-3 flex items-center justify-between" data-testid={`executive-branch-${branch.store_id}`}>
                <div>
                  <p className="text-sm font-semibold">{branch.name}</p>
                  <p className="text-[11px] text-white/40">{branch.city || "—"} · Staff {branch.staff_count} · Low Stock {branch.inventory_low_stock}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#10B981]">€{(branch.revenue || 0).toFixed(0)}</p>
                  <p className="text-[10px] text-white/30">{branch.transactions} TX</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Compliance Center" icon={ShieldCheck} testid="executive-compliance-card">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <MetricChip label="KYC Pending" value={compliance?.kyc?.pending ?? 0} />
              <MetricChip label="KYC Verified" value={compliance?.kyc?.verified ?? 0} />
              <MetricChip label="AML Flags" value={compliance?.aml?.flags ?? 0} />
              <MetricChip label="Risk Alerts" value={(compliance?.risk_monitoring || []).length} />
            </div>
            <div className="space-y-2 text-xs">
              {(compliance?.audit_logs || []).slice(0, 4).map((log, idx) => (
                <div key={idx} className="rounded-xl bg-white/5 p-3">{log.event || "audit"} · {log.timestamp?.slice(0, 16)}</div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Partner Portal" icon={Briefcase} testid="executive-partner-card">
            <div className="space-y-2">
              {(partner?.modules || []).map((mod) => (
                <button key={mod.name} onClick={() => onNavigate?.(mod.route)} className="w-full rounded-xl bg-white/5 border border-white/5 p-3 text-left hover:bg-white/10 transition-colors" data-testid={`partner-module-${mod.name.replace(/\s+/g, '-').toLowerCase()}`}>
                  <p className="text-sm font-semibold">{mod.name}</p>
                  <p className="text-[11px] text-white/40">Partner: {mod.count}</p>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Launch Certification" icon={ShieldCheck} testid="executive-launch-card">
          <div className={`rounded-xl p-4 border ${launch?.ready ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <p className="text-sm font-semibold">{launch?.ready ? 'Launch Ready' : 'Review Required'}</p>
            <p className="text-[11px] text-white/50 mt-1">{launch?.checked_at?.slice(0, 16)}</p>
            {!launch?.ready && (launch?.issues || []).length > 0 && (
              <ul className="mt-3 text-xs text-white/70 space-y-1 list-disc list-inside">
                {launch.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, testid }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4" data-testid={testid}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-[#00C2FF]" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, testid }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4" data-testid={testid}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40">{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
    </div>
  );
}

function MetricChip({ label, value }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-3">
      <p className="text-[10px] text-white/40">{label}</p>
      <p className="text-base font-bold mt-1">{value}</p>
    </div>
  );
}