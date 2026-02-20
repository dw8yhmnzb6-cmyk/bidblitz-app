/**
 * Enterprise Portal - Großhändler-Verwaltung
 * For large retailers like Edeka, Rewe to manage branches, API keys, and reports
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, Key, Users, BarChart3, Download, Store, Plus, Settings,
  ChevronRight, LogOut, Check, X, RefreshCw, FileText, TrendingUp,
  Calendar, Euro, ShoppingBag, Gift, Percent, Eye, EyeOff, Copy,
  Trash2, ToggleLeft, ToggleRight, Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Role labels in German
const ROLE_LABELS = {
  admin: 'Administrator',
  branch_manager: 'Filialleiter',
  cashier: 'Kassierer'
};

export default function EnterprisePortal() {
  const [token, setToken] = useState(localStorage.getItem('enterprise_token') || '');
  const [enterprise, setEnterprise] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Auth state
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '', company_name: '', contact_person: '', phone: '', address: '' });
  
  // Data state
  const [branches, setBranches] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  
  // Modal state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Report filters
  const [reportPeriod, setReportPeriod] = useState('month');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Fetch enterprise info
  const fetchEnterprise = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEnterprise(data);
      } else {
        localStorage.removeItem('enterprise_token');
        setToken('');
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  // Fetch branches
  const fetchBranches = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/branches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/api-keys${selectedBranch ? `?branch_id=${selectedBranch}` : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.api_keys || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token, selectedBranch]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  // Fetch stats/reports
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/reports/overview?period=${reportPeriod}${selectedBranch ? `&branch_id=${selectedBranch}` : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token, reportPeriod, selectedBranch]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/reports/transactions?period=${reportPeriod}${selectedBranch ? `&branch_id=${selectedBranch}` : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token, reportPeriod, selectedBranch]);

  useEffect(() => {
    if (token) {
      fetchEnterprise();
      fetchBranches();
      fetchApiKeys();
      fetchUsers();
      fetchStats();
      fetchTransactions();
    }
  }, [token, fetchEnterprise, fetchBranches, fetchApiKeys, fetchUsers, fetchStats, fetchTransactions]);

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/enterprise/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('enterprise_token', data.token);
        setToken(data.token);
        toast.success(`Willkommen, ${data.company_name}!`);
      } else {
        toast.error(data.detail || 'Login fehlgeschlagen');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Register
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/enterprise/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIsRegistering(false);
        setAuthForm({ email: '', password: '', company_name: '', contact_person: '', phone: '', address: '' });
      } else {
        toast.error(data.detail || 'Registrierung fehlgeschlagen');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('enterprise_token');
    setToken('');
    setEnterprise(null);
    toast.success('Abgemeldet');
  };

  // Create Branch
  const handleCreateBranch = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/branches`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowBranchModal(false);
        fetchBranches();
      } else {
        toast.error(data.detail);
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  // Create API Key
  const handleCreateApiKey = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/api-keys`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        // Show the keys in a modal
        setEditingItem({ 
          type: 'new_key', 
          api_key: data.api_key, 
          secret_key: data.secret_key 
        });
        fetchApiKeys();
      } else {
        toast.error(data.detail);
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  // Toggle API Key
  const handleToggleKey = async (keyId) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/api-keys/${keyId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchApiKeys();
      } else {
        toast.error(data.detail);
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  // Delete API Key
  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('API-Key wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchApiKeys();
      } else {
        toast.error(data.detail);
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  // Create User
  const handleCreateUser = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowUserModal(false);
        fetchUsers();
      } else {
        toast.error(data.detail);
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  // Export Report
  const handleExport = async (format) => {
    try {
      const url = `${API_URL}/api/enterprise/reports/export?format=${format}&period=${reportPeriod}${selectedBranch ? `&branch_id=${selectedBranch}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = format === 'csv' ? `bericht_${reportPeriod}.csv` : `bericht_${reportPeriod}.html`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        toast.success(`${format.toUpperCase()} Export heruntergeladen`);
      }
    } catch (err) {
      toast.error('Export fehlgeschlagen');
    }
  };

  // ==================== RENDER ====================

  // Login/Register Screen
  if (!token || !enterprise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Enterprise Portal</h1>
            <p className="text-gray-400 mt-2">Großhändler-Verwaltung für BidBlitz</p>
          </div>

          <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
            {isRegistering ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <h2 className="text-xl font-bold text-white mb-4">Registrierung</h2>
                <input
                  type="text"
                  placeholder="Firmenname (z.B. Edeka Zentrale)"
                  value={authForm.company_name}
                  onChange={(e) => setAuthForm({...authForm, company_name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Ansprechpartner"
                  value={authForm.contact_person}
                  onChange={(e) => setAuthForm({...authForm, contact_person: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500"
                  required
                />
                <input
                  type="email"
                  placeholder="E-Mail"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500"
                  required
                />
                <input
                  type="tel"
                  placeholder="Telefon (optional)"
                  value={authForm.phone}
                  onChange={(e) => setAuthForm({...authForm, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500"
                />
                <input
                  type="password"
                  placeholder="Passwort (min. 8 Zeichen)"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500"
                  required
                  minLength={8}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Wird registriert...' : 'Registrieren'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="w-full py-2 text-gray-400 hover:text-white"
                >
                  Zurück zum Login
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <h2 className="text-xl font-bold text-white mb-4">Anmelden</h2>
                <input
                  type="email"
                  placeholder="E-Mail"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500"
                  required
                />
                <input
                  type="password"
                  placeholder="Passwort"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Anmelden...' : 'Anmelden'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="w-full py-2 text-gray-400 hover:text-white"
                >
                  Noch kein Account? Jetzt registrieren
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Portal
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold">{enterprise.company_name}</h1>
                <p className="text-xs text-gray-400">Enterprise Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1"><Store className="w-4 h-4" /> {enterprise.stats?.branches || 0} Filialen</span>
                <span className="flex items-center gap-1"><Key className="w-4 h-4" /> {enterprise.stats?.api_keys || 0} API-Keys</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {enterprise.stats?.users || 0} Benutzer</span>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-gray-700 rounded-lg">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'branches', label: 'Filialen', icon: Store },
              { id: 'api-keys', label: 'API-Keys', icon: Key },
              { id: 'users', label: 'Benutzer', icon: Users },
              { id: 'reports', label: 'Berichte', icon: FileText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border-orange-500 text-orange-600 font-semibold' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow">
                {['day', 'week', 'month', 'year'].map(p => (
                  <button
                    key={p}
                    onClick={() => setReportPeriod(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      reportPeriod === p ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p === 'day' ? 'Heute' : p === 'week' ? 'Woche' : p === 'month' ? 'Monat' : 'Jahr'}
                  </button>
                ))}
              </div>
              <button onClick={() => { fetchStats(); fetchTransactions(); }} className="p-2 bg-white rounded-lg shadow hover:bg-gray-50">
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Euro className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-sm text-gray-500">Umsatz</span>
                  </div>
                  <p className="text-2xl font-bold">€{stats.stats.total_revenue?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-500">Transaktionen</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.stats.total_transactions || 0}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Percent className="w-5 h-5 text-orange-600" />
                    </div>
                    <span className="text-sm text-gray-500">Provision</span>
                  </div>
                  <p className="text-2xl font-bold">€{stats.stats.total_commission?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Gift className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-500">Bonus ausgegeben</span>
                  </div>
                  <p className="text-2xl font-bold">€{stats.stats.total_bonus_given?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-pink-600" />
                    </div>
                    <span className="text-sm text-gray-500">Cashback</span>
                  </div>
                  <p className="text-2xl font-bold">€{stats.stats.total_cashback?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            )}

            {/* Branch Comparison */}
            {stats?.branch_comparison?.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Store className="w-5 h-5 text-orange-500" />
                  Filial-Vergleich (Top 10)
                </h3>
                <div className="space-y-3">
                  {stats.branch_comparison.map((branch, i) => (
                    <div key={branch.branch_id} className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' : 
                        i === 1 ? 'bg-gray-100 text-gray-600' : 
                        i === 2 ? 'bg-orange-100 text-orange-700' : 
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{branch.branch_name}</p>
                        <p className="text-sm text-gray-500">{branch.transactions} Transaktionen</p>
                      </div>
                      <p className="font-bold text-green-600">€{branch.revenue?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-500" />
                Letzte Transaktionen
              </h3>
              {transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Datum</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Filiale</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Kasse</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Typ</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Betrag</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Provision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactions.slice(0, 10).map((tx, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{new Date(tx.created_at).toLocaleString('de-DE')}</td>
                          <td className="px-4 py-3">{tx.branch_name || '-'}</td>
                          <td className="px-4 py-3">{tx.register_name || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              tx.type === 'topup' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {tx.type === 'topup' ? 'Aufladung' : 'Zahlung'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">€{tx.amount?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-orange-600">€{tx.merchant_commission?.toFixed(2) || '0.00'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Keine Transaktionen im gewählten Zeitraum</p>
              )}
            </div>
          </div>
        )}

        {/* Branches Tab */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Filialen</h2>
              <button
                onClick={() => setShowBranchModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
              >
                <Plus className="w-4 h-4" />
                Neue Filiale
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map(branch => (
                <div key={branch.id} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        branch.is_active ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Store className={`w-5 h-5 ${branch.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-bold">{branch.name}</h3>
                        <p className="text-sm text-gray-500">{branch.city || 'Keine Stadt'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      branch.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {branch.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-gray-600">
                      <Key className="w-4 h-4" />
                      {branch.api_keys_count || 0} API-Keys
                    </p>
                    <p className="flex items-center gap-2 text-gray-600">
                      <Euro className="w-4 h-4" />
                      €{branch.total_revenue?.toFixed(2) || '0.00'} Umsatz
                    </p>
                    {branch.manager_name && (
                      <p className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4" />
                        {branch.manager_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {branches.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center">
                <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Noch keine Filialen angelegt</p>
                <button
                  onClick={() => setShowBranchModal(true)}
                  className="mt-4 text-orange-500 hover:underline"
                >
                  Erste Filiale erstellen
                </button>
              </div>
            )}
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'api-keys' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-bold">API-Keys / Kassen</h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-4 py-2 bg-white border rounded-xl text-sm"
                >
                  <option value="">Alle Filialen</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
                >
                  <Plus className="w-4 h-4" />
                  Neue Kasse
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Kasse</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Filiale</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">API-Key</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Umsatz</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apiKeys.map(key => (
                    <tr key={key.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{key.name}</td>
                      <td className="px-4 py-3 text-gray-600">{key.branch_name}</td>
                      <td className="px-4 py-3">
                        <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {key.api_key?.slice(0, 20)}...
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(key.api_key); toast.success('Kopiert!'); }}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          key.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {key.is_active ? 'Aktiv' : 'Deaktiviert'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">€{key.total_volume?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleToggleKey(key.id)}
                            className={`p-2 rounded-lg ${key.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                            title={key.is_active ? 'Deaktivieren' : 'Aktivieren'}
                          >
                            {key.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteKey(key.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Löschen"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {apiKeys.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  Keine API-Keys gefunden. Erstellen Sie einen für Ihre erste Kasse.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Benutzer & Mitarbeiter</h2>
              <button
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
              >
                <Plus className="w-4 h-4" />
                Neuer Benutzer
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {users.map(user => (
                <div key={user.id} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.role === 'admin' ? 'bg-purple-100' : 
                        user.role === 'branch_manager' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Users className={`w-5 h-5 ${
                          user.role === 'admin' ? 'text-purple-600' : 
                          user.role === 'branch_manager' ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-bold">{user.name}</h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {user.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className={`inline-block px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                      user.role === 'branch_manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {ROLE_LABELS[user.role]}
                    </p>
                    {user.branch_name && (
                      <p className="text-gray-600 flex items-center gap-1 mt-2">
                        <Store className="w-4 h-4" />
                        {user.branch_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {users.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Noch keine Mitarbeiter angelegt</p>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-bold">Berichte exportieren</h2>
              <div className="flex items-center gap-2">
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value)}
                  className="px-4 py-2 bg-white border rounded-xl"
                >
                  <option value="day">Heute</option>
                  <option value="week">Diese Woche</option>
                  <option value="month">Dieser Monat</option>
                  <option value="year">Dieses Jahr</option>
                </select>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-4 py-2 bg-white border rounded-xl"
                >
                  <option value="">Alle Filialen</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">CSV Export</h3>
                    <p className="text-sm text-gray-500">Excel-kompatibel, zur Weiterverarbeitung</p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  CSV herunterladen
                </button>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">PDF Export</h3>
                    <p className="text-sm text-gray-500">Zum Ausdrucken, mit Zusammenfassung</p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  PDF öffnen
                </button>
              </div>
            </div>

            {/* Report Preview */}
            {stats && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold mb-4">Vorschau: {
                  reportPeriod === 'day' ? 'Heute' : 
                  reportPeriod === 'week' ? 'Diese Woche' : 
                  reportPeriod === 'month' ? 'Dieser Monat' : 'Dieses Jahr'
                }</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Umsatz</p>
                    <p className="text-xl font-bold">€{stats.stats.total_revenue?.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Transaktionen</p>
                    <p className="text-xl font-bold">{stats.stats.total_transactions}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Ihre Provision</p>
                    <p className="text-xl font-bold text-orange-600">€{stats.stats.total_commission?.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Bonus ausgegeben</p>
                    <p className="text-xl font-bold text-purple-600">€{stats.stats.total_bonus_given?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Branch Modal */}
      {showBranchModal && (
        <Modal title="Neue Filiale erstellen" onClose={() => setShowBranchModal(false)}>
          <BranchForm 
            branches={branches}
            onSubmit={handleCreateBranch}
            onCancel={() => setShowBranchModal(false)}
          />
        </Modal>
      )}

      {/* API Key Modal */}
      {showKeyModal && (
        <Modal title="Neue Kasse / API-Key erstellen" onClose={() => setShowKeyModal(false)}>
          <ApiKeyForm 
            branches={branches}
            onSubmit={handleCreateApiKey}
            onCancel={() => setShowKeyModal(false)}
          />
        </Modal>
      )}

      {/* User Modal */}
      {showUserModal && (
        <Modal title="Neuen Benutzer erstellen" onClose={() => setShowUserModal(false)}>
          <UserForm 
            branches={branches}
            onSubmit={handleCreateUser}
            onCancel={() => setShowUserModal(false)}
          />
        </Modal>
      )}

      {/* New Key Display Modal */}
      {editingItem?.type === 'new_key' && (
        <Modal title="⚠️ API-Schlüssel erstellt!" onClose={() => setEditingItem(null)}>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800 text-sm">
              <strong>Wichtig:</strong> Speichern Sie diese Schlüssel jetzt! Der Secret-Key wird nicht erneut angezeigt.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API-Key:</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm break-all">{editingItem.api_key}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(editingItem.api_key); toast.success('Kopiert!'); }}
                  className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secret-Key:</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm break-all">{editingItem.secret_key}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(editingItem.secret_key); toast.success('Kopiert!'); }}
                  className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              onClick={() => setEditingItem(null)}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600"
            >
              Verstanden, ich habe die Schlüssel gespeichert
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Modal Component
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// Branch Form
function BranchForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', city: '', address: '', manager_name: '', manager_email: '', phone: '' });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Filialname (z.B. Edeka München Zentrum)"
        value={form.name}
        onChange={(e) => setForm({...form, name: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Stadt"
          value={form.city}
          onChange={(e) => setForm({...form, city: e.target.value})}
          className="px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        />
        <input
          type="tel"
          placeholder="Telefon"
          value={form.phone}
          onChange={(e) => setForm({...form, phone: e.target.value})}
          className="px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        />
      </div>
      <input
        type="text"
        placeholder="Adresse"
        value={form.address}
        onChange={(e) => setForm({...form, address: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
      />
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Filialleiter Name"
          value={form.manager_name}
          onChange={(e) => setForm({...form, manager_name: e.target.value})}
          className="px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        />
        <input
          type="email"
          placeholder="Filialleiter E-Mail"
          value={form.manager_email}
          onChange={(e) => setForm({...form, manager_email: e.target.value})}
          className="px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border rounded-xl hover:bg-gray-50">
          Abbrechen
        </button>
        <button type="submit" className="flex-1 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600">
          Filiale erstellen
        </button>
      </div>
    </form>
  );
}

// API Key Form
function ApiKeyForm({ branches, onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', branch_id: '', description: '' });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.branch_id) {
      toast.error('Bitte Filiale auswählen');
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select
        value={form.branch_id}
        onChange={(e) => setForm({...form, branch_id: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        required
      >
        <option value="">Filiale auswählen...</option>
        {branches.filter(b => b.is_active).map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Kassenname (z.B. Kasse 1, Kasse Haupteingang)"
        value={form.name}
        onChange={(e) => setForm({...form, name: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        required
      />
      <input
        type="text"
        placeholder="Beschreibung (optional)"
        value={form.description}
        onChange={(e) => setForm({...form, description: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
      />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border rounded-xl hover:bg-gray-50">
          Abbrechen
        </button>
        <button type="submit" className="flex-1 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600">
          API-Key erstellen
        </button>
      </div>
    </form>
  );
}

// User Form
function UserForm({ branches, onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '', branch_id: '' });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.role !== 'admin' && !form.branch_id) {
      toast.error('Bitte Filiale für diesen Benutzer auswählen');
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm({...form, name: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        required
      />
      <input
        type="email"
        placeholder="E-Mail"
        value={form.email}
        onChange={(e) => setForm({...form, email: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        required
      />
      <input
        type="password"
        placeholder="Passwort (min. 6 Zeichen)"
        value={form.password}
        onChange={(e) => setForm({...form, password: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        required
        minLength={6}
      />
      <select
        value={form.role}
        onChange={(e) => setForm({...form, role: e.target.value})}
        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
        required
      >
        <option value="">Rolle auswählen...</option>
        <option value="admin">Administrator (alle Filialen)</option>
        <option value="branch_manager">Filialleiter (nur eine Filiale)</option>
        <option value="cashier">Kassierer (nur eine Filiale)</option>
      </select>
      {form.role && form.role !== 'admin' && (
        <select
          value={form.branch_id}
          onChange={(e) => setForm({...form, branch_id: e.target.value})}
          className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500"
          required
        >
          <option value="">Filiale zuweisen...</option>
          {branches.filter(b => b.is_active).map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border rounded-xl hover:bg-gray-50">
          Abbrechen
        </button>
        <button type="submit" className="flex-1 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600">
          Benutzer erstellen
        </button>
      </div>
    </form>
  );
}
