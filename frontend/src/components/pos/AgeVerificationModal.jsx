import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Altersverifikation für altersbeschränkte Produkte (FSK/Alkohol/Tabak).
 * Ruft POST /api/pos/age-verify auf.
 */
export function AgeVerificationModal({ isOpen, onClose, productId, requiredAge = 18, onVerified }) {
  const [birthYear, setBirthYear] = useState('');
  const [idChecked, setIdChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    if (!birthYear || birthYear.length !== 4) {
      setError('Geburtsjahr (4-stellig) erforderlich');
      return;
    }
    if (!idChecked) {
      setError('Ausweis muss bestätigt werden');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/pos/age-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          product_id: productId,
          birth_year: parseInt(birthYear, 10),
          id_checked: idChecked,
          required_age: requiredAge,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Verifizierung fehlgeschlagen');
      if (data.allowed) {
        setVerified(true);
        onVerified?.(data);
        setTimeout(() => onClose(), 1200);
      } else {
        setError(`Altersprüfung negativ: Mindestalter ${requiredAge} nicht erreicht`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" data-testid="age-verify-modal">
      <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Altersverifikation (FSK {requiredAge})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white" data-testid="age-verify-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {verified ? (
          <div className="flex items-center gap-2 text-green-400 py-8 justify-center" data-testid="age-verify-success">
            <CheckCircle className="w-6 h-6" />
            <span className="font-semibold">Altersfreigabe bestätigt</span>
          </div>
        ) : (
          <>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-sm text-amber-200">
              Dieses Produkt ist altersbeschränkt. Bitte Ausweis prüfen!
            </div>

            <label className="block text-sm text-gray-300 mb-1">Geburtsjahr</label>
            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              maxLength={4}
              data-testid="age-verify-birthyear"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="JJJJ"
            />

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={idChecked}
                onChange={(e) => setIdChecked(e.target.checked)}
                data-testid="age-verify-id-check"
                className="mt-1"
              />
              <span className="text-sm text-gray-300">
                Ich habe den Ausweis (Personalausweis/Reisepass) des Kunden geprüft.
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                <AlertCircle className="w-4 h-4" />
                <span data-testid="age-verify-error">{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={handleVerify}
                disabled={loading}
                data-testid="age-verify-confirm"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Verifizieren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AgeVerificationModal;
