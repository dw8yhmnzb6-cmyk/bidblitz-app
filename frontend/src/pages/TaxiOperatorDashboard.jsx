import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Car, Users, MapPin, Euro, TrendingUp, Clock, CheckCircle, 
  XCircle, Phone, Navigation, Loader2, RefreshCw, Eye, 
  BarChart3, Calendar, ChevronRight, Circle, AlertCircle,
  Plus, Trash2, Power, Building2
} from 'lucide-react';
import { useI18n } from '../store/I18nContext';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  available: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Verfügbar' },
  requested: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Anfrage' },
  accepted: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Angenommen' },
  arriving: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Unterwegs' },
  started: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Fahrt läuft' },
  offline: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Offline' },
};

export default function TaxiOperatorDashboard({ onNavigate }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [rides, setRides] = useState([]);
  const [payments, setPayments] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, fleet, rides, payments
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [error, setError] = useState('');
  const pollingRef = useRef(null);

  useEffect(() => {
    fetchDashboard();
    // Poll every 30 seconds for live updates
    pollingRef.current = setInterval(fetchDashboard, 30000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/operator/dashboard`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      } else if (res.status === 404) {
        // Not an operator - redirect to registration
        onNavigate('/taxi-partner');
        return;
      }
    } catch (err) {
      setError('Dashboard konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const fetchRides = async (status = '') => {
    try {
      const url = status ? `${API}/api/taxi/operator/rides?status=${status}` : `${API}/api/taxi/operator/rides`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRides(data.rides);
      }
    } catch (err) {}
  };

  const fetchPayments = async (period = 'month') => {
    try {
      const res = await fetch(`${API}/api/taxi/operator/payments?period=${period}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {}
  };

  const toggleDriver = async (driverId) => {
    try {
      const res = await fetch(`${API}/api/taxi/operator/driver/${driverId}/toggle`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err) {}
  };

  const removeDriver = async (driverId) => {
    if (!window.confirm('Fahrer wirklich entfernen?')) return;
    try {
      const res = await fetch(`${API}/api/taxi/operator/driver/${driverId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err) {}
  };

  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };

  useEffect(() => {
    if (activeTab === 'rides') fetchRides();
    if (activeTab === 'payments') fetchPayments();
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center px-4">
        <Building2 className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Kein Operator-Zugang</h2>
        <p className="text-gray-400 mb-6">Du musst dich als Taxiunternehmer registrieren.</p>
        <button
          onClick={() => navigate('/taxi-partner')}
          className="px-6 py-3 bg-cyan-500 rounded-xl font-semibold text-black"
        >
          Jetzt registrieren
        </button>
      </div>
    );
  }

  const { operator, fleet, stats, active_rides } = dashboard;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Car className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{operator.company_name}</h1>
                <p className="text-xs text-gray-400">{fleet.total_drivers} Fahrer · {fleet.online} online</p>
              </div>
            </div>
            <button onClick={fetchDashboard} className="p-2 text-gray-400 hover:text-white">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Trial Banner */}
          {operator.is_trial && (
            <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-green-400 text-sm">Testphase aktiv - 0% Provision</span>
              <span className="text-green-400 text-sm font-semibold">{operator.trial_days_left} Tage übrig</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto scrollbar-hide">
            {[
              { id: 'overview', label: 'Übersicht', icon: BarChart3 },
              { id: 'fleet', label: 'Flotte', icon: Car },
              { id: 'rides', label: 'Fahrten', icon: Navigation },
              { id: 'payments', label: 'Zahlungen', icon: Euro },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={Car}
                  label="Online"
                  value={fleet.online}
                  subtext={`von ${fleet.total_drivers}`}
                  color="cyan"
                />
                <StatCard
                  icon={Navigation}
                  label="Aktive Fahrten"
                  value={active_rides?.length || 0}
                  subtext="gerade"
                  color="purple"
                />
                <StatCard
                  icon={Euro}
                  label="Heute"
                  value={`€${stats.today.revenue}`}
                  subtext={`${stats.today.rides} Fahrten`}
                  color="green"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Monat"
                  value={`€${stats.month.revenue}`}
                  subtext={`${stats.month.rides} Fahrten`}
                  color="yellow"
                />
              </div>

              {/* Fleet Status Map */}
              <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    Live-Übersicht
                  </h3>
                </div>
                <div className="relative h-64 bg-[#0a0a0a]">
                  {/* Map placeholder - shows driver count by status */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-2">
                          <span className="text-2xl font-bold text-green-400">{fleet.available}</span>
                        </div>
                        <p className="text-xs text-gray-400">Verfügbar</p>
                      </div>
                      <div>
                        <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                          <span className="text-2xl font-bold text-purple-400">{fleet.busy}</span>
                        </div>
                        <p className="text-xs text-gray-400">Beschäftigt</p>
                      </div>
                      <div>
                        <div className="w-16 h-16 mx-auto rounded-full bg-gray-500/20 flex items-center justify-center mb-2">
                          <span className="text-2xl font-bold text-gray-400">{fleet.offline}</span>
                        </div>
                        <p className="text-xs text-gray-400">Offline</p>
                      </div>
                      <div>
                        <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/20 flex items-center justify-center mb-2">
                          <span className="text-2xl font-bold text-cyan-400">{fleet.total_drivers}</span>
                        </div>
                        <p className="text-xs text-gray-400">Gesamt</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Rides */}
              {active_rides && active_rides.length > 0 && (
                <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/5">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-purple-400" />
                      Aktive Fahrten ({active_rides.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {active_rides.map(ride => (
                      <div key={ride.ride_id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[ride.status]?.bg} ${STATUS_COLORS[ride.status]?.text}`}>
                            {STATUS_COLORS[ride.status]?.label}
                          </span>
                          <span className="text-sm text-gray-400">{ride.car_type}</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-start gap-2">
                            <Circle className="w-3 h-3 text-cyan-400 mt-1 flex-shrink-0" />
                            <span className="text-gray-300">{ride.pickup_address || 'Abholung'}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Circle className="w-3 h-3 text-red-400 mt-1 flex-shrink-0" />
                            <span className="text-gray-300">{ride.dropoff_address || 'Ziel'}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                          <span>Kunde: {ride.customer_name || 'Unbekannt'}</span>
                          <span>~€{ride.fare_estimate?.total?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revenue Summary */}
              <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-2xl p-5 border border-cyan-500/20">
                <h3 className="font-semibold mb-4">Einnahmen-Übersicht</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Heute</span>
                    <div className="text-right">
                      <span className="font-semibold">€{stats.today.net.toFixed(2)}</span>
                      {!operator.is_trial && stats.today.commission > 0 && (
                        <span className="text-xs text-gray-500 ml-2">(-€{stats.today.commission.toFixed(2)})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Diese Woche</span>
                    <div className="text-right">
                      <span className="font-semibold">€{stats.week.net.toFixed(2)}</span>
                      {!operator.is_trial && stats.week.commission > 0 && (
                        <span className="text-xs text-gray-500 ml-2">(-€{stats.week.commission.toFixed(2)})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-white/10">
                    <span className="text-white font-medium">Dieser Monat</span>
                    <div className="text-right">
                      <span className="text-xl font-bold text-cyan-400">€{stats.month.net.toFixed(2)}</span>
                      {!operator.is_trial && (
                        <p className="text-xs text-gray-500">Provision: €{stats.month.commission.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* FLEET TAB */}
          {activeTab === 'fleet' && (
            <motion.div
              key="fleet"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Meine Flotte</h2>
                <button
                  onClick={() => navigate('/taxi-partner')}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Fahrer hinzufügen
                </button>
              </div>

              {fleet.drivers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Noch keine Fahrer hinzugefügt</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fleet.drivers.map(driver => (
                    <div
                      key={driver.driver_id}
                      className="bg-[#111] rounded-xl border border-white/5 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            driver.current_status === 'offline' ? 'bg-gray-500/20' :
                            driver.current_status === 'available' ? 'bg-green-500/20' : 'bg-purple-500/20'
                          }`}>
                            <Car className={`w-6 h-6 ${
                              driver.current_status === 'offline' ? 'text-gray-400' :
                              driver.current_status === 'available' ? 'text-green-400' : 'text-purple-400'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-medium">{driver.name || 'Unbekannt'}</h4>
                            <p className="text-sm text-gray-400">{driver.vehicle_model} · {driver.vehicle_plate}</p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[driver.current_status]?.bg} ${STATUS_COLORS[driver.current_status]?.text}`}>
                          {STATUS_COLORS[driver.current_status]?.label}
                        </div>
                      </div>

                      {/* Current ride info */}
                      {driver.current_ride && (
                        <div className="mt-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <p className="text-xs text-purple-400 mb-1">Aktuelle Fahrt</p>
                          <p className="text-sm">{driver.current_ride.pickup_address} → {driver.current_ride.dropoff_address}</p>
                        </div>
                      )}

                      {/* Driver stats */}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                        <span>{driver.total_rides || 0} Fahrten</span>
                        <span>★ {driver.rating?.toFixed(1) || '5.0'}</span>
                        <span className="capitalize">{driver.car_type}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => toggleDriver(driver.driver_id)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                            driver.status === 'active'
                              ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                              : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                          {driver.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                        <button
                          onClick={() => removeDriver(driver.driver_id)}
                          className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* RIDES TAB */}
          {activeTab === 'rides' && (
            <motion.div
              key="rides"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['', 'completed', 'cancelled'].map(status => (
                  <button
                    key={status}
                    onClick={() => fetchRides(status)}
                    className="px-4 py-2 bg-white/5 rounded-lg text-sm whitespace-nowrap hover:bg-white/10"
                  >
                    {status === '' ? 'Alle' : status === 'completed' ? 'Abgeschlossen' : 'Storniert'}
                  </button>
                ))}
              </div>

              {rides.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Navigation className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Keine Fahrten gefunden</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rides.map(ride => (
                    <div key={ride.ride_id} className="bg-[#111] rounded-xl border border-white/5 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[ride.status]?.bg || 'bg-gray-500/20'} ${STATUS_COLORS[ride.status]?.text || 'text-gray-400'}`}>
                          {STATUS_COLORS[ride.status]?.label || ride.status}
                        </span>
                        <span className="text-lg font-semibold text-cyan-400">€{ride.final_fare?.toFixed(2) || ride.fare_estimate?.total?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <Circle className="w-3 h-3 text-cyan-400 mt-1" />
                          <span className="text-gray-300">{ride.pickup_address}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Circle className="w-3 h-3 text-red-400 mt-1" />
                          <span className="text-gray-300">{ride.dropoff_address}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                        <span>{new Date(ride.created_at).toLocaleDateString('de-DE')} {new Date(ride.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{ride.car_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <motion.div
              key="payments"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex gap-2">
                {['week', 'month', 'year'].map(period => (
                  <button
                    key={period}
                    onClick={() => fetchPayments(period)}
                    className="px-4 py-2 bg-white/5 rounded-lg text-sm hover:bg-white/10"
                  >
                    {period === 'week' ? 'Woche' : period === 'month' ? 'Monat' : 'Jahr'}
                  </button>
                ))}
              </div>

              {payments && (
                <>
                  {/* Summary */}
                  <div className="bg-gradient-to-br from-green-500/10 to-cyan-500/10 rounded-2xl p-5 border border-green-500/20">
                    <h3 className="text-sm text-gray-400 mb-3">Zusammenfassung</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-green-400">€{payments.summary.total_net.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">Netto-Einnahmen</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{payments.summary.total_rides}</p>
                        <p className="text-xs text-gray-400">Fahrten</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-300">€{payments.summary.total_revenue.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">Brutto</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-red-400">-€{payments.summary.total_commission.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">Provision</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment List */}
                  <div className="space-y-2">
                    {payments.payments.map(p => (
                      <div key={p.ride_id} className="bg-[#111] rounded-xl border border-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{p.driver_name}</p>
                            <p className="text-xs text-gray-400">{p.pickup} → {p.dropoff}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-400">€{p.net.toFixed(2)}</p>
                            {p.commission > 0 && (
                              <p className="text-xs text-gray-500">-€{p.commission.toFixed(2)} Prov.</p>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(p.completed_at).toLocaleDateString('de-DE')} {new Date(p.completed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, subtext, color }) {
  const colors = {
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20',
    green: 'from-green-500/10 to-green-500/5 border-green-500/20',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
    yellow: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20',
  };
  const iconColors = {
    cyan: 'text-cyan-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 border`}>
      <Icon className={`w-5 h-5 ${iconColors[color]} mb-2`} />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
      {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
    </div>
  );
}
