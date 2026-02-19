/**
 * Admin Digital Payment API Dashboard
 * Manages API keys, payments, and statistics for external POS integrations
 * Mobile-optimized design
 */
import React, { useState, useEffect } from 'react';
import { 
  Key, CreditCard, TrendingUp, Store, RefreshCw, Copy,
  Plus, Trash2, CheckCircle, Clock, XCircle,
  AlertTriangle, ExternalLink, Webhook
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
  const [createdKey, setCreatedKey] = useState(null);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch API keys
      const keysRes = await fetch(`${API_URL}/api/digital/keys/list`, {
        headers: { 'X-Admin-Key': ADMIN_KEY }
      });
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData.keys || []);
      }

      // Calculate stats from keys
      const keys = apiKeys;
      const totalRequests = keys.reduce((sum, k) => sum + (k.total_requests || 0), 0);
      const totalVolume = keys.reduce((sum, k) => sum + (k.total_volume || 0), 0);
      setStats({
        total_api_keys: keys.length,
        active_api_keys: keys.filter(k => k.is_active).length,
        total_requests: totalRequests,
        total_volume: totalVolume
      });

    } catch (err) {
      console.error('Failed to fetch data:', err);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  // Fetch payments for a specific API key
  const fetchPaymentsForKey = async (apiKey) => {
    try {
      const res = await fetch(`${API_URL}/api/digital/payments?limit=100`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        return data.payments || [];
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    }
    return [];
  };

  // Create new API key
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
          webhook_url: newKeyWebhook || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data);
        toast.success('API-Key erstellt!');
        fetchData();
        setNewKeyName('');
        setNewKeyWebhook('');
      } else {
        toast.error('Fehler beim Erstellen');
      }
    } catch (err) {
      toast.error('Fehler beim Erstellen');
    }
  };

  // Revoke API key
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
        toast.error('Fehler beim Widerrufen');
      }
    } catch (err) {
      toast.error('Fehler beim Widerrufen');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopiert!');
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Status badge
  const StatusBadge = ({ status }) => {
    const config = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Ausstehend' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Abgeschlossen' },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Fehlgeschlagen' },
      expired: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Abgelaufen' },
      refunded: { color: 'bg-purple-100 text-purple-800', icon: RefreshCw, label: 'Erstattet' }
    };
    const { color, icon: Icon, label } = config[status] || config.pending;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-7 h-7 text-orange-500" />
            Digital Payment API
          </h2>
          <p className="text-gray-600 mt-1">Externe Kassensysteme verwalten (z.B. Edeka)</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'overview', label: 'Übersicht', icon: TrendingUp },
          { id: 'api-keys', label: 'API-Keys', icon: Key },
          { id: 'payments', label: 'Zahlungen', icon: CreditCard },
          { id: 'docs', label: 'Dokumentation', icon: ExternalLink }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
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
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Key className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{apiKeys.length}</p>
                  <p className="text-sm text-gray-500">API-Keys</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {apiKeys.filter(k => k.is_active).length}
                  </p>
                  <p className="text-sm text-gray-500">Aktive Keys</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {apiKeys.reduce((sum, k) => sum + (k.total_requests || 0), 0)}
                  </p>
                  <p className="text-sm text-gray-500">Anfragen gesamt</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    €{apiKeys.reduce((sum, k) => sum + (k.total_volume || 0), 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">Volumen gesamt</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Merchants */}
          <div className="bg-white rounded-xl border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-orange-500" />
                Aktive Händler
              </h3>
            </div>
            <div className="p-4">
              {apiKeys.filter(k => k.is_active).length === 0 ? (
                <p className="text-gray-500 text-center py-4">Keine aktiven Händler</p>
              ) : (
                <div className="space-y-3">
                  {apiKeys.filter(k => k.is_active).map(key => (
                    <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Store className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{key.name}</p>
                          <p className="text-sm text-gray-500">
                            {key.total_requests || 0} Anfragen • €{(key.total_volume || 0).toFixed(2)} Volumen
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>Erstellt: {formatDate(key.created_at)}</p>
                        {key.last_used && <p>Zuletzt: {formatDate(key.last_used)}</p>}
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
        <div className="space-y-6">
          {/* Create New Key */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-500" />
              Neuen API-Key erstellen
            </h3>
            
            {createdKey ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">API-Key erfolgreich erstellt!</span>
                </div>
                <div className="bg-white rounded-lg p-3 space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">API Key</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-gray-100 px-2 py-1 rounded">{createdKey.api_key}</code>
                      <button onClick={() => copyToClipboard(createdKey.api_key)} className="p-1 hover:bg-gray-100 rounded">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Secret Key (nur einmal sichtbar!)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-yellow-100 px-2 py-1 rounded text-yellow-800">{createdKey.secret_key}</code>
                      <button onClick={() => copyToClipboard(createdKey.secret_key)} className="p-1 hover:bg-gray-100 rounded">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-yellow-700 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Speichern Sie den Secret Key jetzt! Er wird nicht mehr angezeigt.
                </p>
                <button
                  onClick={() => setCreatedKey(null)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Fertig
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Händlername *
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="z.B. Edeka Berlin Mitte"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL (optional)
                    </label>
                    <input
                      type="url"
                      value={newKeyWebhook}
                      onChange={(e) => setNewKeyWebhook(e.target.value)}
                      placeholder="https://example.com/webhook"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <button
                  onClick={createApiKey}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  API-Key erstellen
                </button>
              </div>
            )}
          </div>

          {/* Existing Keys */}
          <div className="bg-white rounded-xl border">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Alle API-Keys ({apiKeys.length})</h3>
            </div>
            <div className="divide-y">
              {apiKeys.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Keine API-Keys vorhanden</p>
              ) : (
                apiKeys.map(key => (
                  <div key={key.id} className={`p-4 ${!key.is_active ? 'bg-gray-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Store className="w-5 h-5 text-orange-500" />
                          <span className="font-semibold text-gray-900">{key.name}</span>
                          {!key.is_active && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                              Widerrufen
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">{key.key}</code>
                          <button onClick={() => copyToClipboard(key.key)} className="p-1 hover:bg-gray-200 rounded">
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                        {key.webhook_url && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Webhook className="w-4 h-4" />
                            <span className="truncate max-w-xs">{key.webhook_url}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{key.total_requests || 0} Anfragen</span>
                          <span>€{(key.total_volume || 0).toFixed(2)} Volumen</span>
                          <span>Erstellt: {formatDate(key.created_at)}</span>
                        </div>
                      </div>
                      {key.is_active && (
                        <button
                          onClick={() => revokeApiKey(key.id, key.name)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title="API-Key widerrufen"
                        >
                          <Trash2 className="w-5 h-5" />
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

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Hinweis</p>
              <p className="text-sm text-yellow-700">
                Zahlungen sind API-Key-spezifisch. Wählen Sie einen Händler oben aus, um dessen Zahlungen zu sehen.
                Oder verwenden Sie die API: <code className="bg-yellow-100 px-1 rounded">GET /api/digital/payments</code>
              </p>
            </div>
          </div>

          {/* Payment Statistics per Merchant */}
          <div className="bg-white rounded-xl border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Zahlungsübersicht pro Händler</h3>
            </div>
            <div className="p-4">
              {apiKeys.filter(k => k.is_active).length === 0 ? (
                <p className="text-gray-500 text-center py-4">Keine aktiven Händler</p>
              ) : (
                <div className="space-y-3">
                  {apiKeys.filter(k => k.is_active).map(key => (
                    <div key={key.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Store className="w-8 h-8 text-orange-500" />
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-sm text-gray-500">{key.total_requests || 0} Transaktionen</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">€{(key.total_volume || 0).toFixed(2)}</p>
                        <p className="text-sm text-gray-500">Gesamtvolumen</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Documentation Tab */}
      {activeTab === 'docs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">API-Dokumentation</h3>
            
            <div className="prose max-w-none">
              <h4 className="text-md font-medium mt-4">Authentifizierung</h4>
              <p className="text-gray-600">
                Alle API-Anfragen müssen den Header <code className="bg-gray-100 px-1 rounded">X-API-Key</code> enthalten.
              </p>

              <h4 className="text-md font-medium mt-6">Endpoints</h4>
              
              <div className="space-y-4 mt-4">
                {/* Create Payment */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">POST</span>
                    <code className="text-sm">/api/digital/payments/create</code>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Neue Zahlung erstellen</p>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`{
  "amount": 25.50,
  "reference": "ORDER-12345",
  "description": "Einkauf bei Edeka",
  "customer_email": "kunde@example.com"
}`}
                  </pre>
                </div>

                {/* Get Payment */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded">GET</span>
                    <code className="text-sm">/api/digital/payments/{'{payment_id}'}</code>
                  </div>
                  <p className="text-sm text-gray-600">Zahlungsstatus abfragen</p>
                </div>

                {/* List Payments */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded">GET</span>
                    <code className="text-sm">/api/digital/payments</code>
                  </div>
                  <p className="text-sm text-gray-600">Alle Zahlungen auflisten (mit Filtern)</p>
                </div>

                {/* Refund */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">POST</span>
                    <code className="text-sm">/api/digital/payments/{'{payment_id}'}/refund</code>
                  </div>
                  <p className="text-sm text-gray-600">Zahlung erstatten (voll oder teilweise)</p>
                </div>

                {/* Balance */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded">GET</span>
                    <code className="text-sm">/api/digital/balance</code>
                  </div>
                  <p className="text-sm text-gray-600">Statistiken und Kontostand abrufen</p>
                </div>
              </div>

              <h4 className="text-md font-medium mt-6">Webhook Events</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li><code>payment.completed</code> - Zahlung abgeschlossen</li>
                <li><code>payment.failed</code> - Zahlung fehlgeschlagen</li>
                <li><code>payment.refunded</code> - Zahlung erstattet</li>
                <li><code>payment.expired</code> - Zahlung abgelaufen</li>
              </ul>

              <div className="mt-6">
                <a
                  href={`${API_URL}/api/digital/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  <ExternalLink className="w-4 h-4" />
                  Vollständige API-Dokumentation
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
