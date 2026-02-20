import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { 
  Euro, TrendingUp, TrendingDown, RefreshCw, ShoppingCart,
  CreditCard, Package, Clock, Users, Target, BarChart3,
  ArrowUp, ArrowDown, Minus, Zap, Award, PieChart
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminRevenueAnalytics({ token }) {
  const [overview, setOverview] = useState(null);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [packages, setPackages] = useState([]);
  const [auctionStats, setAuctionStats] = useState(null);
  const [topSpenders, setTopSpenders] = useState([]);
  const [conversion, setConversion] = useState(null);
  const [hourlyData, setHourlyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, dailyRes, pkgRes, aucRes, spendRes, convRes, hourRes] = await Promise.all([
        axios.get(`${API}/analytics/revenue/overview`),
        axios.get(`${API}/analytics/revenue/daily?period=${period}`),
        axios.get(`${API}/analytics/revenue/by-package?period=${period}`),
        axios.get(`${API}/analytics/revenue/auctions?period=${period}`),
        axios.get(`${API}/analytics/revenue/top-spenders?limit=15`),
        axios.get(`${API}/analytics/revenue/conversion`),
        axios.get(`${API}/analytics/revenue/hourly`)
      ]);
      
      setOverview(overviewRes.data);
      setDailyRevenue(dailyRes.data.daily_revenue || []);
      setPackages(pkgRes.data.packages || []);
      setAuctionStats(aucRes.data);
      setTopSpenders(spendRes.data.top_spenders || []);
      setConversion(convRes.data);
      setHourlyData(hourRes.data);
    } catch (err) {
      console.error('Error fetching revenue analytics:', err);
      toast.error('Fehler beim Laden der Umsatz-Analyse');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const ChangeIndicator = ({ value }) => {
    if (value > 0) return <span className="flex items-center text-green-600 text-sm"><ArrowUp className="w-4 h-4 mr-1" />+{value.toFixed(1)}%</span>;
    if (value < 0) return <span className="flex items-center text-red-600 text-sm"><ArrowDown className="w-4 h-4 mr-1" />{value.toFixed(1)}%</span>;
    return <span className="flex items-center text-gray-500 text-sm"><Minus className="w-4 h-4 mr-1" />0%</span>;
  };

  const formatCurrency = (value) => `€${(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Euro className="w-6 h-6 text-green-600" />
            Umsatz-Analyse
          </h2>
          <p className="text-gray-500 text-sm mt-1">Einnahmen, Gebotskäufe und Conversion</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="week">Diese Woche</option>
            <option value="month">Dieser Monat</option>
            <option value="quarter">Quartal</option>
          </select>
          <Button onClick={fetchAnalytics} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
            <div className="flex justify-between items-start">
              <Euro className="w-8 h-8 opacity-80" />
              <ChangeIndicator value={overview.day_change_percent} />
            </div>
            <div className="text-3xl font-bold mt-2">{formatCurrency(overview.revenue_today)}</div>
            <div className="text-green-100 text-sm">Umsatz heute</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
            <TrendingUp className="w-8 h-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold">{formatCurrency(overview.revenue_this_week)}</div>
            <div className="text-blue-100 text-sm">Diese Woche</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
            <BarChart3 className="w-8 h-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold">{formatCurrency(overview.revenue_this_month)}</div>
            <div className="text-purple-100 text-sm">Dieser Monat</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
            <ShoppingCart className="w-8 h-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold">{overview.transactions_today}</div>
            <div className="text-amber-100 text-sm">Transaktionen heute</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Übersicht', icon: BarChart3 },
          { id: 'packages', label: 'Gebotspakete', icon: Package },
          { id: 'auctions', label: 'Auktionen', icon: Zap },
          { id: 'spenders', label: 'Top Käufer', icon: CreditCard },
          { id: 'conversion', label: 'Conversion', icon: Target },
          { id: 'timing', label: 'Peak-Zeiten', icon: Clock }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab - Daily Revenue */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Täglicher Umsatz
          </h3>
          
          {dailyRevenue.length > 0 ? (
            <div className="space-y-2">
              {dailyRevenue.slice(-14).map((day) => {
                const maxRev = Math.max(...dailyRevenue.map(d => d.revenue), 1);
                const width = (day.revenue / maxRev) * 100;
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20">{new Date(day.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">{formatCurrency(day.revenue)}</span>
                    <span className="text-xs text-gray-400 w-12">({day.transactions})</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">Keine Umsatzdaten</div>
          )}
        </div>
      )}

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Package className="w-5 h-5 text-purple-500" />Gebotspakete Verkäufe</h3>
          </div>
          <div className="p-6">
            {packages.length > 0 ? (
              <div className="space-y-4">
                {packages.map((pkg, idx) => {
                  const maxRev = packages[0]?.revenue || 1;
                  const width = (pkg.revenue / maxRev) * 100;
                  return (
                    <div key={pkg.bids} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{pkg.package_name}</span>
                        <span className="text-gray-500">{pkg.purchases}x verkauft · Ø {formatCurrency(pkg.avg_price)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${idx === 0 ? 'bg-purple-500' : idx === 1 ? 'bg-blue-500' : idx === 2 ? 'bg-green-500' : 'bg-gray-400'}`} style={{ width: `${width}%` }} />
                        </div>
                        <span className="font-bold text-green-600 w-24 text-right">{formatCurrency(pkg.revenue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">Keine Paketdaten</div>
            )}
          </div>
        </div>
      )}

      {/* Auctions Tab */}
      {activeTab === 'auctions' && auctionStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />Auktions-Statistiken</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Abgeschlossene Auktionen</span><span className="font-bold">{auctionStats.completed_auctions}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Ø Endpreis</span><span className="font-bold text-green-600">{formatCurrency(auctionStats.avg_final_price)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Ø Gebote/Auktion</span><span className="font-bold">{auctionStats.avg_bids_per_auction}</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-600">Gesamte Gebote</span><span className="font-bold text-blue-600">{auctionStats.total_bids_used?.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Euro className="w-5 h-5 text-green-500" />Einnahmen</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Bezahlte Auktionen</span><span className="font-bold">{auctionStats.paid_auctions}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Auktions-Einnahmen</span><span className="font-bold text-green-600">{formatCurrency(auctionStats.paid_revenue)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Geschätzter Gebots-Umsatz</span><span className="font-bold text-blue-600">{formatCurrency(auctionStats.estimated_bid_revenue)}</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-600">Gesamt Retail-Wert</span><span className="font-bold">{formatCurrency(auctionStats.total_retail_value)}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Top Spenders Tab */}
      {activeTab === 'spenders' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-500" />Top Käufer (nach Ausgaben)</h3>
          </div>
          <div className="divide-y">
            {topSpenders.map((spender, idx) => (
              <div key={spender._id} className="px-6 py-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${idx < 3 ? 'bg-green-500' : 'bg-gray-400'}`}>{idx + 1}</div>
                <div className="flex-1">
                  <div className="font-medium">{spender.user_name}</div>
                  <div className="text-xs text-gray-500">{spender.purchases} Käufe · {spender.total_bids} Gebote gekauft</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 text-lg">{formatCurrency(spender.total_spent)}</div>
                  <div className="text-xs text-gray-500">{spender.current_bids} Gebote übrig</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversion Tab */}
      {activeTab === 'conversion' && conversion && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold mb-6 flex items-center gap-2"><Target className="w-5 h-5 text-red-500" />Conversion Funnel (letzte 30 Tage)</h3>
            <div className="space-y-4">
              {[
                { label: 'Registriert', value: conversion.funnel?.registered, color: 'bg-blue-500' },
                { label: 'Gebote platziert', value: conversion.funnel?.placed_bids, color: 'bg-green-500' },
                { label: 'Kauf getätigt', value: conversion.funnel?.made_purchase, color: 'bg-purple-500' },
                { label: 'Auktion gewonnen', value: conversion.funnel?.won_auction, color: 'bg-amber-500' }
              ].map((step, idx) => {
                const maxVal = conversion.funnel?.registered || 1;
                const width = (step.value / maxVal) * 100;
                return (
                  <div key={step.label} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{step.label}</span>
                      <span className="text-gray-600">{step.value}</span>
                    </div>
                    <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${step.color} rounded-full transition-all`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{conversion.conversion_rates?.registration_to_bid}%</div>
              <div className="text-xs text-gray-500">Reg → Bieten</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{conversion.conversion_rates?.bid_to_purchase}%</div>
              <div className="text-xs text-gray-500">Bieten → Kauf</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{conversion.conversion_rates?.purchase_to_win}%</div>
              <div className="text-xs text-gray-500">Kauf → Gewinn</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{conversion.conversion_rates?.overall}%</div>
              <div className="text-xs text-gray-500">Gesamt</div>
            </div>
          </div>
        </div>
      )}

      {/* Timing Tab */}
      {activeTab === 'timing' && hourlyData && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Umsatz nach Tageszeit (letzte 7 Tage)
            {hourlyData.peak_hour && (
              <span className="ml-auto text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                Peak: {hourlyData.peak_hour.hour} ({formatCurrency(hourlyData.peak_hour.revenue)})
              </span>
            )}
          </h3>
          
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {hourlyData.hourly_breakdown?.map((hour) => {
              const maxRev = Math.max(...hourlyData.hourly_breakdown.map(h => h.revenue), 1);
              const height = (hour.revenue / maxRev) * 100;
              const isPeak = hour.hour === hourlyData.peak_hour?.hour;
              return (
                <div key={hour.hour} className="flex flex-col items-center">
                  <div className="h-24 w-full flex items-end justify-center">
                    <div 
                      className={`w-full rounded-t transition-all ${isPeak ? 'bg-green-500' : 'bg-blue-400'}`}
                      style={{ height: `${Math.max(height, 5)}%` }}
                      title={`${hour.hour}: ${formatCurrency(hour.revenue)} (${hour.transactions} Trans.)`}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{hour.hour.slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
          <div className="text-center text-xs text-gray-400 mt-4">Uhrzeit (UTC)</div>
        </div>
      )}

      <div className="text-center text-xs text-gray-400">
        <Clock className="w-3 h-3 inline mr-1" />
        Letzte Aktualisierung: {overview?.timestamp ? new Date(overview.timestamp).toLocaleString('de-DE') : '-'}
      </div>
    </div>
  );
}

export default AdminRevenueAnalytics;
