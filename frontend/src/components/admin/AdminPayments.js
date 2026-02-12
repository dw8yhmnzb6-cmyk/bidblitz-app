// Admin Payments Tab Component
import { DollarSign, CheckCircle, Zap, RefreshCw, Clock, User, Package } from 'lucide-react';
import { Button } from '../ui/button';

export default function AdminPayments({ payments, fetchData }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Zahlungsübersicht</h1>
            <p className="text-slate-500 text-xs sm:text-sm">Alle Transaktionen im Überblick</p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 w-full sm:w-auto">
          <RefreshCw className="w-4 h-4 mr-2" />Aktualisieren
        </Button>
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-500 text-xs sm:text-sm">Umsatz gesamt</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">€{(payments || []).reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-500 text-xs sm:text-sm">Transaktionen</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">{(payments || []).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-500 text-xs sm:text-sm">Gebote verkauft</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">{(payments || []).reduce((sum, p) => sum + (p.bids || 0), 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payments - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {(payments || []).map((payment, index) => (
          <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            {/* Header with status */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{payment.user_name || 'N/A'}</p>
                <p className="text-slate-400 text-xs truncate">{payment.user_email}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                payment.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {payment.status === 'paid' ? 'Bezahlt' : payment.status === 'pending' ? 'Ausstehend' : 'Fehlgeschlagen'}
              </span>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-xs text-slate-400">Paket</p>
                <p className="text-sm font-medium text-slate-700 truncate">{payment.package_name || '-'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-xs text-slate-400">Gebote</p>
                <p className="text-lg font-bold text-amber-600">{payment.bids}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-xs text-slate-400">Betrag</p>
                <p className="text-lg font-bold text-emerald-600">€{payment.amount?.toFixed(2)}</p>
              </div>
            </div>
            
            {/* Date */}
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Clock className="w-3 h-3" />
              {new Date(payment.created_at).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}
            </div>
          </div>
        ))}
        {(payments || []).length === 0 && (
          <p className="text-center text-slate-400 py-12">Noch keine Zahlungen erfasst</p>
        )}
      </div>

      {/* Payments Table - Desktop (hidden on mobile) */}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-slate-600 font-medium">Datum</th>
                <th className="px-6 py-4 text-left text-slate-600 font-medium">Kunde</th>
                <th className="px-6 py-4 text-left text-slate-600 font-medium">Paket</th>
                <th className="px-6 py-4 text-left text-slate-600 font-medium">Gebote</th>
                <th className="px-6 py-4 text-left text-slate-600 font-medium">Betrag</th>
                <th className="px-6 py-4 text-left text-slate-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(payments || []).map((payment, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-700">
                    {new Date(payment.created_at).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-800 font-medium">{payment.user_name || 'N/A'}</p>
                    <p className="text-slate-400 text-sm">{payment.user_email}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{payment.package_name}</td>
                  <td className="px-6 py-4 text-amber-600 font-bold">{payment.bids}</td>
                  <td className="px-6 py-4 text-emerald-600 font-mono font-bold">€{payment.amount?.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                      payment.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {payment.status === 'paid' ? 'Bezahlt' : payment.status === 'pending' ? 'Ausstehend' : 'Fehlgeschlagen'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(payments || []).length === 0 && (
          <p className="text-center text-slate-400 py-12">Noch keine Zahlungen erfasst</p>
        )}
      </div>
    </div>
  );
}
