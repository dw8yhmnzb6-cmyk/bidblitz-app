/**
 * Admin Payouts Management
 * SEPA-Auszahlungen an Großhändler verwalten
 */
import React, { useState, useEffect } from 'react';
import { 
  Banknote, Building2, CheckCircle, Clock, XCircle, RefreshCw,
  Send, Calendar, Euro, ArrowRight, AlertCircle, Download,
  ChevronDown, ChevronUp, Play, Pause
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ADMIN_KEY = 'bidblitz-admin-2026';

export default function AdminPayouts() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [totals, setTotals] = useState({ pending: 0, completed: 0 });
  const [processing, setProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch pending payouts
      const pendingRes = await fetch(`${API_URL}/api/enterprise/admin/payouts/pending`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingPayouts(pendingData.pending_payouts || []);
      }

      // Fetch history
      const historyRes = await fetch(`${API_URL}/api/enterprise/admin/payouts/history?limit=100`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setPayoutHistory(historyData.payouts || []);
        setTotals(historyData.totals || {});
      }
    } catch (err) {
      console.error('Error fetching payouts:', err);
      toast.error('Fehler beim Laden der Auszahlungen');
    } finally {
      setLoading(false);
    }
  };

  const createAndProcessPayout = async (payout) => {
    if (!payout.iban) {
      toast.error('Keine IBAN hinterlegt');
      return;
    }

    setProcessing(true);
    try {
      // Create payout
      const createRes = await fetch(`${API_URL}/api/enterprise/admin/payouts/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY 
        },
        body: JSON.stringify({
          enterprise_id: payout.enterprise_id,
          amount: payout.pending_amount,
          note: `Manuelle Auszahlung - ${payout.frequency}`
        })
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        throw new Error(error.detail || 'Fehler beim Erstellen');
      }

      const createData = await createRes.json();

      // Process payout
      const processRes = await fetch(`${API_URL}/api/enterprise/admin/payouts/${createData.payout_id}/process`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY }
      });

      if (processRes.ok) {
        const processData = await processRes.json();
        toast.success(`SEPA-Überweisung verarbeitet: ${processData.sepa_reference}`);
        fetchData();
      } else {
        const error = await processRes.json();
        throw new Error(error.detail || 'Fehler bei der Verarbeitung');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const batchProcessPayouts = async () => {
    const duePayouts = pendingPayouts.filter(p => p.is_due && p.iban);
    
    if (duePayouts.length === 0) {
      toast.info('Keine fälligen Auszahlungen vorhanden');
      return;
    }

    if (!window.confirm(`${duePayouts.length} Auszahlungen verarbeiten?`)) {
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`${API_URL}/api/enterprise/admin/payouts/batch-process`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY }
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.processed_count} Auszahlungen verarbeitet (€${data.total_amount.toFixed(2)})`);
        if (data.error_count > 0) {
          toast.warning(`${data.error_count} Fehler aufgetreten`);
        }
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler bei der Batch-Verarbeitung');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Abgeschlossen</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Ausstehend</span>;
      case 'processing':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Verarbeitung</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Fehlgeschlagen</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{status}</span>;
    }
  };

  const getFrequencyLabel = (freq) => {
    const labels = {
      daily: 'Täglich',
      weekly: 'Wöchentlich',
      monthly: 'Monatlich',
      manual: 'Manuell'
    };
    return labels[freq] || freq;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  const dueCount = pendingPayouts.filter(p => p.is_due).length;
  const totalPendingAmount = pendingPayouts.reduce((sum, p) => sum + p.pending_amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <Banknote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">SEPA-Auszahlungen</h2>
            <p className="text-sm text-gray-500">Provisionen an Großhändler auszahlen</p>
          </div>
        </div>
        <button 
          onClick={fetchData}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-yellow-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingPayouts.length}</p>
          <p className="text-xs text-yellow-600">Ausstehend</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{dueCount}</p>
          <p className="text-xs text-orange-600">Fällig</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">€{totals.completed?.toFixed(0) || 0}</p>
          <p className="text-xs text-green-600">Ausgezahlt</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">€{totalPendingAmount.toFixed(0)}</p>
          <p className="text-xs text-purple-600">Gesamt offen</p>
        </div>
      </div>

      {/* Batch Action */}
      {dueCount > 0 && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{dueCount} Auszahlungen fällig</p>
              <p className="text-sm opacity-90">
                €{pendingPayouts.filter(p => p.is_due).reduce((s, p) => s + p.pending_amount, 0).toFixed(2)} bereit zur Überweisung
              </p>
            </div>
            <button
              onClick={batchProcessPayouts}
              disabled={processing}
              className="px-4 py-2 bg-white text-green-600 rounded-lg font-medium hover:bg-green-50 flex items-center gap-2 disabled:opacity-50"
            >
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Alle verarbeiten
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Ausstehend ({pendingPayouts.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Historie ({payoutHistory.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'pending' ? (
        <div className="space-y-3">
          {pendingPayouts.length > 0 ? pendingPayouts.map(payout => (
            <div key={payout.enterprise_id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    payout.is_due ? 'bg-orange-100' : 'bg-gray-100'
                  }`}>
                    <Building2 className={`w-5 h-5 ${payout.is_due ? 'text-orange-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-bold">{payout.company_name}</h3>
                    <p className="text-sm text-gray-500">{payout.email}</p>
                  </div>
                </div>
                {payout.is_due && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    Fällig
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 text-sm mb-3">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Umsatz</p>
                  <p className="font-bold">€{payout.total_revenue.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-green-600">Provision ({payout.commission_rate}%)</p>
                  <p className="font-bold text-green-700">€{payout.pending_amount.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Frequenz</p>
                  <p className="font-medium">{getFrequencyLabel(payout.frequency)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Minimum</p>
                  <p className="font-medium">€{payout.min_amount}</p>
                </div>
              </div>

              {/* IBAN Info */}
              {payout.iban ? (
                <div className="bg-blue-50 rounded-lg p-2 text-sm mb-3">
                  <p className="text-blue-600 font-mono text-xs">{payout.iban}</p>
                  <p className="text-blue-700 text-xs">{payout.iban_holder}</p>
                </div>
              ) : (
                <div className="bg-red-50 rounded-lg p-2 text-sm mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">Keine IBAN hinterlegt</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => createAndProcessPayout(payout)}
                disabled={processing || !payout.iban || payout.pending_amount < payout.min_amount}
                className="w-full py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    SEPA-Überweisung starten
                  </>
                )}
              </button>
            </div>
          )) : (
            <div className="text-center py-8 text-gray-500">
              <Banknote className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Keine ausstehenden Auszahlungen</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {payoutHistory.length > 0 ? payoutHistory.map(payout => (
            <div key={payout.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">{payout.company_name}</h3>
                    <p className="text-sm text-gray-500">{payout.note || 'Auszahlung'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">€{payout.amount.toFixed(2)}</p>
                  {getStatusBadge(payout.status)}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {new Date(payout.created_at).toLocaleString('de-DE')}
                </span>
                {payout.sepa_reference && (
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                    {payout.sepa_reference}
                  </span>
                )}
              </div>
            </div>
          )) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Keine Auszahlungs-Historie</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
