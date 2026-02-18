/**
 * Admin Wise Payouts Component
 * Manage automated merchant payouts via Wise
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Euro, Send, RefreshCw, CheckCircle, AlertCircle, Clock, 
  Building2, CreditCard, History, Loader2, ChevronDown, ChevronUp,
  Banknote, ArrowRight, Users
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminWisePayouts({ token }) {
  const [wiseStatus, setWiseStatus] = useState(null);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch Wise status
  const fetchWiseStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/wise-payouts/account-status?token=${token}`);
      setWiseStatus({
        configured: response.data.connected,
        message: response.data.payouts_enabled ? 'Wise API ist verbunden' : 'Wise API nicht konfiguriert - Manuelle Auszahlung'
      });
    } catch (error) {
      console.error('Error fetching Wise status:', error);
      setWiseStatus({ configured: false, message: 'Wise Status nicht verfügbar' });
    }
  }, [token]);

  // Fetch pending payouts
  const fetchPendingPayouts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/wise-payouts/pending?token=${token}`);
      setPendingPayouts(response.data.partners || []);
    } catch (error) {
      console.error('Error fetching pending payouts:', error);
      setPendingPayouts([]);
    }
  }, [token]);

  // Fetch payout history
  const fetchPayoutHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/wise-payouts/history?token=${token}&limit=20`);
      setPayoutHistory(response.data.payouts || []);
    } catch (error) {
      console.error('Error fetching payout history:', error);
      setPayoutHistory([]);
    }
  }, [token]);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchWiseStatus(),
      fetchPendingPayouts(),
      fetchPayoutHistory()
    ]);
    setLoading(false);
  }, [fetchWiseStatus, fetchPendingPayouts, fetchPayoutHistory]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  // Initiate single payout
  const initiatePayout = async (partner) => {
    if (!window.confirm(`Auszahlung von €${partner.earnings_balance.toFixed(2)} an ${partner.partner_name} initiieren?`)) {
      return;
    }

    setProcessing(partner.partner_id);
    try {
      const response = await axios.post(`${API}/api/wise-payouts/admin/initiate?token=${token}`, {
        partner_id: partner.partner_id,
        amount: partner.earnings_balance
      });
      
      toast.success(response.data.message || 'Auszahlung initiiert');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Auszahlung fehlgeschlagen');
    } finally {
      setProcessing(null);
    }
  };

  // Batch payout
  const batchPayout = async () => {
    if (selectedPartners.length === 0) {
      toast.error('Bitte wählen Sie mindestens einen Partner aus');
      return;
    }

    if (!window.confirm(`${selectedPartners.length} Auszahlungen initiieren?`)) {
      return;
    }

    setProcessing('batch');
    try {
      const response = await axios.post(`${API}/api/wise-payouts/admin/batch?token=${token}`, {
        partner_ids: selectedPartners
      });
      
      toast.success(response.data.message || `${selectedPartners.length} Auszahlungen verarbeitet`);
      setSelectedPartners([]);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Batch-Auszahlung fehlgeschlagen');
    } finally {
      setProcessing(null);
    }
  };

  // Toggle partner selection
  const togglePartnerSelection = (partnerId) => {
    setSelectedPartners(prev => 
      prev.includes(partnerId)
        ? prev.filter(id => id !== partnerId)
        : [...prev, partnerId]
    );
  };

  // Select all eligible partners
  const selectAllEligible = () => {
    const eligible = pendingPayouts
      .filter(p => p.has_bank_details && p.earnings_balance >= (p.min_payout_amount || 50))
      .map(p => p.partner_id);
    setSelectedPartners(eligible);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const totalPending = pendingPayouts.reduce((sum, p) => sum + p.earnings_balance, 0);
  const eligibleCount = pendingPayouts.filter(p => p.has_bank_details).length;

  return (
    <div className="space-y-6" data-testid="admin-wise-payouts">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Banknote className="w-6 h-6 text-green-600" />
          Wise Auszahlungen
        </h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadData}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Aktualisieren
        </Button>
      </div>

      {/* Wise Status */}
      <div className={`p-4 rounded-xl border ${wiseStatus?.configured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {wiseStatus?.configured ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <p className="font-medium text-gray-800">
                Wise API: {wiseStatus?.configured ? 'Verbunden' : 'Nicht konfiguriert'}
              </p>
              <p className="text-sm text-gray-500">{wiseStatus?.message}</p>
            </div>
          </div>
          {!wiseStatus?.configured && (
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              Simulationsmodus
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Ausstehende Auszahlungen</span>
            <Euro className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">€{totalPending.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">{pendingPayouts.length} Partner</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Auszahlungsbereit</span>
            <CheckCircle className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{eligibleCount}</p>
          <p className="text-xs text-gray-400 mt-1">Partner mit Bankdaten</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Ausgewählt</span>
            <Users className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-600">{selectedPartners.length}</p>
          <p className="text-xs text-gray-400 mt-1">Für Batch-Auszahlung</p>
        </div>
      </div>

      {/* Batch Actions */}
      {pendingPayouts.length > 0 && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={selectAllEligible}
            className="text-sm"
          >
            Alle auswählen ({eligibleCount})
          </Button>
          {selectedPartners.length > 0 && (
            <Button
              onClick={batchPayout}
              disabled={processing === 'batch'}
              className="bg-green-600 hover:bg-green-700 text-sm"
            >
              {processing === 'batch' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {selectedPartners.length} Auszahlungen starten
            </Button>
          )}
        </div>
      )}

      {/* Pending Payouts List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-bold text-gray-800">Ausstehende Auszahlungen</h3>
        </div>

        {pendingPayouts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Keine ausstehenden Auszahlungen</p>
          </div>
        ) : (
          <div className="divide-y">
            {pendingPayouts.map((partner) => (
              <div 
                key={partner.partner_id} 
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedPartners.includes(partner.partner_id)}
                      onChange={() => togglePartnerSelection(partner.partner_id)}
                      disabled={!partner.has_bank_details}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Building2 className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{partner.partner_name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {partner.has_bank_details ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CreditCard className="w-3 h-3" />
                            {partner.bank_iban?.slice(-4) || 'IBAN hinterlegt'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertCircle className="w-3 h-3" />
                            Keine Bankdaten
                          </span>
                        )}
                        <span>•</span>
                        <span>Min: €{partner.min_payout_amount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        €{partner.earnings_balance.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Gesamt: €{partner.total_earnings?.toFixed(2) || '0.00'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => initiatePayout(partner)}
                      disabled={!partner.has_bank_details || processing === partner.partner_id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing === partner.partner_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1" />
                          Auszahlen
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout History Toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-gray-800 flex items-center gap-2">
          <History className="w-5 h-5 text-gray-400" />
          Auszahlungsverlauf
        </span>
        {showHistory ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Payout History */}
      {showHistory && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          {payoutHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Noch keine Auszahlungen</p>
            </div>
          ) : (
            <div className="divide-y">
              {payoutHistory.map((payout) => (
                <div key={payout.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      payout.status === 'processing' || payout.status === 'funded' 
                        ? 'bg-green-100' 
                        : payout.status === 'bounced_back' 
                          ? 'bg-red-100' 
                          : 'bg-amber-100'
                    }`}>
                      {payout.status === 'processing' || payout.status === 'funded' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : payout.status === 'bounced_back' ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{payout.partner_name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(payout.created_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-gray-800">€{payout.amount?.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      payout.status === 'processing' || payout.status === 'funded'
                        ? 'bg-green-100 text-green-700'
                        : payout.status === 'bounced_back'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {payout.status === 'funded' ? 'Verarbeitet' : 
                       payout.status === 'processing' ? 'In Bearbeitung' :
                       payout.status === 'bounced_back' ? 'Fehlgeschlagen' :
                       payout.simulated ? 'Simuliert' : payout.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
