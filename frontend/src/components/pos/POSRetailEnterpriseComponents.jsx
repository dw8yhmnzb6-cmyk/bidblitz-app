import React, { useState } from 'react';
import { X, AlertCircle, Undo2, Package, ShoppingCart } from 'lucide-react';

/**
 * BON-STORNIERUNG (Receipt Void)
 * Rechtskonforme Stornierung mit negativem Bon
 */
export function VoidReceiptModal({ isOpen, onClose, onVoid }) {
  const [receiptId, setReceiptId] = useState('');
  const [reason, setReason] = useState('Storno');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVoid = async () => {
    if (!receiptId.trim()) {
      setError('Beleg-ID erforderlich');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/pos/receipts/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ receipt_id: receiptId, reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onVoid?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-red-600" />
            Bon stornieren
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beleg-ID</label>
            <input
              type="text"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
              placeholder="RCP-..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grund</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="Storno">Storno</option>
              <option value="Fehler">Fehlerhafte Buchung</option>
              <option value="Kunde">Kundenwunsch</option>
              <option value="Duplikat">Duplikat</option>
            </select>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-xs text-yellow-800">
              ⚠️ Storno erstellt negativen Bon. Original-Bon bleibt erhalten (GoBD-konform).
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleVoid}
              disabled={loading}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Storniere...' : 'Bon stornieren'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * RÜCKGABE/UMTAUSCH (Return/Exchange)
 */
export function ReturnModal({ isOpen, onClose, onReturn }) {
  const [receiptId, setReceiptId] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1, reason: '' }]);
  const [returnType, setReturnType] = useState('refund');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReturn = async () => {
    if (!receiptId.trim()) {
      setError('Beleg-ID erforderlich');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/pos/receipts/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ receipt_id: receiptId, items, return_type: returnType }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onReturn?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[32rem] max-w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            Rückgabe / Umtausch
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Original Beleg-ID</label>
            <input
              type="text"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
              placeholder="RCP-..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rückgabe-Typ</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setReturnType('refund')}
                className={`px-3 py-2 border rounded text-sm ${
                  returnType === 'refund' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Geld
              </button>
              <button
                onClick={() => setReturnType('voucher')}
                className={`px-3 py-2 border rounded text-sm ${
                  returnType === 'voucher' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Gutschein
              </button>
              <button
                onClick={() => setReturnType('exchange')}
                className={`px-3 py-2 border rounded text-sm ${
                  returnType === 'exchange' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Umtausch
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Artikel</label>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={item.product_id}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].product_id = e.target.value;
                    setItems(newItems);
                  }}
                  placeholder="Produkt-ID"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].quantity = parseFloat(e.target.value) || 1;
                    setItems(newItems);
                  }}
                  className="w-20 px-3 py-2 border border-gray-300 rounded text-sm"
                  min="1"
                />
              </div>
            ))}
            <button
              onClick={() => setItems([...items, { product_id: '', quantity: 1, reason: '' }])}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Artikel hinzufügen
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReturn}
              disabled={loading}
              className="flex-1 bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:bg-gray-300"
            >
              {loading ? 'Verarbeite...' : 'Rückgabe durchführen'}
            </button>
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * GEWICHTSARTIKEL SCANNER (Weighted Products)
 */
export function WeightedProductScanner({ storeId, onAdd }) {
  const [pluCode, setPluCode] = useState('');
  const [weight, setWeight] = useState('');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async () => {
    if (!pluCode || !weight) {
      setError('PLU-Code & Gewicht erforderlich');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/pos/products/weighted/lookup?plu_code=${pluCode}&weight_kg=${weight}&store_id=${storeId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (!res.ok) throw new Error('PLU nicht gefunden');
      const data = await res.json();
      setProduct(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (product) {
      onAdd?.({
        product_id: product.product_id,
        name: `${product.name} (${product.weight_kg}kg)`,
        quantity: product.weight_kg,
        price: product.calculated_price,
        tax_rate: product.tax_rate,
      });
      setPluCode('');
      setWeight('');
      setProduct(null);
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-blue-50">
      <h4 className="font-semibold mb-3 flex items-center gap-2">
        <Package className="w-5 h-5" />
        Gewichtsartikel (€/kg)
      </h4>
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">PLU-Code</label>
          <input
            type="text"
            value={pluCode}
            onChange={(e) => setPluCode(e.target.value)}
            placeholder="4011"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Gewicht (kg)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0.5"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>
      <button
        onClick={handleLookup}
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 text-sm mb-2"
      >
        {loading ? 'Suche...' : 'Preis berechnen'}
      </button>
      {product && (
        <div className="bg-white border border-gray-300 rounded p-3 mb-2">
          <div className="text-sm font-semibold">{product.name}</div>
          <div className="text-xs text-gray-600">
            {product.weight_kg} kg × €{product.price_per_kg}/kg
          </div>
          <div className="text-lg font-bold text-green-600 mt-1">€{product.calculated_price.toFixed(2)}</div>
        </div>
      )}
      {product && (
        <button onClick={handleAdd} className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
          Zum Warenkorb
        </button>
      )}
    </div>
  );
}

/**
 * SUPERVISOR CONSOLE (Multi-Station Self-Checkout)
 */
export function SupervisorConsole({ storeId }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/pos/supervisor/dashboard?store_id=${storeId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const data = await res.json();
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/pos/supervisor/alert/${alertId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      loadDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 5000); // Refresh alle 5s
    return () => clearInterval(interval);
  }, [storeId]);

  if (loading && !dashboard) return <div className="p-6 text-center">Lade Supervisor-Dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Supervisor Console — Self-Checkout Überwachung</h3>
        <button
          onClick={loadDashboard}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Aktualisieren
        </button>
      </div>

      {/* Alerts */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          Aktive Alerts ({dashboard?.alerts?.length || 0})
        </h4>
        {dashboard?.alerts?.length === 0 && (
          <div className="p-4 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
            ✓ Keine offenen Alerts
          </div>
        )}
        <div className="space-y-2">
          {dashboard?.alerts?.map((alert) => (
            <div
              key={alert.alert_id}
              className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded flex justify-between items-start"
            >
              <div>
                <div className="font-semibold text-sm">
                  {alert.alert_type === 'age_verify' && '🔞 Altersverifikation erforderlich'}
                  {alert.alert_type === 'help_needed' && '🙋 Hilfe benötigt'}
                  {alert.alert_type === 'error' && '⚠️ Fehler'}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Kasse: {alert.register_id} • {new Date(alert.created_at).toLocaleTimeString('de-DE')}
                </div>
              </div>
              <button
                onClick={() => resolveAlert(alert.alert_id)}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                Lösen
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Kassen-Status */}
      <div>
        <h4 className="font-semibold mb-3">Self-Checkout Kassen ({dashboard?.registers?.length || 0})</h4>
        <div className="grid grid-cols-3 gap-4">
          {dashboard?.registers?.map((reg) => (
            <div key={reg.register_id} className="border border-gray-300 rounded p-3 bg-white">
              <div className="font-medium text-sm">{reg.name}</div>
              <div className="text-xs text-gray-500">{reg.register_id}</div>
              <div
                className={`mt-2 px-2 py-1 rounded text-xs font-semibold ${
                  reg.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {reg.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
