/**
 * Admin Directory Management - Verzeichnis-Administration
 * Admin kann Field Agents verwalten, Listings moderieren, Statistiken sehen
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Building2, Crown, Euro, TrendingUp, UserPlus,
  Edit, Trash2, Check, X, ArrowLeft, DollarSign, BarChart3,
  MapPin, Phone, Mail, Calendar, Search, Filter as FilterIcon
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: 'agents', label: 'Mitarbeiter', icon: Users },
  { id: 'listings', label: 'Listings', icon: Building2 },
  { id: 'stats', label: 'Statistiken', icon: BarChart3 },
  { id: 'payouts', label: 'Auszahlungen', icon: DollarSign },
];

export default function AdminDirectoryPage({ onNavigate }) {
  const [tab, setTab] = useState('agents');
  const [agents, setAgents] = useState([]);
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  
  // Create Agent Form
  const [newAgent, setNewAgent] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    assigned_countries: [],
    assigned_cities: [],
    commission_rate: 0.30,
  });

  // Payout Form
  const [payoutForm, setPayoutForm] = useState({
    agent_email: '',
    amount: 0,
    note: '',
  });

  useEffect(() => {
    if (tab === 'agents') loadAgents();
    else if (tab === 'listings') loadAllListings();
    else if (tab === 'stats') loadStats();
    else if (tab === 'payouts') loadPayouts();
  }, [tab]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/directory/admin/agents`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllListings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/directory/listings?limit=100`);
      const data = await res.json();
      setListings(data.listings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/directory/stats`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/directory/admin/commission/history`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createAgent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/directory/admin/agents`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowCreateAgent(false);
        setNewAgent({ name: '', email: '', password: '', phone: '', assigned_countries: [], assigned_cities: [], commission_rate: 0.30 });
        loadAgents();
      } else {
        alert(data.detail || 'Fehler');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    }
  };

  const deleteAgent = async (email) => {
    if (!window.confirm('Mitarbeiter wirklich löschen?')) return;
    try {
      const res = await fetch(`${API}/api/directory/admin/agents/${email}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        alert('Mitarbeiter gelöscht');
        loadAgents();
      }
    } catch (err) {
      alert('Fehler');
    }
  };

  const deleteListing = async (listingId) => {
    if (!window.confirm('Listing wirklich löschen?')) return;
    try {
      const res = await fetch(`${API}/api/directory/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        alert('Listing gelöscht');
        loadAllListings();
      }
    } catch (err) {
      alert('Fehler');
    }
  };

  const processPayou = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/directory/admin/commission/payout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payoutForm),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setPayoutForm({ agent_email: '', amount: 0, note: '' });
        loadPayouts();
      } else {
        alert(data.detail || 'Fehler');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => onNavigate('/admin')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Verzeichnis-Administration</h1>
              <p className="text-xs text-gray-400">Mitarbeiter & Listings verwalten</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
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

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Laden...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* AGENTS TAB */}
            {tab === 'agents' && (
              <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">{agents.length} Mitarbeiter</h2>
                  <button
                    onClick={() => setShowCreateAgent(!showCreateAgent)}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-sm font-medium hover:bg-cyan-500/30"
                  >
                    <UserPlus size={16} />
                    Neuer Mitarbeiter
                  </button>
                </div>

                {showCreateAgent && (
                  <form onSubmit={createAgent} className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        required
                        placeholder="Name"
                        value={newAgent.name}
                        onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                      />
                      <input
                        required
                        type="email"
                        placeholder="Email"
                        value={newAgent.email}
                        onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        required
                        type="password"
                        placeholder="Passwort"
                        value={newAgent.password}
                        onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                      />
                      <input
                        placeholder="Telefon"
                        value={newAgent.phone}
                        onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="Länder (DE,XK,AT)"
                        value={newAgent.assigned_countries.join(',')}
                        onChange={(e) => setNewAgent({ ...newAgent, assigned_countries: e.target.value.split(',').filter(Boolean) })}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                      />
                      <input
                        placeholder="Provision (z.B. 0.30 = 30%)"
                        type="number"
                        step="0.01"
                        value={newAgent.commission_rate}
                        onChange={(e) => setNewAgent({ ...newAgent, commission_rate: parseFloat(e.target.value) })}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                      />
                    </div>
                    <button type="submit" className="w-full py-2 bg-cyan-500 text-black rounded-xl font-bold hover:bg-cyan-400">
                      Erstellen
                    </button>
                  </form>
                )}

                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.email} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-white">{agent.name}</h3>
                          <p className="text-sm text-gray-400">{agent.email}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>📍 {agent.assigned_countries?.join(', ') || 'Alle Länder'}</span>
                            <span>💰 {(agent.commission_rate * 100).toFixed(0)}% Provision</span>
                            <span>📦 {agent.total_listings_created || 0} Listings</span>
                            <span>👑 {agent.total_premium_sold || 0} Premium</span>
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="text-green-400 font-bold">€{agent.total_commission_earned?.toFixed(2) || '0.00'}</span>
                            <span className="text-gray-500 ml-2">verdient</span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteAgent(agent.email)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* LISTINGS TAB */}
            {tab === 'listings' && (
              <motion.div key="listings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 className="text-lg font-bold mb-4">{listings.length} Listings</h2>
                <div className="space-y-3">
                  {listings.map((listing) => (
                    <div key={listing.listing_id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-white">{listing.business_name}</h3>
                            {listing.is_premium && <Crown size={14} className="text-purple-400" />}
                          </div>
                          <p className="text-sm text-gray-400">{listing.city}, {listing.country_code}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {listing.phone} · Erstellt von: {listing.created_by}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteListing(listing.listing_id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STATS TAB */}
            {tab === 'stats' && stats && (
              <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <StatCard label="Gesamt Listings" value={stats.total_listings} icon={Building2} color="cyan" />
                  <StatCard label="Premium" value={stats.premium_listings} icon={Crown} color="purple" />
                  <StatCard label="Kostenlos" value={stats.free_listings} icon={Building2} color="gray" />
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-4">
                  <h3 className="font-bold mb-3">Nach Kategorie</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.by_category || {}).map(([cat, count]) => (
                      <div key={cat} className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">{cat}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <h3 className="font-bold mb-3">Nach Land</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.by_country || {}).map(([country, count]) => (
                      <div key={country} className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">{country}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* PAYOUTS TAB */}
            {tab === 'payouts' && (
              <motion.div key="payouts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 className="text-lg font-bold mb-4">Provisions-Auszahlungen</h2>

                {/* Payout Form */}
                <form onSubmit={processPayou} className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-4 space-y-3">
                  <select
                    required
                    value={payoutForm.agent_email}
                    onChange={(e) => setPayoutForm({ ...payoutForm, agent_email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
                  >
                    <option value="">Mitarbeiter wählen...</option>
                    {agents.map((agent) => (
                      <option key={agent.email} value={agent.email}>
                        {agent.name} ({agent.email}) - €{agent.total_commission_earned?.toFixed(2) || '0.00'} verfügbar
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      required
                      type="number"
                      step="0.01"
                      placeholder="Betrag (EUR)"
                      value={payoutForm.amount || ''}
                      onChange={(e) => setPayoutForm({ ...payoutForm, amount: parseFloat(e.target.value) })}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                    />
                    <input
                      placeholder="Notiz (optional)"
                      value={payoutForm.note}
                      onChange={(e) => setPayoutForm({ ...payoutForm, note: e.target.value })}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                    />
                  </div>
                  <button type="submit" className="w-full py-2 bg-green-500 text-black rounded-xl font-bold hover:bg-green-400">
                    Auszahlung durchführen
                  </button>
                </form>

                {/* Payout History */}
                <div className="space-y-3">
                  {payouts.map((payout) => (
                    <div key={payout.payout_id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-white">{payout.agent_name}</h3>
                          <p className="text-sm text-gray-400">{payout.agent_email}</p>
                          {payout.note && <p className="text-xs text-gray-500 mt-1">{payout.note}</p>}
                          <p className="text-xs text-gray-600 mt-1">{new Date(payout.created_at).toLocaleString('de-DE')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-400">€{payout.amount.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">von {payout.paid_by}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    cyan: 'from-cyan-500/10 border-cyan-500/20 text-cyan-400',
    purple: 'from-purple-500/10 border-purple-500/20 text-purple-400',
    gray: 'from-gray-500/10 border-gray-500/20 text-gray-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 border`}>
      <Icon size={20} className="mb-2" />
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
