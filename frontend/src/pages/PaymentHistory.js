/**
 * Payment History - Customer's payment transaction history
 * Shows all digital payments made via POS, QR scan, etc.
 */
import React, { useState, useEffect } from 'react';
import { 
  History, CreditCard, QrCode, Store, RefreshCw, Filter,
  ChevronDown, ChevronUp, Calendar, TrendingDown, Search,
  CheckCircle, Clock, XCircle, ArrowUpRight, ArrowDownLeft,
  Receipt, Download, ScanLine
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: {
    title: 'Zahlungsverlauf',
    subtitle: 'Alle Ihre digitalen Zahlungen',
    totalSpent: 'Ausgaben gesamt',
    thisMonth: 'Diesen Monat',
    transactions: 'Transaktionen',
    filter: 'Filter',
    all: 'Alle',
    pos: 'POS/Kasse',
    qrScan: 'QR-Scan',
    checkout: 'Checkout',
    refund: 'Erstattung',
    noTransactions: 'Noch keine Transaktionen',
    noTransactionsDesc: 'Ihre Zahlungen erscheinen hier',
    loading: 'Laden...',
    completed: 'Abgeschlossen',
    pending: 'Ausstehend',
    failed: 'Fehlgeschlagen',
    refunded: 'Erstattet',
    today: 'Heute',
    yesterday: 'Gestern',
    thisWeek: 'Diese Woche',
    older: 'Älter',
    merchant: 'Händler',
    reference: 'Referenz',
    date: 'Datum',
    amount: 'Betrag',
    status: 'Status',
    type: 'Typ',
    details: 'Details',
    downloadHistory: 'Verlauf herunterladen',
    searchPlaceholder: 'Händler oder Referenz suchen...'
  },
  en: {
    title: 'Payment History',
    subtitle: 'All your digital payments',
    totalSpent: 'Total Spent',
    thisMonth: 'This Month',
    transactions: 'Transactions',
    filter: 'Filter',
    all: 'All',
    pos: 'POS/Checkout',
    qrScan: 'QR Scan',
    checkout: 'Checkout',
    refund: 'Refund',
    noTransactions: 'No transactions yet',
    noTransactionsDesc: 'Your payments will appear here',
    loading: 'Loading...',
    completed: 'Completed',
    pending: 'Pending',
    failed: 'Failed',
    refunded: 'Refunded',
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    older: 'Older',
    merchant: 'Merchant',
    reference: 'Reference',
    date: 'Date',
    amount: 'Amount',
    status: 'Status',
    type: 'Type',
    details: 'Details',
    downloadHistory: 'Download History',
    searchPlaceholder: 'Search merchant or reference...'
  }
};

export default function PaymentHistory() {
  const { user, token } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPayment, setExpandedPayment] = useState(null);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, count: 0 });
  const [showFilters, setShowFilters] = useState(false);

  const language = localStorage.getItem('language') || 'de';
  const t = (key) => translations[language]?.[key] || translations.de[key] || key;

  // Fetch payments
  useEffect(() => {
    if (token) {
      fetchPayments();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/digital/customer/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        
        // Calculate stats
        const now = new Date();
        const thisMonth = data.payments?.filter(p => {
          const pDate = new Date(p.created_at);
          return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
        }) || [];
        
        const totalSpent = data.payments?.reduce((sum, p) => 
          p.status === 'completed' ? sum + (p.amount || 0) : sum, 0) || 0;
        const monthSpent = thisMonth.reduce((sum, p) => 
          p.status === 'completed' ? sum + (p.amount || 0) : sum, 0);
        
        setStats({
          total: totalSpent,
          thisMonth: monthSpent,
          count: data.payments?.filter(p => p.status === 'completed').length || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  // Filter payments
  const filteredPayments = payments.filter(p => {
    // Type filter
    if (filter !== 'all') {
      if (filter === 'pos' && p.type !== 'pos' && p.type !== 'scan_pay') return false;
      if (filter === 'qrScan' && p.type !== 'scan_pay') return false;
      if (filter === 'checkout' && p.type !== 'checkout') return false;
      if (filter === 'refund' && p.status !== 'refunded') return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.api_key_name?.toLowerCase().includes(query) ||
        p.reference?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Group payments by date
  const groupPaymentsByDate = (payments) => {
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    payments.forEach(p => {
      const pDate = new Date(p.created_at);
      const pDay = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
      
      if (pDay.getTime() === today.getTime()) {
        groups.today.push(p);
      } else if (pDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(p);
      } else if (pDay > weekAgo) {
        groups.thisWeek.push(p);
      } else {
        groups.older.push(p);
      }
    });
    
    return groups;
  };

  const groupedPayments = groupPaymentsByDate(filteredPayments);

  // Get payment icon
  const getPaymentIcon = (type) => {
    switch (type) {
      case 'scan_pay': return ScanLine;
      case 'pos': return Store;
      case 'checkout': return CreditCard;
      default: return QrCode;
    }
  };

  // Get status color and icon
  const getStatusInfo = (status) => {
    switch (status) {
      case 'completed':
        return { color: 'text-green-500 bg-green-100', icon: CheckCircle, label: t('completed') };
      case 'pending':
        return { color: 'text-yellow-500 bg-yellow-100', icon: Clock, label: t('pending') };
      case 'refunded':
        return { color: 'text-purple-500 bg-purple-100', icon: ArrowDownLeft, label: t('refunded') };
      default:
        return { color: 'text-red-500 bg-red-100', icon: XCircle, label: t('failed') };
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Download history as CSV
  const downloadHistory = () => {
    const csv = [
      ['Datum', 'Händler', 'Referenz', 'Betrag', 'Status', 'Typ'].join(','),
      ...payments.map(p => [
        formatDate(p.created_at),
        p.api_key_name || '-',
        p.reference || '-',
        `€${(p.amount || 0).toFixed(2)}`,
        p.status,
        p.type
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bidblitz-zahlungen-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Verlauf heruntergeladen');
  };

  // Payment row component
  const PaymentRow = ({ payment }) => {
    const Icon = getPaymentIcon(payment.type);
    const statusInfo = getStatusInfo(payment.status);
    const StatusIcon = statusInfo.icon;
    const isExpanded = expandedPayment === payment.id;
    
    return (
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setExpandedPayment(isExpanded ? null : payment.id)}
          className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
        >
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            payment.status === 'refunded' ? 'bg-purple-100' : 'bg-orange-100'
          }`}>
            <Icon className={`w-5 h-5 ${
              payment.status === 'refunded' ? 'text-purple-600' : 'text-orange-600'
            }`} />
          </div>
          
          {/* Info */}
          <div className="flex-1 text-left min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {payment.api_key_name || payment.description || 'Zahlung'}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(payment.created_at).toLocaleTimeString('de-DE', {
                hour: '2-digit', minute: '2-digit'
              })}
              {payment.reference && ` • ${payment.reference}`}
            </p>
          </div>
          
          {/* Amount & Status */}
          <div className="text-right">
            <p className={`font-bold ${
              payment.status === 'refunded' ? 'text-purple-600' : 'text-gray-900'
            }`}>
              {payment.status === 'refunded' ? '+' : '-'}€{(payment.amount || 0).toFixed(2)}
            </p>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
              <StatusIcon className="w-3 h-3" />
              {statusInfo.label}
            </span>
          </div>
          
          {/* Expand icon */}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {/* Expanded details */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t bg-gray-50">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">{t('merchant')}</p>
                <p className="font-medium">{payment.api_key_name || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('reference')}</p>
                <p className="font-medium font-mono text-xs">{payment.reference || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('date')}</p>
                <p className="font-medium">{formatDate(payment.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('type')}</p>
                <p className="font-medium capitalize">{payment.type?.replace('_', ' ') || '-'}</p>
              </div>
              {payment.paid_at && (
                <div className="col-span-2">
                  <p className="text-gray-500">Bezahlt am</p>
                  <p className="font-medium">{formatDate(payment.paid_at)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Date group component
  const DateGroup = ({ title, payments }) => {
    if (payments.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2 px-1">{title}</h3>
        <div className="space-y-2">
          {payments.map((payment, idx) => (
            <PaymentRow key={payment.id || idx} payment={payment} />
          ))}
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Bitte anmelden</p>
          <a href="/login" className="mt-4 inline-block px-6 py-2 bg-orange-500 text-white rounded-lg">
            Anmelden
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 text-sm">{t('subtitle')}</p>
          </div>
          <button
            onClick={fetchPayments}
            className="p-2 hover:bg-gray-200 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500">{t('totalSpent')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">€{stats.total.toFixed(2)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-gray-500">{t('thisMonth')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">€{stats.thisMonth.toFixed(2)}</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">{t('transactions')}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.count}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="space-y-3 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border focus:ring-2 focus:ring-orange-500"
            />
          </div>
          
          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {[
              { id: 'all', label: t('all') },
              { id: 'pos', label: t('pos') },
              { id: 'qrScan', label: t('qrScan') },
              { id: 'checkout', label: t('checkout') },
              { id: 'refund', label: t('refund') }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === f.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payment List */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-500">{t('loading')}</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-900 font-medium">{t('noTransactions')}</p>
            <p className="text-gray-500 text-sm">{t('noTransactionsDesc')}</p>
          </div>
        ) : (
          <>
            <DateGroup title={t('today')} payments={groupedPayments.today} />
            <DateGroup title={t('yesterday')} payments={groupedPayments.yesterday} />
            <DateGroup title={t('thisWeek')} payments={groupedPayments.thisWeek} />
            <DateGroup title={t('older')} payments={groupedPayments.older} />
          </>
        )}

        {/* Download Button */}
        {payments.length > 0 && (
          <button
            onClick={downloadHistory}
            className="w-full mt-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            {t('downloadHistory')}
          </button>
        )}
      </div>
    </div>
  );
}
