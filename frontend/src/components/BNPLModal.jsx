/**
 * Ratenzahlung Modal - "Jetzt kaufen, später bezahlen"
 * Buy Now Pay Later (BNPL) Component
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { 
  CreditCard, Calendar, CheckCircle, AlertCircle, 
  Loader2, ChevronRight, Shield, Clock
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BNPLModal({ 
  isOpen, 
  onClose, 
  itemType, // 'bid_package' oder 'auction_win'
  itemId,
  itemName,
  amount,
  onSuccess 
}) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(3);
  const [calculation, setCalculation] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      checkEligibility();
      calculatePlan(3);
    }
  }, [isOpen, token]);

  const checkEligibility = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/bnpl/eligibility?token=${token}`);
      const data = await res.json();
      setEligibility(data);
    } catch (error) {
      console.error('Eligibility check failed:', error);
      toast.error('Fehler bei der Berechtigungsprüfung');
    } finally {
      setLoading(false);
    }
  };

  const calculatePlan = async (installments) => {
    try {
      const res = await fetch(`${API}/api/bnpl/calculate?amount=${amount}&installments=${installments}`);
      const data = await res.json();
      setCalculation(data);
      setSelectedPlan(installments);
    } catch (error) {
      console.error('Calculation failed:', error);
    }
  };

  const createPlan = async () => {
    try {
      setCreating(true);
      const res = await fetch(`${API}/api/bnpl/create-plan?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          total_amount: amount,
          installments: selectedPlan
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Fehler beim Erstellen');
      }

      toast.success(data.message);
      onSuccess?.(data.plan);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Jetzt kaufen, später bezahlen
          </h2>
          <p className="text-emerald-100 mt-1">Ratenzahlung für {itemName}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : !eligibility?.eligible ? (
            <div className="text-center py-6">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white mb-2">Nicht berechtigt</h3>
              <p className="text-slate-400">{eligibility?.reason}</p>
              <Button
                onClick={onClose}
                className="mt-4 bg-slate-700 hover:bg-slate-600"
              >
                Schließen
              </Button>
            </div>
          ) : (
            <>
              {/* Eligibility Info */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <Shield className="w-8 h-8 text-emerald-500" />
                  <div>
                    <p className="text-emerald-400 font-medium">Sie sind berechtigt!</p>
                    <p className="text-slate-400 text-sm">
                      Kreditlimit: €{eligibility.max_amount?.toFixed(2)} • 
                      Score: {eligibility.credit_score}/100
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div className="text-center mb-6">
                <p className="text-slate-400">Gesamtbetrag</p>
                <p className="text-3xl font-bold text-white">€{amount?.toFixed(2)}</p>
              </div>

              {/* Plan Selection */}
              <div className="space-y-3 mb-6">
                <p className="text-slate-400 text-sm font-medium">Wählen Sie Ihre Raten:</p>
                
                {[3, 6, 12].map((months) => {
                  const interest = months === 3 ? 0 : months === 6 ? 2.9 : 5.9;
                  const total = amount * (1 + interest / 100);
                  const monthly = total / months;
                  
                  return (
                    <button
                      key={months}
                      onClick={() => calculatePlan(months)}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                        selectedPlan === months
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-white font-medium">{months} Raten</p>
                        <p className="text-slate-400 text-sm">
                          {interest === 0 ? '0% Zinsen' : `${interest}% Zinsen`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold">€{monthly.toFixed(2)}/Monat</p>
                        {interest > 0 && (
                          <p className="text-slate-500 text-xs">Gesamt: €{total.toFixed(2)}</p>
                        )}
                      </div>
                      {selectedPlan === months && (
                        <CheckCircle className="w-5 h-5 text-emerald-500 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Calculation Summary */}
              {calculation && (
                <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Originalbetrag</span>
                    <span className="text-white">€{calculation.original_amount?.toFixed(2)}</span>
                  </div>
                  {calculation.interest_amount > 0 && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Zinsen ({calculation.interest_rate}%)</span>
                      <span className="text-white">€{calculation.interest_amount?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-2 border-t border-slate-600">
                    <span className="text-white">Gesamtbetrag</span>
                    <span className="text-emerald-400">€{calculation.total_amount?.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Payment Schedule */}
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
                <Calendar className="w-4 h-4" />
                <span>Erste Rate fällig in 30 Tagen</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-slate-600 text-slate-300"
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={createPlan}
                  disabled={creating || amount > eligibility.max_amount}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2" />
                  )}
                  Ratenzahlung starten
                </Button>
              </div>

              {/* Terms */}
              <p className="text-slate-500 text-xs text-center mt-4">
                Mit dem Klick auf "Ratenzahlung starten" stimmen Sie unseren 
                Ratenzahlungsbedingungen zu.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
