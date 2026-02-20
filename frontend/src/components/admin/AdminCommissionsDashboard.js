/**
 * AdminCommissionsDashboard - Commission statistics and analytics
 * Shows platform commissions earned from merchant transactions
 */
import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Store, Calendar,
  Download, RefreshCw, BarChart3, PieChart, ArrowUpRight,
  ArrowDownRight, Filter, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ADMIN_KEY = 'bidblitz-admin-2026';

export default function AdminCommissionsDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState(30);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/digital/commissions/stats?days=${period}`, {
        headers: { 'X-Admin-Key': ADMIN_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        toast.error('Fehler beim Laden');
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format) => {
    try {
      const res = await fetch(`${API_URL}/api/digital/commissions/export?days=${period}&format=${format}`, {
        headers: { 'X-Admin-Key': ADMIN_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        if (format === 'csv') {
          const blob = new Blob([data.csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `provisionen-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`${data.rows} Einträge exportiert`);
        } else {
          const blob = new Blob([JSON.stringify(data.commissions, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `provisionen-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`${data.count} Einträge exportiert`);
        }
      }
    } catch (err) {
      toast.error('Export fehlgeschlagen');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-commissions-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500" />
            Provisions-Dashboard
          </h2>
          <p className="text-sm text-gray-600 mt-1">Ihre Einnahmen aus Händler-Transaktionen</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm"
            >
              <Calendar className="w-4 h-4 text-gray-500" />
              {period} Tage
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showPeriodDropdown && (
              <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                {[7, 14, 30, 60, 90, 180, 365].map(days => (
                  <button
                    key={days}
                    onClick={() => { setPeriod(days); setShowPeriodDropdown(false); }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${period === days ? 'bg-orange-50 text-orange-600' : ''}`}
                  >
                    {days} Tage
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Export */}
          <button
            onClick={() => exportData('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          
          {/* Refresh */}
          <button
            onClick={fetchStats}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {stats && (
        <>
          {/* Main Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Commission */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-4 sm:p-5 border border-green-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-green-600 font-medium">Provisionen gesamt</p>
                  <p className="text-xl sm:text-3xl font-bold text-green-800 mt-1">
                    {formatCurrency(stats.totals.commission)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">
                Ø {stats.totals.avg_commission_rate}% pro Transaktion
              </p>
            </div>

            {/* Transaction Volume */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-4 sm:p-5 border border-blue-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-blue-600 font-medium">Transaktionsvolumen</p>
                  <p className="text-xl sm:text-3xl font-bold text-blue-800 mt-1">
                    {formatCurrency(stats.totals.volume)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                {stats.totals.transactions} Transaktionen
              </p>
            </div>

            {/* This Month */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl p-4 sm:p-5 border border-orange-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-orange-600 font-medium">Dieser Monat</p>
                  <p className="text-xl sm:text-3xl font-bold text-orange-800 mt-1">
                    {formatCurrency(stats.comparison.this_month)}
                  </p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  stats.comparison.growth_percent >= 0 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {stats.comparison.growth_percent >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(stats.comparison.growth_percent)}%
                </div>
              </div>
              <p className="text-xs text-orange-600 mt-2">
                vs. {formatCurrency(stats.comparison.last_month)} letzter Monat
              </p>
            </div>

            {/* Cashback Given */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl p-4 sm:p-5 border border-purple-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-purple-600 font-medium">Cashback ausgegeben</p>
                  <p className="text-xl sm:text-3xl font-bold text-purple-800 mt-1">
                    {formatCurrency(stats.totals.cashback_given)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                  <PieChart className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-purple-600 mt-2">
                An Kunden zurückgegeben
              </p>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Merchants */}
            <div className="bg-white rounded-xl border">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Store className="w-5 h-5 text-orange-500" />
                  Top Händler
                </h3>
                <span className="text-xs text-gray-500">{stats.by_merchant.length} Händler</span>
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {stats.by_merchant.length === 0 ? (
                  <p className="text-gray-500 text-center py-8 text-sm">Noch keine Daten</p>
                ) : (
                  stats.by_merchant.map((merchant, idx) => (
                    <div key={merchant.api_key_id || idx} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                            idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-gray-300'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{merchant.name}</p>
                            <p className="text-xs text-gray-500">
                              {merchant.transaction_count} Transaktionen
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(merchant.commission_total)}</p>
                          <p className="text-xs text-gray-500">von {formatCurrency(merchant.volume)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Daily Stats */}
            <div className="bg-white rounded-xl border">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Tägliche Übersicht
                </h3>
                <span className="text-xs text-gray-500">Letzte {Math.min(period, 30)} Tage</span>
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {stats.daily.length === 0 ? (
                  <p className="text-gray-500 text-center py-8 text-sm">Noch keine Daten</p>
                ) : (
                  stats.daily.slice(0, 30).map((day, idx) => (
                    <div key={day.date} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 text-center">
                            <p className="text-lg font-bold text-gray-900">{day.date.split('-')[2]}</p>
                            <p className="text-xs text-gray-500">{formatDate(day.date).split('.')[1]}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">{day.transactions} Transaktionen</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(day.commission)}</p>
                        </div>
                      </div>
                      {/* Mini bar chart */}
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full"
                          style={{ 
                            width: `${Math.min(100, (day.commission / (stats.totals.commission / stats.daily.length || 1)) * 50)}%` 
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Zusammenfassung ({period} Tage)</h3>
                <p className="text-orange-100 mt-1">
                  Sie haben {formatCurrency(stats.totals.commission)} Provision aus {stats.totals.transactions} Transaktionen verdient.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => exportData('csv')}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  CSV Export
                </button>
                <button
                  onClick={() => exportData('json')}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  JSON
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
