/**
 * QR Payment Page - Scan & Pay at partner stores
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { QrCode, X, Euro, CheckCircle, Loader2, Store, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function QRPaymentPage() {
  const { token } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [partner, setPartner] = useState(null);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const handleScan = () => {
    // Simulate scanning a partner QR code
    setPartner({ name: 'Demo Partner Shop', id: 'demo-partner' });
    setScanning(false);
  };

  const handlePay = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents < 1) { toast.error('Bitte Betrag eingeben'); return; }
    setPaying(true);
    try {
      // Use wallet ledger to deduct
      await axios.post(`${API}/wallet-ledger/topup`, {
        amount_cents: -cents, method: 'qr_payment'
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPaid(true);
      toast.success(`${amount} EUR an ${partner.name} bezahlt!`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Zahlung fehlgeschlagen');
    } finally { setPaying(false); }
  };

  if (paid) {
    return (
      <div className="min-h-screen bg-emerald-500 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <CheckCircle className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Bezahlt!</h1>
          <p className="text-emerald-100 mb-1">{amount} EUR an {partner?.name}</p>
          <Link to="/" className="mt-6 inline-block px-6 py-3 bg-white text-emerald-600 font-bold rounded-xl">
            Fertig
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 pb-24" data-testid="qr-payment-page">
      <div className="max-w-lg mx-auto pt-4">
        <h1 className="text-xl font-bold text-slate-800 text-center mb-6">QR-Zahlung</h1>

        {!partner ? (
          <>
            {/* Scanner */}
            <div className="bg-slate-900 rounded-2xl p-8 text-center mb-6">
              <div className="w-48 h-48 border-4 border-white/30 rounded-2xl mx-auto relative mb-4">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-400 animate-pulse" />
              </div>
              <p className="text-white/60 text-sm">Händler-QR-Code scannen</p>
            </div>

            <button onClick={handleScan}
              className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 mb-4">
              <QrCode className="w-5 h-5" /> Demo: Partner scannen
            </button>

            <p className="text-center text-xs text-slate-400">Scannen Sie den QR-Code des Händlers um zu bezahlen</p>
          </>
        ) : (
          <>
            {/* Payment Form */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{partner.name}</p>
                  <p className="text-xs text-slate-500">QR-Zahlung</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-slate-600 font-medium">Betrag (EUR)</label>
                <div className="flex items-center mt-1">
                  <Euro className="w-6 h-6 text-slate-400 mr-2" />
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0.00" step="0.01" min="0.01"
                    className="text-3xl font-bold text-slate-800 w-full outline-none" autoFocus />
                </div>
              </div>

              <button onClick={handlePay} disabled={paying || !amount}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Jetzt bezahlen'}
              </button>
            </div>

            <button onClick={() => setPartner(null)} className="w-full py-2 text-slate-500 text-sm">
              Abbrechen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
