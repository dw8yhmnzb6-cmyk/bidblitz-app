/**
 * Admin Enterprise Management
 * Manage enterprise accounts (Großhändler like Edeka, Rewe)
 * Extended with IBAN/Payout settings and detailed data access
 */
import React, { useState, useEffect } from 'react';
import { 
  Building2, Store, Users, Key, CheckCircle, XCircle, Clock,
  RefreshCw, Eye, ToggleLeft, ToggleRight, TrendingUp, Euro,
  Settings, CreditCard, Calendar, ChevronDown, ChevronUp,
  Download, FileText, Edit2, Save, X, Banknote, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ADMIN_KEY = 'bidblitz-admin-2026';

export default function AdminEnterpriseManagement() {
  const [loading, setLoading] = useState(true);
  const [enterprises, setEnterprises] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [editingPayout, setEditingPayout] = useState(null);
  const [editingCommission, setEditingCommission] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    iban: '',
    iban_holder: '',
    payout_frequency: 'monthly',
    iban_mode: 'admin_entry',
    min_payout_amount: 100
  });
  const [commissionForm, setCommissionForm] = useState({
    voucher_commission: 5.0,
    self_pay_commission: 3.0,
    customer_cashback: 1.0,
    is_active: true
  });

  useEffect(() => {
    fetchEnterprises();
  }, []);

  const fetchEnterprises = async () => {
    setLoading(true);
    try {
      // Get all enterprises
      const res = await fetch(`${API_URL}/api/enterprise/admin/list`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      
      if (res.ok) {
        const data = await res.json();
        setEnterprises(data.enterprises || []);
        setPendingCount(data.enterprises?.filter(e => e.status === 'pending').length || 0);
      } else {
        // If endpoint doesn't exist, try getting pending
        const pendingRes = await fetch(`${API_URL}/api/enterprise/admin/pending`, {
          headers: { 'x-admin-key': ADMIN_KEY }
        });
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setEnterprises(pendingData.pending || []);
          setPendingCount(pendingData.pending?.length || 0);
        }
      }
    } catch (err) {
      console.error('Error fetching enterprises:', err);
    } finally {
      setLoading(false);
    }
  };

  const approveEnterprise = async (enterpriseId) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/admin/approve/${enterpriseId}`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      
      if (res.ok) {
        toast.success('Unternehmen freigeschaltet!');
        fetchEnterprises();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    }
  };

  const suspendEnterprise = async (enterpriseId) => {
    if (!window.confirm('Unternehmen wirklich sperren?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/enterprise/admin/suspend/${enterpriseId}`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      
      if (res.ok) {
        toast.success('Unternehmen gesperrt');
        fetchEnterprises();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    }
  };

  const savePayoutSettings = async (enterpriseId) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/admin/payout-settings/${enterpriseId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY 
        },
        body: JSON.stringify(payoutForm)
      });
      
      if (res.ok) {
        toast.success('Auszahlungseinstellungen gespeichert!');
        setEditingPayout(null);
        fetchEnterprises();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler beim Speichern');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    }
  };

  const saveCommissionSettings = async (enterpriseId) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/admin/commission-settings/${enterpriseId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY 
        },
        body: JSON.stringify(commissionForm)
      });
      
      if (res.ok) {
        toast.success('Provisionseinstellungen gespeichert!');
        setEditingCommission(null);
        fetchEnterprises();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler beim Speichern');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    }
  };

  const startEditPayout = (enterprise) => {
    setEditingPayout(enterprise.id);
    setEditingCommission(null);
    setPayoutForm({
      iban: enterprise.payout_settings?.iban || '',
      iban_holder: enterprise.payout_settings?.iban_holder || enterprise.company_name,
      payout_frequency: enterprise.payout_settings?.payout_frequency || 'monthly',
      iban_mode: enterprise.payout_settings?.iban_mode || 'admin_entry',
      min_payout_amount: enterprise.payout_settings?.min_payout_amount || 100
    });
  };

  const startEditCommission = (enterprise) => {
    setEditingCommission(enterprise.id);
    setEditingPayout(null);
    setCommissionForm({
      voucher_commission: enterprise.commission_settings?.voucher_commission ?? 5.0,
      self_pay_commission: enterprise.commission_settings?.self_pay_commission ?? 3.0,
      customer_cashback: enterprise.commission_settings?.customer_cashback ?? 1.0,
      is_active: enterprise.commission_settings?.is_active ?? true
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Aktiv</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Ausstehend</span>;
      case 'suspended':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Gesperrt</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{status}</span>;
    }
  };

  const getPayoutFrequencyLabel = (freq) => {
    const labels = {
      daily: 'Täglich',
      weekly: 'Wöchentlich',
      monthly: 'Monatlich',
      manual: 'Manuell'
    };
    return labels[freq] || freq;
  };

  const filteredEnterprises = activeTab === 'all' 
    ? enterprises 
    : enterprises.filter(e => e.status === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Großhändler (Enterprise)</h2>
            <p className="text-sm text-gray-500">{enterprises.length} Unternehmen registriert</p>
          </div>
        </div>
        <button 
          onClick={fetchEnterprises}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {enterprises.filter(e => e.status === 'approved').length}
          </p>
          <p className="text-xs text-green-600">Aktiv</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-yellow-600">Ausstehend</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-600">
            {enterprises.filter(e => e.status === 'suspended').length}
          </p>
          <p className="text-xs text-red-600">Gesperrt</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Alle' },
          { id: 'pending', label: 'Ausstehend', count: pendingCount },
          { id: 'approved', label: 'Aktiv' },
          { id: 'suspended', label: 'Gesperrt' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Enterprise List */}
      <div className="space-y-3">
        {filteredEnterprises.length > 0 ? filteredEnterprises.map(enterprise => (
          <div key={enterprise.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
            {/* Main Card */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center">
                    <Store className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{enterprise.company_name}</h3>
                    <p className="text-sm text-gray-500">{enterprise.email}</p>
                  </div>
                </div>
                {getStatusBadge(enterprise.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500 text-xs">Ansprechpartner</p>
                  <p className="font-medium">{enterprise.contact_person || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500 text-xs">Telefon</p>
                  <p className="font-medium">{enterprise.phone || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 col-span-2">
                  <p className="text-gray-500 text-xs">Adresse</p>
                  <p className="font-medium">{enterprise.address || '-'}</p>
                </div>
              </div>

              <div className="text-xs text-gray-400 mb-3">
                Registriert: {new Date(enterprise.created_at).toLocaleString('de-DE')}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {enterprise.status === 'pending' && (
                  <button
                    onClick={() => approveEnterprise(enterprise.id)}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Freischalten
                  </button>
                )}
                {enterprise.status === 'approved' && (
                  <>
                    <button
                      onClick={() => setExpandedId(expandedId === enterprise.id ? null : enterprise.id)}
                      className="flex-1 py-2 bg-purple-100 text-purple-600 rounded-lg font-medium hover:bg-purple-200 flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Details & Einstellungen
                      {expandedId === enterprise.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => suspendEnterprise(enterprise.id)}
                      className="py-2 px-3 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
                {enterprise.status === 'suspended' && (
                  <button
                    onClick={() => approveEnterprise(enterprise.id)}
                    className="flex-1 py-2 bg-green-100 text-green-600 rounded-lg font-medium hover:bg-green-200 flex items-center justify-center gap-2"
                  >
                    <ToggleRight className="w-4 h-4" />
                    Reaktivieren
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Details Panel */}
            {expandedId === enterprise.id && enterprise.status === 'approved' && (
              <div className="border-t bg-slate-50 p-4 space-y-4">
                {/* Payout Settings */}
                <div className="bg-white rounded-xl p-4 border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-green-600" />
                      Auszahlungseinstellungen
                    </h4>
                    {editingPayout !== enterprise.id ? (
                      <button 
                        onClick={() => startEditPayout(enterprise)}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Bearbeiten
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => savePayoutSettings(enterprise.id)}
                          className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" /> Speichern
                        </button>
                        <button 
                          onClick={() => setEditingPayout(null)}
                          className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Abbrechen
                        </button>
                      </div>
                    )}
                  </div>

                  {editingPayout === enterprise.id ? (
                    <div className="space-y-3">
                      {/* IBAN Mode Selection */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">IBAN-Verwaltung</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPayoutForm({...payoutForm, iban_mode: 'admin_entry'})}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              payoutForm.iban_mode === 'admin_entry'
                                ? 'bg-purple-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Admin verwaltet
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayoutForm({...payoutForm, iban_mode: 'self_entry'})}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              payoutForm.iban_mode === 'self_entry'
                                ? 'bg-purple-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Händler gibt ein
                          </button>
                        </div>
                      </div>

                      {payoutForm.iban_mode === 'admin_entry' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">IBAN</label>
                            <input
                              type="text"
                              value={payoutForm.iban}
                              onChange={(e) => setPayoutForm({...payoutForm, iban: e.target.value.toUpperCase()})}
                              placeholder="DE89 3704 0044 0532 0130 00"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Kontoinhaber</label>
                            <input
                              type="text"
                              value={payoutForm.iban_holder}
                              onChange={(e) => setPayoutForm({...payoutForm, iban_holder: e.target.value})}
                              placeholder="Firmenname GmbH"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Auszahlungsfrequenz</label>
                          <select
                            value={payoutForm.payout_frequency}
                            onChange={(e) => setPayoutForm({...payoutForm, payout_frequency: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="daily">Täglich</option>
                            <option value="weekly">Wöchentlich</option>
                            <option value="monthly">Monatlich</option>
                            <option value="manual">Manuell</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Mindestbetrag (€)</label>
                          <input
                            type="number"
                            value={payoutForm.min_payout_amount}
                            onChange={(e) => setPayoutForm({...payoutForm, min_payout_amount: parseInt(e.target.value) || 0})}
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </div>

                      {payoutForm.iban_mode === 'self_entry' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-amber-800">
                              Der Großhändler kann seine IBAN selbst im Händler-Portal eingeben und verwalten.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">IBAN-Modus:</span>
                        <span className="font-medium">
                          {enterprise.payout_settings?.iban_mode === 'self_entry' 
                            ? 'Händler gibt ein' 
                            : 'Admin verwaltet'}
                        </span>
                      </div>
                      {enterprise.payout_settings?.iban_mode !== 'self_entry' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">IBAN:</span>
                            <span className="font-medium font-mono text-xs">
                              {enterprise.payout_settings?.iban || 'Nicht hinterlegt'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Kontoinhaber:</span>
                            <span className="font-medium">
                              {enterprise.payout_settings?.iban_holder || '-'}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Frequenz:</span>
                        <span className="font-medium">
                          {getPayoutFrequencyLabel(enterprise.payout_settings?.payout_frequency || 'monthly')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Mindestbetrag:</span>
                        <span className="font-medium">
                          €{enterprise.payout_settings?.min_payout_amount || 100}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Commission Settings - NEW */}
                <div className="bg-white rounded-xl p-4 border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <Percent className="w-4 h-4 text-purple-600" />
                      Provisionseinstellungen
                    </h4>
                    {editingCommission !== enterprise.id ? (
                      <button 
                        onClick={() => startEditCommission(enterprise)}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Bearbeiten
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => saveCommissionSettings(enterprise.id)}
                          className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" /> Speichern
                        </button>
                        <button 
                          onClick={() => setEditingCommission(null)}
                          className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Abbrechen
                        </button>
                      </div>
                    )}
                  </div>

                  {editingCommission === enterprise.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Gutschein-Provision %</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={commissionForm.voucher_commission}
                            onChange={(e) => setCommissionForm({...commissionForm, voucher_commission: parseFloat(e.target.value) || 0})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Eigenzahlung-Prov. %</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={commissionForm.self_pay_commission}
                            onChange={(e) => setCommissionForm({...commissionForm, self_pay_commission: parseFloat(e.target.value) || 0})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Kunden-Cashback %</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={commissionForm.customer_cashback}
                            onChange={(e) => setCommissionForm({...commissionForm, customer_cashback: parseFloat(e.target.value) || 0})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`commission_active_${enterprise.id}`}
                          checked={commissionForm.is_active}
                          onChange={(e) => setCommissionForm({...commissionForm, is_active: e.target.checked})}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor={`commission_active_${enterprise.id}`} className="text-sm text-gray-700">
                          Provisionen aktiviert
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-orange-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-orange-600">Gutschein</p>
                        <p className="text-lg font-bold text-orange-700">
                          {enterprise.commission_settings?.voucher_commission ?? 5}%
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-blue-600">Eigenzahlung</p>
                        <p className="text-lg font-bold text-blue-700">
                          {enterprise.commission_settings?.self_pay_commission ?? 3}%
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-green-600">Kunden-Cashback</p>
                        <p className="text-lg font-bold text-green-700">
                          {enterprise.commission_settings?.customer_cashback ?? 1}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white rounded-xl p-3 border text-center">
                    <Store className="w-5 h-5 mx-auto text-purple-500 mb-1" />
                    <p className="text-lg font-bold">{enterprise.branch_count || 0}</p>
                    <p className="text-xs text-gray-500">Filialen</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border text-center">
                    <Key className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-lg font-bold">{enterprise.api_key_count || 0}</p>
                    <p className="text-xs text-gray-500">API-Keys</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border text-center">
                    <Users className="w-5 h-5 mx-auto text-green-500 mb-1" />
                    <p className="text-lg font-bold">{enterprise.user_count || 0}</p>
                    <p className="text-xs text-gray-500">Mitarbeiter</p>
                  </div>
                </div>

                {/* Revenue Info */}
                <div className="bg-white rounded-xl p-4 border">
                  <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Umsatz & Provisionen
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600">Gesamtumsatz</p>
                      <p className="text-xl font-bold text-green-700">
                        €{(enterprise.total_revenue || 0).toLocaleString('de-DE')}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xs text-purple-600">Provision (fällig)</p>
                      <p className="text-xl font-bold text-purple-700">
                        €{(enterprise.pending_commission || 0).toLocaleString('de-DE')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )) : (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Keine Unternehmen gefunden</p>
            <p className="text-sm">Unternehmen können sich unter /enterprise registrieren</p>
          </div>
        )}
      </div>
    </div>
  );
}
