/**
 * PaymentHistory - Erweiterte Zahlungshistorie mit Filtern
 * Features: Datumsfilter, Typfilter, Suche, Export
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, Search, Filter, Download, Calendar, ArrowUpRight, ArrowDownLeft,
  CreditCard, Gift, RefreshCw, ChevronLeft, ChevronRight, X, Check
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const PaymentHistory = ({ token, language = 'de' }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  
  // Filters
  const [filters, setFilters] = useState({
    type: 'all', // all, deposit, withdrawal, credit, cashback, transfer
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const t = (key) => {
    const translations = {
      de: {
        title: 'Zahlungshistorie',
        subtitle: 'Alle Transaktionen im Überblick',
        search: 'Suchen...',
        filter: 'Filter',
        export: 'Exportieren',
        all: 'Alle',
        deposit: 'Einzahlung',
        withdrawal: 'Auszahlung',
        credit: 'Kredit',
        cashback: 'Cashback',
        transfer: 'Überweisung',
        dateFrom: 'Von',
        dateTo: 'Bis',
        minAmount: 'Min. Betrag',
        maxAmount: 'Max. Betrag',
        apply: 'Anwenden',
        reset: 'Zurücksetzen',
        noTransactions: 'Keine Transaktionen gefunden',
        page: 'Seite',
        of: 'von',
        exportSuccess: 'Export erfolgreich',
        loading: 'Laden...'
      },
      en: {
        title: 'Payment History',
        subtitle: 'All transactions at a glance',
        search: 'Search...',
        filter: 'Filter',
        export: 'Export',
        all: 'All',
        deposit: 'Deposit',
        withdrawal: 'Withdrawal',
        credit: 'Credit',
        cashback: 'Cashback',
        transfer: 'Transfer',
        dateFrom: 'From',
        dateTo: 'To',
        minAmount: 'Min. Amount',
        maxAmount: 'Max. Amount',
        apply: 'Apply',
        reset: 'Reset',
        noTransactions: 'No transactions found',
        page: 'Page',
        of: 'of',
        exportSuccess: 'Export successful',
        loading: 'Loading...'
      }
    };
    return translations[language]?.[key] || translations.de[key] || key;
  };

  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString()
      });
      
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      if (filters.minAmount) params.append('min_amount', filters.minAmount);
      if (filters.maxAmount) params.append('max_amount', filters.maxAmount);
      if (filters.search) params.append('search', filters.search);
      
      const response = await fetch(`${API}/api/bidblitz-pay/transaction-history?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setTotalCount(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [token, page, pageSize, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleExport = async (format = 'csv') => {
    try {
      const params = new URLSearchParams({ format });
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      
      const response = await fetch(`${API}/api/bidblitz-pay/export-transactions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(t('exportSuccess'));
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export fehlgeschlagen');
    }
  };

  const resetFilters = () => {
    setFilters({
      type: 'all',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      search: ''
    });
    setPage(1);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'deposit':
      case 'topup':
      case 'bank_transfer_credit':
        return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
      case 'withdrawal':
      case 'payout':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'credit':
      case 'credit_disbursement':
        return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'cashback':
        return <Gift className="w-4 h-4 text-purple-500" />;
      default:
        return <History className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      deposit: t('deposit'),
      topup: t('deposit'),
      bank_transfer_credit: t('transfer'),
      withdrawal: t('withdrawal'),
      payout: t('withdrawal'),
      credit: t('credit'),
      credit_disbursement: t('credit'),
      credit_repayment: 'Kredit-Rückzahlung',
      cashback: t('cashback'),
      cashback_payout: 'Cashback-Auszahlung',
      transfer_in: 'Empfangen',
      transfer_out: 'Gesendet'
    };
    return labels[type] || type;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4" data-testid="payment-history">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-500" />
            {t('title')}
          </h2>
          <p className="text-gray-500 text-sm">{t('subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'border-amber-500 text-amber-600' : ''}
          >
            <Filter className="w-4 h-4 mr-1" />
            {t('filter')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
          >
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTransactions}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Type Filter */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Typ</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="all">{t('all')}</option>
                <option value="deposit">{t('deposit')}</option>
                <option value="withdrawal">{t('withdrawal')}</option>
                <option value="credit">{t('credit')}</option>
                <option value="cashback">{t('cashback')}</option>
                <option value="transfer">{t('transfer')}</option>
              </select>
            </div>
            
            {/* Date From */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('dateFrom')}</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="text-sm"
              />
            </div>
            
            {/* Date To */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('dateTo')}</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="text-sm"
              />
            </div>
            
            {/* Min Amount */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('minAmount')}</label>
              <Input
                type="number"
                placeholder="€0"
                value={filters.minAmount}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                className="text-sm"
              />
            </div>
            
            {/* Max Amount */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('maxAmount')}</label>
              <Input
                type="number"
                placeholder="€1000"
                value={filters.maxAmount}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                className="text-sm"
              />
            </div>
            
            {/* Search */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('search')}</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={t('search')}
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-8 text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <X className="w-4 h-4 mr-1" />
              {t('reset')}
            </Button>
            <Button size="sm" onClick={() => { setPage(1); fetchTransactions(); }} className="bg-amber-500 hover:bg-amber-600">
              <Check className="w-4 h-4 mr-1" />
              {t('apply')}
            </Button>
          </div>
        </div>
      )}

      {/* Quick Type Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'deposit', 'withdrawal', 'credit', 'cashback', 'transfer'].map((type) => (
          <button
            key={type}
            onClick={() => { setFilters({ ...filters, type }); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filters.type === type
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(type)}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
            <p className="text-gray-500">{t('loading')}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">{t('noTransactions')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.amount > 0 ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {getTypeIcon(tx.type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{tx.description || getTypeLabel(tx.type)}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(tx.created_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                      tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {tx.status || 'completed'}
                    </span>
                  </div>
                </div>
                
                {tx.reference && (
                  <p className="mt-2 text-xs text-gray-400 ml-13">
                    Referenz: {tx.reference}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {t('page')} {page} {t('of')} {totalPages} ({totalCount} Einträge)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;
