import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  BarChart3, TrendingUp, Users, CreditCard, Download, RefreshCw,
  Calendar, Euro, Gift, ShoppingCart, Clock, Building2, User,
  ChevronDown, ChevronUp, FileSpreadsheet, PieChart, Eye, List
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BidBlitzPayAnalytics() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showAllTransactions, setShowAllTransactions] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]); // Heute
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]); // Heute
  const [expandedSections, setExpandedSections] = useState(['daily', 'branches', 'staff', 'customers']); // Alle offen
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState('today');

  const toggleSection = (section) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResponse, txResponse] = await Promise.all([
        axios.get(`${API}/bidblitz-pay-analytics/dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { start_date: startDate, end_date: endDate }
        }),
        axios.get(`${API}/bidblitz-pay-analytics/transactions`, {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { start_date: startDate, end_date: endDate, limit: 500 }
        })
      ]);
      setStats(statsResponse.data);
      setTransactions(txResponse.data.transactions || []);
    } catch (error) {
      toast.error('Fehler beim Laden der Statistiken');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Quick date range buttons
  const setQuickDateRange = (range) => {
    const today = new Date();
    let start = new Date();
    
    switch(range) {
      case 'today':
        start = today;
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        today.setDate(today.getDate() - 1);
        break;
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setDate(today.getDate() - 30);
        break;
      default:
        break;
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    setDateRange(range);
  };

  const handleExportCSV = async (type) => {
    setExporting(true);
    try {
      const endpoint = type === 'transactions' 
        ? '/bidblitz-pay-analytics/export/csv'
        : '/bidblitz-pay-analytics/export/summary';
      
      const response = await axios.get(`${API}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { start_date: startDate, end_date: endDate },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bidblitz_pay_${type}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Export erfolgreich');
    } catch (error) {
      toast.error('Export fehlgeschlagen');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('de-DE').format(value || 0);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE');
  };

  const getTypeLabel = (type) => {
    const labels = {
      'pos_topup': 'Aufladung',
      'topup': 'Aufladung',
      'payment': 'Zahlung',
      'gift_card_redemption': 'Gutschein'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      'pos_topup': 'text-green-400 bg-green-500/20',
      'topup': 'text-green-400 bg-green-500/20',
      'payment': 'text-blue-400 bg-blue-500/20',
      'gift_card_redemption': 'text-purple-400 bg-purple-500/20'
    };
    return colors[type] || 'text-slate-400 bg-slate-500/20';
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <BarChart3 className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">BidBlitz Pay Analyse</h1>
              <p className="text-slate-400 text-sm">Umsatz, Transaktionen & Statistiken</p>
            </div>
          </div>
          
          {/* Date Filters & Export */}
          {/* Quick Date Range Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'today', label: 'Heute' },
              { key: 'yesterday', label: 'Gestern' },
              { key: 'week', label: '7 Tage' },
              { key: 'month', label: '30 Tage' }
            ].map(({ key, label }) => (
              <Button
                key={key}
                onClick={() => setQuickDateRange(key)}
                variant={dateRange === key ? 'default' : 'outline'}
                size="sm"
                className={dateRange === key ? 'bg-amber-500 hover:bg-amber-600' : 'border-slate-600 text-slate-300'}
              >
                {label}
              </Button>
            ))}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDateRange('custom'); }}
                className="w-36 bg-slate-800 border-slate-700 text-white text-sm"
              />
              <span className="text-slate-400">-</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDateRange('custom'); }}
                className="w-36 bg-slate-800 border-slate-700 text-white text-sm"
              />
            </div>
            <Button
              onClick={fetchStats}
              disabled={loading}
              variant="outline"
              size="sm"
              className="border-slate-600"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
            <Button
              onClick={() => handleExportCSV('summary')}
              disabled={exporting}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1" />
              Bericht
            </Button>
            <Button
              onClick={() => handleExportCSV('transactions')}
              disabled={exporting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-1" />
              CSV Export
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            icon={Euro}
            label="Gesamtumsatz"
            value={formatCurrency(stats?.overview?.total_revenue)}
            color="amber"
          />
          <StatCard
            icon={TrendingUp}
            label="Aufladungen"
            value={formatCurrency(stats?.overview?.total_topups)}
            subValue={`${formatNumber(stats?.overview?.total_topup_count)} Stück`}
            color="green"
          />
          <StatCard
            icon={ShoppingCart}
            label="Zahlungen"
            value={formatCurrency(stats?.overview?.total_payments)}
            subValue={`${formatNumber(stats?.overview?.total_payment_count)} Stück`}
            color="blue"
          />
          <StatCard
            icon={Gift}
            label="Boni ausgegeben"
            value={formatCurrency(stats?.overview?.total_bonuses_given)}
            color="purple"
          />
          <StatCard
            icon={CreditCard}
            label="Gutscheine"
            value={formatCurrency(stats?.overview?.total_giftcards)}
            subValue={`${formatNumber(stats?.overview?.total_giftcard_count)} Stück`}
            color="pink"
          />
          <StatCard
            icon={PieChart}
            label="Netto-Umsatz"
            value={formatCurrency(stats?.overview?.net_revenue)}
            color="emerald"
          />
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-amber-400" />
              <div>
                <div className="text-2xl font-bold text-white">{formatNumber(stats?.users?.unique_customers)}</div>
                <div className="text-sm text-slate-400">Aktive Kunden</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-green-400" />
              <div>
                <div className="text-2xl font-bold text-white">{formatNumber(stats?.users?.users_with_balance)}</div>
                <div className="text-sm text-slate-400">Kunden mit Guthaben</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <Euro className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-white">{formatCurrency(stats?.users?.total_balance_in_system)}</div>
                <div className="text-sm text-slate-400">Guthaben im System</div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Breakdown */}
        <CollapsibleSection
          title="Tagesübersicht"
          icon={Calendar}
          expanded={expandedSections.includes('daily')}
          onToggle={() => toggleSection('daily')}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Datum</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Aufladungen</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Anzahl</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Zahlungen</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Anzahl</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Boni</th>
                </tr>
              </thead>
              <tbody>
                {stats?.daily_breakdown?.map((day, i) => (
                  <tr key={day.date} className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}>
                    <td className="py-3 px-4 text-white font-medium">{day.date}</td>
                    <td className="py-3 px-4 text-right text-green-400">{formatCurrency(day.topups)}</td>
                    <td className="py-3 px-4 text-right text-slate-300">{day.topup_count}</td>
                    <td className="py-3 px-4 text-right text-blue-400">{formatCurrency(day.payments)}</td>
                    <td className="py-3 px-4 text-right text-slate-300">{day.payment_count}</td>
                    <td className="py-3 px-4 text-right text-purple-400">{formatCurrency(day.bonuses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Branch Stats */}
        <CollapsibleSection
          title="Filialen"
          icon={Building2}
          expanded={expandedSections.includes('branches')}
          onToggle={() => toggleSection('branches')}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Filiale</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Aufladungen</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Zahlungen</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Gesamt</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Transaktionen</th>
                </tr>
              </thead>
              <tbody>
                {stats?.branch_stats?.map((branch, i) => (
                  <tr key={branch.name} className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}>
                    <td className="py-3 px-4 text-white font-medium">{branch.name}</td>
                    <td className="py-3 px-4 text-right text-green-400">{formatCurrency(branch.topups)}</td>
                    <td className="py-3 px-4 text-right text-blue-400">{formatCurrency(branch.payments)}</td>
                    <td className="py-3 px-4 text-right text-amber-400 font-bold">{formatCurrency(branch.total)}</td>
                    <td className="py-3 px-4 text-right text-slate-300">{branch.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Staff Stats */}
        <CollapsibleSection
          title="Mitarbeiter"
          icon={User}
          expanded={expandedSections.includes('staff')}
          onToggle={() => toggleSection('staff')}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Mitarbeiter</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Aufladungen</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Zahlungen</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Gesamt</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Transaktionen</th>
                </tr>
              </thead>
              <tbody>
                {stats?.staff_stats?.map((staff, i) => (
                  <tr key={staff.name} className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}>
                    <td className="py-3 px-4 text-white font-medium">{staff.name}</td>
                    <td className="py-3 px-4 text-right text-green-400">{formatCurrency(staff.topups)}</td>
                    <td className="py-3 px-4 text-right text-blue-400">{formatCurrency(staff.payments)}</td>
                    <td className="py-3 px-4 text-right text-amber-400 font-bold">{formatCurrency(staff.total)}</td>
                    <td className="py-3 px-4 text-right text-slate-300">{staff.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Top Customers */}
        <CollapsibleSection
          title="Top Kunden"
          icon={Users}
          expanded={expandedSections.includes('customers')}
          onToggle={() => toggleSection('customers')}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Kunde</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Aufladungen</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Zahlungen</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Gesamt</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Transaktionen</th>
                </tr>
              </thead>
              <tbody>
                {stats?.top_customers?.map((customer, i) => (
                  <tr key={customer.id} className={`border-b border-slate-700/50 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{customer.name}</div>
                      {customer.barcode && <div className="text-xs text-slate-500">{customer.barcode}</div>}
                    </td>
                    <td className="py-3 px-4 text-right text-green-400">{formatCurrency(customer.topups)}</td>
                    <td className="py-3 px-4 text-right text-blue-400">{formatCurrency(customer.payments)}</td>
                    <td className="py-3 px-4 text-right text-amber-400 font-bold">{formatCurrency(customer.total)}</td>
                    <td className="py-3 px-4 text-right text-slate-300">{customer.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>

        {/* Hourly Distribution */}
        <CollapsibleSection
          title="Uhrzeitverteilung"
          icon={Clock}
          expanded={expandedSections.includes('hourly')}
          onToggle={() => toggleSection('hourly')}
        >
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {stats?.hourly_distribution?.map((hour) => {
              const maxValue = Math.max(...(stats?.hourly_distribution?.map(h => h.count) || [1]));
              const height = (hour.count / maxValue) * 100;
              return (
                <div key={hour.hour} className="text-center">
                  <div className="h-24 flex items-end justify-center">
                    <div 
                      className="w-full bg-amber-500/50 rounded-t"
                      style={{ height: `${Math.max(height, 5)}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{String(hour.hour).padStart(2, '0')}h</div>
                  <div className="text-xs text-slate-500">{hour.count}</div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* ALL TRANSACTIONS LIST */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 mb-4 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <List className="w-5 h-5 text-amber-400" />
              <span className="font-medium text-white">Alle Transaktionen ({transactions.length})</span>
            </div>
            <Button
              onClick={() => setShowAllTransactions(!showAllTransactions)}
              variant="ghost"
              size="sm"
              className="text-slate-400"
            >
              {showAllTransactions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </div>
          
          {showAllTransactions && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Datum</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Uhrzeit</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Typ</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Kunde</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Kunden-Nr.</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Filiale</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Mitarbeiter</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Betrag</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Bonus</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Rabatt</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-8 text-center text-slate-400">
                        Keine Transaktionen in diesem Zeitraum
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, i) => (
                      <tr key={tx.id || i} className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}>
                        <td className="py-3 px-4 text-white">{formatDate(tx.created_at)}</td>
                        <td className="py-3 px-4 text-slate-300">{formatTime(tx.created_at)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(tx.type)}`}>
                            {getTypeLabel(tx.type)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{tx.customer_name || '-'}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{tx.customer_barcode || tx.customer_number || '-'}</td>
                        <td className="py-3 px-4 text-slate-300">{tx.branch_name || '-'}</td>
                        <td className="py-3 px-4 text-slate-300">{tx.staff_name || '-'}</td>
                        <td className="py-3 px-4 text-right font-bold text-amber-400">{formatCurrency(tx.amount)}</td>
                        <td className="py-3 px-4 text-right text-purple-400">{tx.bonus ? formatCurrency(tx.bonus) : '-'}</td>
                        <td className="py-3 px-4 text-right text-pink-400">{tx.discount_amount ? formatCurrency(tx.discount_amount) : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, subValue, color }) {
  const colorClasses = {
    amber: 'bg-amber-500/20 text-amber-400',
    green: 'bg-green-500/20 text-green-400',
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    pink: 'bg-pink-500/20 text-pink-400',
    emerald: 'bg-emerald-500/20 text-emerald-400'
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
    </div>
  );
}

// Collapsible Section Component
function CollapsibleSection({ title, icon: Icon, expanded, onToggle, children }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 mb-4 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-amber-400" />
          <span className="font-medium text-white">{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      {expanded && (
        <div className="border-t border-slate-700/50 p-4">
          {children}
        </div>
      )}
    </div>
  );
}
