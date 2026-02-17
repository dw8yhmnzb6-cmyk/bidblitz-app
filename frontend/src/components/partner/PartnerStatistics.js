/**
 * Partner Statistics Component
 * Displays charts and analytics for partner performance
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Euro, PieChart, BarChart3, Ticket, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const PartnerStatistics = ({ token, partner, t }) => {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, [token]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/partner-portal/statistics?token=${token}`);
      setStatistics(response.data);
    } catch (err) {
      console.error('Statistics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partner-statistics">
      <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-amber-500" />
        {t('statistics') || 'Statistiken & Berichte'}
      </h2>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm">{t('created') || 'Erstellt'}</p>
          <p className="text-2xl font-bold text-gray-800">{statistics?.overview?.total_created || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
          <p className="text-gray-500 text-sm">{t('sold') || 'Verkauft'}</p>
          <p className="text-2xl font-bold text-green-600">{statistics?.overview?.total_sold || 0}</p>
          <p className="text-xs text-gray-400">{statistics?.overview?.conversion_rate || 0}% Conversion</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500">
          <p className="text-gray-500 text-sm">{t('redeemed') || 'Eingelöst'}</p>
          <p className="text-2xl font-bold text-amber-600">{statistics?.overview?.total_redeemed || 0}</p>
          <p className="text-xs text-gray-400">{statistics?.overview?.redemption_rate || 0}% Rate</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
          <p className="text-gray-500 text-sm">{t('commission') || 'Provision'}</p>
          <p className="text-2xl font-bold text-purple-600">{statistics?.financials?.commission_rate || partner?.commission_rate || 10}%</p>
        </div>
      </div>
      
      {/* Financial Overview */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Euro className="w-5 h-5 text-green-500" />
          {t('financialOverview') || 'Finanzübersicht'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-gray-500 text-sm">{t('totalRevenue') || 'Gesamtumsatz'}</p>
            <p className="text-2xl font-bold text-gray-800">€{statistics?.financials?.total_sales?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">{t('commissionPaid') || 'Provision bezahlt'}</p>
            <p className="text-2xl font-bold text-red-500">€{statistics?.financials?.total_commission?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">{t('pending') || 'Ausstehend'}</p>
            <p className="text-2xl font-bold text-green-600">€{statistics?.financials?.pending_payout?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">{t('paidOut') || 'Ausgezahlt'}</p>
            <p className="text-2xl font-bold text-blue-600">€{statistics?.financials?.total_paid_out?.toFixed(2) || '0.00'}</p>
          </div>
        </div>
      </div>
      
      {/* Voucher Status Pie Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-blue-500" />
          {t('voucherStatus') || 'Gutschein-Status'}
        </h3>
        <div className="flex items-center justify-center gap-8">
          {/* CSS Pie Chart */}
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {(() => {
                const total = (statistics?.overview?.total_created || 1);
                const sold = statistics?.overview?.total_sold || 0;
                const redeemed = statistics?.overview?.total_redeemed || 0;
                const available = Math.max(total - sold, 0);
                
                const soldPct = (sold / total) * 100;
                const redeemedPct = (redeemed / total) * 100;
                const availablePct = (available / total) * 100;
                
                return (
                  <>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="20"
                      strokeDasharray={`${availablePct * 2.51} 251`} strokeDashoffset="0" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#3B82F6" strokeWidth="20"
                      strokeDasharray={`${soldPct * 2.51} 251`} strokeDashoffset={`${-availablePct * 2.51}`} />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="20"
                      strokeDasharray={`${redeemedPct * 2.51} 251`} strokeDashoffset={`${-(availablePct + soldPct) * 2.51}`} />
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span className="text-sm text-gray-600">{t('available') || 'Verfügbar'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" />
              <span className="text-sm text-gray-600">{t('sold') || 'Verkauft'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-500" />
              <span className="text-sm text-gray-600">{t('redeemed') || 'Eingelöst'}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top Vouchers */}
      {statistics?.top_vouchers?.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-500" />
            {t('topVouchers') || 'Top Gutscheine'}
          </h3>
          <div className="space-y-3">
            {statistics.top_vouchers.map((v, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-amber-500">#{i + 1}</span>
                  <div>
                    <p className="font-medium text-gray-800">{v.name}</p>
                    <p className="text-xs text-gray-500">
                      {v.sold} {t('sold') || 'verkauft'}, {v.redeemed} {t('redeemed') || 'eingelöst'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">€{v.revenue?.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{t('revenue') || 'Umsatz'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Daily Redemptions Chart */}
      {statistics?.chart_data?.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            {t('redemptionsChart') || 'Einlösungen (letzte 30 Tage)'}
          </h3>
          <div className="h-40 flex items-end gap-1">
            {statistics.chart_data.map((d, i) => {
              const maxValue = Math.max(...statistics.chart_data.map(x => x.value), 1);
              const height = (d.value / maxValue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group">
                  <div 
                    className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t transition-all hover:from-amber-600 hover:to-amber-500 cursor-pointer"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${d.date}: €${d.value}`}
                  />
                  {i % 5 === 0 && (
                    <span className="text-xs text-gray-400 mt-1 transform -rotate-45 origin-left">
                      {d.date?.slice(5)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerStatistics;
