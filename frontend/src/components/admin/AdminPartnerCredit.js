/**
 * AdminPartnerCredit - Admin panel for managing partner admin credits
 * Allows admins to give partners a credit line for customer top-ups
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Search, Plus, Minus, Euro, Building2, History,
  RefreshCw, CheckCircle, AlertCircle, Users, ArrowUpDown
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Partner-Freibetrag',
    subtitle: 'Verwalten Sie Freibeträge für Partner zum Aufladen von Kundenguthaben',
    searchPlaceholder: 'Partner suchen...',
    currentCredit: 'Aktuelles Guthaben',
    usedCredit: 'Verwendet',
    addCredit: 'Guthaben hinzufügen',
    removeCredit: 'Guthaben abziehen',
    amount: 'Betrag',
    reason: 'Grund',
    reasonPlaceholder: 'z.B. Monatliches Budget, Sonderaktion...',
    confirm: 'Bestätigen',
    cancel: 'Abbrechen',
    history: 'Verlauf',
    noPartners: 'Keine Partner gefunden',
    loading: 'Laden...',
    success: 'Guthaben aktualisiert',
    error: 'Fehler beim Aktualisieren',
    totalCredit: 'Gesamt vergeben',
    totalUsed: 'Gesamt verwendet',
    partnersWithCredit: 'Partner mit Guthaben'
  },
  en: {
    title: 'Partner Credit',
    subtitle: 'Manage partner credit lines for customer top-ups',
    searchPlaceholder: 'Search partners...',
    currentCredit: 'Current Credit',
    usedCredit: 'Used',
    addCredit: 'Add Credit',
    removeCredit: 'Remove Credit',
    amount: 'Amount',
    reason: 'Reason',
    reasonPlaceholder: 'e.g. Monthly budget, special promotion...',
    confirm: 'Confirm',
    cancel: 'Cancel',
    history: 'History',
    noPartners: 'No partners found',
    loading: 'Loading...',
    success: 'Credit updated',
    error: 'Error updating',
    totalCredit: 'Total Issued',
    totalUsed: 'Total Used',
    partnersWithCredit: 'Partners with Credit'
  },
  sq: {
    title: 'Kredia e Partnerit',
    subtitle: 'Menaxhoni linjat e kredisë për partnerët për rimbushjen e klientëve',
    searchPlaceholder: 'Kërko partnerë...',
    currentCredit: 'Kredia Aktuale',
    usedCredit: 'Përdorur',
    addCredit: 'Shto Kredi',
    removeCredit: 'Hiq Kredi',
    amount: 'Shuma',
    reason: 'Arsyeja',
    reasonPlaceholder: 'p.sh. Buxheti mujor, promovim special...',
    confirm: 'Konfirmo',
    cancel: 'Anulo',
    history: 'Historiku',
    noPartners: 'Nuk u gjetën partnerë',
    loading: 'Duke ngarkuar...',
    success: 'Kredia u përditësua',
    error: 'Gabim gjatë përditësimit',
    totalCredit: 'Totali i Dhënë',
    totalUsed: 'Totali i Përdorur',
    partnersWithCredit: 'Partnerë me Kredi'
  }
};

const AdminPartnerCredit = ({ language = 'de' }) => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'remove'
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ totalCredit: 0, totalUsed: 0, partnersWithCredit: 0 });

  const t = (key) => translations[language]?.[key] || translations.de[key] || key;
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/universal-transfer/admin/partner-credits?page=1&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setPartners(data.partners || []);
      
      // Calculate stats
      const totalCredit = data.partners?.reduce((sum, p) => sum + (p.admin_credit || 0), 0) || 0;
      const totalUsed = data.partners?.reduce((sum, p) => sum + (p.admin_credit_used || 0), 0) || 0;
      const partnersWithCredit = data.partners?.filter(p => (p.admin_credit || 0) > 0).length || 0;
      setStats({ totalCredit, totalUsed, partnersWithCredit });
      
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleCreditAction = async () => {
    if (!selectedPartner || !amount || !reason) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    const creditAmount = parseFloat(amount) * (modalMode === 'remove' ? -1 : 1);
    
    setSubmitting(true);
    try {
      const response = await fetch(`${API}/api/universal-transfer/admin/credit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          partner_id: selectedPartner.id,
          amount: creditAmount,
          reason: reason
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update');
      }

      toast.success(t('success'));
      setShowModal(false);
      setAmount('');
      setReason('');
      setSelectedPartner(null);
      fetchPartners();
    } catch (error) {
      console.error('Error updating credit:', error);
      toast.error(error.message || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPartners = partners.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    const name = (p.business_name || p.company_name || '').toLowerCase();
    const number = (p.partner_number || '').toLowerCase();
    return name.includes(searchLower) || number.includes(searchLower);
  });

  const openModal = (partner, mode) => {
    setSelectedPartner(partner);
    setModalMode(mode);
    setShowModal(true);
    setAmount('');
    setReason('');
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="admin-partner-credit">
      {/* Header - Mobile optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" />
            {t('title')}
          </h2>
          <p className="text-gray-500 mt-1 text-sm">{t('subtitle')}</p>
        </div>
        <Button onClick={fetchPartners} variant="outline" size="sm" className="self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards - Stacked on mobile for better readability */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-4 sm:p-5 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Euro className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-green-600">{t('totalCredit')}</p>
              <p className="text-lg sm:text-2xl font-bold text-green-800">€{stats.totalCredit.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl p-4 sm:p-5 border border-orange-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <ArrowUpDown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-orange-600">{t('totalUsed')}</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-800">€{stats.totalUsed.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-4 sm:p-5 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-blue-600">{t('partnersWithCredit')}</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-800">{stats.partnersWithCredit}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Partners List */}
      {loading ? (
        <div className="text-center py-8 sm:py-12">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-500 text-sm">{t('loading')}</p>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="text-center py-8 sm:py-12 text-gray-500">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">{t('noPartners')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {filteredPartners.map((partner) => (
            <div key={partner.id} className="p-3 sm:p-4 hover:bg-gray-50">
              {/* Mobile Layout */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm sm:text-base truncate">{partner.business_name || partner.company_name}</p>
                    <p className="text-xs sm:text-sm text-gray-500">{partner.partner_number}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 ml-13 sm:ml-0">
                  {/* Credits Info - Compact on mobile */}
                  <div className="flex gap-4">
                    <div className="text-center sm:text-right">
                      <p className="text-xs text-gray-500">{t('currentCredit')}</p>
                      <p className={`text-base sm:text-xl font-bold ${(partner.admin_credit || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        €{(partner.admin_credit || 0).toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="text-center sm:text-right">
                      <p className="text-xs text-gray-500">{t('usedCredit')}</p>
                      <p className="text-base sm:text-lg font-medium text-orange-600">
                        €{(partner.admin_credit_used || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-500 hover:bg-green-600 h-8 w-8 sm:h-9 sm:w-9 p-0"
                      onClick={() => openModal(partner, 'add')}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                      onClick={() => openModal(partner, 'remove')}
                      disabled={(partner.admin_credit || 0) <= 0}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && selectedPartner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-2">
              {modalMode === 'add' ? t('addCredit') : t('removeCredit')}
            </h3>
            <p className="text-gray-500 mb-6">
              {selectedPartner.business_name || selectedPartner.company_name} ({selectedPartner.partner_number})
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{t('amount')}</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">{t('reason')}</label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('reasonPlaceholder')}
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                {t('cancel')}
              </Button>
              <Button
                className={`flex-1 ${modalMode === 'add' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                onClick={handleCreditAction}
                disabled={submitting || !amount || !reason}
              >
                {submitting ? '...' : t('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPartnerCredit;
