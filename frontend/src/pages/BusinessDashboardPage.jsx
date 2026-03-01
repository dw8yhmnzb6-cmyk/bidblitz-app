/**
 * Business Dashboard - KPIs, Charts, Module Breakdown, Top Employees
 * Dark mode, matches BidBlitz design
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Building2, Euro, Car, Bike, Coffee, Settings, Users, ArrowLeft, RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

function eur(cents) { return (cents / 100).toFixed(2) + ' EUR'; }

function Kpi({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={`w-4 h-4 ${color || 'text-slate-400'}`} />}
        <span className="text-xs text-slate-400">{title}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function BusinessDashboard() {
  const { token } = useAuth();
  const [businessId, setBusinessId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const headers = { Authorization: `Bearer ${token}` };

  // Auto-load business_id from URL or from /business/me
  useEffect(() => {
    const url = new URL(window.location.href);
    const bid = url.searchParams.get('business_id');
    if (bid) { setBusinessId(bid); return; }
    if (token) {
      axios.get(`${API}/business/me`, { headers }).then(r => {
        const ms = r.data.memberships || [];
        if (ms.length > 0) setBusinessId(ms[0].business_id);
      }).catch(() => {});
    }
  }, [token]);

  const load = async () => {
    if (!businessId) return;
    setLoading(true); setErr('');
    try {
      const r = await axios.get(`${API}/business/dashboard?business_id=${businessId}`, { headers });
      setData(r.data);
    } catch (e) { setErr(e.response?.data?.detail || 'Fehler'); setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (businessId) load(); }, [businessId]);

  const maxDay = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.charts.daily_spend_last_30d.map(x => x.amount_cents));
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 pb-24" data-testid="biz-dashboard">
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <Link to="/business" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><ArrowLeft className="w-5 h-5 text-white" /></Link>
          <h1 className="text-lg font-bold text-white">Business Dashboard</h1>
          <button onClick={load} disabled={loading} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {err && <div className="mx-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm mb-4">{err}</div>}

      {!data && !err && (
        <div className="px-4"><div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center"><Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" /><p className="text-slate-400 text-sm">Lade Dashboard...</p></div></div>
      )}

      {data && (
        <div className="px-4 max-w-lg mx-auto space-y-4">
          {/* Business Header */}
          <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 rounded-xl p-4 flex items-center justify-between">
            <div><p className="text-white font-bold">{data.business.name}</p><p className="text-slate-400 text-xs">{data.business.business_id}</p></div>
            <div className="text-right"><p className="text-xs text-slate-400">Wallet</p><p className="text-lg font-bold text-emerald-400">{eur(data.business.wallet_balance_cents)}</p></div>
          </div>

          {/* Alert */}
          {data.alerts?.invoice_overdue && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" /><span className="text-red-300 text-sm font-bold">Rechnung überfällig!</span></div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <Kpi title="Diesen Monat" value={eur(data.kpis.month_spend_cents)} icon={Euro} color="text-emerald-400" />
            <Kpi title="Letzte 7 Tage" value={eur(data.kpis.last_7d_spend_cents)} icon={Euro} color="text-cyan-400" />
            <Kpi title="Transaktionen" value={String(data.kpis.month_txn_count)} icon={Settings} color="text-amber-400" />
            <Kpi title="Durchschnitt" value={eur(data.kpis.avg_spend_per_txn_cents)} icon={Euro} color="text-violet-400" />
          </div>

          {/* Module KPIs */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center"><Car className="w-4 h-4 text-blue-400 mx-auto mb-1" /><p className="text-white font-bold text-sm">{eur(data.kpis.month_taxi_spend_cents)}</p><p className="text-[10px] text-slate-500">Taxi</p></div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center"><Bike className="w-4 h-4 text-emerald-400 mx-auto mb-1" /><p className="text-white font-bold text-sm">{eur(data.kpis.month_scooter_spend_cents)}</p><p className="text-[10px] text-slate-500">Scooter</p></div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center"><Coffee className="w-4 h-4 text-orange-400 mx-auto mb-1" /><p className="text-white font-bold text-sm">{eur(data.kpis.month_food_spend_cents)}</p><p className="text-[10px] text-slate-500">Food</p></div>
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-center"><Settings className="w-4 h-4 text-violet-400 mx-auto mb-1" /><p className="text-white font-bold text-sm">{eur(data.kpis.month_services_spend_cents)}</p><p className="text-[10px] text-slate-500">Services</p></div>
          </div>

          {/* Daily Chart */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h2 className="text-white font-bold text-sm mb-3">Tägliche Ausgaben (30 Tage)</h2>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {data.charts.daily_spend_last_30d.map(d => {
                const w = Math.round((d.amount_cents / maxDay) * 100);
                return (
                  <div key={d.date} className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-slate-500">{d.date.slice(5)}</span>
                    <div className="flex-1 bg-white/5 rounded h-2 overflow-hidden"><div className="h-2 bg-cyan-500 rounded" style={{ width: `${w}%` }} /></div>
                    <span className="w-16 text-right text-[10px] text-slate-400">{eur(d.amount_cents)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Module Breakdown */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h2 className="text-white font-bold text-sm mb-3">Modul-Breakdown</h2>
            {data.charts.module_breakdown_month.length === 0 ? (
              <p className="text-slate-500 text-sm">Keine Daten</p>
            ) : data.charts.module_breakdown_month.map(m => (
              <div key={m.module} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-white text-sm capitalize">{m.module}</span>
                <div className="text-right"><span className="text-emerald-400 font-bold text-sm">{eur(m.amount_cents)}</span><span className="text-slate-500 text-xs ml-2">({m.count}x)</span></div>
              </div>
            ))}
          </div>

          {/* Top Employees */}
          {data.top_employees && data.top_employees.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" /> Top Mitarbeiter</h2>
              {data.top_employees.map((e, i) => (
                <div key={e.user_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2"><span className="w-5 h-5 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 text-[10px] font-bold">{i + 1}</span><span className="text-white text-sm">{e.name || e.user_id.slice(0, 8)}</span></div>
                  <span className="text-emerald-400 font-bold text-sm">{eur(e.amount_cents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
