import React, { useState } from 'react';
import { X, Printer, ScanLine, Weight, DollarSign, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * POS Hardware Test & Control Modal
 * Endpoints: /api/pos/hardware/printer/print, /scanner/test, /cash-drawer/open, /scale/weight
 */
export function POSHardwareModal({ isOpen, onClose, storeId = 'default' }) {
  const [activeTab, setActiveTab] = useState('printer');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const headers = {
    'Content-Type': 'application/json',
  };

  const callApi = async (path, body = null, method = 'POST') => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const opts = { method, headers, credentials: 'include' };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API}${path}`, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const testPrinter = () =>
    callApi('/api/pos/hardware/printer/print', {
      store_id: storeId,
      receipt: {
        items: [{ name: 'Test-Artikel', qty: 1, price: 1.99 }],
        total: 1.99,
        tax: 0.32,
      },
      printer_type: 'escpos',
    });

  const testScanner = () => callApi('/api/pos/hardware/scanner/test', null, 'GET');

  const openCashDrawer = () =>
    callApi('/api/pos/hardware/cash-drawer/open', { register_id: storeId, store_id: storeId, reason: 'manual' });

  const readScale = () => callApi('/api/pos/hardware/scale/weight', null, 'GET');

  if (!isOpen) return null;

  const tabs = [
    { id: 'printer', label: 'Drucker', icon: Printer, action: testPrinter },
    { id: 'scanner', label: 'Scanner', icon: ScanLine, action: testScanner },
    { id: 'drawer', label: 'Kassenlade', icon: DollarSign, action: openCashDrawer },
    { id: 'scale', label: 'Waage', icon: Weight, action: readScale },
  ];

  const activeTabConfig = tabs.find((t) => t.id === activeTab);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" data-testid="pos-hardware-modal">
      <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">POS Hardware Test</h3>
          <button onClick={onClose} data-testid="pos-hardware-close" className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setResult(null); setError(''); }}
                data-testid={`pos-hardware-tab-${t.id}`}
                className={`p-3 rounded-lg flex flex-col items-center gap-1 transition-all ${
                  activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="bg-black/30 rounded-lg p-4 mb-4 min-h-[120px]">
          {loading && (
            <div className="flex items-center gap-2 text-blue-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Verbinde mit Hardware…
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span data-testid="pos-hardware-error">{error}</span>
            </div>
          )}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" /> Erfolgreich
              </div>
              <pre className="text-xs text-gray-300 overflow-auto max-h-32" data-testid="pos-hardware-result">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
          {!loading && !result && !error && (
            <p className="text-sm text-gray-500">
              {activeTab === 'printer' && 'Druckt einen Test-Bon (ESC/POS Standard).'}
              {activeTab === 'scanner' && 'Test-Scan über USB/Bluetooth Scanner.'}
              {activeTab === 'drawer' && 'Öffnet die elektronische Kassenlade.'}
              {activeTab === 'scale' && 'Liest aktuelles Gewicht von Tischwaage.'}
            </p>
          )}
        </div>

        <button
          onClick={activeTabConfig.action}
          disabled={loading}
          data-testid={`pos-hardware-action-${activeTab}`}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <activeTabConfig.icon className="w-4 h-4" />}
          {activeTab === 'printer' && 'Test-Druck starten'}
          {activeTab === 'scanner' && 'Scanner testen'}
          {activeTab === 'drawer' && 'Kassenlade öffnen'}
          {activeTab === 'scale' && 'Gewicht lesen'}
        </button>
      </div>
    </div>
  );
}

export default POSHardwareModal;
