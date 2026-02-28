/**
 * Admin Taxi Management - Drivers, Rides, Pricing Editor
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Car, Users, Euro, Settings, CheckCircle, XCircle, Clock, Loader2, RefreshCw, Star, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminTaxi({ token }) {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState({});
  const [drivers, setDrivers] = useState([]);
  const [rides, setRides] = useState([]);
  const [pricing, setPricing] = useState({});
  const [loading, setLoading] = useState(true);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [sRes, dRes, rRes, pRes] = await Promise.all([
        axios.get(`${API}/api/taxi/admin/stats`, { headers }),
        axios.get(`${API}/api/taxi/admin/drivers`, { headers }),
        axios.get(`${API}/api/taxi/admin/rides?limit=20`, { headers }),
        axios.get(`${API}/api/taxi/pricing`),
      ]);
      setStats(sRes.data); setDrivers(dRes.data.drivers || []); setRides(rRes.data.rides || []); setPricing(pRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const approveDriver = async (userId) => {
    await axios.post(`${API}/api/taxi/admin/approve-driver/${userId}`, {}, { headers });
    toast.success('Fahrer genehmigt'); fetchAll();
  };
  const blockDriver = async (userId) => {
    await axios.post(`${API}/api/taxi/admin/block-driver/${userId}`, {}, { headers });
    toast.success('Fahrer gesperrt'); fetchAll();
  };

  const savePricing = async () => {
    try {
      await axios.put(`${API}/api/taxi/admin/pricing`, pricing, { headers });
      toast.success('Preise gespeichert');
    } catch (e) { toast.error('Fehler'); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;

  return (
    <div className="space-y-4" data-testid="admin-taxi">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center"><Car className="w-5 h-5 text-white" /></div>
        <div><h1 className="text-lg font-bold text-slate-800">Taxi-Verwaltung</h1><p className="text-xs text-slate-500">{stats.total_drivers || 0} Fahrer | {stats.online_drivers || 0} Online</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {[{id:'stats',l:'Statistik'},{id:'drivers',l:'Fahrer'},{id:'rides',l:'Fahrten'},{id:'pricing',l:'Preise'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{t.l}</button>
        ))}
      </div>

      {/* Stats */}
      {tab === 'stats' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Fahrten</p><p className="text-2xl font-bold">{stats.total_rides || 0}</p></div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100"><p className="text-xs text-emerald-600">Umsatz</p><p className="text-2xl font-bold text-emerald-700">{(stats.total_revenue || 0).toFixed(0)} EUR</p></div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100"><p className="text-xs text-blue-600">Provision</p><p className="text-2xl font-bold text-blue-700">{(stats.total_commission || 0).toFixed(0)} EUR</p></div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100"><p className="text-xs text-amber-600">Nacht-Modus</p><p className="text-2xl font-bold text-amber-700">{stats.is_night ? 'Aktiv' : 'Aus'}</p></div>
        </div>
      )}

      {/* Drivers */}
      {tab === 'drivers' && (
        <div className="space-y-2">
          {drivers.length === 0 ? <p className="text-center text-slate-400 py-8">Keine Fahrer</p> : drivers.map(d => (
            <div key={d.id} className="bg-white rounded-xl p-4 border border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-400">{d.email} | {d.vehicle?.plate}</p>
                  <p className="text-xs text-slate-500">{d.vehicle?.make} {d.vehicle?.model} ({d.vehicle?.color})</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : d.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {d.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                <span>{d.total_rides || 0} Fahrten</span>
                <span>{((d.total_earnings_cents || 0) / 100).toFixed(0)} EUR</span>
                <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400" />{d.rating_avg}</span>
                <span className={d.is_online ? 'text-emerald-500 font-bold' : 'text-slate-400'}>{d.is_online ? 'ONLINE' : 'Offline'}</span>
              </div>
              {d.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveDriver(d.user_id)} className="bg-emerald-500 hover:bg-emerald-600 flex-1">Genehmigen</Button>
                  <Button size="sm" onClick={() => blockDriver(d.user_id)} variant="outline" className="border-red-300 text-red-500 flex-1">Sperren</Button>
                </div>
              )}
              {d.status === 'approved' && (
                <Button size="sm" onClick={() => blockDriver(d.user_id)} variant="outline" className="border-red-300 text-red-500 w-full">Sperren</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rides */}
      {tab === 'rides' && (
        <div className="space-y-2">
          {rides.length === 0 ? <p className="text-center text-slate-400 py-8">Keine Fahrten</p> : rides.map(r => (
            <div key={r.id} className="bg-white rounded-xl p-3 border border-slate-100">
              <div className="flex justify-between mb-1">
                <span className="font-medium text-sm text-slate-800">{r.rider_name} {r.driver_name ? `→ ${r.driver_name}` : ''}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{r.status}</span>
              </div>
              <p className="text-xs text-slate-500 truncate">{r.pickup?.address} → {r.dropoff?.address}</p>
              <div className="flex gap-3 mt-1 text-xs text-slate-500">
                <span>{r.distance_km}km</span>
                <span className="font-bold text-emerald-600">{r.final_fare || r.estimated_fare} EUR</span>
                {r.surcharge_active && <span className="text-amber-500">Nacht+</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pricing Editor */}
      {tab === 'pricing' && (
        <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-800">Preise bearbeiten</h3>
          {['standard','premium','van'].map(vt => (
            <div key={vt} className="bg-slate-50 rounded-xl p-3">
              <p className="text-sm font-bold text-slate-700 mb-2 capitalize">{vt}</p>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] text-slate-500">Grundpreis</label><Input type="number" step="0.01" value={pricing[`base_fare_${vt}`] || ''} onChange={e => setPricing({...pricing, [`base_fare_${vt}`]: parseFloat(e.target.value)})} /></div>
                <div><label className="text-[10px] text-slate-500">Pro km</label><Input type="number" step="0.01" value={pricing[`per_km_${vt}`] || ''} onChange={e => setPricing({...pricing, [`per_km_${vt}`]: parseFloat(e.target.value)})} /></div>
                <div><label className="text-[10px] text-slate-500">Pro Min</label><Input type="number" step="0.01" value={pricing[`per_min_${vt}`] || ''} onChange={e => setPricing({...pricing, [`per_min_${vt}`]: parseFloat(e.target.value)})} /></div>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500">Provision %</label><Input type="number" value={pricing.platform_commission_percent || ''} onChange={e => setPricing({...pricing, platform_commission_percent: parseFloat(e.target.value)})} /></div>
            <div><label className="text-xs text-slate-500">Nacht-Schwelle</label><Input type="number" step="0.1" value={pricing.night_surcharge_threshold_ratio || ''} onChange={e => setPricing({...pricing, night_surcharge_threshold_ratio: parseFloat(e.target.value)})} /></div>
          </div>
          <Button onClick={savePricing} className="w-full bg-blue-500 hover:bg-blue-600">Preise speichern</Button>
        </div>
      )}
    </div>
  );
}
