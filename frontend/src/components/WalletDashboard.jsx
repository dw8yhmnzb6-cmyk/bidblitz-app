import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp } from 'lucide-react';

export function WalletDashboard() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTopupModal, setShowTopupModal] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/super-app/wallet/balance`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBalance(response.data.balance);
      setTransactions(response.data.recent_transactions || []);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async (amount: number, method: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/super-app/wallet/topup`,
        { amount, method },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowTopupModal(false);
      fetchWalletData();
    } catch (error) {
      console.error('Topup error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Lade Wallet...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 mb-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="w-8 h-8" />
          <h2 className="text-xl font-semibold">BidBlitz Wallet</h2>
        </div>
        <div className="mb-6">
          <div className="text-sm opacity-80 mb-1">Verfügbares Guthaben</div>
          <div className="text-4xl font-bold">€{balance.toFixed(2)}</div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTopupModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur rounded-lg hover:bg-white/30 transition-all"
          >
            <ArrowDownLeft className="w-5 h-5" />
            Aufladen
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur rounded-lg hover:bg-white/30 transition-all">
            <ArrowUpRight className="w-5 h-5" />
            Senden
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Ausgaben (Monat)</div>
          <div className="text-2xl font-bold text-white">€0.00</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Einnahmen</div>
          <div className="text-2xl font-bold text-green-400">€0.00</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Transaktionen</div>
          <div className="text-2xl font-bold text-white">{transactions.length}</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Letzte Transaktionen
          </h3>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Noch keine Transaktionen
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    tx.type === 'topup' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {tx.type === 'topup' ? (
                      <ArrowDownLeft className="w-4 h-4 text-green-400" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white">{tx.type}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                </div>
                <div className={`font-semibold ${
                  tx.type === 'topup' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {tx.type === 'topup' ? '+' : '-'}€{Math.abs(tx.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Topup Modal */}
      {showTopupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">
              Wallet aufladen
            </h3>
            <div className="space-y-3 mb-6">
              {[10, 25, 50, 100].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleTopup(amount, 'card')}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white font-semibold"
                >
                  €{amount}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTopupModal(false)}
              className="w-full px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
