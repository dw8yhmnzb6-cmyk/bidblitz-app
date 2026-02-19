/**
 * Digital Payment API Developer Documentation
 * Interactive API documentation for external partners (like Swagger UI)
 */
import React, { useState } from 'react';
import { 
  Key, Send, CheckCircle, Copy, ChevronDown, ChevronUp,
  ExternalLink, Code, Terminal, AlertTriangle, Info
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const endpoints = [
  {
    method: 'POST',
    path: '/api/digital/payments/create',
    title: 'Zahlung erstellen',
    description: 'Erstellt eine neue Zahlungsanforderung',
    headers: ['X-API-Key: Ihr API-Key'],
    body: {
      amount: { type: 'number', required: true, description: 'Betrag in EUR', example: 25.50 },
      reference: { type: 'string', required: true, description: 'Ihre interne Referenz', example: 'ORDER-12345' },
      description: { type: 'string', required: false, description: 'Beschreibung für den Kunden', example: 'Einkauf bei Edeka' },
      customer_email: { type: 'string', required: false, description: 'E-Mail für Benachrichtigung', example: 'kunde@example.com' },
      expires_in_minutes: { type: 'number', required: false, description: 'Gültigkeit (Standard: 1440)', example: 30 }
    },
    response: {
      payment_id: 'pay_abc123...',
      status: 'pending',
      checkout_url: 'https://bidblitz.ae/checkout/pay_abc123...',
      expires_at: '2026-02-20T12:00:00Z'
    }
  },
  {
    method: 'GET',
    path: '/api/digital/payments/{payment_id}',
    title: 'Zahlungsstatus abfragen',
    description: 'Ruft den aktuellen Status einer Zahlung ab',
    headers: ['X-API-Key: Ihr API-Key'],
    params: [{ name: 'payment_id', description: 'ID der Zahlung', example: 'pay_abc123...' }],
    response: {
      payment_id: 'pay_abc123...',
      amount: 25.50,
      status: 'completed',
      reference: 'ORDER-12345',
      paid_at: '2026-02-20T11:35:00Z'
    }
  },
  {
    method: 'GET',
    path: '/api/digital/payments',
    title: 'Zahlungen auflisten',
    description: 'Listet alle Zahlungen mit optionalen Filtern auf',
    headers: ['X-API-Key: Ihr API-Key'],
    queryParams: [
      { name: 'status', description: 'Filter nach Status', example: 'completed' },
      { name: 'limit', description: 'Anzahl (max 100)', example: '50' },
      { name: 'offset', description: 'Offset für Pagination', example: '0' }
    ],
    response: {
      payments: ['...'],
      total: 42,
      limit: 50,
      offset: 0
    }
  },
  {
    method: 'POST',
    path: '/api/digital/payments/{payment_id}/refund',
    title: 'Zahlung erstatten',
    description: 'Erstattet eine abgeschlossene Zahlung (voll oder teilweise)',
    headers: ['X-API-Key: Ihr API-Key'],
    body: {
      amount: { type: 'number', required: false, description: 'Teilbetrag (optional, ohne = volle Erstattung)', example: 10.00 },
      reason: { type: 'string', required: false, description: 'Grund der Erstattung', example: 'Retoure' }
    },
    response: {
      success: true,
      refund_id: 'ref_xyz789...',
      amount_refunded: 10.00,
      status: 'refunded'
    }
  },
  {
    method: 'GET',
    path: '/api/digital/balance',
    title: 'Statistiken abrufen',
    description: 'Ruft Statistiken und Nutzungsdaten ab',
    headers: ['X-API-Key: Ihr API-Key'],
    queryParams: [
      { name: 'customer_id', description: 'Optional: Kundenkontostand abfragen', example: 'BID-123456' }
    ],
    response: {
      api_key_name: 'Edeka Berlin',
      total_requests: 150,
      total_volume: 3500.00,
      last_used: '2026-02-20T12:00:00Z'
    }
  }
];

const webhookEvents = [
  { event: 'payment.completed', description: 'Zahlung wurde vom Kunden bestätigt' },
  { event: 'payment.failed', description: 'Zahlung ist fehlgeschlagen' },
  { event: 'payment.refunded', description: 'Zahlung wurde erstattet' },
  { event: 'payment.expired', description: 'Zahlungsanforderung ist abgelaufen' }
];

export default function ApiDocs() {
  const [expandedEndpoint, setExpandedEndpoint] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code kopiert!');
  };

  const testEndpoint = async (endpoint) => {
    if (!apiKey) {
      toast.error('Bitte API-Key eingeben');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      let url = `${API_URL}${endpoint.path}`;
      const options = {
        method: endpoint.method,
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      };

      if (endpoint.method === 'POST' && endpoint.body) {
        const body = {};
        Object.entries(endpoint.body).forEach(([key, val]) => {
          if (val.example !== undefined) body[key] = val.example;
        });
        options.body = JSON.stringify(body);
      }

      // Replace path params with examples
      if (endpoint.params) {
        endpoint.params.forEach(p => {
          url = url.replace(`{${p.name}}`, p.example);
        });
      }

      const res = await fetch(url, options);
      const data = await res.json();
      
      setTestResult({
        success: res.ok,
        status: res.status,
        data
      });
    } catch (err) {
      setTestResult({
        success: false,
        error: err.message
      });
    } finally {
      setTesting(false);
    }
  };

  const generateCurlCommand = (endpoint) => {
    let cmd = `curl -X ${endpoint.method} "${API_URL}${endpoint.path}"`;
    cmd += ` \\\n  -H "X-API-Key: YOUR_API_KEY"`;
    
    if (endpoint.method === 'POST' && endpoint.body) {
      cmd += ` \\\n  -H "Content-Type: application/json"`;
      const body = {};
      Object.entries(endpoint.body).forEach(([key, val]) => {
        if (val.example !== undefined) body[key] = val.example;
      });
      cmd += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`;
    }
    
    return cmd;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-8 h-8 sm:w-10 sm:h-10" />
            <h1 className="text-2xl sm:text-4xl font-bold">BidBlitz Digital Payment API</h1>
          </div>
          <p className="text-orange-100 text-sm sm:text-lg max-w-2xl">
            Integrieren Sie BidBlitz Pay als Zahlungsmethode in Ihr Kassensystem. 
            Ihre Kunden können mit ihrem BidBlitz-Guthaben bezahlen.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Quick Start */}
        <div className="bg-white rounded-xl border p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-orange-500" />
            Schnellstart
          </h2>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label className="font-medium text-sm sm:text-base whitespace-nowrap">Ihr API-Key:</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="bbz_xxxxxxxxxxxxxxxx"
                className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm"
              />
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Verwenden Sie in der Produktion niemals Ihren Secret Key im Browser. 
                API-Aufrufe sollten nur von Ihrem Backend erfolgen.
              </p>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Code className="w-5 h-5 text-orange-500" />
            API Endpoints
          </h2>
          
          {endpoints.map((endpoint, idx) => (
            <div key={idx} className="bg-white rounded-xl border overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedEndpoint(expandedEndpoint === idx ? -1 : idx)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    endpoint.method === 'GET' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-xs sm:text-sm font-mono text-gray-700">{endpoint.path}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 hidden sm:block">{endpoint.title}</span>
                  {expandedEndpoint === idx ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>
              
              {/* Expanded Content */}
              {expandedEndpoint === idx && (
                <div className="border-t p-4 space-y-4">
                  <p className="text-gray-600 text-sm">{endpoint.description}</p>
                  
                  {/* Headers */}
                  {endpoint.headers && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Headers</h4>
                      <div className="bg-gray-50 rounded-lg p-3">
                        {endpoint.headers.map((h, i) => (
                          <code key={i} className="block text-xs text-gray-700">{h}</code>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Request Body */}
                  {endpoint.body && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Request Body</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Parameter</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Typ</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Beschreibung</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {Object.entries(endpoint.body).map(([key, val]) => (
                              <tr key={key}>
                                <td className="px-3 py-2">
                                  <code className="text-xs">{key}</code>
                                  {val.required && <span className="text-red-500 ml-1">*</span>}
                                </td>
                                <td className="px-3 py-2 text-gray-500 text-xs">{val.type}</td>
                                <td className="px-3 py-2 text-gray-600 text-xs hidden sm:table-cell">{val.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Query Params */}
                  {endpoint.queryParams && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Query Parameter</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Parameter</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Beschreibung</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {endpoint.queryParams.map((p) => (
                              <tr key={p.name}>
                                <td className="px-3 py-2"><code className="text-xs">{p.name}</code></td>
                                <td className="px-3 py-2 text-gray-600 text-xs">{p.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Example Response */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">Beispiel Response</h4>
                    <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto relative">
                      <button 
                        onClick={() => copyCode(JSON.stringify(endpoint.response, null, 2))}
                        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                      >
                        <Copy className="w-3 h-3 text-gray-300" />
                      </button>
                      <pre className="text-xs text-green-400">
                        {JSON.stringify(endpoint.response, null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  {/* cURL Example */}
                  <div>
                    <h4 className="font-medium text-sm mb-2">cURL Beispiel</h4>
                    <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto relative">
                      <button 
                        onClick={() => copyCode(generateCurlCommand(endpoint))}
                        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                      >
                        <Copy className="w-3 h-3 text-gray-300" />
                      </button>
                      <pre className="text-xs text-blue-400 whitespace-pre-wrap">
                        {generateCurlCommand(endpoint)}
                      </pre>
                    </div>
                  </div>
                  
                  {/* Test Button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
                    <button
                      onClick={() => testEndpoint(endpoint)}
                      disabled={testing || !apiKey}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        apiKey 
                          ? 'bg-orange-500 text-white hover:bg-orange-600' 
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      {testing ? 'Teste...' : 'Testen'}
                    </button>
                    
                    {testResult && (
                      <div className={`flex items-center gap-2 text-sm ${
                        testResult.success ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {testResult.success ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Status: {testResult.status}
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4" />
                            Fehler: {testResult.error || `Status ${testResult.status}`}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Test Result */}
                  {testResult?.data && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Test Ergebnis</h4>
                      <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                        <pre className="text-xs text-yellow-400">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Webhooks */}
        <div className="bg-white rounded-xl border p-4 sm:p-6 mb-8">
          <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-orange-500" />
            Webhooks
          </h2>
          
          <p className="text-gray-600 text-sm mb-4">
            Konfigurieren Sie eine Webhook-URL bei der API-Key-Erstellung. 
            Wir senden HTTP POST-Anfragen an Ihre URL bei folgenden Events:
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Event</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Beschreibung</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {webhookEvents.map((e) => (
                  <tr key={e.event}>
                    <td className="px-3 py-2"><code className="text-xs bg-gray-100 px-1 rounded">{e.event}</code></td>
                    <td className="px-3 py-2 text-gray-600">{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Webhook-Signatur verifizieren</p>
              <p>Jeder Webhook enthält den Header <code className="bg-blue-100 px-1 rounded">X-BidBlitz-Signature</code>. 
              Verifizieren Sie die Signatur mit HMAC-SHA256 und Ihrem Secret Key.</p>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="text-center text-gray-500 text-sm pb-8">
          <p>Fragen? Kontaktieren Sie uns unter <a href="mailto:api@bidblitz.ae" className="text-orange-500 hover:underline">api@bidblitz.ae</a></p>
        </div>
      </div>
    </div>
  );
}
