/**
 * Admin SaaS Metrics Card für /admin Dashboard
 */
import React, { useEffect, useState } from "react";
import { TrendingUp, Users, AlertTriangle, Euro, Activity, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminStaffMetrics() {
  const [data, setData] = useState(null);
  const [byPlan, setByPlan] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch(`${API}/api/staff/metrics/overview`, { credentials: "include" }),
          fetch(`${API}/api/staff/metrics/by-plan`, { credentials: "include" }),
        ]);
        if (a.ok) setData(await a.json());
        if (b.ok) setByPlan((await b.json()).rows || []);
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="py-6 flex justify-center"><Loader2 size={20} className="animate-spin text-white/40" /></div>;
  if (!data) return <p className="text-sm text-white/50">Keine Daten verfügbar</p>;

  const s = data.subscriptions || {};

  const tiles = [
    { label: "Trials aktiv", value: s.trials, icon: Activity, color: "#00C2FF" },
    { label: "Aktive Abos", value: s.active, icon: Users, color: "#10B981" },
    { label: "MRR (Platzhalter)", value: `€${(data.mrr_eur_placeholder || 0).toFixed(2)}`, icon: Euro, color: "#A855F7" },
    { label: "ARR (Platzhalter)", value: `€${(data.arr_eur_placeholder || 0).toFixed(0)}`, icon: TrendingUp, color: "#F59E0B" },
    { label: "Ø Mitarbeiter/Händler", value: data.avg_staff_per_merchant ?? 0, icon: Users, color: "#06B6D4" },
    { label: "Kündigungsrisiko", value: data.churn_at_risk_count, icon: AlertTriangle, color: "#EF4444" },
    { label: "Offene Warnungen", value: data.open_warnings_total, icon: AlertTriangle, color: "#EF4444" },
  ];

  return (
    <div data-testid="admin-staff-metrics">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
        <TrendingUp size={14} className="text-[#00C2FF]" />
        BidBlitz Staff — SaaS Metrics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        {tiles.map((t, i) => {
          const I = t.icon;
          return (
            <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <I size={12} style={{ color: t.color }} />
                <p className="text-[10px] uppercase text-white/40 tracking-widest">{t.label}</p>
              </div>
              <p className="text-lg font-bold">{t.value}</p>
            </div>
          );
        })}
      </div>
      {byPlan.length > 0 && (
        <div className="rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-white/10 text-white/50">
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Aktive</th>
                <th className="px-3 py-2 text-right">MRR</th>
              </tr>
            </thead>
            <tbody>
              {byPlan.map((r) => (
                <tr key={r.plan} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2 uppercase font-semibold">{r.plan}</td>
                  <td className="px-3 py-2">{r.count}</td>
                  <td className="px-3 py-2 text-right">€{r.mrr_eur.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
