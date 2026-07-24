import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Car, Users, Building2, Phone, Mail, MapPin, FileCheck, 
  Clock, TrendingUp, CheckCircle, AlertCircle, Plus, Loader2,
  Euro, Percent, Calendar
} from 'lucide-react';
import { useI18n } from '../store/I18nContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TaxiOperatorPage({ onNavigate }) {
  const { t } = useI18n();
  const [view, setView] = useState('status'); // status, register, drivers, earnings
  const [loading, setLoading] = useState(true);
  const [operatorStatus, setOperatorStatus] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Registration form
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    city: '',
    country: 'Deutschland',
    fleet_size: 1,
    license_number: '',
    tax_id: '',
  });

  // Add driver form
  const [driverForm, setDriverForm] = useState({
    driver_user_id: '',
    vehicle_plate: '',
    vehicle_model: '',
    car_type: 'standard',
  });

  useEffect(() => {
    checkOperatorStatus();
  }, []);

  const checkOperatorStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/taxi/operator/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOperatorStatus(data);
        if (data.is_operator && data.status === 'approved') {
          fetchEarnings();
        }
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async (period = 'month') => {
    try {
      const res = await fetch(`${API}/api/taxi/operator/earnings?period=${period}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEarnings(data);
      }
    } catch (err) {}
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(`${API}/api/taxi/operator/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(data.message);
        setTimeout(() => checkOperatorStatus(), 2000);
      } else {
        setError(data.detail || 'Registrierung fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/api/taxi/operator/add-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(driverForm),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(data.message);
        setDriverForm({ driver_user_id: '', vehicle_plate: '', vehicle_model: '', car_type: 'standard' });
        checkOperatorStatus();
      } else {
        setError(data.detail || 'Fahrer hinzufügen fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };

  if (loading && !operatorStatus) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">Taxi Partner</h1>
            <div className="w-8" />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Not registered yet */}
        {!operatorStatus?.is_operator && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Hero */}
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                <Car className="w-10 h-10 text-black" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Werde Taxi-Partner</h2>
              <p className="text-gray-400 text-sm">
                Registriere dein Taxiunternehmen und profitiere von unserer Plattform
              </p>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111] rounded-xl p-4 border border-white/5">
                <Clock className="w-6 h-6 text-green-400 mb-2" />
                <p className="text-sm font-semibold">6 Monate Gratis</p>
                <p className="text-xs text-gray-500">Testphase ohne Kosten</p>
              </div>
              <div className="bg-[#111] rounded-xl p-4 border border-white/5">
                <Percent className="w-6 h-6 text-cyan-400 mb-2" />
                <p className="text-sm font-semibold">5-10% Provision</p>
                <p className="text-xs text-gray-500">Nur nach Testphase</p>
              </div>
              <div className="bg-[#111] rounded-xl p-4 border border-white/5">
                <Users className="w-6 h-6 text-purple-400 mb-2" />
                <p className="text-sm font-semibold">Neue Kunden</p>
                <p className="text-xs text-gray-500">Mehr Reichweite</p>
              </div>
              <div className="bg-[#111] rounded-xl p-4 border border-white/5">
                <Euro className="w-6 h-6 text-yellow-400 mb-2" />
                <p className="text-sm font-semibold">Sichere Zahlung</p>
                <p className="text-xs text-gray-500">Direkt aufs Konto</p>
              </div>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <h3 className="text-lg font-semibold pt-4">Registrierung</h3>
              
              <div className="space-y-3">
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Firmenname *"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    required
                    className="w-full pl-12 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Ansprechpartner *"
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    required
                    className="w-full pl-12 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      placeholder="E-Mail *"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      className="w-full pl-12 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="tel"
                      placeholder="Telefon *"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      required
                      className="w-full pl-12 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Stadt *"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      required
                      className="w-full pl-12 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="Deutschland">Deutschland</option>
                    <option value="Kosovo">Kosovo</option>
                    <option value="VAE">VAE</option>
                    <option value="Österreich">Österreich</option>
                    <option value="Schweiz">Schweiz</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="number"
                      placeholder="Flottengröße *"
                      value={form.fleet_size}
                      onChange={(e) => setForm({ ...form, fleet_size: parseInt(e.target.value) || 1 })}
                      min="1"
                      max="500"
                      required
                      className="w-full pl-12 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <FileCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Lizenznummer *"
                      value={form.license_number}
                      onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                      required
                      className="w-full pl-12 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>
                
                <input
                  type="text"
                  placeholder="Steuernummer (optional)"
                  value={form.tax_id}
                  onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                  className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              
              {success && (
                <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl font-semibold text-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Car className="w-5 h-5" />}
                Jetzt registrieren
              </button>
            </form>

            {/* Pricing Info */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-2xl p-5 border border-cyan-500/20">
              <h4 className="font-semibold mb-3">Provisionsmodell</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Testphase (6 Monate)</span>
                  <span className="text-green-400 font-semibold">0% - Kostenlos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Umsatz €0 - €5.000</span>
                  <span className="text-cyan-400">5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Umsatz €5.000 - €15.000</span>
                  <span className="text-cyan-400">7%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Umsatz über €15.000</span>
                  <span className="text-cyan-400">10%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pending Approval */}
        {operatorStatus?.is_operator && operatorStatus.status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Clock className="w-10 h-10 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Antrag wird geprüft</h2>
            <p className="text-gray-400 mb-4">
              Dein Antrag für <strong>{operatorStatus.company_name}</strong> wird derzeit bearbeitet.
            </p>
            <p className="text-sm text-gray-500">
              Du erhältst eine E-Mail, sobald die Freischaltung erfolgt ist.
            </p>
          </motion.div>
        )}

        {/* Approved - Dashboard */}
        {operatorStatus?.is_operator && operatorStatus.status === 'approved' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Company Header */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-2xl p-5 border border-cyan-500/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{operatorStatus.company_name}</h2>
                  <p className="text-sm text-gray-400">{operatorStatus.fleet_size} Fahrzeuge genehmigt</p>
                </div>
              </div>
              
              {/* Trial Badge */}
              {operatorStatus.is_trial && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 text-sm font-medium">Testphase aktiv</span>
                    <span className="text-green-400 text-sm">{operatorStatus.trial_days_left} Tage übrig</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">0% Provision während der Testphase</p>
                </div>
              )}
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">€{operatorStatus.total_revenue?.toFixed(0) || 0}</p>
                  <p className="text-xs text-gray-500">Umsatz</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{operatorStatus.total_rides || 0}</p>
                  <p className="text-xs text-gray-500">Fahrten</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-400">{operatorStatus.drivers_count || 0}</p>
                  <p className="text-xs text-gray-500">Fahrer</p>
                </div>
              </div>
            </div>

            {/* Earnings Card */}
            {earnings && (
              <div className="bg-[#111] rounded-2xl p-5 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Einnahmen (Monat)</h3>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Brutto-Einnahmen</span>
                    <span className="font-semibold">€{earnings.total_revenue?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Provision ({(earnings.commission_rate * 100).toFixed(0)}%)</span>
                    <span className="text-red-400">-€{earnings.commission_amount?.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-between">
                    <span className="font-semibold">Netto-Einnahmen</span>
                    <span className="text-green-400 font-bold">€{earnings.net_earnings?.toFixed(2)}</span>
                  </div>
                  {earnings.is_trial && earnings.trial_savings > 0 && (
                    <div className="bg-green-500/10 rounded-lg p-2 text-center">
                      <span className="text-green-400 text-sm">
                        Du sparst €{earnings.trial_savings.toFixed(2)} durch die Testphase!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Add Driver */}
            <div className="bg-[#111] rounded-2xl p-5 border border-white/5">
              <h3 className="font-semibold mb-4">Fahrer hinzufügen</h3>
              <form onSubmit={handleAddDriver} className="space-y-3">
                <input
                  type="text"
                  placeholder="Benutzer-ID des Fahrers"
                  value={driverForm.driver_user_id}
                  onChange={(e) => setDriverForm({ ...driverForm, driver_user_id: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Kennzeichen"
                    value={driverForm.vehicle_plate}
                    onChange={(e) => setDriverForm({ ...driverForm, vehicle_plate: e.target.value.toUpperCase() })}
                    required
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Fahrzeugmodell"
                    value={driverForm.vehicle_model}
                    onChange={(e) => setDriverForm({ ...driverForm, vehicle_model: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <select
                  value={driverForm.car_type}
                  onChange={(e) => setDriverForm({ ...driverForm, car_type: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="van">Van/XL</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-cyan-500/20 text-cyan-400 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-cyan-500/30 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Fahrer hinzufügen
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
