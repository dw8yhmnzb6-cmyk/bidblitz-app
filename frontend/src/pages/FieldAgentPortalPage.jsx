/**
 * Field Agent Portal - Mitarbeiter-Dashboard für Dienstleister-Verzeichnis
 * Außendienstmitarbeiter können hier:
 * - Neue Listings erstellen
 * - Ihre Performance sehen
 * - Premium verkaufen
 * - Ihre Provisionen tracken
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, TrendingUp, Euro, MapPin, Phone, Mail,
  Star, Award, BarChart3, Users, Crown, Calendar, Search,
  Filter, X, Check, ArrowLeft, Home, List, DollarSign, Image
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'create', label: 'Neu erstellen', icon: Plus },
  { id: 'listings', label: 'Meine Listings', icon: List },
];

export default function FieldAgentPortalPage({ onNavigate }) {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [categories, setCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    business_name: '',
    category: '',
    phone: '',
    country_code: '',
    city: '',
    address: '',
    postal_code: '',
    email: '',
    website: '',
    description: '',
    opening_hours: '',
    photos: [],
  });

  useEffect(() => {
    loadDashboard();
    loadCategories();
    loadCountries();
  }, []);

  useEffect(() => {
    if (tab === 'listings') loadMyListings();
  }, [tab]);

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API}/api/directory/agent/dashboard`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      } else if (res.status === 403) {
        // Not a field agent
        alert('Zugriff verweigert. Nur für Außendienstmitarbeiter.');
        onNavigate('/');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API}/api/directory/categories`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {}
  };

  const loadCountries = async () => {
    try {
      const res = await fetch(`${API}/api/directory/countries`);
      const data = await res.json();
      setCountries(data.countries || []);
    } catch (err) {}
  };

  const loadMyListings = async () => {
    try {
      const res = await fetch(`${API}/api/directory/agent/my-listings`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (err) {}
  };

  const createListing = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/directory/listings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setForm({
          business_name: '',
          category: '',
          phone: '',
          country_code: '',
          city: '',
          address: '',
          postal_code: '',
          email: '',
          website: '',
          description: '',
          opening_hours: '',
          photos: [],
        });
        setTab('dashboard');
        loadDashboard();
      } else {
        alert(data.detail || 'Fehler');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    } finally {
      setBusy(false);
    }
  };

  const upgradeToPremium = async (listingId, plan) => {
    if (!window.confirm(`Premium-Upgrade (${plan === 'monthly' ? '€1.99/Monat' : '€16.99/Jahr'})?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/directory/premium/upgrade`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, plan }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        loadMyListings();
        loadDashboard();
      } else {
        alert(data.detail || 'Fehler');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Lade Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => onNavigate('/')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex-1 ml-3">
              <h1 className="text-lg font-bold">Mitarbeiter-Portal</h1>
              <p className="text-xs text-gray-400">{dashboard?.agent?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Provision</p>
              <p className="text-sm font-bold text-green-400">
                €{dashboard?.stats?.total_commission?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  tab === t.id
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* DASHBOARD TAB */}
          {tab === 'dashboard' && dashboard && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={List} label="Heute erstellt" value={dashboard.today.created} color="cyan" />
                <StatCard icon={Crown} label="Premium verkauft" value={dashboard.today.premium} color="purple" />
                <StatCard icon={Building2} label="Gesamt Listings" value={dashboard.stats.total_created} color="green" />
                <StatCard icon={Euro} label="Provision (Monat)" value={`€${dashboard.month.commission.toFixed(2)}`} color="yellow" />
              </div>

              {/* Commission Info */}
              <div className="bg-gradient-to-br from-green-500/10 to-cyan-500/5 rounded-2xl p-5 border border-green-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <Award size={24} className="text-green-400" />
                  <div>
                    <h3 className="font-bold text-white">Provisionsrate</h3>
                    <p className="text-sm text-gray-400">
                      {(dashboard.agent.commission_rate * 100).toFixed(0)}% pro Premium-Upgrade
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Heute</p>
                    <p className="text-lg font-bold text-green-400">€0.00</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Dieser Monat</p>
                    <p className="text-lg font-bold text-green-400">€{dashboard.month.commission.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Gesamt</p>
                    <p className="text-lg font-bold text-white">€{dashboard.stats.total_commission.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Recent Listings */}
              {dashboard.recent_listings?.length > 0 && (
                <div>
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <Building2 size={18} className="text-cyan-400" />
                    Kürzlich erstellt
                  </h3>
                  <div className="space-y-2">
                    {dashboard.recent_listings.slice(0, 5).map((listing) => (
                      <div key={listing.listing_id} className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white">{listing.business_name}</h4>
                            <p className="text-xs text-gray-400 mt-1">
                              {categories.find(c => c.id === listing.category)?.icon} {listing.city}, {listing.country_code}
                            </p>
                          </div>
                          {listing.is_premium ? (
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1">
                              <Crown size={12} />
                              Premium
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">Basic</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* CREATE LISTING TAB */}
          {tab === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-xl font-bold mb-1">Neues Listing erstellen</h2>
              <p className="text-sm text-gray-400 mb-6">Füge einen neuen Dienstleister hinzu</p>

              <form onSubmit={createListing} className="space-y-4">
                {/* Business Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Firmenname *
                  </label>
                  <input
                    required
                    value={form.business_name}
                    onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    placeholder="z.B. Dr. Schmidt Praxis"
                  />
                </div>

                {/* Category & Country */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Kategorie *</label>
                    <select
                      required
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="">Wählen...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Land *</label>
                    <select
                      required
                      value={form.country_code}
                      onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="">Wählen...</option>
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phone & City */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Telefon *</label>
                    <input
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                      placeholder="+49 123 456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Stadt *</label>
                    <input
                      required
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                      placeholder="z.B. Berlin"
                    />
                  </div>
                </div>

                {/* Address & Postal Code */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Adresse</label>
                    <input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                      placeholder="Straße & Hausnummer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">PLZ</label>
                    <input
                      value={form.postal_code}
                      onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                      placeholder="12345"
                    />
                  </div>
                </div>

                {/* Email & Website */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                      placeholder="kontakt@firma.de"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                    <input
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                      placeholder="https://www.firma.de"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Beschreibung</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none resize-none"
                    placeholder="Kurze Beschreibung der Dienstleistung..."
                  />
                </div>

                {/* Opening Hours */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Öffnungszeiten</label>
                  <input
                    value={form.opening_hours}
                    onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    placeholder="Mo-Fr: 9-18 Uhr, Sa: 9-14 Uhr"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black disabled:opacity-50 hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  {busy ? 'Erstelle...' : '✓ Listing erstellen'}
                </button>
              </form>
            </motion.div>
          )}

          {/* MY LISTINGS TAB */}
          {tab === 'listings' && (
            <motion.div
              key="listings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-xl font-bold mb-1">Meine Listings</h2>
              <p className="text-sm text-gray-400 mb-6">{listings.length} Einträge</p>

              {listings.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 size={48} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Noch keine Listings erstellt</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {listings.map((listing) => (
                    <div key={listing.listing_id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-white mb-1">{listing.business_name}</h4>
                          <p className="text-sm text-gray-400">
                            {categories.find(c => c.id === listing.category)?.name} · {listing.city}, {listing.country_code}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {listing.phone} · {listing.views || 0} Aufrufe
                          </p>
                        </div>
                        {listing.is_premium ? (
                          <span className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 text-sm rounded-lg flex items-center gap-2 font-semibold">
                            <Crown size={14} />
                            Premium
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-sm rounded-lg">Basic</span>
                        )}
                      </div>

                      {!listing.is_premium && (
                        <div className="pt-3 border-t border-white/5">
                          <p className="text-xs text-gray-400 mb-2">Premium-Upgrade verfügbar:</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => upgradeToPremium(listing.listing_id, 'monthly')}
                              disabled={busy}
                              className="flex-1 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                            >
                              €1.99/Monat
                            </button>
                            <button
                              onClick={() => upgradeToPremium(listing.listing_id, 'yearly')}
                              disabled={busy}
                              className="flex-1 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                            >
                              €16.99/Jahr
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
    green: 'from-green-500/10 to-green-500/5 border-green-500/20 text-green-400',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400',
    yellow: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20 text-yellow-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 border`}>
      <Icon size={20} className="mb-2" />
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
