/**
 * Merchant Panel - QR Topup for customers + commission tracking
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { QrCode, Euro, CheckCircle, Loader2, Store, History, Search, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function MerchantPanel() {
  const { token, user } = useAuth();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [history, setHistory] = useState([]);
  const [scanning, setScanning] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (token) {
      axios.get(`${API}/wallet-ledger/transactions?limit=20`, { headers })
        .then(r => setHistory(r.data.transactions?.filter(t => t.category === 'commission') || []))
        .catch(() => {});
    }
  }, [token]);

  const handleTopup = async () => {
    if (!userId.trim() || !amount) { toast.error('User-ID und Betrag eingeben'); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/taxi/merchant/topup`, { user_id: userId, amount: parseFloat(amount) }, { headers });
      setDone(r.data);
      toast.success(`${r.data.net_credited} EUR aufgeladen!`);
      setUserId(''); setAmount('');
    } catch (e) { toast.error(e.response?.data?.detail || 'Fehler'); }
    finally { setLoading(false); }
  };

  if (done) return (
    <div className="min-h-screen bg-emerald-500 flex items-center justify-center p-4">
      <div className="text-center text-white">
        <CheckCircle className="w-20 h-20 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Aufladung erfolgreich!</h1>
        <p className="text-emerald-100 text-lg mb-1">{done.net_credited} EUR gutgeschrieben</p>
        <p className="text-emerald-200 text-sm">Provision: {done.commission} EUR</p>
        <button onClick={() => setDone(null)} className="mt-6 px-8 py-3 bg-white text-emerald-600 font-bold rounded-xl">Weitere Aufladung</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4 pb-24" data-testid="merchant-panel">
      <div className="max-w-lg mx-auto pt-4">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Merchant Panel</h1>
          <p className="text-slate-400 text-sm mt-1">Kunden-Wallet aufladen</p>
        </div>

        {/* Topup Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <div className="mb-4">
            <label className="text-xs text-slate-400 font-medium">Kunden-ID (QR scannen oder eingeben)</label>
            <div className="flex gap-2 mt-1">
              <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="User-ID" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 font-mono" data-testid="user-id-input" />
              <button onClick={() => setScanning(!scanning)} className="px-4 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center">
                <QrCode className="w-5 h-5 text-cyan-400" />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-slate-400 font-medium">Betrag (EUR)</label>
            <div className="flex items-center gap-2 mt-1">
              <Euro className="w-5 h-5 text-slate-400" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="1" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-2xl font-bold placeholder-white/30" data-testid="amount-input" />
            </div>
          </div>

          {/* Quick amounts */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[5, 10, 20, 50].map(a => (
              <button key={a} onClick={() => setAmount(String(a))} className={`py-2 rounded-xl text-sm font-bold border ${amount === String(a) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white/5 text-white border-white/10'}`}>
                {a} EUR
              </button>
            ))}
          </div>

          <button onClick={handleTopup} disabled={loading || !userId || !amount} className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Euro className="w-5 h-5" /> Aufladen</>}
          </button>
        </div>

        {/* Commission History */}
        <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Provisionen</h3>
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-slate-600 py-4 text-sm">Noch keine Provisionen</p>
          ) : history.map(t => (
            <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div><p className="text-white text-sm">{t.description}</p><p className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString('de-DE')}</p></div>
              <span className="text-emerald-400 font-bold">+{(t.amount_cents/100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
