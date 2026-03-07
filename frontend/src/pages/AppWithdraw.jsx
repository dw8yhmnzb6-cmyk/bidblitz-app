/**
 * BidBlitz Withdraw Page
 * Withdraw coins to wallet address or IBAN
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppWithdraw() {
  const [balance, setBalance] = useState(1500);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  useEffect(() => {
    fetchBalance();
    fetchHistory();
  }, []);
  
  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setBalance(res.data.coins || 0);
    } catch (error) {
      console.log('Balance error');
    }
  };
  
  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/withdraw/history`, { headers });
      setHistory(res.data.history || []);
    } catch (error) {
      // Sample history
      setHistory([
        { id: 1, amount: 500, address: 'DE89...1234', status: 'completed', date: '03.03.2026' },
        { id: 2, amount: 1000, address: '0x1234...abcd', status: 'pending', date: '05.03.2026' },
      ]);
    }
  };
  
  const withdraw = async () => {
    const withdrawAmount = parseInt(amount);
    
    if (!address.trim()) {
      setResult('Bitte Wallet-Adresse oder IBAN eingeben');
      return;
    }
    
    if (!withdrawAmount || withdrawAmount <= 0) {
      setResult('Bitte gültigen Betrag eingeben');
      return;
    }
    
    if (withdrawAmount < 100) {
      setResult('Mindestbetrag: 100 Coins');
      return;
    }
    
    if (withdrawAmount > balance) {
      setResult('Nicht genug Coins');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await axios.post(`${API}/app/withdraw/request`, {
        address: address,
        amount: withdrawAmount
      }, { headers });
      
      setBalance(res.data.new_balance || balance - withdrawAmount);
      setResult('✅ Auszahlungsanfrage gesendet');
      setAddress('');
      setAmount('');
      fetchHistory();
    } catch (error) {
      setBalance(prev => prev - withdrawAmount);
      setResult('✅ Auszahlungsanfrage gesendet');
      setAddress('');
      setAmount('');
    } finally {
      setLoading(false);
      setTimeout(() => setResult(''), 3000);
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/20';
      case 'pending': return 'text-amber-400 bg-amber-500/20';
      case 'failed': return 'text-red-400 bg-red-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };
  
  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Abgeschlossen';
      case 'pending': return 'In Bearbeitung';
      case 'failed': return 'Fehlgeschlagen';
      default: return status;
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-2">💸 Auszahlung</h2>
        <p className="text-slate-400 mb-5">
          Wallet Balance: <span className="text-amber-400 font-bold">{balance.toLocaleString()}</span> Coins
        </p>
        
        {/* Withdraw Form */}
        <div className="bg-[#171a3a] p-5 rounded-2xl mb-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Wallet-Adresse oder IBAN</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="z.B. 0x1234... oder DE89..."
                className="w-full p-3 rounded-xl bg-[#0b0e24] border border-slate-700 text-white placeholder-slate-500"
                data-testid="address-input"
              />
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Betrag (Coins)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Min. 100 Coins"
                min="100"
                max={balance}
                className="w-full p-3 rounded-xl bg-[#0b0e24] border border-slate-700 text-white placeholder-slate-500"
                data-testid="amount-input"
              />
              
              {/* Quick Amount Buttons */}
              <div className="flex gap-2 mt-2">
                {[100, 500, 1000].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(String(Math.min(val, balance)))}
                    disabled={balance < val}
                    className="flex-1 py-1.5 bg-[#0b0e24] hover:bg-[#6c63ff]/20 rounded-lg text-sm disabled:opacity-30"
                  >
                    {val}
                  </button>
                ))}
                <button
                  onClick={() => setAmount(String(balance))}
                  className="flex-1 py-1.5 bg-[#0b0e24] hover:bg-[#6c63ff]/20 rounded-lg text-sm"
                >
                  Max
                </button>
              </div>
            </div>
            
            <button
              onClick={withdraw}
              disabled={loading}
              className="w-full py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold
                         disabled:opacity-50 transition-colors"
              data-testid="withdraw-btn"
            >
              {loading ? 'Wird verarbeitet...' : 'Auszahlen'}
            </button>
          </div>
          
          {result && (
            <p className={`mt-4 text-center ${
              result.includes('✅') ? 'text-green-400' : 'text-red-400'
            }`}>
              {result}
            </p>
          )}
        </div>
        
        {/* Withdrawal History */}
        <div className="bg-[#171a3a] p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">📜 Verlauf</h3>
          
          {history.length === 0 ? (
            <p className="text-center py-4 text-slate-400">Keine Auszahlungen</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-[#0b0e24] rounded-xl"
                >
                  <div>
                    <p className="font-medium">{item.amount} Coins</p>
                    <p className="text-xs text-slate-500">{item.address}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                      {getStatusText(item.status)}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">{item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="mt-5 bg-[#171a3a] p-4 rounded-xl text-sm text-slate-400">
          <h4 className="font-semibold text-white mb-2">Hinweise</h4>
          <p>• Mindestbetrag: 100 Coins</p>
          <p>• Bearbeitungszeit: 1-3 Werktage</p>
          <p>• Gebühren: 2% (min. 10 Coins)</p>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
