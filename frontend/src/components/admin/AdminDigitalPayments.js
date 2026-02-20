/**
 * Admin Digital Payment API Dashboard
 * Manages API keys, payments, and statistics for external POS integrations
 * Mobile-optimized design
 */
import React, { useState, useEffect } from 'react';
import { 
  Key, CreditCard, TrendingUp, Store, RefreshCw, Copy,
  Plus, Trash2, CheckCircle, AlertTriangle, ExternalLink, Webhook
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ADMIN_KEY = 'bidblitz-admin-2026';

export default function AdminDigitalPayments() {
  const [activeTab, setActiveTab] = useState('overview');
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyWebhook, setNewKeyWebhook] = useState('');
  const [newKeyPlatformCommission, setNewKeyPlatformCommission] = useState(0.5);
  const [newKeyCustomerCashback, setNewKeyCustomerCashback] = useState(0);
  const [createdKey, setCreatedKey] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editCommission, setEditCommission] = useState({ platform: 0.5, cashback: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const keysRes = await fetch(`${API_URL}/api/digital/keys/list`, {
        headers: { 'X-Admin-Key': ADMIN_KEY }
      });
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData.keys || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Bitte Namen eingeben');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/digital/keys/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY
        },
        body: JSON.stringify({
          name: newKeyName,
          webhook_url: newKeyWebhook || null,
          platform_commission: newKeyPlatformCommission,
          customer_cashback: newKeyCustomerCashback
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data);
        toast.success('API-Key erstellt!');
        fetchData();
        setNewKeyName('');
        setNewKeyWebhook('');
        setNewKeyPlatformCommission(0.5);
        setNewKeyCustomerCashback(0);
      } else {
        toast.error('Fehler beim Erstellen');
      }
    } catch (err) {
      toast.error('Fehler beim Erstellen');
    }
  };

  const revokeApiKey = async (keyId, keyName) => {
    if (!window.confirm(`API-Key "${keyName}" wirklich widerrufen?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/digital/keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': ADMIN_KEY }
      });

      if (res.ok) {
        toast.success('API-Key widerrufen');
        fetchData();
      } else {
        toast.error('Fehler');
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopiert!');
  };

  const updateCommission = async (keyId) => {
    try {
      const res = await fetch(`${API_URL}/api/digital/keys/${keyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY
        },
        body: JSON.stringify({
          platform_commission: editCommission.platform,
          customer_cashback: editCommission.cashback
        })
      });

      if (res.ok) {
        toast.success('Provisionen aktualisiert!');
        setEditingKey(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Fehler beim Aktualisieren');
      }
    } catch (err) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  // Calculate stats
  const stats = {
    total: apiKeys.length,
    active: apiKeys.filter(k => k.is_active).length,
    requests: apiKeys.reduce((sum, k) => sum + (k.total_requests || 0), 0),
    volume: apiKeys.reduce((sum, k) => sum + (k.total_volume || 0), 0)
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="admin-digital-payments">
      {/* Header - Mobile optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" />
            Digital Payment API
          </h2>
          <p className="text-sm text-gray-600 mt-1">Externe Kassensysteme verwalten (z.B. Edeka)</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="flex gap-1 sm:gap-2 border-b overflow-x-auto pb-px -mx-4 px-4 sm:mx-0 sm:px-0">
        {[
          { id: 'overview', label: 'Übersicht', icon: TrendingUp },
          { id: 'api-keys', label: 'API-Keys', icon: Key },
          { id: 'docs', label: 'Dokumentation', icon: ExternalLink }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-colors whitespace-nowrap text-sm ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Stats Cards - 2x2 grid on mobile, 4 columns on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Key className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">API-Keys</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.active}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Aktive Keys</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.requests}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Anfragen</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">€{stats.volume.toFixed(0)}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Volumen</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Merchants */}
          <div className="bg-white rounded-xl border">
            <div className="p-3 sm:p-4 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                <Store className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                Aktive Händler
              </h3>
            </div>
            <div className="p-3 sm:p-4">
              {loading ? (
                <p className="text-gray-500 text-center py-4 text-sm">Laden...</p>
              ) : apiKeys.filter(k => k.is_active).length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">Keine aktiven Händler</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {apiKeys.filter(k => k.is_active).map(key => (
                    <div key={key.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Store className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{key.name}</p>
                          <p className="text-xs text-gray-500">
                            {key.total_requests || 0} Anfragen
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-semibold text-green-600 text-sm sm:text-base">€{(key.total_volume || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Create New Key */}
          <div className="bg-white rounded-xl border p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm sm:text-base">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              Neuen API-Key erstellen
            </h3>
            
            {createdKey ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold text-sm sm:text-base">API-Key erstellt!</span>
                </div>
                <div className="bg-white rounded-lg p-3 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">API Key</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs sm:text-sm bg-gray-100 px-2 py-1 rounded overflow-x-auto">{createdKey.api_key}</code>
                      <button onClick={() => copyToClipboard(createdKey.api_key)} className="p-1.5 hover:bg-gray-100 rounded flex-shrink-0">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Secret Key (nur einmal sichtbar!)</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs sm:text-sm bg-yellow-100 px-2 py-1 rounded text-yellow-800 overflow-x-auto">{createdKey.secret_key}</code>
                      <button onClick={() => copyToClipboard(createdKey.secret_key)} className="p-1.5 hover:bg-gray-100 rounded flex-shrink-0">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-yellow-700 flex items-start gap-1">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Speichern Sie den Secret Key jetzt!
                </p>
                <button
                  onClick={() => setCreatedKey(null)}
                  className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  Fertig
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Händlername *
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="z.B. Edeka Berlin"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={newKeyWebhook}
                      onChange={(e) => setNewKeyWebhook(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={createApiKey}
                  className="w-full sm:w-auto px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center justify-center gap-2 text-sm"
                >
                  <Key className="w-4 h-4" />
                  API-Key erstellen
                </button>
              </div>
            )}
          </div>

          {/* Existing Keys */}
          <div className="bg-white rounded-xl border">
            <div className="p-3 sm:p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Alle API-Keys ({apiKeys.length})</h3>
            </div>
            <div className="divide-y">
              {loading ? (
                <p className="text-gray-500 text-center py-8 text-sm">Laden...</p>
              ) : apiKeys.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">Keine API-Keys vorhanden</p>
              ) : (
                apiKeys.map(key => (
                  <div key={key.id} className={`p-3 sm:p-4 ${!key.is_active ? 'bg-gray-50' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Store className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
                          <span className="font-semibold text-gray-900 text-sm sm:text-base">{key.name}</span>
                          {!key.is_active && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                              Widerrufen
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-[200px] sm:max-w-none">{key.key}</code>
                          <button onClick={() => copyToClipboard(key.key)} className="p-1 hover:bg-gray-200 rounded flex-shrink-0">
                            <Copy className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                          </button>
                        </div>
                        {key.webhook_url && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Webhook className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{key.webhook_url}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>{key.total_requests || 0} Anfragen</span>
                          <span>€{(key.total_volume || 0).toFixed(2)}</span>
                          <span>{formatDate(key.created_at)}</span>
                        </div>
                      </div>
                      {key.is_active && (
                        <button
                          onClick={() => revokeApiKey(key.id, key.name)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg self-start flex-shrink-0"
                          title="Widerrufen"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Documentation Tab */}
      {activeTab === 'docs' && (
        <div className="bg-white rounded-xl border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">API-Dokumentation</h3>
          
          <div className="space-y-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">Authentifizierung</h4>
              <p className="text-gray-600">
                Header: <code className="bg-gray-100 px-1 rounded">X-API-Key</code>
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-3">Endpoints</h4>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">POST</span>
                    <code className="text-xs sm:text-sm">/api/digital/payments/create</code>
                  </div>
                  <p className="text-xs text-gray-600">Neue Zahlung erstellen</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">GET</span>
                    <code className="text-xs sm:text-sm">/api/digital/payments/{'{id}'}</code>
                  </div>
                  <p className="text-xs text-gray-600">Zahlungsstatus abfragen</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">POST</span>
                    <code className="text-xs sm:text-sm">/api/digital/payments/{'{id}'}/refund</code>
                  </div>
                  <p className="text-xs text-gray-600">Zahlung erstatten</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Webhook Events</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1 text-xs sm:text-sm">
                <li><code>payment.completed</code></li>
                <li><code>payment.failed</code></li>
                <li><code>payment.refunded</code></li>
              </ul>
            </div>

            <a
              href={`${API_URL}/api/digital/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Vollständige Dokumentation
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
