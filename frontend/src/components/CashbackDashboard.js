/**
 * Cashback Dashboard - Customer view for cashback balance, history, and redemption
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Gift, Euro, Clock, TrendingUp, CheckCircle, AlertTriangle,
  RefreshCw, ArrowRight, Percent, Calendar, Store, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CashbackDashboard() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [programInfo, setProgramInfo] = useState(null);
  const [activePromotions, setActivePromotions] = useState([]);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const token = localStorage.getItem('token');

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/cashback/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/cashback/history?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchProgramInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cashback/info`);
      if (res.ok) {
        const data = await res.json();
        setProgramInfo(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivePromotions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cashback/active-promotions`);
      if (res.ok) {
        const data = await res.json();
        setActivePromotions(data.promotions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchBalance(),
        fetchHistory(),
        fetchProgramInfo(),
        fetchActivePromotions()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchBalance, fetchHistory]);

  const handleRedeem = async () => {
    const amount = parseFloat(redeemAmount);
    if (!amount || amount <= 0) {
      toast.error('Bitte gültigen Betrag eingeben');
      return;
    }
    if (amount > (balance?.available_balance || 0)) {
      toast.error('Nicht genügend Cashback verfügbar');
      return;
    }

    setRedeeming(true);
    try {
      const res = await fetch(`${API_URL}/api/cashback/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setRedeemAmount('');
        fetchBalance();
        fetchHistory();
      } else {
        toast.error(data.detail || 'Fehler beim Einlösen');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl mb-4">
          <Gift className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold">Mein Cashback</h1>
        <p className="text-gray-500">Sammeln Sie bei jedem Einkauf {programInfo?.base_rate || 1}% Cashback!</p>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-4 sm:p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-orange-100 text-sm">Verfügbares Cashback</p>
            <p className="text-3xl sm:text-4xl font-bold mt-1">€{(balance?.available_balance ?? 0).toFixed(2)}</p>
            {balance?.expiring_soon > 0 && (
              <p className="text-orange-200 text-sm mt-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                €{balance.expiring_soon.toFixed(2)} verfällt in {balance.expiring_in_days} Tagen
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-orange-100 text-sm">Gesamt gesammelt</p>
            <p className="text-xl font-semibold">€{(balance?.total_earned ?? 0).toFixed(2)}</p>
          </div>
        </div>

        {/* Quick Redeem */}
        {balance?.can_redeem && balance?.available_balance > 0 && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              placeholder="Betrag eingeben..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-orange-200 focus:bg-white/30 focus:outline-none"
              step="0.01"
              min="0"
              max={balance?.available_balance}
            />
            <button
              onClick={handleRedeem}
              disabled={redeeming || !redeemAmount}
              className="px-6 py-3 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {redeeming ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              Einlösen
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center justify-between sm:flex-col sm:items-start">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <TrendingUp className="w-4 h-4" />
              Eingelöst
            </div>
            <p className="text-xl font-bold">€{(balance?.total_redeemed ?? 0).toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center justify-between sm:flex-col sm:items-start">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Percent className="w-4 h-4" />
              Cashback-Rate
            </div>
            <p className="text-xl font-bold">{programInfo?.base_rate ?? 1}%</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center justify-between sm:flex-col sm:items-start">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Clock className="w-4 h-4" />
              Gültigkeit
            </div>
            <p className="text-xl font-bold">{programInfo?.expiry_months ?? 6} Monate</p>
          </div>
        </div>
      </div>

      {/* Active Promotions */}
      {activePromotions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
          <h3 className="font-bold text-purple-800 mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5" />
            🎉 Aktive Bonus-Aktionen
          </h3>
          <div className="space-y-3">
            {activePromotions.map((promo, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-purple-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-purple-800">{promo.name}</p>
                  <p className="text-sm text-gray-500">{promo.merchant_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-600">x{promo.multiplier}</p>
                  <p className="text-xs text-gray-400">Cashback</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'overview' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'
            }`}
          >
            Übersicht
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'history' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'
            }`}
          >
            Verlauf
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'info' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'
            }`}
          >
            So funktioniert's
          </button>
        </div>

        <div className="p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-green-600 mb-1">Verfügbar</p>
                  <p className="text-2xl font-bold text-green-700">
                    €{balance?.available_balance?.toFixed(2)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {balance?.available_count} Transaktionen
                  </p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-sm text-orange-600 mb-1">Eingelöst</p>
                  <p className="text-2xl font-bold text-orange-700">
                    €{balance?.total_redeemed?.toFixed(2)}
                  </p>
                </div>
              </div>

              {balance?.expiring_soon > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Bald ablaufend</p>
                    <p className="text-sm text-yellow-700">
                      €{balance.expiring_soon.toFixed(2)} verfällt in den nächsten {balance.expiring_in_days} Tagen. 
                      Lösen Sie jetzt ein!
                    </p>
                  </div>
                </div>
              )}

              {/* Recent transactions preview */}
              {history.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Letzte Aktivitäten</h4>
                  {history.slice(0, 3).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.status === 'available' ? 'bg-green-100' : 
                          tx.status === 'redeemed' ? 'bg-orange-100' : 'bg-gray-100'
                        }`}>
                          {tx.status === 'available' ? <Gift className="w-4 h-4 text-green-600" /> :
                           tx.status === 'redeemed' ? <CheckCircle className="w-4 h-4 text-orange-600" /> :
                           <Clock className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.merchant_name || 'Cashback'}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(tx.created_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                      </div>
                      <p className={`font-semibold ${
                        tx.status === 'redeemed' ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {tx.status === 'redeemed' ? '-' : '+'}€{tx.amount?.toFixed(2)}
                      </p>
                    </div>
                  ))}
                  <button
                    onClick={() => setActiveTab('history')}
                    className="w-full mt-2 py-2 text-orange-600 text-sm font-medium hover:bg-orange-50 rounded-lg"
                  >
                    Alle anzeigen →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {history.length > 0 ? history.map((tx, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.status === 'available' ? 'bg-green-100' : 
                      tx.status === 'redeemed' ? 'bg-orange-100' : 'bg-gray-200'
                    }`}>
                      {tx.status === 'available' ? <Gift className="w-5 h-5 text-green-600" /> :
                       tx.status === 'redeemed' ? <CheckCircle className="w-5 h-5 text-orange-600" /> :
                       <Clock className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                      <p className="font-medium">{tx.merchant_name || 'Cashback'}</p>
                      <p className="text-sm text-gray-500">
                        {tx.transaction_type === 'topup' ? 'Aufladung' : 'Zahlung'} • 
                        €{tx.transaction_amount?.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleString('de-DE')}
                        {tx.promotion_name && ` • ${tx.promotion_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      tx.status === 'redeemed' ? 'text-orange-600' : 
                      tx.status === 'expired' ? 'text-gray-400 line-through' : 'text-green-600'
                    }`}>
                      {tx.status === 'redeemed' ? '-' : tx.status === 'expired' ? '' : '+'}€{tx.amount?.toFixed(2)}
                    </p>
                    <p className={`text-xs ${
                      tx.status === 'available' ? 'text-green-600' : 
                      tx.status === 'redeemed' ? 'text-orange-600' : 'text-gray-400'
                    }`}>
                      {tx.status === 'available' ? 'Verfügbar' : 
                       tx.status === 'redeemed' ? 'Eingelöst' : 'Abgelaufen'}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-500">
                  <Gift className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Noch keine Cashback-Transaktionen</p>
                  <p className="text-sm">Kaufen Sie ein und sammeln Sie automatisch Cashback!</p>
                </div>
              )}
            </div>
          )}

          {/* Info Tab */}
          {activeTab === 'info' && programInfo && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">So funktioniert BidBlitz Cashback</h3>
              
              <div className="space-y-3">
                {programInfo.features?.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-green-800">{feature}</p>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mt-4">
                <h4 className="font-medium mb-3">Beispielrechnung</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Einkauf bei Partner-Händler</span>
                    <span className="font-medium">€100.00</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>+ {programInfo.base_rate}% Cashback</span>
                    <span className="font-medium">+€{(100 * programInfo.base_rate / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-purple-600">
                    <span>Bei 2x Aktion (z.B. Wochenende)</span>
                    <span className="font-medium">+€{(100 * programInfo.base_rate / 100 * 2).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-gray-500">
                  <strong>Hinweis:</strong> Cashback wird automatisch nach jedem Einkauf gutgeschrieben 
                  und ist sofort einlösbar. Nicht eingelöstes Cashback verfällt nach {programInfo.expiry_months} Monaten.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
