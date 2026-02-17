/**
 * Partner Dashboard Component
 * Main overview with stats and quick actions
 */
import React from 'react';
import { Euro, Tag, TrendingUp, Clock, Users, CheckCircle } from 'lucide-react';

const PartnerDashboard = ({ dashboardData, partner, t }) => {
  const stats = dashboardData?.stats || {};
  const recentRedemptions = dashboardData?.recent_redemptions || [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-teal-500 to-amber-500 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">{t('welcome')}, {partner?.business_name || 'Partner'}!</h1>
        <p className="text-teal-100 mt-1">{t('dashboard')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Euro className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('available')}</p>
              <p className="text-lg font-bold text-gray-800">€{(stats.pending_payout || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('sold')}</p>
              <p className="text-lg font-bold text-gray-800">{stats.sold_vouchers || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('redeemed')}</p>
              <p className="text-lg font-bold text-gray-800">{stats.redeemed_vouchers || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('commission')}</p>
              <p className="text-lg font-bold text-gray-800">€{(stats.total_commission || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Euro className="w-5 h-5 text-green-500" />
          {t('statistics')}
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-800">€{(stats.total_sales || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('sold')}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-800">€{(stats.total_paid_out || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('payouts')}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">€{(stats.pending_payout || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('pending')}</p>
          </div>
        </div>
      </div>

      {/* Recent Redemptions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{t('recentRedemptions')}</h3>
          <Clock className="w-5 h-5 text-gray-400" />
        </div>
        {recentRedemptions.length > 0 ? (
          <div className="divide-y max-h-64 overflow-y-auto">
            {recentRedemptions.map((r, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{r.voucher_name || 'Gutschein'}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(r.redeemed_at).toLocaleDateString('de-DE')} - {new Date(r.redeemed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">€{(r.value || 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('noRedemptions')}</p>
          </div>
        )}
      </div>

      {/* Staff Count */}
      {stats.staff_count > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">{t('staff')}</p>
              <p className="text-xs text-gray-500">{stats.staff_count} {t('active')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDashboard;
