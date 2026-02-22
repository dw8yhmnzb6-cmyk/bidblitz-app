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
    <div className="space-y-2 sm:space-y-4 max-w-full overflow-hidden">
      {/* Header - Einzeilig und kompakt */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm sm:text-lg font-bold text-gray-900 flex items-center gap-1.5">
          <Euro className="w-4 h-4 text-green-600" />
          Umsatz
        </h2>
        <div className="flex gap-1">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-1.5 py-1 border rounded text-[10px] sm:text-xs">
            <option value="week">Woche</option>
            <option value="month">Monat</option>
            <option value="quarter">Quartal</option>
          </select>
          <Button onClick={fetchAnalytics} disabled={loading} variant="outline" size="sm" className="h-6 w-6 p-0">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Overview Cards - Kompaktes 2x2 Grid */}
      {overview && (
        <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
          <div className="bg-green-500 rounded-md p-2 text-white">
            <div className="text-[9px] sm:text-xs opacity-90">Heute</div>
            <div className="text-sm sm:text-xl font-bold">{formatCurrency(overview.revenue_today)}</div>
          </div>
          <div className="bg-blue-500 rounded-md p-2 text-white">
            <div className="text-[9px] sm:text-xs opacity-90">Woche</div>
            <div className="text-sm sm:text-xl font-bold">{formatCurrency(overview.revenue_this_week)}</div>
          </div>
          <div className="bg-purple-500 rounded-md p-2 text-white">
            <div className="text-[9px] sm:text-xs opacity-90">Monat</div>
            <div className="text-sm sm:text-xl font-bold">{formatCurrency(overview.revenue_this_month)}</div>
          </div>
          <div className="bg-amber-500 rounded-md p-2 text-white">
            <div className="text-[9px] sm:text-xs opacity-90">Trans.</div>
            <div className="text-sm sm:text-xl font-bold">{overview.transactions_today}</div>
          </div>
        </div>
      )}

      {/* Tabs - Icons only auf Mobile */}
      <div className="flex gap-1 border-b pb-1.5 overflow-x-auto">
        {[
          { id: 'overview', label: 'Übersicht', icon: BarChart3 },
          { id: 'packages', label: 'Pakete', icon: Package },
          { id: 'auctions', label: 'Aukt.', icon: Zap },
          { id: 'spenders', label: 'Käufer', icon: CreditCard },
          { id: 'conversion', label: 'Conv.', icon: Target },
          { id: 'timing', label: 'Peak', icon: Clock }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[10px] sm:text-xs font-medium whitespace-nowrap ${
              activeTab === tab.id ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            <span className="hidden xs:inline sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab - Täglicher Umsatz */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-lg border p-2 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-2 text-xs sm:text-sm flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            Täglicher Umsatz
          </h3>
          {dailyRevenue.length > 0 ? (
            <div className="space-y-1">
              {dailyRevenue.slice(-7).map((day) => {
                const maxRev = Math.max(...dailyRevenue.map(d => d.revenue), 1);
                const width = (day.revenue / maxRev) * 100;
                return (
                  <div key={day.date} className="flex items-center gap-1.5">
                    <span className="text-[8px] sm:text-[10px] text-gray-500 w-10 sm:w-14">{new Date(day.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' })}</span>
                    <div className="flex-1 h-3 sm:h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.max(width, 3)}%` }} />
                    </div>
                    <span className="text-[8px] sm:text-[10px] font-medium w-12 sm:w-14 text-right">{formatCurrency(day.revenue)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-3 text-xs">Keine Daten</div>
          )}
        </div>
      )}

      {/* Packages Tab - Kompakt */}
      {activeTab === 'packages' && (
        <div className="bg-white rounded-lg border p-2 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-2 text-xs sm:text-sm flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-purple-500" />
            Gebotspakete
          </h3>
          {packages.length > 0 ? (
            <div className="space-y-1.5">
              {packages.slice(0, 5).map((pkg, idx) => {
                const maxRev = packages[0]?.revenue || 1;
                const width = (pkg.revenue / maxRev) * 100;
                return (
                  <div key={pkg.bids} className="flex items-center gap-1.5">
                    <span className="text-[8px] sm:text-[10px] text-gray-600 w-16 sm:w-20 truncate">{pkg.package_name}</span>
                    <div className="flex-1 h-3 sm:h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${idx === 0 ? 'bg-purple-500' : idx === 1 ? 'bg-blue-500' : 'bg-gray-400'}`} style={{ width: `${Math.max(width, 5)}%` }} />
                    </div>
                    <span className="text-[8px] sm:text-[10px] font-bold text-green-600 w-12 sm:w-14 text-right">{formatCurrency(pkg.revenue)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-3 text-xs">Keine Daten</div>
          )}
        </div>
      )}

      {/* Auctions Tab - Kompakt */}
      {activeTab === 'auctions' && auctionStats && (
        <div className="bg-white rounded-lg border p-2 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-2 text-xs sm:text-sm flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Auktionen
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
            <div className="bg-gray-50 rounded p-1.5">
              <div className="text-gray-500">Abgeschlossen</div>
              <div className="font-bold">{auctionStats.completed_auctions}</div>
            </div>
            <div className="bg-gray-50 rounded p-1.5">
              <div className="text-gray-500">Ø Endpreis</div>
              <div className="font-bold text-green-600">{formatCurrency(auctionStats.avg_final_price)}</div>
            </div>
            <div className="bg-gray-50 rounded p-1.5">
              <div className="text-gray-500">Ø Gebote</div>
              <div className="font-bold">{auctionStats.avg_bids_per_auction}</div>
            </div>
            <div className="bg-gray-50 rounded p-1.5">
              <div className="text-gray-500">Einnahmen</div>
              <div className="font-bold text-blue-600">{formatCurrency(auctionStats.paid_revenue)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Spenders Tab - Kompakt */}
      {activeTab === 'spenders' && (
        <div className="bg-white rounded-lg border p-2 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-2 text-xs sm:text-sm flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-500" />
            Top Käufer
          </h3>
          {topSpenders.length > 0 ? (
            <div className="space-y-1">
              {topSpenders.slice(0, 5).map((spender, idx) => (
                <div key={spender._id} className="flex items-center gap-1.5 py-1 border-b border-gray-100 last:border-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${idx < 3 ? 'bg-green-500' : 'bg-gray-400'}`}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] sm:text-xs font-medium truncate">{spender.user_name}</div>
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold text-green-600">{formatCurrency(spender.total_spent)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-3 text-xs">Keine Daten</div>
          )}
        </div>
      )}

      {/* Conversion Tab - Kompakt */}
      {activeTab === 'conversion' && conversion && (
        <div className="bg-white rounded-lg border p-2 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-2 text-xs sm:text-sm flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-red-500" />
            Conversion
          </h3>
          <div className="space-y-1.5">
            {[
              { label: 'Registriert', value: conversion.funnel?.registered, color: 'bg-blue-500' },
              { label: 'Gebote', value: conversion.funnel?.placed_bids, color: 'bg-green-500' },
              { label: 'Kauf', value: conversion.funnel?.made_purchase, color: 'bg-purple-500' },
              { label: 'Gewonnen', value: conversion.funnel?.won_auction, color: 'bg-amber-500' }
            ].map((step) => {
              const maxVal = conversion.funnel?.registered || 1;
              const width = (step.value / maxVal) * 100;
              return (
                <div key={step.label} className="flex items-center gap-1.5">
                  <span className="text-[8px] sm:text-[10px] text-gray-600 w-14 sm:w-16">{step.label}</span>
                  <div className="flex-1 h-3 sm:h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${step.color} rounded-full`} style={{ width: `${Math.max(width, 3)}%` }} />
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-medium w-6 text-right">{step.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timing Tab - Kompakt */}
      {activeTab === 'timing' && hourlyData && (
        <div className="bg-white rounded-lg border p-2 sm:p-4">
          <h3 className="font-medium text-gray-900 mb-2 text-xs sm:text-sm flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            Peak-Zeiten
            {hourlyData.peak_hour && (
              <span className="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded ml-auto">
                Peak: {hourlyData.peak_hour.hour}
              </span>
            )}
          </h3>
          <div className="grid grid-cols-12 gap-0.5">
            {hourlyData.hourly_breakdown?.slice(0, 12).map((hour) => {
              const maxRev = Math.max(...hourlyData.hourly_breakdown.map(h => h.revenue), 1);
              const height = (hour.revenue / maxRev) * 100;
              const isPeak = hour.hour === hourlyData.peak_hour?.hour;
              return (
                <div key={hour.hour} className="flex flex-col items-center">
                  <div className="h-10 sm:h-16 w-full flex items-end justify-center">
                    <div 
                      className={`w-full rounded-t ${isPeak ? 'bg-green-500' : 'bg-blue-400'}`}
                      style={{ height: `${Math.max(height, 8)}%` }}
                    />
                  </div>
                  <span className="text-[6px] sm:text-[8px] text-gray-400">{hour.hour.slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-center text-[8px] sm:text-xs text-gray-400 mt-2">
        Aktualisiert: {overview?.timestamp ? new Date(overview.timestamp).toLocaleTimeString('de-DE') : '-'}
      </div>
    </div>
  );
}

export default AdminRevenueAnalytics;
