/**
 * User Microfinance/Loans Page - Apply for and manage micro-loans
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Banknote, Euro, Clock, CheckCircle, XCircle, AlertCircle,
  ArrowLeft, ChevronRight, Loader2, Shield, Calendar, Percent
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const statusConfig = {
  requested: { label: 'Beantragt', color: 'bg-blue-100 text-blue-700', icon: Clock },
  approved: { label: 'Genehmigt', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  disbursed: { label: 'Ausgezahlt', color: 'bg-green-100 text-green-700', icon: Euro },
  repaying: { label: 'Rückzahlung', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  repaid: { label: 'Zurückgezahlt', color: 'bg-slate-100 text-slate-700', icon: CheckCircle },
  rejected: { label: 'Abgelehnt', color: 'bg-red-100 text-red-700', icon: XCircle },
  defaulted: { label: 'Überfällig', color: 'bg-red-100 text-red-700', icon: AlertCircle }
};

const purposeOptions = [
  { value: 'bid_credits', label: 'Gebote kaufen' },
  { value: 'scooter', label: 'Scooter-Nutzung' },
  { value: 'shopping', label: 'Einkäufe' },
  { value: 'emergency', label: 'Notfall' },
  { value: 'other', label: 'Sonstiges' }
];

export default function LoansPage() {
  const { token, isAuthenticated } = useAuth();
  const [view, setView] = useState('list'); // list, apply, detail
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Application form
  const [amount, setAmount] = useState(100);
  const [termDays, setTermDays] = useState(30);
  const [purpose, setPurpose] = useState('bid_credits');

  const fetchLoans = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/loans/my-loans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLoans(res.data.loans || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const handleApply = async (e) => {
    e.preventDefault();
    if (amount < 50 || amount > 5000) {
      toast.error('Betrag muss zwischen 50 und 5.000 EUR liegen');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/loans/request`, {
        principal_cents: Math.round(amount * 100),
        term_days: termDays,
        purpose
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Kreditantrag eingereicht!');
      setView('list');
      fetchLoans();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Fehler beim Antrag');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRepay = async (loanId, amountCents) => {
    try {
      await axios.post(`${API}/loans/${loanId}/repay`, {
        amount_cents: amountCents,
        method: 'wallet'
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Rückzahlung erfolgreich!');
      fetchLoans();
      if (selectedLoan) {
        const res = await axios.get(`${API}/loans/${loanId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedLoan(res.data.loan || res.data);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Fehler bei Rückzahlung');
    }
  };

  // Estimated interest (15% APR default)
  const estimatedInterest = Math.round(amount * 0.15 * (termDays / 365) * 100) / 100;
  const totalDue = amount + estimatedInterest;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <p className="text-slate-500">Bitte melden Sie sich an.</p>
      </div>
    );
  }

  // APPLY VIEW
  if (view === 'apply') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50 p-4 pb-24" data-testid="loan-apply-page">
        <div className="max-w-lg mx-auto">
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-emerald-600 text-sm font-medium mb-4">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </button>

          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Banknote className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Kredit beantragen</h1>
            <p className="text-sm text-slate-500 mt-1">Schnelle Mikrokredite für BidBlitz-Nutzer</p>
          </div>

          <form onSubmit={handleApply} className="space-y-5">
            {/* Amount Slider */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100">
              <label className="flex items-center justify-between text-sm font-medium text-slate-700 mb-3">
                <span>Betrag</span>
                <span className="text-2xl font-bold text-emerald-600">€{amount}</span>
              </label>
              <input
                type="range"
                min={50}
                max={5000}
                step={50}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full accent-emerald-500"
                data-testid="loan-amount-slider"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>€50</span>
                <span>€5.000</span>
              </div>
            </div>

            {/* Term */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-3">Laufzeit</label>
              <div className="grid grid-cols-4 gap-2">
                {[7, 14, 30, 90].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTermDays(d)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      termDays === d ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {d} Tage
                  </button>
                ))}
              </div>
            </div>

            {/* Purpose */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-2">Verwendungszweck</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm"
              >
                {purposeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
              <h3 className="font-bold mb-3">Zusammenfassung</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-emerald-100">Kreditbetrag</span>
                  <span className="font-bold">€{amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-100">Laufzeit</span>
                  <span className="font-bold">{termDays} Tage</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-100">Zinsen (ca. 15% p.a.)</span>
                  <span className="font-bold">€{estimatedInterest.toFixed(2)}</span>
                </div>
                <div className="border-t border-emerald-400 pt-2 flex justify-between text-base">
                  <span className="font-bold">Gesamt zurückzuzahlen</span>
                  <span className="font-bold">€{totalDue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* KYC Notice */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Shield className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">KYC-Verifizierung erforderlich. Ihr Antrag wird innerhalb von 24 Stunden geprüft.</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              data-testid="loan-submit-btn"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5" />}
              Kredit beantragen
            </button>
          </form>
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  if (view === 'detail' && selectedLoan) {
    const status = statusConfig[selectedLoan.status] || statusConfig.requested;
    const progress = selectedLoan.total_due_cents > 0
      ? Math.min(100, Math.round((selectedLoan.repaid_cents / selectedLoan.total_due_cents) * 100))
      : 0;

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50 p-4 pb-24" data-testid="loan-detail-page">
        <div className="max-w-lg mx-auto">
          <button onClick={() => { setView('list'); setSelectedLoan(null); }} className="flex items-center gap-1 text-emerald-600 text-sm font-medium mb-4">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </button>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-slate-800">Kredit {selectedLoan.loan_number}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(selectedLoan.created_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Kreditbetrag</p>
                  <p className="text-lg font-bold text-slate-800">€{(selectedLoan.principal_cents / 100).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Gesamt fällig</p>
                  <p className="text-lg font-bold text-emerald-600">€{((selectedLoan.total_due_cents || selectedLoan.principal_cents) / 100).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Laufzeit</p>
                  <p className="text-lg font-bold text-slate-800">{selectedLoan.term_days} Tage</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Bereits gezahlt</p>
                  <p className="text-lg font-bold text-blue-600">€{((selectedLoan.repaid_cents || 0) / 100).toFixed(2)}</p>
                </div>
              </div>

              {/* Progress bar */}
              {selectedLoan.total_due_cents > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Rückzahlung</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 rounded-full h-2 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Repay button */}
              {['disbursed', 'repaying'].includes(selectedLoan.status) && (
                <button
                  onClick={() => handleRepay(selectedLoan.id, selectedLoan.total_due_cents - selectedLoan.repaid_cents)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                  data-testid="loan-repay-btn"
                >
                  Vollständig zurückzahlen (€{(((selectedLoan.total_due_cents || 0) - (selectedLoan.repaid_cents || 0)) / 100).toFixed(2)})
                </button>
              )}

              {selectedLoan.status === 'rejected' && selectedLoan.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-3">
                  <p className="text-sm text-red-700">Grund: {selectedLoan.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50 p-4 pb-24" data-testid="loans-page">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Meine Kredite</h1>
              <p className="text-xs text-slate-500">Mikrokredite verwalten</p>
            </div>
          </div>
          <button
            onClick={() => setView('apply')}
            className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl"
            data-testid="apply-loan-btn"
          >
            <Euro className="w-4 h-4" /> Beantragen
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 mb-6 text-white">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">Schnelle Mikrokredite</h3>
              <p className="text-xs text-emerald-100 mt-1">€50 - €5.000 · 7-365 Tage · Ab 15% p.a.</p>
            </div>
          </div>
        </div>

        {/* Loans */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : loans.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
            <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Noch keine Kredite</p>
            <p className="text-slate-400 text-sm mt-1">Beantragen Sie Ihren ersten Mikrokredit</p>
          </div>
        ) : (
          <div className="space-y-3">
            {loans.map((loan) => {
              const status = statusConfig[loan.status] || statusConfig.requested;
              const StatusIcon = status.icon;
              return (
                <div
                  key={loan.id}
                  onClick={() => { setSelectedLoan(loan); setView('detail'); }}
                  className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-emerald-200 transition-all active:scale-[0.98]"
                  data-testid={`loan-${loan.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-slate-800">€{(loan.principal_cents / 100).toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400">{loan.loan_number} · {loan.term_days} Tage</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 flex-shrink-0 ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{new Date(loan.created_at).toLocaleDateString('de-DE')}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
