/**
 * Partner Dashboard Expanded
 * Enhanced dashboard with analytics, charts, quick actions, and insights
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, Euro, History, 
  Gift, Users, Calendar, Clock, Target, Zap, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Eye,
  ShoppingBag, Star, Award, AlertCircle, CheckCircle,
  ArrowRight, Sparkles, Wallet
} from 'lucide-react';
import { Button } from '../ui/button';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PartnerDashboardExpanded({ 
  token, 
  partner, 
  dashboardData, 
  fetchDashboard,
  setView, 
  language = 'de' 
}) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30'); // days
  const [budget, setBudget] = useState(null);

  const t = {
    de: {
      title: 'Dashboard',
      quickActions: 'Schnellaktionen',
      createVoucher: 'Gutschein erstellen',
      viewPayments: 'Zahlungen ansehen',
      checkBudget: 'Budget prüfen',
      todaySummary: 'Heute',
      thisWeek: 'Diese Woche',
      thisMonth: 'Diesen Monat',
      redemptions: 'Einlösungen',
      revenue: 'Umsatz',
      newCustomers: 'Neue Kunden',
      avgOrderValue: 'Ø Bestellwert',
      performanceOverview: 'Leistungsübersicht',
      voucherActivity: 'Gutschein-Aktivität',
      topVouchers: 'Top Gutscheine',
      recentActivity: 'Aktuelle Aktivität',
      noActivity: 'Keine Aktivität',
      viewAll: 'Alle ansehen',
      trend: 'Trend',
      vsLastPeriod: 'vs. Vorperiode',
      pending: 'Ausstehend',
      redeemed: 'Eingelöst',
      sold: 'Verkauft',
      commission: 'Provision',
      budget: 'Guthaben',
      available: 'Verfügbar',
      freibetrag: 'Freibetrag',
      earnings: 'Einnahmen',
      payoutReady: 'Auszahlungsbereit',
      performanceScore: 'Performance Score',
      conversionRate: 'Konversionsrate',
      customerSatisfaction: 'Kundenzufriedenheit',
      tips: 'Tipps zur Verbesserung',
      tip1: 'Erstellen Sie mehr Gutscheine für höhere Sichtbarkeit',
      tip2: 'Teilen Sie Ihre Angebote auf Social Media',
      tip3: 'Aktivieren Sie Flash Sales für mehr Umsatz',
      noData: 'Keine Daten verfügbar',
      refresh: 'Aktualisieren',
      loading: 'Wird geladen...',
      recentRedemptions: 'Letzte Einlösungen',
      noRedemptions: 'Noch keine Einlösungen',
      value: 'Wert'
    },
    en: {
      title: 'Dashboard',
      quickActions: 'Quick Actions',
      createVoucher: 'Create Voucher',
      viewPayments: 'View Payments',
      checkBudget: 'Check Budget',
      todaySummary: 'Today',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      redemptions: 'Redemptions',
      revenue: 'Revenue',
      newCustomers: 'New Customers',
      avgOrderValue: 'Avg Order Value',
      performanceOverview: 'Performance Overview',
      voucherActivity: 'Voucher Activity',
      topVouchers: 'Top Vouchers',
      recentActivity: 'Recent Activity',
      noActivity: 'No activity',
      viewAll: 'View All',
      trend: 'Trend',
      vsLastPeriod: 'vs. Last Period',
      pending: 'Pending',
      redeemed: 'Redeemed',
      sold: 'Sold',
      commission: 'Commission',
      budget: 'Balance',
      available: 'Available',
      freibetrag: 'Free Credit',
      earnings: 'Earnings',
      payoutReady: 'Ready for Payout',
      performanceScore: 'Performance Score',
      conversionRate: 'Conversion Rate',
      customerSatisfaction: 'Customer Satisfaction',
      tips: 'Tips for Improvement',
      tip1: 'Create more vouchers for higher visibility',
      tip2: 'Share your offers on social media',
      tip3: 'Activate flash sales for more revenue',
      noData: 'No data available',
      refresh: 'Refresh',
      loading: 'Loading...',
      recentRedemptions: 'Recent Redemptions',
      noRedemptions: 'No redemptions yet',
      value: 'Value',
      budgetExhausted: 'Budget exhausted',
      pleaseTopUp: 'Please top up'
    },
    sq: {
      title: 'Paneli',
      quickActions: 'Veprime të Shpejta',
      createVoucher: 'Krijo Kupon',
      viewPayments: 'Shiko Pagesat',
      checkBudget: 'Kontrollo Buxhetin',
      todaySummary: 'Sot',
      thisWeek: 'Këtë Javë',
      thisMonth: 'Këtë Muaj',
      redemptions: 'Shlyerjet',
      revenue: 'Të Ardhurat',
      newCustomers: 'Klientë të Rinj',
      avgOrderValue: 'Vlera Mesatare',
      performanceOverview: 'Pasqyra e Performancës',
      voucherActivity: 'Aktiviteti i Kuponëve',
      topVouchers: 'Kuponët Top',
      recentActivity: 'Aktiviteti i Fundit',
      noActivity: 'Asnjë aktivitet',
      viewAll: 'Shiko të Gjitha',
      trend: 'Trendi',
      vsLastPeriod: 'vs. Periudha e Kaluar',
      pending: 'Në Pritje',
      redeemed: 'Shlyer',
      sold: 'Shitur',
      commission: 'Komisioni',
      budget: 'Buxheti',
      available: 'E Disponueshme',
      freibetrag: 'Kredi Falas',
      earnings: 'Të Ardhurat',
      payoutReady: 'Gati për Pagesë',
      performanceScore: 'Rezultati i Performancës',
      conversionRate: 'Shkalla e Konvertimit',
      customerSatisfaction: 'Kënaqësia e Klientëve',
      tips: 'Këshilla për Përmirësim',
      tip1: 'Krijoni më shumë kuponë për dukshmëri më të lartë',
      tip2: 'Ndani ofertat tuaja në media sociale',
      tip3: 'Aktivizoni shitjet e shpejta për më shumë të ardhura',
      noData: 'Asnjë e dhënë e disponueshme',
      refresh: 'Rifresko',
      loading: 'Duke u ngarkuar...',
      recentRedemptions: 'Shlyerjet e Fundit',
      noRedemptions: 'Asnjë shlyerje ende',
      value: 'Vlera',
      budgetExhausted: 'Buxheti u shterua',
      pleaseTopUp: 'Ju lutem ngarkoni'
    },
    tr: {
      title: 'Panel',
      quickActions: 'Hızlı İşlemler',
      createVoucher: 'Kupon Oluştur',
      viewPayments: 'Ödemeleri Görüntüle',
      checkBudget: 'Bütçeyi Kontrol Et',
      todaySummary: 'Bugün',
      thisWeek: 'Bu Hafta',
      thisMonth: 'Bu Ay',
      redemptions: 'Kullanımlar',
      revenue: 'Gelir',
      newCustomers: 'Yeni Müşteriler',
      avgOrderValue: 'Ort. Sipariş Değeri',
      performanceOverview: 'Performans Özeti',
      voucherActivity: 'Kupon Aktivitesi',
      topVouchers: 'En İyi Kuponlar',
      recentActivity: 'Son Aktivite',
      noActivity: 'Aktivite yok',
      viewAll: 'Tümünü Gör',
      trend: 'Trend',
      vsLastPeriod: 'vs. Önceki Dönem',
      pending: 'Bekleyen',
      redeemed: 'Kullanılmış',
      sold: 'Satılmış',
      commission: 'Komisyon',
      budget: 'Bakiye',
      available: 'Kullanılabilir',
      freibetrag: 'Ücretsiz Kredi',
      earnings: 'Kazançlar',
      payoutReady: 'Ödeme için Hazır',
      performanceScore: 'Performans Puanı',
      conversionRate: 'Dönüşüm Oranı',
      customerSatisfaction: 'Müşteri Memnuniyeti',
      tips: 'İyileştirme İpuçları',
      tip1: 'Daha fazla görünürlük için daha fazla kupon oluşturun',
      tip2: 'Tekliflerinizi sosyal medyada paylaşın',
      tip3: 'Daha fazla gelir için flash satışları etkinleştirin',
      noData: 'Veri yok',
      refresh: 'Yenile',
      loading: 'Yükleniyor...',
      recentRedemptions: 'Son Kullanımlar',
      noRedemptions: 'Henüz kullanım yok',
      value: 'Değer',
      budgetExhausted: 'Bütçe tükendi',
      pleaseTopUp: 'Lütfen yükleyin'
    }
  }[language] || {};

  const fetchBudget = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/partner-budget/my-budget?token=${token}`);
      setBudget(response.data);
    } catch (error) {
      console.error('Error fetching budget:', error);
    }
  }, [token]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch statistics which includes analytics data
      const response = await axios.get(`${API}/api/partner-portal/statistics?token=${token}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchAnalytics();
      fetchBudget();
    }
  }, [token, fetchAnalytics, fetchBudget]);

  // Calculate trends (mock data for now, would be calculated from actual data)
  const getTrend = (current, previous) => {
    if (!previous || previous === 0) return { value: 0, direction: 'neutral' };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    };
  };

  // Calculate performance score
  const calculatePerformanceScore = () => {
    if (!dashboardData) return 0;
    const redeemed = dashboardData.stats?.total_redeemed || 0;
    const sold = dashboardData.vouchers?.sold || 0;
    const total = dashboardData.vouchers?.total || 1;
    const redemptionRate = total > 0 ? (redeemed / total) * 100 : 0;
    const saleRate = sold > 0 ? Math.min((sold / total) * 100, 100) : 0;
    return Math.min(Math.round((redemptionRate * 0.6 + saleRate * 0.4)), 100);
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const performanceScore = calculatePerformanceScore();
  const budgetAvailable = budget?.voucher_budget?.total_available || 0;
  const earningsAvailable = budget?.earnings?.available_for_payout || 0;

  return (
    <div className="space-y-6" data-testid="partner-dashboard-expanded">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-amber-500" />
          {t.title}
        </h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { fetchDashboard(token); fetchAnalytics(); fetchBudget(); }}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t.refresh}
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 text-white">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          {t.quickActions}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={() => setView('vouchers')}
            className="bg-white/20 hover:bg-white/30 rounded-lg p-3 text-center transition-colors"
          >
            <Gift className="w-6 h-6 mx-auto mb-1" />
            <span className="text-xs">{t.createVoucher}</span>
          </button>
          <button 
            onClick={() => setView('payouts')}
            className="bg-white/20 hover:bg-white/30 rounded-lg p-3 text-center transition-colors"
          >
            <Euro className="w-6 h-6 mx-auto mb-1" />
            <span className="text-xs">{t.viewPayments}</span>
          </button>
          <button 
            onClick={() => setView('budget')}
            className="bg-white/20 hover:bg-white/30 rounded-lg p-3 text-center transition-colors"
          >
            <Wallet className="w-6 h-6 mx-auto mb-1" />
            <span className="text-xs">{t.checkBudget}</span>
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending Payout */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">{t.pending}</span>
            <div className="p-1.5 bg-green-100 rounded-lg">
              <Euro className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">
            €{(dashboardData?.stats?.pending_payout || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{t.payoutReady}</p>
        </div>

        {/* Redeemed */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">{t.redeemed}</span>
            <div className="p-1.5 bg-amber-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {dashboardData?.stats?.total_redeemed || 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">{t.thisMonth}</p>
        </div>

        {/* Sold */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">{t.sold}</span>
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {dashboardData?.vouchers?.sold || 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">{t.thisMonth}</p>
        </div>

        {/* Commission */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">{t.commission}</span>
            <div className="p-1.5 bg-purple-100 rounded-lg">
              <Target className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {partner?.commission_rate || 10}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{t.earnings}</p>
        </div>
      </div>

      {/* Budget & Earnings Overview */}
      {budget && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Voucher Budget */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-amber-800 flex items-center gap-2">
                <Gift className="w-5 h-5" />
                {t.budget}
              </h3>
              <button 
                onClick={() => setView('budget')}
                className="text-amber-600 hover:text-amber-800"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <p className="text-3xl font-bold text-amber-700 mb-2">
              €{budgetAvailable.toFixed(2)}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-600">{t.freibetrag}:</span>
              <span className="font-medium text-amber-800">
                €{(budget.voucher_budget?.freibetrag_remaining || 0).toFixed(2)}
              </span>
            </div>
            {!budget.can_create_vouchers && (
              <div className="mt-3 p-2 bg-red-100 rounded-lg">
                <p className="text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Budget erschöpft - Bitte aufladen
                </p>
              </div>
            )}
          </div>

          {/* Earnings */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-green-800 flex items-center gap-2">
                <Euro className="w-5 h-5" />
                {t.earnings}
              </h3>
              <button 
                onClick={() => setView('budget')}
                className="text-green-600 hover:text-green-800"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <p className="text-3xl font-bold text-green-700 mb-2">
              €{earningsAvailable.toFixed(2)}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">{t.payoutReady}:</span>
              <span className="font-medium text-green-800">
                €{(budget.earnings?.total_earnings || 0).toFixed(2)} gesamt
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Score */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          {t.performanceScore}
        </h3>
        
        <div className="flex items-center gap-6">
          {/* Score Circle */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={performanceScore >= 70 ? '#22c55e' : performanceScore >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="10"
                strokeDasharray={`${performanceScore * 2.83} 283`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{performanceScore}</span>
            </div>
          </div>
          
          {/* Stats Breakdown */}
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{t.conversionRate}</span>
                <span className="font-medium">
                  {dashboardData?.vouchers?.total > 0 
                    ? Math.round((dashboardData.stats.total_redeemed / dashboardData.vouchers.total) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ 
                    width: `${dashboardData?.vouchers?.total > 0 
                      ? Math.min((dashboardData.stats.total_redeemed / dashboardData.vouchers.total) * 100, 100) 
                      : 0}%` 
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{t.customerSatisfaction}</span>
                <span className="font-medium">
                  {analytics?.ratings?.average?.toFixed(1) || '4.5'} ⭐
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${((analytics?.ratings?.average || 4.5) / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tips for Improvement */}
      {performanceScore < 70 && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {t.tips}
          </h4>
          <ul className="space-y-2 text-sm text-blue-700">
            {(dashboardData?.vouchers?.total || 0) < 5 && (
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                {t.tip1}
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              {t.tip2}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              {t.tip3}
            </li>
          </ul>
        </div>
      )}

      {/* Recent Redemptions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            {t.recentRedemptions}
          </h2>
          <button 
            onClick={() => setView('statistics')}
            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            {t.viewAll}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y">
          {dashboardData?.recent_redemptions?.length > 0 ? (
            dashboardData.recent_redemptions.slice(0, 5).map((r, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Gift className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{r.voucher_code}</p>
                    <p className="text-xs text-gray-500">
                      {r.date ? new Date(r.date).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">+€{(r.payout_amount || r.value * 0.9)?.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{t.value}: €{r.value?.toFixed(2)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-400">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t.noRedemptions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
